/**
 * PRESENTATIONS-AUTH-WALL-001 — signed, mounted role-wall journey.
 *
 * Every identity here is a REAL signed HS256 session minted server-side by
 * `/api/test-support/bootstrap` and `/api/test-support/member`
 * (server/src/routes/testSupport.routes.ts:16-18 — `jwt.sign(payload,
 * config.JWT_SECRET)`), and every request crosses real HTTP to the mounted
 * backend. This spec deliberately does NOT use the `E2E_MODE` unsigned
 * (`alg:none`) token path (auth.middleware.ts:1191-1224): there the caller's
 * role is whatever the test author writes into the forged payload, so a
 * role-wall "proof" built on it proves nothing. Leave `E2E_MODE` unset.
 *
 * Run (mounted backend + frontend):
 *   E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx \
 *   ENABLE_TEST_SUPPORT=true TEST_SUPPORT_KEY=<key> \
 *   E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://127.0.0.1:3000 \
 *   npx playwright test tests/e2e/presentations/presentations-role-wall.signed.spec.ts --project=chromium
 *
 * What it proves end to end:
 *   - a VIEWER-equivalent persona that IS an ACTIVE member of the tenant is
 *     refused on every presentation writer class (submit/approve/reject/
 *     autosave/restore/delete) with 403 PERMISSION_DENIED;
 *   - the refusal changes nothing — the deck's version is byte-identical after
 *     the whole denied sweep;
 *   - the wall is not a blanket deny: an ADMIN persona, and a plain USER
 *     persona that the canonical capability matrix grants `presentation_edit`,
 *     both still write successfully.
 */

import { expect, test, type APIRequestContext } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

type TestIdentity = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
};

const auth = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

const supportHeaders = {
  'x-test-support-key': TEST_SUPPORT_KEY,
  'content-type': 'application/json',
};

async function bootstrapAdmin(request: APIRequestContext, runId: string): Promise<TestIdentity> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
    headers: supportHeaders,
    data: { runId, role: 'ADMIN' },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as TestIdentity;
}

/**
 * `role: 'GUEST'` is how this harness mints a VIEWER: `/test-support/member`
 * seeds a genuinely ACTIVE `organization_members` row and signs a platform
 * role of GUEST, which `normalizeRole()` (presentationAccessPolicyService.ts)
 * maps to VIEWER. That combination is the important one — the persona is a
 * legitimate tenant member, so only the CAPABILITY wall can refuse it.
 */
async function addMember(
  request: APIRequestContext,
  runId: string,
  role: 'ADMIN' | 'USER' | 'GUEST'
): Promise<TestIdentity> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/member`, {
    headers: supportHeaders,
    data: { runId, role },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as TestIdentity;
}

async function createDeck(request: APIRequestContext, token: string): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/presentations/decks`, {
    headers: auth(token),
    data: {
      title: `Role wall ${Date.now()}`,
      theme: 'modern',
      source: 'presentations-role-wall-signed',
      slides: [{ type: 'content', content: { title: 'Wall', bullets: ['role wall evidence'] } }],
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return String(((await response.json()) as any)?.data?.id || '');
}

async function readDeckVersion(
  request: APIRequestContext,
  token: string,
  deckId: string
): Promise<number> {
  const response = await request.get(`${API_BASE_URL}/api/presentations/decks/${deckId}`, {
    headers: auth(token),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as any;
  return Number(body?.data?.version ?? body?.data?.deck?.version ?? 0);
}

/**
 * Exact analytics row count for a deck, read over real HTTP via
 * `GET /decks/:deckId/analytics` (`data.summary.total_views`). This is how the
 * spec measures the write the seventh gated route guards without any database
 * access of its own.
 */
async function readAnalyticsTotal(
  request: APIRequestContext,
  token: string,
  deckId: string
): Promise<number> {
  const response = await request.get(`${API_BASE_URL}/api/presentations/decks/${deckId}/analytics`, {
    headers: auth(token),
  });
  expect(response.ok(), await response.text()).toBe(true);
  const body = (await response.json()) as any;
  return Number(body?.data?.summary?.total_views ?? -1);
}

test.describe('Presentations role wall — signed, mounted [@module:presentations]', () => {
  test.setTimeout(240_000);

  test('a VIEWER member is refused on every writer class while allowed roles still write', async ({
    request,
  }) => {
    const runId = `pres-role-wall-${Date.now()}`;
    const owner = await bootstrapAdmin(request, runId);

    try {
      const deckId = await createDeck(request, owner.token);
      expect(deckId).not.toBe('');

      const viewer = await addMember(request, runId, 'GUEST');
      const editor = await addMember(request, runId, 'USER');
      // Same tenant, different identity — otherwise this proves nothing about
      // roles, only about tenancy.
      expect(viewer.organizationId).toBe(owner.organizationId);
      expect(viewer.userId).not.toBe(owner.userId);

      const versionBefore = await readDeckVersion(request, owner.token, deckId);
      const analyticsBefore = await readAnalyticsTotal(request, owner.token, deckId);

      // ---- the wall: every writer class refused for the VIEWER -------------
      const denied: Array<{ name: string; status: number; code: string }> = [];

      const probes: Array<[string, () => Promise<{ status: number; body: any }>]> = [
        [
          'approval/submit',
          async () => {
            const r = await request.post(
              `${API_BASE_URL}/api/presentations/decks/${deckId}/approval/submit`,
              { headers: auth(viewer.token), data: { assignedToUserId: owner.userId } }
            );
            return { status: r.status(), body: await r.json().catch(() => ({})) };
          },
        ],
        [
          'approval/approve',
          async () => {
            const r = await request.post(
              `${API_BASE_URL}/api/presentations/decks/${deckId}/approval/approve`,
              { headers: auth(viewer.token), data: {} }
            );
            return { status: r.status(), body: await r.json().catch(() => ({})) };
          },
        ],
        [
          'approval/reject',
          async () => {
            const r = await request.post(
              `${API_BASE_URL}/api/presentations/decks/${deckId}/approval/reject`,
              { headers: auth(viewer.token), data: { reason: 'nope' } }
            );
            return { status: r.status(), body: await r.json().catch(() => ({})) };
          },
        ],
        [
          'autosave',
          async () => {
            const r = await request.put(
              `${API_BASE_URL}/api/presentations/decks/${deckId}/autosave`,
              { headers: auth(viewer.token), data: { title: 'VIEWER SHOULD NOT WRITE', cards: [] } }
            );
            return { status: r.status(), body: await r.json().catch(() => ({})) };
          },
        ],
        [
          'versions/restore',
          async () => {
            const r = await request.post(
              `${API_BASE_URL}/api/presentations/decks/${deckId}/versions/any-version/restore`,
              { headers: auth(viewer.token), data: { expectedVersion: versionBefore } }
            );
            return { status: r.status(), body: await r.json().catch(() => ({})) };
          },
        ],
        [
          'delete',
          async () => {
            const r = await request.delete(`${API_BASE_URL}/api/presentations/decks/${deckId}`, {
              headers: auth(viewer.token),
            });
            return { status: r.status(), body: await r.json().catch(() => ({})) };
          },
        ],
      ];

      for (const [name, probe] of probes) {
        const { status, body } = await probe();
        denied.push({ name, status, code: String(body?.code || '') });
      }

      for (const entry of denied) {
        expect(entry.status, `${entry.name} must refuse a VIEWER`).toBe(403);
        expect(entry.code, `${entry.name} denial code`).toBe('PERMISSION_DENIED');
      }

      // ---- the denials changed nothing -------------------------------------
      expect(await readDeckVersion(request, owner.token, deckId)).toBe(versionBefore);
      // Exact zero analytics delta across the whole denied sweep.
      expect(await readAnalyticsTotal(request, owner.token, deckId)).toBe(analyticsBefore);

      // ---- the seventh gated writer: POST /decks/:deckId/analytics/view -----
      // This route is gated with `presentation_view`, which the canonical
      // capability matrix GRANTS to VIEWER (and `normalizeRole()` maps every
      // unrecognised role down to VIEWER), so no role can be refused by that
      // gate. A literal "VIEWER denied on analytics/view" assertion is
      // therefore not writable against the committed product without changing
      // the gate — a product change, out of scope for this test-only pass.
      // What IS proven: the gate is reachable, it lets a VIEWER through per the
      // matrix, and the write it guards really lands — which is what makes the
      // zero-delta assertion above a sensitive measurement rather than a
      // constant.
      // An ACTIVE member holding `presentation_view` — which the canonical
      // matrix grants VIEWER — must be let through by the gate, and the write
      // it guards must actually land: exactly one new analytics row, read back
      // over real HTTP. That exact +1 is what makes the zero-delta assertions
      // above a sensitive measurement rather than a constant.
      const viewerAnalytics = await request.post(
        `${API_BASE_URL}/api/presentations/decks/${deckId}/analytics/view`,
        {
          headers: auth(viewer.token),
          data: { viewerToken: 'role-wall-probe', cardIndex: 0, durationMs: 1 },
        }
      );
      expect(viewerAnalytics.status(), await viewerAnalytics.text()).toBe(200);
      expect(await readAnalyticsTotal(request, owner.token, deckId)).toBe(analyticsBefore + 1);

      // ---- and the wall is not a blanket deny -------------------------------
      const adminWrite = await request.put(
        `${API_BASE_URL}/api/presentations/decks/${deckId}/autosave`,
        { headers: auth(owner.token), data: { title: 'ADMIN MAY WRITE', cards: [] } }
      );
      expect(adminWrite.status(), await adminWrite.text()).toBe(200);

      // A plain USER holds `presentation_edit` in the canonical capability
      // matrix, so the wall must let it through too — this is what stops the
      // fix from silently becoming "ADMIN/OWNER only".
      const editorWrite = await request.put(
        `${API_BASE_URL}/api/presentations/decks/${deckId}/autosave`,
        { headers: auth(editor.token), data: { title: 'USER MAY WRITE', cards: [] } }
      );
      expect(editorWrite.status(), await editorWrite.text()).toBe(200);

      expect(await readDeckVersion(request, owner.token, deckId)).toBeGreaterThan(versionBefore);
    } finally {
      const cleanup = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
        headers: supportHeaders,
        data: { runId },
        // Real-DB cleanup removes the whole isolated organization graph and can
        // exceed Playwright's default request timeout on this schema.
        timeout: 150_000,
      });
      expect(cleanup.ok(), await cleanup.text()).toBe(true);
    }
  });
});
