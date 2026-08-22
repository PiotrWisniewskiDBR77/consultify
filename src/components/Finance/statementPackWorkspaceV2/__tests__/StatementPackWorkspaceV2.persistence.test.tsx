/**
 * @vitest-environment jsdom
 *
 * `StatementPackWorkspaceV2` — AP_MOUNT §6 (persistence / cold reopen). Same
 * round-trip proof: commit a rename through the REAL handler -> real
 * `fetchers.renameArtifact` call with the real value -> unmount -> fresh
 * mount whose `getIdentity` fetcher now returns the renamed value ->
 * cold-reopened UI shows the persisted name.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

import {
  StatementPackWorkspaceV2,
  type StatementPackWorkspaceV2Fetchers,
} from '../StatementPackWorkspaceV2';

function fakeFetchers(name: string, renameArtifact = vi.fn()): StatementPackWorkspaceV2Fetchers {
  return {
    listLines: vi.fn().mockResolvedValue([]),
    getLineage: vi
      .fn()
      .mockResolvedValue({ businessVersionId: 'bv-1', ancestors: [], descendants: [] }),
    listReconciliationRuns: vi.fn().mockResolvedValue([]),
    getReconciliationRunDetail: vi.fn(),
    generateReportDraft: vi.fn(),
    publishReport: vi.fn(),
    getIdentity: vi.fn().mockResolvedValue({
      artifactId: 'art-1',
      name,
      status: 'DRAFT',
      freshness: 'CURRENT',
      versionNo: 1,
      version: 1,
    }),
    renameArtifact,
    transitionVersion: vi.fn(),
    approveModel: vi.fn(),
    reopenModel: vi.fn(),
  };
}

const resolveLineLabel = (rowKey: string) => rowKey;

afterEach(() => {
  clearFeatureFlagOverrides();
});

describe('StatementPackWorkspaceV2 — persistence + cold reopen (AP_MOUNT §6)', () => {
  it('uses the business-facing pack title instead of exposing a technical alias key', async () => {
    setFeatureFlagOverrides({ financeStatementPackWorkspaceV2: true });
    render(
      <StatementPackWorkspaceV2
        businessVersionId="bv-1"
        displayName="CD PROJEKT S.A."
        resolveLineLabel={resolveLineLabel}
        fetchers={fakeFetchers('financial_statement_packs:8b7b08b8-technical-id')}
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
        onOpenReportResult={() => {}}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent(
        'CD PROJEKT S.A.'
      )
    );
    expect(screen.queryByText(/financial_statement_packs:/)).not.toBeInTheDocument();
  });

  it('a committed rename is sent to the real fetcher, and a cold-reopened instance shows the persisted name', async () => {
    setFeatureFlagOverrides({ financeStatementPackWorkspaceV2: true });
    const renameArtifact = vi.fn().mockResolvedValue(undefined);
    const fetchers = fakeFetchers('Sprawozdanie — przed zmianą', renameArtifact);

    const { unmount } = render(
      <StatementPackWorkspaceV2
        businessVersionId="bv-1"
        resolveLineLabel={resolveLineLabel}
        fetchers={fetchers}
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
        onOpenReportResult={() => {}}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent(
        'Sprawozdanie — przed zmianą'
      )
    );

    fireEvent.click(screen.getByTestId('finance-workspace-bar-name'));
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'Sprawozdanie — PO zmianie' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(renameArtifact).toHaveBeenCalledWith('art-1', 'Sprawozdanie — PO zmianie')
    );

    // Cold reopen: unmount + fresh mount whose getIdentity now returns the persisted name.
    unmount();
    const freshFetchers = fakeFetchers('Sprawozdanie — PO zmianie');
    render(
      <StatementPackWorkspaceV2
        businessVersionId="bv-1"
        resolveLineLabel={resolveLineLabel}
        fetchers={freshFetchers}
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
        onOpenReportResult={() => {}}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent(
        'Sprawozdanie — PO zmianie'
      )
    );
    expect(screen.queryByText('Sprawozdanie — przed zmianą')).not.toBeInTheDocument();
  });
});
