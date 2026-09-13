# E1a Sol independent review — Execution navigation

Date: 2026-09-13

## Verdict

**ACCEPT the bounded seven-file E1a source/test delta for integration by the frozen blob and SHA-256 identities below.** No source blocker was found in the four-function Menu 2, legacy subview aliases, disabled-dashboard behavior, typed document identity, cold Initiative identity, or navigation parser/serializer.

This is not full E1a runtime acceptance. The only reproducible author suite is 24/24. The historical mounted-Hub/route 10/10 run has no retained command or exact file list and is not counted; therefore actual mounted click/Back/Forward/cold-render behavior remains `NOT_PROVEN` at this checkpoint. E1b–E1d and full Realizacja remain explicitly unaccepted.

## Frozen identity

- Worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-execution-bank-20260912`
- Base HEAD: `691982300372a9bdb9e506a4414e92ebbcd3e968`
- WIP state: seven intended files only; no reviewer source edits
- Author checkpoint: `/Users/piotrwisniewski/Developer/consultify-handoff-docs/integrator-20260912/E1A_FINAL_CHECKPOINT.md`

| File | Git blob | SHA-256 |
| --- | --- | --- |
| `src/components/Execution/ExecutionHub.tsx` | `fa9c79f51802de872c4307f84f8173344615abb7` | `1817abac0572d31b44d53c21d8cc2d4583c66d908b0b55fbc317643323654556` |
| `src/components/Execution/executionModuleTabs.ts` | `8656d499074ac3f47175d7b4d40f5ba1d18b87f4` | `773794baed5b5876b81a72cd605d3942478ebbf97b497408b6f377333c3e4f3a` |
| `src/components/Execution/executionNavigationState.ts` | `ae132eaac43bbc21ad38c7a283796bfb8af25c06` | `3d03b3c5380144787bb6d294c2c8ec2f946ab100882f95a7f1c414717b12164d` |
| `src/components/Execution/__tests__/ExecutionHub.kokpitMenu3.source.test.ts` | `fbd4f4737846d112879b5920f11884661b2228ad` | `01612251895ebdb3d948c44228973089258084f0ecb99a44626edfc67e0950cc` |
| `src/components/Execution/__tests__/executionModuleTabs.test.ts` | `466ad9faeb3774c27d6c26b7a760eb0efeaa0cef` | `306b7dd6bbb59cafdcae73c9506153f371df9e802136a979002a86b8ec8e5551` |
| `src/components/Execution/__tests__/executionNavigationState.test.ts` | `63e5a7002ff9e47e1cb4fde3ef65f676714de29c` | `d2ce9976e2252f3b588529de7f4170b80eb0799ed9b15a56995d3eaafc1ecc8c` |
| `tests/components/Execution/ExecutionHub.t33-rollout-routing.investigation.test.ts` | `6fddeca94d964cb1f6c32c27a414375fb6a09229` | `93c6e3bdb879d2c93c0c77df51d8ffd3e9e02d06122f76c4818edbbd5e0e931c` |

All Git blobs match `E1A_FINAL_CHECKPOINT.md`; hashes remained unchanged after independent tests. `git diff --check` passed.

## Source conclusion

- Menu 2 is exactly `Bank realizacji → Praca → Zarządzanie ryzykiem → Raporty` with identical membership when the summary flag is on or off.
- `resources` resolves to Work/Resources; `summary` and `rollout` resolve beneath Reports; risk/control aliases converge on Risk management without additional Menu 2 entries.
- With the summary flag off, the parser retains Reports context and emits `SUMMARY_DISABLED`; Hub renders an explicit warning and the Reports surface rather than silently falling back to the Bank.
- The navigation state preserves query parameters and route hash, normalizes `grid → kanban` and `timeline → gantt`, and distinguishes user navigation (`push`) from URL synchronization (`replace`).
- Cold `initiativeId` becomes a typed Initiative document. Work/report/intelligence identities serialize through `documentKind`/`documentId`; `work:<case>:<work>` is not copied into `initiativeId` and the existing render branch handles it before the Initiative fallback.
- Unknown tabs/subviews and unsupported entity/document kinds retain an explicit issue and do not manufacture an Initiative identity.

## Independent evidence

Qualifying frozen-change suite, exact four files from the checkpoint: **24/24 PASS**.

Additional independent regressions: **15/15 PASS** across these exact files:

- `src/components/Execution/__tests__/ExecutionHub.workDeepLink.source.test.ts` — 3
- `src/components/Execution/__tests__/ExecutionHub.sourceRelation.render.test.tsx` — 3
- `src/components/Execution/__tests__/ExecutionHub.entityLookup.test.tsx` — 3
- `src/routes/__tests__/executionCanonicalRoute.test.ts` — 6 (including two generated `it.each` cases)

These additional tests support work-prefix routing, real entity lookup, mounted source-relation rendering and canonical route/query/hash redirects. They do not mount the complete `ExecutionHub` navigation lifecycle, so they are not substituted for the unrepeatable historical mounted run.

The reported mocked-fetch `res.clone` stderr belongs to that historical run. Without its command/output identity it is retained only as author-reported context and contributes zero independent passes or failures here.

## Remaining acceptance boundary

After integration, add or preserve one repeatable `MemoryRouter`/real-router mounted test that clicks between the four Menu 2 functions and the Resources/Summary/Rollout subviews, opens typed Initiative and Work documents, then exercises Back and Forward while asserting function, subview, view, preset, filters, selection, document identity and hash. That is the missing proof for an E1a runtime-complete claim.

No DB, API, ports, build, tsc, migration, live action, commit, push or deployment was performed. E1b four Bank views, E1c full subview reachability, E1d legal lineage/bulk identity and full E1 remain `NOT_PROVEN`.
