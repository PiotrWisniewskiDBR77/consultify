-- ============================================================================
-- D-02 RUNBOOK — idempotent cleanup of the 3 PPTX probe traces (L17b/L18/L19)
-- ----------------------------------------------------------------------------
-- Source of truth : cto-codex/wdrozenie-20-20260917/RAPORT.md §8b + §12 pkt 2
-- Queue           : KOLEJKI-DO-KONCA-20260918.md, Qoder D, QD10 (DLUG D-02, P3/S)
-- Mandate         : "TYLKO symulacja na kopii + skrypt idempotentny,
--                    kasowanie po słowie CTO · staging nietknięty bez słowa CTO"
--
-- WHAT THIS REMOVES (the rows RAPORT §8b named, all from the 2026-09-17 PPTX
-- export probe on deck artifact cdff0c26…):
--   public.v8_output_exports.export_id :
--     d3104b20-dc63-44ae-b88e-9554157d4be2  (L19)
--     9ff7509a-74a9-4b7f-b421-8364e466e573  (L18)
--     d0667889-241e-4d78-b443-36caffdd11da  (L17b)
--     (d4f192ed-… = L20's own export, already deleted by L20 — not targeted)
--   public.notifications  : the twin "Presentation exported" rows
--     (RAPORT gives truncated ids notif-4605309a…, notif-9a0e5f26…,
--      notif-336c1f7d…; all three point at related_object_id = deck cdff0c26…)
--   public.notification_dedup : the dedupe rows for those notifications
--
-- TARGETING STRATEGY (two independent keys, unioned — robust to id truncation):
--   (a) exact export_id IN (…) for the 3 known full ids;
--   (b) deck linkage: v8_output_exports.artifact_id LIKE 'cdff0c26%' and
--       notifications.related_object_id LIKE 'cdff0c26%' (type presentation_export),
--       which also catches the twin notifications whose ids are truncated in RAPORT.
--
-- IDEMPOTENT: every statement is a DELETE … WHERE <key> / snapshot of the same
-- predicate. When the rows are absent (the measured state on the 2026-09-18
-- staging snapshot) every DELETE affects 0 rows and a second run is identical.
--
-- COPY-FIRST: present rows are snapshotted to d02_cleanup_backup (jsonb) before
-- deletion so the change is reversible (rollback aid, mirrors RAPORT §8c
-- sondy/kopia.sql pattern). The snapshot only captures rows still present, so it
-- too is idempotent (0 new backup rows on a re-run after the traces are gone).
--
-- !! DO NOT RUN AGAINST STAGING/DEMO/PROD WITHOUT CTO'S EXPLICIT WORD (QD10). !!
-- !! Validated by simulation on a dump COPY only — see symulacja.sql / .log.    !!
-- ============================================================================

BEGIN;

-- 0. Backup table — created once, never dropped here. -------------------------
CREATE TABLE IF NOT EXISTS d02_cleanup_backup (
  captured_at timestamptz NOT NULL DEFAULT now(),
  tbl         text        NOT NULL,
  row_json    jsonb       NOT NULL
);

-- 1. Snapshot exactly the rows the DELETEs below will touch. ------------------
INSERT INTO d02_cleanup_backup (tbl, row_json)
SELECT 'v8_output_exports', to_jsonb(e)
FROM public.v8_output_exports e
WHERE e.export_id IN (
        'd3104b20-dc63-44ae-b88e-9554157d4be2',
        '9ff7509a-74a9-4b7f-b421-8364e466e573',
        'd0667889-241e-4d78-b443-36caffdd11da')
   OR e.artifact_id LIKE 'cdff0c26%';

INSERT INTO d02_cleanup_backup (tbl, row_json)
SELECT 'notifications', to_jsonb(n)
FROM public.notifications n
WHERE n.type = 'presentation_export'
  AND ( n.id LIKE 'notif-4605309a%'
     OR n.id LIKE 'notif-9a0e5f26%'
     OR n.id LIKE 'notif-336c1f7d%'
     OR n.related_object_id LIKE 'cdff0c26%' );

INSERT INTO d02_cleanup_backup (tbl, row_json)
SELECT 'notification_dedup', to_jsonb(d)
FROM public.notification_dedup d
WHERE d.notification_id IN (
        SELECT n.id FROM public.notifications n
        WHERE n.type = 'presentation_export'
          AND ( n.id LIKE 'notif-4605309a%'
             OR n.id LIKE 'notif-9a0e5f26%'
             OR n.id LIKE 'notif-336c1f7d%'
             OR n.related_object_id LIKE 'cdff0c26%' ) );

-- 2. Delete child → parent (dedup → notifications → exports). -----------------
DELETE FROM public.notification_dedup
WHERE notification_id IN (
        SELECT n.id FROM public.notifications n
        WHERE n.type = 'presentation_export'
          AND ( n.id LIKE 'notif-4605309a%'
             OR n.id LIKE 'notif-9a0e5f26%'
             OR n.id LIKE 'notif-336c1f7d%'
             OR n.related_object_id LIKE 'cdff0c26%' ) );

DELETE FROM public.notifications
WHERE type = 'presentation_export'
  AND ( id LIKE 'notif-4605309a%'
     OR id LIKE 'notif-9a0e5f26%'
     OR id LIKE 'notif-336c1f7d%'
     OR related_object_id LIKE 'cdff0c26%' );

DELETE FROM public.v8_output_exports
WHERE export_id IN (
        'd3104b20-dc63-44ae-b88e-9554157d4be2',
        '9ff7509a-74a9-4b7f-b421-8364e466e573',
        'd0667889-241e-4d78-b443-36caffdd11da')
   OR artifact_id LIKE 'cdff0c26%';

COMMIT;
