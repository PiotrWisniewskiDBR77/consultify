import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

describe('Day 17 X.4 control KPI HTTP contract', () => {
  const read = vi.fn().mockResolvedValue({
    weekStart: '2026-08-24',
    families: Array.from({ length: 8 }, (_, index) => ({ family: `family-${index}` })),
    policy: { policyId: null, resolved: false, missingParameters: [] },
    scopeCompleteness: 'PARTIAL',
    calculatedAt: '2026-08-26T00:00:00.000Z',
  });

  const makeApp = (authenticated = true) => {
    const app = express();
    app.use((req, _res, next) => {
      if (authenticated) (req as any).user = { id: 'user-a', organizationId: 'org-a' };
      next();
    });
    app.use(
      '/api/v8/pmo/initiatives-execution',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: {} as any,
        reader: {} as any,
        authorize: vi.fn(),
        resolvePolicy: vi.fn(),
        controlKpis: { read } as any,
      })
    );
    return app;
  };

  it('returns the read model using only the authenticated organization', async () => {
    const response = await request(makeApp()).get(
      '/api/v8/pmo/initiatives-execution/control-kpis?weekStart=2026-08-24&policyId=policy-a'
    );
    expect(response.status).toBe(200);
    expect(response.body.families).toHaveLength(8);
    expect(read).toHaveBeenCalledWith('org-a', '2026-08-24', 'policy-a');
  });

  it('rejects an invalid weekStart', async () => {
    const response = await request(makeApp()).get(
      '/api/v8/pmo/initiatives-execution/control-kpis?weekStart=not-a-date'
    );
    expect(response.status).toBe(400);
  });

  it('requires an authenticated actor', async () => {
    const response = await request(makeApp(false)).get(
      '/api/v8/pmo/initiatives-execution/control-kpis?weekStart=2026-08-24'
    );
    expect(response.status).toBe(401);
  });
});
