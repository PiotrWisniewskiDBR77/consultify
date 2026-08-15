import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { CreateInitiativeSchema } from '../../../server/src/validators/initiative.validators.js';
import { makeChatProjectsApp } from './_helpers/makeChatProjectsApp';

const { checkChatPermission, db, getDatabase } = vi.hoisted(() => ({
  checkChatPermission: vi.fn(),
  db: {
    queryOne: vi.fn(),
    run: vi.fn(),
  },
  getDatabase: vi.fn(),
}));

vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => getDatabase(),
}));

vi.mock('../../../server/src/services/chatPermissionService.js', () => ({
  checkChatPermission,
}));

describe('Chat projects routes: move/remove conversation (REAL integration)', () => {
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
    checkChatPermission.mockImplementation(
      async (_userId: string, _organizationId: string, _action: string, ctx: any) => ({
        allowed: ctx?.isCreator === true,
        role: 'contributor',
        reason: ctx?.isCreator ? '' : 'Only the creator or an admin can manage this thread.',
      })
    );
  });

  it('POST /:id/conversations/:conversationId returns 404 when project is missing', async () => {
    db.queryOne.mockResolvedValueOnce(null);
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/chat-projects/p1/conversations/c1');
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Project not found' }));
  });

  it('POST /:id/conversations/:conversationId returns 404 when conversation is missing', async () => {
    db.queryOne
      .mockResolvedValueOnce({ id: 'p1', scope: 'personal', user_id: 'u-1' }) // project
      .mockResolvedValueOnce(null); // conversation
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/chat-projects/p1/conversations/c404');
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Conversation not found' }));
  });

  it('POST /:id/conversations/:conversationId moves the conversation on success', async () => {
    db.queryOne
      .mockResolvedValueOnce({
        id: 'p1',
        user_id: 'u-1',
        scope: 'team',
        organization_id: 'org-1',
      }) // project creator is allowed to manage the thread
      .mockResolvedValueOnce({ id: 'c1' }); // conversation
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/chat-projects/p1/conversations/c1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE conversations SET chat_project_id = ?'),
      expect.arrayContaining(['p1', 'c1'])
    );
  });

  it('POST /:id/conversations/:conversationId denies an org peer without manage_thread', async () => {
    db.queryOne.mockResolvedValueOnce({
      id: 'p1',
      user_id: 'u-owner',
      scope: 'team',
      organization_id: 'org-1',
    });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/chat-projects/p1/conversations/c1');
    expect(res.status).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({ error: 'No permission to move conversations into this team project' })
    );
    expect(db.run).not.toHaveBeenCalled();
  });

  it('DELETE /:id/conversations/:conversationId clears chat_project_id (best-effort)', async () => {
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).delete('/api/chat-projects/p2/conversations/c2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('SET chat_project_id = NULL'),
      expect.arrayContaining(['c2', 'p2', 'u-1', 'org-1'])
    );
  });

  it('POST /:id/conversations/:conversationId returns 500 when update fails', async () => {
    db.queryOne
      .mockResolvedValueOnce({
        id: 'p1',
        user_id: 'u-1',
        scope: 'team',
        organization_id: 'org-1',
      }) // creator reaches the update failure path
      .mockResolvedValueOnce({ id: 'c1' }); // conversation
    db.run.mockRejectedValueOnce(new Error('db fail'));
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).post('/api/chat-projects/p1/conversations/c1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Failed to move conversation' }));
  });
});
