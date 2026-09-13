# E1a final checkpoint — Execution Hub routing and cold identity

- Worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-execution-bank-20260912`
- Branch: `codex/execution-bank-20260912`
- Base / HEAD at freeze: `691982300372a9bdb9e506a4414e92ebbcd3e968`
- Status: frozen WIP, no commit, no push, no build, no DB or ports.

## Frozen artifact blobs

| File | Git blob |
| --- | --- |
| `src/components/Execution/ExecutionHub.tsx` | `fa9c79f51802de872c4307f84f8173344615abb7` |
| `src/components/Execution/executionModuleTabs.ts` | `8656d499074ac3f47175d7b4d40f5ba1d18b87f4` |
| `src/components/Execution/executionNavigationState.ts` | `ae132eaac43bbc21ad38c7a283796bfb8af25c06` |
| `src/components/Execution/__tests__/ExecutionHub.kokpitMenu3.source.test.ts` | `fbd4f4737846d112879b5920f11884661b2228ad` |
| `src/components/Execution/__tests__/executionModuleTabs.test.ts` | `466ad9faeb3774c27d6c26b7a760eb0efeaa0cef` |
| `src/components/Execution/__tests__/executionNavigationState.test.ts` | `63e5a7002ff9e47e1cb4fde3ef65f676714de29c` |
| `tests/components/Execution/ExecutionHub.t33-rollout-routing.investigation.test.ts` | `6fddeca94d964cb1f6c32c27a414375fb6a09229` |

Historic manifest digest was reported but the underlying manifest was not retained; it is not accepted as evidence. Use the actual per-file identities independently verified in E1A_SOL_INDEPENDENT_REVIEW.md.

Tracked sparse dependency `packages/shared/src/constants/initiativeStatuses.generated.ts` remained unchanged and matched HEAD blob `ab9363a8756b7d1e72268e1c0db91100ccca9f91`.

## Behavioral evidence

The final frozen-change run covered these four files:

1. `src/components/Execution/__tests__/ExecutionHub.kokpitMenu3.source.test.ts`
2. `src/components/Execution/__tests__/executionModuleTabs.test.ts`
3. `src/components/Execution/__tests__/executionNavigationState.test.ts`
4. `tests/components/Execution/ExecutionHub.t33-rollout-routing.investigation.test.ts`

Command:

```bash
npx vitest run \
  src/components/Execution/__tests__/ExecutionHub.kokpitMenu3.source.test.ts \
  src/components/Execution/__tests__/executionModuleTabs.test.ts \
  src/components/Execution/__tests__/executionNavigationState.test.ts \
  tests/components/Execution/ExecutionHub.t33-rollout-routing.investigation.test.ts \
  --maxWorkers=1 --maxConcurrency=1
```

Result at freeze and independently rechecked by the reviewer: **4 test files passed, 24 tests passed**. A separate mounted Hub plus route-state run was recorded as **10/10 passed**, for a total reported evidence count of **34/34**, not 37. Its exact historic command was not retained in the handoff, so this checkpoint does not invent a file list for that run. The mounted suite emitted expected mocked-fetch `res.clone` stderr while exiting 0. Scoped ESLint and `git diff --check` were clean.

The T33 test in the 24-test run was converted from source-anchor inspection to behavior-level adapter coverage.

Root correction: table paths and sparse dependency verified against current tracked files and exact Git blobs. Historic totals 34/37 remain unverified and contribute zero accepted evidence.
