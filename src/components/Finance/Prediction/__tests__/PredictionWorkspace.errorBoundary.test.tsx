/**
 * @vitest-environment jsdom
 *
 * `PredictionWorkspace` — AP_MOUNT §D (OWN-FIN-002): a crash inside this
 * document's content must not corrupt the surrounding React tree —
 * `FinanceErrorBoundary` catches it and shows a Retry/Back fallback.
 *
 * NOTE (documented honestly, not silently fixed): unlike Baseline/
 * Valuation/Analysis, `PredictionWorkspace`'s `FinanceErrorBoundary` wraps
 * the BAR too (not just the content area) — see the component's own JSX.
 * This test proves the boundary still does its job (catches the crash,
 * doesn't propagate to the caller, offers Retry/Back), but it does NOT
 * prove "the bar keeps working during the crash" the way the other three
 * do, because the bar is inside the boundary here. Flagged in
 * AP_MOUNT_report.md §D as a structural inconsistency worth a follow-up,
 * out of this task's scope to restructure.
 */
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../ScenarioAssumptionsView', () => ({
  ScenarioAssumptionsView: () => {
    throw new Error('injected crash — proves FinanceErrorBoundary catches real render errors');
  },
}));

import { PredictionWorkspace } from '../PredictionWorkspace';

const PERSISTED_DRAFT: FinancePredictionDraftDto = {
  businessVersionId: 'bv-eb-1',
  version: 1,
  sourceBaselineVersionId: 'bv-baseline-1', sourceBaselineContextVersion: 1,
  sourceBaselineContextHash: 'a'.repeat(64), sourceStatementVersionId: 'bv-statement-1',
  sourceAnalysisVersionId: 'bv-analysis-1', name: 'Scenariusz', description: null,
  scenarioMode: 'STANDARD_BASE',
  computeContext: { entityId: 'entity-1', openingBalanceSheetPeriodId: 'period-opening', forecastPeriods: [{ periodId: 'period-1', label: '01/2026', periodStart: '2026-01-01', periodEnd: '2026-01-31' }] },
  driverOverrides: [], initiatives: [], impacts: [], financing: [],
  lastAssumptionChangeAt: '2026-08-01T00:00:00Z', lastComputeAt: null,
};

afterEach(() => {
  clearFeatureFlagOverrides();
});

describe('PredictionWorkspace — FinanceErrorBoundary (AP_MOUNT §D)', () => {
  it('a crash in the assumptions view is caught locally, not propagated to the caller', async () => {
    apiMocks.getFinancePredictionDraft.mockResolvedValue(PERSISTED_DRAFT);
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-eb-1" />)
    ).not.toThrow();
    await waitFor(() => expect(screen.getByTestId('finance-error-boundary')).toBeInTheDocument());
    expect(screen.getByTestId('finance-error-boundary')).toHaveTextContent(/Ponów|Wróć do listy/);
    consoleErrorSpy.mockRestore();
  });
});
