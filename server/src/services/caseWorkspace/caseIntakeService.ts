/**
 * Case Workspace — CASE INTAKE service (Stream B / E8: Chat + Teresa -> Case).
 *
 * This is the ONLY sanctioned path from a conversation to a Case. It exists
 * because the audit found the gap literally: `caseCoreService` has 31 files of
 * references and every single one lives under `server/src/services/caseWorkspace/`
 * or `server/src/routes/caseWorkspace/` — zero callers in `src/`, in
 * `routes/v8/`, in `services/ai/` or in `services/v8/`. Chat could not create a
 * Case at all, and the three existing confirmation patterns (Teresa's proposal
 * envelope, the agent-plan side-effect gate, the front-end AI-Actions gate)
 * plus `POST /api/ai/chat/confirm` all share one hole: none of them produces a
 * VERSIONED, DIGESTED work order. `/chat/confirm` persists nothing at all
 * (`ai.routes.ts:1198` ends at `res.json` on `:1425`), and
 * `teresaCopilotService.ts` contains no `digest|sha256|createHash` anywhere.
 *
 * =========================================================================
 * THE THREE CANON RULES THIS FILE ENFORCES
 * =========================================================================
 * CW-CANON-01  Informational chat creates ZERO Cases and ZERO Runs.
 *   `proposeWorkOrder()` never touches `case_core` and never touches any run
 *   table. It writes exactly one row: the `case.intake.work_order_proposed`
 *   outbox event (the durable record that a specific work order was SHOWN to
 *   a specific human at a specific time). A conversation that never calls
 *   `confirmWorkOrder()` therefore leaves no Case behind, by construction —
 *   not by convention, not by a flag.
 *
 * CW-CANON-03  Durable Teresa work creates or REUSES exactly ONE Case, and
 *   only after confirmation of an exact, versioned work-order digest.
 *   `confirmWorkOrder()` refuses unless the digest the human confirmed equals,
 *   byte for byte, the digest recomputed from the work order it was handed.
 *   "Exactly one" is enforced by the DATABASE, not by a read-then-write race:
 *   `case_core.project_id` carries `UNIQUE (project_id)`
 *   (`case_core_project_id_key`) and the insert is
 *   `INSERT … ON CONFLICT (project_id) DO NOTHING RETURNING *`. The loser of a
 *   concurrent race gets zero rows back, re-reads the winner's committed row,
 *   and returns it as a REUSE — never a duplicate, never an error the caller
 *   has to interpret.
 *
 * LIGHT policy  Zero or one Run.
 *   This service creates ZERO Runs, in both entry points. It never calls
 *   `executionSpineService.createRun`, never INSERTs into `v8_execution_runs`
 *   and never INSERTs into `case_workspace_run_bindings`. Binding a Run to the
 *   Case is a separate, later, explicitly-approved step (`runBindingService`),
 *   which is exactly what keeps the LIGHT policy's ceiling of one honest:
 *   intake cannot be the thing that silently spends a Run.
 *
 * =========================================================================
 * WHY THE DIGEST IS THE SECURITY BOUNDARY, NOT A CHECKSUM
 * =========================================================================
 * The failure this guards against is not corruption in transit. It is:
 * Teresa shows the human work order A, the human clicks "Confirm", and the
 * system executes work order B — because the conversation moved on, because a
 * retry re-derived the order from newer context, or because something in
 * between rewrote it. The human would have authorized something they never
 * saw. So `confirmWorkOrder` treats a digest mismatch as a REFUSAL with its
 * own code (`intake_work_order_digest_mismatch`), never as a warning, never as
 * "close enough", and never by silently preferring one side.
 *
 * Two independent checks, both required:
 *   1. RECOMPUTE  digest(canonicalize(workOrder)) === confirmedDigest.
 *      Catches any drift between what was shown and what is being submitted.
 *   2. WAS-SHOWN  the `case.intake.work_order_proposed` outbox row for that
 *      exact digest must already exist, in this tenant. Catches a caller that
 *      fabricates a self-consistent (order, digest) pair that no human was
 *      ever shown — check 1 alone would happily pass such a pair.
 *
 * The digest algorithm MIRRORS `casePlanVersionService.computeGraphDigest`
 * (`sha256:<hex>` over a canonicalization that drops null/undefined keys and
 * sorts object keys) rather than importing it, for two reasons: that function
 * is typed `(graph: CanonicalGraph) => string` and passing a work order to it
 * would be a type lie, and this directory's universal convention is that each
 * service keeps its own local helpers (see the identical `requireNonBlank` in
 * caseCoreService, casePlanVersionService, proposalApprovalService and
 * caseWorkspaceAuthContext). One deliberate DIFFERENCE from that function:
 * it sorts arrays whose elements all carry `nodeId`/`edgeId`/`name`, because
 * graph node order is meaningless. Here every array is a list of HUMAN-READ
 * SENTENCES (scope, constraints, success criteria) whose ORDER IS PART OF WHAT
 * THE HUMAN READ, so arrays keep their order and a reordered scope list is a
 * DIFFERENT work order with a different digest. That is the correct reading of
 * "exactly what was shown".
 *
 * =========================================================================
 * WHERE THE PROPOSAL AND THE CONFIRMATION ARE STORED
 * =========================================================================
 * In `case_workspace_event_outbox`, under DETERMINISTIC event ids derived from
 * the digest — which is precisely the use the outbox's own contract calls for:
 * "Supply a DETERMINISTIC id (derived from the command's idempotency key) when
 * the command itself can be retried — that is what makes ON CONFLICT DO
 * NOTHING a real deduplication rather than a formality"
 * (eventOutboxService.ts, DomainEventEnvelope.eventId).
 *
 * No new table and no migration is added by this packet (its file allowlist
 * contains no migration), so the outbox is also the ONLY durable home
 * available. That is a real, named limitation, not a hidden one — see
 * OPEN QUESTIONS #1: `case_core` has no column pointing at the work-order
 * digest that created it, so "which work order produced this Case" is
 * answerable only by reading the event stream (`getConfirmedWorkOrders()`
 * below does exactly that), never by a join or a WHERE clause.
 *
 * =========================================================================
 * PROPOSED EVENT TYPES (NOT YET IN EVENT_TAXONOMY.md — that file is owned by
 * another stream and is deliberately NOT edited by this packet)
 * =========================================================================
 *   case.intake.work_order_proposed   aggregate CASE_INTAKE, id `wo-<digest>`
 *     Emitted by proposeWorkOrder. caseId NULL — no Case exists yet, and that
 *     NULL is the machine-readable proof of CW-CANON-01.
 *   case.intake.work_order_confirmed  aggregate CASE, id = the case_id
 *     Emitted by confirmWorkOrder, causationId = the proposed event's id, so
 *     §10's correlation chain runs conversation -> proposal -> Case.
 *
 * Both are published on the CALLER'S OPEN TRANSACTION via
 * `publishEvent(client, …)`, in the same BEGIN…COMMIT as the `case_core`
 * INSERT — no dual write, no "commit then publish" window.
 *
 * =========================================================================
 * WHY THIS FILE INSERTS INTO case_core ITSELF INSTEAD OF CALLING createCase
 * =========================================================================
 * A deliberate, load-bearing trade-off. `caseCoreService.createCase` opens its
 * OWN `withPgTransaction`. Calling it from here would put the Case INSERT in
 * transaction 1 and `case.intake.work_order_confirmed` in transaction 2 —
 * exactly the dual-write hole the outbox exists to close ("kill worker … after
 * domain commit before outbox publication"). It would also turn the
 * concurrency story from "the DB decides, once" into a read-then-write race,
 * because `createCase` pre-checks with a SELECT and THROWS
 * `case_already_exists_for_project` rather than returning the existing Case —
 * which is the opposite of the reuse semantics CW-CANON-03 requires.
 *
 * So this file writes the row itself, mirroring `createCase`'s INSERT shape
 * (same columns, same defaults, same `governance_tier_history` seed entry,
 * `version = 1`, `case_status = 'DRAFT'`) and emitting the same `case.created`
 * event the taxonomy assigns to that command, so no consumer can tell which
 * door a Case came through. `caseCoreService.ts` itself is NOT modified.
 * Consequence to keep in view: any future change to `createCase`'s INSERT
 * (a new NOT NULL column, a changed default) must be mirrored here — see
 * OPEN QUESTIONS #2.
 *
 * =========================================================================
 * AUTHORIZATION — fail closed, before anything is read or written
 * =========================================================================
 * Every public function begins with `requireOrgMember` / `requireCaseAccess`
 * from caseWorkspaceAuthContext, BEFORE any project lookup, digest work or
 * transaction is opened, so a non-member learns nothing — not even how long a
 * lookup took. Cross-tenant probing is answered with ONE code,
 * `intake_project_not_found`, for all three of "no such project", "project in
 * another tenant" and "project the actor cannot see", matching
 * `requireCaseAccess`'s own enumeration-oracle posture (SEC-009, CW-DOD-D6);
 * `_shared/errors.ts` maps `*_not_found` to 404, so the HTTP surface leaks
 * nothing either.
 *
 * =========================================================================
 * OPEN QUESTIONS (carried forward, NOT resolved here)
 * =========================================================================
 * 1. No column on `case_core` records the work-order digest that created the
 *    Case. The binding lives only in the outbox event. A future migration
 *    should add `case_core.intake_work_order_digest` (nullable, indexed) so
 *    "show me the Case for this work order" stops being an event-stream scan.
 * 2. The `case_core` INSERT here duplicates `createCase`'s column list (see
 *    the section above for why). If Stream A ever refactors `createCase` to
 *    accept an EXISTING transaction client, this file should collapse to a
 *    delegating call and the duplication should be deleted.
 * 3. The confirmed event id is derived from the DIGEST ALONE, deliberately not
 *    from the actor. A second human confirming the same work order therefore
 *    dedups to no new event — correct for idempotency, arguably wrong for
 *    audit (a second approver's assent leaves no trace). Recording
 *    co-confirmations needs a table this packet may not add.
 * 4. No LLM extraction lives here. `proposeWorkOrder` takes an ALREADY
 *    STRUCTURED draft (goal / scope / expected outcome) and is deterministic:
 *    same input, same digest, forever. Turning free conversation text into
 *    that structure is the caller's job (`chatExecutionService.classifyIntent`
 *    is today a self-declared "heuristic stub (LLM call placeholder)" at
 *    `chatExecutionService.ts:132`). Putting a model call in here would make
 *    the digest non-deterministic and destroy the entire guarantee.
 * 5. Case REUSE is keyed on `project_id`, because that is the only uniqueness
 *    the schema gives. Confirming a SECOND, different work order against a
 *    project that already has a Case therefore returns that existing Case with
 *    `reuseReason: 'existing_case_for_project'` and records the new work order
 *    against it. Whether a genuinely different work order should instead be
 *    refused, or should open a second Case (which the UNIQUE constraint
 *    forbids), is a product decision this packet cannot make alone.
 * 6. No autonomy-level (A0–A4) enforcement — that mechanism does not exist
 *    anywhere in this codebase yet. `autonomyPolicy` is carried into the Case
 *    and into the digest, so the human confirms it, but nothing downstream
 *    reads it back as a gate.
 */

import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { queryAll, withPgTransaction, type PgTransactionClient } from '../../utils/queryHelpers.js';
import type {
  AutonomyPolicy,
  CaseProfile,
  ClosureType,
  GovernanceTier,
} from './caseCoreService.js';
import { requireCaseAccess, requireOrgMember } from './caseWorkspaceAuthContext.js';
import { publishEvent, redact } from './eventOutboxService.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Bumped ONLY when the canonical work-order shape changes incompatibly. It is
 * part of the digested payload on purpose: a work order proposed under v1 can
 * never silently satisfy a v2 confirmation, because the digest changes.
 */
export const WORK_ORDER_SCHEMA_VERSION = 1;

/** Aggregate name for the pre-Case proposal (no Case exists yet). */
export const CASE_INTAKE_AGGREGATE_TYPE = 'CASE_INTAKE';
/** Aggregate name once a Case exists — same as caseCoreService's. */
const CASE_AGGREGATE_TYPE = 'CASE';

export const EVENT_WORK_ORDER_PROPOSED = 'case.intake.work_order_proposed';
export const EVENT_WORK_ORDER_CONFIRMED = 'case.intake.work_order_confirmed';
/** Same event type caseCoreService.createCase emits — see the header. */
const EVENT_CASE_CREATED = 'case.created';

const OUTBOX_TABLE = 'case_workspace_event_outbox';

/** Per-field ceilings. Generous for a real work order, hostile to a document. */
const MAX_GOAL_CHARS = 1200;
const MAX_OUTCOME_CHARS = 1200;
const MAX_LIST_ITEMS = 12;
const MAX_LIST_ITEM_CHARS = 400;

/**
 * Aggregate ceiling on the canonical work order, checked BEFORE publishing.
 * eventOutboxService rejects a redacted summary over 8 KiB with its own
 * `event_outbox_redacted_summary_too_large`; catching it here first turns an
 * outbox-internal error into an intake-level one the caller can act on, and
 * leaves headroom for the summary's own wrapper fields.
 */
const MAX_WORK_ORDER_BYTES = 6 * 1024;

const CASE_PROFILES: readonly CaseProfile[] = ['LIGHT', 'STANDARD', 'TRANSFORMATION', 'MONITORING'];
const GOVERNANCE_TIERS: readonly GovernanceTier[] = ['LIGHTWEIGHT', 'STANDARD', 'CONTROLLED'];
const AUTONOMY_POLICIES: readonly AutonomyPolicy[] = [
  'ASK_EACH_ACTION',
  'ASK_MATERIAL_ACTIONS',
  'EXECUTE_APPROVED_PLAN',
];
const CLOSURE_TYPES: readonly ClosureType[] = [
  'DELIVERY_COMPLETED',
  'DECISION_COMPLETED',
  'IMPLEMENTATION_COMPLETED',
  'OUTCOME_VALIDATED',
  'COMPLETED_PARTIAL',
];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * What a caller (chat / Teresa) hands in. Loose on purpose: optional fields
 * may be omitted OR null, and `normalizeWorkOrder` collapses both to the same
 * canonical value so the two spellings can never produce two digests.
 */
export interface WorkOrderDraftInput {
  organizationId: string;
  projectId: string;
  /** The one sentence answering "what are we doing". */
  goal: string;
  /** Ordered — see the header: order is part of what the human read. */
  scope: string[];
  /** What exists at the end that did not exist before. */
  expectedOutcome: string;
  constraints?: string[] | null;
  successCriteria?: string[] | null;
  contractedClosureType: ClosureType;
  caseProfile?: CaseProfile | null;
  governanceTier?: GovernanceTier | null;
  autonomyPolicy?: AutonomyPolicy | null;
  /** Provenance: which conversation/message this came from. Digested. */
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
}

/**
 * The normalized, fully-defaulted work order. THIS — and only this — is what
 * the digest is computed over, and it is returned to the caller so the UI
 * renders exactly the object that was digested rather than the raw draft.
 */
export interface CanonicalWorkOrder {
  workOrderSchemaVersion: number;
  organizationId: string;
  projectId: string;
  goal: string;
  scope: string[];
  expectedOutcome: string;
  constraints: string[];
  successCriteria: string[];
  contractedClosureType: ClosureType;
  caseProfile: CaseProfile;
  governanceTier: GovernanceTier;
  autonomyPolicy: AutonomyPolicy;
  sourceConversationId: string | null;
  sourceMessageId: string | null;
}

export interface ProposeWorkOrderResult {
  /** Deterministic: `wo-<sha256 hex>`. Same content -> same id, forever. */
  workOrderId: string;
  /** `sha256:<hex>`. This is what the human must confirm, verbatim. */
  workOrderDigest: string;
  workOrder: CanonicalWorkOrder;
  proposedEventId: string;
  /** true when this exact work order had already been proposed before. */
  alreadyProposed: boolean;
  /**
   * ALWAYS false. Present as an explicit, assertable statement of
   * CW-CANON-01 rather than a comment: proposing creates no Case.
   */
  caseCreated: false;
  /** ALWAYS false — the LIGHT policy's ceiling is untouched by intake. */
  runCreated: false;
}

export type WorkOrderReuseReason =
  | 'none'
  | 'work_order_already_confirmed'
  | 'existing_case_for_project';

export interface ConfirmWorkOrderResult {
  caseId: string;
  workOrderId: string;
  workOrderDigest: string;
  /** false = this call created the Case; true = an existing Case was reused. */
  caseCreated: boolean;
  reused: boolean;
  reuseReason: WorkOrderReuseReason;
  confirmedEventId: string;
  /** true when this exact work order's confirmation event already existed. */
  confirmedEventDeduplicated: boolean;
  /** ALWAYS false — confirming a work order does not start work. */
  runCreated: false;
}

/** One `case.intake.work_order_confirmed` fact, read back off the Case. */
export interface ConfirmedWorkOrderRecord {
  eventId: string;
  caseId: string;
  workOrderId: string;
  workOrderDigest: string;
  confirmedByActorId: string;
  confirmedAt: string;
  summary: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Local helpers (this directory's convention: each service keeps its own copies —
// see caseCoreService.ts / casePlanVersionService.ts / caseWorkspaceAuthContext.ts)
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

/**
 * Unicode NFC + trim, and nothing else. Deliberately does NOT collapse inner
 * whitespace or change case: that is the human's text, and rewriting it would
 * mean the digest covers something subtly different from what was displayed.
 * NFC alone is safe and necessary — the same visible string typed on macOS
 * (NFD) and pasted from Windows (NFC) must not produce two digests.
 */
function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFC')
    .trim();
}

function normalizeRequiredText(value: unknown, maxChars: number, reason: string): string {
  const text = normalizeText(value);
  if (!text) throw new Error(reason);
  if (text.length > maxChars) throw new Error(`${reason.replace(/_required$/, '')}_too_long`);
  return text;
}

/**
 * Normalizes a list field: drops blank entries (a UI's trailing empty input
 * must not change the digest), preserves order, enforces the ceilings.
 */
function normalizeList(
  value: string[] | null | undefined,
  fieldCode: string,
  { required }: { required: boolean }
): string[] {
  const raw = Array.isArray(value) ? value : [];
  const items = raw.map(normalizeText).filter((item) => item.length > 0);
  if (required && items.length === 0) throw new Error(`intake_${fieldCode}_required`);
  if (items.length > MAX_LIST_ITEMS) throw new Error(`intake_${fieldCode}_too_many_items`);
  for (const item of items) {
    if (item.length > MAX_LIST_ITEM_CHARS) throw new Error(`intake_${fieldCode}_item_too_long`);
  }
  return items;
}

function optionalId(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
}

// ---------------------------------------------------------------------------
// Canonicalization + digest (mirrors casePlanVersionService.computeGraphDigest;
// see the header for the one deliberate difference — arrays keep their order)
// ---------------------------------------------------------------------------

/**
 * Drops null/undefined-valued object keys and sorts remaining keys, so
 * `{a:1, b:null}`, `{a:1}` and `{b:undefined, a:1}` all canonicalize
 * identically. Arrays are mapped in place — order preserved, never sorted.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, v]) => [key, canonicalize(v)] as const)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const result: Record<string, unknown> = {};
    for (const [key, v] of entries) result[key] = v;
    return result;
  }

  return value;
}

/** Exported for callers that want to verify a digest without a DB round trip. */
export function computeWorkOrderDigest(workOrder: CanonicalWorkOrder): string {
  const json = JSON.stringify(canonicalize(workOrder));
  return `sha256:${createHash('sha256').update(json, 'utf8').digest('hex')}`;
}

function digestHex(digest: string): string {
  return digest.startsWith('sha256:') ? digest.slice('sha256:'.length) : digest;
}

/** `wo-<hex>` — deterministic identity of the work order itself. */
export function workOrderIdForDigest(digest: string): string {
  return `wo-${digestHex(digest)}`;
}

/** Deterministic outbox ids — the actual idempotency keys (see header). */
function proposedEventIdForDigest(digest: string): string {
  return `cwevt-intake-proposed-${digestHex(digest)}`;
}

function confirmedEventIdForDigest(digest: string): string {
  return `cwevt-intake-confirmed-${digestHex(digest)}`;
}

/**
 * Draft -> canonical. Total and deterministic: every optional field is given
 * its default here, so two callers who disagree about whether to send
 * `caseProfile` still produce the SAME digest for the same intent.
 */
export function normalizeWorkOrder(input: WorkOrderDraftInput): CanonicalWorkOrder {
  if (!input || typeof input !== 'object') throw new Error('intake_work_order_required');

  const canonical: CanonicalWorkOrder = {
    workOrderSchemaVersion: WORK_ORDER_SCHEMA_VERSION,
    organizationId: requireNonBlank(input.organizationId, 'intake_organization_id_required'),
    projectId: requireNonBlank(input.projectId, 'intake_project_id_required'),
    goal: normalizeRequiredText(input.goal, MAX_GOAL_CHARS, 'intake_goal_required'),
    scope: normalizeList(input.scope, 'scope', { required: true }),
    expectedOutcome: normalizeRequiredText(
      input.expectedOutcome,
      MAX_OUTCOME_CHARS,
      'intake_expected_outcome_required'
    ),
    constraints: normalizeList(input.constraints, 'constraints', { required: false }),
    successCriteria: normalizeList(input.successCriteria, 'success_criteria', { required: false }),
    contractedClosureType: requireEnum(
      input.contractedClosureType,
      CLOSURE_TYPES,
      'intake_contracted_closure_type_invalid'
    ),
    // LIGHT / LIGHTWEIGHT / ASK_MATERIAL_ACTIONS are caseCoreService.createCase's
    // own defaults — mirrored so a Case created through intake is
    // indistinguishable from one created through that command.
    caseProfile: requireEnum(input.caseProfile ?? 'LIGHT', CASE_PROFILES, 'intake_case_profile_invalid'),
    governanceTier: requireEnum(
      input.governanceTier ?? 'LIGHTWEIGHT',
      GOVERNANCE_TIERS,
      'intake_governance_tier_invalid'
    ),
    autonomyPolicy: requireEnum(
      input.autonomyPolicy ?? 'ASK_MATERIAL_ACTIONS',
      AUTONOMY_POLICIES,
      'intake_autonomy_policy_invalid'
    ),
    sourceConversationId: optionalId(input.sourceConversationId),
    sourceMessageId: optionalId(input.sourceMessageId),
  };

  const bytes = Buffer.byteLength(JSON.stringify(canonicalize(canonical)), 'utf8');
  if (bytes > MAX_WORK_ORDER_BYTES) throw new Error('intake_work_order_too_large');

  return canonical;
}

/**
 * The event summary shape shared by both events. `goal`/`expectedOutcome`/
 * `scope` are FACTS about the order, small by construction (the ceilings
 * above), and they are what makes the event stream readable by a human
 * auditor. Note the key names: none of them collide with
 * PiiRedactor.DEFAULT_PII_FIELDS (`name`, `email`, `token`, …), which would
 * otherwise silently replace the value with `[REDACTED]`.
 */
function workOrderSummary(
  workOrder: CanonicalWorkOrder,
  digest: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return redact({
    workOrderId: workOrderIdForDigest(digest),
    workOrderDigest: digest,
    workOrderSchemaVersion: workOrder.workOrderSchemaVersion,
    goal: workOrder.goal,
    scope: workOrder.scope,
    expectedOutcome: workOrder.expectedOutcome,
    constraints: workOrder.constraints,
    successCriteria: workOrder.successCriteria,
    contractedClosureType: workOrder.contractedClosureType,
    caseProfile: workOrder.caseProfile,
    governanceTier: workOrder.governanceTier,
    autonomyPolicy: workOrder.autonomyPolicy,
    sourceConversationId: workOrder.sourceConversationId,
    sourceMessageId: workOrder.sourceMessageId,
    ...extra,
  }) as Record<string, unknown>;
}

/**
 * Enumeration-safe project resolution. "No such project", "project belongs to
 * another tenant" and "project the actor has no standing in" all raise the
 * SAME `intake_project_not_found` — the caller cannot use the error to learn
 * that a foreign projectId exists (SEC-009, CW-DOD-D6). Read-only: this
 * service never writes to `projects`.
 */
async function requireProjectInOrg(
  client: PgTransactionClient,
  projectId: string,
  organizationId: string
): Promise<void> {
  const result = await client.query<{ id: string; organization_id: string }>(
    `SELECT id, organization_id FROM projects WHERE id = ?`,
    [projectId]
  );
  const project = result.rows[0];
  if (!project || project.organization_id !== organizationId) {
    throw new Error('intake_project_not_found');
  }
}

// ---------------------------------------------------------------------------
// 1. proposeWorkOrder — CW-CANON-01
// ---------------------------------------------------------------------------

/**
 * Turns a structured draft into a PROPOSAL: normalizes it, computes its
 * digest, records durably that it was shown, and returns it for display.
 *
 * CREATES NO CASE AND NO RUN. The only row written is the
 * `case.intake.work_order_proposed` outbox event, whose `case_id` is NULL —
 * which is itself the machine-checkable evidence for CW-CANON-01.
 *
 * Idempotent by construction: the same draft yields the same digest, the same
 * `wo-<hex>` id and the same deterministic event id, so re-proposing after a
 * network retry reports `alreadyProposed: true` instead of writing a second
 * proposal. The stored row is left byte-for-byte as first written.
 */
export async function proposeWorkOrder(input: {
  workOrder: WorkOrderDraftInput;
  proposedByActorId: string;
  correlationId?: string | null;
}): Promise<ProposeWorkOrderResult> {
  const proposedByActorId = requireNonBlank(input?.proposedByActorId, 'intake_actor_required');
  const workOrder = normalizeWorkOrder(input?.workOrder);

  // Fail closed FIRST — before the project is looked up, before a transaction
  // is opened, before anything observable happens.
  await requireOrgMember(proposedByActorId, workOrder.organizationId);

  const workOrderDigest = computeWorkOrderDigest(workOrder);
  const workOrderId = workOrderIdForDigest(workOrderDigest);
  const proposedEventId = proposedEventIdForDigest(workOrderDigest);

  const published = await withPgTransaction(async (client) => {
    await requireProjectInOrg(client, workOrder.projectId, workOrder.organizationId);

    return publishEvent(client, {
      eventId: proposedEventId,
      eventType: EVENT_WORK_ORDER_PROPOSED,
      organizationId: workOrder.organizationId,
      projectId: workOrder.projectId,
      aggregateType: CASE_INTAKE_AGGREGATE_TYPE,
      aggregateId: workOrderId,
      // No Case exists yet. This NULL is the assertion, not an omission.
      caseId: null,
      actorUserId: proposedByActorId,
      correlationId: input?.correlationId ?? null,
      redactedSummary: workOrderSummary(workOrder, workOrderDigest, {
        proposedByActorId,
        caseCreated: false,
        runCreated: false,
      }),
    });
  });

  return {
    workOrderId,
    workOrderDigest,
    workOrder,
    proposedEventId: published.eventId,
    alreadyProposed: published.deduplicated,
    caseCreated: false,
    runCreated: false,
  };
}

// ---------------------------------------------------------------------------
// 2. confirmWorkOrder — CW-CANON-03
// ---------------------------------------------------------------------------

interface CaseCoreIdentityRow {
  case_id: string;
  project_id: string;
  organization_id: string;
  version: number;
  created_by_actor_id: string;
  case_status: string;
  case_profile: string;
  governance_tier: string;
  autonomy_policy: string;
  contracted_closure_type: string;
}

const CASE_IDENTITY_COLUMNS = `case_id, project_id, organization_id, version, created_by_actor_id,
  case_status, case_profile, governance_tier, autonomy_policy, contracted_closure_type`;

/**
 * Creates — or reuses — EXACTLY ONE Case, and only for a work order whose
 * digest matches, bit for bit, the digest that was shown and confirmed.
 *
 * Refusals, in the order they are checked (each one leaves ZERO Cases behind):
 *   `intake_work_order_digest_mismatch`  the confirmed digest is not the
 *       digest of the submitted work order. The human authorized something
 *       other than what is being asked for. This is a security refusal.
 *   `intake_project_not_found`           unknown / cross-tenant project.
 *   `intake_work_order_not_proposed`     self-consistent but never shown.
 *
 * Concurrency: two simultaneous confirmations of the same digest both reach
 * `INSERT … ON CONFLICT (project_id) DO NOTHING`. Postgres serializes them on
 * the unique index — the second blocks until the first COMMITs and then gets
 * zero rows back, re-reads the committed row, and returns it with
 * `caseCreated: false`. Exactly one `case_core` row exists either way, and the
 * deterministic confirmed-event id collapses the second event too.
 *
 * Creates NO Run (LIGHT policy). Nothing here touches `v8_execution_runs` or
 * `case_workspace_run_bindings`.
 */
export async function confirmWorkOrder(input: {
  workOrder: WorkOrderDraftInput;
  /** Exactly the `workOrderDigest` proposeWorkOrder returned and the UI showed. */
  confirmedDigest: string;
  confirmedByActorId: string;
  correlationId?: string | null;
}): Promise<ConfirmWorkOrderResult> {
  const confirmedByActorId = requireNonBlank(input?.confirmedByActorId, 'intake_actor_required');
  const confirmedDigest = requireNonBlank(input?.confirmedDigest, 'intake_confirmed_digest_required');
  const workOrder = normalizeWorkOrder(input?.workOrder);

  await requireOrgMember(confirmedByActorId, workOrder.organizationId);

  const workOrderDigest = computeWorkOrderDigest(workOrder);

  // THE GATE. Plain !== on the full `sha256:<hex>` string — no prefix
  // tolerance, no case folding, no "did they mean this one". A mismatch means
  // the human confirmed a different work order than the one submitted, and
  // that must never resolve in favour of either side.
  if (workOrderDigest !== confirmedDigest) {
    throw new Error('intake_work_order_digest_mismatch');
  }

  const workOrderId = workOrderIdForDigest(workOrderDigest);
  const proposedEventId = proposedEventIdForDigest(workOrderDigest);
  const confirmedEventId = confirmedEventIdForDigest(workOrderDigest);

  return withPgTransaction(async (client) => {
    await requireProjectInOrg(client, workOrder.projectId, workOrder.organizationId);

    // WAS-SHOWN check. Tenant-scoped: a proposal recorded in another org can
    // never satisfy a confirmation here, even with an identical digest (the
    // digest covers organizationId, so this is belt and braces).
    const proposal = await client.query<{ event_id: string }>(
      `SELECT event_id FROM ${OUTBOX_TABLE}
        WHERE event_id = ? AND organization_id = ? AND event_type = ?`,
      [proposedEventId, workOrder.organizationId, EVENT_WORK_ORDER_PROPOSED]
    );
    if (!proposal.rows[0]) throw new Error('intake_work_order_not_proposed');

    const now = new Date().toISOString();
    const candidateCaseId = `case-${uuidv4()}`;
    const initialHistory = [
      {
        tier: workOrder.governanceTier,
        changedAt: now,
        changedByActorId: confirmedByActorId,
        reason: 'case_created',
      },
    ];

    // The one write that decides everything. ON CONFLICT (project_id) DO
    // NOTHING is what makes "exactly one Case" a database guarantee rather
    // than a hopeful SELECT-then-INSERT.
    const inserted = await client.query<CaseCoreIdentityRow>(
      `INSERT INTO case_core (
         case_id, project_id, organization_id, case_profile, governance_tier,
         governance_tier_history, autonomy_policy, case_status,
         contracted_closure_type, created_by_actor_id, version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, 1, ?, ?)
       ON CONFLICT (project_id) DO NOTHING
       RETURNING ${CASE_IDENTITY_COLUMNS}`,
      [
        candidateCaseId,
        workOrder.projectId,
        workOrder.organizationId,
        workOrder.caseProfile,
        workOrder.governanceTier,
        JSON.stringify(initialHistory),
        workOrder.autonomyPolicy,
        workOrder.contractedClosureType,
        confirmedByActorId,
        now,
        now,
      ]
    );

    let caseRow = inserted.rows[0] ?? null;
    const caseCreated = Boolean(caseRow);

    if (!caseRow) {
      // Lost the race, or a Case already existed for this project. Re-read the
      // committed winner (READ COMMITTED: this statement takes a fresh
      // snapshot, so the row the conflict blocked on is visible now).
      const existing = await client.query<CaseCoreIdentityRow>(
        `SELECT ${CASE_IDENTITY_COLUMNS} FROM case_core WHERE project_id = ?`,
        [workOrder.projectId]
      );
      caseRow = existing.rows[0] ?? null;
      // ON CONFLICT reported a conflict but the row is gone: structurally
      // impossible here (nothing in this codebase deletes case_core rows).
      // `*_idempotency_record_not_found` is the existing convention for this
      // anomaly and maps to 500, never to a client-facing 404.
      if (!caseRow) throw new Error('intake_case_idempotency_record_not_found');
      // CW-01-026-INV1: one org context per Case. A project whose Case sits in
      // a different org is a corrupted invariant, not a normal denial.
      if (caseRow.organization_id !== workOrder.organizationId) {
        throw new Error('intake_case_organization_mismatch');
      }
    }

    let caseCreatedEventId: string | null = null;
    if (caseCreated) {
      // Same event type, same aggregate, same summary keys caseCoreService's
      // createCase emits (EVENT_TAXONOMY.md §2), so a consumer cannot tell
      // which door this Case came through.
      const created = await publishEvent(client, {
        eventType: EVENT_CASE_CREATED,
        organizationId: caseRow.organization_id,
        projectId: caseRow.project_id,
        aggregateType: CASE_AGGREGATE_TYPE,
        aggregateId: caseRow.case_id,
        aggregateVersion: Number(caseRow.version),
        caseId: caseRow.case_id,
        actorUserId: caseRow.created_by_actor_id,
        correlationId: input?.correlationId ?? null,
        causationId: proposedEventId,
        redactedSummary: redact({
          caseProfile: caseRow.case_profile,
          governanceTier: caseRow.governance_tier,
          contractedClosureType: caseRow.contracted_closure_type,
          autonomyPolicy: caseRow.autonomy_policy,
          caseStatus: caseRow.case_status,
        }),
      });
      caseCreatedEventId = created.eventId;
    }

    // Deterministic id: a retry of this exact confirmation adds no second
    // event, and the race loser's publish reports `deduplicated: true`, which
    // is how the two reuse reasons are told apart below.
    const confirmed = await publishEvent(client, {
      eventId: confirmedEventId,
      eventType: EVENT_WORK_ORDER_CONFIRMED,
      organizationId: caseRow.organization_id,
      projectId: caseRow.project_id,
      aggregateType: CASE_AGGREGATE_TYPE,
      aggregateId: caseRow.case_id,
      aggregateVersion: Number(caseRow.version),
      caseId: caseRow.case_id,
      actorUserId: confirmedByActorId,
      correlationId: input?.correlationId ?? null,
      // The chain the auditor walks: proposal -> (case.created) -> confirmation.
      causationId: caseCreatedEventId ?? proposedEventId,
      redactedSummary: workOrderSummary(workOrder, workOrderDigest, {
        confirmedByActorId,
        confirmedDigest,
        caseId: caseRow.case_id,
        caseCreated,
        runCreated: false,
      }),
    });

    const reuseReason: WorkOrderReuseReason = caseCreated
      ? 'none'
      : confirmed.deduplicated
        ? 'work_order_already_confirmed'
        : 'existing_case_for_project';

    return {
      caseId: caseRow.case_id,
      workOrderId,
      workOrderDigest,
      caseCreated,
      reused: !caseCreated,
      reuseReason,
      confirmedEventId: confirmed.eventId,
      confirmedEventDeduplicated: confirmed.deduplicated,
      runCreated: false as const,
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Read-back
// ---------------------------------------------------------------------------

/**
 * Every work order ever confirmed against one Case, oldest first.
 *
 * This is the ONLY way to answer "which work order produced this Case" today
 * — see OPEN QUESTIONS #1: no `case_core` column carries the digest, so the
 * event stream is the record. Gated by `requireCaseAccess`, which makes an
 * unknown caseId and a cross-tenant caseId indistinguishable
 * (`case_access_denied` -> HTTP 404).
 */
export async function getConfirmedWorkOrders(
  caseId: string,
  actorUserId: string
): Promise<ConfirmedWorkOrderRecord[]> {
  const id = requireNonBlank(caseId, 'intake_case_id_required');
  const actor = requireNonBlank(actorUserId, 'intake_actor_required');

  await requireCaseAccess(actor, id);

  const rows = await queryAll<{
    event_id: string;
    case_id: string;
    actor_user_id: string;
    occurred_at: Date | string;
    redacted_summary: Record<string, unknown> | string | null;
  }>(
    `SELECT event_id, case_id, actor_user_id, occurred_at, redacted_summary
       FROM ${OUTBOX_TABLE}
      WHERE aggregate_type = $1 AND aggregate_id = $2 AND event_type = $3
      ORDER BY occurred_at ASC, created_at ASC`,
    [CASE_AGGREGATE_TYPE, id, EVENT_WORK_ORDER_CONFIRMED]
  );

  return rows.map((row) => {
    let summary: Record<string, unknown> = {};
    if (row.redacted_summary && typeof row.redacted_summary === 'string') {
      try {
        const parsed = JSON.parse(row.redacted_summary);
        if (parsed && typeof parsed === 'object') summary = parsed as Record<string, unknown>;
      } catch {
        summary = {};
      }
    } else if (row.redacted_summary && typeof row.redacted_summary === 'object') {
      summary = row.redacted_summary as Record<string, unknown>;
    }

    return {
      eventId: row.event_id,
      caseId: row.case_id,
      workOrderId: String(summary.workOrderId ?? ''),
      workOrderDigest: String(summary.workOrderDigest ?? ''),
      confirmedByActorId: row.actor_user_id,
      confirmedAt:
        row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at),
      summary,
    };
  });
}

// ===========================================================================
// 4. CONVERSATION BINDING — the layer the REAL chat/Teresa routes call
// ===========================================================================
/**
 * Everything above is conversation-agnostic: `confirmWorkOrder` takes the work
 * order FROM THE CALLER and only checks that the caller's digest matches the
 * caller's own order. That is enough for a machine-to-machine contract and it
 * is NOT enough for a chat surface, because it leaves the client free to
 * submit an order the human never saw and a digest computed over it. Check 1
 * (RECOMPUTE) passes trivially for such a pair; check 2 (WAS-SHOWN) only
 * proves that SOMEONE was once shown that order, not that it is what this
 * conversation is showing NOW.
 *
 * The three functions below close that hole, and they are the ONLY entry
 * points the chat/Teresa routes use:
 *
 *   proposeConversationWorkOrder   binds the proposal to a conversationId
 *                                  (never optional here — the link is what
 *                                  makes "return from the Case to the right
 *                                  conversation" answerable at all).
 *   getCurrentConversationWorkOrder  reads back the CURRENT (newest) proposal
 *                                  for a conversation, reconstructed from the
 *                                  event stream and re-digested.
 *   confirmConversationWorkOrder   takes ONLY a digest from the client. The
 *                                  work order that gets executed is the one
 *                                  the SERVER reads back. If the digest the
 *                                  human confirmed is not the current one,
 *                                  the answer is `intake_work_order_digest_stale`
 *                                  and no Case is created.
 *
 * That inversion — client sends a digest, server supplies the order — is what
 * makes "what you confirmed is what will be executed" true rather than merely
 * asserted. A client CANNOT confirm a superseded summary, because the digest
 * of a superseded summary is not the current digest, and it cannot smuggle a
 * different order in alongside a valid digest, because it never sends one.
 *
 * WHERE THE LINK LIVES. In the proposal/confirmation events' redacted summary
 * (`sourceConversationId`), which is already part of the DIGESTED work order —
 * so the conversation a Case came from is covered by the same signature the
 * human confirmed and cannot be rewritten after the fact. This packet adds no
 * migration (none is in its allowlist), so there is no `case_core` column and
 * no join; see OPEN QUESTIONS #1. Consequence, stated plainly: both link
 * lookups are event-stream scans filtered on a JSONB expression, and there is
 * no index on `redacted_summary->>'sourceConversationId'` today.
 */

/**
 * What may happen to Runs once this Case exists. Intake itself ALWAYS creates
 * zero Runs (see the header) — this value tells the surface what is permitted
 * NEXT, so a UI cannot invent a "start" button the policy forbids.
 *
 * LIGHT — the ceiling is one Run, and it may be started straight off the
 *   confirmed work order; there is no plan to publish first.
 * STANDARD / TRANSFORMATION — ZERO Runs until a plan version is published AND
 *   a human explicitly starts it. Confirming the work order creates the Case
 *   and nothing else.
 * MONITORING — treated as STANDARD deliberately: it has no defined intake
 *   run policy yet, and the safe default for an undefined policy is the one
 *   that starts nothing.
 */
export type RunStartPolicy =
  | 'MAY_START_SINGLE_RUN_AFTER_CONFIRMATION'
  | 'REQUIRES_PUBLISHED_PLAN_AND_EXPLICIT_START';

export function resolveRunStartPolicy(caseProfile: CaseProfile): RunStartPolicy {
  return caseProfile === 'LIGHT'
    ? 'MAY_START_SINGLE_RUN_AFTER_CONFIRMATION'
    : 'REQUIRES_PUBLISHED_PLAN_AND_EXPLICIT_START';
}

/** The current proposal for one conversation, reconstructed from the outbox. */
export interface ConversationWorkOrderProposal {
  conversationId: string;
  workOrderId: string;
  workOrderDigest: string;
  /** Re-digested on read: this object provably hashes to `workOrderDigest`. */
  workOrder: CanonicalWorkOrder;
  proposedEventId: string;
  proposedAt: string;
  proposedByActorId: string;
  runStartPolicy: RunStartPolicy;
  /** ALWAYS false — a proposal is not a Case (CW-CANON-01). */
  caseCreated: false;
  /** ALWAYS false — a proposal is not a Run. */
  runCreated: false;
}

export interface ConversationProposeResult extends ProposeWorkOrderResult {
  conversationId: string;
  runStartPolicy: RunStartPolicy;
}

export interface ConversationConfirmResult extends ConfirmWorkOrderResult {
  conversationId: string;
  runStartPolicy: RunStartPolicy;
}

/** The two-way link between a conversation and the Case it produced. */
export interface CaseConversationLink {
  caseId: string;
  conversationId: string;
  projectId: string | null;
  workOrderId: string;
  workOrderDigest: string;
  confirmedByActorId: string;
  confirmedAt: string;
  confirmedEventId: string;
}

interface IntakeOutboxRow {
  event_id: string;
  event_type: string;
  organization_id: string;
  project_id: string | null;
  aggregate_id: string;
  case_id: string | null;
  actor_user_id: string;
  occurred_at: Date | string;
  redacted_summary: Record<string, unknown> | string | null;
}

const INTAKE_OUTBOX_COLUMNS = `event_id, event_type, organization_id, project_id, aggregate_id,
  case_id, actor_user_id, occurred_at, redacted_summary`;

function summaryOf(row: IntakeOutboxRow): Record<string, unknown> {
  const raw = row.redacted_summary;
  if (raw && typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

function occurredAtOf(row: IntakeOutboxRow): string {
  return row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

/**
 * Rebuilds the canonical work order from the proposal event, then PROVES the
 * rebuild is faithful by re-digesting it and comparing to the digest stored in
 * the same row. Without that comparison this function would be a trust hole:
 * the summary passes through `redact()` on the way in, and any future change
 * to the PII field list (or to `normalizeWorkOrder`'s defaults) could silently
 * hand back an order that differs from the one the human read. A mismatch is
 * therefore an integrity failure, never something to paper over.
 */
function reconstructWorkOrder(row: IntakeOutboxRow): {
  workOrder: CanonicalWorkOrder;
  digest: string;
} {
  const summary = summaryOf(row);
  const storedDigest = String(summary.workOrderDigest ?? '');
  const storedVersion = Number(summary.workOrderSchemaVersion ?? 0);
  if (storedVersion !== WORK_ORDER_SCHEMA_VERSION) {
    // A v1 proposal must never be silently re-read under v2 rules.
    throw new Error('intake_work_order_schema_version_unsupported');
  }

  const workOrder = normalizeWorkOrder({
    organizationId: row.organization_id,
    projectId: String(row.project_id ?? ''),
    goal: String(summary.goal ?? ''),
    scope: stringList(summary.scope),
    expectedOutcome: String(summary.expectedOutcome ?? ''),
    constraints: stringList(summary.constraints),
    successCriteria: stringList(summary.successCriteria),
    contractedClosureType: summary.contractedClosureType as ClosureType,
    caseProfile: (summary.caseProfile ?? null) as CaseProfile | null,
    governanceTier: (summary.governanceTier ?? null) as GovernanceTier | null,
    autonomyPolicy: (summary.autonomyPolicy ?? null) as AutonomyPolicy | null,
    sourceConversationId: (summary.sourceConversationId ?? null) as string | null,
    sourceMessageId: (summary.sourceMessageId ?? null) as string | null,
  });

  const digest = computeWorkOrderDigest(workOrder);
  if (digest !== storedDigest) throw new Error('intake_work_order_reconstruction_mismatch');
  return { workOrder, digest };
}

/**
 * Proposes a work order that is BOUND to a conversation.
 *
 * Identical to `proposeWorkOrder` in every guarantee (zero Cases, zero Runs,
 * idempotent on the digest) with one addition: `sourceConversationId` is set
 * from the `conversationId` argument and a caller-supplied one in the draft is
 * OVERWRITTEN, not merged. The conversation a work order belongs to is decided
 * by the route that owns the conversation, never by the request body — the
 * same reasoning that keeps `organizationId` out of the body.
 */
export async function proposeConversationWorkOrder(input: {
  conversationId: string;
  workOrder: WorkOrderDraftInput;
  proposedByActorId: string;
  correlationId?: string | null;
}): Promise<ConversationProposeResult> {
  const conversationId = requireNonBlank(input?.conversationId, 'intake_conversation_id_required');

  const proposal = await proposeWorkOrder({
    workOrder: { ...input.workOrder, sourceConversationId: conversationId },
    proposedByActorId: input.proposedByActorId,
    correlationId: input?.correlationId ?? null,
  });

  return {
    ...proposal,
    conversationId,
    runStartPolicy: resolveRunStartPolicy(proposal.workOrder.caseProfile),
  };
}

/**
 * The CURRENT work order for a conversation — the newest proposal, which is by
 * definition the only one a human may confirm. Returns null when the
 * conversation never produced a proposal (an informational chat: CW-CANON-01).
 *
 * Fail-closed and enumeration-safe: `requireOrgMember` runs FIRST, so a
 * non-member gets the identical `not_org_member` answer whether the
 * conversation exists, belongs to another tenant, or does not exist at all.
 */
export async function getCurrentConversationWorkOrder(input: {
  conversationId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<ConversationWorkOrderProposal | null> {
  const conversationId = requireNonBlank(input?.conversationId, 'intake_conversation_id_required');
  const organizationId = requireNonBlank(input?.organizationId, 'intake_organization_id_required');
  const actorUserId = requireNonBlank(input?.actorUserId, 'intake_actor_required');

  await requireOrgMember(actorUserId, organizationId);

  const rows = await queryAll<IntakeOutboxRow>(
    `SELECT ${INTAKE_OUTBOX_COLUMNS}
       FROM ${OUTBOX_TABLE}
      WHERE organization_id = $1
        AND event_type = $2
        AND redacted_summary->>'sourceConversationId' = $3
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 1`,
    [organizationId, EVENT_WORK_ORDER_PROPOSED, conversationId]
  );

  const row = rows[0];
  if (!row) return null;

  const { workOrder, digest } = reconstructWorkOrder(row);

  return {
    conversationId,
    workOrderId: workOrderIdForDigest(digest),
    workOrderDigest: digest,
    workOrder,
    proposedEventId: row.event_id,
    proposedAt: occurredAtOf(row),
    proposedByActorId: row.actor_user_id,
    runStartPolicy: resolveRunStartPolicy(workOrder.caseProfile),
    caseCreated: false,
    runCreated: false,
  };
}

/**
 * Confirms a conversation's CURRENT work order and creates EXACTLY ONE Case.
 *
 * The client sends a digest and nothing else. Refusals, each leaving zero
 * Cases behind:
 *   `intake_conversation_work_order_not_proposed`  nothing was ever shown in
 *       this conversation — there is nothing a human could have confirmed.
 *   `intake_work_order_digest_stale`  (409) the confirmed digest is a real,
 *       previously-shown digest, but it is NOT the current one: the summary
 *       moved on between display and click. This is the security case. It is
 *       deliberately a SEPARATE code from
 *       `intake_work_order_digest_mismatch`, because the two say different
 *       things to an operator: "you sent an inconsistent pair" versus "you
 *       confirmed something that is no longer what we would execute".
 *
 * Concurrency: two simultaneous confirmations read the same current proposal
 * and both call `confirmWorkOrder`, whose `ON CONFLICT (project_id) DO
 * NOTHING` lets exactly one INSERT win. The loser returns the winner's Case
 * with `caseCreated: false`. One Case, no error either side has to interpret.
 *
 * Creates NO Run, for every profile. `runStartPolicy` says what MAY happen
 * next; nothing here acts on it.
 */
export async function confirmConversationWorkOrder(input: {
  conversationId: string;
  organizationId: string;
  confirmedDigest: string;
  confirmedByActorId: string;
  correlationId?: string | null;
}): Promise<ConversationConfirmResult> {
  const conversationId = requireNonBlank(input?.conversationId, 'intake_conversation_id_required');
  const organizationId = requireNonBlank(input?.organizationId, 'intake_organization_id_required');
  const confirmedDigest = requireNonBlank(
    input?.confirmedDigest,
    'intake_confirmed_digest_required'
  );
  const confirmedByActorId = requireNonBlank(input?.confirmedByActorId, 'intake_actor_required');

  // Fail closed before anything about the conversation is observable.
  await requireOrgMember(confirmedByActorId, organizationId);

  const current = await getCurrentConversationWorkOrder({
    conversationId,
    organizationId,
    actorUserId: confirmedByActorId,
  });
  if (!current) throw new Error('intake_conversation_work_order_not_proposed');

  if (current.workOrderDigest !== confirmedDigest) {
    throw new Error('intake_work_order_digest_stale');
  }

  const result = await confirmWorkOrder({
    // The SERVER's copy of the order — never the client's.
    workOrder: current.workOrder,
    confirmedDigest: current.workOrderDigest,
    confirmedByActorId,
    correlationId: input?.correlationId ?? null,
  });

  return {
    ...result,
    conversationId,
    runStartPolicy: current.runStartPolicy,
  };
}

function toLink(row: IntakeOutboxRow): CaseConversationLink | null {
  const summary = summaryOf(row);
  const conversationId = String(summary.sourceConversationId ?? '');
  const caseId = row.case_id ?? String(row.aggregate_id ?? '');
  if (!conversationId || !caseId) return null;
  return {
    caseId,
    conversationId,
    projectId: row.project_id,
    workOrderId: String(summary.workOrderId ?? ''),
    workOrderDigest: String(summary.workOrderDigest ?? ''),
    confirmedByActorId: row.actor_user_id,
    confirmedAt: occurredAtOf(row),
    confirmedEventId: row.event_id,
  };
}

/**
 * Conversation -> Case. "This chat already produced a work order; here is the
 * Case." Returns the FIRST confirmation, because that is the one that created
 * the Case; later confirmations against the same project reuse it.
 */
export async function findCaseForConversation(input: {
  conversationId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<CaseConversationLink | null> {
  const conversationId = requireNonBlank(input?.conversationId, 'intake_conversation_id_required');
  const organizationId = requireNonBlank(input?.organizationId, 'intake_organization_id_required');
  const actorUserId = requireNonBlank(input?.actorUserId, 'intake_actor_required');

  await requireOrgMember(actorUserId, organizationId);

  const rows = await queryAll<IntakeOutboxRow>(
    `SELECT ${INTAKE_OUTBOX_COLUMNS}
       FROM ${OUTBOX_TABLE}
      WHERE organization_id = $1
        AND event_type = $2
        AND redacted_summary->>'sourceConversationId' = $3
      ORDER BY occurred_at ASC, created_at ASC
      LIMIT 1`,
    [organizationId, EVENT_WORK_ORDER_CONFIRMED, conversationId]
  );

  return rows[0] ? toLink(rows[0]) : null;
}

/**
 * Case -> conversation. "Take me back to the chat this came from."
 *
 * Gated by `requireCaseAccess`, so an unknown caseId and a cross-tenant caseId
 * are indistinguishable (`case_access_denied` -> HTTP 404): the return link
 * must not become the enumeration oracle the rest of the surface refuses to
 * be.
 */
export async function findConversationForCase(
  caseId: string,
  actorUserId: string
): Promise<CaseConversationLink | null> {
  const id = requireNonBlank(caseId, 'intake_case_id_required');
  const actor = requireNonBlank(actorUserId, 'intake_actor_required');

  await requireCaseAccess(actor, id);

  const rows = await queryAll<IntakeOutboxRow>(
    `SELECT ${INTAKE_OUTBOX_COLUMNS}
       FROM ${OUTBOX_TABLE}
      WHERE aggregate_type = $1
        AND aggregate_id = $2
        AND event_type = $3
        AND redacted_summary->>'sourceConversationId' IS NOT NULL
      ORDER BY occurred_at ASC, created_at ASC
      LIMIT 1`,
    [CASE_AGGREGATE_TYPE, id, EVENT_WORK_ORDER_CONFIRMED]
  );

  return rows[0] ? toLink(rows[0]) : null;
}
