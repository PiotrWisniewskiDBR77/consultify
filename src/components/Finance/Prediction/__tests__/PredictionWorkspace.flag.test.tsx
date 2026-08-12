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
 *   - flag ON (local override, same mechanism a real user/harness would use):
 *     mounts the real bar + assumptions view.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

const apiMocks = vi.hoisted(() => ({
  runFinancePredictionPreflight: vi.fn(),
  runFinancePredictionCalculate: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import { PredictionWorkspace } from '../PredictionWorkspace';

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('PredictionWorkspace — flag gate (AP_MOUNT §A)', () => {
  it('OFF (default): renders nothing and calls zero Prediction network functions', () => {
    const { container } = render(<PredictionWorkspace artifactId="artifact-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();
  });

  it('ON (local override): mounts the real bar and the assumptions view', () => {
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    render(<PredictionWorkspace artifactId="artifact-1" />);
    expect(screen.getByTestId('finance-workspace-bar')).toBeInTheDocument();
    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
  });
});
