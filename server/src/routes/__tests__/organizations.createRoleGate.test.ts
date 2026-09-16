/**
 * K-21, część druga (dług bezpieczeństwa z triage 16.09): `POST /api/organizations`
 * stała wyłącznie za `verifyToken` — KAŻDY zalogowany principal, łącznie z
 * kontem demo (rola CONSULTANT) i respondentem pilota, mógł fabrykować kolejne
 * tenanty. Sąsiednie trasy organizacji (`/:orgId/members`, `/:orgId/admin/*`)
 * mają `requireRole('ADMIN','OWNER','SUPERADMIN')` — ta trasa dostaje tę samą
 * konwencję.
 *
 * Test używa PRAWDZIWEGO `requireRole` (tylko `verifyToken` jest atrapą, żeby
 * wstrzyknąć rolę) — inaczej mierzyłby atrapę, nie bramkę.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let user: any = null;
const createOrganization = vi.fn((_req: any, res: any) => res.status(201).json({ id: 'org-new' }));

vi.mock('../../middleware/auth.middleware.js', async () => {
  const actual: any = await vi.importActual('../../middleware/auth.middleware.js');
  return {
    ...actual,
    requireRole: actual.requireRole,
    verifyToken: (req: any, res: any, next: any) => {
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      req.user = user;
      req.userId = user.id;
      req.userRole = user.role;
      next();
    },
  };
});

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../controllers/OrganizationController.js', () => ({
  default: new Proxy(
    {},
    {
      get: (_t, prop: string) =>
        prop === 'createOrganization'
          ? (req: any, res: any) => createOrganization(req, res)
          : (_req: any, res: any) => res.json({}),
    }
  ),
}));

vi.mock('../../controllers/AdminIamController.js', () => ({
  AdminIamController: {
    list: (_req: any, res: any) => res.json({}),
    command: () => (_req: any, res: any) => res.json({}),
    changeRole: (_req: any, res: any) => res.json({}),
    revokeMember: (_req: any, res: any) => res.json({}),
  },
}));

const routesPromise = import('../organization/organizations.routes.js');

const app = async () => {
  const { default: routes } = await routesPromise;
  const a = express();
  a.use(express.json());
  a.use('/api/organizations', routes as any);
  return a;
};

describe('K-21 — POST /api/organizations wymaga roli', () => {
  beforeEach(() => {
    user = null;
    createOrganization.mockClear();
  });

  it('bez tokenu: 401', async () => {
    const res = await request(await app()).post('/api/organizations').send({ name: 'Acme' });
    expect(res.status).toBe(401);
    expect(createOrganization).not.toHaveBeenCalled();
  });

  it('CONSULTANT (konto demo): 403 — kontroler w ogóle nie jest wołany', async () => {
    user = { id: 'u1', role: 'CONSULTANT' };
    const res = await request(await app()).post('/api/organizations').send({ name: 'Acme' });
    expect(res.status).toBe(403);
    expect(createOrganization).not.toHaveBeenCalled();
  });

  it('USER: 403', async () => {
    user = { id: 'u2', role: 'USER' };
    const res = await request(await app()).post('/api/organizations').send({ name: 'Acme' });
    expect(res.status).toBe(403);
    expect(createOrganization).not.toHaveBeenCalled();
  });

  for (const role of ['ADMIN', 'OWNER', 'SUPERADMIN']) {
    it(`${role}: przechodzi do kontrolera`, async () => {
      user = { id: 'u3', role };
      const res = await request(await app()).post('/api/organizations').send({ name: 'Acme' });
      expect(res.status).toBe(201);
      expect(createOrganization).toHaveBeenCalledTimes(1);
    });
  }
});
