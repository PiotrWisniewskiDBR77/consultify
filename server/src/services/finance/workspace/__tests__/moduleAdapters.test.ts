/**
 * AP-10 — Finance module adapter tests.
 *
 * Split out of the former `workspaceContracts.test.ts` (AP-0 wave prep).
 * Shared fixtures and the "why there is no database here" rationale live in
 * `workspaceTestFixtures.ts`.
 */
import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_BAR_MAX_DIRECT_RIGHT_CONTROLS,
  countDirectRightControls,
  mergeFreshnessIntoPrimaryLabel,
  resolveViewNavigationPlacement,
  validateWorkspaceBarConfig,
} from '../workspaceBarContract.js';
import {
  FINANCE_MODULE_ADAPTERS,
  FINANCE_MODULE_ADAPTER_LIST,
  buildWorkspaceBarConfig,
  resolvePrimaryAction,
  validateModuleAdapter,
  type FinanceModuleAdapter,
} from '../moduleAdapters.js';
import { allowedDownstreamCreations } from '../lineageNavigatorContract.js';
import {
  allGatesSatisfied,
  artifactRef,
  configFor,
  evaluationContext,
} from './workspaceTestFixtures.js';

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
      // `sourceStatus` is a REQUIRED parameter (a terminal status yields
      // nothing); the adapter declares what a LIVE artifact may spawn, so the
      // comparison is made against a non-terminal status.
      expect([...adapter.relatedDownstreamTypes]).toEqual([
        ...allowedDownstreamCreations(adapter.artifactType, 'APPROVED'),
      ]);
    }
  );
});