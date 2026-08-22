import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import * as DbPromise from '../../utils/DbPromise.js';

vi.mock('../../utils/DbPromise.js', async () => {
  const actual = await vi.importActual<typeof import('../../utils/DbPromise.js')>(
    '../../utils/DbPromise.js'
  );
  return { ...actual, get: vi.fn() };
});

// Gate A / WP-A04 follow-up: the FIN-06 candidate-handoff mounts
// (investment-case, digitization-analysis, statement-pack, valuation-recommendation) were mounted
// in Gateway.ts without gatewayVerifyToken, unlike every sibling finance
// mount (e.g. /api/financial-modeling). Each router's requireUser() throws
// on a missing req.user, so this was "broken for everyone" rather than an
// open hole, but it diverged from the documented convention in the route
// files' own header comments ("whichever verifyToken-equivalent already
// runs ahead of this router populates req.user") without anything actually
// running ahead. This test pins the mount wiring statically so a future
// edit cannot silently drop the guard again.
describe('finance candidate-handoff mounts require gatewayVerifyToken', () => {
  const gatewaySrc = readFileSync(path.resolve(__dirname, '../../Gateway.ts'), 'utf8');

  const mounts = [
    "'/api/finance/candidate-handoff/investment-case'",
    "'/api/finance/candidate-handoff/digitization-analysis'",
    "'/api/finance/candidate-handoff/statement-pack'",
    "'/api/finance/candidate-handoff/valuation-recommendation'",
  ];

  it.each(mounts)('%s orders JWT then strict membership then router', (mountPath) => {
    const idx = gatewaySrc.indexOf(mountPath);
    expect(idx).toBeGreaterThan(-1);
    const mountBlock = gatewaySrc.slice(idx, idx + 260);
    expect(mountBlock).toContain('gatewayVerifyToken');
    expect(mountBlock).toContain('tenantStrictMembership');
    expect(mountBlock.indexOf('gatewayVerifyToken')).toBeLessThan(
      mountBlock.indexOf('tenantStrictMembership')
    );
  });
});

describe('finance candidate-handoff strict membership matrix', () => {
  const get = vi.mocked(DbPromise.get);
  const next = vi.fn() as unknown as NextFunction;
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;

  beforeEach(() => {
    vi.clearAllMocks();
    status.mockReturnValue({ json });
  });

  it('allows an ACTIVE ordinary tenant member', async () => {
    get.mockResolvedValueOnce({ status: 'ACTIVE' });
    await requireActiveMembership(
      { user: { id: 'u-1', organizationId: 'o-1', role: 'USER' } } as any,
      response,
      next
    );
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('organization_members'),
      ['u-1', 'o-1'],
      {
        fallback: false,
      }
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    ['ordinary missing', undefined],
    ['ordinary revoked', { status: 'REVOKED' }],
    ['SUPERADMIN without membership', undefined],
  ])('denies %s without reaching a handler', async (_label, membership) => {
    get.mockResolvedValueOnce(membership as any);
    await requireActiveMembership(
      {
        user: {
          id: 'u-1',
          organizationId: 'o-1',
          role: _label.startsWith('SUPERADMIN') ? 'SUPERADMIN' : 'USER',
          isSuperAdmin: _label.startsWith('SUPERADMIN'),
        },
      } as any,
      response,
      next
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed with 503 on a membership lookup error and recovers next request', async () => {
    get.mockRejectedValueOnce(new Error('membership unavailable')).mockResolvedValueOnce({
      status: 'ACTIVE',
    });
    const request = { user: { id: 'u-1', organizationId: 'o-1', role: 'OWNER' } } as any;
    await requireActiveMembership(request, response, next);
    expect(status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
    vi.clearAllMocks();
    status.mockReturnValue({ json });
    await requireActiveMembership(request, response, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
