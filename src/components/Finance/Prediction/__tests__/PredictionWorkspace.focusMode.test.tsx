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

import type { FinanceBusinessVersionDetailDto } from '../../../../services/api/financeV2.types';

const apiMocks = vi.hoisted(() => ({
  getFinanceBusinessVersion: vi.fn(),
  runFinancePredictionPreflight: vi.fn(),
  runFinancePredictionCalculate: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import { createEmptyScenarioDraft } from '../predictionScenarioModel';
import { PredictionWorkspace } from '../PredictionWorkspace';

const CONFIRMED_VERSION: FinanceBusinessVersionDetailDto = {
  businessVersionId: 'bv-focus-1',
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
  vi.clearAllMocks();
});

describe('PredictionWorkspace — Focus Mode no-refetch (AP_MOUNT §E)', () => {
  it('entering and exiting focus mode calls zero Prediction network functions and preserves the active view; Esc exits', async () => {
    apiMocks.getFinanceBusinessVersion.mockResolvedValue(CONFIRMED_VERSION);
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    const draft = createEmptyScenarioDraft({ name: 'Scenariusz zachowany' });
    render(
      <PredictionWorkspace
        artifactId="artifact-1"
        businessVersionId="bv-focus-1"
        initialDraft={draft}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument()
    );
    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();

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

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(document.body.classList.contains('finance-focus-mode-active')).toBe(false)
    );

    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();
    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent(
      'Scenariusz zachowany'
    );
  });
});
