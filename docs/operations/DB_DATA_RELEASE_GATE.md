# DB Data Release Gate

## Goal

Production can move forward only when data truth is explicit across runtime, scripts, and critical business views.

## Mandatory Checks

- No hardcoded Postgres URLs in critical operational scripts.
- Legacy `server/scripts/migrate.js` is blocked and points to `server/scripts/migrate.postgres.ts`.
- Critical business modules gate sample data behind explicit demo mode:
  - `src/components/Economics/hooks/useFinanceData.ts`
  - `src/components/Initiatives/InitiativesHub.tsx`
  - `src/components/ReportsAndPresentations/useRapData.ts`
  - `src/components/Interview/InterviewHub.tsx`
- My Work personal tasks view states its real scope:
  - endpoint `/api/my-work/personal-tasks`
  - personal task slice only
  - hidden statuses by default
- Backend exposes authenticated diagnostic context:
  - `GET /api/health/data-context`

## Execution

```bash
npm run release:gate:data-truth
```

## Read-only Audit Commands

```bash
npm run db:inventory
npm run db:audit:truth
ENV_FILE=.env.staging.local npm run db:audit:truth:staging
```

## Expected Outputs

- `server/exports/inventory-*.json`
- `server/exports/data-truth-audit-*.json`
- `server/exports/data-truth-audit-*.md`
- `server/exports/data-truth-release-gate-*.md`

## Go / No-Go

- `GO`: all release-gate checks pass and readonly audits are reviewed.
- `NO-GO`: any hardcoded DB target remains, any critical module still mixes sample data silently, or active data context is not visible.
