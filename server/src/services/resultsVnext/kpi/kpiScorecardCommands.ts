/**
 * KPI-E004 — Scorecards command layer.
 *
 * Design: docs/product/results-vnext/KPI_E004_DESIGN.md §B (frozen —
 * `publishReviewSnapshot` copied verbatim, decision #6a filter spliced in
 * per that section's own explicit instruction) + decision #8 ("implement
 * following the established KPI-E001/E003 pattern exactly" for the
 * draft-creating half neither draft pass fully specified).
 * Schema: server/migrations/20260812_rvn_kpi_scorecards.sql.
 *
 * Write pattern (decision #8, literal):
 *  - `createScorecard` — `executeAtomicCreate` (new `scorecard_id` + version 1
 *    + a `rvn_platform_resource_visibility` row, resource_type='kpi_scorecard',
 *    same transaction) — identical shape to `kpiDefinitionCommands.createKpiDraft`.
 *    Decision #1: the visibility POLICY looked up/inherited is the `'kpi'`
 *    domain policy (reuse, no new provisioning step) — the resource_type on
 *    the visibility row itself is still the genuine `'kpi_scorecard'` value
 *    (a separate axis from which policy's defaults it inherits).
 *  - `addScorecardItem` / `removeScorecardItem` / `reorderScorecardItems` —
 *    `executeAtomicCommand` CAS'd on the SCORECARD's own `row_version`, not
 *    an item-level CAS (items have no `row_version` column — §A's schema).
 *    `executeAtomicCommand`'s own `loadForUpdate` step already
 *    `SELECT ... FOR UPDATE`s the scorecard row before `applyMutation` runs,
 *    which is also what serializes concurrent membership writes on the same
 *    scorecard (mirrors the "lock the parent while creating a scoped child"
 *    shape `kpiCorrectiveActionCommands.ts`'s header comment describes for
 *    `addCorrectiveAction`, here applied to a CAS'd parent instead of a
 *    plain existence lock).
 *  - `activateScorecard` / `suspendScorecard` / `archiveScorecard` — CAS'd
 *    lifecycle transitions on the scorecard's own row, identical shape to
 *    `kpiDefinitionCommands.ts`'s `runKpiLifecycleTransition` /
 *    `activateKpi`/`suspendKpi`/`archiveKpi`.
 *  - `createReviewSnapshot` — `executeAtomicCreate` producing a
 *    `status='draft'` row with `review_period_start`/`review_period_end` set
 *    and `snapshot_payload`/`content_hash`/`published_*` left `NULL` — no
 *    live-data materialization at this step (that happens only at publish).
 *  - `publishReviewSnapshot` — `executeAtomicCommand` CAS'd on the
 *    snapshot's own `row_version`, §B verbatim.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import {
  executeAtomicCommand,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { getActiveVisibilityPolicy } from '../platform/visibilityResolver.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { computeStateHash, KPI_EVENT_SOURCE, KpiNoActiveVisibilityPolicyError } from './kpiDefinitionCommands.js';
import {
  toKpiScorecard,
  toKpiScorecardItem,
  toKpiScorecardReviewSnapshot,
  type KpiScorecard,
  type KpiScorecardItem,
  type KpiScorecardItemRole,
  type KpiScorecardItemRow,
  type KpiScorecardLifecycleStatus,
  type KpiScorecardReviewFrequency,
  type KpiScorecardReviewSnapshot,
  type KpiScorecardReviewSnapshotRow,
  type KpiScorecardRow,
  type KpiScorecardScopeType,
  type ScorecardSnapshotItemFact,
  type ScorecardStatusCounts,
} from './kpiScorecardTypes.js';

export const KPI_SCORECARD_EVENT_SOURCE = 'resultsVnext.kpiScorecard';

/** Decyzja #1: Scorecards reuse the `'kpi'` visibility-policy domain for V1
 * (no new provisioning step) — the `rvn_platform_resource_visibility` row
 * itself still records the genuine `resource_type='kpi_scorecard'`. Same
 * name convention as `KPI_VISIBILITY_DOMAIN` in `kpiDefinitionCommands.ts`,
 * kept as a distinct exported constant here since it documents a
 * Scorecard-specific decision, not a re-export of the KPI one. */
export const KPI_SCORECARD_VISIBILITY_DOMAIN = 'kpi';

// ==========================================
// ERRORS
// ==========================================

export class KpiScorecardValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code = 'INVALID_TRANSITION', details?: Record<string, unknown>) {
    super(message);
    this.name = 'KpiScorecardValidationError';
    this.code = code;
    this.details = details;
  }
}

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadScorecardForUpdate(
  client: PoolClient,
  scorecardId: string,
  organizationId: string
): Promise<KpiScorecardRow | undefined> {
  const result = await client.query<KpiScorecardRow>(
    `SELECT * FROM rvn_kpi_scorecards WHERE scorecard_id = $1 AND organization_id = $2 FOR UPDATE`,
    [scorecardId, organizationId]
  );
  return result.rows[0];
}
const scorecardRowVersion = (row: KpiScorecardRow) => row.row_version;

function toScorecardSummary(row: KpiScorecardRow) {
  return { scorecard: toKpiScorecard(row) };
}

// ==========================================
// createScorecard
// ==========================================

export interface CreateScorecardInput {
  organizationId: string;
  name: string;
  description?: string | null;
  scopeType: KpiScorecardScopeType;
  scopeId?: string | null;
  ownerUserId?: string | null;
  reviewFrequency: KpiScorecardReviewFrequency;
  /** Only meaningful when the active `'kpi'`-domain visibility policy's
   * `default_scope_type` needs a concrete target — same minimal surface
   * `createKpiDraft`'s own `scopeId` param documents. */
  sensitivity?: string | null;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface CreateScorecardResult {
  scorecard: KpiScorecard;
}

export async function createScorecard(
  input: CreateScorecardInput
): Promise<AtomicCommandOutcome<CreateScorecardResult>> {
  const {
    organizationId,
    name,
    description = null,
    scopeType,
    scopeId = null,
    ownerUserId = null,
    reviewFrequency,
    sensitivity = null,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let visibilityPolicyVersion: string | undefined;

  return executeAtomicCreate<CreateScorecardResult>({
    organizationId,
    applyMutation: async (client) => {
      // Decyzja #1: reuse the 'kpi' domain policy — fail closed, same
      // discipline as createKpiDraft (decyzja #11 of KPI-E001/E002).
      const policy = await getActiveVisibilityPolicy(client, {
        organizationId,
        domain: KPI_SCORECARD_VISIBILITY_DOMAIN,
      });
      if (!policy) {
        throw new KpiNoActiveVisibilityPolicyError(organizationId, KPI_SCORECARD_VISIBILITY_DOMAIN);
      }
      visibilityPolicyVersion = policy.policyVersion;

      const policyDetailsResult = await client.query<{
        visibility_mode: string;
        default_scope_type: string | null;
      }>(
        `SELECT visibility_mode, default_scope_type
           FROM rvn_platform_visibility_policies
          WHERE policy_id = $1`,
        [policy.policyId]
      );
      const policyDetails = policyDetailsResult.rows[0];
      if (!policyDetails) {
        throw new Error(
          `[createScorecard] active policy ${policy.policyId} could not be re-read mid-transaction`
        );
      }

      const insertResult = await client.query<KpiScorecardRow>(
        `INSERT INTO rvn_kpi_scorecards
           (organization_id, name, description, scope_type, scope_id, owner_user_id, review_frequency, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [organizationId, name, description, scopeType, scopeId, ownerUserId ?? createdBy, reviewFrequency, createdBy]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[createScorecard] insert into rvn_kpi_scorecards returned no row');

      await client.query(
        `INSERT INTO rvn_platform_resource_visibility
           (resource_type, resource_id, organization_id, visibility_mode, policy_id, scope_type, scope_id, owner_user_id, sensitivity)
         VALUES ('kpi_scorecard', $1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          row.scorecard_id,
          organizationId,
          policyDetails.visibility_mode,
          policy.policyId,
          policyDetails.default_scope_type,
          scopeId,
          ownerUserId ?? createdBy,
          sensitivity,
        ]
      );

      return { scorecard: toKpiScorecard(row) };
    },
    buildEvent: ({ result }) => {
      const afterState: Record<string, unknown> = { scorecard: result.scorecard };
      return {
        schemaVersion: 1,
        eventType: 'scorecard.created',
        aggregateType: 'kpi_scorecard',
        aggregateId: result.scorecard.scorecardId,
        organizationId,
        actorUserId: createdBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: visibilityPolicyVersion ?? '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: KPI_SCORECARD_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { scorecardId: result.scorecard.scorecardId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// Shared base input for scorecard-CAS'd commands (membership + lifecycle).
// ==========================================

interface BaseScorecardCommandInput {
  scorecardId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/** Membership mutations are illegal once a scorecard is archived — not
 * pinned by decision #8 explicitly (which only fixes the *shape* of these
 * commands), this package's own minimal guard, mirroring
 * `addCorrectiveAction`'s status-gated parent check. */
function assertScorecardNotArchived(row: KpiScorecardRow, scorecardId: string): void {
  if (row.lifecycle_status === 'archived') {
    throw new KpiScorecardValidationError(
      `Scorecard ${scorecardId} is "archived" — membership can no longer be changed`,
      'SCORECARD_ARCHIVED',
      { scorecardId, lifecycleStatus: row.lifecycle_status }
    );
  }
}

// ==========================================
// addScorecardItem
// ==========================================

export interface AddScorecardItemInput extends BaseScorecardCommandInput {
  kpiId: string;
  role?: KpiScorecardItemRole;
  sortOrder?: number;
  displayConfig?: Record<string, unknown> | null;
}

export interface ScorecardMembershipResult {
  scorecard: KpiScorecard;
  item: KpiScorecardItem;
}

export async function addScorecardItem(
  input: AddScorecardItemInput
): Promise<AtomicCommandOutcome<ScorecardMembershipResult>> {
  const {
    scorecardId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    kpiId,
    role = 'supporting',
    sortOrder = 0,
    displayConfig = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiScorecardRow, ScorecardMembershipResult>({
    organizationId,
    aggregateId: scorecardId,
    expectedVersion,
    loadForUpdate: loadScorecardForUpdate,
    getCurrentVersion: scorecardRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      assertScorecardNotArchived(currentRow, scorecardId);
      beforeState = toScorecardSummary(currentRow);

      const kpiCheck = await client.query(
        `SELECT 1 FROM rvn_kpi_definitions WHERE kpi_id = $1 AND organization_id = $2`,
        [kpiId, organizationId]
      );
      if (!kpiCheck.rowCount) {
        throw new KpiScorecardValidationError(
          `KPI ${kpiId} does not exist in organization ${organizationId}`,
          'KPI_NOT_FOUND',
          { kpiId, organizationId }
        );
      }

      // The scorecard row is already locked (FOR UPDATE, executeAtomicCommand
      // step 2) — a concurrent second addScorecardItem for the same
      // scorecard blocks until this transaction commits/rolls back, so this
      // pre-check (rather than a raw 23505 from the UNIQUE (scorecard_id,
      // kpi_id) index) is race-free, not merely best-effort.
      const duplicateCheck = await client.query(
        `SELECT 1 FROM rvn_kpi_scorecard_items WHERE scorecard_id = $1 AND kpi_id = $2`,
        [scorecardId, kpiId]
      );
      if (duplicateCheck.rowCount) {
        throw new KpiScorecardValidationError(
          `KPI ${kpiId} is already a member of scorecard ${scorecardId}`,
          'ITEM_ALREADY_EXISTS',
          { scorecardId, kpiId }
        );
      }

      const itemInsert = await client.query<KpiScorecardItemRow>(
        `INSERT INTO rvn_kpi_scorecard_items
           (scorecard_id, kpi_id, organization_id, role, sort_order, display_config, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [scorecardId, kpiId, organizationId, role, sortOrder, displayConfig, actorUserId]
      );
      const itemRow = itemInsert.rows[0];
      if (!itemRow) throw new Error('[addScorecardItem] insert into rvn_kpi_scorecard_items returned no row');

      const scorecardUpdate = await client.query<KpiScorecardRow>(
        `UPDATE rvn_kpi_scorecards SET row_version = $1, updated_at = now() WHERE scorecard_id = $2 RETURNING *`,
        [nextVersion, scorecardId]
      );
      const updatedScorecard = scorecardUpdate.rows[0];
      if (!updatedScorecard) throw new Error(`[addScorecardItem] scorecard update returned no row for ${scorecardId}`);

      return { scorecard: toKpiScorecard(updatedScorecard), item: toKpiScorecardItem(itemRow) };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { scorecard: result.scorecard, item: result.item };
      return {
        schemaVersion: 1,
        eventType: 'scorecard.membership_changed',
        aggregateType: 'kpi_scorecard',
        aggregateId: scorecardId,
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
        source: KPI_SCORECARD_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { scorecardId, itemId: result.item.itemId, kpiId, change: 'added' },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// removeScorecardItem
// ==========================================

export interface RemoveScorecardItemInput extends BaseScorecardCommandInput {
  itemId: string;
}

export interface RemoveScorecardItemResult {
  scorecard: KpiScorecard;
  removedItemId: string;
}

export async function removeScorecardItem(
  input: RemoveScorecardItemInput
): Promise<AtomicCommandOutcome<RemoveScorecardItemResult>> {
  const {
    scorecardId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    itemId,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiScorecardRow, RemoveScorecardItemResult>({
    organizationId,
    aggregateId: scorecardId,
    expectedVersion,
    loadForUpdate: loadScorecardForUpdate,
    getCurrentVersion: scorecardRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      beforeState = toScorecardSummary(currentRow);

      const deleteResult = await client.query(
        `DELETE FROM rvn_kpi_scorecard_items WHERE item_id = $1 AND scorecard_id = $2 AND organization_id = $3`,
        [itemId, scorecardId, organizationId]
      );
      if (!deleteResult.rowCount) {
        throw new KpiScorecardValidationError(
          `Item ${itemId} is not a member of scorecard ${scorecardId}`,
          'ITEM_NOT_FOUND',
          { scorecardId, itemId }
        );
      }

      const scorecardUpdate = await client.query<KpiScorecardRow>(
        `UPDATE rvn_kpi_scorecards SET row_version = $1, updated_at = now() WHERE scorecard_id = $2 RETURNING *`,
        [nextVersion, scorecardId]
      );
      const updatedScorecard = scorecardUpdate.rows[0];
      if (!updatedScorecard)
        throw new Error(`[removeScorecardItem] scorecard update returned no row for ${scorecardId}`);

      return { scorecard: toKpiScorecard(updatedScorecard), removedItemId: itemId };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { scorecard: result.scorecard, removedItemId: result.removedItemId };
      return {
        schemaVersion: 1,
        eventType: 'scorecard.membership_changed',
        aggregateType: 'kpi_scorecard',
        aggregateId: scorecardId,
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
        source: KPI_SCORECARD_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { scorecardId, itemId, change: 'removed' },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// reorderScorecardItems (decision #4: item `role` change folded in here —
// no separate endpoint)
// ==========================================

export interface ReorderScorecardItemSpec {
  itemId: string;
  sortOrder: number;
  role?: KpiScorecardItemRole;
}

export interface ReorderScorecardItemsInput extends BaseScorecardCommandInput {
  items: ReorderScorecardItemSpec[];
}

export interface ReorderScorecardItemsResult {
  scorecard: KpiScorecard;
  items: KpiScorecardItem[];
}

export async function reorderScorecardItems(
  input: ReorderScorecardItemsInput
): Promise<AtomicCommandOutcome<ReorderScorecardItemsResult>> {
  const {
    scorecardId,
    organizationId,
    expectedVersion,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    items,
  } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<KpiScorecardRow, ReorderScorecardItemsResult>({
    organizationId,
    aggregateId: scorecardId,
    expectedVersion,
    loadForUpdate: loadScorecardForUpdate,
    getCurrentVersion: scorecardRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      beforeState = toScorecardSummary(currentRow);

      const updatedItems: KpiScorecardItem[] = [];
      for (const spec of items) {
        const updateResult = await client.query<KpiScorecardItemRow>(
          `UPDATE rvn_kpi_scorecard_items
              SET sort_order = $1, role = COALESCE($2, role)
            WHERE item_id = $3 AND scorecard_id = $4 AND organization_id = $5
            RETURNING *`,
          [spec.sortOrder, spec.role ?? null, spec.itemId, scorecardId, organizationId]
        );
        const updatedRow = updateResult.rows[0];
        if (!updatedRow) {
          throw new KpiScorecardValidationError(
            `Item ${spec.itemId} is not a member of scorecard ${scorecardId}`,
            'ITEM_NOT_FOUND',
            { scorecardId, itemId: spec.itemId }
          );
        }
        updatedItems.push(toKpiScorecardItem(updatedRow));
      }

      const scorecardUpdate = await client.query<KpiScorecardRow>(
        `UPDATE rvn_kpi_scorecards SET row_version = $1, updated_at = now() WHERE scorecard_id = $2 RETURNING *`,
        [nextVersion, scorecardId]
      );
      const updatedScorecard = scorecardUpdate.rows[0];
      if (!updatedScorecard)
        throw new Error(`[reorderScorecardItems] scorecard update returned no row for ${scorecardId}`);

      return { scorecard: toKpiScorecard(updatedScorecard), items: updatedItems };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { scorecard: result.scorecard, items: result.items };
      return {
        schemaVersion: 1,
        eventType: 'scorecard.membership_changed',
        aggregateType: 'kpi_scorecard',
        aggregateId: scorecardId,
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
        source: KPI_SCORECARD_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { scorecardId, itemIds: result.items.map((i) => i.itemId), change: 'reordered' },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// Lifecycle: activateScorecard / suspendScorecard / archiveScorecard
// (mirrors kpiDefinitionCommands.ts's runKpiLifecycleTransition)
// ==========================================

interface ScorecardLifecycleTransitionSpec {
  eventType: string;
  fromStatuses: readonly KpiScorecardLifecycleStatus[];
  toStatus: KpiScorecardLifecycleStatus;
  /** Decyzja #5: activateScorecard requires >=1 member. */
  requiresAtLeastOneMember: boolean;
}

async function runScorecardLifecycleTransition(
  spec: ScorecardLifecycleTransitionSpec,
  input: BaseScorecardCommandInput
): Promise<AtomicCommandOutcome<KpiScorecard>> {
  const {
    scorecardId,
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

  return executeAtomicCommand<KpiScorecardRow, KpiScorecard>({
    organizationId,
    aggregateId: scorecardId,
    expectedVersion,
    loadForUpdate: loadScorecardForUpdate,
    getCurrentVersion: scorecardRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (!spec.fromStatuses.includes(currentRow.lifecycle_status)) {
        throw new KpiScorecardValidationError(
          `Scorecard ${scorecardId} is "${currentRow.lifecycle_status}" — cannot transition to "${spec.toStatus}" from there`,
          'INVALID_SCORECARD_STATUS_TRANSITION',
          { scorecardId, currentStatus: currentRow.lifecycle_status, toStatus: spec.toStatus }
        );
      }

      if (spec.requiresAtLeastOneMember) {
        const memberCount = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM rvn_kpi_scorecard_items WHERE scorecard_id = $1`,
          [scorecardId]
        );
        if (Number(memberCount.rows[0]?.count ?? '0') < 1) {
          throw new KpiScorecardValidationError(
            `Scorecard ${scorecardId} has no members — cannot activate`,
            'NO_MEMBERS',
            { scorecardId }
          );
        }
      }

      beforeState = toScorecardSummary(currentRow);

      const updateResult = await client.query<KpiScorecardRow>(
        `UPDATE rvn_kpi_scorecards
            SET lifecycle_status = $1, row_version = $2, updated_at = now()
          WHERE scorecard_id = $3
          RETURNING *`,
        [spec.toStatus, nextVersion, scorecardId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[${spec.eventType}] update returned no row for ${scorecardId}`);
      return toKpiScorecard(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = { scorecard: result };
      return {
        schemaVersion: 1,
        eventType: spec.eventType,
        aggregateType: 'kpi_scorecard',
        aggregateId: scorecardId,
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
        source: KPI_SCORECARD_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { scorecardId },
      } satisfies AtomicEventInput;
    },
  });
}

export function activateScorecard(input: BaseScorecardCommandInput): Promise<AtomicCommandOutcome<KpiScorecard>> {
  return runScorecardLifecycleTransition(
    {
      eventType: 'scorecard.activated',
      fromStatuses: ['draft', 'suspended'],
      toStatus: 'active',
      requiresAtLeastOneMember: true,
    },
    input
  );
}

export function suspendScorecard(input: BaseScorecardCommandInput): Promise<AtomicCommandOutcome<KpiScorecard>> {
  return runScorecardLifecycleTransition(
    {
      eventType: 'scorecard.suspended',
      fromStatuses: ['active'],
      toStatus: 'suspended',
      requiresAtLeastOneMember: false,
    },
    input
  );
}

export function archiveScorecard(input: BaseScorecardCommandInput): Promise<AtomicCommandOutcome<KpiScorecard>> {
  return runScorecardLifecycleTransition(
    {
      eventType: 'scorecard.archived',
      fromStatuses: ['draft', 'active', 'suspended'],
      toStatus: 'archived',
      requiresAtLeastOneMember: false,
    },
    input
  );
}

// ==========================================
// createReviewSnapshot (decision #8: draft only, no live-data
// materialization — that happens only at publish, §B)
// ==========================================

export interface CreateReviewSnapshotInput {
  scorecardId: string;
  organizationId: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  createdBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function createReviewSnapshot(
  input: CreateReviewSnapshotInput
): Promise<AtomicCommandOutcome<KpiScorecardReviewSnapshot>> {
  const {
    scorecardId,
    organizationId,
    reviewPeriodStart,
    reviewPeriodEnd,
    createdBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  return executeAtomicCreate<KpiScorecardReviewSnapshot>({
    organizationId,
    applyMutation: async (client) => {
      // Not pinned by decision #8 explicitly (which only fixes the create
      // shape) — this package's own minimal guard, existence + archived
      // check, mirroring addCorrectiveAction's parent-existence check.
      const scorecardResult = await client.query<{ lifecycle_status: KpiScorecardLifecycleStatus }>(
        `SELECT lifecycle_status FROM rvn_kpi_scorecards WHERE scorecard_id = $1 AND organization_id = $2`,
        [scorecardId, organizationId]
      );
      const scorecardRow = scorecardResult.rows[0];
      if (!scorecardRow) {
        throw new KpiScorecardValidationError(`Scorecard ${scorecardId} not found`, 'SCORECARD_NOT_FOUND', {
          scorecardId,
        });
      }
      if (scorecardRow.lifecycle_status === 'archived') {
        throw new KpiScorecardValidationError(
          `Scorecard ${scorecardId} is "archived" — a new review snapshot cannot be started`,
          'SCORECARD_ARCHIVED',
          { scorecardId }
        );
      }

      const insertResult = await client.query<KpiScorecardReviewSnapshotRow>(
        `INSERT INTO rvn_kpi_scorecard_review_snapshots
           (scorecard_id, organization_id, review_period_start, review_period_end, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [scorecardId, organizationId, reviewPeriodStart, reviewPeriodEnd, createdBy]
      );
      const row = insertResult.rows[0];
      if (!row) throw new Error('[createReviewSnapshot] insert returned no row');
      return toKpiScorecardReviewSnapshot(row);
    },
    buildEvent: ({ result }) => {
      const afterState = { snapshot: result };
      return {
        schemaVersion: 1,
        eventType: 'scorecard.review_created',
        aggregateType: 'kpi_scorecard',
        aggregateId: scorecardId,
        organizationId,
        actorUserId: createdBy,
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
        source: KPI_SCORECARD_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { scorecardId, snapshotId: result.snapshotId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// publishReviewSnapshot — §B, verbatim, WITH decision #6a's publisher-
// visibility filter spliced in (the design doc's own §B prose explicitly
// flags this as required, not optional, before shipping).
// ==========================================

async function loadSnapshotForUpdate(
  client: PoolClient,
  snapshotId: string,
  organizationId: string
): Promise<KpiScorecardReviewSnapshotRow | undefined> {
  const result = await client.query<KpiScorecardReviewSnapshotRow>(
    `SELECT * FROM rvn_kpi_scorecard_review_snapshots
      WHERE snapshot_id = $1 AND organization_id = $2 FOR UPDATE`,
    [snapshotId, organizationId]
  );
  return result.rows[0];
}
const snapshotRowVersion = (row: KpiScorecardReviewSnapshotRow) => row.row_version;

function toScorecardReviewSnapshotSummary(row: KpiScorecardReviewSnapshotRow) {
  return {
    snapshot: {
      snapshotId: row.snapshot_id,
      scorecardId: row.scorecard_id,
      status: row.status,
      reviewPeriodStart: row.review_period_start,
      reviewPeriodEnd: row.review_period_end,
      contentHash: row.content_hash,
    },
  };
}

export interface PublishReviewSnapshotInput {
  snapshotId: string;
  scorecardId: string;
  organizationId: string;
  expectedVersion: number;
  publishedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface PublishReviewSnapshotResult {
  snapshotId: string;
  scorecardId: string;
  status: 'published';
  contentHash: string;
  publishedAt: string;
  supersededSnapshotId: string | null;
  items: ScorecardSnapshotItemFact[];
  statusCounts: ScorecardStatusCounts;
}

/**
 * Publishes a draft review snapshot: materializes the frozen payload from
 * LIVE data as of NOW, filtered to items the PUBLISHER can see (decision #6a
 * — full non-leak requires ALSO decision #6b at read time, see
 * kpiScorecardRepository.ts's `getPublishedSnapshot`), computes
 * content_hash, supersedes whatever was previously published for this
 * scorecard_id, freezes this row. One transaction, CAS'd on the snapshot's
 * own row_version.
 */
export async function publishReviewSnapshot(
  input: PublishReviewSnapshotInput
): Promise<AtomicCommandOutcome<PublishReviewSnapshotResult>> {
  const {
    snapshotId,
    scorecardId,
    organizationId,
    expectedVersion,
    publishedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  let beforeState: Record<string, unknown> | null = null;
  let supersededSnapshotId: string | null = null;

  return executeAtomicCommand<KpiScorecardReviewSnapshotRow, PublishReviewSnapshotResult>({
    organizationId,
    aggregateId: snapshotId,
    expectedVersion,
    loadForUpdate: loadSnapshotForUpdate,
    getCurrentVersion: snapshotRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.scorecard_id !== scorecardId) {
        throw new KpiScorecardValidationError(
          `Snapshot ${snapshotId} does not belong to scorecard ${scorecardId}`,
          'SCORECARD_MISMATCH',
          { snapshotId, scorecardId, actualScorecardId: currentRow.scorecard_id }
        );
      }
      if (currentRow.status !== 'draft') {
        throw new KpiScorecardValidationError(
          `Snapshot ${snapshotId} is "${currentRow.status}" — only a draft snapshot may be published`,
          'NOT_A_DRAFT',
          { snapshotId, status: currentRow.status }
        );
      }

      beforeState = toScorecardReviewSnapshotSummary(currentRow);

      // Step 1: materialize from live data, filtered to items VISIBLE TO
      // THE PUBLISHER (decision #6a) — same predicate shape
      // buildVisibilityScopedCte would produce for a single user, spliced in
      // via wrapWithVisibilityScope rather than hand-rolled, so this reuses
      // the SAME branching resolveVisibility()/buildVisibilityScopedCte
      // already implement instead of a third divergent visibility check.
      const baseQuerySql = `
        SELECT si.kpi_id, si.role, kd.current_definition_version_id AS definition_version_id,
               m.measurement_id, m.actual_value, dv.unit, m.performance_status,
               m.data_quality_status, m.period_start, m.period_end
          FROM rvn_kpi_scorecard_items si
          INNER JOIN rvn_visible_resources vr
                  ON vr.resource_type = 'kpi' AND vr.resource_id = si.kpi_id
          JOIN rvn_kpi_definitions kd
            ON kd.kpi_id = si.kpi_id AND kd.organization_id = si.organization_id
          LEFT JOIN rvn_kpi_definition_versions dv
            ON dv.definition_version_id = kd.current_definition_version_id
          LEFT JOIN LATERAL (
            SELECT m2.* FROM rvn_kpi_measurements m2
             WHERE m2.kpi_id = si.kpi_id AND m2.period_end <= $${VISIBILITY_CTE_PARAM_COUNT + 3}
               AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer
                                WHERE newer.correction_of_measurement_id = m2.measurement_id)
             ORDER BY m2.period_end DESC, m2.recorded_at DESC LIMIT 1
          ) m ON true
         WHERE si.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
           AND si.organization_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
         ORDER BY si.sort_order ASC`;
      const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
        userId: publishedBy,
        organizationId,
        resourceType: 'kpi',
      });
      const itemsResult = await client.query<{
        kpi_id: string;
        role: string;
        definition_version_id: string | null;
        measurement_id: string | null;
        actual_value: string | null;
        unit: string | null;
        performance_status: string | null;
        data_quality_status: string | null;
        period_start: string | null;
        period_end: string | null;
      }>(wrapped.sql, [...wrapped.values, scorecardId, organizationId, currentRow.review_period_end]);

      const items: ScorecardSnapshotItemFact[] = itemsResult.rows.map((row) => ({
        kpiId: row.kpi_id,
        definitionVersionId: row.definition_version_id,
        itemRole: row.role as 'primary' | 'supporting',
        measurementId: row.measurement_id,
        actualValue: row.actual_value === null ? null : Number(row.actual_value),
        unit: row.unit,
        performanceStatus: row.performance_status as ScorecardSnapshotItemFact['performanceStatus'],
        dataQualityStatus: row.data_quality_status,
        periodStart: row.period_start,
        periodEnd: row.period_end,
      }));

      // Step 2: status distribution. 'missing' = no measurement row OR
      // performance_status='neutral' (decision #2) — invariant "missing is
      // never inferred as zero" honored by keeping both out of the
      // numeric-looking buckets.
      const statusCounts: ScorecardStatusCounts = { safe: 0, warning: 0, critical: 0, missing: 0 };
      for (const item of items) {
        if (item.performanceStatus === 'on_target') statusCounts.safe += 1;
        else if (item.performanceStatus === 'warning') statusCounts.warning += 1;
        else if (item.performanceStatus === 'critical') statusCounts.critical += 1;
        else statusCounts.missing += 1;
      }

      const snapshotPayload = { items, statusCounts };
      const contentHash = computeStateHash(snapshotPayload as unknown as Record<string, unknown>);

      // Step 3: supersede the currently-published snapshot, same transaction.
      const supersedeResult = await client.query<{ snapshot_id: string }>(
        `UPDATE rvn_kpi_scorecard_review_snapshots
            SET status = 'superseded', superseded_by_snapshot_id = $1, superseded_at = now(),
                row_version = row_version + 1, updated_at = now()
          WHERE scorecard_id = $2 AND status = 'published'
          RETURNING snapshot_id`,
        [snapshotId, scorecardId]
      );
      supersededSnapshotId = supersedeResult.rows[0]?.snapshot_id ?? null;

      // Step 4: freeze this snapshot.
      const publishedAt = new Date().toISOString();
      const updateResult = await client.query<KpiScorecardReviewSnapshotRow>(
        `UPDATE rvn_kpi_scorecard_review_snapshots
            SET status = 'published', snapshot_payload = $1, content_hash = $2,
                published_by = $3, published_at = $4, row_version = $5, updated_at = now()
          WHERE snapshot_id = $6 RETURNING *`,
        [JSON.stringify(snapshotPayload), contentHash, publishedBy, publishedAt, nextVersion, snapshotId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[publishReviewSnapshot] update returned no row for ${snapshotId}`);

      // Step 5: record which measurements the frozen payload used.
      const measurementIds = items.map((i) => i.measurementId).filter((id): id is string => id !== null);
      if (measurementIds.length > 0) {
        await client.query(
          `INSERT INTO rvn_kpi_scorecard_review_snapshot_measurements (snapshot_id, measurement_id)
             SELECT $1, mid FROM unnest($2::uuid[]) AS mid ON CONFLICT DO NOTHING`,
          [snapshotId, measurementIds]
        );
      }

      return {
        snapshotId: updatedRow.snapshot_id,
        scorecardId: updatedRow.scorecard_id,
        status: 'published',
        contentHash,
        publishedAt,
        supersededSnapshotId,
        items,
        statusCounts,
      };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = {
        snapshot: {
          snapshotId: result.snapshotId,
          scorecardId: result.scorecardId,
          status: result.status,
          contentHash: result.contentHash,
          statusCounts: result.statusCounts,
        },
      };
      return {
        schemaVersion: 1,
        eventType: 'scorecard.review_published',
        aggregateType: 'kpi_scorecard',
        aggregateId: result.scorecardId,
        organizationId,
        actorUserId: publishedBy,
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
        source: KPI_SCORECARD_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: {
          snapshotId: result.snapshotId,
          contentHash: result.contentHash,
          supersededSnapshotId: result.supersededSnapshotId,
        },
      } satisfies AtomicEventInput;
    },
  });
}
