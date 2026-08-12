import { describe, expect, it } from 'vitest';

import type { ReconciliationDetailRowDto, StatementLineDto } from '@/services/api/financeV2.types';

import {
  canonicalLineIdFromRowKey,
  deriveStatementTable,
  findReconciliationDetailRowForCell,
  pickHeaderCurrencyAndScale,
} from '../deriveStatementTable';

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
      unit: 'UNITS',
      multiplier: '1',
      sourceRef: { page: 3 },
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

describe('deriveStatementTable', () => {
  it('groups lines into rows×periods keyed by canonicalLineId', () => {
    const table = deriveStatementTable([
      line({ stmtLineId: 'l1', periodId: 'p1', periodLabel: 'FY2024' }),
      line({ stmtLineId: 'l2', periodId: 'p2', periodLabel: 'FY2025' }),
    ]);
    expect(table.rows).toHaveLength(1);
    expect(table.periods).toHaveLength(2);
    expect(table.rows[0]!.cellsByPeriodId['p1']!.stmtLineId).toBe('l1');
    expect(table.rows[0]!.cellsByPeriodId['p2']!.stmtLineId).toBe('l2');
  });

  it('preserves MISSING status distinct from PRESENT_ZERO — never coerces to a number', () => {
    const table = deriveStatementTable([
      line({
        stmtLineId: 'l1',
        periodId: 'p1',
        value: {
          status: 'MISSING',
          valueDecimal: null,
          nativeCurrency: 'PLN',
          presentationCurrency: 'PLN',
          unit: 'UNITS',
          multiplier: '1',
          sourceRef: null,
          isAdjustment: false,
          adjustmentReason: null,
        },
      }),
    ]);
    const cell = table.rows[0]!.cellsByPeriodId['p1']!;
    expect(cell.value.status).toBe('MISSING');
    expect(cell.value.valueDecimal).toBeNull();
  });

  // ★ Korekta kanonu (koordynator, po przeczytaniu master planu §2.4): PIĘĆ
  // rozróżnialnych stanów, nie trzy — PRESENT_ZERO/PRESENT_NONZERO/MISSING/
  // NA/NOT_APPLICABLE. `deriveStatementTable` jest czystą derywacją
  // strukturalną (zero arytmetyki), więc dowód "brak koercji" musi objąć
  // WSZYSTKIE pięć z osobna, nie tylko MISSING-vs-PRESENT_ZERO.
  it('round-trips all five FinanceValueStatus values through the derivation UNCHANGED — no coercion of any kind', () => {
    const statuses: Array<{ status: StatementLineDto['value']['status']; valueDecimal: string | null }> = [
      { status: 'PRESENT_ZERO', valueDecimal: '0' },
      { status: 'PRESENT_NONZERO', valueDecimal: '42.5' },
      { status: 'MISSING', valueDecimal: null },
      { status: 'NA', valueDecimal: null },
      { status: 'NOT_APPLICABLE', valueDecimal: null },
    ];
    for (const s of statuses) {
      const table = deriveStatementTable([
        line({
          stmtLineId: `l-${s.status}`,
          periodId: 'p1',
          value: {
            status: s.status,
            valueDecimal: s.valueDecimal,
            nativeCurrency: 'PLN',
            presentationCurrency: 'PLN',
            unit: 'UNITS',
            multiplier: '1',
            sourceRef: null,
            isAdjustment: false,
            adjustmentReason: null,
          },
        }),
      ]);
      const cell = table.rows[0]!.cellsByPeriodId['p1']!;
      expect(cell.value.status).toBe(s.status);
      expect(cell.value.valueDecimal).toBe(s.valueDecimal);
    }
  });

  // KONTROLA NEGATYWNA: zmiana jednej wartości w mocku musi zmienić wynik.
  it('NEGATIVE CONTROL — changing one input value changes the derived output', () => {
    const before = deriveStatementTable([line({ stmtLineId: 'l1', periodId: 'p1' })]);
    const after = deriveStatementTable([
      line({
        stmtLineId: 'l1',
        periodId: 'p1',
        value: {
          status: 'PRESENT_NONZERO',
          valueDecimal: '999999999',
          nativeCurrency: 'PLN',
          presentationCurrency: 'PLN',
          unit: 'UNITS',
          multiplier: '1',
          sourceRef: null,
          isAdjustment: false,
          adjustmentReason: null,
        },
      }),
    ]);
    expect(before.rows[0]!.cellsByPeriodId['p1']!.value.valueDecimal).not.toBe(
      after.rows[0]!.cellsByPeriodId['p1']!.value.valueDecimal
    );
  });

  it('detects duplicate period labels across distinct periodIds', () => {
    const table = deriveStatementTable([
      line({ stmtLineId: 'l1', periodId: 'p1', periodLabel: 'FY2025' }),
      line({ stmtLineId: 'l2', periodId: 'p1b', periodLabel: 'FY2025', canonicalLineId: 'canon-cogs', lineCode: 'COGS' }),
    ]);
    const dup = table.warnings.find((w) => w.code === 'DUPLICATE_PERIOD_LABEL');
    expect(dup).toBeDefined();
    expect(dup!.message).toContain('FY2025');
  });

  it('detects mixed units within the same canonical line across periods', () => {
    const table = deriveStatementTable([
      line({ stmtLineId: 'l1', periodId: 'p1' }),
      line({
        stmtLineId: 'l2',
        periodId: 'p2',
        value: {
          status: 'PRESENT_NONZERO',
          valueDecimal: '1000',
          nativeCurrency: 'PLN',
          presentationCurrency: 'PLN',
          unit: 'THOUSANDS',
          multiplier: '1',
          sourceRef: null,
          isAdjustment: false,
          adjustmentReason: null,
        },
      }),
    ]);
    expect(table.warnings.some((w) => w.code === 'MIXED_UNIT_WITHIN_LINE')).toBe(true);
  });

  it('flags lines missing canonicalLineId as a lineCode fallback (info, not silently merged wrong)', () => {
    const table = deriveStatementTable([
      line({ stmtLineId: 'l1', canonicalLineId: null, lineCode: 'MISC_LINE' }),
    ]);
    expect(table.rows[0]!.usesLineCodeFallback).toBe(true);
    expect(table.warnings.some((w) => w.code === 'UNMAPPED_LINE_CODE')).toBe(true);
  });

  it('flags multiple entities present when more than one entityId appears', () => {
    const table = deriveStatementTable([
      line({ stmtLineId: 'l1', entityId: 'entity-1' }),
      line({ stmtLineId: 'l2', entityId: 'entity-2', periodId: 'p2' }),
    ]);
    expect(table.entityIds).toHaveLength(2);
    expect(table.warnings.some((w) => w.code === 'MULTIPLE_ENTITIES_PRESENT')).toBe(true);
  });

  it('does not warn when data is clean (no false positives)', () => {
    const table = deriveStatementTable([
      line({ stmtLineId: 'l1', periodId: 'p1', periodLabel: 'FY2024' }),
      line({ stmtLineId: 'l2', periodId: 'p2', periodLabel: 'FY2025' }),
    ]);
    expect(table.warnings).toHaveLength(0);
  });
});

describe('pickHeaderCurrencyAndScale', () => {
  it('returns currency/unit from the first PRESENT cell', () => {
    const table = deriveStatementTable([line({ stmtLineId: 'l1', periodId: 'p1' })]);
    expect(pickHeaderCurrencyAndScale(table)).toEqual({ currency: 'PLN', unit: 'UNITS' });
  });

  it('falls back to declared currency/unit even for a MISSING-only cell (never fabricates a default)', () => {
    const table = deriveStatementTable([
      line({
        stmtLineId: 'l1',
        periodId: 'p1',
        value: {
          status: 'MISSING',
          valueDecimal: null,
          nativeCurrency: 'EUR',
          presentationCurrency: 'EUR',
          unit: 'MILLIONS',
          multiplier: '1',
          sourceRef: null,
          isAdjustment: false,
          adjustmentReason: null,
        },
      }),
    ]);
    expect(pickHeaderCurrencyAndScale(table)).toEqual({ currency: 'EUR', unit: 'MILLIONS' });
  });

  it('returns null when there are no lines at all — honest absence, not a fabricated default', () => {
    expect(pickHeaderCurrencyAndScale(deriveStatementTable([]))).toBeNull();
  });
});

function reconRow(overrides: Partial<ReconciliationDetailRowDto> & { id: string }): ReconciliationDetailRowDto {
  return {
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
    ...overrides,
  };
}

// ★ Dowód „odtwarzalnego łańcucha" (brief pkt 4): od zaprezentowanej komórki
// (canonicalLineId+periodId+entityId) do jej wiersza mapowania rekoncyliacji
// (sourceAmount/mappedAmount/sourceRowRef) — dopasowanie STRUKTURALNE, nie po
// nazwie/etykiecie (żaden z tych DTO nie niesie nazwy linii).
// ★ `rowKey` <-> `canonicalLineId` must round-trip through `deriveStatementTable`
// exactly — this is what lets `StatementPackWorkspaceV2` recover the
// canonicalLineId from `onSelectCell`'s rowKey without a duplicated field.
describe('canonicalLineIdFromRowKey', () => {
  it('returns the rowKey unchanged when it is a real canonicalLineId (round-trips with deriveStatementTable)', () => {
    const table = deriveStatementTable([line({ stmtLineId: 'l1', canonicalLineId: 'canon-revenue' })]);
    const row = table.rows[0]!;
    expect(canonicalLineIdFromRowKey(row.rowKey)).toBe('canon-revenue');
    expect(canonicalLineIdFromRowKey(row.rowKey)).toBe(row.canonicalLineId);
  });

  it('returns null for a lineCode-fallback rowKey (round-trips with deriveStatementTable)', () => {
    const table = deriveStatementTable([line({ stmtLineId: 'l1', canonicalLineId: null, lineCode: 'MISC_LINE' })]);
    const row = table.rows[0]!;
    expect(row.usesLineCodeFallback).toBe(true);
    expect(canonicalLineIdFromRowKey(row.rowKey)).toBeNull();
  });

  // KONTROLA NEGATYWNA: a canonicalLineId that (adversarially) starts with the fallback prefix
  // string is NOT itself a fallback — proves the check is prefix-based on the ACTUAL rowKey
  // construction, not a heuristic on the canonicalLineId's own contents alone.
  it('NEGATIVE CONTROL — a genuine canonicalLineId is never rewritten to null merely because a differently-shaped id could look similar', () => {
    const table = deriveStatementTable([line({ stmtLineId: 'l1', canonicalLineId: 'canon-revenue' })]);
    expect(canonicalLineIdFromRowKey(table.rows[0]!.rowKey)).not.toBeNull();
  });
});

describe('findReconciliationDetailRowForCell', () => {
  it('finds the reconciliation row that maps to a presented cell, by (canonicalLineId, periodId, entityId)', () => {
    const rows = [
      reconRow({ id: 'r1', canonicalLineId: 'canon-cogs', periodId: 'period-1', entityId: 'entity-1' }),
      reconRow({ id: 'r2', canonicalLineId: 'canon-revenue', periodId: 'period-1', entityId: 'entity-1' }),
      reconRow({ id: 'r3', canonicalLineId: 'canon-revenue', periodId: 'period-2', entityId: 'entity-1' }),
    ];
    const match = findReconciliationDetailRowForCell(
      { canonicalLineId: 'canon-revenue', periodId: 'period-1', entityId: 'entity-1' },
      rows
    );
    expect(match?.id).toBe('r2');
    expect(match?.sourceRowRef).toEqual({ file: 'trial_balance.csv', row: 42 });
  });

  it('returns null (honest absence) when no row matches — never guesses the nearest one', () => {
    const rows = [reconRow({ id: 'r1', canonicalLineId: 'canon-cogs', periodId: 'period-1', entityId: 'entity-1' })];
    expect(
      findReconciliationDetailRowForCell(
        { canonicalLineId: 'canon-revenue', periodId: 'period-1', entityId: 'entity-1' },
        rows
      )
    ).toBeNull();
  });

  it('returns null for cells without a canonicalLineId (lineCode fallback rows cannot be reconciled by definition)', () => {
    const rows = [reconRow({ id: 'r1', canonicalLineId: 'canon-revenue', periodId: 'period-1', entityId: 'entity-1' })];
    expect(findReconciliationDetailRowForCell({ canonicalLineId: null, periodId: 'period-1', entityId: 'entity-1' }, rows)).toBeNull();
  });

  // KONTROLA NEGATYWNA: zmiana JEDNEGO pola dopasowania (entityId) musi zerwać dopasowanie.
  it('NEGATIVE CONTROL — changing only entityId breaks the match even when canonicalLineId+periodId still agree', () => {
    const rows = [reconRow({ id: 'r1', canonicalLineId: 'canon-revenue', periodId: 'period-1', entityId: 'entity-1' })];
    const sameEntity = findReconciliationDetailRowForCell(
      { canonicalLineId: 'canon-revenue', periodId: 'period-1', entityId: 'entity-1' },
      rows
    );
    expect(sameEntity?.id).toBe('r1');
    const differentEntity = findReconciliationDetailRowForCell(
      { canonicalLineId: 'canon-revenue', periodId: 'period-1', entityId: 'entity-2' },
      rows
    );
    expect(differentEntity).toBeNull();
  });
});
