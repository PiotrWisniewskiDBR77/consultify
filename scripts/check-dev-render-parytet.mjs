#!/usr/bin/env node
/**
 * PARYTET HARNESSU Z PRODUKCJĄ — bramka mechaniczna dla `dev-render/screens/*.tsx`
 *
 * POWÓD ISTNIENIA (2026-09-01, audyt `docs/program/grafika/AUDYT_PRZYRZADU_20260901.md`):
 * właściciel ocenia PRODUKT po zrzutach z harnessu. Jeśli ekran harnessu składa
 * własną kompozycję — dokłada pasek, którego produkcja nie stawia, montuje komponent,
 * do którego nie prowadzi żadna trasa, albo ściska treść w `max-w-*`, którego u
 * wołacza nie ma — to właściciel ocenia obraz, którego w aplikacji NIE MA.
 *
 * Audyt zmierzył skalę: 41 ekranów z udokumentowaną rozbieżnością, z czego 29 jest
 * w odbiorze z oceną A lub B. W jednym przypadku (`agent-plan-canvas`) właściciel dał
 * ocenę A układowi, który w kodzie produkcyjnym jest opisany jako NAPRAWIONY BŁĄD.
 * Defekt 175 (`idea-table`) przeżył dwie naprawy wymierzone dokładnie w ten plik,
 * bo nikt nie liczył tego mechanicznie — po usunięciu `ArtifactRightPanel` została
 * druga wymyślona warstwa (`TopBar`).
 *
 * Ta bramka nie ocenia estetyki. Odpowiada na jedno pytanie: czy to, co ekran
 * pokazuje właścicielowi, ma odpowiednik w kodzie produkcyjnym.
 *
 * ── TRZY REGUŁY ───────────────────────────────────────────────────────────────
 *  R1 (BŁĄD)      Komponent bez wołacza. Ekran musi montować ≥1 komponent
 *                 produkcyjny (inaczej pokazuje przepisany markup, nie produkt),
 *                 a każdy montowany komponent musi być renderowany w co najmniej
 *                 jednym pliku `src/`, który go NIE definiuje (albo być ładowany
 *                 leniwie z pliku tras). Łapie ekrany oceniające kod, do którego
 *                 nic nie prowadzi.
 *  R2 (BŁĄD)      Kompozycja bez precedensu. Każda para komponentów montowanych
 *                 RAZEM przez ekran musi współwystępować w co najmniej jednym pliku
 *                 produkcyjnym. Łapie dokładanie paneli i pasków, których produkcja
 *                 nie stawia obok siebie (to jest defekt 175 i to, co po nim zostało).
 *  R3 (OSTRZEŻENIE) Wymyślona szerokość. `max-w-*` / `w-[Npx]` narzucone przez ekran,
 *                 gdy tej samej klasy nie ma ani u wołacza produkcyjnego, ani w samym
 *                 komponencie. Ostrzeżenie, nie błąd — modale i szyny mają własne
 *                 szerokości i twarda reguła sypałaby fałszywkami (audyt: 18 z 36
 *                 sprawdzonych szerokości było ZGODNYCH).
 *  PODPIS (OSTRZEŻENIE) — dorzucone z audytu: ekran rysuje własny `<h1..h3>` bez
 *                 `data-dev-render-chrome`, więc podpis harnessu ląduje na zrzucie,
 *                 który właściciel ocenia jako produkt. Nie wchodzi do bilansu reguł.
 *
 * ── DLACZEGO TA BRAMKA MA MAŁO FAŁSZYWYCH ALARMÓW ─────────────────────────────
 * Bramka, która krzyczy bez powodu, zostaje wyłączona — a wtedy jest gorsza niż jej
 * brak (tak umarła zero-tolerancyjna wersja `check-list-canon.sh`). Sześć sit —
 * każde wprowadzone po ZMIERZENIU fałszywego alarmu, nie z przeczucia:
 *
 *  (a) EKRANY WARIANTOWE. Ekran czytający z URL parametr rozgałęziający
 *      (`?variant=`, `?state=`, `?scene=`, `?view=`, `?case=`, `?mode=` …) montuje
 *      w jednym przebiegu TYLKO jedną gałąź. Statycznie widać wszystkie naraz, więc
 *      naiwna reguła R2 nazwałaby to „kompozycją bez precedensu". Audyt zmierzył,
 *      że naiwny licznik daje 11 fałszywych trafień na 20. Dla takich ekranów R2
 *      jest POMIJANE (zliczane osobno jako „pominięte: wariantowe").
 *  (b) DOMKNIĘCIE O JEDEN SKOK. Para współwystępuje także wtedy, gdy plik produkcyjny
 *      renderuje A oraz komponent C, którego własny plik renderuje B. Bez tego każda
 *      para „powłoka + treść przez jeden poziom" byłaby fałszywym alarmem.
 *  (c) R2 TYLKO DLA KOMPONENTÓW Z WOŁACZEM. Komponent bez wołacza zgłasza już R1;
 *      wciąganie go do par mnożyłoby ten sam defekt przez N i topiło sygnał.
 *  (d) R3 SZUKA KLASY, NIE ZGADUJE. Szerokość jest „wymyślona" tylko wtedy, gdy
 *      dosłownie tego tokenu nie ma w ŻADNYM wołaczu ANI w definicji montowanego
 *      komponentu. Dzięki temu ekran cytujący kontrakt produkcyjny (np.
 *      `chat-signals-feed` z `max-w-[1040px]` za `ChatSignalsPanel.tsx`) przechodzi.
 *      Tokeny nieograniczające (`max-w-full`, `max-w-none`) są ignorowane.
 *  (e) LAZY TO IMPORT, NIE DEFINICJA. `const X = lazy(() => import(…))` w pliku tras
 *      nie czyni tego pliku definicją X. Bez tego wyjątku R1 zgłaszała 61 ekranów
 *      zamiast 51 i twierdziła, że AssessmentHub, SettingsView czy IdeaMapWorkspace
 *      nie mają wołacza — mimo że stoją w `<Route element>`.
 *  (f) RUSZTOWANIE ≠ KOMPOZYCJA. `<AppProviders>`, `<MemoryRouter>`, konteksty
 *      i granice błędów nie wchodzą do par R2 — owinięcie realnego komponentu
 *      w provider to montaż produktu, nie wymyślona kompozycja. Bez tego sita
 *      R2 zgłaszała 37 ekranów zamiast 9, prawie same fałszywki.
 *  Dodatkowo: pliki testów, storybooków i sam harness NIE liczą się jako wołacze —
 *  test renderujący komponent to nie jest miejsce w produkcie („Wołacz istnieje ≠
 *  renderuje się"). Cena sit (uczciwie): sito (b) gubi `menu-dlugi-domkniecie`
 *  i `mindmap-i18n-smoke`, bo w produkcji te komponenty stoją o jeden poziom od
 *  siebie w tym samym hubie. Bramka nie zastępuje oczu — ma tylko nie kłamać.
 *
 * ── LINIA BAZOWA (ratchet) ────────────────────────────────────────────────────
 * 41 rozbieżności to DŁUG ZASTANY. Bramka, która od pierwszego dnia blokuje
 * wszystko, zostanie obejściem albo wyłączona. Więc jak w `check-list-canon.sh`
 * i `check-artefakt.sh`: stan zastany zapisany w
 * `scripts/check-dev-render-parytet.baseline.txt`, bramka pilnuje, żeby dług
 * NIE RÓSŁ. Każdy wpis ma kolumnę POWÓD — „przyrząd, nie ekran produktu"
 * (`preview-4-zakladki`, `mm-ppm-measure`) przechodzi ŚWIADOMIE, a nie po cichu.
 *
 * Format wpisu (tab-separated, 4 kolumny):
 *     <ekran>\t<reguła>\t<szczegół>\t<powód>
 * Klucz ratchetu = trzy pierwsze kolumny, więc podmiana jednego naruszenia na inne
 * NIE przechodzi (to jest mocniejsze niż licznik per plik z `check-list-canon.sh`;
 * wybrane świadomie, bo tutaj „szczegół" to nazwa komponentu, a nie liczba).
 *
 * Regeneracja po ŚWIADOMYM sprzątnięciu długu: --update (powody z istniejącego
 * pliku są zachowywane). NIGDY żeby uciszyć nową regresję.
 *
 * ── UŻYCIE ────────────────────────────────────────────────────────────────────
 *   node scripts/check-dev-render-parytet.mjs            # bramka (dług = baseline → 0)
 *   node scripts/check-dev-render-parytet.mjs --all      # policz i pokaż CAŁY dług
 *   node scripts/check-dev-render-parytet.mjs --report   # szczegóły per ekran
 *   node scripts/check-dev-render-parytet.mjs --update   # regeneruj linię bazową
 *   node scripts/check-dev-render-parytet.mjs --ekran=idea-table   # jeden ekran
 *
 * Kod wyjścia: 1 gdy jest NOWE naruszenie R1/R2 spoza linii bazowej, inaczej 0.
 * (R3 i PODPIS są ostrzeżeniami — nigdy nie zwracają 1.)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS_DIR = path.join(ROOT, 'dev-render/screens');
const SRC_DIR = path.join(ROOT, 'src');
const BASELINE_FILE = path.join(ROOT, 'scripts/check-dev-render-parytet.baseline.txt');

// ── Flagi ─────────────────────────────────────────────────────────────────────
let trybAll = false;
let trybReport = false;
let trybUpdate = false;
let ekranFilter = null;

for (const arg of process.argv.slice(2)) {
  if (arg === '--all') trybAll = true;
  else if (arg === '--report') { trybReport = true; trybAll = true; }
  else if (arg === '--update') trybUpdate = true;
  else if (arg.startsWith('--ekran=')) { ekranFilter = arg.slice(8); trybAll = true; trybReport = true; }
  else {
    console.error(`check-dev-render-parytet: nieznany argument '${arg}' (dozwolone: --all, --report, --update, --ekran=<id>)`);
    process.exit(2);
  }
}

// ── Narzędzia tekstowe ────────────────────────────────────────────────────────

/**
 * Usuwa komentarze. Powód: audyt zmierzył, że naiwne liczenie `<Komponent>` łapie
 * gałęzie w komentarzach i opisach — a komentarz nie renderuje się na zrzucie.
 *
 * NAPRAWIONE (2026-09-01, drugi audyt): poprzednia wersja usuwała bloki `/* … *​/`
 * pojedynczym regexem `/\/\*[\s\S]*?\*\//g` na CAŁYM tekście pliku, bez pojęcia
 * o stringach. `src/routes/AppRoutes.tsx` ma trasy typu `` `/settings/*` `` —
 * literalne „/*" na końcu wildcardu w template-stringu. Regex czytał to jako
 * START komentarza i (leniwie, ale poprawnie w sensie regexu) zjadał wszystko
 * AŻ DO NASTĘPNEGO „*​/" — które trafiało się dopiero w kolejnym prawdziwym
 * docblocku, ~600 linii dalej, kasując po drodze `<SettingsView …>` i inne
 * prawdziwe wołacze. Efekt: R1 fałszywie zgłaszała „komponent bez wołacza"
 * dla każdego ekranu montującego to, co regex akurat zjadł.
 *
 * Naprawa: jednoprzebiegowy automat stanów zamiast regexu. Śledzi, czy jesteśmy
 * w stringu (`'`, `"`, `` ` ``) — w takim stanie `/*` i `//` NIC nie znaczą,
 * więc string nigdy nie otwiera komentarza. Nadal prymitywne (nie parser JS:
 * nie rozróżnia literału regex od dzielenia, `${…}` w template-stringu jest
 * traktowane jako zwykły tekst stringa), ale te uproszczenia tylko NIE TNĄ
 * czegoś, co komentarzem nie jest — nigdy nie zjadają więcej niż stary regex.
 */
function bezKomentarzy(tekst) {
  let out = '';
  let i = 0;
  const n = tekst.length;
  /** @type {'code'|'line'|'block'|'squote'|'dquote'|'template'} */
  let stan = 'code';

  while (i < n) {
    const c = tekst[i];
    const c2 = i + 1 < n ? tekst[i + 1] : '';

    if (stan === 'code') {
      if (c === '/' && c2 === '/') { stan = 'line'; i += 2; continue; }
      if (c === '/' && c2 === '*') { stan = 'block'; i += 2; continue; }
      if (c === "'") { stan = 'squote'; out += c; i += 1; continue; }
      if (c === '"') { stan = 'dquote'; out += c; i += 1; continue; }
      if (c === '`') { stan = 'template'; out += c; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (stan === 'line') {
      if (c === '\n') { stan = 'code'; out += '\n'; i += 1; continue; }
      i += 1; continue;
    }
    if (stan === 'block') {
      if (c === '*' && c2 === '/') { stan = 'code'; i += 2; out += ' '; continue; }
      out += c === '\n' ? '\n' : ' '; // zachowaj numerację linii, resztę zgaś
      i += 1; continue;
    }
    if (stan === 'squote' || stan === 'dquote') {
      const cudzyslow = stan === 'squote' ? "'" : '"';
      if (c === '\\' && c2) { out += c + c2; i += 2; continue; } // escape — nie kończ stringa
      out += c;
      if (c === cudzyslow) stan = 'code';
      i += 1; continue;
    }
    if (stan === 'template') {
      if (c === '\\' && c2) { out += c + c2; i += 2; continue; }
      out += c;
      if (c === '`') stan = 'code';
      i += 1; continue;
    }
  }
  return out;
}

/** Nazwy renderowane w JSX: `<Foo`, `<Foo.Bar` → Foo. Tylko z wielkiej litery. */
function renderowaneNazwy(tekst) {
  const out = new Set();
  for (const m of tekst.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)) out.add(m[1]);
  return out;
}

/**
 * Fragmenty TEKSTU WIDOCZNEGO na zrzucie (rozszerzenie reguły PODPIS, 2026-09-01,
 * audyt `finance-comments-panel`): tekst harnessu zdradzający przyrząd nie zawsze
 * siedzi w `<h1..h3>` — bywa zwykłym `<span>`/`<div>` (pasek „(symulowane Menu 1 —
 * nie część tego pakietu)"), którego stara reguła PODPIS w ogóle nie widziała.
 *
 * Dwa źródła, oba świadomie wąskie (żeby NIE łapać importów/komentarzy/kodu):
 *  1. tekst JSX pomiędzy `>` a `<`, bez `{`/`}` (wyrażenia JS pomijamy — literał
 *     tekstowy, nie zmienna),
 *  2. wartości propsów, które w praktyce lądują na ekranie jako podpis/etykieta
 *     (`label`, `title`, `caption`, `heading`, `aria-label`, `placeholder`).
 */
function widoczneFragmenty(tekst) {
  const out = [];
  for (const m of tekst.matchAll(/>([^<>{}]+)</g)) {
    const s = m[1].trim();
    // Sito: `>` / `<` bywają też generykiem TS (`React.FC<{ … }>`) albo końcem
    // jednego JSX bloku i początkiem następnego, z kodem/komentarzem PO
    // `bezKomentarzy` (linie `//` znikają, ale puste linie zostają) między nimi
    // — regex nie rozumie gramatyki, więc czasem „mostkuje" dwa fragmenty przez
    // pustą przestrzeń kodu. Zmierzone (2026-09-01): jeden taki most w całym
    // korpusie 240 ekranów (`prawy-pas-jedna-formula`, 309 znaków, złapałby
    // „mock" z komentarza, który NIGDY nie renderuje się na zrzucie). Realne
    // podpisy/etykiety w JSX są krótkie — najdłuższa realna z całego korpusu to
    // 265 znaków (jedna wielolinijkowa etykieta `wave5-internal-crimson`).
    // Pułap 280 wpuszcza ją i odcina most (309 znaków).
    if (s && s.length <= 280) out.push(s);
  }
  for (const m of tekst.matchAll(
    /\b(?:label|title|caption|heading|aria-label|placeholder)\s*=\s*["']([^"']+)["']/g,
  )) {
    const s = m[1].trim();
    if (s) out.push(s);
  }
  return out;
}

/**
 * Wzorce „zdradzają przyrząd" — dobrane PO przejrzeniu realnych trafień w
 * `dev-render/screens/` (nie zgadywane), patrz raport dyżuru 2026-09-01:
 *  - symulowane/symulacja → 7 ekranów finansów, wszystkie ten sam pasek
 *    „(symulowane Menu 1 — nie część tego pakietu)".
 *  - nie część / nie jest częścią → te same 7 + `vault-folder-block-proof`.
 *  - harness / dev-render → 8-9 ekranów (etykiety w stylu „harness dev-render",
 *    „(dev-render marker)", „ten harness izoluje…").
 *  - mock → 1 ekran (`prawy-panel-szyna-ikon`, już w linii bazowej jako PRZED/PO).
 *  - przyrząd → 0 trafień w treści widocznej (słowo żyje tylko w komentarzach —
 *    już usuwanych przez `bezKomentarzy`); zostawione w regule na przyszłość.
 *  - PRZED/PO jako etykieta → kotwiczone na START fragmentu (`^(PRZED|PO)\b`),
 *    bo samo „po" jest zwykłym polskim przyimkiem i bez kotwicy zalałoby wynik
 *    fałszywkami („Kliknij po zapisaniu" itp.) — 6 ekranów, wszystkie diptychy.
 *  - atrapa → 0 trafień w treści widocznej (jak „przyrząd" — zostawione).
 */
const WZORCE_PRZYRZADU = [
  ['symulowane/symulacja', /symulowan|symulacj/i],
  ['nie część / nie jest częścią', /nie\s+(?:jest\s+)?część/i],
  ['atrapa', /atrap/i],
  ['harness', /\bharness\b/i],
  ['dev-render', /dev-render/i],
  ['mock', /\bmock\b/i],
  ['przyrząd', /przyrz[ąa]d/i],
  ['PRZED/PO etykieta', /^(PRZED|PO)\b/],
];

/**
 * Nazwy DEKLAROWANE w pliku — plik definiujący nie liczy się jako własny wołacz.
 *
 * UWAGA (to był pierwszy zmierzony fałszywy alarm tej bramki): `const X = lazy(…)`
 * / `lazyWithRetry(…)` w pliku tras to NIE jest definicja komponentu, tylko IMPORT
 * pod inną nazwą. Bez tego wyjątku `src/routes/AppRoutes.tsx` „definiowałby" połowę
 * modułów aplikacji i R1 ogłaszałaby, że AssessmentHub, SettingsView czy
 * IdeaMapWorkspace nie mają wołacza — mimo że są renderowane w `<Route element>`.
 */
function deklarowaneNazwy(tekst) {
  const out = new Set();
  const wzorce = [
    /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*(?::[^=\n]*)?=\s*([^\n]*)/g,
    /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*[<(]/g,
    /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?class\s+([A-Z][A-Za-z0-9_]*)\b/g,
  ];
  for (const [i, w] of wzorce.entries()) {
    for (const m of tekst.matchAll(w)) {
      if (i === 0 && /^\s*(?:React\.)?lazy\w*\s*\(/.test(m[2] ?? '')) continue;
      out.add(m[1]);
    }
  }
  return out;
}

/**
 * Rusztowanie harnessu, nie kompozycja wizualna (sito fałszywych alarmów dla R2):
 * providery, konteksty, routery i granice błędów niczego nie stawiają obok siebie.
 * Ekran, który owija realny komponent w `<AppProviders>` albo `<MemoryRouter>`,
 * pokazuje produkt — a nie „kompozycję bez precedensu".
 */
function czyRusztowanie(nazwa) {
  return /(?:Providers?|Context|Boundary|Router|Gate|Wrapper|Harness|Mock)$/.test(nazwa)
    || nazwa === 'Suspense'
    || nazwa === 'Fragment';
}

/** Tokeny szerokości narzucone klasą: max-w-* oraz w-[Npx]. */
function tokenySzerokosci(tekst) {
  const out = new Set();
  for (const m of tekst.matchAll(/\bmax-w-(?:\[[^\]\s'"`]+\]|[a-z0-9]+)/g)) {
    // max-w-full / max-w-none nie OGRANICZAJĄ — nie ma czego porównywać.
    if (m[0] === 'max-w-full' || m[0] === 'max-w-none') continue;
    out.add(m[0]);
  }
  for (const m of tekst.matchAll(/\bw-\[\d+px\]/g)) out.add(m[0]);
  return out;
}

// ── Parametry rozgałęziające (sito fałszywych alarmów (a)) ────────────────────
// `theme`, `lang`, `screen` NIE zmieniają tego, co się montuje — nie są wariantem.
const PARAMY_WARIANTUJACE = new Set([
  'variant', 'wariant', 'state', 'stan', 'scene', 'view', 'widok', 'case', 'mode',
  'tryb', 'stage', 'step', 'krok', 'kind', 'sekcja', 'tab', 'zakladka',
  'scenario', 'scenariusz',
]);
// Świadomie POZA listą: `empty`, `pusty`, `dane` — te przełączają DANE, nie to, który
// komponent się montuje. Wpisanie ich tu ukryło `menu-dlugi-domkniecie` (dwa niezależne
// dowody w jednym kadrze), który audyt wskazał wprost jako cel R2.

function czyWariantowy(tekst) {
  for (const m of tekst.matchAll(/\.get\(\s*['"]([A-Za-z_]+)['"]\s*\)/g)) {
    if (PARAMY_WARIANTUJACE.has(m[1])) return m[1];
  }
  return null;
}

// ── Import produkcyjny w pliku harnessu ───────────────────────────────────────
// Trzy wzorce z audytu: `@/…`, `../../src/…` ORAZ `React.lazy(() => import(…))`
// (bez trzeciego 8 ekranów fałszywie wygląda na atrapy).

function czySciezkaProdukcyjna(spec) {
  return spec.startsWith('@/') || /(^|\/)\.\.\/src\//.test(spec) || spec.startsWith('src/');
}

/** `@/components/X/Y` → bezwzględna ścieżka pliku w src (albo null). */
function rozwinSciezke(spec, zPliku) {
  let baza;
  if (spec.startsWith('@/')) baza = path.join(SRC_DIR, spec.slice(2));
  else if (spec.startsWith('src/')) baza = path.join(ROOT, spec);
  else baza = path.resolve(path.dirname(zPliku), spec);
  for (const kand of [
    `${baza}.tsx`, `${baza}.ts`,
    path.join(baza, 'index.tsx'), path.join(baza, 'index.ts'),
  ]) {
    if (fs.existsSync(kand)) return kand;
  }
  return null;
}

/**
 * Zwraca komponenty produkcyjne zaimportowane przez ekran, jako
 * { lokalnaNazwa → { spec, plik } }. Importy `type` pomijamy — typ się nie renderuje.
 */
function importyProdukcyjne(tekst, sciezkaPliku) {
  const out = new Map();

  for (const m of tekst.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const [, klauzula, spec] = m;
    if (!czySciezkaProdukcyjna(spec)) continue;
    if (/^\s*type\b/.test(klauzula)) continue; // `import type { … }`
    const plik = rozwinSciezke(spec, sciezkaPliku);

    const nawiasy = klauzula.match(/\{([\s\S]*)\}/);
    if (nawiasy) {
      for (const surowy of nawiasy[1].split(',')) {
        const s = surowy.trim();
        if (!s || s.startsWith('type ')) continue;
        const alias = s.split(/\s+as\s+/);
        const nazwaLokalna = (alias[1] ?? alias[0]).trim();
        const nazwaZrodlowa = alias[0].trim();
        if (!/^[A-Z]/.test(nazwaLokalna)) continue;
        out.set(nazwaLokalna, { spec, plik, zrodlo: nazwaZrodlowa });
      }
    }
    const domyslny = klauzula.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim();
    if (domyslny && /^[A-Z][A-Za-z0-9_]*$/.test(domyslny)) {
      out.set(domyslny, { spec, plik, zrodlo: domyslny });
    }
  }

  // React.lazy(() => import('@/…')) — trzeci wzorzec z audytu.
  for (const m of tekst.matchAll(
    /(?:const|let)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/g,
  )) {
    const [, nazwa, spec] = m;
    if (!czySciezkaProdukcyjna(spec)) continue;
    out.set(nazwa, { spec, plik: rozwinSciezke(spec, sciezkaPliku), zrodlo: nazwa, lazy: true });
  }

  return out;
}

// ── Indeks produkcji: „co renderuje co" ───────────────────────────────────────

function zbierzPliki(dir, akc = []) {
  for (const wpis of fs.readdirSync(dir, { withFileTypes: true })) {
    const pelna = path.join(dir, wpis.name);
    if (wpis.isDirectory()) {
      if (wpis.name === 'node_modules' || wpis.name === '__snapshots__') continue;
      zbierzPliki(pelna, akc);
    } else if (wpis.name.endsWith('.tsx') || wpis.name.endsWith('.ts')) {
      akc.push(pelna);
    }
  }
  return akc;
}

/** Test / story / mock nie jest miejscem w produkcie („Wołacz istnieje ≠ renderuje się"). */
function czyPlikProdukcyjny(p) {
  return !/(__tests__|__mocks__|\.test\.|\.spec\.|\.stories\.)/.test(p);
}

console.error('… buduję indeks produkcji z src/ (co renderuje co)');

const plikiSrc = zbierzPliki(SRC_DIR).filter(czyPlikProdukcyjny);

/** plik → { renderowane:Set, deklarowane:Set, tekst } */
const indeks = new Map();
/** nazwa → Set(pliki, które ją renderują i NIE definiują) = realni wołacze */
const wolacze = new Map();
/** nazwa → Set(pliki, które ją definiują) */
const definicje = new Map();

for (const p of plikiSrc) {
  const surowy = fs.readFileSync(p, 'utf8');
  const tekst = bezKomentarzy(surowy);
  const rend = renderowaneNazwy(tekst);
  const dekl = deklarowaneNazwy(tekst);
  indeks.set(p, { rend, dekl, tekst });
  for (const n of dekl) {
    if (!definicje.has(n)) definicje.set(n, new Set());
    definicje.get(n).add(p);
  }
}

for (const [p, { rend, dekl }] of indeks) {
  for (const n of rend) {
    if (dekl.has(n)) continue; // sam siebie nie woła
    if (!wolacze.has(n)) wolacze.set(n, new Set());
    wolacze.get(n).add(p);
  }
}

// Lazy-import z pliku tras też jest wołaczem (komponent nie ma `<X` u wołacza).
for (const [p, { tekst }] of indeks) {
  for (const m of tekst.matchAll(
    /(?:const|let)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/g,
  )) {
    const cel = rozwinSciezke(m[2], p);
    if (!cel) continue;
    // Nazwa lokalna aliasu bywa inna niż eksport — bierzemy nazwy deklarowane w celu.
    const celDekl = indeks.get(cel)?.dekl ?? new Set();
    for (const n of celDekl) {
      if (!indeks.get(p).rend.has(m[1])) continue;
      if (!wolacze.has(n)) wolacze.set(n, new Set());
      wolacze.get(n).add(p);
    }
  }
}

/**
 * DOMKNIĘCIE O JEDEN SKOK (sito (b)): zbiór komponentów widocznych „z" danego pliku —
 * to, co renderuje sam, plus to, co renderują komponenty, które renderuje.
 * Bez tego para „powłoka + treść przez jeden poziom" byłaby fałszywym alarmem.
 */
const domkniecieCache = new Map();
function domkniecie(plik) {
  if (domkniecieCache.has(plik)) return domkniecieCache.get(plik);
  const wpis = indeks.get(plik);
  if (!wpis) return new Set();
  const out = new Set(wpis.rend);
  for (const n of wpis.rend) {
    for (const d of definicje.get(n) ?? []) {
      for (const m of indeks.get(d)?.rend ?? []) out.add(m);
    }
  }
  domkniecieCache.set(plik, out);
  return out;
}

/**
 * TABLICA TRAS NIE JEST KOMPOZYCJĄ (sito fałszywych alarmów, druga strona medalu).
 * `src/routes/AppRoutes.tsx` renderuje kilkaset komponentów — ale każdy pod INNĄ
 * ścieżką, więc dwa z nich nigdy nie stoją obok siebie na ekranie. Gdyby liczyć ją
 * jako współwystąpienie, R2 przepuszczałaby dowolne zestawienie dwóch modułów
 * (audyt wskazywał `menu-dlugi-domkniecie` — `AgentHubShell` + `VaultDocumentsView`
 * — dokładnie z tego powodu).
 */
const czyTablicaTras = (plik) => {
  const t = indeks.get(plik)?.tekst ?? '';
  return /<Routes[\s>]/.test(t) || (t.match(/<Route[\s>]/g) ?? []).length >= 5;
};

let paryCache = null;
function czyWspolwystepuja(a, b) {
  if (!paryCache) paryCache = new Map();
  const klucz = a < b ? `${a} ${b}` : `${b} ${a}`;
  if (paryCache.has(klucz)) return paryCache.get(klucz);
  let wynik = false;
  for (const zbior of [wolacze.get(a) ?? new Set(), wolacze.get(b) ?? new Set()]) {
    for (const plik of zbior) {
      if (czyTablicaTras(plik)) continue;
      const dom = domkniecie(plik);
      if (dom.has(a) && dom.has(b)) { wynik = true; break; }
    }
    if (wynik) break;
  }
  paryCache.set(klucz, wynik);
  return wynik;
}

// ── Analiza ekranów harnessu ──────────────────────────────────────────────────

console.error('… analizuję ekrany harnessu');

const naruszenia = [];   // { ekran, regula, szczegol, opis }
const pominieteWariant = [];
const statEkranow = { R1: new Set(), R2: new Set(), R3: new Set(), PODPIS: new Set() };

const plikiEkranow = fs
  .readdirSync(SCREENS_DIR)
  .filter((f) => f.endsWith('.tsx'))
  .sort();

for (const nazwaPliku of plikiEkranow) {
  const ekran = nazwaPliku.replace(/\.tsx$/, '');
  if (ekranFilter && ekran !== ekranFilter) continue;

  const sciezka = path.join(SCREENS_DIR, nazwaPliku);
  const surowy = fs.readFileSync(sciezka, 'utf8');
  const tekst = bezKomentarzy(surowy);

  const importy = importyProdukcyjne(tekst, sciezka);
  const rend = renderowaneNazwy(tekst);

  // Montowane = zaimportowane Z PRODUKCJI i faktycznie postawione w JSX.
  const montowane = [];
  for (const [lokalna, info] of importy) {
    if (!rend.has(lokalna)) continue;
    montowane.push({ lokalna, nazwa: info.zrodlo, plik: info.plik });
  }

  // ── R1 — komponent bez wołacza ──────────────────────────────────────────────
  // Pierwsza połowa reguły: ekran, który nie montuje ANI JEDNEGO komponentu
  // produkcyjnego, nie pokazuje produktu — pokazuje przepisany markup. To jest
  // klasa defektu `calendar-sync-settings` (kopia bez i18n: 0 wywołań t() wobec 22
  // w oryginale), `chat-split-teresa-right` i trzech ekranów `canvas-*`.
  if (montowane.length === 0) {
    naruszenia.push({
      ekran, regula: 'R1', szczegol: '(brak montażu)',
      opis: 'nie montuje ŻADNEGO komponentu produkcyjnego — pokazuje własny markup, nie produkt',
    });
    statEkranow.R1.add(ekran);
  }

  const zWolaczem = [];
  for (const k of montowane) {
    const w = wolacze.get(k.nazwa);
    if (!w || w.size === 0) {
      naruszenia.push({
        ekran, regula: 'R1', szczegol: k.nazwa,
        opis: `montuje <${k.nazwa}>, którego żaden plik src/ nie renderuje`,
      });
      statEkranow.R1.add(ekran);
    } else {
      zWolaczem.push(k);
    }
  }

  // ── R2 — kompozycja bez precedensu ──────────────────────────────────────────
  const wariant = czyWariantowy(tekst);
  if (wariant) {
    if (zWolaczem.length > 1) pominieteWariant.push({ ekran, param: wariant });
  } else {
    const nazwy = [...new Set(zWolaczem.map((k) => k.nazwa))].filter((n) => !czyRusztowanie(n)).sort();
    for (let i = 0; i < nazwy.length; i += 1) {
      for (let j = i + 1; j < nazwy.length; j += 1) {
        if (czyWspolwystepuja(nazwy[i], nazwy[j])) continue;
        naruszenia.push({
          ekran, regula: 'R2', szczegol: `${nazwy[i]}+${nazwy[j]}`,
          opis: `stawia obok siebie <${nazwy[i]}> i <${nazwy[j]}>; produkcja nigdy ich razem nie renderuje`,
        });
        statEkranow.R2.add(ekran);
      }
    }
  }

  // ── R3 — wymyślona szerokość (ostrzeżenie) ──────────────────────────────────
  const tokenyEkranu = tokenySzerokosci(tekst);
  if (tokenyEkranu.size > 0 && montowane.length > 0) {
    // Zbiór tekstów, w których szerokość byłaby UZASADNIONA: wołacze + definicje
    // montowanych komponentów. Token obecny tam = ekran cytuje kontrakt, nie zmyśla.
    const uzasadnienia = [];
    for (const k of montowane) {
      for (const w of wolacze.get(k.nazwa) ?? []) uzasadnienia.push(indeks.get(w)?.tekst ?? '');
      for (const d of definicje.get(k.nazwa) ?? []) uzasadnienia.push(indeks.get(d)?.tekst ?? '');
      if (k.plik && indeks.has(k.plik)) uzasadnienia.push(indeks.get(k.plik).tekst);
    }
    for (const token of [...tokenyEkranu].sort()) {
      if (uzasadnienia.some((t) => t.includes(token))) continue;
      naruszenia.push({
        ekran, regula: 'R3', szczegol: token,
        opis: `narzuca ${token}, którego nie ma ani u wołacza, ani w komponencie`,
      });
      statEkranow.R3.add(ekran);
    }
  }

  // ── PODPIS — nagłówek harnessu bez data-dev-render-chrome (ostrzeżenie) ──────
  // `grafika-zrzuty.mjs` ukrywa przed zrzutem tylko [data-dev-render-chrome].
  // Nieoznaczony <h1..h3> ląduje na zrzucie, który właściciel ocenia jako produkt.
  //
  // Sito fałszywych alarmów (ten sam styl co reszta pliku): jeśli ekran W OGÓLE
  // używa `data-dev-render-chrome` gdziekolwiek, zakładamy że autor już oznaczył
  // swoje paski/etykiety — bez tego sita KAŻDY ekran, który poprawnie chowa jeden
  // podpis, ale ma DRUGI (osobny) nagłówek gdzie indziej w pliku, dostałby fałszywe
  // trafienie. Cena (uczciwie): to jest per-PLIK, nie per-element — mniej precyzyjne
  // niż prawdziwy parser JSX, ale ten sam kompromis co reszta tej bramki (patrz sita
  // R2 wyżej) i tania metoda, która nie wymaga parsować JSX.
  const chroniony = tekst.includes('data-dev-render-chrome');

  const maNaglowek = /<h[123][\s>]/.test(tekst);
  if (maNaglowek && !chroniony) {
    naruszenia.push({
      ekran, regula: 'PODPIS', szczegol: 'naglowek',
      opis: 'rysuje własny <h1..h3> bez data-dev-render-chrome — podpis trafia na zrzut',
    });
    statEkranow.PODPIS.add(ekran);
  }

  // ── PODPIS — tekst zdradzający przyrząd poza <h1..h3> (ostrzeżenie) ──────────
  // Rozszerzenie 2026-09-01 (audyt `finance-comments-panel`): powyższa reguła
  // łapie tylko własne nagłówki. Pasek „(symulowane Menu 1 — nie część tego
  // pakietu)" to zwykły `<span>`, więc reguła nagłówkowa go nie widziała.
  if (!chroniony) {
    const fragmenty = widoczneFragmenty(tekst);
    const zlapane = new Set();
    for (const frag of fragmenty) {
      for (const [nazwa, wzorzec] of WZORCE_PRZYRZADU) {
        if (zlapane.has(nazwa)) continue;
        if (wzorzec.test(frag)) zlapane.add(nazwa);
      }
    }
    for (const nazwa of [...zlapane].sort()) {
      naruszenia.push({
        ekran, regula: 'PODPIS', szczegol: `tekst:${nazwa}`,
        opis: `pokazuje tekst zdradzający przyrząd („${nazwa}") poza data-dev-render-chrome — podpis trafia na zrzut`,
      });
      statEkranow.PODPIS.add(ekran);
    }
  }
}

// ── Linia bazowa ──────────────────────────────────────────────────────────────

function kluczNaruszenia(n) {
  return `${n.ekran}\t${n.regula}\t${n.szczegol}`;
}

function wczytajBaseline() {
  const mapa = new Map();
  if (!fs.existsSync(BASELINE_FILE)) return mapa;
  for (const linia of fs.readFileSync(BASELINE_FILE, 'utf8').split('\n')) {
    if (!linia.trim() || linia.startsWith('#')) continue;
    const cz = linia.split('\t');
    if (cz.length < 3) continue;
    mapa.set(`${cz[0]}\t${cz[1]}\t${cz[2]}`, cz[3] ?? '');
  }
  return mapa;
}

if (trybUpdate) {
  const stare = wczytajBaseline();
  const naglowek = [
    '# check-dev-render-parytet.mjs — BASELINE długu zastanego (ratchet).',
    '# Format: <ekran>\\t<reguła>\\t<szczegół>\\t<powód>. Klucz = trzy pierwsze kolumny.',
    '#',
    '# POWÓD ISTNIENIA PLIKU: audyt 2026-09-01 wykazał 41 ekranów harnessu pokazujących',
    '# co innego niż produkt, z czego 29 jest w odbiorze z oceną A/B. Bramka blokująca',
    '# od pierwszego dnia cały ten dług zostałaby wyłączona (tak umarła zero-tolerancyjna',
    '# wersja check-list-canon.sh). Dług zapisany tutaj PRZECHODZI; każde NOWE naruszenie',
    '# spoza tego pliku blokuje.',
    '#',
    '# Kolumna POWÓD jest po to, żeby „przyrząd pomiarowy, nie ekran produktu" przechodziło',
    '# ŚWIADOMIE. Uzupełniaj ją ręcznie — regeneracja (--update) zachowuje istniejące powody.',
    '#',
    '# Regeneruj TYLKO gdy dług ŚWIADOMIE SPADŁ. Nigdy żeby uciszyć nową regresję.',
    `# WYGENEROWANO: ${new Date().toISOString().slice(0, 10)} (node scripts/check-dev-render-parytet.mjs --update)`,
    `# RAZEM: ${naruszenia.length} pozycji`,
    '',
  ].join('\n');

  const linie = naruszenia
    .map((n) => {
      const k = kluczNaruszenia(n);
      const powod = stare.get(k) || `dług zastany 2026-09-01 (audyt przyrządu): ${n.opis}`;
      return `${k}\t${powod}`;
    })
    .sort();

  fs.writeFileSync(BASELINE_FILE, `${naglowek}${linie.join('\n')}\n`);
  console.log(`Zapisano linię bazową: ${BASELINE_FILE} (${linie.length} pozycji)`);
  process.exit(0);
}

const baseline = wczytajBaseline();
const nowe = naruszenia.filter((n) => !baseline.has(kluczNaruszenia(n)));

// ── Raport ────────────────────────────────────────────────────────────────────

const REGULY = [
  ['R1', 'komponent bez wołacza', 'BŁĄD'],
  ['R2', 'kompozycja bez precedensu', 'BŁĄD'],
  ['R3', 'wymyślona szerokość', 'ostrzeżenie'],
  ['PODPIS', 'nagłówek harnessu na zrzucie', 'ostrzeżenie'],
];

function wypisz(lista, tytul) {
  if (lista.length === 0) return;
  console.log(`\n${tytul}`);
  for (const [kod, nazwa] of REGULY) {
    const grupa = lista.filter((n) => n.regula === kod);
    if (grupa.length === 0) continue;
    const ekrany = new Set(grupa.map((n) => n.ekran));
    console.log(`\n  ${kod} — ${nazwa}: ${grupa.length} naruszeń w ${ekrany.size} ekranach`);
    const limit = trybReport ? grupa.length : 15;
    for (const n of grupa.slice(0, limit)) {
      console.log(`    ${n.ekran}: ${n.opis}`);
    }
    if (grupa.length > limit) console.log(`    … i jeszcze ${grupa.length - limit}`);
  }
}

if (trybAll) {
  wypisz(naruszenia, `CAŁY DŁUG (${naruszenia.length} naruszeń, ${plikiEkranow.length} przeskanowanych ekranów):`);
  if (pominieteWariant.length > 0) {
    console.log(`\n  R2 pominięte jako WARIANTOWE: ${pominieteWariant.length} ekranów`);
    if (trybReport) {
      for (const p of pominieteWariant) console.log(`    ${p.ekran} (?${p.param}=)`);
    }
  }
}

wypisz(nowe, 'NOWE NARUSZENIA (spoza linii bazowej):');

console.log(`\n${'='.repeat(66)}`);
console.log(`Ekranów harnessu: ${plikiEkranow.length}   linia bazowa: ${baseline.size} pozycji`);
for (const [kod, nazwa, waga] of REGULY) {
  const wszystkie = naruszenia.filter((n) => n.regula === kod);
  const noweK = nowe.filter((n) => n.regula === kod);
  console.log(
    `  ${kod.padEnd(6)} ${nazwa.padEnd(30)} ekranów: ${String(statEkranow[kod].size).padStart(3)}   nowych: ${String(noweK.length).padStart(3)}   [${waga}]  (naruszeń łącznie: ${wszystkie.length})`,
  );
}
console.log('='.repeat(66));

const noweBledy = nowe.filter((n) => n.regula === 'R1' || n.regula === 'R2');
const noweOstrzezenia = nowe.filter((n) => n.regula === 'R3' || n.regula === 'PODPIS');

if (noweOstrzezenia.length > 0) {
  console.log(`\nOstrzeżenia spoza linii bazowej: ${noweOstrzezenia.length} (nie blokują).`);
}

if (noweBledy.length > 0) {
  console.log(
    `\nWynik: ${noweBledy.length} NOWYCH naruszeń R1/R2 — ekran harnessu pokazuje kompozycję,\n` +
    'której produkcja nie ma. NIE rób zrzutów do odbioru, dopóki tego nie naprawisz.\n' +
    '(Jeśli to świadomy przyrząd pomiarowy, a nie ekran produktu — dopisz wpis z POWODEM\n' +
    ' do scripts/check-dev-render-parytet.baseline.txt.)',
  );
  process.exit(1);
}

console.log('\nWynik: CZYSTO — dług na poziomie linii bazowej, brak nowych rozbieżności.');
process.exit(0);
