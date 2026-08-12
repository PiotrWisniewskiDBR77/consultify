/**
 * @vitest-environment jsdom
 *
 * `AnalysisWorkspace` — AP_MOUNT §6 (persistence / cold reopen). Same
 * round-trip proof as BaselineWorkspace.persistence.test.tsx: commit a
 * rename through the REAL handler -> real API call with the real value ->
 * unmount (no client state survives) -> fresh mount whose GET mocks now
 * return the renamed value -> cold-reopened UI shows the persisted name.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

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

import { AnalysisWorkspace } from '../AnalysisWorkspace';

const BUSINESS_VERSION = {
  businessVersionId: 'bv-1', artifactId: 'art-1', versionNo: 1, version: 1, status: 'DRAFT' as const, freshness: 'NEVER_COMPUTED' as const,
};

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('AnalysisWorkspace — persistence + cold reopen (AP_MOUNT §6)', () => {
  it('a committed rename is sent to the real API, and a cold-reopened instance shows the persisted name', async () => {
    setFeatureFlagOverrides({ financeAnalysisWorkspaceV1: true });
    apiMocks.getFinanceArtifact.mockResolvedValue({ artifactId: 'art-1', naturalKey: 'Analiza — przed zmianą', currentBusinessVersion: null });
    apiMocks.getFinanceBusinessVersion.mockResolvedValue(BUSINESS_VERSION);
    apiMocks.getAnalysisKpiValues.mockResolvedValue([]);
    apiMocks.getAnalysisKpiCatalog.mockResolvedValue([]);
    apiMocks.renameFinanceArtifact.mockResolvedValue({ artifactId: 'art-1', naturalKey: 'Analiza — PO zmianie' });

    const { unmount } = render(<AnalysisWorkspace artifactId="art-1" businessVersionId="bv-1" role="preparer" onNavigateBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Analiza — przed zmianą'));

    fireEvent.click(screen.getByTestId('finance-workspace-bar-name'));
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'Analiza — PO zmianie' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(apiMocks.renameFinanceArtifact).toHaveBeenCalledWith('art-1', 'Analiza — PO zmianie'));

    // Cold reopen: unmount + fresh mount whose GET now returns the persisted name.
    unmount();
    vi.clearAllMocks();
    apiMocks.getFinanceArtifact.mockResolvedValue({ artifactId: 'art-1', naturalKey: 'Analiza — PO zmianie', currentBusinessVersion: null });
    apiMocks.getFinanceBusinessVersion.mockResolvedValue(BUSINESS_VERSION);
    apiMocks.getAnalysisKpiValues.mockResolvedValue([]);
    apiMocks.getAnalysisKpiCatalog.mockResolvedValue([]);

    render(<AnalysisWorkspace artifactId="art-1" businessVersionId="bv-1" role="preparer" onNavigateBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Analiza — PO zmianie'));
    expect(screen.queryByText('Analiza — przed zmianą')).not.toBeInTheDocument();
  });
});
