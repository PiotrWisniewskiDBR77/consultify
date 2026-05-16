import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import {
  sendApiMethodNotAllowed,
  sendApiUnknownRouteNotFound,
} from '../../../server/src/utils/apiContractResponses.js';
import { resolveAllowedApiMethods } from '../../../server/src/utils/apiRouteMethodAllowlist.js';

function buildAppWithUnknownApiHandler() {
  const app = express();
  app.use(correlationMiddleware);
  app.get('/api/_known', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use((req, res) => {
    if (!req.path.startsWith('/api/')) {
      return res.status(404).json({ status: 'fail', error: { code: 'ASSET_NOT_FOUND' } });
    }
    const allowedMethods = resolveAllowedApiMethods(app, req);
    if (allowedMethods.length > 0 && !allowedMethods.includes(req.method.toUpperCase())) {
      sendApiMethodNotAllowed(req, res, allowedMethods);
      return;
    }
    sendApiUnknownRouteNotFound(req, res);
  });
  return app;
}

describe('api unknown route fail-closed contract', () => {
  it('returns namespaced coded fail envelope with correlation parity', async () => {
    const app = buildAppWithUnknownApiHandler();
    const res = await request(app)
      .get('/api/__pack08_s4_no_route__')
      .set('X-Correlation-ID', 'pack08s4-corr-route-1');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('API_ROUTE_NOT_FOUND');
    expect(res.body.error.message).toBe('The requested API endpoint does not exist.');
    expect(Number.isNaN(Date.parse(res.body.error.timestamp))).toBe(false);
    expect(res.body.correlationId).toBe('pack08s4-corr-route-1');
    expect(res.headers['x-correlation-id']).toBe('pack08s4-corr-route-1');
    expect(JSON.stringify(res.body)).not.toContain('__pack08_s4_no_route__');
  });

  it('returns 405 with allow header for known path and wrong method', async () => {
    const app = buildAppWithUnknownApiHandler();
    const res = await request(app)
      .post('/api/_known')
      .set('X-Correlation-ID', 'pack08s5-corr-method-1');

    expect(res.status).toBe(405);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('API_METHOD_NOT_ALLOWED');
    expect(res.body.correlationId).toBe('pack08s5-corr-method-1');
    expect(res.headers.allow).toContain('GET');
    expect(res.headers.allow).toContain('HEAD');
  });
});

