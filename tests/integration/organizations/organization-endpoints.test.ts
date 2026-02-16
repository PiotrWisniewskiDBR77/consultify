import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { getAttributionByOrganization, validateReferralCode, createAttribution } = vi.hoisted(
  () => ({
    getAttributionByOrganization: vi.fn(),
    validateReferralCode: vi.fn(),
    createAttribution: vi.fn(),
  })
);

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/services/partnerReferralService.js', () => ({
  getAttributionByOrganization: (...args: any[]) => getAttributionByOrganization(...args),
  validateReferralCode: (...args: any[]) => validateReferralCode(...args),
  createAttribution: (...args: any[]) => createAttribution(...args),
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({}),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn(async () => null),
}));

async function loadPartnerCodeRouter() {
  return (await import('../../../server/src/routes/organization/partner-code.routes.ts')).default;
}

async function makePartnerCodeApp(opts?: { organization_id?: string }) {
  const router = await loadPartnerCodeRouter();
  return makeTestApp({
    mountPath: '/api/organization',
    router,
    beforeMount: (app) => {
      app.use((req, _res, next) => {
        (req as any).user = { id: 'u-1', organization_id: opts?.organization_id };
        next();
      });
    },
  });
}

describe('Organization partner code routes - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAttributionByOrganization.mockResolvedValue(null);
    validateReferralCode.mockResolvedValue({ valid: false, error: 'Invalid' });
    createAttribution.mockResolvedValue({ id: 'attr-1' });
  });

  it('GET /partner-attribution returns 400 when organization_id is missing', async () => {
    const app = await makePartnerCodeApp();
    const res = await request(app).get('/api/organization/partner-attribution');
    expect(res.status).toBe(400);
  });

  it('GET /partner-attribution returns null data when no attribution exists', async () => {
    const app = await makePartnerCodeApp({ organization_id: 'org-1' });
    const res = await request(app).get('/api/organization/partner-attribution');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
  });

  it('POST /partner-code returns 400 for invalid partner code', async () => {
    const app = await makePartnerCodeApp({ organization_id: 'org-1' });
    const res = await request(app)
      .post('/api/organization/partner-code')
      .send({ partnerCode: 'X' });
    expect(res.status).toBe(400);
  });
});
