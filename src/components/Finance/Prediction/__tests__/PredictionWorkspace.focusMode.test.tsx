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

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

const apiMocks = vi.hoisted(() => ({
  runFinancePredictionPreflight: vi.fn(),
  runFinancePredictionCalculate: vi.fn(),
}));
vi.mock('@/services/api/financeV2.api', () => apiMocks);

import { createEmptyScenarioDraft } from '../predictionScenarioModel';
import { PredictionWorkspace } from '../PredictionWorkspace';

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('PredictionWorkspace — Focus Mode no-refetch (AP_MOUNT §E)', () => {
  it('entering and exiting focus mode calls zero Prediction network functions and preserves the active view; Esc exits', async () => {
    setFeatureFlagOverrides({ financePredictionWorkspaceV1: true });
    const draft = createEmptyScenarioDraft({ name: 'Scenariusz zachowany' });
    render(<PredictionWorkspace artifactId="artifact-1" initialDraft={draft} />);

    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('finance-workspace-bar-fullscreen'));
    await waitFor(() => expect(document.body.classList.contains('finance-focus-mode-active')).toBe(true));

    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Scenariusz zachowany');
    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.body.classList.contains('finance-focus-mode-active')).toBe(false));

    expect(apiMocks.runFinancePredictionPreflight).not.toHaveBeenCalled();
    expect(apiMocks.runFinancePredictionCalculate).not.toHaveBeenCalled();
    expect(screen.getByTestId('prediction-assumptions-view')).toBeInTheDocument();
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Scenariusz zachowany');
  });
});
