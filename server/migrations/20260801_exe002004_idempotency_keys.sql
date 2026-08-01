-- EXE-02/03/04 execution management spine — idempotent-retry support for
-- initiative-scoped creation endpoints: milestones, resources, RAID items,
-- tasks. A client-supplied `idempotencyKey` on the POST body lets a retried
-- request (network drop, double-click, at-least-once queue) return the
-- original row instead of inserting a duplicate.
--
-- Uniqueness is scoped per initiative_id (not global) so two unrelated
-- initiatives can each reuse a simple client-generated key without collision.
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB):
-- only ADD COLUMN IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.

ALTER TABLE initiative_milestones ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE initiative_resources ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE raid_items ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_milestones_idempotency
  ON initiative_milestones(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_initiative_resources_idempotency
  ON initiative_resources(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_raid_items_idempotency
  ON raid_items(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_idempotency
  ON tasks(initiative_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
