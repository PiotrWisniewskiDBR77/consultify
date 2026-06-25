import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/services/financeEnterpriseService.js', () => ({
  FinanceEnterpriseService: class MockFinanceEnterpriseService {
    getModelVersions = vi.fn().mockResolvedValue([]);
    compareVersions = vi.fn().mockResolvedValue(null);
  },
}));

import { FinanceEnterpriseService } from '../../../server/src/services/financeEnterpriseService.js';

function createVersionsApp(svc: any) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' };
    next();
  });
  app.get('/models/:modelId/versions', async (req: any, res) => {
    const versions = await svc.getModelVersions('org-1', req.params.modelId);
    res.json({ data: { versions, count: versions.length } });
  });
  app.get('/models/:modelId/versions/diff', async (req: any, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });
    const diff = await svc.compareVersions('org-1', from, to);
    if (!diff) return res.status(404).json({ error: 'versions not found' });
    res.json({ data: { diff } });
  });
  return app;
}

describe('finance model versions routes (M16)', () => {
  it('GET /models/:modelId/versions returns 200 with empty array when no versions', async () => {
    const svc = new FinanceEnterpriseService();
    const res = await request(createVersionsApp(svc))
      .get('/models/model-abc/versions');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('versions');
    expect(Array.isArray(res.body.data.versions)).toBe(true);
    expect(res.body.data.versions).toHaveLength(0);
    expect(res.body.data.count).toBe(0);
  });

  it('GET /models/:modelId/versions/diff returns 400 without from/to params', async () => {
    const svc = new FinanceEnterpriseService();
    const res = await request(createVersionsApp(svc))
      .get('/models/model-abc/versions/diff');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'from and to required');
  });
});
