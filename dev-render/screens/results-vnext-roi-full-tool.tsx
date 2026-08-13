/**
 * dev-render host for the REAL ROI Case FULL TOOL — mounts the ACTUAL
 * production component tree (`ResultsRoiHub` -> row kebab "Otwórz pełne
 * narzędzie" -> `RoiCaseFullTool` -> one of the four real phase-workspace
 * components), NOT a reimplementation. Per the coordinator's OQ-UI-I
 * finding (`RN_G2_OPEN_QUESTIONS_UI.md`): five of six pre-existing
 * `results-vnext-*` screens re-assemble the screen from presenters instead
 * of mounting the shipped component, so a screenshot there proves the
 * presenters render, not that the real component's hooks/state/fetch
 * orchestration work. This screen exists specifically to close that gap for
 * the full tool.
 *
 * Network stub: `roiApi.ts`/`roiCaseDetailApi.ts`/`roiCaseFullToolApi.ts`
 * all use a bare `fetch` (not the giant `Api` object — see `roiApi.ts`
 * header comment), so — same pattern as
 * `dev-render/screens/results-vnext-legacy-archive.tsx` — this screen stubs
 * `window.fetch` directly, matching on `/vnext/results/roi...` paths. The
 * stub is STATEFUL (writes mutate the in-memory `DB`, a later GET reflects
 * them) per this program's own "mock w harnessie MUSI być stanowy" rule —
 * not a fresh static payload per request.
 *
 * `onClose` throughout the real component tree is the REAL one
 * (`ResultsRoiHub`'s own `setSelectedCaseId(null)`/`setModelCase(null)`
 * etc.) — nothing in this file overrides it with a no-op, unlike the two
 * pre-existing ROI screens (`results-vnext-roi-registry.tsx`,
 * `results-vnext-roi-model.tsx`), so Esc/focus-return through any of the
 * ~15 forms in this tool is genuinely exercised when clicked through
 * `shot.mjs --click`/`--eval`, not structurally unverifiable.
 *
 * URL params:
 *   ?screen=results-vnext-roi-full-tool
 *   &lang=pl|en                (main.tsx wires i18next globally)
 *   &state=ready|loading|empty|error   forces GET /cases outcome (registry
 *                                       list only — every full-tool endpoint
 *                                       keeps its normal stateful mock)
 *
 * Golden-flow click chain (see acceptance report for the actual run):
 *   1. row click on "Wdrożenie MES — linia pakowania" (case-full-1)
 *   2. kebab -> "Otwórz pełne narzędzie"
 *   3. Build Case: Baseline&policy -> Edit baseline -> save
 *   4. Menu3 chip "Decyzja" -> Approval snapshots (empty, case not yet approved)
 *   5. Menu3 chip "Realizacja wartości" -> Actuals -> "Zarejestruj wykonanie" -> save
 *   6. Menu3 chip "Wnioski" -> Finance links -> "Nowe powiązanie" -> save
 *   7. Esc closes the last-opened modal; back to registry via breadcrumb
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ResultsRoiHub } from '../../src/components/ResultsVNext/roi/ResultsRoiHub';

const harnessParams = new URLSearchParams(window.location.search);
/** Forces `GET /cases` (the registry's own list fetch) to the given
 * outcome — independent of every other endpoint below, which stay on their
 * normal stateful behaviour regardless of this param (mirrors the "state
 * only gates the top-level list" convention `results-vnext-kpi-registry.tsx`
 * documents for its own `measState`). */
const registryState = harnessParams.get('state') || 'ready';
// RN-G4 lane `teresa` (FALA 2, 2026-08-11) — two DELIBERATE, DOCUMENTED
// scenario toggles for the Teresa governance surface (`TeresaProposalPanel`),
// independent of `registryState` above (same "only gates what it names"
// convention as `measState` in `results-vnext-kpi-registry.tsx`):
//   &teresaDown=1      — every `POST /v8/teresa/proposal*` call REJECTS the
//                        fetch promise (a real transport failure, not a
//                        4xx/5xx body) so `TeresaProposalPanel` reaches its
//                        `phase:'unavailable'` state and
//                        `TeresaUnavailableBanner`'s manual fallback.
//   &teresaRace=1      — the FIRST `execute` call against `pir-2`
//                        deterministically simulates a concurrent human
//                        recording a disposition on that PIR between
//                        "approve" and "execute" (a real race the server's
//                        own guard exists to catch —
//                        `roiPirCommands.ts` L863-870,
//                        `DISPOSITION_ALREADY_RECORDED`) — NOT a fabricated
//                        error code, the exact real guard condition
//                        (`teresa_draft_disposition !== null`) is evaluated
//                        against the just-mutated row.
const teresaDown = harnessParams.get('teresaDown') === '1';
const teresaRace = harnessParams.get('teresaRace') === '1';

try {
  window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
} catch {
  // no-op — dev-render only
}

// ==========================================================================
// In-memory, STATEFUL mock DB — one seeded case with enough real data to
// visit every sub-view of every phase at least once.
// ==========================================================================

const ORG_ID = 'org-dbr77-demo';
const USER_ID = 'user-piotr-demo';
const CASE_ID = 'case-full-1';
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

const roiCase = {
  caseId: CASE_ID,
  organizationId: ORG_ID,
  initiativeId: 'init-mes-1',
  title: 'Wdrożenie MES — linia pakowania',
  ownerUserId: USER_ID,
  status: 'modeling' as string,
  currency: 'PLN',
  granularity: 'monthly',
  analysisStart: '2026-01-01',
  analysisEnd: '2026-12-31',
  nextActionType: null as string | null,
  nextActionDueAt: null as string | null,
  nextReviewAt: null as string | null,
  submittedAt: null as string | null,
  approvedAt: null as string | null,
  rejectedAt: null as string | null,
  rejectionReason: null as string | null,
  changesRequestedAt: null as string | null,
  changesRequestedReason: null as string | null,
  archivedAt: null as string | null,
  rowVersion: 1,
  createdAt: '2026-06-01T08:00:00Z',
  updatedAt: '2026-08-10T08:00:00Z',
};

const baseline = {
  baselineId: 'bl-1', caseId: CASE_ID, organizationId: ORG_ID,
  baselinePeriodStart: '2026-01-01', baselinePeriodEnd: '2026-03-31',
  currentMeasuredValue: 82, currentMeasuredUnit: 'defektów/tydzień', currentMeasuredAsOf: '2026-03-31',
  bauProjectionMethod: 'flat', bauGrowthRatePct: null, bauReferenceValue: null,
  interventionComparisonNotes: null, source: 'Raport jakości Q1', confidence: 'medium',
  ownerUserId: USER_ID, frozenAt: null, frozenBy: null, rowVersion: 1,
  createdBy: USER_ID, createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-06-01T08:00:00Z',
};
const policy = {
  policyRowId: 'pol-1', caseId: CASE_ID, organizationId: ORG_ID,
  discountRatePct: 8, taxTreatment: 'pre_tax', inflationRatePct: 2.5, roundingPolicy: 'half_up_2dp',
  requiredMetrics: ['npv', 'irr'], notes: null, confidence: 'high', ownerUserId: USER_ID,
  frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID,
  createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-06-01T08:00:00Z',
};
const assumptions: any[] = [
  { assumptionId: 'as-1', caseId: CASE_ID, organizationId: ORG_ID, category: 'Wydajność', label: 'Redukcja przestojów', unit: '%', baseValue: 15, downsideValue: 8, upsideValue: 22, confidence: 'medium', evidenceRef: null, source: null, ownerUserId: USER_ID, sensitivityRank: 1, notes: null, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID, createdAt: '2026-06-02T08:00:00Z', updatedAt: '2026-06-02T08:00:00Z' },
];
const costLines: any[] = [
  { costLineId: 'cl-1', caseId: CASE_ID, organizationId: ORG_ID, category: 'Licencje', label: 'Licencja MES (roczna)', description: null, amount: 180000, currency: 'PLN', timingType: 'recurring', oneTimePeriodDate: null, recurrenceStartDate: '2026-01-01', recurrenceEndDate: '2026-12-31', recurrenceCadence: 'annual', confidence: 'high', source: null, ownerUserId: USER_ID, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID, createdAt: '2026-06-02T08:00:00Z', updatedAt: '2026-06-02T08:00:00Z' },
];
const benefitLines: any[] = [
  { benefitLineId: 'bn-1', caseId: CASE_ID, organizationId: ORG_ID, category: 'Jakość', label: 'Redukcja odpadu', description: null, isFinancial: true, amount: 240000, currency: 'PLN', timingType: 'recurring', oneTimePeriodDate: null, recurrenceStartDate: '2026-04-01', recurrenceEndDate: '2026-12-31', recurrenceCadence: 'quarterly', rampPeriods: 2, doubleCountingGroup: null, doubleCountingResolutionNote: null, confidence: 'medium', source: null, ownerUserId: USER_ID, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID, createdAt: '2026-06-02T08:00:00Z', updatedAt: '2026-06-02T08:00:00Z' },
];
const evidenceLinks: Record<string, any[]> = { 'bn-1': [] };
const scenarios: any[] = [
  { scenarioId: 'sc-1', caseId: CASE_ID, organizationId: ORG_ID, scenarioType: 'downside', label: 'Opóźnione wdrożenie', description: 'Start przesunięty o kwartał', deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID, createdAt: '2026-06-05T08:00:00Z', updatedAt: '2026-06-05T08:00:00Z' },
];
const calcRuns: any[] = [
  { runId: 'run-1', caseId: CASE_ID, organizationId: ORG_ID, scenarioId: null, status: 'completed', totalCosts: 180000, totalFinancialBenefits: 240000, simpleRoi: 33.3, npv: 41250, irrPct: 24.1, irrStatus: 'computed', paybackPeriods: 9, discountedPaybackPeriods: 10, benefitCostRatio: 1.33, inputHash: 'hash-1', hasUnresolvedDoubleCounting: false, hasMixedCurrencyFailure: false, validationFindings: [], warnings: [], initiatedBy: USER_ID, startedAt: '2026-08-01T09:00:00Z', completedAt: '2026-08-01T09:00:05Z', createdAt: '2026-08-01T09:00:05Z' },
];
const approvalSnapshots: any[] = [];
const forecastVersions: any[] = [];
const actualEntries: any[] = [];
const actualSnapshots: any[] = [];
const variances: any[] = [];
const varianceCauses: Record<string, any[]> = {};
// RN-G4 lane `teresa` (FALA 2, 2026-08-11) — two seeded PIRs so the "Ask
// Teresa" -> propose -> approve/reject -> execute -> disposition -> audit
// loop is reachable end-to-end via clicking, plus a second PIR reserved for
// the deterministic execute-time-denial demo (see `raceOnExecute` below).
const pirs: any[] = [
  {
    pirId: 'pir-1', caseId: CASE_ID, organizationId: ORG_ID, sequenceNumber: 1,
    status: 'draft', startedBy: USER_ID, startedAt: '2026-08-05T09:00:00Z',
    reviewSnapshotHash: 'snap-hash-pir-1', outcome: null, lessonsLearned: null,
    recommendation: null, openVarianceWaiverReason: null,
    teresaDraftLessonsPayload: null, teresaDraftGeneratedAt: null,
    teresaDraftDisposition: null, teresaDraftDispositionBy: null, teresaDraftDispositionAt: null,
    finalizedBy: null, finalizedAt: null, rowVersion: 1,
    createdBy: USER_ID, createdAt: '2026-08-05T09:00:00Z', updatedBy: null, updatedAt: '2026-08-05T09:00:00Z',
  },
  {
    pirId: 'pir-2', caseId: CASE_ID, organizationId: ORG_ID, sequenceNumber: 2,
    status: 'draft', startedBy: USER_ID, startedAt: '2026-08-07T09:00:00Z',
    reviewSnapshotHash: 'snap-hash-pir-2', outcome: null, lessonsLearned: null,
    recommendation: null, openVarianceWaiverReason: null,
    teresaDraftLessonsPayload: null, teresaDraftGeneratedAt: null,
    teresaDraftDisposition: null, teresaDraftDispositionBy: null, teresaDraftDispositionAt: null,
    finalizedBy: null, finalizedAt: null, rowVersion: 1,
    createdBy: USER_ID, createdAt: '2026-08-07T09:00:00Z', updatedBy: null, updatedAt: '2026-08-07T09:00:00Z',
  },
];
const financeLinks: any[] = [];
const financeReconciliations: any[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorResponse(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: message, code }, status);
}

// ==========================================================================
// RN-G4 lane `teresa` (FALA 2, 2026-08-11) — stateful mock of the REAL P08
// Teresa proposal lifecycle (`server/src/routes/v8/teresa.routes.ts`,
// `/api/v8/teresa/proposal*`). Mirrors the real
// `ActionEnvelopeState`/`TeresaChatProposalEnvelope` shapes exactly (see
// `src/components/ResultsVNext/teresa/teresaHandoffTypes.ts`) so the REAL
// production `TeresaProposalPanel` component — mounted here with zero
// reimplementation, same doctrine as the rest of this file — drives it
// unmodified. Only the ONE landed ROI advisor mode (`pir_lessons_draft`) is
// implemented; execute() mutates the SAME `pirs` array the PIR tab already
// reads, so approving+executing here is immediately visible in the table
// and unlocks the pre-existing "Decyzja o szkicu Teresy" disposition step.
// ==========================================================================
type TeresaEnvelopeState = 'proposal' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'undone' | 'rejected';
interface TeresaMockProposal {
  id: string;
  state: TeresaEnvelopeState;
  targetModule: string;
  targetPayload: any;
  handoffContext: any;
  auditTrail: Array<{ id: string; proposal_id: string; action: string; actor: string; timestamp: string; from_state: TeresaEnvelopeState | null; to_state: TeresaEnvelopeState; detail: any }>;
}
const teresaProposals = new Map<string, TeresaMockProposal>();
let teresaSeq = 0;
let teresaRaceConsumed = false;

function teresaAuditEntry(p: TeresaMockProposal, action: string, actor: string, from: TeresaEnvelopeState | null, to: TeresaEnvelopeState, detail: any) {
  const entry = { id: `taudit-${(teresaSeq += 1)}`, proposal_id: p.id, action, actor, timestamp: new Date().toISOString(), from_state: from, to_state: to, detail };
  p.auditTrail.push(entry);
  return entry;
}

function teresaAllowedActions(state: TeresaEnvelopeState): string[] {
  switch (state) {
    case 'proposal':
    case 'pending_approval':
      return ['approve', 'reject', 'navigate'];
    case 'approved':
      return ['execute', 'reject', 'navigate'];
    case 'completed':
    case 'executing':
    case 'undone':
    case 'rejected':
      return ['navigate'];
    default:
      return ['navigate'];
  }
}

function teresaEnvelope(p: TeresaMockProposal) {
  const intent = String(p.handoffContext?.user_intent || 'Teresa proposal');
  return {
    proposalId: p.id,
    contractId: 'teresa_copilot_v1',
    title: intent.length > 72 ? `${intent.slice(0, 71)}…` : intent,
    summary: p.handoffContext?.proposed_next_action?.handoff_intent || intent,
    state: p.state,
    approvalState: p.state === 'approved' ? 'approved' : p.state === 'completed' || p.state === 'undone' ? 'completed' : p.state === 'rejected' ? 'rejected' : 'awaiting_review',
    allowedActions: teresaAllowedActions(p.state),
    targetModule: p.targetModule,
    targetLabel: p.targetModule.toUpperCase(),
    handoffIntent: String(p.handoffContext?.proposed_next_action?.handoff_intent || 'open'),
    previewLines: [],
    auditCount: p.auditTrail.length,
    resultRef: null,
    degraded: null,
  };
}

/** `sub` is already the path with the `/v8/teresa` prefix stripped, e.g.
 * `/proposal`, `/proposal/:id/approve`, `/audit/:id` — the caller
 * (`window.fetch` override below) does the prefix match/strip once, the
 * same convention the pre-existing ROI branch in this file uses for its
 * own `/vnext/results/roi` prefix. */
async function handleTeresaProposalRoute(sub: string, method: string, body: any): Promise<Response | null> {
  const segs = sub.split('/').filter(Boolean); // ['proposal', ':id'?, 'approve'|'reject'|'execute'?] | ['audit', ':id'] | ['proposals']

  if (teresaDown && sub === '/proposal' && method === 'POST') {
    // Real transport failure — the fetch PROMISE rejects, matching what a
    // genuinely unreachable server looks like from the client's `fetch()`.
    throw new Error('dev-render teresaDown=1: simulated network failure contacting Teresa');
  }

  if (segs[0] === 'proposal' && segs.length === 1 && method === 'POST') {
    const id = `tprop-${(teresaSeq += 1)}`;
    const p: TeresaMockProposal = { id, state: 'proposal', targetModule: body.targetModule, targetPayload: body.targetPayload, handoffContext: body.handoffContext, auditTrail: [] };
    teresaAuditEntry(p, 'proposal_created', 'teresa', null, 'proposal', { target_module: body.targetModule });
    teresaProposals.set(id, p);
    return jsonResponse({ data: teresaEnvelope(p), meta: { action: 'proposal_created' } }, 201);
  }

  if (segs[0] === 'proposal' && segs.length === 2 && method === 'GET') {
    const p = teresaProposals.get(segs[1]);
    if (!p) return errorResponse('Proposal not found', 404, 'P08_PROPOSAL_NOT_FOUND');
    return jsonResponse({ data: teresaEnvelope(p) });
  }

  if (segs[0] === 'proposal' && segs.length === 3 && segs[2] === 'approve' && method === 'POST') {
    const p = teresaProposals.get(segs[1]);
    if (!p) return errorResponse('Proposal not found', 404, 'P08_PROPOSAL_NOT_FOUND');
    const from = p.state;
    p.state = 'approved';
    teresaAuditEntry(p, 'approved', 'user:user-piotr-demo', from, 'approved', null);
    return jsonResponse({ data: teresaEnvelope(p), meta: { action: 'approved' } });
  }

  if (segs[0] === 'proposal' && segs.length === 3 && segs[2] === 'reject' && method === 'POST') {
    const p = teresaProposals.get(segs[1]);
    if (!p) return errorResponse('Proposal not found', 404, 'P08_PROPOSAL_NOT_FOUND');
    const from = p.state;
    p.state = 'rejected';
    teresaAuditEntry(p, 'rejected', 'user:user-piotr-demo', from, 'rejected', body?.reason ? { reason: body.reason } : null);
    return jsonResponse({ data: teresaEnvelope(p), meta: { action: 'rejected' } });
  }

  if (segs[0] === 'proposal' && segs.length === 3 && segs[2] === 'execute' && method === 'POST') {
    const p = teresaProposals.get(segs[1]);
    if (!p) return errorResponse('Proposal not found', 404, 'P08_PROPOSAL_NOT_FOUND');
    if (p.state !== 'approved') return errorResponse(`Cannot execute proposal in state: ${p.state}`, 400, 'P08_INVALID_STATE_TRANSITION');
    teresaAuditEntry(p, 'execution_started', 'user:user-piotr-demo', 'approved', 'executing', null);

    // ROI pir_lessons_draft — the one wired-up mode.
    if (p.targetModule === 'roi') {
      const roiCtx = p.targetPayload?.roi_handoff_context;
      const pirId = roiCtx?.target_resource?.resource_id;
      const pir = pirs.find((x) => x.pirId === pirId);
      if (teresaRace && pirId === 'pir-2' && !teresaRaceConsumed) {
        // Deliberately-scripted concurrency scenario (see the `teresaRace`
        // header comment above) — simulate a human recording a disposition
        // on THIS pir between approve and execute, then evaluate the SAME
        // real guard `recordRoiPirTeresaLessonsDraft` uses.
        teresaRaceConsumed = true;
        if (pir) pir.teresaDraftDisposition = 'rejected';
      }
      if (!pir) {
        const execution = { success: false, proposal_id: p.id, target_module: 'roi', state: 'rejected' as TeresaEnvelopeState, audit_entry_id: '', error: `PIR ${pirId} not found`, degraded: 'tool_unavailable' };
        p.state = 'rejected';
        teresaAuditEntry(p, 'execution_failed', 'teresa:system', 'executing', 'rejected', { error: execution.error });
        return jsonResponse({ data: { execution, proposal: teresaEnvelope(p) }, meta: { action: 'executed' } }, 500);
      }
      if (pir.status !== 'draft') {
        const error = `PIR ${pirId} is "${pir.status}" — Teresa may only draft lessons while the PIR is a draft`;
        const execution = { success: false, proposal_id: p.id, target_module: 'roi', state: 'rejected' as TeresaEnvelopeState, audit_entry_id: '', error, degraded: 'tool_unavailable' };
        p.state = 'rejected';
        const auditEntry = teresaAuditEntry(p, 'execution_failed', 'teresa:system', 'executing', 'rejected', { error });
        execution.audit_entry_id = auditEntry.id;
        return jsonResponse({ data: { execution, proposal: teresaEnvelope(p) }, meta: { action: 'executed' } }, 500);
      }
      if (pir.teresaDraftDisposition !== null) {
        const error = `PIR ${pirId} already has a recorded Teresa draft disposition ("${pir.teresaDraftDisposition}") — regenerating would silently invalidate a human decision`;
        const execution = { success: false, proposal_id: p.id, target_module: 'roi', state: 'rejected' as TeresaEnvelopeState, audit_entry_id: '', error, degraded: 'tool_unavailable' };
        p.state = 'rejected';
        const auditEntry = teresaAuditEntry(p, 'execution_failed', 'teresa:system', 'executing', 'rejected', { error });
        execution.audit_entry_id = auditEntry.id;
        return jsonResponse({ data: { execution, proposal: teresaEnvelope(p) }, meta: { action: 'executed' } }, 500);
      }
      pir.teresaDraftLessonsPayload = roiCtx.pir_lessons_draft;
      pir.teresaDraftGeneratedAt = new Date().toISOString();
      pir.rowVersion += 1;
      pir.updatedAt = new Date().toISOString();
      p.state = 'completed';
      const auditEntry = teresaAuditEntry(p, 'execution_completed', 'roi_service', 'executing', 'completed', { handoff_result: { handoff: 'roi', advisor_mode: 'pir_lessons_draft', pir_id: pirId, real_entity: true } });
      const execution = { success: true, proposal_id: p.id, target_module: 'roi', state: 'completed' as TeresaEnvelopeState, audit_entry_id: auditEntry.id, handoff_result: { pir_id: pirId, real_entity: true } };
      return jsonResponse({ data: { execution, proposal: teresaEnvelope(p) }, meta: { action: 'executed' } });
    }

    const execution = { success: false, proposal_id: p.id, target_module: p.targetModule, state: 'rejected' as TeresaEnvelopeState, audit_entry_id: '', error: `dev-render mock: target_module "${p.targetModule}" not implemented`, degraded: 'tool_unavailable' };
    p.state = 'rejected';
    teresaAuditEntry(p, 'execution_failed', 'teresa:system', 'executing', 'rejected', { error: execution.error });
    return jsonResponse({ data: { execution, proposal: teresaEnvelope(p) }, meta: { action: 'executed' } }, 500);
  }

  if (segs[0] === 'audit' && segs.length === 2 && method === 'GET') {
    const p = teresaProposals.get(segs[1]);
    if (!p) return errorResponse('Proposal not found', 404, 'P08_PROPOSAL_NOT_FOUND');
    return jsonResponse({ data: p.auditTrail, meta: { count: p.auditTrail.length } });
  }

  return errorResponse(`dev-render Teresa mock: unmatched ${method} ${sub}`, 404, 'MOCK_UNMATCHED');
}

// ==========================================================================
// Router — one big match against method+path, mutating the DB above.
// ==========================================================================

const g = window as unknown as { __RVN_ROI_FULL_TOOL_FETCH__?: boolean };
if (!g.__RVN_ROI_FULL_TOOL_FETCH__) {
  g.__RVN_ROI_FULL_TOOL_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (rawUrl.includes('/locales/')) return realFetch(input as RequestInfo, init);

    // RN-G4 lane `teresa` (FALA 2, 2026-08-11) — P08 Teresa proposal
    // lifecycle, checked BEFORE the ROI-specific match below (disjoint path
    // prefixes, order doesn't matter functionally, but keeping the newer
    // block first makes it easier to find). Same `(\/.*)?$` capture +
    // `split('?')` convention the ROI branch below already uses.
    const teresaMatch = rawUrl.match(/\/v8\/teresa(\/.*)?$/);
    if (teresaMatch) {
      const method = (init?.method ?? 'GET').toUpperCase();
      const [teresaSub] = (teresaMatch[1] ?? '/').split('?');
      const teresaBody: any = init?.body ? JSON.parse(String(init.body)) : {};
      const resp = await handleTeresaProposalRoute(teresaSub, method, teresaBody);
      if (resp) return resp;
      return realFetch(input as RequestInfo, init);
    }

    const m = rawUrl.match(/\/vnext\/results\/roi(\/.*)?$/);
    if (!m) return realFetch(input as RequestInfo, init);

    const method = (init?.method ?? 'GET').toUpperCase();
    const [path] = (m[1] ?? '/').split('?');
    const body: any = init?.body ? JSON.parse(String(init.body)) : {};
    const seg = path.split('/').filter(Boolean); // e.g. ['cases','case-full-1','baseline']

    const bump = () => { roiCase.rowVersion += 1; roiCase.updatedAt = new Date().toISOString(); };

    // ---- org perspectives ----
    if (path === '/org/benefits-realization') {
      return jsonResponse({ attention: { cases: [{ caseId: CASE_ID, initiativeId: 'init-mes-1', title: roiCase.title, status: roiCase.status, approvedFinancialBenefits: null, actualFinancialBenefits: null, benefitsRealizationPct: null }], portfolioTotals: { totalApprovedFinancialBenefits: 0, totalActualFinancialBenefits: 0, caseCountWithActual: 0, caseCountTotal: 1 } } });
    }
    if (path === '/org/pir-outcomes') return jsonResponse({ pirOutcomes: [] });

    // ---- cases ----
    if (path === '/cases' && method === 'GET') {
      if (registryState === 'loading') return new Promise(() => { /* never resolves */ });
      if (registryState === 'error') return errorResponse('Upstream ROI service returned a 503.', 503, 'ROI_INTERNAL_ERROR');
      if (registryState === 'empty') return jsonResponse({ cases: [] });
      return jsonResponse({ cases: [roiCase] });
    }
    if (path === '/cases' && method === 'POST') {
      const created = { ...roiCase, caseId: nextId('case'), title: body.title, initiativeId: body.initiativeId, ownerUserId: body.ownerUserId, currency: body.currency, status: 'draft', rowVersion: 1 };
      return jsonResponse({ outcome: 'applied', created: true, case: created }, 201);
    }
    if (seg[0] === 'cases' && seg.length === 2 && method === 'GET') {
      if (seg[1] !== CASE_ID) return errorResponse('ROI case not found', 404, 'NOT_FOUND');
      return jsonResponse({ case: roiCase });
    }

    // ---- lifecycle transitions ----
    const transitionMatch = seg[0] === 'cases' && seg[2] === 'transitions';
    if (transitionMatch && method === 'POST') {
      const action = seg[3];
      const STATUS_AFTER: Record<string, string> = {
        'start-modeling': 'modeling', 'ready-for-review': 'ready_for_review',
        'submit-for-approval': 'submitted_for_approval', 'reopen-after-rejection': 'modeling',
        approve: 'approved', reject: 'rejected', 'request-changes': 'changes_requested',
        'reopen-for-revision': 'modeling', 'start-tracking': 'tracking',
        'start-benefits-realization': 'benefits_realization', cancel: 'cancelled',
        'mark-pir-due': 'post_investment_review_due', 'start-pir': 'post_investment_review',
        close: 'closed',
      };
      const next = STATUS_AFTER[action ?? ''];
      if (next) { roiCase.status = next as any; bump(); }
      if (action === 'approve') { approvalSnapshots.push({ snapshotId: nextId('snap'), caseId: CASE_ID, organizationId: ORG_ID, approvedBy: USER_ID, approvedAt: new Date().toISOString(), baselineSnapshot: {}, economicModelSnapshot: {}, calculationRunId: calcRuns[0]?.runId ?? 'run-1', createdAt: new Date().toISOString() }); return jsonResponse({ outcome: 'applied', case: roiCase, snapshot: approvalSnapshots[approvalSnapshots.length - 1] }); }
      if (action === 'start-pir' || action === 'close') { const pir = pirs[pirs.length - 1] ?? null; return jsonResponse({ outcome: 'applied', case: roiCase, pir }); }
      return jsonResponse({ outcome: 'applied', case: roiCase });
    }

    // ---- baseline ----
    if (seg[2] === 'baseline') {
      if (method === 'GET') return jsonResponse({ baseline });
      if (method === 'PUT') { Object.assign(baseline, body, { rowVersion: baseline.rowVersion + 1, updatedAt: new Date().toISOString() }); return jsonResponse({ outcome: 'applied', baseline }); }
    }
    // ---- calculation-policy ----
    if (seg[2] === 'calculation-policy') {
      if (method === 'GET') return jsonResponse({ calculationPolicy: policy });
      if (method === 'PUT') { Object.assign(policy, body, { rowVersion: policy.rowVersion + 1, updatedAt: new Date().toISOString() }); return jsonResponse({ outcome: 'applied', calculationPolicy: policy }); }
    }

    // ---- assumptions / cost-lines / benefit-lines (generic CRUD helper) ----
    function crud(resourceSeg: string, list: any[], idField: string, envelopeKey: string) {
      if (seg[2] !== resourceSeg) return null;
      if (seg.length === 3 && method === 'GET') return jsonResponse({ [`${envelopeKey}s`]: list });
      if (seg.length === 3 && method === 'POST') {
        const created = { ...body, [idField]: nextId(resourceSeg), caseId: CASE_ID, organizationId: ORG_ID, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        list.push(created);
        return jsonResponse({ outcome: 'applied', [envelopeKey]: created }, 201);
      }
      if (seg.length === 4 && method === 'PATCH') {
        const row = list.find((r) => r[idField] === seg[3]);
        if (!row) return errorResponse('Not found', 404, 'NOT_FOUND');
        Object.assign(row, body, { rowVersion: row.rowVersion + 1, updatedAt: new Date().toISOString() });
        return jsonResponse({ outcome: 'applied', [envelopeKey]: row });
      }
      if (seg.length === 4 && method === 'DELETE') {
        const row = list.find((r) => r[idField] === seg[3]);
        if (!row) return errorResponse('Not found', 404, 'NOT_FOUND');
        row.deletedAt = new Date().toISOString();
        return jsonResponse({ outcome: 'applied', [envelopeKey]: row });
      }
      return undefined; // matched resource, unmatched sub-path — fall through
    }
    const assumptionsResp = crud('assumptions', assumptions, 'assumptionId', 'assumption');
    if (assumptionsResp) return assumptionsResp;
    const costResp = crud('cost-lines', costLines, 'costLineId', 'costLine');
    if (costResp) return costResp;
    const benefitResp = crud('benefit-lines', benefitLines, 'benefitLineId', 'benefitLine');
    if (benefitResp) return benefitResp;

    // ---- KPI evidence links ----
    if (seg[2] === 'benefit-lines' && seg[4] === 'kpi-evidence-links') {
      const benefitLineId = seg[3];
      const links = (evidenceLinks[benefitLineId] ??= []);
      if (seg.length === 5 && method === 'GET') return jsonResponse({ links });
      if (seg.length === 5 && method === 'POST') {
        const created = { linkId: nextId('link'), benefitLineId, caseId: CASE_ID, organizationId: ORG_ID, kpiId: body.kpiId, pinnedKpiDefinitionVersionId: body.pinnedKpiDefinitionVersionId, expectedUnit: body.expectedUnit ?? null, purpose: body.purpose, linkedBy: USER_ID, linkedAt: new Date().toISOString(), freshnessCheckedAt: null, disputeStatus: 'none', notes: body.notes ?? null, rowVersion: 1, createdBy: USER_ID, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        links.push(created);
        return jsonResponse({ outcome: 'applied', link: created }, 201);
      }
      if (seg.length === 6 && method === 'DELETE') {
        const idx = links.findIndex((l) => l.linkId === seg[5]);
        if (idx >= 0) links.splice(idx, 1);
        return jsonResponse({ outcome: 'applied', linkId: seg[5] });
      }
      if (seg.length === 7 && seg[6] === 'freshness-check' && method === 'POST') {
        const link = links.find((l) => l.linkId === seg[5]);
        if (link) link.freshnessCheckedAt = new Date().toISOString();
        return jsonResponse({ outcome: 'applied', link });
      }
    }

    // ---- scenarios (+ overrides) ----
    if (seg[2] === 'scenarios') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ scenarios });
      if (seg.length === 3 && method === 'POST') {
        const created = { scenarioId: nextId('sc'), caseId: CASE_ID, organizationId: ORG_ID, scenarioType: body.scenarioType, label: body.label, description: body.description ?? null, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        scenarios.push(created);
        return jsonResponse({ outcome: 'applied', scenario: created }, 201);
      }
      if (seg.length === 4 && method === 'PATCH') {
        const s = scenarios.find((x) => x.scenarioId === seg[3]);
        if (!s) return errorResponse('Not found', 404, 'NOT_FOUND');
        Object.assign(s, { label: body.label ?? s.label, description: body.description ?? s.description, rowVersion: s.rowVersion + 1, updatedAt: new Date().toISOString() });
        return jsonResponse({ outcome: 'applied', scenario: s });
      }
      if (seg.length === 4 && method === 'DELETE') {
        const s = scenarios.find((x) => x.scenarioId === seg[3]);
        if (s) s.deletedAt = new Date().toISOString();
        return jsonResponse({ outcome: 'applied', scenario: s });
      }
      if (seg.length === 5 && seg[4] === 'overrides' && method === 'POST') {
        const created = { overrideId: nextId('ov'), scenarioId: seg[3], organizationId: ORG_ID, targetType: body.targetType, targetId: body.targetId, overrideValue: body.overrideValue ?? null, overrideAmount: body.overrideAmount ?? null, note: body.note ?? null, createdBy: USER_ID, createdAt: new Date().toISOString() };
        return jsonResponse({ outcome: 'applied', override: created }, 201);
      }
      if (seg.length === 6 && seg[4] === 'overrides' && method === 'DELETE') {
        return jsonResponse({ outcome: 'applied', overrideId: seg[5] });
      }
    }

    // ---- calculation-runs ----
    if (seg[2] === 'calculation-runs') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ runs: calcRuns });
      if (seg.length === 3 && method === 'POST') {
        const created = { ...calcRuns[0], runId: nextId('run'), scenarioId: body.scenarioId ?? null, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() };
        calcRuns.unshift(created);
        return jsonResponse({ outcome: 'applied', run: created }, 201);
      }
      if (seg.length === 4 && method === 'GET') {
        const run = calcRuns.find((r) => r.runId === seg[3]);
        return run ? jsonResponse({ run }) : errorResponse('Not found', 404, 'NOT_FOUND');
      }
    }

    // ---- approval-snapshots ----
    if (seg[2] === 'approval-snapshots') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ snapshots: approvalSnapshots });
      if (seg.length === 4 && method === 'GET') {
        const s = approvalSnapshots.find((x) => x.snapshotId === seg[3]);
        return s ? jsonResponse({ snapshot: s }) : errorResponse('Not found', 404, 'NOT_FOUND');
      }
    }

    // ---- forecast-versions + compare ----
    if (seg[2] === 'forecast-versions') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ forecastVersions });
      if (seg.length === 3 && method === 'POST') {
        const created = { forecastVersionId: nextId('fv'), caseId: CASE_ID, organizationId: ORG_ID, sequenceNumber: forecastVersions.length + 1, status: 'completed', totalCosts: 180000, totalFinancialBenefits: 250000, simpleRoi: 38.9, npv: 45000, irrPct: 26, irrStatus: 'computed', paybackPeriods: 8, discountedPaybackPeriods: 9, benefitCostRatio: 1.39, reason: body.reason, publishedBy: USER_ID, publishedAt: new Date().toISOString(), hasUnresolvedDoubleCounting: false, hasMixedCurrencyFailure: false, validationFindings: [], warnings: [], createdAt: new Date().toISOString() };
        forecastVersions.unshift(created);
        return jsonResponse({ outcome: 'applied', forecastVersion: created }, 201);
      }
      if (seg.length === 4 && method === 'GET') {
        const f = forecastVersions.find((x) => x.forecastVersionId === seg[3]);
        return f ? jsonResponse({ forecastVersion: f }) : errorResponse('Not found', 404, 'NOT_FOUND');
      }
    }
    if (seg[2] === 'compare' && method === 'GET') {
      return jsonResponse({ compare: { caseId: CASE_ID, metrics: { npv: { approved: null, forecast: forecastVersions[0]?.npv ?? null, actual: null }, simpleRoi: { approved: null, forecast: forecastVersions[0]?.simpleRoi ?? null, actual: null } } } });
    }

    // ---- actuals ----
    if (seg[2] === 'actuals' && seg.length === 3) {
      if (method === 'GET') return jsonResponse({ entries: actualEntries });
      if (method === 'POST') {
        const created = { actualEntryId: nextId('ae'), caseId: CASE_ID, organizationId: ORG_ID, entryType: body.entryType, costLineId: body.costLineId ?? null, benefitLineId: body.benefitLineId ?? null, periodStart: body.periodStart, periodEnd: body.periodEnd, amount: body.amount ?? null, currency: body.currency ?? null, dataQualityStatus: 'unverified', correctionOfActualEntryId: null, correctionReason: null, source: body.source, evidenceRefs: [], notes: body.notes ?? null, recordedBy: USER_ID, recordedAt: new Date().toISOString(), verifiedBy: null, verifiedAt: null, lineKey: body.costLineId ?? body.benefitLineId ?? 'none' };
        actualEntries.unshift(created);
        return jsonResponse({ outcome: 'applied', actualEntry: created }, 201);
      }
    }
    if (seg[2] === 'actuals' && seg.length === 4 && method === 'GET') {
      const e = actualEntries.find((x) => x.actualEntryId === seg[3]);
      return e ? jsonResponse({ actualEntry: e }) : errorResponse('Not found', 404, 'NOT_FOUND');
    }
    if (seg[2] === 'actuals' && seg.length === 5 && method === 'POST') {
      const original = actualEntries.find((x) => x.actualEntryId === seg[3]);
      if (!original) return errorResponse('Not found', 404, 'NOT_FOUND');
      const kind = seg[4];
      const superseding = { ...original, actualEntryId: nextId('ae'), correctionOfActualEntryId: original.actualEntryId, recordedAt: new Date().toISOString(),
        amount: kind === 'corrections' ? (body.amount ?? null) : original.amount,
        correctionReason: kind === 'corrections' ? body.correctionReason : kind === 'dispute' ? body.disputeReason : (body.notes ?? null),
        dataQualityStatus: kind === 'verify' ? 'verified' : kind === 'dispute' ? 'disputed' : original.dataQualityStatus,
        verifiedBy: kind === 'verify' ? USER_ID : null, verifiedAt: kind === 'verify' ? new Date().toISOString() : null };
      actualEntries.unshift(superseding);
      return jsonResponse({ outcome: 'applied', actualEntry: superseding }, 201);
    }

    // ---- actual-snapshots ----
    if (seg[2] === 'actual-snapshots') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ actualSnapshots });
      if (seg.length === 3 && method === 'POST') {
        const created = { actualSnapshotId: nextId('as'), caseId: CASE_ID, organizationId: ORG_ID, totalActualCosts: 90000, totalActualFinancialBenefits: 60000, actualSimpleRoi: -33.3, actualNpv: -12000, coveragePct: 40, periodsWithActualCount: 3, periodsExpectedCount: 8, unverifiedEntryCount: 1, disputedEntryCount: 0, entryIdsIncluded: actualEntries.map((e) => e.actualEntryId), sequenceNumber: actualSnapshots.length + 1, asOfPeriodEnd: body.asOfPeriodEnd, publishedBy: USER_ID, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
        actualSnapshots.unshift(created);
        return jsonResponse({ outcome: 'applied', actualSnapshot: created }, 201);
      }
      if (seg.length === 4 && method === 'GET') {
        const s = actualSnapshots.find((x) => x.actualSnapshotId === seg[3]);
        return s ? jsonResponse({ actualSnapshot: s }) : errorResponse('Not found', 404, 'NOT_FOUND');
      }
    }

    // ---- variances (+causes) ----
    if (seg[2] === 'variances') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ variances });
      if (seg.length === 3 && method === 'POST') {
        const created = { varianceId: nextId('var'), caseId: CASE_ID, organizationId: ORG_ID, comparisonType: body.comparisonType, metric: body.metric, referenceApprovalSnapshotId: body.referenceApprovalSnapshotId ?? null, referenceForecastVersionId: body.referenceForecastVersionId ?? null, referenceActualSnapshotId: body.referenceActualSnapshotId ?? null, baselineValue: 45000, comparisonValue: -12000, varianceAmount: -57000, variancePct: -126.7, status: 'open', ownerUserId: body.ownerUserId ?? null, rowVersion: 1, createdBy: USER_ID, createdAt: new Date().toISOString(), updatedBy: null, updatedAt: new Date().toISOString() };
        variances.unshift(created);
        return jsonResponse({ outcome: 'applied', variance: created }, 201);
      }
      if (seg.length === 4 && method === 'GET') {
        const v = variances.find((x) => x.varianceId === seg[3]);
        return v ? jsonResponse({ variance: v }) : errorResponse('Not found', 404, 'NOT_FOUND');
      }
      if (seg.length === 4 && method === 'PATCH') {
        const v = variances.find((x) => x.varianceId === seg[3]);
        if (!v) return errorResponse('Not found', 404, 'NOT_FOUND');
        Object.assign(v, { status: body.status ?? v.status, ownerUserId: body.ownerUserId ?? v.ownerUserId, rowVersion: v.rowVersion + 1, updatedAt: new Date().toISOString() });
        return jsonResponse({ outcome: 'applied', variance: v });
      }
      if (seg.length === 5 && seg[4] === 'causes' && method === 'POST') {
        const created = { causeId: nextId('cause'), varianceId: seg[3], organizationId: ORG_ID, causeCategory: body.causeCategory, contributionPct: body.contributionPct ?? null, narrative: body.narrative, createdBy: USER_ID, createdAt: new Date().toISOString() };
        (varianceCauses[seg[3]] ??= []).push(created);
        return jsonResponse({ outcome: 'applied', varianceCause: created }, 201);
      }
      if (seg.length === 6 && seg[4] === 'causes' && method === 'DELETE') {
        const list = varianceCauses[seg[3]] ?? [];
        const idx = list.findIndex((c) => c.causeId === seg[5]);
        if (idx >= 0) list.splice(idx, 1);
        return jsonResponse({ outcome: 'applied', causeId: seg[5] });
      }
    }

    // ---- benefits-realization (case-level) ----
    if (seg[2] === 'benefits-realization' && method === 'GET') {
      return jsonResponse({ benefitsRealization: { caseId: CASE_ID, approvedFinancialBenefits: null, actualFinancialBenefits: actualEntries.length > 0 ? 60000 : null, benefitsRealizationPct: null } });
    }

    // ---- PIR ----
    if (seg[2] === 'post-investment-review-schedule' && method === 'PUT') {
      roiCase.nextReviewAt = body.nextReviewAt; bump();
      return jsonResponse({ outcome: 'applied', case: roiCase });
    }
    if (seg[2] === 'post-investment-reviews') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ postInvestmentReviews: pirs });
      if (seg.length === 4 && method === 'GET') {
        const p = pirs.find((x) => x.pirId === seg[3]);
        return p ? jsonResponse({ postInvestmentReview: p }) : errorResponse('Not found', 404, 'NOT_FOUND');
      }
      if (seg.length === 4 && method === 'PATCH') {
        const p = pirs.find((x) => x.pirId === seg[3]);
        if (!p) return errorResponse('Not found', 404, 'NOT_FOUND');
        Object.assign(p, { outcome: body.outcome ?? p.outcome, lessonsLearned: body.lessonsLearned ?? p.lessonsLearned, recommendation: body.recommendation ?? p.recommendation, rowVersion: p.rowVersion + 1, updatedAt: new Date().toISOString() });
        return jsonResponse({ outcome: 'applied', postInvestmentReview: p });
      }
      if (seg.length === 5 && seg[4] === 'teresa-draft-disposition' && method === 'POST') {
        const p = pirs.find((x) => x.pirId === seg[3]);
        if (!p) return errorResponse('Not found', 404, 'NOT_FOUND');
        Object.assign(p, { teresaDraftDisposition: body.disposition, teresaDraftDispositionBy: USER_ID, teresaDraftDispositionAt: new Date().toISOString(), lessonsLearned: body.disposition !== 'rejected' ? body.finalLessonsText : p.lessonsLearned, rowVersion: p.rowVersion + 1 });
        return jsonResponse({ outcome: 'applied', postInvestmentReview: p });
      }
    }

    // ---- finance links / reconciliations / projections ----
    if (seg[2] === 'finance-links') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ financeLinks });
      if (seg.length === 3 && method === 'POST') {
        const created = { linkId: nextId('flink'), caseId: CASE_ID, organizationId: ORG_ID, financeArtifactType: body.financeArtifactType, financeArtifactId: body.financeArtifactId, financeVersionId: body.financeVersionId, mappingVersion: body.mappingVersion ?? 1, source: body.source, asOf: body.asOf, semanticUnit: body.semanticUnit ?? null, currency: body.currency ?? null, linkPurpose: body.linkPurpose, linkedBy: USER_ID, linkedAt: new Date().toISOString(), rowVersion: 1, createdBy: USER_ID, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        financeLinks.unshift(created);
        return jsonResponse({ outcome: 'applied', financeLink: created }, 201);
      }
      if (seg.length === 4 && method === 'DELETE') {
        const idx = financeLinks.findIndex((l) => l.linkId === seg[3]);
        const removed = idx >= 0 ? financeLinks.splice(idx, 1)[0] : null;
        return jsonResponse({ outcome: 'applied', financeLink: removed });
      }
    }
    if (seg[2] === 'finance-reconciliations') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ financeReconciliations });
      if (seg.length === 3 && method === 'POST') {
        const created = { reconciliationId: nextId('recon'), caseId: CASE_ID, organizationId: ORG_ID, financeLinkId: body.financeLinkId, roiValue: body.roiValue, financeValue: body.financeValue, divergenceReason: body.divergenceReason ?? null, status: 'open', openedBy: USER_ID, openedAt: new Date().toISOString(), resolvedBy: null, resolvedAt: null, resolutionNotes: null, rowVersion: 1 };
        financeReconciliations.unshift(created);
        return jsonResponse({ outcome: 'applied', financeReconciliation: created }, 201);
      }
      if (seg.length === 4 && method === 'PATCH') {
        const r = financeReconciliations.find((x) => x.reconciliationId === seg[3]);
        if (!r) return errorResponse('Not found', 404, 'NOT_FOUND');
        Object.assign(r, { status: body.status, resolutionNotes: body.resolutionNotes ?? r.resolutionNotes, resolvedBy: body.status === 'resolved' || body.status === 'accepted_divergence' ? USER_ID : r.resolvedBy, resolvedAt: body.status === 'resolved' || body.status === 'accepted_divergence' ? new Date().toISOString() : r.resolvedAt, rowVersion: r.rowVersion + 1 });
        return jsonResponse({ outcome: 'applied', financeReconciliation: r });
      }
    }
    if (seg[2] === 'finance-projections' && method === 'GET') return jsonResponse({ financeProjections: [] });

    // Unmatched — fail loudly rather than silently falling through to the
    // real network (a stray unmocked ROI endpoint should 404 visibly in the
    // harness, not hang on a real fetch that has nothing to answer it).
    return errorResponse(`dev-render ROI full-tool mock: unmatched ${method} ${path}`, 404, 'MOCK_UNMATCHED');
  };
}

const ResultsVNextRoiFullToolScreen: React.FC = () => (
  <div className="h-screen bg-c-bg text-c-text">
    <MemoryRouter initialEntries={['/results/roi']}>
      <ResultsRoiHub />
    </MemoryRouter>
  </div>
);

export default ResultsVNextRoiFullToolScreen;
