/**
 * COMFIT 이벤트 접수 서버 (Google Apps Script)
 *
 * 사이트의 이벤트 참여 페이지(join.html)에서 보낸 내용을
 *   - 이 스프레드시트의 "접수" 시트에 한 줄씩 기록하고
 *   - 첨부한 리포트 파일은 내 Google 드라이브의 "COMFIT 이벤트 리포트" 폴더에 저장합니다.
 * 파일과 시트는 나(운영자)만 볼 수 있습니다. 공유 설정을 바꾸지 마세요.
 *
 * 설치 방법: 저장소의 docs/이벤트-접수-설정.md
 */

const SETTINGS = {
  OPEN: true,                 // false로 바꾸면 접수를 받지 않습니다 (바꾼 뒤 "배포 관리 → 새 버전"으로 다시 배포)
  SHEET_NAME: '접수',
  FOLDER_NAME: 'COMFIT 이벤트 리포트',
  MAX_FILE_MB: 10,            // 사이트 config.js 의 maxFileMB 와 같게
  ALLOWED_EXT: ['pdf', 'json', 'zip', 'html', 'htm', 'txt', 'png', 'jpg', 'jpeg', 'webp'],
  ONE_PER_EMAIL: true,        // 같은 이메일로 두 번 참여 못 하게
  NOTIFY: true,               // 접수될 때마다 내 메일로 알림 (Gmail 무료 계정은 하루 100통까지)
  MAX_PER_HOUR: 300           // 1시간에 받는 최대 건수 (스팸이 몰릴 때 막는 안전장치)
};

const Q1 = ['게임', '사무·공부', '영상·디자인 작업', '기타'];
const Q2 = ['느려졌다', '팬 소음이 크다', '뜨겁다', '갑자기 꺼지거나 멈춘다', '특별한 증상 없음'];
const Q3 = ['산 적 있다', '판 적 있다', '둘 다 있다', '없다'];
const Q5 = ['쓰고 싶다', '잘 모르겠다', '필요 없다'];
const HEADERS = ['접수번호', '접수시각', '닉네임', '이메일', 'PC 용도', '증상', '중고 거래 경험', '결과표 활용 의향(1~5)',
  '공유 기능 관심', '바라는 점', '소식 수신 동의', '리포트 파일 이름', '리포트 링크(운영자만 열림)', '파일 크기(KB)'];
const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  json: 'application/json', txt: 'text/plain', zip: 'application/zip' }; // html/htm 은 열리지 않게 일반 파일로 저장

/** 처음 한 번 실행: 시트 머리줄과 드라이브 폴더를 만듭니다. */
function setup() {
  sheet_();
  const folder = folder_();
  Logger.log('준비 완료. 리포트 폴더: ' + folder.getUrl());
}

function doGet() {
  return json_({ ok: true, message: 'COMFIT 이벤트 접수 서버가 동작 중입니다.' });
}

function doPost(e) {
  try {
    return json_(handle_(e));
  } catch (err) {
    console.error(err && err.stack || err);
    return json_({ ok: false, message: '접수 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.' });
  }
}

function handle_(e) {
  if (!SETTINGS.OPEN) return fail_('이벤트 접수가 마감되었습니다.');
  const raw = e && e.postData && e.postData.contents;
  if (!raw) return fail_('잘못된 요청입니다.');
  if (raw.length > SETTINGS.MAX_FILE_MB * 1024 * 1024 * 1.4 + 20000) return fail_('파일이 너무 큽니다. ' + SETTINGS.MAX_FILE_MB + 'MB 이하로 올려 주세요.');

  let d;
  try { d = JSON.parse(raw); } catch (x) { return fail_('잘못된 요청입니다.'); }
  if (!d || typeof d !== 'object') return fail_('잘못된 요청입니다.');

  // 사람 눈에는 안 보이는 칸(website)에 값이 있으면 자동 프로그램(봇)으로 보고 조용히 버린다
  if (d.website) return { ok: true, id: 'CF-RECEIVED' };

  const nick = text_(d.nick, 20);
  const email = String(d.email || '').trim().toLowerCase().slice(0, 100);
  if (nick.length < 2) return fail_('닉네임을 2~20자로 적어 주세요.');
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(email)) return fail_('이메일 주소를 확인해 주세요.');
  if (d.agreePrivacy !== true || d.agreeAge !== true) return fail_('필수 항목에 동의해 주세요.');

  const q1 = pick_(d.q1, Q1), q3 = pick_(d.q3, Q3), q5 = pick_(d.q5, Q5);
  const q2 = (Array.isArray(d.q2) ? d.q2 : []).filter(function (v) { return Q2.indexOf(v) >= 0; });
  const q4 = [1, 2, 3, 4, 5].indexOf(Number(d.q4)) >= 0 ? Number(d.q4) : 0;
  if (!q1 || !q2.length || !q3 || !q4 || !q5) return fail_('설문 1~5번에 모두 답해 주세요.');
  const q6 = text_(d.q6, 500);

  // 파일 검사
  const f = d.file || {};
  const name = String(f.name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(-80);
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (!name || SETTINGS.ALLOWED_EXT.indexOf(ext) < 0) return fail_('올릴 수 없는 파일 형식입니다.');
  let bytes;
  try { bytes = Utilities.base64Decode(String(f.data || '')); } catch (x) { return fail_('파일을 읽지 못했습니다. 다시 첨부해 주세요.'); }
  if (!bytes.length) return fail_('빈 파일입니다.');
  if (bytes.length > SETTINGS.MAX_FILE_MB * 1024 * 1024) return fail_('파일이 너무 큽니다. ' + SETTINGS.MAX_FILE_MB + 'MB 이하로 올려 주세요.');
  if (!magicOk_(ext, bytes)) return fail_('파일 내용이 확장자와 맞지 않습니다. 검진 프로그램이 만든 파일을 그대로 올려 주세요.');

  // 몰림 방지
  const cache = CacheService.getScriptCache();
  const hourKey = 'n' + Math.floor(Date.now() / 3600000);
  const n = Number(cache.get(hourKey) || 0);
  if (n >= SETTINGS.MAX_PER_HOUR) return fail_('지금 접수가 몰리고 있습니다. 잠시 뒤 다시 시도해 주세요.');
  if (cache.get('e:' + email)) return fail_('방금 접수된 이메일입니다. 잠시 뒤에 확인해 주세요.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return fail_('지금 접수가 몰리고 있습니다. 잠시 뒤 다시 시도해 주세요.');
  let id;
  try {
    const sh = sheet_();
    if (SETTINGS.ONE_PER_EMAIL && emailUsed_(sh, email)) return fail_('이미 이 이메일로 참여하셨습니다. 한 사람당 한 번만 참여할 수 있습니다.');
    id = newId_();
    const blob = Utilities.newBlob(bytes, MIME[ext] || 'application/octet-stream', id + '_' + name);
    const file = folder_().createFile(blob);
    sh.appendRow([id, new Date(), nick, email, q1, q2.join(', '), q3, q4, q5, q6, d.agreeMarketing === true ? '동의' : '미동의',
      name, file.getUrl(), Math.max(1, Math.ceil(bytes.length / 1024))].map(cell_));
    cache.put(hourKey, String(n + 1), 3700);
    cache.put('e:' + email, '1', 120);
  } finally {
    lock.releaseLock();
  }

  if (SETTINGS.NOTIFY) {
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '[COMFIT] 이벤트 접수 ' + id,
        '새 참여가 접수되었습니다.\n\n접수번호: ' + id + '\n닉네임: ' + nick + '\n파일: ' + name +
        '\n\n전체 목록은 접수 스프레드시트에서 확인하세요.\n' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
    } catch (x) { console.warn('알림 메일 실패(하루 한도 초과일 수 있음): ' + x); }
  }
  return { ok: true, id: id };
}

/* ---------- 도우미 ---------- */
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SETTINGS.SHEET_NAME) || ss.insertSheet(SETTINGS.SHEET_NAME);
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}
function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (x) { /* 지워졌으면 새로 만든다 */ } }
  const f = DriveApp.createFolder(SETTINGS.FOLDER_NAME);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}
function emailUsed_(sh, email) {
  const last = sh.getLastRow();
  if (last < 2) return false;
  const vals = sh.getRange(2, 4, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]).replace(/^'/, '').toLowerCase() === email) return true;
  return false;
}
function newId_() {
  const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMdd');
  const r = Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  return 'EV-' + day + '-' + r;
}
function text_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}
function pick_(v, list) { return list.indexOf(v) >= 0 ? v : ''; }
/** 스프레드시트 수식 주입 방지: = + - @ 로 시작하는 글은 글자로만 저장 */
function cell_(v) {
  if (typeof v !== 'string') return v;
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}
function magicOk_(ext, b) {
  const h = function (i) { return (b[i] + 256) % 256; };
  if (ext === 'pdf') return h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46;
  if (ext === 'png') return h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47;
  if (ext === 'jpg' || ext === 'jpeg') return h(0) === 0xff && h(1) === 0xd8;
  if (ext === 'zip') return h(0) === 0x50 && h(1) === 0x4b;
  if (ext === 'webp') return h(8) === 0x57 && h(9) === 0x45 && h(10) === 0x42 && h(11) === 0x50;
  // 글자 파일(json/html/txt): 실행 파일(MZ)이 아닌지만 본다
  return !(h(0) === 0x4d && h(1) === 0x5a);
}
function fail_(message) { return { ok: false, message: message }; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
