/**
 * assessmentHubHarness — wspólna obudowa harnessu dla REALNEGO
 * `src/components/assessment/AssessmentHub.tsx` (moduł „Ocena").
 *
 * ★ Po co: audyt przewodów odbioru (2026-09-03,
 * `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`)
 * wykazał, że cztery ZATWIERDZONE przez właściciela ekrany modułu Ocena
 * montowały w harnessie coś innego niż dostaje realny użytkownik:
 *   - `assessment-list` i `drd-library-entry` — REPLIKA: plik harnessu sam
 *     sklejał `StandardModuleBar` + `StandardTable` + `PreviewPane` z
 *     lokalnymi wierszami, zamiast montować `AssessmentHub`;
 *   - `assessment-initiatives-table` i `assessment-reports-table` — ROZJAZD:
 *     montowały `src/components/assessment/InitiativesTable.tsx` /
 *     `ReportsTable.tsx`, które mają ZERO wołaczy w `src/` (potwierdzone
 *     `git grep -w`), więc żaden użytkownik ich nie widzi.
 *
 * Realny łańcuch: `src/routes/AppRoutes.tsx:2301` `<Route index element={<AssessmentHub />} />`
 * (ścieżka `/assessment`), a pięć powierzchni Menu 2 (`FIVE_SURFACES_TAB_IDS`,
 * AssessmentHub.tsx:368) to `library · processes · outputs · reports ·
 * initiatives`. Każdy z czterech ekranów odbioru = jedna z tych zakładek.
 *
 * Ten moduł instaluje mocki sieciowe (module-level, jak w
 * `assessment-menu3-status-chips.tsx` — `AssessmentHub` woła API w pierwszym
 * commicie montowania) i eksportuje jeden komponent `AssessmentHubScreen`
 * przyjmujący `tab`. Zero re-implementacji UI: cały wygląd pochodzi z
 * realnego `AssessmentHub`.
 */
import React from 'react';

import { AssessmentHub } from '../../src/components/assessment/AssessmentHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import {
  DRD_METHOD_PACK_ID,
  DRD_METHOD_PACK_VERSION,
} from '../../src/method-core/methods/drd/compileDrdPack';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from './seedStore';

export type AssessmentHubTab = 'library' | 'processes' | 'outputs' | 'reports' | 'initiatives';

/** Legacy assessments (non-DRD) — `Api.listAssessments`. DRD-y przychodzą
 *  osobno z Method Core (patrz `MOCK_METHOD_SESSIONS`), bo
 *  `loadAssessmentListCore()` wycina `type === 'DRD'` z listy legacy. */
const MOCK_ASSESSMENTS = [
  {
    id: 'assess-2',
    name: 'Segment Manufacturing — DRD Light',
    description: 'Skrócona diagnoza pilotażowa — 3 osie priorytetowe.',
    status: 'completed',
    type: 'drd_light',
    completionPercent: 100,
    overallScore: 4.1,
    createdAt: '2026-05-20T08:00:00Z',
    updatedAt: '2026-07-08T09:15:00Z',
    createdBy: 'user-anna-demo',
  },
  {
    id: 'assess-3',
    name: 'Segment Logistics — DRD Light',
    description: 'Nierozpoczęta — czeka na kickoff z liderem BU.',
    status: 'draft',
    type: 'drd_light',
    completionPercent: 0,
    overallScore: 0,
    createdAt: '2026-07-11T08:00:00Z',
    updatedAt: '2026-07-11T08:00:00Z',
    createdBy: 'user-marek-demo',
  },
  {
    id: 'assess-5',
    name: 'Segment Sales & Marketing',
    description: 'Wynik wstępny — czeka na walidację panelu ekspertów.',
    status: 'in_review',
    type: 'drd_light',
    completionPercent: 55,
    overallScore: 3.1,
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-09T08:00:00Z',
    createdBy: 'user-marek-demo',
  },
  {
    id: 'assess-6',
    name: 'Segment Finance & Shared Services',
    description: 'Zamknięta po wdrożeniu inicjatyw naprawczych.',
    status: 'archived',
    type: 'drd_light',
    completionPercent: 100,
    overallScore: 2.8,
    createdAt: '2026-03-02T08:00:00Z',
    updatedAt: '2026-05-14T08:00:00Z',
    createdBy: 'user-anna-demo',
  },
];

/** Kanoniczne sesje DRD (Method Core). UWAGA — kontrakt `MethodSession`
 *  (src/method-core/contracts/session.ts:135) NIE MA pola nazwy, więc
 *  `methodSessionToAssessment` (AssessmentHub.tsx:264) buduje etykietę jako
 *  `DRD · <8 pierwszych znaków id>`. Identyfikatory poniżej są realistyczne
 *  (takie, jakie generuje kernel), żeby zrzut pokazywał to, co widzi
 *  użytkownik, a nie ładniejszą fikcję harnessu. */
const MOCK_METHOD_SESSIONS = [
  {
    id: 'sess-drd-dbr77-grupa-0001',
    organizationId: 'org-dbr77-demo',
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'in_review',
    domainStage: 'Oś 1 — Procesy Cyfrowe',
    mode: 'guided_manual',
    ownerUserId: 'user-piotr-demo',
    createdAt: '2026-06-02T08:00:00.000Z',
    updatedAt: '2026-07-10T11:20:00.000Z',
    version: 5,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    hasFrozenOutput: false,
  },
  {
    id: 'sess-drd-consultify-roczna-0002',
    organizationId: 'org-dbr77-demo',
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'frozen',
    domainStage: 'Porównanie rok do roku, delta +0.6 vs 2025',
    mode: 'guided_manual',
    ownerUserId: 'user-piotr-demo',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-06-30T10:00:00.000Z',
    version: 9,
    frozenSnapshotId: 'output-0002',
    revisionOfSessionId: null,
    hasFrozenOutput: true,
  },
];

/** `Api.getAssessmentReports()` — zakładka „Raporty" (widok globalny, wszystkie
 *  oceny naraz). Kształt 1:1 z `ReportBuilderReportFromAPI` czytanym w
 *  `AssessmentHub.renderContent case 'reports'`. */
const MOCK_REPORTS = [
  {
    id: 'rep-1',
    name: 'DBR77 — Raport diagnostyczny Q3 2026',
    title: 'DBR77 — Raport diagnostyczny Q3 2026',
    status: 'PENDING_APPROVAL',
    assessmentId: 'assess-1',
    assessmentName: 'DBR77 · Digital Readiness Diagnosis',
    assessmentType: 'drd',
    builderReportId: 'builder-rep-1',
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-10T09:00:00Z',
    createdBy: 'user-piotr-demo',
  },
  {
    id: 'rep-2',
    name: 'Segment Manufacturing — podsumowanie zarządcze',
    title: 'Segment Manufacturing — podsumowanie zarządcze',
    status: 'APPROVED',
    assessmentId: 'assess-2',
    assessmentName: 'Segment Manufacturing — DRD Light',
    assessmentType: 'drd_light',
    builderReportId: 'builder-rep-2',
    createdAt: '2026-06-20T08:00:00Z',
    updatedAt: '2026-07-08T11:00:00Z',
    createdBy: 'user-anna-demo',
  },
  {
    id: 'rep-3',
    name: 'Raport zarządu — decyzja inwestycyjna',
    title: 'Raport zarządu — decyzja inwestycyjna',
    status: 'FINAL',
    assessmentId: 'assess-3',
    assessmentName: 'DBR77 · Przegląd zarządczy',
    assessmentType: 'drd',
    builderReportId: 'builder-rep-3',
    createdAt: '2026-05-15T08:00:00Z',
    updatedAt: '2026-06-30T10:00:00Z',
    createdBy: 'user-piotr-demo',
  },
  {
    id: 'rep-4',
    name: 'Raport dla klienta zewnętrznego — Retail SA',
    title: 'Raport dla klienta zewnętrznego — Retail SA',
    status: 'DRAFT',
    assessmentId: 'assess-4',
    assessmentName: 'Klient zewnętrzny · Retail SA',
    assessmentType: 'drd_light',
    builderReportId: null,
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-05-01T08:00:00Z',
    createdBy: 'user-anna-demo',
  },
  {
    id: 'rep-5',
    name: 'DBR77 — raport wykorzystany w programie transformacji',
    title: 'DBR77 — raport wykorzystany w programie transformacji',
    status: 'UTILIZED',
    assessmentId: 'assess-5',
    assessmentName: 'DBR77 · Program transformacji',
    assessmentType: 'drd',
    builderReportId: 'builder-rep-5',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-04-01T08:00:00Z',
    createdBy: 'user-marek-demo',
  },
];

/** `Api.get('/initiatives?source=assessment')` — zakładka „Inicjatywy".
 *  `isAssessmentModuleInitiative` (AssessmentHub.tsx:335) ODRZUCA wiersz bez
 *  `sourceType`/`sourceId`, więc oba pola są tu obowiązkowe. */
const MOCK_INITIATIVES = [
  {
    id: 'init-1',
    name: 'Wdrożyć jednolity model danych produkcyjnych',
    description: 'Ujednolicenie schematów danych między liniami produkcyjnymi.',
    status: 'DRAFT',
    priority: 'critical',
    impact: 'high',
    sourceType: 'assessment',
    sourceId: 'assess-1',
    reportName: 'DBR77 — Raport diagnostyczny Q3 2026',
    createdBy: 'user-piotr-demo',
    createdAt: '2026-06-02T10:00:00Z',
    updatedAt: '2026-07-10T08:30:00Z',
  },
  {
    id: 'init-2',
    name: 'Zautomatyzować raportowanie OEE',
    description: 'Dashboard OEE zasilany z hali w czasie rzeczywistym.',
    status: 'PLANNING',
    priority: 'high',
    impact: 'high',
    sourceType: 'assessment',
    sourceId: 'assess-1',
    reportName: 'DBR77 — Raport diagnostyczny Q3 2026',
    createdBy: 'user-anna-demo',
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-07-08T14:00:00Z',
  },
  {
    id: 'init-3',
    name: 'Przegląd dostawców krytycznych komponentów',
    description: 'Audyt ryzyka łańcucha dostaw dla komponentów o pojedynczym źródle.',
    status: 'REVIEW',
    priority: 'medium',
    impact: 'medium',
    sourceType: 'assessment_report',
    sourceId: 'rep-2',
    reportName: 'Segment Manufacturing — podsumowanie zarządcze',
    createdBy: 'user-marek-demo',
    createdAt: '2026-06-20T11:00:00Z',
    updatedAt: '2026-07-05T09:15:00Z',
  },
  {
    id: 'init-4',
    name: 'Program szkoleń Lean dla brygadzistów',
    description: 'Cykl warsztatów Lean dla liderów zmian produkcyjnych.',
    status: 'APPROVED',
    priority: 'low',
    impact: 'medium',
    sourceType: 'assessment',
    sourceId: 'assess-2',
    reportName: 'Segment Manufacturing — podsumowanie zarządcze',
    createdBy: 'user-anna-demo',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-06-01T16:00:00Z',
  },
  {
    id: 'init-5',
    name: 'Standaryzacja raportowania jakości w trzech zakładach',
    description: 'Jeden formularz zgłoszenia niezgodności dla całej grupy.',
    status: 'EXECUTING',
    priority: 'high',
    impact: 'high',
    sourceType: 'assessment_drd',
    sourceId: 'assess-1',
    reportName: 'DBR77 — Raport diagnostyczny Q3 2026',
    createdBy: 'user-piotr-demo',
    createdAt: '2026-05-04T08:00:00Z',
    updatedAt: '2026-07-02T12:00:00Z',
  },
];

const MOCK_USERS = [
  { id: 'user-piotr-demo', firstName: 'Piotr', lastName: 'Wiśniewski' },
  { id: 'user-anna-demo', firstName: 'Anna', lastName: 'Kowalska' },
  { id: 'user-marek-demo', firstName: 'Marek', lastName: 'Zieliński' },
];

let installed = false;

/**
 * Instaluje mocki i ustawia `?tab=` PRZED pierwszym renderem huba.
 * Woływane na poziomie modułu w każdym ekranie harnessu (AssessmentHub
 * strzela do API w pierwszym commicie, więc `useEffect` wrappera jest
 * za późno — wzorzec z `audyty-drd-report.tsx`/`prezentacje-template-states.tsx`).
 */
export function installAssessmentHubHarness(tab: AssessmentHubTab): void {
  seedRealisticSession();

  useAppStore.setState({
    theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
  } as any);

  // `?tab=` jest źródłem prawdy w AssessmentHub (efekt kanonizacji URL,
  // AssessmentHub.tsx:430-452) — ustawiamy je tak, jak zrobiłby to prawdziwy
  // link/zakładka przeglądarki, zamiast polegać wyłącznie na propie.
  {
    const p = new URLSearchParams(window.location.search);
    p.set('tab', tab);
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }

  if (installed) return;
  installed = true;

  Api.getUsers = (async () => MOCK_USERS) as typeof Api.getUsers;
  Api.listAssessments = (async () => ({
    items: MOCK_ASSESSMENTS,
    total: MOCK_ASSESSMENTS.length,
  })) as typeof Api.listAssessments;
  Api.getAssessmentReports = (async () => MOCK_REPORTS) as typeof Api.getAssessmentReports;
  Api.listReportImports = (async () => ({ data: [] })) as typeof Api.listReportImports;

  const originalGet = Api.get.bind(Api);
  Api.get = (async (url: string, ...rest: unknown[]) => {
    if (url.startsWith('/initiatives')) return MOCK_INITIATIVES;
    return (originalGet as any)(url, ...rest);
  }) as typeof Api.get;

  // `loadAssessmentListCore()` czyta kanoniczne DRD-y NIE przez `Api`, tylko
  // przez `listSessions()` → `GET /api/method/sessions` na surowym `fetch`.
  // Bez tego mocka hub pokazuje trwały baner „Nie udało się wczytać sesji DRD".
  {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || 'GET').toUpperCase();
      if (method === 'GET' && /\/api\/method\/sessions(\?.*)?$/.test(url)) {
        return new Response(
          JSON.stringify({ sessions: MOCK_METHOD_SESSIONS, total: MOCK_METHOD_SESSIONS.length }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;
  }
}

/** Realny `AssessmentHub` w realnym drzewie `AppProviders`. */
export function AssessmentHubScreen({ tab }: { tab: AssessmentHubTab }): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
        <div style={{ height: '100vh', overflow: 'hidden' }}>
          <AssessmentHub initialTab={tab} />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}
