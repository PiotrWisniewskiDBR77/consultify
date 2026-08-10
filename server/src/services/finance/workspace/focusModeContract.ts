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

import type { CellRef } from '../../../types/finance/CellRef.js';
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
 * The five things handoff section 11 names literally. Each maps onto a field
 * of AP-00's `FinanceWorkspaceState` (or, for `focus`, onto the session's own
 * focused-cell capture, which `WorkspaceState.selection.activeCell` already
 * carries).
 */
export const FOCUS_MODE_PRESERVED_STATE_KEYS = [
  'selection',
  'filters',
  'scroll',
  'focus',
  'draft',
] as const;
export type FocusModePreservedStateKey = (typeof FOCUS_MODE_PRESERVED_STATE_KEYS)[number];

export const FOCUS_MODE_PRESERVED_STATE_SOURCE: Readonly<Record<FocusModePreservedStateKey, string>> = {
  selection: 'FinanceWorkspaceState.selection',
  filters: 'FinanceWorkspaceState.filters',
  scroll: 'FinanceWorkspaceState.scroll',
  focus: 'FinanceWorkspaceState.selection.activeCell (+ FocusModeSession.focusedCell)',
  draft: 'FinanceWorkspaceState.unsavedOperationStack + sourceWorkingRevisionId',
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
   * The live workspace state. Both `enterFocusMode` and `exitFocusMode` carry
   * this through BY REFERENCE — see the file header.
   */
  workspaceState: FinanceWorkspaceState;
}

export function createFocusModeSession(workspaceState: FinanceWorkspaceState): FocusModeSession {
  return {
    active: false,
    enteredAt: null,
    restoreFocusToControlId: null,
    focusedCell: workspaceState.selection.activeCell,
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
