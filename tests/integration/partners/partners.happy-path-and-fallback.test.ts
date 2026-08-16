/**
 * M26 Portal Partnerski — E2E happy-path + honest degradacja (L-02/L-03/L-04).
 *
 * - L-02 (S1): connect→dashboard — GET /connection zwraca connected:true + org.
 * - L-03 (S3): payout lifecycle — POST /payouts/request → 201 + payout; pusty → 400.
 * - L-04: legacy earnings silent-fallback — gdy serwis rzuca, 503 DB_ERROR,
 *         NIGDY hardkodowany commissionRate:15 (regresja `7cf315b4b9`).
 *
 * DB nie jest dostępne w teście integracyjnym (vitest, brak postgres) — happy-path
 * mockuje granicę serwisów/DAO (wzór: `v8-partner-read.test.ts` mockuje serwisy,
 * nie SQL). Routing + auth-gate + kontrakt odpowiedzi są realne.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

// ── Mocks granicy danych (hoisted) ───────────────────────────────────────────
const { resolveOrgIdMock, dbGetMock, dbAllMock, dbRunMock, commissionSvc } = vi.hoisted(() => ({
  resolveOrgIdMock: vi.fn(),
  dbGetMock: vi.fn(),
  dbAllMock: vi.fn(),
  dbRunMock: vi.fn(),
  commissionSvc: {
    getEarningsSummary: vi.fn(),
    requestPayout: vi.fn(),
    getCommissions: vi.fn(),
    getPayouts: vi.fn(),
  },
}));

vi.mock('../../../server/src/services/partnerOrgResolution.js', () => ({
  getActivePartnerOrgIdForUser: (...a: unknown[]) => resolveOrgIdMock(...a),
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({}),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...a: unknown[]) => dbGetMock(...a),
  all: (...a: unknown[]) => dbAllMock(...a),
  run: (...a: unknown[]) => dbRunMock(...a),
}));

vi.mock('../../../server/src/services/partnerCommissionService.js', () => ({
  default: commissionSvc,
  ...commissionSvc,
}));

// Demo seed jest no-op w teście (idempotentny connect).
vi.mock('../../../server/src/services/partnerDemoSeedService.js', () => ({
  ensurePartnerDemoDataset: vi.fn(async () => undefined),
}));

describe('M26 Portal Partnerski — happy-path + fallback', () => {
  const basePath = '/api/partners';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'u-partner-1',
            organizationId: 'o-1',
            role: 'admin',
            email: 'partner@example.com',
            name: 'Partner One',
          };
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    // This suite intentionally proves the retired route contract. Production
    // defaults to zero legacy writers; the explicit switch exercises rollback.
    process.env.PARTNER_LEGACY_ROLLBACK_ENABLED = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/partners.routes.ts')).default;
  });

  afterAll(() => {
    delete process.env.PARTNER_LEGACY_ROLLBACK_ENABLED;
  });

  beforeEach(() => {
    resolveOrgIdMock.mockReset();
    dbGetMock.mockReset();
    dbAllMock.mockReset();
    dbRunMock.mockReset();
    commissionSvc.getEarningsSummary.mockReset();
    commissionSvc.requestPayout.mockReset();
  });

  // ── L-02 (S1): connect → dashboard ─────────────────────────────────────────
  it('S1 (L-02): GET /connection returns connected:true with the partner org', async () => {
    resolveOrgIdMock.mockResolvedValue('partner-org-1');
    dbGetMock.mockResolvedValue({
      id: 'partner-org-1',
      name: 'Acme Resellers',
      contact_email: 'ops@acme.test',
      tier: 'gold',
      status: 'active',
      public_listing_enabled: true,
      commission_rate_percent: 18,
    });
    dbAllMock.mockResolvedValue([]); // specializations + regions

    const res = await request(makeApp()).get(`${basePath}/connection`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.connected).toBe(true);
    expect(res.body.data.organization.name).toBe('Acme Resellers');
    expect(res.body.data.organization.tier).toBe('gold');
  });

  it('S1 (L-02): GET /connection returns connected:false when user has no partner org', async () => {
    resolveOrgIdMock.mockResolvedValue(null);

    const res = await request(makeApp()).get(`${basePath}/connection`);

    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(false);
    expect(dbGetMock).not.toHaveBeenCalled();
  });

  // ── L-03 (S3): payout lifecycle ────────────────────────────────────────────
  it('S3 (L-03): POST /payouts/request returns 201 with the created payout', async () => {
    resolveOrgIdMock.mockResolvedValue('partner-org-1');
    commissionSvc.requestPayout.mockResolvedValue({
      id: 'payout-1',
      partnerOrgId: 'partner-org-1',
      amount: 1250,
      currency: 'EUR',
      status: 'requested',
    });

    const res = await request(makeApp())
      .post(`${basePath}/payouts/request`)
      .send({ payoutAccountId: 'acct-1', notes: 'Q2' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('payout-1');
    expect(res.body.data.status).toBe('requested');
    // scope: serwis dostał właściwe partnerOrgId (boundary partner-org, nie tenant)
    expect(commissionSvc.requestPayout).toHaveBeenCalledWith(
      expect.objectContaining({ partnerOrgId: 'partner-org-1' })
    );
  });

  it('S3 (L-03): POST /payouts/request returns 400 when nothing is payable', async () => {
    resolveOrgIdMock.mockResolvedValue('partner-org-1');
    commissionSvc.requestPayout.mockResolvedValue(null);

    const res = await request(makeApp()).post(`${basePath}/payouts/request`).send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ── L-04: legacy earnings silent-fallback regresja ─────────────────────────
  it('L-04: GET /earnings surfaces 503 DB_ERROR (never a hardcoded commissionRate:15)', async () => {
    resolveOrgIdMock.mockResolvedValue('partner-org-1');
    commissionSvc.getEarningsSummary.mockRejectedValue(new Error('relation "partner_commission_transactions" does not exist'));

    const res = await request(makeApp()).get(`${basePath}/earnings`);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('DB_ERROR');
    // kluczowa regresja: ZERO cichej hardkodowanej pustki
    expect(JSON.stringify(res.body)).not.toContain('commissionRate');
    expect(JSON.stringify(res.body)).not.toContain('"15"');
  });

  it('L-04: GET /earnings returns real summary on the happy path', async () => {
    resolveOrgIdMock.mockResolvedValue('partner-org-1');
    commissionSvc.getEarningsSummary.mockResolvedValue({
      totalEarned: 4200,
      readyForPayout: 1250,
      currency: 'EUR',
    });

    const res = await request(makeApp()).get(`${basePath}/earnings`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalEarned).toBe(4200);
  });
});
