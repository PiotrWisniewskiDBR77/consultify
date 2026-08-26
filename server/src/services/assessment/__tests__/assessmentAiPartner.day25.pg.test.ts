/** @vitest-environment node */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

describe.skipIf(!REAL_DB)('Assessment day 25 — AI partner fallback characterisation', () => {
  let app: Express;
  let pool: import('pg').Pool;
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
    const { trialEntryGuard } = await import('../../../middleware/trialEntryGuard.middleware.js');
    const { default: routes } = await import('../../../routes/assessment/assessment-ai.routes.js');
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query(
      `INSERT INTO organizations (id, name) VALUES
       ('day25-ai-org','Day 25 AI org'),('day25-ai-foreign-org','Day 25 AI foreign org')
       ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO assessments (id, organization_id, name, answers_json)
       VALUES ('day25-real-foreign-assessment','day25-ai-foreign-org','Foreign assessment','{}')
       ON CONFLICT (id) DO NOTHING`
    );
    app = express();
    app.use(express.json());
    app.use('/api/assessment', verifyToken, trialEntryGuard, routes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM assessments WHERE id='day25-real-foreign-assessment'`);
    await pool.query(
      `DELETE FROM organizations WHERE id IN ('day25-ai-org','day25-ai-foreign-org')`
    );
    await pool.end();
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
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Nie znaleziono oceny o podanym identyfikatorze.',
      code: 'ASSESSMENT_NOT_FOUND',
    });
  });

  it('makes a real foreign assessment indistinguishable from a missing assessment', async () => {
    const missing = await auth(request(app).get('/api/assessment/unknown/ai/insights'));
    const foreign = await auth(
      request(app).get('/api/assessment/day25-real-foreign-assessment/ai/insights')
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });
});
