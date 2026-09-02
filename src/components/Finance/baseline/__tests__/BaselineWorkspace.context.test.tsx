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
  // ★ DYŻUR 279: default flagi to teraz ON, więc bramkę sprawdzamy jawnym
  // override OFF (ścieżka cofania) — inaczej ten test przestałby czegokolwiek bronić.
  it('does not fetch context while the workspace flag is explicitly OFF', () => {
    setFeatureFlagOverrides({ financeBaselineWorkspaceV1: false });
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
      // ★ DYŻUR 279 — rozszerzony kontrakt kontekstu.
      openingBalanceSheetPeriod: {
        periodId: 'period-opening',
        label: '12/2026',
        periodStart: '2026-12-01',
        periodEnd: '2026-12-31',
      },
      assumptionBasePeriods: [
        {
          periodId: 'period-opening',
          label: '12/2026',
          periodStart: '2026-12-01',
          periodEnd: '2026-12-31',
        },
      ],
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
    apiMocks.listBaselineAssumptions.mockResolvedValue([
      {
        assumptionId: 'a-1',
        scheduleType: 'revenue_pvm',
        driverCode: 'REVENUE_GROWTH_YOY',
        entityId: 'entity-source',
        periodId: 'period-forecast',
        basePeriodId: 'period-opening',
        rule: 'GROWTH_RATE',
        value: { status: 'PRESENT_NONZERO', valueDecimal: '0.12', unit: 'PCT' },
        rangeLow: null,
        rangeHigh: null,
        quality: 'CONFIRMED',
        createdBy: 'u',
        createdAt: '2026-08-01T09:00:00.000Z',
        updatedAt: '2026-08-01T09:00:00.000Z',
      },
    ]);

    render(<BaselineWorkspace {...props} />);
    expect(apiMocks.listBaselineAssumptions).not.toHaveBeenCalled();
    expect(await screen.findByTestId('baseline-workspace')).toBeInTheDocument();
    await waitFor(() =>
      expect(apiMocks.listBaselineAssumptions).toHaveBeenCalledWith('bv-context', {
        entityId: 'entity-source',
      })
    );

    // ★ DYŻUR 279 — kolumna „Okres bazowy" pokazuje ETYKIETĘ okresu otwarcia
    // z kontekstu, nie surowe ID (`period-opening`). To jest zgłoszenie
    // właściciela „`per-2025-12`" w postaci testu.
    await waitFor(() => expect(screen.getByText('12/2026')).toBeInTheDocument());
    expect(screen.queryByText('period-opening')).not.toBeInTheDocument();

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
