#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE = 'http://localhost:3185';
const AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-audyt.json';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: AUTH,
});
const page = await context.newPage();
page.on('console', (m) => console.log('[konsola]', m.type(), m.text().slice(0, 200)));
page.on('response', (r) => {
  if (/\/api\//.test(r.url())) console.log('[api]', r.status(), r.url());
});
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText));

await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
console.log('URL koncowy:', page.url());
const cookies = await context.cookies();
console.log('Cookies w kontekscie:', cookies.map(c => `${c.name}@${c.domain}${c.path}`));
await browser.close();
