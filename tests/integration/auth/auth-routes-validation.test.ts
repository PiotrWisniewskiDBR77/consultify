import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import net from 'node:net';

import authRouter from '../../../server/src/routes/auth.routes.ts';

describe('Auth routes (REAL integration)', () => {
  const origE2eMode = process.env.E2E_MODE;
  const origNodeEnv = process.env.NODE_ENV;
  let canListen = true;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.E2E_MODE = 'true';
  });

  beforeAll(async () => {
    canListen = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.listen(0, '127.0.0.1', () => s.close(() => resolve(true)));
    });
  });

  afterAll(() => {
    if (origE2eMode === undefined) delete process.env.E2E_MODE;
    else process.env.E2E_MODE = origE2eMode;
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
  });

  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const out: Record<string, string> = {};
      const raw = req.headers.cookie;
      if (typeof raw === 'string' && raw.length > 0) {
        for (const part of raw.split(';')) {
          const [k, ...rest] = part.trim().split('=');
          if (!k) continue;
          out[k] = decodeURIComponent(rest.join('=') || '');
        }
      }
      (req as any).cookies = out;
      next();
    });
    app.use('/api/auth', authRouter);
    return app;
  };

  describe('POST /api/auth/login (validation only)', () => {
    it('returns 400 when email is missing', async function () {
      if (!canListen) this.skip();
      const app = makeApp();
      const res = await request(app).post('/api/auth/login').send({ password: 'x' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          details: expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
        })
      );
    });

    it('returns 400 when email format is invalid', async function () {
      if (!canListen) this.skip();
      const app = makeApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'x' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'email', message: expect.stringMatching(/invalid/i) }),
          ]),
        })
      );
    });

    it('returns 400 when password is empty', async function () {
      if (!canListen) this.skip();
      const app = makeApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: '' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          details: expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
        })
      );
    });
  });

  describe('POST /api/auth/register (validation only)', () => {
    it('returns 400 when required fields are missing', async function () {
      if (!canListen) this.skip();
      const app = makeApp();
      const res = await request(app).post('/api/auth/register').send({ email: 'a@b.com' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
            expect.objectContaining({ field: 'firstName' }),
            expect.objectContaining({ field: 'lastName' }),
          ]),
        })
      );
    });

    it('returns 400 when password is too short', async function () {
      if (!canListen) this.skip();
      const app = makeApp();
      const res = await request(app).post('/api/auth/register').send({
        email: 'a@b.com',
        password: 'short',
        firstName: 'A',
        lastName: 'B',
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'password',
              message: expect.stringMatching(/at least/i),
            }),
          ]),
        })
      );
    });
  });

  describe('POST /api/auth/refresh (E2E_MODE remains fail-closed)', () => {
    it('returns 400 when refreshToken is missing (no body, no cookie)', async function () {
      if (!canListen) this.skip();
      const app = makeApp();
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual(expect.objectContaining({ error: 'Refresh token is required' }));
    });

    it('reads a cookie token but rejects it when it is not a persisted refresh token', async function () {
      if (!canListen) this.skip();
      const app = makeApp();
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refresh_token=e2e-cookie-refresh'])
        .send({});

      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty('token');
    });
  });
});
