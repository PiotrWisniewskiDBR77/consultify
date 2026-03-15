# Railway DB Target Rules

## Purpose

This project must never guess which database target to use.

The goal is to enforce one rule: outside tests, the app and scripts must use the external database target.
If that target is unavailable, the run must fail fast instead of falling back to localhost or inventing an alternative flow.

## Rules

1. Outside Railway:
Use `DATABASE_PUBLIC_URL` for Postgres access when the Railway service exposes a public TCP proxy.

Localhost Postgres is not an allowed runtime fallback outside tests.

2. Inside Railway:
Use `DATABASE_URL` or `DB_HOST=*.railway.internal`.

3. Local staging files:
`.env.staging.local` may contain `DATABASE_URL`, but it must not point to `*.railway.internal`.
If the primary Railway variable is private, put the external proxy in `DATABASE_PUBLIC_URL`.

Do not put `localhost`, `127.0.0.1`, or `0.0.0.0` Postgres targets in shared app/runtime flows.

4. Finance imports:
Always pass explicit targets:
- `FINANCE_IMPORT_API_URL`
- `FINANCE_IMPORT_DATABASE_URL` or `FINANCE_IMPORT_DATABASE_PUBLIC_URL`
- `FINANCE_IMPORT_ORG_ID`

5. Organization consistency:
Railway `staging` and `production` must keep:
- `DEMO_ORG_ID=atelier`
- `DEMO_ORG_NAME=Atelier`
- `FINANCE_IMPORT_ORG_ID=atelier`

## Enforced In Code

- `server/src/config/databaseTargetResolver.ts`
- `server/src/config/DatabaseConfig.ts`
- `server/scripts/migrate.postgres.ts`
- `server/scripts/ensure-staging-schema-compat.ts`
- `server/scripts/lib/financeImportTarget.ts`
- `scripts/dev/reject-local-db.mjs`
- `scripts/dev/require-env-file.mjs`

## Operational Checklist

Before local work against Railway data:

1. Confirm `.env.staging.local` uses a public/external Postgres URL.
2. Run `npm run dev:staging`, `npm run dev:staging:ro`, or `npm run dev:railway`.
3. Never paste `pgvector.railway.internal` into local env files.
4. For production DB maintenance from a laptop, use the database service `DATABASE_PUBLIC_URL`, not the app service `DATABASE_URL`.
