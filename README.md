# COMFIT 웹 사이트

주소: https://comfit.kr/ (도메인 연결 전: https://fromistarantino.github.io/comfit_web_2026/)
이벤트 참여(광고 연결용): https://comfit.kr/join.html

## 운영자용 안내

| 하고 싶은 것 | 문서 |
|---|---|
| 글·이벤트 기간·경품·다운로드 주소 고치기 | [docs/글-수정-방법.md](docs/글-수정-방법.md) — 대부분 `web/config.js` 한 파일 |
| 이벤트 참여 내용 받아 보기 (Google 시트) | [docs/이벤트-접수-설정.md](docs/이벤트-접수-설정.md) |
| 내 도메인 연결 | [docs/도메인-연결.md](docs/도메인-연결.md) — `deploy.json`의 `domain` |
| 아직 정할 것 목록 | [docs/논의-필요.md](docs/논의-필요.md) |

`main`에 고친 내용을 저장(commit)하면 GitHub Actions가 자동으로 배포합니다 (`.github/workflows/deploy.yml`, 2~3분).

### 지금 사이트 상태
- 열려 있음: 홈, 검진 안내, 다운로드, 이벤트 안내(`event.html`), **이벤트 참여(`join.html`)**, 고객센터, 약관
- 준비 중 화면: SHOP(`list`, `product`, `buy`, `sell`, `order`, `search`), 장터, 시세, 로그인·회원가입·마이페이지·계정, 1:1 문의
  (예시 상품·가격·주문 데이터는 모두 지웠습니다)
- `survey.html`은 `join.html`로 넘어갑니다.

### 보안 설정
- 모든 페이지에 Content-Security-Policy: 이 사이트의 스크립트만 실행, 외부로는 이벤트 접수 서버(Google Apps Script)에만 전송, 폼 전송·플러그인·외부 틀 차단
- 다른 사이트가 iframe으로 감싸면 화면을 숨김 (클릭 가로채기 방지)
- 비밀번호 입력란 등 가짜 로그인 양식 제거, 외부 스크립트·추적 코드 없음
- 접수 서버: 봇 덫, 이메일당 1회, 시간당 한도, 파일 형식·내용 검사, 시트 수식 주입 방지 (`tools/apps-script/Code.gs`)

## 폴더

| 폴더 | 내용 | 고칠 때 |
|---|---|---|
| `web/` | **PC 웹사이트 전체.** 화면(`index.html` 등 29개 + `404.html`), 공통 스타일 `site.css`, 화면을 그리는 `runtime.js`, 사진·글꼴 `assets/` | 글·사진·PC 배치를 바꿀 때 |
| `mobile/` | **모바일 전용 스타일** `mobile.css`. 화면 폭 720px 이하에서만 적용 | 휴대폰 화면의 배치·크기만 바꿀 때 |
| `tools/` | 배포 폴더 만들기(`deploy.py`), 화면 미리 그리기(`prerender.js`), 이벤트 접수 서버 코드(`apps-script/Code.gs`), 캔버스 변환 스크립트(`canvas/`) | - |

화면의 글과 구조는 PC와 모바일이 같은 html 파일을 씁니다. 글을 한 번만 고치면 양쪽에 반영됩니다.
모바일에서만 보이는 요소(SHOP의 필터 버튼, 약관의 접는 목차, 짧은 안내 띠 문구)도 html 안에 있고,
PC에서는 `site.css`가 숨깁니다.

화면 하나의 구조: `<div id="app">`(비워 둠, 배포 때 자동으로 채움) + `<template id="dc">`(화면 틀) + `<script id="dc-code">`(예시 데이터와 동작).
글을 고칠 때는 **template 쪽**을 고치세요. 자주 바꾸는 값은 `web/config.js`에 있습니다.

## 배포

자동: `main`에 commit 하면 Actions가 아래 과정을 대신 합니다.
수동: 배포 폴더를 만들고, `node tools/prerender.js dist`로 화면을 미리 그린 뒤 `dist/`를 `gh-pages` 브랜치에 올립니다.

```
python3 tools/deploy.py pc     # PC 웹사이트만: 휴대폰에서는 PC 화면이 축소되어 보임
python3 tools/deploy.py all    # PC + 모바일
python3 tools/deploy.py        # deploy.json 의 "mobile" 값대로 (true = all, false = pc)
```

결과는 `dist/`에 생깁니다. `dist/`의 내용이 `gh-pages` 브랜치의 내용이 되면 됩니다.

미리 보기: 저장소 폴더에서 `python3 -m http.server 8000`을 띄우고 `http://localhost:8000/web/` 를 엽니다.

### 검진 프로그램 관련 페이지 (comfit3 저장소와 맞춤, 2026-11-22)
- `web/verify/`: 결과표 진위 확인 페이지 (`https://comfit.kr/verify/`). **원본은 comfit3 저장소의 `web-verify/`** — 확인 코드는 그쪽에서 고치고 시험한 뒤 이 폴더로 복사합니다. 운영 서명 키를 만들면 `keys.json`에 공개 키를 넣습니다 (비밀 키는 절대 넣지 않음).
- 개인정보처리방침·검진 프로그램 이용약관·오픈소스 라이선스·고객센터 요약은 검진 프로그램 1.0.0의 실제 동작에 맞췄습니다 (업로드 항목, 국외 이전, 중단 온도, 저장 위치, 구성 요소).
- 처리방침의 연락처는 `web/config.js`의 `contactEmail` 하나로 정해집니다. 비어 있으면 "연락처 이메일 등록 전"으로 보입니다.
- 업데이트 목록(`/update/latest.json`)은 업데이트 서명 키로 서명한 파일만 올립니다 (서명 없는 파일은 프로그램이 무시함).

## 아직 남아 있는 것
- [docs/논의-필요.md](docs/논의-필요.md) 참고
- 약관·처리방침·공지·FAQ 안의 `[사업자 확인 필요]` 자리 (시행일, 상호, 보호책임자 등)
- 이벤트 페이지 외 나머지 페이지의 `<meta name="robots" content="noindex">` (정식 공개 때 지우기)

## 참고
- `tools/canvas/`는 Claude Design 캔버스에서 처음 변환할 때 쓴 스크립트입니다. 다시 돌리면 `web/`을 덮어쓰므로, 이 저장소에서 고친 내용이 있으면 쓰지 마세요.
