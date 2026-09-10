// E1b/R1 — zrzut PRZED/PO dla kebaba "Otwórz zadanie" w Realizacja → Praca.
// Użycie: node scripts/dev/e1b-r1-zrzut.mjs <przed|po>
import { chromium } from 'playwright';

const label = process.argv[2] || 'po';
const base = 'http://localhost:3241';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.emulateMedia({ colorScheme: 'light' });

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

await page.goto(`${base}/execution?tab=work`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Zamknij onboarding, jeśli jest.
const skip = page.getByText('Skip for now');
if (await skip.count()) {
  await skip.first().click();
  await page.waitForTimeout(300);
}

await page.waitForSelector('table tbody tr');
await page.waitForTimeout(500);

// Kebab drugiego wiersza (Złożenie dokumentacji zgodności).
const rows = page.locator('table tbody tr');
const row = rows.nth(1);
await row.locator('button[aria-label="Row actions"], button[aria-label="Akcje wiersza"]').click();
await page.waitForTimeout(300);
await page.getByRole('menuitem', { name: /Open task|Otwórz zadanie/ }).click();
await page.waitForTimeout(1500);

await page.screenshot({ path: `evidence/e1b/r1-${label}-otworz-zadanie-1440-jasny.png`, fullPage: false });
console.log('URL after click:', page.url());

await browser.close();
