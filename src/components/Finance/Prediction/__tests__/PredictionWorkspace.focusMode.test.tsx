/**
 * @vitest-environment jsdom
 *
 * `PredictionWorkspace` — AP_MOUNT §E (OWN-FIN-004): entering/exiting focus
 * mode must not refetch anything and must preserve the active view + draft
 * name; `Esc` exits.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

import type { FinancePredictionDraftDto } from '../../../../services/api/financeV2.types';

const apiMocks = vi.hoisted(() => ({
  getFinancePredictionDraft: vi.fn(),
  saveFinancePredictionDraft: vi.fn(),
  runFinancePredictionPreflight: vi.fn(),
  runFinancePredictionCalculate: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import { PredictionWorkspace } from '../PredictionWorkspace';

const PERSISTED_DRAFT: FinancePredictionDraftDto = {
  businessVersionId: 'bv-focus-1',
  version: 1,
  sourceBaselineVersionId: 'bv-baseline-1',
  sourceBaselineContextVersion: 1,
  sourceBaselineContextHash: 'a'.repeat(64),
  sourceStatementVersionId: 'bv-statement-1',
  sourceAnalysisVersionId: 'bv-analysis-1',
  name: 'Scenariusz zachowany',
  description: null,
  scenarioMode: 'STANDARD_BASE',
  computeContext: {
    entityId: 'entity-real',
    openingBalanceSheetPeriodId: 'period-opening',
    forecastPeriods: [{ periodId: 'period-1', label: '01/2026', periodStart: '2026-01-01', periodEnd: '2026-01-31' }],
  },
  driverOverrides: [],
  initiatives: [],
  impacts: [],
  financing: [],
  lastAssumptionChangeAt: '2026-08-01T00:00:00Z',
  lastComputeAt: null,
};

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('PredictionWorkspace — Focus Mode no-refetch (AP_MOUNT §E)', () => {
  it('entering and exiting focus mode calls zero Prediction network functions and preserves the active view; Esc exits', async () => {
    apiMocks.getFinancePredictionDraft.mockResolvedValue(PERSISTED_DRAFT);
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-focus-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument()
    );
    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();
    expect(apiMocks.getFinancePredictionDraft).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('finance-workspace-bar-fullscreen'));
    await waitFor(() =>
      expect(document.body.classList.contains('finance-focus-mode-active')).toBe(true)
    );

    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent(
      'Scenariusz zachowany'
    );
    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();
    expect(apiMocks.getFinancePredictionDraft).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(document.body.classList.contains('finance-focus-mode-active')).toBe(false)
    );

    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();
    expect(apiMocks.getFinancePredictionDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent(
      'Scenariusz zachowany'
    );
  });
});
