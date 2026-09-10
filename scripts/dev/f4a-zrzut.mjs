// F4a — zrzut PRZED/PO dla "Otwórz zadanie" z karty inicjatywy w Ocenie.
// Użycie: node scripts/dev/f4a-zrzut.mjs <przed|po>
import { chromium } from 'playwright';

const label = process.argv[2] || 'po';
const base = 'http://localhost:3274';

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

await page.goto(`${base}/assessment?tab=initiatives`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const skip = page.getByText('Skip for now');
if (await skip.count()) {
  await skip.first().click();
  await page.waitForTimeout(300);
}

// Otwórz initiative "Zarządzanie wydajnością cyfrową" (source=assessment,
// widoczna na liście Assessment > Initiatives), potem "Open" -> pełny widok.
await page.getByText('Zarządzanie wydajnością').first().click();
await page.waitForTimeout(500);
await page.getByText('Open', { exact: true }).click();
await page.waitForTimeout(1000);

// Sekcja "Tasks" w menu bocznym.
await page.getByText('Tasks', { exact: true }).first().click();
await page.waitForTimeout(500);

// Zadanie bez przypisanego właściciela z widoku oglądającego (audyt@dbr77.local,
// ADMIN, nie assignee) — dokładnie ten kształt co E1c (task 2a4d39f7 dla Initiatives).
await page.getByText('Analiza opcji integracji AI', { exact: true }).click();
await page.waitForTimeout(1500);

await page.screenshot({
  path: `evidence/f4/f4a-${label}-otworz-zadanie-ocena-1440-jasny.png`,
  fullPage: false,
});
console.log('URL after click:', page.url());

await browser.close();
