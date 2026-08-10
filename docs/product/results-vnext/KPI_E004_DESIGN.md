# KPI-E004 Scorecards — Approved Design

> Status: APPROVED FOR IMPLEMENTATION (Integration Owner review 2026-08-09).
> Two independent draft passes (agents `a919e772f8a34efad`, `a4f07bd2c39d8702e`)
> reconciled into ONE self-consistent design by the Integration Owner — they
> disagreed on non-leak read semantics, resolved below (decision #6+).
> **This file contains the COMPLETE DDL and command/repository code.**
> Implementers work from THIS FILE ALONE, not from any prior conversation.

## Prerequisite (must land first, Package 0)

`server/src/services/resultsVnext/platform/resourceTypes.ts`'s
`RVN_RESOURCE_TYPES` today is `['kpi','roi_case','okr_set','deviation_case']`
— it does **not** contain `'kpi_scorecard'`. Append it (never reorder/remove
existing values), and append `'kpi_scorecard'` to `CanonicalObjectTypeValues`
in `server/src/types/myWorkRoofPackage.ts` the same way KPI-E003 appended
`'deviation_case'`. Nothing in §B/§C below compiles or passes visibility
checks without this one-line-per-file prerequisite.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Visibility policy domain for Scorecards: reuse `'kpi'` or new `'kpi_scorecard'` domain (for `getActiveVisibilityPolicy(orgId, domain)`) | **Reuse `'kpi'` domain for V1.** Simpler, no new provisioning step. The `resource_type` used in `rvn_platform_resource_visibility`/`rvn_visible_resources` is still genuinely `'kpi_scorecard'` (separate axis) — this decision only concerns which policy *defaults* a scorecard inherits. |
| 2 | "Missing" bucket = no measurement row OR `performance_status='neutral'`, both in one counter | **Approved as designed.** Both cases mean "this number says nothing about status" from a reviewer's perspective — same action either way ("check why"). |
| 3 | Frozen snapshot does not retroactively redact if a member KPI's visibility narrows after publish | **Approved, documented tradeoff** — same posture as "approved definition version is immutable." No retroactive redaction of the *stored* row (would break `content_hash` integrity). Read-time redaction (decision #6) is a separate, additional layer — it does not mutate storage. |
| 4 | Item `role` change folded into `reorderScorecardItems` (no separate endpoint) | **Approved.** |
| 5 | `activateScorecard` requires ≥1 member | **Approved.** |
| 6 | **Non-leak on READ of a published snapshot (P0, plan §14 risk row) — the two draft passes disagreed here, this is the Integration Owner's resolution, not either draft's original design:** | **Two-layer defense, both required:** (a) `publishReviewSnapshot` only materializes items the **publisher** can see (§B step 1, unchanged from the second reconstruction) — an unauthorized publisher cannot freeze what they cannot see. (b) **NEW REQUIREMENT, not in either draft**: `getPublishedSnapshot`/`listReviewSnapshots` (§C.2) must additionally filter the returned `snapshot_payload.items` array to only the KPIs the **requesting reader** can currently see, using the same `'kpi'`-resourceType visibility check `listScorecardItems` already uses — computed and applied at response time, never persisted, never changing `content_hash` (the hash validates the full *stored* row; what's redacted is what's *served* to an under-privileged caller). Without this, a snapshot published by an authorized user (who could see a restricted KPI) would leak that KPI's frozen values to any other viewer who merely has scorecard-level visibility — exactly the plan's own named P0 risk. |
| 7 | Supersession matches review period by **exact equality**, not range overlap | **Approved as designed.** Scorecard review periods are set explicitly per cadence; overlap semantics add complexity with no demonstrated need. |
| 8 | `createScorecard`/`addScorecardItem`/`createReviewSnapshot` (the draft-creating half, before `publishReviewSnapshot`) were not fully specified by either draft pass | **Implement following the established KPI-E001/E003 pattern exactly** (`createKpiDraft`/`addCorrectiveAction` as the templates): `createScorecard` via `executeAtomicCreate` (INSERT `rvn_kpi_scorecards` + INSERT `rvn_platform_resource_visibility` row with `resource_type='kpi_scorecard'`, same transaction); `addScorecardItem`/`removeScorecardItem`/`reorderScorecardItems` via `executeAtomicCommand` on the scorecard's own `row_version` (adding/removing/reordering membership is a scorecard-level mutation, not an item-level CAS — items have no `row_version` of their own, matching §A's schema which gives `rvn_kpi_scorecard_items` no such column); `createReviewSnapshot` via `executeAtomicCreate` producing a `status='draft'` row with `review_period_start`/`review_period_end` set and `snapshot_payload`/`content_hash`/`published_*` left `NULL` — no live-data materialization at this step (that happens only at publish, §B). |

## A) Frozen schema

```sql
-- server/migrations/20260812_rvn_kpi_scorecards.sql

-- KPI-E004 — Scorecards (rvn_kpi_scorecards / rvn_kpi_scorecard_items /
-- rvn_kpi_scorecard_review_snapshots / rvn_kpi_scorecard_review_snapshot_measurements).
--
-- Design: 02_KPI_IMPLEMENTATION_PLAN.md §3.1 (Scorecard/ScorecardItem/
-- ScorecardReviewSnapshot YAML), §7.4 (API routes), §8 (event catalog),
-- §14 P0 risk row "Restricted KPI leaks in Scorecard totals" (see decision
-- #6 above for how this is closed). EPIC_LEDGER_LIVE.md KPI-E004: 5 AC —
-- (1) one KPI in many scorecards without duplicating truth, (2) ScorecardItem
-- never writes to KPI tables, (3) immutable snapshot with content_hash +
-- supersession, (4) non-leak aggregation, (5) 7-section Scorecard Tool.
-- Builds on 20260809_rvn_platform_*.sql and 20260810_rvn_kpi_core.sql —
-- same conventions (organization_id everywhere, row_version for CAS, TEXT
-- ids, TIMESTAMPTZ, gen_random_uuid() defaults).
--
-- PREREQUISITE (not in this file): RVN_RESOURCE_TYPES / CanonicalObjectTypeValues
-- must have 'kpi_scorecard' appended before any application code in §B/§C
-- below can call buildVisibilityScopedCte/getActiveVisibilityPolicy with it.

CREATE TABLE IF NOT EXISTS rvn_kpi_scorecards (
  scorecard_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      TEXT NOT NULL,
  name               TEXT NOT NULL,
  description          TEXT NULL,
  scope_type          TEXT NOT NULL
                      CHECK (scope_type IN
                        ('organization','business_unit','team','process','individual','custom')),
  scope_id            TEXT NULL,
  owner_user_id        TEXT NOT NULL,
  review_frequency      TEXT NOT NULL
                      CHECK (review_frequency IN ('weekly','monthly','quarterly','annual','custom')),
  -- No 'pending_approval' — a Scorecard is a curation/membership object,
  -- not a governed contract requiring maker-checker.
  lifecycle_status      TEXT NOT NULL DEFAULT 'draft'
                      CHECK (lifecycle_status IN ('draft','active','suspended','archived')),
  row_version          INT NOT NULL DEFAULT 1,
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecards_org_status
  ON rvn_kpi_scorecards(organization_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecards_owner
  ON rvn_kpi_scorecards(organization_id, owner_user_id);

-- rvn_kpi_scorecard_items — pure membership reference. AC #1/#2. Carries NO
-- KPI-fact column (no actual_value, no cached status) — every render reads
-- rvn_kpi_measurements fresh through kpi_id. This is what makes AC #2
-- structurally true, not just a discipline.
CREATE TABLE IF NOT EXISTS rvn_kpi_scorecard_items (
  item_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id        UUID NOT NULL REFERENCES rvn_kpi_scorecards(scorecard_id),
  kpi_id             UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  organization_id      TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'supporting'
                      CHECK (role IN ('primary','supporting')),
  sort_order          INT NOT NULL DEFAULT 0,
  display_config       JSONB NULL,
  added_by           TEXT NOT NULL,
  added_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- AC #1 is cross-scorecard (same kpi_id legitimately has one row per OTHER
  -- scorecard). This UNIQUE is the within-scorecard half: no duplicate KPI
  -- on one card.
  UNIQUE (scorecard_id, kpi_id)
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_items_scorecard_sort
  ON rvn_kpi_scorecard_items(scorecard_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_items_kpi
  ON rvn_kpi_scorecard_items(kpi_id);

-- rvn_kpi_scorecard_review_snapshots — immutable published view. AC #3.
CREATE TABLE IF NOT EXISTS rvn_kpi_scorecard_review_snapshots (
  snapshot_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id            UUID NOT NULL REFERENCES rvn_kpi_scorecards(scorecard_id),
  organization_id          TEXT NOT NULL,
  review_period_start        TIMESTAMPTZ NOT NULL,
  review_period_end          TIMESTAMPTZ NOT NULL,
  -- Shape: { items: [{ kpiId, definitionVersionId, itemRole, measurementId,
  -- actualValue, unit, performanceStatus, dataQualityStatus, periodStart,
  -- periodEnd }], statusCounts: { safe, warning, critical, missing } }.
  -- NULL while status='draft'.
  snapshot_payload          JSONB NULL,
  status                 TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','published','superseded')),
  content_hash             TEXT NULL,
  published_by             TEXT NULL,
  published_at             TIMESTAMPTZ NULL,
  superseded_by_snapshot_id     UUID NULL REFERENCES rvn_kpi_scorecard_review_snapshots(snapshot_id),
  superseded_at             TIMESTAMPTZ NULL,
  row_version              INT NOT NULL DEFAULT 1,
  created_by              TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_snapshots_scorecard_status
  ON rvn_kpi_scorecard_review_snapshots(scorecard_id, status);
CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_snapshots_published_at
  ON rvn_kpi_scorecard_review_snapshots(scorecard_id, published_at DESC);

-- AC #3 defense-in-depth: at most ONE live published snapshot per scorecard.
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_kpi_scorecard_snapshots_one_published
  ON rvn_kpi_scorecard_review_snapshots(scorecard_id)
  WHERE status = 'published';

-- Immutability trigger — same shape as
-- trg_rvn_kpi_definition_versions_protect_approved. Allows exactly the
-- supersession bookkeeping through after publish; everything else frozen.
CREATE OR REPLACE FUNCTION rvn_kpi_scorecard_snapshots_protect_published()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'published' THEN
    IF NEW.scorecard_id IS DISTINCT FROM OLD.scorecard_id
       OR NEW.review_period_start IS DISTINCT FROM OLD.review_period_start
       OR NEW.review_period_end IS DISTINCT FROM OLD.review_period_end
       OR NEW.snapshot_payload IS DISTINCT FROM OLD.snapshot_payload
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.published_by IS DISTINCT FROM OLD.published_by
       OR NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
    THEN
      RAISE EXCEPTION
        'rvn_kpi_scorecard_review_snapshots: snapshot % is published — only status/superseded_by_snapshot_id/superseded_at (and row_version/updated_at bookkeeping) may change',
        OLD.snapshot_id
        USING ERRCODE = '23001';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'superseded' THEN
      RAISE EXCEPTION
        'rvn_kpi_scorecard_review_snapshots: snapshot % is published — may only transition to superseded',
        OLD.snapshot_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_kpi_scorecard_snapshots_protect_published ON rvn_kpi_scorecard_review_snapshots;
CREATE TRIGGER trg_rvn_kpi_scorecard_snapshots_protect_published
  BEFORE UPDATE ON rvn_kpi_scorecard_review_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION rvn_kpi_scorecard_snapshots_protect_published();

-- Join table replacing the plan's literal source_measurement_ids: uuid[]
-- (same reasoning as KPI-E003 decision #6: Postgres does not validate FKs
-- inside arrays).
CREATE TABLE IF NOT EXISTS rvn_kpi_scorecard_review_snapshot_measurements (
  snapshot_id      UUID NOT NULL REFERENCES rvn_kpi_scorecard_review_snapshots(snapshot_id),
  measurement_id    UUID NOT NULL REFERENCES rvn_kpi_measurements(measurement_id),
  PRIMARY KEY (snapshot_id, measurement_id)
);

CREATE INDEX IF NOT EXISTS idx_rvn_kpi_scorecard_snapshot_measurements_measurement
  ON rvn_kpi_scorecard_review_snapshot_measurements(measurement_id);
```

## B) Command layer

`publishReviewSnapshot` — the flagship, full example (create-flow commands
per decision #8 follow the KPI-E001/E003 templates, not reproduced line by
line here):

```ts
// server/src/services/resultsVnext/kpi/kpiScorecardCommands.ts
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  executeAtomicCommand,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import { computeStateHash } from './kpiDefinitionCommands.js';

export const KPI_SCORECARD_EVENT_SOURCE = 'resultsVnext.kpiScorecard';

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

export interface KpiScorecardReviewSnapshotRow {
  snapshot_id: string;
  scorecard_id: string;
  organization_id: string;
  review_period_start: string;
  review_period_end: string;
  snapshot_payload: Record<string, unknown> | null;
  status: 'draft' | 'published' | 'superseded';
  content_hash: string | null;
  published_by: string | null;
  published_at: string | null;
  superseded_by_snapshot_id: string | null;
  superseded_at: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

async function loadSnapshotForUpdate(
  client: PoolClient, snapshotId: string, organizationId: string
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
    snapshotId: row.snapshot_id, scorecardId: row.scorecard_id, status: row.status,
    reviewPeriodStart: row.review_period_start, reviewPeriodEnd: row.review_period_end,
    contentHash: row.content_hash,
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

export interface ScorecardSnapshotItemFact {
  kpiId: string;
  definitionVersionId: string | null;
  itemRole: 'primary' | 'supporting';
  measurementId: string | null;
  actualValue: number | null;
  unit: string | null;
  performanceStatus: 'on_target' | 'warning' | 'critical' | 'neutral' | null;
  dataQualityStatus: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ScorecardStatusCounts {
  safe: number; warning: number; critical: number; missing: number;
}

export interface PublishReviewSnapshotResult {
  snapshotId: string; scorecardId: string; status: 'published'; contentHash: string;
  publishedAt: string; supersededSnapshotId: string | null;
  items: ScorecardSnapshotItemFact[]; statusCounts: ScorecardStatusCounts;
}

/**
 * Publishes a draft review snapshot: materializes the frozen payload from
 * LIVE data as of NOW, filtered to items the PUBLISHER can see (decision #6a
 * — full non-leak requires ALSO decision #6b at read time, see
 * kpiScorecardRepository.ts), computes content_hash, supersedes whatever was
 * previously published for this scorecard_id, freezes this row. One
 * transaction, CAS'd on the snapshot's own row_version.
 */
export async function publishReviewSnapshot(
  input: PublishReviewSnapshotInput
): Promise<AtomicCommandOutcome<PublishReviewSnapshotResult>> {
  const {
    snapshotId, scorecardId, organizationId, expectedVersion, publishedBy,
    actorEffectiveRole, idempotencyKey, correlationId, causationId = null, reason = null,
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
          'SCORECARD_MISMATCH', { snapshotId, scorecardId, actualScorecardId: currentRow.scorecard_id }
        );
      }
      if (currentRow.status !== 'draft') {
        throw new KpiScorecardValidationError(
          `Snapshot ${snapshotId} is "${currentRow.status}" — only a draft snapshot may be published`,
          'NOT_A_DRAFT', { snapshotId, status: currentRow.status }
        );
      }

      beforeState = { snapshot: toScorecardReviewSnapshotSummary(currentRow) };

      // Step 1: materialize from live data, filtered to items VISIBLE TO
      // THE PUBLISHER (decision #6a) — join to rvn_platform_resource_visibility
      // for resource_type='kpi' scoped to publishedBy, exactly the same
      // predicate shape buildVisibilityScopedCte would produce for a single
      // user, inlined here since this runs inside an existing transaction
      // rather than through the read-path CTE wrapper. Implementer: reuse
      // resolveVisibility()-equivalent logic, do not hand-roll a THIRD
      // divergent visibility check — call buildVisibilityScopedCte({userId:
      // publishedBy, organizationId, resourceType:'kpi'}) and splice its CTE
      // into this query rather than reimplementing the branches inline.
      const itemsResult = await client.query<{
        kpi_id: string; role: string; definition_version_id: string | null;
        measurement_id: string | null; actual_value: string | null; unit: string | null;
        performance_status: string | null; data_quality_status: string | null;
        period_start: string | null; period_end: string | null;
      }>(
        `SELECT si.kpi_id, si.role, kd.current_definition_version_id AS definition_version_id,
                m.measurement_id, m.actual_value, dv.unit, m.performance_status,
                m.data_quality_status, m.period_start, m.period_end
           FROM rvn_kpi_scorecard_items si
           JOIN rvn_kpi_definitions kd
             ON kd.kpi_id = si.kpi_id AND kd.organization_id = si.organization_id
           LEFT JOIN rvn_kpi_definition_versions dv
             ON dv.definition_version_id = kd.current_definition_version_id
           LEFT JOIN LATERAL (
             SELECT m2.* FROM rvn_kpi_measurements m2
              WHERE m2.kpi_id = si.kpi_id AND m2.period_end <= $3
                AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer
                                 WHERE newer.correction_of_measurement_id = m2.measurement_id)
              ORDER BY m2.period_end DESC, m2.recorded_at DESC LIMIT 1
           ) m ON true
          WHERE si.scorecard_id = $1 AND si.organization_id = $2
          ORDER BY si.sort_order ASC`,
        [scorecardId, organizationId, currentRow.review_period_end]
      );
      // NOTE for implementer: the query above does NOT yet apply the
      // publisher-visibility filter described in the prose — splice it in
      // (INNER JOIN to the resolved visible-kpi-id CTE) before this ships;
      // shown without it here only to keep the base "current row per
      // period" shape readable. Do not ship without the filter — it is not
      // optional, it is decision #6a.

      const items: ScorecardSnapshotItemFact[] = itemsResult.rows.map((row) => ({
        kpiId: row.kpi_id, definitionVersionId: row.definition_version_id,
        itemRole: row.role as 'primary' | 'supporting', measurementId: row.measurement_id,
        actualValue: row.actual_value === null ? null : Number(row.actual_value),
        unit: row.unit, performanceStatus: row.performance_status as ScorecardSnapshotItemFact['performanceStatus'],
        dataQualityStatus: row.data_quality_status, periodStart: row.period_start, periodEnd: row.period_end,
      }));

      // Step 2: status distribution. 'missing' = no measurement row OR
      // performance_status='neutral' (decision #2) — invariant #6 ("missing
      // is never inferred as zero") honored by keeping both out of the
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
        snapshotId: updatedRow.snapshot_id, scorecardId: updatedRow.scorecard_id, status: 'published',
        contentHash, publishedAt, supersededSnapshotId, items, statusCounts,
      };
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState = {
        snapshot: { snapshotId: result.snapshotId, scorecardId: result.scorecardId,
          status: result.status, contentHash: result.contentHash, statusCounts: result.statusCounts },
      };
      return {
        schemaVersion: 1,
        eventType: 'scorecard.review_published',
        aggregateType: 'kpi_scorecard',
        aggregateId: result.scorecardId,
        organizationId, actorUserId: publishedBy, actorEffectiveRole,
        commandId: randomUUID(), correlationId: correlationId ?? randomUUID(), causationId,
        occurredAt: new Date().toISOString(), policyVersion: '',
        beforeState, afterState, stateHash: computeStateHash(afterState),
        reason, evidenceRefs: [], source: KPI_SCORECARD_EVENT_SOURCE, idempotencyKey,
        expectedVersion, resultingVersion: nextVersion,
        payload: { snapshotId: result.snapshotId, contentHash: result.contentHash, supersededSnapshotId: result.supersededSnapshotId },
      } satisfies AtomicEventInput;
    },
  });
}
```

Add `'scorecard.review_published'` (and `.created`, `.membership_changed`)
to `atomicWrite.ts`'s `EVENT_TYPE_CONSUMER_GROUPS` (`['mywork_projection']`,
same default every other domain uses) — currently absent, same
"documentation gap" pattern as every prior package.

## C) Repository (non-leak, both layers per decision #6)

```ts
// server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts
import type { PoolClient, QueryResultRow } from 'pg';
import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  buildVisibilityScopedCte, wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try { return await fn(client); } finally { client.release(); }
}
async function queryRows<T extends QueryResultRow>(client: PoolClient, sql: string, values: unknown[]): Promise<T[]> {
  return (await client.query<T>(sql, values)).rows;
}

export interface KpiScorecardRow {
  scorecard_id: string; organization_id: string; name: string; description: string | null;
  scope_type: string; scope_id: string | null; owner_user_id: string; review_frequency: string;
  lifecycle_status: 'draft' | 'active' | 'suspended' | 'archived'; row_version: number;
  created_by: string; created_at: string; updated_at: string;
}
function toKpiScorecard(row: KpiScorecardRow) {
  return {
    scorecardId: row.scorecard_id, organizationId: row.organization_id, name: row.name,
    description: row.description, scopeType: row.scope_type, scopeId: row.scope_id,
    ownerUserId: row.owner_user_id, reviewFrequency: row.review_frequency,
    lifecycleStatus: row.lifecycle_status, rowVersion: row.row_version,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export interface ListScorecardsParams {
  userId: string; organizationId: string; lifecycleStatus?: KpiScorecardRow['lifecycle_status'];
  ownerUserId?: string; limit?: number; offset?: number;
}
export async function listScorecards(params: ListScorecardsParams) {
  const { userId, organizationId, lifecycleStatus, ownerUserId, limit = 100, offset = 0 } = params;
  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi_scorecard' });
  const values: unknown[] = [...cte.values];
  const filters: string[] = [];
  if (lifecycleStatus) { values.push(lifecycleStatus); filters.push(`sc.lifecycle_status = $${values.length}`); }
  if (ownerUserId) { values.push(ownerUserId); filters.push(`sc.owner_user_id = $${values.length}`); }
  values.push(limit); const limitParamIndex = values.length;
  values.push(offset); const offsetParamIndex = values.length;
  const baseQuerySql = `
    SELECT sc.* FROM rvn_kpi_scorecards sc
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi_scorecard' AND vr.resource_id = sc.scorecard_id
     WHERE sc.organization_id = $1 ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY sc.updated_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
  const rows = await withReadClient((c) => queryRows<KpiScorecardRow>(c, `${cte.sql}\n${baseQuerySql}`, values));
  return rows.map(toKpiScorecard);
}

export interface ListScorecardItemsParams { userId: string; organizationId: string; scorecardId: string; }
export interface KpiScorecardItemRow {
  item_id: string; scorecard_id: string; kpi_id: string; organization_id: string;
  role: 'primary' | 'supporting'; sort_order: number; display_config: Record<string, unknown> | null;
  added_by: string; added_at: string;
}
function toKpiScorecardItem(row: KpiScorecardItemRow) {
  return { itemId: row.item_id, scorecardId: row.scorecard_id, kpiId: row.kpi_id, role: row.role,
    sortOrder: row.sort_order, displayConfig: row.display_config, addedBy: row.added_by, addedAt: row.added_at };
}
// AC #4: item-level visibility check on resourceType 'kpi', NOT 'kpi_scorecard'
// — scorecard-level visibility never implies per-item KPI visibility (plan:
// "Scorecard visibility cannot broaden a more restrictive KPI policy").
export async function listScorecardItems(params: ListScorecardItemsParams) {
  const { userId, organizationId, scorecardId } = params;
  const baseQuerySql = `
    SELECT si.* FROM rvn_kpi_scorecard_items si
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi' AND vr.resource_id = si.kpi_id
     WHERE si.organization_id = $1 AND si.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY si.sort_order ASC`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: 'kpi' });
  const values = [...wrapped.values, scorecardId];
  const rows = await withReadClient((c) => queryRows<KpiScorecardItemRow>(c, wrapped.sql, values));
  return rows.map(toKpiScorecardItem);
}

/**
 * AC #4 non-leak status distribution — filter BEFORE aggregate (decision #6a
 * pattern applied to the live/unpublished view, mirroring publishReviewSnapshot's
 * own filter for the frozen view).
 */
export interface GetScorecardStatusDistributionParams {
  userId: string; organizationId: string; scorecardId: string; asOf?: string;
}
export interface ScorecardStatusDistribution {
  safe: number; warning: number; critical: number; missing: number; totalVisible: number;
}
export async function getScorecardStatusDistribution(
  params: GetScorecardStatusDistributionParams
): Promise<ScorecardStatusDistribution> {
  const { userId, organizationId, scorecardId, asOf } = params;
  const asOfTimestamp = asOf ?? new Date().toISOString();
  const baseQuerySql = `
    SELECT
        COUNT(*) FILTER (WHERE latest.performance_status = 'on_target') AS safe_count,
        COUNT(*) FILTER (WHERE latest.performance_status = 'warning')   AS warning_count,
        COUNT(*) FILTER (WHERE latest.performance_status = 'critical')  AS critical_count,
        COUNT(*) FILTER (WHERE latest.performance_status IS NULL OR latest.performance_status = 'neutral') AS missing_count,
        COUNT(*) AS total_count
      FROM rvn_kpi_scorecard_items si
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi' AND vr.resource_id = si.kpi_id
      LEFT JOIN LATERAL (
        SELECT m.performance_status FROM rvn_kpi_measurements m
         WHERE m.kpi_id = si.kpi_id AND m.period_end <= $${VISIBILITY_CTE_PARAM_COUNT + 2}
           AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer WHERE newer.correction_of_measurement_id = m.measurement_id)
         ORDER BY m.period_end DESC, m.recorded_at DESC LIMIT 1
      ) latest ON true
     WHERE si.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1} AND si.organization_id = $1`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: 'kpi' });
  const values = [...wrapped.values, scorecardId, asOfTimestamp];
  const rows = await withReadClient((c) => queryRows<{
    safe_count: string; warning_count: string; critical_count: string; missing_count: string; total_count: string;
  }>(c, wrapped.sql, values));
  const row = rows[0];
  if (!row) return { safe: 0, warning: 0, critical: 0, missing: 0, totalVisible: 0 };
  return { safe: Number(row.safe_count), warning: Number(row.warning_count), critical: Number(row.critical_count),
    missing: Number(row.missing_count), totalVisible: Number(row.total_count) };
}

/**
 * DECISION #6b (Integration Owner resolution, THE critical correctness
 * addition over both draft passes): a published snapshot's frozen
 * `snapshot_payload.items` MUST be re-filtered to the REQUESTING reader's
 * currently-visible KPI set before being returned — the stored row and its
 * content_hash are untouched (integrity of the archival record is
 * preserved), but the served response strips items the caller cannot
 * currently see. Compute the reader's visible kpi_id set the same way
 * listScorecardItems does (buildVisibilityScopedCte resourceType='kpi'),
 * intersect with `snapshot_payload.items[].kpiId`, and recompute
 * statusCounts from the FILTERED item list for the response (never
 * recompute/rewrite the stored row's own counts).
 */
export interface GetPublishedSnapshotParams { userId: string; organizationId: string; scorecardId: string; }
export async function getPublishedSnapshot(params: GetPublishedSnapshotParams) {
  const { userId, organizationId, scorecardId } = params;
  const baseQuerySql = `
    SELECT rs.* FROM rvn_kpi_scorecard_review_snapshots rs
      INNER JOIN rvn_kpi_scorecards sc ON sc.scorecard_id = rs.scorecard_id
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = 'kpi_scorecard' AND vr.resource_id = sc.scorecard_id
     WHERE rs.organization_id = $1 AND rs.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1} AND rs.status = 'published'`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: 'kpi_scorecard' });
  const values = [...wrapped.values, scorecardId];
  const rows = await withReadClient((c) => queryRows<{
    snapshot_id: string; snapshot_payload: { items: { kpiId: string }[]; statusCounts: unknown } | null;
  }>(c, wrapped.sql, values));
  const row = rows[0];
  if (!row || !row.snapshot_payload) return row ?? null;

  // Decision #6b: re-derive the reader's visible kpi_id set, filter, recompute.
  const visibleItemsCte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const visibleIdsResult = await withReadClient((c) =>
    queryRows<{ resource_id: string }>(c,
      `${visibleItemsCte.sql}\nSELECT resource_id FROM rvn_visible_resources WHERE resource_type = 'kpi'`,
      visibleItemsCte.values)
  );
  const visibleKpiIds = new Set(visibleIdsResult.map((r) => r.resource_id));
  const filteredItems = (row.snapshot_payload.items ?? []).filter((item) => visibleKpiIds.has(item.kpiId));
  const filteredCounts = { safe: 0, warning: 0, critical: 0, missing: 0 };
  for (const item of filteredItems as unknown as { performanceStatus: string | null }[]) {
    if (item.performanceStatus === 'on_target') filteredCounts.safe += 1;
    else if (item.performanceStatus === 'warning') filteredCounts.warning += 1;
    else if (item.performanceStatus === 'critical') filteredCounts.critical += 1;
    else filteredCounts.missing += 1;
  }
  return { ...row, snapshot_payload: { items: filteredItems, statusCounts: filteredCounts } };
}

// listReviewSnapshots (history, summary rows only — no payload, decision
// #6b's redaction is irrelevant here since content_hash/status/dates leak
// nothing item-level) follows the same scorecard-level visibility pattern
// as listScorecards — implement analogously, ORDER BY review_period_end
// DESC, created_at DESC.
```

## C.3) Scorecard Tool — 7 sections → query/endpoint mapping

| # | Section (plan §6.7) | Fed by | Notes |
|---|---|---|---|
| 1 | Current review | `getScorecard` + `getScorecardStatusDistribution` (live) + `listReviewSnapshots({status:'draft', limit:1})` | |
| 2 | KPI list | `listScorecardItems` | per-item visibility already applied |
| 3 | Attention and deviations | `listScorecardItems` + **out of scope for this package**: `kpiDeviationRepository.listDeviationCases` needs a `kpiIds: string[]` variant (today single `kpiId`) — small follow-up, not built here |
| 4 | Review notes and decisions | frozen `snapshot_payload` fields; Decisions linkage **not built** (Decisions domain has no `scorecard_id`/`context_type` column yet — future) | |
| 5 | Published snapshots | `getPublishedSnapshot` (decision #6b applied) | |
| 6 | Membership and display settings | `listScorecardItems` (read) + `addScorecardItem`/`removeScorecardItem`/`reorderScorecardItems` (write, decision #8) | |
| 7 | History | `listReviewSnapshots()` + `rvn_platform_events WHERE aggregate_type='kpi_scorecard' AND aggregate_id=scorecardId` (existing table, no new query) | |

## D) Files to create

| File | Notes |
|---|---|
| Edit `platform/resourceTypes.ts` + `myWorkRoofPackage.ts` | Prerequisite — append `'kpi_scorecard'` |
| `server/migrations/20260812_rvn_kpi_scorecards.sql` | §A |
| `server/src/services/resultsVnext/kpi/kpiScorecardTypes.ts` | Row/DTO types |
| `server/src/services/resultsVnext/kpi/kpiScorecardCommands.ts` | `createScorecard`, `addScorecardItem`, `removeScorecardItem`, `reorderScorecardItems`, `activateScorecard`, `suspendScorecard`, `archiveScorecard`, `createReviewSnapshot`, `publishReviewSnapshot` (full example above) |
| `server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts` | §C, both non-leak layers |
| Edit `atomicWrite.ts` | `EVENT_TYPE_CONSUMER_GROUPS` entries for `scorecard.*` |
| Tests | Unit (CAS, self-consistency of counts, close-without-verification-style guards), realDB: publish-supersede-atomicity under two-connection race, non-leak (§6a AND §6b both — a restricted KPI must be absent from both the live distribution and a published snapshot served to an unauthorized reader, even though it's present in the stored row for an authorized one) |

Not in this package: `server/src/routes/resultsVnext/kpiScorecard.routes.ts` (HTTP layer, next package).
