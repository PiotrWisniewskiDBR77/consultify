/**
 * K5pl-229 pkg4 (Wpis 231 pkt 3, DEC-690): the requireTenantAdmin 403 guard in
 * table-platform.routes.ts must answer with the stable `code` only — the client
 * localizes it via apiErrorFallbacks/errors.*, so the redundant Polish `error:`
 * was dead contract noise. This is a wpięcie test on the REAL router (real
 * /api/table-platform mount), not a mirror.
 */
import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CODE = 'ADMIN_ACCESS_REQUIRED';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    // MEMBER + not superadmin -> requireTenantAdmin must answer 403.
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'MEMBER', isSuperAdmin: false };
    next();
  },
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

// checkSchemaReady() does `getDatabase().query('SELECT 1 FROM tp_bases LIMIT 0')`
// behind requireTablePlatform; resolve it so the request reaches the guard.
vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: async () => ({ rows: [] }) }),
}));

vi.mock('../../config/FeatureFlags.js', async (importActual) => {
  const actual = await importActual<any>();
  return {
    ...actual,
    featureFlags: { ...actual.featureFlags, ENABLE_TABLE_PLATFORM_RECORDS_API: true },
  };
});

async function loadApp() {
  const router = (await import('../table-platform.routes.js')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/table-platform', router);
  return app;
}

describe('K5pl-229 pkg4 — table-platform requireTenantAdmin 403 answers code only', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /api/table-platform/admin/sso as MEMBER -> 403 { code } with no Polish diacritics', async () => {
    const app = await loadApp();
    const res = await request(app).get('/api/table-platform/admin/sso');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ code: CODE });
    expect(JSON.stringify(res.body)).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
  });

  it('code is registered in apiErrorFallbacks (EN, no diacritics)', () => {
    const src = readFileSync(path.join(ROOT, 'src/utils/apiErrorFallbacks.ts'), 'utf8');
    const line = src.split('\n').find((l) => l.includes(`${CODE}:`));
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
  });

  it('code has an EN and PL errors.* entry (parity)', () => {
    const en = JSON.parse(
      readFileSync(path.join(ROOT, 'public/locales/en/translation.json'), 'utf8')
    );
    const pl = JSON.parse(
      readFileSync(path.join(ROOT, 'public/locales/pl/translation.json'), 'utf8')
    );
    expect(en.errors?.[CODE]).toBeTruthy();
    expect(pl.errors?.[CODE]).toBeTruthy();
    expect(en.errors[CODE]).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
  });
});
