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

## Migration Gate (Target Verification)

`server/scripts/release-migration-gate.ts` is the fail-closed pre-deploy
migration entry point. It requires `RELEASE_TARGET_DB_HOST_FINGERPRINT`; absence
of that declaration stops the gate, as does a mismatch
(`server/src/services/releaseGate/gateContract.ts:33-47`). The gate deliberately
keeps the host redacted and prints a human-supplied, sanitized `dbTarget=` label
instead (`server/scripts/release-migration-gate.ts`). See
`docs/operations/RAILWAY_DB_TARGET_RULES.md` for the single environment map.

Deployment-log acceptance procedure:

1. Find the line beginning with `RELEASE_MIGRATION_GATE_PASS`.
2. Find the `[Postgres] Config:` line.
3. Compare the `dbTarget=` field in both:
   - identical values: target-label check is consistent;
   - different values: divergence — stop the deployment;
   - either value is `unset`: `DB_TARGET_LABEL` is not configured;
   - either line lacks `dbTarget`: that side is running an older build.

Until both sides run code that emits the field, a missing field means an older
build, not an unset label.

## Go / No-Go

- `GO`: all release-gate checks pass and readonly audits are reviewed.
- `NO-GO`: any hardcoded DB target remains, any critical module still mixes sample data silently, or active data context is not visible.
- `NO-GO`: the two `dbTarget=` values differ, either is `unset`, or either log
  line lacks the field.
