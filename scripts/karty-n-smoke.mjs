#!/usr/bin/env node
/**
 * KARTY-N-SMOKE — bramka strukturalna rejestru kart N (SPEC-N §5.3, §5.4).
 *
 * Problem, ktory rozwiazuje (2026-07-21):
 * warunkiem wejscia do migracji (plan §2, wyjscie fali F) jest to, ze KAZDA z 7 kart N
 * ma zywy ekran w harnessie `dev-render` — bo bez zrzutu PRZED nie da sie uczciwie
 * odebrac zrzutu PO. Dzis nic tego nie pilnuje: ekran mozna skasowac, przemianowac albo
 * dopisac plik i zapomniec go zarejestrowac w `dev-render/main.tsx`, a rejestr kart
 * dalej twierdzi, ze ekran istnieje. Rejestr, ktory klamie, jest gorszy niz jego brak.
 *
 * Ten skrypt czyta `src/components/standard/registry.ts` (JEDYNE zrodlo listy kart)
 * i dla kazdego wpisu sprawdza dwie rzeczy:
 *   1. plik ekranu istnieje w `dev-render/screens/`,
 *   2. ekran jest zarejestrowany w `dev-render/main.tsx` (import + klucz w SCREENS).
 * Dodatkowo ostrzega (bez bledu), gdy nie istnieje plik komponentu karty.
 *
 * ┌─ CZEGO TEN SMOKE **NIE** SPRAWDZA — celowo ────────────────────────────────┐
 * │ To jest bramka STRUKTURALNA, nie runtime'owa. NIE uruchamia przegladarki,   │
 * │ wiec NIE wykryje:                                                           │
 * │   · error-boundary po otwarciu ekranu (lekcja fali N: TDZ w `useCallback`   │
 * │     przeszlo esbuild i tsc, wywalilo sie dopiero w przegladarce),           │
 * │   · brakujacych kluczy i18n renderowanych jako goly klucz,                  │
 * │   · zlych tokenow kolorystycznych / crimsona w powloce,                     │
 * │   · siedmiu asercji zgodnosci ze SPEC-N §5.3 (jeden primary, panel obecny,  │
 * │     kolejnosc sekcji, brak duplikatow akcji, zarezerwowane id, limit klasy, │
 * │     `aiContract` na kazdej sekcji).                                         │
 * │ Otwarcie kazdego z 7 ekranow oczami i sprawdzenie braku error-boundary robi │
 * │ NADZORCA. „smoke zielony" NIE znaczy „karta dziala".                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Dlaczego regex na .ts, a nie import: skrypt `.mjs` nie zaimportuje `.ts` bez
 * transpilacji, a druga kopia listy kart w skrypcie oznaczalaby dwa zrodla prawdy —
 * dokladnie to, czemu rejestr ma zapobiegac. Parsujemy wiec plik rejestru; gdy parser
 * nie znajdzie ani jednego wpisu, skrypt konczy sie bledem zamiast udawac sukces.
 *
 *   node scripts/karty-n-smoke.mjs          # tabela + wynik
 *   node scripts/karty-n-smoke.mjs --cicho  # tylko bledy (do hooka/CI)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CICHO = process.argv.includes('--cicho');

const PLIK_REJESTRU = 'src/components/standard/registry.ts';
const KATALOG_EKRANOW = 'dev-render/screens';
const PLIK_MAIN = 'dev-render/main.tsx';

// ── odczyt rejestru ───────────────────────────────────────────────────────────

/**
 * Wyciaga wpisy z `REJESTR_KART_N`. Szukamy blokow `  klucz: { ... },` wewnatrz
 * literalu obiektu — kazdy wpis ma pola `nazwa`, `komponent`, `klasa`,
 * `ekranHarnessu`, `statusMigracji`.
 */
function czytajRejestr() {
  const sciezka = join(KORZEN, PLIK_REJESTRU);
  if (!existsSync(sciezka)) {
    console.error(`\n❌ Brak rejestru: ${PLIK_REJESTRU}`);
    console.error('   Bez rejestru nie ma czego sprawdzac — to jest zrodlo listy kart N.\n');
    process.exit(1);
  }
  const tekst = readFileSync(sciezka, 'utf8');

  const poczatek = tekst.indexOf('REJESTR_KART_N');
  const cialo = poczatek === -1 ? tekst : tekst.slice(poczatek);

  const wpisy = [];
  const pole = (blok, nazwa) => {
    const m = blok.match(new RegExp(`\\b${nazwa}:\\s*'([^']*)'`));
    return m ? m[1] : null;
  };

  for (const m of cialo.matchAll(/^ {2}([A-Za-z][\w]*):\s*\{\n([\s\S]*?)\n {2}\},/gm)) {
    const [, klucz, blok] = m;
    const wpis = {
      klucz,
      nazwa: pole(blok, 'nazwa'),
      komponent: pole(blok, 'komponent'),
      klasa: pole(blok, 'klasa'),
      ekranHarnessu: pole(blok, 'ekranHarnessu'),
      statusMigracji: pole(blok, 'statusMigracji'),
    };
    // blok bez `ekranHarnessu` to nie jest wpis karty (np. przypadkowy obiekt) — pomijamy
    if (wpis.ekranHarnessu) wpisy.push(wpis);
  }

  if (wpisy.length === 0) {
    console.error(`\n❌ Parser nie znalazl ani jednego wpisu w ${PLIK_REJESTRU}.`);
    console.error(
      '   Prawdopodobnie zmienil sie ksztalt literalu `REJESTR_KART_N`.\n' +
      '   Skrypt konczy sie bledem zamiast raportowac falszywy sukces.\n'
    );
    process.exit(1);
  }
  return wpisy;
}

// ── sprawdzenia ───────────────────────────────────────────────────────────────

function plikEkranuIstnieje(ekran) {
  return ['tsx', 'ts', 'jsx', 'js'].some((ext) =>
    existsSync(join(KORZEN, KATALOG_EKRANOW, `${ekran}.${ext}`))
  );
}

/** Ekran liczy sie za zarejestrowany, gdy main.tsx ma i import pliku, i klucz w SCREENS. */
function czyZarejestrowany(mainTekst, ekran) {
  // BRAMKA, KTORA NIGDY NIE MOGLA PRZEJSC (naprawione 2026-09-06, DEC-422).
  // Detektor szukal WYLACZNIE statycznego `from './screens/<ekran>'`, a
  // `dev-render/main.tsx` laduje KAZDY ekran leniwie:
  //     const KartaToolScreen = React.lazy(() => import('./screens/karta-tool'));
  // Zmierzone na commicie f3655ddb56: `grep -c "from './screens/karta-"` = 0,
  // wiec smoke zglaszal WSZYSTKIE 8 kart jako niezarejestrowane, mimo ze kazda
  // miala i plik, i klucz w SCREENS. Bramka czerwona zawsze nie mierzy niczego.
  // Teraz uznajemy obie formy: statyczny `from '...'` i dynamiczny `import('...')`.
  const sciezka = `\\./screens/${ekran}`;
  const maImport =
    new RegExp(`from\\s+'${sciezka}'`).test(mainTekst) ||
    new RegExp(`import\\(\\s*'${sciezka}'\\s*\\)`).test(mainTekst);
  const maKlucz = new RegExp(`'${ekran}'\\s*:\\s*\\{`).test(mainTekst);
  return { maImport, maKlucz, ok: maImport && maKlucz };
}

// ── bieg ──────────────────────────────────────────────────────────────────────

const wpisy = czytajRejestr();

const sciezkaMain = join(KORZEN, PLIK_MAIN);
if (!existsSync(sciezkaMain)) {
  console.error(`\n❌ Brak harnessu: ${PLIK_MAIN}\n`);
  process.exit(1);
}
const mainTekst = readFileSync(sciezkaMain, 'utf8');

const bledy = [];
const ostrzezenia = [];
const wiersze = [];

for (const w of wpisy) {
  const ekranJest = plikEkranuIstnieje(w.ekranHarnessu);
  const rej = czyZarejestrowany(mainTekst, w.ekranHarnessu);

  if (!ekranJest) {
    bledy.push(
      `${w.nazwa ?? w.klucz}: brak pliku ekranu ${KATALOG_EKRANOW}/${w.ekranHarnessu}.tsx`
    );
  }
  if (!rej.ok) {
    const czego = [!rej.maImport && 'import', !rej.maKlucz && 'klucz w SCREENS']
      .filter(Boolean)
      .join(' + ');
    bledy.push(`${w.nazwa ?? w.klucz}: ekran '${w.ekranHarnessu}' nie jest zarejestrowany w ${PLIK_MAIN} (brak: ${czego})`);
  }
  if (w.komponent && !existsSync(join(KORZEN, w.komponent))) {
    ostrzezenia.push(`${w.nazwa ?? w.klucz}: plik komponentu nie istnieje — ${w.komponent}`);
  }

  wiersze.push({
    karta: `${w.nazwa ?? w.klucz} [${w.klasa ?? '?'}]`,
    ekran: w.ekranHarnessu,
    zarejestrowany: ekranJest && rej.ok ? 'tak' : 'NIE',
    status: w.statusMigracji ?? '?',
  });
}

if (!CICHO) {
  const kol = [
    ['karta', 'karta'],
    ['ekran', 'ekran'],
    ['zarejestrowany', 'zarejestrowany'],
    ['status', 'status migracji'],
  ];
  const szer = kol.map(([k, naglowek]) =>
    Math.max(naglowek.length, ...wiersze.map((r) => String(r[k]).length))
  );
  const linia = (komorki) =>
    komorki.map((c, i) => String(c).padEnd(szer[i])).join('  |  ');

  console.log(`\nRejestr kart N: ${PLIK_REJESTRU} — wpisow: ${wpisy.length}\n`);
  console.log(linia(kol.map(([, n]) => n)));
  console.log(szer.map((s) => '-'.repeat(s)).join('--+--'));
  for (const r of wiersze) console.log(linia(kol.map(([k]) => r[k])));
}

if (ostrzezenia.length && !CICHO) {
  console.warn(`\n⚠️  Ostrzezenia (nie zatrzymuja bramki):`);
  for (const o of ostrzezenia) console.warn(`   · ${o}`);
}

if (bledy.length) {
  console.error(`\n❌ KARTY N — brakujace ekrany harnessu (${bledy.length}):\n`);
  for (const b of bledy) console.error(`   · ${b}`);
  console.error(
    '\nNapraw jedna z dwoch drog: (a) dodaj ekran do dev-render (plik + import + klucz\n' +
    'w SCREENS), (b) usun wpis z rejestru. Karta bez ekranu harnessu nie ma zrzutu PRZED,\n' +
    'wiec nie da sie uczciwie odebrac zrzutu PO (plan wdrozenia, warunek wejscia do W4).\n'
  );
  process.exit(1);
}

if (!CICHO) {
  console.log(`\n✅ ${wpisy.length}/${wpisy.length} kart ma ekran harnessu i jest zarejestrowanych.`);
  console.log(
    '   UWAGA: to bramka strukturalna. Brak error-boundary po otwarciu ekranu\n' +
    '   sprawdza nadzorca oczami — patrz naglowek tego pliku.\n'
  );
}
