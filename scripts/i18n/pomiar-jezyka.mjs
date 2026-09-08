#!/usr/bin/env node
/**
 * pomiar-jezyka.mjs — POMIAR spójności językowej aplikacji (EN i PL).
 *
 * Mierzy kategorie obcego języka, każdą osobno (bo każda ma inną naprawę):
 *   K1    polski tekst w plikach `public/locales/en/*.json`
 *   K1def polski `defaultValue` w wywołaniu `t('klucz', 'Polski tekst')` w src/**
 *   K2    angielski tekst w plikach `public/locales/pl/*.json`
 *   K3a   klucz jest w PL, brak w EN — patrz K3aPL / K3aKLUCZ
 *   K3aPL   z tego: brak w EN i polski defaultValue w kodzie -> UŻYTKOWNIK EN WIDZI POLSKI
 *   K3aKLUCZ z tego: brak w EN i brak defaultValue -> UŻYTKOWNIK EN WIDZI SUROWY KLUCZ
 *   K3b   klucz jest w EN, brak w PL (użytkownik PL zobaczy angielski default/klucz)
 *   K4    tekst na sztywno w JSX/TSX poza `t()` (osobno PL i EN)
 *   K5    zdania po polsku/angielsku wychodzące z serwera do UI (błędy, walidatory, throw)
 *   K7    daty/liczby/waluty formatowane bez locale albo z locale przybitym na sztywno
 *
 * DLACZEGO K1def i K3aPL są najważniejsze dla wersji EN:
 * `src/i18n.ts` ustawia `fallbackLng: { en: ['en'] }` — brak klucza w EN NIE spada
 * na polski plik, tylko na `defaultValue` z kodu, a gdy go nie ma — na surowy klucz.
 * Dodatkowo `react.useSuspense: false` sprawia, że do czasu dojścia pliku tłumaczeń
 * `t()` zwraca `defaultValue`, więc polskie defaulty MIGAJĄ nawet przy poprawnym EN.
 *
 * Kategorie K6 (etykiety z danych/seed), K8 (maile, PDF/DOCX) i K9 (język odpowiedzi AI)
 * NIE są mierzone tym skanerem — patrz docs/program/JEZYK_EN_PL_20260908/POMIAR.md.
 *
 * Użycie:
 *   node scripts/i18n/pomiar-jezyka.mjs                 # raport tekstowy per moduł
 *   node scripts/i18n/pomiar-jezyka.mjs --json          # surowe liczby (do bramki)
 *   node scripts/i18n/pomiar-jezyka.mjs --json > baseline.json
 *   node scripts/i18n/pomiar-jezyka.mjs --baseline <plik>  # RATCHET: kod 1 gdy liczba rośnie
 *   node scripts/i18n/pomiar-jezyka.mjs --modul Initiatives   # tylko jeden moduł
 *   node scripts/i18n/pomiar-jezyka.mjs --kategoria K1        # tylko jedna kategoria
 *   node scripts/i18n/pomiar-jezyka.mjs --przyklady 20        # więcej przykładów
 *
 * ZASADA: to jest PRZYRZĄD, nie prawda ostateczna. Heurystyka słownikowa daje
 * fałszywe trafienia i fałszywe przepuszczenia. Wyjątki i słowniki: plik obok
 * (pomiar-jezyka.wyjatki.json). Zawsze weryfikuj oczami na zrzucie ekranu.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const WYJATKI = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pomiar-jezyka.wyjatki.json'), 'utf8'),
);

// ---------------------------------------------------------------------------
// 16 pozycji menu wg docs/FUNCTIONAL_DOCUMENTATION.md (kolejność = kolejność planu)
// ---------------------------------------------------------------------------
const MODULY = [
  '01 Chat',
  '02 My Work',
  '03 Interview',
  '04 Tools',
  '05 Assessment',
  '06 Initiatives',
  '07 Execution',
  '08 Results',
  '09 Finance',
  '10 Materials',
  '11 Audits',
  '12 Meeting',
  '13 Organization',
  '14 Admin Panel',
  '15 Settings',
  '16 Partner Portal',
  'ZZ wspólne',
];
const WSPOLNE = 'ZZ wspólne';

/** ścieżka pliku źródłowego -> moduł (pierwsze dopasowanie wygrywa) */
const MAPA_SCIEZEK = [
  [/^src\/(components\/(AIChat|Chat)|views\/(AIChatView|SharedConversationView))/, '01 Chat'],
  [/^src\/(components\/(MyWork|CaseWorkspace|Journey)|views\/(MyWorkView|MyApprovalsView|AgentPlanView|ActionProposalView)|views\/vault)/, '02 My Work'],
  [/^src\/(components\/(Interview|Survey)|views\/(InterviewView|PublicInterviewRespondentView))/, '03 Interview'],
  [/^src\/(components\/(DiscoveryTools|Discovery|Studio|Megatrend|PlaybookEditor|TemplateBuilder|method-workspace|Knowledge)|views\/(ToolsShowcasePage|StudioView|StudioUnavailableView|KnowledgeBaseView|KnowledgeBaseEntryView|ContextBuilder|Module1ContextView)|views\/knowledge)/, '04 Tools'],
  [/^src\/(components\/assessment|components\/MaturityMatrix|views\/(AssessmentSessionEditorView|FreeAssessmentView|PublicMiniAssessmentView))/, '05 Assessment'],
  [/^src\/(components\/(Initiatives|InitiativeDetail|Portfolio|Strategy)|components\/(Initiative|Roadmap|Rebalance)[A-Z]|views\/(FullInitiativesView|InitiativeManagementView|PortfolioView|FullRoadmapView))/, '06 Initiatives'],
  [/^src\/(components\/(Execution|PMO|Projects|Team)|components\/(Task|Workload|Rollout|FullPilot)[A-Z]|views\/(FullExecutionView|FullPilotView|ProjectIntelligenceView))/, '07 Execution'],
  [/^src\/(components\/(Results|ResultsVNext|Benefits|Conclusions)|components\/(ROIPayback|RadarChart)|views\/(KpiOkrView|FullROIView|ExecutiveSummaryView|ExecutiveView|LeadershipDashboardView))/, '08 Results'],
  [/^src\/(components\/(Finance|Economics)|views\/(EconomicsView|PricingView|PricingLandingPage|AppPricingView))/, '09 Finance'],
  [/^src\/(components\/(DocumentStudio|PresentationStudio|Presentations|Sheets|ReportBuilder|Reports|ReportsAndPresentations|documents)|components\/FullReportDocument|views\/(ReportBuilderView|PublicArtifactView)|views\/reports|views\/docs)/, '10 Materials'],
  [/^src\/(components\/Audit|views\/(AuditsShowcasePage|DRDAuditReportView|DRDMatrixPreview))/, '11 Audits'],
  [/^src\/(components\/Meeting|views\/PublicBookingView)/, '12 Meeting'],
  [/^src\/(components\/(Organization|governance)|components\/OrgSwitcher|views\/(OrganizationView|OrgSetupWizard))/, '13 Organization'],
  [/^src\/(components\/(Admin|SuperAdmin|billing)|views\/(admin|superadmin)|components\/SystemHealth|views\/SystemHealthDashboard)/, '14 Admin Panel'],
  [/^src\/(components\/(settings|AISettings|Profile|Onboarding|Help|Notifications|Gamification|Education|InAppNudges)|components\/(OnboardingTour|CookieConsentBanner|InviteUserModal)|views\/(SettingsView|OnboardingWizard|WelcomeView|AppIntroView|ChangelogView)|views\/settings)/, '15 Settings'],
  [/^src\/(components\/(Partner|Subscriber|Trial)|views\/(BecomePartnerView|PartnerApplicationView|TrialEntryView)|views\/partner|views\/subscriber)/, '16 Partner Portal'],
];

/** prefiks klucza i18n -> moduł */
const MAPA_KLUCZY = {
  '01 Chat': ['chat', 'aiChat', 'chatSignals', 'chatProposal', 'chatOutputTool', 'voice', 'thinking', 'deepThinking', 'focusMode', 'commandPalette', 'command', 'commandCenter'],
  '02 My Work': ['myWork', 'myWorkIdeas', 'myWorkTable', 'myWorkNotebook', 'myWorkMindmap', 'vault', 'agentPlan', 'task', 'taskDropdown', 'formBuilder', 'formsIndex', 'interfacesIndex', 'step1'],
  '03 Interview': ['interview', 'survey'],
  '04 Tools': ['tools', 'discovery', 'discoveryTools', 'discoveryToolsSteps', 'discoveryToolsMain', 'discoveryToolsTools', 'licensedTools', 'megatrends', 'canvas', 'canvasEditBar', 'mindmap', 'ideas', 'notebook', 'processFlow', 'diagram', 'table', 'templateBuilder', 'methodWorkspace', 'kb', 'karta'],
  '05 Assessment': ['assessment', 'publicAssessment', 'externalAssessment', 'capability', 'competency', 'skillsGap', 'nmodeCompleteness', 'maturity'],
  '06 Initiatives': ['initiatives', 'initiative', 'initiativeStatus', 'initiativeStatusDescription', 'portfolio', 'roadmap', 'businessCase', 'decisions', 'priority'],
  '07 Execution': ['execution', 'executionReports', 'pmo', 'change', 'stakeholder', 'branch', 'team'],
  '08 Results': ['benefits', 'kpi', 'results', 'executive', 'conclusions'],
  '09 Finance': ['economics', 'finance', 'valuation', 'pricing', 'billing', 'billingAdmin', 'transactionReadiness', 'sellixIntegration'],
  '10 Materials': ['presentations', 'prezentacje', 'presentationState', 'documents', 'documentStudio', 'tabele', 'excele', 'reports', 'reportBuilder', 'rbHub', 'coreDocs', 'sponsorReport', 'artifacts', 'toolOutputs', 'html'],
  '11 Audits': ['audit', 'audits', 'agentAudit', 'drd', 'traceability'],
  '12 Meeting': ['meeting', 'meetingActionItemsP9', 'scheduleModal', 'publicBooking', 'p9Handoff'],
  '13 Organization': ['organization', 'relation', 'role'],
  '14 Admin Panel': ['admin', 'superadmin', 'superAdmin', 'superadminGuardrails', 'impersonation', 'aiGovernance', 'modelRegistry', 'scimGroupSync', 'ssoSelfService', 'aiPlatform', 'aios', 'aiActions', 'aiPrompts', 'aiAuthoring', 'llm', 'access', 'policy'],
  '15 Settings': ['settings', 'profile', 'userProfile', 'security', 'mfa', 'notifications', 'notificationDropdown', 'onboarding', 'tour', 'firstRun', 'help', 'feedback', 'welcome'],
  '16 Partner Portal': ['partner', 'partners', 'trial', 'subscriber'],
};
const KLUCZ_DO_MODULU = new Map();
for (const [modul, prefiksy] of Object.entries(MAPA_KLUCZY)) {
  for (const p of prefiksy) if (!KLUCZ_DO_MODULU.has(p)) KLUCZ_DO_MODULU.set(p, modul);
}
/** dodatkowe pliki namespace -> moduł */
const MAPA_NAMESPACE = {
  'assessment-module': '05 Assessment',
  discovery: '04 Tools',
  'tabele-lifecycle': '10 Materials',
  'tabele-provenance': '10 Materials',
  'tabele-templates': '10 Materials',
};

// ---------------------------------------------------------------------------
// heurystyka językowa
// ---------------------------------------------------------------------------
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const pomijaneWartosci = WYJATKI.pomijaneWartosci.map((r) => new RegExp(r));
const pomijaneKlucze = WYJATKI.pomijaneKlucze.map((r) => new RegExp(r));
const pomijaneSciezki = WYJATKI.pomijaneSciezki.map((r) => new RegExp(r));
const nazwyWlasne = new Set(WYJATKI.nazwyWlasne.map((s) => s.toLowerCase()));
const plSilne = new Set(WYJATKI.polskieSilne);
const plSlabe = new Set(WYJATKI.polskieSlabe);
const enSilne = new Set(WYJATKI.angielskieSilne);
const enSlabe = new Set(WYJATKI.angielskieSlabe);

/** usuwa to, co nie jest ludzkim tekstem: {{count}}, <tag>, URL, kod */
function oczysc(tekst) {
  return String(tekst)
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\$\{[^}]*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[\w.-]+@[\w.-]+\b/g, ' ');
}

function slowa(tekst) {
  const out = [];
  for (const w of oczysc(tekst).split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)) {
    if (!w) continue;
    const l = w.toLowerCase();
    if (nazwyWlasne.has(l)) continue;
    out.push(l);
  }
  return out;
}

/** czy wartość w ogóle nadaje się do oceny językowej */
function wartoOceniac(tekst) {
  const s = String(tekst).trim();
  if (s.length < 3) return false;
  for (const r of pomijaneWartosci) if (r.test(s)) return false;
  const czysty = oczysc(s).trim();
  if (czysty.length < 3) return false;
  if (!/[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]{2,}/.test(czysty)) return false;
  return true;
}

/** @returns {null|{jezyk:'pl'|'en', dowod:string[]}} */
function wykryjPolski(tekst) {
  if (!wartoOceniac(tekst)) return null;
  const dowod = [];
  const czysty = oczysc(tekst);
  const diak = czysty.match(DIAKRYTYKI);
  if (diak) dowod.push(`diakrytyk:${diak[0]}`);
  const ws = slowa(tekst);
  const silne = [...new Set(ws.filter((w) => plSilne.has(w)))];
  const slabe = [...new Set(ws.filter((w) => plSlabe.has(w)))];
  if (silne.length) dowod.push(...silne.map((w) => `pl:${w}`));
  if (dowod.length === 0 && slabe.length >= 2) dowod.push(...slabe.slice(0, 2).map((w) => `pl?:${w}`));
  return dowod.length ? { jezyk: 'pl', dowod } : null;
}

function wykryjAngielski(tekst) {
  if (!wartoOceniac(tekst)) return null;
  const ws = slowa(tekst);
  // polskie diakrytyki albo silne polskie słowo => to jednak polski, nie flagujemy
  if (DIAKRYTYKI.test(oczysc(tekst))) return null;
  if (ws.some((w) => plSilne.has(w))) return null;
  const silne = [...new Set(ws.filter((w) => enSilne.has(w)))];
  const slabe = [...new Set(ws.filter((w) => enSlabe.has(w)))];
  const dowod = [];
  if (silne.length) dowod.push(...silne.map((w) => `en:${w}`));
  if (dowod.length === 0 && slabe.length >= 2) dowod.push(...slabe.slice(0, 2).map((w) => `en?:${w}`));
  return dowod.length ? { jezyk: 'en', dowod } : null;
}

// ---------------------------------------------------------------------------
// obsługa plików
// ---------------------------------------------------------------------------
function pominSciezke(rel) {
  return pominSciezkeRaw(rel.split(path.sep).join('/'));
}
function pominSciezkeRaw(rel) {
  for (const r of pomijaneSciezki) if (r.test(rel)) return true;
  return false;
}

function listujPliki(dir, filtr, wynik = []) {
  let wpisy;
  try {
    wpisy = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return wynik;
  }
  for (const w of wpisy) {
    const pelna = path.join(dir, w.name);
    const rel = path.relative(ROOT, pelna).split(path.sep).join('/');
    if (w.isDirectory()) {
      if (w.name === 'node_modules' || w.name === '.git') continue;
      if (pominSciezkeRaw(rel + '/')) continue;
      listujPliki(pelna, filtr, wynik);
    } else if (filtr(w.name) && !pominSciezkeRaw(rel)) {
      wynik.push(rel);
    }
  }
  return wynik;
}

function modulZeSciezki(rel) {
  for (const [re, modul] of MAPA_SCIEZEK) if (re.test(rel)) return modul;
  return WSPOLNE;
}
function modulZKlucza(klucz, namespace) {
  const pierwszy = String(klucz).split('.')[0];
  if (KLUCZ_DO_MODULU.has(pierwszy)) return KLUCZ_DO_MODULU.get(pierwszy);
  if (MAPA_NAMESPACE[namespace]) return MAPA_NAMESPACE[namespace];
  return WSPOLNE;
}

function splaszcz(obiekt, prefiks = '', out = new Map()) {
  for (const [k, v] of Object.entries(obiekt)) {
    const klucz = prefiks ? `${prefiks}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) splaszcz(v, klucz, out);
    else if (Array.isArray(v)) v.forEach((el, i) => {
      if (typeof el === 'string') out.set(`${klucz}[${i}]`, el);
    });
    else if (typeof v === 'string') out.set(klucz, v);
  }
  return out;
}

/** i18next liczy mnogie inaczej w PL (_few/_many) niz w EN (_one/_other).
 *  Do porownania obecnosci klucza sprowadzamy wszystkie formy do bazy. */
const SUFIKSY_MNOGIE = /_(zero|one|two|few|many|other|plural)$/;
function bazaKlucza(klucz) {
  return klucz.replace(/\[\d+\]$/, '').replace(SUFIKSY_MNOGIE, '');
}

function kluczPominiety(klucz) {
  for (const r of pomijaneKlucze) if (r.test(klucz)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// zbieranie wyników
// ---------------------------------------------------------------------------
const KATEGORIE = {
  K1: 'PL w plikach EN (klucze tłumaczeń)',
  K1def: 'polski defaultValue w t() — widoczny w EN',
  K1defWID: '  z tego: brak klucza w EN -> EN WIDZI POLSKI NA STAŁE',
  K2: 'EN w plikach PL (klucze tłumaczeń)',
  K3a: 'klucz jest w PL, brak w EN (razem)',
  K3aKLUCZ: '  z tego: brak defaultu w kodzie -> EN widzi SUROWY KLUCZ',
  K3b: 'klucz jest w EN, brak w PL (fallback pokaże angielski)',
  K4pl: 'polski tekst na sztywno w JSX/TSX (poza t())',
  K4en: 'angielski tekst na sztywno w JSX/TSX (poza t())',
  K5pl: 'polskie zdania z serwera do UI',
  K5en: 'angielskie zdania z serwera do UI',
  K7: 'daty/liczby/waluty bez locale albo z locale na sztywno',
};

const wynik = {
  _meta: { data: new Date().toISOString(), root: ROOT },
  suma: Object.fromEntries(Object.keys(KATEGORIE).map((k) => [k, 0])),
  moduly: Object.fromEntries(
    MODULY.map((m) => [m, Object.fromEntries(Object.keys(KATEGORIE).map((k) => [k, 0]))]),
  ),
  przyklady: Object.fromEntries(Object.keys(KATEGORIE).map((k) => [k, []])),
  plikiTop: {},
};

function zapisz(kat, modul, lokalizacja, tresc, dowod) {
  wynik.suma[kat] += 1;
  if (!wynik.moduly[modul]) wynik.moduly[modul] = Object.fromEntries(Object.keys(KATEGORIE).map((k) => [k, 0]));
  wynik.moduly[modul][kat] += 1;
  // K3a jest sumą kontrolną nad K3aPL/K3aKLUCZ — nie liczymy jej podwójnie w rankingu plików
  if (kat !== 'K3a') {
    const plik = String(lokalizacja).split(':')[0];
    wynik.plikiTop[plik] = (wynik.plikiTop[plik] || 0) + 1;
  }
  wynik.przyklady[kat].push({
    modul,
    gdzie: lokalizacja,
    tekst: String(tresc).slice(0, 120),
    dowod: (dowod || []).slice(0, 3).join(','),
  });
}

// ---------------------------------------------------------------------------
// K1def — polskie wartości domyślne w wywołaniach t('klucz', 'Tekst')
// Buduje też mapę klucz -> defaultValue, potrzebną do rozbicia K3a.
// ---------------------------------------------------------------------------
/** @type {Map<string,{tekst:string,gdzie:string,modul:string}>} */
const DEFAULTY = new Map();
const WZ_T_DEFAULT =
  /\bt\(\s*(["'`])([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$[\]]+)+)\1\s*,\s*(["'])((?:[^"'\\]|\\.){3,200})\3/g;

function skanujDefaultyT() {
  const pliki = [
    ...listujPliki(path.join(ROOT, 'src'), (n) => /\.(ts|tsx)$/.test(n)),
  ];
  for (const rel of pliki) {
    const tresc = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (!tresc.includes('t(')) continue;
    const modul = modulZeSciezki(rel);
    WZ_T_DEFAULT.lastIndex = 0;
    let m;
    while ((m = WZ_T_DEFAULT.exec(tresc))) {
      const klucz = m[2];
      const tekst = m[4];
      const nrLinii = tresc.slice(0, m.index).split('\n').length;
      const gdzie = `${rel}:${nrLinii}`;
      if (!DEFAULTY.has(klucz)) DEFAULTY.set(klucz, { tekst, gdzie, modul });
      const pl = wykryjPolski(tekst);
      if (pl) zapisz('K1def', modul, gdzie, `${klucz} = "${tekst}"`, pl.dowod);
    }
  }
}

// ---------------------------------------------------------------------------
// K1 / K2 / K3 — pliki tłumaczeń
// ---------------------------------------------------------------------------
const KLUCZE_EN = new Set();

/** polskie defaulty, dla ktorych NIE MA klucza w EN -> widoczne na stale */
function skanujDefaultyWidoczne() {
  const bazyEnGlobal = new Set([...KLUCZE_EN].map(bazaKlucza));
  for (const [klucz, def] of DEFAULTY) {
    if (KLUCZE_EN.has(klucz) || bazyEnGlobal.has(bazaKlucza(klucz))) continue;
    const pl = wykryjPolski(def.tekst);
    if (pl) zapisz('K1defWID', def.modul, def.gdzie, `${klucz} = "${def.tekst}"`, ['brak klucza w EN', ...pl.dowod]);
  }
}

function skanujTlumaczenia() {
  const dirEn = path.join(ROOT, 'public/locales/en');
  const dirPl = path.join(ROOT, 'public/locales/pl');
  const namespaces = fs
    .readdirSync(dirEn)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));

  for (const ns of namespaces) {
    const fEn = path.join(dirEn, `${ns}.json`);
    const fPl = path.join(dirPl, `${ns}.json`);
    if (!fs.existsSync(fPl)) continue;
    const en = splaszcz(JSON.parse(fs.readFileSync(fEn, 'utf8')));
    for (const k of en.keys()) KLUCZE_EN.add(k);
    const pl = splaszcz(JSON.parse(fs.readFileSync(fPl, 'utf8')));
    const bazyEn = new Set([...en.keys()].map(bazaKlucza));
    const bazyPl = new Set([...pl.keys()].map(bazaKlucza));

    for (const [klucz, wartosc] of en) {
      if (kluczPominiety(klucz)) continue;
      const t = wykryjPolski(wartosc);
      if (t) zapisz('K1', modulZKlucza(klucz, ns), `public/locales/en/${ns}.json:${klucz}`, wartosc, t.dowod);
    }
    for (const [klucz, wartosc] of pl) {
      if (kluczPominiety(klucz)) continue;
      const t = wykryjAngielski(wartosc);
      if (t) zapisz('K2', modulZKlucza(klucz, ns), `public/locales/pl/${ns}.json:${klucz}`, wartosc, t.dowod);
    }
    for (const [klucz, wartosc] of pl) {
      if (kluczPominiety(klucz)) continue;
      if (en.has(klucz) || bazyEn.has(bazaKlucza(klucz))) continue;
      const modul = modulZKlucza(klucz, ns);
      const gdzie = `public/locales/pl/${ns}.json:${klucz}`;
      zapisz('K3a', modul, gdzie, wartosc, ['brak w en']);
      if (!DEFAULTY.has(bazaKlucza(klucz))) {
        zapisz('K3aKLUCZ', modul, gdzie, wartosc, ['brak w en', 'brak defaultu w kodzie']);
      }
    }
    for (const [klucz, wartosc] of en) {
      if (kluczPominiety(klucz)) continue;
      if (!pl.has(klucz) && !bazyPl.has(bazaKlucza(klucz))) zapisz('K3b', modulZKlucza(klucz, ns), `public/locales/en/${ns}.json:${klucz}`, wartosc, ['brak w pl']);
    }
  }
}

// ---------------------------------------------------------------------------
// K4 — teksty na sztywno w JSX/TSX
// ---------------------------------------------------------------------------
const ATRYBUTY_TEKSTOWE = /\b(placeholder|title|label|aria-label|ariaLabel|alt|tooltip|emptyText|helperText|subtitle|heading|confirmText|cancelText|okText|description)\s*=\s*(["'])([^"'{}]{3,160})\2/g;
const TEKST_JSX = />\s*([^<>{}\n][^<>{}]{2,160})\s*</g;

function skanujJsx() {
  const pliki = listujPliki(path.join(ROOT, 'src'), (n) => n.endsWith('.tsx'));
  for (const rel of pliki) {
    const tresc = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const linie = tresc.split('\n');
    const modul = modulZeSciezki(rel);
    const zapiszTekst = (offset, tekst) => {
      const nrLinii = tresc.slice(0, offset).split('\n').length;
      const linia = linie[nrLinii - 1] || '';
      // pomijamy to, co i tak jest w t(...) albo to komentarz / import
      if (/\bt\s*\(/.test(linia) && linia.indexOf(tekst.trim()) > linia.indexOf('t(')) return;
      if (/^\s*(\/\/|\*|\/\*|import |export \* )/.test(linia)) return;
      const pl = wykryjPolski(tekst);
      if (pl) { zapisz('K4pl', modul, `${rel}:${nrLinii}`, tekst.trim(), pl.dowod); return; }
      const en = wykryjAngielski(tekst);
      if (en) zapisz('K4en', modul, `${rel}:${nrLinii}`, tekst.trim(), en.dowod);
    };
    let m;
    ATRYBUTY_TEKSTOWE.lastIndex = 0;
    while ((m = ATRYBUTY_TEKSTOWE.exec(tresc))) zapiszTekst(m.index, m[3]);
    TEKST_JSX.lastIndex = 0;
    while ((m = TEKST_JSX.exec(tresc))) {
      const kandydat = m[1].trim();
      if (!/[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]{3,}/.test(kandydat)) continue;
      if (/^[A-Za-z]+\s*=/.test(kandydat)) continue; // fragment atrybutu
      // odsiew kodu zlapanego przez generyki TS: `useState<Foo>(null); ... useState<`
      if (/;|=>|\bconst\b|\blet\b|\breturn\b|\bfunction\b|useState|useRef|useMemo|&&|\|\||\?\?|===|!==/.test(kandydat)) continue;
      zapiszTekst(m.index, kandydat);
    }
  }
}

// ---------------------------------------------------------------------------
// K5 — komunikaty serwera trafiające do UI
// ---------------------------------------------------------------------------
const WZORCE_SERWERA = [
  /\berror\s*:\s*(["'`])([^"'`]{4,200})\1/g,
  /\bmessage\s*:\s*(["'`])([^"'`]{4,200})\1/g,
  /throw new (?:Error|HttpError|ApiError|ValidationError)\(\s*(["'`])([^"'`]{4,200})\1/g,
  /\.(?:min|max|regex|email|url|length|nonempty)\([^,)]*,\s*(["'`])([^"'`]{4,200})\1/g,
  /required_error\s*:\s*(["'`])([^"'`]{4,200})\1/g,
];

/** nazwa pliku po stronie serwera -> moduł menu (heurystyka po słowie w nazwie) */
const MAPA_SERWERA = [
  [/(chat|conversation|kimi)/i, '01 Chat'],
  [/(my-?work|vault|inbox|approval|form-?builder)/i, '02 My Work'],
  [/(interview|survey|respondent)/i, '03 Interview'],
  [/(discovery|tool|canvas|mindmap|notebook|process-?flow|idea|megatrend|knowledge|playbook|template)/i, '04 Tools'],
  [/(assessment|maturity|capability|competency)/i, '05 Assessment'],
  [/(initiative|portfolio|roadmap|business-?case|decision)/i, '06 Initiatives'],
  [/(execution|task|project|pmo|stakeholder|change)/i, '07 Execution'],
  [/(benefit|kpi|okr|result|outcome)/i, '08 Results'],
  [/(econom|financ|billing|pricing|valuation|invoice|subscription)/i, '09 Finance'],
  [/(document|presentation|deck|sheet|table-platform|tabele|excel|report|material|artifact|output)/i, '10 Materials'],
  [/(audit|drd|traceab)/i, '11 Audits'],
  [/(meeting|booking|schedule)/i, '12 Meeting'],
  [/(organization|org-|team|member|relation)/i, '13 Organization'],
  [/(admin|superadmin|impersonat|governance|model-registry|scim|sso|platform)/i, '14 Admin Panel'],
  [/(setting|profile|notification|onboard|security|mfa|auth|help|feedback)/i, '15 Settings'],
  [/(partner|subscriber|trial|affiliate)/i, '16 Partner Portal'],
];
function modulSerwera(rel) {
  const nazwa = rel.split('/').slice(-2).join('/');
  for (const [re, modul] of MAPA_SERWERA) if (re.test(nazwa)) return modul;
  return WSPOLNE;
}

function skanujSerwer() {
  // Świadome zawężenie: tylko powierzchnie, których treść realnie wychodzi
  // odpowiedzią HTTP do przeglądarki. `services/` i `repositories/` rzucają
  // setki błędów wewnętrznych, które bywają łapane i nigdy nie widoczne —
  // liczenie ich zawyżałoby pomiar.
  const katalogi = ['routes', 'middleware', 'validators', 'schemas', 'controllers'];
  const pliki = katalogi.flatMap((k) =>
    listujPliki(path.join(ROOT, 'server/src', k), (n) => n.endsWith('.ts')),
  );
  for (const rel of pliki) {
    const tresc = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const modul = modulSerwera(rel);
    for (const wz of WZORCE_SERWERA) {
      wz.lastIndex = 0;
      let m;
      while ((m = wz.exec(tresc))) {
        const tekst = m[2];
        if (/^[A-Z0-9_.:-]+$/.test(tekst)) continue; // to już kod błędu, nie zdanie
        const nrLinii = tresc.slice(0, m.index).split('\n').length;
        const pl = wykryjPolski(tekst);
        if (pl) { zapisz('K5pl', modul, `${rel}:${nrLinii}`, tekst, pl.dowod); continue; }
        const en = wykryjAngielski(tekst);
        if (en) zapisz('K5en', modul, `${rel}:${nrLinii}`, tekst, en.dowod);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// K7 — daty/liczby/waluty
// ---------------------------------------------------------------------------
const WZORCE_DATY = [
  [/toLocaleDateString\(\s*\)/g, 'toLocaleDateString() bez locale'],
  [/toLocaleTimeString\(\s*\)/g, 'toLocaleTimeString() bez locale'],
  [/toLocaleString\(\s*\)/g, 'toLocaleString() bez locale'],
  [/toLocale(?:Date|Time)?String\(\s*(["'])(en-US|en-GB|pl-PL|de-DE)\1/g, 'locale przybity na sztywno'],
  [/new Intl\.(?:DateTimeFormat|NumberFormat)\(\s*\)/g, 'Intl bez locale'],
  [/new Intl\.(?:DateTimeFormat|NumberFormat)\(\s*(["'])(en-US|en-GB|pl-PL|de-DE)\1/g, 'Intl z locale na sztywno'],
];

function skanujDaty() {
  const pliki = [
    ...listujPliki(path.join(ROOT, 'src'), (n) => /\.(ts|tsx)$/.test(n)),
    ...listujPliki(path.join(ROOT, 'server/src'), (n) => /\.(ts|tsx)$/.test(n)),
  ];
  for (const rel of pliki) {
    const tresc = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const modul = rel.startsWith('src/') ? modulZeSciezki(rel) : WSPOLNE;
    for (const [wz, opis] of WZORCE_DATY) {
      wz.lastIndex = 0;
      let m;
      while ((m = wz.exec(tresc))) {
        const nrLinii = tresc.slice(0, m.index).split('\n').length;
        zapisz('K7', modul, `${rel}:${nrLinii}`, m[0], [opis]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// raport
// ---------------------------------------------------------------------------
const POD_KATEGORIE = new Set(['K1defWID', 'K3aKLUCZ']); // zawarte w K3a — poza sumą RAZEM

function raportTekstowy(limitPrzykladow, filtrModul, filtrKategoria) {
  const kolumny = Object.keys(KATEGORIE);
  const doSumy = kolumny.filter((k) => !POD_KATEGORIE.has(k));
  const linie = [];
  linie.push('POMIAR SPÓJNOŚCI JĘZYKOWEJ — ' + new Date().toISOString().slice(0, 19).replace('T', ' '));
  linie.push('');
  linie.push('LEGENDA KATEGORII');
  for (const [k, v] of Object.entries(KATEGORIE)) linie.push(`  ${k.padEnd(5)} ${v}`);
  linie.push('');
  linie.push('TABELA: MODUŁ × KATEGORIA');
  const szer = 20;
  linie.push('(K1defWID ⊂ K1def, K3aKLUCZ ⊂ K3a — wiersze rozbicia nie wchodzą do kolumny RAZEM)');
  linie.push('| ' + 'Moduł'.padEnd(szer) + ' | ' + kolumny.map((k) => k.padStart(6)).join(' | ') + ' | RAZEM |');
  linie.push('|' + '-'.repeat(szer + 2) + '|' + kolumny.map(() => '-------|').join('') + '-------|');
  for (const m of MODULY) {
    if (filtrModul && !m.toLowerCase().includes(filtrModul.toLowerCase())) continue;
    const w = wynik.moduly[m];
    const razem = doSumy.reduce((s, k) => s + w[k], 0);
    linie.push('| ' + m.padEnd(szer) + ' | ' + kolumny.map((k) => String(w[k]).padStart(6)).join(' | ') + ' | ' + String(razem).padStart(5) + ' |');
  }
  const razemWszystko = doSumy.reduce((s, k) => s + wynik.suma[k], 0);
  linie.push('| ' + 'RAZEM'.padEnd(szer) + ' | ' + kolumny.map((k) => String(wynik.suma[k]).padStart(6)).join(' | ') + ' | ' + String(razemWszystko).padStart(5) + ' |');
  linie.push('');
  linie.push('TOP 10 NAJGORSZYCH PLIKÓW');
  const top = Object.entries(wynik.plikiTop).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [plik, n] of top) linie.push(`  ${String(n).padStart(5)}  ${plik}`);
  linie.push('');
  linie.push('PRZYKŁADY');
  for (const k of kolumny) {
    if (filtrKategoria && k !== filtrKategoria) continue;
    linie.push(`  [${k}] ${KATEGORIE[k]} — ${wynik.suma[k]}`);
    for (const p of wynik.przyklady[k].slice(0, limitPrzykladow)) {
      linie.push(`      ${p.gdzie}`);
      linie.push(`        „${p.tekst}"  (${p.dowod})`);
    }
  }
  return linie.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
function arg(nazwa, domyslna = null) {
  const i = argv.indexOf(nazwa);
  return i >= 0 ? argv[i + 1] : domyslna;
}
const chceJson = argv.includes('--json');
const baseline = arg('--baseline');
const limitPrzykladow = Number(arg('--przyklady', '3'));
const filtrModul = arg('--modul');
const filtrKategoria = arg('--kategoria');

skanujDefaultyT();
skanujTlumaczenia();
skanujDefaultyWidoczne();
skanujJsx();
skanujSerwer();
skanujDaty();

// przykłady przycinamy do 25 na kategorię w JSON, żeby plik bramki był mały
for (const k of Object.keys(wynik.przyklady)) wynik.przyklady[k] = wynik.przyklady[k].slice(0, 25);
wynik.plikiTop = Object.fromEntries(Object.entries(wynik.plikiTop).sort((a, b) => b[1] - a[1]).slice(0, 30));

if (baseline) {
  if (!fs.existsSync(baseline)) {
    console.error(`BRAK PLIKU BAZOWEGO: ${baseline}. Wygeneruj: node scripts/i18n/pomiar-jezyka.mjs --json > ${baseline}`);
    process.exit(2);
  }
  const bazowy = JSON.parse(fs.readFileSync(baseline, 'utf8'));
  const wzrosty = [];
  for (const k of Object.keys(KATEGORIE)) {
    const przed = bazowy.suma?.[k] ?? 0;
    const teraz = wynik.suma[k];
    if (teraz > przed) wzrosty.push(`${k}: ${przed} -> ${teraz} (+${teraz - przed})`);
  }
  if (wzrosty.length) {
    console.error('BRAMKA JĘZYKOWA — LICZBA OBCOJĘZYCZNYCH MIEJSC WZROSŁA:');
    for (const w of wzrosty) console.error('  ' + w);
    console.error('Napraw albo zaktualizuj baseline świadomie (tylko przy spadku).');
    process.exit(1);
  }
  const spadki = Object.keys(KATEGORIE)
    .map((k) => [k, (bazowy.suma?.[k] ?? 0) - wynik.suma[k]])
    .filter(([, d]) => d > 0);
  console.log('BRAMKA JĘZYKOWA: OK (nic nie wzrosło).' + (spadki.length ? ' Spadki: ' + spadki.map(([k, d]) => `${k} -${d}`).join(', ') : ''));
  process.exit(0);
}

if (chceJson) console.log(JSON.stringify(wynik, null, 2));
else console.log(raportTekstowy(limitPrzykladow, filtrModul, filtrKategoria));
