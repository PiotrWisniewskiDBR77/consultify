#!/usr/bin/env node
// Uruchomienie realnego zadania agenta (Siły Rynkowe / 5 Sił Portera, gotowa analiza, 3 kroki)
// przez UI, jak zrobiłby to właściciel. Loguje KAŻDE wywołanie /api/ (metoda, url, status, skrócone body),
// robi zrzuty PRZED/W TRAKCIE/PO, i odpytuje status planu do 3 minut.
import { chromium } from 'playwright';
import fs from 'node:fs';

const auth = process.env.ODBIOR_AUTH_STATE;
const outDir = '/private/tmp/m03/evidence/odbior-cto-20260905/agent';
fs.mkdirSync(outDir, { recursive: true });

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
  const url = req.url();
  if (url.includes('/api/')) {
    let body = null;
    try { body = await resp.text(); } catch {}
    netlog.push({ t: new Date().toISOString(), method: req.method(), url, status: resp.status(), body: body ? body.slice(0, 1500) : null });
  }
});
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));

function flush() {
  fs.writeFileSync(`${outDir}/RUN_network.json`, JSON.stringify(netlog, null, 2));
  fs.writeFileSync(`${outDir}/RUN_console.json`, JSON.stringify(consoleErrors, null, 2));
}

// 1) BEFORE: templates tab, preview open
await page.goto('http://localhost:3000/my-work?tab=agent&agentView=templates', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
await page.locator('text=Siły Rynkowe (5 Sił Portera)').first().click({ timeout: 8000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/10-before-run.png`, fullPage: true });
flush();

// 2) START: click "Użyj szablonu"
const netBefore = netlog.length;
await page.locator('text=Użyj szablonu').first().click({ timeout: 8000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${outDir}/11-during-just-after-click.png`, fullPage: true });
flush();

// Find the createAgentPlan response to extract plan id
let planId = null;
for (const entry of netlog.slice(netBefore)) {
  if (entry.method === 'POST' && /\/api\/ai\/agent-plan\/?$/.test(entry.url.split('?')[0])) {
    try {
      const parsed = JSON.parse(entry.body);
      planId = parsed?.plan?.id || parsed?.data?.plan?.id || parsed?.id || null;
    } catch {}
  }
}
fs.writeFileSync(`${outDir}/RUN_planId.txt`, String(planId));
console.log('planId:', planId);

// 3) POLL up to 3 minutes (every 15s) via UI reload of the same URL + direct API check via page.evaluate fetch
const startTs = Date.now();
const pollLog = [];
const maxMs = 3 * 60 * 1000;
let lastStatus = null;
while (Date.now() - startTs < maxMs) {
  await page.waitForTimeout(15000);
  if (planId) {
    try {
      const res = await page.evaluate(async (id) => {
        const token = JSON.parse(localStorage.getItem('consultify-storage') || '{}');
        const authToken = localStorage.getItem('token');
        const r = await fetch(`/api/ai/agent-plan/${id}`, { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
        const j = await r.json().catch(() => null);
        return { status: r.status, body: j };
      }, planId);
      pollLog.push({ t: new Date().toISOString(), elapsedMs: Date.now() - startTs, httpStatus: res.status, planStatus: res.body?.plan?.status || res.body?.data?.plan?.status, completedSteps: res.body?.plan?.completedSteps, totalSteps: res.body?.plan?.totalSteps });
      lastStatus = res.body?.plan?.status || res.body?.data?.plan?.status;
      console.log('poll', pollLog[pollLog.length - 1]);
      if (lastStatus && ['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(lastStatus)) break;
    } catch (e) {
      pollLog.push({ t: new Date().toISOString(), error: String(e).slice(0, 200) });
    }
  } else {
    break;
  }
}
fs.writeFileSync(`${outDir}/RUN_poll.json`, JSON.stringify(pollLog, null, 2));

// 4) AFTER: reload the plan tab UI and screenshot final state
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${outDir}/12-after-final.png`, fullPage: true });
const bodyText = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(`${outDir}/12-after-final.png.text.txt`, bodyText);
flush();

try {
  if (!page.url().includes('/login')) {
    const st = await ctx.storageState();
    fs.writeFileSync(auth, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
} catch {}
await browser.close();
console.log('DONE. planId=', planId, 'lastStatus=', lastStatus);
