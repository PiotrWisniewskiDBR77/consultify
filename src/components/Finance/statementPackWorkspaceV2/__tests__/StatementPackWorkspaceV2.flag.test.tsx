/**
 * @vitest-environment jsdom
 *
 * `StatementPackWorkspaceV2` — AP_MOUNT §A: the component reads its OWN flag
 * (`financeStatementPackWorkspaceV2`, default OFF) and gates on it BEFORE
 * mounting the four `useEffect`s that fetch on mount (identity, lines,
 * lineage, reconciliation runs) — via the component's own injectable
 * `fetchers` prop (its established DI pattern), not `vi.mock()`.
 *
 * Proves:
 *   - flag OFF (no override, i.e. real production default): renders nothing
 *     AND never calls any injected fetcher.
 *   - flag ON (local override): mounts and calls `listLines`/`getIdentity`.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

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

describe('StatementPackWorkspaceV2 — flag gate (AP_MOUNT §A)', () => {
  it('OFF (default): renders nothing and never calls any injected fetcher', () => {
    const fetchers = fakeFetchers();
    const { container } = render(
      <StatementPackWorkspaceV2
        businessVersionId="bv-1"
        resolveLineLabel={resolveLineLabel}
        fetchers={fetchers}
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
        onOpenReportResult={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
    expect(fetchers.listLines).not.toHaveBeenCalled();
    expect(fetchers.getLineage).not.toHaveBeenCalled();
    expect(fetchers.listReconciliationRuns).not.toHaveBeenCalled();
    expect(fetchers.getIdentity).not.toHaveBeenCalled();
  });

  it('ON (local override): mounts and calls listLines + getIdentity', async () => {
    const fetchers = fakeFetchers();
    setFeatureFlagOverrides({ financeStatementPackWorkspaceV2: true });
    render(
      <StatementPackWorkspaceV2
        businessVersionId="bv-1"
        resolveLineLabel={resolveLineLabel}
        fetchers={fetchers}
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
        onOpenReportResult={() => {}}
      />
    );
    expect(screen.getByTestId('statement-pack-workspace-v2')).toBeInTheDocument();
    await waitFor(() => expect(fetchers.listLines).toHaveBeenCalledTimes(1));
    expect(fetchers.getIdentity).toHaveBeenCalledTimes(1);
  });
});
