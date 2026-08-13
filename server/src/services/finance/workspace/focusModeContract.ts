/**
 * AP-09 — Focus mode (the "fullscreen"/full-work-area standard) contract.
 *
 * Sources of truth:
 *   - `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 *     section 11 "Focus mode", quoted in full because it is short and every
 *     clause below implements one of its sentences: "Pozostawia Menu 1,
 *     Workspace Bar, view navigation i workspace. Ukrywa global topbar i
 *     Finance chrome. `Esc` wychodzi. Nie refetchuje i zachowuje selection,
 *     filters, scroll, focus i draft."
 *   - `OWNER_REVIEW_REGISTER_2026-08-09.md` OWN-FIN-004 ("dyskretny,
 *     jednoznaczny przycisk w prawym górnym rogu; po aktywacji zostaje tylko
 *     Menu 1, stan zakładki i pracy jest zachowany, a `Esc` przywraca widok.
 *     Standard wielokrotnego użycia"), OWN-FIN-011 and OWN-FIN-020 (identical
 *     behaviour in all five workspaces).
 *   - `server/src/types/finance/WorkspaceState.ts` (AP-00) — the state that
 *     must survive the toggle, unchanged.
 *
 * SCOPE: pure logic, no React, no DOM. This module decides WHAT is retained
 * and hidden, WHAT the toggle does to state (nothing), and WHO consumes an
 * `Escape` keypress. It renders nothing. See the AP-09/10/11 report.
 *
 * The single most important guarantee here — and the one the tests assert by
 * reference identity, not by deep equality — is that toggling focus mode does
 * not touch `FinanceWorkspaceState` at all. "Nie refetchuje" is not a
 * best-effort intention; a toggle that returns the *same object* cannot have
 * refetched, cannot have reset scroll, and cannot have dropped a draft.
 */

import { cellRefsEqual, type CellRef } from '../../../types/finance/CellRef.js';
import type { FinanceWorkspaceState } from '../../../types/finance/WorkspaceState.js';

// ---------------------------------------------------------------------------
// Chrome regions.
// ---------------------------------------------------------------------------

/**
 * Every chrome region focus mode has an opinion about. A closed union (rather
 * than free strings) is what makes `assertFocusModeRegionPartition` able to
 * prove that no region was forgotten: adding a region to the type without
 * classifying it fails to compile.
 */
export const FINANCE_CHROME_REGIONS = [
  // retained
  'menu1',
  'workspaceBar',
  'viewNavigation',
  'workspace',
  // hidden
  'globalTopbar',
  'globalFooter',
  'financeModuleHeader',
  'financeBreadcrumbs',
  'financeSecondaryNav',
  'financeListRail',
  'financeStatusStrip',
] as const;
export type FinanceChromeRegion = (typeof FINANCE_CHROME_REGIONS)[number];

/** Handoff section 11: "Pozostawia Menu 1, Workspace Bar, view navigation i workspace." */
export const FOCUS_MODE_RETAINED_REGIONS = [
  'menu1',
  'workspaceBar',
  'viewNavigation',
  'workspace',
] as const satisfies readonly FinanceChromeRegion[];

/**
 * Handoff section 11: "Ukrywa global topbar i Finance chrome."
 * `financeStatusStrip` is here because OWN-FIN-005 already ordered the
 * separate status lines merged into the main bar — in focus mode any residue
 * of them is gone outright.
 */
export const FOCUS_MODE_HIDDEN_REGIONS = [
  'globalTopbar',
  'globalFooter',
  'financeModuleHeader',
  'financeBreadcrumbs',
  'financeSecondaryNav',
  'financeListRail',
  'financeStatusStrip',
] as const satisfies readonly FinanceChromeRegion[];

export type FocusModeRegionVisibility = 'retained' | 'hidden';

export function regionVisibilityInFocusMode(region: FinanceChromeRegion): FocusModeRegionVisibility {
  return (FOCUS_MODE_RETAINED_REGIONS as readonly FinanceChromeRegion[]).includes(region)
    ? 'retained'
    : 'hidden';
}

export type RegionPartitionCheck =
  | { ok: true }
  | { ok: false; unclassified: FinanceChromeRegion[]; doubleClassified: FinanceChromeRegion[] };

/** Runtime companion to the type-level closure: every declared region is in exactly one of the two lists. */
export function assertFocusModeRegionPartition(): RegionPartitionCheck {
  const retained = new Set<string>(FOCUS_MODE_RETAINED_REGIONS);
  const hidden = new Set<string>(FOCUS_MODE_HIDDEN_REGIONS);
  const unclassified: FinanceChromeRegion[] = [];
  const doubleClassified: FinanceChromeRegion[] = [];
  for (const region of FINANCE_CHROME_REGIONS) {
    const inRetained = retained.has(region);
    const inHidden = hidden.has(region);
    if (!inRetained && !inHidden) unclassified.push(region);
    if (inRetained && inHidden) doubleClassified.push(region);
  }
  return unclassified.length === 0 && doubleClassified.length === 0
    ? { ok: true }
    : { ok: false, unclassified, doubleClassified };
}

// ---------------------------------------------------------------------------
// Preserved state.
// ---------------------------------------------------------------------------

/**
 * The five things handoff section 11 names literally (`selection`, `filters`,
 * `scroll`, `focus`, `draft`) PLUS `activeView`. Each maps onto a field of
 * AP-00's `FinanceWorkspaceState` (or, for `focus`, onto the session's own
 * focused-cell capture, which `WorkspaceState.selection.activeCell` already
 * carries).
 *
 * WHY `activeView` is here even though section 11 does not list it among the
 * five: OWN-FIN-004 states the requirement in different words — "po aktywacji
 * zostaje tylko Menu 1, **stan zakładki** i pracy jest zachowany". The "stan
 * zakładki" IS the active view, and section 11's own retained-region list
 * keeps `viewNavigation` on screen; a retained navigation that silently jumps
 * back to view #1 would satisfy the letter of the region list and break the
 * requirement. The active view is NOT a field of `FinanceWorkspaceState` (it
 * lives in `WorkspaceBarViewNavigation.activeViewId`, AP-09's bar contract),
 * so preserving it by carrying `workspaceState` through by reference is not
 * enough — the session has to carry the id itself. See
 * `FocusModeSession.activeViewId` and `assertFocusModePreservation`.
 */
export const FOCUS_MODE_PRESERVED_STATE_KEYS = [
  'selection',
  'filters',
  'scroll',
  'focus',
  'draft',
  'activeView',
] as const;
export type FocusModePreservedStateKey = (typeof FOCUS_MODE_PRESERVED_STATE_KEYS)[number];

export const FOCUS_MODE_PRESERVED_STATE_SOURCE: Readonly<Record<FocusModePreservedStateKey, string>> = {
  selection: 'FinanceWorkspaceState.selection',
  filters: 'FinanceWorkspaceState.filters',
  scroll: 'FinanceWorkspaceState.scroll',
  focus: 'FinanceWorkspaceState.selection.activeCell (+ FocusModeSession.focusedCell)',
  draft: 'FinanceWorkspaceState.unsavedOperationStack + sourceWorkingRevisionId',
  activeView: 'WorkspaceBarViewNavigation.activeViewId (+ FocusModeSession.activeViewId)',
};

/**
 * Compile-time-ish documentation that the toggle performs NO data effects.
 * Kept as an exported constant rather than a comment so a test can assert it
 * and a future implementer cannot quietly add a refetch "just for this case".
 */
export const FOCUS_MODE_NEVER_REFETCHES = true as const;

// ---------------------------------------------------------------------------
// Session + toggle.
// ---------------------------------------------------------------------------

export type FocusModeTrigger = 'toggle-control' | 'escape-key' | 'programmatic' | 'keyboard-shortcut';

export interface FocusModeSession {
  active: boolean;
  /** ISO-8601. `null` when inactive. */
  enteredAt: string | null;
  /**
   * A11y (handoff section 11 "focus restore"): the id of the control that
   * opened focus mode, so exiting returns keyboard focus there instead of
   * dumping the user at document start. Stored as an opaque id — this module
   * never touches the DOM.
   */
  restoreFocusToControlId: string | null;
  /** The grid cell that had focus when the toggle happened; restored on exit. */
  focusedCell: CellRef | null;
  /**
   * OWN-FIN-004 "stan zakładki ... jest zachowany": the
   * `WorkspaceBarViewNavigation.activeViewId` at the moment the session was
   * created, carried unchanged through every toggle. `null` only for a
   * workspace whose bar has not reported a view yet (never legal in a built
   * `WorkspaceBarConfig` — `validateWorkspaceBarConfig` rejects an unknown/
   * empty active view — but representable so a caller cannot be forced to
   * invent an id).
   *
   * ADDITIVE: `createFocusModeSession`'s second argument is optional, so every
   * existing caller keeps compiling and gets `null`.
   */
  activeViewId: string | null;
  /**
   * The live workspace state. Both `enterFocusMode` and `exitFocusMode` carry
   * this through BY REFERENCE — see the file header.
   */
  workspaceState: FinanceWorkspaceState;
}

export function createFocusModeSession(
  workspaceState: FinanceWorkspaceState,
  options: { activeViewId?: string | null } = {}
): FocusModeSession {
  return {
    active: false,
    enteredAt: null,
    restoreFocusToControlId: null,
    focusedCell: workspaceState.selection.activeCell,
    activeViewId: options.activeViewId ?? null,
    workspaceState,
  };
}

/**
 * A side effect the UI layer must perform. Note what is NOT representable:
 * there is no `refetch`, no `reset-state`, no `reload` variant. The type
 * itself is the enforcement of "Nie refetchuje".
 */
export type FocusModeEffect =
  | { kind: 'hide-region'; region: FinanceChromeRegion }
  | { kind: 'show-region'; region: FinanceChromeRegion }
  | { kind: 'move-focus'; controlId: string | null; cell: CellRef | null }
  | { kind: 'announce'; messageKey: string; messagePl: string };

export interface FocusModeToggleResult {
  session: FocusModeSession;
  effects: FocusModeEffect[];
  /** Always `false`. Present so a caller can assert it rather than trust prose. */
  refetched: false;
  /** `true` when the call was a no-op (already in the requested state). */
  noop: boolean;
}

export function enterFocusMode(
  session: FocusModeSession,
  params: { trigger: FocusModeTrigger; restoreFocusToControlId: string | null; now?: () => string }
): FocusModeToggleResult {
  if (session.active) {
    return { session, effects: [], refetched: false, noop: true };
  }
  const now = params.now ?? (() => new Date().toISOString());
  const next: FocusModeSession = {
    active: true,
    enteredAt: now(),
    restoreFocusToControlId: params.restoreFocusToControlId,
    focusedCell: session.workspaceState.selection.activeCell,
    // Carried verbatim: entering focus mode must not re-select a view.
    activeViewId: session.activeViewId,
    // Same reference — the whole point.
    workspaceState: session.workspaceState,
  };
  const effects: FocusModeEffect[] = FOCUS_MODE_HIDDEN_REGIONS.map((region) => ({
    kind: 'hide-region' as const,
    region,
  }));
  effects.push({
    kind: 'announce',
    messageKey: 'finance.focusMode.entered',
    messagePl: 'Tryb pełnego obszaru roboczego włączony. Naciśnij Esc, aby wyjść.',
  });
  return { session: next, effects, refetched: false, noop: false };
}

export function exitFocusMode(
  session: FocusModeSession,
  params: { trigger: FocusModeTrigger }
): FocusModeToggleResult {
  if (!session.active) {
    return { session, effects: [], refetched: false, noop: true };
  }
  const next: FocusModeSession = {
    active: false,
    enteredAt: null,
    restoreFocusToControlId: null,
    focusedCell: session.focusedCell,
    // Carried verbatim: leaving focus mode must not re-select a view either.
    activeViewId: session.activeViewId,
    workspaceState: session.workspaceState,
  };
  const effects: FocusModeEffect[] = FOCUS_MODE_HIDDEN_REGIONS.map((region) => ({
    kind: 'show-region' as const,
    region,
  }));
  effects.push({
    kind: 'move-focus',
    controlId: session.restoreFocusToControlId,
    cell: session.focusedCell,
  });
  effects.push({
    kind: 'announce',
    messageKey: 'finance.focusMode.exited',
    messagePl: 'Tryb pełnego obszaru roboczego wyłączony.',
  });
  void params.trigger;
  return { session: next, effects, refetched: false, noop: false };
}

/**
 * Everything the toggle does to DATA: nothing, in every case. Exists so the
 * contract states it as code rather than as a promise in a document.
 */
export function focusModeDataEffects(): readonly never[] {
  return [];
}

// ---------------------------------------------------------------------------
// Preservation check — the guarantee, as an assertable function.
// ---------------------------------------------------------------------------

export interface FocusModePreservationViolation {
  key: FocusModePreservedStateKey;
  detail: string;
}

export type FocusModePreservationCheck =
  | { ok: true }
  | { ok: false; violations: FocusModePreservationViolation[] };

/**
 * Compare the session BEFORE a toggle with the session AFTER it and prove
 * every preserved key survived.
 *
 * Two different kinds of proof, deliberately:
 *   - `selection`/`filters`/`scroll`/`draft` are fields of
 *     `FinanceWorkspaceState`, which the toggle carries BY REFERENCE — so the
 *     check is reference identity on `workspaceState`. A toggle that returned
 *     a structurally-equal copy would have had to rebuild the state, which is
 *     exactly the refetch this contract forbids; identity catches that, deep
 *     equality would not.
 *   - `focus` and `activeView` live on the session itself, so they are
 *     compared by value (`focusedCell` by reference, since it is a `CellRef`
 *     the caller owns and the toggle must not clone either).
 *
 * A no-op toggle returns the SAME session object, so this trivially passes —
 * which is correct: a no-op preserved everything.
 */
export function assertFocusModePreservation(
  before: FocusModeSession,
  after: FocusModeSession
): FocusModePreservationCheck {
  const violations: FocusModePreservationViolation[] = [];
  if (before.workspaceState !== after.workspaceState) {
    for (const key of ['selection', 'filters', 'scroll', 'draft'] as const) {
      violations.push({
        key,
        detail:
          `FinanceWorkspaceState was replaced by the toggle (${FOCUS_MODE_PRESERVED_STATE_SOURCE[key]}). ` +
          'Focus mode must carry the same object through — a new object means something rebuilt or refetched it.',
      });
    }
  }
  if (before.focusedCell !== after.focusedCell) {
    violations.push({
      key: 'focus',
      detail: 'FocusModeSession.focusedCell changed across the toggle.',
    });
  }
  if (before.activeViewId !== after.activeViewId) {
    violations.push({
      key: 'activeView',
      detail:
        `Active view changed across the toggle: "${String(before.activeViewId)}" -> "${String(after.activeViewId)}". ` +
        'OWN-FIN-004 requires the open tab to survive entering/leaving focus mode.',
    });
  }
  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

/**
 * The `activeViewId` a Workspace Bar must render while `session` is live.
 * A future component calls THIS rather than re-deriving a default from the
 * adapter's view list — re-deriving is precisely how "focus mode reset my tab"
 * bugs happen. `fallbackViewId` covers the session that was created before the
 * bar knew its view (`activeViewId === null`).
 */
export function focusModeActiveViewId(session: FocusModeSession, fallbackViewId: string): string {
  return session.activeViewId ?? fallbackViewId;
}

// ---------------------------------------------------------------------------
// Escape-key precedence.
// ---------------------------------------------------------------------------

/**
 * "`Esc` wychodzi" cannot be implemented as an unconditional handler: AP-03
 * already binds `Escape` to `grid.cancelEdit` in the `cell-editing` context,
 * and a modal/popover/command palette must close before the layout changes
 * underneath the user. This ordered list resolves the conflict once, for the
 * whole module, instead of each screen inventing its own precedence.
 *
 * First match in this order wins.
 */
export const ESCAPE_PRECEDENCE = [
  'modal',
  'command-palette',
  'popover',
  'cell-editing',
  'focus-mode',
] as const;
export type EscapeConsumer = (typeof ESCAPE_PRECEDENCE)[number] | 'none';

export interface EscapeContext {
  modalOpen: boolean;
  commandPaletteOpen: boolean;
  popoverOpen: boolean;
  cellEditing: boolean;
  focusModeActive: boolean;
}

export function resolveEscapeKey(ctx: EscapeContext): EscapeConsumer {
  if (ctx.modalOpen) return 'modal';
  if (ctx.commandPaletteOpen) return 'command-palette';
  if (ctx.popoverOpen) return 'popover';
  if (ctx.cellEditing) return 'cell-editing';
  if (ctx.focusModeActive) return 'focus-mode';
  return 'none';
}

// ---------------------------------------------------------------------------
// THE ESCAPE BRIDGE TO AP-03 — one entry point, ownership as data.
//
// The problem this section closes: `ESCAPE_PRECEDENCE` above and AP-03's
// `KeyboardCommandRegistry` were two unconnected owners of the same physical
// key. The registry answered `Escape` in `'cell-editing'` (`grid.cancelEdit`)
// and knew nothing about focus mode; this file knew the precedence and
// nothing about the registry. A future hook wiring one of them would have
// silently broken the other — Escape either exiting focus mode out from under
// an open modal, or never exiting it at all.
//
// HOW THE TWO SIDES MEET, and why it is shaped this way:
//   * AP-09 owns the ORDER (which consumer wins) and the fact that focus mode
//     is the last resort. That is a layout/UX rule, not a keymap rule.
//   * AP-03 owns the KEYMAP (which command id fires in which command context).
//   * The join is by STRING ID, never by import. This file must not import
//     `keyboard/**`: the command ids below are DATA, so AP-03 can register,
//     rename or re-context its commands without a single edit here, and this
//     package stays free of a dependency on the keyboard layer (the same
//     discipline `WorkspaceBarPrimaryAction.keyboardCommandId` already uses).
//
// WHAT AP-03 (or the future keyboard hook) CALLS, in order:
//   1. `resolveEscapeCommand(ctx)` — FIRST, before touching the registry.
//   2. If `dispatchViaKeyboardRegistry` is false, the overlay layer closes its
//      own modal/palette/popover and the registry is never consulted.
//   3. If it is true, call `registry.resolve(escapeEvent, resolution
//      .keyboardCommandContext, platform)` and assert the resolved command's
//      id equals `resolution.keyboardCommandId`.
//   4. `verifyEscapeRegistryCoverage(...)` in a test, to prove the registry
//      actually carries every command this contract promises.
// A caller that owns a `FocusModeSession` can skip 1..3 for the focus-mode
// case and call `handleEscapeKey(session, ctx)`, which resolves AND performs
// the exit in one step.
// ---------------------------------------------------------------------------

/** The `KeyboardEvent.key` value this whole section is about. Data, so a test can build the event without a magic string. */
export const ESCAPE_KEY = 'Escape' as const;

/**
 * Mirror of AP-03's `CommandContext` ids (`keyboard/commandTypes.ts`), carried
 * as data for the reason stated above. Kept as a const array so a drift test
 * can compare it against the real `COMMAND_CONTEXTS` without this file
 * importing it.
 */
export const FINANCE_COMMAND_CONTEXT_IDS = ['grid-focused', 'cell-editing', 'global'] as const;
export type FinanceCommandContextId = (typeof FINANCE_COMMAND_CONTEXT_IDS)[number];

/**
 * The AP-03 `KeyboardCommand.id`s AP-09 depends on. Changing one of these is
 * a coordinated, two-package change — which is exactly why they are named
 * constants and not literals scattered through the file.
 */
export const FINANCE_FOCUS_MODE_COMMAND_IDS = {
  /** Enter/leave focus mode from the keyboard (AP-03: `Mod+Shift+F`, context `global`). */
  toggle: 'workspace.toggleFocusMode',
  /** Leave focus mode with `Escape` — the command this precedence table hands the key to. */
  exit: 'workspace.exitFocusMode',
  /** The palette, listed because it outranks focus mode for `Escape`. */
  commandPalette: 'workspace.commandPalette',
  /** AP-03's pre-existing `Escape` owner, which outranks focus mode. */
  cancelCellEdit: 'grid.cancelEdit',
} as const;

export type EscapeOwner = 'ui-overlay' | 'AP-03-keyboard' | 'AP-09-focus-mode';

export interface EscapeConsumerBinding {
  consumer: (typeof ESCAPE_PRECEDENCE)[number];
  owner: EscapeOwner;
  /** `null` when no keyboard command is involved (an overlay closes itself). */
  keyboardCommandId: string | null;
  /** AP-03 command contexts in which `keyboardCommandId` must be registered. */
  keyboardCommandContexts: readonly FinanceCommandContextId[];
  note: string;
}

export const ESCAPE_CONSUMER_BINDINGS: Readonly<
  Record<(typeof ESCAPE_PRECEDENCE)[number], EscapeConsumerBinding>
> = {
  modal: {
    consumer: 'modal',
    owner: 'ui-overlay',
    keyboardCommandId: null,
    keyboardCommandContexts: [],
    note: 'A modal traps focus and closes itself. The keyboard registry must NOT see this Escape at all — dispatching `grid.cancelEdit` or an exit-focus-mode command underneath an open dialog changes the layout the user is looking at.',
  },
  'command-palette': {
    consumer: 'command-palette',
    owner: 'ui-overlay',
    keyboardCommandId: null,
    keyboardCommandContexts: [],
    note: 'The palette is OPENED by an AP-03 command (`workspace.commandPalette`) but CLOSED by itself: while it is open it owns the keyboard, so routing its Escape back through the registry would let the registry act on a grid the user is not looking at.',
  },
  popover: {
    consumer: 'popover',
    owner: 'ui-overlay',
    keyboardCommandId: null,
    keyboardCommandContexts: [],
    note: 'Context popover / More menu / lifecycle menu. Same reasoning as a modal, one level lighter.',
  },
  'cell-editing': {
    consumer: 'cell-editing',
    owner: 'AP-03-keyboard',
    keyboardCommandId: FINANCE_FOCUS_MODE_COMMAND_IDS.cancelCellEdit,
    keyboardCommandContexts: ['cell-editing'],
    note: 'AP-03 already owns this one; AP-09 only guarantees it is asked BEFORE focus mode, so Escape cancels the edit the user is in rather than tearing down the layout around it.',
  },
  'focus-mode': {
    consumer: 'focus-mode',
    owner: 'AP-09-focus-mode',
    keyboardCommandId: FINANCE_FOCUS_MODE_COMMAND_IDS.exit,
    keyboardCommandContexts: ['grid-focused'],
    note: 'Handoff section 11 "`Esc` wychodzi" — the LAST resort. The command id is AP-03\'s dispatch handle; the state transition itself is `exitFocusMode` in this file, which AP-03 must call rather than reimplement.',
  },
};

export interface EscapeResolution {
  consumer: EscapeConsumer;
  binding: EscapeConsumerBinding | null;
  owner: EscapeOwner | 'none';
  keyboardCommandId: string | null;
  /** The AP-03 `CommandContext` `registry.resolve` must be called with, or `null` when the registry must not be consulted. */
  keyboardCommandContext: FinanceCommandContextId | null;
  /** `false` means: the overlay layer handles this Escape and the registry never sees it. */
  dispatchViaKeyboardRegistry: boolean;
}

/**
 * THE single entry point for an `Escape` keypress anywhere in a Finance
 * workspace. Answers "who handles it, and does the keyboard registry get to
 * see this keypress at all" in one call.
 *
 * The AP-03 command context is DERIVED from `ctx.cellEditing` rather than
 * taken as a parameter: a caller that could pass its own context could pass
 * one that contradicts the precedence table (claiming `'cell-editing'` while
 * `cellEditing` is false), which is the drift this bridge exists to remove.
 */
export function resolveEscapeCommand(ctx: EscapeContext): EscapeResolution {
  const consumer = resolveEscapeKey(ctx);
  if (consumer === 'none') {
    return {
      consumer,
      binding: null,
      owner: 'none',
      keyboardCommandId: null,
      keyboardCommandContext: null,
      dispatchViaKeyboardRegistry: false,
    };
  }
  const binding = ESCAPE_CONSUMER_BINDINGS[consumer];
  const dispatchViaKeyboardRegistry = binding.keyboardCommandId !== null;
  return {
    consumer,
    binding,
    owner: binding.owner,
    keyboardCommandId: binding.keyboardCommandId,
    keyboardCommandContext: dispatchViaKeyboardRegistry
      ? ctx.cellEditing
        ? 'cell-editing'
        : 'grid-focused'
      : null,
    dispatchViaKeyboardRegistry,
  };
}

/** Guard a future keyboard hook calls before letting `KeyboardCommandRegistry.resolve` see an `Escape`. */
export function shouldKeyboardRegistryHandleEscape(ctx: EscapeContext): boolean {
  return resolveEscapeCommand(ctx).dispatchViaKeyboardRegistry;
}

// --- Coverage: does AP-03's registry actually carry what AP-09 promises? ----

export interface EscapeRegistryRegistration {
  commandId: string;
  context: FinanceCommandContextId;
}

export interface EscapeCoverageGap {
  consumer: (typeof ESCAPE_PRECEDENCE)[number];
  commandId: string;
  context: FinanceCommandContextId;
}

export type EscapeCoverageResult = { ok: true } | { ok: false; missing: EscapeCoverageGap[] };

/**
 * Cross-check: every `(commandId, context)` pair the bindings above promise
 * must exist in AP-03's registry. Takes the registrations as an ARGUMENT
 * (rather than importing the registry) so this package keeps no dependency on
 * `keyboard/**` — a test on either side supplies the real list.
 *
 * This is the function that turns "the two layers agree" from a claim in a
 * report into something CI can fail on.
 */
export function verifyEscapeRegistryCoverage(
  registered: readonly EscapeRegistryRegistration[]
): EscapeCoverageResult {
  const have = new Set(registered.map((r) => `${r.commandId}@${r.context}`));
  const missing: EscapeCoverageGap[] = [];
  for (const consumer of ESCAPE_PRECEDENCE) {
    const binding = ESCAPE_CONSUMER_BINDINGS[consumer];
    if (!binding.keyboardCommandId) continue;
    for (const context of binding.keyboardCommandContexts) {
      if (!have.has(`${binding.keyboardCommandId}@${context}`)) {
        missing.push({ consumer, commandId: binding.keyboardCommandId, context });
      }
    }
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

// --- Resolve AND act, for a caller that holds the session -------------------

/** The overlay half of `EscapeContext`; `focusModeActive` is not taken from the caller — it is read off the session. */
export type EscapeOverlayContext = Omit<EscapeContext, 'focusModeActive'>;

export interface EscapeHandlingResult {
  resolution: EscapeResolution;
  /** Non-`null` only when AP-09 itself consumed the key, i.e. `consumer === 'focus-mode'`. */
  toggle: FocusModeToggleResult | null;
  session: FocusModeSession;
}

/**
 * One call: resolve the precedence AND, when focus mode is the winner, perform
 * the exit. `focusModeActive` is read off `session.active` so a caller cannot
 * desynchronise the two.
 */
export function handleEscapeKey(
  session: FocusModeSession,
  ctx: EscapeOverlayContext
): EscapeHandlingResult {
  const resolution = resolveEscapeCommand({ ...ctx, focusModeActive: session.active });
  if (resolution.consumer !== 'focus-mode') {
    return { resolution, toggle: null, session };
  }
  const toggle = exitFocusMode(session, { trigger: 'escape-key' });
  return { resolution, toggle, session: toggle.session };
}

// ---------------------------------------------------------------------------
// THE FOCUS-MODEL BRIDGE TO AP-03.
//
// The codebase carries two descriptions of "who had focus and where does it go
// back to":
//
//   AP-03  `FocusSnapshot { activeCell, reason, capturedAt }` +
//          `resolveFocusRestorePatch(reason, cell) -> { activeCell, collapseSelection }`
//   AP-09  `FocusModeSession.focusedCell` + `.restoreFocusToControlId`,
//          surfaced as the `{ kind: 'move-focus' }` effect of `exitFocusMode`
//
// They are not duplicates — they answer different questions (AP-09: which cell
// and which BAR CONTROL was focused when the layout changed; AP-03: what the
// GRID should do with a restored cell) — but nothing proved they were talking
// about the same cell, so they could drift invisibly.
//
// Direction of authority: AP-09 CAPTURES (entering focus mode can be a mouse
// click on the fullscreen control, so it is not a keyboard command's outcome);
// AP-03 decides what the grid does with the captured cell. This section
// converts between the two; it does not merge them.
// ---------------------------------------------------------------------------

/**
 * The members of this file's types that AP-03 reads. Load-bearing: renaming or
 * retyping any of them breaks the keyboard package, which imports
 * `FocusModeSession`/`FocusModeEffect` structurally. Additive fields (like
 * `activeViewId`) are safe — AP-03 reads through `Pick<>`.
 */
export const FOCUS_MODEL_BRIDGE_SURFACE = [
  'FocusModeSession.focusedCell',
  'FocusModeSession.restoreFocusToControlId',
  "FocusModeEffect { kind: 'move-focus'; controlId; cell }",
] as const;

/**
 * The `FocusRestoreReason` id AP-09 asks AP-03 to use when focus returns after
 * leaving focus mode. AP-03 added exactly this literal to
 * `FOCUS_RESTORE_REASONS` alongside its workspace-level commands.
 */
export const FOCUS_MODE_FOCUS_RESTORE_REASON = 'focusModeExit' as const;

/**
 * The reason to use while `focusModeExit` is not yet present in the consuming
 * tree. `commandPaletteInvoke` is the semantically closest PRE-EXISTING reason:
 * both are non-mutating focus returns, and AP-03 classifies both as
 * non-collapsing — which is the property that actually matters here (see
 * `FOCUS_MODE_MUST_NOT_COLLAPSE_SELECTION`).
 */
export const FOCUS_MODE_FOCUS_RESTORE_REASON_FALLBACK = 'commandPaletteInvoke' as const;

/**
 * Non-negotiable, and the reason this bridge is worth having: restoring focus
 * after focus mode must NOT collapse the grid selection. Focus mode's whole
 * contract is that the toggle preserves `selection`; a focus-restore patch
 * with `collapseSelection: true` would honour AP-03's model and silently
 * violate AP-09's.
 */
export const FOCUS_MODE_MUST_NOT_COLLAPSE_SELECTION = true as const;

/**
 * Pick the reason id to hand `resolveFocusRestorePatch`, given the reasons the
 * consuming tree's AP-03 actually knows. Takes the list as an argument for the
 * same no-import reason as the Escape bridge.
 */
export function focusRestoreReasonForExit(
  supportedReasons: readonly string[]
): typeof FOCUS_MODE_FOCUS_RESTORE_REASON | typeof FOCUS_MODE_FOCUS_RESTORE_REASON_FALLBACK {
  return supportedReasons.includes(FOCUS_MODE_FOCUS_RESTORE_REASON)
    ? FOCUS_MODE_FOCUS_RESTORE_REASON
    : FOCUS_MODE_FOCUS_RESTORE_REASON_FALLBACK;
}

/**
 * An AP-03 `FocusSnapshot`, structurally. Generic in the reason so the value
 * this file produces is assignable to AP-03's `FocusSnapshot` (whose `reason`
 * is a narrow union) without this file importing that union.
 */
export interface FocusModeFocusSnapshot<R extends string = string> {
  activeCell: CellRef | null;
  reason: R;
  /** ISO-8601. */
  capturedAt: string;
}

/** Read an AP-09 session as an AP-03-shaped snapshot. */
export function focusModeFocusSnapshot<R extends string>(
  session: Pick<FocusModeSession, 'focusedCell'>,
  reason: R,
  now: () => string = () => new Date().toISOString()
): FocusModeFocusSnapshot<R> {
  return { activeCell: session.focusedCell, reason, capturedAt: now() };
}

/** Everything the UI needs to put focus back after an exit: a DOM control id and/or a grid cell. */
export interface FocusModeRestoreTarget {
  controlId: string | null;
  cell: CellRef | null;
}

export function focusRestoreTargetOnExit(session: FocusModeSession): FocusModeRestoreTarget {
  return { controlId: session.restoreFocusToControlId, cell: session.focusedCell };
}

export type FocusModelAgreement =
  | { ok: true; cell: CellRef | null }
  | { ok: false; reason: 'CELL_MISMATCH' | 'NULLNESS_MISMATCH'; ap09: CellRef | null; ap03: CellRef | null };

/**
 * Prove the two models are describing the same focus. Compared by
 * `cellRefsEqual` (AP-00's own canonical-key equality), not by reference: a
 * snapshot that travelled through serialization is still the same cell.
 */
export function assertFocusModelsAgree(
  session: Pick<FocusModeSession, 'focusedCell'>,
  snapshot: Pick<FocusModeFocusSnapshot, 'activeCell'>
): FocusModelAgreement {
  const ap09 = session.focusedCell;
  const ap03 = snapshot.activeCell;
  if (ap09 === null || ap03 === null) {
    return ap09 === ap03
      ? { ok: true, cell: null }
      : { ok: false, reason: 'NULLNESS_MISMATCH', ap09, ap03 };
  }
  return cellRefsEqual(ap09, ap03)
    ? { ok: true, cell: ap09 }
    : { ok: false, reason: 'CELL_MISMATCH', ap09, ap03 };
}

// ---------------------------------------------------------------------------
// Viewport policy (handoff section 11) — needed here because focus mode is the
// control that is offered/withheld per device class.
// ---------------------------------------------------------------------------

export type FinanceViewportClass = 'desktop' | 'tablet' | 'mobile';

export const FINANCE_DESKTOP_MIN_PX = 1024;
export const FINANCE_TABLET_MIN_PX = 768;

export function classifyViewport(widthPx: number): FinanceViewportClass {
  if (widthPx >= FINANCE_DESKTOP_MIN_PX) return 'desktop';
  if (widthPx >= FINANCE_TABLET_MIN_PX) return 'tablet';
  return 'mobile';
}

export interface ViewportCapability {
  edit: boolean;
  compute: boolean;
  review: boolean;
  read: boolean;
  focusMode: boolean;
}

/**
 * DEC-FIN-008 + handoff section 11: desktop = full editing; tablet =
 * read/review/exception triage; mobile = mutations/compute/review disabled
 * FAIL-CLOSED with a clear DesktopRequired. Mobile is not a gate for this
 * release, but the contract must already say "no", not "unspecified".
 */
export const FINANCE_VIEWPORT_CAPABILITIES: Readonly<Record<FinanceViewportClass, ViewportCapability>> = {
  desktop: { edit: true, compute: true, review: true, read: true, focusMode: true },
  tablet: { edit: false, compute: false, review: true, read: true, focusMode: true },
  mobile: { edit: false, compute: false, review: false, read: false, focusMode: false },
};

export function viewportCapability(widthPx: number): ViewportCapability {
  return FINANCE_VIEWPORT_CAPABILITIES[classifyViewport(widthPx)];
}
