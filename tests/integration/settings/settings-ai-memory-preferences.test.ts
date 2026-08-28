import express from 'express';
import net from 'node:net';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'u-1' as string | null,
  organizationId: 'org-1' as string | null,
  role: 'ADMIN' as string | null,
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = authState.userId
        ? {
            id: authState.userId,
            organizationId: authState.organizationId,
            role: authState.role || 'ADMIN',
          }
        : undefined;
      next();
    },
  };
});

const storedPreferences = new Map<string, string>();
const mockDbGet = vi.fn(async (_sql: string, params: any[]) => {
  const [userId, key] = params;
  const value = storedPreferences.get(`${userId}:${key}`);
  return value ? { preferences_data: value } : null;
});
const mockDbRun = vi.fn(async (sql: string, params: any[] = []) => {
  if (
    sql.includes('INSERT INTO user_preferences') ||
    sql.includes('INSERT OR REPLACE INTO user_preferences')
  ) {
    const [userId, key, value] = params;
    storedPreferences.set(`${userId}:${key}`, value);
  }
  return { success: true };
});
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../server/src/utils/DbPromise.js', async () => {
  const actual = (await vi.importActual('../../../server/src/utils/DbPromise.js')) as any;
  return {
    ...actual,
    get: (sql: string, ...args: any[]) =>
      sql.includes('organization_members') ? Promise.resolve({ status: 'ACTIVE' }) : mockDbGet(sql, ...args),
    run: (...args: any[]) => mockDbRun(...args),
    all: (...args: any[]) => mockDbAll(...args),
  };
});

const { default: settingsRouter } = await import('../../../server/src/routes/settings.routes.ts');

describe('Settings AI memory preferences', () => {
  let canListen = true;

  beforeEach(() => {
    authState.userId = 'u-1';
    authState.organizationId = 'org-1';
    authState.role = 'ADMIN';
    storedPreferences.clear();
    mockDbGet.mockClear();
    mockDbRun.mockClear();
    mockDbAll.mockClear();
  });

  beforeAll(async () => {
    canListen = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.listen(0, '127.0.0.1', () => s.close(() => resolve(true)));
    });
  });

  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);
    return app;
  };

  it('persists AI memory preferences and returns them on the next fetch', async function () {
    if (!canListen) this.skip();

    const app = makeApp();
    const preferences = {
      enabled: false,
      retentionDays: 45,
      includeConversations: false,
      includePreferences: true,
      includeContext: false,
    };

    const saveRes = await request(app)
      .put('/api/settings/preferences/ai-memory')
      .send({ preferences });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body).toEqual({ success: true });

    const getRes = await request(app).get('/api/settings/preferences/ai-memory');

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual({ preferences });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_preferences'),
      ['u-1', 'settings:ai-memory', JSON.stringify(preferences)],
      expect.any(Object)
    );
  });

  it('returns coded 401 and does not touch DB when user is unauthenticated', async function () {
    if (!canListen) this.skip();
    authState.userId = null;
    const app = makeApp();

    const res = await request(app).get('/api/settings/preferences/ai-memory');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('User not authenticated');
    expect(res.body.code).toBe('AUTH_REQUIRED');
    expect(mockDbGet).not.toHaveBeenCalled();
  });

  it('returns coded 500 when stored ai-memory preferences are invalid JSON', async function () {
    if (!canListen) this.skip();
    storedPreferences.set('u-1:settings:ai-memory', '{broken-json');
    const app = makeApp();

    const res = await request(app).get('/api/settings/preferences/ai-memory');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_MEMORY_PREFERENCES_INVALID_STORE');
  });

  it('returns coded 400 when ai-memory preferences payload is invalid', async function () {
    if (!canListen) this.skip();
    const app = makeApp();

    const res = await request(app).put('/api/settings/preferences/ai-memory').send({
      preferences: 'invalid',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AI_MEMORY_PREFERENCES_INVALID_PAYLOAD');
  });

  it('returns coded 500 when ai-memory preferences save fails', async function () {
    if (!canListen) this.skip();
    let failedOnce = false;
    mockDbRun.mockImplementation(async (sql: string, params: any[] = []) => {
      if (
        !failedOnce &&
        (sql.includes('INSERT INTO user_preferences') ||
          sql.includes('INSERT OR REPLACE INTO user_preferences'))
      ) {
        failedOnce = true;
        const [userId, key, value] = params;
        storedPreferences.set(`${userId}:${key}`, value);
        return { success: false, error: 'disk full' };
      }
      return { success: true };
    });
    const app = makeApp();

    const res = await request(app).put('/api/settings/preferences/ai-memory').send({
      preferences: {
        enabled: true,
        retentionDays: 30,
        includeConversations: true,
        includePreferences: true,
        includeContext: true,
      },
    });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AI_MEMORY_PREFERENCES_SAVE_FAILED');
  });

  it('clears ai-memory history via dedicated endpoint', async function () {
    if (!canListen) this.skip();
    const app = makeApp();

    const res = await request(app).delete('/api/settings/preferences/ai-memory/clear');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM conversations'),
      ['u-1']
    );
  });
});
