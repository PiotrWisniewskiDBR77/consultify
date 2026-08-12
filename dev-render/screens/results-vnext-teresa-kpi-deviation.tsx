/**
 * RN-G5 lane `teresa` (2026-08-12) — dev-render host for the REAL
 * `<KpiDeviationCaseSubview>` (`src/components/ResultsVNext/kpiTool/
 * KpiDeviationCaseSubview.tsx`) with its "Ask Teresa" action (Phase 2, the
 * `reflection_rca` advisor mode wired via `kpiTeresaRcaDraft.ts`), no
 * reimplementation — the production component mounted with `Api.get`/
 * `Api.post`/`Api.put` stubbed for `/vnext/results/kpi*` (same convention
 * `results-vnext-kpi-tool.tsx` already uses for the same component) PLUS a
 * stateful `window.fetch` mock of the REAL P08 Teresa proposal lifecycle
 * (`/api/v8/teresa/proposal*`) so `TeresaProposalPanel` — mounted here with
 * zero reimplementation — drives it unmodified. Mirrors the `handleTeresa
 * ProposalRoute` shape `results-vnext-roi-full-tool.tsx` already
 * established for ROI's `pir_lessons_draft` mode; this file is the KPI
 * counterpart for `reflection_rca`.
 *
 * URL params:
 *   ?screen=results-vnext-teresa-kpi-deviation
 *   &teresaDown=1   every `POST /v8/teresa/proposal` REJECTS the fetch
 *                   promise (real transport failure) so the panel reaches
 *                   `phase:'unavailable'` and the manual-fallback banner.
 *   &teresaDeny=1   the FIRST `execute` call denies with a domain-guard-
 *                   shaped error (mirrors a real downstream self-approval
 *                   rejection becoming visible at execute time), so the
 *                   panel reaches `phase:'denied'` without ever showing a
 *                   fabricated success.
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { KpiDeviationCaseSubview } from '../../src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview';
import { ROUTES } from '../../src/routes/routeConfig';
import { Api } from '../../src/services/api';

const harnessParams = new URLSearchParams(window.location.search);
const teresaDown = harnessParams.get('teresaDown') === '1';
const teresaDeny = harnessParams.get('teresaDeny') === '1';

try {
  window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
} catch {
  // no-op — dev-render only
}

const KPI_ID = 'kpi-1';
const CASE_ID = 'case-1';
const ORG_ID = 'org-dbr77-demo';
const USER_ID = 'user-piotr-demo';

const MEASUREMENT = {
  measurementId: 'meas-1',
  kpiId: KPI_ID,
  periodEnd: '2026-08-07T23:59:59Z',
  actualValue: 74,
};

let mutableCase = {
  caseId: CASE_ID,
  organizationId: ORG_ID,
  kpiId: KPI_ID,
  triggerMeasurementId: MEASUREMENT.measurementId,
  severity: 'critical' as const,
  status: 'analysis_required' as string,
  escalated: false,
  escalatedAt: null as string | null,
  escalatedReason: null as string | null,
  escalatedBy: null as string | null,
  ownerUserId: USER_ID,
  managerUserId: 'user-marek',
  detectedAt: '2026-08-08T09:05:00Z',
  responseDueAt: '2026-08-10T09:05:00Z',
  rootCauseSummary: null as string | null,
  rootCauseCategory: null as string | null,
  recurrenceFlag: false,
  expectedRecoveryDate: null as string | null,
  expectedRecoveryValue: null as number | null,
  planSubmittedBy: null as string | null,
  planSubmittedAt: null as string | null,
  planApprovedBy: null as string | null,
  planApprovedAt: null as string | null,
  recoveryObservedBy: null as string | null,
  recoveryObservedAt: null as string | null,
  recoveryObservationMeasurementId: null as string | null,
  closedAt: null as string | null,
  closedBy: null as string | null,
  closeEffectivenessVerificationId: null as string | null,
  reopenedFromCaseId: null as string | null,
  rowVersion: 2,
  createdBy: 'system',
  createdAt: '2026-08-08T09:05:00Z',
  updatedAt: '2026-08-08T09:05:00Z',
};

function bump(update: Partial<typeof mutableCase>) {
  mutableCase = { ...mutableCase, ...update, rowVersion: mutableCase.rowVersion + 1, updatedAt: new Date().toISOString() };
  return mutableCase;
}

const realGet = Api.get.bind(Api);
const realPost = Api.post.bind(Api);
const realPut = Api.put.bind(Api);

Api.get = (async (url: string) => {
  if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/measurements`)) return { measurements: [MEASUREMENT] };
  if (url.startsWith('/vnext/results/kpi/deviation-cases/')) {
    const caseId = url.split('/vnext/results/kpi/deviation-cases/')[1]?.split('?')[0];
    if (caseId !== CASE_ID) {
      const err: any = new Error('Deviation case not found');
      err.status = 404;
      throw err;
    }
    return { case: mutableCase };
  }
  return realGet(url);
}) as typeof Api.get;

Api.post = (async (url: string, data: any) => {
  if (url.endsWith('/acknowledge')) return { outcome: 'applied', eventId: 'evt-1', resultingVersion: mutableCase.rowVersion + 1, case: bump({ status: 'analysis_required' }) };
  return realPost(url, data);
}) as typeof Api.post;

Api.put = (async (url: string, data: any) => {
  if (url.endsWith('/root-cause')) {
    return {
      outcome: 'applied',
      eventId: 'evt-rc',
      resultingVersion: mutableCase.rowVersion + 1,
      case: bump({
        status: 'plan_required',
        rootCauseSummary: data?.rootCauseSummary ?? null,
        rootCauseCategory: data?.rootCauseCategory ?? null,
        recurrenceFlag: !!data?.recurrenceFlag,
      }),
    };
  }
  return realPut(url, data);
}) as typeof Api.put;

// ==========================================================================
// Stateful mock of the REAL P08 Teresa proposal lifecycle
// (`server/src/routes/v8/teresa.routes.ts`), same shape as
// `results-vnext-roi-full-tool.tsx`'s own `handleTeresaProposalRoute` —
// only the `execute()` KPI branch differs (calls the case's root-cause
// write instead of ROI's PIR draft write).
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

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorResponse(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: message, code }, status);
}

async function handleTeresaProposalRoute(sub: string, method: string, body: any): Promise<Response | null> {
  const segs = sub.split('/').filter(Boolean);

  if (teresaDown && sub === '/proposal' && method === 'POST') {
    throw new Error('dev-render teresaDown=1: simulated network failure contacting Teresa');
  }

  if (segs[0] === 'proposal' && segs.length === 1 && method === 'POST') {
    const id = `tprop-kpi-${(teresaSeq += 1)}`;
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
    teresaAuditEntry(p, 'approved', `user:${USER_ID}`, from, 'approved', null);
    return jsonResponse({ data: teresaEnvelope(p), meta: { action: 'approved' } });
  }

  if (segs[0] === 'proposal' && segs.length === 3 && segs[2] === 'reject' && method === 'POST') {
    const p = teresaProposals.get(segs[1]);
    if (!p) return errorResponse('Proposal not found', 404, 'P08_PROPOSAL_NOT_FOUND');
    const from = p.state;
    p.state = 'rejected';
    teresaAuditEntry(p, 'rejected', `user:${USER_ID}`, from, 'rejected', body?.reason ? { reason: body.reason } : null);
    return jsonResponse({ data: teresaEnvelope(p), meta: { action: 'rejected' } });
  }

  if (segs[0] === 'proposal' && segs.length === 3 && segs[2] === 'execute' && method === 'POST') {
    const p = teresaProposals.get(segs[1]);
    if (!p) return errorResponse('Proposal not found', 404, 'P08_PROPOSAL_NOT_FOUND');
    if (p.state !== 'approved') return errorResponse(`Cannot execute proposal in state: ${p.state}`, 400, 'P08_INVALID_STATE_TRANSITION');
    teresaAuditEntry(p, 'execution_started', `user:${USER_ID}`, 'approved', 'executing', null);

    if (teresaDeny && !teresaDenyConsumed) {
      teresaDenyConsumed = true;
      const error = 'Sprawa została w międzyczasie zmieniona przez inną osobę (expected_version mismatch) — regenerowanie unieważniłoby jej decyzję.';
      const execution = { success: false, proposal_id: p.id, target_module: 'kpi', state: 'rejected' as TeresaEnvelopeState, audit_entry_id: '', error, degraded: 'tool_unavailable' };
      p.state = 'rejected';
      const auditEntry = teresaAuditEntry(p, 'execution_failed', 'teresa:system', 'executing', 'rejected', { error });
      execution.audit_entry_id = auditEntry.id;
      return jsonResponse({ data: { execution, proposal: teresaEnvelope(p) }, meta: { action: 'executed' } }, 500);
    }

    if (p.targetModule === 'kpi') {
      const kpiCtx = p.targetPayload?.kpi_handoff_context;
      const rca = kpiCtx?.reflection_rca;
      if (kpiCtx?.advisor_mode === 'reflection_rca' && rca) {
        bump({
          status: 'plan_required',
          rootCauseSummary: rca.proposed_root_cause_summary,
          rootCauseCategory: rca.proposed_root_cause_category,
          recurrenceFlag: !!rca.recurrence_flag,
        });
        p.state = 'completed';
        const auditEntry = teresaAuditEntry(p, 'execution_completed', 'kpi_service', 'executing', 'completed', {
          handoff_result: { handoff: 'kpi', advisor_mode: 'reflection_rca', case_id: CASE_ID, real_entity: true },
        });
        const execution = { success: true, proposal_id: p.id, target_module: 'kpi', state: 'completed' as TeresaEnvelopeState, audit_entry_id: auditEntry.id, handoff_result: { case_id: CASE_ID, case_status: mutableCase.status, real_entity: true } };
        return jsonResponse({ data: { execution, proposal: teresaEnvelope(p) }, meta: { action: 'executed' } });
      }
    }

    const execution = { success: false, proposal_id: p.id, target_module: p.targetModule, state: 'rejected' as TeresaEnvelopeState, audit_entry_id: '', error: `dev-render mock: unhandled KPI advisor payload`, degraded: 'tool_unavailable' };
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

const g = window as unknown as { __RVN_TERESA_KPI_DEVIATION_FETCH__?: boolean };
if (!g.__RVN_TERESA_KPI_DEVIATION_FETCH__) {
  g.__RVN_TERESA_KPI_DEVIATION_FETCH__ = true;
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
    }
    return realFetch(input as RequestInfo, init);
  };
}

const initialPath = ROUTES.RESULTS_KPI.DEVIATION_CASE.replace(':kpiId', KPI_ID).replace(':caseId', CASE_ID);

export default function ResultsVNextTeresaKpiDeviationScreen() {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <div className="h-screen w-screen">
        <Routes>
          <Route path={ROUTES.RESULTS_KPI.DEVIATION_CASE} element={<KpiDeviationCaseSubview />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}
