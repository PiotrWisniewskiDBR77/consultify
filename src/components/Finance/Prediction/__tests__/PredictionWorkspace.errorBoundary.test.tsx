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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

vi.mock('@/services/api/financeV2.api', () => ({
  runFinancePredictionPreflight: vi.fn(),
  runFinancePredictionCalculate: vi.fn(),
}));

vi.mock('../ScenarioAssumptionsView', () => ({
  ScenarioAssumptionsView: () => {
    throw new Error('injected crash — proves FinanceErrorBoundary catches real render errors');
  },
}));

import { PredictionWorkspace } from '../PredictionWorkspace';

afterEach(() => {
  clearFeatureFlagOverrides();
});

describe('PredictionWorkspace — FinanceErrorBoundary (AP_MOUNT §D)', () => {
  it('a crash in the assumptions view is caught locally, not propagated to the caller', () => {
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<PredictionWorkspace artifactId="artifact-1" />)).not.toThrow();
    expect(screen.getByTestId('finance-error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('finance-error-boundary')).toHaveTextContent(/Ponów|Wróć do listy/);
    consoleErrorSpy.mockRestore();
  });
});
