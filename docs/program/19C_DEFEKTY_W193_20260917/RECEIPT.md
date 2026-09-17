# 19c-defekty W193 — receipt

Status: READY FOR CTO REVIEW.

Base/head before commit: `3eae3a68934b` (`origin/integracja/20260911`, newer than W193 minimum `1b662df8cd`). Branch: `codex/19c-defekty-w193-20260917`.

Scope delivered:
- B-E0: schedule risk no longer depends on cost EVM when schedule dates and progress exist. `scheduleHealth` can be measured from schedule/progress; value axes still return `NA` with explicit reasons such as `no-value-baseline`.
- B-E0 UI: risk axes carry a `reason`, support API aliases (`schedule`/`impact`/`promise`), and tooltips say why an axis is not measured instead of the generic baseline sentence.
- DRD-2: frozen technical output heading uses `session.name` with a `Session <short-id>` fallback, so Northwind sessions show the business name instead of the UUID prefix.
- KPI-1: new KPI card links use `?set=...`; old `?zbior=...` links remain readable. Empty Process / Response policy properties show an honest `Not set` instead of a bare dash while preserving stored business strings.
- P-E2: work report badges defensively normalize the visible `CalculatedNeutral` fallback to `Calculated · Neutral`; `work-intelligence` chip labeling already comes from `execution.reports.intelligence.workTab` and is documented as checked in code.
- A3: flag dependency recorded below; no env values were changed.

A3 flag dependency for one screen:
- frontend visibility: `VITE_INITIATIVE_APPROVAL_V2` / existing client-side approval flag family for the Initiative card UI;
- backend read/write adapter: `ENABLE_INITIATIVE_APPROVAL_V2` (`server/src/routes/pmo/definitionApprovalAdapter.ts`);
- governance/flow prerequisite: initiative execution runtime/governance approval data must be present for the organization/project, otherwise the adapter returns enabled-but-empty capability/data.

Known limits:
- W193 P-E2 source mismatch `100 tasks / 19 overdue / 3 blocked` versus generated analysis `0/0/0` needs CTO's API regeneration/readback. This package does not claim live staging proof for that data mismatch.
- W193 OB1-4 workload seed gap is explicitly D/Qoder scope, not changed here.
- No screenshots, per channel header.

Evidence:
- Exact lock: `npm ls @types/node --depth=0` => root, backend workspace, shared workspace all `@types/node@22.19.3`.
- Focused tests: `npx vitest run src/components/ResultsVNext/kpiTool/__tests__/kpiCardSetPath.w193.test.ts src/components/Execution/__tests__/executionRiskSignal.test.ts server/src/services/execution/__tests__/threeAxisReportService.w193.test.ts src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.frozenShell.test.tsx --retry=0` => 4 files, 23 tests PASS.
- Server TSC: `npm run -s type-check:server` => RC=2, `error TS` lines 1 total / 0 node_modules / 1 non-node; no changed-file hits. Existing error: `server/src/routes/presentations.routes.ts(611,3)`.
- Front TSC: `npm run -s type-check` => RC=2, `error TS` lines 152 total / 0 node_modules / 152 non-node; no changed-file hits.
- `git diff --check` => PASS.
