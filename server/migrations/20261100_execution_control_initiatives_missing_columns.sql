-- Naprawa TRI-MUST-05 (bramka stagingu 2026-08-26): GET /api/v8/execution-control/timeline-warnings
-- maskował błąd SQL 200-ką z pustym fallbackiem (DbPromise.all domyślne fallback:true
-- traktuje KAŻDY "column ... does not exist" jak "no such table" i cicho zwraca []).
--
-- Diagnoza (real Postgres, pgvector/pgvector:pg16, pełny przebieg migracji,
-- \d initiatives): executionControlReadService.getTimelineWarningsSnapshot()
-- SELECT-uje initiatives.sla_deadline i initiatives.blocked_at. Obie kolumny
-- ISTNIEJĄ tylko w migracjach, które NIGDY nie odpalają na Postgresie, bo ich
-- nazwy plików nie pasują do MIGRATION_PATTERN
-- (server/src/services/tablePlatform/migrationIdentity.ts: /^(7\d{2}|\d{8})_.*\.sql$/):
--   - sla_deadline: server/migrations/294_execution_center.sql (prefiks "294" — nie 7XX, nie 8-cyfrowy)
--   - blocked_at:   server/migrations/061_initiative_lifecycle.sql,
--                   server/migrations/247_initiative_enhancements.sql (prefiksy "061"/"247")
-- owner_business_id (000_initdb_core_tables.sql, CREATE TABLE) i blocked_reason
-- (20260719_baseline_gap.sql, 8-cyfrowy prefiks — odpala) już istnieją na żywej
-- bazie; to NIE jest część tej naprawy.
--
-- Fix: addytywna, idempotentna kolumna z prefiksem daty (202611xx), by wpaść
-- w autorun. Typ TIMESTAMPTZ zgodny z siblingami (execution_started_at,
-- tracking_start_date) w tej samej tabeli.

ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
