import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

const mockQuery = vi.fn();
vi.mock('../../../server/src/database/index.js', async () => {
  const actual = (await vi.importActual('../../../server/src/database/index.js')) as any;
  return {
    ...actual,
    getDatabase: () => ({ query: mockQuery }),
  };
});

const { default: chatProjectsRouter } =
  await import('../../../server/src/routes/chat-projects.routes.ts');

describe('Chat projects routes (REAL integration)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  let canListen = true;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  beforeAll(async () => {
    canListen = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.listen(0, '127.0.0.1', () => s.close(() => resolve(true)));
    });
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
  });

  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/chat-projects', chatProjectsRouter);
    return app;
  };

  it('returns empty list when chat_projects table is missing', async function () {
    if (!canListen) this.skip();
    mockQuery.mockRejectedValueOnce({
      code: 'SQLITE_ERROR',
      message: 'SQLITE_ERROR: no such table: chat_projects',
    });

    const app = makeApp();
    const res = await request(app).get('/api/chat-projects');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ projects: [], total: 0 });
  });
});
