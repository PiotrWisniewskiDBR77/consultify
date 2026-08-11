/**
 * Focus Mode („tryb pełnego obszaru roboczego") — kontrakt danych (Pakiet C,
 * OWN-FIN-004).
 *
 * PORT (patrz nagłówek `financeWorkspaceBar.contract.ts` dla uzasadnienia
 * portu zamiast importu) z `server/src/services/finance/workspace/focusModeContract.ts`
 * (AP-09, 826 linii). Cytaty plik:linia przy każdej sekcji.
 *
 * Zakres w tym porcie:
 *   - WŁĄCZONE: regiony chrome (retained/hidden), sesja + toggle (enter/exit),
 *     dowód zachowania stanu (`assertFocusModePreservation`), precedencja
 *     Escape (modal > command-palette > popover > cell-editing > focus-mode).
 *   - POMINIĘTE: most do AP-03 keyboard registry (`resolveEscapeCommand`,
 *     `verifyEscapeRegistryCoverage`, focus-snapshot bridge) — nie istnieje
 *     dziś żaden keyboard command registry po stronie frontendu do
 *     zsynchronizowania (grid/keyboard to martwa warstwa dla klienta,
 *     PKG_B_API_report.md §1.3). `resolveEscapeKey` (prosta precedencja) jest
 *     zachowana, bo to ONA jest kontraktem testowalnym przez negatywną
 *     kontrolę tego pakietu.
 *
 * Stan roboczy (`FinanceWorkspaceDraftState` niżej) jest UPROSZCZONYM
 * odpowiednikiem `server/src/types/finance/WorkspaceState.ts`'s
 * `FinanceWorkspaceState` — ten pakiet nie ma jeszcze prawdziwego grida
 * (AP-01), więc zamiast twardo typować pełny `selection/filters/scroll/
 * unsavedOperationStack` (który nic dziś nie wypełnia), sesja jest generyczna
 * po `TState` — dowolny stan roboczy modułu przechodzi przez toggle PRZEZ
 * REFERENCJĘ, co jest właśnie tym, co `assertFocusModePreservation` dowodzi.
 */

// ---------------------------------------------------------------------------
// Regiony chrome — focusModeContract.ts:43-111
// ---------------------------------------------------------------------------

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

/** „Pozostawia Menu 1, Workspace Bar, view navigation i workspace." */
export const FOCUS_MODE_RETAINED_REGIONS: readonly FinanceChromeRegion[] = [
  'menu1',
  'workspaceBar',
  'viewNavigation',
  'workspace',
];

/** „Ukrywa global topbar i Finance chrome." */
export const FOCUS_MODE_HIDDEN_REGIONS: readonly FinanceChromeRegion[] = [
  'globalTopbar',
  'globalFooter',
  'financeModuleHeader',
  'financeBreadcrumbs',
  'financeSecondaryNav',
  'financeListRail',
  'financeStatusStrip',
];

export type FocusModeRegionVisibility = 'retained' | 'hidden';

export function regionVisibilityInFocusMode(region: FinanceChromeRegion): FocusModeRegionVisibility {
  return FOCUS_MODE_RETAINED_REGIONS.includes(region) ? 'retained' : 'hidden';
}

// ---------------------------------------------------------------------------
// Zachowany stan — focusModeContract.ts:117-160 (5 pól z rejestru + activeView)
// ---------------------------------------------------------------------------

export const FOCUS_MODE_PRESERVED_STATE_KEYS = ['selection', 'filters', 'scroll', 'focus', 'draft', 'activeView'] as const;
export type FocusModePreservedStateKey = (typeof FOCUS_MODE_PRESERVED_STATE_KEYS)[number];

/** Compile-time-ish dokumentacja: toggle nie robi ŻADNYCH efektów danych (zero refetch). */
export const FOCUS_MODE_NEVER_REFETCHES = true as const;

// ---------------------------------------------------------------------------
// Sesja + toggle — focusModeContract.ts:166-297
// ---------------------------------------------------------------------------

export type FocusModeTrigger = 'toggle-control' | 'escape-key' | 'programmatic' | 'keyboard-shortcut';

export interface FocusModeSession<TState = unknown> {
  active: boolean;
  enteredAt: string | null;
  /** A11y focus-restore: id kontrolki, która otworzyła focus mode. */
  restoreFocusToControlId: string | null;
  /** OWN-FIN-004 „stan zakładki jest zachowany" — `WorkspaceBarViewNavigation.activeViewId` w momencie utworzenia sesji, niezmienne przez cały toggle. */
  activeViewId: string | null;
  /** Cały stan roboczy modułu (draft, selection, scroll, ...), przenoszony PRZEZ REFERENCJĘ przez każdy toggle. */
  workspaceState: TState;
}

export function createFocusModeSession<TState>(
  workspaceState: TState,
  options: { activeViewId?: string | null } = {}
): FocusModeSession<TState> {
  return {
    active: false,
    enteredAt: null,
    restoreFocusToControlId: null,
    activeViewId: options.activeViewId ?? null,
    workspaceState,
  };
}

/** Efekt, który warstwa UI musi wykonać. Celowo NIE ISTNIEJE wariant `refetch`/`reset-state`/`reload` — sam typ jest egzekwowaniem „nie refetchuje". */
export type FocusModeEffect =
  | { kind: 'hide-region'; region: FinanceChromeRegion }
  | { kind: 'show-region'; region: FinanceChromeRegion }
  | { kind: 'move-focus'; controlId: string | null }
  | { kind: 'announce'; messageKey: string; messagePl: string };

export interface FocusModeToggleResult<TState = unknown> {
  session: FocusModeSession<TState>;
  effects: FocusModeEffect[];
  /** Zawsze `false`. Obecne, żeby caller mógł to zaasertować zamiast ufać prozie. */
  refetched: false;
  noop: boolean;
}

export function enterFocusMode<TState>(
  session: FocusModeSession<TState>,
  params: { trigger: FocusModeTrigger; restoreFocusToControlId: string | null; now?: () => string }
): FocusModeToggleResult<TState> {
  if (session.active) {
    return { session, effects: [], refetched: false, noop: true };
  }
  const now = params.now ?? (() => new Date().toISOString());
  const next: FocusModeSession<TState> = {
    active: true,
    enteredAt: now(),
    restoreFocusToControlId: params.restoreFocusToControlId,
    activeViewId: session.activeViewId,
    workspaceState: session.workspaceState, // ta sama referencja — to jest cały sens
  };
  const effects: FocusModeEffect[] = FOCUS_MODE_HIDDEN_REGIONS.map((region) => ({ kind: 'hide-region' as const, region }));
  effects.push({
    kind: 'announce',
    messageKey: 'finance.focusMode.entered',
    messagePl: 'Tryb pełnego obszaru roboczego włączony. Naciśnij Esc, aby wyjść.',
  });
  return { session: next, effects, refetched: false, noop: false };
}

export function exitFocusMode<TState>(
  session: FocusModeSession<TState>,
  params: { trigger: FocusModeTrigger }
): FocusModeToggleResult<TState> {
  if (!session.active) {
    return { session, effects: [], refetched: false, noop: true };
  }
  const next: FocusModeSession<TState> = {
    active: false,
    enteredAt: null,
    restoreFocusToControlId: null,
    activeViewId: session.activeViewId,
    workspaceState: session.workspaceState,
  };
  const effects: FocusModeEffect[] = FOCUS_MODE_HIDDEN_REGIONS.map((region) => ({ kind: 'show-region' as const, region }));
  effects.push({ kind: 'move-focus', controlId: session.restoreFocusToControlId });
  effects.push({
    kind: 'announce',
    messageKey: 'finance.focusMode.exited',
    messagePl: 'Tryb pełnego obszaru roboczego wyłączony.',
  });
  void params.trigger;
  return { session: next, effects, refetched: false, noop: false };
}

export function focusModeDataEffects(): readonly never[] {
  return [];
}

// ---------------------------------------------------------------------------
// Dowód zachowania — focusModeContract.ts:309-368
// ---------------------------------------------------------------------------

export interface FocusModePreservationViolation {
  key: FocusModePreservedStateKey;
  detail: string;
}

export type FocusModePreservationCheck = { ok: true } | { ok: false; violations: FocusModePreservationViolation[] };

/**
 * Porównaj sesję PRZED i PO toggle i udowodnij, że wszystko przetrwało.
 * `workspaceState` porównywane PRZEZ TOŻSAMOŚĆ referencji — kopia strukturalnie
 * równa oznaczałaby, że toggle przebudował stan (czyli dokładnie ten refetch,
 * który ten kontrakt zakazuje); równość głęboka by tego nie złapała.
 */
export function assertFocusModePreservation<TState>(
  before: FocusModeSession<TState>,
  after: FocusModeSession<TState>
): FocusModePreservationCheck {
  const violations: FocusModePreservationViolation[] = [];
  if (before.workspaceState !== after.workspaceState) {
    for (const key of ['selection', 'filters', 'scroll', 'draft'] as const) {
      violations.push({
        key,
        detail: 'Stan roboczy modułu został podmieniony przez toggle. Focus mode musi nieść ten sam obiekt — nowy obiekt oznacza, że coś go przebudowało lub przeładowało.',
      });
    }
  }
  if (before.activeViewId !== after.activeViewId) {
    violations.push({
      key: 'activeView',
      detail: `Aktywny widok zmienił się w trakcie toggle: "${String(before.activeViewId)}" -> "${String(after.activeViewId)}". OWN-FIN-004 wymaga, żeby otwarta zakładka przetrwała wejście/wyjście z focus mode.`,
    });
  }
  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

export function focusModeActiveViewId(session: Pick<FocusModeSession, 'activeViewId'>, fallbackViewId: string): string {
  return session.activeViewId ?? fallbackViewId;
}

// ---------------------------------------------------------------------------
// Precedencja Escape — focusModeContract.ts:382-418 (bez mostu do AP-03,
// patrz nagłówek pliku).
// ---------------------------------------------------------------------------

export const ESCAPE_PRECEDENCE = ['modal', 'command-palette', 'popover', 'cell-editing', 'focus-mode'] as const;
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
// Polityka viewport — focusModeContract.ts:792-826
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

/** Desktop = pełna edycja; tablet = odczyt/review; mobile = mutacje/compute/review fail-closed. */
export const FINANCE_VIEWPORT_CAPABILITIES: Readonly<Record<FinanceViewportClass, ViewportCapability>> = {
  desktop: { edit: true, compute: true, review: true, read: true, focusMode: true },
  tablet: { edit: false, compute: false, review: true, read: true, focusMode: true },
  mobile: { edit: false, compute: false, review: false, read: false, focusMode: false },
};

export function viewportCapability(widthPx: number): ViewportCapability {
  return FINANCE_VIEWPORT_CAPABILITIES[classifyViewport(widthPx)];
}
