// @vitest-environment node
/**
 * F0/L1 — buildOrgFinancialsSummary: financials grounding z realnych danych org.
 * Część kręgosłupa inicjatyw (INITIATIVE_SYSTEM_SSOT §F0). Best-effort + fail-soft.
 *
 * Mockuje warstwę DB na poziomie `Database` (db.all callback) — wzorzec jak
 * DbPromise.all, którego helper używa wewnętrznie.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { buildOrgFinancialsSummary } from '../../../server/src/services/initiative/financialsGrounding.ts';

/** Build a fake Database whose `all` resolves with the given rows (or throws). */
function makeDb(rows: unknown[] | Error) {
  return {
    all: (_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) => {
      if (rows instanceof Error) cb(rows, []);
      else cb(null, rows);
    },
    get: (_sql: string, _params: unknown[], cb: (err: Error | null, row: unknown) => void) =>
      cb(null, null),
    run: (_sql: string, _params: unknown[], cb: (err: Error | null) => void) => cb(null),
    exec: (_sql: string, cb: (err: Error | null) => void) => cb(null),
  } as any;
}

describe('F0 — buildOrgFinancialsSummary (financials grounding)', () => {
  it('buduje jednowierszowe podsumowanie z realnych wierszy (Revenue/EBITDA/Net)', async () => {
    const db = makeDb([
      { line_code: 'REVENUE', value: 8.8, scaling: 'millions', currency: 'EUR', period_label: '2025', period_end: '2025-12-31' },
      { line_code: 'EBITDA', value: 2.7, scaling: 'millions', currency: 'EUR', period_label: '2025', period_end: '2025-12-31' },
      { line_code: 'NET_INCOME', value: 1.4, scaling: 'millions', currency: 'EUR', period_label: '2025', period_end: '2025-12-31' },
    ]);
    const summary = await buildOrgFinancialsSummary(db, 'org-1');
    expect(summary).toBeDefined();
    expect(summary).toContain('Przychód 2025: 8.8M EUR');
    expect(summary).toContain('EBITDA 2.7M');
    expect(summary).toContain('Zysk netto 1.4M');
  });

  it('de-skaluje wartości: scaling=thousands → wartości w setkach K', async () => {
    const db = makeDb([
      { line_code: 'REVENUE', value: 8800, scaling: 'thousands', currency: 'PLN', period_label: 'FY24', period_end: '2024-12-31' },
    ]);
    const summary = await buildOrgFinancialsSummary(db, 'org-2');
    // 8800 * 1000 = 8.8M
    expect(summary).toContain('Przychód FY24: 8.8M PLN');
  });

  it('brak danych (pusta lista) → undefined (zero fabrykacji)', async () => {
    const db = makeDb([]);
    const summary = await buildOrgFinancialsSummary(db, 'org-3');
    expect(summary).toBeUndefined();
  });

  it('fail-soft: błąd query → undefined, nie rzuca', async () => {
    const db = makeDb(new Error('relation "financial_statements" does not exist'));
    const summary = await buildOrgFinancialsSummary(db, 'org-4');
    expect(summary).toBeUndefined();
  });

  it('brak db lub orgId → undefined (guard)', async () => {
    expect(await buildOrgFinancialsSummary(undefined as any, 'org-5')).toBeUndefined();
    expect(await buildOrgFinancialsSummary(makeDb([]), '')).toBeUndefined();
  });

  it('node-pg może zwrócić REAL jako string — parsuje liczbowo', async () => {
    const db = makeDb([
      { line_code: 'REVENUE', value: '12.5', scaling: 'millions', currency: 'USD', period_label: '2025', period_end: '2025-12-31' },
    ]);
    const summary = await buildOrgFinancialsSummary(db, 'org-6');
    expect(summary).toContain('12.5M USD');
  });

  it('pomija wiersze z nieliczbową/null wartością, nie fabrykuje', async () => {
    const db = makeDb([
      { line_code: 'REVENUE', value: null, scaling: 'millions', currency: 'EUR', period_label: '2025', period_end: '2025-12-31' },
      { line_code: 'EBITDA', value: 2.7, scaling: 'millions', currency: 'EUR', period_label: '2025', period_end: '2025-12-31' },
    ]);
    const summary = await buildOrgFinancialsSummary(db, 'org-7');
    expect(summary).toBeDefined();
    expect(summary).not.toContain('Przychód');
    // EBITDA staje się pierwszą pozycją → dostaje walutę i okres
    expect(summary).toContain('EBITDA 2025: 2.7M EUR');
  });
});
