/**
 * AP-03 — Command availability: MAY this command run right now, and if not,
 * WHAT does the user get told?
 *
 * ===========================================================================
 * REUSE, not a second permission model.
 * ===========================================================================
 * AP-09's `workspaceBarContract.ts` already answers "may this control be
 * used" for the mouse-driven half of the same product, with a model this file
 * imports rather than re-implements:
 *
 *   - `WorkspaceBarEnablement`      — a fail-closed WHITELIST of statuses,
 *                                     roles, freshness states and named
 *                                     completeness gates ('any' must be
 *                                     written explicitly; an unknown gate is
 *                                     `false`).
 *   - `WorkspaceBarEvaluationContext` — the facts to evaluate it against.
 *   - `resolveControlState`         — the evaluator, returning
 *                                     `{ available: false, reason, detail }`.
 *   - `WorkspaceBarLabel`           — the i18n-key + Polish-default label shape.
 *
 * A keyboard shortcut for `Przelicz` and the Workspace Bar button for
 * `Przelicz` must never disagree about who may press them, and the only
 * structural way to guarantee that is to evaluate ONE model. So
 * `KeyboardCommandAvailability` EXTENDS `WorkspaceBarEnablement` and
 * `canExecuteCommand` DELEGATES to `resolveControlState`; everything below is
 * the delta, and each piece of delta is justified where it is declared.
 *
 * THE DELTA, and why each part could not be satisfied by reuse alone:
 *
 * 1. `artifactTypes` — the bar is built per module by an adapter that already
 *    knows its artifact type, so the bar never needs to ask. A keyboard
 *    registry is ONE global table shared by all five workspaces, so it does
 *    need to: `Mod+Enter` (Compute) is meaningless on a REPORT_EXPORT. Kept
 *    as a whitelist with an explicit `'any'`, exactly like the fields it sits
 *    next to, so the fail-closed discipline is not diluted.
 *
 * 2. `requiresViewportCapability` — AP-09 already decided this
 *    (`focusModeContract.ts`'s `FINANCE_VIEWPORT_CAPABILITIES`: mobile is
 *    fail-closed for edit/compute/review), but nothing connected that
 *    decision to the key handler. A physical keyboard on a tablet would
 *    otherwise walk straight past a policy that already exists. This is
 *    reuse of AP-09's table, not a new policy.
 *
 * 3. A DISPLAYABLE reason. `resolveControlState` returns a CODE plus a raw
 *    detail (`{ reason: 'ROLE', detail: 'viewer' }`). A bar button can live
 *    with that because it is simply greyed out and sits next to its own
 *    label; a keyboard shortcut has no visible surface at all — the user
 *    presses a key, nothing happens, and unless the application says why, the
 *    feature is indistinguishable from a bug. So every code is mapped to a
 *    `WorkspaceBarLabel` here, with the enum values translated to Polish
 *    rather than leaked raw (`APPROVED` -> `Zatwierdzone`).
 *
 * SCOPE: pure logic, no DOM, no DB — same discipline as the rest of the
 * package. Every import below resolves to a pure contract module.
 */

import type { FinanceArtifactType } from '../../../types/finance/ArtifactRef.js';
import type { FinanceArtifactFreshness } from '../../../types/finance/financeValueSemantics.js';
import type { BusinessVersionStatus, FinanceRole } from '../canonical/lifecycleService.js';
import { viewportCapability, type ViewportCapability } from '../workspace/focusModeContract.js';
import {
  resolveControlState,
  type WorkspaceBarEnablement,
  type WorkspaceBarEvaluationContext,
  type WorkspaceBarLabel,
} from '../workspace/workspaceBarContract.js';

// ---------------------------------------------------------------------------
// The availability declaration attached to every command.
// ---------------------------------------------------------------------------

/** Which `ViewportCapability` flag the command needs — the keys of AP-09's own capability table. */
export type ViewportCapabilityKey = keyof ViewportCapability;

export interface KeyboardCommandAvailability extends WorkspaceBarEnablement {
  /** Artifact types the command applies to. `'any'` must be explicit — same whitelist discipline as the inherited fields. */
  artifactTypes: readonly FinanceArtifactType[] | 'any';
  /** `null` = no device requirement (navigation, copy, palette). Otherwise the capability that must be `true` for the current viewport class. */
  requiresViewportCapability: ViewportCapabilityKey | null;
}

export function commandAvailability(partial: Partial<KeyboardCommandAvailability>): KeyboardCommandAvailability {
  return {
    statuses: partial.statuses ?? 'any',
    roles: partial.roles ?? 'any',
    freshness: partial.freshness ?? 'any',
    requiresGates: partial.requiresGates ?? [],
    artifactTypes: partial.artifactTypes ?? 'any',
    requiresViewportCapability: partial.requiresViewportCapability ?? null,
  };
}

/** Mirrors AP-09's `ENABLEMENT_ALWAYS`. Legitimate only for commands that must never be trapped behind a policy — `grid.cancelEdit` above all: a blocked Escape would leave the user stuck inside a cell editor. */
export const AVAILABILITY_ALWAYS: KeyboardCommandAvailability = commandAvailability({});

// Role bands, named exactly as `moduleAdapters.ts` (AP-10) names them, so the
// two files can be diffed against each other.
export const PREPARER_PLUS: readonly FinanceRole[] = ['preparer', 'reviewer', 'approver', 'finance_admin'];
export const REVIEWER_PLUS: readonly FinanceRole[] = ['reviewer', 'approver', 'finance_admin'];

/** Same two statuses `moduleAdapters.ts` calls `EDITABLE_STATUSES`. Content is immutable everywhere else (DEC-FIN-007). */
export const EDITABLE_STATUSES: readonly BusinessVersionStatus[] = ['DRAFT', 'NEEDS_CHANGES'];

/** Read-only commands: navigation, copy, find, compare, the palette. Any role including `viewer`; blocked only where the device cannot even read. */
export const AVAILABILITY_READ: KeyboardCommandAvailability = commandAvailability({
  requiresViewportCapability: 'read',
});

/** Anything that produces an `Operation`: paste, clear, undo/redo, confirming an edit, checkpointing. */
export const AVAILABILITY_EDIT: KeyboardCommandAvailability = commandAvailability({
  statuses: EDITABLE_STATUSES,
  roles: PREPARER_PLUS,
  requiresViewportCapability: 'edit',
});

/** Compute: same who/when as editing, but gated on the device's `compute` capability (AP-09 disables it on mobile independently of `edit`). */
export const AVAILABILITY_COMPUTE: KeyboardCommandAvailability = commandAvailability({
  statuses: EDITABLE_STATUSES,
  roles: PREPARER_PLUS,
  requiresViewportCapability: 'compute',
});

/** Commenting is a review activity: allowed in every status (commenting on an Approved artifact is legitimate), denied to `viewer`, gated on `review`. */
export const AVAILABILITY_COMMENT: KeyboardCommandAvailability = commandAvailability({
  roles: PREPARER_PLUS,
  requiresViewportCapability: 'review',
});

/** Opening the lifecycle menu — the transitions inside it carry their own AP-09 enablement, so this only filters out roles that have no transitions at all. */
export const AVAILABILITY_LIFECYCLE: KeyboardCommandAvailability = commandAvailability({
  roles: PREPARER_PLUS,
  requiresViewportCapability: 'review',
});

/** Focus mode — AP-09 already says mobile does not get it. */
export const AVAILABILITY_FOCUS_MODE: KeyboardCommandAvailability = commandAvailability({
  requiresViewportCapability: 'focusMode',
});

// ---------------------------------------------------------------------------
// Evaluation.
// ---------------------------------------------------------------------------

export interface CommandEvaluationContext extends WorkspaceBarEvaluationContext {
  artifactType: FinanceArtifactType;
  /** Current viewport width; classified through AP-09's `classifyViewport`/`FINANCE_VIEWPORT_CAPABILITIES`. */
  viewportWidthPx: number;
  /**
   * Readable names for the module's own completeness gates, e.g.
   * `{ 'statements.mappingComplete': { key: '...', pl: 'Mapowanie źródeł' } }`.
   * Optional: an unmapped gate degrades to its machine name inside an
   * otherwise-readable sentence, which is still far better than surfacing a
   * bare `GATE` code — but a module that wants a good message supplies this.
   */
  gateLabels?: Readonly<Record<string, WorkspaceBarLabel>>;
}

/** AP-09's four codes, widened by the two dimensions the keyboard layer adds. */
export type CommandUnavailableReason = 'STATUS' | 'ROLE' | 'FRESHNESS' | 'GATE' | 'ARTIFACT_TYPE' | 'VIEWPORT';

export type CommandExecutability =
  | { canExecute: true }
  | {
      canExecute: false;
      /** Machine code — for telemetry and tests. */
      reason: CommandUnavailableReason;
      /** Raw offending value (`'APPROVED'`, `'viewer'`, a gate name) — for telemetry and tests. */
      detail: string;
      /** What a human is shown. THE gap this file closes: AP-09 returns the code only. */
      message: WorkspaceBarLabel;
    };

// --- Polish renderings of the enum values -----------------------------------
// Leaking `APPROVED`/`viewer`/`STALE_SOURCE` into a user-facing sentence is
// how a "reason" ends up being no more readable than the code it replaced.

const STATUS_PL: Readonly<Record<BusinessVersionStatus, string>> = {
  DRAFT: 'Wersja robocza',
  READY_FOR_REVIEW: 'Gotowe do przeglądu',
  IN_REVIEW: 'W przeglądzie',
  APPROVED: 'Zatwierdzone',
  NEEDS_CHANGES: 'Wymaga zmian',
  SUPERSEDED: 'Zastąpione',
  ARCHIVED: 'Zarchiwizowane',
  INVALIDATED: 'Unieważnione',
};

const ROLE_PL: Readonly<Record<FinanceRole, string>> = {
  viewer: 'Podgląd',
  preparer: 'Przygotowujący',
  reviewer: 'Recenzent',
  approver: 'Zatwierdzający',
  finance_admin: 'Administrator finansów',
};

const FRESHNESS_PL: Readonly<Record<FinanceArtifactFreshness, string>> = {
  CURRENT: 'Aktualne',
  NEVER_COMPUTED: 'Nie przeliczono',
  STALE_SOURCE: 'Nieaktualne (zmienione źródła)',
  STALE_ASSUMPTIONS: 'Nieaktualne (zmienione założenia)',
  COMPUTE_FAILED: 'Błąd przeliczenia',
};

const ARTIFACT_TYPE_PL: Readonly<Record<FinanceArtifactType, string>> = {
  STATEMENT_PACK: 'Pakiet sprawozdań',
  HISTORICAL_ANALYSIS: 'Analiza historyczna',
  BASELINE_MODEL: 'Model bazowy',
  PREDICTION_SCENARIO: 'Scenariusz prognozy',
  VALUATION_CASE: 'Wycena',
  REPORT_EXPORT: 'Eksport raportu',
};

const VIEWPORT_CAPABILITY_PL: Readonly<Record<ViewportCapabilityKey, string>> = {
  edit: 'edycja',
  compute: 'przeliczanie',
  review: 'przegląd',
  read: 'odczyt',
  focusMode: 'tryb pełnego obszaru roboczego',
};

export function describeCommandUnavailability(
  reason: CommandUnavailableReason,
  detail: string,
  ctx: Pick<CommandEvaluationContext, 'gateLabels'>
): WorkspaceBarLabel {
  switch (reason) {
    case 'STATUS':
      return {
        key: 'finance.keyboard.blocked.status',
        pl: `Niedostępne dla wersji w statusie „${STATUS_PL[detail as BusinessVersionStatus] ?? detail}".`,
      };
    case 'ROLE':
      return {
        key: 'finance.keyboard.blocked.role',
        pl: `Twoja rola (${ROLE_PL[detail as FinanceRole] ?? detail}) nie pozwala na tę operację.`,
      };
    case 'FRESHNESS':
      return {
        key: 'finance.keyboard.blocked.freshness',
        pl: `Niedostępne przy stanie danych „${FRESHNESS_PL[detail as FinanceArtifactFreshness] ?? detail}".`,
      };
    case 'GATE': {
      const label = ctx.gateLabels?.[detail];
      return {
        key: 'finance.keyboard.blocked.gate',
        pl: label
          ? `Najpierw ukończ krok: ${label.pl}.`
          : `Najpierw ukończ wymagany krok konfiguracji (${detail}).`,
      };
    }
    case 'ARTIFACT_TYPE':
      return {
        key: 'finance.keyboard.blocked.artifactType',
        pl: `Ta komenda nie dotyczy artefaktu „${ARTIFACT_TYPE_PL[detail as FinanceArtifactType] ?? detail}".`,
      };
    case 'VIEWPORT':
      return {
        key: 'finance.keyboard.blocked.viewport',
        pl: `Na tym urządzeniu ${VIEWPORT_CAPABILITY_PL[detail as ViewportCapabilityKey] ?? detail} jest wyłączona — otwórz artefakt na komputerze.`,
      };
    default: {
      const exhaustive: never = reason;
      throw new Error(`describeCommandUnavailability: unhandled reason ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * The whole question, answered once.
 *
 * Order of checks is deliberate and is what decides WHICH reason the user
 * sees when several apply: the most fundamental "this does not apply here at
 * all" first (wrong artifact, wrong device), then AP-09's own status -> role
 * -> freshness -> gate order, unchanged, because a user who is told "your role
 * does not allow this" should get the same sentence whether they clicked the
 * button or pressed the key.
 */
export function evaluateCommandAvailability(
  availability: KeyboardCommandAvailability,
  ctx: CommandEvaluationContext
): CommandExecutability {
  if (availability.artifactTypes !== 'any' && !availability.artifactTypes.includes(ctx.artifactType)) {
    return {
      canExecute: false,
      reason: 'ARTIFACT_TYPE',
      detail: ctx.artifactType,
      message: describeCommandUnavailability('ARTIFACT_TYPE', ctx.artifactType, ctx),
    };
  }

  if (availability.requiresViewportCapability !== null) {
    const capability = availability.requiresViewportCapability;
    if (!viewportCapability(ctx.viewportWidthPx)[capability]) {
      return {
        canExecute: false,
        reason: 'VIEWPORT',
        detail: capability,
        message: describeCommandUnavailability('VIEWPORT', capability, ctx),
      };
    }
  }

  // Delegation — NOT a re-implementation. Status/role/freshness/gate semantics
  // (including "an absent gate is not satisfied") live in AP-09 alone.
  const state = resolveControlState(availability, ctx);
  if (state.available) return { canExecute: true };
  return {
    canExecute: false,
    reason: state.reason,
    detail: state.detail,
    message: describeCommandUnavailability(state.reason, state.detail, ctx),
  };
}
