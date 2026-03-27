import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-partner-1', organizationId: 'tenant-org-1', role: 'ADMIN' };
    req.userId = 'user-partner-1';
    req.organizationId = 'tenant-org-1';
    next();
  },
}));

vi.mock('../../../server/src/services/partnerOrgResolution.js', () => ({
  getActivePartnerOrgIdForUser: vi.fn().mockResolvedValue('partner-org-resolved'),
}));

async function loadPartnersRouter() {
  return (await import('../../../server/src/routes/partners.routes.ts')).default;
}

async function makePartnersApp() {
  const router = await loadPartnersRouter();
  return makeTestApp({ mountPath: '/api/partners', router });
}

describe('Clients endpoints (partners routes) - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /clients returns a real partner-scoped list', async () => {
    const app = await makePartnersApp();
    const res = await request(app).get('/api/partners/clients');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
      })
    );
  });

  it('POST /clients remains unavailable until broader client-access writes land', async () => {
    const app = await makePartnersApp();
    const res = await request(app)
      .post('/api/partners/clients')
      .send({ name: 'N', industry: 'I', contactEmail: 'a@b.com' });
    expect(res.status).toBe(503);
  });

  it('GET /clients/:clientId remains unavailable until broader client-access detail continuity lands', async () => {
    const app = await makePartnersApp();
    const res = await request(app).get('/api/partners/clients/client-999');
    expect(res.status).toBe(503);
  });

  it('GET /projects returns a real partner-scoped project list', async () => {
    const app = await makePartnersApp();
    const res = await request(app).get('/api/partners/projects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
      })
    );
  });

  it('GET /employees returns a real partner-scoped employee roster', async () => {
    const app = await makePartnersApp();
    const res = await request(app).get('/api/partners/employees');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
      })
    );
  });
});
