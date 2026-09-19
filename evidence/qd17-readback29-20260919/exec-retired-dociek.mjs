// QD17 — dociek: retired execution deep links (?tab=resources|summary) na żywo.
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
for (const u of ['/execution?tab=resources', '/execution?tab=summary', '/execution?tab=rollout&subview=risk#kotwica']) {
  await page.goto(BASE + u, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log(`${u}  ->  ${page.url().replace(BASE, '')}`);
}
await browser.close();
