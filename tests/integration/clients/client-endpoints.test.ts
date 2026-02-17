import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

async function loadPartnersRouter() {
  return (await import('../../../server/src/routes/partners.routes.ts')).default;
}

async function makePartnersApp() {
  const router = await loadPartnersRouter();
  return makeTestApp({ mountPath: '/api/partners', router });
}

describe('Clients endpoints (partners routes demo) - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /clients returns demo list and pagination', async () => {
    const app = await makePartnersApp();
    const res = await request(app).get('/api/partners/clients');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
        pagination: expect.objectContaining({ total: expect.any(Number) }),
      })
    );
  });

  it('POST /clients returns 201 with created client object', async () => {
    const app = await makePartnersApp();
    const res = await request(app)
      .post('/api/partners/clients')
      .send({ name: 'N', industry: 'I', contactEmail: 'a@b.com' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.objectContaining({ name: 'N', status: 'onboarding' }));
  });

  it('GET /clients/:clientId echoes the clientId in response', async () => {
    const app = await makePartnersApp();
    const res = await request(app).get('/api/partners/clients/client-999');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('client-999');
  });
});
