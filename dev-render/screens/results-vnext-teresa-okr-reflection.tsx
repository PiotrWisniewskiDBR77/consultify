/**
 * RN-G5 lane `teresa` (2026-08-12) — dev-render host for the REAL
 * `<OkrReviewReflectionView>` (`src/components/ResultsVNext/okr/
 * OkrReviewReflectionView.tsx`) with its new "Poproś Teresę o szkic
 * refleksji" action (the `reflection_synthesis` advisor mode wired via
 * `okrTeresaReflectionDraft.ts`), NO reimplementation — the production
 * component mounted with `window.fetch` stubbed for
 * `/api/vnext/results/okr/*` (same shapes as the pre-existing
 * `results-vnext-okr-workspace.tsx` harness — objective `progress`/KR
 * `progress` are UNCLAMPED 0-1 fraction STRINGS, e.g. `'1.3'` for
 * overachievement, per that harness's own documented mock-scale
 * precedent) PLUS a stateful mock of the REAL P08 Teresa proposal
 * lifecycle (`/api/v8/teresa/proposal*`), same `TeresaMockProposal` shape
 * the ROI/KPI harnesses already established.
 *
 * URL params:
 *   ?screen=results-vnext-teresa-okr-reflection
 *   &teresaDown=1   every `POST /v8/teresa/proposal` REJECTS the fetch
 *                   promise (real transport failure) so the panel reaches
 *                   `phase:'unavailable'` and the manual-fallback banner.
 *   &teresaDeny=1   the FIRST `execute` call denies with a domain-guard-
 *                   shaped error, so the panel reaches `phase:'denied'`
 *                   without ever showing a fabricated success.
 */
import React from 'react';

import { OkrReviewReflectionView } from '../../src/components/ResultsVNext/okr/OkrReviewReflectionView';
import type { OkrSetDto } from '../../src/components/ResultsVNext/okr/okrApi';

const harnessParams = new URLSearchParams(window.location.search);
const teresaDown = harnessParams.get('teresaDown') === '1';
const teresaDeny = harnessParams.get('teresaDeny') === '1';

const SET_ID = 'okr-set-teresa-1';
const ORG_ID = 'org-dbr77-demo';
const OWNER_ID = 'user-anna-kowalska';
const OBJECTIVE_ID = 'obj-teresa-1';

const MOCK_SET: OkrSetDto = {
  setId: SET_ID,
  organizationId: ORG_ID,
  programId: 'program-fy26',
  cycleId: 'cycle-fy26-h2',
  scopeType: 'individual',
  scopeId: OWNER_ID,
  ownerUserId: OWNER_ID,
  reviewerUserId: 'user-marek',
  title: 'Wdrożyć MES na 3 liniach produkcyjnych',
  status: 'review',
  submittedBy: OWNER_ID,
  submittedAt: '2026-06-01T09:00:00Z',
  approvedBy: 'user-marek',
  approvedAt: '2026-06-05T09:00:00Z',
  changesRequestedBy: null,
  changesRequestedAt: null,
  changesRequestedReason: null,
  currentVersion: 3,
  approvedVersion: 2,
  latestApprovedSnapshotId: 'snap-1-v2',
  // Real 0-1 fraction, unclamped-capable convention (per
  // `okrRegistryMappers.ts`'s own documented formatter/mock-scale bug
  // precedent — this is NOT 62.5, it is 0.625).
  overallProgress: '0.625',
  overallConfidence: 'medium',
  attentionState: 'watch',
  lastCheckinAt: '2026-08-05T09:00:00Z',
  nextCheckinDueAt: '2026-08-19T09:00:00Z',
  carriedFromSetId: null,
  rowVersion: 5,
  createdBy: OWNER_ID,
  createdAt: '2026-06-01T09:00:00Z',
  updatedBy: OWNER_ID,
  updatedAt: '2026-08-05T09:00:00Z',
};

let mutableObjective = {
  objectiveId: OBJECTIVE_ID,
  setId: SET_ID,
  organizationId: ORG_ID,
  ownerUserId: OWNER_ID,
  title: 'Uruchomić linię MES-1 w pełnej automatyzacji',
  description: 'Wdrożenie pełnego monitoringu produkcji na linii 1.',
  rationale: 'Linia 1 generuje najwięcej przestojów nieplanowanych.',
  ambitionType: 'committed' as const,
  status: 'active' as const,
  // Unclamped-capable 0-1 fraction (>1 legal for overachievement) — NOT a
  // 0-100 scale. See harness header.
  progress: '0.82',
  progressCalcPolicyVersionId: 'policy-1',
  progressCalcReason: 'equal_average over 1 calculable key result(s) (of 1 total)',
  confidence: 'high' as const,
  confidenceNumericValue: null,
  confidenceCalcPolicyVersionId: 'policy-1',
  confidenceCalcReason: 'lowest_kr: categorical confidence, worst of 1 key result(s)',
  sortOrder: 0,
  rowVersion: 4,
  createdBy: OWNER_ID,
  createdAt: '2026-06-02T09:00:00Z',
  updatedBy: OWNER_ID,
  updatedAt: '2026-08-05T09:00:00Z',
  approvedAt: '2026-06-05T09:00:00Z',
  keyResults: [
    {
      keyResultId: 'kr-teresa-1',
      objectiveId: OBJECTIVE_ID,
      setId: SET_ID,
      organizationId: ORG_ID,
      ownerUserId: OWNER_ID,
      title: 'Podłączyć 12 czujników PLC do systemu MES',
      description: null,
      measurementType: 'numeric' as const,
      unit: 'czujniki',
      currency: null,
      baselineValue: '0',
      targetValue: '12',
      startValue: '0',
      currentValue: '10',
      direction: 'increase' as const,
      rangeMin: null,
      rangeMax: null,
      progress: '0.8333333333',
      progressCalcPolicyVersionId: 'policy-1',
      progressCalcReason: 'increase: (current_value - baseline_value) / (target_value - baseline_value)',
      outOfRangeDistance: null,
      confidence: 'high' as const,
      confidenceNumericValue: null,
      status: 'on_track' as const,
      sourceType: 'manual' as const,
      sourceReference: null,
      weight: '1',
      rowVersion: 6,
      createdBy: OWNER_ID,
      createdAt: '2026-06-02T09:00:00Z',
      updatedBy: OWNER_ID,
      updatedAt: '2026-08-05T09:00:00Z',
    },
  ],
};

let mutableReflection: {
  reflectionId: string;
  setId: string;
  objectiveId: string;
  organizationId: string;
  status: 'draft' | 'finalized';
  finalScore: string | null;
  scoringModelUnsupported: boolean;
  finalScorePayload: null;
  scoringPolicyVersionId: null;
  scoredBy: null;
  scoredAt: null;
  whatWorked: string | null;
  whatDidNotWork: string | null;
  why: string | null;
  learning: string | null;
  nextCycleChange: string | null;
  disposition: string | null;
  finalizedBy: null;
  finalizedAt: null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
} = {
  reflectionId: 'refl-teresa-1',
  setId: SET_ID,
  objectiveId: OBJECTIVE_ID,
  organizationId: ORG_ID,
  status: 'draft',
  finalScore: null,
  scoringModelUnsupported: false,
  finalScorePayload: null,
  scoringPolicyVersionId: null,
  scoredBy: null,
  scoredAt: null,
  whatWorked: null,
  whatDidNotWork: null,
  why: null,
  learning: null,
  nextCycleChange: null,
  disposition: null,
  finalizedBy: null,
  finalizedAt: null,
  rowVersion: 0,
  createdBy: OWNER_ID,
  createdAt: '2026-08-10T09:00:00Z',
  updatedBy: null,
  updatedAt: '2026-08-10T09:00:00Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorResponse(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: message, code }, status);
}

// ==========================================================================
// Stateful mock of the REAL P08 Teresa proposal lifecycle
// (`server/src/routes/v8/teresa.routes.ts`), same shape as
// `results-vnext-roi-full-tool.tsx`/`results-vnext-teresa-kpi-deviation.tsx`
// — only the `execute()` OKR branch differs (calls
// `handleOkrReflectionSynthesis`'s real return shape verbatim, read off
// `teresaCopilotService.ts` L3390-3441).
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
let teresaDenyConsumed = false;

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

async function handleTeresaProposalRoute(sub: string, method: string, body: any): Promise<Response | null> {
  const segs = sub.split('/').filter(Boolean);

  if (teresaDown && sub === '/proposal' && method === 'POST') {
    throw new Error('dev-render teresaDown=1: simulated network failure contacting Teresa');
  }

  if (segs[0] === 'proposal' && segs.length === 1 && method === 'POST') {
    const id = `tprop-okr-${(teresaSeq += 1)}`;
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
    teresaAuditEntry(p, 'approved', `user:${OWNER_ID}`, from, 'approved', null);
    return jsonResponse({ data: teresaEnvelope(p), meta: { action: 'approved' } });
  }
  if (segs[0] === 'proposal' && segs.length === 3 && segs[2] === 'reject' && method === 'POST') {
    const p = teresaProposals.get(segs[1]);
    if (!p) return errorResponse('Proposal not found', 404, 'P08_PROPOSAL_NOT_FOUND');
    const from = p.state;
    p.state = 'rejected';
    teresaAuditEntry(p, 'rejected', `user:${OWNER_ID}`, from, 'rejected', body?.reason ? { reason: body.reason } : null);
    return jsonResponse({ data: teresaEnvelope(p), meta: { action: 'rejected' } });
  }
  if (segs[0] === 'proposal' && segs.length === 3 && segs[2] === 'execute' && method === 'POST') {
    const p = teresaProposals.get(segs[1]);
    if (!p) return errorResponse('Proposal not found', 404, 'P08_PROPOSAL_NOT_FOUND');
    if (p.state !== 'approved') return errorResponse(`Cannot execute proposal in state: ${p.state}`, 400, 'P08_INVALID_STATE_TRANSITION');
    teresaAuditEntry(p, 'execution_started', `user:${OWNER_ID}`, 'approved', 'executing', null);

    if (teresaDeny && !teresaDenyConsumed) {
      teresaDenyConsumed = true;
      const error = 'Refleksja została w międzyczasie zmieniona przez inną osobę (expected_version mismatch) — regenerowanie unieważniłoby jej treść.';
      const execution = { success: false, proposal_id: p.id, target_module: 'okr', state: 'rejected' as TeresaEnvelopeState, audit_entry_id: '', error, degraded: 'tool_unavailable' };
      p.state = 'rejected';
      const auditEntry = teresaAuditEntry(p, 'execution_failed', 'teresa:system', 'executing', 'rejected', { error });
      execution.audit_entry_id = auditEntry.id;
      return jsonResponse({ data: { execution, proposal: teresaEnvelope(p) }, meta: { action: 'executed' } }, 500);
    }

    if (p.targetModule === 'okr') {
      const okrCtx = p.targetPayload?.okr_handoff_context;
      const synthesis = okrCtx?.reflection_synthesis;
      if (okrCtx?.advisor_mode === 'reflection_synthesis' && synthesis) {
        mutableReflection = {
          ...mutableReflection,
          rowVersion: mutableReflection.rowVersion + 1,
          updatedAt: new Date().toISOString(),
        };
        p.state = 'completed';
        // Verbatim shape of `handleOkrReflectionSynthesis`'s real return
        // value (`teresaCopilotService.ts` L3430-3439) — NOT a fabricated
        // convenience shape.
        const handoffResult = {
          handoff: 'okr',
          advisor_mode: 'reflection_synthesis',
          objective_id: synthesis.objective_id,
          set_id: synthesis.set_id,
          row_version: mutableReflection.rowVersion,
          real_entity: true,
          outcome: 'applied',
          draft: {
            draft_reflection_text: synthesis.draft_reflection_text,
            proposed_disposition_hint: synthesis.proposed_disposition_hint,
            evidence_breakdown: synthesis.evidence_breakdown,
          },
        };
        const auditEntry = teresaAuditEntry(p, 'execution_completed', 'okr_service', 'executing', 'completed', { handoff_result: handoffResult });
        const execution = { success: true, proposal_id: p.id, target_module: 'okr', state: 'completed' as TeresaEnvelopeState, audit_entry_id: auditEntry.id, handoff_result: handoffResult };
        return jsonResponse({ data: { execution, proposal: teresaEnvelope(p) }, meta: { action: 'executed' } });
      }
    }

    const execution = { success: false, proposal_id: p.id, target_module: p.targetModule, state: 'rejected' as TeresaEnvelopeState, audit_entry_id: '', error: `dev-render mock: unhandled OKR advisor payload`, degraded: 'tool_unavailable' };
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

const g = window as unknown as { __RVN_TERESA_OKR_REFLECTION_FETCH__?: boolean };
if (!g.__RVN_TERESA_OKR_REFLECTION_FETCH__) {
  g.__RVN_TERESA_OKR_REFLECTION_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (rawUrl.includes('/locales/')) return realFetch(input as RequestInfo, init);

    const teresaMatch = rawUrl.match(/\/v8\/teresa(\/.*)?$/);
    if (teresaMatch) {
      const method = (init?.method ?? 'GET').toUpperCase();
      const [teresaSub] = (teresaMatch[1] ?? '/').split('?');
      const teresaBody: any = init?.body ? JSON.parse(String(init.body)) : {};
      const resp = await handleTeresaProposalRoute(teresaSub, method, teresaBody);
      if (resp) return resp;
      return realFetch(input as RequestInfo, init);
    }

    if (!rawUrl.includes('/api/vnext/results/okr/')) return realFetch(input as RequestInfo, init);
    const method = (init?.method || 'GET').toUpperCase();

    if (rawUrl.match(/\/sets\/[^/]+\/objectives$/) && method === 'GET') {
      return jsonResponse({ objectives: [mutableObjective] });
    }
    if (rawUrl.match(/\/sets\/[^/]+\/reviews$/) && method === 'GET') {
      return jsonResponse({ reviews: [] });
    }
    if (rawUrl.match(/\/objectives\/[^/]+\/reflection$/) && method === 'POST') {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      mutableReflection = {
        ...mutableReflection,
        whatWorked: body.whatWorked ?? mutableReflection.whatWorked,
        whatDidNotWork: body.whatDidNotWork ?? mutableReflection.whatDidNotWork,
        why: body.why ?? mutableReflection.why,
        learning: body.learning ?? mutableReflection.learning,
        nextCycleChange: body.nextCycleChange ?? mutableReflection.nextCycleChange,
        disposition: body.disposition ?? mutableReflection.disposition,
        rowVersion: mutableReflection.rowVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      return jsonResponse({ outcome: 'applied', reflection: mutableReflection });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function ResultsVNextTeresaOkrReflectionScreen() {
  return (
    <div className="h-screen w-screen bg-c-bg text-c-text">
      <OkrReviewReflectionView
        set={MOCK_SET}
        isPolish
        currentUserId={OWNER_ID}
        onSetChanged={() => {}}
      />
    </div>
  );
}
