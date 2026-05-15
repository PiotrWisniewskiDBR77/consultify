# Production Data Split Runbook

**Status:** Active runbook  
**Last updated:** 2026-04-12

## Purpose

Use this runbook to bootstrap the clean production data model:

- one physical `production` database
- three production tenants: `vts`, `dbr77`, `atelier`
- current staging/test database retained only for `staging` and local work

## Preconditions

- production backup path is prepared
- new production Postgres target exists
- app secrets for the new production target are ready
- staging remains the only source for day-to-day testing and local investigation

## Canonical Tenant IDs

- `vts`
- `dbr77`
- `atelier`

Forbidden legacy tenant in the new production target:

- `org-dbr77-system`

## Safety Rules

1. Never restore the dirty staging/test database into the new production target.
2. Always point scripts at an explicit DB target.
3. Run all destructive demo rebuilds with explicit confirmation flags.
4. Keep branded demo orgs behind `ALLOW_NONDEFAULT_DEMO_ORG=1`.
5. Validate tenant presence and legacy absence before cutover.

## Bootstrap Order

### 1. Backup current production

```bash
npm run db:backup
```

### 2. Run migrations against the new clean production DB

```bash
npm run db:migrate:strict
```

### 3. Bootstrap clean DBR77

```bash
npm run db:seed:dbr77
```

### 4. Bootstrap clean VTS

```bash
npm run db:seed:vts
```

### 5. Materialize Atelier Toys demo

```bash
npm run db:seed:atelier
```

### 6. Verify tenant split before cutover

```bash
npm run db:verify:tenant-split
```

## Required Environment Notes

### `db:seed:dbr77`

- requires `SEED_MODE=production`
- requires `SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION`
- defaults to org ID `dbr77`

### `db:seed:vts`

- requires `SEED_MODE=production`
- requires `SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION`
- defaults to org ID `vts`
- supports overrides like `SEED_ORG_ID`, `SEED_ORG_NAME`, `VTS_OWNER_EMAIL`

### `db:seed:atelier`

- requires `DEMO_ORG_ID=atelier`
- requires `ALLOW_NONDEFAULT_DEMO_ORG=1`
- requires `ALLOW_BRANDED_DEMO_ORG=1`
- requires `ALLOW_ATELIER_AS_DEMO_ORG=1`
- requires `DEMO_DATASET_CONFIRM=REBUILD_CANONICAL_DEMO`

## Cutover Validation

Before switching the production app to the new DB target:

1. confirm `vts`, `dbr77`, and `atelier` exist
2. confirm `org-dbr77-system` does not exist in the new production DB
3. confirm `dbr77` users can log in
4. confirm `vts` owner/admin users can log in
5. confirm `atelier` has seeded demo content
6. confirm no staging-only orgs were imported

## Rollback

If any production bootstrap or smoke check fails:

1. do not restore staging data into production
2. keep the old production DB target unchanged
3. point the app back to the previous stable DB target
4. retain the failed clean DB for audit and repair

## Local and Staging Rule

Local development continues through `.env.staging.local` and the staging DB only:

```bash
npm run dev:staging
npm run dev:staging:ro
```

Do not point local development at the clean production target.
