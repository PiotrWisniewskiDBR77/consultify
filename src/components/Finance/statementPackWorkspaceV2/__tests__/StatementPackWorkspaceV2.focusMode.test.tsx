/**
 * @vitest-environment jsdom
 *
 * `StatementPackWorkspaceV2` — AP_MOUNT §E (OWN-FIN-004): entering/exiting
 * focus mode must not fire any NEW fetcher call and must preserve the
 * selected cell (SourceEvidencePanel's selection); `Esc` exits.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearFeatureFlagOverrides, setFeatureFlagOverrides } from '@/test-utils/featureFlagOverrides';

import { StatementPackWorkspaceV2, type StatementPackWorkspaceV2Fetchers } from '../StatementPackWorkspaceV2';
import type { StatementLineDto } from '@/services/api/financeV2.types';

function line(overrides: Partial<StatementLineDto> & { stmtLineId: string }): StatementLineDto {
  return {
    statementType: 'P&L',
    canonicalLineId: 'canon-revenue',
    lineCode: 'REVENUE',
    entityId: 'entity-1',
    entityCode: 'PARENT',
    periodId: 'period-1',
    periodLabel: 'FY2025',
    accumulationBasis: 'FULL_YEAR',
    consolidationScope: 'CONSOLIDATED',
    value: {
      status: 'PRESENT_NONZERO', valueDecimal: '1000000', nativeCurrency: 'PLN', presentationCurrency: 'PLN',
      unit: 'THOUSANDS', multiplier: '1', sourceRef: { page: 3, row: 12 }, isAdjustment: false, adjustmentReason: null,
    },
    signConvention: 'NATURAL',
    accountingPolicy: 'IFRS',
    reclassifiedFromLineId: null,
    createdBy: 'user-1',
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

function fakeFetchers(): StatementPackWorkspaceV2Fetchers {
  return {
    listLines: vi.fn().mockResolvedValue([line({ stmtLineId: 'l1' })]),
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

const resolveLineLabel = (rowKey: string, canonicalLineId: string | null, lineCode: string | null) =>
  lineCode || canonicalLineId || rowKey;

afterEach(() => {
  clearFeatureFlagOverrides();
});

describe('StatementPackWorkspaceV2 — Focus Mode no-refetch (AP_MOUNT §E)', () => {
  it('entering and exiting focus mode fires zero additional fetcher calls and preserves the selected cell; Esc exits', async () => {
    setFeatureFlagOverrides({ financeStatementPackWorkspaceV2: true });
    const fetchers = fakeFetchers();
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

    await waitFor(() => expect(fetchers.listLines).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('canonical-statement-table-v2')).toBeInTheDocument());

    // Select a cell — this is the state Focus Mode must preserve.
    fireEvent.click(screen.getByTestId('canonical-statement-cell-canon-revenue::period-1'));
    await waitFor(() => expect(screen.queryByTestId('source-evidence-panel-empty')).not.toBeInTheDocument());

    const callsBefore =
      (fetchers.listLines as ReturnType<typeof vi.fn>).mock.calls.length +
      (fetchers.getLineage as ReturnType<typeof vi.fn>).mock.calls.length +
      (fetchers.listReconciliationRuns as ReturnType<typeof vi.fn>).mock.calls.length +
      (fetchers.getIdentity as ReturnType<typeof vi.fn>).mock.calls.length;

    fireEvent.click(screen.getByTestId('finance-workspace-bar-fullscreen'));
    await waitFor(() => expect(document.body.classList.contains('finance-focus-mode-active')).toBe(true));

    const callsAfterEnter =
      (fetchers.listLines as ReturnType<typeof vi.fn>).mock.calls.length +
      (fetchers.getLineage as ReturnType<typeof vi.fn>).mock.calls.length +
      (fetchers.listReconciliationRuns as ReturnType<typeof vi.fn>).mock.calls.length +
      (fetchers.getIdentity as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfterEnter).toBe(callsBefore);
    expect(screen.queryByTestId('source-evidence-panel-empty')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.body.classList.contains('finance-focus-mode-active')).toBe(false));

    const callsAfterExit =
      (fetchers.listLines as ReturnType<typeof vi.fn>).mock.calls.length +
      (fetchers.getLineage as ReturnType<typeof vi.fn>).mock.calls.length +
      (fetchers.listReconciliationRuns as ReturnType<typeof vi.fn>).mock.calls.length +
      (fetchers.getIdentity as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfterExit).toBe(callsBefore);
    expect(screen.queryByTestId('source-evidence-panel-empty')).not.toBeInTheDocument();
  });
});
