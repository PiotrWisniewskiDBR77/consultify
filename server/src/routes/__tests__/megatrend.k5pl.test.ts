/**
 * K5pl-229 (Wpis 231 pkt 3 / Wpis 261, DEC-690) — megatrend.routes.ts.
 *
 * Five 500 handlers (GET /baseline, GET /radar, GET /:id, POST /custom,
 * PUT /custom/:id) each returned a stable `code: MEGATREND_*_FAILED` alongside a
 * redundant Polish `error:` literal. The client localizes the code via
 * apiErrorFallbacks + errors.<CODE>, so the Polish `error:` was dead contract
 * noise and was removed. This suite pins the wire contract (body == { code }, no
 * Polish diacritics) on the REAL router and the i18n parity of every code, so
 * re-introducing a Polish `error:` fails.
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
  baseline: 'MEGATREND_BASELINE_FAILED',
  radar: 'MEGATREND_RADAR_FAILED',
  detail: 'MEGATREND_DETAIL_FAILED',
  create: 'MEGATREND_CUSTOM_CREATE_FAILED',
  update: 'MEGATREND_CUSTOM_UPDATE_FAILED',
} as const;

// Auth guard passthrough with an organizationId so the write handlers' companyId
// guard (401) is satisfied and execution reaches the service call.
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    next();
  },
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../utils/Logger.js', () => ({
  default: { error: () => undefined, info: () => undefined, warn: () => undefined },
}));

// megatrendService truthy (so the handler does NOT short-circuit to 503
// notConfigured) and every method throws a generic Error (no `.code`, so
// respondIfUnavailable returns null and the handler lands in its 500 branch).
const boom = async () => {
  throw new Error('service down');
};
vi.mock('../../services/megatrendService.js', () => ({
  megatrendService: {
    getBaselineTrends: boom,
    getRadarData: boom,
    getTrendDetail: boom,
    createCustomTrend: boom,
    updateCustomTrend: boom,
  },
}));

let app: express.Express;

beforeAll(async () => {
  const router = (await import('../megatrend.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/megatrends', router);
});

async function expect500(res: any, code: string) {
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ code });
  expect(JSON.stringify(res.body)).not.toMatch(DIACRITICS);
}

describe('K5pl-229 megatrend.routes 500 bodies are code-only', () => {
  it('GET /baseline → 500 { code: MEGATREND_BASELINE_FAILED }', async () => {
    await expect500(await request(app).get('/api/megatrends/baseline'), CODES.baseline);
  });

  it('GET /radar → 500 { code: MEGATREND_RADAR_FAILED }', async () => {
    await expect500(await request(app).get('/api/megatrends/radar'), CODES.radar);
  });

  it('GET /:id → 500 { code: MEGATREND_DETAIL_FAILED }', async () => {
    await expect500(await request(app).get('/api/megatrends/trend-1'), CODES.detail);
  });

  it('POST /custom → 500 { code: MEGATREND_CUSTOM_CREATE_FAILED }', async () => {
    await expect500(
      await request(app).post('/api/megatrends/custom').send({ name: 'x' }),
      CODES.create
    );
  });

  it('PUT /custom/:id → 500 { code: MEGATREND_CUSTOM_UPDATE_FAILED }', async () => {
    await expect500(
      await request(app).put('/api/megatrends/custom/trend-1').send({ name: 'x' }),
      CODES.update
    );
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
