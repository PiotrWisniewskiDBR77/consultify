/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU 09 FINANSE (paczka J9, program spójności
 * językowej `docs/program/JEZYK_EN_PL_20260908/PLAN.md`).
 *
 * DLACZEGO ISTNIEJE (pomiar 08.09, `evidence/jezyk-j9/przed/`): konto
 * angielskie widziało w tym module 176 polskich `defaultValue` w `t()`,
 * 183 polskie napisy wpisane wprost w JSX i 49 miejsc formatujących liczbę,
 * kwotę albo datę z `'pl-PL'` w wywołaniu. `src/i18n.ts` ustawia
 * `fallbackLng: { en: ['en'] }`, więc EN NIGDY nie spada na plik PL: spada na
 * `defaultValue` z KODU. Polski default jest równoznaczny z polskim ekranem
 * dla Anglika, a `useSuspense: false` pokazuje go jeszcze zanim plik EN
 * dojedzie.
 *
 * TEN TEST CZYTA ŹRÓDŁO, nie renderuje — dlatego łapie też miejsca, których
 * żaden zrzut nie odwiedził (panele wartości za flagą, kroki wyceny, kreator
 * analizy, dziennik rekoncyliacji). Skaner `scripts/i18n/pomiar-jezyka.mjs`
 * liczy tylko `.tsx` w kategorii K4; ten test obejmuje również `.ts` (tam
 * siedzą `statementReadinessCopy.ts`, `baselineLabels.ts`,
 * `analysisKpiTable.contract.ts`).
 *
 * ZASIĘG: `src/components/Finance/**` i `src/components/Economics/**` — oba
 * katalogi to moduł 09 wg mapy w `pomiar-jezyka.mjs` (nazwa „Economics" jest
 * historyczna; tam mieszka FinanceHub i panele wartości).
 * POZA zasięgiem, świadomie: `src/views/AppPricingView.tsx`
 * i `src/views/PricingView.tsx` (strony cennika — treść handlowa, osobna
 * decyzja) oraz `src/components/Benefits/ValuationWorkspace.tsx` (moduł 08).
 *
 * MUTACJA (dowód, że test nie jest dekoracją) — każdy z trzech `it` ma własną:
 *   1. zamiana dowolnego `t('klucz', 'English')` w zasięgu na
 *      `t('klucz', 'Polski tekst')`  → RED w pierwszym `it`;
 *   2. wpisanie `<p>Brak danych</p>` w dowolny plik zasięgu → RED w drugim;
 *   3. wpisanie `x.toLocaleString('pl-PL')` w dowolny plik → RED w trzecim.
 * Wykonana i opisana w `evidence/jezyk-j9/README.md`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KATALOGI = [
  path.resolve(__dirname, '..'), // src/components/Finance
  path.resolve(__dirname, '../../Economics'),
];
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Same diakrytyki NIE WYSTARCZAJĄ i to jest zmierzone, nie teoretyczne:
 * „Brak danych", „Wybierz plik", „Nowa pozycja", „Zastosowano: dodane {{n}}",
 * „Ostatnie udane przeliczenie" to zdania w pełni polskie BEZ ani jednego
 * ogonka — wszystkie siedziały w tym module i wszystkie przeszłyby detektor
 * wyłącznie diakrytyczny. Dlatego test dokłada słownik polskich słów
 * funkcyjnych, i to TEN SAM, na którym stoi `scripts/i18n/pomiar-jezyka.mjs`
 * — żeby bezpiecznik i przyrząd pomiarowy nie rozjechały się definicją
 * „polskiego" (gdy rozjadą się, jedno z dwóch zacznie cicho przepuszczać).
 */
const WYJATKI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../scripts/i18n/pomiar-jezyka.wyjatki.json'),
    'utf8'
  )
) as { polskieSilne: string[] };

const POLSKIE_SLOWA = new Set([
  ...WYJATKI.polskieSilne,
  // Domierzone w J9 — słowa, które faktycznie stały w tym module bez ogonka.
  'zastosowano',
  'wczytano',
  'dodane',
  'zmienione',
  'wyczyszczone',
  'okres',
  'wiersz',
  'wiersze',
  'wierszy',
  'kwartalnie',
  'rocznie',
  'miesiecznie',
  'przeliczenie',
  'przeliczono',
  'nazwa',
  'nowa',
  'nowy',
  'nowe',
  'wersja',
  'wersji',
  'zalozenia',
  'zalozenie',
  'wykres',
  'kwota',
  'tys',
  'mln',
  'mld',
]);

function czyPolski(tekst: string): boolean {
  if (DIAKRYTYKI.test(tekst)) return true;
  return tekst
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .some((slowo) => POLSKIE_SLOWA.has(slowo.toLowerCase()));
}

/**
 * Pliki świadomie WYŁĄCZONE, każdy z powodem. To NIE jest „lista, na którą
 * dopisuje się kolejny plik, gdy test zaświeci" — dopisanie czegokolwiek tutaj
 * wymaga takiego samego uzasadnienia jak wpisy poniżej.
 */
const WYLACZONE: Record<string, string> = {
  // Para słowników PL/EN wybierana przez `isPolish` — poprawny wzorzec
  // dwujęzyczny, nie polski default (patrz nagłówek pliku).
  'financeEnums.ts': 'para słowników pl/en wybierana przez isPolish',
  'financeModelLabels.ts': 'para słowników pl/en wybierana przez isPolish',
  'financeErrorMap.ts': 'mapa kodów błędu na parę pl/en',
  // Etykiety cyklu życia trzymają `pl` i `en` obok siebie w jednym obiekcie
  // (`WorkspaceBarLabel`), więc polski string JEST tu poprawnym danymi.
  'financeVersionLifecycle.ts': 'obiekty { pl, en } — polski to dana, nie default',
  'financeWorkspaceBar.contract.ts': 'obiekty { pl, en } — polski to dana, nie default',
  // Dane pokazowe właściciela: nazwy modeli i pozycji sprawozdań. Język
  // DANYCH to osobna kategoria (K6) i osobna decyzja właściciela.
  'financeOwnerSampleData.ts': 'zestaw danych pokazowych, nie napisy interfejsu',
};

function pliki(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const wpis of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, wpis.name);
    if (wpis.isDirectory()) {
      if (wpis.name === '__tests__') continue;
      out.push(...pliki(p));
      continue;
    }
    if (!/\.tsx?$/.test(wpis.name)) continue;
    if (/\.test\.tsx?$/.test(wpis.name)) continue;
    if (WYLACZONE[wpis.name]) continue;
    out.push(p);
  }
  return out;
}

/** Komentarze wygaszone spacjami — numery linii zostają nienaruszone. */
function bezKomentarzy(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
}

const ZRODLA = KATALOGI.flatMap((k) => pliki(k)).map((p) => ({
  nazwa: path.relative(path.resolve(__dirname, '../..'), p),
  tekst: bezKomentarzy(fs.readFileSync(p, 'utf8')),
}));

describe('J9 — moduł Finanse mówi do konta angielskiego po angielsku', () => {
  it('zasięg testu nie jest pusty (kontrola negatywna samego przyrządu)', () => {
    // Bez tego `expect([]).toEqual([])` przechodziłby także wtedy, gdyby
    // `pliki()` nic nie znalazło — czyli zielony wynik oznaczałby „nie
    // zmierzyłem", a nie „czysto". To jest ten sam błąd, co „brak pomiaru
    // uznany za wynik".
    expect(ZRODLA.length).toBeGreaterThan(100);
  });

  it('nie ma polskiego defaultValue w t()/ft()', () => {
    const wzorzec =
      /\b(?:ft|t|i18n\.t)\(\s*(?:'[^']+'|"[^"]+"|`[^`]+`)\s*,\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const m of tekst.matchAll(wzorzec)) {
        if (czyPolski(m[2])) trafienia.push(`${nazwa}: „${m[2]}"`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie ma polskich napisów poza t() w treści JSX i etykietach', () => {
    // Tylko TREŚĆ między znacznikami: bez apostrofów, średników i znaku `=`,
    // bo `(filtr === 'wszystkie' || …)` to kod, nie napis na ekranie.
    const tekstJsx = />\s*([^<>{}'"`;=\n][^<>{}'"`;=]*)</g;
    const atrybuty =
      /\b(title|placeholder|aria-label|ariaLabel|alt|label|emptyText|subtitle|helperText|confirmText|cancelText)\s*=\s*"([^"]+)"/g;
    // ŚWIADOMIE BEZ `note:` — jedyne polskie `note:` w tym module to stała
    // `SCENARIO_DEPENDENCY_COVERAGE` w `predictionScenarioModel.ts`, która
    // opisuje OGRANICZENIA SCHEMATU SERWERA dla czytającego kod i NIE MA ANI
    // JEDNEGO konsumenta w `src/` (sprawdzone gremem 08.09). Tłumaczenie
    // dokumentacji na angielski nie zmieniłoby ani jednego piksela ekranu,
    // a lista wyłączeń per PLIK zabrałaby przy okazji realne etykiety, które
    // ten plik mógłby kiedyś dostać.
    const etykietyObiektu = /\b(label|title|reason|description|tooltip)\s*:\s*'([^']+)'/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const wzorzec of [tekstJsx, atrybuty, etykietyObiektu]) {
        for (const m of tekst.matchAll(wzorzec)) {
          const wartosc = m[m.length - 1];
          if (czyPolski(wartosc)) trafienia.push(`${nazwa}: „${wartosc.trim()}"`);
        }
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie formatuje dat, liczb ani kwot z locale przybitym na sztywno', () => {
    // SSOT: src/utils/listDateFormat.ts (formatListDate / formatListDateTime /
    // formatListTime / formatListNumber / formatListCurrency /
    // formatListPercent / localeListy).
    const wzorce = [
      /toLocale(?:Date|Time)?String\(\s*\)/g,
      /toLocale(?:Date|Time)?String\(\s*'(?:pl-PL|en-US|en-GB|de-DE)'/g,
      /new Intl\.(?:DateTime|Number)Format\(\s*'(?:pl-PL|en-US|en-GB|de-DE)'/g,
      /new Intl\.(?:DateTime|Number)Format\(\s*\)/g,
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
