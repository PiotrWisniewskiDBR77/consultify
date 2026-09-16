# FEEDBACK-1 / 1g — My Work Overdue canonical filter

**Verdict: READY FOR CTO REVIEW after W170 correction; independent ACCEPT (`P0=0`, `P1=0`, `P2=0`).** The real My Work hub now uses one canonical filter contract in the list, Kanban, and calendar surfaces; a 57-task mounted-hub regression proves that the `Overdue` Menu 3 pill narrows the table to 2 rows and preserves the same 2 tasks after switching to Kanban and Calendar.

- Base after final rebase: `1ca425abfa26e92aa1e6f975105ceb62e57884d1`
- Branch: `codex/feedback-1-1g-fix-w170-20260917`
- Freeze marker for the final commit: `[ODMROZENIE 07_MY_WORK_AGENT DEC-575]`
- Feature flag: none (production defect repair)
- Locale/catalog changes: EN+PL chart fallback keys for Deck Builder
- Staging writes, deploys, Railway changes, screenshots: none

## Measured diagnosis

At the base revision, `MyWorkHub` already passed one `taskFilter` state to all three task views, but each view implemented its own date/status predicate and its own counts. The list additionally used a separate group selector. That duplication let the Menu 3 badge and visible rows drift and already gave `week` different boundaries between the list, Kanban, and calendar. The accepted K-31 unit test exercised only the extracted list selector, not the mounted hub or Kanban.

## Change

- Added `taskHubFilter.ts` as the single source for completed status, urgent priority, local-day time buckets, `New` recency/triage state, search, filtering, and counts.
- Wired `MyTasksListContent`, `TasksKanbanBoard`, and `TasksCalendarView` to that contract, including one persisted set of triaged task IDs for `New`.
- Removed the list-only grouped selector and duplicated Kanban/calendar predicates.
- Kept `categorizeTask` as a compatibility export backed by the canonical time-bucket function.
- Fixed Calendar so active `Overdue` renders every matching old task instead of hiding the overdue surface and limiting output to the current seven-day grid.
- Added a mounted production-hub regression with 57 API tasks: All = 57, click `Overdue` = 2 table rows, switch to Kanban = the same 2 cards, switch to Calendar = the same 2 old tasks.
- Added transition evidence that triaging a recent task changes `New` from 1 to 0, plus Today/Week/Urgent filter-to-count parity.

- Normalized PostgreSQL `DATE` strings as local calendar days, so `YYYY-MM-DD` does not move from Today to Overdue in negative UTC offsets; Calendar uses the same local date key for headers and rows.
- Defined `This week` as the current local Monday–Sunday boundary and pinned its Sunday/Monday regression.
- Aligned all three task surfaces to `includeDone: true` and `limit: 500` before applying the canonical predicates.
- W155: replaced hardcoded Polish Deck chart fallbacks with pure adapter inputs, deterministic English defaults and EN/PL i18n values from `ChartBlock`; authored labels remain authoritative.

## Evidence

W170 repaired two false or brittle checks without changing production behavior:

- the completed-task readback test matches the behavior-bearing `includeDone: true` property and tolerates the canonical `limit: 500` option;
- the mounted hub uses PostgreSQL `DATE` fixtures (`YYYY-MM-DD`) for `dueDate`, and directly proves that `parseTaskHubDate('2026-09-17')` remains local midnight on calendar day 17.

Independent mutation proof:

- `includeDone: true` changed to `false` → readback test RED;
- `includeDone` removed → readback test RED;
- local-date parser reverted to `new Date(value)` under `TZ=America/Chicago` → both local-midnight and mounted 57→2 assertions RED (3 overdue rows observed).

Final W170 focused result: Chicago **3/3 PASS**, Warsaw **3/3 PASS**, `--retry=0`.

Focused command:

```text
npx vitest run \
  src/components/MyWork/__tests__/MyTasksList.k31.test.ts \
  tests/components/MyWork/MyWorkHub.overdueCanonicalFilter.test.tsx \
  src/components/MyWork/__tests__/TasksKanbanBoard.canonCard.test.tsx \
  src/components/Presentations/DeckBuilder/__tests__/deckChartAdapter.i18n.test.ts \
  tests/unit/deliverables/deckChartAdapter.test.ts \
  --retry=0 --no-file-parallelism --reporter=dot
```

Result after final rebase and review fixes: **5 files / 32 tests PASS / retry 0**.

Behavior proof from the mounted `MyWorkHub` test:

```text
57 task rows -> click Menu 3 Overdue (count 2) -> 2 task rows
2 task rows -> switch real hub view to Kanban -> 2 StandardKanbanCard cards
2 Kanban cards -> switch real hub view to Calendar -> the same 2 old tasks
non-overdue Hub task 57 absent in all three filtered views
New transition: recent/untriaged 1 -> triaged 0; Today/Week/Urgent counts equal their canonical result sets
```

TypeScript:

```text
exact-lock dependency tree: npm ci / @types/node 22.19.3
candidate server: RC 0 / 0 errors
candidate frontend: TIMEOUT at the mandatory 120 s command limit, no diagnostics emitted; not reported as PASS
W170 correction changes only two test files outside the root tsconfig include set
```

Focused ESLint: **0 errors**. `git diff --check`: **PASS**.

## Files

- `src/components/MyWork/taskHubFilter.ts`
- `src/components/MyWork/MyTasksListContent.tsx`
- `src/components/MyWork/TasksKanbanBoard.tsx`
- `src/components/MyWork/TasksCalendarView.tsx`
- `src/components/MyWork/__tests__/MyTasksList.k31.test.ts`
- `tests/components/MyWork/MyWorkHub.overdueCanonicalFilter.test.tsx`
- `tests/components/MyWork/MyTasksListContent.completed-readback.test.ts`
- `src/components/Presentations/DeckBuilder/blocks/deckChartAdapter.ts`
- `src/components/Presentations/DeckBuilder/blocks/ChartBlock.tsx`
- `src/components/Presentations/DeckBuilder/__tests__/deckChartAdapter.i18n.test.ts`
- `public/locales/{en,pl}/translation.json`
