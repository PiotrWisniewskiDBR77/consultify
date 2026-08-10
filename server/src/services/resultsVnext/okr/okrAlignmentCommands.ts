/**
 * OKR-E005 — Alignment command layer.
 *
 * Design: docs/product/results-vnext/OKR_E005_DESIGN.md §A-§H, ratified by
 * the §-IO Integration Owner rulings block at the top of that document.
 *
 * Re-verified against OKR-E001/E002/E003's ACTUAL LANDED code (ruling IO-1)
 * before writing a single line here — all three epics are merged in this
 * worktree, not just their frozen design docs.
 *
 * ★ THE DEFINING CONSTRAINT OF THIS EPIC (D09/OKR-F-015, the
 * acceptance-evidence text is literally "brak FK/roll-up inheritance" —
 * 01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md §2's gate table): creating or
 * responding to an alignment must NEVER mutate the source or target
 * Objective's `progress`/`confidence`/any other column, in either
 * direction, ever. This file contains ZERO `UPDATE okr_vnext_objectives`
 * statements and ZERO calls into any `okrObjectiveCommands.ts` mutation —
 * every read of `okr_vnext_objectives` below is a plain `SELECT` used only
 * for ownership/cycle/visibility pre-checks. See
 * `tests/resultsVnext/okr/alignmentNoScoreMutation.static.test.ts` (Layer 2)
 * and `tests/resultsVnext/okr/alignmentNoScoreMutation.realdb.test.ts`
 * (Layers 3+4) for the structural proof; the DDL itself (Layer 1) has no
 * trigger, per `server/migrations/20260825_rvn_okr_alignment.sql`.
 *
 * ★ IO-1 DIVERGENCE FROM THE FROZEN DESIGN DRAFT (binding, restated in the
 * EXECUTION_LEDGER closure entry): the draft assumed OKR-E003 would
 * register a new `'okr_objective'` ABAC resource_type
 * (`RVN_RESOURCE_TYPES`/`rvn_platform_resource_visibility`) for Objectives,
 * and that this epic's read layer would join against it directly. Direct
 * read of the ACTUAL LANDED `okrObjectiveRepository.ts`/
 * `okrObjectiveCommands.ts`/`20260824_rvn_okr_objective_key_result.sql`
 * shows E003 made a different, simpler choice: Objectives/KeyResults have
 * NO independent resource_type — they inherit visibility entirely through
 * the parent Set's own `'okr_set'` visibility row, joined on `set_id`. Every
 * ownership/visibility/cycle check below is written against that real
 * landed shape (join through `okr_vnext_objectives.set_id ->
 * okr_vnext_sets.cycle_id`, visibility checks scoped to
 * `resourceType: OKR_SET_RESOURCE_TYPE`), never against a nonexistent
 * `'okr_objective'` resource type.
 *
 * Naming: the design draft's own error-class sketch used an
 * `ObjectiveAlignment*Error` prefix. This file uses `OkrAlignment*Error`
 * instead, to match this program's ACTUAL landed convention (`OkrSet*Error`,
 * `OkrObjective*Error`, `OkrCycle*Error` — always `Okr<Aggregate>`, never
 * `<Aggregate>` alone) — a naming-only deviation, stated explicitly per this
 * program's own "state deviations, never decide silently" discipline.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { createObligation } from '../platform/obligations.js';
import { VISIBILITY_CTE_PARAM_COUNT, wrapWithVisibilityScope } from '../platform/visibilityScopedQuery.js';

import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import { OKR_SET_RESOURCE_TYPE } from './okrSetCommands.js';
import { OkrObjectiveNotFoundError } from './okrObjectiveCommands.js';
import {
  toOkrAlignment,
  type OkrAlignment,
  type OkrAlignmentRow,
} from './okrAlignmentTypes.js';

// ==========================================
// SHARED CONSTANTS
// ==========================================

export const OKR_ALIGNMENT_AGGREGATE_TYPE = 'okr_alignment';

/** §-IO item 8 / design §I / §J item 8: a design ADDITION beyond the
 * literal AC table, stated explicitly (not silently assumed) — same class
 * of addition OKR-E002 D14/D15 made for their own obligation types. Low
 * risk: `createObligation`'s `obligationType` is free-text (no enum found
 * in `platform/obligations.ts` on direct read). */
export const REVIEW_ALIGNMENT_PROPOSAL_OBLIGATION_TYPE = 'review_alignment_proposal';

/** Bounded-depth defensive cap for the cycle-detection recursive CTE — same
 * defensive-bound philosophy as `managementChainMaintenance.ts`'s
 * `orgSize`-hop cap (guards a pre-existing corrupted cycle from looping
 * forever, and against pathological fan-out). Not AC-sourced — a generous,
 * arbitrary constant (design §D). */
const ALIGNMENT_CYCLE_WALK_MAX_DEPTH = 50;

// ==========================================
// ERRORS
// ==========================================

/** Generic invalid-input / bad-transition guard for Alignment commands —
 * mirrors `OkrObjectiveValidationError`'s role in the Objective command
 * layer. */
export class OkrAlignmentValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrAlignmentValidationError';
    this.code = code;
    this.details = details;
  }
}

/** OKR-F-016: same-Cycle (transitively same-Program) compatibility failed —
 * design §C's chosen interpretation (same `organization_id` AND same
 * `cycle_id`, resolved via each Objective's own Set). Enforced BOTH here
 * (fail-fast, named error) AND by the DB-level
 * `CHECK (source_cycle_id = target_cycle_id)` (defense in depth — see
 * `okrAlignmentCycleBoundary.realdb.test.ts`). */
export class OkrAlignmentCycleMismatchError extends Error {
  code = 'CYCLE_MISMATCH';
  details: Record<string, unknown>;
  constructor(sourceCycleId: string, targetCycleId: string) {
    super(`Objective alignment rejected: source Cycle ${sourceCycleId} does not match target Cycle ${targetCycleId}`);
    this.name = 'OkrAlignmentCycleMismatchError';
    this.details = { sourceCycleId, targetCycleId };
  }
}

/** OKR-F-016: graph-cycle rejection — general reachability over the
 * `accepted`-edge graph (design §D), not the single-parent-chain algorithm
 * `managementChainMaintenance.ts` uses (alignment is a many-to-many DAG). */
export class OkrAlignmentCycleDetectedError extends Error {
  code = 'CYCLE_DETECTED';
  details: Record<string, unknown>;
  constructor(sourceObjectiveId: string, targetObjectiveId: string) {
    super(
      `Aligning Objective ${sourceObjectiveId} to ${targetObjectiveId} would create a cycle in the accepted alignment graph`
    );
    this.name = 'OkrAlignmentCycleDetectedError';
    this.details = { sourceObjectiveId, targetObjectiveId };
  }
}

/** Design §E's structural addition: `proposeAlignment` requires the
 * proposer to currently have view-visibility into the TARGET Objective (via
 * its owning Set); `acceptAlignment` symmetrically re-confirms the
 * responder can still see the SOURCE Objective. Not present in any AC —
 * flagged in the closure entry (§J item 6/7), not silently assumed. */
export class OkrAlignmentVisibilityDeniedError extends Error {
  code = 'VISIBILITY_DENIED';
  details: Record<string, unknown>;
  constructor(objectiveId: string, setId: string) {
    super(`Objective ${objectiveId} (Set ${setId}) is not visible to the caller — alignment rejected`);
    this.name = 'OkrAlignmentVisibilityDeniedError';
    this.details = { objectiveId, setId };
  }
}

// ==========================================
// SHARED HELPERS
// ==========================================

interface AlignmentObjectiveContext {
  objectiveId: string;
  setId: string;
  cycleId: string;
  ownerUserId: string;
}

/**
 * Plain read, no cascade concern — resolves the fields alignment commands
 * need to validate an Objective endpoint: its owning Set (for the
 * visibility join, per IO-1's divergence note above) and that Set's
 * `cycle_id` (for OKR-F-016's same-Cycle check). This file NEVER imports
 * `okrObjectiveCommands.ts`'s own row loaders (which are `FOR UPDATE`,
 * intended for mutation) — alignment never locks or mutates an Objective
 * row.
 */
async function loadObjectiveContextForAlignment(
  client: PoolClient,
  objectiveId: string,
  organizationId: string
): Promise<AlignmentObjectiveContext | undefined> {
  const result = await client.query<{
    objective_id: string;
    set_id: string;
    owner_user_id: string;
    cycle_id: string;
  }>(
    `SELECT o.objective_id, o.set_id, o.owner_user_id, s.cycle_id
       FROM okr_vnext_objectives o
       JOIN okr_vnext_sets s ON s.set_id = o.set_id
      WHERE o.objective_id = $1 AND o.organization_id = $2`,
    [objectiveId, organizationId]
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return { objectiveId: row.objective_id, setId: row.set_id, cycleId: row.cycle_id, ownerUserId: row.owner_user_id };
}

/**
 * Design §E / §G: visibility is derived at read time from the Objective's
 * OWNING SET's `'okr_set'` visibility row (IO-1 divergence note above) —
 * never an independent `'okr_objective'` resource type, which does not
 * exist in landed code. Throws `OkrAlignmentVisibilityDeniedError` if the
 * viewer cannot see `setId`.
 */
async function assertObjectiveVisibleToViewer(
  client: PoolClient,
  params: { userId: string; organizationId: string; objectiveId: string; setId: string }
): Promise<void> {
  const { userId, organizationId, objectiveId, setId } = params;
  const wrapped = await wrapWithVisibilityScope(
    `SELECT 1
       FROM rvn_visible_resources vr
      WHERE vr.resource_type = '${OKR_SET_RESOURCE_TYPE}' AND vr.resource_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}::text
      LIMIT 1`,
    { userId, organizationId, resourceType: OKR_SET_RESOURCE_TYPE }
  );
  const values = [...wrapped.values, setId];
  const result = await client.query(wrapped.sql, values);
  if ((result.rowCount ?? 0) === 0) {
    throw new OkrAlignmentVisibilityDeniedError(objectiveId, setId);
  }
}

/**
 * OKR-F-016 / design §D: general graph-reachability cycle check over the
 * `accepted`-edge subgraph only (a `proposed`, not-yet-agreed edge is not
 * yet a live contribution relationship — see design §D). Before inserting
 * `source -> target`, asks "can `target` already reach `source`?" — if yes,
 * adding the candidate edge would close a cycle
 * (`source -> target -> ... -> source`).
 *
 * Called at BOTH `proposeAlignment` time (OKR-F-016-AC-01's literal
 * "walidacja przy create") AND `acceptAlignment` time (design §D's stated
 * addition, defending against two independently-acyclic `proposed` edges
 * jointly closing a cycle once both are accepted).
 */
export async function assertNoAlignmentCycle(
  client: PoolClient,
  params: { organizationId: string; sourceObjectiveId: string; targetObjectiveId: string }
): Promise<void> {
  const { organizationId, sourceObjectiveId, targetObjectiveId } = params;
  const result = await client.query<{ objective_id: string }>(
    `WITH RECURSIVE reachable AS (
       SELECT target_objective_id AS objective_id, 1 AS depth
         FROM okr_vnext_alignments
        WHERE source_objective_id = $1
          AND status = 'accepted'
          AND organization_id = $3
       UNION ALL
       SELECT a.target_objective_id, r.depth + 1
         FROM okr_vnext_alignments a
         JOIN reachable r ON a.source_objective_id = r.objective_id
        WHERE a.status = 'accepted'
          AND a.organization_id = $3
          AND r.depth < ${ALIGNMENT_CYCLE_WALK_MAX_DEPTH}
     )
     SELECT 1 AS objective_id FROM reachable WHERE objective_id = $2 LIMIT 1`,
    [targetObjectiveId, sourceObjectiveId, organizationId]
  );
  if ((result.rowCount ?? 0) > 0) {
    throw new OkrAlignmentCycleDetectedError(sourceObjectiveId, targetObjectiveId);
  }
}

function alignmentRowVersion(row: OkrAlignmentRow): number {
  return row.row_version;
}

async function loadAlignmentForUpdate(
  client: PoolClient,
  alignmentId: string,
  organizationId: string
): Promise<OkrAlignmentRow | undefined> {
  const result = await client.query<OkrAlignmentRow>(
    `SELECT * FROM okr_vnext_alignments WHERE alignment_id = $1 AND organization_id = $2 FOR UPDATE`,
    [alignmentId, organizationId]
  );
  return result.rows[0];
}

// ==========================================
// proposeAlignment (OKR-F-014-AC-01 / OKR-F-016-AC-01, design §A/§C/§D/§E)
// ==========================================

export interface ProposeAlignmentInput {
  organizationId: string;
  sourceObjectiveId: string;
  targetObjectiveId: string;
  rationale?: string | null;
  proposedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface ProposeAlignmentResult {
  alignment: OkrAlignment;
  /** `false` = a pre-existing, live (`proposed`/`accepted`) edge for this
   * exact (org, source, target, relation) tuple was found and returned
   * instead of creating a new one — mirrors `createOkrSet`'s D3 dedupe
   * contract exactly (`ux_okr_vnext_alignments_live_edge`). */
  created: boolean;
}

/**
 * Design §A/§C/§D/§E, executed in this order (fail fast, cheapest checks
 * first):
 *   1. source/target Objective both exist (else `OkrObjectiveNotFoundError`);
 *   2. no self-loop (else `OkrAlignmentValidationError` — the DB `CHECK` is
 *      defense in depth, not the primary guard);
 *   3. caller is the SOURCE Objective's Owner (else `OkrAlignmentValidationError`,
 *      code `NOT_SOURCE_OWNER`);
 *   4. same-Cycle compatibility (else `OkrAlignmentCycleMismatchError`);
 *   5. caller has view-visibility into the TARGET Objective (else
 *      `OkrAlignmentVisibilityDeniedError` — design §E's stated addition);
 *   6. no graph cycle would be introduced (else `OkrAlignmentCycleDetectedError`);
 *   7. D3-shaped dedupe (cheap pre-check SELECT, then a SAVEPOINT-wrapped
 *      candidate INSERT for the racing case — copied verbatim in shape from
 *      `createOkrSet`).
 *
 * §-IO / design §B: this function contains NO write to
 * `okr_vnext_objectives` anywhere — every read above is a plain `SELECT`.
 */
export async function proposeAlignment(
  input: ProposeAlignmentInput
): Promise<AtomicCommandOutcome<ProposeAlignmentResult>> {
  const {
    organizationId,
    sourceObjectiveId,
    targetObjectiveId,
    rationale = null,
    proposedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  async function loadResult(client: PoolClient, alignmentId: string): Promise<ProposeAlignmentResult> {
    const result = await client.query<OkrAlignmentRow>(
      `SELECT * FROM okr_vnext_alignments WHERE alignment_id = $1 AND organization_id = $2`,
      [alignmentId, organizationId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`[proposeAlignment] winning alignment ${alignmentId} could not be re-read after SAVEPOINT rollback`);
    }
    return { alignment: toOkrAlignment(row), created: false };
  }

  return executeAtomicCreate<ProposeAlignmentResult>({
    organizationId,
    applyMutation: async (client) => {
      if (sourceObjectiveId === targetObjectiveId) {
        throw new OkrAlignmentValidationError(
          `Objective ${sourceObjectiveId} cannot be aligned to itself`,
          'SELF_LOOP',
          { objectiveId: sourceObjectiveId }
        );
      }

      const source = await loadObjectiveContextForAlignment(client, sourceObjectiveId, organizationId);
      if (!source) throw new OkrObjectiveNotFoundError(sourceObjectiveId);
      const target = await loadObjectiveContextForAlignment(client, targetObjectiveId, organizationId);
      if (!target) throw new OkrObjectiveNotFoundError(targetObjectiveId);

      if (proposedBy !== source.ownerUserId) {
        throw new OkrAlignmentValidationError(
          `User ${proposedBy} may not propose an alignment from Objective ${sourceObjectiveId}: not its Owner`,
          'NOT_SOURCE_OWNER',
          { objectiveId: sourceObjectiveId, ownerUserId: source.ownerUserId }
        );
      }

      if (source.cycleId !== target.cycleId) {
        throw new OkrAlignmentCycleMismatchError(source.cycleId, target.cycleId);
      }

      // Design §E: proposer must be able to see the target they are naming.
      await assertObjectiveVisibleToViewer(client, {
        userId: proposedBy,
        organizationId,
        objectiveId: targetObjectiveId,
        setId: target.setId,
      });

      // OKR-F-016: reject at CREATE time if this edge would close a cycle
      // in the accepted-edge graph.
      await assertNoAlignmentCycle(client, { organizationId, sourceObjectiveId, targetObjectiveId });

      // D3-shaped dedupe: cheap pre-check SELECT (non-racing path).
      const existingResult = await client.query<{ alignment_id: string }>(
        `SELECT alignment_id FROM okr_vnext_alignments
          WHERE organization_id = $1 AND source_objective_id = $2 AND target_objective_id = $3
            AND relation = 'contributes_to' AND status IN ('proposed','accepted')`,
        [organizationId, sourceObjectiveId, targetObjectiveId]
      );
      const existing = existingResult.rows[0];
      if (existing) {
        return loadResult(client, existing.alignment_id);
      }

      // Racing case: SAVEPOINT around the candidate INSERT — verbatim shape
      // copied from `createOkrSet` (okrSetCommands.ts).
      await client.query('SAVEPOINT okr_alignment_propose');
      let alignmentRow: OkrAlignmentRow;
      try {
        const insertResult = await client.query<OkrAlignmentRow>(
          `INSERT INTO okr_vnext_alignments
             (organization_id, source_objective_id, target_objective_id, rationale,
              source_cycle_id, target_cycle_id, proposed_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [organizationId, sourceObjectiveId, targetObjectiveId, rationale, source.cycleId, target.cycleId, proposedBy]
        );
        const inserted = insertResult.rows[0];
        if (!inserted) throw new Error('[proposeAlignment] insert into okr_vnext_alignments returned no row');
        alignmentRow = inserted;
        await client.query('RELEASE SAVEPOINT okr_alignment_propose');
      } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
          await client.query('ROLLBACK TO SAVEPOINT okr_alignment_propose');
          const retryResult = await client.query<{ alignment_id: string }>(
            `SELECT alignment_id FROM okr_vnext_alignments
              WHERE organization_id = $1 AND source_objective_id = $2 AND target_objective_id = $3
                AND relation = 'contributes_to' AND status IN ('proposed','accepted')`,
            [organizationId, sourceObjectiveId, targetObjectiveId]
          );
          const winner = retryResult.rows[0];
          if (!winner) {
            throw new Error(
              `[proposeAlignment] 23505 on ux_okr_vnext_alignments_live_edge but no winning row found for (${sourceObjectiveId}, ${targetObjectiveId})`
            );
          }
          return loadResult(client, winner.alignment_id);
        }
        throw err;
      }

      // Design §I / §J item 8: MyWork obligation, assigned to the target
      // Objective's Owner — a stated design addition, not AC-sourced.
      await createObligation(client, {
        organizationId,
        assigneeUserId: target.ownerUserId,
        referenceType: OKR_ALIGNMENT_AGGREGATE_TYPE,
        referenceId: alignmentRow.alignment_id,
        aggregateVersionAtCreation: 1,
        obligationType: REVIEW_ALIGNMENT_PROPOSAL_OBLIGATION_TYPE,
        deduplicationKey: `${organizationId}:${OKR_ALIGNMENT_AGGREGATE_TYPE}:${alignmentRow.alignment_id}:${REVIEW_ALIGNMENT_PROPOSAL_OBLIGATION_TYPE}`,
      });

      return { alignment: toOkrAlignment(alignmentRow), created: true };
    },
    buildEvent: ({ result }) => {
      const afterState = { alignment: result.alignment };
      return {
        schemaVersion: 1,
        eventType: 'okr_alignment.proposed',
        aggregateType: OKR_ALIGNMENT_AGGREGATE_TYPE,
        aggregateId: result.alignment.alignmentId,
        organizationId,
        actorUserId: proposedBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: result.alignment.rowVersion,
        payload: {
          alignmentId: result.alignment.alignmentId,
          sourceObjectiveId,
          targetObjectiveId,
          created: result.created,
        },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// acceptAlignment (design §D/§E/§H)
// ==========================================

export interface AcceptAlignmentInput {
  alignmentId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Design §D's stated addition: re-runs `assertNoAlignmentCycle` at accept
 * time too (defends against two independently-acyclic `proposed` edges
 * jointly closing a cycle once both are accepted — see that function's own
 * doc comment). Design §E's stated addition: re-confirms the responder
 * (target Owner) can still see the SOURCE Objective before accepting.
 *
 * ★ Contains NO write to `okr_vnext_objectives` — only `okr_vnext_alignments`
 * itself is updated (status/responded_by/responded_at/row_version).
 */
export async function acceptAlignment(input: AcceptAlignmentInput): Promise<AtomicCommandOutcome<OkrAlignment>> {
  const {
    alignmentId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrAlignmentRow, OkrAlignment>({
    organizationId,
    aggregateId: alignmentId,
    expectedVersion,
    loadForUpdate: loadAlignmentForUpdate,
    getCurrentVersion: alignmentRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'proposed') {
        throw new OkrAlignmentValidationError(
          `Alignment ${alignmentId} is "${currentRow.status}" — only a "proposed" alignment may be accepted`,
          'NOT_PROPOSED',
          { alignmentId, status: currentRow.status }
        );
      }

      const target = await loadObjectiveContextForAlignment(client, currentRow.target_objective_id, organizationId);
      if (!target) throw new OkrObjectiveNotFoundError(currentRow.target_objective_id);
      if (actorUserId !== target.ownerUserId) {
        throw new OkrAlignmentValidationError(
          `User ${actorUserId} may not accept alignment ${alignmentId}: not the target Objective's Owner`,
          'NOT_TARGET_OWNER',
          { alignmentId, ownerUserId: target.ownerUserId }
        );
      }

      const source = await loadObjectiveContextForAlignment(client, currentRow.source_objective_id, organizationId);
      if (!source) throw new OkrObjectiveNotFoundError(currentRow.source_objective_id);

      // Design §E: re-confirm the source is still visible to the responder
      // (visibility may have narrowed between propose and accept).
      await assertObjectiveVisibleToViewer(client, {
        userId: actorUserId,
        organizationId,
        objectiveId: currentRow.source_objective_id,
        setId: source.setId,
      });

      // Design §D: accept-time re-check (race defense).
      await assertNoAlignmentCycle(client, {
        organizationId,
        sourceObjectiveId: currentRow.source_objective_id,
        targetObjectiveId: currentRow.target_objective_id,
      });

      beforeState = { alignment: toOkrAlignment(currentRow) };

      const updateResult = await client.query<OkrAlignmentRow>(
        `UPDATE okr_vnext_alignments
            SET status = 'accepted', responded_by = $1, responded_at = now(),
                row_version = $2, updated_at = now()
          WHERE alignment_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, alignmentId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[acceptAlignment] update returned no row for ${alignmentId}`);
      return toOkrAlignment(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { alignment: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_alignment.accepted',
        aggregateType: OKR_ALIGNMENT_AGGREGATE_TYPE,
        aggregateId: alignmentId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { alignmentId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// rejectAlignment (design §H)
// ==========================================

export interface RejectAlignmentInput {
  alignmentId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  responseReason?: string | null;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

/** ★ Contains NO write to `okr_vnext_objectives`. */
export async function rejectAlignment(input: RejectAlignmentInput): Promise<AtomicCommandOutcome<OkrAlignment>> {
  const {
    alignmentId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    responseReason = null,
    idempotencyKey,
    correlationId,
    causationId = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrAlignmentRow, OkrAlignment>({
    organizationId,
    aggregateId: alignmentId,
    expectedVersion,
    loadForUpdate: loadAlignmentForUpdate,
    getCurrentVersion: alignmentRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'proposed') {
        throw new OkrAlignmentValidationError(
          `Alignment ${alignmentId} is "${currentRow.status}" — only a "proposed" alignment may be rejected`,
          'NOT_PROPOSED',
          { alignmentId, status: currentRow.status }
        );
      }

      const target = await loadObjectiveContextForAlignment(client, currentRow.target_objective_id, organizationId);
      if (!target) throw new OkrObjectiveNotFoundError(currentRow.target_objective_id);
      if (actorUserId !== target.ownerUserId) {
        throw new OkrAlignmentValidationError(
          `User ${actorUserId} may not reject alignment ${alignmentId}: not the target Objective's Owner`,
          'NOT_TARGET_OWNER',
          { alignmentId, ownerUserId: target.ownerUserId }
        );
      }

      beforeState = { alignment: toOkrAlignment(currentRow) };

      const updateResult = await client.query<OkrAlignmentRow>(
        `UPDATE okr_vnext_alignments
            SET status = 'rejected', responded_by = $1, responded_at = now(), response_reason = $2,
                row_version = $3, updated_at = now()
          WHERE alignment_id = $4
          RETURNING *`,
        [actorUserId, responseReason, nextVersion, alignmentId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[rejectAlignment] update returned no row for ${alignmentId}`);
      return toOkrAlignment(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { alignment: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_alignment.rejected',
        aggregateType: OKR_ALIGNMENT_AGGREGATE_TYPE,
        aggregateId: alignmentId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason: responseReason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { alignmentId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// removeAlignment (design §H / §J item 5)
// ==========================================

export interface RemoveAlignmentInput {
  alignmentId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

const OKR_ALIGNMENT_REMOVABLE_FROM_STATUSES: readonly string[] = ['proposed', 'accepted'];

/**
 * §J item 5 (design's own flagged ambiguity, restated here rather than
 * silently resolved): EPIC_LEDGER_LIVE names only "Objective Owner
 * (propose), target Owner (accept/reject)" — who may REMOVE an
 * already-accepted edge is unstated by any AC. This design defaults to
 * "either endpoint's Owner may unilaterally remove" — a considered default,
 * not a proven requirement; restate/confirm in a future epic.
 *
 * ★ Contains NO write to `okr_vnext_objectives`.
 */
export async function removeAlignment(input: RemoveAlignmentInput): Promise<AtomicCommandOutcome<OkrAlignment>> {
  const {
    alignmentId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<OkrAlignmentRow, OkrAlignment>({
    organizationId,
    aggregateId: alignmentId,
    expectedVersion,
    loadForUpdate: loadAlignmentForUpdate,
    getCurrentVersion: alignmentRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!OKR_ALIGNMENT_REMOVABLE_FROM_STATUSES.includes(currentRow.status)) {
        throw new OkrAlignmentValidationError(
          `Alignment ${alignmentId} is "${currentRow.status}" — cannot remove from there`,
          'NOT_REMOVABLE',
          { alignmentId, status: currentRow.status }
        );
      }

      const source = await loadObjectiveContextForAlignment(client, currentRow.source_objective_id, organizationId);
      if (!source) throw new OkrObjectiveNotFoundError(currentRow.source_objective_id);
      const target = await loadObjectiveContextForAlignment(client, currentRow.target_objective_id, organizationId);
      if (!target) throw new OkrObjectiveNotFoundError(currentRow.target_objective_id);

      if (actorUserId !== source.ownerUserId && actorUserId !== target.ownerUserId) {
        throw new OkrAlignmentValidationError(
          `User ${actorUserId} may not remove alignment ${alignmentId}: not the source or target Objective's Owner`,
          'NOT_OWNER',
          { alignmentId, sourceOwnerUserId: source.ownerUserId, targetOwnerUserId: target.ownerUserId }
        );
      }

      beforeState = { alignment: toOkrAlignment(currentRow) };

      const updateResult = await client.query<OkrAlignmentRow>(
        `UPDATE okr_vnext_alignments
            SET status = 'removed', removed_by = $1, removed_at = now(),
                row_version = $2, updated_at = now()
          WHERE alignment_id = $3
          RETURNING *`,
        [actorUserId, nextVersion, alignmentId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[removeAlignment] update returned no row for ${alignmentId}`);
      return toOkrAlignment(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { alignment: result };
      return {
        schemaVersion: 1,
        eventType: 'okr_alignment.removed',
        aggregateType: OKR_ALIGNMENT_AGGREGATE_TYPE,
        aggregateId: alignmentId,
        organizationId,
        actorUserId,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { alignmentId },
      } satisfies AtomicEventInput;
    },
  });
}
