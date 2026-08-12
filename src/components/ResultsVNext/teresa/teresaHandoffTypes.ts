/**
 * RN-G4 lane `teresa` (FALA 2, 2026-08-11) — client-side mirror of the P08
 * Teresa Copilot contract types actually needed by the ResultsVNext Teresa
 * surfaces (KPI/ROI/OKR advisor handoffs).
 *
 * These are a DELIBERATE, MINIMAL re-declaration, not an import — the
 * canonical types live in `server/src/services/v8/teresaCopilotCanon.ts`,
 * which is outside this package's allowlist (`server/**` is frozen for this
 * lane; a parallel session owns three files under
 * `server/src/database/PostgresDatabase.ts` and friends). Every field name/
 * shape below was read directly off that file (cited per-block) rather than
 * guessed — see the header comment of `teresaProposalApi.ts` for the exact
 * line ranges consulted.
 *
 * Server source of truth (read-only references, verified 2026-08-11):
 *  - `server/src/services/v8/teresaCopilotCanon.ts` L26-83 (`HandoffTargetModule`,
 *    `TeresaHandoffContext`), L147-254 (KPI-E006 payload types),
 *    L295-410 (OKR-E008 payload types, unused by this lane's ROI-only slice
 *    but kept for the shared shell contract), L412-529 (`P08_HANDOFF_TARGETS`
 *    entries for kpi/roi/okr — `required_extra_fields` verified per target).
 *  - `server/src/services/v8/teresaCopilotService.ts` L106-139
 *    (`HandoffResult`, `TeresaChatProposalEnvelope`), L731-741
 *    (`P08_ACTION_ENVELOPE_STATES`).
 *  - ROI's one real advisor mode (`pir_lessons_draft`) is the only mode this
 *    lane wires end-to-end to a live UI surface (see `roiTeresaLessonsDraft.ts`)
 *    — KPI/OKR types below are declared for the shared panel's type surface
 *    but have NO call site in this package (see FALA 2 report: KPI/OKR
 *    blockers).
 */

export type HandoffTargetModule =
  | 'radar'
  | 'initiatives'
  | 'calendar'
  | 'notebook'
  | 'interview'
  | 'excele'
  | 'ideas'
  | 'results'
  | 'kpi'
  | 'roi'
  | 'okr'
  | 'execution'
  | 'finance'
  | 'meeting'
  | 'outputs'
  | 'documents'
  | 'tables'
  | 'presentations';

/** Verbatim shape of `TeresaHandoffContext`
 * (`teresaCopilotCanon.ts` L46-83). Every field is REQUIRED by
 * `validateHandoffContext` (`P08_COMMON_PAYLOAD_FIELDS`, L713-725) except
 * `operation_contract_ref`. */
export interface TeresaHandoffContext {
  origin: 'teresa';
  user_intent: string;
  active_surface: string;
  org_context_ref: string;
  operation_contract_ref?: string | null;
  runtime_binding?: {
    conversation_id?: string | null;
    session_id?: string | null;
    context_snapshot_id?: string | null;
    execution_run_id?: string | null;
    artifact_run_id?: string | null;
    tool_invocation_id?: string | null;
  };
  bounded_context_pack: Array<{
    ref: string;
    type: string;
    deeplink?: string | null;
  }>;
  constraints: string[];
  assumptions: string[];
  uncertainty_boundary: {
    missing_inputs: string[];
    conflicts: string[];
    what_would_change_next_action: string[];
  };
  evidence_pointers: string[];
  proposed_next_action: {
    target_module: HandoffTargetModule;
    handoff_intent: 'open' | 'create' | 'append';
    requires_approval: true;
  };
  audit_stub: {
    actor: string;
    timestamp: string;
    proposal_id?: string | null;
  };
}

// ────────────────────────────────────────────────────────────────
// ROI-E008 — the one governed mode this lane wires to a real UI
// (`teresaCopilotCanon.ts` L219-254).
// ────────────────────────────────────────────────────────────────

export type ResultsRoiAdvisorMode = 'pir_lessons_draft';

export interface RoiPirLessonsAdvisorEvidenceBreakdown {
  facts: string[];
  inference: string[];
  missing_evidence: string[];
  recommendation: string;
}

export interface RoiPirLessonsDraftPayload {
  draft_lessons_text: string;
  evidence_breakdown: RoiPirLessonsAdvisorEvidenceBreakdown;
}

export interface ResultsRoiHandoffContext {
  advisor_mode: ResultsRoiAdvisorMode;
  target_resource: {
    resource_type: 'roi_pir';
    resource_id: string;
  };
  case_id: string;
  expected_version: number;
  pir_lessons_draft?: RoiPirLessonsDraftPayload;
}

// ────────────────────────────────────────────────────────────────
// OKR-E008 — `reflection_synthesis`, the one governed OKR mode this lane
// wires to a real UI surface (`okr/okrTeresaReflectionDraft.ts`).
// Verbatim mirror of `ResultsOkrHandoffContext`/`OkrReflectionSynthesisPayload`
// (`teresaCopilotCanon.ts` L385-410) — client-side re-declaration, not an
// import, same convention as the rest of this file (`server/**` frozen for
// this lane). Field names/shapes read directly off that file, not guessed:
// `set_id` is REQUIRED (a real divergence from an earlier design draft,
// per that file's own comment — `okr_vnext_reflections.set_id` is NOT
// NULL and the reflection row may not exist yet on first draft).
//
// CONFIRMED SERVER GAP (read via `server/src/routes/resultsVnext/okr.routes.ts`,
// grepped for `teresa-draft-disposition` — zero hits, vs. ROI's real route
// at `roi.routes.ts` L2798): `recordOkrReflectionTeresaDraftDisposition`
// exists as a command function but has NO REST route wired to it. Unlike
// ROI, this lane's OKR UI therefore cannot offer a second, dedicated
// "accept/reject the persisted draft" decision — see `okrTeresaReflectionDraft.ts`'s
// own header for how this is handled honestly instead of silently building
// a button that would call a route that does not exist.
// ────────────────────────────────────────────────────────────────

export type ResultsOkrAdvisorMode = 'reflection_synthesis';

export type OkrReflectionSynthesisDispositionHint = 'complete' | 'carry_forward' | 'drop' | 'redefine' | null;

export interface OkrReflectionSynthesisPayload {
  set_id: string;
  objective_id: string;
  draft_reflection_text: string;
  proposed_disposition_hint: OkrReflectionSynthesisDispositionHint;
  evidence_breakdown: RoiPirLessonsAdvisorEvidenceBreakdown;
}

export interface ResultsOkrHandoffContext {
  advisor_mode: ResultsOkrAdvisorMode;
  target_resource: {
    resource_type: 'okr_objective';
    resource_id: string;
  };
  expected_version: number;
  reflection_synthesis?: OkrReflectionSynthesisPayload;
}

// ────────────────────────────────────────────────────────────────
// P08 action envelope + chat proposal envelope
// (`teresaCopilotCanon.ts` L731-751, `teresaCopilotService.ts` L106-139)
// ────────────────────────────────────────────────────────────────

export const TERESA_ACTION_ENVELOPE_STATES = [
  'proposal',
  'pending_approval',
  'approved',
  'executing',
  'completed',
  'undone',
  'rejected',
] as const;
export type TeresaActionEnvelopeState = (typeof TERESA_ACTION_ENVELOPE_STATES)[number];

export interface TeresaAuditEntry {
  id: string;
  proposal_id: string;
  action: string;
  actor: string;
  timestamp: string;
  from_state: TeresaActionEnvelopeState | null;
  to_state: TeresaActionEnvelopeState;
  detail: Record<string, unknown> | null;
}

export interface TeresaHandoffExecutionResult {
  success: boolean;
  proposal_id: string;
  target_module: HandoffTargetModule;
  state: TeresaActionEnvelopeState;
  audit_entry_id: string;
  handoff_result?: Record<string, unknown>;
  degraded?: string;
  error?: string;
}

export interface TeresaChatProposalEnvelope {
  proposalId: string;
  contractId: string;
  title: string;
  summary: string;
  state: TeresaActionEnvelopeState;
  approvalState: 'awaiting_review' | 'approved' | 'completed' | 'rejected';
  allowedActions: Array<'approve' | 'reject' | 'execute' | 'undo' | 'navigate'>;
  targetModule: HandoffTargetModule;
  targetLabel: string;
  handoffIntent: string;
  previewLines: string[];
  auditCount: number;
  resultRef: string | null;
  degraded: string | null;
  operationContract?: unknown;
}
