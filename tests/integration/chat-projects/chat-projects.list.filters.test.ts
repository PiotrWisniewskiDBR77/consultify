import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { CreateInitiativeSchema } from '../../../server/src/validators/initiative.validators.js';
import { makeChatProjectsApp } from './_helpers/makeChatProjectsApp';

const { db, getDatabase } = vi.hoisted(() => ({
  db: {
    query: vi.fn(),
    queryOne: vi.fn(),
    run: vi.fn(),
  },
  getDatabase: vi.fn(),
}));

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => getDatabase(),
}));

describe('Chat projects routes: list filters (REAL integration)', () => {
  void CreateInitiativeSchema;
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  const origMockDb = process.env.MOCK_DB;
  const origTestType = process.env.TEST_TYPE;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
    if (origMockDb === undefined) delete process.env.MOCK_DB;
    else process.env.MOCK_DB = origMockDb;
    if (origTestType === undefined) delete process.env.TEST_TYPE;
    else process.env.TEST_TYPE = origTestType;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getDatabase.mockReturnValue(db);
    db.query.mockResolvedValue({ rows: [] });
  });

  it('returns empty list for scope=team when orgId is missing', async () => {
    const app = await makeChatProjectsApp({ user: { organizationId: null } });
    const res = await request(app).get('/api/chat-projects?scope=team');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ projects: [], total: 0 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('lists personal projects when scope=personal', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).get('/api/chat-projects?scope=personal');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const params = db.query.mock.calls[0]?.[1] as any[];
    expect(params).toEqual(['u-1']);
  });

  it('lists team projects when scope=team and orgId exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 't1', scope: 'team' }] });
    const app = await makeChatProjectsApp({ user: { id: 'u-2', organizationId: 'org-2' } });
    const res = await request(app).get('/api/chat-projects?scope=team');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    const params = db.query.mock.calls[0]?.[1] as any[];
    // rbacReady=true adds userId for membership visibility check (org + member filter)
    expect(params).toEqual(['org-2', 'u-2']);
  });

  it('includes both personal and team filters when no scope is provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const app = await makeChatProjectsApp({ user: { id: 'u-3', organizationId: 'org-3' } });
    const res = await request(app).get('/api/chat-projects');
    expect(res.status).toBe(200);
    const params = db.query.mock.calls[0]?.[1] as any[];
    // rbacReady=true appends userId again for the team membership EXISTS subquery
    expect(params).toEqual(['u-3', 'org-3', 'u-3']);
  });

  it('returns empty list when chat_projects table is missing in sqlite', async () => {
    db.query.mockRejectedValueOnce({
      code: 'SQLITE_ERROR',
      message: 'no such table: chat_projects',
    });
    const app = await makeChatProjectsApp({ user: { id: 'u-4', organizationId: 'org-4' } });
    const res = await request(app).get('/api/chat-projects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ projects: [], total: 0 });
  });
});
