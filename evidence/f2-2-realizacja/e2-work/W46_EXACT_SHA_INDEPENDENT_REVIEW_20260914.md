# S4 F2-2 Praca — Wpis 46 exact-SHA independent review

**Verdict: HOLD for exact freeze `31828c73eff0feb56b730d5c484dedb5ffa1daae` on base `eba9d72ad9c730728b212ee7826164519e4d095c`.** The identity fix, manifest, RealPG receipt, W45 UI canon and visual evidence pass, but two of the three reported “inherited” red tests are new regressions introduced by the candidate after its required rebase.

## P1 — two candidate regressions were classified as inherited

The test files and their assertions are unchanged from the W46 base, while `ExecutionHub.tsx` changed the exact expressions they protect:

1. `src/components/Execution/__tests__/ExecutionHub.daneRealne.source.test.ts` is **11/12** on the candidate. The base contains `onTimeFromInitiatives(dashboardBaseInitiatives)`; the candidate changes it to `onTimeFromInitiatives(dashboardBaseInitiatives as any)`. The unchanged assertion at line 82 requires the base expression.
2. `src/components/Execution/__tests__/ExecutionHub.kokpitRaidOblozenie.source.test.ts` is **7/8** on the candidate. The base contains `dashboardBaseInitiatives.filter((i) => isBlockedInitiative(i))`; the candidate changes it to `isBlockedInitiative(i as any)`. The unchanged assertion at line 116 requires the base expression.

These two tests were green on base `eba9d72ad9` by exact source/assertion comparison and are red on the candidate in fresh `--retry=0` runs. They therefore cannot be counted as inherited. The required closure is to restore a type-correct production expression that preserves both contracts, without weakening the assertions, then rerun the full caller/sibling gate and refresh the exact freeze.

The third red, `tests/components/Execution/ExecutionHub.k5Naprawy.behavior.test.tsx` **5/6**, remains the single inherited failure: the unchanged word-counter behavior in `StandardPreview` is outside the S4 identity change.

## Passing evidence

- **Identity contract:** `buildExecutionBankRows` defaults to `LEGACY`; `ExecutionHub` explicitly selects `INITIATIVE` only for the enabled four-button surface. The direct caller inventory covers `ExecutionHub`, `ExecutionBankViews` behavior/K5/value-cleared, `executionBankHandoff`, Fala B, `executionBankModel`, accepted-baseline projection, change-progress RealPG and native-baseline RealPG. Calls that require initiative projection opt in; legacy siblings retain the default.
- **Three required identity regressions:** fresh independent runs are **20/20 PASS** without assertion changes: K5 7/7, value-cleared 1/1, and change/progress Gateway/JWT/real PostgreSQL 12/12 on `127.0.0.1:5290/consultify_s4_w43`.
- **Manifest:** self-excluding, base/content identities correct, content is the direct parent of the freeze, **70/70** selected paths match, and all byte counts plus SHA-256 values match Git blobs. Evidence is exactly **1,464,131 B**.
- **Recorded full gate:** 35 exact test files report 254 green and three red. The numeric result is consistent with fresh spot checks, but only one red is inherited; the two source-test reds above belong to this candidate.
- **Type/build receipts:** frontend tsc is recorded as base 189 to candidate 177; the candidate run remains red as expected for repository debt. Server tsc with 8 GiB heap exits 0, and the production build receipt exits 0. The reduced frontend diagnostic count does not override the two behavior-contract regressions.
- **W45 canon:** preview Open has a real handler when reachable; manager actions use typed `warning`/`neutral` variants; the empty state uses the typed `StandardTable` empty contract. The real canon test is 5/5.
- **UI:** all eight 1440×900 full-`ExecutionHub` captures were inspected: empty/populated × EN/PL × light/dark. Populated variants show 3 previous-week, 3 next-week and 6 next-month events, the Project column, standard table/preview and a reachable Open. Empty variants render the canonical empty state. The capture receipt reports zero console/page/HTTP errors.
- **Other gates:** no conflict markers, `git diff --check` passes, feature flags remain default OFF, and the Q2 Work report route/visibility condition remains preserved after rebase.

No implementation, migration, deployment, Railway setting or protected branch was changed by the reviewer.
