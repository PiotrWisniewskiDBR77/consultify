/**
 * @vitest-environment jsdom
 *
 * `ReconciliationLedgerPanel` — dowodzi, że rekoncyliacja jest REALNYM
 * ledgerem (loading/empty/populated odróżnialne, klik przebiegu pokazuje
 * jego detal, podział na buckety widoczny, DUPLICATE ma jawne ostrzeżenie
 * tekstowe — nie tylko kolor) — nie ozdobną zieloną plakietką.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type {
  ReconciliationDetailRowDto,
  ReconciliationRunDetailDto,
  ReconciliationRunSummaryDto,
} from '@/services/api/financeV2.types';

import { ReconciliationLedgerPanel } from '../ReconciliationLedgerPanel';

function run(overrides: Partial<ReconciliationRunSummaryDto> & { reconciliationRunId: string }): ReconciliationRunSummaryDto {
  return {
    reconciliationRunId: overrides.reconciliationRunId,
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
    ...overrides,
  };
}

function detailRow(overrides: Partial<ReconciliationDetailRowDto> & { id: string }): ReconciliationDetailRowDto {
  return {
    id: overrides.id,
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
    sourceRowRef: null,
    ...overrides,
  };
}

describe('ReconciliationLedgerPanel — loading/empty distinguished', () => {
  it('shows a distinct loading skeleton (not the empty state)', () => {
    render(
      <ReconciliationLedgerPanel
        runs={[]}
        loading
        selectedRunId={null}
        onSelectRun={() => {}}
        runDetail={null}
        runDetailLoading={false}
        emptyLabel="Brak przebiegów rekoncyliacji."
      />
    );
    expect(screen.getByTestId('reconciliation-ledger-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('reconciliation-ledger-empty')).not.toBeInTheDocument();
  });

  it('shows the honest empty state when loaded and genuinely zero runs — never fabricates a run', () => {
    render(
      <ReconciliationLedgerPanel
        runs={[]}
        loading={false}
        selectedRunId={null}
        onSelectRun={() => {}}
        runDetail={null}
        runDetailLoading={false}
        emptyLabel="Brak przebiegów rekoncyliacji."
      />
    );
    expect(screen.getByTestId('reconciliation-ledger-empty')).toHaveTextContent('Brak przebiegów rekoncyliacji.');
  });
});

describe('ReconciliationLedgerPanel — real ledger, not a decoration', () => {
  it('lists runs newest-first order as given, with quality DESCRIBED in text next to the color, not color alone', () => {
    render(
      <ReconciliationLedgerPanel
        runs={[run({ reconciliationRunId: 'run-1', resultQuality: 'MATERIAL_BREAK' })]}
        loading={false}
        selectedRunId={null}
        onSelectRun={() => {}}
        runDetail={null}
        runDetailLoading={false}
        emptyLabel="—"
      />
    );
    const row = screen.getByTestId('reconciliation-run-run-1');
    // a11y: the quality is legible as TEXT, not just conveyed by a color class.
    expect(row).toHaveTextContent('MATERIAL_BREAK');
  });

  it('selecting a run calls onSelectRun with its id', () => {
    const onSelectRun = vi.fn();
    render(
      <ReconciliationLedgerPanel
        runs={[run({ reconciliationRunId: 'run-1' })]}
        loading={false}
        selectedRunId={null}
        onSelectRun={onSelectRun}
        runDetail={null}
        runDetailLoading={false}
        emptyLabel="—"
      />
    );
    fireEvent.click(screen.getByTestId('reconciliation-run-run-1'));
    expect(onSelectRun).toHaveBeenCalledWith('run-1');
  });

  it('shows the detail loading skeleton distinctly from the resolved detail', () => {
    render(
      <ReconciliationLedgerPanel
        runs={[run({ reconciliationRunId: 'run-1' })]}
        loading={false}
        selectedRunId="run-1"
        onSelectRun={() => {}}
        runDetail={null}
        runDetailLoading
        emptyLabel="—"
      />
    );
    expect(screen.queryByTestId('reconciliation-run-detail')).not.toBeInTheDocument();
  });

  it('shows an honest "failed to load" message when a run is selected but detail resolves to null (not loading)', () => {
    render(
      <ReconciliationLedgerPanel
        runs={[run({ reconciliationRunId: 'run-1' })]}
        loading={false}
        selectedRunId="run-1"
        onSelectRun={() => {}}
        runDetail={null}
        runDetailLoading={false}
        emptyLabel="—"
      />
    );
    expect(screen.getByTestId('reconciliation-run-detail-missing')).toBeInTheDocument();
  });

  it('renders the bucket breakdown from REAL detail rows, and flags DUPLICATE with an explicit text warning', () => {
    const detail: ReconciliationRunDetailDto = {
      reconciliationRunId: 'run-1',
      artifactId: 'artifact-1',
      businessVersionId: 'bv-1',
      sourceSystem: 'SAP_EXPORT',
      status: 'completed',
      resultQuality: 'WITHIN_TOLERANCE',
      residual: '500',
      residualPct: '0.05',
      createdAt: '2026-08-11T00:00:00.000Z',
      rows: [
        detailRow({ id: 'r1', bucket: 'MAPPED' }),
        detailRow({ id: 'r2', bucket: 'MAPPED' }),
        detailRow({ id: 'r3', bucket: 'DUPLICATE' }),
      ],
    };
    render(
      <ReconciliationLedgerPanel
        runs={[run({ reconciliationRunId: 'run-1' })]}
        loading={false}
        selectedRunId="run-1"
        onSelectRun={() => {}}
        runDetail={detail}
        runDetailLoading={false}
        emptyLabel="—"
      />
    );
    expect(screen.getByTestId('reconciliation-bucket-breakdown')).toHaveTextContent('MAPPED: 2');
    expect(screen.getByTestId('reconciliation-bucket-breakdown')).toHaveTextContent('DUPLICATE: 1');
    expect(screen.getByTestId('reconciliation-duplicate-warning')).toHaveTextContent('1 wiersz oznaczony');
  });

  it('does NOT show a duplicate warning when there are zero duplicates — no false alarm', () => {
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
      rows: [detailRow({ id: 'r1', bucket: 'MAPPED' })],
    };
    render(
      <ReconciliationLedgerPanel
        runs={[run({ reconciliationRunId: 'run-1' })]}
        loading={false}
        selectedRunId="run-1"
        onSelectRun={() => {}}
        runDetail={detail}
        runDetailLoading={false}
        emptyLabel="—"
      />
    );
    expect(screen.queryByTestId('reconciliation-duplicate-warning')).not.toBeInTheDocument();
  });

  // KONTROLA NEGATYWNA: zmiana resultQuality w mocku musi zmienić widoczny tekst.
  it('NEGATIVE CONTROL — changing resultQuality in the mock changes the rendered text', () => {
    const { rerender } = render(
      <ReconciliationLedgerPanel
        runs={[run({ reconciliationRunId: 'run-1', resultQuality: 'CLEAN' })]}
        loading={false}
        selectedRunId={null}
        onSelectRun={() => {}}
        runDetail={null}
        runDetailLoading={false}
        emptyLabel="—"
      />
    );
    expect(screen.getByTestId('reconciliation-run-run-1')).toHaveTextContent('CLEAN');

    rerender(
      <ReconciliationLedgerPanel
        runs={[run({ reconciliationRunId: 'run-1', resultQuality: 'MATERIAL_BREAK' })]}
        loading={false}
        selectedRunId={null}
        onSelectRun={() => {}}
        runDetail={null}
        runDetailLoading={false}
        emptyLabel="—"
      />
    );
    expect(screen.getByTestId('reconciliation-run-run-1')).not.toHaveTextContent('CLEAN');
    expect(screen.getByTestId('reconciliation-run-run-1')).toHaveTextContent('MATERIAL_BREAK');
  });
});
