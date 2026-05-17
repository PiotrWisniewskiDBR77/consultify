/**
 * V10-AGT-001 — `ExecutionProposalV1` schema (Wave A seed, schema-only).
 *
 * Implements R-AGENT-1 from
 * `docs/Chat V9/DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md` and
 * `docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-agt-001`.
 *
 * Scope (Wave A seed)
 * -------------------
 * This file ships the `ExecutionProposalV1` envelope and its brands.
 * Sibling tickets ship the inner unions in their own files:
 *
 *   - V10-AGT-002 → `Severity`
 *   - V10-AGT-003 → `OpType`, `Op`
 *   - V10-AGT-004 → `ApprovalMode`
 *   - V10-AGT-005 → `ExpectedVersionMap`
 *   - V10-AGT-006 → `BudgetBudget`
 *   - V10-AGT-007 → `BlastRadius`, `DiffPreview`
 *   - V10-AGT-008 → `NavigationIntent`, `MessageType`
 *
 * Until those land, this file inlines the smallest placeholder that
 * makes the envelope compile. Each placeholder carries a `@placeholder`
 * JSDoc tag + the ticket that subsumes it. When a sibling lands it
 * re-exports the canonical union from its own file and the placeholder
 * here becomes a type alias for 1 PR before deletion.
 *
 * Runtime behaviour
 * -----------------
 * No runtime behaviour. Type-only + a `required-keys` manifest for the
 * unit-test invariant. Validation (Zod or equivalent) lands with
 * V10-AGT-026 (boundary validator).
 *
 * CI contract
 * -----------
 * - Unit test (`ExecutionProposalV1.test.ts`) asserts the envelope
 *   shape.
 * - V10 registry invariant 32 pins the owning ticket
 *   (`V10-AGT-001` → block `agent_runtime`).
 * - Approve/reject branch coverage lands with V10-AGT-026.
 */

// ---------------------------------------------------------------------------
// §1 — Identity brands.
// ---------------------------------------------------------------------------

declare const PROPOSAL_ID_BRAND: unique symbol;
declare const TENANT_ID_BRAND: unique symbol;
declare const ACTOR_ID_BRAND: unique symbol;
declare const POLICY_ID_BRAND: unique symbol;

export type ProposalId = string & { readonly [PROPOSAL_ID_BRAND]: void };
export type TenantId = string & { readonly [TENANT_ID_BRAND]: void };
export type ActorId = string & { readonly [ACTOR_ID_BRAND]: void };
export type PolicyId = string & { readonly [POLICY_ID_BRAND]: void };

export type Timestamp = string;

export const unsafeProposalId = (v: string): ProposalId => v as ProposalId;
export const unsafeTenantId = (v: string): TenantId => v as TenantId;
export const unsafeActorId = (v: string): ActorId => v as ActorId;
export const unsafePolicyId = (v: string): PolicyId => v as PolicyId;

// ---------------------------------------------------------------------------
// §2 — Placeholder unions (replaced by sibling tickets).
// ---------------------------------------------------------------------------

/**
 * @placeholder Replaced in full by V10-AGT-002 (Severity S0–S4 policies).
 * Wave A seed exposes the five ladder levels; policy defaults per
 * level (approval mode, undo window, audit retention, UI treatment)
 * are deferred.
 */
export type Severity = 'S0' | 'S1' | 'S2' | 'S3' | 'S4';

/**
 * @placeholder Replaced in full by V10-AGT-003 (OpType registry + handlers).
 */
export type OpType =
  | 'read'
  | 'create_entity'
  | 'update_entity'
  | 'delete_entity'
  | 'attach_artifact'
  | 'detach_artifact'
  | 'send_notification'
  | 'external_api_call'
  | 'schedule_trigger'
  | 'ledger_write';

/** @placeholder Subsumed by V10-AGT-003. */
export interface EntityRef {
  readonly kind: string;
  readonly id: string;
}

/** @placeholder Subsumed by V10-AGT-003. */
export interface Op {
  readonly kind: OpType;
  readonly target: EntityRef;
  readonly payload: unknown;
  readonly expectedVersion?: string;
  readonly compensatingOp?: Op | null;
}

/**
 * @placeholder Replaced in full by V10-AGT-004 (approval-mode handlers).
 */
export type ApprovalMode =
  | 'implicit'
  | 'inline'
  | 'explicit_form'
  | 'multi_reviewer'
  | 'admin_only';

/**
 * @placeholder Replaced in full by V10-AGT-005 (optimistic concurrency
 * check). Seed ships a flat map keyed by `<entity-kind>:<entity-id>`.
 */
export type ExpectedVersionMap = Readonly<Record<string, string>>;

/** @placeholder Subsumed by V10-AGT-006 (budget enforcement). */
export interface BudgetBudget {
  readonly maxWallClockMs: number;
  readonly maxCostUsdCents: number;
  readonly maxToolCalls: number;
}

/** @placeholder Subsumed by V10-AGT-007 (blast-radius calculator). */
export interface BlastRadius {
  readonly entityCount: number;
  readonly externalVisible: boolean;
  readonly tenantsAffected: number;
}

/** @placeholder Subsumed by V10-AGT-007 (diff preview renderer). */
export interface DiffPreview {
  readonly summary: string;
  readonly renderedMarkdown: string | null;
}

/** @placeholder Subsumed by V10-AGT-008 (navigation intent resolver). */
export type NavigationIntent =
  | 'stay_in_chat'
  | 'open_artifact'
  | 'open_library'
  | 'open_admin_console';

/** @placeholder Subsumed by V10-AGT-008 (message-type router). */
export type MessageType = 'execution_proposal' | 'agent_status' | 'agent_question';

/** @placeholder Subsumed by V10-RSN-015 (TrustBundle). */
export interface EvidenceRef {
  readonly trustBundleSha256: string;
  readonly sourceHint: string | null;
}

// ---------------------------------------------------------------------------
// §3 — Envelope.
// ---------------------------------------------------------------------------

/**
 * The single envelope every AI-originated action reaches downstream
 * systems through. Invariant R-AGENT-1 (master plan §1.1 · block 3)
 * asserts this is the ONLY way.
 *
 * Validation
 * ----------
 * Full runtime validation (Zod) lands with V10-AGT-026. At seed time
 * callers wishing to construct a proposal use a factory that asserts
 * required keys + rejects malformed `reversibilityHint` values — the
 * factory is in the unit test and will move into a shipped helper at
 * V10-AGT-026.
 */
export interface ExecutionProposalV1 {
  readonly schemaVersion: 'v1';
  readonly id: ProposalId;
  readonly tenantId: TenantId;
  readonly correlationId: string;
  readonly messageType: MessageType;
  readonly severity: Severity;
  readonly ops: readonly Op[];
  readonly sources: readonly EvidenceRef[];
  readonly rationale: string;
  readonly expectedVersions: ExpectedVersionMap;
  readonly approvalMode: ApprovalMode;
  readonly approvalPolicyId: PolicyId;
  readonly preview: DiffPreview;
  readonly navigationIntent: NavigationIntent;
  readonly budget: BudgetBudget;
  readonly blastRadius: BlastRadius;
  readonly reversibilityHint: ReversibilityHint;
  readonly proposedBy: ActorId;
  readonly proposedAt: Timestamp;
  readonly expiresAt: Timestamp;
}

/**
 * Separately exported so the reversibility catalogue is consumable by
 * the severity policy table (V10-AGT-002) without importing the full
 * envelope.
 */
export type ReversibilityHint = 'reversible' | 'compensating' | 'irreversible';

export const EXECUTION_PROPOSAL_V1_REQUIRED_KEYS = [
  'schemaVersion',
  'id',
  'tenantId',
  'correlationId',
  'messageType',
  'severity',
  'ops',
  'sources',
  'rationale',
  'expectedVersions',
  'approvalMode',
  'approvalPolicyId',
  'preview',
  'navigationIntent',
  'budget',
  'blastRadius',
  'reversibilityHint',
  'proposedBy',
  'proposedAt',
  'expiresAt',
] as const satisfies ReadonlyArray<keyof ExecutionProposalV1>;

export type ExecutionProposalV1RequiredKey = (typeof EXECUTION_PROPOSAL_V1_REQUIRED_KEYS)[number];

/**
 * The five severities, iteration-stable. Consumed by the V10-AGT-002
 * policy table at implementation time and by the unit test here.
 */
export const SEVERITIES: readonly Severity[] = ['S0', 'S1', 'S2', 'S3', 'S4'] as const;

/** Iteration-stable ApprovalMode catalogue. */
export const APPROVAL_MODES: readonly ApprovalMode[] = [
  'implicit',
  'inline',
  'explicit_form',
  'multi_reviewer',
  'admin_only',
] as const;

/** Iteration-stable OpType catalogue. */
export const OP_TYPES: readonly OpType[] = [
  'read',
  'create_entity',
  'update_entity',
  'delete_entity',
  'attach_artifact',
  'detach_artifact',
  'send_notification',
  'external_api_call',
  'schedule_trigger',
  'ledger_write',
] as const;
