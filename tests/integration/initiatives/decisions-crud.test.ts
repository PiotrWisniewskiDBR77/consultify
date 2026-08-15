/**
 * M03 / decisions — GET /decisions (DecisionController.getDecisions).
 *
 * Regression guard for the getTableColumns guard (finding
 * "subquery_on_optional_table_silent_empty"): the blocker-count subquery over
 * `decision_impacts` must be replaced by a literal `0` when that table/column
 * is absent, so a schema-drifted env returns the decisions list instead of a
 * SILENTLY empty `[]` (queryAll swallows the SQL error).
 *
 * Exercises the REAL controller method, mocking only leaf deps:
 *   - dbSchema.getTableColumns → control the presence of decision_impacts;
 *   - queryHelpers.queryAll/queryRun → return controlled decision rows.
 *
 * Asserts:
 *   - decision_impacts present → SQL uses the COUNT subquery + list is returned
 *     org-scoped (d.organization_id = ?), not empty;
 *   - decision_impacts absent → SQL uses literal `0` (no decision_impacts
 *     reference) AND the list is still returned (not silently emptied);
 *   - blockedItemsCount is surfaced from the row.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryAll, mockQueryRun, mockGetTableColumns } = vi.hoisted(() => ({
  mockQueryAll: vi.fn(async () => [] as any[]),
  mockQueryRun: vi.fn(async () => ({ changes: 0, lastID: 0 })),
  mockGetTableColumns: vi.fn(async () => new Set<string>()),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: vi.fn(),
  queryAll: (...a: any[]) => mockQueryAll(...a),
  queryRun: (...a: any[]) => mockQueryRun(...a),
  queryFirst: vi.fn(),
  getTableColumns: vi.fn(async () => []),
  query: (...a: any[]) => mockQueryAll(...a),
  run: (...a: any[]) => mockQueryRun(...a),
  buildInPlaceholders: (values: unknown[]) => values.map(() => '?').join(', '),
  buildOrgFilter: () => '',
  buildUserFilter: () => '',
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (...a: any[]) => mockGetTableColumns(...a),
}));

import DecisionController from '../../../server/src/controllers/DecisionController.js';

const ORG_ID = 'org-1';

const decisionRow = {
  id: 'dec-1',
  title: 'Wybór dostawcy ERP',
  description: 'Decyzja o wyborze dostawcy systemu ERP.',
  type: 'strategic',
  status: 'pending',
  decision_maker_id: 'u1',
  created_by: 'u2',
  project_id: null,
  // far-future deadline → not overdue → no escalation UPDATE side-effect
  deadline: '2099-12-31T00:00:00.000Z',
  created_at: '2026-06-01T00:00:00.000Z',
  priority: 'high',
  impact: 'high',
  escalation_level: 'none',
  owner_name: 'Anna Nowak',
  requested_by_name: 'Jan Kowalski',
  project_name: null,
  blocked_items_count: 3,
};

/** colsByTable: map of table → column names present. */
function setColumns(colsByTable: Record<string, string[]>) {
  mockGetTableColumns.mockImplementation(async (table: string) => {
    return new Set<string>(colsByTable[table] ?? []);
  });
}

async function callGet(): Promise<{ statusCode: number | null; json: any }> {
  const req: any = { query: {}, user: { id: 'u1', organizationId: ORG_ID, role: 'ADMIN' } };
  let statusCode: number | null = null;
  let jsonBody: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
  };
  let caught: any = null;
  await (DecisionController as any).getDecisions(req, res, (e: any) => {
    caught = e;
  });
  if (caught) throw caught;
  return { statusCode, json: jsonBody };
}

describe('M03 — GET /decisions getTableColumns guard (real controller)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAll.mockImplementation(async () => [{ ...decisionRow }]);
    mockQueryRun.mockImplementation(async () => ({ changes: 0, lastID: 0 }));
  });

  it('decision_impacts present → COUNT subquery + org-scoped list (not empty)', async () => {
    setColumns({
      decisions: ['escalation_level', 'source_type'],
      decision_impacts: ['is_blocker'],
    });

    const res = await callGet();

    expect(mockQueryAll).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQueryAll.mock.calls[0] as [string, any[]];
    expect(String(sql)).toMatch(/FROM decision_impacts di/i);
    expect(String(sql)).toMatch(/is_blocker::text IN \('1','true'\)/i);
    expect(String(sql)).toMatch(/d\.organization_id = \?/i);
    expect(params).toContain(ORG_ID);

    expect(Array.isArray(res.json)).toBe(true);
    expect(res.json).toHaveLength(1);
    expect(res.json[0]).toEqual(expect.objectContaining({ id: 'dec-1', blockedItemsCount: 3 }));
  });

  it('decision_impacts ABSENT → literal 0, no decision_impacts ref, list NOT silently empty', async () => {
    // The drift scenario: decisions table exists but decision_impacts does not.
    setColumns({ decisions: ['escalation_level'], decision_impacts: [] });

    const res = await callGet();

    const [sql] = mockQueryAll.mock.calls[0] as [string, any[]];
    // Guard kicked in: the blocker subquery is gone (literal 0 substituted).
    expect(String(sql)).not.toMatch(/FROM decision_impacts/i);
    expect(String(sql)).toMatch(/0 as blocked_items_count/i);

    // Crucially the list is still returned (the bug was a silent []).
    expect(Array.isArray(res.json)).toBe(true);
    expect(res.json).toHaveLength(1);
    expect(res.json[0].id).toBe('dec-1');
  });
});
