import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const netLog = [];
page.on('requestfinished', async (req) => {
  if (req.url().includes('/api/') && ['POST','PUT','PATCH'].includes(req.method())) netLog.push(req.url());
});
await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
const composer = page.getByPlaceholder(/Zapytaj Teres/i);
await composer.click();
await composer.fill('test6');
await page.locator('[data-testid="chat-send-btn"]').first().click();
await page.waitForTimeout(15000);

// hover the user message bubble to reveal its action bar
const userMsg = page.locator('text=test6').first();
await userMsg.hover();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT_DIR}/17-user-actions-visible.png` });

// Copy
try {
  await page.locator('[title="Copy"], [aria-label="Copy"], [aria-label="Kopiuj"]').last().click({ timeout: 4000 });
  console.log('copy click OK');
} catch (e) { console.log('copy FAILED', String(e).slice(0,300)); }
await page.waitForTimeout(500);
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(()=>'ERR'));
console.log('clipboard:', clip);

// Edit
try {
  await userMsg.hover();
  await page.locator('[aria-label="Edit"], [aria-label="Edytuj"]').last().click({ timeout: 4000 });
  console.log('edit click OK');
} catch (e) { console.log('edit FAILED', String(e).slice(0,300)); }
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT_DIR}/18-user-edit-clicked.png` });
// escape to cancel edit
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Branch
try {
  await userMsg.hover();
  await page.locator('[aria-label="Branch from here"], [aria-label="Rozgałęź stąd"], [title*="Branch"]').last().click({ timeout: 4000 });
  console.log('branch click OK');
} catch (e) { console.log('branch FAILED', String(e).slice(0,300)); }
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT_DIR}/19-user-branch-clicked.png` });
console.log('net calls:', JSON.stringify(netLog));
await browser.close();
