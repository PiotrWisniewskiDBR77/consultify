/**
 * Unit tests for GovernedModelService.computeKpi (E1-2 Governed Models).
 *
 * Coverage:
 *   - computeKpi: field_sum / field_avg / field_count (SQL aggregations)
 *   - computeKpi: expression (references sibling KPIs by code via formulaEngine)
 *   - computeKpi: canonical_line (aggregation restricted to trusted records)
 *   - guard: requireKpiAccess denies an unauthorized user with 403 (not 500)
 *
 * The db mock is a SQL-shape dispatcher: it inspects the query text + params
 * and returns deterministic rows, so we can assert computeKpi against a hand-
 * computed expected value (anti-false-green: see the numeric comments below).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import governedModelService from '../GovernedModelService.js';
import permissionsService from '../PermissionsService.js';

// ---------------------------------------------------------------------------
// Sample data — a single "sales" table with 4 records.
//   amount: 100, 200, 300, 400   →  SUM = 1000 ; AVG = 250 ; COUNT = 4
//   Of these, records r1 (100) and r3 (300) are marked trusted (canonical).
//     canonical SUM = 400 ; canonical AVG = 200 ; canonical COUNT = 2
// ---------------------------------------------------------------------------

const TABLE_ID = 'tbl-sales';
const FIELD_ID = 'fld-amount';
const MODEL_ID = 'model-1';

const AMOUNTS = [100, 200, 300, 400];
const TRUSTED_AMOUNTS = [100, 300];

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

// KPI definition rows keyed by kpi_id.
const KPI_ROWS: Record<string, Record<string, unknown>> = {
  'kpi-sum': {
    kpi_id: 'kpi-sum',
    model_id: MODEL_ID,
    code: 'revenue',
    formula_type: 'field_sum',
    source_table_id: TABLE_ID,
    source_field_id: FIELD_ID,
    formula_config: {},
  },
  'kpi-avg': {
    kpi_id: 'kpi-avg',
    model_id: MODEL_ID,
    code: 'avg_deal',
    formula_type: 'field_avg',
    source_table_id: TABLE_ID,
    source_field_id: FIELD_ID,
    formula_config: {},
  },
  'kpi-count': {
    kpi_id: 'kpi-count',
    model_id: MODEL_ID,
    code: 'deals',
    formula_type: 'field_count',
    source_table_id: TABLE_ID,
    source_field_id: null,
    formula_config: {},
  },
  'kpi-cost': {
    kpi_id: 'kpi-cost',
    model_id: MODEL_ID,
    code: 'cost',
    formula_type: 'field_sum',
    source_table_id: TABLE_ID,
    source_field_id: 'fld-cost',
    formula_config: {},
  },
  'kpi-expr': {
    kpi_id: 'kpi-expr',
    model_id: MODEL_ID,
    code: 'profit',
    formula_type: 'expression',
    source_table_id: null,
    source_field_id: null,
    // profit = revenue - cost  →  1000 - 250 = 750
    formula_config: { expression: 'revenue - cost' },
  },
  'kpi-canon': {
    kpi_id: 'kpi-canon',
    model_id: MODEL_ID,
    code: 'canonical_revenue',
    formula_type: 'canonical_line',
    source_table_id: TABLE_ID,
    source_field_id: FIELD_ID,
    formula_config: { aggregation: 'sum' },
  },
};

// A separate cost total the expression test relies on: cost SUM = 250.
const COST_SUM = 250;

/**
 * SQL-shape dispatcher. Returns `{ rows }` based on the query text.
 */
function dispatch(sql: string, params: unknown[]): { rows: unknown[] } {
  const q = sql.replace(/\s+/g, ' ').trim();

  // KPI definition lookup by kpi_id.
  if (q.startsWith('SELECT * FROM tp_kpi_definitions WHERE kpi_id =')) {
    const row = KPI_ROWS[params[0] as string];
    return { rows: row ? [row] : [] };
  }

  // KPI lookup by (model_id, code) — used by expression resolution.
  if (q.includes('SELECT kpi_id FROM tp_kpi_definitions WHERE model_id = $1 AND code = $2')) {
    const code = params[1] as string;
    const match = Object.values(KPI_ROWS).find((r) => r.code === code);
    return { rows: match ? [{ kpi_id: match.kpi_id }] : [] };
  }

  // field_count: COUNT(*) over table (no trusted filter).
  if (q.startsWith('SELECT COUNT(*) AS val FROM tp_records WHERE table_id =')) {
    return { rows: [{ val: String(AMOUNTS.length) }] };
  }

  // canonical_line COUNT with trusted filter.
  if (q.includes('SELECT COUNT(*) AS val FROM tp_records r') && q.includes('trusted = true')) {
    return { rows: [{ val: String(TRUSTED_AMOUNTS.length) }] };
  }

  // canonical_line SUM/AVG with trusted filter.
  if (q.includes('FROM tp_records r') && q.includes('trusted = true')) {
    if (q.includes('SUM(')) return { rows: [{ val: String(sum(TRUSTED_AMOUNTS)) }] };
    if (q.includes('AVG('))
      return { rows: [{ val: String(sum(TRUSTED_AMOUNTS) / TRUSTED_AMOUNTS.length) }] };
  }

  // field_sum / field_avg over whole table (no trusted filter).
  if (q.startsWith('SELECT SUM(') && q.includes('FROM tp_records WHERE table_id =')) {
    const field = params[1] as string;
    if (field === 'fld-cost') return { rows: [{ val: String(COST_SUM) }] };
    return { rows: [{ val: String(sum(AMOUNTS)) }] };
  }
  if (q.startsWith('SELECT AVG(') && q.includes('FROM tp_records WHERE table_id =')) {
    return { rows: [{ val: String(sum(AMOUNTS) / AMOUNTS.length) }] };
  }

  throw new Error(`Unhandled SQL in test dispatcher: ${q}`);
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation((sql: string, params: unknown[] = []) =>
    Promise.resolve(dispatch(sql, params))
  );
});

describe('GovernedModelService.computeKpi — field aggregations', () => {
  it('field_sum returns SUM of the source field (hand-computed 1000)', async () => {
    const { value } = await governedModelService.computeKpi('kpi-sum');
    expect(value).toBe(1000);
  });

  it('field_avg returns AVG of the source field (hand-computed 250)', async () => {
    const { value } = await governedModelService.computeKpi('kpi-avg');
    expect(value).toBe(250);
  });

  it('field_count returns COUNT(*) of records (hand-computed 4)', async () => {
    const { value } = await governedModelService.computeKpi('kpi-count');
    expect(value).toBe(4);
  });
});

describe('GovernedModelService.computeKpi — expression', () => {
  it('evaluates a formula referencing sibling KPIs by code (profit = revenue - cost = 750)', async () => {
    // revenue (field_sum) = 1000 ; cost (field_sum on fld-cost) = 250 ; 1000-250 = 750
    const { value } = await governedModelService.computeKpi('kpi-expr');
    expect(value).toBe(750);
  });

  it('returns null (not a fabricated 0) when the expression config is missing', async () => {
    KPI_ROWS['kpi-empty-expr'] = {
      kpi_id: 'kpi-empty-expr',
      model_id: MODEL_ID,
      code: 'empty',
      formula_type: 'expression',
      source_table_id: null,
      source_field_id: null,
      formula_config: {},
    };
    const { value } = await governedModelService.computeKpi('kpi-empty-expr');
    expect(value).toBeNull();
    delete KPI_ROWS['kpi-empty-expr'];
  });
});

describe('GovernedModelService.computeKpi — canonical_line', () => {
  it('sums only trusted/canonical records (400, not the full 1000)', async () => {
    const { value } = await governedModelService.computeKpi('kpi-canon');
    expect(value).toBe(400);
  });

  it('counts only trusted/canonical records when aggregation=count (2, not 4)', async () => {
    KPI_ROWS['kpi-canon-count'] = {
      ...KPI_ROWS['kpi-canon'],
      kpi_id: 'kpi-canon-count',
      formula_config: { aggregation: 'count' },
    };
    const { value } = await governedModelService.computeKpi('kpi-canon-count');
    expect(value).toBe(2);
    delete KPI_ROWS['kpi-canon-count'];
  });
});

describe('PermissionsService.requireKpiAccess — guard', () => {
  it('denies an unauthorized user with 403 (not 500)', async () => {
    // KPI resolves to a base the user cannot access.
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM tp_kpi_definitions k') && sql.includes('JOIN tp_governed_models')) {
        return Promise.resolve({ rows: [{ base_id: 'base-forbidden' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    // Deny access at the base level.
    const canAccessSpy = vi
      .spyOn(permissionsService, 'canAccessBase')
      .mockResolvedValue(false);

    const statusCode = { code: 0 };
    const jsonBody = { body: undefined as unknown };
    const req = {
      userId: 'user-x',
      organizationId: 'org-x',
      params: { kpiId: 'kpi-sum' },
    } as unknown as Parameters<typeof permissionsService.requireKpiAccess>[0];
    const res = {
      status(c: number) {
        statusCode.code = c;
        return this;
      },
      json(b: unknown) {
        jsonBody.body = b;
        return this;
      },
    } as unknown as Parameters<typeof permissionsService.requireKpiAccess>[1];
    const next = vi.fn();

    permissionsService.requireKpiAccess(req, res, next);
    // Let the promise chain settle.
    await new Promise((r) => setTimeout(r, 0));

    expect(statusCode.code).toBe(403);
    expect(next).not.toHaveBeenCalled();
    canAccessSpy.mockRestore();
  });

  it('allows an authorized user (calls next, no error status)', async () => {
    mockQuery.mockReset();
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM tp_kpi_definitions k') && sql.includes('JOIN tp_governed_models')) {
        return Promise.resolve({ rows: [{ base_id: 'base-ok' }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const canAccessSpy = vi
      .spyOn(permissionsService, 'canAccessBase')
      .mockResolvedValue(true);

    let statusCalled = false;
    const req = {
      userId: 'user-y',
      organizationId: 'org-y',
      params: { kpiId: 'kpi-sum' },
    } as unknown as Parameters<typeof permissionsService.requireKpiAccess>[0];
    const res = {
      status() {
        statusCalled = true;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Parameters<typeof permissionsService.requireKpiAccess>[1];
    const next = vi.fn();

    permissionsService.requireKpiAccess(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledTimes(1);
    expect(statusCalled).toBe(false);
    canAccessSpy.mockRestore();
  });
});
