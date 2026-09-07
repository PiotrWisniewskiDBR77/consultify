import { chromium } from 'playwright';
const BASE = 'http://localhost:3185';
const AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-anna-odbior-3185.json';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH, locale: 'pl-PL' });
const page = await context.newPage();
const wyniki = [];
page.on('response', async (r) => {
  if (/\/api\/tasks\//.test(r.url()) && r.request().method() === 'PUT') {
    let body=''; try { body = await r.text(); } catch {}
    wyniki.push(`PUT ${r.status()} ${r.url()}\n${body}`);
  }
});
await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
// Znajdz wiersz "DPIA submission deadline" (status W toku, nieprzypisany) i zmien status
const wiersz = page.locator('tr, [role="row"]').filter({ hasText: 'DPIA submission deadline' }).first();
const statusKomorka = wiersz.locator('[data-editable="tak"]').nth(2); // Osoba,Termin,Status
await statusKomorka.dblclick();
await page.waitForTimeout(400);
const select = page.locator('select[aria-label="Zmień status"]').first();
if (await select.count()) {
  const opcje = await select.locator('option').evaluateAll((els) => els.map((e) => e.value));
  console.log('Opcje statusu:', opcje);
  if (opcje.length > 1) { await select.selectOption(opcje[1]); await page.waitForTimeout(1500); }
} else {
  console.log('brak select status');
}
console.log('WYNIKI PUT:', wyniki.length ? wyniki.join('\n---\n') : 'BRAK wywolania PUT');
await browser.close();
