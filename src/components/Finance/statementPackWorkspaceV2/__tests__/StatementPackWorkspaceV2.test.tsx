/**
 * @vitest-environment jsdom
 *
 * `StatementPackWorkspaceV2` — integration tests over the REAL sub-components
 * (no re-implementation), with injected fetchers standing in for the network
 * (same pattern as `ValueOfficePanel.valueBridgeFetcher`, no `window.fetch`
 * mocking needed).
 *
 * ★ Proves brief pkt 4 END-TO-END: clicking a presented number in the table
 * reveals its FinanceValue.sourceRef (step 1) AND, once a reconciliation run
 * is selected, its mapping row (step 2) — from presentation back to source,
 * through the assembled workspace, not just in isolated unit tests.
 *
 * ★ Proves brief pkt 8 END-TO-END: the three report actions actually call
 * the real API client shape (createFinanceArtifact-shaped draft ->
 * onOpenReportResult callback -> transitionFinanceVersion-shaped publish),
 * wired through real component state, not just the presentational gating
 * tested in isolation.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type {
  LineageEdgeDto,
  ReconciliationRunDetailDto,
  ReconciliationRunSummaryDto,
  StatementLineDto,
  VersionLineageDto,
} from '@/services/api/financeV2.types';

import {
  StatementPackWorkspaceV2,
  type ReportArtifactRef,
  type StatementPackWorkspaceV2Fetchers,
} from '../StatementPackWorkspaceV2';

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
      status: 'PRESENT_NONZERO',
      valueDecimal: '1000000',
      nativeCurrency: 'PLN',
      presentationCurrency: 'PLN',
      unit: 'THOUSANDS',
      multiplier: '1',
      sourceRef: { page: 3, row: 12 },
      isAdjustment: false,
      adjustmentReason: null,
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

const resolveLineLabel = (rowKey: string, canonicalLineId: string | null, lineCode: string | null) =>
  lineCode || canonicalLineId || rowKey;

function makeFetchers(overrides: Partial<StatementPackWorkspaceV2Fetchers> = {}): StatementPackWorkspaceV2Fetchers {
  return {
    listLines: vi.fn(async () => [line({ stmtLineId: 'l1' })]),
    getLineage: vi.fn(async (): Promise<VersionLineageDto> => ({ businessVersionId: 'bv-1', ancestors: [], descendants: [] })),
    listReconciliationRuns: vi.fn(async (): Promise<ReconciliationRunSummaryDto[]> => []),
    getReconciliationRunDetail: vi.fn(async (): Promise<ReconciliationRunDetailDto> => {
      throw new Error('not configured in this test');
    }),
    generateReportDraft: vi.fn(async (): Promise<ReportArtifactRef> => ({
      artifactId: 'report-1',
      businessVersionId: 'bv-report-1',
      version: 1,
    })),
    publishReport: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('StatementPackWorkspaceV2 — assembly renders real data via injected fetchers', () => {
  it('renders the table once lines resolve, and the empty-lookup evidence panel before any cell is selected', async () => {
    const fetchers = makeFetchers();
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
    await waitFor(() => expect(screen.getByTestId('canonical-statement-table-v2')).toBeInTheDocument());
    expect(screen.getByTestId('source-evidence-panel-empty')).toBeInTheDocument();
  });
});

describe('StatementPackWorkspaceV2 — chain proof (source -> mapping -> canonical line -> presentation)', () => {
  it('clicking a presented cell shows step-1 evidence (sourceRef) immediately, then step-2 mapping once a reconciliation run is selected', async () => {
    const runs: ReconciliationRunSummaryDto[] = [
      {
        reconciliationRunId: 'run-1',
        artifactId: 'artifact-1',
        businessVersionId: 'bv-1',
        sourceSystem: 'SAP_EXPORT',
        status: 'completed',
        resultQuality: 'CLEAN',
        totals: {
          sourceTotal: '1000000',
          mappedTotal: '1000000',
          excludedTotal: '0',
          unmappedTotal: '0',
          duplicateTotal: '0',
          reclassNetTotal: '0',
          eliminationNetTotal: '0',
          canonicalTotal: '1000000',
          residual: '0',
          residualPct: '0.00',
        },
        materialityThresholdApplied: '0.5',
        sourceValueCoveragePct: '100.00',
        linkedExceptionId: null,
        coverageExceptionId: null,
        createdAt: '2026-08-11T00:00:00.000Z',
        createdBy: 'user-1',
      },
    ];
    const detail: ReconciliationRunDetailDto = {
      reconciliationRunId: 'run-1',
      artifactId: 'artifact-1',
      businessVersionId: 'bv-1',
      sourceSystem: 'SAP_EXPORT',
      status: 'completed',
      resultQuality: 'CLEAN',
      residual: '0',
      residualPct: '0.00',
      createdAt: '2026-08-11T00:00:00.000Z',
      rows: [
        {
          id: 'row-1',
          canonicalLineId: 'canon-revenue',
          entityId: 'entity-1',
          periodId: 'period-1',
          bucket: 'MAPPED',
          sourceAmount: '1000000',
          mappedAmount: '1000000',
          duplicateOfRowId: null,
          reclassTargetLineId: null,
          eliminationCounterpartyEntityId: null,
          reasonCode: null,
          sourceRowRef: { file: 'trial_balance.csv', row: 42 },
        },
      ],
    };
    const fetchers = makeFetchers({
      listReconciliationRuns: vi.fn(async () => runs),
      getReconciliationRunDetail: vi.fn(async () => detail),
    });

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

    await waitFor(() => expect(screen.getByTestId('canonical-statement-table-v2')).toBeInTheDocument());

    // Click the presented cell — step 1 (sourceRef) must appear immediately.
    fireEvent.click(screen.getByTestId('canonical-statement-cell-canon-revenue::period-1'));
    await waitFor(() => expect(screen.getByTestId('source-evidence-ref')).toBeInTheDocument());
    expect(screen.getByTestId('source-evidence-ref')).toHaveTextContent('page');
    // Step 2 (mapping) not yet looked up — no reconciliation run selected.
    expect(screen.queryByTestId('source-evidence-mapping')).not.toBeInTheDocument();

    // Open the reconciliation section — auto-selects the first run in this assembly.
    fireEvent.click(screen.getByTestId('named-collapsible-trigger-reconciliation'));
    await waitFor(() => expect(screen.getByTestId('source-evidence-mapping-row')).toBeInTheDocument());
    // Step 2 proof: the SAME cell's mapping row is now visible, tying source -> mapping -> canonical line -> presentation.
    expect(screen.getByTestId('source-evidence-mapping-bucket')).toHaveTextContent('MAPPED');
    expect(screen.getByTestId('source-evidence-mapping-source-row-ref')).toHaveTextContent('trial_balance.csv');
  });

  // KONTROLA NEGATYWNA: a mapping row for a DIFFERENT period must NOT show up as this cell's evidence.
  it('NEGATIVE CONTROL — a reconciliation row for a different period is not shown as this cell\'s mapping evidence', async () => {
    const runs: ReconciliationRunSummaryDto[] = [
      {
        reconciliationRunId: 'run-1',
        artifactId: 'artifact-1',
        businessVersionId: 'bv-1',
        sourceSystem: 'SAP_EXPORT',
        status: 'completed',
        resultQuality: 'CLEAN',
        totals: {
          sourceTotal: null,
          mappedTotal: null,
          excludedTotal: null,
          unmappedTotal: null,
          duplicateTotal: null,
          reclassNetTotal: null,
          eliminationNetTotal: null,
          canonicalTotal: null,
          residual: null,
          residualPct: null,
        },
        materialityThresholdApplied: null,
        sourceValueCoveragePct: null,
        linkedExceptionId: null,
        coverageExceptionId: null,
        createdAt: '2026-08-11T00:00:00.000Z',
        createdBy: 'user-1',
      },
    ];
    const detail: ReconciliationRunDetailDto = {
      reconciliationRunId: 'run-1',
      artifactId: 'artifact-1',
      businessVersionId: 'bv-1',
      sourceSystem: 'SAP_EXPORT',
      status: 'completed',
      resultQuality: 'CLEAN',
      residual: null,
      residualPct: null,
      createdAt: '2026-08-11T00:00:00.000Z',
      rows: [
        {
          id: 'row-other-period',
          canonicalLineId: 'canon-revenue',
          entityId: 'entity-1',
          periodId: 'period-DIFFERENT',
          bucket: 'MAPPED',
          sourceAmount: '999',
          mappedAmount: '999',
          duplicateOfRowId: null,
          reclassTargetLineId: null,
          eliminationCounterpartyEntityId: null,
          reasonCode: null,
          sourceRowRef: null,
        },
      ],
    };
    const fetchers = makeFetchers({
      listReconciliationRuns: vi.fn(async () => runs),
      getReconciliationRunDetail: vi.fn(async () => detail),
    });

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
    await waitFor(() => expect(screen.getByTestId('canonical-statement-table-v2')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('canonical-statement-cell-canon-revenue::period-1'));
    fireEvent.click(screen.getByTestId('named-collapsible-trigger-reconciliation'));
    await waitFor(() => expect(screen.getByTestId('source-evidence-mapping')).toBeInTheDocument());
    // Honest "no match" — NOT a fabricated cross-period match.
    expect(screen.getByTestId('source-evidence-mapping-missing')).toBeInTheDocument();
  });
});

describe('StatementPackWorkspaceV2 — report actions wired to the real client shape', () => {
  it('the full sequence calls generateReportDraft -> onOpenReportResult -> publishReport with the SAME artifact ref', async () => {
    const onOpenReportResult = vi.fn();
    const fetchers = makeFetchers();
    render(
      <StatementPackWorkspaceV2
        businessVersionId="bv-1"
        resolveLineLabel={resolveLineLabel}
        fetchers={fetchers}
        onOpenArtifact={() => {}}
        onCreateNew={() => {}}
        onOpenReportResult={onOpenReportResult}
      />
    );
    await waitFor(() => expect(screen.getByTestId('canonical-statement-table-v2')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('statement-report-step-button-draft'));
    expect(fetchers.generateReportDraft).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('statement-report-step-button-open')).not.toBeDisabled());

    fireEvent.click(screen.getByTestId('statement-report-step-button-open'));
    expect(onOpenReportResult).toHaveBeenCalledWith({ artifactId: 'report-1', businessVersionId: 'bv-report-1', version: 1 });
    await waitFor(() => expect(screen.getByTestId('statement-report-step-button-publish')).not.toBeDisabled());

    fireEvent.click(screen.getByTestId('statement-report-step-button-publish'));
    await waitFor(() =>
      expect(fetchers.publishReport).toHaveBeenCalledWith({ artifactId: 'report-1', businessVersionId: 'bv-report-1', version: 1 })
    );
    await waitFor(() => expect(screen.getByTestId('statement-report-step-status-publish')).toHaveTextContent('Opublikowano'));
  });

  it('step 3 is never reachable without going through step 2 — clicking publish before opening does nothing (button stays disabled)', async () => {
    const fetchers = makeFetchers();
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
    await waitFor(() => expect(screen.getByTestId('canonical-statement-table-v2')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('statement-report-step-button-draft'));
    await waitFor(() => expect(screen.getByTestId('statement-report-step-button-open')).not.toBeDisabled());

    // Skip step 2 — publish must still be disabled.
    expect(screen.getByTestId('statement-report-step-button-publish')).toBeDisabled();
    fireEvent.click(screen.getByTestId('statement-report-step-button-publish'));
    expect(fetchers.publishReport).not.toHaveBeenCalled();
  });

  it('a generateReportDraft failure surfaces the real error text and keeps step 2/3 blocked', async () => {
    const fetchers = makeFetchers({
      generateReportDraft: vi.fn(async () => {
        throw new Error('Serwer odrzucił żądanie (500)');
      }),
    });
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
    await waitFor(() => expect(screen.getByTestId('canonical-statement-table-v2')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('statement-report-step-button-draft'));
    await waitFor(() =>
      expect(screen.getByTestId('statement-report-step-status-draft')).toHaveTextContent('Serwer odrzucił żądanie (500)')
    );
    expect(screen.getByTestId('statement-report-step-button-open')).toBeDisabled();
  });
});
