/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const saved = process.env.ENABLE_INITIATIVES_PLAN;

afterEach(() => {
  if (saved === undefined) delete process.env.ENABLE_INITIATIVES_PLAN;
  else process.env.ENABLE_INITIATIVES_PLAN = saved;
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user: Record<string, string> }).user = {
      id: 'owner-1',
      organizationId: 'org-1',
      role: 'OWNER',
    };
    next();
  });
  app.use(
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: {} as never,
      reader: {
        listPlannableModuleInitiatives: vi.fn(async () => []),
        listPlanScenarios: vi.fn(async () => []),
      } as never,
      authorize: vi.fn(async () => true),
      resolvePolicy: vi.fn(),
    })
  );
  return app;
}

describe('ENABLE_INITIATIVES_PLAN server gate', () => {
  it('defaults OFF and blocks all three Plan route families before their handlers', async () => {
    delete process.env.ENABLE_INITIATIVES_PLAN;
    const app = makeApp();
    const responses = await Promise.all([
      request(app).get('/planning/plannable-initiatives'),
      request(app).get('/plan-scenarios'),
      request(app).post('/plan-analysis-proposals/proposal-1/review').send({}),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: { code: 'FEATURE_DISABLED' } });
    }
  });

  it('ON reaches the real handlers', async () => {
    process.env.ENABLE_INITIATIVES_PLAN = 'true';
    const app = makeApp();
    const plannable = await request(app).get('/planning/plannable-initiatives');
    const scenarios = await request(app).get('/plan-scenarios');
    const invalidReview = await request(app)
      .post('/plan-analysis-proposals/proposal-1/review')
      .send({});

    expect(plannable.status).toBe(200);
    expect(plannable.body).toEqual({ initiatives: [] });
    expect(scenarios.status).toBe(200);
    expect(scenarios.body).toEqual({ scenarios: [] });
    expect(invalidReview.status).toBe(400);
    expect(invalidReview.body?.error?.code).toBe('VALIDATION_FAILED');
  });
});
