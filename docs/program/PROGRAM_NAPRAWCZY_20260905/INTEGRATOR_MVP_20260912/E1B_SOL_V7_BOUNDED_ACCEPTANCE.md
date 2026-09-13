# E1b Sol independent bounded acceptance — V7

Date: 2026-09-13
Worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-execution-bank-views-20260913`
Base/HEAD: `8991ceb703dc0d466eb3a96e096f053a5eeb14f1`
Scope: independent source and targeted jsdom review. No DB, build, ports, business writes, commit, or product-source edit by reviewer.

## Verdict and integration disposition

**SCOPED ACCEPT for integration of frozen V7.** The bounded Execution Bank model, four read-only renderers, nullable numeric adapter, and navigation/selection repairs meet their reviewed behavior. Root may proceed with normal-hook commit and integrate this slice.

This is **not full E1b acceptance**. The real Execution Case bulk DTO still lacks the forecast observation/source/completeness/staleness feed represented by the rich fixture. Runtime forecast-based variance therefore remains **OPEN / PARTIAL / NOT PROVEN**. Missing forecast must remain UNKNOWN; current plan must not be substituted.

## Accepted behavior

- Table, Kanban, Calendar and Gantt expose the same native `(initiativeId, executionCaseId|null)` multiset with no omissions or duplicates.
- Table/Gantt retain global source order; Kanban and Calendar retain source order inside semantic columns/buckets.
- A canonical Initiative without an Execution Case remains visible, selectable, highlighted with `aria-selected=true`, preserved across view change, and restored after cold reload using typed row identity `initiative:<initiativeId>`. No Execution Case ID is fabricated; historical case-ID URLs still resolve.
- User selection preserves scope and hash and invokes no mutation transport.
- Controlled `asOf` rehydrates on browser Back and Forward.
- Gantt axis and row tracks share the same 110px/620px grid and 1000-unit SVG coordinate width. Baseline/current-plan/forecast/actual geometry derives only from known dates and moves with the horizon; unknown/invalid/outside values receive no invented geometry.
- Missing or blank Execution Case version/blocker/pending-decision values remain `null`; a real numeric or numeric-string zero remains `0`.
- Nullable Initiative progress remains `null`, distinct from measured zero, in both controller list responses.
- User-facing UI does not surface raw reason codes or UUID pairs as primary copy.

## Reviewer correction

The earlier global Kanban DOM-order RED is preserved as overstrict instrumentation, not a product defect. The corrected invariant follows `INITIATIVES_EXECUTION_FUNCTIONS_CANON` §4.2 and §10.3: same dataset, scope, filters and selection, with stable sort inside semantic groups. The corrected preflight is `E1B_SOL_BOUNDED_PREFLIGHT.md`, SHA256 `056c4055547a42fbcb4b1cf4fc3ac95d87ef3f5defc94de87c457377499c5f7b`.

## Frozen evidence

Author checkpoint:

- `E1B_FINAL_CHECKPOINT_V7_20260913T070802Z.md`
- SHA256 `b4fc9b349ecafd2ba8543cc02548feeac6631bc072e12dc5124ff8f6cff97905`

Independent exact run:

- `E1B_SOL_GREEN_V7_20260913T071500Z.json`
- SHA256 `39baf86fbe093f3e3c7810c309d4fda36bff33eda4618ebc1e76ae8edf7ec0a6`
- exact command requested 9 test files
- Vitest JSON reports 18/18 suites, 44 tests passed, 0 failed; exit 0
- `git diff --check`: PASS

Relevant preserved REDs:

- no-case click/reload before row-identity fix: `E1B_SOL_NO_CASE_SELECTION_RED_FINAL_20260913T070600Z.json`, SHA256 `3808aada6c7db1202838bbb8e49564391e33c1ac3e57390f36d892e047e9365b`
- no-case visual highlight before V7: `E1B_SOL_NO_CASE_HIGHLIGHT_RED_20260913T071200Z.json`, SHA256 `f95a2c2fe441584158ad68faa26fcbfa00c8d9256eeace70df82ec3f3d00b2a0`
- overstrict Kanban-order instrumentation retained as reviewer correction: `E1B_SOL_VISIBLE_ORDER_RED_ALL_20260913T065600Z.json`, SHA256 `80d830199a55a11da7508a9411eec5cd208746051cd5fa9c8d17df2129dfc929`

Verified V7 Git blobs:

- `server/src/controllers/InitiativeController.ts`: `0a9a8fc073e30c75b8a0f95af70e0fc99e3fe5b1`
- `src/components/Execution/ExecutionHub.tsx`: `9d92454212d6d83e90312f0471ee653fab63696c`
- `server/src/controllers/__tests__/InitiativeController.e1bNullableProgress.test.ts`: `ede48e42678ac35fcb6e4460c9a4e66e01d42b85`
- `src/components/Execution/ExecutionBankViews.tsx`: `613c150fab65b104199a818ea274fa0306a419a0`
- `src/components/Execution/__tests__/executionBankModel.test.ts`: `6c5e71aaffff21b0c2568512ce7f09bbe0c7fa94`
- `src/components/Execution/executionBankModel.ts`: `6c5013bae085de4239f828d6668b3020d33bc97b`
- `tests/components/Execution/ExecutionBankViews.behavior.test.tsx`: `405c6957c6f8645932b3e9131f00ab227b21b31a`
- `tests/components/Execution/ExecutionHub.e1bBankViews.behavior.test.tsx`: `0c4057a9061ec10f1db36d3e115fd21bb0db10c0`
- `tests/components/Execution/ExecutionHub.e1bReviewerGaps.behavior.test.tsx`: `d661f828eb84bbcf4142c1ec8d76b8c6c9316b4f`
