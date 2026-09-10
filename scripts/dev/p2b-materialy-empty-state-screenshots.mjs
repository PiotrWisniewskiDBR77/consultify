// Evidence capture — P2B (DEC-457) — puste stany czterech ekranów Materiałów
// (Prezentacje, dwa ekrany Outputów zbiorczych, Arkusze) PRZED/PO łatce
// `materialy-empty-state-fix-ZABLOKOWANY-mvp-final.patch`.
//
// Uzywa dev-render harnessu (REALNY <ReportsAndPresentationsHub>, mock fetch,
// zero logowania, zero backendu) — ekran `day267-materialy-hub-zrzuty`,
// `&state=empty` wymusza pustą tabelę. Serwer startowany ręcznie:
//   npx vite --config dev-render/vite.config.ts --port 3103 --strictPort
//
// Usage: node scripts/dev/p2b-materialy-empty-state-screenshots.mjs <out-dir> <faza:przed|po>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.APP_BASE_URL || 'http://localhost:3103';
const OUT = process.argv[2] || '/private/tmp/p2b-materialy-empty';
const FAZA = process.argv[3] || 'przed';

fs.mkdirSync(OUT, { recursive: true });

// UWAGA (pomiar 2026-09-10): `parseRapTabFromQuery` (outputsLibraryTabQuery.ts)
// akceptuje krótkie aliasy ('all'/'documents'/'sheets'/'presentations'), NIE
// wewnętrzne wartości RapTab ('outputs_all'/'outputs_documents'/...) — pierwsza
// wersja tego skryptu używała złych aliasów i po cichu lądowała zawsze na
// 'outputs_all' (pusty stan z działającym CTA), maskując prawdziwy defekt.
//
// UWAGA #2 (pomiar 2026-09-10, żywy klik): `OutputsAggregateTabContent` ma
// WCZEŚNIEJSZY early-return „Teresa onboarding" (rows.length===0 && brak
// szukania/filtra) z WŁASNYM działającym CTA („Wygeneruj z Teresą") — ten
// stan jest już DOBRY, patch go nie rusza. `empty` prop na StandardTable,
// który patch naprawia, jest osiągalny TYLKO gdy `searchQuery` jest
// niepuste a `activeFilters.length===0` (zero trafień wyszukiwania, bez
// aktywnego czipa filtra Menu 3 — czip filtra prowadzi do INNEJ, twardo
// zakodowanej gałęzi StandardTable „No items found" — angielski tekst bez
// akcji, POZA zakresem tej łatki, zgłoszony osobno jako STOP). Dlatego dla
// obu ekranów Outputów zbiorczych skrypt wpisuje fałszywe zapytanie w
// wyszukiwarkę zamiast polegać na samym &state=empty.
const screens = [
  { key: 'prezentacje', tab: 'presentations', viaSearch: false },
  { key: 'outputy-wszystkie', tab: 'all', viaSearch: true },
  { key: 'outputy-dokumenty', tab: 'documents', viaSearch: true },
  { key: 'arkusze', tab: 'sheets', viaSearch: false },
];
const themes = ['light', 'dark'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

for (const s of screens) {
  for (const theme of themes) {
    const url = `${BASE}/?screen=day267-materialy-hub-zrzuty&tab=${s.tab}&state=empty&theme=${theme}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);
    if (s.viaSearch) {
      // Otwórz pole szukania (ikona lupy w Menu 1) i wpisz zapytanie bez
      // trafień — to jedyna żywa ścieżka do gałęzi `empty` StandardTable
      // (patrz UWAGA #2 wyżej).
      await page.locator('button:has(svg)').first().click();
      await page.waitForTimeout(150);
      const search = page.locator('input[placeholder*="zukaj" i], input[type="search"]').first();
      await search.click();
      await search.fill('zzz-brak-wynikow-p2b');
      await page.waitForTimeout(500);
    }
    const path = `${OUT}/${s.key}-${FAZA}-${theme}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log('saved', path);
  }
}

await browser.close();
console.log('DONE', FAZA);
