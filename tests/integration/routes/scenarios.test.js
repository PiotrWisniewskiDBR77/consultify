import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => {
  return {
    verifyToken: vi.fn((req, _res, next) => {
      req.user = {
        id: 'scenario-user',
        organizationId: 'scenario-org',
        role: 'ADMIN',
      };
      next();
    }),
  };
});

import scenariosRouter from '../../../server/src/routes/scenarios.routes.js';

// @vitest-environment node

/**
 * Level 2: Integration Tests - Scenarios
 * Tests what-if scenarios and critical path analysis
 */
const app = express();
app.use(express.json());
app.use('/api/scenarios', scenariosRouter);

describe('Integration Test: Scenarios Routes', () => {
  const testProjectId = 'scenario-project';

  describe('POST /api/scenarios/:projectId/analyze', () => {
    it('should analyze impact of proposed changes', async () => {
      const res = await request(app)
        .post(`/api/scenarios/${testProjectId}/analyze`)
        .send({
          scenarios: [{ name: 'Five day delay' }],
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        projectId: testProjectId,
        results: [{ scenarioId: 'scenario-1', name: 'Five day delay' }],
      });
    });
  });

  describe('GET /api/scenarios/:projectId/critical-path', () => {
    it('should calculate critical path', async () => {
      const res = await request(app)
        .get(`/api/scenarios/${testProjectId}/critical-path`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        projectId: testProjectId,
        criticalPath: { duration: 45, unit: 'days' },
      });
    });
  });

  describe('GET /api/scenarios/:projectId/schedule-risks', () => {
    it('should analyze schedule risks', async () => {
      const res = await request(app)
        .get(`/api/scenarios/${testProjectId}/schedule-risks`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        projectId: testProjectId,
        overallRiskScore: 0.35,
      });
    });
  });
});
