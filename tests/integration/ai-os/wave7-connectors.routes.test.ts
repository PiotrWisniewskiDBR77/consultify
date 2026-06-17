/**
 * M22 L-08 — Route-integration tests for Wave 7 connector-runtime routes.
 *
 * Mounts the REAL wave7-connectors router (`/api/ai-connectors/*`) and verifies
 * key GET/POST endpoints return the expected envelope, are org-scoped, and
 * propagate allowed/blocked (200/403, 202/403) status codes.
 *
 * wave7ConnectorRuntimeService is fully mocked — no real DB.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTestApp } from '../_helpers/testApp';

const svc = vi.hoisted(() => ({
  getWave7ConnectorCatalog: vi.fn(),
  listWave7Connectors: vi.fn(),
  registerWave7Connector: vi.fn(),
  updateWave7Connector: vi.fn(),
  linkWave7ConnectorToExternal: vi.fn(),
  disconnectWave7Connector: vi.fn(),
  reindexWave7Connector: vi.fn(),
  executeWave7ConnectorTool: vi.fn(),
  listWave7ConnectorRuns: vi.fn(),
  buildWave7ConnectorHealth: vi.fn(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/wave7ConnectorRuntimeService.js', () => svc);

const BASE = '/api/ai-connectors';
const ORG = 'org-wave7';
const USER = 'user-wave7';

let router: any;

const makeApp = () =>
  makeTestApp({
    mountPath: BASE,
    router,
    beforeMount: (app) => {
      app.use((req: any, _res, next) => {
        req.user = { id: USER, organizationId: ORG, role: 'admin' };
        next();
      });
    },
  });

beforeEach(async () => {
  vi.clearAllMocks();
  router = (await import('../../../server/src/routes/wave7-connectors.routes.ts')).default;
});

describe('M22 L-08 — Wave 7 /api/ai-connectors routes', () => {
  it('GET /catalog returns 200 with { success, catalog } (no org required)', async () => {
    svc.getWave7ConnectorCatalog.mockResolvedValue([{ provider: 'gdrive' }]);

    const res = await request(makeApp()).get(`${BASE}/catalog`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, catalog: [{ provider: 'gdrive' }] });
  });

  it('GET / returns 200 with { success, connectors } scoped to the caller org', async () => {
    svc.listWave7Connectors.mockResolvedValue([{ id: 'conn-1', provider: 'slack' }]);

    const res = await request(makeApp()).get(`${BASE}/`).query({ projectId: 'p-7' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.connectors).toEqual([{ id: 'conn-1', provider: 'slack' }]);
    expect(svc.listWave7Connectors).toHaveBeenCalledWith({
      organizationId: ORG,
      projectId: 'p-7',
    });
  });

  it('GET /health returns 200 with { success, health } scoped to org', async () => {
    svc.buildWave7ConnectorHealth.mockResolvedValue({ healthy: 2, degraded: 0 });

    const res = await request(makeApp()).get(`${BASE}/health`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, health: { healthy: 2, degraded: 0 } });
    expect(svc.buildWave7ConnectorHealth).toHaveBeenCalledWith({ organizationId: ORG });
  });

  it('GET /runs returns 200 with { success, runs } and honors the limit query', async () => {
    svc.listWave7ConnectorRuns.mockResolvedValue([{ id: 'run-1' }]);

    const res = await request(makeApp()).get(`${BASE}/runs`).query({ limit: '10' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, runs: [{ id: 'run-1' }] });
    expect(svc.listWave7ConnectorRuns).toHaveBeenCalledWith({ organizationId: ORG, limit: 10 });
  });

  it('POST / registers a connector → 201 with { success, connector }', async () => {
    svc.registerWave7Connector.mockResolvedValue({ id: 'conn-new', provider: 'notion' });

    const res = await request(makeApp())
      .post(`${BASE}/`)
      .send({ provider: 'notion', scopes: ['read'] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, connector: { id: 'conn-new' } });
    expect(svc.registerWave7Connector).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, userId: USER, provider: 'notion' })
    );
  });

  it('POST /execute returns 403 + success:false when the service disallows the tool call', async () => {
    svc.executeWave7ConnectorTool.mockResolvedValue({ allowed: false, reason: 'acl_denied' });

    const res = await request(makeApp())
      .post(`${BASE}/execute`)
      .send({ connectorId: 'conn-1', toolName: 'connector_search' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, allowed: false, reason: 'acl_denied' });
  });

  it('POST /:id/reindex returns 202 when the service allows the reindex', async () => {
    svc.reindexWave7Connector.mockResolvedValue({ allowed: true, runId: 'r-1' });

    const res = await request(makeApp()).post(`${BASE}/conn-1/reindex`).send({});

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ success: true, allowed: true, runId: 'r-1' });
    expect(svc.reindexWave7Connector).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, connectorId: 'conn-1' })
    );
  });

  it('PATCH /:id returns 404 when the connector does not exist (null from service)', async () => {
    svc.updateWave7Connector.mockResolvedValue(null);

    const res = await request(makeApp()).patch(`${BASE}/missing`).send({ status: 'disconnected' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });
});
