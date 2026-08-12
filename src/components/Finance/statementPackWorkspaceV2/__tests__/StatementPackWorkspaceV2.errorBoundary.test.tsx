/**
 * @vitest-environment jsdom
 *
 * `StatementPackWorkspaceV2` — AP_MOUNT §D (OWN-FIN-002): a crash inside the
 * canonical statement table content is caught by the LOCAL
 * `FinanceErrorBoundary` added in this task (the component had NEITHER a
 * bar NOR a boundary before) — the bar (name, lifecycle) lives OUTSIDE the
 * boundary and survives.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

vi.mock('../CanonicalStatementTableV2', () => ({
  CanonicalStatementTableV2: () => {
    throw new Error('injected crash — proves FinanceErrorBoundary catches real render errors');
  },
}));

import { StatementPackWorkspaceV2, type StatementPackWorkspaceV2Fetchers } from '../StatementPackWorkspaceV2';

function fakeFetchers(): StatementPackWorkspaceV2Fetchers {
  return {
    listLines: vi.fn().mockResolvedValue([]),
    getLineage: vi.fn().mockResolvedValue({ businessVersionId: 'bv-1', ancestors: [], descendants: [] }),
    listReconciliationRuns: vi.fn().mockResolvedValue([]),
    getReconciliationRunDetail: vi.fn(),
    generateReportDraft: vi.fn(),
    publishReport: vi.fn(),
    getIdentity: vi.fn().mockResolvedValue({
      artifactId: 'art-1', name: 'Sprawozdanie testowe', status: 'DRAFT', freshness: 'CURRENT', versionNo: 1, version: 1,
    }),
    renameArtifact: vi.fn(),
    transitionVersion: vi.fn(),
    approveModel: vi.fn(),
    reopenModel: vi.fn(),
  };
}

const resolveLineLabel = (rowKey: string) => rowKey;

afterEach(() => {
  clearFeatureFlagOverrides();
});

describe('StatementPackWorkspaceV2 — FinanceErrorBoundary (AP_MOUNT §D)', () => {
  it('a crash in the statement table is caught locally — the bar survives outside the boundary', async () => {
    setFeatureFlagOverrides({ financeStatementPackWorkspaceV2: true });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StatementPackWorkspaceV2
        businessVersionId="bv-1"
        resolveLineLabel={resolveLineLabel}
        fetchers={fakeFetchers()}
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
        onOpenReportResult={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByTestId('finance-error-boundary')).toBeInTheDocument());
    expect(screen.getByTestId('finance-workspace-bar-name')).toHaveTextContent('Sprawozdanie testowe');

    consoleErrorSpy.mockRestore();
  });
});
