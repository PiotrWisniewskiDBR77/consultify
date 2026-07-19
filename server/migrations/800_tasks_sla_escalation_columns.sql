-- RED fix: tasks.sla_due_at (and sibling SLA/escalation columns) do not exist in Postgres.
--
-- server/src/services/taskAssignmentService.ts reads/writes tasks.sla_hours, tasks.sla_due_at,
-- tasks.escalation_level, tasks.escalated_to_id and tasks.last_escalated_at. These columns were
-- only ever defined in server/migrations/042_pmo_roles_workstreams.sql.sql — a file the migration
-- runner (server/scripts/migrate.postgres.ts) SKIPS by design because of its double `.sql.sql`
-- extension (line ~134: `if (f.endsWith('.sql.sql')) return true;`), and which was written in
-- SQLite dialect anyway (datetime('now', ...) triggers, not valid Postgres). Net effect: every
-- assignTask/unassignTask/escalateTask/checkAndEscalateOverdue/getOverdueTasks/
-- getTasksApproachingSLA/getUserWorkload query throws "column ... does not exist" (42703), which
-- DbPromise's default fallback=true swallows into `[]`/`null`/`{success:false}` — silent SLA
-- degradation, no error surfaced anywhere.
--
-- This is additive + idempotent (IF NOT EXISTS) and reintroduces only the plain columns (no
-- SQLite triggers — the assignment/escalation code path already sets these fields explicitly in
-- TypeScript, so no DB-side trigger is needed on Postgres).
--
-- Additive + idempotent. Named 79x so the app's own migrationRunner (regex /^(7\d{2}|\d{8})_/)
-- autoruns it on demo/staging; the acceptance schema loader applies every server/migrations/*.sql.
--
-- Out of scope (separate RED item, not fixed here): server/src/services/taskAssignmentService.ts
-- escalateTask()/resolveEscalation()/getTaskEscalationHistory() also read/write a `task_escalations`
-- table that does not exist in Postgres at all (confirmed via parity :5443 information_schema).
-- Creating that table is a larger, separate change and was left out of this narrow sla_due_at fix.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_hours INTEGER DEFAULT 24;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS escalated_to_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_tasks_sla_due ON tasks(sla_due_at) WHERE sla_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_escalation_level ON tasks(escalation_level) WHERE escalation_level > 0;
