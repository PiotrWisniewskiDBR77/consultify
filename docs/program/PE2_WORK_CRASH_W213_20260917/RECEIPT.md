# PE2 Work crash W213 — receipt

Status: READY FOR CTO REVIEW.

Base: `fa075366be0c8bafa666275c8f8cb7868e5f0099` (staging deployment 23 from W213).
Branch: `codex/a-pe2-work-crash-w213-20260917`.

## Problem reproduced from W213 evidence

CTO evidence from `~/Developer/cto-codex/wdrozenie-23-20260917/dowody` shows Northwind `/execution?tab=work` crashed with:

- `TypeError: Cannot read properties of null (reading 'trim')`
- minified stack in `ExecutionHub-DPxFjt3y.js`: `Cu -> Ya -> render`
- downloaded staging asset maps `Cu` to `isOpaqueIdentifier(value.trim())` and `Ya` to `actorLabelWithOrigin(...)` in `ExecutionWorkSurface.tsx`.
- `e4-api-trace-northwind2.json` shows `/api/tasks` records with `sourceType: null` and `sourceId: null`; runtime work can also carry nullable actor ids.

The direct crash path is therefore nullable actor/person data reaching `actorLabelWithOrigin` and then `isOpaqueIdentifier(value.trim())`. The source fields are part of the same Northwind nullable payload, but the stack points at actor label rendering.

## Change

- `mapRuntimeWorkRows` now normalizes nullable `assigneeId` / `authorityId` to an empty owner value before rows reach the table.
- `actorLabelWithOrigin` now accepts `unknown` and normalizes non-string values before directory/demo/UUID handling.
- `businessLabel` uses the same defensive normalization before calling `isOpaqueIdentifier`.
- Added a regression test that renders the Work surface with Northwind-shaped data: `/api/tasks` row with `sourceType: null`, `sourceId: null`, and runtime work task with `assigneeId: null`. The test asserts the Work surface renders and does not show `RouteErrorBoundary` / `Cannot read properties of null`.

## Evidence

- Focused Vitest: `npm exec vitest -- run src/components/Execution/__tests__/ExecutionWorkSurface.daneRealne.test.tsx --retry=0 --no-file-parallelism` → 9/9 PASS.
- `git diff --cached --check` → PASS.
- Staged language gate: `npm run check:jezyk:staged -- --przyklady 50` → PASS.
- Full language gate: `npm run check:jezyk:ci` → PASS (`K4obj -4`, `K5en -1`, `K8sen -3`).
- Server TypeScript: `npm run type-check:server` → PASS / 0.
- Front TypeScript: `npm run type-check` → RC 2, 167 total errors, 5 in `node_modules`, 0 in changed files. Log: `/tmp/a-pe2-work-crash-w213-front-tsc.log`.

## Boundaries

No migration, no deploy, no protected branch push, no staging/demo/Londyn/integracja push.
