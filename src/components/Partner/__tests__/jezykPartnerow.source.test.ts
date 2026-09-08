/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU PARTNERZY / PARTNER PORTAL (paczka J16, DEC-453).
 *
 * DLACZEGO ISTNIEJE (pomiar 09.09, `evidence/jezyk-j16/`): moduł miał 131
 * polskich `defaultValue` w `t()`, 167 kluczy obecnych wyłącznie w `pl`,
 * 24 polskie i 21 angielskich napisów wprost w JSX oraz 34 daty/liczby
 * formatowane bez locale z konta. `src/i18n.ts` ustawia
 * `fallbackLng: { en: ['en'] }`, więc konto angielskie NIGDY nie spada na plik
 * PL — spada na `defaultValue` z KODU. Polski default jest tu równoznaczny
 * z polskim ekranem dla Anglika, co widać na zrzucie PRZED
 * `evidence/jezyk-j16/przed/11-home-en.png` („Twój program partnerski",
 * „ZAROBIONE ŁĄCZNIE", „Przejdź do prowizji" na koncie EN).
 *
 * TEN TEST CZYTA ŹRÓDŁO, nie renderuje — dlatego obejmuje też ekrany, których
 * żaden zrzut nie odwiedził: bramę `TrialTransitionConfirmation` (modal przed
 * utworzeniem organizacji), tabelę wysyłek subskrybenta i panele kanonu
 * cyklu życia partnera. Skaner `scripts/i18n/pomiar-jezyka.mjs` liczy TSX;
 * ten test obejmuje również `.ts` (tam siedzą słowniki i helpery).
 *
 * ZASIĘG: katalogi, które przyrząd pomiarowy przypisuje do modułu 16
 * (`scripts/i18n/pomiar-jezyka.mjs:99`). Zamrożenie MVP `16_PARTNER` wymienia
 * węższy zbiór (28 plików `Partner/**` i `views/partner/**`) — reszta
 * (Trial, Subscriber, TrialEntryView) należy do modułu wg mapy przyrządu,
 * nie jest współdzielona z żadnym innym modułem i to w niej siedziało
 * 23 z 24 polskich napisów na sztywno.
 *
 * MUTACJA (dowód, że test nie jest dekoracją): zamiana dowolnego
 * `t('klucz', 'English')` w zasięgu na polski tekst daje RED w drugim `it`;
 * przywrócenie formatowania daty bez argumentu daje RED w ostatnim.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KORZEN = path.resolve(__dirname, '../../..'); // src/
const KATALOGI = [
  'components/Partner',
  'components/Subscriber',
  'components/Trial',
  'views/partner',
  'views/subscriber',
];
const POJEDYNCZE = ['views/BecomePartnerView.tsx', 'views/PartnerApplicationView.tsx', 'views/TrialEntryView.tsx'];

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * Same diakrytyki NIE WYSTARCZAJĄ — „Status partnera", „Brak danych",
 * „Wypłacone" bez ogonków przeszłyby bokiem. Rdzeń słownika jest TEN SAM, na
 * którym stoi `scripts/i18n/pomiar-jezyka.mjs`, żeby bezpiecznik i przyrząd
 * pomiarowy nie rozjechały się definicją „polskiego"; dołożone są słowa
 * widziane na zrzutach PRZED tego modułu.
 */
const WYJATKI = JSON.parse(
  fs.readFileSync(path.resolve(KORZEN, '../scripts/i18n/pomiar-jezyka.wyjatki.json'), 'utf8')
) as { polskieSilne: string[] };
const POLSKIE_SLOWA = new Set([
  ...WYJATKI.polskieSilne.map((s) => s.toLowerCase()),
  'partnerski',
  'partnerskiego',
  'partnerska',
  'prowizja',
  'prowizje',
  'prowizji',
  'wyplata',
  'wyplaty',
  'polecenie',
  'polecenia',
  'polecen',
  'klient',
  'klienci',
  'klientow',
  'organizacja',
  'organizacje',
  'organizacji',
  'zarobione',
  'wstrzymane',
  'certyfikat',
  'certyfikaty',
  'akademia',
  'egzamin',
  'egzaminy',
  'nieznany',
  'nieznana',
  'brak',
  'dostep',
  'kody',
]);
// ŚWIADOMIE POZA SŁOWNIKIEM: „link", „kod", „status", „start" — to te same
// słowa w obu językach. Pierwsza wersja listy miała „link" i wywaliła
// 13 POPRAWNYCH angielskich napisów z `ReferralToolsSection` („Copy link",
// „Campaign link created!"). Bezpiecznik, który krzyczy na poprawny angielski,
// uczy ignorowania bezpiecznika.

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
  // Treść programu partnerskiego w dwóch wariantach językowych wybieranych
  // jawnie — to TREŚĆ oferty, nie etykiety ekranu, i ma własny mechanizm.
  'partnerProgramLocale.ts': 'dwujęzyczna treść programu, język wybierany jawnie',
  'partnerProgramContent.ts': 'treść programu partnerskiego, nie napisy interfejsu',
  // Cennik: nazwy pakietów i pozycji handlowych (dane), nie interfejs.
  'partnerPricingData.ts': 'dane cennika, nie napisy interfejsu',
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

const ZRODLA = [
  ...KATALOGI.flatMap((k) => [...pliki(path.join(KORZEN, k))]),
  ...POJEDYNCZE.map((p) => path.join(KORZEN, p)),
]
  .filter((p) => !(path.basename(p) in WYLACZONE))
  .map((p) => ({ nazwa: path.relative(KORZEN, p), tekst: fs.readFileSync(p, 'utf8') }));

describe('moduł Partnerzy — konto angielskie nie widzi polskiego', () => {
  it('ma co skanować (bezpiecznik przed pustym zbiorem)', () => {
    expect(ZRODLA.length).toBeGreaterThan(20);
  });

  it('nie ma polskiego defaultValue w t()', () => {
    const wzorzec =
      /\bt\(\s*(["'`])[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]]+)+\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,400})\2/g;
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
      /\b(title|placeholder|aria-label|ariaLabel|alt|label|subtitle|eyebrow|description|emptyText|helperText|tooltip)\s*=\s*"([^"]+)"/g;
    const etykietyObiektu = /\b(label|title|description|subtitle|actionLabel)\s*:\s*'([^']+)'/g;
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
    // formatListNumber / formatListTime / localeListy).
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
