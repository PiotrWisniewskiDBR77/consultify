/**
 * Auth Integration Tests
 * Testing authentication endpoints with real HTTP against REAL routes (no local mock handlers).
 *
 * @module tests/integration/auth/auth-endpoints.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import net from 'node:net';

import authRouter from '../../../server/src/routes/auth.routes.ts';

describe('Auth Endpoints Integration', () => {
  let app: express.Application;
  let canListen = true;
  const origE2eMode = process.env.E2E_MODE;
  const origNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.E2E_MODE = 'true';
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  describe('POST /api/auth/refresh', () => {
    beforeAll(async () => {
      canListen = await new Promise<boolean>((resolve) => {
        const s = net.createServer();
        s.once('error', () => resolve(false));
        s.listen(0, '127.0.0.1', () => {
          s.close(() => resolve(true));
        });
      });
    });

    it('does not bypass refresh-token verification in E2E_MODE', async function () {
      if (!canListen) this.skip();
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'e2e-refresh' });
      expect(response.status).toBe(401);
      expect(response.body).not.toHaveProperty('token');
    });

    it('rejects when refreshToken is missing', async function () {
      if (!canListen) this.skip();
      const response = await request(app).post('/api/auth/refresh').send({});
      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  afterAll(() => {
    if (origE2eMode === undefined) delete process.env.E2E_MODE;
    else process.env.E2E_MODE = origE2eMode;
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
  });
});
