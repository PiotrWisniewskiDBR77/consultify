/**
 * BUG B (H2.14) — AI Controls → Audit Log tab.
 *
 * Two defects made the tab show "Failed to fetch audit log":
 *   1. The role gate on GET /api/ai-settings/audit only accepted exact
 *      admin/superadmin, so org OWNERs got 403.
 *   2. The service returns { total, rows, entries } (an object), but the FE
 *      expects a plain array — so even a 200 broke `.filter`.
 *
 * These tests prove an OWNER now gets 200 and the body is an array of entries.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

// Service returns the enveloped object shape the real service uses.
const getAuditLog = vi.fn().mockResolvedValue({
  total: 2,
  rows: [{ id: 'a1' }, { id: 'a2' }],
  entries: [{ id: 'a1' }, { id: 'a2' }],
});
vi.mock('../../../../server/src/services/aiSettingsService.js', () => ({
  default: { getAuditLog },
}));

async function loadRouter() {
  return (await import('../../../../server/src/routes/ai/ai-settings.routes.ts')).default;
}

function makeApp(user: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = user;
    (req as any).userRole = user.role;
    next();
  });
  return app;
}

const ORG = 'org-1';

describe('GET /api/ai-settings/audit — owner access + array shape (BUG B / H2.14)', () => {
  beforeEach(() => getAuditLog.mockClear());
  afterEach(() => vi.clearAllMocks());

  it('returns 200 with an ARRAY of entries for an org OWNER (was 403 before)', async () => {
    const app = makeApp({ id: 'o', role: 'OWNER', organizationId: ORG });
    app.use('/api/ai-settings', await loadRouter());

    const res = await request(app).get('/api/ai-settings/audit');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.headers['x-total-count']).toBe('2');
    expect(getAuditLog).toHaveBeenCalled();
  });

  it('returns 200 with an array for a lowercase admin', async () => {
    const app = makeApp({ id: 'a', role: 'admin', organizationId: ORG });
    app.use('/api/ai-settings', await loadRouter());

    const res = await request(app).get('/api/ai-settings/audit');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('still denies a plain member with 403', async () => {
    const app = makeApp({ id: 'm', role: 'member', organizationId: ORG });
    app.use('/api/ai-settings', await loadRouter());

    const res = await request(app).get('/api/ai-settings/audit');
    expect(res.status).toBe(403);
    expect(getAuditLog).not.toHaveBeenCalled();
  });
});
