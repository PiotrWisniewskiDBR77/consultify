#!/usr/bin/env node
// Read-only exploration with clicks. Args: out url [klik1] [klik2] ...
import { chromium } from 'playwright';
import fs from 'node:fs';

const auth = process.env.ODBIOR_AUTH_STATE;
const out = process.argv[2];
const url = process.argv[3] || '/my-work?tab=agent';
const kliki = process.argv.slice(4);

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
    let body = null;
    try { body = await resp.text(); } catch {}
    netlog.push({ method: req.method(), url: req.url(), status: resp.status(), body: body ? body.slice(0, 500) : null });
  }
});
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));

await page.goto('http://localhost:3000' + url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);

for (const k of kliki) {
  try { await page.locator(k).first().click({ timeout: 8000 }); await page.waitForTimeout(1500); }
  catch (e) { consoleErrors.push(`klik nieudany: ${k}: ${String(e.message).split('\n')[0].slice(0, 200)}`); }
}
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: true });
const bodyText = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(out + '.text.txt', bodyText);
fs.writeFileSync(out + '.net.json', JSON.stringify(netlog, null, 2));
fs.writeFileSync(out + '.console.json', JSON.stringify(consoleErrors, null, 2));
console.log('DONE', page.url(), 'NET:', netlog.length, 'ERR:', consoleErrors.length);
try {
  if (!page.url().includes('/login')) {
    const st = await ctx.storageState();
    fs.writeFileSync(auth, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
} catch {}
await browser.close();
