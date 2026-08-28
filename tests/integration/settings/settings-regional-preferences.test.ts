import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import net from 'node:net';

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

const mockDbGet = vi.fn();
const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbAll = vi.fn();
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

describe('Settings regional preferences (REAL integration)', () => {
  let canListen = true;

  beforeEach(() => {
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue({ success: true });
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

  it('GET returns defaults when preferences are missing', async function () {
    if (!canListen) this.skip();
    mockDbGet.mockResolvedValueOnce(null);

    const app = makeApp();
    const res = await request(app).get('/api/settings/preferences/regional');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        preferences: expect.objectContaining({
          timezone: 'UTC',
          units: 'metric',
          currency: 'USD',
        }),
      })
    );
  });

  it('GET returns stored preferences when present', async function () {
    if (!canListen) this.skip();
    mockDbGet.mockResolvedValueOnce({
      preferences_data: JSON.stringify({ timezone: 'Europe/Warsaw' }),
    });

    const app = makeApp();
    const res = await request(app).get('/api/settings/preferences/regional');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ preferences: { timezone: 'Europe/Warsaw' } });
  });

  it('PUT returns 400 when preferences object is missing', async function () {
    if (!canListen) this.skip();
    const app = makeApp();
    const res = await request(app).put('/api/settings/preferences/regional').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Preferences object is required' }));
  });

  it('PUT inserts preferences when no record exists', async function () {
    if (!canListen) this.skip();
    mockDbGet.mockResolvedValueOnce(null);

    const app = makeApp();
    const res = await request(app)
      .put('/api/settings/preferences/regional')
      .send({ preferences: { timezone: 'UTC' } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_preferences'),
      expect.any(Array),
      expect.any(Object)
    );
  });
});
