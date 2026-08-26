/** @vitest-environment node */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

describe.skipIf(!REAL_DB)('Assessment day 25 — AI partner fallback characterisation', () => {
  let app: Express;
  let authorization = '';

  beforeAll(async () => {
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const { default: config } = await import('../../../config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: 'day25-ai-user', organizationId: 'day25-ai-org', role: 'user' },
      config.JWT_SECRET,
      {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      }
    )}`;
    const { verifyToken } = await import('../../../middleware/auth.middleware.js');
    const { default: routes } = await import('../../../routes/assessment/assessment-ai.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/assessment', verifyToken, routes);
  });

  const auth = (probe: request.Test) => probe.set('Authorization', authorization);

  it('suggest-target returns the deterministic fallback envelope', async () => {
    const response = await auth(
      request(app).post('/api/assessment/project-1/ai/suggest-target')
    ).send({ axisId: 'processes', currentScore: 2, ambitionLevel: 'balanced' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ambitionLevel: 'balanced',
      axisId: 'processes',
      currentScore: 2,
      reasoning:
        'Zbalansowany cel: przejście na poziom 4 wymaga średnioterminowego programu transformacji (12-18 miesięcy).',
      suggestedTarget: 4,
      timeEstimate: '10 miesięcy',
    });
  });

  it('validate returns a deterministic fallback result for an empty assessment', async () => {
    const response = await auth(request(app).post('/api/assessment/project-1/ai/validate')).send({
      assessment: { axes: {} },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      hasInconsistencies: false,
      inconsistencies: [],
      overallAssessment: 'Assessment appears internally consistent',
    });
  });

  it('insights returns an honest fallback for an unknown project', async () => {
    const response = await auth(request(app).get('/api/assessment/unknown/ai/insights'));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ insights: [], message: 'No assessment data to analyze' });
  });

  it('characterises the open tenant gap: an unknown foreign project is not rejected', async () => {
    const response = await auth(request(app).get('/api/assessment/foreign-project/ai/insights'));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ insights: [], message: 'No assessment data to analyze' });
  });
});
