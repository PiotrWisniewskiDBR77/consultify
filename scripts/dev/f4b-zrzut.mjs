// F4b — zrzut PRZED/PO dla fetchu eksportów w podglądzie raportu Oceny.
// Sam widok ("No exports yet") jest identyczny PRZED/PO — naprawa usuwa
// SKAZANE NA 404 zapytanie sieciowe, nie zmienia UI. Dowód = network log
// (network-{label}.json), nie sam zrzut ekranu.
// Użycie: node scripts/dev/f4b-zrzut.mjs <przed|po>
import { chromium } from 'playwright';

const label = process.argv[2] || 'po';
const base = 'http://localhost:3274';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.emulateMedia({ colorScheme: 'light' });

const exportRequests = [];
page.on('request', (req) => {
  if (req.url().includes('/report-builder/') && req.url().includes('/exports')) {
    exportRequests.push({ url: req.url(), method: req.method() });
  }
});

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

await page.goto(`${base}/assessment?tab=reports`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const skip = page.getByText('Skip for now');
if (await skip.count()) {
  await skip.first().click();
  await page.waitForTimeout(300);
}

await page.getByText('DBR77 Staging Assessment Executive Report', { exact: true }).click();
await page.waitForTimeout(1500);

await page.screenshot({
  path: `evidence/f4/f4b-${label}-podglad-raportu-ocena-1440-jasny.png`,
  fullPage: false,
});

const fs = await import('node:fs');
fs.writeFileSync(
  `evidence/f4/f4b-${label}-network-exports-requests.json`,
  JSON.stringify(exportRequests, null, 2)
);
console.log(`exports requests fired (${label}):`, exportRequests.length, exportRequests);

await browser.close();
