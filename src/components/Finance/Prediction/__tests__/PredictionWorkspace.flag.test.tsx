/**
 * @vitest-environment jsdom
 *
 * `PredictionWorkspace` — AP_MOUNT §A: the component reads its OWN flag
 * (`financePredictionWorkspaceV1`, default OFF) and gates on it BEFORE
 * mounting any child hook/effect — not just relying on the caller to check
 * the flag first.
 *
 * Proves:
 *   - flag OFF (no override, i.e. real production default): renders nothing
 *     (`container` is empty) AND never calls any Prediction network function.
 *   - flag ON, with a real `businessVersionId` (local override, same mechanism
 *     a real user/harness would use): mounts the real bar + assumptions view.
 *   - flag ON, WITHOUT a `businessVersionId` (ID_BRIDGE, Gate E — the bridge
 *     could not resolve a canonical record): still mounts (not `null`), but
 *     renders the honest "no-id" empty state instead of a silent empty
 *     assumptions form, and calls zero Prediction network functions (nothing
 *     to check without an id).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

const apiMocks = vi.hoisted(() => ({
  getFinancePredictionDraft: vi.fn(),
  saveFinancePredictionDraft: vi.fn(),
  runFinancePredictionPreflight: vi.fn(),
  runFinancePredictionCalculate: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import type { FinancePredictionDraftDto } from '../../../../services/api/financeV2.types';
import { PredictionWorkspace } from '../PredictionWorkspace';

const PERSISTED_DRAFT: FinancePredictionDraftDto = {
  businessVersionId: 'bv-flag-1',
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
  vi.clearAllMocks();
});

describe('PredictionWorkspace — flag gate (AP_MOUNT §A)', () => {
  it('OFF (default): renders nothing and calls zero Prediction network functions', () => {
    const { container } = render(
      <PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-flag-1" />
    );
    expect(container).toBeEmptyDOMElement();
    expect(apiMocks.getFinancePredictionDraft).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();
  });

  it('ON (local override) + real businessVersionId: mounts the real bar and the assumptions view', async () => {
    apiMocks.getFinancePredictionDraft.mockResolvedValue(PERSISTED_DRAFT);
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-flag-1" />);
    expect(await screen.findByTestId('finance-workspace-bar')).toBeInTheDocument();
    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
  });

  it('ON (local override), WITHOUT businessVersionId (bridge could not resolve): mounts but shows the honest empty state, not the form, and touches zero network', () => {
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    const { container } = render(<PredictionWorkspace artifactId="artifact-1" />);
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByTestId('prediction-mount-no-id')).toBeInTheDocument();
    expect(screen.queryByTestId('prediction-assumptions-view')).not.toBeInTheDocument();
    expect(apiMocks.getFinancePredictionDraft).not.toHaveBeenCalled();
  });
});
