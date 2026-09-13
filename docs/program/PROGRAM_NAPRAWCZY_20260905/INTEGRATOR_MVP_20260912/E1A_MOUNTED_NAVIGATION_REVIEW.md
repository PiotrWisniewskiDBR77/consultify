# E1a mounted navigation — independent behavioral review

Date: 2026-09-13  
Worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-execution-bank-20260912`  
Base HEAD during RED: `691982300372a9bdb9e506a4414e92ebbcd3e968`

## Scope and harness

Additive mounted test:

`tests/components/Execution/ExecutionHub.e1aNavigation.behavior.test.tsx`

The harness mounts the actual `ExecutionHub` inside the real React Router
`MemoryRouter`. It also keeps the actual `StandardModuleBar`,
`executionNavigationState` and `executionModuleTabs`. Only data sources,
side-panel infrastructure and domain child surfaces are mocked. Each child
surface has a distinct rendered sentinel, so the assertions prove which branch
the actual Hub selected.

Final test hash after restoring the real router hook:

- Git blob: `148a2d04a26b01ecd04c5b59d2b04cc032b866e5`
- SHA-256: `9b355ae05d4691005347b28dd0e30647c53d5b192c2f63cbac31143f2c1733d1`

## Instrumentation result retained for the audit trail

Command:

```text
npx vitest run tests/components/Execution/ExecutionHub.e1aNavigation.behavior.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=json --outputFile=/Users/piotrwisniewski/Developer/consultify-handoff-docs/integrator-20260912/E1A_MOUNTED_NAVIGATION_RED.json
```

Result: **5 passed, 1 failed**; exit `1`.

This was an instrumentation failure, not a confirmed product defect.
`tests/setup.ts` globally replaces `react-router-dom.useNavigate` with a no-op.
The first harness used real `MemoryRouter` and `useLocation`, but did not yet
undo that global hook mock. Consequently the Hub changed its rendered state
while the test router could not receive a navigation command. The raw result is
retained as `E1A_MOUNTED_NAVIGATION_RED.json` and must not be counted as a
product RED.

Passing behavior:

1. cold `initiativeId` renders the initiative card with the same ID;
2. typed `work:` identity renders Work and never the initiative card;
3. Resources renders under Menu 2 Work;
4. Rollout renders under Menu 2 Reports;
5. disabled Summary renders Reports plus the honest `Dashboard unavailable`
   callout.

Observed behavior with the globally mocked `useNavigate`:

1. enter
   `/execution?tab=resources&subview=resources&view=kanban&preset=capacity&filters=red&selection=i-8&returnContext=portfolio#row-i-8`;
2. click the actual Menu 2 `Reports` tab;
3. the actual Hub renders `ExecutionReportsSurface`, but `MemoryRouter` remains
   at the exact Resources URL and records no new location;
4. therefore browser Back/Forward cannot return between those surfaces.

The harness now explicitly calls `vi.unmock('react-router-dom')` before imports,
which restores the real router hooks while leaving the actual Hub and navigation
functions unchanged.

## Final mounted result

Command:

```text
npx vitest run tests/components/Execution/ExecutionHub.e1aNavigation.behavior.test.tsx --no-file-parallelism --maxWorkers=1 --reporter=json --outputFile=/Users/piotrwisniewski/Developer/consultify-handoff-docs/integrator-20260912/E1A_MOUNTED_NAVIGATION_GREEN.json
```

Result: **6 passed, 0 failed**; exit `0`.

The sixth test proves the whole mounted interaction:

1. enter a Resources deep link carrying `view`, `preset`, `filters`,
   `selection`, `returnContext` and a hash;
2. click the actual Menu 2 `Reports` tab;
3. observe the Reports surface and a pushed Reports URL;
4. click browser Back and observe Resources under Menu 2 Work with the saved
   query context and hash;
5. click browser Forward and observe Reports again with the same context and
   hash.

No E1a product source change was needed for this retest. The mounted navigation
acceptance is **ACCEPT** for the reviewed E1a scope. This does not extend to
later E1b–E1d work.

RED source hashes:

- `ExecutionHub.tsx`: Git blob `fa9c79f51802de872c4307f84f8173344615abb7`, SHA-256 `1817abac0572d31b44d53c21d8cc2d4583c66d908b0b55fbc317643323654556`
- `executionNavigationState.ts`: Git blob `ae132eaac43bbc21ad38c7a283796bfb8af25c06`, SHA-256 `3d03b3c5380144787bb6d294c2c8ec2f946ab100882f95a7f1c414717b12164d`
- `executionModuleTabs.ts`: Git blob `8656d499074ac3f47175d7b4d40f5ba1d18b87f4`, SHA-256 `773794baed5b5876b81a72cd605d3942478ebbf97b497408b6f377333c3e4f3a`
