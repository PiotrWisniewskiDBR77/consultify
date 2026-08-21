/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetTableColumns = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    req.user = { id: 'user-1', organizationId: 'org-1', email: 'user@example.com' };
    next();
  },
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import myWorkRoutes from '../my-work.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

describe('legacy my-work notebook routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockResolvedValue(new Set(['id']));
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockQueryOne.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM notebook_pages') && sql.includes('WHERE id = ? LIMIT 1')) {
        return {
          id: 'note-1',
          ownerUserId: 'user-1',
          organizationId: 'org-1',
          projectId: null,
          visibility: 'private',
          title: 'Fresh note',
          contentJson: JSON.stringify({ type: 'doc', content: [] }),
          contentText: '',
          tags: '[]',
          maturity: 'seed',
          icon: null,
          summary: null,
          status: 'active',
          pinned: 0,
          captureSource: null,
          captureMetadataJson: null,
          attachmentsJson: null,
          convertedToJson: null,
          createdAt: '2026-03-27T00:00:00.000Z',
          updatedAt: '2026-03-27T00:00:00.000Z',
        };
      }
      if (sql.includes('FROM project_members')) {
        return null;
      }
      return null;
    });
    mockQueryAll.mockResolvedValue([
      {
        id: 'note-1',
        ownerUserId: 'user-1',
        organizationId: 'org-1',
        projectId: null,
        visibility: 'private',
        title: 'Fresh note',
        contentJson: JSON.stringify({ type: 'doc', content: [] }),
        contentText: '',
        tags: '[]',
        maturity: 'seed',
        icon: null,
        summary: null,
        status: 'active',
        pinned: 0,
        verificationStatus: 'unverified',
        reviewCadence: 'monthly',
        staleAt: null,
        lastReviewedAt: null,
        captureSource: null,
        captureMetadataJson: null,
        attachmentsJson: null,
        convertedToJson: null,
        createdAt: '2026-03-27T00:00:00.000Z',
        updatedAt: '2026-03-27T00:00:00.000Z',
      },
    ]);
  });

  it('lists the author private note when list rows use aliased owner/organization keys', async () => {
    const app = createApp();

    const createRes = await request(app)
      .post('/api/my-work/notebook/pages')
      .send({
        title: 'Fresh note',
        contentJson: { type: 'doc', content: [] },
        contentText: '',
      });
    expect(createRes.status).toBe(201);

    const listRes = await request(app).get('/api/my-work/notebook/pages');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0]).toMatchObject({
      id: 'note-1',
      title: 'Fresh note',
      visibility: 'private',
      ownerUserId: 'user-1',
      organizationId: 'org-1',
    });
    expect(mockQueryOne).not.toHaveBeenCalledWith(
      expect.stringContaining('FROM project_members'),
      expect.anything()
    );
  });
});
