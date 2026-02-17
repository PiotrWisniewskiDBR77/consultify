import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { CreateInitiativeSchema } from '../../../server/src/validators/initiative.validators.js';
import { makeChatProjectsApp } from './_helpers/makeChatProjectsApp';

const { db, getDatabase, checkChatPermission } = vi.hoisted(() => ({
  db: {
    run: vi.fn(),
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

describe('Chat projects routes: patch + delete (REAL integration)', () => {
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
    checkChatPermission.mockResolvedValue({ allowed: true, role: 'owner' });
  });

  it('PATCH returns 404 when project is not found', async () => {
    db.queryOne.mockResolvedValueOnce(null);
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-1' } });
    const res = await request(app).patch('/api/chat-projects/p-404').send({ name: 'New' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Project not found' }));
  });

  it('PATCH updates personal project when owned by user', async () => {
    db.queryOne.mockResolvedValueOnce({
      id: 'p-1',
      user_id: 'u-2',
      scope: 'personal',
      organization_id: null,
    });
    const app = await makeChatProjectsApp({ user: { id: 'u-2', organizationId: 'org-x' } });
    const res = await request(app).patch('/api/chat-projects/p-1').send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE chat_projects SET'),
      expect.any(Array)
    );
  });

  it('PATCH denies team project update when permission service returns allowed=false', async () => {
    db.queryOne.mockResolvedValueOnce({
      id: 't-1',
      user_id: 'u-9',
      scope: 'team',
      organization_id: 'org-9',
    });
    checkChatPermission.mockResolvedValueOnce({ allowed: false, role: 'viewer' });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-9' } });
    const res = await request(app).patch('/api/chat-projects/t-1').send({ name: 'Renamed' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    expect(checkChatPermission).toHaveBeenCalledWith('u-1', 'org-9', 'edit_project', {
      isCreator: false,
    });
  });

  it('DELETE removes personal project and clears conversations link', async () => {
    db.queryOne.mockResolvedValueOnce({
      id: 'p-2',
      user_id: 'u-2',
      scope: 'personal',
      organization_id: null,
    });
    const app = await makeChatProjectsApp({ user: { id: 'u-2', organizationId: 'org-any' } });
    const res = await request(app).delete('/api/chat-projects/p-2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(db.run).toHaveBeenCalledTimes(2);
    expect(db.run.mock.calls[0][0]).toContain('UPDATE conversations SET chat_project_id = NULL');
    expect(db.run.mock.calls[1][0]).toContain('DELETE FROM chat_projects');
  });

  it('DELETE denies team project delete when permission service returns allowed=false', async () => {
    db.queryOne.mockResolvedValueOnce({
      id: 't-2',
      user_id: 'u-9',
      scope: 'team',
      organization_id: 'org-9',
    });
    checkChatPermission.mockResolvedValueOnce({ allowed: false, role: 'viewer' });
    const app = await makeChatProjectsApp({ user: { id: 'u-1', organizationId: 'org-9' } });
    const res = await request(app).delete('/api/chat-projects/t-2');
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
