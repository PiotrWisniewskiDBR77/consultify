/* eslint-disable */
/** Kryteria odbioru K5-7: aside, przewijanie strony, bledy konsoli, wysokosc wiersza. */
import { chromium } from 'playwright';
const [url, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const h = rest.find(a=>a.startsWith(`--${n}=`)); return h ? h.slice(n.length+3) : d; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text().slice(0,160)); });
page.on('pageerror', e => errors.push('PAGEERROR '+String(e).slice(0,160)));
await page.route('**/*', r => (r.request().url().startsWith('http://localhost') || r.request().url().startsWith('data:') ? r.continue() : r.abort()));
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
await page.waitForTimeout(6000);
for (const sel of rest.filter(a=>a.startsWith('--click=')).map(a=>a.slice(8))) {
  await page.locator(sel).first().click({ timeout: 8000 }).catch(()=>{});
  await page.waitForTimeout(2000);
}
const out = await page.evaluate(() => {
  const tr = document.querySelector('tbody tr');
  const table = document.querySelector('table');
  const scroller = table ? table.parentElement : null;
  return {
    aside: document.querySelectorAll('aside').length,
    przewijaniePionowe: document.documentElement.scrollHeight > document.documentElement.clientHeight + 2,
    przewijaniePoziome: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    wysokoscWiersza: tr ? Math.round(tr.getBoundingClientRect().height) : null,
    nadmiarTabeli: table && scroller ? Math.round(table.getBoundingClientRect().width - scroller.clientWidth) : null,
    pustyBlokRelacji: document.querySelectorAll('[data-relations-empty]').length,
  };
});
console.log(JSON.stringify({ ...out, bledyKonsoli: errors.length, bledy: errors.slice(0,5) }, null, 1));
await browser.close();
