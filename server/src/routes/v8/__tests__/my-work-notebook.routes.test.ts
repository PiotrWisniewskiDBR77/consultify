import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetTableColumns = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

import myWorkRoutes from '../my-work.routes.js';

const ORG = 'org-notebook-v8';
const USER_ID = 'user-notebook-v8';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = {
      organizationId: ORG,
      userId: USER_ID,
      userRole: 'ADMIN',
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/my-work', myWorkRoutes);
  return app;
}

describe('V8 My Work notebook routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockResolvedValue(new Map([['id', { name: 'id' }]]));
  });

  it('lists notebook pages through the V8 envelope', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'note-1',
        ownerUserId: USER_ID,
        organizationId: ORG,
        projectId: null,
        visibility: 'private',
        title: 'Notebook item',
        contentJson: JSON.stringify({ type: 'doc', content: [] }),
        contentText: 'content',
        tags: '["alpha"]',
        maturity: 'seed',
        icon: null,
        summary: null,
        status: 'active',
        pinned: 0,
        verificationStatus: 'unverified',
        reviewCadence: 'monthly',
        staleAt: null,
        lastReviewedAt: null,
        convertedToJson: null,
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:00:00.000Z',
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/my-work/notebook/pages')
      .query({ status: 'active', limit: '10', pinned: '0' });

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ version: 'v8', contract: 'my_work_notebook_v1' });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: 'note-1',
      title: 'Notebook item',
      tags: ['alpha'],
      pinned: false,
    });
  });

  it('creates a notebook page through the V8 namespace', async () => {
    mockQueryRun.mockResolvedValue({});
    mockQueryOne.mockResolvedValue({
      id: 'note-2',
      ownerUserId: USER_ID,
      organizationId: ORG,
      projectId: null,
      visibility: 'private',
      title: 'Fresh note',
      contentJson: JSON.stringify({ type: 'doc', content: [] }),
      contentText: null,
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
      convertedToJson: null,
      createdAt: '2026-03-26T10:00:00.000Z',
      updatedAt: '2026-03-26T10:00:00.000Z',
    });

    const res = await request(createApp()).post('/api/v8/my-work/notebook/pages').send({
      title: 'Fresh note',
      contentJson: { type: 'doc', content: [] },
    });

    expect(res.status).toBe(201);
    expect(res.body.meta.contract).toBe('my_work_notebook_v1');
    expect(mockQueryRun).toHaveBeenCalled();
    expect(res.body.data.title).toBe('Fresh note');
  });

  it('updates an owned notebook page through the V8 namespace', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'note-3',
        owner_user_id: USER_ID,
        organization_id: ORG,
        project_id: null,
        visibility: 'private',
      })
      .mockResolvedValueOnce({
        id: 'note-3',
        ownerUserId: USER_ID,
        organizationId: ORG,
        projectId: null,
        visibility: 'private',
        title: 'Updated title',
        contentJson: JSON.stringify({ type: 'doc', content: [] }),
        contentText: 'updated',
        tags: '["beta"]',
        maturity: 'mature',
        icon: null,
        summary: 'summary',
        status: 'active',
        pinned: 1,
        verificationStatus: 'verified',
        reviewCadence: 'monthly',
        staleAt: null,
        lastReviewedAt: null,
        convertedToJson: null,
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:05:00.000Z',
      });

    const res = await request(createApp())
      .put('/api/v8/my-work/notebook/pages/note-3')
      .send({ title: 'Updated title', contentText: 'updated', tags: ['beta'] });

    expect(res.status).toBe(200);
    expect(mockQueryRun).toHaveBeenCalled();
    expect(res.body.data).toMatchObject({
      id: 'note-3',
      title: 'Updated title',
      tags: ['beta'],
      pinned: true,
    });
  });

  it('updates notebook status through the V8 namespace', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'note-4',
      owner_user_id: USER_ID,
      organization_id: ORG,
    });
    mockQueryRun.mockResolvedValue({});

    const res = await request(createApp())
      .put('/api/v8/my-work/notebook/pages/note-4/status')
      .send({ status: 'archived' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 'note-4', status: 'archived' });
  });

  it('deletes an owned notebook page through the V8 namespace', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'note-5',
      owner_user_id: USER_ID,
      organization_id: ORG,
    });
    mockQueryRun.mockResolvedValue({});

    const res = await request(createApp()).delete('/api/v8/my-work/notebook/pages/note-5');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ success: true, id: 'note-5' });
  });
});
