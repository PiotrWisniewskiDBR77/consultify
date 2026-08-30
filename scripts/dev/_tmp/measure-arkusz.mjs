/* eslint-disable */
/**
 * Pomiar górnej części ekranu arkusza (tor grafika, 2026-08-30).
 * node scripts/dev/_tmp/measure-arkusz.mjs "<url>"
 */
import { chromium } from 'playwright';

const url = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.route('**/*', (r) => {
  const u = r.request().url();
  return u.startsWith('http://127.0.0.1') ||
    u.startsWith('http://localhost') ||
    u.startsWith('data:') ||
    u.startsWith('blob:')
    ? r.continue()
    : r.abort();
});
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await p.waitForTimeout(3500);
const out = await p.evaluate(() => {
  const table = document.querySelector('table');
  const thead = table?.querySelector('thead tr');
  const firstBodyRow = table?.querySelector('tbody tr');
  const r = (el) => (el ? el.getBoundingClientRect().top : null);
  return {
    theadTop: r(thead),
    firstRowTop: r(firstBodyRow),
    viewportH: window.innerHeight,
    toolbar:
      document.querySelector('[data-testid="artifact-menu3"]')?.getBoundingClientRect().toJSON() ??
      null,
    rightPanel:
      document
        .querySelector('[data-testid="artifact-studio-right-panel"]')
        ?.getBoundingClientRect()
        .toJSON() ?? null,
    menu3Buttons: [
      ...document.querySelectorAll('[data-testid="artifact-menu3"] [data-command-id]'),
    ].map((e) => e.getAttribute('data-command-id')),
    overflow: !!document.querySelector('[data-testid="artifact-menu3-overflow"]'),
    saveError: !!document.querySelector('[data-testid="spreadsheet-save-error"]'),
  };
});
console.log(JSON.stringify(out, null, 2));
console.log(
  'PROCENT do naglowka kolumn:',
  out.theadTop != null ? ((out.theadTop / out.viewportH) * 100).toFixed(1) + '%' : '—'
);
console.log(
  'PROCENT do pierwszego wiersza danych:',
  out.firstRowTop != null ? ((out.firstRowTop / out.viewportH) * 100).toFixed(1) + '%' : '—'
);
await b.close();
