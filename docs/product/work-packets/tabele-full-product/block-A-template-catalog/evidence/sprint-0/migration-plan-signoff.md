# Migration Plan Sign-off — Block A Sprint 0

**Date:** 2026-05-08
**Author:** Cursor agent (Orchestrator, CTO mode)
**Status:** `SIGNED OFF — ready for S1`

---

## Migration metadata

- Filename: `20260508_block_a_template_lifecycle.sql`
- Location: `DRD/consultify/server/migrations/`
- Naming convention: `^(7\d{2}|\d{8})_.*\.sql$` (date-prefixed); enforced by `migrationRunner.ts` line 26.
- Discovery: top-level `migrations/` folder only (per `getMigrationsDir` in `migrationRunner.ts`).

## Changes

```sql
-- 20260508_block_a_template_lifecycle.sql
-- Block A — Template Catalog: lifecycle, governance, ownership

ALTER TABLE tp_base_templates
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'deprecated')),
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS approval_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS governance_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tp_templates_status
  ON tp_base_templates(status);

CREATE INDEX IF NOT EXISTS idx_tp_templates_owner
  ON tp_base_templates(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- Promote 3 legacy featured templates to approved.
-- Rationale: they were already production-tested and is_featured=true.
UPDATE tp_base_templates
   SET status = 'approved',
       approval_history = '[{"action":"approve","actor":"system","reason":"legacy_featured","at":"2026-05-08T00:00:00Z"}]'::jsonb
 WHERE status = 'draft'
   AND is_featured = true
   AND name IN ('CRM Pipeline', 'Project Tracker', 'HR Onboarding');
```

## Lock duration estimate

- `ALTER TABLE ... ADD COLUMN ... DEFAULT <constant>` on PostgreSQL 11+ is metadata-only (no row rewrite).
- `CREATE INDEX` without `CONCURRENTLY` blocks writes briefly. Safe alternative: separate the index creation into `CREATE INDEX CONCURRENTLY` if the table is large.
- For `tp_base_templates` (≤ 100 rows expected), even a non-concurrent index is < 1 s.
- Estimated total lock duration: < 200 ms on production.

**Decision:** ship as-is (non-concurrent indexes); if production load is heavier than expected, S1 swaps to `CONCURRENTLY` before merge.

## Rollback path

Forward-only migrations (no down script). If rollback is required:

```sql
ALTER TABLE tp_base_templates
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS owner_user_id,
  DROP COLUMN IF EXISTS approval_history,
  DROP COLUMN IF EXISTS governance_rules;

DROP INDEX IF EXISTS idx_tp_templates_status;
DROP INDEX IF EXISTS idx_tp_templates_owner;
```

Rollback file (manual application): `DRD/consultify/server/migrations/_rollbacks/20260508_block_a_template_lifecycle_rollback.sql`. Created at S1 alongside the forward migration.

## Backwards compatibility

- All new columns have defaults → existing rows backfill automatically.
- Existing endpoints (`GET /tables/...templates`, `POST /tables/...templates/use`) continue to work without changes — they don't reference the new columns.
- `TemplateService.listTemplates(category?)` returns rows including new columns (Postgres returns all columns by default with `SELECT *`); Foundation Block consumers only read `id, name, description, category, schema_snapshot, usage_count, is_featured` → no breakage.
- New consumers in Block A (`TemplateLifecycleService`) explicitly project the new columns.

## Pre-deployment checklist (S1)

- [ ] Migration applied on staging.
- [ ] Existing `seedDefaultTemplates` smoke run succeeds (no template duplication).
- [ ] `SELECT count(*) FROM tp_base_templates WHERE status='approved'` returns ≥ 3 (legacy featured promoted).
- [ ] Existing endpoints continue to return rows.
- [ ] Rollback rehearsal: apply rollback, verify drop, reapply.

## Sign-off

- Schema reviewer: Cursor agent (CTO mode)
- Migration runner compatibility: verified against `migrationRunner.ts` line 26 pattern.
- Foundation Block compatibility: verified — no consumer reads new columns.
- Tenancy review: `tp_base_templates` has no tenant column today (templates are global). Approval / deprecation lifecycle is super-admin only; no per-tenant template scope yet (separate program later).

**Decision:** `GO` for S1 implementation.
