-- 932_canonical_inbox_items_source_status_initiative.sql
--
-- MW-CORE-001 golden flow (Inbox/Task, 2026-08-01): `canonical_inbox_items`
-- only ever copied `title/description/priority/section/sla_deadline` from the
-- source Task/Decision at materialization time. The materialization query in
-- `inboxService.ts` already fetches `t.initiative_id`/`d.initiative_id` (and
-- `t.status`/`d.status`) and discards them — the frontend correctly refused to
-- fabricate a "source status" / "initiative context" field client-side rather
-- than invent data the server never persisted.
--
-- ── WHY TWO NEW COLUMNS, NOT A LIVE JOIN ────────────────────────────────────
-- The read path is a single `SELECT * FROM canonical_inbox_items` (no join
-- back to `tasks`/`decisions`), and a join would have to branch per
-- `source_entity_type` anyway (task vs decision vs notification each has a
-- different source table, and notifications have no status/initiative concept
-- at all). Copy-at-upsert-time matches the existing pattern already used for
-- title/description — kept in sync via `ON CONFLICT ... DO UPDATE` on every
-- materialization run, not a point-in-time snapshot that goes stale silently.
--
-- `source_status` is the SOURCE entity's (task/decision) status at last
-- materialization — explicitly NOT the same thing as this table's own
-- `status` column, which is the INBOX ITEM's triage lifecycle
-- (pending/triaged/delegated/resolved/snoozed). The two must never be
-- conflated; `inboxService.ts`'s `CanonicalInboxItem` interface documents
-- this distinction inline.
--
-- ── SAFETY ───────────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS, no DEFAULT, no backfill/rewrite. NULL for every
-- existing row — additive, zero behavior change until the service code
-- (already updated in this same change) starts populating them going forward.
-- Partial index on initiative_id only indexes the rows that actually carry
-- one (tasks/decisions), skipping the notification-sourced rows that are
-- always NULL here — smaller index, no cost for the majority-null column.
--
-- ★ NOT YET RUN on any database (demo/prod) — to be applied by the main
--   session supervisor per the `consultify-promocja-demo` skill.

ALTER TABLE canonical_inbox_items
    ADD COLUMN IF NOT EXISTS source_status TEXT;

ALTER TABLE canonical_inbox_items
    ADD COLUMN IF NOT EXISTS initiative_id TEXT;

COMMENT ON COLUMN canonical_inbox_items.source_status IS
    'Status of the SOURCE task/decision at last materialization — distinct from this row''s own triage status. NULL for notification-sourced items and for rows materialized before this column existed.';

COMMENT ON COLUMN canonical_inbox_items.initiative_id IS
    'initiative_id of the SOURCE task/decision at last materialization. NULL for notification-sourced items and for rows materialized before this column existed.';

CREATE INDEX IF NOT EXISTS canonical_inbox_items_initiative_id_idx
    ON canonical_inbox_items (initiative_id)
    WHERE initiative_id IS NOT NULL;
