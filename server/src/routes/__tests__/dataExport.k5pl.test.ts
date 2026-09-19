/**
 * K5pl-229 (Wpis 231 pkt 3 / Wpis 261, DEC-690) — dataExport.routes.ts.
 *
 * Five 500 handlers (POST /request, GET /status/:id, GET /requests,
 * GET /download/:id, DELETE /delete-request/:id) each returned a stable
 * `code: DATA_EXPORT_*_FAILED` alongside a redundant Polish `error:` literal.
 * The client localizes the code via apiErrorFallbacks + errors.<CODE>, so the
 * Polish `error:` was dead contract noise and was removed. This suite pins the
 * wire contract (body == { code }, no Polish diacritics) on the REAL router and
 * the i18n parity of every code, so re-introducing a Polish `error:` fails.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

const CODES = {
  create: 'DATA_EXPORT_CREATE_REQUEST_FAILED',
  status: 'DATA_EXPORT_STATUS_FAILED',
  list: 'DATA_EXPORT_LIST_REQUESTS_FAILED',
  download: 'DATA_EXPORT_DOWNLOAD_FAILED',
  cancel: 'DATA_EXPORT_CANCEL_DELETION_FAILED',
} as const;

// Auth + membership + audit guards passthrough; the 500 fires inside the handler.
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
  isAuthenticated: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
}));
vi.mock('../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: async () => undefined,
}));
vi.mock('../../utils/Logger.js', () => ({
  default: { error: () => undefined, info: () => undefined, warn: () => undefined },
}));

// Every db call throws a generic Error (no `.code`), so each handler's first db
// access lands in its catch → 500 with the stable code (never the LEGAL_HOLD branch).
vi.mock('../../utils/DbPromise.js', () => ({
  all: async () => {
    throw new Error('db down');
  },
  get: async () => {
    throw new Error('db down');
  },
  run: async () => {
    throw new Error('db down');
  },
}));

let app: express.Express;

beforeAll(async () => {
  const router = (await import('../dataExport.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/user', router);
});

async function expect500(res: any, code: string) {
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ code });
  expect(JSON.stringify(res.body)).not.toMatch(DIACRITICS);
}

describe('K5pl-229 dataExport.routes 500 bodies are code-only', () => {
  it('POST /request → 500 { code: DATA_EXPORT_CREATE_REQUEST_FAILED }', async () => {
    const res = await request(app).post('/api/user/request').send({ format: 'json' });
    await expect500(res, CODES.create);
  });

  it('GET /status/:requestId → 500 { code: DATA_EXPORT_STATUS_FAILED }', async () => {
    const res = await request(app).get('/api/user/status/req-1');
    await expect500(res, CODES.status);
  });

  it('GET /requests → 500 { code: DATA_EXPORT_LIST_REQUESTS_FAILED }', async () => {
    const res = await request(app).get('/api/user/requests');
    await expect500(res, CODES.list);
  });

  it('GET /download/:requestId → 500 { code: DATA_EXPORT_DOWNLOAD_FAILED }', async () => {
    const res = await request(app).get('/api/user/download/req-1');
    await expect500(res, CODES.download);
  });

  it('DELETE /delete-request/:requestId → 500 { code: DATA_EXPORT_CANCEL_DELETION_FAILED }', async () => {
    const res = await request(app).delete('/api/user/delete-request/req-1');
    await expect500(res, CODES.cancel);
  });

  it('every code is localized: apiErrorFallbacks (EN, no diacritics) + en/pl errors pair', () => {
    const fallbacks = fs.readFileSync(path.join(ROOT, 'src/utils/apiErrorFallbacks.ts'), 'utf8');
    const en = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public/locales/en/translation.json'), 'utf8')
    );
    const pl = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public/locales/pl/translation.json'), 'utf8')
    );
    for (const code of Object.values(CODES)) {
      const line = fallbacks.split('\n').find((l) => l.includes(`${code}:`));
      expect(line, `apiErrorFallbacks must register ${code}`).toBeTruthy();
      expect(line!, `EN fallback for ${code} must not contain diacritics`).not.toMatch(DIACRITICS);
      expect(en.errors?.[code], `en.errors must have ${code}`).toBeTruthy();
      expect(pl.errors?.[code], `pl.errors must have ${code}`).toBeTruthy();
      expect(String(en.errors[code]), `EN errors value for ${code} no diacritics`).not.toMatch(
        DIACRITICS
      );
    }
  });
});
