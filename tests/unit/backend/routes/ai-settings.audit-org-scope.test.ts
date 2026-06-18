/**
 * C2 — org-scope of GET /api/ai-settings/audit/org/:orgId
 *
 * Regression for the audit-log IDOR: access must be superadmin OR admin of THIS
 * org. A same-org NON-admin must be denied, and a cross-org admin must be denied.
 * (Canonical gate :689-692.)
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

// Service must expose getAuditLog so we reach the access gate (not the
// service-not-configured early return).
const getAuditLog = vi.fn().mockResolvedValue([{ id: 'a1' }]);
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
const PATH = `/api/ai-settings/audit/org/${ORG}`;

describe('GET /api/ai-settings/audit/org/:orgId — org-scope (C2)', () => {
  beforeEach(() => getAuditLog.mockClear());
  afterEach(() => vi.clearAllMocks());

  it('allows a superadmin (any org)', async () => {
    const app = makeApp({ id: 'sa', role: 'superadmin', organizationId: 'other-org' });
    app.use('/api/ai-settings', await loadRouter());
    const res = await request(app).get(PATH);
    expect(res.status).toBe(200);
    expect(getAuditLog).toHaveBeenCalled();
  });

  it('allows an admin of the SAME org', async () => {
    const app = makeApp({ id: 'a', role: 'admin', organizationId: ORG });
    app.use('/api/ai-settings', await loadRouter());
    const res = await request(app).get(PATH);
    expect(res.status).toBe(200);
  });

  it('DENIES a same-org non-admin (member) with 403', async () => {
    const app = makeApp({ id: 'm', role: 'member', organizationId: ORG });
    app.use('/api/ai-settings', await loadRouter());
    const res = await request(app).get(PATH);
    expect(res.status).toBe(403);
    expect(getAuditLog).not.toHaveBeenCalled();
  });

  it('DENIES a cross-org admin with 403 (IDOR guard)', async () => {
    const app = makeApp({ id: 'a2', role: 'admin', organizationId: 'org-2' });
    app.use('/api/ai-settings', await loadRouter());
    const res = await request(app).get(PATH);
    expect(res.status).toBe(403);
    expect(getAuditLog).not.toHaveBeenCalled();
  });
});
