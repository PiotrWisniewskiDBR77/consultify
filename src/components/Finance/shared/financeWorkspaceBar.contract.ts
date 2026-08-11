/**
 * `FinanceWorkspaceBar` — kontrakt danych (Pakiet C, OWN-FIN-011/016/020/021).
 *
 * PORT (nie import — `server/**` poza allowlistą tego pakietu, zero
 * cross-importów src/↔server/src istnieje dziś w repo) z realnego,
 * przetestowanego kontraktu backendowego, który już implementuje dokładnie
 * te same reguły: `server/src/services/finance/workspace/workspaceBarContract.ts`
 * (AP-09, 1038 linii, testy w `__tests__/workspaceBarContract.test.ts`).
 * Stałe i algorytmy poniżej są CELOWO bit-identyczne z tamtym plikiem — cytaty
 * plik:linia przy każdej sekcji — żeby gdy AP-09 kiedyś stanie się wspólnym
 * pakietem (np. przeniesiony do `packages/finance-shared`), zamiana importu
 * była mechaniczna, nie przepisywaniem logiki.
 *
 * Zakres w tym porcie (świadomie mniejszy niż oryginał):
 *   - WŁĄCZONE: limity (5 kontrolek, 60/120 znaków, 1280px), etykiety +
 *     freshness→CTA merge, enablement/`resolveControlState`, tożsamość
 *     (rename kontrolowany), nawigacja widoków (in-bar vs osobny rząd),
 *     akcje prawej strony, walidator całej konfiguracji, budżet layoutu
 *     (`estimateWorkspaceBarLayout` — dowód kryterium 1280px/60 znaków).
 *   - POMINIĘTE (poza zakresem Pakietu C, brak konsumenta dziś): most do
 *     AP-03 keyboard registry (`keyboardCommandId` pole zostaje jako dana,
 *     ale nic go dziś nie konsumuje po stronie klienta — grid/keyboard to
 *     martwa dla frontendu warstwa, PKG_B_API_report.md §1.3).
 */

import type { BusinessVersionStatus, FinanceArtifactFreshness, FinanceArtifactType, FinanceRole, LifecycleAction } from '@/services/api/financeV2.types';

// ---------------------------------------------------------------------------
// Limity — workspaceBarContract.ts:58-93
// ---------------------------------------------------------------------------

export const WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS = 5;
export const WORKSPACE_BAR_INLINE_VIEW_LIMIT = 2;
export const WORKSPACE_BAR_NAME_MAX_CHARS = 120;
export const WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS = 60;
export const WORKSPACE_BAR_REFERENCE_VIEWPORT_PX = 1280;
export const WORKSPACE_BAR_MIN_CONTROL_PX = 44;

// ---------------------------------------------------------------------------
// Etykiety — workspaceBarContract.ts:106-161
// ---------------------------------------------------------------------------

export interface WorkspaceBarLabel {
  key: string;
  pl: string;
}

export const WORKSPACE_BAR_FRESHNESS_SEPARATOR = ' · ';

export const WORKSPACE_BAR_FRESHNESS_PREFIX: Readonly<Record<FinanceArtifactFreshness, WorkspaceBarLabel | null>> = {
  CURRENT: null,
  NEVER_COMPUTED: { key: 'finance.freshness.neverComputed', pl: 'Nie przeliczono' },
  STALE_SOURCE: { key: 'finance.freshness.staleSource', pl: 'Nieaktualne' },
  STALE_ASSUMPTIONS: { key: 'finance.freshness.staleAssumptions', pl: 'Nieaktualne' },
  COMPUTE_FAILED: { key: 'finance.freshness.computeFailed', pl: 'Błąd przeliczenia' },
};

export interface MergedPrimaryLabel {
  prefix: WorkspaceBarLabel | null;
  action: WorkspaceBarLabel;
  pl: string;
  freshness: FinanceArtifactFreshness;
}

/** freshness połączone z CTA, np. „Nieaktualne · Przelicz" — addendum §7. */
export function mergeFreshnessIntoPrimaryLabel(
  action: WorkspaceBarLabel,
  freshness: FinanceArtifactFreshness,
  mergesFreshness = true
): MergedPrimaryLabel {
  const prefix = mergesFreshness ? WORKSPACE_BAR_FRESHNESS_PREFIX[freshness] : null;
  return {
    prefix,
    action,
    pl: prefix ? `${prefix.pl}${WORKSPACE_BAR_FRESHNESS_SEPARATOR}${action.pl}` : action.pl,
    freshness,
  };
}

// ---------------------------------------------------------------------------
// Enablement — workspaceBarContract.ts:167-225
// ---------------------------------------------------------------------------

export interface WorkspaceBarEnablement {
  statuses: readonly BusinessVersionStatus[] | 'any';
  roles: readonly FinanceRole[] | 'any';
  freshness: readonly FinanceArtifactFreshness[] | 'any';
  /** Nazwane bramki kompletności modułu (np. `'analysis.hasConfiguredKpis'`). Nieznana bramka = `false` (fail-closed). */
  requiresGates: readonly string[];
}

export const ENABLEMENT_ALWAYS: WorkspaceBarEnablement = {
  statuses: 'any',
  roles: 'any',
  freshness: 'any',
  requiresGates: [],
};

export interface WorkspaceBarEvaluationContext {
  status: BusinessVersionStatus;
  role: FinanceRole;
  freshness: FinanceArtifactFreshness;
  gates: Readonly<Record<string, boolean>>;
}

export type ControlState =
  | { available: true }
  | { available: false; reason: 'STATUS' | 'ROLE' | 'FRESHNESS' | 'GATE'; detail: string };

export function resolveControlState(
  enablement: WorkspaceBarEnablement,
  ctx: WorkspaceBarEvaluationContext
): ControlState {
  if (enablement.statuses !== 'any' && !enablement.statuses.includes(ctx.status)) {
    return { available: false, reason: 'STATUS', detail: ctx.status };
  }
  if (enablement.roles !== 'any' && !enablement.roles.includes(ctx.role)) {
    return { available: false, reason: 'ROLE', detail: ctx.role };
  }
  if (enablement.freshness !== 'any' && !enablement.freshness.includes(ctx.freshness)) {
    return { available: false, reason: 'FRESHNESS', detail: ctx.freshness };
  }
  for (const gate of enablement.requiresGates) {
    if (ctx.gates[gate] !== true) {
      return { available: false, reason: 'GATE', detail: gate };
    }
  }
  return { available: true };
}

// ---------------------------------------------------------------------------
// Tożsamość (lewa strona) — workspaceBarContract.ts:231-328
// ---------------------------------------------------------------------------

export const WORKSPACE_BAR_CONTEXT_FIELDS = ['type', 'period', 'entity', 'currencyScale', 'source', 'lastCompute'] as const;
export type WorkspaceBarContextField = (typeof WORKSPACE_BAR_CONTEXT_FIELDS)[number];

export interface WorkspaceBarEditableName {
  value: string;
  editable: boolean;
  editableBlockedReason: 'STATUS_IMMUTABLE' | 'INSUFFICIENT_ROLE' | null;
  maxChars: number;
  layoutBudgetChars: number;
}

export interface WorkspaceBarVersionBadge {
  label: string;
  businessVersionId: string;
  hasUncommittedWorkingRevision: boolean;
}

export interface WorkspaceBarIdentity {
  artifactRef: { artifactType: FinanceArtifactType; businessVersionId: string; artifactId: string };
  back: { targetListRoute: string; label: WorkspaceBarLabel };
  name: WorkspaceBarEditableName;
  version: WorkspaceBarVersionBadge;
  status: BusinessVersionStatus;
  freshness: FinanceArtifactFreshness;
  contextFields: readonly WorkspaceBarContextField[];
}

/** Approved (i inne terminalne) = niezmienialne — reopen/nowa wersja to wspierana ścieżka. workspaceBarContract.ts:288-295. */
export const RENAMEABLE_STATUSES: readonly BusinessVersionStatus[] = ['DRAFT', 'READY_FOR_REVIEW', 'IN_REVIEW', 'NEEDS_CHANGES'];
export const RENAMEABLE_ROLES: readonly FinanceRole[] = ['preparer', 'reviewer', 'approver', 'finance_admin'];

export function canRenameArtifact(
  status: BusinessVersionStatus,
  role: FinanceRole
): { editable: true } | { editable: false; reason: 'STATUS_IMMUTABLE' | 'INSUFFICIENT_ROLE' } {
  if (!RENAMEABLE_STATUSES.includes(status)) return { editable: false, reason: 'STATUS_IMMUTABLE' };
  if (!RENAMEABLE_ROLES.includes(role)) return { editable: false, reason: 'INSUFFICIENT_ROLE' };
  return { editable: true };
}

export type WorkspaceNameValidation =
  | { ok: true; normalized: string }
  | { ok: false; code: 'NAME_EMPTY' | 'NAME_TOO_LONG' | 'NAME_CONTROL_CHARS'; message: string };

export function validateWorkspaceName(raw: string): WorkspaceNameValidation {
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    return { ok: false, code: 'NAME_EMPTY', message: 'Nazwa nie może być pusta' };
  }
  // Bez literalu regex z zakresem znaków sterujących (ryzyko złego
  // zakodowania bajtów sterujacych przy zapisie) — sprawdzamy kody znaków wprost.
  const hasControlChars = Array.from(normalized).some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (hasControlChars) {
    return { ok: false, code: 'NAME_CONTROL_CHARS', message: 'Nazwa zawiera niedozwolone znaki sterujące' };
  }
  if (normalized.length > WORKSPACE_BAR_NAME_MAX_CHARS) {
    return {
      ok: false,
      code: 'NAME_TOO_LONG',
      message: `Nazwa może mieć maksymalnie ${WORKSPACE_BAR_NAME_MAX_CHARS} znaków (podano ${normalized.length})`,
    };
  }
  return { ok: true, normalized };
}

// ---------------------------------------------------------------------------
// Nawigacja widoków — workspaceBarContract.ts:334-371
// ---------------------------------------------------------------------------

export type WorkspaceBarViewNavigationPlacement = 'in-bar' | 'separate-row';
export type WorkspaceBarViewNavigationKind = 'tabs' | 'stepper';

export type WorkspaceBarViewStateKind = 'not-configured' | 'incomplete' | 'ready' | 'stale' | 'blocked' | 'not-applicable';

export interface WorkspaceBarViewState {
  kind: WorkspaceBarViewStateKind;
  label: WorkspaceBarLabel;
}

export interface WorkspaceBarView {
  id: string;
  label: WorkspaceBarLabel;
  /** Nazwany stan zamiast kropki koloru — a11y „status niezależny od koloru". `null` = brak stanu. */
  state: WorkspaceBarViewState | null;
}

export interface WorkspaceBarViewNavigation {
  kind: WorkspaceBarViewNavigationKind;
  views: readonly WorkspaceBarView[];
  activeViewId: string;
  placement: WorkspaceBarViewNavigationPlacement;
}

export function resolveViewNavigationPlacement(viewCount: number): WorkspaceBarViewNavigationPlacement {
  return viewCount <= WORKSPACE_BAR_INLINE_VIEW_LIMIT ? 'in-bar' : 'separate-row';
}

// ---------------------------------------------------------------------------
// Prawa strona — workspaceBarContract.ts:377-465. Budżet 5 kontrolek.
// ---------------------------------------------------------------------------

export type WorkspaceBarControlKind = 'primary' | 'secondary' | 'lifecycle' | 'more' | 'fullscreen' | 'extra';

interface WorkspaceBarControlBase {
  id: string;
  label: WorkspaceBarLabel;
  enablement: WorkspaceBarEnablement;
}

export interface WorkspaceBarPrimaryAction extends WorkspaceBarControlBase {
  kind: 'primary';
  mergesFreshness: boolean;
  keyboardCommandId: string | null;
}

export interface WorkspaceBarSecondaryAction extends WorkspaceBarControlBase {
  kind: 'secondary';
  keyboardCommandId: string | null;
}

export type WorkspaceBarLifecycleActionId = LifecycleAction | 'save_draft' | 'new_version';

export interface WorkspaceBarLifecycleTransition {
  action: WorkspaceBarLifecycleActionId;
  label: WorkspaceBarLabel;
  enablement: WorkspaceBarEnablement;
  destructive: boolean;
  requiresConfirmation: boolean;
  requiresReason: boolean;
}

export interface WorkspaceBarLifecycleControl extends WorkspaceBarControlBase {
  kind: 'lifecycle';
  transitions: readonly WorkspaceBarLifecycleTransition[];
}

export type WorkspaceBarMoreMenuItemGroup = 'document' | 'report' | 'data' | 'navigation' | 'danger';

export interface WorkspaceBarMoreMenuItem {
  id: string;
  label: WorkspaceBarLabel;
  group: WorkspaceBarMoreMenuItemGroup;
  enablement: WorkspaceBarEnablement;
  destructive: boolean;
  requiresConfirmation: boolean;
}

export interface WorkspaceBarMoreMenu extends WorkspaceBarControlBase {
  kind: 'more';
  items: readonly WorkspaceBarMoreMenuItem[];
}

export interface WorkspaceBarFullscreenControl extends WorkspaceBarControlBase {
  kind: 'fullscreen';
  iconOnly: true;
  ariaLabel: WorkspaceBarLabel;
}

export interface WorkspaceBarExtraControl extends WorkspaceBarControlBase {
  kind: 'extra';
}

export interface WorkspaceBarActions {
  primary: WorkspaceBarPrimaryAction;
  secondary: WorkspaceBarSecondaryAction | null;
  lifecycle: WorkspaceBarLifecycleControl | null;
  more: WorkspaceBarMoreMenu | null;
  fullscreen: WorkspaceBarFullscreenControl;
  extraDirectControls: readonly WorkspaceBarExtraControl[];
}

export type FinanceWorkspaceModuleId = 'statements' | 'analysis' | 'baselineModel' | 'prediction' | 'valuation';

export interface WorkspaceBarConfig {
  moduleId: FinanceWorkspaceModuleId;
  artifactType: FinanceArtifactType;
  identity: WorkspaceBarIdentity;
  viewNavigation: WorkspaceBarViewNavigation;
  actions: WorkspaceBarActions;
}

export function directRightControls(actions: WorkspaceBarActions): WorkspaceBarControlKind[] {
  const kinds: WorkspaceBarControlKind[] = ['primary'];
  if (actions.secondary) kinds.push('secondary');
  if (actions.lifecycle) kinds.push('lifecycle');
  if (actions.more) kinds.push('more');
  kinds.push('fullscreen');
  for (const _extra of actions.extraDirectControls) kinds.push('extra');
  return kinds;
}

export function countDirectRightControls(actions: WorkspaceBarActions): number {
  return directRightControls(actions).length;
}

// ---------------------------------------------------------------------------
// Walidacja — workspaceBarContract.ts:700-893 (bez sekcji „one document
// identity" — ta dotyczy deklaracji chrome regionów istniejących pięciu
// workspace'ów, których ten pakiet nie przebudowuje, OWN-FIN-001/allowlista).
// ---------------------------------------------------------------------------

export type WorkspaceBarValidationCode =
  | 'TOO_MANY_DIRECT_RIGHT_CONTROLS'
  | 'MISSING_PRIMARY_ACTION'
  | 'MISSING_FULLSCREEN_CONTROL'
  | 'DUPLICATE_CONTROL_ID'
  | 'EMPTY_MORE_MENU'
  | 'EMPTY_VIEW_NAVIGATION'
  | 'DUPLICATE_VIEW_ID'
  | 'ACTIVE_VIEW_NOT_FOUND'
  | 'VIEW_PLACEMENT_MISMATCH'
  | 'INVALID_NAME'
  | 'NAME_BUDGET_MISCONFIGURED'
  | 'ARTIFACT_TYPE_MISMATCH'
  | 'DESTRUCTIVE_WITHOUT_CONFIRMATION'
  | 'DUPLICATE_LIFECYCLE_TRANSITION'
  | 'EMPTY_CONTEXT_FIELDS';

export interface WorkspaceBarValidationError {
  code: WorkspaceBarValidationCode;
  path: string;
  message: string;
}

export type WorkspaceBarValidationResult = { ok: true } | { ok: false; errors: WorkspaceBarValidationError[] };

export function validateWorkspaceBarConfig(config: WorkspaceBarConfig): WorkspaceBarValidationResult {
  const errors: WorkspaceBarValidationError[] = [];
  const { actions, viewNavigation, identity } = config;

  const directCount = countDirectRightControls(actions);
  if (directCount > WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS) {
    errors.push({
      code: 'TOO_MANY_DIRECT_RIGHT_CONTROLS',
      path: 'actions',
      message: `Workspace Bar dopuszcza maks. ${WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS} bezpośrednich kontrolek po prawej, jest ${directCount} (${directRightControls(actions).join(', ')}). Przenieś nadmiar do menu More.`,
    });
  }
  if (!actions.primary) {
    errors.push({ code: 'MISSING_PRIMARY_ACTION', path: 'actions.primary', message: 'Wymagana dokładnie jedna akcja primary.' });
  }
  if (!actions.fullscreen) {
    errors.push({ code: 'MISSING_FULLSCREEN_CONTROL', path: 'actions.fullscreen', message: 'Fullscreen (focus mode) jest obowiązkową, zawsze ostatnią kontrolką.' });
  }

  const controlIds: Array<{ id: string; path: string }> = [];
  if (actions.primary) controlIds.push({ id: actions.primary.id, path: 'actions.primary' });
  if (actions.secondary) controlIds.push({ id: actions.secondary.id, path: 'actions.secondary' });
  if (actions.lifecycle) controlIds.push({ id: actions.lifecycle.id, path: 'actions.lifecycle' });
  if (actions.more) controlIds.push({ id: actions.more.id, path: 'actions.more' });
  if (actions.fullscreen) controlIds.push({ id: actions.fullscreen.id, path: 'actions.fullscreen' });
  actions.extraDirectControls.forEach((extra, index) => controlIds.push({ id: extra.id, path: `actions.extraDirectControls[${index}]` }));
  if (actions.more) {
    actions.more.items.forEach((item, index) => controlIds.push({ id: item.id, path: `actions.more.items[${index}]` }));
  }
  const seenControlIds = new Set<string>();
  for (const entry of controlIds) {
    if (seenControlIds.has(entry.id)) {
      errors.push({ code: 'DUPLICATE_CONTROL_ID', path: entry.path, message: `Zduplikowany id kontrolki "${entry.id}".` });
    }
    seenControlIds.add(entry.id);
  }

  if (actions.more && actions.more.items.length === 0) {
    errors.push({ code: 'EMPTY_MORE_MENU', path: 'actions.more.items', message: 'Menu More bez pozycji to martwa kontrolka — pomiń menu.' });
  }
  if (actions.more) {
    actions.more.items.forEach((item, index) => {
      if (item.destructive && !item.requiresConfirmation) {
        errors.push({ code: 'DESTRUCTIVE_WITHOUT_CONFIRMATION', path: `actions.more.items[${index}]`, message: `Destrukcyjna pozycja "${item.id}" musi wymagać potwierdzenia.` });
      }
    });
  }
  if (actions.lifecycle) {
    const seenTransitions = new Set<WorkspaceBarLifecycleActionId>();
    actions.lifecycle.transitions.forEach((transition, index) => {
      if (transition.destructive && !transition.requiresConfirmation) {
        errors.push({ code: 'DESTRUCTIVE_WITHOUT_CONFIRMATION', path: `actions.lifecycle.transitions[${index}]`, message: `Destrukcyjne przejście "${transition.action}" musi wymagać potwierdzenia.` });
      }
      if (seenTransitions.has(transition.action)) {
        errors.push({ code: 'DUPLICATE_LIFECYCLE_TRANSITION', path: `actions.lifecycle.transitions[${index}]`, message: `Akcja lifecycle "${transition.action}" zadeklarowana dwukrotnie.` });
      }
      seenTransitions.add(transition.action);
    });
  }

  if (viewNavigation.views.length === 0) {
    errors.push({ code: 'EMPTY_VIEW_NAVIGATION', path: 'viewNavigation.views', message: 'Każdy workspace deklaruje co najmniej jeden widok.' });
  } else {
    const seenViewIds = new Set<string>();
    viewNavigation.views.forEach((view, index) => {
      if (seenViewIds.has(view.id)) {
        errors.push({ code: 'DUPLICATE_VIEW_ID', path: `viewNavigation.views[${index}]`, message: `Zduplikowany id widoku "${view.id}".` });
      }
      seenViewIds.add(view.id);
    });
    if (!seenViewIds.has(viewNavigation.activeViewId)) {
      errors.push({ code: 'ACTIVE_VIEW_NOT_FOUND', path: 'viewNavigation.activeViewId', message: `activeViewId "${viewNavigation.activeViewId}" nie jest jednym z deklarowanych widoków.` });
    }
    const expectedPlacement = resolveViewNavigationPlacement(viewNavigation.views.length);
    if (viewNavigation.placement !== expectedPlacement) {
      errors.push({
        code: 'VIEW_PLACEMENT_MISMATCH',
        path: 'viewNavigation.placement',
        message: `${viewNavigation.views.length} widoki muszą renderować się jako "${expectedPlacement}" (limit inline ${WORKSPACE_BAR_INLINE_VIEW_LIMIT}), jest "${viewNavigation.placement}".`,
      });
    }
  }

  const nameCheck = validateWorkspaceName(identity.name.value);
  if (!nameCheck.ok) {
    errors.push({ code: 'INVALID_NAME', path: 'identity.name.value', message: nameCheck.message });
  }
  if (identity.name.maxChars !== WORKSPACE_BAR_NAME_MAX_CHARS || identity.name.layoutBudgetChars !== WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS) {
    errors.push({ code: 'NAME_BUDGET_MISCONFIGURED', path: 'identity.name', message: `Limity nazwy są stałą programu (maks ${WORKSPACE_BAR_NAME_MAX_CHARS}, budżet layoutu ${WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS}).` });
  }
  if (identity.artifactRef.artifactType !== config.artifactType) {
    errors.push({ code: 'ARTIFACT_TYPE_MISMATCH', path: 'identity.artifactRef.artifactType', message: `Config deklaruje artifactType "${config.artifactType}", identity.artifactRef ma "${identity.artifactRef.artifactType}".` });
  }
  if (identity.contextFields.length === 0) {
    errors.push({ code: 'EMPTY_CONTEXT_FIELDS', path: 'identity.contextFields', message: 'Context popover musi nieść co najmniej jedno pole.' });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ---------------------------------------------------------------------------
// Budżet layoutu — DOWÓD kryterium „1280px / 60 znaków / brak nakładania".
// workspaceBarContract.ts:900-1038.
// ---------------------------------------------------------------------------

export interface WorkspaceBarLayoutMetrics {
  charPx: number;
  gapPx: number;
  edgePaddingPx: number;
  iconControlPx: number;
  labelPaddingPx: number;
  backControlPx: number;
  versionBadgePx: number;
  statusBadgePx: number;
  inlineViewPaddingPx: number;
  inlineViewMinPx: number;
  minNamePx: number;
}

export const DEFAULT_WORKSPACE_BAR_METRICS: WorkspaceBarLayoutMetrics = {
  charPx: 7.5,
  gapPx: 8,
  edgePaddingPx: 16,
  iconControlPx: WORKSPACE_BAR_MIN_CONTROL_PX,
  labelPaddingPx: 28,
  backControlPx: WORKSPACE_BAR_MIN_CONTROL_PX,
  versionBadgePx: 52,
  statusBadgePx: 104,
  inlineViewPaddingPx: 24,
  inlineViewMinPx: 88,
  minNamePx: 120,
};

export interface WorkspaceBarLayoutEstimate {
  /** „Brak nakładania" — kryterium właścicielskie: reszta jest stałej szerokości, a to co zostaje ≥ minNamePx. */
  fits: boolean;
  fitsWithoutTruncation: boolean;
  viewportPx: number;
  fixedPx: number;
  nameAvailablePx: number;
  displayableNameChars: number;
  targetNameChars: number;
  slackPx: number;
  breakdown: { identityFixedPx: number; viewNavigationPx: number; actionsPx: number; gapsPx: number };
}

export function estimateWorkspaceBarLayout(
  config: WorkspaceBarConfig,
  options: { viewportPx?: number; nameChars?: number; freshness?: FinanceArtifactFreshness; metrics?: WorkspaceBarLayoutMetrics } = {}
): WorkspaceBarLayoutEstimate {
  const m = options.metrics ?? DEFAULT_WORKSPACE_BAR_METRICS;
  const viewportPx = options.viewportPx ?? WORKSPACE_BAR_REFERENCE_VIEWPORT_PX;
  const targetNameChars = options.nameChars ?? WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS;
  const freshness = options.freshness ?? config.identity.freshness;

  const labeledPx = (label: string): number => m.labelPaddingPx + label.length * m.charPx;
  const identityFixedPx = m.backControlPx + m.versionBadgePx + m.statusBadgePx;

  const inlineViews = config.viewNavigation.placement === 'in-bar' ? config.viewNavigation.views : [];
  const viewNavigationPx = inlineViews.reduce(
    (total, v) => total + Math.max(m.inlineViewMinPx, m.inlineViewPaddingPx + v.label.pl.length * m.charPx),
    0
  );

  const { actions } = config;
  const primaryLabel = mergeFreshnessIntoPrimaryLabel(actions.primary.label, freshness, actions.primary.mergesFreshness).pl;
  let actionsPx = labeledPx(primaryLabel);
  if (actions.secondary) actionsPx += labeledPx(actions.secondary.label.pl);
  if (actions.lifecycle) actionsPx += labeledPx(actions.lifecycle.label.pl);
  if (actions.more) actionsPx += m.iconControlPx;
  actionsPx += m.iconControlPx; // fullscreen
  for (const extra of actions.extraDirectControls) actionsPx += labeledPx(extra.label.pl);

  const gapCount = 3 + inlineViews.length + countDirectRightControls(actions) + 1;
  const gapsPx = gapCount * m.gapPx + 2 * m.edgePaddingPx;

  const fixedPx = identityFixedPx + viewNavigationPx + actionsPx + gapsPx;
  const nameAvailablePx = viewportPx - fixedPx;
  const displayableNameChars = Math.max(0, Math.floor(nameAvailablePx / m.charPx));

  return {
    fits: nameAvailablePx >= m.minNamePx,
    fitsWithoutTruncation: displayableNameChars >= targetNameChars,
    viewportPx,
    fixedPx: Math.round(fixedPx),
    nameAvailablePx: Math.round(nameAvailablePx),
    displayableNameChars,
    targetNameChars,
    slackPx: Math.round(nameAvailablePx - m.minNamePx),
    breakdown: {
      identityFixedPx: Math.round(identityFixedPx),
      viewNavigationPx: Math.round(viewNavigationPx),
      actionsPx: Math.round(actionsPx),
      gapsPx: Math.round(gapsPx),
    },
  };
}
