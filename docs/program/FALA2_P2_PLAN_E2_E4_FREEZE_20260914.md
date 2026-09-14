# P2 Plan — E2–E4 freeze

**Verdict: implementation is frozen on the required W56 line `19b633c81e` and is ready for independent review.**

- Branch: `codex/plan-inicjatyw-20260914`
- Required base: `19b633c81e262b9f3c2f25b0555b2dfceab8b42e`
- Frozen implementation: `04109287cd` (the freeze receipt is the following documentation-only commit)
- Decision marker: `[ODMROZENIE 05_INITIATIVES DEC-497]`
- Schema: unchanged; no migration
- Runtime gates: `VITE_INITIATIVES_PLAN=true` and `ENABLE_INITIATIVES_PLAN=true`; both fail closed and default OFF

## Delivered behavior

The Plan workspace starts the governed analysis command with `analysisKind=AI_DEPENDENCY`. The result presents grounded dependency observations for individual or bulk review. A manager can accept or reject every observation, edit its rationale and conditional trigger, and add a human comment. Accepted observations are persisted in the versioned JSON aggregate and written through the canonical dependency and Plan writers. The resulting order is stable and topological; existing human dependencies remain intact.

The exact-review HOLD is repaired in `04109287cd`. `ABSOLUTE` observations alone enter the hard `dependencySnapshot`. Accepted `CONDITIONAL` observations retain their condition and the manager-confirmed active state in `conditionalDependencySnapshot`. An inactive condition stays persisted and auditable without becoming a hard dependency; an active condition participates in solver ordering and Gantt connectors while remaining typed as conditional.

Critical paths retain the `ABSOLUTE` and `CONDITIONAL` distinction. The timeline reuses `Initiatives/gantt/InitiativeGantt.tsx` and offers 1/3/6/12-month horizons: 1 and 3 use weekly zoom, while 6 and 12 use monthly zoom. Initiatives already in execution are frozen and rendered in dark navy. The Plan tab stays inside the complete Initiatives Hub shell and keeps canonical Menu 3 behavior.

All new user-facing copy is available in English and Polish, with English first. Lists continue through the canonical list and preview components; the package adds no competing table implementation.

## Verification after the W56 rebase

- Rebase: no conflicts; merge base equals `19b633c81e`.
- Focused tests: 11 files, 28 tests, all passed with `--retry=0`.
- HOLD repair tests: 5 affected files, 18 tests, all passed. The RED test first proved that an inactive condition was flattened to a hard edge; GREEN proves inactive and active behavior in the helper, canonical writer flow, and solver.
- Real PostgreSQL: `cx-a-b-plan-pg` on port 5300, `RUN_DB_TESTS=1`, `MOCK_DB=false`; 1 file, 1 test passed. Readback proves proposal version 2, two accepted observations, and retained `CONDITIONAL` kind, exact condition, and `conditionActive=false` review state.
- Server TypeScript: W56 base 0 errors / candidate 0 errors, both exit code 0 with 8 GB heap.
- Frontend TypeScript: the W56 base and candidate both reached the mandatory 120-second ceiling before emitting diagnostics. On the preceding exact W54 base, the base measured 177 existing errors and the candidate measured 178; the only added error was the stale Plan history-tab symbol in `InitiativesHub.tsx`. It was repaired before W56 in the rebased implementation. This is explicit timeout evidence, not a green global frontend TypeScript claim.
- Per-file esbuild for the HOLD repair: four affected frontend production files and four affected server production files passed.
- UI evidence: 12 JPEG files, 847,179 bytes total. EN/PL × light/dark × full/empty are present; the four full-state captures were regenerated and show the explicit condition-active control. Four timeline captures prove horizon controls, critical paths, and the frozen in-progress bar.

## Evidence boundary

The E1 external-provider success probe remains `NOT_PROVEN` because the package environment has no configured premium provider. Provider failure remains fail-closed. The E2–E4 behavior is proven with the real command path, focused behavior tests, and PostgreSQL readback.

Applying accepted observations uses the existing dependency writer, Plan writer, and analysis-review writer in sequence. Each writer is versioned and fail-visible, but the three HTTP writes are not one database transaction. An interrupted sequence can require retry from the latest readback.

This author stops at freeze. Independent review and acceptance belong to a different agent and CTO.
