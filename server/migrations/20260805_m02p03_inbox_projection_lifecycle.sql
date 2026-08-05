-- Migration: 20260805_m02p03_inbox_projection_lifecycle.sql
-- M02-P03 (finding M02-002) — canonical_inbox_items lifecycle correctness.
--
-- ROOT CAUSE (verified, not guessed — see M02-P03_RETURN.md for the local
-- Postgres probe that reproduced this before writing a single line of fix):
-- --------------------------------------------------------------------------
-- `canonical_inbox_items` is a PROJECTION of a source object (task /
-- decision / notification). `inboxService.materializeInboxItems()` only ever
-- INSERTs/UPSERTs rows for sources that are CURRENTLY eligible:
--
--     tasks         ... WHERE status NOT IN ('done','completed','validated')
--     decisions     ... WHERE status IN ('pending','escalated')
--     notifications ... WHERE read = 0
--
-- Nothing ever retires a projection once its source stops being eligible —
-- the row simply drops out of the next materialization query and is never
-- revisited again. Its `status` column, set to 'pending' at INSERT time,
-- never changes on its own. This is a ONE-WAY, INSERT-ONLY pipeline with no
-- corresponding retirement path, so the `pending` bucket is monotonically
-- non-decreasing except for whatever a user manually triages by hand through
-- the Inbox UI itself. On live demo (measured 2026-08-05, read-only,
-- untouched by this packet) this is 704 of 706 rows — i.e. the backlog is
-- exactly the accumulated exhaust of this leak across every user who ever
-- opened Inbox, not a single incident.
--
-- Ported from the unmerged `codex/m02-mywork-core-20260804` candidate
-- (`20260805_m02a_inbox_projection_lifecycle.sql`, tasks+decisions only) per
-- `M02_INTEGRATION_MAP.md`'s `INTEGRATE_EXACT_COMMITS` recommendation for the
-- non-hub-touching Inbox fix, and EXTENDED here to also cover notifications
-- (same leak class, same read=0->1 transition pattern, not covered by the
-- candidate) — see the `notifications` section below.
--
-- WHY A TRIGGER AND NOT SERVICE CODE
-- -----------------------------------
-- There are multiple independent live write paths for `tasks` status changes
-- and deletes (TaskController, TaskService, my-work.routes personal-task
-- delete, InterviewAssignmentService, InterviewController, health-probe
-- seeding), several for `decisions`, and several for `notifications` (read,
-- bulk-mark-read, single mark-read). Patching each call site individually
-- leaves the invariant bypassable by the next one. A trigger is the only
-- construct every writer passes through regardless of caller.
--
-- SEMANTICS
-- ---------
-- Retire, do not delete: the projection moves to `resolved` with
-- `resolved_at` set and a tombstone recorded in `metadata_json`
-- (`mwLifecycle` = source_deleted | source_archived). This preserves the
-- audit trail and is reversible, unlike a DELETE — see the companion
-- `materializeInboxItems` reopen logic (server/src/services/inboxService.ts)
-- which clears ONLY a system tombstone, never a user's own resolve.
--
-- Tenancy: every UPDATE is additionally constrained by
-- `organization_id = <source row's own org>` (or, for notifications where
-- `organization_id` may legitimately be NULL, by `user_id` — see below), so a
-- trigger can never touch another tenant's/user's row even in the impossible
-- case of an id collision.
--
-- Idempotency: the guard `status IS DISTINCT FROM 'resolved'` makes
-- re-firing a no-op, so delete -> recreate -> delete, or repeated status
-- flips, converge without duplicate work.
--
-- Additive and safe to re-run: CREATE OR REPLACE / DROP TRIGGER IF EXISTS.
-- Changes NO existing row on its own — it only acts on FUTURE task/decision/
-- notification writes. The historical backlog (704 pending rows measured
-- live 2026-08-05) is NOT touched by this migration; retiring/backfilling
-- those rows is the separate, still-unauthorized cleanup owned by packet P19
-- (see M02-P03_RETURN.md "What P19 needs" section for the exact query shape).

-- ---------------------------------------------------------------------------
-- Helper: metadata_json is TEXT and is not guaranteed to hold valid JSON, so
-- a bare ::jsonb cast inside a trigger would abort the caller's transaction
-- (i.e. a bad metadata string on one projection could block a task delete).
-- Fail soft.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mw_safe_jsonb(t text) RETURNS jsonb AS $$
BEGIN
  IF t IS NULL OR btrim(t) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN t::jsonb;
EXCEPTION WHEN others THEN
  RETURN '{}'::jsonb;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- Shared retire routine, org-scoped (tasks/decisions always carry a
-- non-null organization_id).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mw_retire_inbox_projection(
  p_source_type text,
  p_source_id   text,
  p_org_id      text,
  p_reason      text
) RETURNS void AS $$
BEGIN
  UPDATE canonical_inbox_items
     SET status        = 'resolved',
         resolved_at   = now(),
         updated_at    = now(),
         metadata_json = (
           mw_safe_jsonb(metadata_json)
           || jsonb_build_object('mwLifecycle', p_reason, 'mwLifecycleAt', now())
         )::text
   WHERE source_entity_type = p_source_type
     AND source_entity_id   = p_source_id
     AND organization_id    = p_org_id
     AND status IS DISTINCT FROM 'resolved';
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Retire routine keyed by user_id instead of org_id — needed for
-- notifications, whose `organization_id` column is nullable (personal
-- notifications may carry no org at all). The (user_id, source_entity_type,
-- source_entity_id) triple is the table's own UNIQUE constraint, so this is
-- exactly as safe a scoping key as org_id is for tasks/decisions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mw_retire_inbox_projection_by_user(
  p_source_type text,
  p_source_id   text,
  p_user_id     text,
  p_reason      text
) RETURNS void AS $$
BEGIN
  UPDATE canonical_inbox_items
     SET status        = 'resolved',
         resolved_at   = now(),
         updated_at    = now(),
         metadata_json = (
           mw_safe_jsonb(metadata_json)
           || jsonb_build_object('mwLifecycle', p_reason, 'mwLifecycleAt', now())
         )::text
   WHERE source_entity_type = p_source_type
     AND source_entity_id   = p_source_id
     AND user_id            = p_user_id
     AND status IS DISTINCT FROM 'resolved';
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mw_tasks_inbox_lifecycle() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM mw_retire_inbox_projection('task', OLD.id, OLD.organization_id, 'source_deleted');
    RETURN OLD;
  END IF;

  -- UPDATE: retire once the task leaves the materialization-eligible set.
  IF lower(coalesce(NEW.status, '')) IN ('done', 'completed', 'validated')
     AND lower(coalesce(OLD.status, '')) IS DISTINCT FROM lower(coalesce(NEW.status, ''))
  THEN
    PERFORM mw_retire_inbox_projection('task', NEW.id, NEW.organization_id, 'source_archived');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mw_tasks_inbox_lifecycle_del ON tasks;
CREATE TRIGGER trg_mw_tasks_inbox_lifecycle_del
  AFTER DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION mw_tasks_inbox_lifecycle();

DROP TRIGGER IF EXISTS trg_mw_tasks_inbox_lifecycle_upd ON tasks;
CREATE TRIGGER trg_mw_tasks_inbox_lifecycle_upd
  AFTER UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION mw_tasks_inbox_lifecycle();

-- ---------------------------------------------------------------------------
-- decisions — identical invariant. The eligible set is
-- status IN ('pending','escalated'), so any transition out of it, or a
-- delete, strands the projection exactly as tasks do.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mw_decisions_inbox_lifecycle() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM mw_retire_inbox_projection('decision', OLD.id, OLD.organization_id, 'source_deleted');
    RETURN OLD;
  END IF;

  IF lower(coalesce(NEW.status, '')) NOT IN ('pending', 'escalated')
     AND lower(coalesce(OLD.status, '')) IS DISTINCT FROM lower(coalesce(NEW.status, ''))
  THEN
    PERFORM mw_retire_inbox_projection('decision', NEW.id, NEW.organization_id, 'source_archived');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mw_decisions_inbox_lifecycle_del ON decisions;
CREATE TRIGGER trg_mw_decisions_inbox_lifecycle_del
  AFTER DELETE ON decisions
  FOR EACH ROW EXECUTE FUNCTION mw_decisions_inbox_lifecycle();

DROP TRIGGER IF EXISTS trg_mw_decisions_inbox_lifecycle_upd ON decisions;
CREATE TRIGGER trg_mw_decisions_inbox_lifecycle_upd
  AFTER UPDATE OF status ON decisions
  FOR EACH ROW EXECUTE FUNCTION mw_decisions_inbox_lifecycle();

-- ---------------------------------------------------------------------------
-- notifications — same leak class, not present in the ported candidate.
-- Eligible set is `read = 0`; a mark-as-read (single or bulk) strands the
-- projection the same way a task-done transition does. Scoped by user_id,
-- not org_id (organization_id is nullable on this table).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mw_notifications_inbox_lifecycle() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM mw_retire_inbox_projection_by_user('notification', OLD.id, OLD.user_id, 'source_deleted');
    RETURN OLD;
  END IF;

  IF coalesce(NEW.read, 0) = 1 AND coalesce(OLD.read, 0) = 0 THEN
    PERFORM mw_retire_inbox_projection_by_user('notification', NEW.id, NEW.user_id, 'source_archived');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mw_notifications_inbox_lifecycle_del ON notifications;
CREATE TRIGGER trg_mw_notifications_inbox_lifecycle_del
  AFTER DELETE ON notifications
  FOR EACH ROW EXECUTE FUNCTION mw_notifications_inbox_lifecycle();

DROP TRIGGER IF EXISTS trg_mw_notifications_inbox_lifecycle_upd ON notifications;
CREATE TRIGGER trg_mw_notifications_inbox_lifecycle_upd
  AFTER UPDATE OF read ON notifications
  FOR EACH ROW EXECUTE FUNCTION mw_notifications_inbox_lifecycle();
