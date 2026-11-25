/**
 * COMFIT 이벤트 접수 서버 (Google Apps Script)
 *
 * 사이트의 이벤트 참여 페이지(join.html)에서 보낸 내용을
 *   - 이 스프레드시트의 "접수" 시트에 한 줄씩 기록하고 (이름·연락처·설문 답 원본)
 *   - 첨부한 리포트 파일은 내 Google 드라이브의 "COMFIT 이벤트 리포트" 폴더에 저장합니다.
 * setup()을 실행하면 사업계획서용 시트 두 개도 만듭니다.
 *   - "집계": 문항별 응답 수·비율·평균·긍정 응답률이 자동 계산됩니다 (새 접수가 들어오면 바로 바뀜)
 *   - "통계용": 이름·이메일·휴대폰을 뺀 설문 응답만 보입니다 (다른 사람에게 보여 주거나 내려받을 때 이것만)
 * 파일과 시트는 나(운영자)만 볼 수 있습니다. 공유 설정을 바꾸지 마세요.
 *
 * 설치 방법: 저장소의 docs/이벤트-접수-설정.md
 */

const SETTINGS = {
  OPEN: true,                 // false로 바꾸면 접수를 받지 않습니다 (바꾼 뒤 "배포 관리 → 새 버전"으로 다시 배포)
  SHEET_NAME: '접수',
  SUMMARY_NAME: '집계',
  STATS_NAME: '통계용',
  FOLDER_NAME: 'COMFIT 이벤트 리포트',
  MAX_FILE_MB: 10,            // 사이트 config.js 의 maxFileMB 와 같게
  ALLOWED_EXT: ['pdf', 'json', 'zip', 'html', 'htm', 'txt', 'png', 'jpg', 'jpeg', 'webp'],
  ONE_PER_PERSON: true,       // 같은 이메일 또는 같은 휴대폰 번호로 두 번 참여 못 하게
  NOTIFY: true,               // 접수될 때마다 내 메일로 알림 (Gmail 무료 계정은 하루 100통까지)
  MAX_PER_HOUR: 300           // 1시간에 받는 최대 건수 (스팸이 몰릴 때 막는 안전장치)
};

/* 설문 문항: 사이트 web/join.html 의 QUESTIONS와 보기 글자까지 똑같아야 합니다.
   scale = 5점 척도 (시트에는 숫자로 저장: 5 매우 그렇다 · 4 그렇다 · 3 보통이다 · 2 그렇지 않다 · 1 전혀 그렇지 않다) */
const SCALE = ['매우 그렇다', '그렇다', '보통이다', '그렇지 않다', '전혀 그렇지 않다'];
const QUESTIONS = [
  { id: 'q1', type: 'one', head: 'Q1 중고 거래 경험(1년)', text: '지난 1년 동안 중고 PC나 PC 부품을 사거나 판 적이 있나요?',
    opts: ['사 본 적 있다', '팔아 본 적 있다', '둘 다 있다', '없다'] },
  { id: 'q2', type: 'one', head: 'Q2 1년 거래 금액', text: '지난 1년 동안 중고 PC·부품을 사거나 판 금액은 모두 얼마쯤인가요?',
    opts: ['거래하지 않았다', '10만 원 미만', '10만~30만 원 미만', '30만~50만 원 미만', '50만~100만 원 미만', '100만 원 이상'],
    mid: [0, 5, 20, 40, 75, 150] },   // 평균 거래액(만 원) 추정에 쓰는 구간 가운데 값. 100만 원 이상은 150으로 가정
  { id: 'q3', type: 'scale', head: 'Q3 거래 어려움 경험(1~5)', text: 'PC 부품을 거래하면서 어려움을 겪은 적이 있다.' },
  { id: 'q4', type: 'multi', max: 3, none: '특별히 없다', head: 'Q4 어렵거나 걱정되는 점', text: '중고 PC·부품을 거래할 때 가장 어렵거나 걱정되는 점은 무엇인가요? (최대 3개)',
    opts: ['부품 상태·고장 여부를 확인하기 어렵다', '적정 가격을 판단하기 어렵다', '설명과 다른 물건이 올 수 있다', '혹사·채굴 등 사용 이력을 알 수 없다', '사기·미입금이 걱정된다', '거래 뒤 문제가 생기면 해결하기 어렵다', '특별히 없다'] },
  { id: 'q5', type: 'scale', head: 'Q5 불신으로 거래 포기(1~5)', text: '부품 상태를 믿기 어려워 중고 거래를 망설이거나 포기한 적이 있다.' },
  { id: 'q6', type: 'scale', head: 'Q6 객관 지표 중개 사이트 필요(1~5)', text: 'PC 부품과 중고 PC를 객관적인 지표로 거래할 수 있는 중개 거래 사이트가 있으면 좋을 것 같다.' },
  { id: 'q7', type: 'scale', head: 'Q7 중개 사이트 이용 의향(1~5)', text: '그런 중개 거래 사이트가 생기면 실제로 이용하겠다.' },
  { id: 'q8', type: 'one', head: 'Q8 검증 매물 추가 지불', text: '검진 리포트로 상태가 확인된 매물이라면, 일반 중고 시세보다 얼마까지 더 낼 수 있나요?',
    opts: ['더 낼 생각 없다', '3% 이내', '3~5%', '5~10%', '10%보다 더'] },
  { id: 'q9', type: 'scale', head: 'Q9 검진 만족(1~5)', text: 'COMFIT 검진에 만족한다.' },
  { id: 'q10', type: 'scale', head: 'Q10 유료 리포트 지불 의사(1~5)', text: 'COMFIT 진단 리포트를 유료화(1,000~3,000원)하면 돈을 내고 이용할 의사가 있다.' },
  { id: 'q11', type: 'multi', max: 2, head: 'Q11 이용하고 싶은 서비스', text: 'COMFIT 사이트에서 가장 이용하고 싶은 서비스는 무엇인가요? (최대 2개)',
    opts: ['진단 리포트 보관·공유 (링크·QR)', '상태가 확인된 중고 매물 구매 (SHOP)', '내 부품 판매 (장터)', '부품 시세 조회', '업그레이드·교체 추천'] },
  { id: 'q12', type: 'scale', head: 'Q12 추천 의향(1~5)', text: 'COMFIT을 주변 사람에게 추천하겠다.' }
];
const PERSONAL = ['접수번호', '접수시각', '이름', '이메일', '휴대폰'];
const HEADERS = PERSONAL.concat(QUESTIONS.map(function (q) { return q.head; }),
  ['자유 의견', '약관 동의', '개인정보 동의', '통계 활용 동의', '만 14세·본인 리포트 확인', '소식 수신 동의',
   '리포트 파일 이름', '리포트 링크(운영자만 열림)', '파일 크기(KB)']);
const COL = { email: 4, phone: 5, firstQ: 6 };   // 1부터 세는 열 번호
const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  json: 'application/json', txt: 'text/plain', zip: 'application/zip' }; // html/htm 은 열리지 않게 일반 파일로 저장

/** 처음 한 번 실행: 시트 머리줄, 집계·통계용 시트, 드라이브 폴더를 만듭니다. 문항을 바꾼 뒤에도 다시 실행하세요. */
function setup() {
  sheet_();
  buildSummary_();
  buildStats_();
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

  const name = text_(d.name, 20);
  const email = String(d.email || '').trim().toLowerCase().slice(0, 100);
  const phoneDigits = String(d.phone || '').replace(/\D/g, '');
  if (name.length < 2) return fail_('이름을 2~20자로 적어 주세요.');
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(email)) return fail_('이메일 주소를 확인해 주세요.');
  if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) return fail_('휴대폰 번호를 확인해 주세요.');
  const phone = phoneDigits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
  if (d.agreeTerms !== true || d.agreePrivacy !== true || d.agreeStats !== true || d.agreeAge !== true) return fail_('필수 항목에 모두 동의해 주세요.');

  // 설문: 정해진 보기만 저장
  const ans = (d.answers && typeof d.answers === 'object') ? d.answers : {};
  const cells = [], missing = [];
  QUESTIONS.forEach(function (q) {
    const v = ans[q.id];
    let out = '';
    if (q.type === 'scale') out = [1, 2, 3, 4, 5].indexOf(Number(v)) >= 0 ? Number(v) : '';
    else if (q.type === 'one') out = pick_(v, q.opts);
    else {
      let list = (Array.isArray(v) ? v : []).filter(function (x, i, arr) { return q.opts.indexOf(x) >= 0 && arr.indexOf(x) === i; });
      if (q.none && list.indexOf(q.none) >= 0) list = [q.none];
      if (list.length > q.max) return missing.push(q.id.slice(1));
      out = list.join(', ');
    }
    if (out === '') missing.push(q.id.slice(1));
    cells.push(out);
  });
  if (missing.length) return fail_('설문 ' + missing.join(', ') + '번 답을 확인해 주세요.');
  const note = text_(d.note, 500);

  // 파일 검사
  const f = d.file || {};
  const fileName = String(f.name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(-80);
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (!fileName || SETTINGS.ALLOWED_EXT.indexOf(ext) < 0) return fail_('올릴 수 없는 파일 형식입니다.');
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
  if (cache.get('e:' + email) || cache.get('p:' + phoneDigits)) return fail_('방금 접수된 정보입니다. 잠시 뒤에 확인해 주세요.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return fail_('지금 접수가 몰리고 있습니다. 잠시 뒤 다시 시도해 주세요.');
  let id;
  try {
    const sh = sheet_();
    if (SETTINGS.ONE_PER_PERSON) {
      const used = used_(sh, email, phone);
      if (used) return fail_('이미 이 ' + used + '(으)로 참여하셨습니다. 한 사람당 한 번만 참여할 수 있습니다.');
    }
    id = newId_();
    const blob = Utilities.newBlob(bytes, MIME[ext] || 'application/octet-stream', id + '_' + fileName);
    const file = folder_().createFile(blob);
    sh.appendRow([id, new Date(), name, email, phone].concat(cells,
      [note, '동의', '동의', '동의', '확인', d.agreeMarketing === true ? '동의' : '미동의',
       fileName, file.getUrl(), Math.max(1, Math.ceil(bytes.length / 1024))]).map(cell_));
    cache.put(hourKey, String(n + 1), 3700);
    cache.put('e:' + email, '1', 120);
    cache.put('p:' + phoneDigits, '1', 120);
  } finally {
    lock.releaseLock();
  }

  if (SETTINGS.NOTIFY) {
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '[COMFIT] 이벤트 접수 ' + id,
        '새 참여가 접수되었습니다.\n\n접수번호: ' + id + '\n이름: ' + name + '\n파일: ' + fileName +
        '\n\n전체 목록은 접수 스프레드시트에서 확인하세요.\n' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
    } catch (x) { console.warn('알림 메일 실패(하루 한도 초과일 수 있음): ' + x); }
  }
  return { ok: true, id: id };
}

/* ---------- 도우미 ---------- */
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SETTINGS.SHEET_NAME);
  if (sh && sh.getLastRow() > 0) {
    const cur = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].join('|');
    if (cur !== HEADERS.join('|')) {
      // 예전 양식의 시트는 지우지 않고 이름만 바꿔 둔다 (새 양식은 새 시트에)
      sh.setName(SETTINGS.SHEET_NAME + '(이전 양식 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MMdd-HHmm') + ')');
      sh = null;
    }
  }
  if (!sh) sh = ss.insertSheet(SETTINGS.SHEET_NAME, 0);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setWrap(true);
    sh.getRange(2, COL.phone, sh.getMaxRows() - 1, 1).setNumberFormat('@');  // 휴대폰 번호 앞의 0이 사라지지 않게
  }
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
/** 이미 참여한 이메일·휴대폰이면 그 이름('이메일'/'휴대폰 번호')을 돌려준다 */
function used_(sh, email, phone) {
  const last = sh.getLastRow();
  if (last < 2) return '';
  const vals = sh.getRange(2, COL.email, last - 1, 2).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).replace(/^'/, '').toLowerCase() === email) return '이메일';
    if (String(vals[i][1]).replace(/^'/, '') === phone) return '휴대폰 번호';
  }
  return '';
}

/* ---------- 사업계획서용 시트 ---------- */
function colA1_(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function esc_(t) { return String(t).replace(/"/g, '""'); }

/** "집계" 시트: 수식으로 계산하므로 새 접수가 들어오면 자동으로 바뀝니다. */
function buildSummary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SETTINGS.SUMMARY_NAME) || ss.insertSheet(SETTINGS.SUMMARY_NAME, 1);
  sh.clear();
  const src = "'" + SETTINGS.SHEET_NAME + "'!";
  const N = 'COUNTA(' + src + 'A2:A)';                        // 전체 응답자 수
  const rows = [];   // [A, B, C, D] = 항목, 값(수식), 비율(수식), 메모
  const fmtPct = [];
  rows.push(['COMFIT 이벤트 설문 집계', '', '', '이 시트는 수식으로 자동 계산됩니다. 고치지 마세요. (문항을 바꾸면 Apps Script에서 setup 다시 실행)']);
  rows.push(['전체 응답자 수(명)', '=' + N, '', '사업계획서에는 "조사 대상: 이벤트 참여자 N명, 조사 기간"을 함께 적으세요']);
  rows.push(['조사 기간', '=IF(' + N + '=0,"",TEXT(MIN(' + src + 'B2:B),"yyyy. m. d.")&" ~ "&TEXT(MAX(' + src + 'B2:B),"yyyy. m. d."))', '', '']);
  rows.push(['', '', '', '']);
  QUESTIONS.forEach(function (q, i) {
    const c = colA1_(COL.firstQ + i), r = src + c + '2:' + c;
    rows.push([q.head.replace(/\(1~5\)$/, '') + ' — ' + q.text, '응답 수', '비율', q.type === 'multi' ? '여러 개 고른 문항이라 비율 합이 100%를 넘습니다' : '']);
    if (q.type === 'scale') {
      const cnt = 'COUNT(' + r + ')';
      SCALE.forEach(function (label, k) {
        const n = 5 - k;
        rows.push(['  ' + n + ' ' + label, '=COUNTIF(' + r + ',' + n + ')', '=IFERROR(B' + (rows.length + 1) + '/' + cnt + ',0)', '']); fmtPct.push(rows.length);
      });
      rows.push(['  ▶ 긍정 응답률 (매우 그렇다 + 그렇다)', '=COUNTIF(' + r + ',">=4")', '=IFERROR(B' + (rows.length + 1) + '/' + cnt + ',0)', '사업계획서에 쓰는 핵심 수치']); fmtPct.push(rows.length);
      rows.push(['  ▶ 부정 응답률 (그렇지 않다 + 전혀 그렇지 않다)', '=COUNTIF(' + r + ',"<=2")', '=IFERROR(B' + (rows.length + 1) + '/' + cnt + ',0)', '']); fmtPct.push(rows.length);
      rows.push(['  ▶ 평균 (5점 만점)', '=IFERROR(ROUND(AVERAGE(' + r + '),2),"")', '', '']);
    } else {
      q.opts.forEach(function (label) {
        const f = q.type === 'one'
          ? '=SUMPRODUCT(--(' + r + '="' + esc_(label) + '"))'
          : '=SUMPRODUCT(--ISNUMBER(FIND(", ' + esc_(label) + ',", ", "&' + r + '&",")))';
        rows.push(['  ' + label, f, '=IFERROR(B' + (rows.length + 1) + '/' + N + ',0)', '']); fmtPct.push(rows.length);
      });
      if (q.mid) {
        const parts = q.opts.map(function (label, k) { return 'SUMPRODUCT(--(' + r + '="' + esc_(label) + '"))*' + q.mid[k]; }).join('+');
        rows.push(['  ▶ 1인 평균 거래액 추정(만 원)', '=IFERROR(ROUND((' + parts + ')/' + N + ',1),"")', '', '구간 가운데 값으로 계산한 추정치 (100만 원 이상은 150만 원으로 가정)']);
      }
    }
    rows.push(['', '', '', '']);
  });
  rows.push(['소식 수신 동의(명)', '=COUNTIF(' + src + colA1_(HEADERS.indexOf('소식 수신 동의') + 1) + '2:' + colA1_(HEADERS.indexOf('소식 수신 동의') + 1) + ',"동의")', '', '출시 알림을 보낼 수 있는 잠재 고객 수']);
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  fmtPct.forEach(function (r) { sh.getRange(r, 3).setNumberFormat('0.0%'); });
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  rows.forEach(function (row, k) { if (/^Q\d+ /.test(row[0])) sh.getRange(k + 1, 1, 1, 4).setFontWeight('bold').setBackground('#F4F4F5'); });
  sh.setColumnWidth(1, 520); sh.setColumnWidth(2, 90); sh.setColumnWidth(3, 80); sh.setColumnWidth(4, 420);
  sh.setFrozenRows(3);
}

/** "통계용" 시트: 이름·이메일·휴대폰·리포트 링크를 뺀 설문 응답만 (원본을 실시간으로 보여 줌) */
function buildStats_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SETTINGS.STATS_NAME) || ss.insertSheet(SETTINGS.STATS_NAME, 2);
  sh.clear();
  const src = "'" + SETTINGS.SHEET_NAME + "'!";
  const first = colA1_(COL.firstQ), lastQ = colA1_(COL.firstQ + QUESTIONS.length - 1);
  const noteCol = colA1_(COL.firstQ + QUESTIONS.length);
  // 응답 순번, 접수 날짜, Q1~Q12, 자유 의견
  sh.getRange(1, 1).setFormula('={"응답 순번","접수 날짜",' + QUESTIONS.map(function (q) { return '"' + esc_(q.head) + '"'; }).join(',') + ',"자유 의견"}');
  sh.getRange(2, 1).setFormula('=ARRAYFORMULA(IF(' + src + 'A2:A="",,ROW(' + src + 'A2:A)-1))');
  sh.getRange(2, 2).setFormula('=ARRAYFORMULA(IF(' + src + 'A2:A="",,TO_DATE(INT(' + src + 'B2:B))))');
  sh.getRange(2, 3).setFormula('=ARRAYFORMULA(IF(' + src + 'A2:A="",,' + src + first + '2:' + lastQ + '))');
  sh.getRange(2, 3 + QUESTIONS.length).setFormula('=ARRAYFORMULA(IF(' + src + 'A2:A="",,' + src + noteCol + '2:' + noteCol + '))');
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, QUESTIONS.length + 3).setFontWeight('bold').setWrap(true);
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
