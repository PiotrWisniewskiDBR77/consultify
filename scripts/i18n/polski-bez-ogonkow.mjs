#!/usr/bin/env node
/**
 * polski-bez-ogonkow.mjs — PRZYRZĄD POMOCNICZY paczki J-DOG-C.
 *
 * PROBLEM: `pomiar-jezyka.mjs` (funkcja `wykryjPolski`) rozpoznaje polski
 * głównie po diakrytykach + krótkiej liście `polskieSilne`/`polskieSlabe`
 * (patrz `pomiar-jezyka.wyjatki.json`). Polski BEZ ogonków spoza tej listy
 * („Strategiczne", „Sekcje", „Macierz", „Dalej", „Prowizje", „Klienci",
 * „Akademia", „Zapisz", „Anuluj", „Szczegoly", „Brak danych") przechodzi
 * niewidoczny — zmierzone przez paczki J4/J15/J16 (34–39 trafień/moduł na
 * bezpiecznikach źródłowych per moduł).
 *
 * PODEJŚCIE: automatyczny słownik zbudowany z `public/locales/pl/translation.json`
 * (rozbity na słowa, zdjęte diakrytyki), pomniejszony o słowa występujące
 * też jako angielskie w `public/locales/en/translation.json` (żeby nie łapać
 * „plan", „case", „team" itd.), plus ręczna lista rdzeni z instrukcji J-DOG-C.
 * Słowa < 4 znaki odrzucone (zbyt duży szum: „na", „to", „w" itd.).
 *
 * SKANUJE (w plikach modułów z `ZAKRES_MODULOW` poniżej):
 *   - drugi argument `t('klucz', 'tekst')` (defaultValue)
 *   - literał tekstowy w JSX między `>` a `<`
 *   - atrybuty title/placeholder/aria-label/label
 * Komentarze (`// `, `/* `, ` * `, `import`, `export * as`) pomijane.
 *
 * TO JEST PRZYRZĄD, NIE WYROK: fałszywe trafienia (nazwy własne, identyfikatory,
 * angielskie słowa przypadkiem pokrywające się z polskim rdzeniem) trzeba
 * odsiać oczami — patrz `evidence/jezyk-jdog-c/README.md`.
 *
 * Użycie:
 *   node scripts/i18n/polski-bez-ogonkow.mjs                       # wszystkie moduły zakresu
 *   node scripts/i18n/polski-bez-ogonkow.mjs --modul "06 Initiatives"
 *   node scripts/i18n/polski-bez-ogonkow.mjs --json > przed.json
 *   node scripts/i18n/polski-bez-ogonkow.mjs --slownik             # tylko wypisz zbudowany słownik (debug)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// zakres modułów paczki J-DOG-C (patrz instrukcja robotnika — 10 modułów,
// bez modułów J-DOG-A/J-DOG-B: 02 My Work, 04 Tools, 09 Finance, 14 Admin
// Panel, 15 Settings, 16 Partner Portal, ZZ wspólne)
// ---------------------------------------------------------------------------
const ZAKRES_MODULOW = [
  ['01 Chat', [/^src\/(components\/(AIChat|Chat)|views\/(AIChatView|SharedConversationView))/]],
  ['03 Interview', [/^src\/(components\/(Interview|Survey)|views\/(InterviewView|PublicInterviewRespondentView))/]],
  ['05 Assessment', [/^src\/(components\/assessment|components\/MaturityMatrix|views\/(AssessmentSessionEditorView|FreeAssessmentView|PublicMiniAssessmentView))/]],
  ['06 Initiatives', [/^src\/(components\/(Initiatives|InitiativeDetail|Portfolio|Strategy)|components\/(Initiative|Roadmap|Rebalance)[A-Z]|views\/(FullInitiativesView|InitiativeManagementView|PortfolioView|FullRoadmapView))/]],
  ['07 Execution', [/^src\/(components\/(Execution|PMO|Projects|Team)|components\/(Task|Workload|Rollout|FullPilot)[A-Z]|views\/(FullExecutionView|FullPilotView|ProjectIntelligenceView))/]],
  ['08 Results', [/^src\/(components\/(Results|ResultsVNext|Benefits|Conclusions)|components\/(ROIPayback|RadarChart)|views\/(KpiOkrView|FullROIView|ExecutiveSummaryView|ExecutiveView|LeadershipDashboardView))/]],
  ['10 Materials', [/^src\/(components\/(DocumentStudio|PresentationStudio|Presentations|Sheets|ReportBuilder|Reports|ReportsAndPresentations|documents)|components\/FullReportDocument|views\/(ReportBuilderView|PublicArtifactView)|views\/reports|views\/docs)/]],
  ['11 Audits', [/^src\/(components\/Audit|views\/(AuditsShowcasePage|DRDAuditReportView|DRDMatrixPreview))/]],
  ['12 Meeting', [/^src\/(components\/Meeting|views\/PublicBookingView)/]],
  ['13 Organization', [/^src\/(components\/(Organization|governance)|components\/OrgSwitcher|views\/(OrganizationView|OrgSetupWizard))/]],
];

function modulZeSciezki(rel) {
  for (const [modul, regexy] of ZAKRES_MODULOW) {
    for (const re of regexy) if (re.test(rel)) return modul;
  }
  return null;
}

// ---------------------------------------------------------------------------
// diakrytyki
// ---------------------------------------------------------------------------
const MAPA_OGONKOW = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
};
function zdejmijOgonki(s) {
  return String(s).replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => MAPA_OGONKOW[ch] || ch);
}

// ---------------------------------------------------------------------------
// ręczna lista rdzeni (z instrukcji J-DOG-C) — dopasowanie: słowo ZACZYNA SIĘ
// od rdzenia (po zdjęciu ogonków, lowercase) — łapie odmiany/liczbę mnogą.
// ---------------------------------------------------------------------------
const RDZENIE_RECZNE = [
  'zapisz', 'anuluj', 'dalej', 'wstecz', 'brak', 'szczegol', 'dodaj', 'usun',
  'edytuj', 'nowy', 'nowa', 'wybierz', 'zaloguj', 'wyloguj', 'ladowanie',
  'wczytywanie', 'blad', 'sukces', 'uwaga', 'prosze', 'czekaj', 'filtr',
  'sortuj', 'wyszukaj', 'pokaz', 'ukryj', 'wiecej', 'mniej', 'wszystkie',
  'zadne', 'potwierdz', 'odrzuc', 'zatwierdz', 'wyslij',
  'pobierz', 'otworz', 'zamknij', 'kopiuj', 'wklej', 'drukuj', 'eksport',
  'import', 'ustawienia', 'raport', 'inicjatyw', 'zadani', 'zadanie',
  'spotkani', 'notatk', 'decyzj', 'ryzyk', 'koszt', 'budzet', 'termin',
  'wlasciciel', 'odpowiedzialn', 'priorytet', 'status', 'etap', 'krok',
  'faza', 'obszar', 'poziom', 'ocena', 'wynik', 'podsumowanie', 'wniosk',
  'rekomendacj', 'zrodlo', 'dowod', 'zalacznik', 'uczestnik', 'organizacj',
  'uzytkownik', 'zespol', 'klient', 'partner', 'prowizj',
  // dodatkowe rdzenie zmierzone przez J4/J15/J16 jako niewidoczne w przyrządzie:
  'strategiczn', 'sekcj', 'macierz', 'akademi', 'wstecz',
].map((r) => r.toLowerCase());

// TAK/NIE osobno (za krótkie na próg 4 znaków, ale częste jako etykieta przycisku)
const RDZENIE_KROTKIE = new Set(['tak', 'nie']);

// ---------------------------------------------------------------------------
// budowa automatycznego słownika PL bez ogonków (z public/locales/pl minus en)
// ---------------------------------------------------------------------------
function splaszcz(obj, out = []) {
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') splaszcz(v, out);
    else if (typeof v === 'string') out.push(v);
  }
  return out;
}
function slowaZTekstu(tekst) {
  return String(tekst)
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\$\{[^}]*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

function zbudujSlowniki() {
  const plJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/locales/pl/translation.json'), 'utf8'));
  const enJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/locales/en/translation.json'), 'utf8'));

  const plWartosci = splaszcz(plJson);
  const enWartosci = splaszcz(enJson);

  const enSlowa = new Set();
  for (const w of enWartosci) for (const s of slowaZTekstu(w)) enSlowa.add(s);

  const plSlowaBezOgonkow = new Map(); // slowo-bez-ogonkow -> przyklad oryginalny (z ogonkami, do meldunku)
  for (const w of plWartosci) {
    for (const s of slowaZTekstu(w)) {
      const bezOgonkow = zdejmijOgonki(s);
      if (bezOgonkow.length < 4) continue;
      if (enSlowa.has(bezOgonkow)) continue; // to samo słowo istnieje jako angielskie -> nie flagujemy
      if (!plSlowaBezOgonkow.has(bezOgonkow)) plSlowaBezOgonkow.set(bezOgonkow, s);
    }
  }
  return { plSlowaBezOgonkow, enSlowa };
}

const { plSlowaBezOgonkow: SLOWNIK_AUTO, enSlowa: SLOWNIK_EN } = zbudujSlowniki();

/**
 * czy słowo (już bez ogonków, lowercase) jest uznane za polskie.
 * WAŻNE: nawet gdy słowo pasuje do rdzenia ręcznego, jeśli TO SAMO słowo
 * (całe, nie rdzeń) jest też legalnym angielskim tokenem z en/translation.json
 * (np. „status", „important" zawiera rdzeń „import"), NIE flagujemy —
 * to ta sama ochrona, którą ma słownik automatyczny.
 */
function jestPolskimSlowem(slowoBezOgonkow) {
  if (SLOWNIK_EN.has(slowoBezOgonkow)) return null;
  if (RDZENIE_KROTKIE.has(slowoBezOgonkow)) return 'reczny-krotki';
  if (SLOWNIK_AUTO.has(slowoBezOgonkow)) return 'auto';
  for (const rdzen of RDZENIE_RECZNE) {
    if (slowoBezOgonkow.length >= 4 && slowoBezOgonkow.startsWith(rdzen)) return `reczny:${rdzen}`;
  }
  return null;
}

/**
 * @returns {null|{dowod:string[]}} dowód = lista `slowo(zrodlo)` które zdecydowały
 */
export function wykryjPolskiBezOgonkow(tekst) {
  const s = String(tekst).trim();
  if (s.length < 3) return null;
  const dowod = [];
  for (const w of slowaZTekstu(s)) {
    const bezOgonkow = zdejmijOgonki(w);
    const zrodlo = jestPolskimSlowem(bezOgonkow);
    if (zrodlo) dowod.push(`${w}(${zrodlo})`);
  }
  return dowod.length ? { dowod: [...new Set(dowod)] } : null;
}

export { zdejmijOgonki, slowaZTekstu, SLOWNIK_AUTO, RDZENIE_RECZNE };

// ---------------------------------------------------------------------------
// skanowanie plików modułu
// ---------------------------------------------------------------------------
function listujPliki(dir, out = []) {
  let wpisy;
  try {
    wpisy = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const w of wpisy) {
    const pelna = path.join(dir, w.name);
    if (w.isDirectory()) {
      if (w.name === 'node_modules' || w.name === '.git') continue;
      listujPliki(pelna, out);
    } else if (/\.(ts|tsx)$/.test(w.name) && !/\.(test|spec)\./.test(w.name)) {
      out.push(pelna);
    }
  }
  return out;
}

function znajdzPlikiModulu() {
  const wszystkie = listujPliki(path.join(ROOT, 'src'));
  const wynik = new Map(); // modul -> [plik,...]
  for (const [modul] of ZAKRES_MODULOW) wynik.set(modul, []);
  for (const pelna of wszystkie) {
    const rel = path.relative(ROOT, pelna).split(path.sep).join('/');
    if (rel.includes('/__tests__/')) continue;
    const modul = modulZeSciezki(rel);
    if (modul) wynik.get(modul).push(pelna);
  }
  return wynik;
}

// Grupa 4 wyklucza TYLKO ogranicznik \3 (przez negative lookahead), nie oba
// typy cudzysłowu — inaczej ginie każdy default zawierający cudzysłów innego
// typu w środku (np. `'Załóż plan przyciskiem „Nowy plan" — …'`, zmierzone
// przez bezpiecznik J-DOG-C Initiatives 2026-09-09: 5 takich defaultów było
// niewidocznych przy starej, zbyt agresywnej wersji tego wzorca).
const WZ_T_DEFAULT = /\bt\(\s*(["'`])([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]]+)+)\1\s*,\s*(["'])((?:\\.|(?!\3)[^\\]){2,400})\3/g;
const WZ_ATRYBUTY = /\b(placeholder|title|label|aria-label|ariaLabel)\s*=\s*(["'])([^"'{}]{2,200})\2/g;
// tag i tekst mogą być w osobnych liniach (`<label>\n  Tekst\n</label>`) —
// białe znaki WOKÓŁ (w tym nowa linia) są dozwolone, ale sam przechwycony
// tekst musi być jednoliniowy (żeby nie łapać kodu rozlanego na wiele linii).
const WZ_TEKST_JSX = />[ \t\r\n]*([^<>{}\n][^<>{}\n]*)[ \t\r\n]*</g;

function jestKomentarzemLubImportem(linia) {
  return /^\s*(\/\/|\*|\/\*|\{\s*\/\*|import |export \* )/.test(linia);
}

function skanujPlik(pelna) {
  const rel = path.relative(ROOT, pelna).split(path.sep).join('/');
  const tresc = fs.readFileSync(pelna, 'utf8');
  const linie = tresc.split('\n');
  const trafienia = [];

  const nrLinii = (offset) => tresc.slice(0, offset).split('\n').length;

  if (tresc.includes('t(')) {
    WZ_T_DEFAULT.lastIndex = 0;
    let m;
    while ((m = WZ_T_DEFAULT.exec(tresc))) {
      const nr = nrLinii(m.index);
      if (jestKomentarzemLubImportem(linie[nr - 1] || '')) continue;
      const wynik = wykryjPolskiBezOgonkow(m[4]);
      if (wynik) trafienia.push({ rel, linia: nr, tekst: m[4], typ: 't-default', dowod: wynik.dowod });
    }
  }

  WZ_ATRYBUTY.lastIndex = 0;
  let ma;
  while ((ma = WZ_ATRYBUTY.exec(tresc))) {
    const nr = nrLinii(ma.index);
    const linia = linie[nr - 1] || '';
    if (jestKomentarzemLubImportem(linia)) continue;
    if (/\bt\s*\(/.test(linia) && linia.indexOf(ma[3]) > linia.indexOf('t(')) continue;
    const wynik = wykryjPolskiBezOgonkow(ma[3]);
    if (wynik) trafienia.push({ rel, linia: nr, tekst: ma[3], typ: `atrybut:${ma[1]}`, dowod: wynik.dowod });
  }

  WZ_TEKST_JSX.lastIndex = 0;
  let mj;
  while ((mj = WZ_TEKST_JSX.exec(tresc))) {
    const kandydat = mj[1].trim();
    if (!kandydat) continue;
    const offsetTekstu = mj.index + mj[0].indexOf(mj[1]);
    const nr = nrLinii(offsetTekstu);
    const linia = linie[nr - 1] || '';
    if (jestKomentarzemLubImportem(linia)) continue;
    if (/^[A-Za-z]+\s*=/.test(kandydat)) continue;
    if (/;|=>|\bconst\b|\blet\b|\breturn\b|\bfunction\b|useState|useRef|useMemo|&&|\|\||\?\?|===|!==/.test(kandydat)) continue;
    // generyki TS (`Foo<Bar<Baz>>`) i wyrażenia (`krok.wielokrotny ? (`) też
    // pasują do `>...<` — odrzuć identyfikator/wyrażenie zakończone ternary/nawiasem
    if (/^[A-Za-z_$][\w.[\]']*\s*\?\s*\(?\s*$/.test(kandydat)) continue;
    if (/^[A-Za-z_$][\w]*(\.[A-Za-z_$][\w]*)+$/.test(kandydat)) continue;
    if (/\bt\s*\(/.test(linia) && linia.indexOf(kandydat) > linia.indexOf('t(')) continue;
    const wynik = wykryjPolskiBezOgonkow(kandydat);
    if (wynik) trafienia.push({ rel, linia: nr, tekst: kandydat, typ: 'jsx-tekst', dowod: wynik.dowod });
  }

  return trafienia;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function main() {
  const argi = process.argv.slice(2);
  if (argi.includes('--slownik')) {
    console.log(`Auto (${SLOWNIK_AUTO.size}):`, [...SLOWNIK_AUTO.keys()].sort().join(', '));
    console.log(`Ręczne rdzenie (${RDZENIE_RECZNE.length}):`, RDZENIE_RECZNE.join(', '));
    return;
  }
  const idxModul = argi.indexOf('--modul');
  const filtrModul = idxModul >= 0 ? argi[idxModul + 1] : null;
  const jsonOut = argi.includes('--json');

  const plikiPerModul = znajdzPlikiModulu();
  const raport = {};
  let sumaTrafien = 0;

  for (const [modul] of ZAKRES_MODULOW) {
    if (filtrModul && modul !== filtrModul) continue;
    const pliki = plikiPerModul.get(modul) || [];
    const trafienia = [];
    for (const p of pliki) trafienia.push(...skanujPlik(p));
    raport[modul] = { plikow: pliki.length, trafien: trafienia.length, trafienia };
    sumaTrafien += trafienia.length;
  }

  if (jsonOut) {
    console.log(JSON.stringify(raport, null, 2));
    return;
  }

  for (const [modul, dane] of Object.entries(raport)) {
    console.log(`\n=== ${modul} — plików: ${dane.plikow}, trafień: ${dane.trafien} ===`);
    for (const t of dane.trafienia) {
      console.log(`${t.rel}:${t.linia}: [${t.typ}] "${t.tekst.slice(0, 100)}" — ${t.dowod.join(', ')}`);
    }
  }
  console.log(`\nSUMA trafień (zakres J-DOG-C): ${sumaTrafien}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
