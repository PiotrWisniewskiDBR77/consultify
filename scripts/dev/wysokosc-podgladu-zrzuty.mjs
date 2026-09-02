/* eslint-disable */
/**
 * Zrzuty dowodowe do naprawy wysokosci podgladu (uwaga wlasciciela 02.09:
 * „Preview nie jest wysokie na wysokosc przestrzeni od menu 3 do dolu strony").
 *
 * Trzy ekrany rodziny x dwa motywy. `uwagi=0` wylacza panel uwag harnessu -
 * bez tego kontrolki przyrzadu zasłaniaja produkt i zrzut pokazuje nie to,
 * co ocenia wlasciciel.
 *
 * Skrypt NIE mierzy pelnego kanonu - pomiar szerokosci/kolejnosci blokow robi
 * scripts/dev/measure-preview-canon.mjs --wysokosc. Tutaj: dowod wzrokowy +
 * mechaniczna kontrola, ze para light/dark to dwa ROZNE obrazy (para
 * „duplikat zamiast motywu" juz raz przeszla odbior) + (opt-in --k4) pomiar
 * LITERALNY warunku wlasciciela „od menu 3 do dolu strony".
 *
 * Parametry (wszystkie opt-in, domyslne = zachowanie sprzed tej zmiany):
 *   --port=3352        port harnessu dev-render (byl na sztywno 3352)
 *   --out=evidence/...  katalog docelowy zrzutow (byl na sztywno wpisany)
 *   --tag=              dopisek do nazwy pliku, np. --tag=przed -> zasoby-przed-light.png
 *                       (pusty tag = nazwy jak dotychczas: zasoby-light.png)
 *   --screens=zasoby,praca,sterowanie   podzbior rodziny do zrzucenia
 *   --k4                dolacza pomiar literalny: gorna krawedz podgladu vs
 *                       dolna krawedz Menu 3, dolna krawedz podgladu vs dol
 *                       viewportu (dokladnie warunek wlasciciela z 02.09).
 *                       Kotwica Menu 3 = pierwsze dziecko root-a
 *                       StandardModuleBar (`.flex.flex-col.h-full`) o klasie
 *                       `flex-1` — to jest content-area sasiadujacy z paskiem
 *                       Menu1/2/3, wiec jego gorna krawedz == dolna krawedz Menu 3.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';

const arg = (n, d) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const flag = (n) => process.argv.slice(2).includes(`--${n}`);

const PORT = arg('port', '3352');
const OUT = arg('out', 'evidence/grafika/220-wysokosc-podgladu');
const TAG = arg('tag', '');
const K4 = flag('k4');
const SCREEN_KEYS = arg('screens', 'zasoby,praca,sterowanie').split(',').map((s) => s.trim());
const BASE = `http://localhost:${PORT}`;

mkdirSync(OUT, { recursive: true });

const WSZYSTKIE = [
  { key: 'zasoby', screen: 'execution-tab-resources', opis: 'Realizacja / Zasoby (ekran ze zrzutu wlasciciela)' },
  { key: 'praca', screen: 'execution-tab-work', opis: 'Realizacja / Praca' },
  { key: 'sterowanie', screen: 'execution-tab-control', opis: 'Realizacja / Sterowanie' },
];
const ekrany = WSZYSTKIE.filter((e) => SCREEN_KEYS.includes(e.key));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const sumy = {};
const pomiaryK4 = {};

for (const e of ekrany) {
  for (const theme of ['light', 'dark']) {
    const url = `${BASE}/?screen=${e.screen}&lang=pl&theme=${theme}&uwagi=0`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.locator('tbody tr, [role="row"]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const suffix = TAG ? `-${TAG}` : '';
    const path = `${OUT}/${e.key}${suffix}-${theme}.png`;
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

    if (K4) {
      const m = await page.evaluate(() => {
        const pane = document.querySelector('[data-preview-pane]');
        // Root StandardModuleBar (paski Menu 1/2/3) = `.flex.flex-col.h-full`
        // ktory poprzedza content-area `.flex-1.min-h-0.overflow-auto`. Gorna
        // krawedz tego content-area == dolna krawedz Menu 3 (sasiadujace divy,
        // bez przerwy). To jest DOKLADNIE „przestrzen od menu 3 do dolu strony".
        const barRoot = document.querySelector('.flex.flex-col.h-full.bg-c-bg');
        const contentArea = barRoot ? barRoot.querySelector(':scope > .flex-1.min-h-0.overflow-auto') : null;
        if (!pane || !contentArea) {
          return { blad: `brak elementu (pane=${!!pane}, contentArea=${!!contentArea})` };
        }
        const paneRect = pane.getBoundingClientRect();
        const menu3Bottom = contentArea.getBoundingClientRect().top;
        return {
          menu3Bottom: Math.round(menu3Bottom),
          panelTop: Math.round(paneRect.top),
          panelBottom: Math.round(paneRect.bottom),
          viewportBottom: window.innerHeight,
          lukaGora: Math.round(paneRect.top - menu3Bottom),
          lukaDol: Math.round(window.innerHeight - paneRect.bottom),
        };
      });
      pomiaryK4[`${e.key}-${theme}`] = m;
      console.log(`  K4 ${e.key}/${theme}: ${JSON.stringify(m)}`);
    }
  }
}
await browser.close();

let blad = 0;
for (const e of ekrany) {
  const l = sumy[`${e.key}-light`], d = sumy[`${e.key}-dark`];
  if (l === d) { console.log(`BLAD: ${e.key} light i dark to TEN SAM obraz (${l})`); blad = 1; }
}
console.log(blad ? 'ZRZUTY: para motywow zduplikowana' : 'ZRZUTY: kazda para light/dark to dwa rozne obrazy');
if (K4) console.log('POMIARY K4:', JSON.stringify(pomiaryK4, null, 2));
process.exit(blad);
