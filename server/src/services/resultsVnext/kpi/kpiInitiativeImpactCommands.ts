/**
 * KPI-E005 — InitiativeKPIImpact command layer.
 *
 * Design: docs/product/results-vnext/KPI_E005_DESIGN.md §C.3 (signatures) +
 * §C (schema, `rvn_kpi_initiative_impacts`).
 * Schema: server/migrations/20260813_rvn_kpi_initiative_impacts.sql.
 *
 * Write pattern: `proposeInitiativeKpiImpact` is the only CREATE (new
 * `impact_id`, status='proposed', baseline_* stays NULL) and goes through
 * `executeAtomicCreate` — identical shape to `kpiDefinitionCommands.createKpiDraft`.
 * `commitInitiativeKpiImpact` / `recordReviewedAttribution` /
 * `supersedeInitiativeKpiImpact` all mutate an EXISTING row and go through
 * `executeAtomicCommand` with that row's own `row_version` as the
 * optimistic-concurrency CAS — the same convention every other KPI command
 * file in this program uses.
 *
 * Visibility: this table does NOT get its own `rvn_platform_resource_visibility`
 * row — it inherits visibility from `kpi_id` (`resourceType:'kpi'`), same as
 * KPI-E003's deviation cases/corrective actions (design §C: "Initiative
 * (legacy module) does not participate in RVN ABAC").
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';

import { computeStateHash, KPI_EVENT_SOURCE } from './kpiDefinitionCommands.js';
import {
  toInitiativeKpiImpact,
  type InitiativeKpiImpact,
  type InitiativeKpiImpactDirection,
  type InitiativeKpiImpactRow,
} from './kpiInitiativeImpactTypes.js';

/**
 * `PlatformEventEnvelope.aggregateType` (eventEnvelope.ts) is typed as
 * `RvnResourceType` — it MUST be a value from `RVN_RESOURCE_TYPES`
 * (resourceTypes.ts). No `'kpi_initiative_impact'` resource type is
 * registered there (design §C: this table deliberately has no own
 * `rvn_platform_resource_visibility` row, it inherits visibility from its
 * `kpi_id`) — so events about an impact use `'kpi'` as their aggregateType,
 * with `aggregateId` set to the impact's OWNING `kpi_id`, not the impact's
 * own `impact_id`. Same shape `kpiCorrectiveActionCommands.ts` already uses
 * for corrective-action events (`aggregateType: 'deviation_case'`,
 * `aggregateId: result.deviationCaseId` — the PARENT aggregate's identifier
 * space, not the child row's own id).
 */
const INITIATIVE_IMPACT_AGGREGATE_TYPE = 'kpi';

// ==========================================
// ERRORS
// ==========================================

export class KpiInitiativeImpactValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'KpiInitiativeImpactValidationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * `recordReviewedAttribution`'s maker-checker guard — `reviewedBy` must
 * differ from `committedBy` for a material review (design §C.3: "server-side
 * enforced, mirrors SelfApprovalDeniedError/DeviationSelfApprovalDeniedError,
 * not UI-only"). Shape mirrors those two classes exactly.
 */
export class InitiativeKpiImpactSelfApprovalDeniedError extends Error {
  code = 'SELF_APPROVAL_DENIED';
  details: Record<string, unknown>;
  constructor(impactId: string, reviewerId: string) {
    super(
      `User ${reviewerId} may not record the reviewed attribution for impact ${impactId}: matches its own committed_by`
    );
    this.name = 'InitiativeKpiImpactSelfApprovalDeniedError';
    this.details = { impactId, reviewerId, reasonField: 'committed_by' };
  }
}

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadInitiativeKpiImpactForUpdate(
  client: PoolClient,
  impactId: string,
  organizationId: string
): Promise<InitiativeKpiImpactRow | undefined> {
  const result = await client.query<InitiativeKpiImpactRow>(
    `SELECT * FROM rvn_kpi_initiative_impacts WHERE impact_id = $1 AND organization_id = $2 FOR UPDATE`,
    [impactId, organizationId]
  );
  return result.rows[0];
}
const impactRowVersion = (row: InitiativeKpiImpactRow) => row.row_version;

// ==========================================
// proposeInitiativeKpiImpact
// ==========================================

export interface ProposeInitiativeKpiImpactInput {
  organizationId: string;
  kpiId: string;
  initiativeId: string;
  expectedContributionValue: number | null;
  expectedContributionDirection: InitiativeKpiImpactDirection | null;
  targetCompletionDate: string | null;
  proposedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function proposeInitiativeKpiImpact(
  input: ProposeInitiativeKpiImpactInput
): Promise<AtomicCommandOutcome<{ impact: InitiativeKpiImpact }>> {
  const {
    organizationId,
    kpiId,
    initiativeId,
    expectedContributionValue,
    expectedContributionDirection,
    targetCompletionDate,
    proposedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  return executeAtomicCreate<{ impact: InitiativeKpiImpact }>({
    organizationId,
    applyMutation: async (client) => {
      // Best-effort pre-check for a friendly typed error instead of a raw
      // 23505 surfacing from the INSERT below — the real guarantee is the
      // DB-level partial unique index
      // (ux_rvn_kpi_initiative_impacts_one_active), same "pre-check + DB is
      // the real guarantee" shape reopenDeviationCase's own comment
      // documents for its equivalent OTHER_ACTIVE_CASE_EXISTS check.
      const activeResult = await client.query<{ impact_id: string }>(
        `SELECT impact_id FROM rvn_kpi_initiative_impacts
          WHERE organization_id = $1 AND kpi_id = $2 AND initiative_id = $3
            AND status IN ('proposed', 'committed')`,
        [organizationId, kpiId, initiativeId]
      );
      const active = activeResult.rows[0];
      if (active) {
        throw new KpiInitiativeImpactValidationError(
          `KPI ${kpiId} / initiative ${initiativeId} already has an active impact (${active.impact_id}) — at most one proposed/committed impact is allowed per (kpi, initiative)`,
          'ACTIVE_IMPACT_EXISTS',
          { kpiId, initiativeId, activeImpactId: active.impact_id }
        );
      }

      const insertResult = await client.query<InitiativeKpiImpactRow>(
        `INSERT INTO rvn_kpi_initiative_impacts
           (organization_id, kpi_id, initiative_id, status,
            expected_contribution_value, expected_contribution_direction, target_completion_date,
            proposed_by, created_by)
         VALUES ($1, $2, $3, 'proposed', $4, $5, $6, $7, $7)
         RETURNING *`,
        [
          organizationId,
          kpiId,
          initiativeId,
          expectedContributionValue,
          expectedContributionDirection,
          targetCompletionDate,
          proposedBy,
        ]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[proposeInitiativeKpiImpact] insert returned no row');
      return { impact: toInitiativeKpiImpact(row) };
    },
    buildEvent: ({ result }) => {
      const afterState = { impact: result.impact };
      return {
        schemaVersion: 1,
        eventType: 'kpi.initiative_impact_proposed',
        aggregateType: INITIATIVE_IMPACT_AGGREGATE_TYPE,
        aggregateId: result.impact.kpiId,
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
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { impactId: result.impact.impactId, kpiId, initiativeId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// commitInitiativeKpiImpact
// ==========================================

export interface CommitInitiativeKpiImpactInput {
  organizationId: string;
  impactId: string;
  expectedVersion: number;
  committedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

interface LatestMeasurementRow {
  measurement_id: string;
  actual_value: string | null;
  period_end: string;
}

/**
 * `commitInitiativeKpiImpact` — reads the CURRENT latest non-superseded
 * `rvn_kpi_measurements` row for `kpi_id` INSIDE the same transaction and
 * pins it as baseline (design §C.3). No measurement yet -> baseline_* stays
 * NULL (honest, never fabricated — same "missing config never fabricates a
 * status" rule the rest of this domain follows).
 *
 * ALSO writes a `link_graph_edges` row in the SAME transaction (design §C.3:
 * "through the SAME code path the existing POST /api/my-work/link-graph/edges
 * handler uses internally — architectural rule #6, do not hand-roll a second
 * INSERT").
 *
 * -- DEVIATION FROM DESIGN: the "same code path" the design points at is
 * `linkGraphAddEdge` in `server/src/routes/my-work.routes.ts` (~line 810) —
 * verified by reading that file, not guessed. It cannot literally be
 * imported and called here for two independent reasons: (1) it is a
 * module-private `const`, never exported; (2) it writes through
 * `queryHelpers.queryRun`, which — per `queryHelpers.ts`'s OWN doc comment on
 * `withPgTransaction` — goes through `PostgresDatabase`'s shared connection
 * POOL, grabbing a different physical connection on every call, so it cannot
 * participate in `executeAtomicCommand`'s pinned-`PoolClient` transaction the
 * baseline freeze itself runs on (that file's comment names this exact
 * footgun: a `BEGIN` on one connection and a later write on another are not
 * atomic — "previously hit in production", its own words). Since design
 * §C.3 explicitly requires the edge write to land in the SAME transaction as
 * the baseline freeze, using the real `linkGraphAddEdge` would silently
 * break that requirement even if it could be imported. Nearest safe
 * equivalent: replicate the EXACT SAME row shape `linkGraphAddEdge` inserts
 * (`server/migrations/20260303_link_graph_v3.sql`: id/organization_id/
 * created_by/source_type/source_id/target_type/target_id/relation/
 * container_type/container_id/block_id/created_at, all plain TEXT columns —
 * no `::text` cast needed here, this table predates the RVN UUID/TEXT join
 * bug class entirely), on the SAME pinned client, with the SAME idempotent-
 * duplicate handling (catch the unique-violation on
 * `ux_link_graph_edges_ref` and treat it as a no-op) — this is copying the
 * same shape, not hand-rolling a different one.
 */
export async function commitInitiativeKpiImpact(
  input: CommitInitiativeKpiImpactInput
): Promise<AtomicCommandOutcome<{ impact: InitiativeKpiImpact }>> {
  const {
    organizationId,
    impactId,
    expectedVersion,
    committedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<InitiativeKpiImpactRow, { impact: InitiativeKpiImpact }>({
    organizationId,
    aggregateId: impactId,
    expectedVersion,
    loadForUpdate: loadInitiativeKpiImpactForUpdate,
    getCurrentVersion: impactRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'proposed') {
        throw new KpiInitiativeImpactValidationError(
          `Impact ${impactId} is "${currentRow.status}" — only a "proposed" impact may be committed`,
          'NOT_PROPOSED',
          { impactId, status: currentRow.status }
        );
      }
      beforeState = { impact: toInitiativeKpiImpact(currentRow) };

      const kpiResult = await client.query<{ current_definition_version_id: string | null }>(
        `SELECT current_definition_version_id FROM rvn_kpi_definitions WHERE kpi_id = $1 AND organization_id = $2`,
        [currentRow.kpi_id, organizationId]
      );
      const definitionVersionIdAtCommitment = kpiResult.rows[0]?.current_definition_version_id ?? null;

      const latestResult = await client.query<LatestMeasurementRow>(
        `SELECT m.measurement_id, m.actual_value, m.period_end
           FROM rvn_kpi_measurements m
          WHERE m.kpi_id = $1
            AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer WHERE newer.correction_of_measurement_id = m.measurement_id)
          ORDER BY m.period_end DESC, m.recorded_at DESC LIMIT 1`,
        [currentRow.kpi_id]
      );
      const latest = latestResult.rows[0];

      const updateResult = await client.query<InitiativeKpiImpactRow>(
        `UPDATE rvn_kpi_initiative_impacts
            SET status = 'committed',
                baseline_measurement_id = $1,
                baseline_value_at_commitment = $2,
                baseline_period_end = $3,
                definition_version_id_at_commitment = $4,
                committed_by = $5,
                committed_at = now(),
                row_version = $6,
                updated_at = now()
          WHERE impact_id = $7
          RETURNING *`,
        [
          latest?.measurement_id ?? null,
          latest?.actual_value ?? null,
          latest?.period_end ?? null,
          definitionVersionIdAtCommitment,
          committedBy,
          nextVersion,
          impactId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[commitInitiativeKpiImpact] update returned no row for ${impactId}`);

      // link_graph_edges row — same transaction, same shape as
      // linkGraphAddEdge (see this function's own doc comment above for why
      // that helper cannot be called directly).
      try {
        await client.query(
          `INSERT INTO link_graph_edges
             (id, organization_id, created_by, source_type, source_id, target_type, target_id,
              relation, container_type, container_id, block_id, created_at)
           VALUES ($1, $2, $3, 'initiative', $4, 'kpi', $5, 'kpi_impact', NULL, NULL, NULL, now())`,
          [randomUUID(), organizationId, committedBy, updatedRow.initiative_id, updatedRow.kpi_id]
        );
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        // 23505 = unique_violation on ux_link_graph_edges_ref — best-effort
        // idempotency, same handling linkGraphAddEdge itself uses (a retry
        // of this command with the SAME committedBy/kpi/initiative would
        // otherwise fail the whole transaction on a link that already
        // exists from a prior attempt).
        if (code !== '23505') throw err;
      }

      return { impact: toInitiativeKpiImpact(updatedRow) };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { impact: result.impact };
      return {
        schemaVersion: 1,
        eventType: 'kpi.initiative_impact_committed',
        aggregateType: INITIATIVE_IMPACT_AGGREGATE_TYPE,
        aggregateId: result.impact.kpiId,
        organizationId,
        actorUserId: committedBy,
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
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { impactId, baselineMeasurementId: result.impact.baselineMeasurementId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// recordReviewedAttribution
// ==========================================

export interface RecordReviewedAttributionInput {
  organizationId: string;
  impactId: string;
  expectedVersion: number;
  reviewedAttributionValue: number;
  reviewedAttributionMeasurementId: string | null;
  reviewRationale: string;
  reviewedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/**
 * Self-approval denial FIRST, before any write (design §C.3: "reviewedBy
 * MUST differ from committedBy for a material review — server-side
 * enforced"). Mirrors `approveDefinitionVersion`/`approvePlan`'s discipline
 * exactly: the check runs inside `applyMutation`, after `loadForUpdate`'s
 * `SELECT ... FOR UPDATE` has already locked the row but before anything is
 * written.
 */
export async function recordReviewedAttribution(
  input: RecordReviewedAttributionInput
): Promise<AtomicCommandOutcome<{ impact: InitiativeKpiImpact }>> {
  const {
    organizationId,
    impactId,
    expectedVersion,
    reviewedAttributionValue,
    reviewedAttributionMeasurementId,
    reviewRationale,
    reviewedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<InitiativeKpiImpactRow, { impact: InitiativeKpiImpact }>({
    organizationId,
    aggregateId: impactId,
    expectedVersion,
    loadForUpdate: loadInitiativeKpiImpactForUpdate,
    getCurrentVersion: impactRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // Self-approval denial — FIRST, before any write.
      if (currentRow.committed_by === reviewedBy) {
        throw new InitiativeKpiImpactSelfApprovalDeniedError(impactId, reviewedBy);
      }

      if (currentRow.status !== 'committed' && currentRow.status !== 'superseded') {
        throw new KpiInitiativeImpactValidationError(
          `Impact ${impactId} is "${currentRow.status}" — a reviewed attribution may only be recorded on a committed (or later superseded) impact`,
          'NOT_COMMITTED',
          { impactId, status: currentRow.status }
        );
      }

      beforeState = { impact: toInitiativeKpiImpact(currentRow) };

      const updateResult = await client.query<InitiativeKpiImpactRow>(
        `UPDATE rvn_kpi_initiative_impacts
            SET status = CASE WHEN status = 'committed' THEN 'realized_reviewed' ELSE status END,
                reviewed_attribution_value = $1,
                reviewed_attribution_measurement_id = $2,
                review_rationale = $3,
                reviewed_by = $4,
                reviewed_at = now(),
                row_version = $5,
                updated_at = now()
          WHERE impact_id = $6
          RETURNING *`,
        [
          reviewedAttributionValue,
          reviewedAttributionMeasurementId,
          reviewRationale,
          reviewedBy,
          nextVersion,
          impactId,
        ]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[recordReviewedAttribution] update returned no row for ${impactId}`);
      return { impact: toInitiativeKpiImpact(updatedRow) };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { impact: result.impact };
      return {
        schemaVersion: 1,
        eventType: 'kpi.initiative_impact_reviewed',
        aggregateType: INITIATIVE_IMPACT_AGGREGATE_TYPE,
        aggregateId: result.impact.kpiId,
        organizationId,
        actorUserId: reviewedBy,
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
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { impactId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// supersedeInitiativeKpiImpact
// ==========================================

export interface SupersedeInitiativeKpiImpactInput {
  organizationId: string;
  impactId: string;
  expectedVersion: number;
  replacementInput: Omit<ProposeInitiativeKpiImpactInput, 'organizationId' | 'kpiId' | 'initiativeId'>;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface SupersedeInitiativeKpiImpactResult {
  superseded: InitiativeKpiImpact;
  replacement: InitiativeKpiImpact;
}

/**
 * `status -> 'superseded'`, `superseded_by_impact_id` points at a fresh
 * `'proposed'` row created in the SAME transaction — never edits history
 * (design §C.3). CAS'd on the SUPERSEDED row's own `row_version` (the row
 * being replaced, mirroring `reopenDeviationCase`'s "prior case" naming but
 * unlike that command — which is a pure `executeAtomicCreate` with only a
 * best-effort pre-check on the prior row's status — this one needs the
 * prior row's OWN row_version as a real CAS, since design §C.3 pins this as
 * `executeAtomicCommand`, not `executeAtomicCreate`).
 */
export async function supersedeInitiativeKpiImpact(
  input: SupersedeInitiativeKpiImpactInput
): Promise<AtomicCommandOutcome<SupersedeInitiativeKpiImpactResult>> {
  const {
    organizationId,
    impactId,
    expectedVersion,
    replacementInput,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<InitiativeKpiImpactRow, SupersedeInitiativeKpiImpactResult>({
    organizationId,
    aggregateId: impactId,
    expectedVersion,
    loadForUpdate: loadInitiativeKpiImpactForUpdate,
    getCurrentVersion: impactRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.status !== 'proposed' && currentRow.status !== 'committed') {
        throw new KpiInitiativeImpactValidationError(
          `Impact ${impactId} is "${currentRow.status}" — only a "proposed" or "committed" impact may be superseded`,
          'NOT_ACTIVE',
          { impactId, status: currentRow.status }
        );
      }
      beforeState = { impact: toInitiativeKpiImpact(currentRow) };

      // Create the replacement FIRST — while the superseded row still
      // occupies the partial unique index slot
      // (ux_rvn_kpi_initiative_impacts_one_active WHERE status IN
      // ('proposed','committed')), so the new row is only inserted once the
      // old one's status flip below has been decided; to avoid a transient
      // double-active-row conflict on the unique index, the old row is
      // flipped to 'superseded' BEFORE the new row is inserted. Both writes
      // are in the same transaction either way — order only matters for the
      // partial index, not atomicity.
      const supersedeResult = await client.query<InitiativeKpiImpactRow>(
        `UPDATE rvn_kpi_initiative_impacts
            SET status = 'superseded', superseded_at = now(), row_version = $1, updated_at = now()
          WHERE impact_id = $2
          RETURNING *`,
        [nextVersion, impactId]
      );
      const supersededRow = supersedeResult.rows[0];
      if (!supersededRow) throw new Error(`[supersedeInitiativeKpiImpact] update returned no row for ${impactId}`);

      const replacementInsert = await client.query<InitiativeKpiImpactRow>(
        `INSERT INTO rvn_kpi_initiative_impacts
           (organization_id, kpi_id, initiative_id, status,
            expected_contribution_value, expected_contribution_direction, target_completion_date,
            proposed_by, created_by)
         VALUES ($1, $2, $3, 'proposed', $4, $5, $6, $7, $7)
         RETURNING *`,
        [
          organizationId,
          supersededRow.kpi_id,
          supersededRow.initiative_id,
          replacementInput.expectedContributionValue,
          replacementInput.expectedContributionDirection,
          replacementInput.targetCompletionDate,
          replacementInput.proposedBy,
        ]
      );
      const replacementRow = replacementInsert.rows[0];
      if (!replacementRow) throw new Error('[supersedeInitiativeKpiImpact] replacement insert returned no row');

      const finalSupersedeResult = await client.query<InitiativeKpiImpactRow>(
        `UPDATE rvn_kpi_initiative_impacts
            SET superseded_by_impact_id = $1
          WHERE impact_id = $2
          RETURNING *`,
        [replacementRow.impact_id, impactId]
      );
      const finalSupersededRow = finalSupersedeResult.rows[0];
      if (!finalSupersededRow) {
        throw new Error(`[supersedeInitiativeKpiImpact] final update returned no row for ${impactId}`);
      }

      return {
        superseded: toInitiativeKpiImpact(finalSupersededRow),
        replacement: toInitiativeKpiImpact(replacementRow),
      };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { superseded: result.superseded, replacement: result.replacement };
      return {
        schemaVersion: 1,
        eventType: 'kpi.initiative_impact_superseded',
        aggregateType: INITIATIVE_IMPACT_AGGREGATE_TYPE,
        aggregateId: result.superseded.kpiId,
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
        source: KPI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { impactId, replacementImpactId: result.replacement.impactId },
      } satisfies AtomicEventInput;
    },
  });
}
