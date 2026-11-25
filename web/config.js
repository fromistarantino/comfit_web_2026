/* ============================================================
   COMFIT 사이트 설정 파일
   자주 바꾸는 값(이벤트 기간, 경품, 다운로드 주소, 접수 주소, 사업자 정보)은
   전부 여기에 모여 있습니다. 이 파일만 고치면 모든 페이지(PC·모바일)에 반영됩니다.

   고치는 규칙
   - 작은따옴표 '...' 안의 글자만 바꾸세요. 따옴표와 끝의 쉼표(,)는 지우지 마세요.
   - 글 안에 작은따옴표(')를 써야 하면 앞에 \ 를 붙이세요.  예: 'COMFIT\'s'
   - 목록 [ ... ] 은 줄을 늘리거나 줄여도 됩니다. 각 줄 끝의 쉼표를 지키세요.
   - 자세한 방법: 저장소의 docs/글-수정-방법.md
   ============================================================ */
window.COMFIT = {

  /* ---------- 이벤트 ---------- */
  eventName: 'PC 건강검진 DAY',
  eventPeriod: '2026. 11. 20(금) ~ 11. 30(월)',
  eventAnnounce: '2026. 12. 4(금) · 당첨자에게 이메일·문자로 개별 안내',
  eventTarget: '만 14세 이상, Windows PC를 가진 누구나 (1인 1회)',

  // 접수를 받는 중이면 true, 마감하면 false (false면 참여 양식 대신 "마감" 안내가 나옵니다)
  eventOpen: true,

  // 경품 목록 (이벤트 안내·참여 페이지에 그대로 나옵니다)
  prizes: [
    'MSI 지포스 RTX 5060 벤투스 2X OC V1 D7 8GB',
    'ESSENCORE KLEVV DDR5-5600 16GB',
    '컴퓨터 케이스, 쿨러 등'
  ],

  // 당첨자가 배송 정보를 회신해야 하는 기간(일). 넘기면 당첨 취소·재추첨 (참여 약관에 나옵니다)
  replyDays: 7,
  // 경품 제세공과금 안내 (참여 약관에 나옵니다). 부담 주체를 정했으면 바꾸세요.
  //   운영자가 부담할 때 예: '경품 가액이 5만 원을 넘으면 생기는 제세공과금(22%)은 운영자가 부담합니다. 세금 신고를 위해 당첨자에게 신분 확인 정보를 따로 받을 수 있습니다.'
  prizeTaxNote: '경품 가액이 5만 원을 넘으면 생기는 제세공과금(경품 가액의 22%)은 운영자가 부담합니다. 세금 신고를 위해 당첨자에게 신분 확인 정보를 따로 받을 수 있으며, 신고가 끝나면 법령에서 정한 기간만 보관합니다.',

  // 참여자 개인정보를 보관하는 기간 (참여 양식의 동의 문구에 나옵니다)
  retention: '이벤트 종료 후 3개월까지 보관한 뒤 파기',

  /* ---------- 이벤트 접수 주소 ----------
     Google Apps Script를 배포하고 받은 "웹 앱 URL"을 붙여 넣으세요.
     (https://script.google.com/macros/s/..../exec 형태)
     비워 두면 참여 양식의 제출 버튼이 "접수 준비 중"으로 막힙니다.
     설정 방법: docs/이벤트-접수-설정.md */
  formEndpoint: '',

  // 첨부 파일 최대 크기(MB). Apps Script 쪽 MAX_FILE_MB와 같게 맞추세요.
  maxFileMB: 10,

  /* ---------- 검진 프로그램 다운로드 ----------
     autoRelease가 true면 사이트를 배포할 때 이 저장소의 GitHub Releases에서
     최신 릴리스를 읽어 아래 값(주소·버전·출시일·크기·SHA-256)을 자동으로 채웁니다.
     새 릴리스를 공개하면 사이트도 자동으로 다시 배포됩니다.
     방법: docs/프로그램-배포-방법.md
     릴리스가 아직 없으면 아래에 직접 적은 값이 쓰입니다. */
  autoRelease: true,
  // 정식 배포 전 베타(Releases에서 "Set as a pre-release"로 공개한 것)도 다운로드에 보여 줄지.
  // true면 정식·베타 중 가장 최근 것이 나오고, 베타면 다운로드 페이지에 "베타" 표시가 붙습니다.
  // 정식 버전을 공개한 뒤 베타를 숨기려면 false로 바꾸세요.
  includePrerelease: true,
  // 릴리스에 파일이 여러 개일 때 설치 파일 이름에 들어가는 글자 (비우면 .exe → .msi → .msix → .zip 순서로 고름)
  releaseAsset: '',

  // 직접 적는 값 (autoRelease가 false이거나 릴리스가 없을 때)
  // 프로그램 파일 주소 (https:// 로 시작). 비워 두면 다운로드 버튼이 "준비 중"으로 표시됩니다.
  downloadUrl: '',
  programVersion: '',          // 예: 'v0.5.0'
  programDate: '',             // 예: '2026. 11. 19.'
  programSize: '',             // 예: '24 MB'
  programOS: 'Windows 10 이상 (64비트)',
  programSha256: '',           // 파일의 SHA-256 값 (없으면 비워 두세요)
  releaseNotesUrl: '',         // 변경 내역 페이지 주소 (없으면 비워 두세요)
  programPrerelease: false,    // 베타(정식 배포 전) 파일이면 true

  /* ---------- 연락처·운영자 정보 (모든 페이지 맨 아래에 나옵니다) ---------- */
  contactEmail: '',            // 예: 'help@comfit.kr'  (비우면 표시하지 않음)
  // 맨 아래에 더 적고 싶은 줄 (없으면 비워 둠). 예: '운영 COMFIT 팀 · 개인정보 보호책임자 홍길동'
  footerLines: []
};

/* ============ 아래는 고치지 마세요 (위 값으로 자동 계산) ============ */
(function (c) {
  var safe = function (u) { return /^https:\/\//i.test(String(u || '').trim()) ? String(u).trim() : ''; };
  c.downloadUrl = safe(c.downloadUrl);
  c.formEndpoint = safe(c.formEndpoint);
  c.hasDownload = !!c.downloadUrl; c.noDownload = !c.hasDownload;
  c.hasSha = !!c.programSha256;
  c.isBeta = c.hasDownload && c.programPrerelease === true;
  c.releaseNotesUrl = safe(c.releaseNotesUrl); c.hasNotes = c.hasDownload && !!c.releaseNotesUrl;
  c.hasEmail = !!c.contactEmail; c.mailto = c.hasEmail ? 'mailto:' + c.contactEmail : '';
  // 처리방침·약관에 쓰는 연락처 (비어 있으면 등록 전이라고 표시)
  c.contactText = c.hasEmail ? c.contactEmail : '연락처 이메일 등록 전 — 공지사항으로 알릴 예정';
  c.isOpen = !!c.eventOpen; c.isClosed = !c.isOpen;
  c.hasEndpoint = !!c.formEndpoint;
  c.prizes = c.prizes || []; c.footerLines = c.footerLines || [];
})(window.COMFIT);
