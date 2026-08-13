/**
 * Dev-render host for the REAL `<AssessmentReportView />`
 * (src/components/assessment/report/) — CLAUDE.md rule #7: render on mock
 * data ourselves, screenshot, THEN show the owner. The component only ever
 * performs GET requests (`reportApi.ts`), so we stub `window.fetch` with
 * kernel-shaped mock JSON keyed by URL path (pattern from
 * dev-render/screens/assessment-reports-table.tsx).
 *
 * URL param `?variant=` selects which state to mount:
 *   happy       (default) — frozen Output, mixed strengths/gaps, two units
 *               without accepted evidence (the "nie wiem" panel), one
 *               approval on record, per-axis aggregation POPULATED (the
 *               shape the report is built to render once a bridge fills
 *               `aggregation.byGroup` — see AssessmentReportDocument's
 *               empty-aggregation fallback for TODAY's actual
 *               EventDerivedOutputBridge behaviour, exercised by `edge`).
 *   edge        — demo-bypass Output, superseded by a newer revision, ZERO
 *               recorded approvals, EMPTY aggregation.byGroup (today's real
 *               bridge shape) — exercises every "honest gap" message at once.
 *   not-frozen  — `outputId=null`, no fetch at all.
 */
import React from 'react';

import { AssessmentReportView } from '../../src/components/assessment/report/AssessmentReportView';

const METHOD_PACK_VERSION = '2.0.0-methodpack.1';

const BASE_OUTPUT = {
  id: 'out-1',
  organizationId: 'org-1',
  sessionId: 'sess-1',
  snapshotId: 'snap-1',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: METHOD_PACK_VERSION,
  outputVersion: 1,
  revisionOfOutputId: null,
  scope: 'Sesja sess-1 — drd@2.0.0-methodpack.1, zamrożona z event-store.',
  current: { '1A': 4, '1B': 6, '2A': null, '4C': 2, '6B': 3, '7A': 2 },
  target: { '1A': 6, '1B': 6, '2A': 4, '4C': 5, '6B': 3, '7A': 4 },
  gap: { '1A': 2, '1B': 0, '2A': null, '4C': 3, '6B': 0, '7A': 2 },
  visualModel: { kind: 'matrix', dataRef: {} },
  evidenceCompleteness: {
    totalUnits: 6,
    unitsWithAcceptedEvidence: 4,
    unitsMissingEvidence: 2,
    completenessRatio: 4 / 6,
  },
  limitations: [
    'Output wygenerowany automatycznie z event-store (EventDerivedOutputBridge, vertical-slice demo) — ' +
      'businessMeaning/recommendation to deterministyczne szablony z realnych danych (unit/level/evidence), ' +
      'NIE analiza LLM ani recenzja metodyka.',
    'aggregation.byGroup jest pusta — agregacja per-oś jest regułą metody i liczona jest client-side.',
  ],
  findings: [
    {
      id: 'find-1a',
      outputId: 'out-1',
      unitId: '1A',
      unitName: 'Procesy Sprzedaży',
      currentLevel: 4,
      targetLevel: 6,
      gap: 2,
      supportingEvidence: [
        {
          evidenceId: 'ev-1a-1',
          evidenceType: 'system_export',
          strength: 'E2',
          locator: 'vault://evidence/ev-1a-1',
          title: 'Eksport CRM Q2 2026',
        },
      ],
      contradictingEvidence: [],
      businessMeaning:
        'Sprzedaż rejestruje dane cyfrowo i steruje budżetem procesu, ale automatyzacja kanału online (sklep/marketplace) nie jest jeszcze wdrożona.',
      rootCauseHypothesis: null,
      riskOrOpportunity:
        'Konkurenci z automatyzacją sprzedaży online skalują przy tych samych zasobach handlowych.',
      recommendation: 'Wdrożyć podstawowy kanał e-commerce/marketplace w ciągu najbliższych 2 kwartałów.',
      prerequisite: null,
      expectedOutcome: 'Sprzedaż online bez udziału handlowca dla podstawowego asortymentu.',
      confidence: 'medium',
      priorityRationale: 'Luka 2 poziomy, bezpośredni wpływ na przychód.',
      sourceLocators: ['method-event://evt-1a-1', 'vault://evidence/ev-1a-1'],
      createdAt: '2026-08-10T09:00:00.000Z',
    },
    {
      id: 'find-1b',
      outputId: 'out-1',
      unitId: '1B',
      unitName: 'Procesy Marketingowe',
      currentLevel: 6,
      targetLevel: 6,
      gap: 0,
      supportingEvidence: [
        { evidenceId: 'ev-1b-1', evidenceType: 'system_export', strength: 'E3', locator: 'vault://evidence/ev-1b-1' },
      ],
      contradictingEvidence: [],
      businessMeaning: 'Marketing korzysta z ERP zintegrowanego z innymi obszarami organizacji — cel osiągnięty.',
      rootCauseHypothesis: null,
      riskOrOpportunity: null,
      recommendation: 'Utrzymać obecny poziom; sprawdzić integrację przy najbliższej migracji ERP.',
      prerequisite: null,
      expectedOutcome: 'Stabilizacja jednostki 1B na obecnym poziomie.',
      confidence: 'high',
      priorityRationale: 'Brak luki — priorytet utrzymaniowy, nie inwestycyjny.',
      sourceLocators: ['method-event://evt-1b-1', 'vault://evidence/ev-1b-1'],
      createdAt: '2026-08-10T09:05:00.000Z',
    },
    {
      id: 'find-4c',
      outputId: 'out-1',
      unitId: '4C',
      unitName: 'Jakość Danych',
      currentLevel: 2,
      targetLevel: 5,
      gap: 3,
      supportingEvidence: [
        { evidenceId: 'ev-4c-1', evidenceType: 'interview', strength: 'E1', locator: 'vault://evidence/ev-4c-1' },
      ],
      contradictingEvidence: [],
      businessMeaning:
        'Zarządzanie jakością danych opiera się na ręcznych przeglądach arkuszy, bez zautomatyzowanej walidacji.',
      rootCauseHypothesis: null,
      riskOrOpportunity: 'Błędy w danych źródłowych propagują się do raportowania zarządczego bez wykrycia.',
      recommendation: 'Wdrożyć automatyczną walidację jakości danych w hurtowni przed końcem roku.',
      prerequisite: null,
      expectedOutcome: 'Zamknięcie luki na jednostce 4C.',
      confidence: 'low',
      priorityRationale: 'Największa luka w tej ocenie (3 poziomy) — priorytet nr 1.',
      sourceLocators: ['method-event://evt-4c-1', 'vault://evidence/ev-4c-1'],
      createdAt: '2026-08-10T09:10:00.000Z',
    },
    {
      id: 'find-6b',
      outputId: 'out-1',
      unitId: '6B',
      unitName: 'Zarządzanie Tożsamością i Dostępem',
      currentLevel: 3,
      targetLevel: 3,
      gap: 0,
      supportingEvidence: [
        { evidenceId: 'ev-6b-1', evidenceType: 'policy_document', strength: 'E4', locator: 'vault://evidence/ev-6b-1' },
      ],
      contradictingEvidence: [],
      businessMeaning: 'Polityka bezpieczeństwa dostępu spełnia obecny cel — brak rekomendowanych działań.',
      rootCauseHypothesis: null,
      riskOrOpportunity: null,
      recommendation: 'Utrzymać obecny poziom; zaplanować przegląd polityki za 12 miesięcy.',
      prerequisite: null,
      expectedOutcome: 'Stabilizacja jednostki 6B na obecnym poziomie.',
      confidence: 'high',
      priorityRationale: 'Brak luki.',
      sourceLocators: ['method-event://evt-6b-1', 'vault://evidence/ev-6b-1'],
      createdAt: '2026-08-10T09:15:00.000Z',
    },
  ],
  prioritisationResult: null,
  sourceRevisionOfSessionId: null,
  contentHash: 'sha256-mock1a2b3c4d5e6f7890',
  createdAt: '2026-08-10T09:20:00.000Z',
  frozenAt: '2026-08-10T09:20:00.000Z',
  demoBypassActive: false,
};

const HAPPY_OUTPUT = {
  ...BASE_OUTPUT,
  // This mock demonstrates the FUTURE-READY rendering path (a bridge that
  // does populate per-axis aggregation before freezing) — so, unlike
  // BASE_OUTPUT.limitations, it must NOT also claim aggregation is empty.
  limitations: [BASE_OUTPUT.limitations[0]],
  aggregation: {
    byGroup: { 'axis-1': 5.0, 'axis-2': null, 'axis-4': 2.0, 'axis-6': 3.0, 'axis-7': 2.0 },
    byGroupNorm: { 'axis-1': 0.667, 'axis-2': null, 'axis-4': 0.25, 'axis-6': 0.4, 'axis-7': 0.25 },
    mappingVersion: 'drd-axis-mean-v1',
    rule:
      'drd-axis-mean-v1: arithmetic mean of non-null unit levels within the same axis, rounded to 1 decimal.',
    excluded: { '2A': 'null_or_not_applicable_unit_level_excluded_not_imputed' },
  },
};

const EDGE_OUTPUT = {
  ...BASE_OUTPUT,
  id: 'out-3',
  demoBypassActive: true,
  aggregation: {
    byGroup: {},
    byGroupNorm: {},
    mappingVersion: 'event-derived-v1',
    rule:
      'EventDerivedOutputBridge nie liczy agregacji per-oś/pillar (metoda-specyficzna reguła) — to zostaje po stronie klienta przed wyświetleniem.',
    excluded: {},
  },
  limitations: [
    ...BASE_OUTPUT.limitations,
    '★ DEMO BYPASS: Ten Output pochodzi z sesji utworzonej przez demo bypass — NIE jest wynikiem produkcyjnym i nie może zostać zatwierdzony jako released/pilot przez ten mechanizm.',
  ],
};

const SESSION = {
  id: 'sess-1',
  organizationId: 'org-1',
  projectId: 'proj-77',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: METHOD_PACK_VERSION,
  state: 'frozen',
  domainStage: null,
  mode: 'guided_manual',
  ownerUserId: 'user-42',
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-10T09:20:00.000Z',
  version: 3,
};

const APPROVALS_HAPPY = [
  {
    id: 'appr-1',
    sessionId: 'sess-1',
    revision: 3,
    decision: 'approved',
    comment: 'Wyniki spójne z warsztatem walidacyjnym z klientem.',
    actorUserId: 'user-7',
    createdAt: '2026-08-10T09:18:00.000Z',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function installFetchStub(variant: string): void {
  const g = window as unknown as { __ASSESSMENT_OUTPUT_REPORT_FETCH__?: boolean };
  if (g.__ASSESSMENT_OUTPUT_REPORT_FETCH__) return;
  g.__ASSESSMENT_OUTPUT_REPORT_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (/\/api\/method\/outputs\/out-1$/.test(url)) {
        return jsonResponse({ output: HAPPY_OUTPUT, superseded: false, supersededByOutputId: null });
      }
      if (/\/api\/method\/outputs\/out-3$/.test(url)) {
        return jsonResponse({ output: EDGE_OUTPUT, superseded: true, supersededByOutputId: 'out-4' });
      }
      if (/\/api\/method\/sessions\/sess-1$/.test(url)) {
        return jsonResponse({ session: SESSION, roles: [] });
      }
      if (/\/api\/method\/sessions\/sess-1\/approvals$/.test(url)) {
        return jsonResponse({ approvals: variant === 'edge' ? [] : APPROVALS_HAPPY });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function AssessmentOutputReportScreen(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const variant = params.get('variant') || 'happy';
  installFetchStub(variant);

  const outputId = variant === 'not-frozen' ? null : variant === 'edge' ? 'out-3' : 'out-1';

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', height: '100vh' }}>
      <AssessmentReportView outputId={outputId} />
    </div>
  );
}
