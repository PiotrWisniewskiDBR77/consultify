import { chromium } from 'playwright';
const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3184';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt.json`;
const NAZWA = 'ODBIOR NOC 07.09 — automatyzacja raportowania';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type()==='error') console.log('CONSOLE-ERR:', m.text().slice(0,200)); });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const KEY = 'consultify-storage';
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state || {}), theme: 'light' };
    localStorage.setItem(KEY, JSON.stringify(parsed));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const pomin = page.getByText('Pomiń na razie', { exact: true });
  if (await pomin.first().isVisible({ timeout: 2000 }).catch(() => false)) { await pomin.first().click({ force: true }); await page.waitForTimeout(500); }

  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const radioCount = await page.getByRole('radio', { name: 'Wszystkie' }).count();
  console.log('radio Wszystkie count:', radioCount);
  const chipAll = page.locator('[data-testid="initiatives-menu3-chip-all"]');
  console.log('chip-all count:', await chipAll.count());

  // click scope=all radio
  if (radioCount) {
    await page.getByRole('radio', { name: 'Wszystkie' }).first().click();
    await page.waitForTimeout(2500);
  }
  const rowCountAny = await page.locator('table tbody tr').count();
  console.log('total rows after scope=all:', rowCountAny);
  const rowMatch = await page.locator('table tbody tr', { hasText: NAZWA }).count();
  console.log('rows matching NAZWA:', rowMatch);

  // dump all row texts
  const rows = await page.locator('table tbody tr').allTextContents();
  rows.slice(0, 80).forEach((r, i) => console.log(`ROW${i}:`, r.slice(0, 160)));

  await context.close();
  await browser.close();
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
