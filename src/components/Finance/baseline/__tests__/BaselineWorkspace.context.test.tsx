/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

const apiMocks = vi.hoisted(() => ({
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn(),
  getBaselineWorkspaceContext: vi.fn(),
  listBaselineAssumptions: vi.fn().mockResolvedValue([]),
  upsertBaselineAssumptions: vi.fn(),
  computeBaseline: vi.fn(),
  listBaselineOutputs: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import { BaselineWorkspace } from '../../BaselineWorkspace';

const props = {
  artifactId: 'artifact-context',
  businessVersionId: 'bv-context',
  name: 'Model bazowy',
  status: 'DRAFT' as const,
  freshness: 'NEVER_COMPUTED' as const,
  version: 1,
  role: 'preparer' as const,
  contextValues: { type: 'Model bazowy (Baseline)' },
  onNavigateBack: () => {},
};

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('BaselineWorkspace — canonical context loader', () => {
  it('does not fetch context while the workspace flag is OFF', () => {
    const { container } = render(<BaselineWorkspace {...props} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiMocks.getBaselineWorkspaceContext).not.toHaveBeenCalled();
  });

  it('hydrates the mounted workspace from the persisted context', async () => {
    setFeatureFlagOverrides({ financeBaselineWorkspaceV1: true });
    apiMocks.getBaselineWorkspaceContext.mockResolvedValue({
      businessVersionId: 'bv-context',
      entityId: 'entity-source',
      openingBalanceSheetPeriodId: 'period-opening',
      forecastPeriods: [
        {
          periodId: 'period-forecast',
          label: '01/2027',
          periodStart: '2027-01-01',
          periodEnd: '2027-01-31',
        },
      ],
      assumptionRowOrder: [
        {
          scheduleType: 'revenue_pvm',
          driverCode: 'REVENUE_GROWTH_YOY',
          entityId: 'entity-source',
          periodId: 'period-forecast',
        },
      ],
      version: 1,
    });

    render(<BaselineWorkspace {...props} />);
    expect(apiMocks.listBaselineAssumptions).not.toHaveBeenCalled();
    expect(await screen.findByTestId('baseline-workspace')).toBeInTheDocument();
    await waitFor(() =>
      expect(apiMocks.listBaselineAssumptions).toHaveBeenCalledWith('bv-context', {
        entityId: 'entity-source',
      })
    );

    apiMocks.computeBaseline.mockResolvedValue({
      jobId: 'job-1',
      jobStatus: 'succeeded',
      periodsComputed: 1,
      monthlyResults: [],
    });
    fireEvent.click(screen.getByTestId('finance-workspace-bar-primary'));
    await waitFor(() =>
      expect(apiMocks.computeBaseline).toHaveBeenCalledWith({
        businessVersionId: 'bv-context',
        entityId: 'entity-source',
        forecastPeriodIds: ['period-forecast'],
        openingBalanceSheetPeriodId: 'period-opening',
      })
    );
  });

  it('renders an honest error and never mounts data hooks when context loading fails', async () => {
    setFeatureFlagOverrides({ financeBaselineWorkspaceV1: true });
    apiMocks.getBaselineWorkspaceContext.mockRejectedValue(
      Object.assign(new Error('Context not configured'), {
        status: 409,
        data: { code: 'BASELINE_CONTEXT_NOT_CONFIGURED' },
      })
    );
    render(<BaselineWorkspace {...props} />);
    expect(await screen.findByTestId('baseline-context-error')).toBeInTheDocument();
    expect(apiMocks.listBaselineAssumptions).not.toHaveBeenCalled();
  });
});
