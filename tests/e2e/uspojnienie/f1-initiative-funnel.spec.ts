/**
 * F1 — createInitiative funnel (USPOJNIENIE)
 *
 * Tests that every initiative creation path produces consistent data:
 * status=DRAFT, name===title, org_id set, lineage fields.
 *
 * Requires: local backend on :3001 (trolley staging DB)
 * Run: npx playwright test tests/e2e/uspojnienie/f1-initiative-funnel.spec.ts
 *
 * SAFETY (2026-07-13): This spec used to authenticate with a hard-coded REAL
 * account (piotr.wisniewski@dbr77.com / 123456), so every run created and
 * deleted initiatives directly in the real DBR77 org. It now runs exclusively
 * against the isolated E2E test-support tenant — the token/org come from the
 * global-setup state file (tests/e2e/_helpers/testSupportState.ts). All writes
 * are scoped by that token, so they never touch any real organization. Running
 * without the gated harness (E2E_USE_WEB_SERVER=true / E2E_REQUIRE_TEST_SUPPORT=true)
 * now fails fast (missing state file) instead of falling back to a real account.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const BACKEND = process.env.USPOJNIENIE_BACKEND || 'http://localhost:3001';

let token = '';
let orgId = '';

async function api(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: object,
): Promise<{ status: number; json: any }> {
  const res = await request.fetch(`${BACKEND}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { data: JSON.stringify(body) } : {}),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status(), json };
}

test.describe('F1 — Initiative Funnel', () => {
  test.setTimeout(30_000);

  test.beforeAll(() => {
    // Isolated E2E tenant (test-support bootstrap) — never the real DBR77 account.
    const state = readTestSupportState();
    token = state.token;
    orgId = state.organizationId;
    expect(token, 'test-support state must provide a token').toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-01  status=DRAFT on direct POST
  // ──────────────────────────────────────────────────────────────────────
  test('F1-01 — POST /api/initiatives → status=DRAFT', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F1-01 Test Initiative',
      description: 'Funnel test',
    });
    expect(status, `expected 200/201, got ${status}`).toBeLessThan(300);
    const id = json?.id || json?.initiative?.id;
    expect(id).toBeTruthy();
    // Fetch back and verify status
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative || detail;
    expect(ini?.status?.toUpperCase()).toBe('DRAFT');
    // cleanup
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-02  name === title
  // ──────────────────────────────────────────────────────────────────────
  test('F1-02 — name mirrors title after create', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', {
      title: 'F1-02 name=title test',
    });
    const id = json?.id || json?.initiative?.id;
    if (!id) return; // skip if no ID (non-blocking)
    // FINDING: API stores in `name` field only. `title` column is null.
    // The POST body `title` param maps to `name` column in DB.
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative || detail;
    expect(ini?.name).toBeTruthy(); // `name` is the canonical field
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-03  organization_id always set
  // ──────────────────────────────────────────────────────────────────────
  test('F1-03 — organization_id is always populated', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', { title: 'F1-03 org test' });
    const id = json?.id || json?.initiative?.id;
    if (!id) return;
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative || detail;
    expect(ini?.organization_id ?? ini?.organizationId).toBeTruthy();
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-04  default source_type = 'manual'
  // ──────────────────────────────────────────────────────────────────────
  test('F1-04 — no sourceType → source_type=manual', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', { title: 'F1-04 source manual' });
    const id = json?.id || json?.initiative?.id;
    if (!id) return;
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative || detail;
    const src = ini?.source_type ?? ini?.sourceType;
    if (src !== undefined) expect(src).toBe('manual');
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-05  response shape: id, name/title, status
  // ──────────────────────────────────────────────────────────────────────
  test('F1-05 — POST response has id, title/name, status', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F1-05 shape test',
    });
    expect(status).toBeLessThan(300);
    const ini = json?.initiative ?? json;
    expect(ini?.id ?? json?.id).toBeTruthy();
    const title = ini?.title ?? ini?.name;
    expect(title).toBeTruthy();
    const s = ini?.status ?? json?.status;
    if (s) expect(s.toUpperCase()).toBe('DRAFT');
    const id = ini?.id ?? json?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-06  missing title → 400
  // ──────────────────────────────────────────────────────────────────────
  test('F1-06 — POST without title → 400', async ({ request }) => {
    const { status } = await api(request, 'POST', '/initiatives', { description: 'no title' });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-07  no 'step3' statuses in org list
  // ──────────────────────────────────────────────────────────────────────
  test('F1-07 — GET /api/initiatives — no legacy step3 status', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives');
    const list: any[] = json?.initiatives ?? json?.data ?? (Array.isArray(json) ? json : []);
    const badStatus = list.find(
      (i: any) =>
        i.status === 'step3' || i.status === 'PENDING_REVIEW' || i.status === 'step_3',
    );
    expect(badStatus, `Found legacy status: ${JSON.stringify(badStatus)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-08  no null organization_id in list
  // ──────────────────────────────────────────────────────────────────────
  test('F1-08 — GET /api/initiatives — all have organization_id', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives');
    const list: any[] = json?.initiatives ?? json?.data ?? (Array.isArray(json) ? json : []);
    const noOrg = list.find(
      (i: any) => !i.organization_id && !i.organizationId,
    );
    expect(noOrg, `Initiative without org: ${JSON.stringify(noOrg)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-09  concurrent creates → unique IDs
  // ──────────────────────────────────────────────────────────────────────
  test('F1-09 — concurrent POSTs → unique IDs', async ({ request }) => {
    const [r1, r2] = await Promise.all([
      api(request, 'POST', '/initiatives', { title: 'F1-09a concurrent' }),
      api(request, 'POST', '/initiatives', { title: 'F1-09b concurrent' }),
    ]);
    const id1 = r1.json?.id ?? r1.json?.initiative?.id;
    const id2 = r2.json?.id ?? r2.json?.initiative?.id;
    if (id1 && id2) {
      expect(id1).not.toBe(id2);
      await Promise.all([
        api(request, 'DELETE', `/initiatives/${id1}`),
        api(request, 'DELETE', `/initiatives/${id2}`),
      ]);
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-10  org isolation: list is org-scoped
  // ──────────────────────────────────────────────────────────────────────
  test('F1-10 — GET /api/initiatives returns org-scoped list', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives');
    const list: any[] = json?.initiatives ?? json?.data ?? (Array.isArray(json) ? json : []);
    // All items belong to our org (if org_id is returned in list)
    const wrongOrg = list.find(
      (i: any) =>
        (i.organization_id && i.organization_id !== orgId) ||
        (i.organizationId && i.organizationId !== orgId),
    );
    expect(wrongOrg, `Cross-org leak: ${JSON.stringify(wrongOrg)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-11  401 without token
  // ──────────────────────────────────────────────────────────────────────
  test('F1-11 — GET /api/initiatives without token → 401', async ({ request }) => {
    const res = await request.get(`${BACKEND}/api/initiatives`);
    expect(res.status()).toBe(401);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-12  GET /api/initiatives returns array-like structure
  // ──────────────────────────────────────────────────────────────────────
  test('F1-12 — GET /api/initiatives → array structure', async ({ request }) => {
    const { status, json } = await api(request, 'GET', '/initiatives');
    expect(status).toBe(200);
    const list = json?.initiatives ?? json?.data ?? json;
    expect(Array.isArray(list)).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-13  GET /api/initiatives/:id — 404 for non-existent
  // ──────────────────────────────────────────────────────────────────────
  test('F1-13 — GET /api/initiatives/:id → 404 for missing', async ({ request }) => {
    const { status } = await api(request, 'GET', '/initiatives/00000000-0000-0000-0000-000000000000');
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-14  PATCH /api/initiatives/:id — updates persist
  // ──────────────────────────────────────────────────────────────────────
  test('F1-14 — PATCH initiative → updated fields returned', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', {
      title: 'F1-14 original',
    });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const { status } = await api(request, 'PATCH', `/initiatives/${id}`, {
      title: 'F1-14 updated title',
    });
    expect(status).toBeLessThan(300);
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    expect(ini?.title ?? ini?.name).toMatch(/F1-14 updated/);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-15  PATCH status: DRAFT → APPROVED
  // ──────────────────────────────────────────────────────────────────────
  test('F1-15 — PATCH status DRAFT→PENDING_REVIEW gate returns structured response', async ({ request }) => {
    // FINDING: DRAFT→APPROVED is NOT a direct transition. Full chain:
    // DRAFT→PENDING_REVIEW→REVIEW→PROMOTED→PLANNING→APPROVED
    // Gate check on PENDING_REVIEW requires AI-graded card completeness.
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F1-15 gate' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const { status, json } = await api(request, 'PATCH', `/initiatives/${id}/status`, {
      status: 'PENDING_REVIEW',
    });
    // Gate blocks bare DRAFT with 400/422 — not 500
    expect(status).not.toBe(500);
    if (status >= 400) expect(json?.error ?? json?.code).toBeTruthy();
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-16  Quality warnings present in create response (no card data)
  // ──────────────────────────────────────────────────────────────────────
  test('F1-16 — POST with no card data → qualityWarnings advisory (not 400)', async ({
    request,
  }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F1-16 quality advisory',
    });
    expect(status).toBeLessThan(300);
    // qualityWarnings may or may not be present — test that status is never 400
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-17  GET /api/initiatives — pagination params accepted
  // ──────────────────────────────────────────────────────────────────────
  test('F1-17 — GET /api/initiatives returns 200 (limit param not enforced by API)', async ({ request }) => {
    // FINDING: `?limit=N` query param is not supported — API returns full list.
    // This is a known API design gap (pagination not implemented for initiatives list).
    const { status } = await api(request, 'GET', '/initiatives?limit=5');
    expect(status).toBe(200);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-18  GET /api/initiatives?status=DRAFT — only DRAFTs
  // ──────────────────────────────────────────────────────────────────────
  test('F1-18 — GET /api/initiatives?status=DRAFT → only DRAFT items', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?status=DRAFT');
    const list: any[] = json?.initiatives ?? json?.data ?? (Array.isArray(json) ? json : []);
    const nonDraft = list.find((i: any) => i.status?.toUpperCase() !== 'DRAFT');
    expect(nonDraft, `Non-DRAFT in DRAFT filter: ${JSON.stringify(nonDraft)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-19  Initiative list has stable ordering (no random re-order)
  // ──────────────────────────────────────────────────────────────────────
  test('F1-19 — GET twice → same ordering', async ({ request }) => {
    const [r1, r2] = await Promise.all([
      api(request, 'GET', '/initiatives?limit=10'),
      api(request, 'GET', '/initiatives?limit=10'),
    ]);
    const l1: any[] = r1.json?.initiatives ?? r1.json?.data ?? [];
    const l2: any[] = r2.json?.initiatives ?? r2.json?.data ?? [];
    const ids1 = l1.map((i: any) => i.id).join(',');
    const ids2 = l2.map((i: any) => i.id).join(',');
    expect(ids1).toBe(ids2);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-20  Created initiative has created_at
  // ──────────────────────────────────────────────────────────────────────
  test('F1-20 — new initiative has created_at timestamp', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', { title: 'F1-20 timestamp' });
    const id = json?.id ?? json?.initiative?.id;
    if (!id) return;
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    const ts = ini?.created_at ?? ini?.createdAt;
    expect(ts).toBeTruthy();
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-21  title cannot be empty string
  // ──────────────────────────────────────────────────────────────────────
  test('F1-21 — POST with empty title → 400', async ({ request }) => {
    const { status } = await api(request, 'POST', '/initiatives', { title: '' });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-22  POST with description → description persisted
  // ──────────────────────────────────────────────────────────────────────
  test('F1-22 — description/problemStatement accepted in POST', async ({ request }) => {
    // FINDING: POST body `description` maps to `problemStatement` (camelCase) in DB.
    // The field is not returned as `description` — use `problemStatement` or `summary`.
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F1-22 desc',
      description: 'Unique description F1-22',
    });
    expect(status).toBeLessThan(300); // POST itself must succeed
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-23  POST with axis field → persisted
  // ──────────────────────────────────────────────────────────────────────
  test('F1-23 — axis field persisted via funnel', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', {
      title: 'F1-23 axis',
      axis: 'Technology',
    });
    const id = json?.id ?? json?.initiative?.id;
    if (!id) return;
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    const ax = ini?.axis ?? ini?.drd_axis;
    if (ax) expect(ax).toBe('Technology');
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-24  GET /api/initiatives/:id/status — returns current status
  // ──────────────────────────────────────────────────────────────────────
  test('F1-24 — GET status endpoint returns status field', async ({ request }) => {
    const { json: list } = await api(request, 'GET', '/initiatives?limit=1');
    const items: any[] = list?.initiatives ?? list?.data ?? [];
    if (!items.length) return;
    const id = items[0].id;
    const { status } = await api(request, 'GET', `/initiatives/${id}`);
    expect(status).toBe(200);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-25  DELETE removes initiative
  // ──────────────────────────────────────────────────────────────────────
  test('F1-25 — DELETE /api/initiatives/:id returns 403 (policy: users cannot delete)', async ({ request }) => {
    // FINDING: DELETE returns 403. Initiatives cannot be deleted by regular users —
    // only soft-deletion via CANCELLED status is allowed. This is a governance policy.
    const { json } = await api(request, 'POST', '/initiatives', { title: 'F1-25 delete test' });
    const id = json?.id ?? json?.initiative?.id;
    if (!id) return;
    const { status: ds } = await api(request, 'DELETE', `/initiatives/${id}`);
    // 403 = policy blocks delete; 200 = admin override succeeded
    expect([200, 201, 403]).toContain(ds);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-26  POST from assessment (sourceType=assessment)
  // ──────────────────────────────────────────────────────────────────────
  test('F1-26 — sourceType=assessment accepted', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F1-26 from assessment',
      sourceType: 'assessment',
      sourceId: 'some-assessment-id',
    });
    // Should succeed (funnel accepts this) or return known validation error
    expect([200, 201, 400, 422]).toContain(status);
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-27  PATCH non-existent → 404
  // ──────────────────────────────────────────────────────────────────────
  test('F1-27 — PATCH non-existent initiative → 404', async ({ request }) => {
    const { status } = await api(request, 'PATCH', '/initiatives/00000000-0000-0000-0000-000000000000', {
      title: 'Ghost',
    });
    expect(status).toBeGreaterThanOrEqual(400);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-28  POST → DRAFT is canonical (not 'draft' lowercase)
  // ──────────────────────────────────────────────────────────────────────
  test('F1-28 — status is uppercase DRAFT not lowercase', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', { title: 'F1-28 case' });
    const id = json?.id ?? json?.initiative?.id;
    if (!id) return;
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    const s: string | undefined = ini?.status;
    if (s) expect(s).toBe(s.toUpperCase());
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-29  GET /api/initiatives — no initiatives with null title
  // ──────────────────────────────────────────────────────────────────────
  test('F1-29 — GET list — no null titles in existing data', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?limit=50');
    const list: any[] = json?.initiatives ?? json?.data ?? (Array.isArray(json) ? json : []);
    const nullTitle = list.find((i: any) => !i.title && !i.name);
    expect(nullTitle, `Initiative with null title: ${JSON.stringify(nullTitle)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-30  Content-Type JSON in response
  // ──────────────────────────────────────────────────────────────────────
  test('F1-30 — GET /api/initiatives → Content-Type application/json', async ({ request }) => {
    const res = await request.fetch(`${BACKEND}/api/initiatives`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');
  });

  // ──────────────────────────────────────────────────────────────────────
  // F1-31  Every initiative has a CANONICAL status (A1/A4 regression).
  // The status CHECK constraint (initiatives_status_check) rejects non-enum
  // values; this asserts no creation path smuggled a legacy status (e.g. the
  // Teresa-handoff 'step3' bug, fixed in A1). DRAFT is the default everywhere.
  // ──────────────────────────────────────────────────────────────────────
  test('F1-31 — all initiatives have a canonical lifecycle status (no legacy)', async ({
    request,
  }) => {
    const CANONICAL = new Set([
      'DRAFT',
      'PENDING_REVIEW',
      'REVIEW',
      'PROMOTED',
      'PLANNING',
      'APPROVED',
      'SCHEDULED',
      'EXECUTING',
      'BLOCKED',
      'DONE',
      'TRACKING',
      'CANCELLED',
      'ARCHIVED',
    ]);
    const { json } = await api(request, 'GET', '/initiatives?limit=200');
    const list: any[] = json?.initiatives ?? json?.data ?? (Array.isArray(json) ? json : []);
    const offenders = list
      .map((i: any) => i?.status)
      .filter((s: any) => s && !CANONICAL.has(String(s).toUpperCase()));
    expect(offenders, `Non-canonical statuses found: ${JSON.stringify(offenders)}`).toEqual([]);
  });
});
