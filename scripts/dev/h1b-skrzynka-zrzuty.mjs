/**
 * H1b — zrzuty odbiorowe SKRZYNKI RECENZENTA (14.09).
 *
 * Uruchom harness dev-render:
 *   npx vite --config dev-render/vite.config.ts --port 5411 --strictPort
 * potem:
 *   node scripts/dev/h1b-skrzynka-zrzuty.mjs
 *
 * Poza zrzutem MIERZY jasność tła i liczbę wierszy — para „jasny/ciemny" ma
 * być dwoma różnymi obrazami, a nie tym samym plikiem pod dwiema nazwami
 * (pamięć „Duplikat zamiast motywu"), a pusta tabela w skrzynce zatwierdzeń
 * byłaby najgorszym możliwym fałszem („nic na ciebie nie czeka").
 */
import { mkdirSync } from 'node:fs';

import { chromium } from 'playwright';

const OUT = 'evidence/h1b-20260914';
const BASE = 'http://127.0.0.1:5411';
const SCREEN = 'h1b-skrzynka-przejsc';

const SHOTS = [
  ['01-skrzynka-jasny', 'default', 'light', 2],
  ['02-skrzynka-ciemny', 'default', 'dark', 2],
  ['03-podglad-jasny', 'default', 'light', 2, true],
  ['04-podglad-ciemny', 'default', 'dark', 2, true],
  ['05-pusta-jasny', 'empty', 'light', 0],
  ['06-off-jasny', 'off', 'light', 0],
  ['07-off-ciemny', 'off', 'dark', 0],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const measured = [];

for (const [name, variant, theme, expectRows, openPreview] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(`${name}: ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name}: ${m.text()}`);
  });
  await page.goto(`${BASE}/?screen=${SCREEN}&case=${variant}&lang=en&theme=${theme}&uwagi=0`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  if (expectRows > 0) await page.waitForSelector('table tbody tr', { timeout: 20000 });
  if (openPreview) {
    await page.click('table tbody tr');
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(800);

  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((theme === 'dark') !== isDark) errors.push(`${name}: motyw nie wszedl`);
  const rows = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
  if (expectRows > 0 && rows < expectRows)
    errors.push(`${name}: oczekiwano >=${expectRows} wierszy, jest ${rows}`);
  const bg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor || getComputedStyle(document.documentElement).backgroundColor
  );
  measured.push({ name, theme, rows, bg });

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await page.close();
}

await browser.close();
console.table(measured);
if (errors.length) {
  console.error('BLEDY:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`OK — ${SHOTS.length} zrzutow w ${OUT}`);
