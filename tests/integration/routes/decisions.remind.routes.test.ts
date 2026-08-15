// @vitest-environment node

import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { makeTestApp } from '../_helpers/testApp';

const noop = vi.fn(async (_req: any, res: any) => res.status(200).json({ ok: true }));
const remindDecision = vi.fn(async (_req: any, res: any) =>
  res.status(200).json({ success: true })
);

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/controllers/DecisionController.js', () => ({
  default: new Proxy(
    {
      getDecisions: noop,
      getBottlenecks: noop,
      getDecisionById: noop,
      createDecision: noop,
      updateDecision: noop,
      decide: noop,
      escalateDecision: noop,
      remindDecision,
      getCreatedTasks: noop,
      transitionWorkflow: noop,
    },
    { get: (target, key) => (target as any)[key] ?? noop }
  ),
}));

async function makeDecisionsApp() {
  const router = (await import('../../../server/src/routes/pmo/decisions.routes.ts')).default;
  return makeTestApp({ mountPath: '/api/decisions', router });
}

describe('Decisions remind endpoint', () => {
  it('POST /api/decisions/:id/remind returns 200 for empty body', async () => {
    const app = await makeDecisionsApp();
    const res = await request(app).post('/api/decisions/d-1/remind').send({}).expect(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true }));
    expect(remindDecision).toHaveBeenCalledTimes(1);
  });

  it('POST /api/decisions/:id/remind returns 400 when message is too long', async () => {
    const app = await makeDecisionsApp();
    const msg = 'x'.repeat(501);
    const res = await request(app)
      .post('/api/decisions/d-1/remind')
      .send({ message: msg })
      .expect(400);
    expect(res.body?.error || '').toMatch(/at most|too big|max/i);
    expect(remindDecision).not.toHaveBeenCalled();
  });
});
