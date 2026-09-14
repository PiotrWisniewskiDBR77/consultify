/**
 * FALA J2 — harness sesji ZAMROŻONEJ (patrz nagłówek `j2-frozen.html`).
 *
 * Realny `DrdHttpMethodWorkspaceScreen` na podstawionym `window.fetch`
 * (wzór: dev-render/screens/assessment-output-report.tsx). Scena jest
 * identyczna przed i po naprawie, więc para zrzutów PRZED/PO pokazuje
 * WYŁĄCZNIE różnicę w ekranie, nie w danych.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import i18n from '../src/i18n';
import { FeatureFlagsProvider } from '../src/contexts/FeatureFlagsContext';
import { DrdHttpMethodWorkspaceScreen } from '../src/components/assessment/drd/DrdHttpMethodWorkspaceScreen';
import { useAppStore } from '../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') || 'light';
const lang = params.get('lang') || 'en';

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light' } as never);
document.body.style.background = 'var(--c-bg)';
void i18n.changeLanguage(lang);

const SESSION_ID = 'sess-j2-frozen';
const OUTPUT_ID = 'out-j2-frozen';
const METHOD_PACK_VERSION = '2.0.0-methodpack.1';

const SESSION = {
  id: SESSION_ID,
  organizationId: 'org-1',
  projectId: 'proj-77',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: METHOD_PACK_VERSION,
  state: 'frozen',
  domainStage: null,
  mode: 'guided_manual',
  ownerUserId: 'user-42',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-14T09:20:00.000Z',
  version: 6,
  frozenSnapshotId: 'snap-j2',
  revisionOfSessionId: null,
};

const OUTPUT = {
  id: OUTPUT_ID,
  organizationId: 'org-1',
  sessionId: SESSION_ID,
  snapshotId: 'snap-j2',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: METHOD_PACK_VERSION,
  outputVersion: 1,
  revisionOfOutputId: null,
  scope: `Scope: session ${SESSION_ID}, method pack drd ${METHOD_PACK_VERSION}, frozen snapshot.`,
  current: { '1A': 4, '1B': 6, '4C': 2 },
  target: { '1A': 6, '1B': 6, '4C': 5 },
  gap: { '1A': 2, '1B': 0, '4C': 3 },
  aggregation: {
    byGroup: {},
    byGroupNorm: {},
    mappingVersion: 'event-derived-v1',
    rule: 'Per-axis summaries follow the method rules and are calculated when the result is presented; this record stores the per-area levels.',
    excluded: {},
  },
  visualModel: { kind: 'matrix', dataRef: {} },
  evidenceCompleteness: {
    totalUnits: 3,
    unitsWithAcceptedEvidence: 3,
    unitsMissingEvidence: 0,
    completenessRatio: 1,
  },
  limitations: [
    'Limitations: this result is derived deterministically from the confirmed answers and the attached evidence — it is not an AI analysis nor a methodologist review.',
    'Per-axis summaries follow the method rules and are calculated when the result is presented; the frozen record stores the per-area levels.',
  ],
  findings: [
    {
      id: 'find-1a',
      outputId: OUTPUT_ID,
      unitId: '1A',
      // ★ FALA J3: mostek zapisuje od 14.09 NAZWĘ obszaru z metodyki, nie
      // identyfikator (D5, `outputUnitNames.ts`). Mock idzie za produktem.
      unitName: 'Sales Processes',
      currentLevel: 4,
      targetLevel: 6,
      gap: 2,
      supportingEvidence: [
        {
          evidenceId: 'ev-1a-1',
          evidenceType: 'system_export',
          strength: 'E2',
          locator: 'vault://evidence/ev-1a-1',
          title: 'CRM export Q2 2026',
        },
      ],
      contradictingEvidence: [],
      businessMeaning: 'Area 1A confirmed at level 4, supported by evidence (1).',
      rootCauseHypothesis: null,
      riskOrOpportunity: 'A gap of 2 level(s) to the target in area 1A.',
      recommendation: 'Plan the actions that take area 1A from level 4 to 6.',
      prerequisite: null,
      expectedOutcome: 'The gap in area 1A is closed.',
      kpiProposal: null,
      confidence: 'medium',
      priorityRationale: 'The order follows the size of the gap (2).',
      sourceLocators: ['method-event://evt-1a-1'],
      createdAt: '2026-09-14T09:20:00.000Z',
    },
    {
      id: 'find-4c',
      outputId: OUTPUT_ID,
      unitId: '4C',
      unitName: 'Data Communication',
      currentLevel: 2,
      targetLevel: 5,
      gap: 3,
      supportingEvidence: [
        {
          evidenceId: 'ev-4c-1',
          evidenceType: 'interview',
          strength: 'E1',
          locator: 'vault://evidence/ev-4c-1',
          title: 'Data owner interview',
        },
      ],
      contradictingEvidence: [],
      businessMeaning: 'Area 4C confirmed at level 2, supported by evidence (1).',
      rootCauseHypothesis: null,
      riskOrOpportunity: 'A gap of 3 level(s) to the target in area 4C.',
      recommendation: 'Plan the actions that take area 4C from level 2 to 5.',
      prerequisite: null,
      expectedOutcome: 'The gap in area 4C is closed.',
      kpiProposal: null,
      confidence: 'low',
      priorityRationale: 'The order follows the size of the gap (3).',
      sourceLocators: ['method-event://evt-4c-1'],
      createdAt: '2026-09-14T09:20:00.000Z',
    },
  ],
  prioritisationResult: null,
  sourceRevisionOfSessionId: null,
  contentHash: 'sha256-j2mock1a2b3c4d5e6f7890',
  createdAt: '2026-09-14T09:20:00.000Z',
  frozenAt: '2026-09-14T09:20:00.000Z',
  demoBypassActive: false,
};

/**
 * ★ FALA J3 — ZDARZENIA, BEZ KTÓRYCH WYWIAD NIE MA CO POKAZAĆ.
 * Do 14.09 harness podawał pustą listę zdarzeń, więc zakładka „Wywiad"
 * zamrożonej sesji siłą rzeczy stała na poziomie 1 z pustym polem odpowiedzi
 * — i tak wyglądał defekt na żywo. Tu odtwarzamy RAMPĘ (poziomy 1..N
 * potwierdzone po kolei), dokładnie tak, jak robi to zasiew `seed-ramp.mjs`:
 * bez niej klient liczy `currentLevel = null` (`drdAdapter.resolveOpenLevels`).
 */
const RAMPA: Record<string, number> = { '1A': 4, '1B': 6, '4C': 2 };
const EVENTS = Object.entries(RAMPA).flatMap(([unitId, current]) => [
  ...Array.from({ length: current }, (_, i) => ({
    id: `evt-${unitId}-ans-${i + 1}`,
    organizationId: 'org-1',
    sessionId: SESSION_ID,
    type: 'ANSWER_CONFIRMED',
    unitId,
    level: i + 1,
    actorKind: 'human',
    actorUserId: 'user-42',
    methodPackVersion: METHOD_PACK_VERSION,
    payload: {
      questionId: `${unitId}-L${i + 1}-Q1`,
      answerState: 'confirmed',
      text: `Confirmed at level ${i + 1} — evidence reviewed during the workshop.`,
    },
    createdAt: '2026-09-14T09:10:00.000Z',
  })),
  {
    id: `evt-${unitId}-ev`,
    organizationId: 'org-1',
    sessionId: SESSION_ID,
    type: 'EVIDENCE_ATTACHED',
    unitId,
    actorKind: 'human',
    actorUserId: 'user-42',
    methodPackVersion: METHOD_PACK_VERSION,
    payload: { evidenceId: `ev-${unitId}-1`, evidenceType: 'system_export', strength: 'E2' },
    createdAt: '2026-09-14T09:12:00.000Z',
  },
  {
    id: `evt-${unitId}-target`,
    organizationId: 'org-1',
    sessionId: SESSION_ID,
    type: 'DECISION_APPROVED',
    unitId,
    level: (OUTPUT.target as Record<string, number>)[unitId],
    actorKind: 'human',
    actorUserId: 'user-42',
    methodPackVersion: METHOD_PACK_VERSION,
    payload: { subject: 'target_level' },
    createdAt: '2026-09-14T09:14:00.000Z',
  },
]);

const APPROVALS = [
  {
    id: 'appr-1',
    sessionId: SESSION_ID,
    revision: 6,
    decision: 'approved',
    comment: 'Consistent with the validation workshop.',
    actorUserId: 'user-7',
    // ★ FALA J3 (D6): ślad zatwierdzenia niesie nazwę osoby OBOK identyfikatora.
    actorName: 'Irina Lebedjuk',
    createdAt: '2026-09-14T09:18:00.000Z',
  },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/\/api\/method\/sessions\/[^/?]+\/events/.test(url)) return json({ events: EVENTS });
  if (/\/api\/method\/sessions\/[^/?]+\/approvals/.test(url)) return json({ approvals: APPROVALS });
  if (/\/api\/method\/sessions\/[^/?]+$/.test(url))
    // ★ FALA J3 (D6): `ownerName` przychodzi OBOK rekordu sesji.
    return json({ session: SESSION, roles: ['owner'], ownerName: 'Tomasz Kowalczyk' });
  if (/\/api\/method\/outputs\/[^/?]+$/.test(url)) {
    return json({ output: OUTPUT, superseded: false, supersededByOutputId: null });
  }
  if (/\/api\/method\/outputs(\?|$)/.test(url)) return json({ outputs: [OUTPUT], total: 1 });
  if (/\/api\/method\/reports(\?|$)/.test(url)) return json({ reports: [] });
  if (/\/api\/method\/initiative-drafts(\?|$)/.test(url)) return json({ initiativeDrafts: [] });
  return realFetch(input as RequestInfo, init);
};

createRoot(document.getElementById('dev-render-root')!).render(
  <MemoryRouter>
    <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
      <React.Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Ładowanie…</div>}>
        <DrdHttpMethodWorkspaceScreen demoSessionId={SESSION_ID} />
      </React.Suspense>
    </FeatureFlagsProvider>
  </MemoryRouter>
);
