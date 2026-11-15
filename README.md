# COMFIT 웹 사이트

주소: https://fromistarantino.github.io/comfit_web_2026/

## 폴더

| 폴더 | 내용 | 고칠 때 |
|---|---|---|
| `web/` | **PC 웹사이트 전체.** 화면(`index.html` 등 29개 + `404.html`), 공통 스타일 `site.css`, 화면을 그리는 `runtime.js`, 사진·글꼴 `assets/` | 글·사진·PC 배치를 바꿀 때 |
| `mobile/` | **모바일 전용 스타일** `mobile.css`. 화면 폭 720px 이하에서만 적용 | 휴대폰 화면의 배치·크기만 바꿀 때 |
| `tools/` | 배포 폴더 만들기(`deploy.py`), 동작 확인(`check.js`), 캔버스 변환 스크립트(`canvas/`) | - |

화면의 글과 구조는 PC와 모바일이 같은 html 파일을 씁니다. 글을 한 번만 고치면 양쪽에 반영됩니다.
모바일에서만 보이는 요소(SHOP의 필터 버튼, 약관의 접는 목차, 짧은 안내 띠 문구)도 html 안에 있고,
PC에서는 `site.css`가 숨깁니다.

화면 하나의 구조: `<div id="app">`(처음 보이는 내용) + `<template id="dc">`(화면 틀) + `<script id="dc-code">`(예시 데이터와 동작).
글을 고칠 때는 **template 쪽**을 고치세요. `#app` 안의 내용은 열릴 때 template 기준으로 다시 그려집니다.

## 배포

`main`을 고친 뒤 배포 폴더를 만들어 `gh-pages` 브랜치에 올리면 사이트에 반영됩니다.

```
python3 tools/deploy.py pc     # PC 웹사이트만: 휴대폰에서는 PC 화면이 축소되어 보임
python3 tools/deploy.py all    # PC + 모바일
python3 tools/deploy.py        # deploy.json 의 "mobile" 값대로 (true = all, false = pc)
```

결과는 `dist/`에 생깁니다. `dist/`의 내용이 `gh-pages` 브랜치의 내용이 되면 됩니다.

미리 보기: 저장소 폴더에서 `python3 -m http.server 8000`을 띄우고 `http://localhost:8000/web/` 를 엽니다.

## 아직 남아 있는 것
- 모든 페이지의 `<meta name="robots" content="noindex">` (정식 공개 때 지우기)
- 푸터와 문서의 `[사업자 확인 필요]` 자리
- 약관·처리방침의 "작업용 · 공개 전 삭제" 상자, 처리방침 8항(검토용 초안)
- 예시 상품·가격·주문·시세

## 참고
- `tools/canvas/`는 Claude Design 캔버스에서 처음 변환할 때 쓴 스크립트입니다. 다시 돌리면 `web/`을 덮어쓰므로, 이 저장소에서 고친 내용이 있으면 쓰지 마세요.
- 동작 확인: 정적 서버를 띄운 뒤 `node tools/check.js dist http://localhost:8000/dist/` (Playwright 필요)
