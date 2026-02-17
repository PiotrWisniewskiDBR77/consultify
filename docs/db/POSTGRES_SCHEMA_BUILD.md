# Build Postgres schema (deterministic)

## Why

The legacy runner [`server/scripts/migrate.ts`](server/scripts/migrate.ts) is SQLite-first and rewrites SQL to keep SQLite dev DBs working.

For Railway Postgres we use the Postgres-only runner:

- [`server/scripts/migrate.postgres.ts`](server/scripts/migrate.postgres.ts)

## Prerequisites

- A fresh Railway Postgres database (recommended for clean migration).
- Set `DATABASE_URL` for that database (Railway Variables or local `.env.local`).

## Commands

### 1) Dry-run (see pending files)

```bash
DB_TYPE=postgres DATABASE_URL="postgresql://..." npm run db:migrate:postgres:dry
```

### 2) Apply migrations (strict)

```bash
DB_TYPE=postgres DATABASE_URL="postgresql://..." npm run db:migrate:postgres
```

### 3) Apply migrations (safe mode)

If you want to continue even if a migration fails (records as `skipped`):

```bash
DB_TYPE=postgres DATABASE_URL="postgresql://..." tsx server/scripts/migrate.postgres.ts --safe
```

## Output / state

Migration state is tracked in `schema_migrations` (Postgres table).
