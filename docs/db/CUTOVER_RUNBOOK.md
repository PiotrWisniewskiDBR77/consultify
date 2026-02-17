# Cutover runbook (SQLite → Railway Postgres)

This assumes:

- you created a **fresh** Railway Postgres instance,
- you accept a short downtime (5–20 min),
- embeddings/pgvector data can be rebuilt post-cutover.

## Pre-cutover (repeatable)

### 1) Build schema on the new Postgres DB

```bash
DB_TYPE=postgres DATABASE_URL="postgresql://..." npm run db:migrate:postgres
```

### 2) Full ETL import from SQLite

If Postgres is missing lots of tables (ETL logs “Skipping … not present in schema”), first sync schema from SQLite:

```bash
DB_TYPE=postgres DATABASE_URL="postgresql://..." npm run db:schema:sync:sqlite-to-pg
```

```bash
SQLITE_PATH=./data/dev/consultinity.db DB_TYPE=postgres DATABASE_URL="postgresql://..." \
  npm run db:transfer:sqlite-to-pg -- --batch-size 200 --skip-embeddings true
```

This writes a report under `server/exports/transfer-report-sqlite-to-pg-*.json`.

⚠️ Recommended: run the import into a **fresh, empty** Postgres database. If you import into an existing DB, you may end up with extra rows compared to SQLite (seed data / previous runs).

### 3) Inventory + compare

```bash
npm run db:inventory:sqlite
DB_TYPE=postgres DATABASE_URL="postgresql://..." npm run db:inventory:postgres

# compare (provide the two JSON files)
npm run db:inventory:compare -- --sqlite server/exports/inventory-sqlite-....json --postgres server/exports/inventory-postgres-....json
```

### 4) Smoke tests against Postgres (local)

- Start backend with Postgres: `npm run dev:backend:railway` (with `DATABASE_URL` pointing to the new DB)
- Run smoke E2E: `npm run test:e2e:smoke`

## Cutover (downtime)

1. **Stop writes** (stop backend / maintenance mode).
2. If SQLite had any recent writes since the last ETL run, run the ETL again (or run a delta approach if you have it).
3. Update production `DATABASE_URL` to the **new** Railway Postgres instance.
4. Start backend.
5. Verify:
   - `/api/health`
   - `/api/llm/providers/health`
   - UI: assessments, initiatives, my work, notifications

## Post-cutover (embeddings rebuild)

Wipe embeddings tables/columns to force rebuild:

```bash
DB_TYPE=postgres DATABASE_URL="postgresql://..." npm run db:embeddings:reset
```

Then regenerate embeddings using your normal ingestion flows (knowledge upload / background jobs), or add a dedicated regeneration job if needed.

## Rollback

If anything is wrong:

- switch `DATABASE_URL` back to the old database,
- restart backend.
