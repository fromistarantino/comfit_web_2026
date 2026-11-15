const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2], BASE = process.argv[3]; const res = []; const ok = (n, c, x='') => res.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
(async () => {
  const br = await chromium.launch();
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.html'));
  for (const w of [390, 1440]) {
    const ctx = await br.newContext({ viewport: { width: w, height: 900 } }); let bad = [];
    for (const f of files) { const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
      await page.goto(BASE + f); await page.waitForTimeout(150);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => !h.startsWith('#') && !/^(https?:|mailto:)/.test(h)) }));
      const dead = [...new Set(r.links)].filter(h => !files.includes(h.split('#')[0]));
      if (r.sw > r.w + 1 || errs.length || dead.length) bad.push([f, r.sw, errs.slice(0,2), dead]);
      await page.close(); }
    ok(`${w}px: 31개 페이지 오류·가로 넘침·끊긴 링크 없음`, bad.length === 0, JSON.stringify(bad).slice(0, 600)); await ctx.close();
  }
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }); let p = await ctx.newPage();
  await p.goto(BASE + 'list.html'); const aside = p.locator('aside[aria-label="필터"]');
  ok('SHOP 모바일: 필터 처음엔 접힘', !(await aside.isVisible())); await p.getByRole('button', { name: /^필터/ }).click(); ok('SHOP 모바일: 필터 버튼으로 펼침', await aside.isVisible());
  await p.goto(BASE + 'signup.html'); const em = p.locator('input[type=email]'); await em.click(); await p.keyboard.type('a@b.co');
  ok('회원가입: 입력 중 포커스 유지', await em.evaluate(e => document.activeElement === e && e.value === 'a@b.co'), await em.inputValue());
  await p.locator('input[type=password]').nth(0).fill('abcd1234'); await p.locator('input[type=password]').nth(1).fill('abcd1234');
  const join = p.getByRole('button', { name: '가입하기' }); ok('회원가입: 처음엔 가입 버튼 비활성', await join.isDisabled());
  for (const l of ['[필수] 만 14세 이상입니다', '[필수] 이용약관 동의']) await p.getByLabel(l).click(); ok('회원가입: 필수 두 항목 체크 후 활성', await join.isEnabled());
  await p.goto(BASE + 'terms.html'); const det = p.locator('details.cf-toc-m'); await det.locator('summary').click(); ok('약관 모바일: 목차 펼침', await det.evaluate(d => d.open));
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(400);
  const dlg = p.locator('[role=dialog]'); ok('홈: 포스터 팝업 표시', await dlg.count() > 0);
  const lab = () => p.locator('text=/^[123] \\/ 3$/').first().innerText(); const a = await lab(); await p.waitForTimeout(2600); const b = await lab(); ok('홈: 배너 자동 넘김', a !== b, a + ' → ' + b);
  await p.goto(BASE + 'index.html'); await p.locator('a[href="event.html"]').first().click({ force: true }).catch(() => {}); await p.waitForTimeout(300); ok('홈 → 공모전 이동', p.url().endsWith('event.html'), p.url());
  await p.goto(BASE + 'buy.html'); await p.getByRole('tab', { name: '즉시 구매' }).click(); for (const c of await p.locator('input[type=checkbox]').all()) await c.click(); await p.getByRole('button', { name: '즉시 구매 계속' }).click(); ok('구매: 예시 안내 창', await p.getByText('여기까지가 화면 예시입니다').count() > 0);
  await p.locator('a[href="order.html"]').click(); await p.waitForTimeout(300); ok('구매 → 주문 결과 화면', p.url().endsWith('order.html') && await p.getByText('실제 결제와 주문은 이루어지지 않았습니다').count() > 0);
  await br.close(); console.log(res.join('\n'));
})();
