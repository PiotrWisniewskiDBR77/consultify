#!/usr/bin/env node
// Open the Porter plan row and click "Uruchom proces" explicitly; capture the POST /run response.
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
    netlog.push({ t: new Date().toISOString(), method: req.method(), url: req.url(), status: resp.status(), body: body ? body.slice(0, 1500) : null });
  }
});
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));

await page.goto('http://localhost:3000/my-work?tab=agent&agentView=processes', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.locator('text=Siły Rynkowe (5 Sił Portera)').first().click({ timeout: 8000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/14-reopened-plan.png`, fullPage: true });

// find and click "Uruchom proces" / "Otwórz" first if needed
const openBtn = page.locator('text=Otwórz').first();
if (await openBtn.count()) {
  await openBtn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: `${outDir}/15-plan-workspace-opened.png`, fullPage: true });

const runBtn = page.locator('text=Uruchom proces').first();
const hasRun = await runBtn.count();
fs.writeFileSync(`${outDir}/RUN2_hasRunButton.txt`, String(hasRun));
if (hasRun) {
  await runBtn.click({ timeout: 8000 });
  await page.waitForTimeout(4000);
}
await page.screenshot({ path: `${outDir}/16-after-uruchom-click.png`, fullPage: true });
const bodyText = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(`${outDir}/16-after-uruchom-click.png.text.txt`, bodyText);

fs.writeFileSync(`${outDir}/RUN2_network.json`, JSON.stringify(netlog, null, 2));
fs.writeFileSync(`${outDir}/RUN2_console.json`, JSON.stringify(consoleErrors, null, 2));
console.log('DONE', page.url(), 'hasRunButton=', hasRun, 'NET=', netlog.length);

try {
  if (!page.url().includes('/login')) {
    const st = await ctx.storageState();
    fs.writeFileSync(auth, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
} catch {}
await browser.close();
