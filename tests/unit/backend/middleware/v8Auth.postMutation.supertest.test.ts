import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  attachV8Context,
  requireV8OrgContext,
} from '../../../../server/src/middleware/v8Auth.middleware.ts';

/**
 * SUPERTEST regression guard — v8 POST mutation must pass through the auth gates.
 *
 * This drives the ACTUAL Express body-parser (express.json()) which, after
 * consuming a POST/PATCH body, marks the IncomingMessage (`req`) as destroyed
 * while the socket stays open. If the v8 middleware ever gates on `req.destroyed`
 * again, this request would hang (no next(), no response) and the test would
 * time out / never return 201 — reproducing the demo-breaking Cloudflare 524.
 *
 * A minimal app is used deliberately (no controller/DB mocking) so this test is
 * fast and pins ONLY the middleware pass-through behaviour end-to-end.
 */
function buildApp() {
  const app = express();
  app.use(express.json());

  // Simulate the auth layer having populated org/user context upstream.
  app.use((req: any, _res, next) => {
    req.organizationId = 'org-1';
    req.userId = 'user-1';
    req.userRole = 'ADMIN';
    req.user = { id: 'user-1', organizationId: 'org-1', isSuperAdmin: false };
    next();
  });

  // The real v8 mutation gates, in the same order routers apply them.
  app.use(requireV8OrgContext as any);
  app.use(attachV8Context as any);

  app.post('/v8/things', (req: any, res) => {
    res.status(201).json({ ok: true, echoed: req.body, ctx: req.v8Context });
  });

  return app;
}

describe('v8Auth POST mutation (supertest end-to-end)', () => {
  it('POST with JSON body passes both v8 gates and returns 201 (does not hang on req.destroyed)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/v8/things')
      .send({ name: 'widget', count: 3 })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.echoed).toEqual({ name: 'widget', count: 3 });
    expect(res.body.ctx).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'ADMIN',
      isSuperAdmin: false,
    });
  });

  it('PATCH with JSON body also passes through the v8 gates', async () => {
    const app = buildApp();
    app.patch('/v8/things/:id', (req: any, res) => {
      res.status(200).json({ ok: true, id: req.params.id, body: req.body });
    });

    const res = await request(app)
      .patch('/v8/things/42')
      .send({ count: 9 })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, id: '42', body: { count: 9 } });
  });

  it('POST without org context is denied with 403 (gate still enforces its contract)', async () => {
    const app = express();
    app.use(express.json());
    app.use(requireV8OrgContext as any);
    app.use(attachV8Context as any);
    app.post('/v8/things', (_req, res) => res.status(201).json({ ok: true }));

    const res = await request(app)
      .post('/v8/things')
      .send({ name: 'widget' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('V8_MISSING_ORG_CONTEXT');
  });
});
