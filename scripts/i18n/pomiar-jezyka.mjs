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
 *   node scripts/i18n/pomiar-jezyka.mjs --baseline <plik>  # RATCHET pełny skan: kod 1 gdy
 *                                                          # rośnie SUMA albo KTÓRYKOLWIEK moduł
 *   node scripts/i18n/pomiar-jezyka.mjs --baseline <plik> --staged   # RATCHET szybki (pre-commit):
 *                                                          # liczy tylko pliki dotknięte w indeksie
 *                                                          # gita (git diff --cached), deltę dodaje
 *                                                          # do baseline. Spada na --baseline pełny,
 *                                                          # gdy commit dotyka public/locales/**.json
 *                                                          # (K1/K2/K3a/K3b zależą od całego pliku).
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
import os from 'node:os';
import url from 'node:url';
import { execFileSync } from 'node:child_process';

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

/**
 * E2f-bis (DEC-461/DEC-510) — ROZSZERZONE wykrywanie angielskiego.
 *
 * POWÓD, zmierzony: `wykryjAngielski()` opierał się WYŁĄCZNIE na słowniku
 * (44 „silne" + 56 „słabych"). Sonda z fali E2b-Exec na realnych napisach
 * modułu Realizacja: „Team Member", „Diagnosis", „Overallocated",
 * „Missing dates", „Execution Workbench" — ZERO trafień. Dlatego wiersz
 * „07 Execution" pokazywał K4en = 0 przy ~200 realnych kandydatach na ekranie.
 * To był artefakt przyrządu, nie czystość modułu.
 *
 * Nowe sygnały (precyzja przed czułością — słaby sygnał sam nie wystarcza):
 *   SILNY  — słowo ze słownika ALBO końcówka nieobecna w polszczyźnie
 *            (-tion/-sion/-ness/-ship/-ally/-ility/-ivity/-ated/-ating/-ing/-sis)
 *   SŁABY  — słowo ze słownika słabego, końcówka dwuznaczna
 *            (-ed/-ers/-ive/-ous/-ful/-less/-able/-ity/-ance/-ment), albo
 *            fraza Title Case; potrzeba DWÓCH różnych sygnałów słabych.
 *
 * `sufiksyWyjatki` to zapora na zapożyczenia, które w polskim UI są polskie:
 * „monitoring", „dokument", „element", „moment", „segment" — bez niej polski
 * ekran zostałby policzony jako angielski.
 */
const SUF_EN_SILNE = (WYJATKI.angielskieSufiksySilne || []).map((w) => ({
  re: new RegExp(w.wzorzec),
  min: w.minDlugosc || 0,
}));
const SUF_EN_SLABE = (WYJATKI.angielskieSufiksySlabe || []).map((w) => ({
  re: new RegExp(w.wzorzec),
  min: w.minDlugosc || 0,
}));
const sufiksyWyjatki = new Set((WYJATKI.sufiksyWyjatki || []).map((s) => s.toLowerCase()));

/**
 * Końcówki fleksyjne, których angielszczyzna NIE MA. Jedno takie słowo znaczy,
 * że zdanie jest po polsku — nawet jeśli zawiera zapożyczenie.
 *
 * POWÓD, zmierzony: po samym rozszerzeniu słownika angielskiego K2 („EN
 * w plikach PL") skoczyło 4 -> 123. Próbka pokazała, że to NIE są angielskie
 * napisy, tylko polskie zdania z żargonem: „Podsumowanie Gap Analysis",
 * „Eskalacja z preview — wymaga reakcji", „Spadek health score". Zapora
 * morfologiczna sprowadziła to z powrotem do realnych trafień.
 */
const SUF_PL = (WYJATKI.polskieSufiksy || []).map((w) => ({
  re: new RegExp(w.wzorzec),
  min: w.minDlugosc || 0,
}));
const sufiksyPlWyjatki = new Set((WYJATKI.polskieSufiksyWyjatki || []).map((s) => s.toLowerCase()));
function sufiksPolski(w) {
  if (sufiksyPlWyjatki.has(w)) return false;
  return SUF_PL.some((x) => w.length >= x.min && x.re.test(w));
}

function sufiksSilny(w) {
  if (sufiksyWyjatki.has(w)) return false;
  return SUF_EN_SILNE.some((x) => w.length >= x.min && x.re.test(w));
}
function sufiksSlaby(w) {
  if (sufiksyWyjatki.has(w)) return false;
  return SUF_EN_SLABE.some((x) => w.length >= x.min && x.re.test(w));
}

/** fraza Title Case: >=2 słowa ASCII, każde z wielkiej litery, zero polskich znaków */
const WZ_TITLE_CASE = /^(?:[A-Z][a-z]+|[A-Z]{2,5})(?:[ \t-]+(?:[A-Z][a-z]+|[A-Z]{2,5}|[a-z]{1,3}))+$/;
function frazaTitleCase(tekst) {
  const czysty = oczysc(tekst).trim().replace(/[.:,;!?]+$/, '');
  if (DIAKRYTYKI.test(czysty)) return false;
  return WZ_TITLE_CASE.test(czysty);
}

/**
 * Frazy wielowyrazowe uznane za nazwy własne — wycinane PRZED tokenizacją, bo
 * tokenizator dzieli po znakach niebędących literami i „what-if" rozpadłby się
 * na „what" + „if" (oba w słowniku angielskim).
 */
const frazyWlasne = (WYJATKI.nazwyWlasneFrazy || []).map(
  (f) => new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
);

/** usuwa to, co nie jest ludzkim tekstem: {{count}}, <tag>, URL, kod */
function oczysc(tekst) {
  let wynik = String(tekst);
  for (const f of frazyWlasne) wynik = wynik.replace(f, ' ');
  return wynik
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
    // Jednoliterowe tokeny są zbyt wieloznaczne: polskie spójniki `i`/`w`/`z`
    // kolidują z angielskim `I`, skrótami kolumn i zmiennymi we fragmentach
    // kodu. Nie mogą samodzielnie stanowić dowodu języka.
    if (l.length < 2) continue;
    if (nazwyWlasne.has(l)) continue;
    out.push(l);
  }
  return out;
}

/**
 * Słowa uprawnione do dowodu MORFOLOGICZNEGO (sufiksowego), a nie słownikowego.
 *
 * POWÓD, zmierzony: dowód z samej końcówki wywracał się na NAZWACH WŁASNYCH.
 * Na pliku `public/locales/en/translation.json` przyrząd zgłosił jako „polski
 * tekst w pliku EN": „Dr. Kowalski commented on ROI analysis", „Munich,
 * Germany", „Bartosz Sotomski", „Gate D: Overreach" — 10 z 12 trafień K1 było
 * fałszywych, bo `-ski`/`-ich`/`-ach` pasuje i do polskiej fleksji, i do
 * nazwiska czy angielskiego słowa.
 *
 * Reguła (precyzja przed czułością): końcówka liczy się tylko dla słowa
 * pisanego MAŁĄ literą albo stojącego na POCZĄTKU napisu. Wielka litera
 * w środku zdania to pozycja nazwy własnej, nie fleksji. „Prezentacja
 * wykonawcza" (pierwsze słowo) nadal liczy, „Dr. Kowalski" już nie.
 */
function slowaMorfo(tekst) {
  const out = [];
  let pierwsze = true;
  for (const w of oczysc(tekst).split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/)) {
    if (!w) continue;
    const l = w.toLowerCase();
    const naPoczatku = pierwsze;
    pierwsze = false;
    if (nazwyWlasne.has(l)) continue;
    if (!naPoczatku && w[0] !== l[0]) continue; // wielka litera w środku = nazwa własna
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
  // `sa` bywa polskim zapisem bez ogonka, ale w materiale EN jest również
  // skrótem spółki. Wymaga drugiego sygnału zamiast samodzielnie dowodzić PL.
  const silne = [...new Set(ws.filter((w) => plSilne.has(w) && w !== 'sa'))];
  const slabe = [...new Set(ws.filter((w) => plSlabe.has(w)))];
  const morfo = [...new Set(slowaMorfo(tekst).filter((w) => !plSilne.has(w) && sufiksPolski(w)))];
  if (silne.length) dowod.push(...silne.map((w) => `pl:${w}`));
  if (morfo.length) dowod.push(...morfo.slice(0, 2).map((w) => `pl-suf:${w}`));
  if (dowod.length === 0 && slabe.length >= 2) dowod.push(...slabe.slice(0, 2).map((w) => `pl?:${w}`));
  return dowod.length ? { jezyk: 'pl', dowod } : null;
}

function wykryjAngielski(tekst) {
  if (!wartoOceniac(tekst)) return null;
  const ws = slowa(tekst);
  // polskie diakrytyki albo silne polskie słowo => to jednak polski, nie flagujemy
  if (DIAKRYTYKI.test(oczysc(tekst))) return null;
  if (ws.some((w) => plSilne.has(w))) return null;
  if (ws.filter((w) => plSlabe.has(w)).length >= 2) return null;
  // fleksja polska => zdanie jest polskie, choćby niosło angielski żargon
  // UWAGA: tu świadomie NIE filtrujemy po wielkości liter (inaczej niż przy
  // dowodzie „to jest polskie"). Zapora ma być NAJCZULSZA, bo jej fałszywe
  // zadziałanie kosztuje jedno pominięcie, a jej brak — fałszywe oskarżenie
  // polskiego napisu o angielszczyznę („Plan Komunikacji", „Top Priorytety").
  if (ws.some((w) => sufiksPolski(w))) return null;

  const silneSlowa = [...new Set(ws.filter((w) => enSilne.has(w)))];
  const silneSuf = [...new Set(ws.filter((w) => !enSilne.has(w) && sufiksSilny(w)))];
  const dowod = [];
  if (silneSlowa.length) dowod.push(...silneSlowa.map((w) => `en:${w}`));
  if (silneSuf.length) dowod.push(...silneSuf.map((w) => `en-suf:${w}`));
  if (dowod.length) return { jezyk: 'en', dowod };

  // sygnały słabe — trzeba DWÓCH różnych
  const slabe = [];
  for (const w of [...new Set(ws)]) {
    if (enSlabe.has(w)) slabe.push(`en?:${w}`);
    else if (sufiksSlaby(w)) slabe.push(`en?suf:${w}`);
  }
  if (frazaTitleCase(tekst)) slabe.push('en?:TitleCase');
  if (slabe.length >= 2) return { jezyk: 'en', dowod: slabe.slice(0, 3) };
  return null;
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
  K4objPL: 'polski literał w WŁAŚCIWOŚCI obiektu UI (label/title/header/… kolumn, pigułek, menu)',
  K4obj: 'angielski literał w WŁAŚCIWOŚCI obiektu UI (label/title/header/… kolumn, pigułek, menu)',
  K5pl: 'polskie zdania z serwera do UI',
  K5en: 'angielskie zdania z serwera do UI',
  K7: 'daty/liczby/waluty bez locale albo z locale na sztywno',
  K8spl: 'PL w literalach serwera widocznych dla uzytkownika (poza routes/*, tj. services/jobs/email/PDF)',
  K8sen: 'EN proza w tych samych literalach, poza slownikami dwujezycznymi',
  K9pPL: 'prompt AI napisany po polsku (odpowiedz modelu pojdzie po polsku)',
  K9pMIX: 'prompt AI mieszany PL+EN w jednym literale',
  K9pBRAK: 'plik buduje system prompt, ale nie dopina withResolvedLocaleInstruction',
  K10dPL: 'method pack DRD: polski tekst w compileDrdPack(\'en\') (cel 0)',
  K10dROZ: 'method pack DRD: report.discrepancies (ujawnione rozjazdy metodyki)',
  K11: 't() zamknięte w literale — na ekran idzie surowe \"{t(...)}\" zamiast tłumaczenia',
};

function aktualnySha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const wynik = {
  _meta: { data: new Date().toISOString(), root: ROOT, sha: aktualnySha() },
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

function skanujDefaultyT(pliki) {
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

// --- wersje "czyste" (bez zapisu do globalnego `wynik`) — używane przez tryb
// szybki (--staged), który liczy tylko DELTĘ starej/nowej treści dotkniętych
// plików, bez chodzenia po całym repo. Ta sama logika regexów co wyżej,
// żeby tryb szybki i pełny skan nigdy się nie rozjechały.
function analizujDefaultyZawartosc(tresc, kluczeEnBazy) {
  const w = { K1def: 0, K1defWID: 0 };
  if (!tresc || !tresc.includes('t(')) return w;
  WZ_T_DEFAULT.lastIndex = 0;
  let m;
  while ((m = WZ_T_DEFAULT.exec(tresc))) {
    const klucz = m[2];
    const tekst = m[4];
    const pl = wykryjPolski(tekst);
    if (pl) {
      w.K1def += 1;
      if (kluczeEnBazy && !kluczeEnBazy.has(bazaKlucza(klucz))) w.K1defWID += 1;
    }
  }
  return w;
}

// ---------------------------------------------------------------------------
// K1 / K2 / K3 — pliki tłumaczeń
// ---------------------------------------------------------------------------
const KLUCZE_EN = new Set();

/** Jak KLUCZE_EN, ale bez chodzenia po całym repo — czyta tylko namespace'y
 *  public/locales/en/*.json (kilka małych plików + translation.json, żadnego
 *  katalogu src/server/src). Używane przez tryb szybki (--staged). */
function wczytajKluczeEnSzybko() {
  const dirEn = path.join(ROOT, 'public/locales/en');
  const zbior = new Set();
  for (const f of fs.readdirSync(dirEn).filter((n) => n.endsWith('.json'))) {
    const obj = JSON.parse(fs.readFileSync(path.join(dirEn, f), 'utf8'));
    for (const k of splaszcz(obj).keys()) zbior.add(bazaKlucza(k));
  }
  return zbior;
}

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

/**
 * Wycina TREŚĆ komentarzy blokowych (`/* … *\/`, w JSX `{/* … *\/}`), zostawiając
 * w ich miejscu spacje i znaki nowej linii — offsety i numery linii zostają bez zmian.
 *
 * POWÓD (paczka J-małe, 08.09): heurystyka „pomiń linię zaczynającą się od `*`"
 * łapie tylko PIERWSZĄ linię komentarza. Wielolinijkowy komentarz JSX, którego
 * kolejne wiersze nie zaczynają się od gwiazdki, wchodził do wyniku jako tekst
 * interfejsu — zmierzone na `OrganizationCardPrimitives.tsx:104`
 * („…here skipped a level everywhere it's used." liczone jako K4en). To był
 * defekt przyrządu, nie produktu: komentarz nigdy nie trafia na ekran.
 */
function bezKomentarzyBlokowych(tresc) {
  return tresc.replace(/\/\*[\s\S]*?\*\//g, (blok) => blok.replace(/[^\n]/g, ' '));
}

function skanujJsx(pliki) {
  for (const rel of pliki) {
    const tresc = bezKomentarzyBlokowych(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const linie = tresc.split('\n');
    const modul = modulZeSciezki(rel);
    const zapiszTekst = (offset, tekst) => {
      const nrLinii = tresc.slice(0, offset).split('\n').length;
      const linia = linie[nrLinii - 1] || '';
      // pomijamy to, co i tak jest w t(...) albo to komentarz / import
      if (/\bt\s*\(/.test(linia) && linia.indexOf(tekst.trim()) > linia.indexOf('t(')) return;
      if (/^\s*(\/\/|\*|\/\*|import |export \* )/.test(linia)) return;
      if (wartoscTechniczna(tekst)) return;
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
      // Fragment ternary JSX: `) : loading ? (`, `) : (`, `: null}` — regex tekstu
      // widzi to, co stoi między `>` i `<` sąsiednich znaczników, więc łapie sam
      // kod. Zmierzone 08.09: 4 fałszywe K4en w module 07 Realizacja
      // (BenefitsRegisterPanel, CutoverRunbookPanel, RolloutBaselinePanel,
      // RolloutStagesPanel — wszystkie na `) : loading ? (`) i 1 fałszywe K4pl
      // w module 06 (InitiativeDocumentView.tsx:10336, `) : (`).
      if (/^[)\]}]/.test(kandydat) || /\?\s*\($/.test(kandydat)) continue;
      // Rzutowanie TS złapane przez generyki: `r as unknown as Record<string, unknown>`
      // — regex tekstu JSX widzi fragment między `>` i `<` jako zdanie po angielsku.
      // Zmierzone 08.09 na ResultsKpiRegistryPage.tsx:1681 i bliźniaczym miejscu
      // w ResultsKpiScorecardDetailPage.tsx (dwa fałszywe K4en w module 08).
      if (/\bas\s+(unknown|const|never|any)\b|\bas\s+[A-Z]\w*(\[\])?$/.test(kandydat)) continue;
      zapiszTekst(m.index, kandydat);
    }
  }
}

function analizujJsxZawartosc(trescSurowa) {
  const w = { K4pl: 0, K4en: 0 };
  if (!trescSurowa) return w;
  // Ta sama zasada co w `skanujJsx` — inaczej tryb szybki (pre-commit) i tryb
  // pełny liczyłyby RÓŻNE liczby dla tego samego pliku.
  const tresc = bezKomentarzyBlokowych(trescSurowa);
  const linie = tresc.split('\n');
  const licz = (offset, tekst) => {
    const nrLinii = tresc.slice(0, offset).split('\n').length;
    const linia = linie[nrLinii - 1] || '';
    if (/\bt\s*\(/.test(linia) && linia.indexOf(tekst.trim()) > linia.indexOf('t(')) return;
    if (/^\s*(\/\/|\*|\/\*|import |export \* )/.test(linia)) return;
    if (wartoscTechniczna(tekst)) return;
    const pl = wykryjPolski(tekst);
    if (pl) { w.K4pl += 1; return; }
    const en = wykryjAngielski(tekst);
    if (en) w.K4en += 1;
  };
  let m;
  ATRYBUTY_TEKSTOWE.lastIndex = 0;
  while ((m = ATRYBUTY_TEKSTOWE.exec(tresc))) licz(m.index, m[3]);
  TEKST_JSX.lastIndex = 0;
  while ((m = TEKST_JSX.exec(tresc))) {
    const kandydat = m[1].trim();
    if (!/[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]{3,}/.test(kandydat)) continue;
    if (/^[A-Za-z]+\s*=/.test(kandydat)) continue;
    if (/;|=>|\bconst\b|\blet\b|\breturn\b|\bfunction\b|useState|useRef|useMemo|&&|\|\||\?\?|===|!==/.test(kandydat)) continue;
    licz(m.index, kandydat);
  }
  return w;
}

// ---------------------------------------------------------------------------
// K4obj / K4objPL — literały etykiet w OBIEKTACH, nie w JSX
//
// POWÓD, zmierzony (fala E2b-Exec, INWENTARZ §3): zrzut `bank-pl-light.png`
// pokazał 9 angielskich nagłówków kolumn i angielską plakietkę cyklu życia na
// koncie POLSKIM. Żaden z dwóch ówczesnych skanerów ich nie widział, bo to nie
// jest tekst JSX ani atrybut, tylko WŁAŚCIWOŚĆ OBIEKTU:
//     { id: 'lifecycle', label: 'Lifecycle', width: 120 }
// w tablicy definicji kolumn `StandardTable`. Skala zmierzona w samym module
// Realizacja: 123 takie literały w 13 plikach.
//
// Dokładnie siedem ujść wskazanych w W73 siedzi w
// `pomiar-jezyka.wyjatki.json` (`wlasciwosciUjsciaUI`). Każde rozszerzenie tej
// listy zmienia mianownik i wymaga osobnego pomiaru precyzji.
// Nazwy TECHNICZNE (id/key/value/type/status/href/path/icon/variant/...) są
// wykluczone twardo poniżej — to nie są napisy dla człowieka.
// ---------------------------------------------------------------------------
const WLASCIWOSCI_UI = (WYJATKI.wlasciwosciUjsciaUI || []).filter(
  (n) => !/^(id|key|value|type|status|name)$/.test(n) || n === 'name',
);
const WZ_WLASCIWOSC_UI = new RegExp(
  `(?:^|[\\{,\\s])(${WLASCIWOSCI_UI.join('|')})\\s*:\\s*(["'\`])((?:[^"'\`\\\\\\n]|\\\\.){3,160})\\2`,
  'g',
);
/** nazwy właściwości NIGDY nieuznawane za ujście UI (identyfikatory, enumy, ścieżki) */
const WLASCIWOSCI_TECHNICZNE = /^(id|key|value|type|status|slug|code|kind|variant|icon|color|path|route|href|url|to|testId|dataKey|field|accessor|sortKey|className|ns|namespace|i18nKey|locale|format|role|scope)$/;
/** wartość, która jest identyfikatorem/kluczem i18n/ścieżką — nie napisem dla człowieka */
function wartoscTechniczna(tekst) {
  const s = String(tekst).trim();
  if (/\r|\n/.test(String(tekst))) return true;                    // regex przeciął literał / tablicę JS
  if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/.test(s)) return true; // klucz i18n: 'execution.bank.title'
  if (/^[a-z0-9]+([-_][a-z0-9]+)+$/.test(s)) return true;           // kebab/snake: 'data-quality'
  if (/^[a-z][a-z0-9_-]*(?:\s*\|\s*[a-z][a-z0-9_-]*)+\.?$/.test(s)) return true; // unia enumów: 'public | authenticated'
  if (/^[@./#]/.test(s)) return true;                               // ścieżka, selektor, import
  if (/^[A-Za-z]+(?:\.[A-Za-z_$][\w$]*)*\s*\(/.test(s)) return true; // wywołanie / chain: Array.isArray(
  if (/^\([^)]*:\s*[A-Za-z_$][\w$<>,.[\] |?]*\)\s*(?::|=>)/.test(s)) return true; // sygnatura TS
  if (/^[A-Za-z_$][\w$]*\)\s*:\s*[A-Za-z_$][\w$<>,.[\] |?]*$/.test(s)) return true; // ogon sygnatury po generyku `>`
  if (/^!?\([A-Za-z_$][\w$.?]*$/.test(s)) return true;              // początek wyrażenia przeciętego operatorem `<`
  if (/=>|===|!==|==|\b(?:const|let|var|return|reduce|map|filter)\b|\?\s*[A-Za-z_$]/.test(s)) return true;
  if (/^[A-Za-z_$][\w$.?]*(?:\s*[+*/-]\s*[A-Za-z_$][\w$.?]*)?\)+$/.test(s)) return true; // ogon wyrażenia po `=>`
  if (/^[\[\]{}(),.;]+$/.test(s)) return true;
  return false;
}

function analizujLiteralyObiektowZawartosc(trescSurowa) {
  const w = { K4obj: 0, K4objPL: 0, trafienia: [] };
  if (!trescSurowa) return w;
  const tresc = bezKomentarzyBlokowych(trescSurowa);
  const linie = tresc.split('\n');
  WZ_WLASCIWOSC_UI.lastIndex = 0;
  let m;
  while ((m = WZ_WLASCIWOSC_UI.exec(tresc))) {
    const wlasciwosc = m[1];
    const tekst = m[3];
    if (WLASCIWOSCI_TECHNICZNE.test(wlasciwosc)) continue;
    if (wartoscTechniczna(tekst)) continue;
    const nrLinii = tresc.slice(0, m.index).split('\n').length;
    const linia = linie[nrLinii - 1] || '';
    if (/^\s*(\/\/|\*|\/\*|import |export \* )/.test(linia)) continue;
    // `label: t('klucz', 'Tekst')` — to już przechodzi przez t(), liczy K1def
    if (/\bt\s*\(/.test(linia) && linia.indexOf(tekst) > linia.indexOf('t(')) continue;
    const pl = wykryjPolski(tekst);
    if (pl) { w.K4objPL += 1; w.trafienia.push(['K4objPL', nrLinii, `${wlasciwosc}: ${tekst}`, pl.dowod]); continue; }
    const en = wykryjAngielski(tekst);
    if (en) { w.K4obj += 1; w.trafienia.push(['K4obj', nrLinii, `${wlasciwosc}: ${tekst}`, en.dowod]); }
  }
  return w;
}

function skanujLiteralyObiektow(pliki) {
  for (const rel of pliki) {
    const w = analizujLiteralyObiektowZawartosc(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const modul = modulZeSciezki(rel);
    for (const [kat, nrLinii, tekst, dowod] of w.trafienia) {
      zapisz(kat, modul, `${rel}:${nrLinii}`, tekst, dowod);
    }
  }
}

// ---------------------------------------------------------------------------
// K11 — t() zamknięte w literale
//
// `placeholder="{t('aios.research.scope', 'Scope and constraints')}"` NIE jest
// wywołaniem — to napis. Użytkownik widzi na ekranie dosłownie klamrę z kodem.
// Ratchet: stan bazy (patrz baseline.json), cel 0.
// ---------------------------------------------------------------------------
const WZ_T_W_LITERALE = /(["'`])\{\s*t\s*\(/g;

function analizujTwLiteraleZawartosc(trescSurowa) {
  const w = { K11: 0, trafienia: [] };
  if (!trescSurowa) return w;
  const tresc = bezKomentarzyBlokowych(trescSurowa);
  WZ_T_W_LITERALE.lastIndex = 0;
  let m;
  while ((m = WZ_T_W_LITERALE.exec(tresc))) {
    const nrLinii = tresc.slice(0, m.index).split('\n').length;
    const linia = (tresc.split('\n')[nrLinii - 1] || '').trim();
    if (/^(\/\/|\*|\/\*)/.test(linia)) continue;
    w.K11 += 1;
    w.trafienia.push(['K11', nrLinii, linia.slice(0, 160), ['t-w-literale']]);
  }
  return w;
}

function skanujTwLiterale(pliki) {
  for (const rel of pliki) {
    const w = analizujTwLiteraleZawartosc(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const modul = rel.startsWith('server/') ? modulSerwera(rel) : modulZeSciezki(rel);
    for (const [kat, nrLinii, tekst, dowod] of w.trafienia) {
      zapisz(kat, modul, `${rel}:${nrLinii}`, tekst, dowod);
    }
  }
}

// ---------------------------------------------------------------------------
// K5 — komunikaty serwera trafiające do UI
// ---------------------------------------------------------------------------
const WZORCE_SERWERA = [
  /\berror\s*:\s*(["'`])([^"'`\r\n]{4,200})\1/g,
  /\bmessage\s*:\s*(["'`])([^"'`\r\n]{4,200})\1/g,
  /throw new (?:Error|HttpError|ApiError|ValidationError)\(\s*(["'`])([^"'`\r\n]{4,200})\1/g,
  /\.(?:min|max|regex|email|url|length|nonempty)\([^,)]*,\s*(["'`])([^"'`\r\n]{4,200})\1/g,
  /required_error\s*:\s*(["'`])([^"'`\r\n]{4,200})\1/g,
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

/** katalogi serwera, których treść realnie wychodzi odpowiedzią HTTP do
 *  przeglądarki. `services/` i `repositories/` rzucają setki błędów
 *  wewnętrznych, które bywają łapane i nigdy nie widoczne — liczenie ich
 *  zawyżałoby pomiar. Współdzielone przez pełny skan i tryb szybki. */
const KATALOGI_SERWERA = ['routes', 'middleware', 'validators', 'schemas', 'controllers'];
function jestKodemSerwerowymUI(rel) {
  return new RegExp(`^server/src/(${KATALOGI_SERWERA.join('|')})/`).test(rel);
}

function skanujSerwer(pliki) {
  for (const rel of pliki) {
    const tresc = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const modul = modulSerwera(rel);
    for (const wz of WZORCE_SERWERA) {
      wz.lastIndex = 0;
      let m;
      while ((m = wz.exec(tresc))) {
        const tekst = m[2];
        if (wartoscTechniczna(tekst)) continue;
        const nrLinii = tresc.slice(0, m.index).split('\n').length;
        const pl = wykryjPolski(tekst);
        if (pl) { zapisz('K5pl', modul, `${rel}:${nrLinii}`, tekst, pl.dowod); continue; }
        const en = wykryjAngielski(tekst);
        if (en) zapisz('K5en', modul, `${rel}:${nrLinii}`, tekst, en.dowod);
      }
    }
  }
}

function analizujSerwerZawartosc(tresc) {
  const w = { K5pl: 0, K5en: 0 };
  if (!tresc) return w;
  for (const wz of WZORCE_SERWERA) {
    wz.lastIndex = 0;
    let m;
    while ((m = wz.exec(tresc))) {
      const tekst = m[2];
      if (wartoscTechniczna(tekst)) continue;
      const pl = wykryjPolski(tekst);
      if (pl) { w.K5pl += 1; continue; }
      const en = wykryjAngielski(tekst);
      if (en) w.K5en += 1;
    }
  }
  return w;
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

/**
 * Wycina treść komentarzy — blokowych i liniowych — zostawiając białe znaki.
 *
 * POWÓD (J-małe): `KpiToolPage.tsx:1224` opisuje w komentarzu defekt
 * („`undefined.toLocaleString()` wywraca kartę"), a skaner liczył ten opis
 * jako realne wywołanie bez locale. Komentarz nie renderuje daty.
 */
function bezKomentarzy(tresc) {
  return bezKomentarzyBlokowych(tresc).replace(/\/\/[^\n]*/g, (l) => ' '.repeat(l.length));
}

function skanujDaty(pliki) {
  for (const rel of pliki) {
    const tresc = bezKomentarzy(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
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

function analizujDatyZawartosc(trescSurowa) {
  let n = 0;
  if (!trescSurowa) return { K7: 0 };
  // Ta sama zasada co w `skanujDaty` — tryb szybki i pełny muszą liczyć tak samo.
  const tresc = bezKomentarzy(trescSurowa);
  for (const [wz] of WZORCE_DATY) {
    wz.lastIndex = 0;
    while (wz.exec(tresc)) n += 1;
  }
  return { K7: n };
}

// ---------------------------------------------------------------------------
// K8s — literały serwera widoczne dla użytkownika POZA katalogami K5
//
// K5 mierzy WYŁĄCZNIE `server/src/{routes,middleware,validators,schemas,
// controllers}` — świadome zawężenie z 08.09. Fale E2c/E2c-bis/D4 (14.09)
// pokazały, że druga połowa bałaganu siedzi POZA tymi katalogami: w
// `services/` (maile, PDF, eksporty) i w `method-core/` (teksty Outputu).
// K8s liczy dokładnie tę resztę — rozłącznie z K5, więc nic nie jest liczone
// dwa razy.
//
// CZEGO NIE LICZYMY (i dlaczego):
//   * SŁOWNIKI DWUJĘZYCZNE — obiekt, w którym obok siebie stoją klucze `en:`
//     i `pl:`, jest MECHANIZMEM naprawy, nie długiem. Tak wygląda `MESSAGES`
//     w `services/report/reportLocale.ts` i `TEKSTY_OUTPUTU` w
//     `method-core/outputs/EventDerivedOutputBridge.ts`. Liczenie ich
//     nagradzałoby usunięcie tłumaczenia („bezpiecznik nagradza defekt").
//   * PLIKI POLITYKI JĘZYKA — `services/ai/languagePolicy.ts`,
//     `services/ai/responseLanguage.ts`, `services/report/reportLocale.ts`:
//     z definicji zawierają napisy w obu językach.
//   * testy, mocki, kopie zapasowe, `scripts/`.
// ---------------------------------------------------------------------------
const K8S_PLIKI_POLITYKI = [
  /^server\/src\/services\/ai\/languagePolicy\.ts$/,
  /^server\/src\/services\/ai\/responseLanguage\.ts$/,
  /^server\/src\/services\/report\/reportLocale\.ts$/,
];
const K8S_POMIJANE = [
  /(^|\/)__tests__\//,
  /(^|\/)__mocks__\//,
  /(^|\/)_backup\//,
  /\.(test|spec)\.ts$/,
  /^server\/src\/(scripts|testing)\//,
];

/** dodatkowe ujścia widoczne dla użytkownika: e-mail i PDF */
const WZORCE_SERWERA_K8S = [
  ...WZORCE_SERWERA,
  /\bsubject\s*:\s*(["'`])([^"'`\r\n]{6,200})\1/g,
  /\b(?:html|htmlBody|textBody|bodyText)\s*:\s*(["'`])([^"'`\r\n]{12,200})\1/g,
  /\.(?:drawText|addText|writeText)\(\s*(["'`])([^"'`\r\n]{6,200})\1/g,
];

/**
 * Zamazuje (spacjami, bez zmiany offsetów i numerów linii) treść obiektów,
 * w których obok siebie stoją klucze `en:` i `pl:` — czyli słowników
 * dwujęzycznych. Dopasowanie po nawiasach klamrowych, nie regexem „od do",
 * bo słowniki bywają zagnieżdżone na kilka poziomów.
 */
function bezSlownikowDwujezycznych(tresc) {
  const znaki = tresc.split('');
  const startDeklaracji = /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z0-9_$]+[^=\n]*=\s*\{/g;
  let m;
  startDeklaracji.lastIndex = 0;
  while ((m = startDeklaracji.exec(tresc))) {
    const otwarcie = tresc.indexOf('{', m.index);
    if (otwarcie < 0) continue;
    let glebokosc = 0;
    let koniec = -1;
    for (let i = otwarcie; i < tresc.length; i += 1) {
      const c = tresc[i];
      if (c === '{') glebokosc += 1;
      else if (c === '}') {
        glebokosc -= 1;
        if (glebokosc === 0) { koniec = i; break; }
      }
    }
    if (koniec < 0) continue;
    const cialo = tresc.slice(otwarcie, koniec + 1);
    if (/\ben\s*:/.test(cialo) && /\bpl\s*:/.test(cialo)) {
      for (let i = otwarcie; i <= koniec; i += 1) if (znaki[i] !== '\n') znaki[i] = ' ';
    }
    startDeklaracji.lastIndex = koniec;
  }
  return znaki.join('');
}

function jestKodemSerwerowymK8s(rel) {
  if (!/^server\/src\/.*\.ts$/.test(rel)) return false;
  if (jestKodemSerwerowymUI(rel)) return false; // to liczy K5
  for (const r of K8S_POMIJANE) if (r.test(rel)) return false;
  for (const r of K8S_PLIKI_POLITYKI) if (r.test(rel)) return false;
  return true;
}

function analizujSerwerK8sZawartosc(trescSurowa) {
  const w = { K8spl: 0, K8sen: 0, trafienia: [] };
  if (!trescSurowa) return w;
  const tresc = bezSlownikowDwujezycznych(bezKomentarzy(trescSurowa));
  for (const wz of WZORCE_SERWERA_K8S) {
    wz.lastIndex = 0;
    let m;
    while ((m = wz.exec(tresc))) {
      const tekst = m[2];
      if (wartoscTechniczna(tekst)) continue;
      const nrLinii = tresc.slice(0, m.index).split('\n').length;
      const pl = wykryjPolski(tekst);
      if (pl) { w.K8spl += 1; w.trafienia.push(['K8spl', nrLinii, tekst, pl.dowod]); continue; }
      const en = wykryjAngielski(tekst);
      if (en) { w.K8sen += 1; w.trafienia.push(['K8sen', nrLinii, tekst, en.dowod]); }
    }
  }
  return w;
}

function skanujSerwerK8s(pliki) {
  for (const rel of pliki) {
    if (!jestKodemSerwerowymK8s(rel)) continue;
    const w = analizujSerwerK8sZawartosc(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const modul = modulSerwera(rel);
    for (const [kat, nrLinii, tekst, dowod] of w.trafienia) {
      zapisz(kat, modul, `${rel}:${nrLinii}`, tekst, dowod);
    }
  }
}

// ---------------------------------------------------------------------------
// K9p — prompty AI
//
// Inwentarz Codexa (14.09, `AI_PROMPTS.tsv`: 282 wpisy w 59 plikach, 238 EN /
// 40 PL / 1 mieszany) leży POZA repo. Dowód poza repo wyparowuje, więc ten
// skaner liczy po SWOJEMU, z drzewa: literał promptowy = napis >= 60 znaków
// przypisany do zmiennej/klucza o nazwie promptowej, albo stojący w wywołaniu
// budującym prompt. Liczby nie muszą się zgadzać z TSV co do jednego — ważne,
// żeby liczył ZAWSZE tak samo, bo to jest ratchet, nie spis inwentarza.
//
// K9pBRAK to licznik PLIKÓW, nie literałów: plik, który sam składa prompt
// systemowy, a nie przepuszcza go przez `withResolvedLocaleInstruction`
// (SSOT DEC-510, `services/ai/languagePolicy.ts`), nie ma jak wymusić języka
// odpowiedzi — to jest dokładnie ten defekt, przez który Teresa odpowiadała
// po angielsku na polskie pytanie.
// ---------------------------------------------------------------------------
const K9P_KATALOGI = [/^server\/src\//, /^src\/services\//, /^src\/lib\//];
const K9P_POMIJANE = K8S_POMIJANE;
/** literał przypisany do nazwy promptowej: `const systemPrompt = \`...\`` / `system: '...'` */
const WZ_PROMPT_LITERAL =
  /(?:(?:const|let|var)\s+([A-Za-z0-9_$]*(?:[Pp]rompt|[Ii]nstruction|[Pp]ersona|[Ss]ystem)[A-Za-z0-9_$]*)\s*(?::[^=\n]+)?=|\b(system|systemPrompt|systemInstruction|prompt|instructions)\s*:)\s*(["'`])((?:[^\\]|\\[\s\S]){60,4000}?)\3/g;
/** plik „buduje system prompt" — składa go sam, a nie tylko przekazuje dalej */
const WZ_BUDUJE_SYSTEM_PROMPT = [
  /(?:const|let|var)\s+[A-Za-z0-9_$]*[Ss]ystem[A-Za-z0-9_$]*\s*(?::[^=\n]+)?=\s*["'`]/,
  /\b(?:system|systemPrompt|systemInstruction)\s*:\s*["'`]/,
  /function\s+build[A-Za-z0-9_$]*(?:System)?Prompt/,
];

function jestPlikiemPromptowym(rel) {
  if (!/\.(ts|tsx)$/.test(rel)) return false;
  for (const r of K9P_POMIJANE) if (r.test(rel)) return false;
  for (const r of K9P_KATALOGI) if (r.test(rel)) return true;
  return false;
}

function analizujPromptyZawartosc(trescSurowa) {
  const w = { K9pPL: 0, K9pMIX: 0, K9pBRAK: 0, trafienia: [] };
  if (!trescSurowa) return w;
  const tresc = bezKomentarzy(trescSurowa);
  WZ_PROMPT_LITERAL.lastIndex = 0;
  let m;
  while ((m = WZ_PROMPT_LITERAL.exec(tresc))) {
    const tekst = m[4];
    const nrLinii = tresc.slice(0, m.index).split('\n').length;
    const pl = wykryjPolski(tekst);
    const en = wykryjAngielski(tekst);
    // `wykryjAngielski` sam zwraca null, gdy widzi polskie znaki — mieszany
    // literał rozpoznajemy po tym, że POZA polskim dowodem stoi angielskie
    // zdanie (>= 2 silne angielskie słowa) w tym samym napisie.
    if (pl) {
      const enSilneWTekscie = [...new Set(slowa(tekst).filter((s) => enSilne.has(s)))];
      if (enSilneWTekscie.length >= 2) {
        w.K9pMIX += 1;
        w.trafienia.push(['K9pMIX', nrLinii, tekst, [...pl.dowod.slice(0, 2), ...enSilneWTekscie.slice(0, 2).map((s) => `en:${s}`)]]);
      } else {
        w.K9pPL += 1;
        w.trafienia.push(['K9pPL', nrLinii, tekst, pl.dowod]);
      }
      continue;
    }
    if (en) continue; // prompt po angielsku = stan docelowy, nie liczymy
  }
  const budujeSystem = WZ_BUDUJE_SYSTEM_PROMPT.some((r) => r.test(tresc));
  if (budujeSystem && !/withResolvedLocaleInstruction/.test(trescSurowa)) {
    w.K9pBRAK = 1;
    w.trafienia.push(['K9pBRAK', 1, 'buduje system prompt bez withResolvedLocaleInstruction', ['brak SSOT DEC-510']]);
  }
  return w;
}

function skanujPrompty(pliki) {
  for (const rel of pliki) {
    if (!jestPlikiemPromptowym(rel)) continue;
    const tresc = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (!/prompt|Prompt|system/.test(tresc)) continue;
    const w = analizujPromptyZawartosc(tresc);
    const modul = rel.startsWith('server/') ? modulSerwera(rel) : modulZeSciezki(rel);
    for (const [kat, nrLinii, tekst, dowod] of w.trafienia) {
      zapisz(kat, modul, `${rel}:${nrLinii}`, tekst, dowod);
    }
  }
}

// ---------------------------------------------------------------------------
// K10d — method pack DRD skompilowany po angielsku
//
// Po falach J1/J3 `compileDrdPack('en')` ma emitować wariant EN poziomu
// (`titleEN`/`descriptionEN`) i obszaru (`name`/`namePL`). Ten licznik pilnuje,
// żeby to nie odrosło: CEL = 0 polskich tekstów w paczce zbudowanej dla `en`.
//
// DOWÓD, ŻE PRZYRZĄD MIERZY (a nie zwraca zera, bo nie patrzy): ta sama
// funkcja licząca na `compileDrdPack('pl')` daje 1338 trafień — test
// `pomiar-jezyka.warstwy.test.mjs` trzyma tę mutację.
//
// `compileDrdPack` to TypeScript z aliasem `@/`, więc pomiar bundluje go
// esbuildem do pliku tymczasowego i importuje. Gdy bundlowanie się NIE uda,
// NIE wpisujemy zera (brak pomiaru nie jest wynikiem) — pomiar zgłasza błąd.
// ---------------------------------------------------------------------------
const K10D_ZRODLA = [
  /^src\/method-core\/methods\/drd\//,
  /^src\/services\/drdStructure\.ts$/,
  /^src\/services\/assessmentKnowledge/,
];
const K10D_MODUL = '05 Assessment';

function zbundlujDrd() {
  const wyjscie = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'pomiar-jezyka-drd-')),
    'compileDrdPack.mjs',
  );
  const esbuild = path.join(ROOT, 'node_modules', '.bin', 'esbuild');
  if (!fs.existsSync(esbuild)) throw new Error('brak node_modules/.bin/esbuild — nie da się zmierzyć K10d');
  execFileSync(
    esbuild,
    [
      'src/method-core/methods/drd/compileDrdPack.ts',
      '--bundle',
      '--format=esm',
      '--platform=node',
      `--outfile=${wyjscie}`,
      '--log-level=error',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return wyjscie;
}

/** Zbiera wszystkie teksty widoczne dla użytkownika z jednej skompilowanej paczki. */
export function tekstyPaczkiDrd(wynikKompilacji) {
  const out = [];
  const dodaj = (gdzie, tekst) => {
    if (typeof tekst === 'string' && tekst.trim()) out.push([gdzie, tekst]);
  };
  for (const u of wynikKompilacji.pack.units || []) {
    dodaj(`unit:${u.unitId}#name`, u.name);
    dodaj(`unit:${u.unitId}#description`, u.description);
  }
  for (const l of wynikKompilacji.pack.levels || []) {
    dodaj(`level:${l.unitId}#${l.level}#title`, l.title);
    dodaj(`level:${l.unitId}#${l.level}#canonicalDefinition`, l.canonicalDefinition);
    (l.expectedEvidence || []).forEach((e, i) => dodaj(`level:${l.unitId}#${l.level}#expectedEvidence[${i}]`, e));
    (l.technologyExamples || []).forEach((e, i) => dodaj(`level:${l.unitId}#${l.level}#technologyExamples[${i}]`, e));
  }
  for (const q of wynikKompilacji.pack.questions || []) {
    dodaj(`question:${q.questionId}#canonicalWording`, q.canonicalWording);
    (q.expectedEvidence || []).forEach((e, i) => dodaj(`question:${q.questionId}#expectedEvidence[${i}]`, e));
  }
  return out;
}

/** @returns {{K10dPL:number, K10dROZ:number, trafienia:Array}} */
export function policzDrd(wynikKompilacji) {
  const w = { K10dPL: 0, K10dROZ: 0, trafienia: [] };
  for (const [gdzie, tekst] of tekstyPaczkiDrd(wynikKompilacji)) {
    const pl = wykryjPolski(tekst);
    if (pl) {
      w.K10dPL += 1;
      w.trafienia.push(['K10dPL', gdzie, tekst, pl.dowod]);
    }
  }
  const rozjazdy = wynikKompilacji.report?.discrepancies || [];
  w.K10dROZ = rozjazdy.length;
  rozjazdy.forEach((r, i) => w.trafienia.push(['K10dROZ', `report.discrepancies[${i}]`, r, ['ujawniony rozjazd metodyki']]));
  return w;
}

async function skanujDrd() {
  const bundle = zbundlujDrd();
  const modul = await import(url.pathToFileURL(bundle).href);
  const w = policzDrd(modul.compileDrdPack('en'));
  for (const [kat, gdzie, tekst, dowod] of w.trafienia) {
    zapisz(kat, K10D_MODUL, `drd:en:${gdzie}`, tekst, dowod);
  }
  try {
    fs.rmSync(path.dirname(bundle), { recursive: true, force: true });
  } catch {
    /* plik tymczasowy — sprzątanie nie może wywrócić pomiaru */
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
    // filtr modulu obowiazuje TAKZE przyklady — inaczej `--modul X` pokazuje
    // tabele dla X, a przyklady z calego repo (pulapka przyrzadu: robotnik
    // naprawia nie swoj modul).
    const przykladyK = filtrModul
      ? wynik.przyklady[k].filter((p) => String(p.modul || '').toLowerCase().includes(filtrModul.toLowerCase()))
      : wynik.przyklady[k];
    linie.push(`  [${k}] ${KATEGORIE[k]} — ${filtrModul ? przykladyK.length + ' (w module; suma repo ' + wynik.suma[k] + ')' : wynik.suma[k]}`);
    for (const p of przykladyK.slice(0, limitPrzykladow)) {
      linie.push(`      ${p.gdzie}`);
      linie.push(`        „${p.tekst}"  (${p.dowod})`);
    }
  }
  return linie.join('\n');
}

/**
 * `--report <plik>` — PEŁNA lista `plik:linia` per kategoria (bez przycinania
 * do 25 przykładów, którym karmiony jest baseline). To jest robocza lista dla
 * człowieka, który ma dług spłacić, nie dowód bramki.
 */
function zapiszRaportPlikLinia(sciezka) {
  const linie = [];
  linie.push(`POMIAR JĘZYKA — LISTA PLIK:LINIA — ${new Date().toISOString()}`);
  linie.push(`sha=${wynik._meta.sha || '?'}`);
  linie.push('');
  for (const [kat, opis] of Object.entries(KATEGORIE)) {
    linie.push(`### ${kat} — ${opis} — ${wynik.suma[kat]}`);
    for (const p of wynik.przyklady[kat]) {
      linie.push(`${p.gdzie}\t${p.modul}\t${p.tekst.replace(/\s+/g, ' ')}\t${p.dowod}`);
    }
    linie.push('');
  }
  fs.mkdirSync(path.dirname(path.resolve(ROOT, sciezka)), { recursive: true });
  fs.writeFileSync(path.resolve(ROOT, sciezka), linie.join('\n'), 'utf8');
  console.log(`RAPORT PLIK:LINIA -> ${sciezka} (${Object.values(wynik.przyklady).reduce((a, b) => a + b.length, 0)} pozycji)`);
}

// ---------------------------------------------------------------------------
// bramka (RATCHET) — wspólne porównanie z baseline, per SUMA i per MODUŁ.
// Per-moduł jest tu, bo bramka global-only chowa regresję jednego modułu za
// niezwiązaną poprawą gdzieś indziej (dokładnie klasa błędu K-41 opisana w
// scripts/check-focus-canon.sh — "bezpiecznik nagradza defekt").
// ---------------------------------------------------------------------------
function porownajZBaseline(bazowy, sumaAktualna, modulyAktualne) {
  const wzrosty = [];
  for (const k of Object.keys(KATEGORIE)) {
    const przed = bazowy.suma?.[k] ?? 0;
    const teraz = sumaAktualna[k] ?? 0;
    if (teraz > przed) wzrosty.push(`SUMA ${k}: ${przed} -> ${teraz} (+${teraz - przed})`);
  }
  const wszystkieModuly = new Set([
    ...Object.keys(bazowy.moduly || {}),
    ...Object.keys(modulyAktualne || {}),
  ]);
  for (const modul of wszystkieModuly) {
    for (const k of Object.keys(KATEGORIE)) {
      const przed = bazowy.moduly?.[modul]?.[k] ?? 0;
      const teraz = modulyAktualne?.[modul]?.[k] ?? 0;
      if (teraz > przed) wzrosty.push(`${modul} / ${k}: ${przed} -> ${teraz} (+${teraz - przed})`);
    }
  }
  return wzrosty;
}

function raportujWzrosty(wzrosty) {
  console.error('BRAMKA JĘZYKOWA — LICZBA OBCOJĘZYCZNYCH MIEJSC WZROSŁA:');
  for (const w of wzrosty) console.error('  ' + w);
  console.error('Napraw albo zaktualizuj baseline świadomie (tylko przy spadku).');
}

// ---------------------------------------------------------------------------
// tryb szybki (--staged) — dla pre-commit. Zamiast chodzić po całym repo
// (pełny skan: ~7-8s, za wolno na commit), liczy DELTĘ starej (git show
// HEAD:<plik>) i nowej (working tree) treści WYŁĄCZNIE dla plików dotkniętych
// w indeksie gita, i dokłada tę deltę do baseline. To jest MATEMATYCZNIE
// dokładne (nie przybliżenie) dla kategorii K1def/K1defWID/K4pl/K4en/K5pl/
// K5en/K7, bo każde trafienie tych kategorii siedzi w JEDNYM pliku — jeśli
// baseline.json trafnie opisuje stan HEAD, a zmienia się tylko treść
// dotkniętych plików, to (baseline + delta dotkniętych plików) == wynik
// pełnego skanu, bez potrzeby go uruchamiać.
//
// K1/K2/K3a/K3aKLUCZ/K3b zależą od CAŁEJ zawartości public/locales/{en,pl}
// (klucz obecny/nieobecny w całym pliku, nie w jednej linii) — gdy commit
// dotyka tych plików, tryb szybki NIE próbuje ich różnicować i spada na
// pełny skan (wolniejszy, ale poprawny). K3aKLUCZ ma jeszcze jedną, świadomą
// nieprecyzję: sprawdza defaultValue tylko w DOTKNIĘTYCH plikach źródłowych,
// nie w całym repo — omówione w J0_BRAMKA.md.
function gitTouchedFiles() {
  try {
    const out = execFileSync(
      'git',
      ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function gitOldContent(rel) {
  try {
    // stdio: plik nowy (brak w HEAD) daje "fatal: ... not in 'HEAD'" na stderr —
    // to oczekiwane i obsłużone przez catch, więc nie ma co straszyć nim w konsoli hooka.
    return execFileSync('git', ['show', `HEAD:${rel}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return ''; // plik nowy (nie istniał w HEAD) — stara treść jest pusta
  }
}

async function trybSzybki(baselinePath) {
  if (!fs.existsSync(baselinePath)) {
    console.error(`BRAK PLIKU BAZOWEGO: ${baselinePath}. Wygeneruj: node scripts/i18n/pomiar-jezyka.mjs --json > ${baselinePath}`);
    return 2;
  }
  const bazowy = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const dotkniete = gitTouchedFiles();

  const dotykaTlumaczen = dotkniete.some((f) => /^public\/locales\/(en|pl)\/.*\.json$/.test(f));
  if (dotykaTlumaczen) {
    console.error('BRAMKA JĘZYKOWA: commit dotyka public/locales/**.json — tryb szybki nie');
    console.error('  potrafi bezpiecznie policzyć K1/K2/K3a/K3b z samej delty, robię pełny skan.');
    return trybPelny(baselinePath, bazowy);
  }

  // K10d (DRD) nie da się policzyć z delty pliku — paczka powstaje z kilku
  // źródeł naraz (DRD_STRUCTURE + trzy pliki override'ów) i jedna zmiana
  // przestawia setki tekstów. Gdy commit dotyka tych źródeł, spadamy na
  // pełny skan, dokładnie jak przy public/locales.
  if (dotkniete.some((f) => K10D_ZRODLA.some((r) => r.test(f)))) {
    console.error('BRAMKA JĘZYKOWA: commit dotyka źródeł method packa DRD — robię pełny skan (K10d).');
    return trybPelny(baselinePath, bazowy);
  }

  const dotknieteSrc = dotkniete.filter((f) => /^(src|server\/src)\/.*\.(ts|tsx)$/.test(f));
  if (dotknieteSrc.length === 0) {
    console.log('BRAMKA JĘZYKOWA (szybki tryb): OK — brak dotkniętych plików źródłowych .ts/.tsx.');
    return 0;
  }

  const kluczeEnBazy = wczytajKluczeEnSzybko();
  const delty = {};
  const deltyModul = {};
  const dodaj = (modul, kat, n) => {
    if (!n) return;
    delty[kat] = (delty[kat] || 0) + n;
    deltyModul[modul] = deltyModul[modul] || {};
    deltyModul[modul][kat] = (deltyModul[modul][kat] || 0) + n;
  };

  for (const rel of dotknieteSrc) {
    const pelna = path.join(ROOT, rel);
    const nowaTresc = fs.existsSync(pelna) ? fs.readFileSync(pelna, 'utf8') : '';
    const staraTresc = gitOldContent(rel);

    if (rel.startsWith('src/')) {
      const modul = modulZeSciezki(rel);
      const nowe = analizujDefaultyZawartosc(nowaTresc, kluczeEnBazy);
      const stare = analizujDefaultyZawartosc(staraTresc, kluczeEnBazy);
      dodaj(modul, 'K1def', nowe.K1def - stare.K1def);
      dodaj(modul, 'K1defWID', nowe.K1defWID - stare.K1defWID);

      if (rel.endsWith('.tsx')) {
        const noweJsx = analizujJsxZawartosc(nowaTresc);
        const stareJsx = analizujJsxZawartosc(staraTresc);
        dodaj(modul, 'K4pl', noweJsx.K4pl - stareJsx.K4pl);
        dodaj(modul, 'K4en', noweJsx.K4en - stareJsx.K4en);
      }

      // K4obj/K4objPL — literały w właściwościach obiektów. Liczone dla .ts
      // TAKŻE, bo definicje kolumn/pigułek siedzą często w plikach `*.ts`
      // (np. `executionColumns.ts`), nie tylko w komponentach `.tsx`.
      const noweObj = analizujLiteralyObiektowZawartosc(nowaTresc);
      const stareObj = analizujLiteralyObiektowZawartosc(staraTresc);
      dodaj(modul, 'K4obj', noweObj.K4obj - stareObj.K4obj);
      dodaj(modul, 'K4objPL', noweObj.K4objPL - stareObj.K4objPL);

      const noweDaty = analizujDatyZawartosc(nowaTresc);
      const stareDaty = analizujDatyZawartosc(staraTresc);
      dodaj(modul, 'K7', noweDaty.K7 - stareDaty.K7);
    } else if (jestKodemSerwerowymUI(rel)) {
      const modul = modulSerwera(rel);
      const noweSrv = analizujSerwerZawartosc(nowaTresc);
      const stareSrv = analizujSerwerZawartosc(staraTresc);
      dodaj(modul, 'K5pl', noweSrv.K5pl - stareSrv.K5pl);
      dodaj(modul, 'K5en', noweSrv.K5en - stareSrv.K5en);

      const noweDaty = analizujDatyZawartosc(nowaTresc);
      const stareDaty = analizujDatyZawartosc(staraTresc);
      dodaj(WSPOLNE, 'K7', noweDaty.K7 - stareDaty.K7);
    } else {
      // server/src poza katalogami UI (services/, repositories/...) — nie
      // liczy się do K5 (świadome zawężenie skanera), ale K7 (daty/liczby)
      // mierzy CAŁY server/src w pełnym skanie, więc licz to też tutaj.
      const noweDaty = analizujDatyZawartosc(nowaTresc);
      const stareDaty = analizujDatyZawartosc(staraTresc);
      dodaj(WSPOLNE, 'K7', noweDaty.K7 - stareDaty.K7);
    }

    // K8s i K9p liczą się PER PLIK (każde trafienie siedzi w jednym pliku),
    // więc delta starej i nowej treści jest tu dokładna — tak samo jak K5/K7.
    if (jestKodemSerwerowymK8s(rel)) {
      const modul = modulSerwera(rel);
      const noweK8 = analizujSerwerK8sZawartosc(nowaTresc);
      const stareK8 = analizujSerwerK8sZawartosc(staraTresc);
      dodaj(modul, 'K8spl', noweK8.K8spl - stareK8.K8spl);
      dodaj(modul, 'K8sen', noweK8.K8sen - stareK8.K8sen);
    }
    {
      const modulK11 = rel.startsWith('server/') ? modulSerwera(rel) : modulZeSciezki(rel);
      const noweT = analizujTwLiteraleZawartosc(nowaTresc);
      const stareT = analizujTwLiteraleZawartosc(staraTresc);
      dodaj(modulK11, 'K11', noweT.K11 - stareT.K11);
    }
    if (jestPlikiemPromptowym(rel)) {
      const modul = rel.startsWith('server/') ? modulSerwera(rel) : modulZeSciezki(rel);
      const noweP = analizujPromptyZawartosc(nowaTresc);
      const stareP = analizujPromptyZawartosc(staraTresc);
      dodaj(modul, 'K9pPL', noweP.K9pPL - stareP.K9pPL);
      dodaj(modul, 'K9pMIX', noweP.K9pMIX - stareP.K9pMIX);
      dodaj(modul, 'K9pBRAK', noweP.K9pBRAK - stareP.K9pBRAK);
    }
  }

  const sumaAktualna = { ...bazowy.suma };
  for (const [k, d] of Object.entries(delty)) sumaAktualna[k] = (sumaAktualna[k] || 0) + d;
  const modulyAktualne = JSON.parse(JSON.stringify(bazowy.moduly || {}));
  for (const [modul, kats] of Object.entries(deltyModul)) {
    if (!modulyAktualne[modul]) modulyAktualne[modul] = Object.fromEntries(Object.keys(KATEGORIE).map((k) => [k, 0]));
    for (const [k, d] of Object.entries(kats)) modulyAktualne[modul][k] = (modulyAktualne[modul][k] || 0) + d;
  }

  const wzrosty = porownajZBaseline(bazowy, sumaAktualna, modulyAktualne);
  if (wzrosty.length) {
    raportujWzrosty(wzrosty);
    return 1;
  }
  const zmienioneKategorie = Object.entries(delty).filter(([, d]) => d !== 0);
  console.log(
    'BRAMKA JĘZYKOWA (szybki tryb — tylko dotknięte pliki): OK.' +
      (zmienioneKategorie.length ? ' Zmiany: ' + zmienioneKategorie.map(([k, d]) => `${k} ${d > 0 ? '+' : ''}${d}`).join(', ') : ''),
  );
  return 0;
}

// ---------------------------------------------------------------------------
// tryb pełny — chodzi po całym repo (src/**, server/src/**, public/locales/**).
// Używany zawsze w CI, i jako spadek trybu szybkiego, gdy dotknięte są pliki
// tłumaczeń.
// ---------------------------------------------------------------------------
async function trybPelny(baselinePath, bazowyPrzekazany, przytnijPrzykladyDo25 = true) {
  skanujDefaultyT(listujPliki(path.join(ROOT, 'src'), (n) => /\.(ts|tsx)$/.test(n)));
  skanujTlumaczenia();
  skanujDefaultyWidoczne();
  skanujJsx(listujPliki(path.join(ROOT, 'src'), (n) => n.endsWith('.tsx')));
  const plikiSrc = listujPliki(path.join(ROOT, 'src'), (n) => /\.(ts|tsx)$/.test(n));
  skanujLiteralyObiektow(plikiSrc);
  skanujSerwer(KATALOGI_SERWERA.flatMap((k) => listujPliki(path.join(ROOT, 'server/src', k), (n) => n.endsWith('.ts'))));
  const plikiSerwera = listujPliki(path.join(ROOT, 'server/src'), (n) => n.endsWith('.ts'));
  skanujTwLiterale([...plikiSrc, ...plikiSerwera]);
  skanujSerwerK8s(plikiSerwera);
  skanujPrompty([
    ...plikiSerwera,
    ...listujPliki(path.join(ROOT, 'src/services'), (n) => /\.(ts|tsx)$/.test(n)),
    ...listujPliki(path.join(ROOT, 'src/lib'), (n) => /\.(ts|tsx)$/.test(n)),
  ]);
  await skanujDrd();
  skanujDaty([
    ...listujPliki(path.join(ROOT, 'src'), (n) => /\.(ts|tsx)$/.test(n)),
    ...listujPliki(path.join(ROOT, 'server/src'), (n) => /\.(ts|tsx)$/.test(n)),
  ]);

  // przykłady przycinamy do 25 na kategorię TYLKO gdy wynik idzie do pliku
  // (JSON/baseline) — żeby plik bramki był mały. Raport tekstowy (--przyklady N)
  // ma dostać tyle, ile poprosił wywołujący (raportTekstowy i tak tnie sam).
  if (przytnijPrzykladyDo25) {
    for (const k of Object.keys(wynik.przyklady)) wynik.przyklady[k] = wynik.przyklady[k].slice(0, 25);
  }
  wynik.plikiTop = Object.fromEntries(Object.entries(wynik.plikiTop).sort((a, b) => b[1] - a[1]).slice(0, 30));

  if (!baselinePath) return null; // wołający chce tylko wypełnić `wynik` (raport/--json)

  const bazowy = bazowyPrzekazany || JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const wzrosty = porownajZBaseline(bazowy, wynik.suma, wynik.moduly);
  if (wzrosty.length) {
    raportujWzrosty(wzrosty);
    return 1;
  }
  const spadki = Object.keys(KATEGORIE)
    .map((k) => [k, (bazowy.suma?.[k] ?? 0) - wynik.suma[k]])
    .filter(([, d]) => d > 0);
  console.log('BRAMKA JĘZYKOWA: OK (nic nie wzrosło).' + (spadki.length ? ' Spadki: ' + spadki.map(([k, d]) => `${k} -${d}`).join(', ') : ''));
  return 0;
}

// ---------------------------------------------------------------------------
// main — odpala się TYLKO gdy plik jest wołany bezpośrednio z CLI (`node
// pomiar-jezyka.mjs ...`), NIE przy `import` z testu. Bez tej strażnicy sam
// import tego modułu (np. z pliku testowego funkcji klasyfikującej) odpalałby
// pełny skan repo (kilka-kilkanaście sekund) i mógłby wywołać process.exit()
// w środku importu — dlatego funkcje klasyfikujące (wykryjPolski/wykryjAngielski/
// bazaKlucza/oczysc) są wyeksportowane osobno, do użycia bez efektów ubocznych.
// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  function arg(nazwa, domyslna = null) {
    const i = argv.indexOf(nazwa);
    return i >= 0 ? argv[i + 1] : domyslna;
  }
  const chceJson = argv.includes('--json');
  const baseline = arg('--baseline');
  const chceStaged = argv.includes('--staged');
  const limitPrzykladow = Number(arg('--przyklady', '3'));
  const filtrModul = arg('--modul');
  const filtrKategoria = arg('--kategoria');
  const raportPlik = arg('--report');

  if (baseline && chceStaged && !raportPlik) {
    process.exit(await trybSzybki(baseline));
  }

  if (baseline) {
    if (!fs.existsSync(baseline)) {
      console.error(`BRAK PLIKU BAZOWEGO: ${baseline}. Wygeneruj: node scripts/i18n/pomiar-jezyka.mjs --json > ${baseline}`);
      process.exit(2);
    }
    const kod = await trybPelny(baseline, null, !raportPlik);
    if (raportPlik) zapiszRaportPlikLinia(raportPlik);
    process.exit(kod);
  }

  await trybPelny(null, null, chceJson && !raportPlik);
  if (raportPlik) zapiszRaportPlikLinia(raportPlik);
  if (chceJson) console.log(JSON.stringify(wynik, null, 2));
  else if (!raportPlik) console.log(raportTekstowy(limitPrzykladow, filtrModul, filtrKategoria));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('POMIAR JĘZYKA PRZERWANY (brak pomiaru nie jest wynikiem):', e?.message || e);
    process.exit(2);
  });
}

// Eksport dla testów (scripts/i18n/__tests__/pomiar-jezyka.klasyfikacja.test.mjs)
// — WYŁĄCZNIE czyste funkcje klasyfikujące, bez efektów ubocznych (nie liczą do
// `wynik`, nie dotykają dysku poza odczytem, nie wołają process.exit).
export {
  wykryjPolski,
  wykryjAngielski,
  bazaKlucza,
  oczysc,
  wartoOceniac,
  wartoscTechniczna,
  analizujJsxZawartosc,
  analizujSerwerZawartosc,
  // E2f (DEC-510) — trzy warstwy poza UI. Wszystkie są czyste: liczą z
  // przekazanej treści/obiektu, nie dotykają dysku i nie wołają process.exit.
  analizujSerwerK8sZawartosc,
  jestKodemSerwerowymK8s,
  // E2f-bis (DEC-461) — nowe kubełki i nowe sygnały wykrywania angielskiego.
  analizujLiteralyObiektowZawartosc,
  analizujTwLiteraleZawartosc,
  sufiksSilny,
  sufiksSlaby,
  frazaTitleCase,
  bezSlownikowDwujezycznych,
  analizujPromptyZawartosc,
  jestPlikiemPromptowym,
};
