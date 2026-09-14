// DEC-495 — zrzuty rejestru Inicjatyw: zakres „Aktywne" (bez archiwalnych)
// i „Archiwalne" (wylacznie archiwalne), jasny + ciemny.
//
// Motyw bierzemy z parametru `&theme=` harnessu, NIE z page.emulateMedia —
// aplikacja czyta motyw z zustand, wiec emulacja media-query nie zmienia nic
// (pomiar 10.09: 12 zrzutow nazwanych „jasny" bylo ciemnych).
//
// Wymaga osobno: npx vite --config dev-render/vite.config.ts --port 5351
// Uzycie: node scripts/dev/dec495-archiwum-zrzut.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';

import { chromium } from 'playwright';

const base = 'http://127.0.0.1:5351';
const out = 'evidence/archived-filter-20260914';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const sums = [];

for (const theme of ['light', 'dark']) {
  for (const zakres of ['aktywne', 'archiwalne']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/?screen=dec495-inicjatywy-archiwum&theme=${theme}&lang=pl`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(2500);

    if (zakres === 'archiwalne') {
      await page.getByRole('radio', { name: 'Archiwalne' }).click();
      await page.waitForTimeout(1200);
    }

    // Dowod tekstowy obok obrazu: co NAPRAWDE stoi w tabeli.
    const widoczne = await page.evaluate(() =>
      Array.from(document.querySelectorAll('table tbody tr'))
        .map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60))
        .filter(Boolean)
    );

    const path = `${out}/inicjatywy-${zakres}-${theme === 'light' ? 'jasny' : 'ciemny'}.png`;
    await page.screenshot({ path, fullPage: false });
    const sum = createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12);
    sums.push({ path, sum, wierszy: widoczne.length, widoczne });
    console.log(`${path}  sha=${sum}  wierszy=${widoczne.length}`);
    widoczne.forEach((w) => console.log(`    - ${w}`));
    await page.close();
  }
}

await browser.close();

// Bezpiecznik „duplikat zamiast motywu": cztery zrzuty musza byc czterema
// roznymi obrazami, inaczej cos podmienilo motyw albo klik nie zadzialal.
const unikalne = new Set(sums.map((s) => s.sum));
if (unikalne.size !== sums.length) {
  console.error(`BLAD: ${sums.length} zrzutow, tylko ${unikalne.size} roznych obrazow`);
  process.exit(1);
}
console.log('OK — 4 rozne obrazy');
