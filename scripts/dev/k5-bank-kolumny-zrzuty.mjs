/**
 * K5 — zrzuty odbiorowe SZEROKOŚCI KOLUMN banku Realizacji (13.09).
 *
 * Uruchom harness dev-render na 5312:
 *   npx vite --config dev-render/vite.config.ts --port 5312 --strictPort
 * potem:
 *   node scripts/dev/k5-bank-kolumny-zrzuty.mjs
 *
 * Poza zrzutem wypisuje ZMIERZONE szerokości każdej kolumny (getBoundingClientRect),
 * szerokość kontenera i tabeli oraz wysokość wiersza — żeby odbiór stał na
 * liczbach z przeglądarki, nie na deklaracji w kodzie.
 */
import { chromium } from 'playwright';

const OUT = 'evidence/k5-bank-kolumny-20260913';
const BASE = 'http://127.0.0.1:5312';
const SHOTS = [
  ['k5-naprawy-realizacja', 1280, 'light'],
  ['k5-naprawy-realizacja', 1440, 'light'],
  ['k5-naprawy-realizacja', 1920, 'light'],
  ['k5-naprawy-realizacja', 1440, 'dark'],
  ['k5-preview-bank', 1280, 'light'],
  ['k5-preview-bank', 1440, 'light'],
  ['k5-preview-bank', 1920, 'light'],
  ['k5-preview-bank', 1440, 'dark'],
];

const browser = await chromium.launch();
const errors = [];

const otworz = async (screen, width, theme) => {
  const page = await browser.newPage({ viewport: { width, height: 960 } });
  page.on('pageerror', (e) => errors.push(`${screen}/${width}/${theme}: ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${screen}/${width}/${theme}: ${m.text()}`);
  });
  await page.goto(`${BASE}/?screen=${screen}&lang=en&theme=${theme}`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  await page.waitForSelector('table tbody tr', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1200));
  return page;
};

for (const [screen, width, theme] of SHOTS) {
  const page = await otworz(screen, width, theme);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((theme === 'dark') !== isDark) errors.push(`${screen}/${width}: motyw nie wszedl`);
  const geom = await page.evaluate(() => {
    const wrap = document.querySelector('.overflow-x-auto');
    const wiersz = document.querySelector('table tbody tr');
    return {
      kontener: wrap ? wrap.clientWidth : null,
      tabela: document.querySelector('table')?.scrollWidth ?? null,
      kolumny: Array.from(document.querySelectorAll('th[data-column-id]')).map((th) => [
        th.dataset.columnId,
        Math.round(th.getBoundingClientRect().width),
      ]),
      wysokoscWiersza: wiersz ? Math.round(wiersz.getBoundingClientRect().height) : null,
    };
  });
  console.log(screen, width, theme, JSON.stringify(geom));
  await page.screenshot({ path: `${OUT}/PO-${screen}-${width}-${theme}.png` });
  await page.close();
}

// Pstryczek kolumn — kolumna tytułowa musi być LOCKED (kanon: kolumna główna
// jest `required`), a kolumny z myślnikami użytkownik chowa jednym kliknięciem.
const page = await otworz('k5-naprawy-realizacja', 1440, 'light');
await page.locator('th button').last().click();
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${OUT}/PO-pstryczek-kolumn-1440-light.png` });
console.log(
  'zablokowane w pstryczku:',
  JSON.stringify(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('input[type=checkbox][disabled]')).map(
        (i) => i.closest('label')?.textContent?.trim() ?? '?'
      )
    )
  )
);
await page.close();

console.log('bledyKonsoli:', errors.length, JSON.stringify(errors));
await browser.close();
