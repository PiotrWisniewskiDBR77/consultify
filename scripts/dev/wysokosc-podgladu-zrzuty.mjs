/* eslint-disable */
/**
 * Zrzuty dowodowe do naprawy wysokosci podgladu (uwaga wlasciciela 02.09:
 * „Preview nie jest wysokie na wysokosc przestrzeni od menu 3 do dolu strony").
 *
 * Trzy ekrany rodziny x dwa motywy. `uwagi=0` wylacza panel uwag harnessu -
 * bez tego kontrolki przyrzadu zasłaniaja produkt i zrzut pokazuje nie to,
 * co ocenia wlasciciel.
 *
 * Skrypt NIE mierzy - pomiar robi scripts/dev/measure-preview-canon.mjs --wysokosc.
 * Tutaj tylko dowod wzrokowy + mechaniczna kontrola, ze para light/dark to dwa
 * ROZNE obrazy (para „duplikat zamiast motywu" juz raz przeszla odbior).
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3352';
const OUT = 'evidence/grafika/220-wysokosc-podgladu';

const ekrany = [
  { key: 'zasoby', screen: 'execution-tab-resources', opis: 'Realizacja / Zasoby (ekran ze zrzutu wlasciciela)' },
  { key: 'praca', screen: 'execution-tab-work', opis: 'Realizacja / Praca' },
  { key: 'sterowanie', screen: 'execution-tab-control', opis: 'Realizacja / Sterowanie' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const sumy = {};

for (const e of ekrany) {
  for (const theme of ['light', 'dark']) {
    const url = `${BASE}/?screen=${e.screen}&lang=pl&theme=${theme}&uwagi=0`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.locator('tbody tr, [role="row"]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const path = `${OUT}/${e.key}-${theme}.png`;
    await page.screenshot({ path, fullPage: false });
    sumy[`${e.key}-${theme}`] = createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 12);
    // Dolna krawedz panelu vs dolna krawedz obszaru tresci - jednym zdaniem do raportu.
    const styk = await page.evaluate(() => {
      const w = document.querySelector('[data-preview-pane]');
      const layout = w && (w.closest('.flex.h-full') || w.parentElement);
      const tab = layout && layout.querySelector('.flex-1');
      if (!w || !tab) return 'brak panelu';
      return `panel dol=${Math.round(w.getBoundingClientRect().bottom)}px, tabela dol=${Math.round(tab.getBoundingClientRect().bottom)}px`;
    });
    console.log(`${path} | ${styk}`);
  }
}
await browser.close();

let blad = 0;
for (const e of ekrany) {
  const l = sumy[`${e.key}-light`], d = sumy[`${e.key}-dark`];
  if (l === d) { console.log(`BLAD: ${e.key} light i dark to TEN SAM obraz (${l})`); blad = 1; }
}
console.log(blad ? 'ZRZUTY: para motywow zduplikowana' : 'ZRZUTY: kazda para light/dark to dwa rozne obrazy');
process.exit(blad);
