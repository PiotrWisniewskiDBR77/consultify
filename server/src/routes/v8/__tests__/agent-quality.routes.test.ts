import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const evaluateTransformationCaseLive = vi.fn();
vi.mock('../../../services/v8/agentQualityEvaluationService.js', () => ({
  evaluateTransformationCaseLive,
}));

async function app(organizationId = 'org-a') {
  const { default: router } = await import('../agent-quality.routes.js');
  const server = express();
  server.use((req, _res, next) => {
    (req as any).v8Context = {
      organizationId,
      userId: 'consultant-a',
      userRole: 'CONSULTANT',
      isSuperAdmin: false,
    };
    next();
  });
  server.use('/api/v8/agent-quality', router);
  return server;
}

describe('agent quality routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses authenticated tenant for canonical live case evaluation', async () => {
    evaluateTransformationCaseLive.mockResolvedValue({
      status: 'passed',
      score: 1,
      suiteVersion: 'transformation-case-live-v1',
      cases: [],
      criticalFailures: [],
    });
    const response = await request(await app()).get(
      '/api/v8/agent-quality/transformation-cases/case-a?organizationId=org-foreign'
    );
    expect(response.status).toBe(200);
    expect(response.body.meta.source).toBe('canonical_live_readback');
    expect(evaluateTransformationCaseLive).toHaveBeenCalledWith({
      transformationCaseId: 'case-a',
      organizationId: 'org-a',
    });
  });

  it('retains tenant-scoped not-found semantics', async () => {
    evaluateTransformationCaseLive.mockResolvedValue(null);
    const response = await request(await app('org-b')).get(
      '/api/v8/agent-quality/transformation-cases/case-a'
    );
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('TRANSFORMATION_CASE_NOT_FOUND');
  });
});
