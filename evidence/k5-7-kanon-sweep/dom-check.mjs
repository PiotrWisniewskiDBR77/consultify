import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**/*', (r) => (r.request().url().startsWith('http://localhost') ? r.continue() : r.abort()));
await page.goto('http://localhost:5316/?screen=k5-naprawy-inicjatywy&lang=en&theme=dark', { waitUntil: 'networkidle' }).catch(()=>{});
await page.waitForTimeout(5000);
await page.locator('button:has-text("Plan")').first().click().catch(()=>{});
await page.waitForTimeout(2500);
const out = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('tbody tr td')];
  return { wiersz: Math.round(document.querySelector('tbody tr').getBoundingClientRect().height),
    komorki: tds.map(td => {
      const inner = td.querySelector('[data-overflow-tooltip-text]') || td.firstElementChild;
      return { txt: (td.textContent||'').trim().slice(0,28), tdH: Math.round(td.getBoundingClientRect().height),
        innerH: inner ? Math.round(inner.getBoundingClientRect().height) : null,
        cls: inner ? String(inner.className).slice(0,80) : null };
    }) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
