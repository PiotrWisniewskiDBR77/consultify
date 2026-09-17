/**
 * B2 / N-2·N-3 point 4 (DEC-575) — the controller's SECOND sort over
 * `getCurrentOrganizations` must be null-safe and deterministically tie-broken.
 *
 * `organizations.name` is nullable. The pre-fix controller sorted with
 * `left.name.localeCompare(right.name)`; a single NULL name made that throw a
 * TypeError and 500 the whole `GET /api/organizations/current` switcher load.
 * The fix guards with `String(name ?? '')` and adds `id` as the final tiebreaker
 * so equal names keep a deterministic order (the JS counterpart of the SQL
 * `ORDER BY … o.name ASC, o.id ASC`).
 *
 * Unlike the SQL tiebreaker (which a fresh PostgreSQL happens to satisfy without
 * being told — see the .pg.test honesty note), this JS sort IS mutation-
 * falsifiable: V8's Array#sort is stable, so dropping the id tiebreaker leaves
 * equal-name rows in their INPUT order, and dropping the null guard throws.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrganizationController from '../OrganizationController.js';

const getUserOrganizations = vi.fn();

vi.mock('../../services/organizationService.js', () => ({
  getUserOrganizations: (...args: unknown[]) => getUserOrganizations(...args),
}));

function createResponse() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.headers = {} as Record<string, string>;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: any) => {
    res.body = body;
    return res;
  });
  res.set = vi.fn((key: string, value: string) => {
    res.headers[key] = value;
    return res;
  });
  return res;
}

describe('OrganizationController.getCurrentOrganizations sort safety', () => {
  beforeEach(() => {
    getUserOrganizations.mockReset();
  });

  it('is null-safe, puts current first, and tie-breaks equal names by id', async () => {
    // Deliberately fed in an order the sort must fix: the larger id ('org-b') of
    // the equal-name pair comes FIRST, and a NULL name sits in the middle.
    getUserOrganizations.mockResolvedValue([
      { id: 'org-b', name: 'Tie', billing_status: 'ACTIVE', industry: null, role: 'MEMBER' },
      { id: 'org-null', name: null, billing_status: 'ACTIVE', industry: null, role: 'MEMBER' },
      { id: 'org-a', name: 'Tie', billing_status: 'ACTIVE', industry: null, role: 'MEMBER' },
      { id: 'org-cur', name: 'Current', billing_status: 'ACTIVE', industry: null, role: 'OWNER' },
    ]);

    const req: any = { user: { id: 'u-1' }, organizationId: 'org-cur' };
    const res = createResponse();

    await OrganizationController.getCurrentOrganizations(req, res, vi.fn());

    // Must not throw on the NULL name, and must respond exactly once.
    expect(res.json).toHaveBeenCalledTimes(1);
    const orgs = res.body.organizations.map((o: any) => o.id);
    // current first; then '' (null) before 'Tie'; then the tie pair id-ordered.
    expect(orgs).toEqual(['org-cur', 'org-null', 'org-a', 'org-b']);
    expect(res.body.organizations[0].is_current).toBe(true);
    expect(res.headers['Cache-Control']).toBe('no-store, private');
  });

  it('falls back to the row is_current flag when the request carries no org context', async () => {
    getUserOrganizations.mockResolvedValue([
      { id: 'org-x', name: 'X', billing_status: 'ACTIVE', industry: null, role: 'MEMBER', is_current: false },
      { id: 'org-y', name: 'Y', billing_status: 'ACTIVE', industry: null, role: 'MEMBER', is_current: true },
    ]);

    const req: any = { user: { id: 'u-1' } };
    const res = createResponse();

    await OrganizationController.getCurrentOrganizations(req, res, vi.fn());

    expect(res.body.organizations.map((o: any) => o.id)).toEqual(['org-y', 'org-x']);
  });

  it('401s when the request has no authenticated user', async () => {
    const req: any = {};
    const res = createResponse();

    await OrganizationController.getCurrentOrganizations(req, res, vi.fn());

    expect(res.statusCode).toBe(401);
    expect(getUserOrganizations).not.toHaveBeenCalled();
  });
});
