/**
 * Agent 5 — notebook version-history routes (snapshot / list / restore).
 * Mounts `registerNotebookVersionsRoutes` on a bare router with supertest and
 * mocks the DB layer (queryHelpers), schema probe (dbSchema), and v8 context.
 */
import express, { type Express, Router } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
}));

let mockColumns = new Set<string>(['id', 'page_id', 'content_json']);
vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async (table: string) => {
    if (table === 'notebook_page_versions') return mockColumns;
    // notebook_pages — pretend it has updated_at
    return new Set<string>(['id', 'title', 'content_json', 'content_text', 'updated_at']);
  }),
}));

let mockCtx = { organizationId: 'org-1', userId: 'user-1', userRole: 'ADMIN', isSuperAdmin: false };
vi.mock('../../../server/src/middleware/v8Auth.middleware.js', () => ({
  getV8Context: () => mockCtx,
}));

import { registerNotebookVersionsRoutes } from '../../../server/src/routes/v8/notebookVersions.routes.js';

const PAGE_ID = 'page-123';
const OWNED_PAGE = {
  id: PAGE_ID,
  owner_user_id: 'user-1',
  organization_id: 'org-1',
  visibility: 'private',
  project_id: null,
  title: 'My note',
  content_json: '{"type":"doc","content":[]}',
  content_text: 'hello world',
};

function createApp(): Express {
  const app = express();
  app.use(express.json());
  const router = Router();
  registerNotebookVersionsRoutes(router);
  app.use('/api/v8/notebook', router);
  return app;
}

describe('notebook version-history routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockColumns = new Set<string>(['id', 'page_id', 'content_json']);
    mockCtx = { organizationId: 'org-1', userId: 'user-1', userRole: 'ADMIN', isSuperAdmin: false };
  });

  it('GET versions returns mapped snapshots for an owned page', async () => {
    mockQueryOne.mockResolvedValueOnce(OWNED_PAGE); // loadPage
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'v1',
        page_id: PAGE_ID,
        title: 'My note',
        content_json: '{"type":"doc"}',
        content_text: 'hello world',
        created_at: '2026-06-20T10:00:00Z',
        created_by: 'user-1',
      },
    ]);

    const res = await request(createApp()).get(`/api/v8/notebook/pages/${PAGE_ID}/versions`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: 'v1', pageId: PAGE_ID, contentText: 'hello world' });
    expect(res.body.data[0].contentJson).toEqual({ type: 'doc' });
    expect(res.body.meta.contract).toBe('notebook_versions_v1');
  });

  it('GET versions returns 503 when the versions table is missing (degraded, not 500)', async () => {
    mockColumns = new Set<string>();
    const res = await request(createApp()).get(`/api/v8/notebook/pages/${PAGE_ID}/versions`);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('NOTEBOOK_VERSIONS_UNAVAILABLE');
    // Must not have hit the page query.
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('GET versions returns 404 for a page in another org', async () => {
    mockQueryOne.mockResolvedValueOnce({ ...OWNED_PAGE, organization_id: 'org-other' });
    const res = await request(createApp()).get(`/api/v8/notebook/pages/${PAGE_ID}/versions`);
    expect(res.status).toBe(404);
  });

  it('POST versions creates a snapshot from current page content', async () => {
    mockQueryOne.mockResolvedValueOnce(OWNED_PAGE); // loadPage
    mockQueryRun.mockResolvedValueOnce({ changes: 1 });

    const res = await request(createApp()).post(`/api/v8/notebook/pages/${PAGE_ID}/versions`).send({});

    expect(res.status).toBe(201);
    expect(res.body.data.pageId).toBe(PAGE_ID);
    expect(typeof res.body.data.id).toBe('string');
    // INSERT into notebook_page_versions with page content.
    const insertCall = mockQueryRun.mock.calls[0];
    expect(insertCall[0]).toMatch(/INSERT INTO notebook_page_versions/);
    expect(insertCall[1]).toContain(PAGE_ID);
  });

  it('POST versions can snapshot in-flight body content', async () => {
    mockQueryOne.mockResolvedValueOnce(OWNED_PAGE);
    mockQueryRun.mockResolvedValueOnce({ changes: 1 });

    const res = await request(createApp())
      .post(`/api/v8/notebook/pages/${PAGE_ID}/versions`)
      .send({ title: 'Edited', contentText: 'new body', contentJson: { type: 'doc', content: [1] } });

    expect(res.status).toBe(201);
    const params = mockQueryRun.mock.calls[0][1] as unknown[];
    // params: [id, page_id, org, title, content_json, content_text, created_by]
    expect(params[3]).toBe('Edited');
    expect(params[5]).toBe('new body');
    expect(String(params[4])).toContain('doc');
  });

  it('POST restore snapshots current state then updates the page', async () => {
    mockQueryOne
      .mockResolvedValueOnce(OWNED_PAGE) // loadPage
      .mockResolvedValueOnce({
        id: 'v1',
        page_id: PAGE_ID,
        title: 'Old title',
        content_json: '{"type":"doc","old":true}',
        content_text: 'old text',
      }); // version lookup
    mockQueryRun
      .mockResolvedValueOnce({ changes: 1 }) // backup snapshot insert
      .mockResolvedValueOnce({ changes: 1 }); // UPDATE notebook_pages

    const res = await request(createApp()).post(
      `/api/v8/notebook/pages/${PAGE_ID}/versions/v1/restore`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.restoredFrom).toBe('v1');
    expect(res.body.data.title).toBe('Old title');
    expect(res.body.data.contentText).toBe('old text');

    // First run = backup INSERT, second = UPDATE page.
    expect(mockQueryRun.mock.calls[0][0]).toMatch(/INSERT INTO notebook_page_versions/);
    expect(mockQueryRun.mock.calls[1][0]).toMatch(/UPDATE notebook_pages/);
    expect(mockQueryRun.mock.calls[1][0]).toMatch(/updated_at = CURRENT_TIMESTAMP/);
  });

  it('POST restore returns 404 when the version does not belong to the page', async () => {
    mockQueryOne
      .mockResolvedValueOnce(OWNED_PAGE) // loadPage
      .mockResolvedValueOnce(null); // version not found

    const res = await request(createApp()).post(
      `/api/v8/notebook/pages/${PAGE_ID}/versions/ghost/restore`
    );
    expect(res.status).toBe(404);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });
});
