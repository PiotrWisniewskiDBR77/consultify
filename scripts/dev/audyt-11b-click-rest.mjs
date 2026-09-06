import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const results = {};
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const netLog = [];
page.on('requestfinished', async (req) => {
  if (req.url().includes('/api/') && ['POST','PUT','PATCH','DELETE'].includes(req.method())) {
    let respBody = null;
    try { const r = await req.response(); respBody = r ? await r.json().catch(()=>null) : null; } catch {}
    netLog.push({ url: req.url(), method: req.method(), respBody });
  }
});

await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const composer = page.getByPlaceholder(/Zapytaj Teres/i);
await composer.click();
await composer.fill('test2');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);
await page.locator('[aria-label="Więcej akcji"]').first().click();
await page.waitForTimeout(400);

function drainNet() { const c = [...netLog]; netLog.length = 0; return c; }

async function clickBtn(label, name, waitMs=1000) {
  drainNet();
  try {
    await page.locator(`[aria-label="${label}"]`).first().click({ timeout: 4000 });
  } catch (e) {
    results[name] = { error: String(e).slice(0,200) };
    return;
  }
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${OUT_DIR}/click2-${name}.png`, fullPage: false });
  results[name] = { apiCalls: drainNet() };
}

await clickBtn('Szczegóły źródeł', '01-szczegoly-zrodel');
await clickBtn('Raport', '02-raport-open');
// cancel report dialog
try { await page.getByText('Anuluj').first().click({ timeout: 2000 }); } catch {}
await page.waitForTimeout(300);
await clickBtn('Zapisz jako notatkę', '03-zapisz-notatke');
await clickBtn('Zapisz jako pomysł', '04-zapisz-pomysl');
await clickBtn('Zapisz w Context OS', '05-zapisz-context');
await clickBtn('Kontynuuj', '06-kontynuuj', 8000);
await clickBtn('Wygeneruj ponownie', '07-regeneruj', 8000);

await browser.close();
fs.writeFileSync(`${OUT_DIR}/click-results-rest.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
