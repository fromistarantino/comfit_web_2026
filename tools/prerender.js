const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const OUT = process.argv[2], BASE = process.argv[3];
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.html'))) {
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('requestfailed', r => errs.push('failed ' + r.url()));
    page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    await page.addInitScript(() => { window.setInterval = () => 0; });
    await page.goto(BASE + f, { waitUntil: 'load' });
    const html = await page.evaluate(() => document.getElementById('app').innerHTML);
    if (errs.length || html.includes('{{') || html.length < 2000) console.log('PROBLEM', f, errs.slice(0, 3), html.length);
    const p = path.join(OUT, f); let s = fs.readFileSync(p, 'utf8');
    if (!s.includes('<!--PRERENDER-->')) { console.log('already', f); } else fs.writeFileSync(p, s.replace('<!--PRERENDER-->', () => html));
    await page.close();
  }
  await br.close(); console.log('prerender done');
})();
