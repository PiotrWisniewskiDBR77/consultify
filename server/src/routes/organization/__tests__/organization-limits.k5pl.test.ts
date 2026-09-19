/**
 * K5pl-229 (Wpis 231 pkt 3, DEC-690) — organization-limits' fail-closed 500 branch used to inline
 * a Polish `error:` sentence next to the stable `code:`. The code is LOKALIZOWANY (present in
 * `apiErrorFallbacks.ts` + `errors.*` EN/PL), so the live client already rendered the English
 * sentence by code and the Polish literal was dead contract noise. The server now sends ONLY
 * `{ code }` (canonical shape, cf. assessment-hub.routes.ts:496). The 500 itself is unchanged —
 * it stays a real fail-closed 5xx (the snapshot drives capability gates downstream).
 *
 * This supertest mounts the REAL router, forces the 500 path (buildPolicySnapshot rejects), and
 * asserts the contract: a stable code, and no Polish diacritics anywhere in the body.
 * MUTATION: restore `error: 'Nie udało się pobrać ustawień dostępu organizacji'` in the route →
 * the `toEqual({ code })` and the diacritic assertions both go RED.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildPolicySnapshot = vi.fn();

vi.mock('../../../services/accessPolicyService.js', () => ({
  buildPolicySnapshot,
}));

// The router does `router.use(verifyToken)`; replace it with a passthrough that supplies the
// authenticated identity the handler reads (`req.organizationId` / `req.user.organizationId`).
vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.organizationId = 'org-1';
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
}));

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const CODE = 'ORG_POLICY_SNAPSHOT_FAILED';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

function errorsLocale(locale: 'en' | 'pl'): Record<string, unknown> {
  const file = path.join(ROOT, `public/locales/${locale}/translation.json`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { errors?: Record<string, unknown> };
  return parsed.errors ?? {};
}

async function app() {
  const { default: router } = await import('../organization-limits.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/organization', router);
  return app;
}

describe('organization-limits policy-snapshot 500 carries a stable code and no Polish (K5pl-229)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET policy-snapshot → buildPolicySnapshot throws → 500 { code } only', async () => {
    buildPolicySnapshot.mockRejectedValue(new Error('db down — internals must not leak'));
    const res = await request(await app()).get('/api/organization/policy-snapshot');
    expect(res.status).toBe(500);
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
