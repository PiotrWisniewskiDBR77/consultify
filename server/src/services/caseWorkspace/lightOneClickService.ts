/**
 * Case Workspace — LIGHT one-click start (packet CW-T-C).
 *
 * The ONE action behind "Zatwierdź i rozpocznij" for a LIGHT Case: from an
 * existing DRAFT/ACTIVE Case with `caseProfile === 'LIGHT'` to a Case with a
 * PUBLISHED minimal canonical Plan v1, exactly one bound Run and its
 * required NodeRun — in one semantic operation, idempotent, with an honest
 * "created, zero Run, exact reason" outcome when a safe start is not
 * possible. This file adds NO migration and OWNS NO table: every write goes
 * through an existing service's existing public function
 * (caseCoreService.transitionStatus, casePlanVersionService.{createPlanDraft,
 * validatePlanVersion,proposePlanVersion,publishPlanVersion},
 * contextSnapshotService.captureSnapshot, runBindingService.
 * bindRunToPlanVersion, nodeRunService.createNodeRun) — exactly the same
 * "call into the owning service" posture caseIntakeService.ts and
 * playService.ts already document for the tables they do not own — with ONE
 * deliberate, documented exception for `v8_execution_runs` itself; see
 * "WHY THIS FILE INSERTS v8_execution_runs DIRECTLY" below.
 *
 * ===========================================================================
 * WHY THIS FILE INSERTS v8_execution_runs DIRECTLY INSTEAD OF CALLING
 * executionSpineService.createRun
 * ===========================================================================
 * A deliberate departure from the "always call the owning service" rule
 * above, for a concrete, verified reason:
 * `executionSpineService.createRun`'s own `CreateRunParamsSchema`
 * (server/src/types/executionSpine.ts) requires `organizationId` AND
 * `initiatorUserId` to be `z.string().uuid()` — but this system's REAL
 * identities are not guaranteed to look like a UUID at all.
 * `scripts/dev/case-workspace-seed-local.mjs` — the exact seed script the
 * ZYWY STACK runbook this packet is proved against uses — mints
 * `organizationId: 'cw-local-org'` and `userId: 'cw-local-user'` verbatim
 * (and `server/src/routes/auth.routes.ts`'s demo-login path mints
 * `'demo-org'`/`'demo-user-id'` the same way), so `createRun` would reject
 * the exact actor/org this packet's own "DOWÓD na ŻYWYM stacku" requirement
 * runs as, with a raw ZodError that does not even match this directory's
 * `snake_case` error convention (routes/caseWorkspace/_shared/errors.ts
 * would fall through to an opaque 500). No other function in this entire
 * directory imposes a UUID-shape requirement — caseCoreService,
 * casePlanVersionService, runBindingService, nodeRunService and
 * contextSnapshotService.captureSnapshot all accept any non-blank string —
 * so this is `createRun`'s own, isolated constraint, not a codebase-wide
 * invariant this file should inherit.
 *
 * The fix is to mint the `v8_execution_runs` row here directly, with the
 * SAME `INSERT ... ON CONFLICT (run_id) DO NOTHING RETURNING *` idiom this
 * whole directory already uses (capabilityRegistryService.
 * recordIdempotencyKeyCheck, caseIntakeService.confirmWorkOrder,
 * runBindingService.bindRunToPlanVersion, nodeRunService.createNodeRun) —
 * except the `run_id` here is DETERMINISTIC, derived from `caseId` alone
 * (`stableRunId`), which `createRun` structurally cannot offer (it always
 * mints a fresh `uuidv4()` with no caller-supplied-id parameter at all).
 * That determinism is a strict improvement over relying on `createRun`
 * even ignoring the UUID issue: a retry after a mid-flight crash between
 * "run created" and "run bound" re-derives the SAME run_id, finds the row
 * already there (ON CONFLICT DO NOTHING), and proceeds straight to binding
 * it — so there is no orphaned-run window to document as an open question
 * the way there would be with a non-idempotent `createRun` call.
 *
 * ===========================================================================
 * WHY THIS IS NOT ONE DATABASE TRANSACTION (and what stands in for it)
 * ===========================================================================
 * `withPgTransaction` (server/src/utils/queryHelpers.ts) opens its OWN
 * dedicated `pg.Client` per call — it is NOT reentrant, and every service
 * function this file calls (transitionStatus, createPlanDraft,
 * proposePlanVersion, publishPlanVersion, bindRunToPlanVersion,
 * createNodeRun) opens its own. Calling one of them from inside another's
 * callback would run on a SECOND physical connection, not inside the first
 * one's BEGIN…COMMIT — so a single ACID transaction spanning
 * Case→Plan→Run→binding→NodeRun is not achievable without editing those
 * files, which this packet's allowlist forbids.
 *
 * What replaces it, deliberately:
 *
 *   1. A MUTEX, not a transaction — and an ADVISORY lock, not a row lock.
 *      `startLightOneClick` opens its own `withPgTransaction` and calls
 *      `pg_advisory_xact_lock(hashtext(caseId))`, then keeps that
 *      transaction OPEN (no COMMIT) for the ENTIRE remainder of the flow,
 *      including every call into another service's own separate connection.
 *      A concurrent second call for the SAME caseId blocks on that advisory
 *      lock until the first call's transaction commits or rolls back, i.e.
 *      until the first call is completely finished — the same serialization
 *      a `case_core ... FOR UPDATE` row lock would give, deliberately NOT
 *      via that row lock: `caseCoreService.transitionStatus` and
 *      `casePlanVersionService.createPlanDraft` (both called, on their OWN
 *      separate connections, from inside this flow) ALSO take
 *      `case_core ... FOR UPDATE` on this exact row — if this file held that
 *      SAME row lock open on ITS OWN connection while awaiting one of those
 *      calls, the sub-call's own `FOR UPDATE` would block forever waiting
 *      for a COMMIT that can only happen after that same `await` resolves: a
 *      guaranteed hang, not a graceful deadlock-and-abort (Postgres' deadlock
 *      detector only sees two DB sessions, one waiting on a lock the other
 *      session holds — it has no visibility into "the same Node.js call
 *      stack is waiting on both"). An advisory lock lives in a completely
 *      separate namespace from row locks, so it serializes concurrent
 *      `startLightOneClick` calls for the same caseId without ever
 *      contending with either sub-call's own row lock. This is what makes
 *      double-click and concurrent confirmation SERIALIZE rather than race
 *      OR hang: whichever call acquires the advisory lock second always
 *      observes the first call's fully-committed result before doing
 *      anything itself.
 *
 *   2. RESUMABLE STEPS, not compensation. Every step re-reads current state
 *      before acting and reuses whatever a PRIOR (possibly crashed) attempt
 *      already committed, in this precedence:
 *        a. a `case.light_one_click.started` outbox event with a
 *           DETERMINISTIC id derived from caseId alone (`completedEventId`)
 *           — if present, the whole operation is done; return its receipt,
 *           create nothing.
 *        b. a `case_workspace_run_bindings` row for this caseId — if
 *           present (step (5) below already ran, but step (6)'s NodeRun or
 *           this file's own completion event did not), reuse that Run and
 *           its Plan Version and proceed to NodeRun/completion only.
 *        c. a PUBLISHED `case_plan_versions` row for this caseId — if
 *           present (a prior attempt got as far as publishing but crashed
 *           before creating a Run), reuse it and skip straight to Run
 *           creation.
 *        d. a DRAFT/IN_REVIEW `case_plan_versions` row this file itself
 *           created (tagged via `LIGHT_PLAN_CHANGE_REASON` — see below) —
 *           resume it from wherever it stopped (validate→propose→publish).
 *        e. nothing found — create the minimal canonical LIGHT graph fresh.
 *      Because the mutex (1) guarantees no two attempts for the same caseId
 *      ever run concurrently, and because state is always re-read rather
 *      than assumed, a retry after a mid-flight crash always converges
 *      toward "exactly one bound Run, fully set up" rather than duplicating
 *      work — it can never observe its own previous attempt's writes as
 *      "not there yet" and redo them, because there is no previous attempt
 *      still running to race against.
 *
 *   3. NO Run is EVER created before the Plan is PUBLISHED, and the
 *      completion marker (2a) is published ONLY after the NodeRun exists —
 *      so a caller can never observe (or a crash can never leave behind) a
 *      Case that LOOKS started (has the completion event) but has zero Run,
 *      or a Run that is not bound to a real, published `casePlanVersionId`.
 *      Unlike a hypothetical call into `executionSpineService.createRun`
 *      (see "WHY THIS FILE INSERTS v8_execution_runs DIRECTLY" above), the
 *      `v8_execution_runs` INSERT this file performs IS itself idempotent
 *      (deterministic `run_id`, `ON CONFLICT DO NOTHING`), so even a process
 *      crash between "run row created" and "run bound" leaves no orphan: the
 *      next attempt derives the identical run_id and proceeds to bind it.
 *
 * ===========================================================================
 * WHY THE PLAN IS REAL, NOT A NULLABLE/FAKE STAND-IN
 * ===========================================================================
 * The owner's explicit instruction for this packet forbids working around
 * the `casePlanVersionId` requirement with a nullable FK or a fabricated
 * identifier. This file does the opposite of that on purpose: it builds one
 * real, minimal, structurally-valid `CanonicalGraph` (`buildLightMinimalGraph`
 * — one CAPABILITY node, zero edges, that node as both entry and terminal),
 * runs it through the SAME `createPlanDraft → validatePlanVersion →
 * proposePlanVersion → publishPlanVersion` sequence any human-authored LIGHT
 * plan takes, and only then calls `bindRunToPlanVersion`, which itself
 * refuses (`plan_version_not_publishable_for_run`) anything not PUBLISHED.
 * There is no code path in this file that binds a Run to anything but a real,
 * validated, published `case_plan_versions` row.
 *
 * ===========================================================================
 * SAFE-START GATE (the "utwórz Case z ZERO Run i pokaż DOKŁADNY POWÓD" branch)
 * ===========================================================================
 * `startLightOneClick` NEVER throws for an ordinary business refusal —
 * wrong profile, wrong Case status and plan-validation failure are the three
 * checked here — it RETURNS `{ outcome: 'refused', reasonCode, reasonDetail,
 * blockers }` instead. The Case is left exactly as it was (plus, if it was
 * DRAFT, activated to ACTIVE — see open_questions #2 for why that one step
 * is NOT rolled back on a later refusal): zero Run, an honest, specific
 * reason, never a fabricated success. Only truly exceptional conditions
 * (missing/inaccessible Case, wrong actor) throw, via the same
 * `snake_case`-message convention every other file in this directory uses,
 * chosen so `routes/caseWorkspace/_shared/errors.ts`'s EXISTING suffix
 * heuristics classify them correctly without that shared file needing an
 * edit (`_required`/`_invalid` -> 400, `_not_found` -> 404, `_not_ready`/
 * contains `_requires_` -> 409).
 *
 * OPEN QUESTIONS (named, not hidden — matches this directory's convention):
 *   1. This file's direct `v8_execution_runs` INSERT sets `state = 'drafting'`
 *      and never advances it through `executionSpineService`'s own
 *      drafting→…→completed state machine — nothing in the case-workspace
 *      surface reads that state (bindRunToPlanVersion/createNodeRun only
 *      check the row EXISTS), so this is inert today, but a future packet
 *      that unifies the V8 execution spine with case-workspace Runs should
 *      revisit whether a LIGHT one-click Run ought to be driven through that
 *      state machine too.
 *   2. If Plan validation refuses AFTER this file has already transitioned a
 *      DRAFT Case to ACTIVE, that transition is not rolled back — Case
 *      status transitions are supposed to be a one-way, auditable state
 *      machine (CW-RT-026: `caseCoreService` defines no `ACTIVE -> DRAFT`
 *      edge at all), so "undo the activation" is not an available move.
 *      ACTIVE-with-zero-Run is treated here as the intended honest resting
 *      state for a refused start, matching the packet brief's own language
 *      ("utwórz Case z ZERO Run i pokaż dokładny powód" — it does not say
 *      the Case must stay DRAFT).
 *   3. `LIGHT_PLAN_CHANGE_REASON` is a plain string match, not a structural
 *      tag — the collision-avoidance mandate leaves this file no column of
 *      its own to mark "this plan version belongs to the one-click flow"
 *      more durably. A human who happens to create a DRAFT plan version with
 *      exactly this changeReason text would be adopted by a later retry;
 *      considered acceptable because case_plan_versions.change_reason is
 *      never user-facing chrome and no UI in this codebase lets a human type
 *      an arbitrary changeReason for a LIGHT Case today.
 */

import { createHash } from 'node:crypto';

import { getCorrelationId } from '../../utils/RequestStore.js';
import { queryOne, withPgTransaction } from '../../utils/queryHelpers.js';
import { captureSnapshot } from '../v8/contextSnapshotService.js';
import * as caseCoreService from './caseCoreService.js';
import type { CaseCore } from './caseCoreService.js';
import * as planSvc from './casePlanVersionService.js';
import type { CanonicalGraph, CasePlanVersion, PlanValidationBlocker } from './casePlanVersionService.js';
import { requireCaseAccess } from './caseWorkspaceAuthContext.js';
import { publishEvent, redact } from './eventOutboxService.js';
import { createNodeRun } from './nodeRunService.js';
import type { NodeRun } from './nodeRunService.js';
import { bindRunToPlanVersion } from './runBindingService.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The single node of the minimal canonical LIGHT graph — see open_question #3. */
const LIGHT_NODE_ID = 'light-work';
const LIGHT_NODE_VERSION = 'v1';

/**
 * The marker this file writes into `change_reason` so a resumed attempt can
 * find (and only find) a plan draft/in-review row IT created, never a
 * human-authored one that happens to share a case_id — see open_question #3.
 */
const LIGHT_PLAN_CHANGE_REASON = 'case-workspace:light-one-click:v1';

const LIGHT_ONE_CLICK_EVENT_TYPE = 'case.light_one_click.started';
const CASE_AGGREGATE_TYPE = 'CASE';

// ---------------------------------------------------------------------------
// Local helpers (this directory's own convention: each service file keeps a
// private copy rather than importing another file's — see caseCoreService.ts
// / casePlanVersionService.ts's identical header notes).
// ---------------------------------------------------------------------------

function requireNonBlank(value: string | null | undefined, reason: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(reason);
  return normalized;
}

/** Deterministic, derived from caseId ALONE — see the file header (2a). */
function completedEventIdForCase(caseId: string): string {
  const hex = createHash('sha256').update(`light-one-click:v1:${caseId}`).digest('hex');
  return `cwevt-light1c-${hex.slice(0, 32)}`;
}

/**
 * Deterministic, derived from caseId ALONE — see "WHY THIS FILE INSERTS
 * v8_execution_runs DIRECTLY" in the file header. LIGHT's own ceiling is one
 * Run ever, so one deterministic id per Case is the correct scope (not per
 * idempotencyKey — a header note explains why that header is log-only here).
 */
function stableRunId(caseId: string): string {
  const hex = createHash('sha256').update(`light-one-click:v1:run:${caseId}`).digest('hex');
  return `cwrun-light-${hex.slice(0, 32)}`;
}

function buildLightMinimalGraph(): CanonicalGraph {
  return {
    schemaVersion: '1',
    entryNodeIds: [LIGHT_NODE_ID],
    terminalNodeIds: [LIGHT_NODE_ID],
    nodes: [
      {
        nodeId: LIGHT_NODE_ID,
        type: 'CAPABILITY',
        effectClass: 'SAFE_ADDITIVE',
        tags: ['light-one-click'],
      },
    ],
    edges: [],
    variables: [],
    metadata: { generatedBy: 'lightOneClickService', purpose: 'LIGHT minimal canonical plan v1' },
  };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LightOneClickReceipt {
  caseId: string;
  case: CaseCore;
  casePlanVersionId: string;
  planVersion: CasePlanVersion;
  runId: string;
  nodeRunIds: string[];
}

export type LightOneClickResult =
  | ({ outcome: 'started'; alreadyStarted: false } & LightOneClickReceipt)
  | ({ outcome: 'already_started'; alreadyStarted: true } & LightOneClickReceipt)
  | {
      outcome: 'refused';
      alreadyStarted: false;
      caseId: string;
      case: CaseCore;
      reasonCode: string;
      reasonDetail: string;
      blockers: PlanValidationBlocker[];
    };

// ---------------------------------------------------------------------------
// Plan resolution — createPlanDraft -> validate -> propose -> publish,
// resumable at any point (file header §2c/§2d/§2e).
// ---------------------------------------------------------------------------

type EnsurePlanOutcome =
  | { outcome: 'published'; planVersion: CasePlanVersion }
  | {
      outcome: 'refused';
      reasonCode: string;
      reasonDetail: string;
      blockers: PlanValidationBlocker[];
    };

async function ensureLightPlanPublished(
  caseId: string,
  actorUserId: string,
  correlationId: string | null
): Promise<EnsurePlanOutcome> {
  const versions = await planSvc.listPlanVersionsForCase(caseId, actorUserId);

  const published = versions.find((v) => v.status === 'PUBLISHED');
  if (published) return { outcome: 'published', planVersion: published };

  let draft =
    versions.find((v) => v.status === 'IN_REVIEW' && v.changeReason === LIGHT_PLAN_CHANGE_REASON) ??
    versions.find((v) => v.status === 'DRAFT' && v.changeReason === LIGHT_PLAN_CHANGE_REASON) ??
    null;

  if (!draft) {
    draft = await planSvc.createPlanDraft({
      caseId,
      semanticGraph: buildLightMinimalGraph(),
      changeReason: LIGHT_PLAN_CHANGE_REASON,
      createdByActorId: actorUserId,
    });
  }

  if (draft.status === 'DRAFT') {
    const validation = await planSvc.validatePlanVersion(draft.casePlanVersionId, actorUserId);
    if (!validation.valid) {
      const blocking = validation.blockers.filter((b) => b.severity === 'BLOCKING');
      return {
        outcome: 'refused',
        reasonCode: 'light_one_click_plan_validation_failed',
        reasonDetail:
          `Minimalny plan LIGHT nie przeszedł walidacji: ` +
          blocking.map((b) => `${b.code} — ${b.detail}`).join('; '),
        blockers: blocking,
      };
    }
    draft = await planSvc.proposePlanVersion(draft.casePlanVersionId, { actorUserId }, draft.version);
  }

  if (draft.status === 'IN_REVIEW') {
    try {
      draft = await planSvc.publishPlanVersion(draft.casePlanVersionId, { actorUserId }, draft.version);
    } catch (err) {
      // publishPlanVersion re-validates internally; a failure here for OUR
      // OWN deterministic minimal graph would be a real anomaly, but it must
      // still surface as an honest refusal, never a 500 masquerading as
      // "started".
      const message = err instanceof Error ? err.message : 'plan_publish_validation_failed';
      return {
        outcome: 'refused',
        reasonCode: 'light_one_click_plan_validation_failed',
        reasonDetail: `Publikacja planu LIGHT nie powiodła się: ${message}`,
        blockers: [],
      };
    }
  }

  if (draft.status !== 'PUBLISHED') {
    return {
      outcome: 'refused',
      reasonCode: 'light_one_click_plan_not_publishable',
      reasonDetail: `Plan LIGHT jest w nieoczekiwanym stanie: ${draft.status}.`,
      blockers: [],
    };
  }

  void correlationId; // reserved: propose/publish resolve correlation from ambient RequestStore today.
  return { outcome: 'published', planVersion: draft };
}

// ---------------------------------------------------------------------------
// Run resolution — reuse an existing binding, or capture+create+bind fresh
// (file header §2b / §3).
// ---------------------------------------------------------------------------

async function ensureLightRunBound(input: {
  caseCore: CaseCore;
  planVersion: CasePlanVersion;
  actorUserId: string;
}): Promise<{ runId: string }> {
  const existing = await queryExistingRunBinding(input.caseCore.caseId);
  if (existing) return { runId: existing.runId };

  const runId = await ensureLightExecutionRun(input.caseCore, input.actorUserId, input.planVersion);

  const binding = await bindRunToPlanVersion({
    runId,
    casePlanVersionId: input.planVersion.casePlanVersionId,
    boundByActorId: input.actorUserId,
  });

  return { runId: binding.runId };
}

/**
 * Mints (or, on a resumed retry, reuses) the `v8_execution_runs` row this
 * Case's Run binds to — see "WHY THIS FILE INSERTS v8_execution_runs
 * DIRECTLY" in the file header for why this is a direct INSERT rather than
 * a call to `executionSpineService.createRun`.
 */
async function ensureLightExecutionRun(
  caseCore: CaseCore,
  actorUserId: string,
  planVersion: CasePlanVersion
): Promise<string> {
  const runId = stableRunId(caseCore.caseId);

  const already = await queryOne<{ run_id: string }>(
    `SELECT run_id FROM v8_execution_runs WHERE run_id = ?`,
    [runId]
  );
  if (already) return already.run_id;

  const snapshot = await captureSnapshot({
    workspaceId: caseCore.projectId || caseCore.organizationId,
    organizationId: caseCore.organizationId,
    projectId: caseCore.projectId,
    conversationId: null,
    executionRunId: null,
    artifactRefs: [],
    effectiveScopeRef: `case:${caseCore.caseId}`,
    resolvedRoleRef: 'case_workspace_light_one_click',
    initiatorUserId: actorUserId,
    consumerClass: 'execution',
    privacyMode: false,
    sourceContextRefs: [
      { sourceId: caseCore.caseId, scopeType: 'organization', sourceKind: 'case', freshnessAt: null },
    ],
  });

  return withPgTransaction(async (client) => {
    const now = new Date().toISOString();
    const inserted = await client.query<{ run_id: string }>(
      `INSERT INTO v8_execution_runs (
         run_id, organization_id, context_snapshot_id, initiator_user_id,
         state, plan_version, goal, created_at, updated_at, metadata
       ) VALUES (?, ?, ?, ?, 'drafting', 1, ?, ?, ?, ?)
       ON CONFLICT (run_id) DO NOTHING
       RETURNING run_id`,
      [
        runId,
        caseCore.organizationId,
        snapshot.snapshotId,
        actorUserId,
        `LIGHT one-click start — case ${caseCore.caseId}`,
        now,
        now,
        JSON.stringify({
          source: 'case-workspace-light-one-click',
          caseId: caseCore.caseId,
          casePlanVersionId: planVersion.casePlanVersionId,
        }),
      ]
    );
    if (inserted.rows[0]) return inserted.rows[0].run_id;

    // Lost a race against a concurrent attempt for the SAME caseId — cannot
    // happen while the caller holds the case_core mutex (file header §1),
    // but re-reading rather than assuming keeps this function correct even
    // if ever called outside that mutex in the future.
    const race = await client.query<{ run_id: string }>(
      `SELECT run_id FROM v8_execution_runs WHERE run_id = ?`,
      [runId]
    );
    const raceRow = race.rows[0];
    if (!raceRow) throw new Error('light_one_click_run_insert_failed');
    return raceRow.run_id;
  });
}

async function queryExistingRunBinding(caseId: string): Promise<{ runId: string } | null> {
  const row = await queryOne<{ run_id: string }>(
    `SELECT run_id FROM case_workspace_run_bindings WHERE case_id = ? ORDER BY created_at ASC LIMIT 1`,
    [caseId]
  );
  return row ? { runId: row.run_id } : null;
}

// ---------------------------------------------------------------------------
// Completion marker readback (file header §2a).
// ---------------------------------------------------------------------------

interface CompletedSummary {
  casePlanVersionId?: string;
  runId?: string;
  nodeRunIds?: string[];
}

async function readCompletedReceipt(
  caseId: string,
  actorUserId: string
): Promise<LightOneClickReceipt | null> {
  const completedEventId = completedEventIdForCase(caseId);
  const row = await queryOne<{ redacted_summary: unknown }>(
    `SELECT redacted_summary FROM case_workspace_event_outbox WHERE event_id = ? AND case_id = ?`,
    [completedEventId, caseId]
  );
  if (!row) return null;

  const raw = row.redacted_summary;
  const summary: CompletedSummary =
    typeof raw === 'string' ? (JSON.parse(raw) as CompletedSummary) : ((raw ?? {}) as CompletedSummary);

  const caseCore = await caseCoreService.getCase({ caseId }, actorUserId);
  if (!caseCore) throw new Error('light_one_click_case_not_found');
  const casePlanVersionId = requireNonBlank(
    summary.casePlanVersionId,
    'light_one_click_completed_summary_invalid'
  );
  const planVersion = await planSvc.getPlanVersion(casePlanVersionId, actorUserId);
  if (!planVersion) throw new Error('light_one_click_completed_plan_missing');
  const runId = requireNonBlank(summary.runId, 'light_one_click_completed_summary_invalid');

  return {
    caseId,
    case: caseCore,
    casePlanVersionId,
    planVersion,
    runId,
    nodeRunIds: Array.isArray(summary.nodeRunIds) ? summary.nodeRunIds : [],
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * "Zatwierdź i rozpocznij" for a LIGHT Case, in full — see the file header.
 *
 * `caseId` MUST already exist (created via the existing intake/createCase
 * paths this packet does not touch) and MUST have `caseProfile === 'LIGHT'`
 * — every other profile is refused with `light_one_click_requires_light_
 * profile` (409, matches STANDARD/TRANSFORMATION's "zero Run before publish
 * and explicit start" policy verbatim: this command simply does not apply to
 * them).
 */
export async function startLightOneClick(input: {
  caseId: string;
  actorUserId: string;
  correlationId?: string | null;
}): Promise<LightOneClickResult> {
  const caseId = requireNonBlank(input?.caseId, 'light_one_click_case_id_required');
  const actorUserId = requireNonBlank(input?.actorUserId, 'light_one_click_actor_required');
  const correlationId = input?.correlationId ?? getCorrelationId() ?? null;

  // Fail closed BEFORE the mutex is even opened — mirrors every other
  // mutating method in this directory (e.g. caseCoreService.transitionStatus).
  await requireCaseAccess(actorUserId, caseId);

  // THE MUTEX (file header §1): an ADVISORY lock, held open for the ENTIRE
  // remainder of this function — including every call into another
  // service's own connection — WITHOUT taking the `case_core` row lock
  // those sub-calls also take (see the header for why that would hang).
  return withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [caseId]);

    const caseRowResult = await client.query<{
      case_id: string;
      case_profile: string;
      case_status: string;
      organization_id: string;
      project_id: string | null;
    }>(`SELECT case_id, case_profile, case_status, organization_id, project_id FROM case_core WHERE case_id = ?`, [
      caseId,
    ]);
    const caseRow = caseRowResult.rows[0];
    if (!caseRow) throw new Error('light_one_click_case_not_found');

    if (caseRow.case_profile !== 'LIGHT') {
      throw new Error('light_one_click_requires_light_profile');
    }
    if (caseRow.case_status !== 'DRAFT' && caseRow.case_status !== 'ACTIVE') {
      throw new Error('light_one_click_case_not_ready');
    }

    // §2a — the definitive "already fully done" short-circuit.
    const alreadyCompleted = await readCompletedReceipt(caseId, actorUserId);
    if (alreadyCompleted) {
      return { outcome: 'already_started', alreadyStarted: true, ...alreadyCompleted };
    }

    // Activate a DRAFT Case as part of "rozpocznij" — see open_question #2
    // for why this one step is not undone on a later refusal.
    if (caseRow.case_status === 'DRAFT') {
      await caseCoreService.transitionStatus(
        caseId,
        'ACTIVE',
        { actorUserId },
        'Automatyczny start LIGHT (Zatwierdź i rozpocznij)'
      );
    }

    const planOutcome = await ensureLightPlanPublished(caseId, actorUserId, correlationId);
    if (planOutcome.outcome === 'refused') {
      const caseAfter = await caseCoreService.getCase({ caseId }, actorUserId);
      if (!caseAfter) throw new Error('light_one_click_case_not_found');
      return {
        outcome: 'refused',
        alreadyStarted: false,
        caseId,
        case: caseAfter,
        reasonCode: planOutcome.reasonCode,
        reasonDetail: planOutcome.reasonDetail,
        blockers: planOutcome.blockers,
      };
    }

    const caseCoreForRun = await caseCoreService.getCase({ caseId }, actorUserId);
    if (!caseCoreForRun) throw new Error('light_one_click_case_not_found');

    const { runId } = await ensureLightRunBound({
      caseCore: caseCoreForRun,
      planVersion: planOutcome.planVersion,
      actorUserId,
    });

    const nodeRun: NodeRun = await createNodeRun(
      {
        caseId,
        runId,
        nodeId: LIGHT_NODE_ID,
        nodeVersionRef: planOutcome.planVersion.graphDigest || LIGHT_NODE_VERSION,
        idempotencyKey: `light-one-click:${caseId}:${LIGHT_NODE_ID}`,
        initialStatus: 'READY',
      },
      actorUserId
    );

    // §2a completion marker — published LAST, deterministic on caseId alone,
    // so a retry that reaches this point again for the same caseId (crash
    // after this commits, before the client saw the response) reads it back
    // as `already_started` rather than repeating any of the above.
    const completedEventId = completedEventIdForCase(caseId);
    await withPgTransaction(async (eventClient) => {
      await publishEvent(eventClient, {
        eventId: completedEventId,
        eventType: LIGHT_ONE_CLICK_EVENT_TYPE,
        organizationId: caseRow.organization_id,
        projectId: caseRow.project_id,
        aggregateType: CASE_AGGREGATE_TYPE,
        aggregateId: caseId,
        caseId,
        runId,
        actorUserId,
        correlationId,
        redactedSummary: redact({
          caseProfile: 'LIGHT',
          casePlanVersionId: planOutcome.planVersion.casePlanVersionId,
          graphDigest: planOutcome.planVersion.graphDigest,
          runId,
          nodeRunIds: [nodeRun.nodeRunId],
        }),
      });
    });

    const caseAfter = await caseCoreService.getCase({ caseId }, actorUserId);
    if (!caseAfter) throw new Error('light_one_click_case_not_found');
    const planVersionAfter = await planSvc.getPlanVersion(
      planOutcome.planVersion.casePlanVersionId,
      actorUserId
    );
    if (!planVersionAfter) throw new Error('light_one_click_completed_plan_missing');

    return {
      outcome: 'started',
      alreadyStarted: false,
      caseId,
      case: caseAfter,
      casePlanVersionId: planVersionAfter.casePlanVersionId,
      planVersion: planVersionAfter,
      runId,
      nodeRunIds: [nodeRun.nodeRunId],
    };
  });
}
