/**
 * S1.14b / B4 — POST /api/onboarding/context answered 404 API_ROUTE_NOT_FOUND.
 *
 * Measured on staging 13.09: the front has called this route since Phase E
 * (`src/services/api.ts` saveOnboardingContext, `src/services/api/users.api.ts`)
 * but `server/src` never defined it — a phantom caller. "Generate My Strategy"
 * died on its first request, so the wizard that could set
 * `onboarding_status='ORG_SETUP_COMPLETED'` from that screen could not finish.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queries: Array<{ sql: string; params: unknown[] }> = [];
vi.mock('../../database/index.js', () => ({
  getDatabase: () => ({
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (/SELECT attribution_data/i.test(sql)) {
        return { rows: [{ attribution_data: JSON.stringify({ existing: 'keep-me' }) }] };
      }
      return { rows: [] };
    },
  }),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    req.organizationId = 'org-1';
    next();
  },
}));
vi.mock('../../utils/ensureUserOnboardingStatusTable.js', () => ({
  ensureUserOnboardingStatusTable: async () => undefined,
}));
vi.mock('../../services/legalService.js', () => ({ default: {} }));

const buildApp = async () => {
  const { default: router } = await import('../onboarding.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/onboarding', router);
  return app;
};

describe('S1.14b/B4 — POST /api/onboarding/context exists and completes org setup', () => {
  beforeEach(() => {
    queries.length = 0;
  });

  it('answers 200 (not 404) and persists the context', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/api/onboarding/context')
      .send({ role: 'CFO', industry: 'manufacturing', problems: 'Order-to-cash leakage' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.context.role).toBe('CFO');
  });

  it('sets onboarding_status=ORG_SETUP_COMPLETED — the field the trial AI gate reads', async () => {
    const app = await buildApp();
    await request(app).post('/api/onboarding/context').send({ role: 'CFO', problems: 'x' });

    const update = queries.find((q) => /UPDATE organizations/i.test(q.sql));
    expect(update).toBeTruthy();
    expect(update!.sql).toContain("onboarding_status = 'ORG_SETUP_COMPLETED'");
    expect(update!.params[1]).toBe('org-1');
  });

  it('keeps the existing attribution_data instead of overwriting it', async () => {
    const app = await buildApp();
    await request(app).post('/api/onboarding/context').send({ role: 'CFO', problems: 'x' });

    const update = queries.find((q) => /UPDATE organizations/i.test(q.sql));
    const written = JSON.parse(String(update!.params[0]));
    expect(written.existing).toBe('keep-me');
    expect(written.onboardingContext.role).toBe('CFO');
  });
});
