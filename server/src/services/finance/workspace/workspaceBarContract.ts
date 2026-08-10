/**
 * AP-09 — Finance Workspace Bar: the typed contract every Finance module
 * supplies so ONE shared bar can render all five workspaces.
 *
 * Sources of truth (read in full before writing this file):
 *   - `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 *     section 11 ("Finance Workspace Bar" / "Focus mode" / "Viewport policy" /
 *     "A11y"): sticky, one hierarchy — left = Back + editable name + compact
 *     version/status; Context popover = type, period, entity, currency/scale,
 *     source, last compute; centre = main views only; right = combined
 *     freshness/primary action, max 1 secondary, lifecycle, More and
 *     fullscreen; **max 5 direct controls on the right**. "Valuation stepper
 *     jest osobnym kompaktowym row, nie przeładowuje paska."
 *   - `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 *     section 7 ("Odchudzenie Workspace Bar"), which adds the acceptance
 *     criterion: "przy 1280 px i nazwie 60 znaków brak nakładania; maksymalnie
 *     pięć bezpośrednich controls po prawej; 200% zoom pozostaje operacyjny".
 *   - `docs/validation/finance-v3/OWNER_REVIEW_REGISTER_2026-08-09.md`
 *     OWN-FIN-011 (one shared bar, editable name as a CONTROLLED operation
 *     with validation/save/readback/history, dependent on status and
 *     permissions), OWN-FIN-012 (the bar is the lifecycle centre; an empty
 *     Draft's primary CTA leads to configuration, NOT to a sham Approve),
 *     OWN-FIN-016 and OWN-FIN-020 (apply the same bar in Models/Prediction).
 *
 * ===========================================================================
 * SCOPE — stated up front because it drives every decision below.
 * ===========================================================================
 * This package is DATA AND PURE LOGIC ONLY. There is deliberately **no React
 * component, no .tsx file and no DOM import** anywhere in
 * `server/src/services/finance/workspace/`. The visual shell is a separate,
 * later step that requires the owner's acceptance on screenshots
 * (`CLAUDE.md` rule 7: "Piotr nigdy nie jest pierwszym testerem wizualnym").
 * The same split AP-01 draws between pure grid-coordinate logic and the future
 * `FinanceDataGrid`, and AP-03 draws between its command registry and the
 * future keyboard hook, applies here: this file says WHAT the bar contains and
 * WHICH configurations are illegal; a future component says how it looks.
 *
 * Consequently `validateWorkspaceBarConfig` is the enforcement point for the
 * "max 5 direct controls" rule — it is a real, testable gate that rejects an
 * over-stuffed module configuration at contract level, before any pixel
 * exists. A React component cannot be trusted to enforce it (nothing stops a
 * module from rendering a sixth button); a validated config can.
 */

import type { ArtifactRef, FinanceArtifactType } from '../../../types/finance/ArtifactRef.js';
import type { FinanceArtifactFreshness } from '../../../types/finance/financeValueSemantics.js';
import type { FinanceChromeRegion } from './focusModeContract.js';
import type {
  BusinessVersionStatus,
  FinanceRole,
  LifecycleAction,
} from '../canonical/lifecycleService.js';

// ---------------------------------------------------------------------------
// Hard limits — the numbers section 7 of the addendum states literally.
// ---------------------------------------------------------------------------

/** Addendum section 7: "maksymalnie pięć bezpośrednich controls po prawej". Handoff section 11 repeats it. */
export const WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS = 5;

/**
 * Addendum section 7: "view navigation: w pasku dla dwóch widoków, osobna
 * kompaktowa linia przy większej liczbie kroków". Taken literally: two views
 * render inside the bar, three or more render on their own compact row.
 *
 * JUDGMENT CALL, flagged in the AP-09/10/11 report's escalation section: this
 * puts Statements (P&L/BS/CF = three views) on the separate row even though
 * handoff section 5 calls P&L/BS/CF "główne widoki" and section 11 puts
 * "główne views" in the centre of the bar. The addendum is the later,
 * explicitly narrowing document ("Odchudzenie Workspace Bar") and this task's
 * brief cites its criterion verbatim, so the literal reading wins here and the
 * tension is escalated rather than silently resolved in either direction.
 * Changing the decision means changing this one constant — every adapter
 * derives its placement from it.
 */
export const WORKSPACE_BAR_INLINE_VIEW_LIMIT = 2;

/** Hard cap on a stored artifact name. Longer names are a data problem, not a layout problem. */
export const WORKSPACE_BAR_NAME_MAX_CHARS = 120;

/**
 * The LAYOUT budget from the addendum's acceptance criterion ("nazwa 60
 * znaków"), which is a different thing from the storage cap above: a 61..120
 * character name is legal to store and is rendered truncated with the full
 * value in the title/tooltip; the bar must not overlap at 60.
 */
export const WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS = 60;

/** Addendum section 7 acceptance criterion viewport. Handoff section 11 viewport policy: acceptance primarily at 1280/1440/1920. */
export const WORKSPACE_BAR_REFERENCE_VIEWPORT_PX = 1280;

/** Handoff section 11 A11y: "44 px controls". Used by the layout budget below. */
export const WORKSPACE_BAR_MIN_CONTROL_PX = 44;

// ---------------------------------------------------------------------------
// Labels — data, not rendered strings.
// ---------------------------------------------------------------------------

/**
 * A label carried as an i18n key PLUS the Polish default. The owner reviews in
 * Polish and the register (OWN-FIN-012) dictates Polish wording
 * (`Zapisz wersję roboczą`, `Przelicz`, `Przekaż do przeglądu`, ...), but
 * hard-coding a display string into a backend contract would make the bar
 * untranslatable. Both travel together so neither side has to guess.
 */
export interface WorkspaceBarLabel {
  key: string;
  pl: string;
}

// ---------------------------------------------------------------------------
// Freshness merged into the primary CTA (addendum section 7:
// "freshness połączone z CTA, np. `Nieaktualne · Przelicz`").
// ---------------------------------------------------------------------------

export const WORKSPACE_BAR_FRESHNESS_SEPARATOR = ' · ';

/**
 * Prefix prepended to the primary action's label per freshness state. `null`
 * means "no prefix" — a CURRENT artifact must not shout a status that says
 * nothing; the bar shows the bare CTA.
 */
export const WORKSPACE_BAR_FRESHNESS_PREFIX: Readonly<
  Record<FinanceArtifactFreshness, WorkspaceBarLabel | null>
> = {
  CURRENT: null,
  NEVER_COMPUTED: { key: 'finance.freshness.neverComputed', pl: 'Nie przeliczono' },
  STALE_SOURCE: { key: 'finance.freshness.staleSource', pl: 'Nieaktualne' },
  STALE_ASSUMPTIONS: { key: 'finance.freshness.staleAssumptions', pl: 'Nieaktualne' },
  COMPUTE_FAILED: { key: 'finance.freshness.computeFailed', pl: 'Błąd przeliczenia' },
};

/**
 * Build the rendered primary-CTA label. Returns a structured result rather
 * than a bare string so the future component can style the prefix
 * independently (handoff section 11 A11y: "status niezależny od koloru" — the
 * prefix IS the non-colour status carrier) and so a screen reader can be given
 * the two parts separately.
 */
export interface MergedPrimaryLabel {
  /** `null` when freshness is CURRENT. */
  prefix: WorkspaceBarLabel | null;
  action: WorkspaceBarLabel;
  /** Convenience flattening for tests/snapshot: `Nieaktualne · Przelicz`. */
  pl: string;
  freshness: FinanceArtifactFreshness;
}

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
// Enablement — declarative, evaluated by `resolveControlState` below.
// ---------------------------------------------------------------------------

/**
 * When a control is available. Everything is a whitelist so the DEFAULT is
 * "hidden/disabled", not "shown": OWN-FIN-012's complaint is precisely that an
 * empty Draft offered a sham Approve. `'any'` must be written explicitly.
 */
export interface WorkspaceBarEnablement {
  statuses: readonly BusinessVersionStatus[] | 'any';
  roles: readonly FinanceRole[] | 'any';
  /** Freshness states in which the control is meaningful; `'any'` for state-independent controls (fullscreen, More). */
  freshness: readonly FinanceArtifactFreshness[] | 'any';
  /**
   * Named completeness gates the module itself evaluates (e.g.
   * `'analysis.hasConfiguredKpis'`, `'model.assumptionsConfirmed'`). This
   * contract only carries the NAMES — evaluating them needs artifact content
   * the bar does not own. Unknown/unsupplied gates resolve to `false`
   * (fail-closed), which is what keeps a sham Approve off an empty Draft.
   */
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
  /** Gate name -> satisfied. A gate absent from this map is treated as NOT satisfied. */
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
// Identity (left side).
// ---------------------------------------------------------------------------

/**
 * Handoff section 11: "Context popover: type, period, entity, currency/scale,
 * source i last compute". These six are the whole popover — anything a module
 * wants beyond them belongs in the workspace, not the bar. Keeping this a
 * closed union is what stops OWN-FIN-011's "kilka pięter nagłówka" from
 * reappearing inside a popover.
 */
export const WORKSPACE_BAR_CONTEXT_FIELDS = [
  'type',
  'period',
  'entity',
  'currencyScale',
  'source',
  'lastCompute',
] as const;
export type WorkspaceBarContextField = (typeof WORKSPACE_BAR_CONTEXT_FIELDS)[number];

/** OWN-FIN-011: renaming is a controlled operation with validation, save, readback and history — never a bare input. */
export interface WorkspaceBarEditableName {
  value: string;
  /** Resolved by `canRenameArtifact` at build time; the component must not re-derive it. */
  editable: boolean;
  /** Why editing is off, for the disabled-state tooltip. `null` when `editable`. */
  editableBlockedReason: 'STATUS_IMMUTABLE' | 'INSUFFICIENT_ROLE' | null;
  maxChars: number;
  /** Renders truncated beyond this, full value in the accessible name. */
  layoutBudgetChars: number;
}

export interface WorkspaceBarVersionBadge {
  /** Human label, e.g. `v3`. Derived from the business version, never typed by a user. */
  label: string;
  businessVersionId: string;
  /** DEC-FIN-010: working revisions are NOT business versions. Shown as a subdued "· zmiany robocze" marker, not a new version number. */
  hasUncommittedWorkingRevision: boolean;
}

export interface WorkspaceBarIdentity {
  artifactRef: ArtifactRef;
  /** Left-most control. OWN-FIN-016: "Back to list" belongs here, not as a second header row. */
  back: { targetListRoute: string; label: WorkspaceBarLabel };
  name: WorkspaceBarEditableName;
  version: WorkspaceBarVersionBadge;
  status: BusinessVersionStatus;
  freshness: FinanceArtifactFreshness;
  /** Only fields the module can actually populate; the popover hides the rest rather than showing empty rows. */
  contextFields: readonly WorkspaceBarContextField[];
}

/**
 * OWN-FIN-011 / DEC-FIN-007: an Approved (or otherwise terminal) version's
 * content is immutable. A NAME is metadata, but the register still ties the
 * rename to "status/uprawnienia", and renaming an Approved artifact that has
 * already been cited downstream is exactly the kind of silent history rewrite
 * the lineage rules exist to prevent — so terminal + APPROVED are read-only
 * here. Reopen/new version is the supported path.
 */
export const RENAMEABLE_STATUSES: readonly BusinessVersionStatus[] = [
  'DRAFT',
  'READY_FOR_REVIEW',
  'IN_REVIEW',
  'NEEDS_CHANGES',
];

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

/** OWN-FIN-011's "walidacja" half of the controlled rename. Save/readback/history are the caller's (a future route) job. */
export function validateWorkspaceName(raw: string): WorkspaceNameValidation {
  const normalized = raw.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    return { ok: false, code: 'NAME_EMPTY', message: 'Nazwa nie może być pusta' };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(normalized)) {
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
// View navigation (centre / own compact row).
// ---------------------------------------------------------------------------

export type WorkspaceBarViewNavigationPlacement = 'in-bar' | 'separate-row';
export type WorkspaceBarViewNavigationKind = 'tabs' | 'stepper';

export interface WorkspaceBarView {
  id: string;
  label: WorkspaceBarLabel;
  /**
   * Handoff section 9: "Named step states zamiast czerwonych kropek" — the
   * step/tab carries a NAMED state, never a bare coloured dot (also the A11y
   * "status niezależny od koloru" requirement). `null` = no state to show.
   */
  state: WorkspaceBarViewState | null;
}

export type WorkspaceBarViewStateKind =
  | 'not-configured'
  | 'incomplete'
  | 'ready'
  | 'stale'
  | 'blocked'
  | 'not-applicable';

export interface WorkspaceBarViewState {
  kind: WorkspaceBarViewStateKind;
  label: WorkspaceBarLabel;
}

export interface WorkspaceBarViewNavigation {
  kind: WorkspaceBarViewNavigationKind;
  views: readonly WorkspaceBarView[];
  activeViewId: string;
  /** Derived — always via `resolveViewNavigationPlacement`; the validator rejects a hand-set mismatch. */
  placement: WorkspaceBarViewNavigationPlacement;
}

export function resolveViewNavigationPlacement(viewCount: number): WorkspaceBarViewNavigationPlacement {
  return viewCount <= WORKSPACE_BAR_INLINE_VIEW_LIMIT ? 'in-bar' : 'separate-row';
}

// ---------------------------------------------------------------------------
// Right-hand controls. THE part the 5-control budget governs.
// ---------------------------------------------------------------------------

export type WorkspaceBarControlKind = 'primary' | 'secondary' | 'lifecycle' | 'more' | 'fullscreen' | 'extra';

interface WorkspaceBarControlBase {
  id: string;
  label: WorkspaceBarLabel;
  enablement: WorkspaceBarEnablement;
}

export interface WorkspaceBarPrimaryAction extends WorkspaceBarControlBase {
  kind: 'primary';
  /** When true the rendered label is `mergeFreshnessIntoPrimaryLabel(label, freshness)` — addendum section 7. */
  mergesFreshness: boolean;
  /** Optional AP-03 `KeyboardCommand.id` this button mirrors, so the bar and the keyboard layer cannot drift apart. */
  keyboardCommandId: string | null;
}

export interface WorkspaceBarSecondaryAction extends WorkspaceBarControlBase {
  kind: 'secondary';
  keyboardCommandId: string | null;
}

/** OWN-FIN-012: one status control that both SHOWS the status and offers only the permitted transitions. Its menu items are NOT direct controls. */
export interface WorkspaceBarLifecycleControl extends WorkspaceBarControlBase {
  kind: 'lifecycle';
  transitions: readonly WorkspaceBarLifecycleTransition[];
}

/**
 * `action` widens `LifecycleAction` with the two bar-level operations
 * OWN-FIN-012/013 name that are not `lifecycleService` transitions:
 * `save_draft` (a working revision, DEC-FIN-010) and `new_version` (the
 * Approved -> numbered new draft path, OWN-FIN-013).
 */
export type WorkspaceBarLifecycleActionId = LifecycleAction | 'save_draft' | 'new_version';

export interface WorkspaceBarLifecycleTransition {
  action: WorkspaceBarLifecycleActionId;
  label: WorkspaceBarLabel;
  enablement: WorkspaceBarEnablement;
  /** OWN-FIN-012: "wymagają potwierdzenia dla operacji destrukcyjnych". */
  destructive: boolean;
  requiresConfirmation: boolean;
  /** DEC-FIN-001/007: a reason string is mandatory for these (invalidate, reopen, emergency approve). */
  requiresReason: boolean;
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

/** OWN-FIN-004: "dyskretny, jednoznaczny przycisk w prawym górnym rogu" — always the last control. */
export interface WorkspaceBarFullscreenControl extends WorkspaceBarControlBase {
  kind: 'fullscreen';
  iconOnly: true;
  /** A11y: an icon-only control needs a real accessible name (handoff section 11 "screen-reader labels"). */
  ariaLabel: WorkspaceBarLabel;
}

/**
 * Deliberate escape hatch that exists ONLY so the validator can catch abuse.
 * A module has no legitimate reason to populate this — but without a place to
 * put a sixth control, "reject a config with 6 direct controls" would be
 * unrepresentable and therefore untestable. Populating it is what makes
 * `validateWorkspaceBarConfig` fail.
 */
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

// ---------------------------------------------------------------------------
// The full config.
// ---------------------------------------------------------------------------

export type FinanceWorkspaceModuleId =
  | 'statements'
  | 'analysis'
  | 'baselineModel'
  | 'prediction'
  | 'valuation';

export interface WorkspaceBarConfig {
  moduleId: FinanceWorkspaceModuleId;
  /** Must equal `identity.artifactRef.artifactType`; the validator enforces it. */
  artifactType: FinanceArtifactType;
  identity: WorkspaceBarIdentity;
  viewNavigation: WorkspaceBarViewNavigation;
  actions: WorkspaceBarActions;
  /**
   * What chrome the module renders around the bar in NORMAL (non-focus) mode.
   * OPTIONAL and defaulting to `DEFAULT_WORKSPACE_CHROME_DECLARATION`, so the
   * five AP-10 adapters keep compiling and validating unchanged — see the
   * "one document identity" section below for why the default is
   * bar-only-and-compliant and what that costs.
   */
  chrome?: WorkspaceChromeDeclaration | null;
}

// ---------------------------------------------------------------------------
// ONE DOCUMENT IDENTITY — the rule OUTSIDE focus mode.
//
// `focusModeContract.ts` hides `financeModuleHeader` & co. when focus mode is
// on. That covers a mode the user is rarely in and says nothing about the
// normal screen — yet the requirement is about the normal screen:
//
//   OWN-FIN-011: "Nazwa projektu/analizy i informacje kontekstowe są
//   powtarzane w kilku piętrach nagłówka, co zabiera znaczną część obszaru
//   roboczego. ... Usunąć duplikaty tytułu i osobny konkurencyjny nagłówek."
//   OWN-FIN-005 already ordered the separate status lines merged into the bar.
//
// So the bar is not merely "a place where the name may appear" — it is the
// ONLY place. This section makes that a validated rule, in the same spirit as
// `TOO_MANY_DIRECT_RIGHT_CONTROLS`: a module DECLARES its chrome and an
// illegal declaration is rejected at contract level.
//
// WHAT THIS DOES NOT DO, stated plainly so a green test is not mistaken for a
// clean screen: this validates a DECLARATION, not a rendered page. The five
// existing `src/components/finance/Financial*Workspace.tsx` components know
// nothing about this contract and are not covered by it. Visual proof that no
// duplicate header survives stays EVIDENCE_MISSING (see the AP-09 report) and
// requires a screenshot at 1280 px per CLAUDE.md rule 7.
// ---------------------------------------------------------------------------

/** The elements that, together, ARE the document's identity. Any of them outside the bar is a duplicate title. */
export const DOCUMENT_IDENTITY_ELEMENTS = [
  'name',
  'version',
  'status',
  'freshness',
  'contextMetadata',
  'backToList',
] as const;
export type DocumentIdentityElement = (typeof DOCUMENT_IDENTITY_ELEMENTS)[number];

/** The one region allowed to carry them. */
export const DOCUMENT_IDENTITY_REGION: FinanceChromeRegion = 'workspaceBar';

/**
 * Regions a Finance workspace may not render AT ALL in normal mode, whatever
 * they claim to contain: OWN-FIN-011 removed the competing header outright and
 * OWN-FIN-005 merged the status strip into the bar. Keeping them out by name
 * (rather than only checking their contents) is deliberate — a "header" that
 * currently holds nothing identity-shaped is one commit away from holding the
 * title again, and it is already costing the vertical space the register
 * complained about.
 */
export const FORBIDDEN_NORMAL_MODE_REGIONS: readonly FinanceChromeRegion[] = [
  'financeModuleHeader',
  'financeStatusStrip',
];

export interface WorkspaceChromeDeclaration {
  /** Chrome regions the module renders in NORMAL mode, besides the bar itself. */
  regionsRendered: readonly FinanceChromeRegion[];
  /** Identity elements carried per region. A region absent from the map carries none. */
  identityElementsByRegion: Readonly<Partial<Record<FinanceChromeRegion, readonly DocumentIdentityElement[]>>>;
}

/**
 * The compliant declaration: the bar carries the whole identity and the module
 * adds no header of its own. Used as the default for a config that does not
 * declare — which means an undeclared module PASSES. That is a knowingly weak
 * default, chosen because tightening it would require editing the five AP-10
 * adapters (out of scope for this wave); `requireChromeDeclaration` below is
 * the switch AP-10 flips once the adapters declare explicitly.
 */
export const DEFAULT_WORKSPACE_CHROME_DECLARATION: WorkspaceChromeDeclaration = {
  regionsRendered: [],
  identityElementsByRegion: {
    workspaceBar: DOCUMENT_IDENTITY_ELEMENTS,
  },
};

/** Every control the bar renders DIRECTLY on the right (menu contents excluded — a menu is one control). */
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
// Validation.
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
  | 'EMPTY_CONTEXT_FIELDS'
  | 'DUPLICATE_DOCUMENT_IDENTITY'
  | 'COMPETING_MODULE_HEADER'
  | 'IDENTITY_REGION_NOT_RENDERED'
  | 'BAR_CARRIES_NO_IDENTITY'
  | 'MISSING_CHROME_DECLARATION';

export interface WorkspaceBarValidationError {
  code: WorkspaceBarValidationCode;
  /** Dot path into the config, e.g. `actions.extraDirectControls[0]`. */
  path: string;
  message: string;
}

export type WorkspaceBarValidationResult =
  | { ok: true }
  | { ok: false; errors: WorkspaceBarValidationError[] };

/**
 * Reject any Workspace Bar configuration that violates the addendum's slimming
 * rules. Returns ALL violations, not the first — a module author fixing an
 * over-stuffed bar should see the whole bill at once.
 *
 * The headline rule (this task's acceptance criterion): a configuration with
 * more than `WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS` direct right-hand
 * controls is REJECTED.
 */
export interface WorkspaceBarValidationOptions {
  /**
   * Reject a config that does not declare its chrome, instead of assuming the
   * compliant default. Off by default so the AP-10 adapters (which predate the
   * field) keep passing; AP-10 turns it on when every adapter declares.
   */
  requireChromeDeclaration?: boolean;
}

/**
 * The "one document identity" half of the validator, split out so it can be
 * called on a bare declaration (e.g. from a component test) without building a
 * whole `WorkspaceBarConfig`.
 */
export function validateDocumentIdentity(
  chrome: WorkspaceChromeDeclaration,
  pathPrefix = 'chrome'
): WorkspaceBarValidationError[] {
  const errors: WorkspaceBarValidationError[] = [];

  for (const region of chrome.regionsRendered) {
    if (FORBIDDEN_NORMAL_MODE_REGIONS.includes(region)) {
      errors.push({
        code: 'COMPETING_MODULE_HEADER',
        path: `${pathPrefix}.regionsRendered`,
        message:
          `Region "${region}" must not be rendered at all — OWN-FIN-011 removed the competing header and ` +
          'OWN-FIN-005 merged the status lines into the Workspace Bar. Move its content into the bar or the workspace.',
      });
    }
  }

  const barElements = chrome.identityElementsByRegion[DOCUMENT_IDENTITY_REGION] ?? [];
  if (barElements.length === 0) {
    errors.push({
      code: 'BAR_CARRIES_NO_IDENTITY',
      path: `${pathPrefix}.identityElementsByRegion.${DOCUMENT_IDENTITY_REGION}`,
      message:
        'The Workspace Bar must carry the document identity (name/version/status). A declaration that gives it ' +
        'none has moved the title somewhere else, which is the duplication OWN-FIN-011 exists to end.',
    });
  }

  for (const [region, elements] of Object.entries(chrome.identityElementsByRegion) as Array<
    [FinanceChromeRegion, readonly DocumentIdentityElement[] | undefined]
  >) {
    if (region === DOCUMENT_IDENTITY_REGION || !elements || elements.length === 0) continue;
    errors.push({
      code: 'DUPLICATE_DOCUMENT_IDENTITY',
      path: `${pathPrefix}.identityElementsByRegion.${region}`,
      message:
        `Region "${region}" declares document identity element(s) [${elements.join(', ')}], but only ` +
        `"${DOCUMENT_IDENTITY_REGION}" may carry them (OWN-FIN-011: "Usunąć duplikaty tytułu i osobny ` +
        'konkurencyjny nagłówek"). This rule applies in NORMAL mode, not only in focus mode.',
    });
    if (!chrome.regionsRendered.includes(region)) {
      errors.push({
        code: 'IDENTITY_REGION_NOT_RENDERED',
        path: `${pathPrefix}.identityElementsByRegion.${region}`,
        message:
          `Region "${region}" carries identity elements but is not listed in regionsRendered — the declaration ` +
          'contradicts itself, so neither half can be trusted.',
      });
    }
  }

  return errors;
}

export function validateWorkspaceBarConfig(
  config: WorkspaceBarConfig,
  options: WorkspaceBarValidationOptions = {}
): WorkspaceBarValidationResult {
  const errors: WorkspaceBarValidationError[] = [];
  const { actions, viewNavigation, identity } = config;

  // --- One document identity, in NORMAL mode --------------------------------
  if (config.chrome == null) {
    if (options.requireChromeDeclaration) {
      errors.push({
        code: 'MISSING_CHROME_DECLARATION',
        path: 'chrome',
        message:
          'This module must declare which chrome it renders in normal mode, so "one document identity" can be ' +
          'checked rather than assumed.',
      });
    }
  } else {
    errors.push(...validateDocumentIdentity(config.chrome));
  }

  // --- Right-hand control budget -------------------------------------------
  const directCount = countDirectRightControls(actions);
  if (directCount > WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS) {
    errors.push({
      code: 'TOO_MANY_DIRECT_RIGHT_CONTROLS',
      path: 'actions',
      message:
        `Workspace Bar allows at most ${WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS} direct controls on the right, ` +
        `got ${directCount} (${directRightControls(actions).join(', ')}). ` +
        'Move the surplus into the More menu or onto the view itself.',
    });
  }

  if (!actions.primary) {
    errors.push({
      code: 'MISSING_PRIMARY_ACTION',
      path: 'actions.primary',
      message: 'Every Finance workspace must declare exactly one primary action (addendum section 7: "1 primary").',
    });
  }
  if (!actions.fullscreen) {
    errors.push({
      code: 'MISSING_FULLSCREEN_CONTROL',
      path: 'actions.fullscreen',
      message: 'Fullscreen (focus mode) is a mandatory, always-last control (OWN-FIN-004 / OWN-FIN-011).',
    });
  }

  // --- Control id uniqueness ------------------------------------------------
  const controlIds: Array<{ id: string; path: string }> = [];
  if (actions.primary) controlIds.push({ id: actions.primary.id, path: 'actions.primary' });
  if (actions.secondary) controlIds.push({ id: actions.secondary.id, path: 'actions.secondary' });
  if (actions.lifecycle) controlIds.push({ id: actions.lifecycle.id, path: 'actions.lifecycle' });
  if (actions.more) controlIds.push({ id: actions.more.id, path: 'actions.more' });
  if (actions.fullscreen) controlIds.push({ id: actions.fullscreen.id, path: 'actions.fullscreen' });
  actions.extraDirectControls.forEach((extra, index) =>
    controlIds.push({ id: extra.id, path: `actions.extraDirectControls[${index}]` })
  );
  if (actions.more) {
    actions.more.items.forEach((item, index) =>
      controlIds.push({ id: item.id, path: `actions.more.items[${index}]` })
    );
  }
  const seenControlIds = new Set<string>();
  for (const entry of controlIds) {
    if (seenControlIds.has(entry.id)) {
      errors.push({
        code: 'DUPLICATE_CONTROL_ID',
        path: entry.path,
        message: `Duplicate control id "${entry.id}" — ids must be unique across the whole bar (they are the keyboard/telemetry key).`,
      });
    }
    seenControlIds.add(entry.id);
  }

  // --- More menu ------------------------------------------------------------
  if (actions.more && actions.more.items.length === 0) {
    errors.push({
      code: 'EMPTY_MORE_MENU',
      path: 'actions.more.items',
      message: 'A More menu with no items is a dead control — omit the menu instead.',
    });
  }

  // --- Destructive confirmation --------------------------------------------
  if (actions.more) {
    actions.more.items.forEach((item, index) => {
      if (item.destructive && !item.requiresConfirmation) {
        errors.push({
          code: 'DESTRUCTIVE_WITHOUT_CONFIRMATION',
          path: `actions.more.items[${index}]`,
          message: `Destructive item "${item.id}" must set requiresConfirmation (OWN-FIN-012).`,
        });
      }
    });
  }
  if (actions.lifecycle) {
    const seenTransitions = new Set<WorkspaceBarLifecycleActionId>();
    actions.lifecycle.transitions.forEach((transition, index) => {
      if (transition.destructive && !transition.requiresConfirmation) {
        errors.push({
          code: 'DESTRUCTIVE_WITHOUT_CONFIRMATION',
          path: `actions.lifecycle.transitions[${index}]`,
          message: `Destructive transition "${transition.action}" must set requiresConfirmation (OWN-FIN-012).`,
        });
      }
      if (seenTransitions.has(transition.action)) {
        errors.push({
          code: 'DUPLICATE_LIFECYCLE_TRANSITION',
          path: `actions.lifecycle.transitions[${index}]`,
          message: `Lifecycle action "${transition.action}" is declared twice.`,
        });
      }
      seenTransitions.add(transition.action);
    });
  }

  // --- View navigation ------------------------------------------------------
  if (viewNavigation.views.length === 0) {
    errors.push({
      code: 'EMPTY_VIEW_NAVIGATION',
      path: 'viewNavigation.views',
      message: 'Every Finance workspace declares at least one view.',
    });
  } else {
    const seenViewIds = new Set<string>();
    viewNavigation.views.forEach((view, index) => {
      if (seenViewIds.has(view.id)) {
        errors.push({
          code: 'DUPLICATE_VIEW_ID',
          path: `viewNavigation.views[${index}]`,
          message: `Duplicate view id "${view.id}".`,
        });
      }
      seenViewIds.add(view.id);
    });
    if (!seenViewIds.has(viewNavigation.activeViewId)) {
      errors.push({
        code: 'ACTIVE_VIEW_NOT_FOUND',
        path: 'viewNavigation.activeViewId',
        message: `activeViewId "${viewNavigation.activeViewId}" is not one of the declared views.`,
      });
    }
    const expectedPlacement = resolveViewNavigationPlacement(viewNavigation.views.length);
    if (viewNavigation.placement !== expectedPlacement) {
      errors.push({
        code: 'VIEW_PLACEMENT_MISMATCH',
        path: 'viewNavigation.placement',
        message:
          `${viewNavigation.views.length} views must render as "${expectedPlacement}" ` +
          `(inline limit ${WORKSPACE_BAR_INLINE_VIEW_LIMIT}), got "${viewNavigation.placement}".`,
      });
    }
  }

  // --- Identity -------------------------------------------------------------
  const nameCheck = validateWorkspaceName(identity.name.value);
  if (!nameCheck.ok) {
    errors.push({ code: 'INVALID_NAME', path: 'identity.name.value', message: nameCheck.message });
  }
  if (
    identity.name.maxChars !== WORKSPACE_BAR_NAME_MAX_CHARS ||
    identity.name.layoutBudgetChars !== WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS
  ) {
    errors.push({
      code: 'NAME_BUDGET_MISCONFIGURED',
      path: 'identity.name',
      message:
        `Name limits are program-wide constants (max ${WORKSPACE_BAR_NAME_MAX_CHARS}, layout budget ` +
        `${WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS}); a module must not redefine them.`,
    });
  }
  if (identity.artifactRef.artifactType !== config.artifactType) {
    errors.push({
      code: 'ARTIFACT_TYPE_MISMATCH',
      path: 'identity.artifactRef.artifactType',
      message:
        `Config declares artifactType "${config.artifactType}" but identity.artifactRef is ` +
        `"${identity.artifactRef.artifactType}".`,
    });
  }
  if (identity.contextFields.length === 0) {
    errors.push({
      code: 'EMPTY_CONTEXT_FIELDS',
      path: 'identity.contextFields',
      message:
        'The Context popover must carry at least one field — otherwise the metadata OWN-FIN-011 moved out of the header rows has nowhere to live.',
    });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ---------------------------------------------------------------------------
// Layout budget — the "1280 px / 60 characters / no overlap" criterion,
// expressed as arithmetic so it can regress in CI.
// ---------------------------------------------------------------------------

/**
 * IMPORTANT, and stated plainly: this is a WIDTH BUDGET HEURISTIC, not a
 * rendering test. It cannot prove "brak nakładania" — only a real screenshot
 * at 1280 px can, and per `CLAUDE.md` rule 7 that screenshot is taken by the
 * implementer BEFORE the owner ever sees the screen. What this function does
 * buy is a cheap, deterministic CI tripwire: if someone adds a control or a
 * wider label and the arithmetic no longer fits, the test goes red long before
 * anyone renders anything. Treat a pass as "not obviously broken", never as
 * visual acceptance.
 */
export interface WorkspaceBarLayoutMetrics {
  /** Average advance width of one character in the bar's label font, px. */
  charPx: number;
  gapPx: number;
  edgePaddingPx: number;
  iconControlPx: number;
  /** A labeled button = `labelPaddingPx + label.length * charPx`. */
  labelPaddingPx: number;
  backControlPx: number;
  versionBadgePx: number;
  statusBadgePx: number;
  /** An in-bar tab = `inlineViewPaddingPx + label.length * charPx`, floored at `inlineViewMinPx`. */
  inlineViewPaddingPx: number;
  inlineViewMinPx: number;
  /**
   * The narrowest the (flexible) name may shrink to before it stops being a
   * name. Below this the bar genuinely overlaps rather than truncates.
   */
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
  /**
   * "Brak nakładania": everything except the name is fixed-width, and what is
   * left over is at least `minNamePx`. This is the addendum's actual
   * criterion — a truncated name is not an overlap.
   */
  fits: boolean;
  /** Stricter: the full `nameChars`-character name renders without truncation. */
  fitsWithoutTruncation: boolean;
  viewportPx: number;
  /** Everything that is NOT the name. */
  fixedPx: number;
  /** Space the flexible name actually gets. Negative means a real overlap. */
  nameAvailablePx: number;
  /** How many characters of the name that space shows. */
  displayableNameChars: number;
  /** The stress-case name length being judged (default 60, per the addendum). */
  targetNameChars: number;
  slackPx: number;
  breakdown: { identityFixedPx: number; viewNavigationPx: number; actionsPx: number; gapsPx: number };
}

/**
 * Model note, because the first version of this function got it wrong and the
 * test caught it: the artifact NAME is the one flexible element in the bar.
 * Reserving a fixed 60-character slot for it and declaring the bar "broken"
 * when the total exceeds 1280 px measures a layout nobody would build. A real
 * bar gives the name whatever is left and truncates with a tooltip. So the
 * overlap criterion is `fixed content + minimum name <= viewport`, and the
 * "60 characters" figure is reported separately as
 * `fitsWithoutTruncation`/`displayableNameChars` — a design input, not a pass/fail.
 */
export function estimateWorkspaceBarLayout(
  config: WorkspaceBarConfig,
  options: {
    viewportPx?: number;
    /** Defaults to the addendum's 60-character stress case, not to the actual name. */
    nameChars?: number;
    freshness?: FinanceArtifactFreshness;
    metrics?: WorkspaceBarLayoutMetrics;
  } = {}
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
  const primaryLabel = mergeFreshnessIntoPrimaryLabel(
    actions.primary.label,
    freshness,
    actions.primary.mergesFreshness
  ).pl;
  let actionsPx = labeledPx(primaryLabel);
  if (actions.secondary) actionsPx += labeledPx(actions.secondary.label.pl);
  if (actions.lifecycle) actionsPx += labeledPx(actions.lifecycle.label.pl);
  if (actions.more) actionsPx += m.iconControlPx;
  actionsPx += m.iconControlPx; // fullscreen
  for (const extra of actions.extraDirectControls) actionsPx += labeledPx(extra.label.pl);

  const gapCount = 3 /* identity internals */ + inlineViews.length + countDirectRightControls(actions) + 1;
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
