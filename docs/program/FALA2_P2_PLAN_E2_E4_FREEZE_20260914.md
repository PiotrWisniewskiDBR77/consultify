# P2 Plan — E2–E4 freeze

**Verdict: Plan v2 is frozen on the required W59 line `a2b0a0fe32` and is ready for independent review.**

- Branch: `codex/plan-inicjatyw-20260914`
- Required base: `a2b0a0fe32f2a3f137d919ad81248b9da0f54edd`
- Frozen implementation: `e3cfa2ab2730a6003f8d94c8be892738b6762b24` (the freeze receipt is the following documentation-only commit)
- Decision marker: `[ODMROZENIE 05_INITIATIVES DEC-497]`
- Schema: unchanged; no migration
- Runtime gates: `VITE_INITIATIVES_PLAN=true` and `ENABLE_INITIATIVES_PLAN=true`; both fail closed and default OFF for the Wave 2 dependency-analysis additions. The established Plan tab, solver path, and Plan routes remain available at OFF.

## Delivered behavior

The Plan workspace starts the governed analysis command with `analysisKind=AI_DEPENDENCY`. The result presents grounded dependency observations for individual or bulk review. A manager can accept or reject every observation, edit its rationale and conditional trigger, and add a human comment. Accepted observations are persisted in the versioned JSON aggregate and written through the canonical dependency and Plan writers. The resulting order is stable and topological; existing human dependencies remain intact.

The exact-review HOLD is repaired in `04109287cd`. `ABSOLUTE` observations alone enter the hard `dependencySnapshot`. Accepted `CONDITIONAL` observations retain their condition and the manager-confirmed active state in `conditionalDependencySnapshot`. An inactive condition stays persisted and auditable without becoming a hard dependency; an active condition participates in solver ordering and Gantt connectors while remaining typed as conditional.

Critical paths retain the `ABSOLUTE` and `CONDITIONAL` distinction. The timeline reuses `Initiatives/gantt/InitiativeGantt.tsx` and offers 1/3/6/12-month horizons: 1 and 3 use weekly zoom, while 6 and 12 use monthly zoom. Initiatives already in execution are frozen and rendered in dark navy. The Plan tab stays inside the complete Initiatives Hub shell and keeps canonical Menu 3 behavior.

All new user-facing copy is available in English and Polish, with English first. Lists continue through the canonical list and preview components; the package adds no competing table implementation.

## Verification after the W59 v2 rebase

- Rebase: no conflicts; merge base equals `a2b0a0fe32`.
- Focused tests: 14 files, 47 tests, all passed with `--retry=0`. This includes both unchanged Menu 2 regression suites: Plan remains the second of three established destinations at flag OFF.
- OFF parity: `/planning`, `/plan-scenarios`, and `/plan-analysis-proposals` reach their established handlers at OFF. `AI_DEPENDENCY`, observation review, and persistence of `conditionalDependencySnapshot` fail closed with `FEATURE_DISABLED` until the Wave 2 flag is ON.
- HOLD repair tests: 4 non-database files / 14 tests passed, plus 1 Real PostgreSQL file / 1 test passed: 5 files and 15/15 tests in total. The RED artifact runs the regression assertion on exact pre-fix parent `8a2a58930e` and exits 1 because the inactive conditional observation is received as hard edge `["A"]` instead of `[]`. GREEN proves inactive and active behavior in the helper, canonical writer flow, and solver.
- Real PostgreSQL: `cx-a-b-plan-pg` on port 5300, `RUN_DB_TESTS=1`, `MOCK_DB=false`; 1 file, 1 test passed. Readback proves proposal version 2, two accepted observations, and retained `CONDITIONAL` kind, exact condition, and `conditionActive=false` review state.
- Server TypeScript: exact base 0 errors / candidate 0 errors with 8 GB heap.
- Frontend TypeScript: exact base 177 existing errors (CTO W58 measurement) / candidate 177 errors (fresh candidate measurement), so the delta is 0. This is numeric parity, not a green global frontend TypeScript claim.
- Per-file esbuild: three affected frontend production files and the affected server route passed.
- UI evidence: 12 fresh JPEG files, 1,244,266 bytes total. EN/PL × light/dark × full/empty are present; full-state captures show the canonical dependency-type dropdown. Four timeline captures prove horizon controls, critical paths, and the frozen in-progress bar.
- Reproducible logs: `conditional-dependency-red.log` records the exact pre-fix parent, command, failing assertion, and exit 1; `conditional-dependency-green.log` records 4/4 files and 14/14 non-database tests; `conditional-dependency-realpg-green.log` records 1/1 file and 1/1 database test with local database identity and redacted credentials.

## Evidence boundary

The E1 external-provider success probe remains `NOT_PROVEN` because the package environment has no configured premium provider. Provider failure remains fail-closed. The E2–E4 behavior is proven with the real command path, focused behavior tests, and PostgreSQL readback.

Applying accepted observations uses the existing dependency writer, Plan writer, and analysis-review writer in sequence. Each writer is versioned and fail-visible, but the three HTTP writes are not one database transaction. An interrupted sequence can require retry from the latest readback.

This author stops at freeze. Independent review and acceptance belong to a different agent and CTO.
