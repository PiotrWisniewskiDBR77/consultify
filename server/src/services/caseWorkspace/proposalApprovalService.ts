/**
 * Case Workspace — Action Proposal + Approval service (CW-P05, EPIC E6
 * "Proposals, autonomy and approvals").
 *
 * Backs the `case_workspace_action_proposals` and
 * `case_workspace_action_proposal_decisions` tables added in
 * server/migrations/20260809_case_workspace_proposals_approvals.sql. Those
 * tables are FK-only into `case_core(case_id)` [required],
 * `v8_execution_runs(run_id)` [required, read-only reference like CW-P04's
 * runBindingService.ts], `case_plan_versions(case_plan_version_id)`
 * [optional, per packet scope — CW-P02's own table] and
 * `case_workspace_capabilities(capability_registry_id)` [optional, per
 * packet scope — CW-P03's own table]. This service only ever SELECTs those
 * four tables and never INSERT/UPDATE/DELETEs any of them, and never
 * references Finance or Results tables/routes.
 *
 * `node_run_id` is stored as opaque unenforced TEXT — CW-RT-022 lists it as
 * required, but no confirmed canonical NodeRun table exists in this
 * codebase (v8_agent_branch_tasks.task_id is only a "loose analogy" per
 * CW-P04's own hedge — see open_questions below).
 *
 * `effect_class` reuses CapabilityEffectClass imported READ-ONLY from
 * capabilityRegistryService.ts (CW-P03), the same by-reference-reuse pattern
 * CW-P03 itself used for ApprovalClass from executionSpine.ts. Only
 * `payload_digest` (caller-supplied, never the raw payload — CW-DOD-C3
 * precedent) and opaque `policy_snapshot_ref`/`preview_ref` pointers are
 * stored, never the mutation payload or rendered diff itself.
 *
 * This packet deliberately does NOT build: the A0-A4 execution-class
 * classification logic for real capabilities (depends on CW-P03's registry
 * having real registered capabilities with effect classes — future work);
 * the three user AutonomyPolicy levels' enforcement (ASK_EACH_ACTION/
 * ASK_MATERIAL_ACTIONS/EXECUTE_APPROVED_PLAN — CW-01-018/019/020, DISTINCT
 * from the A0-A4 action classes this table's effect_class column carries —
 * do not conflate the two); or the Chat/Teresa integration (E8).
 * `effectClass` and `proposerType` are caller-supplied opaque inputs.
 *
 * req_id coverage (docs/product/case-workspace/acceptance/
 * FUNCTIONAL_REQUIREMENT_COVERAGE.csv, epics column contains "E6"):
 *
 *   createActionProposal          -> CW-RT-022, CW-RT-043, CW-GR-021, CW-RT-060, CW-01-013
 *   submitActionProposalForReview -> CW-RT-041, CW-RT-043
 *   recordApprovalDecision        -> CW-RT-022, CW-RT-023, CW-RT-041, CW-RT-053, CW-CANON-09,
 *                                     CW-CANON-10, CW-02-034, CW-03-014, CW-GR-027, CW-GR-028,
 *                                     CW-RT-060, CW-RT-061, GOV-022, CW-01-026-INV4, CW-01-026-INV5
 *   transitionProposalToExecuting -> CW-RT-041, CW-RT-042, CW-RT-023, CW-RT-061, CW-00-020-INV11,
 *                                     CW-RT-053
 *   transitionProposalToExecuted  -> CW-RT-041, CW-RT-042
 *   transitionProposalToFailed    -> CW-RT-041
 *   retryProposalFromFailed       -> CW-RT-041
 *   markProposalAudited           -> CW-RT-041
 *   revokeApprovedProposal        -> CW-RT-041
 *   getActionProposal             -> CW-GR-027
 *   listActionProposalsForCase    -> CW-RT-043
 *   listActionProposalsForRun     -> CW-GR-026
 *   listDecisionsForProposal      -> CW-02-034, CW-03-014
 *   computeProposalExpiryState    -> CW-RT-041
 *   computeProposalTargetValidity -> CW-RT-023, CW-RT-061, CW-00-020-INV11
 *
 * Cross-cutting invariants held by every mutating method here (see the
 * migration file's header for the exact canon citations):
 *   - a case_workspace_action_proposals row is immutable once created — no
 *     update-draft method exists anywhere in this file; a correction is a
 *     brand-new row via supersedes_action_proposal_id, exactly mirroring
 *     CasePlanVersion's supersede pattern, which structurally satisfies most
 *     of CW-RT-023's "changing payload... invalidates approval" (you
 *     literally cannot mutate payload post-creation);
 *   - status only moves per CW-RT-041's literal ALLOWED_TRANSITIONS map;
 *   - every mutating method uses loadForUpdate + `WHERE ... AND version =
 *     expectedVersion`; a 0-row UPDATE throws a *_version_conflict error
 *     with no partial write, matching every prior CW-P01-04 service exactly;
 *   - recordApprovalDecision rejects a decision whose caller-supplied
 *     proposalVersion/payloadDigest no longer match the live row
 *     (proposal_stale, maps to CW-GR-028's 409 STALE_PROPOSAL) and rejects
 *     an APPROVE attempted after expires_at has passed
 *     (proposal_review_window_expired);
 *   - recordApprovalDecision rejects decision='APPROVE' where
 *     decidedByActorId === proposal.createdByActorId
 *     (self_approval_forbidden — GOV-022's hard ceiling, scoped to APPROVE
 *     only, since a proposer rejecting/deferring their own proposal is not a
 *     governance bypass);
 *   - transitionProposalToExecuting re-SELECTs the referenced
 *     case_plan_versions/case_workspace_capabilities rows inside its own
 *     transaction and throws proposal_target_stale if the plan version is no
 *     longer PUBLISHED or the capability is no longer ACTIVE/healthy — this
 *     is the packet's "invalidation" enforcement, deliberately scoped only
 *     to the two FKs this packet owns (mirrors CW-P02's
 *     LOCAL_STRUCTURAL/DEFERRED_EXTERNAL split — target_expected_version's
 *     broader cross-module staleness is explicitly left to the future
 *     executor, see open_questions);
 *   - createActionProposal and recordApprovalDecision are idempotent via
 *     `INSERT ... ON CONFLICT DO NOTHING RETURNING *` then a SELECT+digest
 *     compare fallback — same convention proven in
 *     capabilityRegistryService.recordIdempotencyKeyCheck — a matching
 *     digest returns the original result (safe replay), a mismatched digest
 *     fails closed with idempotency_key_conflict;
 *   - EXECUTING/EXECUTED are always two distinct, separately-called
 *     transitions (CW-RT-042) — no method chains an APPROVE decision
 *     directly into an executed state;
 *   - every decision row is an append-only fact — no UPDATE/DELETE method
 *     exists against case_workspace_action_proposal_decisions anywhere.
 *
 * OPEN QUESTIONS (flagged in the approved design, carried forward here — not
 * resolved by this packet, product/API-owner confirmation needed):
 *   1. Three distinct "version"-shaped concepts now coexist on one row:
 *      proposal_version (domain ordinal), target_expected_version (opaque
 *      expectation of some OTHER module's aggregate), and version (this
 *      row's own OCC counter). Same naming-collision precedent CW-P02/CW-P03
 *      already flagged twice over — confirm exact public API field names
 *      before this ships in a route.
 *   2. CW-RT-022 lists runId and nodeRunId as required (no '?'), which this
 *      design honors as NOT NULL — but no confirmed canonical NodeRun table
 *      exists anywhere in this codebase (v8_agent_branch_tasks.task_id is
 *      only a "loose analogy" per CW-P04's own hedge, never an FK target
 *      here). Confirm the intended NodeRun identity source, and confirm
 *      whether an ActionProposal should ever legitimately exist before a
 *      Run/NodeRun is spun up (e.g. a Case-level proposal for a formal
 *      Decision) despite the literal non-optional schema.
 *   3. proposal_version's numbering scheme (MAX(proposal_version) per
 *      case_id + 1, mirroring CasePlanVersion.plan_number) is inferred, not
 *      specified anywhere in the ground-truth docs — an alternative reading
 *      (numbering only within a specific supersede-chain) is equally
 *      plausible. Confirm with product before this ships.
 *   4. target_expected_version's cross-module staleness (the real substance
 *      of CW-RT-023/CW-RT-061 for proposals whose ultimate mutation target
 *      is neither case_plan_versions nor case_workspace_capabilities — i.e.
 *      most real module targets) is NOT verified by this packet at all;
 *      transitionProposalToExecuting only re-checks the two FKs this packet
 *      owns. The future ExecuteApprovedProposal dispatcher, which alone has
 *      FK access to the real target module tables, must perform that check
 *      itself.
 *   5. Expiry semantics for CW-RT-041's PENDING_REVIEW->PENDING_REVIEW
 *      [EXPIRED] self-loop are interpreted here as "blocks a new APPROVE
 *      past expires_at, but does not block REJECT/REQUEST_CHANGES/DEFER" —
 *      canon does not disambiguate which decision types expiry should
 *      block. Confirm.
 *   6. DEFER's exact meaning (a non-status-changing audited "postponed"
 *      fact) is inferred from CW-RT-041 never naming DEFER as a
 *      status-machine trigger, combined with ApprovalDecision.decision
 *      separately enumerating it as a 4th choice. Confirm this reading with
 *      product before a route exposes it.
 *   7. No-self-approval enforcement is scoped to decision=APPROVE only;
 *      REJECT/REQUEST_CHANGES/DEFER from the proposer themselves are
 *      allowed. Confirm this is the intended scope of GOV-022's
 *      "no-self-approval" hard ceiling.
 *   8. transitionProposalToExecuting/Executed/Failed/Audited/
 *      revokeApprovedProposal rely on plain OCC only (no dedicated
 *      idempotency-key ledger), unlike createActionProposal/
 *      recordApprovalDecision. Confirm whether the future
 *      ExecuteApprovedProposal command (CW-RT-043, out of this packet's
 *      scope) needs its own idempotency table analogous to
 *      capabilityRegistryService's, since a naive retry of an
 *      EXECUTING->EXECUTED callback after a crash would otherwise surface as
 *      a hard proposal_version_conflict rather than a safe replay.
 *   9. revokeApprovedProposal only enforces the APPROVED->REVOKED
 *      state-machine guard; CW-RT-041's literal "before execution where
 *      policy permits" precondition needs a policy engine this packet does
 *      not build. Flag for whoever owns that future work.
 *  10. authenticationAssurance and approvalChannelPolicy have no
 *      canon-defined enumerated vocabulary anywhere in
 *      docs/product/case-workspace/*.md (the same gap CW-P03 already
 *      flagged for data_classification/idempotency_strategy/reversibility)
 *      — stored as free TEXT pending product confirmation.
 *  11. Tenant/membership fail-closed checks (CW-RT-065, CW-DOD-D5/D6) are
 *      not performed at this service layer — no method here takes an
 *      orgId/membership guard parameter, matching the existing convention
 *      (or gap) across all four sibling CW-P01-04 services, which also
 *      leave this to a route layer that does not yet exist anywhere in this
 *      codebase. Flag loudly before any of these methods are wired into a
 *      route.
 *  12. CW-00-015's LIGHT-Case single "Zatwierdź i rozpocznij" action
 *      (approve contract + publish plan v1 + start execution in one click)
 *      is explicitly NOT an ActionProposal under this design — it is an
 *      orchestration-layer composition of CW-P01's createCase, CW-P02's
 *      publishPlanVersion, and a future CreateRun/StartRun command. Flag to
 *      prevent a future caller conflating that combined-action UX with this
 *      packet's proposal/decision flow.
 */

import { v4 as uuidv4 } from 'uuid';

import {
  type PgTransactionClient,
  queryAll,
  queryOne,
  withPgTransaction,
} from '../../utils/queryHelpers.js';
import type { CapabilityEffectClass } from './capabilityRegistryService.js';
import { CaseWorkspaceAuthError, requireCaseAccess } from './caseWorkspaceAuthContext.js';

export type { CapabilityEffectClass };

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ActionProposalStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'AUDITED'
  | 'REJECTED'
  | 'REQUESTED_CHANGES'
  | 'REVOKED'
  | 'FAILED';

export type ProposalExpiryState = 'ACTIVE' | 'EXPIRED' | 'NO_EXPIRY';
export type ProposerType = 'HUMAN' | 'AGENT' | 'SYSTEM';
export type ApprovalDecisionType = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'DEFER';
export type ApprovalDecisionSource = 'BUTTON' | 'CONVERSATIONAL' | 'POLICY';

export interface CaseActor {
  actorUserId: string;
}

interface CaseWorkspaceActionProposalRow {
  action_proposal_id: string;
  organization_id: string;
  project_id: string | null;
  case_id: string;
  run_id: string;
  node_run_id: string;
  proposal_version: number;
  supersedes_action_proposal_id: string | null;
  payload_digest: string;
  target_expected_version: number | null;
  policy_snapshot_ref: string;
  effect_class: CapabilityEffectClass;
  preview_ref: string;
  case_plan_version_id: string | null;
  capability_registry_id: string | null;
  status: ActionProposalStatus;
  expires_at: string | null;
  idempotency_key: string;
  created_by_actor_id: string;
  proposer_type: ProposerType;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CaseActionProposal {
  actionProposalId: string;
  organizationId: string;
  projectId: string | null;
  caseId: string;
  runId: string;
  nodeRunId: string;
  proposalVersion: number;
  supersedesActionProposalId: string | null;
  payloadDigest: string;
  targetExpectedVersion: number | null;
  policySnapshotRef: string;
  effectClass: CapabilityEffectClass;
  previewRef: string;
  casePlanVersionId: string | null;
  capabilityRegistryId: string | null;
  status: ActionProposalStatus;
  expiresAt: string | null;
  idempotencyKey: string;
  createdByActorId: string;
  proposerType: ProposerType;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface CaseWorkspaceActionProposalDecisionRow {
  decision_id: string;
  action_proposal_id: string;
  proposal_version: number;
  payload_digest: string;
  target_expected_version: number | null;
  decision: ApprovalDecisionType;
  decided_by_actor_id: string;
  decided_at: string;
  source: ApprovalDecisionSource;
  authentication_assurance: string;
  approval_channel_policy: string;
  conversation_id: string | null;
  source_message_id: string | null;
  source_message_digest: string | null;
  policy_version: string;
  membership_snapshot_ref: string | null;
  reason: string | null;
  idempotency_key: string;
  created_at: string;
}

export interface ApprovalDecisionRecord {
  decisionId: string;
  actionProposalId: string;
  proposalVersion: number;
  payloadDigest: string;
  targetExpectedVersion: number | null;
  decision: ApprovalDecisionType;
  decidedByActorId: string;
  decidedAt: string;
  source: ApprovalDecisionSource;
  authenticationAssurance: string;
  approvalChannelPolicy: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  sourceMessageDigest: string | null;
  policyVersion: string;
  membershipSnapshotRef: string | null;
  reason: string | null;
  idempotencyKey: string;
  createdAt: string;
}

export interface CreateActionProposalInput {
  caseId: string;
  runId: string;
  nodeRunId: string;
  casePlanVersionId?: string | null;
  capabilityRegistryId?: string | null;
  supersedesActionProposalId?: string | null;
  payloadDigest: string;
  targetExpectedVersion?: number | null;
  policySnapshotRef: string;
  effectClass: CapabilityEffectClass;
  previewRef: string;
  expiresAt?: string | null;
  proposerType: ProposerType;
  createdByActorId: string;
  idempotencyKey: string;
}

export interface RecordApprovalDecisionInput {
  proposalVersion: number;
  payloadDigest: string;
  decision: ApprovalDecisionType;
  decidedByActorId: string;
  source: ApprovalDecisionSource;
  authenticationAssurance: string;
  approvalChannelPolicy: string;
  conversationId?: string | null;
  sourceMessageId?: string | null;
  sourceMessageDigest?: string | null;
  policyVersion: string;
  membershipSnapshotRef?: string | null;
  reason?: string | null;
  idempotencyKey: string;
}

export interface RecordApprovalDecisionResult {
  proposal: CaseActionProposal;
  decision: ApprovalDecisionRecord;
}

interface CaseCoreRefRow {
  case_id: string;
  organization_id: string;
  project_id: string;
}

interface V8ExecutionRunRefRow {
  run_id: string;
  organization_id: string;
}

interface CasePlanVersionRefRow {
  case_plan_version_id: string;
  case_id: string;
  status: string;
}

interface CapabilityRegistryRefRow {
  capability_registry_id: string;
  lifecycle: string;
  health: string;
}

export interface ProposalTargetValidityResult {
  valid: boolean;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROPOSAL_STATUSES: readonly ActionProposalStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'EXECUTING',
  'EXECUTED',
  'AUDITED',
  'REJECTED',
  'REQUESTED_CHANGES',
  'REVOKED',
  'FAILED',
];
const PROPOSER_TYPES: readonly ProposerType[] = ['HUMAN', 'AGENT', 'SYSTEM'];
const DECISION_TYPES: readonly ApprovalDecisionType[] = [
  'APPROVE',
  'REJECT',
  'REQUEST_CHANGES',
  'DEFER',
];
const DECISION_SOURCES: readonly ApprovalDecisionSource[] = ['BUTTON', 'CONVERSATIONAL', 'POLICY'];

// Terminal statuses a corrected resubmission may legitimately supersede.
const SUPERSEDABLE_STATUSES: readonly ActionProposalStatus[] = [
  'REQUESTED_CHANGES',
  'REJECTED',
  'REVOKED',
  'FAILED',
];

// CW-RT-041's literal state graph: DRAFT -> PENDING_REVIEW -> APPROVED ->
// EXECUTING -> EXECUTED -> AUDITED; PENDING_REVIEW -> {REJECTED,
// REQUESTED_CHANGES}; APPROVED -> REVOKED [before execution where policy
// permits]; EXECUTING -> FAILED -> APPROVED [controlled idempotent retry].
// The PENDING_REVIEW -> PENDING_REVIEW [EXPIRED] self-loop is deliberately
// NOT modeled here — see computeProposalExpiryState(), a pure overlay rather
// than a stored transition.
const ALLOWED_TRANSITIONS: Record<ActionProposalStatus, readonly ActionProposalStatus[]> = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'REQUESTED_CHANGES'],
  APPROVED: ['EXECUTING', 'REVOKED'],
  EXECUTING: ['EXECUTED', 'FAILED'],
  EXECUTED: ['AUDITED'],
  AUDITED: [],
  REJECTED: [],
  REQUESTED_CHANGES: [],
  REVOKED: [],
  FAILED: ['APPROVED'],
};

// ---------------------------------------------------------------------------
// Local helpers (mirrors caseCoreService.ts/casePlanVersionService.ts/
// capabilityRegistryService.ts/runBindingService.ts's own local helpers —
// not imported from there, each service file in this directory keeps its
// own copy per that file's existing convention).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

function requireEnum<T extends string>(
  value: T | null | undefined,
  allowed: readonly T[],
  reason: string
): T {
  if (!value || !allowed.includes(value)) throw new Error(reason);
  return value;
}

function mapRow(row: CaseWorkspaceActionProposalRow): CaseActionProposal {
  return {
    actionProposalId: row.action_proposal_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    caseId: row.case_id,
    runId: row.run_id,
    nodeRunId: row.node_run_id,
    proposalVersion: Number(row.proposal_version),
    supersedesActionProposalId: row.supersedes_action_proposal_id,
    payloadDigest: row.payload_digest,
    targetExpectedVersion:
      row.target_expected_version === null ? null : Number(row.target_expected_version),
    policySnapshotRef: row.policy_snapshot_ref,
    effectClass: row.effect_class,
    previewRef: row.preview_ref,
    casePlanVersionId: row.case_plan_version_id,
    capabilityRegistryId: row.capability_registry_id,
    status: row.status,
    expiresAt: row.expires_at,
    idempotencyKey: row.idempotency_key,
    createdByActorId: row.created_by_actor_id,
    proposerType: row.proposer_type,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDecisionRow(row: CaseWorkspaceActionProposalDecisionRow): ApprovalDecisionRecord {
  return {
    decisionId: row.decision_id,
    actionProposalId: row.action_proposal_id,
    proposalVersion: Number(row.proposal_version),
    payloadDigest: row.payload_digest,
    targetExpectedVersion:
      row.target_expected_version === null ? null : Number(row.target_expected_version),
    decision: row.decision,
    decidedByActorId: row.decided_by_actor_id,
    decidedAt: row.decided_at,
    source: row.source,
    authenticationAssurance: row.authentication_assurance,
    approvalChannelPolicy: row.approval_channel_policy,
    conversationId: row.conversation_id,
    sourceMessageId: row.source_message_id,
    sourceMessageDigest: row.source_message_digest,
    policyVersion: row.policy_version,
    membershipSnapshotRef: row.membership_snapshot_ref,
    reason: row.reason,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Row loaders
// ---------------------------------------------------------------------------

async function loadForUpdate(
  client: PgTransactionClient,
  actionProposalId: string
): Promise<CaseWorkspaceActionProposalRow> {
  const result = await client.query<CaseWorkspaceActionProposalRow>(
    `SELECT * FROM case_workspace_action_proposals WHERE action_proposal_id = ? FOR UPDATE`,
    [actionProposalId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('proposal_not_found');
  return row;
}

// ---------------------------------------------------------------------------
// Pure, read-only helpers (no DB access) — safe to call both standalone and
// from inside a caller's own transaction against rows already loaded there.
// ---------------------------------------------------------------------------

/**
 * CW-RT-041. Implements the PENDING_REVIEW -> PENDING_REVIEW [EXPIRED]
 * self-loop as a computed overlay rather than a stored transition:
 * `status` never becomes a literal 'EXPIRED' value (not a member of
 * ActionProposalStatus), this is purely a read-time projection.
 */
export function computeProposalExpiryState(
  proposal: Pick<CaseActionProposal, 'expiresAt'>,
  now: Date = new Date()
): ProposalExpiryState {
  if (!proposal.expiresAt) return 'NO_EXPIRY';
  const expiresAtMs = Date.parse(proposal.expiresAt);
  if (Number.isNaN(expiresAtMs)) return 'NO_EXPIRY';
  return expiresAtMs <= now.getTime() ? 'EXPIRED' : 'ACTIVE';
}

/**
 * CW-RT-023, CW-RT-061, CW-00-020-INV11. The packet's concrete "invalidation"
 * enforcement, scoped only to the two FKs this packet owns —
 * target_expected_version's broader cross-module staleness is explicitly
 * deferred (open_question #4). A null ref row means the corresponding FK was
 * never set on the proposal, which is always valid (both FKs are optional
 * per packet scope).
 */
export function computeProposalTargetValidity(
  planVersionRow: CasePlanVersionRefRow | null,
  capabilityRow: CapabilityRegistryRefRow | null
): ProposalTargetValidityResult {
  const reasons: string[] = [];

  if (planVersionRow && planVersionRow.status !== 'PUBLISHED') {
    reasons.push(`case_plan_version_not_published:${planVersionRow.status}`);
  }
  if (capabilityRow) {
    if (capabilityRow.lifecycle !== 'ACTIVE') {
      reasons.push(`capability_not_active:${capabilityRow.lifecycle}`);
    }
    if (capabilityRow.health === 'UNHEALTHY') {
      reasons.push('capability_unhealthy');
    }
  }

  return { valid: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * CW-RT-022 (ActionProposal schema), CW-RT-043, CW-GR-021 (CommandEnvelope
 * idempotencyKey + actor), CW-RT-060 (duplicate dispatch produces one
 * effect), CW-01-013 (Proposal is an exact proposed mutation or plan
 * change).
 *
 * In one transaction: FOR-UPDATE-locks case_core to serialize
 * proposal_version numbering for this case_id (mirrors
 * casePlanVersionService.createPlanDraft's own case_core lock); read-only
 * verifies run_id exists in v8_execution_runs and its organization_id
 * matches the resolved Case's organization_id (else run_case_organization_
 * mismatch, same guard shape as runBindingService.bindRunToPlanVersion);
 * if casePlanVersionId is given, verifies it belongs to the same case; if
 * capabilityRegistryId is given, verifies it exists; if
 * supersedesActionProposalId is given, verifies it belongs to the same case
 * and is in a terminal status (REQUESTED_CHANGES/REJECTED/REVOKED/FAILED),
 * and derives proposal_version = supersedes.proposal_version + 1, else
 * MAX(proposal_version) WHERE case_id=? + 1 (open_question #3). Idempotency
 * via `INSERT ... ON CONFLICT (case_id, idempotency_key) DO NOTHING
 * RETURNING *`, falling back to SELECT+payload_digest compare
 * (idempotency_key_conflict on mismatch, else returns the original result
 * unchanged — safe replay). INSERTs with status='DRAFT', version=1.
 */
export async function createActionProposal(
  input: CreateActionProposalInput
): Promise<CaseActionProposal> {
  const caseId = requireNonBlank(input.caseId, 'proposal_case_id_required');
  const runId = requireNonBlank(input.runId, 'proposal_run_id_required');
  const nodeRunId = requireNonBlank(input.nodeRunId, 'proposal_node_run_id_required');
  const payloadDigest = requireNonBlank(input.payloadDigest, 'proposal_payload_digest_required');
  const policySnapshotRef = requireNonBlank(
    input.policySnapshotRef,
    'proposal_policy_snapshot_ref_required'
  );
  const previewRef = requireNonBlank(input.previewRef, 'proposal_preview_ref_required');
  const createdByActorId = requireNonBlank(
    input.createdByActorId,
    'proposal_created_by_actor_required'
  );
  const idempotencyKey = requireNonBlank(input.idempotencyKey, 'proposal_idempotency_key_required');
  const effectClass = requireEnum(
    input.effectClass,
    [
      'SAFE_ADDITIVE',
      'SAFE_UPDATE',
      'SENSITIVE_UPDATE',
      'DESTRUCTIVE',
      'GOVERNANCE_TRANSITION',
    ] as const,
    'proposal_effect_class_invalid'
  );
  const proposerType = requireEnum(
    input.proposerType,
    PROPOSER_TYPES,
    'proposal_proposer_type_invalid'
  );

  await requireCaseAccess(createdByActorId, caseId);

  return withPgTransaction(async (client) => {
    const caseResult = await client.query<CaseCoreRefRow>(
      `SELECT case_id, organization_id, project_id FROM case_core WHERE case_id = ? FOR UPDATE`,
      [caseId]
    );
    const caseRow = caseResult.rows[0];
    if (!caseRow) throw new Error('proposal_case_not_found');

    const runResult = await client.query<V8ExecutionRunRefRow>(
      `SELECT run_id, organization_id FROM v8_execution_runs WHERE run_id = ?`,
      [runId]
    );
    const run = runResult.rows[0];
    if (!run) throw new Error('proposal_run_not_found');
    if (run.organization_id !== caseRow.organization_id) {
      throw new Error('run_case_organization_mismatch');
    }

    if (input.casePlanVersionId) {
      const planVersionResult = await client.query<{
        case_plan_version_id: string;
        case_id: string;
      }>(
        `SELECT case_plan_version_id, case_id FROM case_plan_versions WHERE case_plan_version_id = ?`,
        [input.casePlanVersionId]
      );
      const planVersion = planVersionResult.rows[0];
      if (!planVersion || planVersion.case_id !== caseId) {
        throw new Error('proposal_case_plan_version_invalid');
      }
    }

    if (input.capabilityRegistryId) {
      const capabilityResult = await client.query<{ capability_registry_id: string }>(
        `SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_registry_id = ?`,
        [input.capabilityRegistryId]
      );
      if (!capabilityResult.rows[0]) throw new Error('proposal_capability_not_found');
    }

    let proposalVersion: number;
    let supersedesActionProposalId: string | null = null;
    if (input.supersedesActionProposalId) {
      const supersedesResult = await client.query<CaseWorkspaceActionProposalRow>(
        `SELECT * FROM case_workspace_action_proposals WHERE action_proposal_id = ?`,
        [input.supersedesActionProposalId]
      );
      const target = supersedesResult.rows[0];
      if (!target || target.case_id !== caseId || !SUPERSEDABLE_STATUSES.includes(target.status)) {
        throw new Error('proposal_supersedes_target_invalid');
      }
      supersedesActionProposalId = target.action_proposal_id;
      proposalVersion = Number(target.proposal_version) + 1;
    } else {
      const proposalVersionResult = await client.query<{ next_proposal_version: number }>(
        `SELECT COALESCE(MAX(proposal_version), 0) + 1 AS next_proposal_version
           FROM case_workspace_action_proposals WHERE case_id = ?`,
        [caseId]
      );
      proposalVersion = Number(proposalVersionResult.rows[0]?.next_proposal_version ?? 1);
    }

    const actionProposalId = `cwprop-${uuidv4()}`;
    const now = new Date().toISOString();

    const inserted = await client.query<CaseWorkspaceActionProposalRow>(
      `INSERT INTO case_workspace_action_proposals (
         action_proposal_id, organization_id, project_id, case_id, run_id,
         node_run_id, proposal_version, supersedes_action_proposal_id,
         payload_digest, target_expected_version, policy_snapshot_ref,
         effect_class, preview_ref, case_plan_version_id,
         capability_registry_id, status, expires_at, idempotency_key,
         created_by_actor_id, proposer_type, version, created_at, updated_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 1, ?, ?
       )
       ON CONFLICT (case_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        actionProposalId,
        caseRow.organization_id,
        caseRow.project_id,
        caseId,
        run.run_id,
        nodeRunId,
        proposalVersion,
        supersedesActionProposalId,
        payloadDigest,
        input.targetExpectedVersion ?? null,
        policySnapshotRef,
        effectClass,
        previewRef,
        input.casePlanVersionId ?? null,
        input.capabilityRegistryId ?? null,
        input.expiresAt ?? null,
        idempotencyKey,
        createdByActorId,
        proposerType,
        now,
        now,
      ]
    );

    if (inserted.rows[0]) {
      return mapRow(inserted.rows[0]);
    }

    const existingResult = await client.query<CaseWorkspaceActionProposalRow>(
      `SELECT * FROM case_workspace_action_proposals WHERE case_id = ? AND idempotency_key = ?`,
      [caseId, idempotencyKey]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error('proposal_idempotency_record_not_found');
    if (existing.payload_digest !== payloadDigest) {
      throw new Error('idempotency_key_conflict');
    }
    return mapRow(existing);
  });
}

/** CW-RT-041, CW-RT-043. DRAFT -> PENDING_REVIEW. */
export async function submitActionProposalForReview(
  actionProposalId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<CaseActionProposal> {
  const id = requireNonBlank(actionProposalId, 'proposal_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'proposal_actor_required');
  if (typeof expectedVersion !== 'number') throw new Error('proposal_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actorUserId, row.case_id);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('PENDING_REVIEW')) {
      throw new Error(`proposal_status_transition_not_allowed:${row.status}->PENDING_REVIEW`);
    }

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceActionProposalRow>(
      `UPDATE case_workspace_action_proposals
          SET status = 'PENDING_REVIEW', version = version + 1, updated_at = ?
        WHERE action_proposal_id = ? AND version = ?
        RETURNING *`,
      [now, id, expectedVersion]
    );
    if (!updated.rows[0]) throw new Error('proposal_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/**
 * CW-RT-022, CW-RT-023, CW-RT-041, CW-RT-053, CW-CANON-09, CW-CANON-10,
 * CW-02-034, CW-03-014, CW-GR-027, CW-GR-028, CW-RT-060, CW-RT-061,
 * GOV-022, CW-01-026-INV4, CW-01-026-INV5.
 *
 * loadForUpdate's the proposal; requires status='PENDING_REVIEW' (else
 * proposal_status_transition_not_allowed); requires
 * input.proposalVersion/payloadDigest to match the live row (else
 * proposal_stale, maps to CW-GR-028's 409 STALE_PROPOSAL); for
 * decision='APPROVE', requires expires_at (if set) has not passed (else
 * proposal_review_window_expired) and requires decidedByActorId !==
 * proposal.createdByActorId (else self_approval_forbidden — GOV-022's hard
 * ceiling). Idempotency via `INSERT ... ON CONFLICT (action_proposal_id,
 * idempotency_key) DO NOTHING RETURNING *` on the decisions table, falling
 * back to SELECT+decision/payload_digest compare (idempotency_key_conflict
 * on mismatch, else returns the original result unchanged — safe replay).
 * INSERTs the decision row snapshotting proposal_version/payload_digest/
 * target_expected_version VERBATIM from the live proposal row. DEFER leaves
 * proposal.status untouched (no OCC update on the proposal — see
 * open_question #6). APPROVE/REJECT/REQUEST_CHANGES map to APPROVED/
 * REJECTED/REQUESTED_CHANGES via a `WHERE version = expectedVersion` OCC
 * update (0 rows -> proposal_version_conflict).
 */
export async function recordApprovalDecision(
  actionProposalId: string,
  input: RecordApprovalDecisionInput,
  expectedVersion: number
): Promise<RecordApprovalDecisionResult> {
  const id = requireNonBlank(actionProposalId, 'proposal_id_required');
  const decidedByActorId = requireNonBlank(
    input.decidedByActorId,
    'proposal_decision_actor_required'
  );
  const authenticationAssurance = requireNonBlank(
    input.authenticationAssurance,
    'proposal_decision_authentication_assurance_required'
  );
  const approvalChannelPolicy = requireNonBlank(
    input.approvalChannelPolicy,
    'proposal_decision_approval_channel_policy_required'
  );
  const policyVersion = requireNonBlank(
    input.policyVersion,
    'proposal_decision_policy_version_required'
  );
  const idempotencyKey = requireNonBlank(
    input.idempotencyKey,
    'proposal_decision_idempotency_key_required'
  );
  const decision = requireEnum(input.decision, DECISION_TYPES, 'proposal_decision_invalid');
  const source = requireEnum(input.source, DECISION_SOURCES, 'proposal_decision_source_invalid');
  if (typeof input.proposalVersion !== 'number') {
    throw new Error('proposal_decision_proposal_version_required');
  }
  const payloadDigest = requireNonBlank(
    input.payloadDigest,
    'proposal_decision_payload_digest_required'
  );
  if (typeof expectedVersion !== 'number') throw new Error('proposal_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(decidedByActorId, row.case_id);
    if (row.status !== 'PENDING_REVIEW') {
      throw new Error(`proposal_status_transition_not_allowed:${row.status}->decision`);
    }
    if (row.proposal_version !== input.proposalVersion || row.payload_digest !== payloadDigest) {
      throw new Error('proposal_stale');
    }
    if (decision === 'APPROVE') {
      if (computeProposalExpiryState(mapRow(row)) === 'EXPIRED') {
        throw new Error('proposal_review_window_expired');
      }
      if (decidedByActorId === row.created_by_actor_id) {
        throw new Error('self_approval_forbidden');
      }
    }

    const now = new Date().toISOString();
    const decisionId = `cwpropdec-${uuidv4()}`;

    const insertedDecision = await client.query<CaseWorkspaceActionProposalDecisionRow>(
      `INSERT INTO case_workspace_action_proposal_decisions (
         decision_id, action_proposal_id, proposal_version, payload_digest,
         target_expected_version, decision, decided_by_actor_id, decided_at,
         source, authentication_assurance, approval_channel_policy,
         conversation_id, source_message_id, source_message_digest,
         policy_version, membership_snapshot_ref, reason, idempotency_key,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (action_proposal_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        decisionId,
        id,
        row.proposal_version,
        row.payload_digest,
        row.target_expected_version,
        decision,
        decidedByActorId,
        now,
        source,
        authenticationAssurance,
        approvalChannelPolicy,
        input.conversationId ?? null,
        input.sourceMessageId ?? null,
        input.sourceMessageDigest ?? null,
        policyVersion,
        input.membershipSnapshotRef ?? null,
        input.reason ?? null,
        idempotencyKey,
        now,
      ]
    );

    let decisionRecord: CaseWorkspaceActionProposalDecisionRow;
    let isReplay = false;
    if (insertedDecision.rows[0]) {
      decisionRecord = insertedDecision.rows[0];
    } else {
      const existingResult = await client.query<CaseWorkspaceActionProposalDecisionRow>(
        `SELECT * FROM case_workspace_action_proposal_decisions
          WHERE action_proposal_id = ? AND idempotency_key = ?`,
        [id, idempotencyKey]
      );
      const existing = existingResult.rows[0];
      if (!existing) throw new Error('proposal_decision_idempotency_record_not_found');
      if (existing.decision !== decision || existing.payload_digest !== payloadDigest) {
        throw new Error('idempotency_key_conflict');
      }
      decisionRecord = existing;
      isReplay = true;
    }

    if (decision === 'DEFER') {
      // CW-RT-041 never lists DEFER as a status-machine trigger — proposal
      // status is left untouched (open_question #6). Re-read the current
      // row (unchanged by this branch) so the returned proposal reflects
      // reality even on a replayed call.
      const currentResult = await client.query<CaseWorkspaceActionProposalRow>(
        `SELECT * FROM case_workspace_action_proposals WHERE action_proposal_id = ?`,
        [id]
      );
      return { proposal: mapRow(currentResult.rows[0]!), decision: mapDecisionRow(decisionRecord) };
    }

    if (isReplay) {
      // A safe replay of a non-DEFER decision must not re-attempt the OCC
      // status transition (the first call already applied it) — just
      // return the current state.
      const currentResult = await client.query<CaseWorkspaceActionProposalRow>(
        `SELECT * FROM case_workspace_action_proposals WHERE action_proposal_id = ?`,
        [id]
      );
      return { proposal: mapRow(currentResult.rows[0]!), decision: mapDecisionRow(decisionRecord) };
    }

    const nextStatus: ActionProposalStatus =
      decision === 'APPROVE'
        ? 'APPROVED'
        : decision === 'REJECT'
          ? 'REJECTED'
          : 'REQUESTED_CHANGES';
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes(nextStatus)) {
      throw new Error(`proposal_status_transition_not_allowed:${row.status}->${nextStatus}`);
    }

    const updated = await client.query<CaseWorkspaceActionProposalRow>(
      `UPDATE case_workspace_action_proposals
          SET status = ?, version = version + 1, updated_at = ?
        WHERE action_proposal_id = ? AND version = ?
        RETURNING *`,
      [nextStatus, now, id, expectedVersion]
    );
    if (!updated.rows[0]) throw new Error('proposal_version_conflict');
    return { proposal: mapRow(updated.rows[0]), decision: mapDecisionRow(decisionRecord) };
  });
}

/**
 * CW-RT-041, CW-RT-042, CW-RT-023, CW-RT-061, CW-00-020-INV11, CW-RT-053.
 *
 * APPROVED -> EXECUTING. Inside the same transaction, re-SELECTs the
 * referenced case_plan_versions row (if case_plan_version_id is set) and
 * case_workspace_capabilities row (if capability_registry_id is set) and
 * runs computeProposalTargetValidity() over them; throws
 * `proposal_target_stale:<reasons>` with no mutation if invalid. This is
 * the packet's concrete "invalidation" enforcement, scoped to the two FKs
 * it owns (open_question #4).
 */
export async function transitionProposalToExecuting(
  actionProposalId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<CaseActionProposal> {
  const id = requireNonBlank(actionProposalId, 'proposal_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'proposal_actor_required');
  if (typeof expectedVersion !== 'number') throw new Error('proposal_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actorUserId, row.case_id);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('EXECUTING')) {
      throw new Error(`proposal_status_transition_not_allowed:${row.status}->EXECUTING`);
    }

    let planVersionRow: CasePlanVersionRefRow | null = null;
    if (row.case_plan_version_id) {
      const planVersionResult = await client.query<CasePlanVersionRefRow>(
        `SELECT case_plan_version_id, case_id, status FROM case_plan_versions
          WHERE case_plan_version_id = ?`,
        [row.case_plan_version_id]
      );
      planVersionRow = planVersionResult.rows[0] ?? null;
    }

    let capabilityRow: CapabilityRegistryRefRow | null = null;
    if (row.capability_registry_id) {
      const capabilityResult = await client.query<CapabilityRegistryRefRow>(
        `SELECT capability_registry_id, lifecycle, health FROM case_workspace_capabilities
          WHERE capability_registry_id = ?`,
        [row.capability_registry_id]
      );
      capabilityRow = capabilityResult.rows[0] ?? null;
    }

    const validity = computeProposalTargetValidity(planVersionRow, capabilityRow);
    if (!validity.valid) {
      throw new Error(`proposal_target_stale:${validity.reasons.join(',')}`);
    }

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceActionProposalRow>(
      `UPDATE case_workspace_action_proposals
          SET status = 'EXECUTING', version = version + 1, updated_at = ?
        WHERE action_proposal_id = ? AND version = ?
        RETURNING *`,
      [now, id, expectedVersion]
    );
    if (!updated.rows[0]) throw new Error('proposal_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/**
 * CW-RT-041, CW-RT-042. EXECUTING -> EXECUTED. Approved is never silently
 * equivalent to executed — this is a distinct, separately-called
 * transition, never chained automatically from an APPROVE decision.
 */
export async function transitionProposalToExecuted(
  actionProposalId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<CaseActionProposal> {
  return applySimpleTransition(actionProposalId, actor, expectedVersion, 'EXECUTED');
}

/** CW-RT-041. EXECUTING -> FAILED. `reason` is required. */
export async function transitionProposalToFailed(
  actionProposalId: string,
  actor: CaseActor,
  reason: string,
  expectedVersion: number
): Promise<CaseActionProposal> {
  requireNonBlank(reason, 'proposal_failed_reason_required');
  return applySimpleTransition(actionProposalId, actor, expectedVersion, 'FAILED');
}

/**
 * CW-RT-041. FAILED -> APPROVED (the literal "controlled idempotent retry"
 * edge). Re-runs computeProposalTargetValidity() since time has passed
 * since the original approval, same guard as
 * transitionProposalToExecuting().
 */
export async function retryProposalFromFailed(
  actionProposalId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<CaseActionProposal> {
  const id = requireNonBlank(actionProposalId, 'proposal_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'proposal_actor_required');
  if (typeof expectedVersion !== 'number') throw new Error('proposal_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actorUserId, row.case_id);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes('APPROVED')) {
      throw new Error(`proposal_status_transition_not_allowed:${row.status}->APPROVED`);
    }

    let planVersionRow: CasePlanVersionRefRow | null = null;
    if (row.case_plan_version_id) {
      const planVersionResult = await client.query<CasePlanVersionRefRow>(
        `SELECT case_plan_version_id, case_id, status FROM case_plan_versions
          WHERE case_plan_version_id = ?`,
        [row.case_plan_version_id]
      );
      planVersionRow = planVersionResult.rows[0] ?? null;
    }

    let capabilityRow: CapabilityRegistryRefRow | null = null;
    if (row.capability_registry_id) {
      const capabilityResult = await client.query<CapabilityRegistryRefRow>(
        `SELECT capability_registry_id, lifecycle, health FROM case_workspace_capabilities
          WHERE capability_registry_id = ?`,
        [row.capability_registry_id]
      );
      capabilityRow = capabilityResult.rows[0] ?? null;
    }

    const validity = computeProposalTargetValidity(planVersionRow, capabilityRow);
    if (!validity.valid) {
      throw new Error(`proposal_target_stale:${validity.reasons.join(',')}`);
    }

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceActionProposalRow>(
      `UPDATE case_workspace_action_proposals
          SET status = 'APPROVED', version = version + 1, updated_at = ?
        WHERE action_proposal_id = ? AND version = ?
        RETURNING *`,
      [now, id, expectedVersion]
    );
    if (!updated.rows[0]) throw new Error('proposal_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/** CW-RT-041. EXECUTED -> AUDITED. */
export async function markProposalAudited(
  actionProposalId: string,
  actor: CaseActor,
  expectedVersion: number
): Promise<CaseActionProposal> {
  return applySimpleTransition(actionProposalId, actor, expectedVersion, 'AUDITED');
}

/**
 * CW-RT-041. APPROVED -> REVOKED. Only enforces the state-machine guard
 * (reachability); CW-RT-041's "where policy permits" precondition needs a
 * policy engine this packet does not build (open_question #9). `reason` is
 * required.
 */
export async function revokeApprovedProposal(
  actionProposalId: string,
  actor: CaseActor,
  reason: string,
  expectedVersion: number
): Promise<CaseActionProposal> {
  requireNonBlank(reason, 'proposal_revoke_reason_required');
  return applySimpleTransition(actionProposalId, actor, expectedVersion, 'REVOKED');
}

/**
 * Shared plain-OCC transition body for the status changes that need no
 * extra domain check beyond ALLOWED_TRANSITIONS reachability
 * (transitionProposalToExecuted/transitionProposalToFailed/
 * markProposalAudited/revokeApprovedProposal — see open_question #8 for why
 * these rely on plain OCC only, unlike createActionProposal/
 * recordApprovalDecision).
 */
async function applySimpleTransition(
  actionProposalId: string,
  actor: CaseActor,
  expectedVersion: number,
  nextStatus: ActionProposalStatus
): Promise<CaseActionProposal> {
  const id = requireNonBlank(actionProposalId, 'proposal_id_required');
  const actorUserId = requireNonBlank(actor?.actorUserId, 'proposal_actor_required');
  if (typeof expectedVersion !== 'number') throw new Error('proposal_expected_version_required');

  return withPgTransaction(async (client) => {
    const row = await loadForUpdate(client, id);
    await requireCaseAccess(actorUserId, row.case_id);
    if (!(ALLOWED_TRANSITIONS[row.status] ?? []).includes(nextStatus)) {
      throw new Error(`proposal_status_transition_not_allowed:${row.status}->${nextStatus}`);
    }

    const now = new Date().toISOString();
    const updated = await client.query<CaseWorkspaceActionProposalRow>(
      `UPDATE case_workspace_action_proposals
          SET status = ?, version = version + 1, updated_at = ?
        WHERE action_proposal_id = ? AND version = ?
        RETURNING *`,
      [nextStatus, now, id, expectedVersion]
    );
    if (!updated.rows[0]) throw new Error('proposal_version_conflict');
    return mapRow(updated.rows[0]);
  });
}

/** CW-GR-027. Plain read, no lock. */
export async function getActionProposal(
  actionProposalId: string,
  actorUserId: string
): Promise<CaseActionProposal | null> {
  const actor = requireNonBlank(actorUserId, 'proposal_actor_required');
  const row = await queryOne<CaseWorkspaceActionProposalRow>(
    `SELECT * FROM case_workspace_action_proposals WHERE action_proposal_id = ?`,
    [requireNonBlank(actionProposalId, 'proposal_id_required')]
  );
  if (!row) return null;
  try {
    await requireCaseAccess(actor, row.case_id);
  } catch (err) {
    if (err instanceof CaseWorkspaceAuthError) return null;
    throw err;
  }
  return mapRow(row);
}

/** CW-RT-043. Plain read, no lock. Newest proposal_version first. */
export async function listActionProposalsForCase(
  caseId: string,
  filters: { status?: ActionProposalStatus } | undefined,
  actorUserId: string
): Promise<CaseActionProposal[]> {
  const id = requireNonBlank(caseId, 'proposal_case_id_required');
  await requireCaseAccess(requireNonBlank(actorUserId, 'proposal_actor_required'), id);
  const conditions = ['case_id = ?'];
  const params: unknown[] = [id];
  if (filters?.status) {
    conditions.push('status = ?');
    params.push(requireEnum(filters.status, PROPOSAL_STATUSES, 'proposal_status_invalid'));
  }
  const rows = await queryAll<CaseWorkspaceActionProposalRow>(
    `SELECT * FROM case_workspace_action_proposals
       WHERE ${conditions.join(' AND ')}
       ORDER BY proposal_version DESC`,
    params
  );
  return rows.map(mapRow);
}

/**
 * CW-GR-026 (GET /api/runs/:runId/proposals). Plain read, no lock, newest
 * proposal_version first.
 */
export async function listActionProposalsForRun(
  runId: string,
  actorUserId: string
): Promise<CaseActionProposal[]> {
  const id = requireNonBlank(runId, 'proposal_run_id_required');
  const actor = requireNonBlank(actorUserId, 'proposal_actor_required');
  const rows = await queryAll<CaseWorkspaceActionProposalRow>(
    `SELECT * FROM case_workspace_action_proposals WHERE run_id = ? ORDER BY proposal_version DESC`,
    [id]
  );
  if (rows.length === 0) return [];
  await requireCaseAccess(actor, rows[0].case_id);
  return rows.map(mapRow);
}

/**
 * CW-02-034, CW-03-014. Plain read, no lock, chronological — the full
 * audit trail including DEFERs, feeding the approval card's history and the
 * immutable receipt.
 */
export async function listDecisionsForProposal(
  actionProposalId: string,
  actorUserId: string
): Promise<ApprovalDecisionRecord[]> {
  const id = requireNonBlank(actionProposalId, 'proposal_id_required');
  const actor = requireNonBlank(actorUserId, 'proposal_actor_required');
  const proposalRow = await queryOne<{ case_id: string }>(
    `SELECT case_id FROM case_workspace_action_proposals WHERE action_proposal_id = ?`,
    [id]
  );
  if (!proposalRow) throw new Error('proposal_not_found');
  await requireCaseAccess(actor, proposalRow.case_id);
  const rows = await queryAll<CaseWorkspaceActionProposalDecisionRow>(
    `SELECT * FROM case_workspace_action_proposal_decisions
       WHERE action_proposal_id = ?
       ORDER BY created_at ASC`,
    [id]
  );
  return rows.map(mapDecisionRow);
}
