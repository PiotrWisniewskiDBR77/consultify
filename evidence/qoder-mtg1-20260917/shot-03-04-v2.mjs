/**
 * Wpis 70 P2 (DEC-596) — dowód wzrokowy PRZED/PO dla zrzutów 03/04 etapu 2.
 *
 * Defekt: podgląd listy Spotkań w sekcji RELATIONS pokazywał polski fallback
 * generyczny „Powiązany rekord" w EN UI, bo relacja projektu miała `label`
 * zaczynający się od `Project:` (łapie `TECHNICAL_PREFIX_PATTERN`), a NIE miała
 * `type` — więc `relationFallbackLabel(undefined)` oddawał generyk.
 *
 * PRZED = harness na bazie etapu 2 (`71b2184985`, port 5431, worktree
 * `~/Developer/qoder-wt/d70-base-check`), PO = harness z naprawą (port 5430).
 * Oba renderują REALNY `<MeetingHub>` (ekran `mtg1-etap2`), motyw przełączany
 * storem aplikacji przez `&theme=`, NIE `emulateMedia`; `&uwagi=0` zdejmuje
 * pływający panel harnessu. `bledyKonsoli` liczone od listenerów podpiętych
 * PRZED navigacją.
 *
 * Uruchomienie (z korzenia repo):
 *   node evidence/qoder-mtg1-20260917/shot-03-04-v2.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KATALOG = dirname(fileURLToPath(import.meta.url));
const WARIANTY = [
  { stan: 'PRZED', port: 5431 },
  { stan: 'PO', port: 5430 },
];
const MOTYWY = ['light', 'dark'];
const WIERSZ = 'Weekly PMO Review';

const wyniki = [];

for (const { stan, port } of WARIANTY) {
  for (const theme of MOTYWY) {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const bledyKonsoli = [];
    const bledyStrony = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') bledyKonsoli.push(msg.text());
    });
    page.on('pageerror', (err) => bledyStrony.push(String(err)));

    const url = `http://127.0.0.1:${port}/?screen=mtg1-etap2&view=list&lang=en&theme=${theme}&uwagi=0`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByText(WIERSZ).first().click();
    await page.waitForSelector('[data-preview-block="relations"]', { timeout: 20000 });
    await page.waitForTimeout(400);

    const chipy = await page.$$eval('[data-preview-block="relations"] span, [data-preview-block="relations"] button', (els) =>
      els.map((el) => (el.textContent || '').trim()).filter(Boolean)
    );
    const tooltipy = await page.$$eval('[data-preview-block="relations"] [title]', (els) =>
      els.map((el) => el.getAttribute('title'))
    );
    const tekstPodgladu = await page.evaluate(() => document.body.innerText);

    const przedrostek = stan === 'PRZED' ? `03-04-${theme}-PRZED` : `0${theme === 'light' ? 3 : 4}v2-lista-podglad-${theme}`;
    const calosc = resolve(KATALOG, `${przedrostek}.png`);
    await page.screenshot({ path: calosc });
    const blok = await page.$('[data-preview-block="relations"]');
    const klip = resolve(KATALOG, `${przedrostek}-relations-clip.png`);
    if (blok) await blok.screenshot({ path: klip });

    wyniki.push({
      stan,
      theme,
      url,
      bledyKonsoli: bledyKonsoli.length,
      bledyStrony: bledyStrony.length,
      chipy,
      tooltipy,
      maPolskiFallback: tekstPodgladu.includes('Powiązany rekord'),
      plik: `${przedrostek}.png`,
      klip: `${przedrostek}-relations-clip.png`,
      szczegolyBledow: [...bledyKonsoli, ...bledyStrony].slice(0, 5),
    });
    await browser.close();
  }
}

writeFileSync(resolve(KATALOG, 'shot-03-04-v2-wynik.json'), JSON.stringify(wyniki, null, 2));
for (const w of wyniki) {
  console.log(
    `${w.stan} ${w.theme}: bledyKonsoli=${w.bledyKonsoli} bledyStrony=${w.bledyStrony} ` +
      `polskiFallback=${w.maPolskiFallback} chipy=${JSON.stringify(w.chipy)}`
  );
}
