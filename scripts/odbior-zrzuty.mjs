/**
 * Zrzuty ekranów do ODBIORU — powtarzalny harness (2026-07-23).
 *
 * Renderuje ekrany dev-render (mock-dane, bez logowania) i zapisuje PNG-i do
 * `rejestr/_zrzuty/<ID>.png` + miniatury JPEG do `rejestr/_zrzuty/mini/<ID>.jpg`
 * (miniatury idą jako data-URI do zakładki „Odbiór" w raporcie — CSP artefaktu
 * nie wpuszcza zewnętrznych obrazów, więc muszą być wklejone).
 *
 * Reguła #7 CLAUDE.md: to JA renderuję i oglądam zanim zobaczy Piotr.
 *
 * Użycie:
 *   1) uruchom harness:  npx vite --config dev-render/vite.config.ts --port 3040
 *   2) node scripts/odbior-zrzuty.mjs [--port 3040] [--only ID1,ID2]
 *
 * Dodanie ekranu do partii = jeden wpis w EKRANY poniżej.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = getArg('port', '3040');
const ONLY = getArg('only', '').split(',').filter(Boolean);

const OUT = path.resolve('rejestr/_zrzuty');
const OUT_MINI = path.join(OUT, 'mini');

/**
 * Jedna pozycja = jedna rzecz do odebrania.
 * `steps` to opcjonalne kliknięcia w stronie PRZED zrzutem (czysty JS w page).
 */
const EKRANY = [
  {
    id: 'ODB-EXCEL-01',
    tytul: 'Excel: zakładka „Generator szablonów Excel" (7 wzorców)',
    screen: 'gen-excel-templates-tab',
    viewport: { width: 1280, height: 900 },
  },
  {
    id: 'ODB-EXCEL-02',
    tytul: 'Excel: formularz parametrów + zapis presetu',
    screen: 'gen-excel-templates-tab',
    viewport: { width: 1280, height: 900 },
    steps: `const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Budżet operacyjny')); if(b) b.click();`,
  },
  {
    id: 'ODB-EXCEL-03',
    tytul: 'Excel: wynik — mini-wykres + siatka z formułami + badge jakości',
    screen: 'gen-excel-templates-tab',
    viewport: { width: 1280, height: 1000 },
    steps: `const c=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Model P')); if(c) c.click();
            await new Promise(r=>setTimeout(r,250));
            const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Zbuduj skoroszyt')); if(b) b.click();
            await new Promise(r=>setTimeout(r,600));`,
  },
  {
    id: 'ODB-DECK-01',
    tytul: 'Gen. Deck: Architekt — sylwetki slajdów, wskazówki treści, briefing (edytowalny)',
    screen: 'gen-deck-content-hints',
    viewport: { width: 1280, height: 1400 },
    steps: `const r=[...document.querySelectorAll('div,span')].find(e=>e.children.length===0 && e.textContent.trim()==='Steering Committee Deck Template'); if(r) r.click();
            await new Promise(r2=>setTimeout(r2,400));
            const i=[...document.querySelectorAll('input')].find(x=>x.value==='Overall Program Status'); if(i) i.scrollIntoView({block:'center'});
            await new Promise(r2=>setTimeout(r2,200));`,
  },
  {
    id: 'ODB-DECK-02',
    tytul: 'Gen. Deck: chipy wizualizacji + wycofanie draftu (danger)',
    screen: 'gen-deck-content-hints',
    viewport: { width: 1280, height: 860 },
    fit: 'viewport', // kadr skupiony: nagłówek edytora (przycisk danger + chipy), bez całej listy slajdów
    steps: `const r=[...document.querySelectorAll('div,span')].find(e=>e.children.length===0 && e.textContent.trim()==='Steering Committee Deck Template'); if(r) r.click();
            await new Promise(r2=>setTimeout(r2,400));
            const h=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && e.textContent.trim().startsWith('Outline editor')); if(h) h.scrollIntoView({block:'start'});
            await new Promise(r2=>setTimeout(r2,250));
            window.scrollBy(0,-90);
            await new Promise(r2=>setTimeout(r2,150));`,
  },
  {
    id: 'ODB-DECK-03',
    tytul: 'Deck: badge jakości na wyniku kreatora (critic + score)',
    screen: 'deck-quality-badge',
    viewport: { width: 1280, height: 700 },
  },
  {
    id: 'ODB-WORD-01',
    tytul: 'Gen. Word: Architekt — wskazówki treści + briefing edytowalny (draft)',
    screen: 'gen-word-content-hints',
    query: '&ff_tpl_editor=1',
    viewport: { width: 1280, height: 1400 },
    maxH: 1900, // 6 sekcji × pola briefingu potrafi urosnąć — tnę do czytelnej wysokości
    steps: `const r=[...document.querySelectorAll('div,span,td')].find(e=>e.children.length===0 && e.textContent.trim()==='Raport zarządczy (miesięczny)'); if(r) r.click();
            await new Promise(r2=>setTimeout(r2,400));`,
  },
  {
    id: 'ODB-WORD-02',
    tytul: 'Gen. Word: podgląd struktury dokumentu (read-only + briefing)',
    screen: 'gen-word-content-hints',
    query: '&ff_tpl_editor=0',
    viewport: { width: 1280, height: 1100 },
    steps: `const r=[...document.querySelectorAll('div,span,td')].find(e=>e.children.length===0 && e.textContent.trim()==='Raport zarządczy (miesięczny)'); if(r) r.click();
            await new Promise(r2=>setTimeout(r2,400));`,
  },
  {
    id: 'ODB-WORD-03',
    tytul: 'Word: badge fabrykacji w panelu QA (zdegradowane)',
    screen: 'word-quality-badge',
    viewport: { width: 1280, height: 600 },
    steps: `const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Uruchom QA')); if(b) b.click();
            await new Promise(r=>setTimeout(r,500));`,
  },
];

const THEMES = ['light', 'dark'];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(OUT_MINI, { recursive: true });

  const lista = ONLY.length ? EKRANY.filter((e) => ONLY.includes(e.id)) : EKRANY;
  const browser = await chromium.launch();
  const manifest = [];

  for (const ekran of lista) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({
        viewport: ekran.viewport || { width: 1280, height: 900 },
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      const url = `http://localhost:${PORT}/?screen=${ekran.screen}&lang=pl&theme=${theme}${ekran.query || ''}`;
      const errors = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);
      if (ekran.steps) {
        await page.evaluate(`(async () => { ${ekran.steps} })()`);
        await page.waitForTimeout(400);
      }

      // Kadr do TREŚCI: ekrany harnessu mają h-screen/min-h-screen, więc
      // fullPage łapie hektary bieli. Mierzymy dolną krawędź realnej treści
      // i przycinamy widok do niej (z zapasem), zamiast zrzucać cały dokument.
      const contentH = await page.evaluate(() => {
        const root = document.getElementById('dev-render-root');
        if (!root) return null;
        let max = 0;
        root.querySelectorAll('*').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.height > 0 && r.width > 0 && r.bottom > max) max = r.bottom;
        });
        return Math.ceil(max + window.scrollY) + 28;
      });
      // fit:'viewport' = kadr skupiony (bez dopasowania do treści) — dla pozycji,
      // gdzie liczy się góra ekranu, nie cała długa lista.
      if (ekran.fit !== 'viewport' && contentH && contentH > 200) {
        const w = (ekran.viewport || {}).width || 1280;
        await page.setViewportSize({ width: w, height: Math.min(contentH, ekran.maxH || 3200) });
        await page.waitForTimeout(250);
      }

      const suffix = theme === 'light' ? '' : '-dark';
      const png = path.join(OUT, `${ekran.id}${suffix}.png`);
      await page.screenshot({ path: png });

      // miniatura JPEG (do wklejenia w artefakt — mniejsza waga niż PNG)
      const mini = path.join(OUT_MINI, `${ekran.id}${suffix}.jpg`);
      await page.screenshot({ path: mini, type: 'jpeg', quality: 72, scale: 'css' });

      manifest.push({
        id: ekran.id,
        tytul: ekran.tytul,
        theme,
        png: path.relative(process.cwd(), png),
        mini: path.relative(process.cwd(), mini),
        url,
        consoleErrors: errors,
      });
      console.log(`✓ ${ekran.id} [${theme}]${errors.length ? ` ⚠ ${errors.length} błędów konsoli` : ''}`);
      await ctx.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const zErr = manifest.filter((m) => m.consoleErrors.length);
  console.log(`\nGotowe: ${manifest.length} zrzutów → ${OUT}`);
  if (zErr.length) console.log(`⚠ Ekrany z błędami konsoli: ${zErr.map((m) => m.id + '/' + m.theme).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
