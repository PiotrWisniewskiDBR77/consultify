/**
 * M13 Depth · Seria C · C1 — POST /initiatives/similar-check.
 *
 * Exercises the REAL InitiativeController.checkSimilarInitiatives against the
 * REAL deterministic similarity service (initiativeSimilarityService —
 * pure Jaccard, org-scoped, no LLM), mocking only the DB query-helpers leaf so
 * the candidate is scored against a controlled set of org initiatives.
 *
 * Asserts the advisory contract:
 *   - 401 when there is no org on the request;
 *   - empty `name` (and no summary) → { similar: [] } (no candidate tokens);
 *   - a near-duplicate row → { similar:[{id,name,score}] } above threshold;
 *   - the org-scoped fetch SQL is the one driven (queryAll called with orgId);
 *   - `excludeId` removes the matching row from the result.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryAll } = vi.hoisted(() => ({
  mockQueryAll: vi.fn(async () => [] as any[]),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: vi.fn(),
  queryAll: (...a: any[]) => mockQueryAll(...a),
  queryRun: vi.fn(async () => ({ changes: 0, lastID: 0 })),
  queryFirst: vi.fn(),
  getTableColumns: vi.fn(async () => []),
  query: (...a: any[]) => mockQueryAll(...a),
  run: vi.fn(async () => ({ changes: 0, lastID: 0 })),
  buildInPlaceholders: (values: unknown[]) => values.map(() => '?').join(', '),
  buildOrgFilter: () => '',
  buildUserFilter: () => '',
}));

import { InitiativeController } from '../../../server/src/controllers/InitiativeController.js';

const ORG_ID = 'org-1';

async function callSimilar(opts: {
  body: Record<string, unknown> | undefined;
  withOrg?: boolean;
}): Promise<{ statusCode: number | null; json: any }> {
  const req: any = {
    body: opts.body,
    user: opts.withOrg === false ? {} : { id: 'u1', organizationId: ORG_ID, role: 'ADMIN' },
  };
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
  await (InitiativeController.checkSimilarInitiatives as any)(req, res, (e: any) => {
    caught = e;
  });
  if (caught) throw caught;
  return { statusCode, json: jsonBody };
}

describe('M13/C1 — POST /similar-check (real controller + real similarity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAll.mockImplementation(async () => []);
  });

  it('401 when the request carries no organization', async () => {
    const res = await callSimilar({ body: { name: 'x' }, withOrg: false });
    expect(res.statusCode).toBe(401);
    expect(res.json).toEqual(expect.objectContaining({ error: 'Unauthorized' }));
    // No org → never touches the DB.
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('empty name + no summary → { similar: [] } without querying', async () => {
    const res = await callSimilar({ body: { name: '', summary: '' } });
    expect(res.json).toEqual({ similar: [] });
    // No candidate tokens → service short-circuits before the org fetch.
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('near-duplicate row → returned above threshold, org-scoped fetch', async () => {
    mockQueryAll.mockImplementation(async () => [
      {
        id: 'ini-dup',
        name: 'Automatyzacja procesu fakturowania klientów',
        summary: 'Wdrożenie automatyzacji wystawiania faktur dla klientów.',
        status: 'EXECUTING',
      },
      {
        id: 'ini-far',
        name: 'Rekrutacja zespołu sprzedaży',
        summary: 'Zatrudnienie handlowców w regionie północnym.',
        status: 'DRAFT',
      },
    ]);

    const res = await callSimilar({
      body: {
        name: 'Automatyzacja fakturowania klientów',
        summary: 'Automatyzacja wystawiania faktur dla klientów firmy.',
      },
    });

    expect(Array.isArray(res.json?.similar)).toBe(true);
    const ids = res.json.similar.map((s: any) => s.id);
    expect(ids).toContain('ini-dup');
    expect(ids).not.toContain('ini-far');
    const dup = res.json.similar.find((s: any) => s.id === 'ini-dup');
    expect(dup.score).toBeGreaterThan(0.25);
    expect(dup).toEqual(
      expect.objectContaining({ id: 'ini-dup', status: 'EXECUTING' })
    );

    // Org-scoped fetch: the org id is passed as the bound parameter.
    expect(mockQueryAll).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQueryAll.mock.calls[0] as [string, any[]];
    expect(String(sql)).toMatch(/FROM initiatives/i);
    expect(String(sql)).toMatch(/organization_id = \?/i);
    expect(params).toEqual([ORG_ID]);
  });

  it('excludeId removes the matching row from the result', async () => {
    mockQueryAll.mockImplementation(async () => [
      {
        id: 'ini-self',
        name: 'Automatyzacja procesu fakturowania klientów',
        summary: 'Wdrożenie automatyzacji wystawiania faktur dla klientów.',
        status: 'DRAFT',
      },
    ]);

    const res = await callSimilar({
      body: {
        name: 'Automatyzacja fakturowania klientów',
        summary: 'Automatyzacja wystawiania faktur dla klientów firmy.',
        excludeId: 'ini-self',
      },
    });

    expect(res.json.similar.map((s: any) => s.id)).not.toContain('ini-self');
  });
});
