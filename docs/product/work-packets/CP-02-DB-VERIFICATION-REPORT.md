# CP-02 DB Verification Report

> **Status:** Template — fill after running `V8_DB_TEST_MODE=real npx vitest run --config vitest.config.v8-db.ts`

## Connection

| Field    | Value |
|----------|-------|
| Target   | Staging Railway Postgres |
| Source   | `DATABASE_PUBLIC_URL` / `DATABASE_URL` |
| Schema   | `v8` |

## Schema verification

| Metric          | Expected | Actual |
|-----------------|----------|--------|
| Tables found    | ≥ 40     | _TBD_  |
| Indexes found   | > 0      | _TBD_  |
| Partial indexes | > 0      | _TBD_  |

## CRUD verification

| Table                  | INSERT | SELECT | DELETE | Result |
|------------------------|--------|--------|--------|--------|
| v8_context_snapshots   | ✅/❌  | ✅/❌  | ✅/❌  | _TBD_  |
| v8_feature_flags       | ✅/❌  | ✅/❌  | ✅/❌  | _TBD_  |
| v8_tool_catalog        | ✅/❌  | ✅/❌  | ✅/❌  | _TBD_  |

## Postgres compatibility

| Check                                         | Result |
|------------------------------------------------|--------|
| CHECK constraints (consumer_class)             | _TBD_  |
| CHECK constraints (tool category)              | _TBD_  |
| DEFAULT CURRENT_TIMESTAMP (created_at)         | _TBD_  |
| Partial indexes (WHERE ... IS NOT NULL)        | _TBD_  |
| UNIQUE constraint (org_id + module)            | _TBD_  |

## SQLite incompatibilities found

| Pattern                | Status | Notes |
|------------------------|--------|-------|
| `datetime('now')`      | ❌ Incompatible | Postgres does not have `datetime()` function. Migrations must rewrite to `CURRENT_TIMESTAMP`. The v8-migrate.ts runner handles this rewrite. |
| `?` placeholders       | ❌ Incompatible | Postgres requires `$1, $2, ...` numbered placeholders. V8 services already use `$N` in most places; any remaining `?` usage will fail. |
| `INTEGER` for booleans | ✅ Compatible | Works in both SQLite and Postgres. |
| `TEXT` for all columns | ✅ Compatible | Works in both. |

## Service compatibility summary

> To be filled after running the full V8 test suite against real DB.

| Service | Tests | Pass | Fail | Notes |
|---------|-------|------|------|-------|
| _TBD_   |       |      |      |       |

## How to run

```bash
cd server
V8_DB_TEST_MODE=real npx vitest run --config vitest.config.v8-db.ts
```

Requires `DATABASE_PUBLIC_URL` (or reachable `DATABASE_URL`) to be set in the environment.
The v8 schema must already exist — run `npx tsx scripts/v8-migrate.ts --apply` first if needed.
