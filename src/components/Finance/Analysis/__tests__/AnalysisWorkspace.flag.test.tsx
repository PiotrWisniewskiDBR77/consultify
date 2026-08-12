/**
 * @vitest-environment jsdom
 *
 * `AnalysisWorkspace` — AP_MOUNT §A: the component reads its OWN flag
 * (`financeAnalysisWorkspaceV1`, default OFF) and gates on it BEFORE
 * mounting the `reload()` effect — which fires FOUR parallel network calls
 * on mount (`getFinanceArtifact`/`getFinanceBusinessVersion`/
 * `getAnalysisKpiValues`/`getAnalysisKpiCatalog`). This is the single most
 * important gate in the AP_MOUNT program: before this fix, this component
 * would fire real network calls the instant it was ever rendered, flag or
 * no flag — because it never read its own flag in the first place.
 *
 * Proves:
 *   - flag OFF (no override, i.e. real production default): renders nothing
 *     AND never calls any of the four load functions.
 *   - flag ON (local override): mounts and calls them.
 */
import { render, screen, waitFor } from '@testing-library/react';
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

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('AnalysisWorkspace — flag gate (AP_MOUNT §A)', () => {
  it('OFF (default): renders nothing and calls zero of the four mount-time load functions', () => {
    const { container } = render(
      <AnalysisWorkspace artifactId="art-1" businessVersionId="bv-1" role="preparer" onNavigateBack={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(apiMocks.getFinanceArtifact).not.toHaveBeenCalled();
    expect(apiMocks.getFinanceBusinessVersion).not.toHaveBeenCalled();
    expect(apiMocks.getAnalysisKpiValues).not.toHaveBeenCalled();
    expect(apiMocks.getAnalysisKpiCatalog).not.toHaveBeenCalled();
  });

  it('ON (local override): mounts and calls the four load functions', async () => {
    apiMocks.getFinanceArtifact.mockResolvedValue({ artifactId: 'art-1', naturalKey: 'Analiza', currentBusinessVersion: null });
    apiMocks.getFinanceBusinessVersion.mockResolvedValue({
      businessVersionId: 'bv-1', artifactId: 'art-1', versionNo: 1, version: 1, status: 'DRAFT', freshness: 'NEVER_COMPUTED',
    });
    apiMocks.getAnalysisKpiValues.mockResolvedValue([]);
    apiMocks.getAnalysisKpiCatalog.mockResolvedValue([]);
    setFeatureFlagOverrides({ financeAnalysisWorkspaceV1: true });
    render(<AnalysisWorkspace artifactId="art-1" businessVersionId="bv-1" role="preparer" onNavigateBack={() => {}} />);
    expect(screen.getByTestId('analysis-workspace')).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.getFinanceArtifact).toHaveBeenCalledTimes(1));
    expect(apiMocks.getFinanceBusinessVersion).toHaveBeenCalledTimes(1);
    expect(apiMocks.getAnalysisKpiValues).toHaveBeenCalledTimes(1);
    expect(apiMocks.getAnalysisKpiCatalog).toHaveBeenCalledTimes(1);
  });
});
