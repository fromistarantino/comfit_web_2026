// 배포 폴더(dist/)의 각 페이지를 브라우저로 열어, 화면에 그려진 내용을 <div id="app"> 안에 미리 넣는다.
// (자바스크립트가 꺼진 환경·검색엔진·링크 미리보기에서도 내용이 보이게 하고, html 원본과 화면이 어긋나지 않게 한다.)
//   사용: node tools/prerender.js dist
// Playwright가 필요하다 (npm i playwright && npx playwright install chromium).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');

const OUT = path.resolve(process.argv[2] || 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const p = path.join(OUT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(OUT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  let problems = 0;
  for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.html'))) {
    const file = path.join(OUT, f);
    let src = fs.readFileSync(file, 'utf8');
    if (!src.includes('<template id="dc">')) continue;
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.addInitScript(() => { window.setInterval = () => 0; try { localStorage.clear(); } catch (e) {} });
    // 404.html 의 <base> 는 실제 사이트 주소 기준이라, 미리 그릴 때만 지운다
    await page.route('**/' + f, async (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: src.replace(/<base [^>]*>\n?/, '') }));
    await page.goto(base + f, { waitUntil: 'load' });
    const html = await page.evaluate(() => document.getElementById('app').innerHTML);
    if (errs.length || html.includes('{{') || html.length < 500) { problems++; console.log('문제', f, errs.slice(0, 3), html.length); }
    const a = src.indexOf('<div id="app">'), b = src.indexOf('</div>\n<template id="dc">');
    if (a < 0 || b < 0) { problems++; console.log('문제', f, '#app 자리를 찾지 못함'); }
    else fs.writeFileSync(file, src.slice(0, a + '<div id="app">'.length) + html + src.slice(b));
    await page.close();
  }
  await br.close(); server.close();
  console.log(problems ? '미리 그리기 중 문제 ' + problems + '건' : '미리 그리기 완료');
  process.exit(problems ? 1 : 0);
})();
