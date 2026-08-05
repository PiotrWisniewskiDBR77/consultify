-- M01-P07C (finding M01-033) — durable receipt for atomic Idea materialization.
--
-- `server/src/services/canvasMaterialize.ts::materializeWorkspaceTarget`'s
-- `idea` branch writes `my_ideas` + `my_idea_maps` + this receipt row inside
-- ONE pinned PostgreSQL transaction (`withPgTransaction`), so an idea, its
-- Mind Map, and a durable, read-back-confirmed proof that the write reached
-- a committed, verified state (`status = 'completed'`) either all land
-- together or none do. This table is that receipt. It is also the
-- idempotency ledger for the `proposal_approval` writer
-- (`workCanvasService.ts::createCanvasIdea`, keyed by `proposal.id`): a
-- retry with the same `(organization_id, idempotency_key)` finds its row
-- here and replays the already-materialized idea/map instead of creating a
-- second one, and two concurrent attempts with the same key resolve to
-- exactly one winner via the partial unique index below.
--
-- FIX (P07C review, one point): this table was previously created lazily at
-- runtime (`CREATE TABLE IF NOT EXISTS` inside canvasMaterialize.ts, on
-- first idea materialization) — invisible to schema-parity tooling, a
-- competing-authority risk against a future migration, and an
-- undocumented DDL write against a live database outside migration
-- history. Moved here; `canvasMaterialize.ts` now only reads/writes rows
-- and asserts the table/indexes exist (see its own comment for how it
-- fails when they don't — no runtime DDL fallback).
--
-- No FK to `my_ideas`/`my_idea_maps`: this is Canvas-materializer-owned
-- provenance, not a My Work (M02) owner object, and materialization already
-- writes idea+map+receipt atomically in one transaction, so referential
-- integrity is guaranteed by the transaction boundary, not a DB-level FK —
-- matching M01-021's `work_canvas_ideas` (Canvas-side lineage table, no FK
-- either) rather than `my_idea_maps`' FK to `my_ideas` (a genuine
-- cross-lifecycle relationship this one isn't).
--
-- Idempotent and safe to replay against a database that already has rows
-- from the (now-removed) runtime-created version of this table — same
-- column set, `IF NOT EXISTS` throughout.
CREATE TABLE IF NOT EXISTS canvas_idea_materialization_receipts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  idea_id TEXT NOT NULL,
  map_id TEXT NOT NULL,
  source_draft_id TEXT,
  writer TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: only rows WITH a caller-supplied idempotency key
-- participate in dedup/conflict detection. Calls that omit it (e.g.
-- /save-to-workspace, by design — see CanvasMaterializeInput's
-- `idempotencyKey` doc in canvasMaterialize.ts) never collide with one
-- another. `canvasMaterialize.ts` checks for THIS exact index by name
-- (`isUniqueViolationOn(err, 'idx_canvas_idea_receipts_org_idem')`) to
-- distinguish "a concurrent winner already claimed this key" from any other
-- constraint violation — the name below MUST stay in sync with that check.
CREATE UNIQUE INDEX IF NOT EXISTS idx_canvas_idea_receipts_org_idem
  ON canvas_idea_materialization_receipts (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_canvas_idea_receipts_idea_id
  ON canvas_idea_materialization_receipts (idea_id);
