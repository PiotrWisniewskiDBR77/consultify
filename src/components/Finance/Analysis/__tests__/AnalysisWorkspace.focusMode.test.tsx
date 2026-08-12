/**
 * @vitest-environment jsdom
 *
 * `AnalysisWorkspace` — AP_MOUNT §E (OWN-FIN-004): entering/exiting focus
 * mode must not fire any NEW `reload()` call and must preserve UI state
 * (here: an open Creator wizard, since this workspace has one view / no
 * tabs); `Esc` exits.
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

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('AnalysisWorkspace — Focus Mode no-refetch (AP_MOUNT §E)', () => {
  it('entering and exiting focus mode calls reload() zero additional times and preserves the open wizard; Esc exits', async () => {
    apiMocks.getFinanceArtifact.mockResolvedValue({ artifactId: 'art-1', naturalKey: 'Analiza', currentBusinessVersion: null });
    apiMocks.getFinanceBusinessVersion.mockResolvedValue({
      businessVersionId: 'bv-1', artifactId: 'art-1', versionNo: 1, version: 1, status: 'DRAFT', freshness: 'NEVER_COMPUTED',
    });
    apiMocks.getAnalysisKpiValues.mockResolvedValue([]);
    apiMocks.getAnalysisKpiCatalog.mockResolvedValue([]);
    setFeatureFlagOverrides({ financeAnalysisWorkspaceV1: true });

    render(<AnalysisWorkspace artifactId="art-1" businessVersionId="bv-1" role="preparer" onNavigateBack={() => {}} />);
    await waitFor(() => expect(apiMocks.getFinanceArtifact).toHaveBeenCalledTimes(1));

    // Open the wizard (UI state that must survive focus-mode toggling). Two
    // elements share this text (bar primary CTA + StandardTable empty-state
    // action) — same disambiguation as AnalysisWorkspace.smoke.test.tsx.
    const ctaButtons = await screen.findAllByText('Skonfiguruj wskaźniki');
    fireEvent.click(ctaButtons[ctaButtons.length - 1]!);
    await waitFor(() => expect(screen.getByTestId('analysis-creator-wizard')).toBeInTheDocument());

    const callsBefore = apiMocks.getFinanceArtifact.mock.calls.length + apiMocks.getAnalysisKpiValues.mock.calls.length;

    fireEvent.click(screen.getByTestId('finance-workspace-bar-fullscreen'));
    await waitFor(() => expect(document.body.classList.contains('finance-focus-mode-active')).toBe(true));

    expect(apiMocks.getFinanceArtifact.mock.calls.length + apiMocks.getAnalysisKpiValues.mock.calls.length).toBe(callsBefore);
    expect(screen.getByTestId('analysis-creator-wizard')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.body.classList.contains('finance-focus-mode-active')).toBe(false));

    expect(apiMocks.getFinanceArtifact.mock.calls.length + apiMocks.getAnalysisKpiValues.mock.calls.length).toBe(callsBefore);
    expect(screen.getByTestId('analysis-creator-wizard')).toBeInTheDocument();
  });
});
