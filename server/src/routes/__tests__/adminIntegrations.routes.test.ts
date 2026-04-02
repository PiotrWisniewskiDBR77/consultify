import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import adminIntegrationsRouter from '../adminIntegrations.routes.js';

const dbAll = vi.fn();
const dbRun = vi.fn();
vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', organizationId: 'org-1', role: 'admin' };
    next();
  },
}));

vi.mock('../../middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: any) => next(),
}));

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/integrations', adminIntegrationsRouter);
  return app;
}

describe('Admin integrations monitoring routes (PO1)', () => {
  beforeEach(() => {
    dbAll.mockReset();
    dbRun.mockReset();
    dbRun.mockResolvedValue({ success: true });
  });

  it('lists user↔integration ownership items', async () => {
    dbAll.mockResolvedValueOnce([
      {
        integrationId: 'int-1',
        userId: 'user-1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@example.com',
        connectorId: 'jira',
        integrationName: 'Jira',
        category: 'project_management',
        status: 'connected',
        updatedAt: '2026-04-02T00:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/admin/integrations/users');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].connectorId).toBe('jira');
  });

  it('returns summary aggregates', async () => {
    dbAll
      .mockResolvedValueOnce([{ total: 2, users: 2 }]) // totals
      .mockResolvedValueOnce([{ status: 'connected', count: 2 }]) // byStatus
      .mockResolvedValueOnce([{ connectorId: 'jira', count: 2 }]); // byConnector

    const app = createApp();
    const res = await request(app).get('/api/admin/integrations/summary');
    expect(res.status).toBe(200);
    expect(res.body.totals.total).toBe(2);
    expect(res.body.byStatus[0].status).toBe('connected');
  });

  it('returns connection logs with pagination', async () => {
    dbAll.mockResolvedValueOnce([{ count: 1 }]); // total
    dbAll.mockResolvedValueOnce([
      {
        id: 'ice-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        integration_id: 'int-1',
        connector_id: 'jira',
        event_type: 'connect_initiated',
        metadata: JSON.stringify({ source: 'settings' }),
        ip_address: '127.0.0.1',
        user_agent: 'test',
        created_at: '2026-04-02T00:00:00.000Z',
      },
    ]); // items

    const app = createApp();
    const res = await request(app).get('/api/admin/integrations/logs?limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].connectorId).toBe('jira');
  });
});

