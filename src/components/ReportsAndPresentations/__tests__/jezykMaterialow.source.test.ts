/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU MATERIAŁY (paczka J10, DEC-453).
 *
 * DLACZEGO ISTNIEJE (pomiar 08.09, `evidence/jezyk-j10/`): to był NAJGORSZY
 * moduł całego programu językowego — 231 polskich `defaultValue` w `t()`,
 * 634 klucze obecne wyłącznie w `pl`, 165 polskich napisów wprost w JSX
 * i 67 dat/liczb formatowanych bez locale z konta. `src/i18n.ts` ustawia
 * `fallbackLng: { en: ['en'] }`, więc konto angielskie NIGDY nie spada na plik
 * PL — spada na `defaultValue` z KODU. Polski default jest tu równoznaczny
 * z polskim ekranem dla Anglika.
 *
 * TEN TEST CZYTA ŹRÓDŁO, nie renderuje — dlatego łapie także miejsca, których
 * żaden zrzut nie odwiedził (kreator prezentacji, architekt wzorców, panel
 * audytu talii, publiczny czytnik dokumentu). Skaner
 * `scripts/i18n/pomiar-jezyka.mjs` liczy TSX; ten test obejmuje również `.ts`
 * (tam siedzą słowniki enumów i helpery dat).
 *
 * ZASIĘG: katalogi modułu Materiały, które NIE należą do innego modułu
 * zamrożenia. `src/components/ReportBuilder/**` (04_ASSESSMENT) i
 * `src/components/documents/**` (07_MY_WORK_AGENT) są świadomie poza — ich
 * odmrożenie wymaga osobnej decyzji właściciela (STOP paczki J10).
 *
 * MUTACJA (dowód, że test nie jest dekoracją): zamiana dowolnego
 * `t('klucz', 'English')` w zasięgu na `t('klucz', 'Polski tekst')` daje RED
 * w pierwszym `it`; przywrócenie `toLocaleDateString()` bez argumentu daje RED
 * w ostatnim.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { znajdzPolskiJsx, znajdzPolskieDefaultValue } from '../../../../tests/unit/i18n/polskiBezOgonkowWspolny';

const KORZEN = path.resolve(__dirname, '../../..'); // src/
const KATALOGI = [
  'components/DocumentStudio',
  'components/Presentations',
  'components/PresentationStudio',
  'components/Reports',
  'components/ReportsAndPresentations',
];

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Same diakrytyki NIE WYSTARCZAJĄ — „Wszystkie formaty", „Raporty", „Tabele",
 * „Pochodzenie i prawa" to napisy w pełni polskie BEZ ani jednego ogonka
 * (zmierzone na zrzutach EN 08.09, `evidence/jezyk-j10/przed/05-wzorce-en.png`).
 * Dlatego test dokłada słownik polskich słów — TEN SAM rdzeń, na którym stoi
 * `scripts/i18n/pomiar-jezyka.mjs`, plus słowa widziane na zrzutach tego modułu,
 * żeby bezpiecznik i przyrząd pomiarowy nie rozjechały się definicją „polskiego".
 */
const WYJATKI = JSON.parse(
  fs.readFileSync(path.resolve(KORZEN, '../scripts/i18n/pomiar-jezyka.wyjatki.json'), 'utf8')
) as { polskieSilne: string[] };
const POLSKIE_SLOWA = new Set([
  ...WYJATKI.polskieSilne.map((s) => s.toLowerCase()),
  'raport',
  'raporty',
  'raportu',
  'tabela',
  'tabele',
  'prezentacja',
  'prezentacje',
  'prezentacji',
  'dokument',
  'dokumenty',
  'dokumentu',
  'wzorzec',
  'wzorce',
  'wzorca',
  'formaty',
  'pochodzenie',
  'prawa',
  'nieznany',
  'nieznana',
  'szablon',
  'szablony',
  'slajd',
  'slajdy',
  'skoroszyt',
  'arkusz',
  'arkusze',
]);

function czyPolski(tekst: string): boolean {
  if (DIAKRYTYKI.test(tekst)) return true;
  return tekst
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .some((slowo) => POLSKIE_SLOWA.has(slowo.toLowerCase()));
}

/**
 * Pliki świadomie WYŁĄCZONE, każdy z powodem. To nie jest „lista, na którą
 * dopisuje się kolejny plik, gdy test zaświeci".
 */
const WYLACZONE: Record<string, string> = {
  // DANE pokazowe (tytuły raportów, nazwiska właścicieli) — treść rekordów,
  // nie interfejsu. Język danych to osobna kategoria i osobna paczka.
  'materialsOwnerSampleData.ts': 'zestaw danych pokazowych, nie napisy interfejsu',
  // Generator treści raportu: buduje ZDANIA RAPORTU w języku konta przez
  // jawny warunek `pl ? … : …`. To treść dokumentu, nie etykieta ekranu.
  'reportContentGenerator.ts': 'treść generowanego raportu, język wybierany jawnie',
  // DANE pokazowe listy Materiałów (tytuły raportów i szablonów widoczne na
  // demo). To rekordy, nie interfejs — język danych to osobna kategoria.
  'mockData.ts': 'zestaw danych pokazowych listy, nie napisy interfejsu',
};

function* pliki(dir: string): Generator<string> {
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

const ZRODLA = KATALOGI.flatMap((k) => [...pliki(path.join(KORZEN, k))])
  .filter((p) => !(path.basename(p) in WYLACZONE))
  .map((p) => ({ nazwa: path.relative(KORZEN, p), tekst: fs.readFileSync(p, 'utf8') }));

describe('moduł Materiały — konto angielskie nie widzi polskiego', () => {
  it('ma co skanować (bezpiecznik przed pustym zbiorem)', () => {
    expect(ZRODLA.length).toBeGreaterThan(100);
  });

  it('nie ma polskiego defaultValue w t()', () => {
    const wzorzec = /\bt\(\s*(["'`])[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]]+)+\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,300})\2/g;
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
      /\b(title|placeholder|aria-label|ariaLabel|alt|label|emptyText|subtitle|helperText|tooltip|description|panelAriaLabel)\s*=\s*"([^"]+)"/g;
    const etykietyObiektu = /\b(label|title|reason|description|powodTylkoOdczyt)\s*:\s*'([^']+)'/g;
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
    // formatListNumber / localeListy).
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

  // ---------------------------------------------------------------------
  // ROZSZERZENIE J-DOG-C (2026-09-09): `POLSKIE_SLOWA` powyżej to ręcznie
  // dopisana lista — nie łapie każdego polskiego bez ogonków spoza niej
  // (zmierzone przez J-DOG-C: „Kolor", „Priorytet", „Rozmiar czcionki",
  // „Kursywa" i kilkadziesiąt innych w tym module przechodziły niewidoczne).
  // Dokłada szerszy detektor `tests/unit/i18n/polskiBezOgonkowWspolny.ts`
  // (słownik automatyczny z `public/locales/pl` + ręczne rdzenie).
  it('J-DOG-C: żaden defaultValue ani napis JSX nie jest polski bez ogonków', () => {
    const trafienia = [...znajdzPolskieDefaultValue(ZRODLA), ...znajdzPolskiJsx(ZRODLA)];
    expect(trafienia).toEqual([]);
  });
});
