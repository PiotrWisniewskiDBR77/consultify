# APWAVE-03 — Keyboard command layer: destructiveness, scope, permissions, workspace commands

**Extends:** `docs/validation/finance-v3/generated/gate-d/AP-03_keyboard_command_registry_report.md` (the
original 22-command registry). Read that first; this report covers only what changed.
**Date:** 2026-08-10
**Worktree:** `/Users/piotrwisniewski/consultify-wt/apwave-ap3-commands`, branch
`codex/finance-v3-apwave-ap3-commands`, based on the frozen accepted SHA `19b4b06934`.
**Status:** `CODE + TESTS — real code, real vitest run. NOT pushed, NOT merged, no migration, no UI/React binding.`
**Commits:**

| SHA | Scope |
|---|---|
| `0d968a8ff9` | Point 1 — destructive-shortcut fix (data-safety blocker), committed separately. |
| `6115ed2263` | Points 2-4 — scope, availability/`canExecute`, workspace commands, tests. |

**Files touched (allowlist respected):** `server/src/services/finance/keyboard/**` and this report. Nothing
under `server/src/services/finance/workspace/**` (including `moduleAdapters.ts`), no migrations, no other
package.

---

## 0. Baseline vs. result

| Measure | Before (`19b4b06934`) | After |
|---|---|---|
| `npx tsc --noEmit -p server/tsconfig.json` | exit 0, 0 errors | exit 0, 0 errors |
| Test-file typecheck (see note) | not run — file is excluded from `server/tsconfig.json` | exit 0, 0 errors |
| `vitest run src/services/finance/keyboard` | 25 passed | **59 passed** |
| `vitest run src/services/finance/workspace` (regression) | 80 passed | 80 passed |
| Commands in registry | 22 (all grid-level) | **30** (22 grid + 8 workspace) |

> **Note worth carrying forward:** `server/tsconfig.json` excludes `**/*.test.ts`, and vitest transpiles with
> esbuild, which does not typecheck. A type error in the test file is therefore invisible to BOTH commands the
> brief asked me to run. I typechecked the test file explicitly with a temporary config that includes it, and
> it found four real type errors in my new test code plus one pre-existing unsound narrowing in the old
> benchmark fixture (`ref.rowKey.entityId` on a `CellRef` union). All fixed. Anyone extending these tests
> should repeat that step; "vitest is green" says nothing about the test file's types.

---

## 1. Point 1 — destructive single-key shortcuts (the blocker)

### 1.1 What was actually wrong

`Delete` and `Backspace` were bound, with no modifier and no confirmation, to `BULK_CLEAR_BINDING` →
`BulkOpsEngine.buildBulkOperations({ kind: 'CLEAR' })`, whose own note states it forces `value_status = MISSING`
for **every selected cell**. The registry also ships `grid.extendUp/Down/Left/Right` on `shift`+arrows. So the
hazardous sequence was two ordinary gestures: extend a selection with shift+arrows (hand already on the
modifier row), then brush `Delete` — N audited financial values destroyed, no prompt. `focusRestoreReason` was
`null` on both commands, so the contract did not even say where focus lands afterwards; the user was not
returned to the damage.

That this was an oversight rather than a decision is evidenced by `workspaceBarContract.ts` (AP-09), which for
the mouse-driven half of the same product carries `destructive` + `requiresConfirmation` on both
`WorkspaceBarMoreMenuItem` and `WorkspaceBarLifecycleTransition`, and whose validator rejects
`DESTRUCTIVE_WITHOUT_CONFIRMATION` outright (OWN-FIN-012). The keyboard layer had none of those fields.

### 1.2 The resolution chosen, and why

**Delete/Backspace keep the bare keys and gain a scaled guard**, declared once in `CLEAR_DESTRUCTIVENESS`:

```
destructive: true, requiresConfirmation: false, confirmAboveTargetCount: 1
focusRestoreReason: 'bulkOp'   (was null)
```

Meaning: clearing the **single active cell** fires instantly; clearing **2 or more** requires an explicit
confirmation before the engine is called.

Alternatives considered and rejected:

- *Move CLEAR to `Mod+Delete`.* Rejected. It guards the bulk case by breaking the most reflexive gesture in any
  grid ("select cell, press Delete") for the one case that is genuinely harmless — blast radius 1, undoable
  with one `Mod+Z`. It buys safety the user does not need at that scale, and pushes people back to the mouse,
  which is the opposite of what this work package exists for.
- *Always confirm.* Rejected for the same reason, plus it would put a modal in the middle of the keyboard-only
  core workflow the same task measures.
- *Do nothing because it is undoable.* Rejected. Undo requires noticing; a cleared off-screen block below the
  fold is exactly what is not noticed. Undo is why the single-cell case can stay unguarded, not why the bulk
  case can.

The hazard is the SCALE, not the key — so the guard is scaled. `MAX_UNCONFIRMED_BARE_KEY_TARGETS = 1` is the
one constant the whole policy hangs on.

`grid.paste` is deliberately **not** classified destructive (asserted in a test so a silent flip is visible):
it substitutes content the user just supplied, has a full inverse on the AP-04 stack, and is unconfirmed in
every spreadsheet this program models. CLEAR is different — it manufactures *absence* of data in an artifact
whose purpose is auditable presence.

### 1.3 The validator rule added (so regression is impossible)

`findDestructiveGuardViolations` / `assertDestructiveCommandsAreGuarded`, run by the
`KeyboardCommandRegistry` constructor immediately after `assertNoComboCollisions` — same placement, same
"fails at construction, not at first keypress" property. Four codes:

| Code | Rejects |
|---|---|
| `DESTRUCTIVE_WITHOUT_CONFIRMATION` | destructive with no confirmation and no threshold — **this is the exact pre-fix declaration**. Code name copied verbatim from AP-09's bar validator so both halves cannot drift into two definitions of "guarded". |
| `DESTRUCTIVE_BARE_KEY_THRESHOLD_TOO_HIGH` | destructive on an unmodified key with a threshold above `MAX_UNCONFIRMED_BARE_KEY_TARGETS` — stops the guard being defeated by declaring `confirmAboveTargetCount: 500`. |
| `DESTRUCTIVE_WITHOUT_FOCUS_RESTORE` | destructive with `focusRestoreReason: null` — the second half of the original defect. |
| `GUARD_ON_NON_DESTRUCTIVE_COMMAND` | a confirmation flag on a non-destructive command (half-declared policy). |

`comboHasGuardModifier` counts `mod` and `alt` but **not `shift`**: shift is the range-extension key on this
very grid, so the user's hand is already on it in the dangerous case, and Windows Explorer uses Shift+Delete
to mean "delete permanently" — the opposite of a guard.

Declaration alone is not enforcement, so the policy also has a runtime application point:
`requiresConfirmationBeforeExecuting(command, targetCount)`, called by the new single entry point
`KeyboardCommandRegistry.dispatch()`, which returns `needs-confirmation` instead of `execute`. A caller using
`dispatch` cannot skip the guard; the guard's own unit tests use the same path.

Test coverage includes a **negative control** that rebuilds the pre-fix declaration and proves each violation
is actually raised, plus a mid-workflow test showing an unconfirmed bulk clear leaves the store untouched.

---

## 2. Point 2 — scope, permissions, `canExecute`, readable reason

### 2.1 Scope: one new axis, not two

`CommandScope = 'grid' | 'workspace'` — the LEVEL axis, orthogonal to `CommandContext` (the MODE axis).

**Artifact type was deliberately NOT made a third dispatch axis.** It does not change *where* a key is
dispatched — the same key means the same thing in every workspace, it is merely unavailable on some artifact
types. That is an availability question, so it lives in `KeyboardCommandAvailability.artifactTypes` as one more
fail-closed whitelist. Adding it to the dispatch matrix would have produced a scope × context × artifactType
lookup whose cells are almost all identical.

**Collision semantics changed, but not the way the brief's shorthand suggests.** "Disjoint scopes may share a
combo" is true in general and false for these two scopes: a workspace-level shortcut such as Focus Mode is
pressed *while the grid has focus* — that is its whole point. So scope is not the collision key. The key is the
**activation set**, computed by `commandActivations()` over `(surface × context)`, where
`activationSurfaces('workspace') = ['grid', 'workspace-chrome']`. Consequences, all tested:

- A workspace command reusing a grid combo IS flagged (the safety property).
- Genuinely disjoint activations MAY share a combo — and the shipped registry uses this: `Escape` is
  `grid.cancelEdit` while editing and `workspace.exitFocusMode` while not.
- It closes a **pre-existing hole**: the old `${context}::${combo}` key only compared `'global'` commands
  against other `'global'` commands, so a `grid-focused` command duplicating `grid.save`'s `Mod+S` was not
  reported even though `forContext('grid-focused')` returns both. Now reported.

The positive control (synthetic duplicate of `grid.copy` → detected, constructor throws) is unchanged and still
present.

### 2.2 Permissions: AP-09's model REUSED, with a named delta

`CommandAvailability.ts` imports and delegates; it does not re-implement.

- `KeyboardCommandAvailability **extends** WorkspaceBarEnablement` (statuses / roles / freshness /
  requiresGates, all fail-closed whitelists with an explicit `'any'`).
- `evaluateCommandAvailability` **delegates to `resolveControlState`** for STATUS/ROLE/FRESHNESS/GATE, in
  AP-09's own order, so a user gets the same answer whether they clicked the bar button or pressed the key.
- Labels use AP-09's `WorkspaceBarLabel` shape (i18n key + Polish default).
- Role bands (`PREPARER_PLUS`, `REVIEWER_PLUS`) and `EDITABLE_STATUSES` are named exactly as `moduleAdapters.ts`
  names them, so the two files can be diffed.

**Delta, and why reuse alone was insufficient (three items, each justified in the file):**

1. `artifactTypes` — the bar is built by a per-module adapter that already knows its artifact type; a single
   global keyboard registry does not. Kept as a whitelist next to the inherited fields so the fail-closed
   discipline is not diluted.
2. `requiresViewportCapability` — AP-09 already decided this in `FINANCE_VIEWPORT_CAPABILITIES` (mobile is
   fail-closed for edit/compute/review; tablet is review/read only), but **nothing connected that decision to a
   key handler**, so a Bluetooth keyboard on a tablet walked straight past an existing policy. This is wiring
   of AP-09's table, not a new policy.
3. **A displayable reason.** This is the real gap the brief names, and reuse cannot close it:
   `resolveControlState` returns `{ reason: 'ROLE', detail: 'viewer' }`. A greyed-out button survives that
   because it sits next to its own label; a keyboard shortcut has no visible surface at all — the user presses
   a key, nothing happens, and the feature is indistinguishable from a bug. `describeCommandUnavailability`
   maps every code to a `WorkspaceBarLabel`, translating enum values rather than leaking them:
   `APPROVED → „Zatwierdzone"`, `viewer → „Podgląd"`, `VALUATION_CASE → „Wycena"`. Gate names are machine
   strings, so `CommandEvaluationContext.gateLabels` lets a module supply readable ones; without it the message
   degrades to a full sentence containing the gate name, never to a bare code.

`canExecute` is exposed twice, deliberately: as `registry.canExecute(command, ctx)` for a palette rendering a
disabled row with a reason, and inside `dispatch()` for a keypress. Both call the same function — a test
asserts the two paths return the identical reason and message.

`CommandDispatchContext` **requires** the availability facts rather than accepting them optionally: an optional
permission context is how a fail-closed model quietly becomes fail-open when one field is forgotten.

`grid.cancelEdit` is the one command declared `AVAILABILITY_ALWAYS` — a blocked Escape would trap the user
inside a cell editor. Tested against viewer / ARCHIVED / mobile.

---

## 3. Point 3 — workspace-level commands (8 added)

| Id | Combo | Context | Binding |
|---|---|---|---|
| `workspace.commandPalette` | `Mod+K` | global | keyboard-owned (`CommandPaletteIndex`) |
| `workspace.toggleFocusMode` | `Mod+Shift+F` | global | AP-09 `focusModeContract.enterFocusMode`/`exitFocusMode` |
| `workspace.exitFocusMode` | `Escape` | grid-focused | AP-09 `focusModeContract.exitFocusMode` |
| `workspace.nextView` | `Mod+PageDown` | grid-focused | workspace-state (`WorkspaceBarViewNavigation.activeViewId`) |
| `workspace.previousView` | `Mod+PageUp` | grid-focused | workspace-state (same) |
| `workspace.toggleRelatedPanel` | `Mod+Shift+R` | grid-focused | AP-09/AP-11 `lineageNavigatorContract.buildRelatedPanel` |
| `workspace.lifecycleMenu` | `Mod+Shift+L` | grid-focused | inline-contract `WorkspaceBarLifecycleControl` |
| `workspace.back` | `Alt+ArrowLeft` | grid-focused | workspace-state (`WorkspaceBarIdentity.back.targetListRoute`) |

**Two phantoms closed** (each has a dedicated test):

1. `focusModeContract.ts` declared `FocusModeTrigger = ... | 'keyboard-shortcut'` and **no keyboard shortcut
   existed anywhere** to produce it. `workspace.toggleFocusMode` now does; the test drives
   `enterFocusMode({ trigger: 'keyboard-shortcut' })` for real.
2. `FocusRestoreContract.ts` declared the reason `'commandPaletteInvoke'` and **nothing opened the palette**.
   `workspace.commandPalette` (`Mod+K`) now carries exactly that reason.

**Escape is deferred, not seized.** `workspace.exitFocusMode` is registered in `grid-focused` only, and its
note states that a key handler must consult AP-09's `resolveEscapeKey` precedence table first
(modal > command-palette > popover > cell-editing > focus-mode). Tested from both directions.

**Lifecycle opens the menu; it does not fire a transition.** A shortcut that submitted or archived directly
would be a second destructive-by-keyboard surface and would bypass `WorkspaceBarLifecycleTransition`'s own
`destructive`/`requiresConfirmation`/`requiresReason` flags — the very fields this wave exists to honour. A
test asserts no registry entry binds a `LifecycleAction` name.

**Bridge convention reused:** ids are the ids `WorkspaceBarPrimaryAction.keyboardCommandId` /
`WorkspaceBarSecondaryAction.keyboardCommandId` can point at. Note in passing (out of allowlist, not changed):
`moduleAdapters.ts` gives all five modules a `finance.<module>.related` secondary action with
`keyboardCommandId: null` — `workspace.toggleRelatedPanel` is now the value that field is waiting for.

**Adapters were NOT touched and did not need to be.** Every change is additive to types the adapters do not
construct: adapters build `WorkspaceBar*` objects and reference keyboard commands only by string id. The new
required fields (`scope`, `availability`, the three destructiveness fields) live on `KeyboardCommand`, which no
adapter builds. `tsc -p server/tsconfig.json` stays at 0 errors and the 80 workspace tests still pass. One
type in `commandTypes.ts` was *widened* rather than narrowed (`InlineContractEngineBinding.engine`:
`'AP-00'` → `ApOwner`), which cannot break an existing caller. A fourth `CommandEngineBinding` kind
(`'workspace-state'`) was added — additive to a union that only this package constructs.

---

## 4. Point 4 — tests (25 → 59)

New blocks: destructive guards (7 tests, incl. negative control), scope & collision semantics (4), `canExecute`
and reasons (8), workspace commands & phantoms (6), AP-03↔AP-09 focus-model agreement (4), the rewritten core
workflow (4). Existing tests kept; two were consciously updated:

- the id-list test still **requires** `grid.clearDelete`/`grid.clearBackspace` (the fix keeps both keys, so
  removing them would have been the wrong resolution) — with a comment pointing at the guard;
- the `engineBinding` structural test gained the `'workspace-state'` case and now checks against `AP_OWNERS`
  instead of a hand-copied literal list that had already drifted.

### 4.1 Focus-model agreement (new)

Before this wave the codebase carried two unrelated focus models — AP-03's `FocusSnapshot` /
`resolveFocusRestorePatch` and AP-09's `FocusModeSession.focusedCell` / `restoreFocusToControlId` — with no
bridge and no test, so AP-09 restoring cell A while AP-03's snapshot said cell B would have been invisible to
every test in either package. Two bridge functions were added **inside the allowlist** (`FocusRestoreContract.ts`):
`focusSnapshotFromFocusModeSession` and `focusRestorePatchFromFocusModeEffects`, plus the reason
`'focusModeExit'` (never collapses the selection — collapsing would break AP-09's "toggle preserves selection"
guarantee from the other side). AP-09 was **not** modified; the bridge converts, it does not duplicate state.
Four tests: round-trip agreement, no-collapse, reference-identity of workspace state (AP-09's "nie refetchuje"
still holds through the bridge), and no invented target on a no-op exit.

### 4.2 Keyboard-only: **EVIDENCE_MISSING** (strengthened, but not proven)

The old benchmark resolved a command and then called engines directly; there was no single entry point, no
executor table, and steps 7 (replace) and 8 (save) were comments rather than executed code. It timed a straight
line of engine calls and called it a keyboard benchmark.

It is now a `KeyboardOnlySession` harness in which **the only way to make anything happen is to press a key**:
every step synthesizes a `KeyboardEventLike`, feeds it to `registry.dispatch()` (the single entry point), and
the outcome is routed through an executor table keyed by command id. A dispatched command with no registered
executor **throws**, so "the key did nothing" cannot pass silently. Seven keystrokes
(select → copy → navigate → paste → undo → find → save) all return `execute`, and the log of dispatched command
ids is asserted exactly.

**It is still reported as `EVIDENCE_MISSING`, not as satisfied**, for three concrete reasons:

1. **No DOM.** Nothing here proves a rendered grid has reachable focus, or that `preventDefault` stops the
   browser stealing `Ctrl+F`/`Ctrl+S`. Full proof needs a rendered grid — out of this package's scope by the
   original AP-03 boundary.
2. **Step 7 (Replace) has no keyboard binding at all.** `FindReplaceEngine.buildFindReplaceOperations` exists,
   but no command binds it — Find opens a UI whose Replace control is mouse-only. A dedicated test asserts this
   gap explicitly rather than papering over it. Until a Replace command exists, the brief's own core workflow
   is *not* completable from the keyboard.
3. **Step 8 executes against a double.** `checkpointOperationStack` opens a pinned Postgres transaction; the
   keystroke, dispatch and routing are real, the persistence is not, and is not claimed to be.

What the block does legitimately measure — the CPU-bound share of the 90 s budget and the completeness of the
command path — it measures, and reports via the existing `[perf]` console line (single-digit milliseconds).

---

## 5. Open items / handed on

1. **Replace command missing** (4.2 item 2) — smallest real blocker to a true keyboard-only claim.
2. **`moduleAdapters.ts` should point `keyboardCommandId` at the new workspace commands** (`related`,
   lifecycle). Out of this wave's allowlist; purely additive when done.
3. **AP-09 exports no mutator for `activeViewId`** — hence the `'workspace-state'` binding kind. If AP-09 later
   exports one, `workspace.nextView`/`previousView` should be promoted to a `'function'` binding.
4. **Test files are outside `tsc -p server`** (section 0 note) — worth a CI job, not fixed here.
5. Nothing was pushed; branch `codex/finance-v3-apwave-ap3-commands` sits two commits ahead of `19b4b06934`.
