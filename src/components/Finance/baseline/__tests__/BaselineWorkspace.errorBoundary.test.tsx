/**
 * @vitest-environment jsdom
 *
 * `BaselineWorkspace` — AP_MOUNT §D (OWN-FIN-002): a crash inside the
 * Założenia view's content is caught by the LOCAL `FinanceErrorBoundary`
 * (which wraps ONLY the content area, `key={activeView}`) — the bar (name,
 * tabs, fullscreen) lives OUTSIDE the boundary and survives.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

vi.mock('@/services/api/financeV2.api', () => ({
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn(),
  listBaselineAssumptions: vi.fn().mockResolvedValue([]),
  upsertBaselineAssumptions: vi.fn(),
  computeBaseline: vi.fn(),
  listBaselineOutputs: vi.fn().mockResolvedValue([]),
}));

vi.mock('../AssumptionsView', () => ({
  AssumptionsView: () => {
    throw new Error('injected crash — proves FinanceErrorBoundary catches real render errors');
  },
}));

import { BaselineWorkspace, type BaselineWorkspaceProps } from '../../BaselineWorkspace';
import type { PeriodMeta } from '../CalculationsView';

const FORECAST_PERIODS: PeriodMeta[] = [{ periodId: 'per-2026-01', label: '01/2026', yearMonth: '2026-01' }];

function baseProps(overrides: Partial<BaselineWorkspaceProps> = {}): BaselineWorkspaceProps {
  return {
    artifactId: 'artifact-1',
    businessVersionId: 'bv-1',
    entityId: 'entity-1',
    name: 'Model bazowy',
    status: 'DRAFT',
    freshness: 'NEVER_COMPUTED',
    version: 1,
    role: 'preparer',
    forecastPeriods: FORECAST_PERIODS,
    openingBalanceSheetPeriodId: 'per-2025-12',
    assumptionRowOrder: [],
    contextValues: { type: 'Model bazowy (Baseline)' },
    onNavigateBack: () => {},
    ...overrides,
  };
}

afterEach(() => {
  clearFeatureFlagOverrides();
});

describe('BaselineWorkspace — FinanceErrorBoundary (AP_MOUNT §D)', () => {
  it('a crash in the Założenia view is caught locally — the bar survives outside the boundary', async () => {
    setFeatureFlagOverrides({ financeBaselineWorkspaceV1: true });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BaselineWorkspace {...baseProps()} />)).not.toThrow();

    expect(await screen.findByTestId('finance-error-boundary')).toBeInTheDocument();
    // The bar is OUTSIDE the crashed content — its tabs and name are still live.
    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Model bazowy');

    consoleErrorSpy.mockRestore();
  });
});
