/**
 * AP-09 / AP-10 / AP-11 — Finance shared workspace layer tests.
 *
 * WHY THERE IS NO DATABASE HERE — a deliberate choice, documented because
 * `MEMORY.md`'s standing lesson is that "green tests" over a mock prove
 * nothing about a real system:
 *
 *   Everything under `server/src/services/finance/workspace/` is a CONTRACT:
 *   declarative configuration (which controls a module may put in the bar,
 *   which views it has) plus pure transformations over data the caller
 *   supplies. Not one function in this package opens a connection, and the
 *   only I/O-shaped thing — `loadLineageNavigator` — takes the lineage service
 *   as an injected `LineageServicePort` precisely so it can be exercised
 *   against mocked `getAncestors`/`getDescendants` results.
 *
 *   The DB-backed half of lineage is already tested where it belongs and
 *   against a real Postgres: `canonicalServices.pg.test.ts` covers
 *   `insertEdge`/`getAncestors`/`getDescendants` including the cycle trigger,
 *   and `lineageService.test.ts` covers the pure rank mirror. Re-testing those
 *   here would duplicate coverage without adding it. What a database CANNOT
 *   tell us is whether a module's bar has six controls — that is exactly what
 *   this file tests.
 *
 *   Where a mock could hide drift, a real cross-check is used instead: the
 *   stage-rank test below imports the genuine `lineageService.stageRank` and
 *   asserts this package's independently-derived order matches it, so the two
 *   cannot silently diverge.
 *
 * Same "pure core logic, no DB, no React" discipline as `operationStack.test.ts`
 * (AP-04), `KeyboardCommandRegistry.test.ts` (AP-03) and
 * `lineageService.test.ts` (WP-B03).
 */
import { describe, expect, it } from 'vitest';

import { FinanceArtifactTypeValues, type ArtifactRef } from '../../../../types/finance/ArtifactRef.js';
import { createEmptyWorkspaceState } from '../../../../types/finance/WorkspaceState.js';
import { stageRank } from '../../canonical/lineageService.js';
import type { LineageEdgeRow } from '../../canonical/lineageService.js';
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
  resolveViewNavigationPlacement,
  validateWorkspaceBarConfig,
  validateWorkspaceName,
  type WorkspaceBarConfig,
  type WorkspaceBarEvaluationContext,
  type WorkspaceBarExtraControl,
} from '../workspaceBarContract.js';
import {
  FINANCE_MODULE_ADAPTERS,
  FINANCE_MODULE_ADAPTER_LIST,
  buildWorkspaceBarConfig,
  resolvePrimaryAction,
  validateModuleAdapter,
  type FinanceModuleAdapter,
} from '../moduleAdapters.js';
import {
  ESCAPE_PRECEDENCE,
  FINANCE_CHROME_REGIONS,
  FOCUS_MODE_HIDDEN_REGIONS,
  FOCUS_MODE_PRESERVED_STATE_KEYS,
  FOCUS_MODE_RETAINED_REGIONS,
  assertFocusModeRegionPartition,
  classifyViewport,
  createFocusModeSession,
  enterFocusMode,
  exitFocusMode,
  regionVisibilityInFocusMode,
  resolveEscapeKey,
  viewportCapability,
} from '../focusModeContract.js';
import {
  LINEAGE_FULL_GRAPH_VIEW,
  allowedDownstreamCreations,
  buildLineageTrail,
  buildRelatedPanel,
  computeDepths,
  isOrphaned,
  lineageStageRank,
  loadLineageNavigator,
  type LineageMetadataResolver,
  type LineageNodeMetadata,
  type LineageServicePort,
  type LineageTrailNode,
} from '../lineageNavigatorContract.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG = 'org-test';

function artifactRef(overrides: Partial<ArtifactRef> = {}): ArtifactRef {
  return {
    organizationId: ORG,
    artifactId: 'artifact-1',
    businessVersionId: 'version-1',
    naturalKey: null,
    artifactType: 'STATEMENT_PACK',
    ...overrides,
  } as ArtifactRef;
}

function evaluationContext(
  overrides: Partial<WorkspaceBarEvaluationContext> = {}
): WorkspaceBarEvaluationContext {
  return {
    status: 'DRAFT',
    role: 'preparer',
    freshness: 'CURRENT',
    gates: {},
    ...overrides,
  };
}

/** All completeness gates satisfied — the "fully configured artifact" case. */
function allGatesSatisfied(): Record<string, boolean> {
  return {
    'statements.mappingComplete': true,
    'statements.checksPassed': true,
    'analysis.hasConfiguredKpis': true,
    'analysis.computed': true,
    'baselineModel.assumptionsConfirmed': true,
    'baselineModel.tieOutsPassed': true,
    'prediction.preflightResolved': true,
    'prediction.computed': true,
    'valuation.methodsConfigured': true,
    'valuation.computed': true,
  };
}

function configFor(
  adapter: FinanceModuleAdapter,
  ctxOverrides: Partial<WorkspaceBarEvaluationContext> = {}
): WorkspaceBarConfig {
  const context = evaluationContext({ gates: allGatesSatisfied(), ...ctxOverrides });
  return buildWorkspaceBarConfig({
    adapter,
    artifactRef: artifactRef({ artifactType: adapter.artifactType }),
    name: 'Apator — sprawozdanie skonsolidowane FY2024',
    versionLabel: 'v3',
    hasUncommittedWorkingRevision: false,
    activeViewId: adapter.views[0].id,
    context,
  });
}

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
// AP-10 — module adapters
// ===========================================================================

describe('AP-10 moduleAdapters — all five adapters are valid', () => {
  it('exposes exactly the five Finance modules', () => {
    expect(FINANCE_MODULE_ADAPTER_LIST.map((a) => a.moduleId)).toEqual([
      'statements',
      'analysis',
      'baselineModel',
      'prediction',
      'valuation',
    ]);
  });

  it.each(FINANCE_MODULE_ADAPTER_LIST.map((a) => [a.moduleId, a] as const))(
    '%s passes validateModuleAdapter',
    (_moduleId, adapter) => {
      const result = validateModuleAdapter(adapter);
      expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
    }
  );

  it.each(FINANCE_MODULE_ADAPTER_LIST.map((a) => [a.moduleId, a] as const))(
    '%s builds a Workspace Bar config that passes validateWorkspaceBarConfig',
    (_moduleId, adapter) => {
      const result = validateWorkspaceBarConfig(configFor(adapter));
      expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
    }
  );

  it.each(FINANCE_MODULE_ADAPTER_LIST.map((a) => [a.moduleId, a] as const))(
    '%s stays valid for a fresh, ungated Draft (the empty-artifact case)',
    (_moduleId, adapter) => {
      const config = buildWorkspaceBarConfig({
        adapter,
        artifactRef: artifactRef({ artifactType: adapter.artifactType }),
        name: 'Nowy dokument',
        versionLabel: 'v1',
        hasUncommittedWorkingRevision: false,
        activeViewId: adapter.views[0].id,
        context: evaluationContext({ status: 'DRAFT', role: 'preparer', freshness: 'NEVER_COMPUTED' }),
      });
      const result = validateWorkspaceBarConfig(config);
      expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
      expect(countDirectRightControls(config.actions)).toBeLessThanOrEqual(
        WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS
      );
    }
  );
});

describe('AP-10 moduleAdapters — owner-mandated view counts (regression)', () => {
  it('Baseline Model has EXACTLY two views: Założenia and Wyliczenia (OWN-FIN-017)', () => {
    const adapter = FINANCE_MODULE_ADAPTERS.baselineModel;
    expect(adapter.views).toHaveLength(2);
    expect(adapter.views.map((v) => v.label.pl)).toEqual(['Założenia', 'Wyliczenia']);
    expect(adapter.viewsMandate).toMatchObject({ source: 'OWNER_MANDATED', exactCount: 2 });
  });

  it('Prediction has EXACTLY two views: Budowa założeń and Modele/Wyniki (OWN-FIN-019)', () => {
    const adapter = FINANCE_MODULE_ADAPTERS.prediction;
    expect(adapter.views).toHaveLength(2);
    expect(adapter.views.map((v) => v.label.pl)).toEqual(['Budowa założeń', 'Modele/Wyniki']);
    expect(adapter.viewsMandate).toMatchObject({ source: 'OWNER_MANDATED', exactCount: 2 });
  });

  it('Valuation has EXACTLY seven steps in the mandated order (OWN-FIN-021)', () => {
    const adapter = FINANCE_MODULE_ADAPTERS.valuation;
    expect(adapter.views).toHaveLength(7);
    expect(adapter.views.map((v) => v.id)).toEqual([
      'source',
      'assumptions',
      'methodsWeights',
      'results',
      'sensitivity',
      'advisor',
      'export',
    ]);
    expect(adapter.viewNavigationKind).toBe('stepper');
    expect(adapter.viewsMandate).toMatchObject({ source: 'OWNER_MANDATED', exactCount: 7 });
  });

  it('Statements shows P&L / BS / CF', () => {
    expect(FINANCE_MODULE_ADAPTERS.statements.views.map((v) => v.id)).toEqual(['pnl', 'bs', 'cf']);
  });

  it('rejects an adapter that drifts away from its own mandate', () => {
    const drifted: FinanceModuleAdapter = {
      ...FINANCE_MODULE_ADAPTERS.baselineModel,
      views: [
        ...FINANCE_MODULE_ADAPTERS.baselineModel.views,
        { id: 'events', label: { key: 'x', pl: 'Oś zdarzeń' }, state: null },
      ],
    };
    const result = validateModuleAdapter(drifted);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors.map((e) => e.code)).toContain('VIEW_COUNT_VIOLATES_MANDATE');
  });

  it('places two views in the bar and a seven-step flow on its own row', () => {
    expect(resolveViewNavigationPlacement(2)).toBe('in-bar');
    expect(resolveViewNavigationPlacement(7)).toBe('separate-row');
    expect(configFor(FINANCE_MODULE_ADAPTERS.prediction).viewNavigation.placement).toBe('in-bar');
    expect(configFor(FINANCE_MODULE_ADAPTERS.valuation).viewNavigation.placement).toBe('separate-row');
  });
});

describe('AP-10 moduleAdapters — primary action resolution', () => {
  it('an empty Analysis Draft offers "Skonfiguruj wskaźniki", not compute and not approve', () => {
    const primary = resolvePrimaryAction(
      FINANCE_MODULE_ADAPTERS.analysis,
      evaluationContext({ status: 'DRAFT', gates: {} })
    );
    expect(primary.id).toBe('finance.analysis.configureKpis');
    expect(primary.label.pl).toBe('Skonfiguruj wskaźniki');
  });

  it('a configured Analysis offers the freshness-merged compute CTA', () => {
    const ctx = evaluationContext({ gates: allGatesSatisfied(), freshness: 'STALE_ASSUMPTIONS' });
    const primary = resolvePrimaryAction(FINANCE_MODULE_ADAPTERS.analysis, ctx);
    expect(primary.id).toBe('finance.analysis.compute');
    expect(mergeFreshnessIntoPrimaryLabel(primary.label, ctx.freshness, primary.mergesFreshness).pl).toBe(
      'Nieaktualne · Przelicz'
    );
  });

  it('Prediction falls back to preflight until conflicts are resolved (DEC-FIN-004)', () => {
    expect(
      resolvePrimaryAction(FINANCE_MODULE_ADAPTERS.prediction, evaluationContext({ gates: {} })).id
    ).toBe('finance.prediction.preflight');
    expect(
      resolvePrimaryAction(
        FINANCE_MODULE_ADAPTERS.prediction,
        evaluationContext({ gates: allGatesSatisfied() })
      ).id
    ).toBe('finance.prediction.compute');
  });

  it('always resolves a primary, even for a viewer on an invalidated artifact', () => {
    for (const adapter of FINANCE_MODULE_ADAPTER_LIST) {
      const primary = resolvePrimaryAction(
        adapter,
        evaluationContext({ status: 'INVALIDATED', role: 'viewer', gates: {} })
      );
      expect(primary).toBeDefined();
      expect(primary.kind).toBe('primary');
    }
  });

  it('keeps "Valuate model" out of the Models bar entirely (OWN-FIN-018)', () => {
    const adapter = FINANCE_MODULE_ADAPTERS.baselineModel;
    const allIds = [
      ...adapter.primaryCandidates.map((c) => c.id),
      adapter.secondary?.id ?? '',
      ...adapter.more.items.map((i) => i.id),
      ...adapter.lifecycle.transitions.map((t) => String(t.action)),
    ];
    expect(allIds.some((id) => /valuat/i.test(id))).toBe(false);
    // Valuation stays reachable, but only as a downstream relation.
    expect(adapter.relatedDownstreamTypes).toContain('VALUATION_CASE');
  });
});

describe('AP-10 moduleAdapters — Related targets agree with the lineage topology', () => {
  it.each(FINANCE_MODULE_ADAPTER_LIST.map((a) => [a.moduleId, a] as const))(
    '%s declares exactly the downstream types the DAG permits',
    (_moduleId, adapter) => {
      expect([...adapter.relatedDownstreamTypes]).toEqual([
        ...allowedDownstreamCreations(adapter.artifactType),
      ]);
    }
  );
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

  it('names the five preserved state keys the program requires', () => {
    expect([...FOCUS_MODE_PRESERVED_STATE_KEYS]).toEqual([
      'selection',
      'filters',
      'scroll',
      'focus',
      'draft',
    ]);
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

// ===========================================================================
// AP-11 — lineage navigator
// ===========================================================================

function edge(
  source: string,
  sourceType: LineageEdgeRow['source_artifact_type'],
  target: string,
  targetType: LineageEdgeRow['target_artifact_type'],
  edgeType: LineageEdgeRow['edge_type'],
  createdAt = '2026-08-01T00:00:00.000Z'
): LineageEdgeRow {
  return {
    id: `${source}->${target}:${edgeType}`,
    organization_id: ORG,
    source_version_id: source,
    source_artifact_type: sourceType,
    target_version_id: target,
    target_artifact_type: targetType,
    edge_type: edgeType,
    transformation_kind: 'COMPUTE',
    assumption_snapshot_hash: null,
    assumption_snapshot_id: null,
    compute_run_id: null,
    author_id: 'user-1',
    created_at: createdAt,
  };
}

const NODES: Record<string, LineageNodeMetadata> = {
  sp3: {
    versionId: 'sp3',
    artifactId: 'sp',
    artifactType: 'STATEMENT_PACK',
    name: 'Statement pack',
    versionLabel: 'v3',
    periodLabel: 'FY2024',
    status: 'APPROVED',
    freshness: 'CURRENT',
    variantLabel: null,
  },
  an2: {
    versionId: 'an2',
    artifactId: 'an',
    artifactType: 'HISTORICAL_ANALYSIS',
    name: 'Analysis',
    versionLabel: 'v2',
    periodLabel: 'FY2024',
    status: 'APPROVED',
    freshness: 'CURRENT',
    variantLabel: null,
  },
  bm4: {
    versionId: 'bm4',
    artifactId: 'bm',
    artifactType: 'BASELINE_MODEL',
    name: 'Baseline model',
    versionLabel: 'v4',
    periodLabel: 'FY2025-FY2029',
    status: 'APPROVED',
    freshness: 'CURRENT',
    variantLabel: null,
  },
  sc2: {
    versionId: 'sc2',
    artifactId: 'sc',
    artifactType: 'PREDICTION_SCENARIO',
    name: 'Scenario',
    versionLabel: 'v2',
    periodLabel: 'FY2025-FY2029',
    status: 'APPROVED',
    freshness: 'STALE_SOURCE',
    variantLabel: 'Bull',
  },
  val1: {
    versionId: 'val1',
    artifactId: 'val',
    artifactType: 'VALUATION_CASE',
    name: 'Valuation',
    versionLabel: 'v1',
    periodLabel: 'FY2025',
    status: 'DRAFT',
    freshness: 'NEVER_COMPUTED',
    variantLabel: null,
  },
  rep1: {
    versionId: 'rep1',
    artifactId: 'rep',
    artifactType: 'REPORT_EXPORT',
    name: 'Report',
    versionLabel: 'v1',
    periodLabel: null,
    status: 'DRAFT',
    freshness: 'CURRENT',
    variantLabel: null,
  },
};

const resolve: LineageMetadataResolver = (versionId) => NODES[versionId];

/** Ancestors of `val1` — the shape `lineageService.getAncestors` really returns: flat, distinct, unordered. */
const ANCESTOR_EDGES: LineageEdgeRow[] = [
  edge('sc2', 'PREDICTION_SCENARIO', 'val1', 'VALUATION_CASE', 'SCENARIO_TO_VALUATION'),
  edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO'),
  edge('an2', 'HISTORICAL_ANALYSIS', 'bm4', 'BASELINE_MODEL', 'ANALYSIS_TO_MODEL'),
  edge('sp3', 'STATEMENT_PACK', 'bm4', 'BASELINE_MODEL', 'STATEMENT_TO_MODEL'),
  edge('sp3', 'STATEMENT_PACK', 'an2', 'HISTORICAL_ANALYSIS', 'STATEMENT_TO_ANALYSIS'),
];

describe('AP-11 lineageNavigatorContract — stage order does not drift from lineageService', () => {
  it('derives the same rank as the real stageRank for every artifact type', () => {
    for (const artifactType of FinanceArtifactTypeValues) {
      expect(lineageStageRank(artifactType)).toBe(stageRank(artifactType));
    }
  });
});

describe('AP-11 lineageNavigatorContract — compact trail', () => {
  it('builds the register\'s example chain as STRUCTURED data, root -> focus', () => {
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve });
    const nodes = trail.items.filter((i): i is LineageTrailNode => i.kind === 'node');
    expect(nodes.map((n) => n.displayName)).toEqual([
      'Statement pack v3',
      'Analysis v2',
      'Baseline model v4',
      'Scenario Bull v2',
      'Valuation v1',
    ]);
    // Structured, not a string: every element carries its own status/freshness/period.
    expect(nodes[3].metadata.status).toBe('APPROVED');
    expect(nodes[3].metadata.periodLabel).toBe('FY2025-FY2029');
    expect(nodes[4].isFocus).toBe(true);
    expect(nodes.slice(0, 4).every((n) => n.isFocus === false)).toBe(true);
    expect(trail.totalNodeCount).toBe(5);
    expect(trail.unresolvedVersionIds).toEqual([]);
  });

  it('carries a stale badge per element instead of one badge for the whole chain', () => {
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve });
    const nodes = trail.items.filter((i): i is LineageTrailNode => i.kind === 'node');
    expect(nodes[0].staleBadge).toBeNull(); // Statement pack is CURRENT
    expect(nodes[3].staleBadge?.kind).toBe('SOURCE_CHANGED'); // Scenario is STALE_SOURCE
    expect(nodes[4].staleBadge?.kind).toBe('NEVER_COMPUTED'); // Valuation was never computed
  });

  it('picks a deterministic primary parent when a node has two (and flags the alternate)', () => {
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve });
    expect(trail.hasAlternatePaths).toBe(true); // bm4 has both sp3 and an2 as parents
    const nodes = trail.items.filter((i): i is LineageTrailNode => i.kind === 'node');
    // Nearest upstream stage wins: HISTORICAL_ANALYSIS (rank 1) over STATEMENT_PACK (rank 0).
    expect(nodes[1].metadata.versionId).toBe('an2');
    // Same input in a different order must give the same trail.
    const shuffled = buildLineageTrail({
      focusVersionId: 'val1',
      ancestorEdges: [...ANCESTOR_EDGES].reverse(),
      resolve,
    });
    expect(shuffled.items.filter((i) => i.kind === 'node').map((i) => (i as LineageTrailNode).displayName)).toEqual(
      nodes.map((n) => n.displayName)
    );
  });

  it('collapses the middle when the chain exceeds the compact budget', () => {
    const trail = buildLineageTrail({
      focusVersionId: 'val1',
      ancestorEdges: ANCESTOR_EDGES,
      resolve,
      maxNodes: 3,
    });
    expect(trail.items).toHaveLength(3);
    expect(trail.items[0]).toMatchObject({ kind: 'node' });
    expect(trail.items[1]).toMatchObject({ kind: 'collapsed', hiddenCount: 3 });
    expect((trail.items[2] as LineageTrailNode).isFocus).toBe(true);
    expect(trail.totalNodeCount).toBe(5);
  });

  it('reports an unresolvable version instead of silently dropping the chain', () => {
    const partial: LineageMetadataResolver = (id) => (id === 'bm4' ? undefined : NODES[id]);
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: ANCESTOR_EDGES, resolve: partial });
    expect(trail.unresolvedVersionIds).toEqual(['bm4']);
  });

  it('terminates on a root with no ancestor edges at all', () => {
    const trail = buildLineageTrail({ focusVersionId: 'sp3', ancestorEdges: [], resolve });
    expect(trail.items).toHaveLength(1);
    expect((trail.items[0] as LineageTrailNode).isFocus).toBe(true);
    expect(trail.hasAlternatePaths).toBe(false);
  });
});

describe('AP-11 lineageNavigatorContract — Related panel', () => {
  const DESCENDANT_EDGES: LineageEdgeRow[] = [
    edge('bm4', 'BASELINE_MODEL', 'sc2', 'PREDICTION_SCENARIO', 'MODEL_TO_SCENARIO'),
    edge('bm4', 'BASELINE_MODEL', 'val1', 'VALUATION_CASE', 'MODEL_TO_VALUATION'),
    edge('sc2', 'PREDICTION_SCENARIO', 'val1', 'VALUATION_CASE', 'SCENARIO_TO_VALUATION'),
    edge('val1', 'VALUATION_CASE', 'rep1', 'REPORT_EXPORT', 'VERSION_TO_REPORT'),
  ];

  it('separates direct parents, direct children and indirect descendants with counts', () => {
    const panel = buildRelatedPanel({
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: DESCENDANT_EDGES,
      resolve,
    })!;
    expect(panel).not.toBeNull();
    expect(panel.parents.map((g) => [g.artifactType, g.count])).toEqual([
      ['STATEMENT_PACK', 1],
      ['HISTORICAL_ANALYSIS', 1],
    ]);
    expect(panel.children.map((g) => [g.artifactType, g.count])).toEqual([
      ['PREDICTION_SCENARIO', 1],
      ['VALUATION_CASE', 1],
    ]);
    expect(panel.indirectDescendants.map((g) => g.artifactType)).toEqual(['REPORT_EXPORT']);
    expect(panel.indirectDescendants[0].entries[0].depth).toBe(2);
  });

  it('offers "+ New" for every permitted downstream type with the exact source version preselected', () => {
    const panel = buildRelatedPanel({
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: DESCENDANT_EDGES,
      resolve,
    })!;
    expect(panel.createNew.map((c) => c.targetArtifactType)).toEqual([
      'PREDICTION_SCENARIO',
      'VALUATION_CASE',
      'REPORT_EXPORT',
    ]);
    for (const action of panel.createNew) {
      expect(action.preselectedSource).toEqual({
        artifactId: 'bm',
        artifactType: 'BASELINE_MODEL',
        businessVersionId: 'bm4',
      });
    }
  });

  it('flags downstream staleness on a node that is itself current', () => {
    const panel = buildRelatedPanel({
      focusVersionId: 'bm4',
      ancestorEdges: ANCESTOR_EDGES,
      descendantEdges: DESCENDANT_EDGES,
      resolve,
    })!;
    expect(NODES.bm4.freshness).toBe('CURRENT');
    expect(panel.focusBadges.map((b) => b.kind)).toEqual(['DOWNSTREAM_STALE']);
  });

  it('flags an orphan: an Analysis with no STATEMENT_TO_ANALYSIS parent', () => {
    expect(isOrphaned('HISTORICAL_ANALYSIS', [])).toBe(true);
    expect(isOrphaned('STATEMENT_PACK', [])).toBe(false); // roots are never orphans
    const panel = buildRelatedPanel({
      focusVersionId: 'an2',
      ancestorEdges: [],
      descendantEdges: [],
      resolve,
    })!;
    expect(panel.focusBadges.map((b) => b.kind)).toContain('ORPHANED');
  });

  it('treats a management-adjusted variant edge as a sibling, not an ancestor', () => {
    const variantEdge = edge('sc2', 'PREDICTION_SCENARIO', 'sc9', 'PREDICTION_SCENARIO', 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT');
    const withVariant = [...ANCESTOR_EDGES, variantEdge];
    const trail = buildLineageTrail({ focusVersionId: 'val1', ancestorEdges: withVariant, resolve });
    expect(trail.items.filter((i) => i.kind === 'node')).toHaveLength(5); // unchanged chain
    const panel = buildRelatedPanel({
      focusVersionId: 'sc2',
      ancestorEdges: withVariant,
      descendantEdges: [],
      resolve: (id) =>
        id === 'sc9'
          ? { ...NODES.sc2, versionId: 'sc9', versionLabel: 'v9', variantLabel: 'Bear', freshness: 'CURRENT' }
          : NODES[id],
    })!;
    expect(panel.siblings.map((s) => s.displayName)).toEqual(['Scenario Bear v9']);
  });

  it('returns null when the focus version itself cannot be resolved', () => {
    expect(
      buildRelatedPanel({ focusVersionId: 'ghost', ancestorEdges: [], descendantEdges: [], resolve })
    ).toBeNull();
  });

  it('computes BFS depths in both directions', () => {
    const down = computeDepths(DESCENDANT_EDGES, 'bm4', 'downstream');
    expect(down.get('sc2')).toBe(1);
    expect(down.get('val1')).toBe(1);
    expect(down.get('rep1')).toBe(2);
    expect(down.has('bm4')).toBe(false);
    const up = computeDepths(ANCESTOR_EDGES, 'val1', 'upstream');
    expect(up.get('sc2')).toBe(1);
    expect(up.get('bm4')).toBe(2);
    expect(up.get('sp3')).toBe(3);
  });
});

describe('AP-11 lineageNavigatorContract — downstream topology and the auxiliary graph', () => {
  it('derives the permitted "+ New" targets from the DAG rules', () => {
    expect(allowedDownstreamCreations('STATEMENT_PACK')).toEqual([
      'HISTORICAL_ANALYSIS',
      'BASELINE_MODEL',
      'REPORT_EXPORT',
    ]);
    expect(allowedDownstreamCreations('HISTORICAL_ANALYSIS')).toEqual(['BASELINE_MODEL', 'REPORT_EXPORT']);
    // Addendum section 6.1: Scenario is OPTIONAL — a Model may go straight to Valuation.
    expect(allowedDownstreamCreations('BASELINE_MODEL')).toEqual([
      'PREDICTION_SCENARIO',
      'VALUATION_CASE',
      'REPORT_EXPORT',
    ]);
    expect(allowedDownstreamCreations('VALUATION_CASE')).toEqual(['REPORT_EXPORT']);
    expect(allowedDownstreamCreations('REPORT_EXPORT')).toEqual([]);
  });

  it('keeps the full graph an auxiliary, off-by-default view (OWN-FIN-022)', () => {
    expect(LINEAGE_FULL_GRAPH_VIEW.auxiliary).toBe(true);
    expect(LINEAGE_FULL_GRAPH_VIEW.defaultVisible).toBe(false);
    expect(LINEAGE_FULL_GRAPH_VIEW.entryPoint).toBe('related-panel-footer');
  });
});

describe('AP-11 lineageNavigatorContract — wraps lineageService through an injectable port', () => {
  it('assembles trail + related panel from mocked getAncestors/getDescendants', async () => {
    const calls: string[] = [];
    const port: LineageServicePort = {
      async getAncestors(organizationId, businessVersionId) {
        calls.push(`ancestors:${organizationId}:${businessVersionId}`);
        return ANCESTOR_EDGES;
      },
      async getDescendants(organizationId, businessVersionId) {
        calls.push(`descendants:${organizationId}:${businessVersionId}`);
        return [edge('val1', 'VALUATION_CASE', 'rep1', 'REPORT_EXPORT', 'VERSION_TO_REPORT')];
      },
    };

    const model = await loadLineageNavigator({
      port,
      organizationId: ORG,
      focusVersionId: 'val1',
      resolve,
    });

    expect(calls.sort()).toEqual(['ancestors:org-test:val1', 'descendants:org-test:val1']);
    expect(
      model.trail.items.filter((i): i is LineageTrailNode => i.kind === 'node').map((n) => n.displayName)
    ).toEqual(['Statement pack v3', 'Analysis v2', 'Baseline model v4', 'Scenario Bull v2', 'Valuation v1']);
    expect(model.related?.children[0]).toMatchObject({ artifactType: 'REPORT_EXPORT', count: 1 });
    expect(model.fullGraph.defaultVisible).toBe(false);
  });
});
