# Local to Staging Runbook

**Status:** Active runbook  
**Last updated:** 2026-04-12

## Purpose

Use this runbook when a developer needs to work locally against the staging environment.

Staging remains the shared test and legacy-data workspace. Do not repoint local development to the clean production DB used for `vts`, `dbr77`, and `atelier`.

## Preconditions

- you have a valid `.env.staging.local`
- staging DB access uses a public Railway target, not `*.railway.internal`
- required staging secrets are available locally

## Allowed Commands

### Full local app against staging

```bash
npm run dev:staging
```

### Read-only local app against staging

```bash
npm run dev:staging:ro
```

### Staging migration

```bash
npm run db:migrate:staging
```

## Safety Rules

Before running anything:

1. confirm `.env.staging.local` does not contain `localhost`, `127.0.0.1`, `0.0.0.0`, or `*.railway.internal`
2. confirm DB credentials point to staging, not production
3. use read-only mode when debugging or investigating

## Verification

After startup:

1. open the frontend locally
2. confirm login works against staging data
3. confirm backend health endpoints respond
4. confirm changes are isolated to the staging tenant and not production

## Troubleshooting

### App fails to connect to DB

- verify `.env.staging.local`
- verify public DB target
- re-read [RAILWAY_DB_TARGET_RULES.md](./RAILWAY_DB_TARGET_RULES.md)

### Migrations fail

- stop and verify the target database
- do not retry against a guessed fallback
- fix the environment file first
