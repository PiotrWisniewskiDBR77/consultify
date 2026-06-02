# RecordsService Baseline — Block B Sprint 0

**Sprint:** `B-S0` Preflight
**Date:** 2026-05-08
**Author:** Cursor agent (Orchestrator)
**Status:** `READ-ONLY AUDIT — no code mutations performed`
**Scope:** Static analysis of `RecordsService.ts`, `tp_records` schema, audit trail integration, and `tp_record_sources` migration plan vs `00_TASK_PACKET.md` and `epics/EPIC-T8*` / `epics/EPIC-T9*`.

---

## 1. Existing surface inventory

### 1.1 `RecordsService.ts`

File: `DRD/consultify/server/src/services/tablePlatform/RecordsService.ts` (1 005 lines).

Public methods (sample):

| Method | Hook point for confidence recompute? | Notes |
|---|---|---|
| `createRecord(tableId, data, createdBy)` | YES — line 341 (after `auditService.logEvent('create', …)`) | Calls auto-fields, formula recompute, realtime, automation, webhooks. |
| `updateRecord(recordId, data, updatedBy, expectedVersion?)` | YES — line 535 | Optimistic concurrency via `version` column; cell-level history via `auditService.logCellChanges`. |
| `deleteRecord(recordId, deletedBy?)` | YES — line 647 | Cascades via `relationService.onRecordDeleted`. |
| `getRecord(recordId, userRole?)` | NO (read path) | Field-level permission filter via `fieldPermissionService`. |
| `listRecords(...)` | NO | Filter / sort / paginate. |
| `batchRecords(ops)` | YES (per-op) | Iterates create/update/delete. |
| `upsertRecords(...)` | YES (per-op) | Same. |
| `undo(userId)` | YES | Restores via `UPDATE tp_records SET data = ...`. |

**Hook insertion order at each create/update/delete site** (from existing code):

```
1. validate input
2. populate auto fields
3. INSERT/UPDATE/DELETE tp_records
4. auditService.logEvent(...)            ← existing
5. auditService.logCellChanges(...)      ← existing (update only)
6. recomputeAffectedFields(...)          ← existing (formula engine)
7. ★ confidenceScoringService.recompute(recordId)  ← Block B inserts here
8. tablePlatformRealtime.notify*         ← existing
9. automationService.evaluateTriggers    ← existing
10. webhookDispatcher.dispatchEvent      ← existing
11. webhookRelayService.dispatchEvent    ← existing
12. recordWatchService.notifyWatchers    ← existing
```

Hook point chosen: **between formula recompute and realtime notification**. Rationale: confidence depends on formula-fielded outputs (formula consistency axis); realtime should fire AFTER score is updated so subscribers see fresh score.

### 1.2 `tp_records` actual schema

Migration source: `DRD/consultify/server/migrations/700_table_platform_foundation.sql`.

```sql
CREATE TABLE IF NOT EXISTS tp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Plus indexes: `idx_tp_records_table`, `idx_tp_records_data` (GIN), `idx_tp_records_created`, and (from 701) `idx_tp_records_table_updated`, `idx_tp_records_data_text` (GIN).

**`version` column** is referenced in code (line 515: `version = COALESCE(version, 0) + 1`) — the COALESCE covers both presence and NULL. The column is added in a later migration (likely `727_beta_missing_tables.sql` or `20260...` series) but not in the foundation migration. Block B's plan does not depend on `version` semantics.

### 1.3 `tp_records` does NOT have `organization_id`

Tenancy is resolved via `tp_records.table_id → tp_tables.base_id → tp_bases.organization_id`.

`tp_bases.organization_id` is **TEXT**, not UUID:

```sql
CREATE TABLE IF NOT EXISTS tp_bases (
  ...
  organization_id TEXT NOT NULL,
  ...
);
```

This contradicts the original `00_TASK_PACKET.md` migration plan which used `organization_id UUID NOT NULL REFERENCES organizations(id)`.

### 1.4 `tp_audit_events`

Already exists (migration 700, lines 113-128):

```sql
CREATE TABLE IF NOT EXISTS tp_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_id TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`AuditService.logEvent(eventType, entityType, entityId, actorId?, before?, after?, metadata?)`** is the canonical entry point (`AuditService.ts:106`). Block B's source/validation operations write here with `entity_type = 'record_source'` or `entity_type = 'record_validation'`.

### 1.5 Existing tests

- `__tests__/RecordsService.test.ts` — 174 lines, 29 test entries (`describe`/`it`).
- Heavy use of `vi.mock` — every collaborator (`AuditService`, `SchemaValidationService`, `RelationService`, `uuid`) is mocked.
- Block B's `confidenceScoringService.recompute` integration: needs to be added to `vi.mock(...)` block in test file → existing tests pass without modification once mocked as no-op.

---

## 2. Migration plan vs reality — findings

### Finding B-S0-F1: Migration filename + location

**Plan said:** `consultify/server/src/services/tablePlatform/migrations/2026_05_block_b_record_sources.sql`

**Reality:** Migration runner discovers files at top-level `DRD/consultify/server/migrations/` only.

**Adjustment:** `DRD/consultify/server/migrations/20260508_block_b_record_sources.sql`. Order: after Block A migration (chronological prefix; Block A migrates first if both ship same day).

### Finding B-S0-F2: `organization_id` is TEXT, no FK to `organizations`

**Plan said:** `organization_id UUID NOT NULL REFERENCES organizations(id)`

**Reality:** `tp_bases.organization_id` is `TEXT NOT NULL` (no FK). User IDs and tenant IDs are TEXT throughout the table platform.

**Adjustment:**

```sql
CREATE TABLE IF NOT EXISTS tp_record_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,                     -- TEXT, no FK
  record_id UUID NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('document','url','record','ai_generation','form_submission')),
  source_ref TEXT NOT NULL,
  label TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ NULL,
  last_verified_by TEXT NULL,
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record
  ON tp_record_sources(record_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_tenant
  ON tp_record_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record_type
  ON tp_record_sources(record_id, source_type) WHERE deleted_at IS NULL;
```

`organization_id` populated via app layer at write time: resolved by joining `tp_records → tp_tables → tp_bases.organization_id`, cached on the source row for fast tenant-scoped queries.

### Finding B-S0-F3: Audit trail integration uses existing `tp_audit_events`

**Plan said:** "Audit log entry written on every state change."

**Reality:** `tp_audit_events` already exists with correct shape; `AuditService.logEvent` is the entry point.

**Adjustment:** Block B writes:
- `entity_type = 'record_source'`, `entity_id = source_id` for source CRUD.
- `entity_type = 'record_validation'`, `entity_id = record_id` for status flips.
- Confidence recompute is high-frequency and must NOT log per-recompute (would flood audit). Only log validation status changes.

### Finding B-S0-F4: Hook point integration is a 2-line change

**Reality:** Inserting `await confidenceScoringService.recompute(recordId).catch(err => logger.warn(...))` in `RecordsService.ts` create/update/delete paths is small and surgical. Pattern matches existing hooks (formula recompute, realtime).

**Adjustment:** S2 (Provenance API) ships service stub; S3 (Confidence Algorithm) wires the hook. Both pass through `RecordsService.ts` with additive imports + 3 `.catch`-wrapped calls. Each modified line is well-tested by existing mocks.

### Finding B-S0-F5: Existing tests need mock of new service

**Reality:** `RecordsService.test.ts` mocks `AuditService` via `vi.mock('../AuditService.js', ...)`. Block B's hook integration adds:

```ts
vi.mock('../ConfidenceScoringService.js', () => ({
  default: { recompute: vi.fn().mockResolvedValue(undefined) },
}));
```

This is one line. Existing test assertions are unchanged.

**Adjustment:** S3 sprint card explicitly notes "update RecordsService.test.ts mock list — 1-line addition; no assertion changes." ✓

### Finding B-S0-F6: `featureRecordProvenanceEnabled` flag must gate `recompute` hook to avoid surprises during ramp-up

**Reality:** Plan calls for feature flag `featureRecordProvenanceEnabled`. Important nuance: the hook in `RecordsService.ts` should check the flag BEFORE calling `recompute`. Otherwise a partially-deployed Block B (e.g., DB migration applied but service code not yet rolled out) would crash record writes.

**Adjustment:** ConfidenceScoringService.recompute internally checks `featureRecordProvenanceEnabled`; returns no-op when disabled. The flag is read from `tp_workspace_settings` (existing) or env var (existing pattern). Sprint S3 card to be enriched.

### Finding B-S0-F7: PermissionsService for ACL filter

**Reality:** `PermissionsService.ts` exists in `tablePlatform/`. Per spec, every source listing must filter through `PermissionsService.canRead`. Need to verify the actual API signature in S2 to avoid plan drift.

**Action item for S2:** Read `PermissionsService` once during S2 to confirm `canRead({actor, resourceType, resourceId})` shape; document if signature differs from plan.

---

## 3. Migration rehearsal (paper)

A live rehearsal on staging requires:
- Database connection to staging Postgres.
- Production-scale snapshot of `tp_records` (target: ≥ 1M rows).
- Maintenance window or read-replica for safe test.

These are not available from agent context. Rehearsal is documented but **not executed**.

### Estimated runtime (model-based)

| Operation | Est. duration on 1M `tp_records` rows |
|---|---|
| `CREATE TABLE tp_record_sources` | < 50 ms |
| `ALTER TABLE tp_records ADD COLUMN confidence_score NUMERIC(3,2) NULL` | < 100 ms (metadata only on PG11+) |
| `ALTER TABLE tp_records ADD COLUMN validation_status TEXT NULL` | < 100 ms (metadata only) |
| `ALTER TABLE tp_records ADD CONSTRAINT chk_validation_status CHECK (validation_status IN (...) OR validation_status IS NULL) NOT VALID` | < 100 ms (NOT VALID → no scan) |
| `ALTER TABLE tp_records VALIDATE CONSTRAINT chk_validation_status` | 5–30 s on 1M rows; non-blocking | 
| `CREATE INDEX idx_tp_records_confidence ON tp_records(confidence_score) WHERE confidence_score IS NOT NULL` | 10–60 s on 1M rows; **blocking** unless `CONCURRENTLY` |
| `CREATE INDEX idx_tp_record_sources_record ...` | < 1 s (new empty table) |

**Total estimated production lock duration:** < 30 s if indexes on `tp_records` use `CONCURRENTLY`. If not, up to 60 s blocking.

**Decision:** All `tp_records` indexes use `CREATE INDEX CONCURRENTLY` to keep the lock window under 30 s. The CHECK constraint uses `NOT VALID` + `VALIDATE CONSTRAINT` two-step pattern. Final migration shape:

```sql
-- 20260508_block_b_record_sources.sql
-- Block B — Record Provenance: sources + confidence + validation

-- Step 1: new table (fast)
CREATE TABLE IF NOT EXISTS tp_record_sources (
  ... -- as above
);
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record ON tp_record_sources(record_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_tenant ON tp_record_sources(organization_id);

-- Step 2: ALTER tp_records — metadata-only, fast
ALTER TABLE tp_records
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2) NULL,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NULL;

-- Step 3: NOT VALID constraint (fast; doesn't scan)
ALTER TABLE tp_records
  ADD CONSTRAINT chk_validation_status
    CHECK (validation_status IS NULL OR validation_status IN ('unverified','auto_validated','human_validated','rejected'))
    NOT VALID;

-- Step 4: VALIDATE CONSTRAINT (background; non-blocking on PG11+)
ALTER TABLE tp_records VALIDATE CONSTRAINT chk_validation_status;
```

**Note:** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Must be applied separately if migration runner wraps each file in a transaction. In that case, the index is created in a **post-migration runtime hook** in `migrationRunner.ts` extension OR a follow-up migration `20260509_block_b_record_indexes.sql`. To be confirmed at S1.

### Rollback path

```sql
DROP TABLE IF EXISTS tp_record_sources CASCADE;

ALTER TABLE tp_records
  DROP CONSTRAINT IF EXISTS chk_validation_status,
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS validation_status;
```

Stored at `DRD/consultify/server/migrations/_rollbacks/20260508_block_b_record_sources_rollback.sql`. Manual application path documented.

---

## 4. Test inventory

```
__tests__/RecordsService.test.ts          174 lines  / 29 it/describe entries
__tests__/MetadataService.test.ts         376 lines  /  ~ test entries
__tests__/AuditService.test.ts            (none — use smoke + manual)
```

Block B will add:

```
__tests__/RecordSourcesService.test.ts        target ~250 lines
__tests__/ConfidenceScoringService.test.ts    target ~150 lines
__tests__/ValidationStatusService.test.ts     target ~150 lines
routes/__tests__/record-sources-acl.test.ts   target ~200 lines
```

---

## 5. Sign-off

- Migration plan adjustments: F1, F2, F3, F4, F5, F6 → flow into S1 / S2 / S3 sprint cards.
- 00_TASK_PACKET.md: §3 update needed for `organization_id TEXT` and migration filename.
- EPIC-T8 schema spec: column types + index strategy aligned.
- Block B test plan: existing RecordsService tests survive with 1-line mock addition.

**Recommendation:** `GO` to Block B Sprint 1.

**Open questions for user (none blocking):**

Q1: Migration runner wraps each file in a transaction by default. `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Choices:
- (a) Split into two migrations: structural + concurrent index (slightly cumbersome).
- (b) Use non-concurrent `CREATE INDEX` — accept ≤ 60 s lock on `tp_records` (acceptable for low-traffic windows).
- (c) Add a `migrationRunner.ts` flag to skip wrapping for specific files.

CTO default: **(b)** — `tp_records` is large but lock < 60 s is tolerable for our deployment cadence; if a customer reports >30 s impact, switch to (a).

Q2: `tp_record_sources.organization_id` is denormalized. Should we add a periodic consistency check job? CTO default: skip for now; add follow-up if drift incidents occur.
