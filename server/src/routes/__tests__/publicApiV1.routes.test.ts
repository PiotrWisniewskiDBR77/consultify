import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import publicApiV1Router from '../publicApiV1.routes.js';

vi.mock('../../services/apiKeyService.js', async () => {
  const actual: any = await vi.importActual('../../services/apiKeyService.js');
  return {
    ...actual,
    ApiKeyService: {
      ...actual.ApiKeyService,
      validateKey: vi.fn().mockResolvedValue(null),
    },
  };
});

const dbGet = vi.fn();
const dbRun = vi.fn();
vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../controllers/TaskController.js', () => ({
  default: {
    getTasks: (req: any, res: any) => res.json({ ok: true, actor: req.user }),
    createTask: (_req: any, res: any) => res.status(201).json({ ok: true }),
    getTaskById: (_req: any, res: any) => res.json({ ok: true }),
    updateTask: (_req: any, res: any) => res.json({ ok: true }),
    deleteTask: (_req: any, res: any) => res.json({ ok: true }),
  },
}));

vi.mock('../../services/v8/calendarInteropService.js', () => ({
  getCalendarSources: vi.fn().mockResolvedValue([]),
  createCalendarSource: vi.fn().mockResolvedValue({ id: 'src-1' }),
  getCalendarItems: vi.fn().mockResolvedValue([]),
  CalendarProviderValues: ['google'],
  DeclaredModeValues: ['read_only'],
  PermissionGradientValues: ['basic'],
}));

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/public/v1', publicApiV1Router);
  return app;
}

describe('Public API v1 (PO1) - API key auth', () => {
  beforeEach(() => {
    dbGet.mockReset();
    dbRun.mockReset();
  });

  it('rejects missing API key', async () => {
    const app = createApp();
    const res = await request(app).get('/api/public/v1/tasks');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('API key required');
  });

  it('accepts legacy plaintext user_api_keys and upgrades hash storage', async () => {
    const app = createApp();

    const plainKey = 'ck_test_legacy_key';
    const userId = 'user-1';
    const orgId = 'org-1';

    dbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM user_api_keys')) {
        return {
          id: 'uak-1',
          user_id: userId,
          key_hash: plainKey, // legacy plaintext storage
          permissions: JSON.stringify(['read:tasks']),
          rate_limit: 1000,
        };
      }
      if (sql.includes('FROM users')) {
        return { organization_id: orgId };
      }
      return null;
    });

    const res = await request(app)
      .get('/api/public/v1/tasks')
      .set('Authorization', `Bearer ${plainKey}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.actor).toEqual({ id: userId, organizationId: orgId });

    // Upgrades plaintext storage to hashed + updates last_used
    expect(dbRun).toHaveBeenCalled();
  });

  it('enforces permission scopes for user API keys', async () => {
    const app = createApp();

    const plainKey = 'ck_test_no_perms';
    dbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM user_api_keys')) {
        return {
          id: 'uak-2',
          user_id: 'user-2',
          key_hash: plainKey,
          permissions: JSON.stringify([]),
          rate_limit: 1000,
        };
      }
      if (sql.includes('FROM users')) {
        return { organization_id: 'org-2' };
      }
      return null;
    });

    const res = await request(app)
      .get('/api/public/v1/tasks')
      .set('Authorization', `Bearer ${plainKey}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Permission denied');
    expect(res.body.yourPermissions).toEqual([]);
  });
});

