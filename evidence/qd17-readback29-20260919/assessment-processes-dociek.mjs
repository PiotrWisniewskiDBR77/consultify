// QD17 — dociek: K-22 kolumna „Wynik" (Score — legacy…) na właściwej zakładce.
import fs from 'node:fs';
import { chromium } from 'playwright';
const BASE = 'https://staging.consultify.ai';
function creds(rel) {
  const d = fs.readFileSync(process.env.HOME + rel, 'utf8');
  const email = (d.match(/E-?mail:\s*`?([^\s`]+@[^\s`]+)`?/i) || [])[1];
  const pass = process.env.CTO_TEST_PASSWORD || (d.match(/Has[łl]o[^:\n]*:\s*`([^`]+)`/i) || [])[1];
  return { email, pass };
}
const { email, pass } = creds('/Developer/cto-codex/irina-20260914/DOSTEP.md');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
const page = await context.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.evaluate(
  async ([em, pw]) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: em, password: pw }) });
    const j = await r.json().catch(() => ({}));
    if (j.token) { localStorage.setItem('token', j.token); localStorage.setItem('i18nextLng', 'en'); }
    return r.status;
  },
  [email, pass],
);
for (const u of ['/assessment?tab=processes']) {
  await page.goto(BASE + u, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const headers = [...document.querySelectorAll('table thead th')].map((h) => (h.textContent || '').trim()).filter(Boolean);
    const rows = document.querySelectorAll('table tbody tr').length;
    const scoreTh = [...document.querySelectorAll('table thead th')].find((h) => /Score/i.test(h.textContent || ''));
    return { url: location.pathname + location.search, headers, rows, scoreHeader: scoreTh ? scoreTh.textContent.trim() : null };
  });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: 'zrzuty/22-assessment-processes.png' });
}
await browser.close();
