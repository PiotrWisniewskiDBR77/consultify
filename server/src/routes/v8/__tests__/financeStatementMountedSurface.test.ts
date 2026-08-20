import express, { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ get: vi.fn(), all: vi.fn(), run: vi.fn() }));
vi.mock('../../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => database.get(...args),
  all: (...args: unknown[]) => database.all(...args),
  run: (...args: unknown[]) => database.run(...args),
}));

import {
  createMountedFinanceStatementRouter,
  isMountedFinanceStatementSurface,
} from '../financeStatementMountedSurface.js';

describe('mounted Finance Statement surface before the global V8 gate', () => {
  it.each([
    ['GET', '/admin/flags'],
    ['GET', '/finance/canonical-lines'],
    ['GET', '/finance/statement-packs'],
    ['GET', '/finance/statement-packs/pack-1'],
    ['GET', '/finance/statements'],
    ['GET', '/finance/statements/stmt-1'],
    ['POST', '/finance/statements/upload-and-analyze'],
    ['POST', '/finance/statements/stmt-1/detect'],
    ['POST', '/finance/statements/stmt-1/extract'],
    ['POST', '/finance/statements/stmt-1/map'],
    ['POST', '/finance/statements/stmt-1/confirm'],
    ['PUT', '/finance/statements/stmt-1/values'],
    ['GET', '/finance/statements/stmt-1/source-receipt'],
    ['POST', '/finance/statements/stmt-1/manual-mapping-decisions'],
  ])('allows %s %s', (method, path) => {
    expect(isMountedFinanceStatementSurface(method, path)).toBe(true);
  });

  it.each([
    ['PUT', '/admin/flags/chat'],
    ['GET', '/admin/flags/all'],
    ['GET', '/finance/analyses'],
    ['POST', '/finance/models'],
    ['DELETE', '/finance/statements/stmt-1'],
    ['GET', '/assessment'],
  ])('keeps unrelated or broader V8 request gated: %s %s', (method, path) => {
    expect(isMountedFinanceStatementSurface(method, path)).toBe(false);
  });

  it('reaches only exact flags and Statement handlers when global and org V8 gates are disabled', async () => {
    const observed: string[] = [];
    const pass = (name: string) => (req: any, _res: any, next: any) => {
      observed.push(name);
      req.user = { id: 'user-1', organizationId: 'org-v8-disabled' };
      req.organizationId = 'org-v8-disabled';
      req.userId = 'user-1';
      next();
    };
    const flags = Router().get('/', (_req, res) => res.json({ surface: 'flags' }));
    const finance = Router()
      .get('/statements', (_req, res) => res.json({ surface: 'statements' }))
      .post('/statements/statement-1/map', (_req, res) => res.json({ surface: 'map' }));
    const app = express();
    app.use(express.json());
    app.use(
      '/api/v8',
      createMountedFinanceStatementRouter({
        verifyToken: pass('auth'),
        requireOrgContext: pass('org-context'),
        attachContext: pass('attach-context'),
        metrics: pass('metrics'),
        mutationCanary: pass('mutation-canary'),
        flagsRouter: flags,
        financeRouter: finance,
      })
    );
    const disabledGlobalAndOrgGate = vi.fn((_req, res) =>
      res.status(404).json({ code: 'V8_NOT_ENABLED' })
    );
    app.use('/api/v8', disabledGlobalAndOrgGate);

    await request(app).get('/api/v8/admin/flags').expect(200, { surface: 'flags' });
    await request(app).get('/api/v8/finance/statements').expect(200, { surface: 'statements' });
    await request(app)
      .post('/api/v8/finance/statements/statement-1/map')
      .expect(200, { surface: 'map' });
    await request(app).get('/api/v8/finance/analyses').expect(404, { code: 'V8_NOT_ENABLED' });
    await request(app).get('/api/v8/admin/flags/all').expect(404, { code: 'V8_NOT_ENABLED' });

    expect(disabledGlobalAndOrgGate).toHaveBeenCalledTimes(2);
    expect(observed).toEqual([
      ...['auth', 'org-context', 'attach-context', 'metrics', 'mutation-canary'],
      ...['auth', 'org-context', 'attach-context', 'metrics', 'mutation-canary'],
      ...['auth', 'org-context', 'attach-context', 'metrics', 'mutation-canary'],
    ]);
  });

  it('keeps the exact mounted surface authenticated', async () => {
    const app = express();
    app.use(
      '/api/v8',
      createMountedFinanceStatementRouter({
        verifyToken: (_req, res) => res.status(401).json({ code: 'UNAUTHENTICATED' }),
      })
    );
    await request(app)
      .get('/api/v8/finance/statements')
      .expect(401, { code: 'UNAUTHENTICATED' });
  });

  it('uses the real Finance membership/editor wall before handlers while V8 gates are disabled', async () => {
    database.get.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM organization_members')) {
        return {
          status: 'ACTIVE',
          role: params[0] === 'member-user' ? 'MEMBER' : 'OWNER',
        };
      }
      return null;
    });
    database.all.mockResolvedValue([]);
    database.run.mockResolvedValue({ changes: 0 });
    const identity = (req: any, _res: any, next: any) => {
      const userId = String(req.headers['x-test-user'] || '');
      req.user = { id: userId, organizationId: 'org-v8-disabled' };
      req.userId = userId;
      req.organizationId = 'org-v8-disabled';
      req.v8Context = {
        organizationId: 'org-v8-disabled',
        userId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      };
      next();
    };
    const pass = (_req: any, _res: any, next: any) => next();
    const app = express();
    app.use(express.json());
    app.use(
      '/api/v8',
      createMountedFinanceStatementRouter({
        verifyToken: identity,
        requireOrgContext: pass,
        attachContext: pass,
        metrics: pass,
        mutationCanary: pass,
      })
    );
    app.use('/api/v8', (_req, res) => res.status(404).json({ code: 'V8_NOT_ENABLED' }));

    const denied = await request(app)
      .post('/api/v8/finance/statements/missing-statement/map')
      .set('x-test-user', 'member-user')
      .send({});
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ code: 'FINANCE_EDIT_FORBIDDEN' });

    const owner = await request(app)
      .post('/api/v8/finance/statements/missing-statement/map')
      .set('x-test-user', 'owner-user')
      .send({});
    expect(owner.status).toBe(404);
    expect(owner.body.error).toMatch(/Statement not found/i);
  });
});
