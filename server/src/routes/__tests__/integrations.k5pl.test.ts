/**
 * K5pl-229 (Wpis 231 pkt 3 / Wpis 261, DEC-690) — integrations.routes.ts.
 *
 * Both POST /connect/:provider and POST /:provider/connect return 501 with a
 * stable `code: GOVERNED_CONNECTOR_NOT_APPROVED` when the governed-connector
 * approval check fails. The client localizes that code via apiErrorFallbacks +
 * errors.<CODE>; the redundant Polish `error:` literal was removed. This suite
 * pins the wire contract (body == { code }, no Polish diacritics) and the i18n
 * parity of the code, so re-introducing a Polish `error:` fails.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const CODE = 'GOVERNED_CONNECTOR_NOT_APPROVED';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

// Passthrough auth chain — the 501 fires inside the handler, not the guards.
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/auditsStrictMembership.middleware.js', () => ({
  requireActiveAuditsMembership: (_req: any, _res: any, next: any) => next(),
}));

// integrations table must look migrated so the governed-connector branch runs.
vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: async () => new Set(['id', 'organization_id', 'connector_id', 'config']),
}));

// Empty config fields → onboardingStatus 'pending_external_auth' for an oauth2
// connector → requiresGovernedExternalAuth true → buildGovernedExternalAuthSession
// runs first and throws the approval error (mirrors requireApprovedGovernedConnector).
// isGovernedConnectorApprovalError replicates the REAL predicate byte-for-byte.
vi.mock('../../services/v8/pmSyncExternalAuthMaterializationService.js', () => ({
  getGovernedExternalAuthConfigFields: () => [],
  buildGovernedExternalAuthSession: () => {
    throw new Error('Governed external auth provider is not approved: gmail');
  },
  isGovernedConnectorApprovalError: (error: unknown) =>
    error instanceof Error &&
    error.message.startsWith('Governed external auth provider is not approved:'),
}));

let app: express.Express;

beforeAll(async () => {
  const router = (await import('../integrations/integrations.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/integrations', router);
});

describe('K5pl-229 integrations.routes GOVERNED_CONNECTOR_NOT_APPROVED', () => {
  it('POST /connect/:provider → 501 body == { code } with no Polish diacritics', async () => {
    const res = await request(app).post('/api/integrations/connect/gmail').send({});
    expect(res.status).toBe(501);
    expect(res.body).toEqual({ code: CODE });
    expect(JSON.stringify(res.body)).not.toMatch(DIACRITICS);
  });

  it('POST /:provider/connect (alias) → 501 body == { code } with no Polish diacritics', async () => {
    const res = await request(app).post('/api/integrations/gmail/connect').send({});
    expect(res.status).toBe(501);
    expect(res.body).toEqual({ code: CODE });
    expect(JSON.stringify(res.body)).not.toMatch(DIACRITICS);
  });

  it('code is localized: apiErrorFallbacks (EN, no diacritics) + en/pl errors pair', () => {
    const fallbacks = fs.readFileSync(path.join(ROOT, 'src/utils/apiErrorFallbacks.ts'), 'utf8');
    const line = fallbacks.split('\n').find((l) => l.includes(`${CODE}:`));
    expect(line, 'apiErrorFallbacks must register the code').toBeTruthy();
    expect(line!, 'EN fallback must not contain Polish diacritics').not.toMatch(DIACRITICS);

    const en = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public/locales/en/translation.json'), 'utf8')
    );
    const pl = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public/locales/pl/translation.json'), 'utf8')
    );
    expect(en.errors?.[CODE], 'en.errors must have the code').toBeTruthy();
    expect(pl.errors?.[CODE], 'pl.errors must have the code').toBeTruthy();
    expect(String(en.errors[CODE]), 'EN errors value must not contain diacritics').not.toMatch(
      DIACRITICS
    );
  });
});
