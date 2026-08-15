import express, { type NextFunction, type Request } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const { createProgram, listPrograms } = vi.hoisted(() => ({
  createProgram: vi.fn(async (_orgId: string, userId: string, input: { name: string }) => ({
    id: 'program-1',
    organizationId: 'org-a',
    name: input.name,
    description: null,
    objective: null,
    status: 'draft',
    preset: null,
    config: {},
    createdBy: userId,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
  })),
  listPrograms: vi.fn(async () => ({ programs: [], total: 0, limit: 50, offset: 0 })),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));
vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: unknown, _res: unknown, next: NextFunction) => next(),
}));
vi.mock('../../services/auditProgramService.js', () => ({
  computeCompletion: vi.fn(),
  createProgram,
  deleteProgram: vi.fn(),
  generateSurveys: vi.fn(),
  getProgram: vi.fn(),
  listPrograms,
  updateProgram: vi.fn(),
}));
vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

async function appFor(role: string) {
  const { default: router } = await import('../audit-programs.routes.js');
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res, next) => {
    Object.assign(req, {
      organizationId: 'org-a',
      userId: `user-${role}`,
      userRole: role,
      user: { id: `user-${role}`, organizationId: 'org-a', role },
    });
    next();
  });
  app.use('/api/audit', router);
  return app;
}

describe('audit-programs base beta role policy', () => {
  it('allows an ordinary member to read the org-scoped registry', async () => {
    const response = await request(await appFor('member')).get('/api/audit/programs');
    expect(response.status).toBe(200);
  });

  it('denies an ordinary member a create mutation', async () => {
    const response = await request(await appFor('member'))
      .post('/api/audit/programs')
      .send({ name: 'Forbidden program' });
    expect(response.status).toBe(403);
    expect(createProgram).not.toHaveBeenCalled();
  });

  it('allows a consultant to create and cold-reads the returned identity', async () => {
    const app = await appFor('consultant');
    const response = await request(app).post('/api/audit/programs').send({ name: 'Beta audit' });
    expect(response.status).toBe(201);
    expect(response.body.program).toMatchObject({
      id: 'program-1',
      organizationId: 'org-a',
      name: 'Beta audit',
    });
  });
});
