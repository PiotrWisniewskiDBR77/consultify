/* eslint-disable */
import { chromium } from 'playwright';
const [url, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const h = rest.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const width = parseInt(opt('w', '1440'), 10);
const lang = opt('lang', '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
if (lang) await page.addInitScript((l) => { try { window.localStorage.setItem('i18nextLng', l); } catch {} }, lang);
await page.route('**/*', (r) => { const u = r.request().url();
  return u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:') ? r.continue() : r.abort(); });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(parseInt(opt('settle', '6000'), 10));
for (const sel of rest.filter((a) => a.startsWith('--click=')).map((a) => a.slice(8))) {
  await page.locator(sel).first().click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(900);
}
const out = await page.evaluate(() => {
  const table = document.querySelector('table'); if (!table) return { error: 'brak <table>' };
  const scroller = table.closest('div');
  const ths = [...table.querySelectorAll('thead th')];
  const rows = [...table.querySelectorAll('tbody tr')];
  const pustyRelations = [...document.querySelectorAll('[data-preview-block]')].filter((b) => (b.textContent||'').trim().length === 0).length;
  return { kontener: scroller?.clientWidth ?? null, tabela: Math.round(table.getBoundingClientRect().width),
    wiersze: rows.slice(0,5).map((r)=>Math.round(r.getBoundingClientRect().height)),
    przewijanieStrony: document.documentElement.scrollHeight > window.innerHeight + 2,
    aside: document.querySelectorAll('aside').length, pusteBloki: pustyRelations,
    kolumny: ths.map((th)=>({ id: th.getAttribute('data-column-id'), px: Math.round(th.getBoundingClientRect().width),
      naglowek: (th.textContent||'').trim().slice(0,22),
      uciety: (()=>{ const s=th.querySelector('[data-overflow-tooltip-text]'); return s? s.scrollWidth>s.clientWidth+1 : false; })() })) };
});
console.log(JSON.stringify(out));
await browser.close();
