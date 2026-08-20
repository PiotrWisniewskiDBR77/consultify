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

import type { FinanceBusinessVersionDetailDto } from '../../../../services/api/financeV2.types';

const apiMocks = vi.hoisted(() => ({
  getFinanceBusinessVersion: vi.fn(),
  getFinancePredictionAuthoring: vi.fn(),
  saveFinancePredictionAuthoring: vi.fn(),
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

const CONFIRMED_VERSION: FinanceBusinessVersionDetailDto = {
  businessVersionId: 'bv-eb-1',
  artifactId: 'artifact-1',
  versionNo: 1,
  version: 1,
  status: 'DRAFT',
  freshness: 'NEVER_COMPUTED',
  freshnessReason: null,
  staleSince: null,
  riskTier: 'LOW',
  versionKind: 'MAIN',
  parentVersionId: null,
  supersededByVersionId: null,
  computeSnapshotId: null,
  computeRunId: null,
  contentSemanticHash: null,
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  reopenReason: null,
  reopenedBy: null,
  reopenedAt: null,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

afterEach(() => {
  clearFeatureFlagOverrides();
});

describe('PredictionWorkspace — FinanceErrorBoundary (AP_MOUNT §D)', () => {
  it('a crash in the assumptions view is caught locally, not propagated to the caller', async () => {
    apiMocks.getFinanceBusinessVersion.mockResolvedValue(CONFIRMED_VERSION);
    apiMocks.getFinancePredictionAuthoring.mockResolvedValue({
      configured: false,
      businessVersionId: 'bv-eb-1',
      revision: 0,
      draft: null,
      computeContext: {
        ready: false,
        entityIds: [],
        forecastPeriodIds: [],
        openingBalanceSheetPeriodId: null,
      },
      results: { scenarioValues: {}, baselineValues: {} },
    });
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
