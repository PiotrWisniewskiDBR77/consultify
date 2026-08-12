/**
 * @vitest-environment jsdom
 *
 * `BaselineWorkspace` — AP_MOUNT §E (OWN-FIN-004): entering/exiting focus
 * mode must not fire any NEW network call (the three mount-time GETs are
 * done before the toggle) and must preserve the active view; `Esc` exits.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

const apiMocks = vi.hoisted(() => ({
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn(),
  listBaselineAssumptions: vi.fn().mockResolvedValue([]),
  upsertBaselineAssumptions: vi.fn(),
  computeBaseline: vi.fn(),
  listBaselineOutputs: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

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
  vi.clearAllMocks();
});

describe('BaselineWorkspace — Focus Mode no-refetch (AP_MOUNT §E)', () => {
  it('entering and exiting focus mode fires zero additional network calls and preserves the active view; Esc exits', async () => {
    setFeatureFlagOverrides({ financeBaselineWorkspaceV1: true });
    render(<BaselineWorkspace {...baseProps()} initialView="wyliczenia" />);

    await waitFor(() => expect(apiMocks.listBaselineOutputs).toHaveBeenCalledTimes(1));
    const callCountBefore =
      apiMocks.listBaselineAssumptions.mock.calls.length + apiMocks.listBaselineOutputs.mock.calls.length;

    expect(screen.getByTestId('baseline-workspace')).toHaveAttribute('data-active-view', 'wyliczenia');

    fireEvent.click(screen.getByTestId('finance-workspace-bar-fullscreen'));
    await waitFor(() => expect(document.body.classList.contains('finance-focus-mode-active')).toBe(true));

    const callCountAfterEnter =
      apiMocks.listBaselineAssumptions.mock.calls.length + apiMocks.listBaselineOutputs.mock.calls.length;
    expect(callCountAfterEnter).toBe(callCountBefore);
    expect(screen.getByTestId('baseline-workspace')).toHaveAttribute('data-active-view', 'wyliczenia');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.body.classList.contains('finance-focus-mode-active')).toBe(false));

    const callCountAfterExit =
      apiMocks.listBaselineAssumptions.mock.calls.length + apiMocks.listBaselineOutputs.mock.calls.length;
    expect(callCountAfterExit).toBe(callCountBefore);
    expect(screen.getByTestId('baseline-workspace')).toHaveAttribute('data-active-view', 'wyliczenia');
  });
});
