# ADR AP-01 — Finance Data Grid core logic (Gate D / Fala 3)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 10
(Stanowisko analityka — Finance Data Grid, target 10k×120, ≥45 FPS, input p95<100 ms, 1000-cell paste jako
jedna transakcja). Also `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3
point 1 (Finance Data Grid MUST requirements) and section 3 "Krytyczna zmiana priorytetów" (Grid moves P2→P0/P1).
**Work package:** AP-01 — first consumer of AP-00's shared contracts (`ArtifactRef`/`CellRef`/`Operation`/
`WorkspaceState`), and the first Analyst Productivity work package to ship code (not only types).
**Date:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `CORE LOGIC ONLY — no React component, no DOM, no database connection. Pure, synchronous,
dependency-free (besides `zod` and the existing AP-00 types) TypeScript. Verified with a scoped tsc --noEmit,
esbuild --bundle, and 47 vitest tests (40 correctness + 7 performance-proxy) run only against these new files
— no full-project tsc/vitest run, per the task's "esbuild per plik" convention (see `CLAUDE.md` "HIGIENA
WYKONANIA"). React/UI integration is explicitly OUT OF SCOPE for this package — see section 9.`

---

## 1. Inputs read, in this order

1. `docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md`, full text, and every file it
   delivered: `server/src/types/finance/ArtifactRef.ts`, `CellRef.ts`, `Operation.ts`, `WorkspaceState.ts`,
   `financeValueSemantics.ts` — this ADR does not redefine any of these; it is the first real *consumer* AP-00's
   own header anticipated ("a prerequisite for AP-01").
2. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 10, the "Finance
   Data Grid" subsection specifically: "multi-range selection, rectangular paste, fill down/right, paste
   special, bulk set/reset/clear, find/replace, freeze/pin/hide/group, formula bar i validation panel, stable
   canonical keys. Target: 10k×120 logical cells, ≥45 FPS, input p95<100 ms, 1000-cell paste jako jedna
   transakcja."
3. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3 point 1: "Finance Data
   Grid: multi-select, rectangular paste, fill down/right, paste special, bulk clear/reset/set rule,
   find/replace, freeze, hide/group, jump-to-line" — same feature list, reused as the literal task checklist
   below (section 3).
4. `server/src/services/finance/canonical/lifecycleService.ts` (real code) for `BusinessVersionStatus`/
   `FinanceRole`, reused by `Operation.ts` and, transitively, by this package's `EngineMutationContext`.

---

## 2. Context — why this is core logic, not a component

The task brief for this work package is explicit: build ONLY the non-React, non-DOM, testable-without-a-browser
logic, and document the contract a future React `FinanceDataGrid` component would call. This mirrors
`CLAUDE.md` rule 7 ("★ PIOTR NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM") — a rendered grid component needs a
harness screenshot and Piotr's prototype-level sign-off before any real UI code is written, which is a
separate, later step this package deliberately does not take. What CAN be built and fully unit-tested without
that step is everything the master plan's Finance Data Grid bullet list actually computes: which cells are
selected, what `Operation`s a paste/fill/bulk-edit/find-replace produces, and what view state (freeze/pin/
hide/group) looks like. All of that is pure data transformation — no DOM measurement, no paint, no `Piotr`
approval needed to verify it, only `vitest`.

---

## 3. Decision — six modules, `server/src/services/finance/grid/`

| File | Exports | Master plan feature |
|---|---|---|
| `gridCoordinates.ts` | `GridCoordinate`, `GridRect`, `GridAddressResolver`, rect algebra (`subtractRect`, `rectFromCorners`, `iterateRect`, ...), `chunkArray`, `MAX_CELLS_PER_OPERATION` | shared foundation (see section 4) |
| `engineContext.ts` | `EngineMutationContext`, `EngineError`, `checkCapability`, id/clock injection helpers | shared plumbing all four mutation engines use |
| `GridSelectionModel.ts` | `GridSelectionModel` class | "multi-range selection" |
| `PasteEngine.ts` | `buildPasteOperations`, `PasteMode` | "rectangular paste", "paste special" |
| `FillEngine.ts` | `buildFillOperations`, `FillDirection` | "fill down/right" |
| `BulkOpsEngine.ts` | `buildBulkOperations`, `BulkOpKind` | "bulk set/reset/clear" |
| `FindReplaceEngine.ts` | `findCells`, `buildFindReplaceOperations`, predicate builders | "find/replace" |
| `GridViewState.ts` | `GridViewState` class | "freeze/pin/hide/group" |
| `index.ts` | barrel re-export of all of the above | — |

**Location decision:** followed AP-00's own precedent (`server/src/types/finance/`) and the repo's existing
`server/src/services/finance/canonical/` sibling directory — `server/src/services/finance/grid/` sits next to
`canonical/` as another Finance-domain service group, keeping the "backend-only, no shared frontend/backend
package" convention AP-00's ADR documented (section 3 of that ADR) rather than reversing it here.

All files type-check cleanly against the real, unmodified `server/tsconfig.json` (strict mode) via a scoped
`include` list (the 9 new files + the 5 AP-00 type files + `lifecycleService.ts`) — zero errors — and bundle
cleanly with `esbuild --bundle --platform=node --external:zod` (42.2 kB combined via the barrel `index.ts`).
See section 9 for the full verification log.

---

## 4. Foundational judgment call — an integer `{row, col}` coordinate space, not `CellRef` arithmetic

**This is the single most consequential decision in this package**, so it is stated once here and referenced
by every other section.

AP-00's `WorkspaceState.ts` (`FinanceGridRangeSelection`) stores a selection range's corners as full `CellRef`
objects — and its own file header says, verbatim: *"`CellRef` has no universal 'next cell' ordering AP-00 can
define generically ... the corners are an opaque pair whose interpretation belongs to AP-01's own grid
layout."* That sentence is a direct instruction to this work package: AP-01 owns the interpretation.

A `CellRef`'s `rowKey`/`columnKey` for `finance_stmt_lines` are composite objects of strings
(`entityId`/`canonicalLineId`/`consolidationScope`, `periodId`/`accumulationBasis`) with no arithmetic
ordering — there is no way to compute "the cell 3 rows below this one" from a `CellRef` alone, no way to measure
a rectangle's area, no way to iterate a range, without first imposing SOME row/column order over the domain
keys. Every virtualized grid implementation that exists (Excel's internal model, ag-grid, react-window,
Google Sheets) solves this the same way: an integer `{row, col}` coordinate space is the thing selection,
paste-rectangle, and fill-range math actually operates over; a resolver translates between that space and the
domain's real addressing only at the boundary (rendering a cell, or persisting a selection).

`gridCoordinates.ts`'s `GridAddressResolver` interface is that resolver:

```ts
interface GridAddressResolver {
  readonly rowCount: number;
  readonly colCount: number;
  cellRefAt(coord: GridCoordinate): CellRef;
  coordinateOf(ref: CellRef): GridCoordinate | null;
}
```

**This package does not implement a resolver for the real, live `finance_stmt_lines` row/column order** — that
requires knowing the artifact's actual entity list, canonical line taxonomy, and period calendar, which is
live server/UI state this core-logic package has no access to (and the task's hard DB prohibition means it
could not fetch it even if it wanted to). Every engine in this package takes a `resolver` as a parameter; the
future AP-01 React layer owns the one real implementation, built from whatever entity/line/period order it is
currently rendering (respecting sort, filters, and `GridViewState`'s own freeze/hide/group state). The
performance test (section 5) builds a synthetic-but-realistic resolver (100 entities × 100 lines × 120
periods) to prove the *shape* of this contract performs at scale — it is not a claim about what the real
resolver's entity/line data will look like.

**Consequence for `GridSelectionModel`:** its public API (`addRange`, `subtractRange`, `iterateCells`, ...) is
entirely in `{row, col}` space. `toCellRefRanges(resolver)` / `GridSelectionModel.fromCellRefRanges(ranges,
resolver)` are the ONLY two methods that cross into `CellRef` space, both explicitly resolver-parameterized —
this is the WorkspaceState interop boundary the AP-00 file header pointed at.

---

## 5. GridSelectionModel — multi-range selection

`server/src/services/finance/grid/GridSelectionModel.ts`.

**Disjoint-ranges invariant.** Every mutating method (`addRange`, `subtractRange`, `toggleRange`, `extendTo`)
re-establishes the invariant that `ranges` is pairwise-disjoint, by subtracting the incoming rectangle from
every existing range (`subtractRect`, a standard 4-piece axis-aligned rectangle difference in
`gridCoordinates.ts`) before adding the new one. This was chosen over the naive alternative (append arbitrary,
possibly-overlapping rectangles, dedup on read) because the naive alternative makes `selectedCellCount()` and
`iterateCells()` — the two operations a virtualized 10k×120 grid calls on every render/every keystroke — cost
O(cells) instead of O(ranges). With the invariant, both are a trivial O(ranges) sum/concat. Measured cost: the
performance test's full-grid `addRange` (1.2M logical cells, one call) takes **0.04 ms**; draining
`iterateCells()` over that same 1.2M-cell selection takes **50.28 ms** (section 9 has the full numbers table).

**`toggleRange` is whole-rectangle toggle, not per-cell XOR.** Ctrl/cmd-click-dragging a rectangle that is
already fully selected removes it; anything else, including a rectangle only partially overlapping existing
selection, is added (extended). A true per-cell XOR of a dragged rectangle against existing selection is not
meaningfully different for the dominant real case (single-cell ctrl-click) and would be materially more complex
(fragmenting into arbitrarily many non-rectangular pieces) for no described product requirement — documented
here as a deliberate simplification, not an oversight.

**Gesture anchor (`anchorCell`) is distinct from `activeCell`.** Shift+click / shift+arrow-key range extension
needs a fixed anchor point independent of where the cursor currently is (`extendTo`) — same distinction Excel
draws internally. `setAnchor`/`selectSingle` start a fresh gesture; `extendTo` grows it.

**WorkspaceState round-trip is lossy-safe, not lossy-silent.** `fromCellRefRanges` returns `{ model,
unresolved }` — a range whose persisted `CellRef` corners no longer resolve under the CURRENT resolver (e.g. a
filter removed that row since the crash) is dropped, and counted, rather than throwing. This is intentional:
a stale selection corner after a filter/sort change between sessions is an expected, not exceptional,
consequence of crash recovery — `WorkspaceState.ts`'s own header frames selection persistence as "AP-01's own
grid layout to interpret," which includes deciding what to do when that layout has since changed.

---

## 6. PasteEngine — rectangular paste, paste special, 1000-cell chunking

`server/src/services/finance/grid/PasteEngine.ts`.

**Operation-type choice.** Emits AP-00's `'paste'` verb — `Operation.ts`'s own design table defines it as
exactly "write a DIFFERENT value per cell (rectangular paste)." This is applying the existing contract, not
inventing a new one.

**1000-cell chunking decision (task scope item 7 — "zdecyduj i udokumentuj który wariant i dlaczego"):**
**DECISION = split into multiple sequential batches, not reject.** `Operation.ts` section 6.4 already states
the AP-00 contract's own position on this exact question: *"A caller (AP-01) needing to paste more than 1000
cells must chunk into multiple batches; this contract does not attempt cross-batch atomicity for that case (out
of scope)."* This ADR follows that, rather than re-litigating it: `buildPasteOperations` treats a >1000-cell
source block as `⌈N/1000⌉` sequential `paste` operations, each alone in its own batch (so each chunk IS
atomic), submitted **in order**. Rejecting outright was considered and discarded — a >1000-cell Excel-style
paste against a 10k×120 grid is an entirely ordinary analyst action, and rejecting it with no path forward
would contradict the master plan's own "Excel round-trip" goal. The accepted cost: the WHOLE paste is not
atomic once it needs more than one batch (a later chunk can fail after earlier chunks already committed) — this
package does not implement cross-chunk compensation/rollback; that is flagged in section 10 as an AP-04 (Undo)
concern, since AP-04 owns the undo stack this package's `Operation` entries feed into, and reversing an
already-committed chunk via a `reset`/`clear` `Operation` is exactly what that stack is for.

**Paste-special modes — a real contract gap, not silently glossed over.** The master plan asks for "paste
special (values-only/formulas-only/formats-only)". AP-00's `FinanceValue`/`FinanceValueInput` has **no formula
field and no format/style field** — only `status`/`valueDecimal`/currency/unit/multiplier/`sourceRef`/
`isAdjustment`/`adjustmentReason`. There is therefore nothing for a "formulas-only" or "formats-only" paste to
write today. Two ways to close this gap: (a) silently treat every mode as `VALUES_ONLY` — rejected, because a
future "Paste Special → Formats Only" button would then silently paste values too, a correctness trap a UI
should never be allowed to hit; or (b) fail loudly with a distinct, named error. This engine takes (b):
`PasteMode` has all four literal values (`ALL`/`VALUES_ONLY`/`FORMULAS_ONLY`/`FORMATS_ONLY`) so the type already
anticipates the future, but `FORMULAS_ONLY`/`FORMATS_ONLY` always return `{ ok: false, code:
'UNSUPPORTED_MODE' }` today. Flagged in section 10 as a gap only AP-00 (or a future ADR extending it) can close
by adding formula/format fields to `FinanceValue` — this package cannot invent them without touching a file
outside its allowlist.

**Bounds/validation order:** capability (`businessVersionStatus`) → shape (empty source) → resolver bounds
(`isRectInBounds`) → per-cell `FinanceValueInputSchema` validation (collects ALL failing cells' issues before
returning, not just the first) → chunk → stamp `Operation`/batch envelope fields.

---

## 7. FillEngine — fill down/right, numeric series detection, tiling fallback

`server/src/services/finance/grid/FillEngine.ts`.

**Operation-type choice, reusing AP-00's own `bulk_set` vs `paste` distinction.** When the fill result is one
shared value repeated to every target cell, this engine emits `'bulk_set'` — cheaper for the executor
(`Operation.ts`'s own words: "write the SAME value to N cells") than N identical `'paste'` entries would be.
When the result varies per cell (a detected series, or a tiled multi-value pattern), it emits `'paste'`. This
is not a new rule — it is applying the distinction `Operation.ts` section 6.1 already draws, to a second
engine.

**Series-detection scope (task: "obsłuż progresję liczbową jeśli źródło to seria, i proste kopiowanie"):**
attempted ONLY when the source pattern is exactly one cell deep along the fill axis (a single column for
`DOWN`, a single row for `RIGHT`) with ≥2 numeric present (`PRESENT_ZERO`/`PRESENT_NONZERO`) cells and a
constant step between consecutive values (`detectConstantStep`, epsilon-tolerant for decimal-string round-trip
noise). A multi-row/column source pattern is tiled (repeated cyclically), never analyzed for a 2-D trend —
"proste kopiowanie" is the task's own stated fallback for exactly that case, and 2-D series inference (e.g. a
diagonal or a per-row/per-column independent trend) is explicitly out of this package's scope, not an
oversight.

**Adjacency validation.** `buildFillOperations` rejects (`SHAPE_MISMATCH`) a `targetRect` that is not axis-
aligned and directly adjacent to `sourceRect` in the stated `direction` — a fill target with a gap, or in the
wrong direction, is not a fill this engine will silently reinterpret.

**Measured cost:** filling a 9,998-cell numeric series (down an entire 10,000-row column, chunked into 10
batches) takes **10.47 ms** (section 9).

---

## 8. BulkOpsEngine, FindReplaceEngine, GridViewState

`BulkOpsEngine.ts` maps `CLEAR`/`RESET`/`SET` 1:1 onto AP-00's `clear`/`reset`/`bulk_set` verbs — it does not
redefine what `clear` vs `reset` mean; `Operation.ts` section 6.1 already draws that line ("clear always
produces MISSING ... reset restores whatever the PARENT business_version had"), and this engine's job is only
to batch/chunk/stamp, using the same `MAX_CELLS_PER_OPERATION` chunking decision as `PasteEngine`/`FillEngine`
for consistency (a >1000-target bulk clear/reset/set also splits, does not reject — same rationale as section
6). Measured: a 10,000-cell bulk clear (10 batches) takes **7.81 ms**.

`FindReplaceEngine.ts`'s `findCells` takes a fully generic `(cell: GridCellSnapshot) => boolean` predicate
rather than a fixed "value/formula/quality" enum the task brief's wording might suggest, for the same reason
`PasteEngine` cannot implement `FORMULAS_ONLY`: AP-00's `FinanceValue` has no formula field, and "quality" in
this program is a separate concept living in the exception ledger (`exceptionLedgerService.ts`, Gate C) this
DB-free core-logic package cannot query. The predicate helpers this file DOES ship (`byStatus`,
`byDecimalEquals`, `byDecimalInRange`, `byNoConfirmedValue`) cover the one axis the contract actually models
(value/status); a caller with access to the exception ledger composes its own predicate for the quality axis,
and "search by formula" has no answer until a future ADR gives `FinanceValue` a formula field. `findCells` also
takes any `Iterable<GridCellSnapshot>`, not a fixed array — the performance test exercises it over both a plain
array and (implicitly, via the sparse `Map`'s `.values()`) a lazy iterator, so a future caller backed by a
virtualized viewport's visible-cell window does not need to materialize the whole grid to search it.

`GridViewState.ts` is an explicitly-scoped **in-memory-only** model — its own file header repeats the task's
scope boundary: this is NOT AP-07's "saved views" persistence, nothing here is written to any `finance_*`
table by this package. `toJSON`/`fromJSON` exist so a future AP-07 integration is a pass-through, not a
redesign. Column/row identity is a plain `string` id (whatever the resolver's domain key is, e.g. a period id
or canonical line id) rather than a `CellRef` or `GridCoordinate`, because freeze/pin/hide/group describe a
whole column or row's properties — a table-level concept orthogonal to any single cell's address.

---

## 9. Explicitly out of scope — the future React integration contract

Per the task's hard instruction, **no React component, no DOM code, no rendering, and no dev-render harness
entry was built in this package.** Per `CLAUDE.md` rule 7, that step requires its own worktree, its own
prototype-first flow, a dev-render screenshot Claude takes itself, and Piotr's sign-off on that screenshot
BEFORE the flag defaults on — none of which this core-logic package attempts to shortcut or simulate.

What this package guarantees for that future step: a future `FinanceDataGrid` React component (or whatever it
is named) is expected to:

1. Own one `GridAddressResolver` instance per open artifact, built from its actual rendered entity/line/period
   order (respecting `GridViewState`'s freeze/hide/group state and any AP-07 filter/sort).
2. Hold one `GridSelectionModel` instance for the current selection, driving it from pointer/keyboard events
   (`selectSingle`/`setAnchor`/`extendTo`/`addRange`/`toggleRange`), and persist it into `WorkspaceState` via
   `toCellRefRanges(resolver)` on autosave / `fromCellRefRanges` on crash-recovery load.
3. Hold one `GridViewState` instance for freeze/pin/hide/group UI (toolbar buttons, column-header context
   menu), computing actual render order via `visibleColumnOrder`/`visibleRowOrder`.
4. On a paste/fill/bulk-edit/find-replace user action, call the matching `buildXOperations` function with the
   live `EngineMutationContext` (current `businessVersionId`/`expectedWorkingRevisionId`/actor), then submit
   the returned `batches` to the (not-yet-built) executor **in array order**, stopping and surfacing a conflict/
   retry UI if any batch after the first fails (per section 6's documented no-cross-batch-atomicity tradeoff).
5. Feed every locally-applied-but-unconfirmed `Operation` into `WorkspaceState.unsavedOperationStack`
   (AP-04's own scope — this package only guarantees `Operation` is the right shape to go there, per AP-00's
   `WorkspaceState.ts` header, section 8 above).

This package's public surface (`server/src/services/finance/grid/index.ts`) is the whole of that contract —
nothing else needs to be imported from a future UI layer to drive it.

---

## 10. Performance results (10k × 120 proxy)

Per task item 8: a simulated 10,000-row × 120-column grid (1,200,000 logical cells; 100 entities × 100
canonical lines × 120 monthly periods) backed by a **sparse** `Map<canonicalCellKey, FinanceValue>` (never a
dense 2-D array of cell objects — see `tests/unit/finance/financeGridPerformance.test.ts` file header for why
that would itself be "the correctness AND performance bug" `WorkspaceState.ts`'s own header warns against at
this scale). All numbers below are from a single local run (`vitest run tests/unit/finance/
financeGridPerformance.test.ts --no-file-parallelism`), Node/vitest v4.1.8, no other load; treat as an
order-of-magnitude proxy, not a certified benchmark — the task itself frames this as "nie 45 FPS dosłownie bez
DOM, ale zmierz czas generowania Operation.batch ... jako proxy."

| Operation | Scale | Measured | Budget asserted in test |
|---|---|---|---|
| Build sparse store | 46,977 entries (~4% density of 1.2M cells) | 76.13 ms | < 2000 ms |
| `GridSelectionModel.addRange` (whole grid) | 1 rect, 1,200,000 cells | 0.04 ms | < 10 ms |
| `GridSelectionModel.iterateCells` (drain) | 1,200,000 coordinates | 50.28 ms | < 1000 ms |
| 500 mixed add/subtract/toggle selection mutations | scattered 11×4 rects over 10k×120 | 10.10 ms | < 500 ms |
| `PasteEngine.buildPasteOperations` | exactly 1000 cells (the master plan's own benchmark size) | 6.42 ms | < 100 ms |
| `FillEngine.buildFillOperations` (numeric series) | 9,998 cells, 10 chunked batches | 10.47 ms | < 300 ms |
| `BulkOpsEngine.buildBulkOperations` (clear) | 10,000 cells, 10 chunked batches | 7.81 ms | < 300 ms |
| Sparse-store random-cell lookups | 2,000 lookups via `cellRefKey` | 2.65 ms | < 50 ms |

**Reading these against the product targets (input p95 < 100 ms, ≥45 FPS ≈ 22 ms/frame):** every measured
number here is the CPU cost of producing a ready-to-submit `Operation.batch` (or draining a selection
generator) — the share of the end-to-end input-to-commit latency this package's pure functions actually own,
before any DOM update, network round trip, or executor transaction. A 1000-cell paste (the master plan's own
named benchmark) costs **6.42 ms** of batch-building time here, well inside the 100 ms p95 budget with ~94 ms
of headroom left for the DOM patch, network round trip, and DB transaction the future executor performs — this
package does not, and cannot, measure those other three costs, which is exactly why this is a proxy, not a
full-budget proof.

---

## 11. Verification performed

Per the task's hard prohibition on connecting to any database, and its instruction to keep verification
scoped (no full-project `tsc`/`vitest`, per `CLAUDE.md` "HIGIENA WYKONANIA" — "zakaz pełnego tsc/vitest u
robotników"):

- **`esbuild --bundle --platform=node --format=esm --external:zod`** on the barrel `index.ts`: bundles cleanly,
  42.2 kB, in 14 ms — proves syntax correctness and that every relative import across all 8 new files resolves.
- **`tsc --noEmit`, scoped `include` list** (a temporary tsconfig extending the real, unmodified
  `server/tsconfig.json` — same `strict`, `noImplicitAny`, `strictNullChecks`, etc. — `include` limited to the
  9 new files in this package, the 5 existing AP-00 type files they import from, and `lifecycleService.ts`):
  **zero errors**, exit code `0`. The temporary tsconfig was deleted after the check (not committed).
- **`vitest run`, scoped to the 7 new test files only** (not the project's `test:unit` suite): **47/47 tests
  pass** — 40 correctness tests (`financeGridSelectionModel.test.ts` ×10, `financeGridPasteEngine.test.ts` ×7,
  `financeGridFillEngine.test.ts` ×5, `financeGridBulkOpsEngine.test.ts` ×7, `financeGridFindReplaceEngine.test.ts`
  ×5, `financeGridViewState.test.ts` ×6) + 7 performance-proxy tests
  (`financeGridPerformance.test.ts`, numbers in section 10).
- No `npm run type-check` / full-project `tsc`, and no full `vitest run tests/unit` was run — both would pull
  in the rest of the repo (including files unrelated to this work package, some of which memory notes record
  as pre-existing red) and would not have added information about these 8 new files.
- No database, of any kind (production, demo, dev, or ephemeral), was connected to during this work package.
  No migration file was created or altered by this package. No existing file was modified.

---

## 12. Judgment calls / open questions flagged for the executive work package

1. **Paste special `FORMULAS_ONLY`/`FORMATS_ONLY` have no representation in AP-00's `FinanceValue`** (section
   6) — closing this requires a future ADR adding formula/format fields to `FinanceValue`, which this package's
   allowlist does not include.
2. **`FindReplaceEngine` cannot search by "formula" or "quality"** for the same underlying reason (section 8)
   — "quality" specifically requires wiring to `exceptionLedgerService.ts` (Gate C), which this DB-free package
   deliberately does not depend on; a future integration package could compose a quality-aware predicate from
   outside using the generic `CellPredicate` shape this file already exposes.
3. **Cross-batch atomicity above 1000 cells is not attempted** (sections 6-8) — a paste/fill/bulk-op needing
   more than one batch can partially commit if a later chunk fails. This package does not implement
   compensating `reset`/`clear` operations to unwind an already-committed chunk; flagged as an AP-04 (Undo)
   concern, since AP-04 owns the undo stack these `Operation` entries feed into and is the natural owner of a
   "rollback a partially-applied bulk action" flow.
4. **No live `GridAddressResolver` implementation exists yet** (section 4) — this package only defines and
   tests the interface plus a synthetic performance-test implementation. The real one (reading actual entity/
   line/period order, respecting live filters/sort) is React-layer AP-01 work explicitly deferred past this
   core-logic package, per the task's own scope boundary.
5. **`toggleRange`'s whole-rectangle semantics vs. a true per-cell XOR** (section 5) — flagged as a
   deliberate simplification pending real UX validation once a component exists to test it against; not
   expected to matter for the dominant single-cell ctrl-click case, but worth re-confirming against Excel/
   Sheets behavior during the future dev-render/Piotr-acceptance step (`CLAUDE.md` rule 7).

---

## 13. Traceability

| Task scope item | Section of this ADR | File |
|---|---|---|
| 1. GridSelectionModel (multi-range, add/subtract/toggle, iteration) | §5 | `GridSelectionModel.ts` |
| 2. PasteEngine (rectangular paste, Operation.batch, paste special, pre-validation) | §6 | `PasteEngine.ts` |
| 3. FillEngine (down/right, numeric progression, simple copy) | §7 | `FillEngine.ts` |
| 4. BulkOpsEngine (bulk clear/reset/set) | §8 | `BulkOpsEngine.ts` |
| 5. FindReplaceEngine (predicate find, optional replace) | §8 | `FindReplaceEngine.ts` |
| 6. GridViewState (freeze/pin/hide/group, in-memory only, not AP-07) | §8 | `GridViewState.ts` |
| 7. 1000-cell batch limit — decision + rationale (split, not reject) | §6 | `PasteEngine.ts`, `FillEngine.ts`, `BulkOpsEngine.ts`, `FindReplaceEngine.ts`, `gridCoordinates.ts` |
| 8. 10k×120 performance tests, sparse structure, measured results | §10 | `tests/unit/finance/financeGridPerformance.test.ts` |
| Hard scope boundary: no React/UI component, no DOM, integration contract only | §9 | — |
| Hard prohibition: no DB connection | §11 | — |

---

## Appendix — files delivered

```
server/src/services/finance/grid/gridCoordinates.ts
server/src/services/finance/grid/engineContext.ts
server/src/services/finance/grid/GridSelectionModel.ts
server/src/services/finance/grid/PasteEngine.ts
server/src/services/finance/grid/FillEngine.ts
server/src/services/finance/grid/BulkOpsEngine.ts
server/src/services/finance/grid/FindReplaceEngine.ts
server/src/services/finance/grid/GridViewState.ts
server/src/services/finance/grid/index.ts
tests/unit/finance/financeGridSelectionModel.test.ts
tests/unit/finance/financeGridPasteEngine.test.ts
tests/unit/finance/financeGridFillEngine.test.ts
tests/unit/finance/financeGridBulkOpsEngine.test.ts
tests/unit/finance/financeGridFindReplaceEngine.test.ts
tests/unit/finance/financeGridViewState.test.ts
tests/unit/finance/financeGridPerformance.test.ts
docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md   (this file)
```

No existing file was modified. No migration file was created or altered. No database, of any kind
(production, demo, dev, or ephemeral), was connected to during this work package. No React component, DOM
code, or dev-render harness entry was created — that is a separate, later step per `CLAUDE.md` rule 7.
