# Railway DB Target Rules

> **NAMING TRAP (state recorded 2026-08-28).** Three different databases are
> named `railway`; the database name does not identify the environment
> (`DEC-2026-08-28-165`). Railway-generated domains are crossed: staging has a
> domain containing "demo", while demo has one containing "staging"; a domain
> name does not identify the environment (`DEC-2026-08-28-172`). The reliable
> deployment check is the database host against
> `RELEASE_TARGET_DB_HOST_FINGERPRINT`, followed by matching `dbTarget=` labels
> in the migration-gate and application startup logs
> (`server/src/services/releaseGate/gateContract.ts:33-47`,
> `server/scripts/release-migration-gate.ts`,
> `server/src/database/PostgresDatabase.ts`).

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
`dbr77` and `atelier` are equal real tenants.
- Do not assume a single primary build org.
- Always pass explicit org targets for imports, seeds, and repair scripts (`ORG_ID`, `SEED_ORG_ID`, `FINANCE_IMPORT_ORG_ID`, `TARGET_ORG_ID`).
- Reserve `DEMO_ORG_ID` only for a truly separate demo tenant.

## Environment and Database Map

State on 2026-08-28 according to `DEC-2026-08-28-165` and
`DEC-2026-08-28-172`. Verify the current mapping in Railway before any database
operation; this repository duty did not perform a live verification.

| Environment | Database role | Proxy host label | Registry evidence | Migration target |
| --- | --- | --- | --- | --- |
| production | production database | `centerbeam` | production target in `DEC-165` | Not established by the registry entries used here |
| demo | `pgvector` service | `trolley` | demo service in the `DEC-172` correction; staging app had also pointed here | No for the staging gate described in `DEC-165` |
| staging | `Postgres-Rehearsal-20260820` | `sakura` | complete rehearsal database described in `DEC-165` | Yes, for the release gate described in `DEC-165` |
| staging | `Postgres` service | `thomas` | stale staging service; dev also points here (`DEC-165`, `DEC-172`) | No for the release gate described in `DEC-165` |

Do not infer a service rename from this table. `DEC-2026-08-28-172` records that
renaming the `Postgres` service before replacing hardcoded private references
would break production.

## Variables Required Before Merge

Values are intentionally absent from the repository. The supervisor must set
them in the named configuration plane and verify the current host first.

| Environment | Required variables | Configuration plane | Effect when absent |
| --- | --- | --- | --- |
| staging | `RELEASE_TARGET_DB_HOST_FINGERPRINT`, `STAGING_DB_HOST_FINGERPRINT`, `DB_TARGET_LABEL` | Railway staging app/service variables; GitHub `vars.STAGING_FRONTEND_URL` and `vars.STAGING_API_HEALTH_URL` must also identify staging | deploy-target guard blocks on either fingerprint; logs show `dbTarget=unset` without the label |
| demo | `RELEASE_TARGET_DB_HOST_FINGERPRINT`, `DEMO_DB_HOST_FINGERPRINT`, `DB_TARGET_LABEL` | Railway demo app/service variables | deploy-target guard blocks on either fingerprint; logs show `dbTarget=unset` without the label |
| production | `RELEASE_TARGET_DB_HOST_FINGERPRINT`, `PRODUCTION_DB_HOST_FINGERPRINT`, `DB_TARGET_LABEL` | Railway production app/service variables, with owner approval for E5 | deploy-target guard blocks on either fingerprint; logs show `dbTarget=unset` without the label |

`RELEASE_TARGET_DB_HOST_FINGERPRINT` was not set in production in the state
recorded by `DEC-2026-08-28-165`/`DEC-2026-08-28-172`. Setting it is E5 and
requires separate owner approval. The repository contains no default host
fingerprint.

## Known Guard Limitations

- The built-in production denylist uses a proxy-name fingerprint and therefore
  can age when the proxy name changes. It can be extended, never reduced, with
  `PRODUCTION_DB_HOST_DENYLIST_EXTRA`
  (`server/src/config/databaseTargetResolver.ts:41,55-60`).
- Target verification is a case-insensitive host substring comparison. It
  protects against accidental mismatch, not a malicious configuration
  (`server/src/services/releaseGate/gateContract.ts:33-47`).
- `scripts/validate-deploy-target.sh` compares declarations; it does not open a
  database connection. Confirm the actual deployed target by comparing the
  `dbTarget=` field on `RELEASE_MIGRATION_GATE_PASS` and `[Postgres] Config:`.

## Enforced In Code

- `server/src/config/databaseTargetResolver.ts`
- `server/src/config/dbTargetLabel.ts`
- `server/src/config/DatabaseConfig.ts`
- `server/scripts/migrate.postgres.ts`
- `server/scripts/release-migration-gate.ts`
- `server/src/services/releaseGate/gateContract.ts`
- `scripts/validate-deploy-target.sh`
- `tests/integration/_helpers/assertRealPostgres.ts`
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
