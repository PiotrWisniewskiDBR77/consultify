/**
 * N4 (odbiór adwersaryjny 20260910, BEZPIECZEŃSTWO) — `validateTask`
 * (pmoValidation.middleware.ts) checked "does this initiativeId exist at
 * all" with `SELECT id FROM initiatives WHERE id = ?`, no
 * `organization_id` filter. Any authenticated caller could create a task
 * pointing at an initiativeId belonging to a DIFFERENT organization and the
 * gate would answer "exists" — the one PMO existence-check found without
 * the tenant filter every sibling gate has (see
 * `ProjectController.assertProjectInCallerOrg` for the established pattern:
 * a foreign-org row must be INDISTINGUISHABLE from a missing one — 404,
 * never 403, so the response never confirms the row exists elsewhere).
 *
 * NOTE for whoever reads this next: `grep -rl "pmoValidation" server/src`
 * (outside this file and the archived `_backup/ts-js-collisions/*.js`) comes
 * back EMPTY — `validateTask` is not wired into any route today. This test
 * proves the gate's own logic is now tenant-scoped; it does not claim the
 * gate sits on a live request path.
 */
import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(),
}));
vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const DbPromise = await import('../../utils/DbPromise.js');
const { validateTask } = await import('../pmoValidation.middleware.js');

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: any };
}

const OTHER_ORG_INITIATIVE_ID = '11111111-1111-1111-1111-111111111111';
const OWN_ORG_INITIATIVE_ID = '22222222-2222-2222-2222-222222222222';

describe('validateTask — organization scope on the initiative-existence check (N4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401s with no organizationId on the request — never queries the DB blind', async () => {
    const req = { body: { initiativeId: OWN_ORG_INITIATIVE_ID } } as any;
    const res = makeRes();
    const next = vi.fn();

    await validateTask(req, res, next as unknown as NextFunction);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it(
    'MUTATION GUARD: the DB query is scoped to the caller org — a foreign-org ' +
      'initiativeId gets 404 (indistinguishable from truly missing), never treated as found',
    async () => {
      (DbPromise.get as any).mockImplementation(
        async (_sql: string, params: unknown[]) => {
          // A row exists for this id, but ONLY under a different organization —
          // the fixed query's `AND organization_id = ?` must exclude it.
          const [id, organizationId] = params;
          if (id === OTHER_ORG_INITIATIVE_ID && organizationId === 'caller-org') {
            return undefined; // not visible to this org
          }
          return undefined;
        }
      );

      const req = {
        body: { initiativeId: OTHER_ORG_INITIATIVE_ID },
        organizationId: 'caller-org',
      } as any;
      const res = makeRes();
      const next = vi.fn();

      await validateTask(req, res, next as unknown as NextFunction);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(404);
      expect(res.body).toMatchObject({ rule: 'TASK_INITIATIVE_REQUIRED' });

      // The query itself must carry the caller's organizationId as a bind param —
      // this is what actually closes the hole (a query without it would find the
      // foreign-org row and call next()).
      const [, params] = (DbPromise.get as any).mock.calls[0];
      expect(params).toEqual([OTHER_ORG_INITIATIVE_ID, 'caller-org']);
    }
  );

  it('calls next() when the initiative exists IN the caller org', async () => {
    (DbPromise.get as any).mockImplementation(async (_sql: string, params: unknown[]) => {
      const [id, organizationId] = params;
      if (id === OWN_ORG_INITIATIVE_ID && organizationId === 'caller-org') {
        return { id: OWN_ORG_INITIATIVE_ID };
      }
      return undefined;
    });

    const req = {
      body: { initiativeId: OWN_ORG_INITIATIVE_ID },
      organizationId: 'caller-org',
    } as any;
    const res = makeRes();
    const next = vi.fn();

    await validateTask(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(0);
  });
});
