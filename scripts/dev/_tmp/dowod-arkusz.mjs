/* eslint-disable */
/**
 * Dowód interaktywny warsztatu arkusza (tor grafika, 2026-08-30):
 * wpisanie wartości, format waluty, ścieżka porażki zapisu.
 *
 * node scripts/dev/_tmp/dowod-arkusz.mjs
 */
import { chromium } from 'playwright';

const D = 'evidence/grafika/110-arkusz-warsztat';
const BAZA = 'http://127.0.0.1:3020/?screen=sheet-artifact&lang=pl&theme=light';

const browser = await chromium.launch();

async function otworz(url) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => {
    const u = r.request().url();
    return u.startsWith('http://127.0.0.1') ||
      u.startsWith('http://localhost') ||
      u.startsWith('data:') ||
      u.startsWith('blob:')
      ? r.continue()
      : r.abort();
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return { ctx, page };
}

// ── DOWÓD 3: wpisanie wartości w komórkę ────────────────────────────────────
{
  const { ctx, page } = await otworz(BAZA);
  await page.locator('td', { hasText: /^4200$/ }).first().dblclick();
  await page.waitForTimeout(400);
  await page.keyboard.type('5555');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `${D}/DOWOD-3__wpisana-wartosc.png`,
    clip: { x: 0, y: 0, width: 1440, height: 340 },
  });
  console.log('DOWOD-3 ok');
  await ctx.close();
}

// ── DOWÓD 4: format waluty na zaznaczonej kolumnie ──────────────────────────
{
  const { ctx, page } = await otworz(BAZA);
  await page.locator('th', { hasText: /^Wartość$/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Waluta', exact: true }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({
    path: `${D}/DOWOD-4__waluta.png`,
    clip: { x: 0, y: 0, width: 1440, height: 340 },
  });
  console.log('DOWOD-4 ok');
  await ctx.close();
}

// ── DOWÓD 5: ścieżka PORAŻKI (stub serwera wyłączony) ───────────────────────
{
  const { ctx, page } = await otworz(`${BAZA}&stub=0`);
  await page.locator('td', { hasText: /^4200$/ }).first().dblclick();
  await page.waitForTimeout(400);
  await page.keyboard.type('9999');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: `${D}/DOWOD-5__cicha-porazka-naprawiona.png`,
    clip: { x: 0, y: 0, width: 1440, height: 400 },
  });
  const widoczny = await page.locator('[data-testid="spreadsheet-save-error"]').count();
  console.log('DOWOD-5 ok; pasek bledu zapisu widoczny:', widoczny > 0 ? 'TAK' : 'NIE');
  await ctx.close();
}

await browser.close();
