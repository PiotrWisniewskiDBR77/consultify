import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platformEnabled: true,
  listVersions: vi.fn(),
  getVersion: vi.fn(),
  compareRequest: vi.fn(),
}));

vi.mock('@/hooks/useFinanceWorkspacePlatformFlag', () => ({
  useFinanceWorkspacePlatformFlag: () => ({ enabled: mocks.platformEnabled }),
}));
vi.mock('@/services/api/financeV2.api', () => ({
  listFinanceArtifactVersions: mocks.listVersions,
  getFinanceBusinessVersion: mocks.getVersion,
}));
vi.mock('../../comments/FinanceCommentsPanel', () => ({
  FinanceCommentsPanel: () => <div>comments-panel</div>,
}));
vi.mock('../../compare/FinanceComparePanel', () => ({
  FinanceComparePanel: ({ request }: { request: unknown }) => {
    mocks.compareRequest(request);
    return <div>compare-panel</div>;
  },
}));
vi.mock('../../exportImport/FinanceExportImportPanel', () => ({
  FinanceExportImportPanel: () => <div>exchange-panel</div>,
}));
vi.mock('../../lineage/FinanceLineageNavigator', () => ({
  FinanceLineageNavigator: () => <div>lineage-panel</div>,
}));
vi.mock('../../savedViews/FinanceSavedViewsPanel', () => ({
  FinanceSavedViewsPanel: () => <div>views-panel</div>,
}));

import { FinanceWorkspaceUtilities } from '../FinanceWorkspaceUtilities';

describe('FinanceWorkspaceUtilities production mount', () => {
  beforeEach(() => {
    mocks.platformEnabled = true;
    mocks.listVersions.mockResolvedValue([
      { businessVersionId: 'bv-current' },
      { businessVersionId: 'bv-previous' },
    ]);
    mocks.getVersion.mockResolvedValue({ workingRevisionId: 'rev-1' });
    mocks.compareRequest.mockClear();
  });

  it('is fail-closed behind the workspace platform flag', () => {
    mocks.platformEnabled = false;
    const { container } = render(
      <FinanceWorkspaceUtilities
        artifactId="art-1"
        businessVersionId="bv-current"
        artifactType="BASELINE_MODEL"
      />
    );
    expect(container).toBeEmptyDOMElement();
    expect(mocks.listVersions).not.toHaveBeenCalled();
  });

  it('exposes all five tools and compares the current version with a distinct prior version', async () => {
    render(
      <FinanceWorkspaceUtilities
        artifactId="art-1"
        businessVersionId="bv-current"
        artifactType="BASELINE_MODEL"
      />
    );
    for (const label of ['Powiązania', 'Porównaj', 'Komentarze', 'Widoki', 'Excel']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    await waitFor(() => expect(mocks.listVersions).toHaveBeenCalledWith('art-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Porównaj' }));
    expect(await screen.findByText('compare-panel')).toBeInTheDocument();
    expect(mocks.compareRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'versions',
        params: expect.objectContaining({
          businessVersionIdA: 'bv-previous',
          businessVersionIdB: 'bv-current',
        }),
      })
    );
  });
});
