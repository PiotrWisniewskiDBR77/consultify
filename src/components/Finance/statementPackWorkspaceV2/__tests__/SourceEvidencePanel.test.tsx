/**
 * @vitest-environment jsdom
 *
 * `SourceEvidencePanel` — dowodzi:
 *   (a) missing ≠ zero ≠ N/A: TRZY różne stany braku/obecności renderują się
 *       jawnie różnie (status wypisany tekstem, wartość widoczna wyłącznie
 *       dla stanów PRESENT_*);
 *   (b) drugi krok łańcucha dowodowego — `mappingRow` (undefined vs null vs
 *       obiekt) renderuje trzy jawnie różne stany, honest UI (CANON §4.1);
 *   (c) kontrole negatywne dla obu.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import type { FinanceValue, ReconciliationDetailRowDto } from '@/services/api/financeV2.types';

import type { StatementTableCell } from '../deriveStatementTable';
import { SourceEvidencePanel } from '../SourceEvidencePanel';

function value(overrides: Partial<FinanceValue> = {}): FinanceValue {
  return {
    status: 'PRESENT_NONZERO',
    valueDecimal: '1000000',
    nativeCurrency: 'PLN',
    presentationCurrency: 'PLN',
    unit: 'THOUSANDS',
    multiplier: '1',
    sourceRef: { page: 3, row: 12 },
    isAdjustment: false,
    adjustmentReason: null,
    ...overrides,
  };
}

function cell(overrides: Partial<StatementTableCell> = {}): StatementTableCell {
  return {
    stmtLineId: 'stmt-1',
    value: value(),
    entityId: 'entity-1',
    entityCode: 'PARENT',
    accumulationBasis: 'FULL_YEAR',
    consolidationScope: 'CONSOLIDATED',
    signConvention: 'NATURAL',
    accountingPolicy: 'IFRS',
    reclassifiedFromLineId: null,
    ...overrides,
  };
}

describe('SourceEvidencePanel — empty state', () => {
  it('shows the honest empty state when no cell is selected', () => {
    render(<SourceEvidencePanel rowLabel="Revenue" periodLabel="FY2025" cell={null} emptyLabel="Wybierz komórkę." />);
    expect(screen.getByTestId('source-evidence-panel-empty')).toHaveTextContent('Wybierz komórkę.');
  });
});

describe('SourceEvidencePanel — missing ≠ zero ≠ N/A', () => {
  it('PRESENT_ZERO renders the real numeral "0" — a true zero, not an absence glyph', () => {
    render(
      <SourceEvidencePanel
        rowLabel="Revenue"
        periodLabel="FY2025"
        cell={cell({ value: value({ status: 'PRESENT_ZERO', valueDecimal: '0' }) })}
        emptyLabel="—"
      />
    );
    expect(screen.getByTestId('source-evidence-status')).toHaveTextContent('PRESENT_ZERO');
    // Wartość jest w <dl> jako pierwszy Row "Wartość" — sprawdzamy globalnie brak "—" w tej wartości.
    expect(screen.queryByText('—', { selector: '.tabular-nums' })).not.toBeInTheDocument();
    expect(screen.getByText('0', { selector: '.tabular-nums' })).toBeInTheDocument();
  });

  it('MISSING renders "—" with an explicit "brak danych" reason — never "0"', () => {
    render(
      <SourceEvidencePanel
        rowLabel="Revenue"
        periodLabel="FY2025"
        cell={cell({ value: value({ status: 'MISSING', valueDecimal: null, sourceRef: null }) })}
        emptyLabel="—"
      />
    );
    expect(screen.getByTestId('source-evidence-status')).toHaveTextContent('MISSING');
    expect(screen.getByText('Brak danych (luka źródłowa)')).toBeInTheDocument();
    expect(screen.queryByText('0', { selector: '.tabular-nums' })).not.toBeInTheDocument();
    expect(screen.getByTestId('source-evidence-ref-missing')).toBeInTheDocument();
  });

  it('NA renders "—" with a DIFFERENT explicit reason than MISSING — the two absence states are distinguishable', () => {
    render(
      <SourceEvidencePanel
        rowLabel="Revenue"
        periodLabel="FY2025"
        cell={cell({ value: value({ status: 'NA', valueDecimal: null }) })}
        emptyLabel="—"
      />
    );
    expect(screen.getByTestId('source-evidence-status')).toHaveTextContent('NA');
    expect(screen.getByText('Analityk oznaczył: nie dotyczy')).toBeInTheDocument();
    expect(screen.queryByText('Brak danych (luka źródłowa)')).not.toBeInTheDocument();
  });

  // KONTROLA NEGATYWNA: zmiana statusu z PRESENT_ZERO na MISSING musi zmienić DOM (glif i etykietę).
  it('NEGATIVE CONTROL — rerender from PRESENT_ZERO to MISSING changes both the glyph and the reason text', () => {
    const { rerender } = render(
      <SourceEvidencePanel
        rowLabel="Revenue"
        periodLabel="FY2025"
        cell={cell({ value: value({ status: 'PRESENT_ZERO', valueDecimal: '0' }) })}
        emptyLabel="—"
      />
    );
    expect(screen.getByText('0', { selector: '.tabular-nums' })).toBeInTheDocument();
    expect(screen.queryByText('Brak danych (luka źródłowa)')).not.toBeInTheDocument();

    rerender(
      <SourceEvidencePanel
        rowLabel="Revenue"
        periodLabel="FY2025"
        cell={cell({ value: value({ status: 'MISSING', valueDecimal: null, sourceRef: null }) })}
        emptyLabel="—"
      />
    );
    expect(screen.queryByText('0', { selector: '.tabular-nums' })).not.toBeInTheDocument();
    expect(screen.getByText('Brak danych (luka źródłowa)')).toBeInTheDocument();
  });
});

describe('SourceEvidencePanel — mapping trail (chain proof, step 2)', () => {
  const baseCell = cell({ value: value() });

  it('omits the mapping section entirely when mappingRow is undefined (not yet looked up — no reconciliation run selected)', () => {
    render(<SourceEvidencePanel rowLabel="Revenue" periodLabel="FY2025" cell={baseCell} emptyLabel="—" />);
    expect(screen.queryByTestId('source-evidence-mapping')).not.toBeInTheDocument();
  });

  it('shows an honest "no match" when mappingRow is null (looked up, nothing found)', () => {
    render(
      <SourceEvidencePanel rowLabel="Revenue" periodLabel="FY2025" cell={baseCell} emptyLabel="—" mappingRow={null} />
    );
    expect(screen.getByTestId('source-evidence-mapping-missing')).toBeInTheDocument();
  });

  it('renders the matched reconciliation row — bucket, amounts, and sourceRowRef', () => {
    const mappingRow: ReconciliationDetailRowDto = {
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
    };
    render(
      <SourceEvidencePanel
        rowLabel="Revenue"
        periodLabel="FY2025"
        cell={baseCell}
        emptyLabel="—"
        mappingRow={mappingRow}
      />
    );
    expect(screen.getByTestId('source-evidence-mapping-bucket')).toHaveTextContent('MAPPED');
    expect(screen.getByTestId('source-evidence-mapping-source-row-ref')).toHaveTextContent('trial_balance.csv');
  });

  // KONTROLA NEGATYWNA: zmiana bucketu w mocku MUSI zmienić DOM.
  it('NEGATIVE CONTROL — changing the mapping row bucket in the mock changes the rendered bucket', () => {
    const mkRow = (bucket: ReconciliationDetailRowDto['bucket']): ReconciliationDetailRowDto => ({
      id: 'row-1',
      canonicalLineId: 'canon-revenue',
      entityId: 'entity-1',
      periodId: 'period-1',
      bucket,
      sourceAmount: '1000000',
      mappedAmount: '1000000',
      duplicateOfRowId: null,
      reclassTargetLineId: null,
      eliminationCounterpartyEntityId: null,
      reasonCode: null,
      sourceRowRef: null,
    });
    const { rerender } = render(
      <SourceEvidencePanel rowLabel="Revenue" periodLabel="FY2025" cell={baseCell} emptyLabel="—" mappingRow={mkRow('MAPPED')} />
    );
    expect(screen.getByTestId('source-evidence-mapping-bucket')).toHaveTextContent('MAPPED');
    rerender(
      <SourceEvidencePanel rowLabel="Revenue" periodLabel="FY2025" cell={baseCell} emptyLabel="—" mappingRow={mkRow('DUPLICATE')} />
    );
    expect(screen.getByTestId('source-evidence-mapping-bucket')).toHaveTextContent('DUPLICATE');
  });
});
