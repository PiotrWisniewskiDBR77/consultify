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

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

const apiMocks = vi.hoisted(() => ({
  getFinanceBusinessVersion: vi.fn(),
  runFinancePredictionPreflight: vi.fn(),
  runFinancePredictionCalculate: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import type { FinanceBusinessVersionDetailDto } from '../../../../services/api/financeV2.types';
import { PredictionWorkspace } from '../PredictionWorkspace';

const CONFIRMED_VERSION: FinanceBusinessVersionDetailDto = {
  businessVersionId: 'bv-flag-1',
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

describe('PredictionWorkspace — flag gate (AP_MOUNT §A)', () => {
  it('OFF (default): renders nothing and calls zero Prediction network functions', () => {
    const { container } = render(<PredictionWorkspace artifactId="artifact-1" businessVersionId="bv-flag-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(apiMocks.getFinanceBusinessVersion).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();
  });

  it('ON (local override) + real businessVersionId: mounts the real bar and the assumptions view', async () => {
    apiMocks.getFinanceBusinessVersion.mockResolvedValue(CONFIRMED_VERSION);
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
    expect(apiMocks.getFinanceBusinessVersion).not.toHaveBeenCalled();
  });
});
