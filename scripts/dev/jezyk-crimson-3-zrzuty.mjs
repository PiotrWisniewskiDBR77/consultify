/**
 * DOWOD WZROKIEM paczki JEZYK-CRIMSON-3 (DEC-453, 09.09).
 *
 * Zrzuty PRZED/PO dla trzech miejsc odblokowanych kolorystycznie:
 *   1. WebAuthnSettings.tsx — "What are passkeys?" (martwy komponent,
 *      montowany STANDALONE, dev-render/screens/ustawienia-bezpieczenstwo-webauthn.tsx)
 *   2. CustomTrendCard.tsx (Megatrend) — "Add to the list?" (montowany
 *      STANDALONE, dev-render/screens/megatrend-custom-trend-card.tsx)
 *   3. DBR77ReportTemplate.tsx — "AUTOMATYZUJ"/"Stanowisk" (metoda ma status
 *      coming_soon we frameworkRegistry.ts, montowany STANDALONE z atrapa
 *      danych, dev-render/screens/assessment-dbr77-report.tsx)
 *
 * Zero logowania/bazy — to dev-render harness (CLAUDE.md #7), serwer
 * `npx vite --config dev-render/vite.config.ts --port 3020`.
 *
 * "PRZED" wymaga tresci PRZED naprawa jezykowa. Zamiast osobnego checkoutu
 * gita, ten skrypt przyjmuje etykiete `--stan=przed|po` i po prostu robi
 * zrzut z URL-a, jaki akurat jest na dysku — nadzorca podmienia 3 pliki
 * zrodlowe (git show <SHA_PRZED>:<plik> > <plik>) MIEDZY dwoma przebiegami
 * i przywraca je do stanu naprawionego na koniec (`git checkout HEAD -- <pliki>`).
 *
 * Uzycie:
 *   node scripts/dev/jezyk-crimson-3-zrzuty.mjs <katalog-wyjsciowy> <przed|po>
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.JC3_BASE || 'http://127.0.0.1:3020';
const OUT = process.argv[2];
const STAN = process.argv[3] || 'po';
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();

async function nowaStrona(lang, theme) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  const p = await c.newPage();
  return { c, p };
}

async function zamknijUwagi(p) {
  // PanelUwag.tsx dorzuca floating "Lista"/"Uwagi" w rogu — nie zaslania
  // celu zrzutu (target boxy sa w gornej/srodkowej czesci ekranu), zostaje
  // widoczny celowo jako furniture harnessu (ten sam wzor co inne paczki).
  await p.waitForTimeout(400);
}

async function zrzutPelnejStrony(screen, lang, theme, nazwa) {
  const { c, p } = await nowaStrona(lang, theme);
  await p.goto(`${BASE}/?screen=${screen}&lang=${lang}&theme=${theme}`, {
    waitUntil: 'networkidle',
  });
  await p.waitForTimeout(1000);
  await zamknijUwagi(p);
  await p.screenshot({ path: path.join(OUT, `${nazwa}-${lang}-${theme}.png`) });
  await c.close();
}

async function zrzutPrzewiniety(screen, lang, theme, nazwa, tekstKotwicy, offset = 200) {
  const { c, p } = await nowaStrona(lang, theme);
  await p.goto(`${BASE}/?screen=${screen}&lang=${lang}&theme=${theme}`, {
    waitUntil: 'networkidle',
  });
  await p.waitForTimeout(1000);
  // Kotwica: znajdz element z dokladnym tekstem i przewin go w widok z offsetem
  // (bez tego pierwszy "ekran" pokazuje pusta strone tytulowa raportu, nie cel).
  await p
    .evaluate((args) => {
      const [teksty, off] = args;
      for (const t of teksty) {
        const el = Array.from(document.querySelectorAll('*')).find(
          (e) => e.children.length === 0 && e.textContent && e.textContent.trim() === t
        );
        if (el) {
          const r = el.getBoundingClientRect();
          window.scrollTo(0, r.top + window.scrollY - off);
          return true;
        }
      }
      return false;
    }, [tekstKotwicy, offset])
    .catch(() => {});
  await p.waitForTimeout(500);
  await zamknijUwagi(p);
  await p.screenshot({ path: path.join(OUT, `${nazwa}-${lang}-${theme}.png`) });
  await c.close();
}

const LANGS = ['en', 'pl'];
const THEMES = ['light', 'dark'];

for (const lang of LANGS) {
  for (const theme of THEMES) {
    // 1. WebAuthnSettings — cel jest w gornej czesci ekranu, bez przewijania.
    await zrzutPelnejStrony(
      'ustawienia-bezpieczenstwo-webauthn',
      lang,
      theme,
      `1-webauthn-passkeys-${STAN}`
    );

    // 2. CustomTrendCard — cel (AI Suggestion Banner) tez u gory.
    await zrzutPelnejStrony(
      'megatrend-custom-trend-card',
      lang,
      theme,
      `2-megatrend-add-to-list-${STAN}`
    );

    // 3a. DBR77 — Executive Summary (kafelek "Stanowisk"/"Workstations").
    await zrzutPrzewiniety(
      'assessment-dbr77-report',
      lang,
      theme,
      `3a-dbr77-workstations-tile-${STAN}`,
      ['Workstations', 'Stanowisk'],
      250
    );

    // 3b. DBR77 — Phase 3 box ("AUTOMATYZUJ"/"AUTOMATE").
    await zrzutPrzewiniety(
      'assessment-dbr77-report',
      lang,
      theme,
      `3b-dbr77-automate-phase-${STAN}`,
      ['AUTOMATE', 'AUTOMATYZUJ'],
      120
    );
  }
}

await b.close();
console.log(`OK — zrzuty (${STAN}) zapisane w ${OUT}`);
