/**
 * M13 Depth · Seria K · K1 — POST /initiatives/validate-card.
 *
 * Exercises the REAL InitiativeController.validateCard against the REAL
 * deterministic §B3 validators (initiativeCardValidators.validateCardContent —
 * pure, no LLM, no DB), mocking only the DB query-helpers leaf so the import
 * graph resolves without a live Postgres.
 *
 * Asserts the advisory contract:
 *   - 401 when there is no org on the request;
 *   - clean text → { issues: [] };
 *   - filler text → { issues:[{rule:'no_filler', ...}] } returned with HTTP 200
 *     (advisory: issues are surfaced, the request is NOT rejected);
 *   - requested rules are honoured (problem_len fires on a too-short field).
 */
import { describe, expect, it, vi } from 'vitest';

// Leaf DB layer — never actually hit by validateCard, but the controller module
// imports queryHelpers at module scope, so it must resolve without a live DB.
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(async () => []),
  queryRun: vi.fn(async () => ({ changes: 0, lastID: 0 })),
  queryFirst: vi.fn(),
  getTableColumns: vi.fn(async () => []),
  query: vi.fn(async () => []),
  run: vi.fn(async () => ({ changes: 0, lastID: 0 })),
  buildInPlaceholders: (values: unknown[]) => values.map(() => '?').join(', '),
  buildOrgFilter: () => '',
  buildUserFilter: () => '',
}));

import { InitiativeController } from '../../../server/src/controllers/InitiativeController.js';

const ORG_ID = 'org-1';

async function callValidate(opts: {
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
  await (InitiativeController.validateCard as any)(req, res, (e: any) => {
    caught = e;
  });
  if (caught) throw caught;
  return { statusCode, json: jsonBody };
}

describe('M13/K1 — POST /validate-card (real controller + real validators)', () => {
  it('401 when the request carries no organization', async () => {
    const res = await callValidate({ body: { text: 'cokolwiek' }, withOrg: false });
    expect(res.statusCode).toBe(401);
    expect(res.json).toEqual(expect.objectContaining({ error: 'Unauthorized' }));
  });

  it('clean Polish prose → { issues: [] }', async () => {
    const res = await callValidate({
      body: { text: 'Skrócenie czasu realizacji zamówień klienta o trzydzieści procent.' },
    });
    expect(res.statusCode).toBeNull(); // res.json without an explicit status → 200
    expect(res.json).toEqual({ issues: [] });
  });

  it('filler text → no_filler issue, still 200 (advisory, never blocks)', async () => {
    const res = await callValidate({ body: { text: 'Cel projektu: TODO uzupełnić.' } });
    expect(res.statusCode).toBeNull(); // advisory: NOT a 4xx even with issues
    expect(Array.isArray(res.json?.issues)).toBe(true);
    expect(res.json.issues.length).toBeGreaterThanOrEqual(1);
    expect(res.json.issues.map((i: any) => i.rule)).toContain('no_filler');
  });

  it('bracketed placeholder is also caught by no_filler', async () => {
    const res = await callValidate({ body: { text: 'Opis [do uzupełnienia] przez zespół.' } });
    expect(res.json.issues.map((i: any) => i.rule)).toContain('no_filler');
  });

  it('honours an explicit rules list — problem_len fires on a short field', async () => {
    const res = await callValidate({
      body: { text: 'Za krótki opis problemu.', rules: ['problem_len'] },
    });
    expect(res.json.issues.map((i: any) => i.rule)).toContain('problem_len');
  });

  it('empty text → { issues: [] } (empty handled elsewhere)', async () => {
    const res = await callValidate({ body: { text: '' } });
    expect(res.json).toEqual({ issues: [] });
  });
});
