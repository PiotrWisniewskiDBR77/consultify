-- MAT-010 durable lineage outbox (2026-08-02, Codex review blocker 2).
--
-- ── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
-- `recordLineageEventSafe()` was fail-OPEN: it caught any error, logged a
-- warning, and let the owning business operation (mint a share, save a
-- version, export a deck) return success anyway. A transient Postgres blip
-- therefore destroyed the lineage event FOREVER, with no durable trace that
-- one was ever supposed to exist — which defeats the entire premise of a
-- "durable canonical receipt". Logs are not a source of truth.
--
-- This table is that missing durable trace: when the direct lineage write
-- fails, the intent is persisted here and later replayed by
-- `reconcilePendingLineageEvents()`.
--
-- ── WHY AN OUTBOX AND NOT A SHARED TRANSACTION ────────────────────────────
-- The ideal is for the business write and the lineage write to share one
-- transaction (atomic by construction). Verified against the actual code, not
-- assumed: of all the lineage hook sites in the three frozen route files,
-- exactly ONE sits in a route that opens a real transaction at all
-- (`POST /api/workbook/:id/versions/:versionId/restore`, which uses
-- `withPgTransaction` — grep `withPgTransaction` across
-- workbook/presentations/document-studio routes: three hits, all in that one
-- workbook route). Every other hook site's business write is pool-autocommit
-- (`queryHelpers.queryRun` / `dbRun`) and is ALREADY COMMITTED by the time
-- lineage is attempted, so there is no transaction left to join.
--
-- Enrolling lineage into that single restore transaction was considered and
-- deliberately REJECTED: it would make a lineage-write failure roll back a
-- frozen, already-approved MAT-006 restore, i.e. a lineage concern breaking a
-- business operation. That is precisely the regression the package boundary
-- forbids ("only additive lineage-recording hooks"). One uniform durability
-- mechanism across all hook sites is also far easier to reason about and test
-- than two. See the MAT-010 report for the full statement of this trade-off.
--
-- ── FRESH-DB GUARD (migration-ordering trap) ──────────────────────────────
-- `migrate.postgres.ts` applies migrations in plain FILENAME STRING sort
-- order, not chronological order ('2' < '7', so every `2026*` file runs before
-- every 3-digit `7xx/8xx/9xx` file on a from-zero replay). This file is IMMUNE
-- by construction: it creates ONE new table and declares NO foreign keys, so
-- it depends on nothing having run before it — not even the companion
-- `20260802_mat010_artifact_lineage.sql` (which sorts earlier anyway:
-- '20260802_mat010_a...' < '20260802_mat010_l...'). Proven by an actual
-- `migrate.postgres.ts --safe` run against a DROP'd + re-CREATE'd empty
-- database, not by assumption.
--
-- Every statement is IF NOT EXISTS / DROP-then-ADD, so re-running is a no-op.

CREATE TABLE IF NOT EXISTS artifact_lineage_pending_events (
  pending_id          TEXT PRIMARY KEY,
  -- Everything needed to reconstruct the ORIGINAL `recordLineageEvent` call.
  organization_id     TEXT NOT NULL,
  artifact_kind       TEXT NOT NULL,
  source_record_id    TEXT NOT NULL,
  event_type          TEXT NOT NULL,
  actor_user_id       TEXT,
  title_snapshot      TEXT,
  source_context_json TEXT,
  detail_json         TEXT,
  -- STABLE idempotency key, computed ONCE from the pending row's own fields
  -- (kind | source id | event type | detail | occurred_at) and stored here.
  -- Deterministic and reconstructable, never random: replaying the same
  -- pending row always presents the same key, so the existing
  -- `idx_artifact_lineage_event_idem` unique index + pre-insert lookup in
  -- `recordLineageEvent` converge on ONE event instead of piling up
  -- duplicates across repeated reconciliation runs. Folding `occurred_at`
  -- into the key is what keeps two genuinely DISTINCT occurrences of the same
  -- logical event (e.g. two xlsx exports of the same workbook) from
  -- collapsing into one.
  idempotency_key     TEXT NOT NULL,
  -- The time the BUSINESS operation actually happened, not the time the
  -- replay ran, so a reconciled event lands in the lineage at its true
  -- position rather than being back-dated to the recovery window.
  occurred_at         TIMESTAMP NOT NULL,
  -- 'pending' -> 'consumed'. Consumed rows are KEPT, never deleted: they are
  -- the audit trail of "this event needed reconciliation", which is itself
  -- operationally meaningful.
  status              TEXT NOT NULL DEFAULT 'pending',
  attempts            INTEGER NOT NULL DEFAULT 0,
  last_error          TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at         TIMESTAMP
);

-- Makes repeated failures of the SAME logical event converge on ONE pending
-- row rather than accumulating a backlog of identical retry intents. Paired
-- with `INSERT ... ON CONFLICT DO NOTHING` in the service — never with a
-- caught constraint error, because `DbPromise.run()` silently swallows those
-- (root cause of the 180 orphaned rows documented at
-- artifactRegistryService.ts:1275).
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_lineage_pending_idem
  ON artifact_lineage_pending_events(organization_id, idempotency_key);

-- The reconciliation scan: oldest outstanding intents first.
CREATE INDEX IF NOT EXISTS idx_artifact_lineage_pending_open
  ON artifact_lineage_pending_events(status, created_at)
  WHERE status = 'pending';

ALTER TABLE artifact_lineage_pending_events
  DROP CONSTRAINT IF EXISTS artifact_lineage_pending_status_check;
ALTER TABLE artifact_lineage_pending_events
  ADD CONSTRAINT artifact_lineage_pending_status_check
  CHECK (status IN ('pending', 'consumed'));

ALTER TABLE artifact_lineage_pending_events
  DROP CONSTRAINT IF EXISTS artifact_lineage_pending_kind_check;
ALTER TABLE artifact_lineage_pending_events
  ADD CONSTRAINT artifact_lineage_pending_kind_check
  CHECK (artifact_kind IN ('document', 'workbook', 'presentation'));
