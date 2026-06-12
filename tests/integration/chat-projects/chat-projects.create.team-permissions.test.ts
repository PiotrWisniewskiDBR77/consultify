import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { CreateInitiativeSchema } from '../../../server/src/validators/initiative.validators.js';
import { makeChatProjectsApp } from './_helpers/makeChatProjectsApp';

const { db, getDatabase, checkChatPermission } = vi.hoisted(() => ({
  db: {
    run: vi.fn(),
    query: vi.fn(),
    queryOne: vi.fn(),
  },
  getDatabase: vi.fn(),
  checkChatPermission: vi.fn(),
}));

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => getDatabase(),
}));

vi.mock('../../../server/src/services/chatPermissionService.js', () => ({
  checkChatPermission: (...args: any[]) => checkChatPermission(...args),
}));

vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue(
    new Set([
      'id', 'user_id', 'organization_id', 'name', 'description',
      'color', 'icon', 'scope', 'created_at', 'updated_at',
      'visibility', 'parent_id', 'custom_instructions',
    ])
  ),
  hasColumn: vi.fn().mockResolvedValue(true),
  clearSchemaCache: vi.fn().mockReturnValue(0),
}));

describe('Chat projects routes: create (REAL integration)', () => {
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
    db.run.mockResolvedValue({ changes: 1 });
    checkChatPermission.mockResolvedValue({ allowed: false, role: 'viewer' });
  });

  it('returns 401 when no token and bypass is disabled', async () => {
    const prev = process.env.ENABLE_TEST_AUTH_BYPASS;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    try {
      const app = await makeChatProjectsApp();
      const res = await request(app).post('/api/chat-projects').send({ name: 'T' });
      expect(res.status).toBe(401);
    } finally {
      process.env.ENABLE_TEST_AUTH_BYPASS = prev;
    }
  });

  it('returns 400 for team scope when orgId is missing', async () => {
    const app = await makeChatProjectsApp({ user: { organizationId: null } });
    const res = await request(app).post('/api/chat-projects').send({ name: 'T', scope: 'team' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 403 when team permission is denied', async () => {
    checkChatPermission.mockResolvedValueOnce({ allowed: false, role: 'viewer' });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/chat-projects').send({ name: 'T', scope: 'team' });
    expect(res.status).toBe(403);
    expect(checkChatPermission).toHaveBeenCalledWith('u-1', 'org-1', 'create_project');
  });

  it('creates team project when permission is allowed', async () => {
    checkChatPermission.mockResolvedValueOnce({ allowed: true, role: 'owner' });
    const app = await makeChatProjectsApp({ user: { id: 'u-2', organizationId: 'org-2' } });
    const res = await request(app)
      .post('/api/chat-projects')
      .send({ name: 'Team', scope: 'team', color: '#111111', icon: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        user_id: 'u-2',
        organization_id: 'org-2',
        scope: 'team',
        name: 'Team',
      })
    );
    expect(db.run).toHaveBeenCalled();
  });

  it('creates personal project and inserts organization_id as null when orgId is missing', async () => {
    const app = await makeChatProjectsApp({ user: { id: 'u-3', organizationId: null } });
    const res = await request(app)
      .post('/api/chat-projects')
      .send({ name: 'P', scope: 'personal' });
    expect(res.status).toBe(201);
    const runArgs = db.run.mock.calls[0]?.[1] as any[];
    expect(runArgs).toBeDefined();
    // values: [id, userId, organization_id, name, ...]
    expect(runArgs[1]).toBe('u-3');
    expect(runArgs[2]).toBe(null);
  });
});
