/**
 * MVP FINAL — mapa modułów + resolver importów (wspólny rdzeń dla zamroz.mjs / porownaj.mjs / testów).
 *
 * PO CO: właściciel odbiera MVP moduł po module (05.09). Po jego „tak" moduł ma być
 * ZAMROŻONY — nikt go już nie dotyka bez świadomej decyzji. Żeby to było mechaniczne,
 * a nie deklaratywne, musimy umieć wyznaczyć LISTĘ PLIKÓW modułu z kodu, nie z opisu.
 *
 * ŹRÓDŁO KORZENI: docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-bindings.json
 * (kolumna `component`) + lazy-importy w src/routes/AppRoutes.tsx, które te komponenty
 * mapują na realne pliki. Mapa jest STATYCZNA (poniżej) świadomie — ma być czytelna dla
 * człowieka i stabilna, a rozjazd z bindings.json wykrywa test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Klucze modułów = katalogi docs/program/waves/WAVE_03_ACCEPTANCE/modules/. */
export const MODULY = {
  '01_ORGANIZATION': {
    nazwa: 'Organizacja',
    bindingId: 'organization',
    korzenie: ['src/views/OrganizationView.tsx'],
    terytorium: ['src/components/Organization/', 'src/views/OrganizationView.tsx'],
    katalogi: ['14-organizacja'],
  },
  '02_INTERVIEW': {
    nazwa: 'Wywiad',
    bindingId: 'interview',
    korzenie: ['src/components/Interview/InterviewHub.tsx'],
    terytorium: ['src/components/Interview/', 'src/views/InterviewView.tsx'],
    katalogi: ['03-wywiad'],
  },
  '03_TOOLS': {
    nazwa: 'Narzędzia',
    bindingId: 'tools',
    korzenie: ['src/components/Discovery/DiscoveryToolsHub.tsx'],
    terytorium: ['src/components/Discovery/', 'src/components/DiscoveryTools/', 'src/views/discovery-tools/', 'src/hooks/discovery/'],
    katalogi: ['04-narzedzia'],
  },
  '04_ASSESSMENT': {
    nazwa: 'Ocena',
    bindingId: 'assessment',
    korzenie: ['src/components/assessment/AssessmentHub.tsx'],
    terytorium: ['src/components/assessment/', 'src/views/AssessmentSessionEditorView.tsx'],
    katalogi: ['05-ocena'],
  },
  '05_INITIATIVES': {
    nazwa: 'Inicjatywy',
    bindingId: 'initiatives',
    korzenie: ['src/components/Initiatives/InitiativesHub.tsx'],
    terytorium: ['src/components/Initiatives/', 'src/components/InitiativeDetail/'],
    katalogi: ['06-inicjatywy'],
  },
  '06_EXECUTION': {
    nazwa: 'Realizacja',
    bindingId: 'execution',
    korzenie: ['src/components/Execution/ExecutionHub.tsx'],
    terytorium: ['src/components/Execution/'],
    katalogi: ['07-realizacja'],
  },
  '07_MY_WORK_AGENT': {
    nazwa: 'Moja praca / Agent',
    bindingId: 'my-work',
    korzenie: ['src/views/MyWorkView.tsx'],
    terytorium: ['src/components/MyWork/', 'src/views/MyWorkView.tsx', 'src/utils/mywork/'],
    katalogi: ['02-moja-praca', '15-agent'],
  },
  '08_MEETINGS': {
    nazwa: 'Spotkania',
    bindingId: 'meetings',
    korzenie: ['src/components/Meeting/MeetingHub.tsx'],
    terytorium: ['src/components/Meeting/'],
    katalogi: ['12-spotkania'],
  },
  '09_RESULTS': {
    nazwa: 'Wyniki',
    bindingId: 'results',
    korzenie: ['src/components/Results/ResultsOwnerReviewEntry.tsx'],
    terytorium: ['src/components/Results/', 'src/components/ResultsVNext/'],
    katalogi: ['08-wyniki'],
  },
  '10_FINANCE': {
    nazwa: 'Finanse',
    bindingId: 'finance',
    korzenie: ['src/views/EconomicsView.tsx'],
    terytorium: ['src/components/Economics/', 'src/components/Finance/', 'src/views/EconomicsView.tsx'],
    katalogi: ['09-finanse'],
  },
  '11_MATERIALS': {
    nazwa: 'Materiały',
    bindingId: 'materials',
    korzenie: ['src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx'],
    terytorium: ['src/components/ReportsAndPresentations/'],
    katalogi: ['10-materialy'],
  },
  '12_AUDITS': {
    nazwa: 'Audyty',
    bindingId: 'audits',
    korzenie: ['src/components/Audit/method/AuditsMethodHub.tsx'],
    terytorium: ['src/components/Audit/'],
    katalogi: ['11-audyty'],
  },
  '13_CHAT': {
    nazwa: 'Czat',
    bindingId: 'chat',
    korzenie: [
      'src/components/AIChat/UnifiedChatPanel.tsx',
      'src/views/AIChatView.tsx',
      'src/components/AIChat/WorkCanvasDocumentPanel.tsx',
    ],
    terytorium: ['src/components/AIChat/', 'src/views/AIChatView.tsx'],
    katalogi: ['01-czat'],
  },
  '14_ADMIN': {
    nazwa: 'Administracja',
    bindingId: 'admin',
    korzenie: ['src/views/admin/AdminView.tsx'],
    terytorium: ['src/components/Admin/', 'src/views/admin/'],
    katalogi: ['13-administracja'],
  },
  '15_SETTINGS': {
    nazwa: 'Ustawienia',
    bindingId: 'settings',
    korzenie: ['src/views/SettingsView.tsx'],
    terytorium: ['src/components/settings/', 'src/views/settings/', 'src/views/SettingsView.tsx'],
    katalogi: ['18-ustawienia'],
  },
  '16_PARTNER': {
    nazwa: 'Partner',
    bindingId: 'partner',
    korzenie: ['src/views/partner/PartnerPortalView.tsx'],
    terytorium: ['src/components/Partner/', 'src/views/partner/'],
    katalogi: [],
  },
};

/** Pseudo-moduł: pliki dzielone przez >1 moduł. Zamrażany osobno (--modul=WSPOLNE). */
export const KLUCZ_WSPOLNE = 'WSPOLNE';
export const KATALOGI_WSPOLNE = ['16-kanon'];

/**
 * Ścieżki, które ZAWSZE trafiają do „wspólnych", nawet gdy dziś sięga po nie jeden moduł.
 * Powód: to jest kanon UI (CLAUDE.md UI pkt 1) — zmiana tutaj rusza KAŻDY zamrożony ekran,
 * więc nie wolno jej schować pod zamrożeniem jednego modułu.
 */
export const WYMUSZONE_WSPOLNE = [
  'src/components/standard/',
  'src/components/shared/',
  'src/components/ui/',
  'src/store/',
  'src/services/api',
  'src/i18n',
];

export const SCIEZKA_REJESTRU = 'docs/program/MVP_FINAL_ZAMROZONE.json';
export const KATALOG_WZORCOW = 'evidence/mvp-final';
export const KATALOG_ZRZUTOW_ZYWO = 'evidence/odbior-zywo-20260905';

const ROZSZERZENIA = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.json'];

/**
 * Wyciąga specyfikatory importu z treści pliku. Świadomie proste (regex, nie parser):
 * łapie `import ... from 'x'`, `export ... from 'x'`, `import('x')`, `require('x')`.
 * Komentarze blokowe wycinamy, żeby zakomentowany import nie wciągał martwego pliku.
 */
export function wyciagnijSpecyfikatory(tresc) {
  const bezKomentarzy = tresc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const out = [];
  const wzorce = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
  ];
  for (const w of wzorce) {
    let m;
    while ((m = w.exec(bezKomentarzy)) !== null) out.push(m[1]);
  }
  return out;
}

/** Kanonizator wielkości liter: macOS ma FS bez rozróżniania (admin == Admin), git nie. */
export function zbudujKanonizator(root) {
  let mapa = null;
  try {
    const lista = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' });
    mapa = new Map();
    for (const l of lista.split('\n')) {
      const s = l.trim();
      if (s) mapa.set(s.toLowerCase(), s);
    }
  } catch {
    mapa = null; // poza repo (fixture w teście) — kanonizacja nie jest potrzebna
  }
  return (p) => (mapa && mapa.get(p.toLowerCase())) || p;
}

/** Rozwiązuje jeden specyfikator do ścieżki względem roota repo, albo null. */
export function rozwiazSpecyfikator(spec, plikZrodlowy, root, istnieje = (p) => fs.existsSync(path.join(root, p))) {
  let baza;
  if (spec.startsWith('@/')) baza = path.posix.join('src', spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) {
    baza = path.posix.normalize(path.posix.join(path.posix.dirname(plikZrodlowy), spec));
  } else return null; // pakiet z node_modules albo inny alias — poza zakresem zamrożenia

  if (!baza.startsWith('src/')) return null;
  const kandydaci = [baza, ...ROZSZERZENIA.map((e) => baza + e), ...ROZSZERZENIA.map((e) => path.posix.join(baza, 'index' + e))];
  for (const k of kandydaci) {
    if (istnieje(k) && fs.statSync(path.join(root, k)).isFile()) return k;
  }
  return null;
}

/**
 * Domknięcie tranzytywne: zbiór plików src/ osiągalnych z podanych korzeni.
 * Zwraca posortowaną tablicę ścieżek względnych do roota repo.
 */
export function zbierzPliki(korzenie, root, opcje = {}) {
  const kanon = opcje.kanonizator || zbudujKanonizator(root);
  const istnieje = (p) => fs.existsSync(path.join(root, p));
  const widziane = new Set();
  const kolejka = [];
  for (const k of korzenie) {
    const kk = kanon(k);
    if (istnieje(kk)) { widziane.add(kk); kolejka.push(kk); }
    else if (opcje.rzucajBrakKorzenia) throw new Error(`Korzeń nie istnieje: ${k}`);
  }
  while (kolejka.length) {
    const plik = kolejka.shift();
    let tresc;
    try { tresc = fs.readFileSync(path.join(root, plik), 'utf8'); } catch { continue; }
    for (const spec of wyciagnijSpecyfikatory(tresc)) {
      const r = rozwiazSpecyfikator(spec, plik, root, istnieje);
      if (!r) continue;
      const rk = kanon(r);
      if (!widziane.has(rk)) { widziane.add(rk); kolejka.push(rk); }
    }
  }
  return [...widziane].sort();
}

/**
 * Pliki, których zamrożenie NIE obejmuje. Powód: właściciel akceptuje EKRAN, nie zakaz
 * dopisywania testów. Zamrożenie ma blokować zmianę produktu, nie dowodu.
 */
export function jestPozaZamrozeniem(p) {
  return (
    /(^|\/)__tests__\//.test(p) ||
    /(^|\/)__mocks__\//.test(p) ||
    /\.(test|spec)\.[tj]sx?$/.test(p) ||
    /\.stories\.[tj]sx?$/.test(p)
  );
}

/** Wszystkie śledzone przez git pliki źródłowe leżące w terytorium modułu. */
export function plikiTerytorium(root, terytorium) {
  if (!terytorium || !terytorium.length) return [];
  let lista = [];
  try {
    lista = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  } catch { return []; }
  return lista.filter(
    (p) => wTerytorium(p, terytorium) && !jestPozaZamrozeniem(p) && /\.(tsx?|jsx?|mjs|cjs)$/.test(p)
  );
}

export function jestWymuszoneWspolne(p) {
  return WYMUSZONE_WSPOLNE.some((prefix) => p.startsWith(prefix));
}

/** Czy ścieżka leży w terytorium modułu (prefiks katalogu albo dokładny plik). */
export function wTerytorium(p, terytorium) {
  if (!terytorium) return false;
  return terytorium.some((t) => (t.endsWith('/') ? p.startsWith(t) : p === t));
}

/**
 * Liczy osiągalność dla WSZYSTKICH 16 modułów naraz i przypisuje każdy plik do
 * właściciela. TRZY reguły, w tej kolejności (zero magii, dają się przeczytać):
 *
 *  R1. Plik leży w TERYTORIUM modułu M (zadeklarowany katalog M) i jest osiągalny z M
 *      → należy do M. Nawet jeśli sięga po niego też inny moduł — właścicielem jest ten,
 *      na czyim terytorium plik stoi.
 *  R2. Plik jest osiągalny DOKŁADNIE z jednego modułu (i nie jest wymuszony jako wspólny)
 *      → należy do tego modułu.
 *  R3. Reszta (osiągalny z ≥2 modułów spoza terytoriów, albo ścieżka z WYMUSZONE_WSPOLNE)
 *      → WSPÓLNE, zamrażane osobno.
 *
 * Bez R1 zamrożenie Czatu chroniłoby 1 plik (94 pliki src/components/AIChat/ są też
 * osiągalne z Mojej Pracy) — czyli bezpiecznik dający fałszywy spokój. Zmierzone 2026-09-05.
 */
export function policzOsiagalnosc(root, moduly = MODULY) {
  const kanonizator = zbudujKanonizator(root);
  const perModul = {};
  const licznik = new Map(); // plik -> Set(kluczy modułów, z których jest osiągalny)
  for (const [klucz, def] of Object.entries(moduly)) {
    const zasiew = [...def.korzenie, ...plikiTerytorium(root, def.terytorium)];
    const pliki = zbierzPliki(zasiew, root, { kanonizator }).filter((p) => !jestPozaZamrozeniem(p));
    perModul[klucz] = pliki;
    for (const p of pliki) {
      if (!licznik.has(p)) licznik.set(p, new Set());
      licznik.get(p).add(klucz);
    }
  }
  const wspolne = [];
  const wlasne = {};
  const powod = {}; // plik -> 'R1'|'R2'|'R3'
  for (const klucz of Object.keys(moduly)) wlasne[klucz] = [];
  for (const [p, osiagalneZ] of licznik) {
    if (jestWymuszoneWspolne(p)) { wspolne.push(p); powod[p] = 'R3'; continue; }
    const wlasciciel = Object.keys(moduly).find(
      (k) => wTerytorium(p, moduly[k].terytorium) && osiagalneZ.has(k)
    );
    if (wlasciciel) { wlasne[wlasciciel].push(p); powod[p] = 'R1'; continue; }
    if (osiagalneZ.size === 1) { const k = [...osiagalneZ][0]; wlasne[k].push(p); powod[p] = 'R2'; continue; }
    wspolne.push(p); powod[p] = 'R3';
  }
  wspolne.sort();
  for (const k of Object.keys(wlasne)) wlasne[k].sort();
  return { perModul, wlasne, wspolne, powod };
}

export function wczytajRejestr(root) {
  const p = path.join(root, SCIEZKA_REJESTRU);
  if (!fs.existsSync(p)) return { _opis: '', moduly: {}, wspolne: null };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Wszystkie ścieżki objęte zamrożeniem (moduły + wspólne). */
export function zamrozonePliki(rejestr) {
  const out = new Map(); // plik -> klucz modułu (pierwszy, który go zamroził)
  for (const [klucz, wpis] of Object.entries(rejestr.moduly || {})) {
    for (const p of wpis.pliki || []) if (!out.has(p)) out.set(p, klucz);
  }
  if (rejestr.wspolne && Array.isArray(rejestr.wspolne.pliki)) {
    for (const p of rejestr.wspolne.pliki) if (!out.has(p)) out.set(p, KLUCZ_WSPOLNE);
  }
  return out;
}
