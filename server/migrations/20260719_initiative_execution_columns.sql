-- Odbiór W2b / RED #1 (H1.6): naprawa „Start Execution" na Postgres.
--
-- Diagnoza: POST /api/initiatives/:id/start-execution -> InitiativeController.startExecution
-- UPDATE-uje initiatives.execution_started_at, ale kolumna NIE ISTNIEJE na żywej bazie
-- (parity :5443, dump z TROLLEY == demo). Migracja 061_initiative_lifecycle.sql, która
-- miała ją dodać, jest w dialekcie SQLite (lower(hex(randomblob(16))), DATETIME, ALTER bez
-- IF NOT EXISTS) i nigdy nie odpaliła na PG (schema_migrations puste). Efekt: każdy
-- start-execution kończy się SQL error 42703 (column does not exist) -> 500.
--
-- Fix: addytywna, idempotentna kolumna. Prefiks daty (20260719_) -> wpada w autorun
-- DatabaseInitializer (regex /^(7\d{2}|\d{8})_/). Czysty Postgres, bez SQLite-izmów.
-- IF NOT EXISTS -> bezkolizyjne z równoległym baseline-gap (B13/t10) i idempotentne (2x run = no-op).
--
-- ZAKRES: WYŁĄCZNIE kolumna, której dotyka UPDATE w startExecution (execution_started_at).
-- Siostrzane transakcje lifecycle (block/unblock/approve) piszą do dalszych brakujących
-- kolumn (blocked_at, blocked_reason, unblocked_at, approved_at, approved_by, approval_comment,
-- roadmap_quarter, roadmap_year) — TEN SAM root cause (nieuruchomiona 061), ale poza tym RED;
-- domknięcie przez baseline-gap B13.

ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMPTZ;
