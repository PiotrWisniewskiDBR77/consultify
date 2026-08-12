/**
 * @vitest-environment jsdom
 *
 * `BaselineWorkspace` — AP_MOUNT §A: the component reads its OWN flag
 * (`financeBaselineWorkspaceV1`, default OFF) and gates on it BEFORE
 * mounting `useBaselineAssumptionsEditor`/`useBaselineOutputs`/
 * `useBaselineCompute` — the three hooks that fetch
 * `/api/v8/finance-v2/baseline/*` on mount.
 *
 * Proves:
 *   - flag OFF (no override, i.e. real production default): renders nothing
 *     AND never calls any of the three baseline network functions.
 *   - flag ON (local override): mounts the real bar + Założenia view.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

const apiMocks = vi.hoisted(() => ({
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn(),
  listBaselineAssumptions: vi.fn(),
  upsertBaselineAssumptions: vi.fn(),
  computeBaseline: vi.fn(),
  listBaselineOutputs: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import { BaselineWorkspace, type BaselineWorkspaceProps } from '../../BaselineWorkspace';
import type { AssumptionRowSpec } from '../AssumptionsView';
import type { PeriodMeta } from '../CalculationsView';

const FORECAST_PERIODS: PeriodMeta[] = [{ periodId: 'per-2026-01', label: '01/2026', yearMonth: '2026-01' }];
const ASSUMPTION_ROWS: AssumptionRowSpec[] = [];

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
    assumptionRowOrder: ASSUMPTION_ROWS,
    contextValues: { type: 'Model bazowy (Baseline)' },
    onNavigateBack: () => {},
    ...overrides,
  };
}

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('BaselineWorkspace — flag gate (AP_MOUNT §A)', () => {
  it('OFF (default): renders nothing and calls zero baseline network functions', () => {
    const { container } = render(<BaselineWorkspace {...baseProps()} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiMocks.listBaselineAssumptions).not.toHaveBeenCalled();
    expect(apiMocks.listBaselineOutputs).not.toHaveBeenCalled();
    expect(apiMocks.computeBaseline).not.toHaveBeenCalled();
  });

  it('ON (local override): mounts the real bar and Założenia view', async () => {
    apiMocks.listBaselineAssumptions.mockResolvedValue([]);
    apiMocks.listBaselineOutputs.mockResolvedValue([]);
    setFeatureFlagOverrides({ financeBaselineWorkspaceV1: true });
    render(<BaselineWorkspace {...baseProps()} />);
    expect(screen.getByTestId('baseline-workspace')).toBeInTheDocument();
    expect(await screen.findByRole('tablist')).toBeInTheDocument();
  });
});
