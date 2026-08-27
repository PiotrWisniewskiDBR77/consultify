# Railway DB Target Rules

> **NAMING TRAP (state recorded 2026-08-28).** Three different databases are
> named `railway`; the database name does not identify the environment
> (`DEC-2026-08-28-165`). Railway-generated domains are crossed: staging has a
> domain containing "demo", while demo has one containing "staging"; a domain
> name does not identify the environment (`DEC-2026-08-28-172`). The reliable
> deployment check compares the database the MIGRATION connects to against the
> database the APPLICATION connects to — two values DERIVED from two different
> connection sources, never a single declared label
> (`server/src/config/databaseIdentity.ts`,
> `server/scripts/release-migration-gate.ts`,
> `server/src/database/PostgresDatabase.ts`,
> `scripts/validate-deploy-target.sh`).
>
> **CORRECTION 2026-08-28 (day-38 fix pass).** The first version of this check
> compared a `dbTarget=` label printed by the gate against a `dbTarget=` label
> printed by the application. Both read the same `DB_TARGET_LABEL` variable in
> the same service, so the two values agreed by construction and could never
> observe a divergence. The label survives as a human-readable hint only; it is
> no longer the check.

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

**CORRECTION 2026-08-28 (day-38 fix pass).** The previous version of this
section said the fingerprints belong in the "Railway staging/demo/production
app/service variables". That was WRONG for the deploy-target guard.
`scripts/validate-deploy-target.sh` runs in **GitHub Actions** (and in
`scripts/deploy-demo.sh` on an operator laptop) — it never executes inside
Railway, so a variable set only in the Railway panel is invisible to it. The
table below names the plane that actually feeds each consumer.

| Variable | Consumer | Plane where it must be set | Effect when absent |
| --- | --- | --- | --- |
| `APP_DATABASE_URL` | deploy-target guard | GitHub **secret** per environment (`STAGING_APP_DATABASE_URL`, `PRODUCTION_APP_DATABASE_URL`); shell env for `deploy-demo.sh` | divergence check cannot run: loud warning when unarmed, hard block when armed |
| `MIGRATION_DATABASE_URL` | deploy-target guard | GitHub **secret** per environment (`STAGING_MIGRATION_DATABASE_URL`, `PRODUCTION_MIGRATION_DATABASE_URL`); shell env for `deploy-demo.sh` | as above |
| `STAGING_/DEMO_/PRODUCTION_DB_HOST_FINGERPRINT` | deploy-target guard | GitHub **variable** (`vars.…`); shell env for `deploy-demo.sh` | derived host is not pinned to the environment |
| `DEPLOY_TARGET_GUARD_ENFORCE` | deploy-target guard | GitHub **variable**, set to `1` when the four above are configured | guard stays advisory: it warns loudly and lets the deploy through |
| `RELEASE_TARGET_DB_HOST_FINGERPRINT` | release migration gate, **inside** Railway | Railway app/service variables per environment | the gate refuses to migrate (`gateContract.ts:33-47`) |
| `DB_TARGET_LABEL` | log readability only | Railway app/service variables | logs show `dbTarget=unset`; the divergence check is unaffected |

`APP_DATABASE_URL` and `MIGRATION_DATABASE_URL` are connection strings, hence
secrets. The guard parses host/port/database out of them and never prints the
value; the tests in `tests/unit/deploy/validate-deploy-target.test.mjs` assert
that no credential and no `postgresql://` prefix reaches stdout or stderr.
Operators who do not want connection strings in CI may instead supply the
already-derived `APP_DB_IDENTITY` / `MIGRATION_DB_IDENTITY`
(`host:port/database`).

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
- `scripts/validate-deploy-target.sh` does not open a database connection. It
  compares two connection descriptions supplied from two different planes; it
  cannot detect a target that changes between the guard run and the deploy.
- The guard is advisory until `DEPLOY_TARGET_GUARD_ENFORCE` is set. An observed
  divergence blocks in either mode, but missing inputs only warn while unarmed.
- Confirm the actual deployed target by comparing the two `DB_IDENTITY` lines in
  the deploy log (`role=migration` from the release gate, `role=app` from the
  application). Both are printed with `console.log`, so no `LOG_LEVEL` can
  suppress them; the older `[Postgres] Config:` line goes through winston, whose
  level defaults to `warn` outside development, and is therefore absent in
  production.

## Enforced In Code

- `server/src/config/databaseTargetResolver.ts`
- `server/src/config/databaseIdentity.ts`
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
