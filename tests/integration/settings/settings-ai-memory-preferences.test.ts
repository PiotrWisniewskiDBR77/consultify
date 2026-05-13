import express from 'express';
import net from 'node:net';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = { id: 'u-1', organizationId: 'org-1', role: 'ADMIN' };
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
  if (sql.includes('INSERT INTO user_preferences')) {
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
    get: (...args: any[]) => mockDbGet(...args),
    run: (...args: any[]) => mockDbRun(...args),
    all: (...args: any[]) => mockDbAll(...args),
  };
});

const { default: settingsRouter } = await import('../../../server/src/routes/settings.routes.ts');

describe('Settings AI memory preferences', () => {
  let canListen = true;

  beforeEach(() => {
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
});
