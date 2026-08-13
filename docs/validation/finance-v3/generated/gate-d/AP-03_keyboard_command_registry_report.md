# AP-03 — Keyboard Command Registry (Gate D, Finance v3 continuation)

**Program:** `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`, section 3 point 3
("Keyboard-first: pelna nawigacja i edycja, copy/paste, undo/redo, find, save, edit, delete, select oraz
skroty Compute/Compare/Comments") and
`docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 10 ("Keyboard: Pelny
core workflow bez myszy, command palette, standardowe skroty, focus restore i task benchmark <=90 s").
**Date:** 2026-08-10
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`
**Status:** `CODE + TESTS — real code, real vitest run, NOT deployed/migrated to demo/dev/prod. NO UI/React binding — see section 5.`

---

## 1. Inputs read

1. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` section 3 point 3 (Keyboard-first
   scope) — this task's own instruction.
2. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 10 ("Keyboard")
   and `FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`'s "AP-03 Keyboard command layer" work-package entry
   ("Pelny workflow bez myszy, command registry/palette i keyboard benchmark <=90 s").
3. `server/src/services/finance/grid/*.ts` (AP-01) — read in full: `GridSelectionModel.ts`, `PasteEngine.ts`,
   `FindReplaceEngine.ts`, `BulkOpsEngine.ts`, `gridCoordinates.ts`, `engineContext.ts` — the engines this
   registry's handlers must map onto, not duplicate.
4. `server/src/services/finance/collaboration/{operationStack,autosaveService,computePinning}.ts` (AP-04) —
   read in full: `OperationStack.undo`/`redo`, `autosaveService.checkpointOperationStack`,
   `computePinning.enqueueComputeForCurrentRevision`.
5. `server/src/services/finance/canonical/financeCompareService.ts` (AP-05) and
   `server/src/services/finance/canonical/commentService.ts` (AP-06) — read the exported function signatures
   (`compareValues` + its six named wrappers, `createComment`) that `finance.compare`/`finance.comment` bind to.
6. `server/src/types/finance/Operation.ts` (AP-00) — `OpSet`/`OpClear`/`OpPaste`/`OpBulkSet`/`OpReset`,
   `operationTargets`, `EngineMutationContext` shape every AP-01 engine shares.
7. `server/src/types/finance/WorkspaceState.ts` (AP-00) — `FinanceGridSelectionState` (`activeCell`/`ranges`),
   the shape `FocusRestoreContract.ts` integrates with, per the task's own instruction ("integracja z
   WorkspaceState z AP-00").
8. `tests/unit/finance/financeGridPerformance.test.ts` (AP-01) — the existing proxy-benchmark pattern
   (`performance.now()`, `[perf]`-prefixed `console.log`, `expect(elapsedMs).toBeLessThan(...)`) this work
   package's benchmark test reuses verbatim rather than inventing a second style.

---

## 2. What was implemented

New directory: `server/src/services/finance/keyboard/` (zero prior files — first AP-03 work in this program).

| File | Lines | Purpose |
|---|---|---|
| `commandTypes.ts` | 242 | `KeyCombo` (cross-platform `mod`/`shift`/`alt` + literal `key`), `comboMatchesEvent`/`describeCombo`/`comboIdentity`, `CommandContext`/`CommandCategory`/`ApOwner`, `CommandEngineBinding` (3-shape union), `KeyboardCommand`. |
| `KeyboardCommandRegistry.ts` | 445 | `FINANCE_KEYBOARD_COMMANDS` — the 22-command declarative registry — plus `KeyboardCommandRegistry` (lookup/resolve class) and `findComboCollisions`/`assertNoComboCollisions`. |
| `CommandPaletteIndex.ts` | 104 | `CommandPaletteIndex` — searchable wrapper over the same commands: precomputed `searchTokens` (fuzzy-search-ready shape) + a plain substring `search()`/`searchInContext()` placeholder. |
| `FocusRestoreContract.ts` | 155 | `FocusSnapshot`/`FocusRestorePatch` types + `captureFocusSnapshot`/`focusTargetForOperation`/`resolveFocusRestorePatch`/`applyFocusRestoreToSelection` — integrates with AP-00's `FinanceGridSelectionState`. |
| `index.ts` | 13 | Barrel export. |
| `__tests__/KeyboardCommandRegistry.test.ts` | 491 | 25 tests: registry shape/typing, collision detection (positive + negative case), palette search, focus-restore contract (including a real `OperationStack.undo()` integration), and the <=90s core-workflow benchmark. |

### 2.1 The 22-command registry

**Standard shortcuts (19):** `grid.copy` (Mod+C), `grid.paste` (Mod+V), `grid.undo` (Mod+Z), `grid.redo`
(Mod+Shift+Z), `grid.find` (Mod+F), `grid.save` (Mod+S, context `global`), `grid.clearDelete` (Delete),
`grid.clearBackspace` (Backspace), `grid.navigateUp/Down/Left/Right` (arrow keys), `grid.extendUp/Down/Left/Right`
(Shift+arrow), `grid.confirmEdit` (Enter, context `cell-editing`), `grid.cancelEdit` (Escape, context
`cell-editing`), `grid.nextCellTab` (Tab).

**Finance-specific shortcuts (3):** `finance.compute` (Mod+Enter), `finance.compare` (Mod+D), `finance.comment`
(Mod+M) — see judgment call in section 4.1 for why these resolve to `Mod` rather than the task brief's literal
"Ctrl" wording.

Every command carries: a `KeyCombo` (cross-platform), a `context` (`grid-focused`/`cell-editing`/`global`), a
`category` (for palette grouping), a `label`/`description` (palette display + search text), an `engineBinding`
(which real function it resolves to — see 2.2), and a `focusRestoreReason` (or `null` if the command never
moves focus).

### 2.2 Engine bindings — what each command actually maps to

| Command | Engine | Module | Function |
|---|---|---|---|
| `grid.copy` | AP-01 | `grid/GridSelectionModel.ts` | `iterateCells` (+ AP-03-owned clipboard glue — see gap note below) |
| `grid.paste` | AP-01 | `grid/PasteEngine.ts` | `buildPasteOperations` |
| `grid.undo` | AP-04 | `collaboration/operationStack.ts` | `OperationStack.undo` (instance method) |
| `grid.redo` | AP-04 | `collaboration/operationStack.ts` | `OperationStack.redo` (instance method) |
| `grid.find` | AP-01 | `grid/FindReplaceEngine.ts` | `findCells` |
| `grid.save` | AP-04 | `collaboration/autosaveService.ts` | `checkpointOperationStack` |
| `grid.clearDelete` / `grid.clearBackspace` | AP-01 | `grid/BulkOpsEngine.ts` | `buildBulkOperations` (`kind: 'CLEAR'`) |
| `grid.navigate*` / `grid.nextCellTab` | AP-01 | `grid/GridSelectionModel.ts` | `selectSingle` (+ AP-03-owned coordinate arithmetic) |
| `grid.extend*` | AP-01 | `grid/GridSelectionModel.ts` | `extendTo` (+ AP-03-owned coordinate arithmetic) |
| `grid.confirmEdit` | AP-00 | `types/finance/Operation.ts` | inline `OpSet` literal — **documented gap, see 4.2** |
| `grid.cancelEdit` | — | — | keyboard-owned, no engine call (local state discard) |
| `finance.compute` | AP-04 | `collaboration/computePinning.ts` | `enqueueComputeForCurrentRevision` |
| `finance.compare` | AP-05 | `canonical/financeCompareService.ts` | `compareValues` (generic primitive; UI picks the axis wrapper) |
| `finance.comment` | AP-06 | `canonical/commentService.ts` | `createComment` (anchor = active cell's `CellRef`) |

### 2.3 `CommandPaletteIndex`

Wraps the same 22 commands in a `CommandPaletteEntry[]` carrying precomputed `searchTokens` (lowercased,
tokenized `id`/`label`/`description`/`category`) and precomputed `comboLabel: {mac, windows}`. `search()`/
`searchInContext()` are a plain case-insensitive substring match — **explicitly not fuzzy search**, per the
task's own wording ("fuzzy-search-ready struktura, nie sama implementacja fuzzy search"); a future UI swaps
this method for Fuse.js/`cmdk` scoring against the same `searchTokens` shape without touching the registry.

### 2.4 `FocusRestoreContract`

`FocusSnapshot` (what had focus, why, when) and `FocusRestorePatch` (`{activeCell, collapseSelection}`).
`focusTargetForOperation(operation)` reads AP-00's `operationTargets()` to find the first target cell — the
"focus returns to the last-edited cell" behavior the task brief names explicitly for undo. `collapseSelection`
is `true` for `undo`/`redo`/`paste`/`bulkOp` (the operation defines a new focal point, Excel re-selects it) and
`false` for `findNavigate`/`editConfirm`/`editCancel`/`commandPaletteInvoke` (focus moves, selection shape does
not change). `applyFocusRestoreToSelection` produces a patch shaped exactly like AP-00's
`FinanceGridSelectionState` (`{activeCell, ranges}`) for a caller to spread into `FinanceWorkspaceState.selection`
directly — no parallel "focus" field invented.

---

## 3. Tests

`server/src/services/finance/keyboard/__tests__/KeyboardCommandRegistry.test.ts` — 25 tests, all passing, pure
unit (no DB, no DOM):

```
npx vitest run server/src/services/finance/keyboard/__tests__/KeyboardCommandRegistry.test.ts
 Test Files  1 passed (1)
      Tests  25 passed (25)
```

- **Registry shape (14 tests):** all 22 command ids present, no duplicate ids, zero combo collisions in the
  shipped registry (task scope item 5), a synthetic collision IS detected (positive control — proves the
  check isn't vacuously passing), same combo in two different contexts is correctly NOT flagged (Enter:
  grid-focused start-edit vs cell-editing confirm-edit is standard editor behavior, not ambiguity — see
  section 4.1 in `KeyboardCommandRegistry.ts`'s own header), every command's `engineBinding` is
  structurally valid and exhaustively typed (`switch` over the 3-shape union with a `never` check), the three
  finance shortcuts are verifiably bound to the real AP-04/AP-05/AP-06 function names (not placeholder
  strings), cross-platform resolution (`Mod+C` matches `Ctrl+C` on Windows and `Cmd+C` on Mac, and Mac's
  `Ctrl+C` does NOT falsely match `grid.copy`), undo vs redo disambiguation, `global` context reachability,
  `Enter` context-scoping, `describeCombo` label rendering.
- **`CommandPaletteIndex` (5 tests):** full indexing, case-insensitive substring search, empty-query
  browse-all, context-scoped search, precomputed combo labels.
- **`FocusRestoreContract` (5 tests):** snapshot capture, `focusTargetForOperation`, collapse-vs-preserve
  table for all 8 `FocusRestoreReason` values, `applyFocusRestoreToSelection` shape integration, and one
  **real integration test** that pushes a `set` Operation onto a live `OperationStack`, calls the actual
  `.undo()`, and resolves+applies focus restore from its real `inverseOperation` — not a mock.
- **Core-workflow benchmark (1 test):** simulates `select range -> copy -> navigate -> paste -> undo -> find ->
  replace -> save` as direct function calls per the task's own instruction ("nie realne nacisniecia klawiszy,
  to backend"). Each step first resolves the command via `KeyboardCommandRegistry.resolve()` against a
  synthetic `KeyboardEventLike`, then calls the REAL bound engine function: `GridSelectionModel.extendTo`/
  `selectSingle`/`iterateCells`, `PasteEngine.buildPasteOperations` (real batch built and pushed onto a real
  `OperationStack`), `OperationStack.undo()` (real inverse operation, fed back into `focusTargetForOperation`),
  `FindReplaceEngine.findCells`. `grid.save`'s binding (`autosaveService.checkpointOperationStack`) is
  DB-backed and out of this pure-logic package's scope, so the benchmark resolves the command but does not
  execute the DB call — consistent with every other AP-01/AP-04 pure-logic test in this program never touching
  Postgres.
  **Measured: 2.58 ms**, against the 90,000 ms (90 s) budget — a ~35,000x margin, expected since this is a CPU-
  bound proxy over in-memory logic with no DOM/network round trip, the same relationship
  `financeGridPerformance.test.ts` documents between its own proxy numbers and the product's real 45 FPS/100 ms
  targets (a lower bound / sanity check, not proof of the full UI-attached budget).

---

## 4. Judgment calls (documented gaps, not silent decisions)

### 4.1 `Mod` instead of literal `Ctrl` for the three finance-specific shortcuts

The task brief's own wording for the finance shortcuts says "Ctrl+Enter compute, Ctrl+D compare, Ctrl+M
comment" — literal Ctrl. But the SAME introducing sentence requires "key combo (cross-platform Mac/Windows)"
for every command, standard and finance-specific alike. A hardcoded Ctrl-only combo would silently do nothing
on macOS for exactly the three highest-value finance actions — the opposite of "keyboard-first". This registry
resolves the tension in favor of the general cross-platform requirement: all three use `mod: true` (Ctrl on
Windows/Linux, Cmd on macOS), documented in `commandTypes.ts`'s `KeyCombo` doc comment. Flagged here rather than
silently decided, per this program's own discipline (`PasteEngine.ts`'s `FORMULAS_ONLY`/`FORMATS_ONLY` gap-
documentation is the model followed).

### 4.2 `grid.confirmEdit` has no dedicated AP-01/AP-04 builder function

`PasteEngine`/`BulkOpsEngine`/`FindReplaceEngine` all build MULTI-cell batches (`paste`/`bulk_set`/`clear`/
`reset`); `OperationStack` only ever emits the INVERSE of an already-applied operation. Nothing in AP-01/AP-04
builds a single-cell `'set'` Operation from a UI edit — that is a direct literal against `Operation.ts`'s own
`OpSet` shape, stamped with the same actor/idempotency/`sourceWorkingRevisionId` fields every engine's
`EngineMutationContext` already carries. `grid.confirmEdit`'s `engineBinding` is `kind: 'inline-contract'`
rather than `kind: 'function'` specifically to name this gap rather than inventing a phantom AP-01 export that
does not exist. Same style as `PasteEngine.ts`'s own documented `FORMULAS_ONLY`/`FORMATS_ONLY` gap.

### 4.3 `grid.copy` has no dedicated AP-01 builder either

AP-01 only models writing TO cells (`Paste`/`BulkOps`), never reading a selection's values out for the
clipboard — that read is `GridSelectionModel.iterateCells()` combined with the caller-owned cell-value store
(the same `GridCellSnapshot` source `FindReplaceEngine.ts` already documents this package never owns).
`grid.copy`'s `engineBinding.note` names this as AP-03-owned glue on top of the one real AP-01 read primitive,
not an invented AP-01 function.

### 4.4 Collision uniqueness is scoped per `(context, combo)`, not globally

`Enter` legitimately means two different things depending on context (start-edit outside this registry's
current scope vs. `grid.confirmEdit` while editing) — every spreadsheet application this program is modeled on
works this way. `findComboCollisions`/`assertNoComboCollisions` check per-context uniqueness; a test
(`does NOT flag the same combo used in two different contexts`) proves this is a deliberate design decision,
not an oversight, by asserting the negative case directly.

---

## 5. Explicitly OUT OF SCOPE — UI/React binding

**This work package ships zero DOM code.** No `keydown` listener, no `event.preventDefault()`, no React
import, no `HTMLElement.focus()` call exists anywhere in `server/src/services/finance/keyboard/`. Per the task
instruction ("NIE buduj UI/React komponentu przechwytujacego klawisze ... to wymaga dev-render/harness i
akceptu wizualnego, osobny krok"), this is a hard boundary, not an oversight.

**Contract a future `FinanceDataGrid` keyboard-shortcut React hook is expected to implement**, using ONLY
these exports:

1. Own one `KeyboardCommandRegistry` instance per open Finance artifact (construction validates zero combo
   collisions — throws synchronously if the shipped `FINANCE_KEYBOARD_COMMANDS` array is ever hand-edited
   into an ambiguous state, catching the bug at app-start rather than at first keypress).
2. On every `keydown`, call `registry.resolve(event, currentContext, platform)` — `currentContext` is
   `'cell-editing'` while an inline cell editor is focused, `'grid-focused'` otherwise; `platform` is sniffed
   once at app start (`navigator.platform`/`navigator.userAgentData`). A non-null result means: call
   `event.preventDefault()` (this package intentionally never does that itself — a UI-layer decision, since a
   `null` result must let the browser's native handling through, e.g. arrow keys inside an actual `<input>`),
   then dispatch on `command.engineBinding.kind` to invoke the named function against the module path given
   (with the resolver's own concrete grid/selection/workspace state as arguments).
3. Before invoking a command whose `focusRestoreReason` is non-null, call `captureFocusSnapshot`; after the
   engine call resolves (including any async DB round trip for `AP-04`/`AP-05`/`AP-06`-bound commands), resolve
   the actual target (`focusTargetForOperation` for anything that produced an `Operation`, or the snapshot's
   own `activeCell` as a fallback) via `resolveFocusRestorePatch`, then `applyFocusRestoreToSelection` into
   `FinanceWorkspaceState.selection` and call the DOM focus() on the resulting `activeCell`'s rendered
   `<td>`/cell element.
4. Feed `FINANCE_KEYBOARD_COMMANDS` into a `CommandPaletteIndex` once; wire the palette's search box to
   `index.search(query)` / `index.searchInContext(query, currentContext)`, and its shortcut-hint column to
   `CommandPaletteIndex.comboLabelFor(entry, platform)`.

No further design decisions are needed for that hook to exist — every ambiguity a UI implementer would
otherwise have to invent an answer for (which function to call, which module it lives in, whether this combo
collides with another, how focus should behave after undo) is already resolved by this contract.

---

## 6. Commits

Worktree: `/private/tmp/finance-v3-gate-a-20260809`, branch `codex/finance-v3-gate-a-20260809`. New files only
(`git add` scoped to the new `server/src/services/finance/keyboard/` directory and this report), not pushed —
see commit SHA recorded by the calling session.
