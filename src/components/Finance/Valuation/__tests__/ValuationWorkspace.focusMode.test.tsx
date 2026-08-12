/**
 * @vitest-environment jsdom
 *
 * `ValuationWorkspace` — AP_MOUNT §E (OWN-FIN-004): entering/exiting focus
 * mode must not fire any NEW `api.*` call and must preserve the active step;
 * `Esc` exits.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

import type { ValuationWorkspaceApi } from '../ValuationWorkspace';
import { ValuationWorkspace } from '../ValuationWorkspace';

const BV_ID = 'bv-focus-1';

function fakeApi(): ValuationWorkspaceApi {
  return {
    getValuationVariant: vi.fn().mockResolvedValue({
      businessVersionId: BV_ID,
      caseId: 'case-1',
      name: 'Wycena Focus Mode',
      description: null,
      status: 'DRAFT',
      freshness: 'CURRENT',
      versionNo: 1,
      createdBy: 'user-1',
      createdAt: '2026-08-01T00:00:00Z',
    }),
    getFinanceVersionLineage: vi
      .fn()
      .mockResolvedValue({ businessVersionId: BV_ID, ancestors: [], descendants: [] }),
    getValuationWaccInputs: vi.fn().mockResolvedValue(null),
    upsertValuationWaccInputs: vi.fn(),
    listValuationMethods: vi.fn().mockResolvedValue({ methods: [], weightedRecommendation: {} }),
    createValuationMethod: vi.fn(),
    setValuationMethodBasketWeights: vi.fn(),
    getValuationResults: vi.fn().mockResolvedValue(null),
    getValuationSensitivityGrid: vi.fn(),
    generateValuationAdvisorOutput: vi.fn(),
    listValuationAdvisorOutputs: vi.fn().mockResolvedValue(null),
  } as unknown as ValuationWorkspaceApi;
}

afterEach(() => {
  clearFeatureFlagOverrides();
});

describe('ValuationWorkspace — Focus Mode no-refetch (AP_MOUNT §E)', () => {
  it('entering and exiting focus mode fires zero additional api calls and preserves the active step; Esc exits', async () => {
    setFeatureFlagOverrides({ financeValuationWorkspaceV1: true });
    const api = fakeApi();
    render(<ValuationWorkspace businessVersionId={BV_ID} api={api} initialStepId="source" />);

    await waitFor(() => expect(api.getValuationVariant).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.getFinanceVersionLineage).toHaveBeenCalledTimes(1));
    const totalBefore = (Object.values(api) as ReturnType<typeof vi.fn>[]).reduce(
      (sum, fn) => sum + fn.mock.calls.length,
      0
    );

    expect(screen.getByTestId('valuation-source-step')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('finance-workspace-bar-fullscreen'));
    await waitFor(() =>
      expect(document.body.classList.contains('finance-focus-mode-active')).toBe(true)
    );

    const totalAfterEnter = (Object.values(api) as ReturnType<typeof vi.fn>[]).reduce(
      (sum, fn) => sum + fn.mock.calls.length,
      0
    );
    expect(totalAfterEnter).toBe(totalBefore);
    expect(screen.getByTestId('valuation-source-step')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(document.body.classList.contains('finance-focus-mode-active')).toBe(false)
    );

    const totalAfterExit = (Object.values(api) as ReturnType<typeof vi.fn>[]).reduce(
      (sum, fn) => sum + fn.mock.calls.length,
      0
    );
    expect(totalAfterExit).toBe(totalBefore);
    expect(screen.getByTestId('valuation-source-step')).toBeInTheDocument();
  });
});
