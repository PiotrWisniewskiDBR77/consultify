/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU 07 REALIZACJA (paczka J7b, DEC-453).
 *
 * DLACZEGO ISTNIEJE (pomiar 08.09, `evidence/jezyk-j7/przed/`): konto
 * angielskie widziało w tym module 653 polskie słowa interfejsu — polskie
 * `defaultValue` w `t()`, polskie słowniki statusów module-scope i polskie
 * napisy wprost w JSX. `src/i18n.ts` ustawia `fallbackLng: { en: ['en'] }`,
 * więc EN NIGDY nie spada na plik PL: spada na `defaultValue` z KODU. Polski
 * default jest w tym module równoznaczny z polskim ekranem dla Anglika.
 *
 * TEN TEST CZYTA ŹRÓDŁO, nie renderuje — dlatego łapie także miejsca, których
 * żaden zrzut nie odwiedził (warsztaty za flagą, panele rollout, artefakt
 * raportu). Skaner `scripts/i18n/pomiar-jezyka.mjs` liczy TSX; ten test
 * obejmuje również `.ts` (tam siedziały słowniki `RAID_TYPE_LABELS_PL`
 * i `sectionTitle(0, 'Postęp i harmonogram')`).
 *
 * ZASIĘG: `src/components/Execution/**`. Poza nim leżą pliki, które skaner
 * `pomiar-jezyka.mjs` też liczy do modułu 07 (PMO/**, Team/**, TaskDetailModal,
 * TaskDropdown, views/ProjectIntelligenceView) — one należą do innych modułów
 * zamrożenia i nie da się ich objąć jednym bezpiecznikiem bez ich decyzji.
 *
 * MUTACJA (dowód, że test nie jest dekoracją): zamiana dowolnego
 * `t('klucz', 'English')` w `src/components/Execution/**` na
 * `t('klucz', 'Polski tekst')` daje RED w pierwszym `it`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { znajdzPolskiJsx, znajdzPolskieDefaultValue } from '../../../../tests/unit/i18n/polskiBezOgonkowWspolny';

const KATALOG = path.resolve(__dirname, '..');
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Same diakrytyki NIE WYSTARCZAJĄ — „Kamienie milowe" i „Brak kanonicznych
 * kamieni milowych" to zdania w pełni polskie BEZ ani jednego ogonka
 * (sprawdzone mutacją 08.09: przy detektorze wyłącznie diakrytycznym obie
 * przechodziły na zielono). Dlatego test dokłada słownik polskich słów
 * funkcyjnych — TEN SAM, na którym stoi `scripts/i18n/pomiar-jezyka.mjs`,
 * żeby bezpiecznik i przyrząd pomiarowy nie rozjechały się definicją
 * „polskiego".
 */
const WYJATKI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../scripts/i18n/pomiar-jezyka.wyjatki.json'),
    'utf8'
  )
) as { polskieSilne: string[] };
const POLSKIE_SLOWA = new Set([
  ...WYJATKI.polskieSilne,
  'kamienie',
  'milowe',
  'kamieni',
  'milowych',
  'zdefiniowane',
]);

function czyPolski(tekst: string): boolean {
  if (DIAKRYTYKI.test(tekst)) return true;
  return tekst
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .some((slowo) => POLSKIE_SLOWA.has(slowo.toLowerCase()));
}

/**
 * Pliki świadomie WYŁĄCZONE, każdy z powodem. To nie jest „lista, na którą
 * dopisuje się kolejny plik, gdy test zaświeci" — dopisanie czegokolwiek tutaj
 * wymaga takiego samego uzasadnienia jak wpisy poniżej.
 */
const WYLACZONE: Record<string, string> = {
  // DANE pokazowe (tytuły zadań, decyzji, nazwiska) — treść rekordów, nie
  // interfejsu. Język danych to osobna kategoria (K6) i osobna paczka.
  'executionLocalReviewData.ts': 'zestaw danych pokazowych, nie napisy interfejsu',
  // Znaczniki zapisywane do bazy (`ŹRÓDŁO-RAID:`, `PRZEKSZTAŁCONE-W-PROBLEM:`).
  // Zmiana napisu zerwałaby odczyt istniejących rekordów — to migracja danych,
  // nie tłumaczenie.
  'raidGovernance.ts': 'znaczniki utrwalone w bazie, zmiana = migracja danych',
  // Tytuł decyzji tworzonej z sygnału — TREŚĆ REKORDU zapisywana do
  // `decisions.title`, nie etykieta ekranu.
  'delaySignals.ts': 'tytuł zapisywanego rekordu decyzji, nie etykieta ekranu',
  // Para słowników PL/EN wybierana przez `isPolish` — poprawny wzorzec
  // dwujęzyczny, nie polski default.
  'executionRealData.ts': 'para słowników PL/EN wybierana przez isPolish',
  'ExecutionManagementTable.tsx': 'para napisów PL/EN wybierana przez isPolish',
  'ExecutionSummaryOneLook.tsx': 'helper tr(pl, en) — obie wersje podane wprost',
};

function pliki(dir: string): string[] {
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

const ZRODLA = pliki(KATALOG).map((p) => ({
  nazwa: path.relative(KATALOG, p),
  tekst: bezKomentarzy(fs.readFileSync(p, 'utf8')),
}));

describe('J7b — moduł Realizacja mówi po angielsku w kodzie', () => {
  it('nie ma polskiego defaultValue w t()', () => {
    const wzorzec =
      /\bt\(\s*(?:'[^']+'|"[^"]+"|`[^`]+`)\s*,\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
    const trafienia: string[] = [];
    for (const { nazwa, tekst } of ZRODLA) {
      for (const m of tekst.matchAll(wzorzec)) {
        if (czyPolski(m[2])) trafienia.push(`${nazwa}: „${m[2]}"`);
      }
    }
    expect(trafienia).toEqual([]);
  });

  it('nie ma polskich napisów poza t() w treści JSX i etykietach', () => {
    // Tekst między znacznikami JSX oraz atrybuty widoczne dla użytkownika.
    // Tylko TREŚĆ między znacznikami: bez apostrofów i średników, bo
    // `(filtrTerminu === 'wszystkie' || …)` to kod, nie napis na ekranie.
    const tekstJsx = />\s*([^<>{}'"`;=\n][^<>{}'"`;=]*)</g;
    const atrybuty =
      /\b(title|placeholder|aria-label|label|openLabel|emptyText|subtitle|relationsEmptyLabel)\s*=\s*"([^"]+)"/g;
    const etykietyObiektu = /\b(label|title|note|reason|description|archiveNote)\s*:\s*'([^']+)'/g;
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
    // formatListNumber / localeListy). Zakaz `toLocaleDateString()` bez
    // argumentu i `'pl-PL'`/`'en-US'`/`'en-GB'` wpisanych w wywołanie.
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
  // ROZSZERZENIE J-DOG-C (2026-09-09): `POLSKIE_SLOWA` powyżej stoi na
  // `polskieSilne` z `pomiar-jezyka.wyjatki.json` + garstce ręcznych dopisków
  // — nie łapie polskiego bez ogonków spoza tej listy („Kolor", „Priorytet").
  // Dokłada szerszy detektor `tests/unit/i18n/polskiBezOgonkowWspolny.ts`
  // (słownik automatyczny z `public/locales/pl` + ręczne rdzenie), żeby
  // regresja tej KONKRETNEJ klasy była też złapana w Realizacji.
  it('J-DOG-C: żaden defaultValue ani napis JSX nie jest polski bez ogonków', () => {
    const trafienia = [...znajdzPolskieDefaultValue(ZRODLA), ...znajdzPolskiJsx(ZRODLA)];
    expect(trafienia).toEqual([]);
  });
});
