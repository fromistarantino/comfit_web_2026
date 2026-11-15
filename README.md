# COMFIT 웹 사이트 (정적 파일)

Claude Design 캔버스 "COMFIT 마켓 시안"을 일반 웹 사이트 파일로 바꾼 것입니다. 2026-11-15 기준.

- `index.html`이 홈이고, 나머지 화면은 `list.html`, `terms.html`처럼 소문자 파일명입니다.
- 각 페이지는 `<template id="dc">`(화면 틀)와 `runtime.js`(상태에 따라 화면을 그리는 스크립트)로 동작합니다. 서버 기능은 없습니다.
- 사진·글꼴·로고는 `assets/`에 있습니다.
- 모든 페이지에 `<meta name="robots" content="noindex">`가 들어 있습니다. 정식 공개 때 지우세요.

## 아직 남아 있는 것
- 푸터와 문서의 `[사업자 확인 필요]` 자리
- 약관·처리방침의 "작업용 · 공개 전 삭제" 상자, 처리방침 8항(검토용 초안)
- 예시 상품·가격·주문·시세

## 다시 만들기 (`tools/`)
캔버스의 `.dc.html` 파일과 이미지가 있는 폴더가 있을 때:
```
python3 tools/build.py <dc.html 폴더> <이미지 폴더> <출력 폴더>
node tools/prerender.js <출력 폴더> http://localhost:8765/     # 정적 서버를 띄운 뒤
node tools/check.js <출력 폴더> http://localhost:8765/         # 링크·넘침·주요 동작 확인
```
