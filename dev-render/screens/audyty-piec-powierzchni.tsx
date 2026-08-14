/**
 * U8 — Harness dla REALNEGO `AuditsMethodHub` (Library · Processes · Outputs ·
 * Reports · Initiatives), metodyczny kernel Audits (`/api/audits/*`, U0-U7).
 *
 * Flaga `auditsFiveSurfacesV1` (default OFF) gejtuje wyłącznie MONTOWANIE
 * trasy w `src/routes/AppRoutes.tsx` — `AuditsMethodHub.tsx` sam NIE woła
 * `useFeatureFlags`/`isEnabled` (patrz jego docstring). Ten harness omija
 * routing i montuje komponent wprost, więc flaga nie jest ściśle wymagana do
 * renderu — mimo to ustawiamy ją w localStorage (wzorzec poniżej) dla
 * spójności z `assessment-five-surfaces.tsx` i na wypadek przyszłej zmiany.
 *
 * Wzorzec 1:1 z `dev-render/screens/assessment-five-surfaces.tsx`: montujemy
 * REALNY komponent wewnątrz REALNEGO `AppProviders` (ten sam plik zawiera już
 * `BrowserRouter`, więc `useSearchParams` w hubie czyta `?tab=` wprost z paska
 * adresu harnessu — nie trzeba przekazywać `initialTab` propem, bo
 * `AuditsMethodHub` go nie przyjmuje), seedujemy sesję demo
 * (`seedRealisticSession`) i podmieniamy `Api.get`/`Api.post` — `Api` jest
 * zwykłym eksportowanym obiektem, więc podmiana metody patchuje singleton,
 * którego `auditsMethodApi.ts` (jedyny klient sieciowy tego huba i wszystkich
 * pięciu zakładek) używa do każdego wywołania `/audits/*`.
 *
 * Kształt mocków ŚCIŚLE odpowiada kontraktowi `auditsMethodApi.ts`:
 * `Api.get(url)` zwraca `{ data: <ciało JSON> }` (`toAxiosLikeResponse`), a
 * `unwrapEnvelope()` w kliencie rozpakowuje ewentualną kopertę `{success,data}`
 * — więc wystarczy zwrócić `{ data: <ciało> }` z ciałem w kształcie, jakiego
 * oczekuje `toArray()`/`toTotal()` (klucze `packs`/`programs`/`outputs`/
 * `reports`/`proposals` + `total`), bez owijania w dodatkową kopertę.
 *
 * `?state=` steruje czterema stanami całego huba (wszystkie zakładki naraz):
 *   default — dane demo poniżej
 *   empty   — wszystkie listy puste (uczciwe puste stany)
 *   loading — `Api.get` dla `/audits/*` nigdy się nie rozwiązuje
 *   error   — `Api.get`/`Api.post` dla `/audits/*` zawsze odrzuca (503)
 */
import React from 'react';

import { AuditsMethodHub } from '../../src/components/Audit/method/AuditsMethodHub';
import type {
  AuditLifecycleState,
  AuditOutputSummary,
  AuditPackDetail,
  AuditPackSummary,
  AuditProgramCoverage,
  AuditProgramDetail,
  AuditProgramLifecycle,
  AuditProgramSummary,
  AuditProposalSummary,
  AuditReportSummary,
} from '../../src/components/Audit/method/auditsMethodApi';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem(
    'consultify_feature_flags',
    JSON.stringify({ ...existing, auditsFiveSurfacesV1: true })
  );
} catch {
  // ignore
}

const STATE = new URLSearchParams(window.location.search).get('state') || 'default';

// ---------------------------------------------------------------------------
// LIBRARY — 5 pakietów, jeden na każdą klasyfikację (kanon prawny: pakiet
// niezweryfikowany nie może wyglądać jak norma — to jest zrzut, który to
// dowodzi). Jeden pakiet (DEMONSTRATION) ma `publicationStatus: 'draft'`, więc
// CTA „Rozpocznij audyt" jest dla niego nieaktywne z widocznym powodem.
// ---------------------------------------------------------------------------

const MOCK_PACKS: AuditPackSummary[] = [
  {
    id: 'pack-qms-elmax',
    packKey: 'QMS-ELMAX-2026',
    version: 3,
    // Pakiet zweryfikowany opiera się na WŁASNEJ procedurze organizacji, a nie
    // na treści normy zewnętrznej. To najczęstszy realny przypadek w
    // konsultingu i jednocześnie jedyny, w którym prawa do źródła są bezsporne.
    // Pokazywanie tu pakietu nazwanego „ISO 9001:2015" sugerowałoby, że
    // Consultify dysponuje licencjonowanym pakietem normy — a nie dysponuje.
    // Norma pozostaje wskazana jako ODNIESIENIE metodyczne w opisie.
    title: 'Audyt systemu zarządzania jakością — procedura QMS Elmax',
    summary:
      'Kryteria zbudowane z procedury QMS klienta, mapowane na strukturę systemu zarządzania jakością.',
    sourceId: 'src-qms-elmax',
    sourceTitle: 'Procedura QMS Elmax Industries, wyd. 4',
    sourceVersion: 'wyd. 4 (2026)',
    classification: 'VERIFIED_NORMATIVE',
    publicationStatus: 'published',
    requiredRoles: ['lead_auditor', 'qms_specialist'],
    criteriaCount: 42,
    updatedAt: '2026-06-18T10:00:00Z',
  },
  {
    id: 'pack-it-vendor',
    packKey: 'DBR77-ITVENDOR-INTERNAL',
    version: 2,
    title: 'Kontrola dostawców IT — framework wewnętrzny DBR77',
    summary:
      'Wewnętrzna metodyka oceny dostawców IT (bezpieczeństwo, SLA, ciągłość działania) — nie jest normą zewnętrzną.',
    sourceId: null,
    sourceTitle: 'DBR77 Framework wewnętrzny v3',
    sourceVersion: '3.1',
    classification: 'INTERNAL_FRAMEWORK',
    publicationStatus: 'published',
    requiredRoles: ['lead_auditor'],
    criteriaCount: 27,
    updatedAt: '2026-07-02T09:30:00Z',
  },
  {
    id: 'pack-nis2-demo',
    packKey: 'NIS2-CYBER-DEMO',
    version: 1,
    title: 'Pakiet demonstracyjny — Gotowość NIS2 (Cyberbezpieczeństwo)',
    summary:
      'Wersja robocza pod nadchodzące wymogi NIS2 — do testów wewnętrznych, nie do audytów klienckich.',
    sourceId: null,
    sourceTitle: 'Dyrektywa NIS2 (UE) 2022/2555 — interpretacja robocza',
    sourceVersion: null,
    classification: 'DEMONSTRATION',
    publicationStatus: 'draft',
    requiredRoles: ['lead_auditor', 'cyber_specialist'],
    criteriaCount: 18,
    updatedAt: '2026-08-05T14:15:00Z',
  },
  {
    id: 'pack-dataquality-2019',
    packKey: 'DQ-LEGACY-2019',
    version: 1,
    title: 'Audyt jakości danych — metodyka 2019',
    summary:
      'Starsza metodyka oceny jakości danych referencyjnych, wycofana z aktywnego użycia po rewizji 2023.',
    sourceId: 'src-dq2019',
    sourceTitle: 'Wewnętrzny standard jakości danych 2019',
    sourceVersion: '1.0',
    classification: 'LEGACY',
    publicationStatus: 'deprecated',
    requiredRoles: ['data_auditor'],
    criteriaCount: 15,
    updatedAt: '2023-11-30T08:00:00Z',
  },
  {
    id: 'pack-rodo-client',
    packKey: 'RODO-CLIENT-UNVERIFIED',
    version: 1,
    title: 'Checklist RODO — pakiet klienta Elmax Industries',
    summary: 'Lista kontrolna dostarczona przez klienta — źródło i prawa autorskie NIE zostały potwierdzone.',
    sourceId: null,
    sourceTitle: null,
    sourceVersion: null,
    classification: 'EVIDENCE_MISSING',
    publicationStatus: 'in_review',
    requiredRoles: ['lead_auditor'],
    criteriaCount: 9,
    updatedAt: '2026-08-11T16:40:00Z',
  },
];

const MOCK_PACK_DETAILS: Record<string, AuditPackDetail> = {
  'pack-qms-elmax': {
    ...MOCK_PACKS[0],
    purpose: 'Potwierdzić zgodność systemu zarządzania jakością klienta z jego własną procedurą QMS przed przeglądem zarządzania. Odniesienie metodyczne: struktura systemu zarządzania jakością.',
    scope: 'Wszystkie procesy objęte certyfikatem: projektowanie, produkcja, kontrola jakości, zarządzanie dostawcami.',
    objectives: 'Zidentyfikować niezgodności, ocenić dojrzałość procesów, potwierdzić gotowość do audytu jednostki certyfikującej.',
    auditType: 'Audyt zgodności normatywnej',
    requiredCompetencies: ['Audytor wiodący systemów zarządzania', 'Znajomość branży produkcyjnej'],
    findingTaxonomy: [
      { key: 'major', label: 'Niezgodność poważna', nonConforming: true },
      { key: 'minor', label: 'Niezgodność drobna', nonConforming: true },
      { key: 'observation', label: 'Obserwacja', nonConforming: false },
    ],
    rightsStatus: 'Licencja zakupiona (ISO)',
    rightsNote: null,
    criteria: [],
  },
  'pack-it-vendor': {
    ...MOCK_PACKS[1],
    purpose: 'Ocenić proces kwalifikacji i bieżącego nadzoru dostawców IT pod kątem bezpieczeństwa i ciągłości działania.',
    scope: 'Dostawcy IT z dostępem do danych produkcyjnych lub infrastruktury krytycznej.',
    objectives: 'Wykryć luki w procesie onboardingu dostawców i w cyklicznym przeglądzie SLA.',
    auditType: 'Audyt wewnętrzny (framework własny)',
    requiredCompetencies: ['Audytor wiodący', 'Podstawy bezpieczeństwa IT'],
    findingTaxonomy: [
      { key: 'critical', label: 'Krytyczne', nonConforming: true },
      { key: 'moderate', label: 'Umiarkowane', nonConforming: true },
      { key: 'note', label: 'Uwaga redakcyjna', nonConforming: false },
    ],
    rightsStatus: 'Własność DBR77',
    rightsNote: null,
    criteria: [],
  },
  'pack-nis2-demo': {
    ...MOCK_PACKS[2],
    purpose: 'Materiał roboczy do wewnętrznych ćwiczeń przygotowawczych pod wymogi NIS2 — NIE do użytku u klienta.',
    scope: 'Wybrane obszary zarządzania ryzykiem cyberbezpieczeństwa (wersja niepełna).',
    objectives: 'Przetestować szablon kryteriów przed formalną publikacją pakietu.',
    auditType: 'Demonstracja / materiał roboczy',
    requiredCompetencies: ['Audytor wiodący', 'Specjalista ds. cyberbezpieczeństwa'],
    findingTaxonomy: [{ key: 'draft_note', label: 'Notatka robocza', nonConforming: false }],
    rightsStatus: 'Nie dotyczy (materiał roboczy)',
    rightsNote: 'Wersja robocza do testów wewnętrznych — nie używać u klienta.',
    criteria: [],
  },
  'pack-dataquality-2019': {
    ...MOCK_PACKS[3],
    purpose: 'Ocena kompletności i spójności danych referencyjnych — metodyka historyczna.',
    scope: 'Dane referencyjne klienta w systemach ERP sprzed migracji 2023.',
    objectives: 'Udokumentowany wyłącznie do wglądu — metodyka wycofana z aktywnego użycia.',
    auditType: 'Audyt jakości danych (wycofany)',
    requiredCompetencies: ['Audytor danych'],
    findingTaxonomy: [{ key: 'gap', label: 'Luka danych', nonConforming: true }],
    rightsStatus: 'Nie zweryfikowano',
    rightsNote: 'Metodyka wycofana z aktywnego użycia w 2023 — zachowana wyłącznie do wglądu historycznego.',
    criteria: [],
  },
  'pack-rodo-client': {
    ...MOCK_PACKS[4],
    purpose: 'Lista kontrolna dostarczona przez klienta Elmax Industries — pochodzenie nie zostało potwierdzone.',
    scope: 'Nieustalony — brak dokumentu źródłowego do porównania.',
    objectives: 'Do potwierdzenia po dostarczeniu przez klienta dowodu źródła.',
    auditType: 'Nieustalony (brak dowodu źródła)',
    requiredCompetencies: ['Audytor wiodący'],
    findingTaxonomy: [],
    rightsStatus: 'Nie zweryfikowano',
    rightsNote: 'Klient nie potwierdził pochodzenia listy kontrolnej — brak dowodu praw źródła.',
    criteria: [],
  },
};

// ---------------------------------------------------------------------------
// PROCESSES — 6 programów, po jednym na każdy interesujący etap lifecycle,
// z realnym postępem (concluded/applicable) i różną liczbą otwartych ustaleń.
// ---------------------------------------------------------------------------

const MOCK_PROGRAMS: AuditProgramSummary[] = [
  {
    id: 'prog-elmax-iso',
    name: 'Elmax Industries — Audyt QMS Q3 2026',
    packId: 'pack-qms-elmax',
    packTitle: MOCK_PACKS[0].title,
    packVersion: 3,
    lifecycleState: 'planning',
    applicableCriteria: 42,
    concludedCriteria: 0,
    openFindings: 0,
    leadAuditorId: 'user-katarzyna',
    leadAuditorName: 'Katarzyna Nowicka',
    plannedStart: '2026-08-18',
    plannedEnd: '2026-09-05',
    updatedAt: '2026-08-10T09:00:00Z',
  },
  {
    id: 'prog-vantico-iso',
    name: 'Vantico Logistics — Audyt QMS (Magazyn Poznań)',
    packId: 'pack-qms-elmax',
    packTitle: MOCK_PACKS[0].title,
    packVersion: 3,
    lifecycleState: 'fieldwork',
    applicableCriteria: 42,
    concludedCriteria: 12,
    openFindings: 4,
    leadAuditorId: 'user-marek',
    leadAuditorName: 'Marek Zieliński',
    plannedStart: '2026-07-20',
    plannedEnd: '2026-08-20',
    updatedAt: '2026-08-12T11:20:00Z',
  },
  {
    id: 'prog-metalplast-itvendor',
    name: 'Grupa Metalplast — Kontrola dostawców IT',
    packId: 'pack-it-vendor',
    packTitle: MOCK_PACKS[1].title,
    packVersion: 2,
    lifecycleState: 'findings_review',
    applicableCriteria: 27,
    concludedCriteria: 27,
    openFindings: 6,
    leadAuditorId: 'user-aleksandra',
    leadAuditorName: 'Aleksandra Dąbrowska',
    plannedStart: '2026-06-15',
    plannedEnd: '2026-07-31',
    updatedAt: '2026-08-09T15:45:00Z',
  },
  {
    id: 'prog-elmax-remediation',
    name: 'Elmax Industries — Naprawa po audycie dostawców IT Q1 2026',
    packId: 'pack-it-vendor',
    packTitle: MOCK_PACKS[1].title,
    packVersion: 2,
    lifecycleState: 'remediation',
    applicableCriteria: 27,
    concludedCriteria: 27,
    openFindings: 2,
    leadAuditorId: 'user-marek',
    leadAuditorName: 'Marek Zieliński',
    plannedStart: '2026-04-01',
    plannedEnd: '2026-08-30',
    updatedAt: '2026-08-11T08:10:00Z',
  },
  {
    id: 'prog-vantico-verification',
    name: 'Vantico Logistics — Weryfikacja skuteczności działań naprawczych',
    packId: 'pack-qms-elmax',
    packTitle: MOCK_PACKS[0].title,
    packVersion: 3,
    lifecycleState: 'effectiveness_verification',
    applicableCriteria: 42,
    concludedCriteria: 40,
    openFindings: 1,
    leadAuditorId: 'user-katarzyna',
    leadAuditorName: 'Katarzyna Nowicka',
    plannedStart: '2026-07-01',
    plannedEnd: '2026-08-15',
    updatedAt: '2026-08-08T10:00:00Z',
  },
  {
    id: 'prog-metalplast-closed',
    name: 'Grupa Metalplast — Audyt QMS 2025 (zamknięty)',
    packId: 'pack-qms-elmax',
    packTitle: MOCK_PACKS[0].title,
    packVersion: 3,
    lifecycleState: 'closed',
    applicableCriteria: 39,
    concludedCriteria: 39,
    openFindings: 0,
    leadAuditorId: 'user-aleksandra',
    leadAuditorName: 'Aleksandra Dąbrowska',
    plannedStart: '2025-10-01',
    plannedEnd: '2025-12-15',
    updatedAt: '2025-12-18T09:30:00Z',
  },
];

const MOCK_PROGRAM_DETAILS: Record<string, AuditProgramDetail> = {
  'prog-elmax-iso': {
    ...MOCK_PROGRAMS[0],
    objective: 'Potwierdzić zgodność systemu zarządzania jakością Elmax Industries z własną procedurą QMS przed przeglądem zarządzania.',
    scopeText: 'Zakład produkcyjny w Tarnowie — procesy produkcyjne, kontrola jakości, zarządzanie dostawcami.',
    projectId: 'proj-elmax-2026',
    members: [
      { userId: 'user-katarzyna', name: 'Katarzyna Nowicka', memberRole: 'lead_auditor' },
      { userId: 'user-marek', name: 'Marek Zieliński', memberRole: 'auditor' },
    ],
  },
  'prog-vantico-iso': {
    ...MOCK_PROGRAMS[1],
    objective: 'Ocena zgodności magazynu centralnego w Poznaniu z wymaganiami procedury QMS.',
    scopeText: 'Magazyn centralny Poznań — przyjęcie towaru, kompletacja, wysyłka, reklamacje.',
    projectId: 'proj-vantico-2026',
    members: [
      { userId: 'user-marek', name: 'Marek Zieliński', memberRole: 'lead_auditor' },
      { userId: 'user-aleksandra', name: 'Aleksandra Dąbrowska', memberRole: 'obserwator' },
    ],
  },
  'prog-metalplast-itvendor': {
    ...MOCK_PROGRAMS[2],
    objective: 'Ocena procesu zarządzania dostawcami IT pod kątem bezpieczeństwa i ciągłości działania.',
    scopeText: 'Wszyscy dostawcy IT z dostępem do danych produkcyjnych (12 dostawców).',
    projectId: 'proj-metalplast-itvendor',
    members: [{ userId: 'user-aleksandra', name: 'Aleksandra Dąbrowska', memberRole: 'lead_auditor' }],
  },
  'prog-elmax-remediation': {
    ...MOCK_PROGRAMS[3],
    objective: 'Zamknięcie działań naprawczych po audycie dostawców IT Q1 2026.',
    scopeText: 'Ustalenia krytyczne i wysokie z raportu Q1 2026 (8 pozycji).',
    projectId: 'proj-elmax-itvendor-remediation',
    members: [{ userId: 'user-marek', name: 'Marek Zieliński', memberRole: 'lead_auditor' }],
  },
  'prog-vantico-verification': {
    ...MOCK_PROGRAMS[4],
    objective: 'Weryfikacja skuteczności działań naprawczych po audycie QMS 2026.',
    scopeText: '12 działań naprawczych zamkniętych w lipcu 2026.',
    projectId: 'proj-vantico-2026',
    members: [{ userId: 'user-katarzyna', name: 'Katarzyna Nowicka', memberRole: 'lead_auditor' }],
  },
  'prog-metalplast-closed': {
    ...MOCK_PROGRAMS[5],
    objective: 'Coroczny audyt utrzymania certyfikatu ISO 9001.',
    scopeText: 'Cała organizacja Grupa Metalplast — audyt odnowieniowy 2025.',
    projectId: 'proj-metalplast-2025',
    members: [
      { userId: 'user-aleksandra', name: 'Aleksandra Dąbrowska', memberRole: 'lead_auditor' },
      { userId: 'user-katarzyna', name: 'Katarzyna Nowicka', memberRole: 'auditor' },
    ],
  },
};

const DEFAULT_COVERAGE: AuditProgramCoverage = {
  applicableCriteria: 0,
  concludedCriteria: 0,
  insufficientEvidenceCriteria: 0,
  openFindings: 0,
  unresolvedFindings: 0,
};

const MOCK_COVERAGE: Record<string, AuditProgramCoverage> = {
  'prog-elmax-iso': { applicableCriteria: 42, concludedCriteria: 0, insufficientEvidenceCriteria: 0, openFindings: 0, unresolvedFindings: 0 },
  'prog-vantico-iso': { applicableCriteria: 42, concludedCriteria: 12, insufficientEvidenceCriteria: 3, openFindings: 4, unresolvedFindings: 4 },
  'prog-metalplast-itvendor': { applicableCriteria: 27, concludedCriteria: 27, insufficientEvidenceCriteria: 0, openFindings: 6, unresolvedFindings: 6 },
  'prog-elmax-remediation': { applicableCriteria: 27, concludedCriteria: 27, insufficientEvidenceCriteria: 0, openFindings: 2, unresolvedFindings: 2 },
  'prog-vantico-verification': { applicableCriteria: 42, concludedCriteria: 40, insufficientEvidenceCriteria: 1, openFindings: 1, unresolvedFindings: 1 },
  'prog-metalplast-closed': { applicableCriteria: 39, concludedCriteria: 39, insufficientEvidenceCriteria: 0, openFindings: 0, unresolvedFindings: 0 },
};

const DEFAULT_LIFECYCLE: AuditProgramLifecycle = { state: 'planning' as AuditLifecycleState, allowed: [] };

const MOCK_LIFECYCLE: Record<string, AuditProgramLifecycle> = {
  'prog-elmax-iso': { state: 'planning', allowed: [{ state: 'preparation', blockers: [] }] },
  'prog-vantico-iso': {
    state: 'fieldwork',
    allowed: [{ state: 'evidence_review', blockers: ['Zbierz dowody dla 30 z 42 kryteriów zanim przejdziesz do przeglądu dowodów.'] }],
  },
  'prog-metalplast-itvendor': {
    state: 'findings_review',
    allowed: [{ state: 'management_response', blockers: ['6 ustaleń nie ma jeszcze przypisanej klasyfikacji krytyczności.'] }],
  },
  'prog-elmax-remediation': {
    state: 'remediation',
    allowed: [{ state: 'effectiveness_verification', blockers: ['2 działania naprawcze nadal otwarte — zamknij je przed weryfikacją skuteczności.'] }],
  },
  'prog-vantico-verification': { state: 'effectiveness_verification', allowed: [{ state: 'closure', blockers: [] }] },
  'prog-metalplast-closed': { state: 'closed', allowed: [] },
};

// ---------------------------------------------------------------------------
// OUTPUTS — 2 wyniki: wersja 1 zastąpiona przez wersję 2 (ten sam program,
// nowy hash, nowa data finalizacji).
// ---------------------------------------------------------------------------

const MOCK_OUTPUTS: AuditOutputSummary[] = [
  {
    id: 'out-metalplast-v1',
    programId: 'prog-metalplast-closed',
    programName: 'Grupa Metalplast — Audyt QMS 2025 (zamknięty)',
    version: 1,
    title: 'Wynik audytu QMS 2025 — Grupa Metalplast (v1)',
    finalizedBy: 'user-aleksandra',
    finalizedByName: 'Aleksandra Dąbrowska',
    finalizedAt: '2025-12-15T16:00:00Z',
    contentHash: 'a13f9c2e7b40',
  },
  {
    id: 'out-metalplast-v2',
    programId: 'prog-metalplast-closed',
    programName: 'Grupa Metalplast — Audyt QMS 2025 (zamknięty)',
    version: 2,
    title: 'Wynik audytu QMS 2025 — Grupa Metalplast (v2, korekta redakcyjna)',
    finalizedBy: 'user-aleksandra',
    finalizedByName: 'Aleksandra Dąbrowska',
    finalizedAt: '2025-12-18T09:15:00Z',
    contentHash: 'f88021d4c9ab',
  },
];

// ---------------------------------------------------------------------------
// REPORTS — 3 raporty: audit_report published, remediation_progress draft,
// audit_report superseded.
// ---------------------------------------------------------------------------

const MOCK_REPORTS: AuditReportSummary[] = [
  {
    id: 'rep-metalplast-audit-v1',
    programId: 'prog-metalplast-closed',
    programName: 'Grupa Metalplast — Audyt QMS 2025 (zamknięty)',
    reportKind: 'audit_report',
    version: 1,
    title: 'Raport z audytu QMS 2025 — Grupa Metalplast',
    status: 'superseded',
    language: 'pl',
    publishedAt: '2025-12-16T10:00:00Z',
    updatedAt: '2025-12-18T09:20:00Z',
  },
  {
    id: 'rep-metalplast-audit-v2',
    programId: 'prog-metalplast-closed',
    programName: 'Grupa Metalplast — Audyt QMS 2025 (zamknięty)',
    reportKind: 'audit_report',
    version: 2,
    title: 'Raport z audytu QMS 2025 — Grupa Metalplast (wersja poprawiona)',
    status: 'published',
    language: 'pl',
    publishedAt: '2025-12-19T08:00:00Z',
    updatedAt: '2025-12-19T08:00:00Z',
  },
  {
    id: 'rep-elmax-remediation',
    programId: 'prog-elmax-remediation',
    programName: 'Elmax Industries — Naprawa po audycie dostawców IT Q1 2026',
    reportKind: 'remediation_progress',
    version: 1,
    title: 'Postęp naprawy — Elmax Industries (sierpień 2026)',
    status: 'draft',
    language: 'pl',
    publishedAt: null,
    updatedAt: '2026-08-11T08:30:00Z',
  },
];

// ---------------------------------------------------------------------------
// INITIATIVES — 3 Proposal Drafty (LOKALNE, nie zarejestrowane Inicjatywy),
// jeden powstały z dwóch ustaleń źródłowych.
// ---------------------------------------------------------------------------

const MOCK_PROPOSALS: AuditProposalSummary[] = [
  {
    id: 'prop-metalplast-1',
    programId: 'prog-metalplast-itvendor',
    programName: 'Grupa Metalplast — Kontrola dostawców IT',
    title: 'Wdrożyć proces okresowej rewalidacji dostępów dostawców IT',
    sourceFindingIds: ['finding-mp-12'],
    priority: 'high',
    status: 'sent_to_candidates',
    updatedAt: '2026-08-09T16:00:00Z',
  },
  {
    id: 'prop-metalplast-2',
    programId: 'prog-metalplast-itvendor',
    programName: 'Grupa Metalplast — Kontrola dostawców IT',
    title: 'Ujednolicić rejestr incydentów bezpieczeństwa dostawców',
    sourceFindingIds: ['finding-mp-15', 'finding-mp-18'],
    priority: 'critical',
    status: 'draft',
    updatedAt: '2026-08-09T16:05:00Z',
  },
  {
    id: 'prop-vantico-1',
    programId: 'prog-vantico-iso',
    programName: 'Vantico Logistics — Audyt QMS (Magazyn Poznań)',
    title: 'Skrócić czas reakcji na reklamacje magazynowe',
    sourceFindingIds: ['finding-vl-04'],
    priority: 'medium',
    status: 'registered',
    updatedAt: '2026-08-12T09:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Api.get/Api.post — patch singletona (patrz nagłówek pliku).
// ---------------------------------------------------------------------------

function envelope<T>(data: T): { data: T } {
  return { data };
}

function serverUnavailable(): never {
  throw Object.assign(new Error('Serwer audytów chwilowo niedostępny (503).'), { status: 503 });
}

const originalGet = Api.get.bind(Api);
const originalPost = Api.post.bind(Api);

// Bardzo prosty stateful magazyn programów — "Rozpocznij audyt" (Library →
// Processes) dopisuje nowy wiersz zamiast ginąć w próżni przy odświeżeniu
// zakładki Processes po sukcesie.
let programsStore: AuditProgramSummary[] = [...MOCK_PROGRAMS];

Api.get = (async (url: string, ...rest: unknown[]) => {
  if (!url.startsWith('/audits/')) return (originalGet as any)(url, ...rest);
  if (STATE === 'loading') return new Promise(() => {}); // nigdy się nie rozwiąże — pokazuje stan ładowania
  if (STATE === 'error') serverUnavailable();

  const empty = STATE === 'empty';
  const path = url.split('?')[0];

  if (path === '/audits/packs') {
    const items = empty ? [] : MOCK_PACKS;
    return envelope({ packs: items, total: items.length });
  }
  const packDetail = path.match(/^\/audits\/packs\/([^/]+)$/);
  if (packDetail) {
    return envelope(MOCK_PACK_DETAILS[decodeURIComponent(packDetail[1])] ?? null);
  }

  if (path === '/audits/programs') {
    const items = empty ? [] : programsStore;
    return envelope({ programs: items, total: items.length });
  }
  const coverage = path.match(/^\/audits\/programs\/([^/]+)\/coverage$/);
  if (coverage) {
    return envelope(MOCK_COVERAGE[decodeURIComponent(coverage[1])] ?? DEFAULT_COVERAGE);
  }
  const lifecycle = path.match(/^\/audits\/programs\/([^/]+)\/lifecycle$/);
  if (lifecycle) {
    return envelope(MOCK_LIFECYCLE[decodeURIComponent(lifecycle[1])] ?? DEFAULT_LIFECYCLE);
  }
  const programDetail = path.match(/^\/audits\/programs\/([^/]+)$/);
  if (programDetail) {
    return envelope(MOCK_PROGRAM_DETAILS[decodeURIComponent(programDetail[1])] ?? null);
  }

  if (path === '/audits/outputs') {
    const items = empty ? [] : MOCK_OUTPUTS;
    return envelope({ outputs: items, total: items.length });
  }
  if (path === '/audits/reports') {
    const items = empty ? [] : MOCK_REPORTS;
    return envelope({ reports: items, total: items.length });
  }
  if (path === '/audits/proposals') {
    const items = empty ? [] : MOCK_PROPOSALS;
    return envelope({ proposals: items, total: items.length });
  }

  return (originalGet as any)(url, ...rest);
}) as typeof Api.get;

Api.post = (async (url: string, data: any) => {
  if (!url.startsWith('/audits/')) return (originalPost as any)(url, data);
  if (STATE === 'error') serverUnavailable();

  if (url === '/audits/packs/seed-demo') {
    return envelope(MOCK_PACKS[0]);
  }

  if (url === '/audits/programs') {
    const pack = MOCK_PACKS.find((p) => p.id === data?.packId) ?? MOCK_PACKS[0];
    const newProgram: AuditProgramSummary = {
      id: `prog-demo-${Date.now()}`,
      name: data?.name || `${pack.title} — nowy program`,
      packId: pack.id,
      packTitle: pack.title,
      packVersion: pack.version,
      lifecycleState: 'planning',
      applicableCriteria: pack.criteriaCount,
      concludedCriteria: 0,
      openFindings: 0,
      leadAuditorId: 'user-piotr-demo',
      leadAuditorName: 'Piotr Wiśniewski',
      plannedStart: null,
      plannedEnd: null,
      updatedAt: new Date().toISOString(),
    };
    programsStore = [newProgram, ...programsStore];
    return envelope(newProgram);
  }

  const transition = url.match(/^\/audits\/programs\/([^/]+)\/transition$/);
  if (transition) {
    const id = decodeURIComponent(transition[1]);
    const idx = programsStore.findIndex((p) => p.id === id);
    if (idx >= 0) {
      programsStore[idx] = {
        ...programsStore[idx],
        lifecycleState: (data?.targetState as AuditLifecycleState) ?? programsStore[idx].lifecycleState,
      };
      return envelope(programsStore[idx]);
    }
    return envelope(null);
  }

  return (originalPost as any)(url, data);
}) as typeof Api.post;

// ---------------------------------------------------------------------------
// Ekran — montuje REALNY AuditsMethodHub wewnątrz REALNEGO AppProviders.
// `?tab=` czyta bezpośrednio `useSearchParams` w hubie (BrowserRouter żyje w
// AppProviders), więc żaden dodatkowy router tutaj nie jest potrzebny.
// ---------------------------------------------------------------------------

export function AudytyPiecPowierzchniScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
        <div style={{ height: '100vh', overflow: 'auto' }}>
          <AuditsMethodHub />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default AudytyPiecPowierzchniScreen;
