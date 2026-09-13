# E1b — production forecast/progress feed preflight

Date: 2026-09-13 (America/Chicago)  
Mode: independent read-only source/SSOT review; no source, DB, port, build or runtime mutation.  
Reviewed moving root worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-w17-deck-autosave-20260912`. The owner integrated E1b during review. The reviewed feed-owning blobs were captured at `fee4f8eaec73156fdec1b9945d435265613b6883`; the worktree then advanced through an unrelated renderer-only repair to clean HEAD `a743a96c6302b6e81d030168e0c3cc687eaa1fee`. The feed-owning blobs listed below did not change.

## Verdict

**IMPLEMENTABLE WITHOUT A NEW SCHEMA; E1b remains PARTIAL until this feed is wired and proven.**

The durable current values already exist in `initiatives.progress`, `initiatives.forecast_start_date` and `initiatives.forecast_end_date`. The missing piece is an honest observation projection. Forecast and progress provenance is split across existing audit/history records, and two writers need special handling. The implementation must not copy current plan into forecast, use general `initiatives.updated_at` as observation time, or promote an unversioned current snapshot to historical truth.

The smallest aligned boundary is the existing Initiative list used by `ExecutionHub`, not the Execution Case aggregate. Forecast currently belongs to the Initiative row. Keeping it on `ExecutionBankCaseSource` would leave canonical Initiatives without a case permanently `UNKNOWN` even when they have a real forecast.

## Existing truth and ownership

### Current values

- `InitiativeController.getInitiatives` already selects `i.*` and returns progress plus baseline/current-plan/actual fields (`server/src/controllers/InitiativeController.ts:271-280`, `393-453`). Additive response fields can be produced without a second business table.
- The controller currently omits `forecast_start_date` and `forecast_end_date` from its response. Its canonical-header compatibility append also invents `progress: 0` (`server/src/controllers/InitiativeController.ts:515-525`). That fallback must be `null` with unavailable evidence.
- `PostgresInitiativeReader.listExecutionCases` reads only `ie_aggregate_state` case identity/version/state/manager/handoff (`server/src/domain/initiatives-execution/postgresInitiativeReader.ts:450-468`). It has no persisted forecast/progress and should remain the case identity source, not become a shadow value owner.

### Forecast writers and receipts

1. V8 `smooth` updates `initiatives.forecast_start_date` / `forecast_end_date` and writes `execution_audit_log.field_changed='smooth'` with old/new JSON (`server/src/routes/v8/execution-control.routes.ts:1258-1302`). Audit is best-effort (`1031-1058`), so a current value without a matching receipt is legitimate but its observation metadata is `UNKNOWN`.
2. V8 `replan` updates the same fields (`1393-1472`) and writes both `execution_audit_log.field_changed='replan'` and visible `initiative_history.action='reforecast'` (`1474-1500`). Both are after the value update and best-effort; a matching surviving record is usable provenance, absence is not permission to use `updated_at`.
3. Manager `scope_reduction` updates only `forecast_end_date` (`server/src/services/v8/managerActionExecutionService.ts:365-382`). Its transactional `manager_action_audit_log` receipt records only generic lane/problem/action text (`150-171`, `648-691`), not the forecast value. It cannot reconstruct or verify the field. Minimal writer hardening should record the exact old/new forecast end in the existing audit columns or add the same existing `initiative_history.reforecast` receipt inside the transaction. No new table is needed.
4. `GET /api/v8/execution-control/baseline-variance/:initiativeId` is not a valid feed. It falls back from forecast to start/planned and actual/planned dates (`server/src/routes/v8/execution-control.routes.ts:1802-1803`), which violates the E1b no-substitution rule.

### Progress writers and receipts

1. Quick update writes `initiatives.progress` and then best-effort `initiative_history.action='progress_updated'` with exact old/new JSON (`server/src/controllers/InitiativeController.ts:1845-1881`). A matching history row is an exact manual observation; a missing row yields unknown provenance.
2. Legacy `/api/execution-control/timeline-update` can write progress and then inserts an exact `execution_audit_log.field_changed='progress'` receipt (`server/src/routes/executionControl.routes.ts:207-275`).
3. `InitiativeProgressService.recalculateProgress` derives a priority-weighted task percentage and writes `initiatives.progress` without an observation receipt (`server/src/services/initiative/InitiativeProgressService.ts:20-88`). It also treats no tasks and null task progress as zero (`39-42`, `60-67`). The target canon says the exact production progress formula is still `UNKNOWN`, so this must be exposed as a named legacy formula with `PARTIAL` completeness, never silently promoted to canonical progress.

For current task-derived progress, the read model can batch-recompute the existing formula from tenant-scoped `tasks`, compare it with the persisted Initiative value, and use `MAX(tasks.updated_at)` as `observedAt` only when every included task has a valid progress observation and the recomputed value matches. No tasks, any missing task progress, mismatch/lag, or a controlled `asOf` before that timestamp returns `UNKNOWN`. A measured manual `0` with a matching receipt remains known zero.

## Required response contract

Use per-field envelopes. One shared `forecastObservedAt` is false after a start-only or end-only intervention.

```ts
type ExecutionBankSourceEvidence<T> = {
  value: T | null;
  observedAt: string | null;
  asOf: string;
  source: { system: string; recordId: string | null; formulaId: string | null; formulaVersion: number | null };
  completeness: 'KNOWN' | 'PARTIAL' | 'UNKNOWN';
  staleness: 'CURRENT' | 'STALE' | 'UNKNOWN';
  reason: string | null;
};

type InitiativeExecutionEvidence = {
  progressEvidence: ExecutionBankSourceEvidence<number>;
  forecastStartEvidence: ExecutionBankSourceEvidence<string>;
  forecastEndEvidence: ExecutionBankSourceEvidence<string>;
};
```

Rules:

- `asOf` is a validated request value echoed by the projection; future/invalid values are rejected. Default current requests may use the server request instant.
- A forecast field is known only when the current field value is valid and a latest matching `reforecast`, `replan` or `smooth` receipt explicitly contains that same field/value at or before `asOf`.
- Partial forecast writes are resolved independently per field. Do not assign the end-date receipt time to an unchanged start date.
- Current row plus an unmatched/generic audit is `UNKNOWN / OBSERVATION_MISSING` or `SOURCE_CONFLICT`. `initiatives.updated_at` is never `observedAt` because unrelated fields also update it.
- The existing manager `scope_reduction` receipt is insufficient. Historical rows written before its audit payload is hardened stay `UNKNOWN`; no date may be reverse-engineered from `created_at + 21d`.
- Progress is known from an exact matching `progress_updated`/`progress` receipt. Task-derived progress is known only under the strict match/completeness rule above and carries source `legacy-task-priority-weighted-progress`, formula version 1, and completeness `PARTIAL` because the target weight policy is unapproved.
- Missing value, invalid value, missing observation, observation after `asOf`, incomplete task inputs, and source conflict are distinct reasons. None becomes zero.
- No approved E1b freshness threshold exists in the binding canon. Set `staleness='UNKNOWN'` with `FRESHNESS_POLICY_MISSING`; do not invent 24h/7d or call `observedAt <= asOf` `CURRENT`. Enable `CURRENT/STALE` only after an approved policy supplies a threshold.
- This is a current-value projection with observation validity. It must not reconstruct an older Bank snapshot from current rows. If an older value cannot be proven from exact receipts, return `UNKNOWN / NO_EVENT_HISTORY_BEFORE_AS_OF`, matching `reportReconstruction.ts:24-29`.

## Smallest aligned implementation packet

1. Add one batch, tenant-scoped read service, preferably `server/src/services/initiative/executionBankEvidenceReadService.ts`. Input: organization ID, returned Initiative IDs, controlled `asOf`. It reads existing `initiatives`, `initiative_history`, `execution_audit_log`, `manager_action_audit_log` and current task inputs; no DDL and no writes.
2. Extend `server/src/controllers/InitiativeController.ts` list output with raw forecast values and the three evidence envelopes. Validate optional `asOf`; keep current list filtering/order. Set canonical aggregate-only compatibility rows to `progress:null` and all three envelopes to source unavailable/unknown.
3. Harden only `server/src/services/v8/managerActionExecutionService.ts` so future `scope_reduction` writes exact old/new forecast-end evidence into its existing transactional audit path. Preserve its existing authority, transaction and action semantics.
4. Extend `src/services/api.ts` `getInitiatives` with an optional `asOf` query for Execution Hub callers.
5. Move forecast provenance into `ExecutionBankInitiativeSource` in `src/components/Execution/executionBankModel.ts`; accept independent start/end evidence and progress evidence. Remove the default implication that a forecast came from `execution-case`. Preserve missing case identity behavior and current compatibility only as explicitly labelled fallback.
6. In `src/components/Execution/ExecutionHub.tsx`, pass controlled `executionBankAsOf`, refetch when it changes, and map the additive Initiative evidence. `listExecutionCases` continues to provide native case identity/state only.

This is the smallest coherent change because it covers case and no-case rows through the one Initiative list already fetched by the Hub. Adding forecast only to `/runtime-v1/execution-cases` would leave the already accepted no-case rows without their real persisted Initiative forecast.

## First behavioral RED and proof packet

Status: **RED SPECIFIED / NOT RUN** in this read-only review.

Primary proposed full name:

`E1b production Initiative projection exposes exact per-field replan and progress receipts at controlled asOf without relabeling updatedAt`

On the current source this fails because the Initiative list omits forecast and all observation metadata. Use the existing fresh synthetic RealPG harness in `tests/integration/execution-change-progress-spine.golden-flow.realdb.test.ts`:

1. Create the normal tenant-scoped Initiative/actor fixture.
2. Perform authorized quick-update `progress=42`, then V8 replan changing only `forecastEndDate` with an idempotency key.
3. Reopen through a fresh app instance and call `GET /api/initiatives?asOf=<after-writes>`.
4. Assert the same Initiative ID returns progress 42 and forecast end with the exact `initiative_history` source record IDs/timestamps; forecast start remains independently unknown unless its own receipt exists; staleness remains unknown because policy is absent.
5. Verify those source IDs directly in `initiative_history` / `execution_audit_log`, then render actual Hub/Bank and prove forecast variance uses forecast, not planned end.

Required negative denominator:

- current forecast inserted/changed without a matching receipt -> raw value may remain available to other legacy consumers, but Bank evidence is `UNKNOWN`, variance unknown;
- controlled `asOf` before the matching observation -> unknown, never current snapshot labelled historic;
- start-only then end-only interventions -> distinct source IDs/observedAt values;
- progress 0 with exact receipt -> known 0; null/no observation -> unknown;
- task-derived progress with one null task input or a persisted/recomputed mismatch -> unknown; complete matching inputs -> known with `PARTIAL` legacy formula metadata;
- manager `scope_reduction` after writer hardening -> exact end-date receipt; pre-hardening generic receipt -> unknown;
- foreign organization cannot obtain value or provenance; same authorized IDs reconcile across Initiative list, Bank row and direct SQL;
- route reload and browser Back/Forward with a changed `asOf` trigger a new evidence read and preserve native selection/query/hash.

Run the server RealPG test against fresh UUID fixtures with cleanup, then the existing E1b model/Hub mounted suites with the actual response shape. Fixture-only frontend GREEN is secondary; the release evidence must include SQL writer receipt -> HTTP read model -> mounted Bank readback for the same IDs and `asOf`.

## Reviewed source blobs at final capture

- `server/src/routes/v8/execution-control.routes.ts` — `d5aa00fb633ce49e1e1e952ddf34ad85d9e6aaf5`
- `server/src/routes/executionControl.routes.ts` — `ca06f4596259eea629aa0c524dd82e3e0f92dda9`
- `server/src/services/v8/managerActionExecutionService.ts` — `835c1d0e05ecda351671f8f4f8e00dc2baa94808`
- `server/src/services/initiative/InitiativeProgressService.ts` — `34fb1f41c65123907391c4bcb86c51c9f18e9078`
- `server/src/controllers/InitiativeController.ts` — `0a9a8fc073e30c75b8a0f95af70e0fc99e3fe5b1`
- `server/src/domain/initiatives-execution/postgresInitiativeReader.ts` — `88a39db200aa1c4ff9412e3bf20efaa53e1f3cfe`
- `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` — `ded64c36c61727be03465e1302efd4c4bdf320ed`
- `src/components/Execution/executionBankModel.ts` — `6c5013bae085de4239f828d6668b3020d33bc97b`
- `src/components/Execution/ExecutionHub.tsx` — `9d92454212d6d83e90312f0471ee653fab63696c`
- `docs/modules/initiatives-execution-canon/05_DOMAIN_DATA_API_EVENTS.md` — `da0177a3b5b3cac026bde821070968df3944e574`
- `docs/modules/initiatives-execution-canon/06_RUNTIME_MIGRATION_REUSE_AND_TESTS.md` — `739e35b74f2eaf887c99d627c40c2938be70bb72`
