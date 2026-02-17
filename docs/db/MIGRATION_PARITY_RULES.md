# Migration parity rules (SQLite → Postgres)

This document defines what “success” means for the migration.

## Parity levels

- **L0 (Connection)**: app starts on Postgres, `/api/health` reports DB connected.
- **L1 (Core data parity)**: users/orgs/projects/tasks/initiatives visible in UI.
- **L2 (Module parity)**: each major module has required tables and row counts within tolerance.
- **L3 (Workflow parity)**: key write flows work (create/update) without DB dialect errors.

## Required table groups (must be present)

### Auth & identity

- `organizations`
- `users`
- `sessions`
- `refresh_tokens`
- `revoked_tokens`

### PMO / execution

- `projects`
- `tasks`
- `teams`
- `project_members` (or equivalent)
- `decisions`
- `raid_items`
- `initiatives`

### Assessment & reporting

- `assessments`
- `assessment_reports`
- `assessment_workflows` / `assessment-workflow-v2` tables (as applicable)

### Notifications

- `notifications`
- `notification_preferences` (if used)

## Row-count checks (minimum)

For the final cutover run, generate inventories and ensure:

- For each required table above: **exact row counts match** (SQLite vs Postgres), OR a documented reason exists (e.g. intentionally rebuilt artifacts).

Run inventory scripts:

- `npm run db:inventory:sqlite`
- `DB_TYPE=postgres DATABASE_URL=\"...\" npm run db:inventory:postgres`

## Relationship sanity checks (sample)

- `projects.id` referenced by `tasks.project_id` exists for a high sample ratio (ideally 100%).\n- `organizations.id` referenced by `users.organization_id` exists.\n- `assessments.id` referenced by `assessment_reports.assessment_id` exists.\n\nIf these fail, either:\n- the import order/ETL needs fixing, OR\n- source SQLite has inconsistent data that must be cleaned.\n+
