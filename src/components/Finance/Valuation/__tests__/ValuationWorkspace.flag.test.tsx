/**
 * @vitest-environment jsdom
 *
 * `ValuationWorkspace` — AP_MOUNT §A: the component reads its OWN flag
 * (`financeValuationWorkspaceV1`, default OFF) and gates on it BEFORE
 * mounting the `useEffect` that calls `api.getValuationVariant` on mount.
 *
 * Uses the component's own injectable `api` prop (its established DI
 * pattern — see the component's own header comment) instead of `vi.mock()`,
 * so the spies prove real call counts through the real prop path.
 *
 * Proves:
 *   - flag OFF (no override, i.e. real production default): renders nothing
 *     AND never calls `api.getValuationVariant`.
 *   - flag ON (local override): mounts and calls it.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

import type { ValuationWorkspaceApi } from '../ValuationWorkspace';
import { ValuationWorkspace } from '../ValuationWorkspace';

function fakeApi(): ValuationWorkspaceApi {
  return {
    getValuationVariant: vi.fn().mockResolvedValue({
      businessVersionId: 'bv-1', caseId: 'case-1', name: 'Wycena testowa', description: null,
      status: 'DRAFT', freshness: 'CURRENT', versionNo: 1, createdBy: 'user-1', createdAt: '2026-08-01T00:00:00Z',
    }),
    getFinanceVersionLineage: vi.fn().mockResolvedValue({ businessVersionId: 'bv-1', ancestors: [], descendants: [] }),
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

describe('ValuationWorkspace — flag gate (AP_MOUNT §A)', () => {
  it('OFF (default): renders nothing and never calls api.getValuationVariant', () => {
    const api = fakeApi();
    const { container } = render(<ValuationWorkspace businessVersionId="bv-1" api={api} />);
    expect(container).toBeEmptyDOMElement();
    expect(api.getValuationVariant).not.toHaveBeenCalled();
  });

  it('ON (local override): mounts and calls api.getValuationVariant', async () => {
    const api = fakeApi();
    setFeatureFlagOverrides({ financeValuationWorkspaceV1: true });
    render(<ValuationWorkspace businessVersionId="bv-1" api={api} />);
    expect(screen.getByTestId('valuation-workspace')).toBeInTheDocument();
    await waitFor(() => expect(api.getValuationVariant).toHaveBeenCalledTimes(1));
  });
});
