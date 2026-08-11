import { describe, expect, it } from 'vitest';

import type { StatementLineDto } from '@/services/api/financeV2.types';

import { deriveStatementTable, pickHeaderCurrencyAndScale } from '../deriveStatementTable';

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
