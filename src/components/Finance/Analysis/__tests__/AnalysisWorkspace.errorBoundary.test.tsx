/**
 * @vitest-environment jsdom
 *
 * `AnalysisWorkspace` — AP_MOUNT §D (OWN-FIN-002): a crash inside the KPI
 * table content is caught by the LOCAL `FinanceErrorBoundary` added in this
 * task (the component had none before) — the bar (name, lifecycle, primary
 * action) lives OUTSIDE the boundary and survives.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

const apiMocks = vi.hoisted(() => ({
  getFinanceArtifact: vi.fn(),
  getFinanceBusinessVersion: vi.fn(),
  getAnalysisKpiValues: vi.fn(),
  getAnalysisKpiCatalog: vi.fn(),
  computeAnalysisKpis: vi.fn(),
  createFinanceArtifact: vi.fn(),
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn(),
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
}));
vi.mock('../../../../services/api/financeV2.api', () => apiMocks);

vi.mock('../AnalysisKpiTable', () => ({
  AnalysisKpiTable: () => {
    throw new Error('injected crash — proves FinanceErrorBoundary catches real render errors');
  },
}));

import { AnalysisWorkspace } from '../AnalysisWorkspace';

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('AnalysisWorkspace — FinanceErrorBoundary (AP_MOUNT §D)', () => {
  it('a crash in the KPI table is caught locally — the bar survives outside the boundary', async () => {
    apiMocks.getFinanceArtifact.mockResolvedValue({
      artifactId: 'art-1',
      naturalKey: 'Analiza testowa',
      currentBusinessVersion: null,
    });
    apiMocks.getFinanceBusinessVersion.mockResolvedValue({
      businessVersionId: 'bv-1',
      artifactId: 'art-1',
      versionNo: 1,
      version: 1,
      status: 'DRAFT',
      freshness: 'NEVER_COMPUTED',
    });
    apiMocks.getAnalysisKpiValues.mockResolvedValue([]);
    apiMocks.getAnalysisKpiCatalog.mockResolvedValue([]);
    setFeatureFlagOverrides({ financeAnalysisWorkspaceV1: true });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AnalysisWorkspace
        artifactId="art-1"
        businessVersionId="bv-1"
        role="preparer"
        onNavigateBack={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByTestId('finance-error-boundary')).toBeInTheDocument());
    // The bar is OUTSIDE the crashed content — name/identity is still live.
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Analiza testowa');

    consoleErrorSpy.mockRestore();
  });
});
