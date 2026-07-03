/**
 * S6.4 — Financial model grounding (backend)
 *
 * Covers:
 *  - createModel seeds assumptions from an approved source statement
 *    (historical lines pulled into initialCash / baseline).
 *  - The critical-line gate rejects a source missing CASH.
 *  - reseedModelFromSource re-pulls historical lines and refreshes seed metadata,
 *    and refuses approved models / sourceless models.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

// Identity canonical resolver + no version snapshot (force the dbAll fallback).
vi.mock('../../../server/src/services/financeCanonicalResolver.js', () => ({
  normalizeCanonicalLineCode: (code: string) => String(code || '').toUpperCase(),
}));
vi.mock('../../../server/src/services/financialStatementService.js', () => ({
  loadLatestStatementVersionSnapshot: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../server/src/services/financialStatementPackService.js', () => ({
  getVerifiedPackSeed: vi.fn(),
}));

import {
  createModel,
  reseedModelFromSource,
} from '../../../server/src/services/financialModelingService.js';

const ORG = 'org-1';

/** A statement row that passes the readiness gate. */
function readyStatementRow(over: Record<string, unknown> = {}) {
  return {
    id: 'stmt-1',
    period_label: 'FY2025',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    currency: 'PLN',
    scaling: 'units',
    source_file_name: 'bilans.pdf',
    status: 'confirmed',
    readiness_status: 'ready',
    ...over,
  };
}

/** Historical lines with the critical trio present (CASH / TOTAL_ASSETS / EQUITY). */
function completeSeedRows() {
  return [
    { line_code: 'CASH', value: 500000 },
    { line_code: 'TOTAL_ASSETS', value: 2000000 },
    { line_code: 'TOTAL_EQUITY', value: 1200000 },
    { line_code: 'REVENUE', value: 3000000 },
    { line_code: 'COGS', value: 1800000 },
    { line_code: 'OPEX', value: 600000 },
  ];
}

describe('Financial model grounding — createModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pulls historical lines from an approved statement into assumptions', async () => {
    mockDbGet.mockResolvedValueOnce(readyStatementRow()); // statement lookup
    mockDbAll.mockResolvedValueOnce(completeSeedRows()); // seed value rows
    mockDbRun.mockResolvedValue(undefined);

    const id = await createModel({
      organizationId: ORG,
      name: 'FY2025 forecast',
      startDate: '2026-01-01',
      createdBy: 'user-1',
      sourceStatementId: 'stmt-1',
    });

    expect(id).toBeTruthy();
    // The INSERT persists assumptions_json seeded from the statement.
    const insertCall = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO financial_models')
    );
    expect(insertCall).toBeTruthy();
    const assumptionsJson = (insertCall![1] as any[]).find(
      (p) => typeof p === 'string' && p.includes('seedSource')
    );
    const parsed = JSON.parse(assumptionsJson);
    expect(parsed.initialCash).toBe(500000);
    expect(parsed.initialEquity).toBe(1200000);
    expect(parsed.baseline.revenue).toBe(3000000);
    expect(parsed.seedSource.type).toBe('statement');
    expect(parsed.seedStatus.state).toBe('seeded');
  });

  it('rejects a source statement missing the critical CASH line', async () => {
    mockDbGet.mockResolvedValueOnce(readyStatementRow());
    mockDbAll.mockResolvedValueOnce([
      { line_code: 'TOTAL_ASSETS', value: 2000000 },
      { line_code: 'TOTAL_EQUITY', value: 1200000 },
      // no CASH
    ]);

    await expect(
      createModel({
        organizationId: ORG,
        name: 'broken',
        startDate: '2026-01-01',
        createdBy: 'user-1',
        sourceStatementId: 'stmt-1',
      })
    ).rejects.toThrow(/critical lines: .*CASH/);
  });

  it('refuses to seed from a statement that is not statement-ready', async () => {
    mockDbGet.mockResolvedValueOnce(
      readyStatementRow({ status: 'draft', readiness_status: 'recoverable' })
    );

    await expect(
      createModel({
        organizationId: ORG,
        name: 'not ready',
        startDate: '2026-01-01',
        createdBy: 'user-1',
        sourceStatementId: 'stmt-1',
      })
    ).rejects.toThrow(/statement-ready/);
  });
});

describe('Financial model grounding — reseedModelFromSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-pulls historical lines and refreshes seed metadata', async () => {
    // getModel(): draft model bound to a source statement.
    mockDbGet.mockResolvedValueOnce({
      id: 'model-1',
      organization_id: ORG,
      status: 'draft',
      source_statement_id: 'stmt-1',
      source_statement_pack_id: null,
      assumptions_json: JSON.stringify({ initialCash: 1, userKnob: 42 }),
    });
    // buildSeededAssumptionsFromStatement(): statement lookup + seed rows.
    mockDbGet.mockResolvedValueOnce(readyStatementRow());
    mockDbAll.mockResolvedValueOnce(completeSeedRows());
    mockDbRun.mockResolvedValue(undefined);

    const result = await reseedModelFromSource('model-1', ORG);

    expect(result.seededFrom).toBe('statement');
    const updateCall = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE financial_models SET assumptions_json')
    );
    expect(updateCall).toBeTruthy();
    const parsed = JSON.parse((updateCall![1] as any[])[0]);
    // Fresh seed wins for seeded keys...
    expect(parsed.initialCash).toBe(500000);
    // ...unrelated user edits survive.
    expect(parsed.userKnob).toBe(42);
    expect(parsed.seedSource.type).toBe('statement');
  });

  it('refuses to refresh an approved model', async () => {
    mockDbGet.mockResolvedValueOnce({
      id: 'model-1',
      organization_id: ORG,
      status: 'approved',
      source_statement_id: 'stmt-1',
      assumptions_json: '{}',
    });

    await expect(reseedModelFromSource('model-1', ORG)).rejects.toThrow(/approved/i);
  });

  it('refuses to refresh a model without a source', async () => {
    mockDbGet.mockResolvedValueOnce({
      id: 'model-1',
      organization_id: ORG,
      status: 'draft',
      source_statement_id: null,
      source_statement_pack_id: null,
      assumptions_json: '{}',
    });

    await expect(reseedModelFromSource('model-1', ORG)).rejects.toThrow(/no source/i);
  });
});
