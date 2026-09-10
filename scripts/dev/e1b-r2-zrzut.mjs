// E1b/R2 — zrzut PRZED/PO dla kebaba wiersza w Realizacja → Realizacje.
// Użycie: node scripts/dev/e1b-r2-zrzut.mjs <przed|po>
import { chromium } from 'playwright';

const label = process.argv[2] || 'po';
const base = 'http://localhost:3241';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(base);
const loginRes = await page.evaluate(async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'audyt@dbr77.local', password: 'AudytDBR77!2026' }),
  });
  const data = await res.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken || '');
  localStorage.setItem('user', JSON.stringify(data.user));
  return { status: res.status, email: data.user?.email };
});
console.log('login', loginRes);

await page.goto(`${base}/execution?tab=list`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const skip = page.getByText('Skip for now');
if (await skip.count()) {
  await skip.first().click();
  await page.waitForTimeout(300);
}

await page.waitForSelector('table tbody tr');
await page.waitForTimeout(500);

const rows = page.locator('table tbody tr');
const row = rows.nth(0);
await row.locator('button[aria-label="Row actions"], button[aria-label="Akcje wiersza"]').click();
await page.waitForTimeout(400);

await page.screenshot({ path: `evidence/e1b/r2-${label}-kebab-realizacje-1440-jasny.png`, fullPage: false });

// Policz ile razy pojawia się "Open preview"/"Otwórz podgląd" w otwartym menu.
const menuText = await page.locator('[role="menu"], [role="menuitem"]').allTextContents();
console.log('menu items:', JSON.stringify(menuText));

await browser.close();
