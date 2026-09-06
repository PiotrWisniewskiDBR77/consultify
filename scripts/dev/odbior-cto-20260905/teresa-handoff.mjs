#!/usr/bin/env node
// DEC-2026-09-05-396 test: ask Teresa (Chat) to do a multi-step task that should
// trigger case recognition ("nowa sprawa") — ONE message, observe, do not confirm anything.
import { chromium } from 'playwright';
import fs from 'node:fs';
const auth = process.env.ODBIOR_AUTH_STATE;
const outDir = '/private/tmp/m03/evidence/odbior-cto-20260905/agent';
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
    netlog.push({ t: new Date().toISOString(), method: req.method(), url: req.url(), status: resp.status(), body: body ? body.slice(0, 2000) : null });
  }
});
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));

await page.goto('http://localhost:3000/chat', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${outDir}/20-chat-before.png`, fullPage: true });

const msg = 'Chcę rozpocząć nową sprawę dla klienta: redukcja kosztów produkcji o 15% w ciągu 6 miesięcy w zakładzie pakowania, z dedykowanym zespołem i cotygodniowym raportowaniem do zarządu.';
const box = page.locator('textarea, [contenteditable="true"]').first();
await box.click({ timeout: 8000 });
await box.fill(msg).catch(async () => { await box.type(msg); });
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(15000);
await page.screenshot({ path: `${outDir}/21-chat-after-send.png`, fullPage: true });
// wait a bit more in case of streaming
await page.waitForTimeout(15000);
await page.screenshot({ path: `${outDir}/22-chat-after-wait.png`, fullPage: true });
const bodyText = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(`${outDir}/22-chat-after-wait.png.text.txt`, bodyText);

fs.writeFileSync(`${outDir}/TERESA_network.json`, JSON.stringify(netlog, null, 2));
fs.writeFileSync(`${outDir}/TERESA_console.json`, JSON.stringify(consoleErrors, null, 2));
console.log('DONE', page.url(), 'NET=', netlog.length, 'ERR=', consoleErrors.length);

try {
  if (!page.url().includes('/login')) {
    const st = await ctx.storageState();
    fs.writeFileSync(auth, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
} catch {}
await browser.close();
