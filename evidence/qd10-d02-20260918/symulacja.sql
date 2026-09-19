-- ============================================================================
-- D-02 SYMULACJA — runs d02-cleanup.sql against a DUMP COPY (never staging).
-- Target DB: consultify_qd10 = pg_restore of staging-pre-wdrozenie29-20260918T2052.dump
-- Container: qoder-d-pg-qd10 (pg17, 127.0.0.1:6631) — D's own, removed after.
--
-- PHASE A = as-restored copy: the 3 named traces are ABSENT (the measured
--           finding) → cleanup must affect 0 rows, twice (idempotent).
-- PHASE B = synthetic: insert minimal rows carrying the SAME keys the script
--           targets → cleanup must remove exactly them, then 0 on re-run
--           (proves the script is not a blind no-op; mutation-style control).
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off

\echo '################ RESET (idempotent — clears any prior partial run) ################'
DROP TABLE IF EXISTS d02_cleanup_backup;
SET session_replication_role = replica;
DELETE FROM public.notification_dedup WHERE dedupe_key LIKE 'd02sim-dedupe-key-%';
DELETE FROM public.notifications WHERE id IN ('notif-4605309a-1111-2222-3333-444444444444','notif-9a0e5f26-1111-2222-3333-444444444444','notif-336c1f7d-1111-2222-3333-444444444444');
DELETE FROM public.v8_output_exports WHERE organization_id='org-d02-sim' OR artifact_id LIKE 'cdff0c26synthetic%';
SET session_replication_role = DEFAULT;

\echo '################ PHASE A — as-restored copy (traces expected ABSENT) ################'

\echo '--- A.0 target counts BEFORE (expect 0/0/0) ---'
SELECT 'A_exports_target'  AS k, count(*) FROM public.v8_output_exports
  WHERE export_id IN ('d3104b20-dc63-44ae-b88e-9554157d4be2','9ff7509a-74a9-4b7f-b421-8364e466e573','d0667889-241e-4d78-b443-36caffdd11da') OR artifact_id LIKE 'cdff0c26%'
UNION ALL SELECT 'A_notifs_target', count(*) FROM public.notifications
  WHERE type='presentation_export' AND (id LIKE 'notif-4605309a%' OR id LIKE 'notif-9a0e5f26%' OR id LIKE 'notif-336c1f7d%' OR related_object_id LIKE 'cdff0c26%')
UNION ALL SELECT 'A_dedup_target', count(*) FROM public.notification_dedup
  WHERE notification_id IN (SELECT id FROM public.notifications WHERE type='presentation_export' AND (id LIKE 'notif-4605309a%' OR id LIKE 'notif-9a0e5f26%' OR id LIKE 'notif-336c1f7d%' OR related_object_id LIKE 'cdff0c26%'));

\echo '--- A.1 baseline totals (context: other pptx/presentation_export data must NOT move) ---'
SELECT 'A_exports_total' AS k, count(*) FROM public.v8_output_exports
UNION ALL SELECT 'A_notifs_pres_export_total', count(*) FROM public.notifications WHERE type='presentation_export'
UNION ALL SELECT 'A_dedup_pres_export_total', count(*) FROM public.notification_dedup WHERE type='presentation_export';

\echo '--- A.2 RUN cleanup (1st) ---'
\i d02-cleanup.sql

\echo '--- A.3 target counts AFTER 1st run (expect 0/0/0) + totals unchanged ---'
SELECT 'A_exports_target'  AS k, count(*) FROM public.v8_output_exports
  WHERE export_id IN ('d3104b20-dc63-44ae-b88e-9554157d4be2','9ff7509a-74a9-4b7f-b421-8364e466e573','d0667889-241e-4d78-b443-36caffdd11da') OR artifact_id LIKE 'cdff0c26%'
UNION ALL SELECT 'A_notifs_target', count(*) FROM public.notifications
  WHERE type='presentation_export' AND (id LIKE 'notif-4605309a%' OR id LIKE 'notif-9a0e5f26%' OR id LIKE 'notif-336c1f7d%' OR related_object_id LIKE 'cdff0c26%')
UNION ALL SELECT 'A_exports_total', count(*) FROM public.v8_output_exports
UNION ALL SELECT 'A_notifs_pres_export_total', count(*) FROM public.notifications WHERE type='presentation_export';

\echo '--- A.4 RUN cleanup (2nd, idempotency) ---'
\i d02-cleanup.sql
\echo '--- A.5 backup rows captured during PHASE A (expect 0 — nothing present to snapshot) ---'
SELECT 'A_backup_rows' AS k, count(*) FROM d02_cleanup_backup;

\echo ''
\echo '################ PHASE B — synthetic rows carrying the SAME target keys ################'
\echo '--- B.0 insert 3 exports + 3 notifications + 3 dedup (SYNTHETIC, copy DB only) ---'
SET session_replication_role = replica;
INSERT INTO public.v8_output_exports (export_id, artifact_id, organization_id, format, requested_by, status, created_at, completed_at) VALUES
  ('d3104b20-dc63-44ae-b88e-9554157d4be2','cdff0c26syntheticdeck0000000000000001','org-d02-sim','pptx','cto-probe','completed','2026-09-17T06:38:02.000Z','2026-09-17T06:38:05.000Z'),
  ('9ff7509a-74a9-4b7f-b421-8364e466e573','cdff0c26syntheticdeck0000000000000001','org-d02-sim','pptx','cto-probe','completed','2026-09-17T05:07:17.000Z','2026-09-17T05:07:20.000Z'),
  ('d0667889-241e-4d78-b443-36caffdd11da','cdff0c26syntheticdeck0000000000000001','org-d02-sim','pptx','cto-probe','completed','2026-09-17T03:44:21.000Z','2026-09-17T03:44:24.000Z');
INSERT INTO public.notifications (id, user_id, type, title, message, related_object_type, related_object_id, created_at) VALUES
  ('notif-4605309a-1111-2222-3333-444444444444','user-d02-sim','presentation_export','Presentation exported','sim','presentation_deck','cdff0c26syntheticdeck0000000000000001','2026-09-17 06:38:06'),
  ('notif-9a0e5f26-1111-2222-3333-444444444444','user-d02-sim','presentation_export','Presentation exported','sim','presentation_deck','cdff0c26syntheticdeck0000000000000001','2026-09-17 05:07:21'),
  ('notif-336c1f7d-1111-2222-3333-444444444444','user-d02-sim','presentation_export','Presentation exported','sim','presentation_deck','cdff0c26syntheticdeck0000000000000001','2026-09-17 03:44:25');
INSERT INTO public.notification_dedup (dedupe_key, user_id, notification_id, type, organization_id, created_at, expires_at) VALUES
  ('d02sim-dedupe-key-0001','user-d02-sim','notif-4605309a-1111-2222-3333-444444444444','presentation_export','org-d02-sim','2026-09-17T06:38:06.000Z','2026-09-24T06:38:06.000Z'),
  ('d02sim-dedupe-key-0002','user-d02-sim','notif-9a0e5f26-1111-2222-3333-444444444444','presentation_export','org-d02-sim','2026-09-17T05:07:21.000Z','2026-09-24T05:07:21.000Z'),
  ('d02sim-dedupe-key-0003','user-d02-sim','notif-336c1f7d-1111-2222-3333-444444444444','presentation_export','org-d02-sim','2026-09-17T03:44:25.000Z','2026-09-24T03:44:25.000Z');
SET session_replication_role = DEFAULT;

\echo '--- B.1 target counts AFTER insert (expect 3/3/3) ---'
SELECT 'B_exports_target' AS k, count(*) FROM public.v8_output_exports WHERE artifact_id LIKE 'cdff0c26%'
UNION ALL SELECT 'B_notifs_target', count(*) FROM public.notifications WHERE type='presentation_export' AND related_object_id LIKE 'cdff0c26%'
UNION ALL SELECT 'B_dedup_target', count(*) FROM public.notification_dedup WHERE notification_id LIKE 'notif-4605309a%' OR notification_id LIKE 'notif-9a0e5f26%' OR notification_id LIKE 'notif-336c1f7d%';

\echo '--- B.2 RUN cleanup (1st) → must delete the 3+3+3 ---'
\i d02-cleanup.sql

\echo '--- B.3 READBACK target counts (expect 0/0/0) + backup captured 9 ---'
SELECT 'B_exports_target' AS k, count(*) FROM public.v8_output_exports WHERE artifact_id LIKE 'cdff0c26%'
UNION ALL SELECT 'B_notifs_target', count(*) FROM public.notifications WHERE type='presentation_export' AND related_object_id LIKE 'cdff0c26%'
UNION ALL SELECT 'B_dedup_target', count(*) FROM public.notification_dedup WHERE notification_id LIKE 'notif-4605309a%' OR notification_id LIKE 'notif-9a0e5f26%' OR notification_id LIKE 'notif-336c1f7d%'
UNION ALL SELECT 'B_backup_rows_phaseB', count(*) FROM d02_cleanup_backup WHERE row_json->>'organization_id'='org-d02-sim' OR row_json->>'user_id'='user-d02-sim';

\echo '--- B.4 RUN cleanup (2nd, idempotency) → 0 ---'
\i d02-cleanup.sql
\echo '--- B.5 readback again (expect 0/0/0) + backup rows did NOT grow on empty re-run ---'
SELECT 'B_exports_target' AS k, count(*) FROM public.v8_output_exports WHERE artifact_id LIKE 'cdff0c26%'
UNION ALL SELECT 'B_notifs_target', count(*) FROM public.notifications WHERE type='presentation_export' AND related_object_id LIKE 'cdff0c26%'
UNION ALL SELECT 'B_dedup_target', count(*) FROM public.notification_dedup WHERE notification_id LIKE 'notif-4605309a%' OR notification_id LIKE 'notif-9a0e5f26%' OR notification_id LIKE 'notif-336c1f7d%'
UNION ALL SELECT 'B_backup_rows_total', count(*) FROM d02_cleanup_backup;

\echo ''
\echo '################ PHASE C — collateral check: other product data untouched ################'
\echo '--- C.1 the 10 August presentation_export notifications + 33 pptx exports must be intact ---'
SELECT 'C_notifs_pres_export_total' AS k, count(*) FROM public.notifications WHERE type='presentation_export'
UNION ALL SELECT 'C_exports_pptx_total', count(*) FROM public.v8_output_exports WHERE format='pptx'
UNION ALL SELECT 'C_exports_total', count(*) FROM public.v8_output_exports;

\echo '--- C.2 cleanup synthetic backup table (simulation artifact, NOT part of staging) ---'
DROP TABLE IF EXISTS d02_cleanup_backup;
\echo '################ SYMULACJA KONIEC ################'
