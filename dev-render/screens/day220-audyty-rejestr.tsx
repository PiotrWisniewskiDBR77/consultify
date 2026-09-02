/**
 * FIX-220 (odbiór adwersaryjny ODBIOR_220.md, punkt 1) — dev-render host dla
 * REALNYCH komponentów naprawionych w dyżurze 220:
 *   `AuditProcessesTab` / `AuditReportsTab` / `AuditFindingsTab`
 *   (`src/components/Audit/method/tabs/*.tsx`).
 *
 * Poprzednia wersja tego pliku była ręcznie sklejoną, osobną tabelą z twardo
 * wpisanymi wartościami — udawała wygląd tych komponentów, nie montowała ich.
 * Rule 7 (`CLAUDE.md`): zrzut ma dowodzić, że REALNY komponent wygląda
 * poprawnie — nie że ktoś umie narysować tabelę. Ten plik montuje teraz
 * dosłownie te same importy co produkcyjny `AuditsMethodHub.tsx` (patrz jego
 * `activeTab === 'processes' | 'reports' | 'findings'` gałęzie), z tymi
 * samymi propami.
 *
 * `AuditProcessesTab` jest prezentacyjny (lista przychodzi propem `programs`,
 * API tylko przy zaznaczeniu wiersza — nie zaznaczamy żadnego, więc zero
 * sieci). `AuditReportsTab` i `AuditFindingsTab` NIE są prezentacyjne — same
 * dociągają dane przez `Api.get` (`listReports`/`listFindings`/
 * `listProgramCriteria`/`listAllActions`/`listEvidence` z
 * `auditsMethodApi.ts`, wszystkie przez `window.fetch`). Ten harness nie ma
 * za sobą żadnego prawdziwego backendu, więc — jak `finance-analysis-
 * workspace.tsx` — przechwytujemy na poziomie `window.fetch` i serwujemy
 * dokładnie te same koperty `{success:true,data:{...}}`, jakich oczekuje
 * `unwrapEnvelope()` w `auditsMethodApi.ts`. To atrapa na warstwie danych/API
 * (dozwolona), NIE na komponencie (montowany jest realny plik produktowy).
 *
 * Dane wzorowane na kanonicznym fixture dyżuru
 * (`scripts/dev/seed-wave3-audits-owner-review.mjs`) — długie polskie
 * wartości, żeby R3 (title= po ucięciu) i R2 (rozwiązane nazwy zamiast
 * surowych ID) były widoczne na zrzucie, nie tylko w kodzie.
 *
 * URL: ?screen=day220-audyty-rejestr[&view=processes|reports|findings][&lang=pl|en][&theme=light|dark]
 */
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type {
  AuditActionSummary,
  AuditCriterionSummary,
  AuditEvidenceSummary,
  AuditFindingSummary,
  AuditProgramSummary,
  AuditReportSummary,
} from '../../src/components/Audit/method/auditsMethodApi';
import { AuditFindingsTab } from '../../src/components/Audit/method/tabs/AuditFindingsTab';
import { AuditProcessesTab } from '../../src/components/Audit/method/tabs/AuditProcessesTab';
import { AuditReportsTab } from '../../src/components/Audit/method/tabs/AuditReportsTab';

// ---------------------------------------------------------------------------
// Mock fixture — wzorowany na scripts/dev/seed-wave3-audits-owner-review.mjs
// ---------------------------------------------------------------------------

const PROGRAM_ID = 'w3-aud-program-v1';
const PROGRAM_ID_2 = 'w3-aud-program-v2';
const LEAD_USER_ID = 'w3-aud-lead-user-v1';
const OWNER_USER_ID = 'w3-aud-owner-user-v1';
const REVIEWER_USER_ID = 'w3-aud-reviewer-user-v1';
const CRITERION_ID = 'w3-aud-criterion-v1';

const PACK_TITLE = 'Pakiet audytu transformacji — operacje wewnętrzne';

const USER_NAME_BY_ID = new Map<string, string>([
  [LEAD_USER_ID, 'Aleksandra Wielka-Nowakowska — Audytorka Wiodąca'],
  [OWNER_USER_ID, 'Piotr Właściciel Programu'],
  [REVIEWER_USER_ID, 'Zofia Recenzentka Niezależna'],
]);

const PACK_TITLE_BY_ID = new Map<string, string>([['w3-aud-pack-v1', `${PACK_TITLE} v1`]]);

const PROGRAM_NAME_BY_ID = new Map<string, string>([
  [PROGRAM_ID, 'Audyt zarządzania transformacją — przegląd właścicielski'],
  [PROGRAM_ID_2, 'Audyt zgodności procesu zakupowego — dostawcy krytyczni'],
]);

const PROGRAMS: AuditProgramSummary[] = [
  {
    id: PROGRAM_ID,
    name: 'Audyt zarządzania transformacją — przegląd właścicielski',
    packId: 'w3-aud-pack-v1',
    packTitle: PACK_TITLE,
    packVersion: 1,
    lifecycleState: 'findings_review',
    applicableCriteria: 1,
    concludedCriteria: 1,
    openFindings: 1,
    leadAuditorId: LEAD_USER_ID,
    leadAuditorName: null,
    plannedStart: '2026-08-01T00:00:00Z',
    plannedEnd: '2026-09-15T00:00:00Z',
    updatedAt: '2026-08-21T09:40:00Z',
  },
  {
    id: PROGRAM_ID_2,
    name: 'Audyt zgodności procesu zakupowego — dostawcy krytyczni',
    packId: 'w3-aud-pack-v1',
    packTitle: PACK_TITLE,
    packVersion: 1,
    lifecycleState: 'planning',
    applicableCriteria: 4,
    concludedCriteria: 0,
    openFindings: 0,
    leadAuditorId: REVIEWER_USER_ID,
    leadAuditorName: null,
    plannedStart: '2026-09-01T00:00:00Z',
    plannedEnd: '2026-10-30T00:00:00Z',
    updatedAt: '2026-08-25T11:05:00Z',
  },
];

const REPORTS: AuditReportSummary[] = [
  {
    id: 'w3-aud-report-v1',
    programId: PROGRAM_ID,
    programName: null,
    reportKind: 'audit_report',
    version: 1,
    title: 'Audyt zarządzania transformacją — szkic raportu właścicielskiego',
    status: 'draft',
    language: 'pl',
    audience: 'wewnętrzny przegląd właścicielski i komitet sterujący transformacją',
    confidentiality: 'wewnętrzny — dostęp ograniczony do zespołu właścicielskiego',
    approvedAt: null,
    publishedAt: null,
    updatedAt: '2026-08-21T09:40:00Z',
  },
  {
    id: 'w3-aud-report-v2',
    programId: PROGRAM_ID,
    programName: null,
    reportKind: 'remediation_progress',
    version: 1,
    title: 'Postęp naprawy — niezależny przegląd decyzji transformacyjnych',
    status: 'approved',
    language: 'pl',
    audience: 'zarząd i sponsor programu',
    confidentiality: 'poufne — tylko komitet sterujący',
    approvedAt: '2026-08-25T10:00:00Z',
    publishedAt: null,
    updatedAt: '2026-08-25T10:00:00Z',
  },
  {
    id: 'w3-aud-report-v3',
    programId: PROGRAM_ID_2,
    programName: null,
    reportKind: 'audit_report',
    version: 1,
    title: 'Audyt zgodności procesu zakupowego — raport wstępny',
    status: 'in_review',
    language: 'pl',
    audience: 'kierownik działu zakupów',
    confidentiality: 'wewnętrzny',
    approvedAt: null,
    publishedAt: null,
    updatedAt: '2026-08-26T08:00:00Z',
  },
];

const CRITERIA: AuditCriterionSummary[] = [
  {
    id: CRITERION_ID,
    programId: PROGRAM_ID,
    parentId: null,
    ordinal: 1,
    refCode: 'TA.1',
    title: 'Decyzje transformacyjne: dowód, właściciel i niezależny przegląd',
    applicable: true,
    conformityStatus: 'nonconforming',
    workStatus: 'concluded',
    evidenceCount: 1,
    findingCount: 1,
    children: [],
  },
];

const ACTIONS: AuditActionSummary[] = [
  {
    id: 'w3-aud-action-v1',
    findingId: 'w3-aud-finding-v1',
    programId: PROGRAM_ID,
    actionKind: 'corrective_action',
    title: 'Wymagaj datowanego zapisu niezależnego przeglądu',
    ownerUserId: OWNER_USER_ID,
    dueDate: '2026-10-15T00:00:00Z',
    status: 'approved',
  },
];

const EVIDENCE: AuditEvidenceSummary[] = [
  {
    id: 'w3-aud-evidence-v1',
    programId: PROGRAM_ID,
    criterionId: CRITERION_ID,
    evidenceKind: 'document',
    title: 'Wewnętrzny rejestr decyzji sterujących — próbka syntetyczna',
  },
];

const FINDINGS: AuditFindingSummary[] = [
  {
    id: 'w3-aud-finding-v1',
    programId: PROGRAM_ID,
    criterionId: CRITERION_ID,
    referenceCode: 'AUD-001',
    statement:
      'W trzech z dwunastu decyzji brakowało datowanego zapisu niezależnego przeglądu oraz jednoznacznego wskazania odpowiedzialnego właściciela decyzji, co uniemożliwia odtworzenie ścieżki odpowiedzialności po fakcie.',
    requirementText:
      'Wewnętrzne decyzje transformacyjne zachowują wskazanego właściciela, datowany dowód i niezależny przegląd.',
    conditionText:
      'Wewnętrzny przegląd komitetu objął próbę 12 decyzji; w 3 brakowało datowanego zapisu niezależnego przeglądu.',
    sourceReference: 'Wewnętrzna procedura transformacyjna, sekcja TA.1',
    gapText: '3 z 12 próbkowanych decyzji nie mają datowanego zapisu niezależnego przeglądu',
    objectiveEvidence: ['w3-aud-evidence-v1'],
    contradictingEvidence: [],
    classification: 'nonconforming',
    severity: 'medium',
    riskText: 'Nie da się odtworzyć odpowiedzialności za decyzję',
    impactText: null,
    recommendation: 'Dodaj obowiązkowy punkt kontrolny niezależnego przeglądu',
    rootCause: null,
    rootCauseMethod: null,
    rootCauseConfirmed: false,
    status: 'confirmed',
    ownerUserId: OWNER_USER_ID,
    authorId: LEAD_USER_ID,
    reviewedBy: REVIEWER_USER_ID,
    reviewedAt: '2026-08-21T09:15:00Z',
    reviewNote: 'Potwierdzone przez recenzenta niezależnego od autora, audytowanego i właściciela działania',
    sentBackAt: null,
    sentBackBy: null,
    sendBackReason: null,
    residualRisk: null,
    residualRiskAcceptedBy: null,
    residualRiskAcceptedAt: null,
    residualRiskNote: null,
    closedAt: null,
    closedBy: null,
    closureNote: null,
    createdAt: '2026-08-21T09:00:00Z',
    updatedAt: '2026-08-21T09:15:00Z',
  },
  {
    id: 'w3-aud-finding-v2',
    programId: PROGRAM_ID,
    criterionId: CRITERION_ID,
    referenceCode: 'AUD-002',
    statement: 'Rejestr ryzyk projektowych nie był aktualizowany od dwóch kwartałów.',
    requirementText: null,
    conditionText: null,
    sourceReference: null,
    gapText: null,
    objectiveEvidence: [],
    contradictingEvidence: [],
    classification: 'observation',
    severity: 'low',
    riskText: null,
    impactText: null,
    recommendation: null,
    rootCause: null,
    rootCauseMethod: null,
    rootCauseConfirmed: false,
    status: 'draft',
    ownerUserId: null,
    authorId: LEAD_USER_ID,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    sentBackAt: null,
    sentBackBy: null,
    sendBackReason: null,
    residualRisk: null,
    residualRiskAcceptedBy: null,
    residualRiskAcceptedAt: null,
    residualRiskNote: null,
    closedAt: null,
    closedBy: null,
    closureNote: null,
    createdAt: '2026-08-22T09:00:00Z',
    updatedAt: '2026-08-22T09:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// window.fetch przechwycenie — atrapa TYLKO warstwy danych/API (wzorzec
// dev-render/screens/finance-analysis-workspace.tsx). `AuditReportsTab` i
// `AuditFindingsTab` wołają `Api.get` (src/services/api.ts), które w
// przeglądarce zawsze schodzi do `window.fetch` — ten harness nie ma za
// sobą żadnego prawdziwego backendu, więc jest to bezpieczne i jedyne
// miejsce przechwycenia (nie da się podmienić named-exportów `auditsMethodApi.ts`,
// bo `AuditReportsTab`/`AuditFindingsTab` importują je bezpośrednio —
// ESM bindingi są już związane przy imporcie).
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  if (url.includes('/audits/reports') && (!init || init.method === undefined || init.method === 'GET')) {
    return jsonResponse({ success: true, data: { reports: REPORTS, total: REPORTS.length } });
  }
  if (url.includes('/audits/findings')) {
    return jsonResponse({ success: true, data: { items: FINDINGS, total: FINDINGS.length } });
  }
  if (url.includes('/audits/criteria')) {
    return jsonResponse({ success: true, data: { criteria: CRITERIA } });
  }
  if (url.includes('/audits/actions')) {
    return jsonResponse({ success: true, data: { items: ACTIONS, total: ACTIONS.length } });
  }
  if (url.includes('/audits/evidence')) {
    return jsonResponse({ success: true, data: { evidence: EVIDENCE } });
  }
  return realFetch(input as any, init);
}) as typeof window.fetch;

// ---------------------------------------------------------------------------
// Harness — montuje REALNE komponenty, przełącznik ?view= tylko wybiera
// KTÓRY realny komponent jest zamontowany, nie rysuje własnej treści.
// ---------------------------------------------------------------------------

type View = 'processes' | 'reports' | 'findings';

const VIEW_LABEL: Record<View, string> = {
  processes: 'Sesje',
  reports: 'Raporty',
  findings: 'Ustalenia',
};

export default function Day220AudytyRejestrScreen(): React.ReactElement {
  const requested = new URLSearchParams(window.location.search).get('view') as View | null;
  const initialView: View = requested && requested in VIEW_LABEL ? requested : 'processes';
  const [view, setView] = useState<View>(initialView);
  const isPolish = (new URLSearchParams(window.location.search).get('lang') || 'pl') !== 'en';

  return (
    <MemoryRouter initialEntries={['/audit-programs']}>
      <main className="min-h-screen bg-c-bg px-8 py-10 text-c-text">
        <section className="mx-auto max-w-[1440px]">
          <header className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-c-text-muted">
              Audyty · przegląd właścicielski — REALNE komponenty (FIX-220)
            </p>
            <h1 className="mt-2 text-2xl font-semibold">{VIEW_LABEL[view]}</h1>
            <p className="mt-2 text-sm text-c-text-secondary">
              Zamontowane bezpośrednio: <code>AuditProcessesTab</code> / <code>AuditReportsTab</code> /{' '}
              <code>AuditFindingsTab</code> (identyczne propy jak produkcyjny <code>AuditsMethodHub.tsx</code>).
            </p>
          </header>
          <nav className="mb-4 flex gap-2" aria-label="Ekrany Audytów">
            {(['processes', 'reports', 'findings'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  item === view
                    ? 'border-c-focus bg-c-surface font-semibold text-c-text'
                    : 'border-c-border bg-c-bg text-c-text-secondary'
                }`}
              >
                {VIEW_LABEL[item]}
              </button>
            ))}
          </nav>
          <div className="h-[720px] min-h-0 overflow-hidden rounded-xl border border-c-border bg-c-surface shadow-sm">
            {view === 'processes' ? (
              <AuditProcessesTab
                initialSelectedId={null}
                programs={PROGRAMS}
                loading={false}
                error={null}
                onRetry={() => {}}
                isPolish={isPolish}
                onProgramChanged={() => {}}
                packTitleById={PACK_TITLE_BY_ID}
                userNameById={USER_NAME_BY_ID}
              />
            ) : view === 'reports' ? (
              <AuditReportsTab isPolish={isPolish} programNameById={PROGRAM_NAME_BY_ID} reloadToken={0} />
            ) : (
              <AuditFindingsTab isPolish={isPolish} programs={PROGRAMS} userNameById={USER_NAME_BY_ID} />
            )}
          </div>
        </section>
      </main>
    </MemoryRouter>
  );
}
