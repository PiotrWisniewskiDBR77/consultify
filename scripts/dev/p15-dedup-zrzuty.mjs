// P15 — zrzuty dowodowe: dwa dokumenty o tej samej nazwie na liście Materiałów.
// Harness: npx vite --config dev-render/vite.config.ts --port 3126 --strictPort
//
// Motyw NIE zależy od prefers-color-scheme (zustand + localStorage
// 'consultify-storage'.state.theme). Ekran harnessu dodatkowo ustawia klasę
// `.dark` z ?theme=, ale wstrzykujemy localStorage tak jak p2a-empty-states-capture.mjs,
// żeby ewentualny ThemeSync nie nadpisał wyboru — i WERYFIKUJEMY faktycznie
// zastosowany motyw zamiast zakładać, że wstrzyknięcie zadziałało.
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.P15_BASE || 'http://localhost:3126';
const OUT = new URL('../../evidence/p15-dedup-20260910/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const warianty = [
  { stan: 'przed', theme: 'light' },
  { stan: 'przed', theme: 'dark' },
  { stan: 'po', theme: 'light' },
  { stan: 'po', theme: 'dark' },
];

const browser = await chromium.launch();
let bledy = 0;
for (const w of warianty) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('consultify-storage', JSON.stringify({ state: { theme: t }, version: 2 }));
    } catch {
      /* localStorage niedostępny — zostanie domyślny motyw */
    }
  }, w.theme);
  const page = await context.newPage();
  await page.goto(`${BASE}/p15-dedup.html?stan=${w.stan}&theme=${w.theme}&lang=pl`);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const applied = await page.evaluate(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  if (applied !== w.theme) {
    console.log(`OSTRZEZENIE ${w.stan}/${w.theme}: zastosowany faktycznie ${applied}`);
    bledy += 1;
  }

  // Twardy pomiar treści: ile wierszy z tym tytułem widać NAPRAWDĘ.
  const tekst = await page.locator('body').innerText();
  const liczba = (tekst.match(/Plan transformacji operacyjnej/g) || []).length;
  const nazwa = `p15-${w.stan}-${w.theme}`;
  await page.screenshot({ path: new URL(`${nazwa}.png`, OUT).pathname, fullPage: false });
  fs.writeFileSync(new URL(`${nazwa}.txt`, OUT).pathname, tekst, 'utf-8');
  console.log(`${nazwa}: motyw=${applied} wystapien-tytulu=${liczba}`);
  await context.close();
}
await browser.close();
process.exit(bledy > 0 ? 1 : 0);
