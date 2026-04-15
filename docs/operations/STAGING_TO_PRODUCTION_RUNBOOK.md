# Staging to Production Runbook

**Status:** Active runbook  
**Last updated:** 2026-04-12

## Purpose

Use this runbook for every customer-facing promotion from staging to production.

When a release also changes the production tenant topology or database target, run the bootstrap and verification steps from [PRODUCTION_DATA_SPLIT_RUNBOOK.md](./PRODUCTION_DATA_SPLIT_RUNBOOK.md) before final cutover.

## Preconditions

- target code is already merged into `develop`
- staging deploy completed successfully
- smoke checks passed on staging
- business owner accepted the release candidate

## Promotion Flow

### 1. Prepare release PR

Open a PR from:

```bash
develop -> main
```

### 2. Verify release gate

Before merging:

1. confirm GitHub Actions passed on the PR
2. confirm staging validation was completed
3. confirm no unresolved rollback blockers remain
4. run `npm run deploy:gate` from the repo root against the release candidate

### 3. Merge to production branch

Merge the approved PR into `main`.

### 4. Trigger production deploy

Run the GitHub Actions workflow:

- workflow: `Railway Deploy`
- environment: `production`
- source ref: `main`

Production deploy is manual by design.

### 5. Execute production verification

After deploy:

1. verify backend health endpoint
2. verify frontend loads
3. verify login
4. verify one critical pilot path end-to-end
5. watch logs and alerts for immediate regressions

## Rollback

Rollback is required when:

- health checks fail
- login is broken
- critical pilot workflow is broken
- error rate spikes after release

Rollback path:

1. redeploy the previous stable production revision in Railway
2. log the failed release
3. keep `main` and `develop` consistent before new attempts

## Hotfix Rule

If production hotfix is needed:

1. branch from `main`
2. merge hotfix into `main`
3. deploy production
4. back-merge `main` into `develop`

Never leave a production-only fix outside `develop`.
