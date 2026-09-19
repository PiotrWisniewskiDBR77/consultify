/**
 * K5pl-229 (Wpis 231 pkt 3, DEC-690) — managementReports' PATCH /:id update-failure branch used to
 * inline a Polish `error:` sentence next to the stable `code:`. The code is LOKALIZOWANY (present
 * in `apiErrorFallbacks.ts` + `errors.*` EN/PL), so the live client already rendered the English
 * sentence by code and the Polish literal was dead contract noise. The server now sends ONLY
 * `{ code }` (canonical shape, cf. assessment-hub.routes.ts:496). The 400 itself is unchanged, and
 * the tenant-miss 404 rethrow above it is untouched.
 *
 * This supertest mounts the REAL router, forces the update-failure path (updateReport rejects with
 * a plain Error carrying no `.status`, so it is NOT the 404 rethrow), and asserts the contract: a
 * stable code, and no Polish diacritics anywhere in the body.
 * MUTATION: restore `error: 'Nie udało się zaktualizować raportu'` in the route → the
 * `toEqual({ code })` and the diacritic assertions both go RED.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateReport = vi.fn();

vi.mock('../../services/managementReportsService.js', () => ({
  default: { updateReport },
}));

// The router does `router.use(verifyToken)`; replace it with a passthrough that supplies the
// authenticated identity the handler reads (`req.userId` / `req.organizationId`).
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

// `router.use(demoContextMiddleware)` — passthrough; the 400 branch does not depend on demo context.
vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
  demoGuard: (_req: any, _res: any, next: any) => next(),
  default: (_req: any, _res: any, next: any) => next(),
}));

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const CODE = 'MANAGEMENT_REPORT_UPDATE_FAILED';
const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function errorsLocale(locale: 'en' | 'pl'): Record<string, unknown> {
  const file = path.join(ROOT, `public/locales/${locale}/translation.json`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { errors?: Record<string, unknown> };
  return parsed.errors ?? {};
}

async function app() {
  const { default: router } = await import('../managementReports.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/management-reports', router);
  return app;
}

describe('managementReports PATCH /:id update-failure carries a stable code and no Polish (K5pl-229)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PATCH /:id → updateReport throws without .status → 400 { code } only', async () => {
    updateReport.mockRejectedValue(new Error('db down — internals must not leak'));
    const res = await request(await app())
      .patch(`/api/management-reports/${ID}`)
      .send({ title: 'edited' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ code: CODE });
    expect(JSON.stringify(res.body)).not.toMatch(POLISH_DIACRITICS);
  });
});

describe('K5pl-229 registry parity for the emitted code (fallbacks ⇔ en ⇔ pl)', () => {
  it(`${CODE} is registered in apiErrorFallbacks.ts and in both locales' errors.*`, () => {
    const fallbacks = fs.readFileSync(path.join(ROOT, 'src/utils/apiErrorFallbacks.ts'), 'utf8');
    expect(fallbacks, 'apiErrorFallbacks.ts').toContain(`${CODE}:`);
    expect(errorsLocale('en')[CODE], 'public/locales/en errors').toBeTruthy();
    expect(errorsLocale('pl')[CODE], 'public/locales/pl errors').toBeTruthy();
  });

  it(`${CODE} EN locale sentence carries no Polish diacritics`, () => {
    expect(String(errorsLocale('en')[CODE])).not.toMatch(POLISH_DIACRITICS);
  });
});
