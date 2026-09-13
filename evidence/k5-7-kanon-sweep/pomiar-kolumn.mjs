/* eslint-disable */
/** Pomiar szerokości kolumn w harnessie: node pomiar-kolumn.mjs <url> [--w=1440] */
import { chromium } from 'playwright';

const [url, ...rest] = process.argv.slice(2);
const opt = (n, d) => {
  const hit = rest.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const width = parseInt(opt('w', '1440'), 10);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
await page.route('**/*', (r) => {
  const u = r.request().url();
  return u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')
    ? r.continue()
    : r.abort();
});
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(parseInt(opt('settle', '6000'), 10));
for (const sel of rest.filter((a) => a.startsWith('--click=')).map((a) => a.slice(8))) {
  await page.locator(sel).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
}
const out = await page.evaluate(() => {
  const table = document.querySelector('table');
  if (!table) return { error: 'brak <table>' };
  const scroller = table.closest('div');
  const ths = [...table.querySelectorAll('thead th')];
  const rows = [...table.querySelectorAll('tbody tr')];
  return {
    kontener: scroller?.clientWidth ?? null,
    tabela: table.getBoundingClientRect().width,
    wysokoscWiersza: rows.slice(0, 5).map((r) => Math.round(r.getBoundingClientRect().height)),
    liczbaWierszy: rows.length,
    kolumny: ths.map((th) => ({
      id: th.getAttribute('data-column-id'),
      px: Math.round(th.getBoundingClientRect().width),
      naglowek: (th.textContent || '').trim().slice(0, 24),
      ucięty: (() => {
        const s = th.querySelector('[data-overflow-tooltip-text]');
        return s ? s.scrollWidth > s.clientWidth + 1 : false;
      })(),
    })),
    aside: document.querySelectorAll('aside').length,
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
