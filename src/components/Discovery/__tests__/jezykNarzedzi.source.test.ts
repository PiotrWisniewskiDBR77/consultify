/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU NARZĘDZIA (paczka J4, DEC-453).
 *
 * DLACZEGO ISTNIEJE (pomiar 09.09, `evidence/jezyk-j4/`): moduł miał 75
 * polskich `defaultValue` w `t()`, 61 kluczy obecnych wyłącznie w `pl`,
 * 81 polskich napisów wprost w JSX, 35 angielskich napisów na sztywno
 * i 7 dat/liczb formatowanych bez locale z konta. `src/i18n.ts` ustawia
 * `fallbackLng: { en: ['en'] }`, więc konto angielskie NIGDY nie spada na plik
 * PL — spada na `defaultValue` z KODU. Polski default jest tu równoznaczny
 * z polskim ekranem dla Anglika.
 *
 * TEN TEST CZYTA ŹRÓDŁO, nie renderuje — dlatego łapie też miejsca, których
 * żaden zrzut nie odwiedził (kreator sesji narzędzia, warsztat metody, panel
 * Teresy, karta rozstrzygnięcia). Skaner `scripts/i18n/pomiar-jezyka.mjs`
 * liczy głównie TSX i tylko frazy ze słownika; ten test obejmuje również `.ts`
 * (tam siedzą słowniki enumów) i łapie polski BEZ ogonków — dokładnie tę
 * klasę, której skaner nie widział („Strategiczne”, „Operacyjne” w kolumnie
 * CATEGORY na koncie angielskim, `evidence/jezyk-j4/przed/01-biblioteka-en.png`).
 *
 * ZASIĘG: katalogi modułu Narzędzia. Poza zasięgiem świadomie:
 *  - `src/views/ContextBuilder/**` — poddrzewo NIEOSIĄGALNE z `AppRoutes.tsx`
 *    (zmierzone 09.09: CompanyProfileModule / MegatrendScannerModule /
 *    ContextBuilderView nie mają żywego importera; P30-D zastąpił je
 *    `OrganizationProfileModule`). Tłumaczenie martwego kodu to praca bez
 *    użytkownika — STOP paczki J4, do usunięcia osobną decyzją.
 *
 * MUTACJA (dowód, że test nie jest dekoracją): zamiana dowolnego
 * `t('klucz', 'English')` w zasięgu na polski tekst daje RED w drugim `it`;
 * przywrócenie `toLocaleDateString('en-US')` daje RED w ostatnim. Oba
 * sprawdzone 09.09.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KORZEN = path.resolve(__dirname, '../../..'); // src/
const KATALOGI = [
  'components/Discovery',
  'components/DiscoveryTools',
  'components/Studio',
  'components/Megatrend',
  'components/PlaybookEditor',
  'components/TemplateBuilder',
  'components/method-workspace',
];

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Same diakrytyki NIE WYSTARCZAJĄ. „Strategiczne”, „Operacyjne”, „Status”,
 * „Nie wiem” to napisy w pełni polskie bez ani jednego ogonka — i to właśnie
 * one świeciły w kolumnie CATEGORY konta angielskiego, a skaner ich nie
 * policzył. Dlatego test dokłada słownik polskich słów: TEN SAM rdzeń, na
 * którym stoi `scripts/i18n/pomiar-jezyka.mjs`, plus słowa widziane na
 * zrzutach tego modułu — żeby bezpiecznik i przyrząd nie rozjechały się
 * definicją „polskiego”.
 */
const WYJATKI = JSON.parse(
  fs.readFileSync(path.resolve(KORZEN, '../scripts/i18n/pomiar-jezyka.wyjatki.json'), 'utf8')
) as { polskieSilne: string[] };
const POLSKIE_SLOWA = new Set([
  ...WYJATKI.polskieSilne.map((s) => s.toLowerCase()),
  'strategiczne',
  'operacyjne',
  'cyfrowe',
  'automatyzacja',
  'oceny',
  'narzedzie',
  'narzedzia',
  'sesja',
  'sesje',
  'sesji',
  'biblioteka',
  'insighty',
  'raport',
  'raporty',
  'inicjatywa',
  'inicjatywy',
  'pytanie',
  'pytania',
  'odpowiedz',
  'dowod',
  'dowody',
  'poziom',
  'poziomy',
  'krok',
  'kroki',
  'macierz',
  'szablon',
  'szablony',
  'slajd',
  'slajdy',
  'arkusz',
  'arkusze',
  'sekcja',
  'sekcje',
  'wykres',
  'nieznany',
  'nieznana',
  'zapisano',
  'anuluj',
  'zapisz',
  // Rdzenie widziane w TYM module na zrzutach i w mutacjach (09.09). Bez nich
  // bezpiecznik przepuszczał „Niezapisane zmiany" — polski w stu procentach,
  // ale bez ani jednego ogonka i bez słowa z listy `polskieSilne`. Mutacja
  // testowa przechodziła na zielono, czyli bezpiecznik NAGRADZAŁ defekt.
  'zmiana',
  'zmiany',
  'zmian',
  'niezapisane',
  'zapisywanie',
  'wczytywanie',
  'otworz',
  'zamknij',
  'edytuj',
  'potwierdz',
  'powrot',
  'wroc',
  'dalej',
  'wstecz',
  'nowa',
  'nowy',
  'nowe',
  'stan',
  'stany',
  'wynik',
  'wyniki',
  'dane',
  'opis',
  'nazwa',
  'tytul',
  'zakres',
  'widok',
  'widoki',
  'lista',
  'listy',
  'tabela',
  'zadanie',
  'zadania',
  'projekt',
  'klient',
  'firma',
  'rynek',
  'proces',
  'procesy',
  'ryzyko',
  'ryzyka',
  'pomoc',
  'ustawienia',
  'jezyk',
  'wybor',
  'kolumna',
  'kolumny',
  'wiersz',
  'wiersze',
  'gotowy',
  'gotowa',
]);

function czyPolski(tekst: string): boolean {
  if (DIAKRYTYKI.test(tekst)) return true;
  return tekst
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .some((slowo) => POLSKIE_SLOWA.has(slowo.toLowerCase()));
}

/**
 * Pliki świadomie WYŁĄCZONE, każdy z powodem. To nie jest „lista, na którą
 * dopisuje się kolejny plik, gdy test zaświeci”.
 */
const WYLACZONE: Record<string, string> = {
  // ZAPIS DO BAZY, nie napis interfejsu: decyzja właściciela
  // DEC-2026-08-25-55 mówi o czterech kanonicznych POLSKICH etykietach
  // w polu `justification`. Interfejs bierze etykiety z `skipReasonOptionsUi(t)`,
  // ten plik trzyma kanoniczny zapis — przetłumaczenie go zmieniłoby DANE.
  'skipReasonCodes.ts': 'kanoniczny zapis powodu pominięcia do bazy (DEC-2026-08-25-55)',
  // Prompty i instrukcje dla modelu — wsad AI, nie napis dla człowieka.
  // Językiem odpowiedzi steruje `resolveResponseLanguage` (PLAN §2 pkt 8).
  'discoveryPrompts.ts': 'prompty dla modelu, nie napisy interfejsu',
  // SŁOWNIK DWUJĘZYCZNY w kodzie: `COPY: Record<'en' | 'pl', …>` z jawnym
  // wyborem po języku konta. Polskie zdania w gałęzi `pl` to POPRAWNE
  // tłumaczenie, nie defekt — test szukający polskiego znajdzie tu zawsze
  // i zawsze fałszywie (sprawdzone 09.09, 10 trafień).
  'ToolsV8CanonPanel.tsx': 'dwujęzyczny słownik en/pl z jawnym wyborem po języku konta',
  // Kontrakt kart narzędzi: pola `reason` to DOKUMENTACJA dla bramek
  // i deweloperów (dlaczego karta nie ma promptu AI), nigdy nie renderowana.
  'toolCards.contract.ts': 'dokumentacja kontraktu dla bramek, nie napisy interfejsu',
};

function* pliki(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const wpis of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, wpis.name);
    if (wpis.isDirectory()) {
      if (wpis.name === '__tests__' || wpis.name === 'node_modules') continue;
      yield* pliki(p);
    } else if (/\.tsx?$/.test(wpis.name) && !/\.d\.ts$/.test(wpis.name)) {
      yield p;
    }
  }
}

/**
 * KOMENTARZE WYCINAMY przed skanowaniem. Powód jest zmierzony, nie
 * teoretyczny: pierwszy przebieg tego testu (09.09) zaświecił na WŁASNYM
 * komentarzu opisującym naprawę („wcześniej stało tu toLocaleTimeString('pl-PL')”)
 * i na notatkach projektowych po polsku. Bezpiecznik ma pilnować tego, co widzi
 * UŻYTKOWNIK — komentarz nie trafia do interfejsu, a karanie za opis naprawy
 * uczy usuwać komentarze zamiast defektów.
 */
function bezKomentarzy(tekst: string): string {
  return tekst.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

const ZRODLA = KATALOGI.flatMap((k) => [...pliki(path.join(KORZEN, k))])
  .filter((p) => !(path.basename(p) in WYLACZONE))
  .map((p) => ({ nazwa: path.relative(KORZEN, p), tekst: bezKomentarzy(fs.readFileSync(p, 'utf8')) }));

describe('moduł Narzędzia — konto angielskie nie widzi polskiego', () => {
  it('ma co skanować (bezpiecznik przed pustym zbiorem)', () => {
    expect(ZRODLA.length).toBeGreaterThan(100);
  });

  it('nie ma polskiego defaultValue w t()', () => {
    const wzorzec =
      /\bt\(\s*(["'`])[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]]+)+\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,300})\2/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const m of tekst.matchAll(wzorzec)) {
        if (czyPolski(m[3])) trafienia.push(`${nazwa}: „${m[3]}"`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie ma polskich napisów poza t() w treści JSX i etykietach', () => {
    const tekstJsx = />\s*([^<>{}'"`;=\n][^<>{}'"`;=]*)</g;
    const atrybuty =
      /\b(title|placeholder|aria-label|ariaLabel|alt|label|emptyText|subtitle|helperText|tooltip|description)\s*=\s*"([^"]+)"/g;
    const etykietyObiektu = /\b(label|title|name|reason|description)\s*:\s*'([^']+)'/g;
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

  it('nie formatuje dat ani liczb z locale przybitym na sztywno', () => {
    // SSOT: src/utils/listDateFormat.ts (formatListDate / formatListDateTime /
    // formatListTime / formatListNumber / localeListy).
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
});
