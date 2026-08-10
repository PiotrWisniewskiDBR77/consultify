/**
 * AP-09 — Finance Workspace Bar + Focus Mode contract tests.
 *
 * Split out of the former `workspaceContracts.test.ts` (AP-0 wave prep) so that
 * AP-09 and AP-11 can be worked on in parallel without file collisions.
 * Shared fixtures and the "why there is no database here" rationale live in
 * `workspaceTestFixtures.ts`.
 */
import { describe, expect, it } from 'vitest';

import { createEmptyWorkspaceState } from '../../../../types/finance/WorkspaceState.js';
import {
  DEFAULT_WORKSPACE_BAR_METRICS,
  WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS,
  WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS,
  WORKSPACE_BAR_NAME_MAX_CHARS,
  canRenameArtifact,
  countDirectRightControls,
  estimateWorkspaceBarLayout,
  mergeFreshnessIntoPrimaryLabel,
  resolveControlState,
  validateWorkspaceBarConfig,
  validateWorkspaceName,
  type WorkspaceBarConfig,
  type WorkspaceBarExtraControl,
} from '../workspaceBarContract.js';
import {
  FINANCE_MODULE_ADAPTERS,
  FINANCE_MODULE_ADAPTER_LIST,
} from '../moduleAdapters.js';
import {
  ESCAPE_KEY,
  ESCAPE_PRECEDENCE,
  FINANCE_CHROME_REGIONS,
  FINANCE_COMMAND_CONTEXT_IDS,
  FINANCE_FOCUS_MODE_COMMAND_IDS,
  FOCUS_MODE_HIDDEN_REGIONS,
  FOCUS_MODE_PRESERVED_STATE_KEYS,
  FOCUS_MODE_PRESERVED_STATE_SOURCE,
  FOCUS_MODE_RETAINED_REGIONS,
  assertFocusModePreservation,
  assertFocusModeRegionPartition,
  classifyViewport,
  createFocusModeSession,
  enterFocusMode,
  exitFocusMode,
  focusModeActiveViewId,
  handleEscapeKey,
  regionVisibilityInFocusMode,
  resolveEscapeCommand,
  resolveEscapeKey,
  shouldKeyboardRegistryHandleEscape,
  verifyEscapeRegistryCoverage,
  viewportCapability,
} from '../focusModeContract.js';
// AP-03, imported READ-ONLY: the bridge is joined by string id inside the
// contract, but a test may look at both sides at once — that is the only way
// to prove the two layers actually agree instead of asserting it in prose.
import { COMMAND_CONTEXTS } from '../../keyboard/commandTypes.js';
import { FINANCE_KEYBOARD_COMMANDS } from '../../keyboard/KeyboardCommandRegistry.js';
import {
  ORG,
  allGatesSatisfied,
  artifactRef,
  configFor,
  evaluationContext,
} from './workspaceTestFixtures.js';

// ===========================================================================
// AP-09 — Workspace Bar contract
// ===========================================================================

describe('AP-09 workspaceBarContract — the five-control budget', () => {
  it('REJECTS a configuration with six direct right-hand controls', () => {
    const base = configFor(FINANCE_MODULE_ADAPTERS.statements);
    // Sanity: the legitimate config is exactly at the limit.
    expect(countDirectRightControls(base.actions)).toBe(WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS);
    expect(validateWorkspaceBarConfig(base).ok).toBe(true);

    const sixth: WorkspaceBarExtraControl = {
      kind: 'extra',
      id: 'finance.statements.valuateModel',
      label: { key: 'x', pl: 'Wyceń model' },
      enablement: { statuses: 'any', roles: 'any', freshness: 'any', requiresGates: [] },
    };
    const overStuffed: WorkspaceBarConfig = {
      ...base,
      actions: { ...base.actions, extraDirectControls: [sixth] },
    };

    expect(countDirectRightControls(overStuffed.actions)).toBe(6);
    const result = validateWorkspaceBarConfig(overStuffed);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.map((e) => e.code)).toContain('TOO_MANY_DIRECT_RIGHT_CONTROLS');
    expect(result.errors.find((e) => e.code === 'TOO_MANY_DIRECT_RIGHT_CONTROLS')?.message).toContain('got 6');
  });

  it('counts a menu as ONE control regardless of how many items it holds', () => {
    const config = configFor(FINANCE_MODULE_ADAPTERS.statements);
    expect(config.actions.more?.items.length).toBeGreaterThan(5);
    expect(config.actions.lifecycle?.transitions.length).toBeGreaterThan(5);
    expect(countDirectRightControls(config.actions)).toBe(5);
  });

  it('rejects a duplicate control id anywhere in the bar', () => {
    const base = configFor(FINANCE_MODULE_ADAPTERS.analysis);
    const clash: WorkspaceBarConfig = {
      ...base,
      actions: {
        ...base.actions,
        secondary: base.actions.secondary
          ? { ...base.actions.secondary, id: base.actions.primary.id }
          : null,
      },
    };
    const result = validateWorkspaceBarConfig(clash);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.map((e) => e.code)).toContain('DUPLICATE_CONTROL_ID');
  });

  it('rejects an artifactType/identity mismatch and an unknown active view', () => {
    const base = configFor(FINANCE_MODULE_ADAPTERS.prediction);
    const broken: WorkspaceBarConfig = {
      ...base,
      identity: { ...base.identity, artifactRef: artifactRef({ artifactType: 'STATEMENT_PACK' }) },
      viewNavigation: { ...base.viewNavigation, activeViewId: 'nope' },
    };
    const result = validateWorkspaceBarConfig(broken);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('ARTIFACT_TYPE_MISMATCH');
    expect(codes).toContain('ACTIVE_VIEW_NOT_FOUND');
  });

  it('rejects a hand-set view placement that contradicts the view count', () => {
    const base = configFor(FINANCE_MODULE_ADAPTERS.valuation);
    expect(base.viewNavigation.placement).toBe('separate-row');
    const broken: WorkspaceBarConfig = {
      ...base,
      viewNavigation: { ...base.viewNavigation, placement: 'in-bar' },
    };
    const result = validateWorkspaceBarConfig(broken);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.map((e) => e.code)).toContain('VIEW_PLACEMENT_MISMATCH');
  });
});

describe('AP-09 workspaceBarContract — freshness merged into the primary CTA', () => {
  it('produces "Nieaktualne · Przelicz" for a stale source', () => {
    const merged = mergeFreshnessIntoPrimaryLabel(
      { key: 'finance.analysis.compute', pl: 'Przelicz' },
      'STALE_SOURCE'
    );
    expect(merged.pl).toBe('Nieaktualne · Przelicz');
    expect(merged.prefix?.key).toBe('finance.freshness.staleSource');
  });

  it('adds no prefix when the artifact is CURRENT', () => {
    const merged = mergeFreshnessIntoPrimaryLabel({ key: 'k', pl: 'Przelicz' }, 'CURRENT');
    expect(merged.pl).toBe('Przelicz');
    expect(merged.prefix).toBeNull();
  });

  it('names every non-current freshness state without relying on colour', () => {
    for (const freshness of ['NEVER_COMPUTED', 'STALE_SOURCE', 'STALE_ASSUMPTIONS', 'COMPUTE_FAILED'] as const) {
      const merged = mergeFreshnessIntoPrimaryLabel({ key: 'k', pl: 'Przelicz' }, freshness);
      expect(merged.prefix).not.toBeNull();
      expect(merged.pl).toContain(' · Przelicz');
    }
  });
});

describe('AP-09 workspaceBarContract — controlled rename (OWN-FIN-011)', () => {
  it('blocks renaming an APPROVED artifact and blocks a viewer everywhere', () => {
    expect(canRenameArtifact('DRAFT', 'preparer')).toEqual({ editable: true });
    expect(canRenameArtifact('APPROVED', 'finance_admin')).toEqual({
      editable: false,
      reason: 'STATUS_IMMUTABLE',
    });
    expect(canRenameArtifact('DRAFT', 'viewer')).toEqual({
      editable: false,
      reason: 'INSUFFICIENT_ROLE',
    });
  });

  it('validates and normalises the name', () => {
    expect(validateWorkspaceName('  Apator   FY2024 ')).toEqual({ ok: true, normalized: 'Apator FY2024' });
    expect(validateWorkspaceName('   ')).toMatchObject({ ok: false, code: 'NAME_EMPTY' });
    expect(validateWorkspaceName('a'.repeat(WORKSPACE_BAR_NAME_MAX_CHARS + 1))).toMatchObject({
      ok: false,
      code: 'NAME_TOO_LONG',
    });
    expect(validateWorkspaceName('Apator\u0007FY2024')).toMatchObject({
      ok: false,
      code: 'NAME_CONTROL_CHARS',
    });
  });

  it('propagates the rename verdict into the built config', () => {
    const approved = configFor(FINANCE_MODULE_ADAPTERS.analysis, { status: 'APPROVED', role: 'approver' });
    expect(approved.identity.name.editable).toBe(false);
    expect(approved.identity.name.editableBlockedReason).toBe('STATUS_IMMUTABLE');
  });
});

describe('AP-09 workspaceBarContract — enablement is a whitelist (fail closed)', () => {
  it('withholds a control whose named gate is absent from the context', () => {
    const state = resolveControlState(
      { statuses: 'any', roles: 'any', freshness: 'any', requiresGates: ['analysis.hasConfiguredKpis'] },
      evaluationContext({ gates: {} })
    );
    expect(state).toEqual({ available: false, reason: 'GATE', detail: 'analysis.hasConfiguredKpis' });
  });

  it('never offers Approve on an empty Draft (OWN-FIN-012)', () => {
    const adapter = FINANCE_MODULE_ADAPTERS.analysis;
    const approve = adapter.lifecycle.transitions.find((t) => t.action === 'approve');
    expect(approve).toBeDefined();
    const emptyDraft = evaluationContext({ status: 'DRAFT', role: 'approver', gates: {} });
    expect(resolveControlState(approve!.enablement, emptyDraft).available).toBe(false);
  });

  it('never offers Approve on a stale artifact even when everything else is satisfied', () => {
    const approve = FINANCE_MODULE_ADAPTERS.baselineModel.lifecycle.transitions.find(
      (t) => t.action === 'approve'
    )!;
    const stale = evaluationContext({
      status: 'IN_REVIEW',
      role: 'approver',
      freshness: 'STALE_SOURCE',
      gates: allGatesSatisfied(),
    });
    expect(resolveControlState(approve.enablement, stale)).toMatchObject({
      available: false,
      reason: 'FRESHNESS',
    });
  });
});

describe('AP-09 workspaceBarContract — 1280 px layout budget', () => {
  it('leaves room for the artifact name at 1280 px in every module (no overlap)', () => {
    const report: string[] = [];
    for (const adapter of FINANCE_MODULE_ADAPTER_LIST) {
      const config = configFor(adapter);
      const estimate = estimateWorkspaceBarLayout(config, {
        viewportPx: 1280,
        nameChars: WORKSPACE_BAR_NAME_LAYOUT_BUDGET_CHARS,
        freshness: 'STALE_SOURCE', // worst case: the freshness prefix widens the primary CTA
        metrics: DEFAULT_WORKSPACE_BAR_METRICS,
      });
      report.push(
        `${adapter.moduleId}: fixed ${estimate.fixedPx}px, name gets ${estimate.nameAvailablePx}px ` +
          `= ${estimate.displayableNameChars} chars (target ${estimate.targetNameChars})`
      );
      expect(estimate.fits, report[report.length - 1]).toBe(true);
      // Even the tightest module must still show a usable stretch of the name.
      expect(estimate.displayableNameChars, report[report.length - 1]).toBeGreaterThanOrEqual(24);
    }
    // Printed so the design step inherits real numbers instead of a bare pass.
    // eslint-disable-next-line no-console
    console.log(`[layout@1280]\n  ${report.join('\n  ')}`);
  });

  it('shows the full 60-character name only when view navigation is off the bar', () => {
    // Statements and Valuation put their navigation on its own row, so the
    // name keeps the width. The three in-bar-tab modules truncate — a real
    // consequence of the addendum's own slimming rules, recorded here rather
    // than discovered on a screenshot.
    const fullNameFits = FINANCE_MODULE_ADAPTER_LIST.filter(
      (adapter) =>
        estimateWorkspaceBarLayout(configFor(adapter), { viewportPx: 1280, freshness: 'STALE_SOURCE' })
          .fitsWithoutTruncation
    ).map((adapter) => adapter.moduleId);
    expect(fullNameFits).toEqual(['statements', 'valuation']);
  });

  it('reports a genuine overlap once extra controls are smuggled in', () => {
    const base = configFor(FINANCE_MODULE_ADAPTERS.valuation);
    expect(estimateWorkspaceBarLayout(base, { viewportPx: 1280 }).fits).toBe(true);
    const bloated: WorkspaceBarConfig = {
      ...base,
      actions: {
        ...base.actions,
        extraDirectControls: [
          {
            kind: 'extra',
            id: 'x1',
            label: { key: 'x', pl: 'Bardzo długa dodatkowa akcja modułu' },
            enablement: { statuses: 'any', roles: 'any', freshness: 'any', requiresGates: [] },
          },
          {
            kind: 'extra',
            id: 'x2',
            label: { key: 'x', pl: 'Kolejna bardzo długa dodatkowa akcja' },
            enablement: { statuses: 'any', roles: 'any', freshness: 'any', requiresGates: [] },
          },
        ],
      },
    };
    const estimate = estimateWorkspaceBarLayout(bloated, { viewportPx: 1280 });
    expect(estimate.fits).toBe(false);
    expect(estimate.slackPx).toBeLessThan(0);
  });

  it('degrades as the viewport narrows and recovers at 1920', () => {
    const config = configFor(FINANCE_MODULE_ADAPTERS.prediction, { freshness: 'STALE_SOURCE' });
    expect(estimateWorkspaceBarLayout(config, { viewportPx: 1920 }).fitsWithoutTruncation).toBe(true);
    expect(estimateWorkspaceBarLayout(config, { viewportPx: 1280 }).fits).toBe(true);
    expect(estimateWorkspaceBarLayout(config, { viewportPx: 900 }).fits).toBe(false);
  });
});
// ===========================================================================
// AP-09 — focus mode
// ===========================================================================

describe('AP-09 focusModeContract — what stays and what goes', () => {
  it('retains Menu 1, the Workspace Bar, view navigation and the workspace', () => {
    expect([...FOCUS_MODE_RETAINED_REGIONS]).toEqual(['menu1', 'workspaceBar', 'viewNavigation', 'workspace']);
    for (const region of FOCUS_MODE_RETAINED_REGIONS) {
      expect(regionVisibilityInFocusMode(region)).toBe('retained');
    }
  });

  it('hides the global topbar and the rest of the Finance chrome', () => {
    expect(FOCUS_MODE_HIDDEN_REGIONS).toContain('globalTopbar');
    expect(FOCUS_MODE_HIDDEN_REGIONS).toContain('financeModuleHeader');
    for (const region of FOCUS_MODE_HIDDEN_REGIONS) {
      expect(regionVisibilityInFocusMode(region)).toBe('hidden');
    }
  });

  it('classifies every declared chrome region exactly once', () => {
    expect(assertFocusModeRegionPartition()).toEqual({ ok: true });
    expect(FOCUS_MODE_RETAINED_REGIONS.length + FOCUS_MODE_HIDDEN_REGIONS.length).toBe(
      FINANCE_CHROME_REGIONS.length
    );
  });
});

describe('AP-09 focusModeContract — state is preserved and nothing refetches', () => {
  const baseState = createEmptyWorkspaceState({
    organizationId: ORG,
    userId: 'user-1',
    artifactRef: artifactRef(),
    sourceWorkingRevisionId: 'wr-1',
  });

  it('names the five preserved state keys the program requires, plus the active view', () => {
    expect([...FOCUS_MODE_PRESERVED_STATE_KEYS]).toEqual([
      'selection',
      'filters',
      'scroll',
      'focus',
      'draft',
      'activeView',
    ]);
    // Every key names where it actually lives — no key without a source.
    for (const key of FOCUS_MODE_PRESERVED_STATE_KEYS) {
      expect(FOCUS_MODE_PRESERVED_STATE_SOURCE[key]).toBeTruthy();
    }
    // The active view is the ONE preserved key that is not a WorkspaceState
    // field — it comes from the bar contract, which is why the session has to
    // carry it explicitly.
    expect(FOCUS_MODE_PRESERVED_STATE_SOURCE.activeView).toContain(
      'WorkspaceBarViewNavigation.activeViewId'
    );
  });

  it('carries WorkspaceState through enter+exit BY REFERENCE (so it cannot have refetched)', () => {
    const session = createFocusModeSession(baseState);
    const entered = enterFocusMode(session, {
      trigger: 'toggle-control',
      restoreFocusToControlId: 'finance.statements.fullscreen',
    });
    expect(entered.session.active).toBe(true);
    expect(entered.refetched).toBe(false);
    expect(entered.session.workspaceState).toBe(baseState);

    const exited = exitFocusMode(entered.session, { trigger: 'escape-key' });
    expect(exited.session.active).toBe(false);
    expect(exited.refetched).toBe(false);
    expect(exited.session.workspaceState).toBe(baseState);
  });

  it('emits only visibility/focus/announce effects — never a data effect', () => {
    const session = createFocusModeSession(baseState);
    const entered = enterFocusMode(session, { trigger: 'toggle-control', restoreFocusToControlId: 'btn' });
    expect(entered.effects.every((e) => ['hide-region', 'show-region', 'move-focus', 'announce'].includes(e.kind))).toBe(
      true
    );
    expect(entered.effects.filter((e) => e.kind === 'hide-region')).toHaveLength(
      FOCUS_MODE_HIDDEN_REGIONS.length
    );
  });

  it('restores keyboard focus to the control that opened focus mode (A11y)', () => {
    const session = createFocusModeSession(baseState);
    const entered = enterFocusMode(session, {
      trigger: 'toggle-control',
      restoreFocusToControlId: 'finance.analysis.fullscreen',
    });
    const exited = exitFocusMode(entered.session, { trigger: 'escape-key' });
    const moveFocus = exited.effects.find((e) => e.kind === 'move-focus');
    expect(moveFocus).toMatchObject({ kind: 'move-focus', controlId: 'finance.analysis.fullscreen' });
  });

  it('keeps the open view across enter AND exit (OWN-FIN-004 "stan zakładki")', () => {
    // A real, non-first view of a real module: Valuation's stepper, step 3.
    const adapter = FINANCE_MODULE_ADAPTERS.valuation;
    const openView = adapter.views[2];
    expect(openView).toBeDefined();
    const config = configFor(adapter);
    const session = createFocusModeSession(baseState, { activeViewId: openView.id });

    const entered = enterFocusMode(session, {
      trigger: 'toggle-control',
      restoreFocusToControlId: 'finance.valuation.fullscreen',
    });
    expect(entered.session.activeViewId).toBe(openView.id);
    expect(assertFocusModePreservation(session, entered.session)).toEqual({ ok: true });

    const exited = exitFocusMode(entered.session, { trigger: 'escape-key' });
    expect(exited.session.activeViewId).toBe(openView.id);
    expect(assertFocusModePreservation(entered.session, exited.session)).toEqual({ ok: true });

    // And the bar renders that view, rather than re-deriving the adapter default.
    expect(focusModeActiveViewId(exited.session, config.viewNavigation.views[0].id)).toBe(openView.id);
    expect(openView.id).not.toBe(config.viewNavigation.views[0].id);
  });

  it('DETECTS a toggle that silently reset the open view (negative control)', () => {
    const session = createFocusModeSession(baseState, { activeViewId: 'sensitivity' });
    const entered = enterFocusMode(session, { trigger: 'toggle-control', restoreFocusToControlId: null });
    // Simulate the bug this key exists to catch: focus mode re-mounts the
    // workspace and the view navigation falls back to view #1.
    const drifted = { ...entered.session, activeViewId: 'source' };
    const check = assertFocusModePreservation(session, drifted);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error('unreachable');
    expect(check.violations.map((v) => v.key)).toEqual(['activeView']);
    expect(check.violations[0].detail).toContain('sensitivity');
  });

  it('DETECTS a toggle that rebuilt WorkspaceState instead of carrying it (negative control)', () => {
    const session = createFocusModeSession(baseState, { activeViewId: 'source' });
    const entered = enterFocusMode(session, { trigger: 'toggle-control', restoreFocusToControlId: null });
    // Structurally identical, different object — i.e. something refetched.
    const rebuilt = { ...entered.session, workspaceState: { ...baseState } };
    const check = assertFocusModePreservation(session, rebuilt);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error('unreachable');
    expect(check.violations.map((v) => v.key)).toEqual(['selection', 'filters', 'scroll', 'draft']);
  });

  it('defaults activeViewId to null for a caller that has not adopted the option (additive change)', () => {
    const session = createFocusModeSession(baseState);
    expect(session.activeViewId).toBeNull();
    expect(focusModeActiveViewId(session, 'pnl')).toBe('pnl');
  });

  it('is a no-op when already in the requested state', () => {
    const session = createFocusModeSession(baseState);
    expect(exitFocusMode(session, { trigger: 'escape-key' }).noop).toBe(true);
    const entered = enterFocusMode(session, { trigger: 'toggle-control', restoreFocusToControlId: null });
    expect(enterFocusMode(entered.session, { trigger: 'toggle-control', restoreFocusToControlId: null }).noop).toBe(
      true
    );
  });
});

describe('AP-09 focusModeContract — Escape precedence', () => {
  const ctx = {
    modalOpen: false,
    commandPaletteOpen: false,
    popoverOpen: false,
    cellEditing: false,
    focusModeActive: false,
  };

  it('exits focus mode when nothing else claims Escape', () => {
    expect(resolveEscapeKey({ ...ctx, focusModeActive: true })).toBe('focus-mode');
  });

  it('lets cell editing, popovers, the palette and modals win first', () => {
    expect(resolveEscapeKey({ ...ctx, focusModeActive: true, cellEditing: true })).toBe('cell-editing');
    expect(resolveEscapeKey({ ...ctx, focusModeActive: true, cellEditing: true, popoverOpen: true })).toBe(
      'popover'
    );
    expect(
      resolveEscapeKey({ ...ctx, focusModeActive: true, popoverOpen: true, commandPaletteOpen: true })
    ).toBe('command-palette');
    expect(resolveEscapeKey({ ...ctx, focusModeActive: true, modalOpen: true, commandPaletteOpen: true })).toBe(
      'modal'
    );
  });

  it('consumes nothing when no consumer is active', () => {
    expect(resolveEscapeKey(ctx)).toBe('none');
    expect(ESCAPE_PRECEDENCE[ESCAPE_PRECEDENCE.length - 1]).toBe('focus-mode');
  });
});

describe('AP-09 focusModeContract — the Escape bridge to AP-03', () => {
  const ctx = {
    modalOpen: false,
    commandPaletteOpen: false,
    popoverOpen: false,
    cellEditing: false,
    focusModeActive: false,
  };

  it('keeps the keyboard registry AWAY from Escape while an overlay is open', () => {
    for (const overlay of ['modalOpen', 'commandPaletteOpen', 'popoverOpen'] as const) {
      const resolution = resolveEscapeCommand({ ...ctx, focusModeActive: true, [overlay]: true });
      expect(resolution.owner).toBe('ui-overlay');
      expect(resolution.keyboardCommandId).toBeNull();
      expect(resolution.keyboardCommandContext).toBeNull();
      expect(resolution.dispatchViaKeyboardRegistry).toBe(false);
      expect(shouldKeyboardRegistryHandleEscape({ ...ctx, focusModeActive: true, [overlay]: true })).toBe(false);
    }
  });

  it('routes Escape to the AP-03 command id + context for each keyboard-owned consumer', () => {
    const editing = resolveEscapeCommand({ ...ctx, focusModeActive: true, cellEditing: true });
    expect(editing.owner).toBe('AP-03-keyboard');
    expect(editing.keyboardCommandId).toBe(FINANCE_FOCUS_MODE_COMMAND_IDS.cancelCellEdit);
    expect(editing.keyboardCommandContext).toBe('cell-editing');
    expect(editing.dispatchViaKeyboardRegistry).toBe(true);

    const focus = resolveEscapeCommand({ ...ctx, focusModeActive: true });
    expect(focus.owner).toBe('AP-09-focus-mode');
    expect(focus.keyboardCommandId).toBe(FINANCE_FOCUS_MODE_COMMAND_IDS.exit);
    expect(focus.keyboardCommandContext).toBe('grid-focused');
    expect(focus.dispatchViaKeyboardRegistry).toBe(true);

    const nobody = resolveEscapeCommand(ctx);
    expect(nobody).toMatchObject({ consumer: 'none', owner: 'none', dispatchViaKeyboardRegistry: false });
  });

  it('mirrors AP-03 command contexts as DATA that has not drifted from the real union', () => {
    // The ids are joined by string on purpose (no import from `keyboard/**`
    // in the contract itself) — this test is the tripwire that the mirror
    // still matches the thing it mirrors.
    expect([...FINANCE_COMMAND_CONTEXT_IDS]).toEqual([...COMMAND_CONTEXTS]);
  });

  it('exits focus mode through ONE entry point, with the real state transition', () => {
    const session = createFocusModeSession(
      createEmptyWorkspaceState({
        organizationId: ORG,
        userId: 'user-1',
        artifactRef: artifactRef(),
        sourceWorkingRevisionId: 'wr-1',
      }),
      { activeViewId: 'assumptions' }
    );
    const entered = enterFocusMode(session, {
      trigger: 'toggle-control',
      restoreFocusToControlId: 'finance.valuation.fullscreen',
    }).session;

    // Overlay open -> AP-09 does NOT touch the session.
    const withPopover = handleEscapeKey(entered, { ...ctx, popoverOpen: true });
    expect(withPopover.toggle).toBeNull();
    expect(withPopover.session).toBe(entered);
    expect(withPopover.session.active).toBe(true);

    // Nothing else claims it -> focus mode exits, state intact.
    const exited = handleEscapeKey(entered, ctx);
    expect(exited.resolution.consumer).toBe('focus-mode');
    expect(exited.toggle?.refetched).toBe(false);
    expect(exited.session.active).toBe(false);
    expect(assertFocusModePreservation(entered, exited.session)).toEqual({ ok: true });

    // Escape on an inactive session is a no-op, not a spurious exit.
    const idle = handleEscapeKey(exited.session, ctx);
    expect(idle.resolution.consumer).toBe('none');
    expect(idle.toggle).toBeNull();
  });

  it('DETECTS a registry that is missing a promised Escape command (negative control)', () => {
    const complete = [
      { commandId: FINANCE_FOCUS_MODE_COMMAND_IDS.cancelCellEdit, context: 'cell-editing' as const },
      { commandId: FINANCE_FOCUS_MODE_COMMAND_IDS.exit, context: 'grid-focused' as const },
    ];
    expect(verifyEscapeRegistryCoverage(complete)).toEqual({ ok: true });

    // Right command, WRONG context — the failure mode a naive "is the id
    // registered anywhere" check would wave through.
    const wrongContext = verifyEscapeRegistryCoverage([
      { commandId: FINANCE_FOCUS_MODE_COMMAND_IDS.cancelCellEdit, context: 'cell-editing' },
      { commandId: FINANCE_FOCUS_MODE_COMMAND_IDS.exit, context: 'global' },
    ]);
    expect(wrongContext.ok).toBe(false);
    if (wrongContext.ok) throw new Error('unreachable');
    expect(wrongContext.missing).toEqual([
      { consumer: 'focus-mode', commandId: 'workspace.exitFocusMode', context: 'grid-focused' },
    ]);

    expect(verifyEscapeRegistryCoverage([]).ok).toBe(false);
  });

  it('reports the REAL AP-03 registry’s Escape coverage (no mock)', () => {
    const escapeRegistrations = FINANCE_KEYBOARD_COMMANDS.filter(
      (command) => command.combo.key === ESCAPE_KEY
    ).map((command) => ({ commandId: command.id, context: command.context }));

    // AP-03 has always owned Escape in `cell-editing`; that half must hold today.
    expect(escapeRegistrations).toContainEqual({
      commandId: FINANCE_FOCUS_MODE_COMMAND_IDS.cancelCellEdit,
      context: 'cell-editing',
    });

    const coverage = verifyEscapeRegistryCoverage(escapeRegistrations);
    const registryOwnsFocusModeExit = escapeRegistrations.some(
      (r) => r.commandId === FINANCE_FOCUS_MODE_COMMAND_IDS.exit && r.context === 'grid-focused'
    );
    if (registryOwnsFocusModeExit) {
      // AP-03's workspace-level commands have landed in this tree: the bridge
      // is closed end to end.
      expect(coverage).toEqual({ ok: true });
    } else {
      // They have not landed yet. This is the honest current state, recorded
      // as an ASSERTED gap rather than a passing test that proves nothing:
      // the only thing allowed to be missing is the focus-mode exit command.
      expect(coverage.ok).toBe(false);
      if (coverage.ok) throw new Error('unreachable');
      expect(coverage.missing).toEqual([
        { consumer: 'focus-mode', commandId: 'workspace.exitFocusMode', context: 'grid-focused' },
      ]);
    }
  });
});

describe('AP-09 focusModeContract — viewport policy (DEC-FIN-008)', () => {
  it('classifies the acceptance widths', () => {
    expect(classifyViewport(1280)).toBe('desktop');
    expect(classifyViewport(1024)).toBe('desktop');
    expect(classifyViewport(800)).toBe('tablet');
    expect(classifyViewport(390)).toBe('mobile');
  });

  it('fails closed on mobile: no edit, no compute, no review', () => {
    expect(viewportCapability(390)).toEqual({
      edit: false,
      compute: false,
      review: false,
      read: false,
      focusMode: false,
    });
    expect(viewportCapability(800).review).toBe(true);
    expect(viewportCapability(800).edit).toBe(false);
    expect(viewportCapability(1440).edit).toBe(true);
  });
});