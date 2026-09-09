/**
 * BEZPIECZNIK JĘZYKOWY — paczka J-DOG-B (2026-09-09, moduł 14 Admin Panel).
 *
 * DLACZEGO ISTNIEJE. `src/components/Admin/__tests__/jezykAdmina.source.test.ts`
 * broni ekranów panelu administratora ORGANIZACJI (`views/admin`,
 * `components/Admin`) i świadomie pomija `src/views/superadmin/**` oraz
 * `src/components/SuperAdmin/**` — to osobna powierzchnia (rola SUPERADMIN),
 * z własnym długiem językowym opisanym w `evidence/jezyk-j14/README.md`.
 *
 * Naprawa J-DOG-B (K1def/K1defWID/K3aKLUCZ/K4pl priorytet 1, moduł
 * "14 Admin Panel" wg `scripts/i18n/pomiar-jezyka.mjs`) dotknęła plików z
 * DOKŁADNIE tej pominiętej powierzchni (`components/billing/*`,
 * `views/superadmin/*`) — rozszerzanie `jezykAdmina.source.test.ts` przez
 * dopisanie tych katalogów do jego `KATALOGI` złamałoby udokumentowaną
 * granicę (i natychmiast zaświeciłoby na CAŁYM nienaprawionym długu
 * superadmina — 543 K4en w samym module, poza zakresem tej paczki).
 *
 * Dlatego osobny, WĄSKI bezpiecznik: lista KONKRETNYCH plików naprawionych
 * w J-DOG-B (nie cały katalog), też czytający źródło, tymi samymi wzorcami
 * co `jezykAdmina.source.test.ts` (diakrytyki + słownik słów bez ogonków +
 * blokada rozgałęzień językowych + blokada locale przybitego na sztywno).
 *
 * MUTACJA (dowód, że to nie dekoracja) — sprawdzone 09.09:
 *   - przywrócenie `t('billing.analytics.loadError', 'Nie udało się...')`
 *     → RED w „nie ma polskiego defaultValue w t()";
 *   - przywrócenie `new Intl.NumberFormat('pl-PL', ...)` w
 *     `UsageAlertsConfig.tsx` → RED w „nie formatuje dat/liczb z locale
 *     przybitym na sztywno".
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KORZEN = path.resolve(__dirname, '../../..'); // src/

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

const WYJATKI = JSON.parse(
  fs.readFileSync(path.resolve(KORZEN, '../scripts/i18n/pomiar-jezyka.wyjatki.json'), 'utf8')
) as { polskieSilne: string[] };

/** TEN SAM rdzeń co przyrząd pomiarowy, plus słowa bez ogonków widoczne w
 * plikach naprawianych w tej paczce (subskrypcje/rozliczenia/LLM health). */
const POLSKIE_SLOWA = new Set([
  ...WYJATKI.polskieSilne.map((s) => s.toLowerCase()),
  'rezygnacje',
  'rezygnacji',
  'netto',
  'rozszerzenie',
  'ograniczenie',
  'miesiac',
  'analiza',
  'lacznie',
  'niedostepne',
  'dzialanie',
  'sprawdzanie',
  'odswiez',
  'testuj',
  'edytuj',
  'konfiguracje',
  'wpisz',
  'ponownie',
  'providerow',
]);

function czyPolski(tekst: string): boolean {
  if (DIAKRYTYKI.test(tekst)) return true;
  return tekst
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .some((slowo) => POLSKIE_SLOWA.has(slowo.toLowerCase()));
}

/** Pliki naprawione w J-DOG-B (priorytet 1: K1def/K1defWID/K3aKLUCZ/K4pl,
 * moduł "14 Admin Panel"), niezależnie od tego, że część leży poza zasięgiem
 * jezykAdmina.source.test.ts (patrz komentarz u góry pliku). */
const PLIKI_NAPRAWIONE = [
  'components/billing/SubscriptionAnalytics.tsx',
  'components/billing/TaxSettingsForm.tsx',
  'components/billing/UsageAlertsConfig.tsx',
  'components/billing/UsageMeters.tsx',
  'views/superadmin/SuperAdminFeedbackView.tsx',
  'views/superadmin/LLMManagementView.tsx',
  'views/superadmin/components/LLMHealthPanel.tsx',
];

const ZRODLA = PLIKI_NAPRAWIONE.map((rel) => ({
  nazwa: rel,
  tekst: fs.readFileSync(path.join(KORZEN, rel), 'utf8'),
}));

describe('J-DOG-B — pliki naprawione nie widzą polskiego na koncie angielskim', () => {
  it('ma co skanować (bezpiecznik przed pustym zbiorem / usuniętym plikiem)', () => {
    expect(ZRODLA.length).toBe(PLIKI_NAPRAWIONE.length);
    for (const { tekst } of ZRODLA) expect(tekst.length).toBeGreaterThan(0);
  });

  it('nie ma polskiego defaultValue w t()', () => {
    const wzorzec =
      /\bt\(\s*(["'`])[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]-]+)+\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,400})\2/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const m of tekst.matchAll(wzorzec)) {
        if (czyPolski(m[3])) trafienia.push(`${nazwa}: „${m[3]}"`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie ma polskich napisów sztywnych w JSX (placeholder/etykieta poza t())', () => {
    const wzorce = [
      /placeholder\s*=\s*'([^']{2,300})'/g,
      />\s*([A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż][^<>{}'"`;=\n]{2,120})</g,
    ];
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const wzorzec of wzorce) {
        for (const m of tekst.matchAll(wzorzec)) {
          const wartosc = String(m[m.length - 1]).trim();
          if (czyPolski(wartosc)) trafienia.push(`${nazwa}: „${wartosc}"`);
        }
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie formatuje dat ani liczb z locale przybitym na sztywno', () => {
    // SSOT: src/utils/listDateFormat.ts
    const wzorce = [
      /toLocale(?:Date|Time)?String\(\s*\)/g,
      /toLocale(?:Date|Time)?String\(\s*'(?:pl-PL|en-US|en-GB)'/g,
      /new Intl\.(?:DateTime|Number)Format\(\s*'(?:pl-PL|en-US|en-GB)'/g,
    ];
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const wzorzec of wzorce) {
        for (const m of tekst.matchAll(wzorzec)) trafienia.push(`${nazwa}: ${m[0]}`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie rozgałęzia napisów po języku zamiast używać i18n', () => {
    // Świadomie BEZ `i18n.language === 'pl'` w tej liście: w
    // SuperAdminFeedbackView.tsx ten wzorzec wybiera obiekt locale date-fns
    // (`{ locale: i18n.language === 'pl' ? pl : enUS }`) — to POPRAWNE użycie
    // i18n, nie ominięcie go. Anty-wzorzec z jezykAdmina.source.test.ts
    // (dwa równoległe napisy zamiast t()) to `isPolish` / `language.startsWith('pl')`.
    const wzorce = [
      /\bisPolish\b/g,
      /\blanguage\s*(?:\?\.)?\.?toLowerCase\(\)\s*\.startsWith\(\s*['"]pl['"]\s*\)/g,
    ];
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const wzorzec of wzorce) {
        for (const m of tekst.matchAll(wzorzec)) trafienia.push(`${nazwa}: ${m[0]}`);
      }
    }
    expect(trafienia).toEqual([]);
  });
});
