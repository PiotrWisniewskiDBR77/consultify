/**
 * K5pl-MUTE-8 (Wpis 231/232, mechanism B) — the pinned-insights write failures used to inline a
 * Polish `error:` sentence next to a stable `code:`. Because the code was mute (absent from
 * `apiErrorFallbacks.ts`), the client rendered that Polish sentence verbatim in an English UI.
 *
 * The server now sends ONLY `{ code }` (canonical shape, cf. assessment-hub.routes.ts:496) and the
 * client localizes by code. This supertest mounts the REAL router, forces each write path to 500,
 * and asserts the contract: a stable code, and no Polish diacritics anywhere in the body.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pinInsight = vi.fn();
const updateInsight = vi.fn();
const unpinInsight = vi.fn();

vi.mock('../../../services/ai/pinnedInsightsService.js', () => ({
  pinnedInsightsService: {
    pinInsight,
    updateInsight,
    unpinInsight,
    listInsights: vi.fn(),
  },
}));

// The router does `router.use(verifyToken)`; replace it with a passthrough that supplies the
// authenticated identity the handlers read (userId/organizationId), so we reach the write path.
vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

async function app() {
  const { default: router } = await import('../pinned-insights.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/ai/pinned-insights', router);
  return app;
}

describe('pinned-insights write failures carry a stable code and no Polish (K5pl-MUTE-8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST pin failure → 500 { code: PINNED_INSIGHTS_PIN_FAILED }', async () => {
    pinInsight.mockRejectedValue(new Error('db down — internals must not leak'));
    const res = await request(await app())
      .post('/api/ai/pinned-insights')
      .send({ content: 'key insight' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: 'PINNED_INSIGHTS_PIN_FAILED' });
    expect(JSON.stringify(res.body)).not.toMatch(POLISH_DIACRITICS);
  });

  it('PATCH update failure → 500 { code: PINNED_INSIGHTS_UPDATE_FAILED }', async () => {
    updateInsight.mockRejectedValue(new Error('db down'));
    const res = await request(await app())
      .patch(`/api/ai/pinned-insights/${ID}`)
      .send({ content: 'edited' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: 'PINNED_INSIGHTS_UPDATE_FAILED' });
    expect(JSON.stringify(res.body)).not.toMatch(POLISH_DIACRITICS);
  });

  it('DELETE unpin failure → 500 { code: PINNED_INSIGHTS_UNPIN_FAILED }', async () => {
    unpinInsight.mockRejectedValue(new Error('db down'));
    const res = await request(await app()).delete(`/api/ai/pinned-insights/${ID}`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: 'PINNED_INSIGHTS_UNPIN_FAILED' });
    expect(JSON.stringify(res.body)).not.toMatch(POLISH_DIACRITICS);
  });
});
