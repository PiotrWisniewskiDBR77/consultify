#!/usr/bin/env node
// Read-only exploration of the Agent tab (My Work). No clicks that create/mutate.
import { chromium } from 'playwright';
import fs from 'node:fs';

const auth = process.env.ODBIOR_AUTH_STATE;
const out = process.argv[2] || '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/727cd91f-4b38-48d7-80ee-553444892eb1/scratchpad/agent-test/explore-before.png';
const url = process.argv[3] || '/my-work?tab=agent';

const browser = await chromium.launch({ headless: true });
const sesja = JSON.parse(fs.readFileSync(auth, 'utf8'));
const ctx = await browser.newContext({ storageState: sesja, viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'pl-PL' });
await ctx.addInitScript(() => {
  try {
    const raw = localStorage.getItem('consultify-storage');
    const obj = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    obj.state = { ...(obj.state || {}), theme: 'light' };
    localStorage.setItem('consultify-storage', JSON.stringify(obj));
    document.documentElement.classList.remove('dark');
  } catch {}
});
const page = await ctx.newPage();
const netlog = [];
page.on('response', async (resp) => {
  const req = resp.request();
  if (req.url().includes('/api/')) {
    netlog.push({ method: req.method(), url: req.url(), status: resp.status() });
  }
});
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));

await page.goto('http://localhost:3000' + url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await page.screenshot({ path: out, fullPage: true });

const bodyText = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(out + '.text.txt', bodyText);
fs.writeFileSync(out + '.net.json', JSON.stringify(netlog, null, 2));
fs.writeFileSync(out + '.console.json', JSON.stringify(consoleErrors, null, 2));
console.log('DONE', page.url());
console.log('NET calls:', netlog.length);
console.log('Console errors:', consoleErrors.length);

// Save updated session
try {
  if (!page.url().includes('/login')) {
    const st = await ctx.storageState();
    fs.writeFileSync(auth, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
} catch {}
await browser.close();
