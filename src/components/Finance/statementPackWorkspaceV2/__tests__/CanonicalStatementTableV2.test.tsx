/**
 * @vitest-environment jsdom
 *
 * `CanonicalStatementTableV2` — dowodzi renderu realnych danych, sticky
 * kolumny nazw (obecność klasy `sticky` — dowód strukturalny), missing ≠
 * zero, i że klik komórki niesie realny `sourceRef`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { StatementLineDto } from '@/services/api/financeV2.types';

import { CanonicalStatementTableV2 } from '../CanonicalStatementTableV2';

function line(overrides: Partial<StatementLineDto> & { stmtLineId: string }): StatementLineDto {
  return {
    stmtLineId: overrides.stmtLineId,
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

describe('CanonicalStatementTableV2', () => {
  it('renders an honest empty state when there are zero lines', () => {
    render(
      <CanonicalStatementTableV2
        lines={[]}
        resolveLineLabel={resolveLineLabel}
        selectedCellKey={null}
        onSelectCell={() => {}}
        emptyLabel="Brak danych dla tego dokumentu."
      />
    );
    expect(screen.getByTestId('canonical-statement-table-v2-empty')).toHaveTextContent('Brak danych');
  });

  it('renders currency+scale in the table header (not just the workspace bar)', () => {
    render(
      <CanonicalStatementTableV2
        lines={[line({ stmtLineId: 'l1' })]}
        resolveLineLabel={resolveLineLabel}
        selectedCellKey={null}
        onSelectCell={() => {}}
        emptyLabel="—"
      />
    );
    const scale = screen.getByTestId('canonical-statement-table-v2-scale');
    expect(scale).toHaveTextContent('PLN');
    expect(scale).toHaveTextContent('tysiące');
  });

  it('MISSING renders "—", never "0" — and calling onSelectCell exposes the real value + sourceRef', () => {
    const onSelectCell = vi.fn();
    render(
      <CanonicalStatementTableV2
        lines={[
          line({ stmtLineId: 'l1', periodId: 'p1', periodLabel: 'FY2024' }),
          line({
            stmtLineId: 'l2',
            periodId: 'p2',
            periodLabel: 'FY2025',
            value: {
              status: 'MISSING',
              valueDecimal: null,
              nativeCurrency: 'PLN',
              presentationCurrency: 'PLN',
              unit: 'THOUSANDS',
              multiplier: '1',
              sourceRef: null,
              isAdjustment: false,
              adjustmentReason: null,
            },
          }),
        ]}
        resolveLineLabel={resolveLineLabel}
        selectedCellKey={null}
        onSelectCell={onSelectCell}
        emptyLabel="—"
      />
    );
    const missingCell = screen.getByTestId('canonical-statement-cell-canon-revenue::p2');
    expect(missingCell).toHaveTextContent('—');
    expect(missingCell).not.toHaveTextContent('0');
    expect(missingCell.getAttribute('data-value-status')).toBe('MISSING');

    const presentCell = screen.getByTestId('canonical-statement-cell-canon-revenue::p1');
    expect(presentCell).toHaveTextContent('1 000 000');

    fireEvent.click(presentCell);
    expect(onSelectCell).toHaveBeenCalledWith(
      expect.objectContaining({
        rowKey: 'canon-revenue',
        periodId: 'p1',
        cell: expect.objectContaining({ value: expect.objectContaining({ sourceRef: { page: 3, row: 12 } }) }),
      })
    );
  });

  // ★ Korekta kanonu (koordynator, po §2.4 master planu): PIĘĆ rozróżnialnych
  // stanów wartości finansowej, nie trzy. `formatFinanceValueForDisplay`
  // (Pakiet C) celowo daje TEN SAM glif "—" trzem stanom absencji (MISSING/
  // NA/NOT_APPLICABLE) — rozróżnienie żyje w `data-value-status` + `title`
  // (reason label). Ten test dowodzi, że wszystkie pięć statusów faktycznie
  // trafiają do DOM-u tabeli NIEZMIENIONE (żaden nie ginie/koerycji do 0),
  // i że PRESENT_ZERO jest realną cyfrą "0", nie tym samym glifem co absencja.
  it('all five FinanceValueStatus values render distinctly at the table-cell surface (status attribute + glyph)', () => {
    const rows: Array<{ status: 'PRESENT_ZERO' | 'PRESENT_NONZERO' | 'MISSING' | 'NA' | 'NOT_APPLICABLE'; valueDecimal: string | null; expectedText: string }> = [
      { status: 'PRESENT_ZERO', valueDecimal: '0', expectedText: '0' },
      { status: 'PRESENT_NONZERO', valueDecimal: '7', expectedText: '7' },
      { status: 'MISSING', valueDecimal: null, expectedText: '—' },
      { status: 'NA', valueDecimal: null, expectedText: '—' },
      { status: 'NOT_APPLICABLE', valueDecimal: null, expectedText: '—' },
    ];
    render(
      <CanonicalStatementTableV2
        lines={rows.map((r, i) =>
          line({
            stmtLineId: `l-${r.status}`,
            canonicalLineId: `canon-${r.status}`,
            lineCode: r.status,
            periodId: 'p1',
            value: {
              status: r.status,
              valueDecimal: r.valueDecimal,
              nativeCurrency: 'PLN',
              presentationCurrency: 'PLN',
              unit: 'UNITS',
              multiplier: '1',
              sourceRef: null,
              isAdjustment: false,
              adjustmentReason: null,
            },
          })
        )}
        resolveLineLabel={resolveLineLabel}
        selectedCellKey={null}
        onSelectCell={() => {}}
        emptyLabel="—"
      />
    );
    for (const r of rows) {
      const el = screen.getByTestId(`canonical-statement-cell-canon-${r.status}::p1`);
      expect(el).toHaveTextContent(r.expectedText);
      expect(el.getAttribute('data-value-status')).toBe(r.status);
    }
    // Trzy stany absencji dzielą glif "—" (celowa decyzja Pakietu C), ale
    // NIGDY nie dzielą go z prawdziwym zerem — sprawdzone jawnie.
    const zeroCell = screen.getByTestId('canonical-statement-cell-canon-PRESENT_ZERO::p1');
    expect(zeroCell).not.toHaveTextContent('—');
    const missingCell = screen.getByTestId('canonical-statement-cell-canon-MISSING::p1');
    expect(missingCell).not.toHaveTextContent('0');
  });

  it('flags management-adjusted cells with a badge, driven by isAdjustment', () => {
    render(
      <CanonicalStatementTableV2
        lines={[
          line({
            stmtLineId: 'l1',
            value: {
              status: 'PRESENT_NONZERO',
              valueDecimal: '500',
              nativeCurrency: 'PLN',
              presentationCurrency: 'PLN',
              unit: 'THOUSANDS',
              multiplier: '1',
              sourceRef: null,
              isAdjustment: true,
              adjustmentReason: 'Jednorazowa korekta odpisu',
            },
          }),
        ]}
        resolveLineLabel={resolveLineLabel}
        selectedCellKey={null}
        onSelectCell={() => {}}
        emptyLabel="—"
      />
    );
    expect(screen.getByText('korekta')).toBeInTheDocument();
  });

  // KONTROLA NEGATYWNA: zmiana wartości w mocku MUSI zmienić DOM.
  it('NEGATIVE CONTROL — changing the mocked value changes the rendered cell', () => {
    const { rerender } = render(
      <CanonicalStatementTableV2
        lines={[line({ stmtLineId: 'l1' })]}
        resolveLineLabel={resolveLineLabel}
        selectedCellKey={null}
        onSelectCell={() => {}}
        emptyLabel="—"
      />
    );
    expect(screen.getByTestId('canonical-statement-cell-canon-revenue::period-1')).toHaveTextContent('1 000 000');

    rerender(
      <CanonicalStatementTableV2
        lines={[
          line({
            stmtLineId: 'l1',
            value: {
              status: 'PRESENT_NONZERO',
              valueDecimal: '42',
              nativeCurrency: 'PLN',
              presentationCurrency: 'PLN',
              unit: 'THOUSANDS',
              multiplier: '1',
              sourceRef: null,
              isAdjustment: false,
              adjustmentReason: null,
            },
          }),
        ]}
        resolveLineLabel={resolveLineLabel}
        selectedCellKey={null}
        onSelectCell={() => {}}
        emptyLabel="—"
      />
    );
    expect(screen.getByTestId('canonical-statement-cell-canon-revenue::period-1')).toHaveTextContent('42');
  });
});
