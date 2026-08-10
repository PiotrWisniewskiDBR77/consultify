# 17 — Performance measurement: Table / Whiteboard / Process Flow / Mind Map

Candidate worktree: `/Users/piotrwisniewski/consultify-wt/ideas-perf-virt`, detached HEAD
`3dd93792b9`. No push/merge/deploy/commit — everything below is uncommitted working-tree state,
re-verified by the orchestrator before it ships anywhere. Scope: turn three prior-audit
code-level claims (Table has no virtualization; Whiteboard/Process Flow are missing
`onlyRenderVisibleElements`; Mind Map's virtualization is flag-gated and possibly a phantom) into
measured numbers, find the sharper problem if one exists, and fix only what is small and
unambiguous.

## 0. Files touched (uncommitted)

| File | What changed |
|---|---|
| `src/components/MyWork/table/useRollupComputation.ts` | Fixed O(rows·(edges+allNodes)) rollup pass → O(edges+allNodes+rows·avgDegree) via a one-time adjacency map + node-by-id index |
| `src/components/MyWork/IdeaWhiteboardTool.tsx` | Added `onlyRenderVisibleElements` to `<ReactFlow>`, threshold `nodes.length >= 300` |
| `src/components/MyWork/IdeaProcessFlowTool.tsx` | Added `onlyRenderVisibleElements` to `<ReactFlow>`, threshold `nodes.length >= 300` |
| `tests/performance/rollupComputation.bench.test.ts` (new) | Rollup benchmark: legacy pass + fast-path correctness + fast-path benchmark |
| `tests/performance/ideaTableTool.mount.bench.test.tsx` (new) | Real `IdeaTableTool` mount-time benchmark vs row count |
| `tests/performance/ideaWhiteboardTool.mount.bench.test.tsx` (new) | Real `IdeaWhiteboardTool` mount-time benchmark vs node count |
| `tests/performance/ideaProcessFlowTool.mount.bench.test.tsx` (new) | Real `IdeaProcessFlowTool` mount-time benchmark vs node count |

New files are untracked (`git status` shows `??`); per repo hygiene they need `git add -f` before
a commit — not done here, per instructions to leave the worktree uncommitted.

## 1. The three claims

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Table tool has no virtualization — every row rendered | **CONFIRMED** | `src/components/MyWork/IdeaTableTool.tsx:4132` and `:4180` — `rows.map((row, idx) => renderRow(row, idx))` / `processedRowsWithRollups.map(...)` into a plain `<table>/<tbody>`. `grep -c 'react-window\|react-virtual\|FixedSizeList\|Virtuoso\|overscan' IdeaTableTool.tsx` = 0. |
| 2 | Whiteboard and Process Flow: `onlyRenderVisibleElements` missing on the canvas | **CONFIRMED** (now fixed, see §5) | `IdeaWhiteboardTool.tsx:613` `<ReactFlow …>` and `IdeaProcessFlowTool.tsx:3498` `<ReactFlow …>` — neither passed the prop before this session's fix. `grep -n onlyRenderVisibleElements` on both files = 0 matches pre-fix. |
| 3 | Mind Map virtualization exists but is gated behind a default-OFF flag; verify real vs phantom | **CONFIRMED REAL, not a phantom** | See §2. |

## 2. Mind Map flag — real, not phantom

- **Flag:** `mindmapVirtualization` (`src/hooks/useFeatureFlags.tsx:238-249`), `defaultValue: false`,
  category `beta`.
- **Wiring:** `IdeaRecommendationMap.tsx:5334-5335` —
  `const virtualizationEnabled = isFeatureEnabled('mindmapVirtualization'); const
  onlyRenderVisibleElements = shouldVirtualize(virtualizationEnabled, nodes.length);` — then spread
  onto the real `<ReactFlow>` element at `IdeaRecommendationMap.tsx:5931`:
  `{...(onlyRenderVisibleElements ? { onlyRenderVisibleElements: true } : {})}`.
- **Threshold:** `VIRTUALIZATION_NODE_THRESHOLD = 300` in
  `src/components/MyWork/mindmap/virtualization.ts:18` — the flag only engages once a map crosses
  300 nodes, so small/medium maps are byte-identical to OFF even when the flag is ON.
- **Is `onlyRenderVisibleElements` a real prop?** Yes — confirmed present and implemented in
  `node_modules/@reactflow/core/dist/esm/index.mjs` (`useVisibleNodes`, `getNodesInside`,
  threaded through `GraphView` → `NodeRenderer`/`EdgeRenderer`). This is ReactFlow's own built-in
  viewport-culling mechanism, not a custom reimplementation — Mind Map is the only one of the four
  tools that turns it on.
- **Existing proof it isn't a phantom:** this repo already ships two unit-test files exercising
  the pure decision logic without a DOM:
  `tests/unit/mindmap/virtualization.test.ts` (13 assertions on `shouldVirtualize`/
  `isNodeRenderable`) and `tests/unit/mindmap/virtualizationProfile.test.ts` (a documented
  DOM-element-count proxy — see its own header comment for why: "jsdom has no layout engine, so
  ReactFlow's built-in onlyRenderVisibleElements … cannot be exercised meaningfully here"). Ran
  both this session: `npx vitest run tests/unit/mindmap/virtualizationProfile.test.ts
  tests/unit/mindmap/virtualization.test.ts` → **13/13 passed, exit code 0**. Measured proxy
  output: 500-node grid map → 104 nodes kept in the culled window (79% reduction); 1000-node map →
  still 104 (89.6% reduction — the visible window is a fixed area, so cost stops scaling with map
  size past the viewport).
- **Full-DOM benchmark NOT attempted for Mind Map** — see §6.

## 3. Measurement — Rollup computation (the sharper problem)

Reading `src/components/MyWork/table/useRollupComputation.ts` while investigating claim 1 found a
worse problem than the missing table virtualization: whenever a table has ≥1 `rollup` column,
`computeRollupValue` ran **once per row**, and each call (a) walked the **entire** `edges` array
with a plain loop and (b) ran `allNodes.filter(...)` over the **entire** node array —
O(rows · (edges + allNodes)). This is independent of DOM/virtualization entirely; it fires on
every table re-render that touches rows/columns/nodes/edges.

**Methodology:** chain topology (node `i` linked to `i±1`, ~2N edges — a plausible "sequence /
dependency" column shape, not an adversarial worst case), one `sum` rollup column, 5 repetitions
per N, `performance.now()` around the full pass.

Command: `npx vitest run tests/performance/rollupComputation.bench.test.ts` (with
`VITEST_HEAP_MB=6144` for headroom at N=10000 — see below).

**Legacy pass (`computeRollupValue`, unchanged — kept exported for any other caller):**

| N | mean ms | min ms | max ms |
|---:|---:|---:|---:|
| 100 | 0.84–1.74 | 0.41–0.52 | 1.86–2.86 |
| 1,000 | 83–303 | 31–122 | 140–377 |
| 5,000 | 1,504–9,025 | 1,195–7,927 | 1,856–9,690 |
| 10,000 | 6,011–18,924 | 3,975–6,328 | 8,124–43,957 |

Two independent runs are shown per N (range) — run-to-run spread was large (system-load
dependent; the first N=10000 attempt exceeded vitest's 60s per-test timeout on its worst rep
(43,957ms) and auto-retried). Growth shape: 100→1,000 is 10× N for ~100–360× time; clearly
super-linear, consistent with the O(n·(edges+allNodes)) reading of the code.

**Fix:** build the edge-adjacency map (O(edges)) and a node-by-id index (O(allNodes)) **once**
per memoized pass in `useRollupComputation`'s `useMemo`, then do an O(1) map lookup per row
instead of two full-array scans. `computeRollupValue`'s exported signature/behavior is untouched
(no other caller found via `grep -rn computeRollupValue src/ tests/`) — only the hook's internal
hot loop was rewired through a shared `aggregateRollup` helper.

**Correctness check:** `useRollupComputation` (fast path, via `renderHook`) produces byte-identical
output to the legacy per-row `computeRollupValue` path at N=50 — asserted directly in the
benchmark file, passed.

**Fast path (fixed hook, real `useMemo`+`renderHook`, 5 reps):**

| N | mean ms | min ms | max ms |
|---:|---:|---:|---:|
| 100 | 7.16 | 1.31 | 13.63 |
| 1,000 | 1.71 | 1.07 | 2.60 |
| 5,000 | 6.69 | 3.21 | 14.97 |
| 10,000 | 16.46 | 6.37 | 38.14 |

At N=10,000: **6,011ms → 16.46ms mean, ~365×** — and the growth curve is now flat/linear
(`renderHook`/`act` overhead dominates the small-N numbers, not the algorithm). All 11 tests in
the file passed: `Test Files 1 passed | Tests 11 passed`.

Benchmark file: `tests/performance/rollupComputation.bench.test.ts`.

## 4. Measurement — mount-time benchmarks (component-level, real components)

All three used `@testing-library/react` `render()`/`renderHook()` + `performance.now()`, real
(unmocked) `reactflow` where applicable, and the same heavy-mock scaffolding already proven in
this repo's own passing tests (`IdeaTableTool.honesty.test.tsx`,
`IdeaWhiteboardTool.drawUndo.test.tsx`, `IdeaProcessFlowTool.error-state.test.tsx`) — not a
reimplementation of the render loop.

### 4.1 IdeaTableTool (`tests/performance/ideaTableTool.mount.bench.test.tsx`)

8 mixed-type columns (text/select/number/date), real rows through the `useTableRows`/
`useTableSchema` mocks, `useRollupComputation` mocked to identity (isolates row/cell render cost
from §3's rollup cost), `viewLayout: 'table'` (the plain-`<table>` branch — an earlier run used
`'grid'` by mistake and silently rendered the mocked `GridView` stub instead, 0 DOM rows; caught
by the file's own `expect(domRows).toBe(n)` sanity assertion, fixed before these numbers).

| N | mean ms | min ms | max ms | DOM rows |
|---:|---:|---:|---:|---:|
| 100 | 880.10 | 561.81 | 1,247.90 | 100 |
| 1,000 | 5,971.74 | 4,608.15 | 6,899.34 | 1,000 |
| 5,000 | **OOM crash** | — | — | — |
| 10,000 | **OOM crash** | — | — | — |

N=5,000 crashed the vitest worker with `FATAL ERROR: Ineffective mark-compacts near heap limit —
JavaScript heap out of memory` under the **default** heap; retried with `VITEST_HEAP_MB=8192` and
it **still** OOM'd. This is a real, repeatable ceiling for mounting the actual component (not the
DOM/jsdom cost of the row markup alone — see §7 for why the absolute numbers likely include fixed
overhead unrelated to N). 5 reps at N=100/1,000; N=5,000/10,000 reps could not be collected —
reported as a hard failure per the task's own instruction, not glossed over.

### 4.2 IdeaWhiteboardTool (`tests/performance/ideaWhiteboardTool.mount.bench.test.tsx`)

Real `reactflow`, `stickyNote` nodes with explicit `width`/`height` (so ReactFlow treats them as
"measured" even though jsdom's `ResizeObserver` polyfill in `tests/setup.ts:811-814` is a no-op),
3 reps, sizes capped below Table's OOM point given the cost already seen there.

| N | mean ms | min ms | max ms | DOM nodes |
|---:|---:|---:|---:|---:|
| 100 | 127.15 | 96.67 | 181.23 | 100 |
| 500 | 309.67 | 236.97 | 446.03 | 500 |
| 1,000 | 777.43 | 702.46 | 829.78 | 1,000 |
| 2,500 | 1,909.15 | 1,672.53 | 2,099.36 | 2,500 |

Clean, roughly linear growth (~0.76 ms/node), no crash, `Test Files 1 passed | Tests 5 passed`.

### 4.3 IdeaProcessFlowTool (`tests/performance/ideaProcessFlowTool.mount.bench.test.tsx`)

Same real-`reactflow` approach, `flowNode` type. Two separate invocations produced very different
absolute numbers (reported both — this is real spread, not cherry-picked):

Run A (sizes run individually): N=100 mean 4,031.81ms; N=500 mean 27,418.30ms (5× N → ~6.8× time).
Run B (full file, one invocation, REPS trimmed 3→2, N capped at 1,000 given cost): N=100 mean
361.32ms; N=500 mean 9,405.63ms (5× N → ~26× time); N=1,000 mean 52,769.51ms (2× N → ~5.6× time).
`Test Files 1 passed | Tests 4 passed` for run B.

Either run shows clearly **super-linear** growth, steeper than Whiteboard's for the same node
counts and node shape. N=2,500 was not attempted after N=1,000 already took ~53s mean per mount —
extrapolating the observed growth rate would put a single N=2,500 mount at several minutes,
judged impractical within this session; reported honestly rather than guessed.

**A plausible contributor** (not proven by profiling, offered as a lead, not a claim): a
`.map((n) => n.id).join(',')` over the full `nodes` array is recomputed inline as a JSX prop
(`IdeaProcessFlowTool.tsx:3494`, `<EdgeRehydrateFix nodeIdsKey={nodes.map((n) => n.id).join(',')}
nodeIds={nodes.map((n) => n.id)} />`) on every render — two more full-array passes per render,
independent of ReactFlow's own cost, and probably not the only contributor at this scale.

## 5. Fixed vs reported (per the "small, unambiguous, own files only" constraint)

**Fixed:**
- **Rollup O(n²)** — `src/components/MyWork/table/useRollupComputation.ts` (§3). Verified against
  existing callers (`IdeaTableTool.honesty.test.tsx`, `IdeaTableTool.columnMenuPlatform.test.tsx`,
  both mock the hook so unaffected; ran both, 7/7 passed) and a new correctness-equivalence test.
- **Whiteboard `onlyRenderVisibleElements`** — `IdeaWhiteboardTool.tsx:610,636`, threshold
  `nodes.length >= 300` (matches Mind Map's threshold for consistency). Whiteboard's manual
  "Add element" path already hard-blocks at 500 nodes (`IdeaWhiteboardTool.tsx:2549`,
  `if (nodes.length >= 500) { toast.error(...); return; }`) — this only ever engages in the
  narrow 300–500 band that path can reach. **Not confirmed** whether paste/import/AI-batch-add
  paths share that 500 cap (only one call site for the guard was found via
  `grep -n objectLimitReached`) — flagged, not chased further.
- **Process Flow `onlyRenderVisibleElements`** — `IdeaProcessFlowTool.tsx:3052,3544`, same
  threshold. Process Flow has **no** node-count ceiling of any kind (`grep -n
  "nodes.length >="` on the file found none) — this is the more load-bearing fix given §4.3's
  numbers and §6's ceiling discussion.
- **Verified no regressions:** ran the five most directly relevant existing component tests after
  both ReactFlow changes — `IdeaWhiteboardTool.drawUndo.test.tsx`,
  `IdeaWhiteboardTool.observer-readonly.test.tsx`, `IdeaProcessFlowTool.convertNode.test.tsx`,
  `IdeaProcessFlowTool.error-state.test.tsx`, `IdeaProcessFlowTool.edgeEditBar.test.tsx` →
  **11/11 passed**, exit code 0 (pre-existing `act()` console warnings only, not new).
- Deliberately **NOT** wired to a new feature flag (would touch
  `src/hooks/useFeatureFlags.tsx`, outside "the four tools' own files"). Per CLAUDE.md rule #7/#9
  this still needs a screenshot-acceptance pass before it goes anywhere near demo, since it
  changes what's mounted in the DOM — that gate is the orchestrator's call, not made here.

**Reported, not done (structural):**
- **Table virtualization** — needs an actual windowing library
  (`react-window`/`@tanstack/react-virtual` or similar) integrated into the `<table>`/`<tbody>`
  render path (`IdeaTableTool.tsx:4132`/`4180`), plus reworking sticky header, group headers,
  row-drag, and column-resize interactions that currently assume every row is a real DOM node.
  **Effort estimate: multi-day** (not small) — this is exactly the kind of change the task
  instructed not to attempt. §4.1's OOM ceiling is the strongest argument for prioritizing it.

## 6. Realistic ceiling and severity

| Tool | Product-level cap found | Severity of the virtualization gap |
|---|---|---|
| Mind Map | Soft: `nodes.length >= 500` shows a "map reached 500-node limit" banner (`IdeaRecommendationMap.tsx:5890`, `LargeMapOptimizer.tsx` thresholds WARNING 150 / CRITICAL 300 / AUTO_SIMPLIFY 500). Flag's own 300-node threshold sits inside that band. | **N/A — already mitigated.** The real gap was only that the mitigation defaults OFF; the mechanism itself is real (§2) and its own product ceiling (~500) is far below where the numeric risk in §4 would matter. |
| Whiteboard | Hard: `addElement` blocks new nodes at 500 (`IdeaWhiteboardTool.tsx:2549`), only confirmed on the manual-add path. | **P2** — capped path is safe (§4.2 shows clean linear cost to 2,500, well past the 500 cap); risk is confined to unconfirmed paste/import/AI-batch paths that may not share the cap. |
| Process Flow | **None found.** | **P1** — no cap of any kind, and §4.3 measured clearly super-linear mount-time growth reaching ~53s mean at just 1,000 nodes in this test harness. Any user-reachable path to a few hundred process-flow nodes (a real BPMN/VSM diagram is not an implausible size) hits this. |
| Table | **None found.** No row cap; CSV import (`csvUtils.ts:parseCSV`) has no row-count limit (`grep -n "MAX_ROWS\|rows.slice(0,"` found nothing row-count-related); the only caps found (`MAX_SEEDED_ROWS = 100` in `ViewSetupEmptyState.tsx`, `PAGE_SIZE = 50` in the separate platform-integration pagination path) don't bound the legacy/full-node code path benchmarked in §4.1. | **P1** — §4.1's OOM at 5,000 rows (even at 8GB heap) with no product guardrail preventing a user from reaching that many rows (CSV import is the obvious path) is the strongest single number in this report. |

## 7. What was NOT measured (do not treat as "should work")

- **Mind Map full-component DOM-reduction benchmark.** Not attempted: `IdeaRecommendationMap.tsx`
  is a ~7,200-line component with a deep hook tree; mounting it with synthetic large node sets
  within this session's time budget was judged too costly relative to the payoff, given §2
  already establishes the mechanism is real via code inspection + the repo's own existing
  pure-function tests. The existing `virtualizationProfile.test.ts` proxy (§2) is the best
  available evidence, and it is explicit about its own limitation (see its header comment).
- **Whether `onlyRenderVisibleElements` actually reduces mounted DOM nodes at initial load, for
  any of the four tools.** Investigated directly for the two tools fixed in this session: both
  Whiteboard (`IdeaWhiteboardTool.tsx:666`, `fitView`) and Process Flow
  (`IdeaProcessFlowTool.tsx:3624`, `fitView={!pendingViewportRef.current}`) call ReactFlow's
  `fitView` on initial load. `fitView` zooms out until the whole graph fits the viewport, which by
  construction makes every node intersect the viewport rect `getNodesInside` culls against — so
  **culling provides zero DOM-count reduction at initial mount**, confirmed empirically: re-ran
  §4.2's N=500 case after the fix landed and `domNodes` was still 500, not reduced. This is not a
  defect in the fix — it's inherent to how `onlyRenderVisibleElements` composes with
  fit-to-view — and it means the fix's real benefit is confined to **after** the user zooms in or
  pans away from the full-map overview, which this session did not benchmark (would need to drive
  the ReactFlow store's `transform` to a non-fit state inside the test, which was judged
  out-of-budget). The mount-time numbers in §4.2/§4.3 are therefore a measurement of "cost of
  mounting N nodes," not "cost with vs. without culling" — there is currently no before/after
  mount-time comparison for the fix itself, only the qualitative DOM-count evidence above.
- **Real-browser numbers.** Everything above is jsdom (`environment: 'jsdom'` in
  `vitest.config.ts:199`), which has no real layout engine
  (`tests/setup.ts:811-814` stubs `ResizeObserver` as a no-op) and is known to have different
  absolute costs than Chrome/V8-in-browser — sometimes slower (no native layout shortcuts),
  sometimes the numbers here include fixed jsdom/testing-library overhead unrelated to N (e.g.
  Table's N=100 mean of 880ms is implausibly slow for 100 real `<table>` rows in a real browser;
  treat the **shape** of the N-vs-time curves and the **OOM ceiling** as the load-bearing findings,
  not the absolute millisecond values).
- **Paste/import/AI-batch node-count caps** for Whiteboard beyond the single `addElement` call
  site found (§5). Not chased further.
- **Root cause of Process Flow's specific super-linear shape** (§4.3) beyond the one plausible
  lead offered (`EdgeRehydrateFix`'s inline `.map().join(',')`) — not profiled, not fixed (outside
  "small and unambiguous").
- **N=10,000 for Whiteboard/Process Flow mount benchmarks** — not attempted after Table's OOM at
  N=5,000 and Process Flow's ~53s mean at N=1,000 made it clearly impractical within this
  session's time budget.
