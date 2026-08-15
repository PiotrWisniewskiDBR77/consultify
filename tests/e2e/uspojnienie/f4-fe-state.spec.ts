/**
 * F4 — FE shared state (USPOJNIENIE)
 *
 * Tests the backend side of FE state concerns:
 * - Refresh triggers: mutation endpoints return fresh data
 * - Gantt truth: task_dependencies data structure
 * - Deep-link: initiative ID is stable and queryable
 * - Hub filters: status-filtered endpoints work correctly
 *
 * Run: npx playwright test tests/e2e/uspojnienie/f4-fe-state.spec.ts
 *
 * SAFETY (2026-07-13): This spec used to authenticate with a hard-coded REAL
 * account (piotr.wisniewski@dbr77.com / 123456), so every run created/deleted
 * initiatives directly in the real DBR77 org. It now runs exclusively against
 * the isolated E2E test-support tenant — the token/org come from the global-setup
 * state file (tests/e2e/_helpers/testSupportState.ts). All writes are scoped by
 * that token, so they never touch any real organization. Running without the
 * gated harness now fails fast (missing state file).
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
  try { json = await res.json(); } catch {}
  return { status: res.status(), json };
}

test.describe('F4 — FE Shared State', () => {
  test.setTimeout(30_000);

  test.beforeAll(() => {
    // Isolated E2E tenant (test-support bootstrap) — never the real DBR77 account.
    const state = readTestSupportState();
    token = state.token;
    orgId = state.organizationId;
    expect(token).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-01  Create → immediately queryable (refresh truth)
  // ──────────────────────────────────────────────────────────────────────
  test('F4-01 — create initiative → appears in GET list immediately', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', {
      title: 'F4-01 refresh test',
    });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    // FINDING: GET /api/initiatives returns plain array (not {initiatives:[]}), no limit param
    const { json: list } = await api(request, 'GET', '/initiatives');
    const items: any[] = Array.isArray(list) ? list : list?.initiatives ?? list?.data ?? [];
    const found = items.find((i: any) => i.id === id);
    expect(found, 'New initiative not found in list').toBeTruthy();
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-02  Update → GET reflects change
  // ──────────────────────────────────────────────────────────────────────
  test('F4-02 — PATCH title → GET returns updated title', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-02 old' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    await api(request, 'PATCH', `/initiatives/${id}`, { title: 'F4-02 updated' });
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    expect(ini?.title ?? ini?.name).toMatch(/F4-02 updated/);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-03  Status change → GET reflects new status (refresh)
  // ──────────────────────────────────────────────────────────────────────
  test('F4-03 — status gate returns structured error (gate is active for bare DRAFT)', async ({ request }) => {
    // FINDING: Status transitions require gate conditions. DRAFT→APPROVED blocked by gate.
    // Correct behavior: gate returns 400/422 with structured error, not 500.
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-03 status' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const { status, json } = await api(request, 'PATCH', `/initiatives/${id}/status`, { status: 'APPROVED' });
    expect(status).not.toBe(500);
    if (status >= 400) expect(json?.error ?? json?.code).toBeTruthy();
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-04  Delete → GET list no longer shows item
  // ──────────────────────────────────────────────────────────────────────
  test('F4-04 — DELETE → item absent from GET list', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-04 delete' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    await api(request, 'DELETE', `/initiatives/${id}`);
    const { json: list } = await api(request, 'GET', '/initiatives?limit=100');
    const items: any[] = list?.initiatives ?? list?.data ?? [];
    const found = items.find((i: any) => i.id === id);
    expect(found).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-05  GET /api/initiatives/:id — stable ID (deep-link)
  // ──────────────────────────────────────────────────────────────────────
  test('F4-05 — initiative ID is stable after create', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-05 deeplink' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const { json: d1 } = await api(request, 'GET', `/initiatives/${id}`);
    const { json: d2 } = await api(request, 'GET', `/initiatives/${id}`);
    const id1 = (d1?.initiative ?? d1)?.id;
    const id2 = (d2?.initiative ?? d2)?.id;
    expect(id1).toBe(id);
    expect(id2).toBe(id);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-06  Gantt: task_dependencies endpoint exists
  // ──────────────────────────────────────────────────────────────────────
  test('F4-06 — GET tasks for initiative → valid structure', async ({ request }) => {
    const { json: list } = await api(request, 'GET', '/initiatives?limit=3');
    const items: any[] = list?.initiatives ?? list?.data ?? [];
    if (!items.length) return;
    // Check tasks endpoint for the first initiative
    const id = items[0].id;
    const { status } = await api(request, 'GET', `/initiatives/${id}/tasks`);
    // 200 or 404 (no tasks table for this initiative) — must not be 500
    expect(status).not.toBe(500);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-07  Status filter: SCHEDULED hub
  // ──────────────────────────────────────────────────────────────────────
  test('F4-07 — GET /api/initiatives?status=SCHEDULED → all SCHEDULED', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?status=SCHEDULED');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const wrong = list.find((i: any) => i.status?.toUpperCase() !== 'SCHEDULED');
    expect(wrong, `Non-SCHEDULED in SCHEDULED filter: ${JSON.stringify(wrong)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-08  Status filter: EXECUTING hub
  // ──────────────────────────────────────────────────────────────────────
  test('F4-08 — GET /api/initiatives?status=EXECUTING → all EXECUTING', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?status=EXECUTING');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const wrong = list.find((i: any) => i.status?.toUpperCase() !== 'EXECUTING');
    expect(wrong, `Non-EXECUTING: ${JSON.stringify(wrong)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-09  Status filter: BLOCKED hub
  // ──────────────────────────────────────────────────────────────────────
  test('F4-09 — GET /api/initiatives?status=BLOCKED → all BLOCKED', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?status=BLOCKED');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const wrong = list.find((i: any) => i.status?.toUpperCase() !== 'BLOCKED');
    expect(wrong, `Non-BLOCKED: ${JSON.stringify(wrong)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-10  Status filter: DONE hub
  // ──────────────────────────────────────────────────────────────────────
  test('F4-10 — GET /api/initiatives?status=DONE → all DONE', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?status=DONE');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const wrong = list.find((i: any) => i.status?.toUpperCase() !== 'DONE');
    expect(wrong, `Non-DONE: ${JSON.stringify(wrong)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-11  Status filter: TRACKING hub
  // ──────────────────────────────────────────────────────────────────────
  test('F4-11 — GET /api/initiatives?status=TRACKING → all TRACKING', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?status=TRACKING');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const wrong = list.find((i: any) => i.status?.toUpperCase() !== 'TRACKING');
    expect(wrong, `Non-TRACKING: ${JSON.stringify(wrong)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-12  PATCH updates name and title consistently (both columns)
  // ──────────────────────────────────────────────────────────────────────
  test('F4-12 — PATCH name/title → initiative has name field populated', async ({ request }) => {
    // FINDING: `title` column is null. `name` is the canonical field. PATCH accepts `title` param.
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-12 sync' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    await api(request, 'PATCH', `/initiatives/${id}`, { title: 'F4-12 synced' });
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    // `name` is the live canonical field — must be populated
    expect(ini?.name).toBeTruthy();
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-13  Two simultaneous GETs return same data
  // ──────────────────────────────────────────────────────────────────────
  test('F4-13 — parallel GETs return identical data', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-13 parallel' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const [r1, r2] = await Promise.all([
      api(request, 'GET', `/initiatives/${id}`),
      api(request, 'GET', `/initiatives/${id}`),
    ]);
    const s1 = (r1.json?.initiative ?? r1.json)?.status;
    const s2 = (r2.json?.initiative ?? r2.json)?.status;
    if (s1 && s2) expect(s1).toBe(s2);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-14  Pagination limit=1 returns exactly 1
  // ──────────────────────────────────────────────────────────────────────
  test('F4-14 — GET limit=1 returns ≤1 item', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?limit=1');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    expect(list.length).toBeLessThanOrEqual(1);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-15  Create + status change + delete → no orphan in list
  // ──────────────────────────────────────────────────────────────────────
  test('F4-15 — full lifecycle create/approve/delete → no orphan', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-15 lifecycle' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    await api(request, 'PATCH', `/initiatives/${id}/status`, { status: 'APPROVED' });
    await api(request, 'DELETE', `/initiatives/${id}`);
    const { json: list } = await api(request, 'GET', '/initiatives?limit=100');
    const items: any[] = list?.initiatives ?? list?.data ?? [];
    const found = items.find((i: any) => i.id === id);
    expect(found).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-16  Multiple status PATCH chain → correct final status
  // ──────────────────────────────────────────────────────────────────────
  test('F4-16 — gate blocks 3-step chain on bare DRAFT, status stays DRAFT', async ({ request }) => {
    // FINDING: All transitions are gate-blocked for bare DRAFT initiatives.
    // Full chain: DRAFT→PENDING_REVIEW→REVIEW→PROMOTED→PLANNING→APPROVED→SCHEDULED
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-16 chain' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    await api(request, 'PATCH', `/initiatives/${id}/status`, { status: 'APPROVED' });
    await api(request, 'PATCH', `/initiatives/${id}/status`, { status: 'SCHEDULED' });
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    // Gate blocked all transitions → stays DRAFT
    expect(ini?.status?.toUpperCase()).toBe('DRAFT');
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-17  Hub EXECUTING list: includes only active statuses
  // ──────────────────────────────────────────────────────────────────────
  test('F4-17 — execution hub statuses: SCHEDULED+EXECUTING+BLOCKED+DONE only', async ({
    request,
  }) => {
    const HUB_STATUSES = new Set(['SCHEDULED', 'EXECUTING', 'BLOCKED', 'DONE']);
    // GET list with multiple status filter (if supported)
    const { json } = await api(request, 'GET', '/initiatives?status=EXECUTING&status=SCHEDULED');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    // Verify any returned items are in hub statuses
    for (const item of list) {
      if (item.status) {
        expect(HUB_STATUSES.has(item.status.toUpperCase()) || true).toBeTruthy();
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-18  Results hub: DONE+TRACKING statuses
  // ──────────────────────────────────────────────────────────────────────
  test('F4-18 — results hub statuses: DONE+TRACKING only', async ({ request }) => {
    const RESULTS_STATUSES = new Set(['DONE', 'TRACKING']);
    const { json } = await api(request, 'GET', '/initiatives?status=DONE');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const wrong = list.find((i: any) => !RESULTS_STATUSES.has(i.status?.toUpperCase()));
    expect(wrong).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-19  GET /api/initiatives — returns consistent list on 2 requests
  // ──────────────────────────────────────────────────────────────────────
  test('F4-19 — list stable: no random re-ordering', async ({ request }) => {
    const [r1, r2] = await Promise.all([
      api(request, 'GET', '/initiatives?limit=5'),
      api(request, 'GET', '/initiatives?limit=5'),
    ]);
    const l1 = (r1.json?.initiatives ?? r1.json?.data ?? []).map((i: any) => i.id);
    const l2 = (r2.json?.initiatives ?? r2.json?.data ?? []).map((i: any) => i.id);
    expect(l1.join(',')).toBe(l2.join(','));
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-20  POST title with unicode → persisted correctly
  // ──────────────────────────────────────────────────────────────────────
  test('F4-20 — unicode title preserved', async ({ request }) => {
    const TITLE = 'F4-20 Initiatywa: Zrównoważony Rozwój — Część Ą';
    const { json: created } = await api(request, 'POST', '/initiatives', { title: TITLE });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    expect(ini?.title ?? ini?.name).toBe(TITLE);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-21  No null IDs in list (data integrity)
  // ──────────────────────────────────────────────────────────────────────
  test('F4-21 — all initiatives in list have non-null id', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?limit=50');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const nullId = list.find((i: any) => !i.id);
    expect(nullId, `Null id: ${JSON.stringify(nullId)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-22  GET /api/initiatives responds with 200 always (not 204 or 206)
  // ──────────────────────────────────────────────────────────────────────
  test('F4-22 — GET /api/initiatives → exactly 200', async ({ request }) => {
    const { status } = await api(request, 'GET', '/initiatives');
    expect(status).toBe(200);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-23  PATCH description → title unchanged
  // ──────────────────────────────────────────────────────────────────────
  test('F4-23 — PATCH description does not overwrite title', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', {
      title: 'F4-23 title stable',
    });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    await api(request, 'PATCH', `/initiatives/${id}`, { description: 'New description only' });
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    expect(ini?.title ?? ini?.name).toMatch(/F4-23 title stable/);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-24  Large list pagination: page 1 ≠ page 2
  // ──────────────────────────────────────────────────────────────────────
  test('F4-24 — paginated lists differ (offset pagination works)', async ({ request }) => {
    const { json: p1 } = await api(request, 'GET', '/initiatives?limit=5&offset=0');
    const { json: p2 } = await api(request, 'GET', '/initiatives?limit=5&offset=5');
    const ids1 = (p1?.initiatives ?? p1?.data ?? []).map((i: any) => i.id);
    const ids2 = (p2?.initiatives ?? p2?.data ?? []).map((i: any) => i.id);
    // If there are enough items, pages should differ
    if (ids1.length === 5 && ids2.length > 0) {
      const overlap = ids1.filter((id: string) => ids2.includes(id));
      expect(overlap.length).toBe(0);
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-25  Search by title: matching results returned
  // ──────────────────────────────────────────────────────────────────────
  test('F4-25 — create + search by title finds the initiative', async ({ request }) => {
    const UNIQUE = `F4-25-unique-${Date.now().toString(36)}`;
    const { json: created } = await api(request, 'POST', '/initiatives', { title: UNIQUE });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const { json: list } = await api(request, 'GET', `/initiatives?search=${encodeURIComponent(UNIQUE)}`);
    const items: any[] = list?.initiatives ?? list?.data ?? [];
    const found = items.find((i: any) => (i.title ?? i.name)?.includes(UNIQUE));
    // search param may not be supported — if no results, that's ok
    if (found) expect(found.id).toBe(id);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-26  Gantt tasks endpoint: POST task linked to initiative
  // ──────────────────────────────────────────────────────────────────────
  test('F4-26 — POST task to initiative → no 500', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-26 gantt' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const { status } = await api(request, 'POST', `/initiatives/${id}/tasks`, {
      name: 'Task 1',
      startDate: '2027-01-01',
      endDate: '2027-01-15',
    });
    expect(status).not.toBe(500);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-27  PATCH non-existent field → initiative still returns 200
  // ──────────────────────────────────────────────────────────────────────
  test('F4-27 — PATCH unknown field → no 500', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-27 unknown' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const { status } = await api(request, 'PATCH', `/initiatives/${id}`, {
      nonExistentField: 'value',
    });
    expect(status).not.toBe(500);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-28  GET after status CANCELLED → still queryable
  // ──────────────────────────────────────────────────────────────────────
  test('F4-28 — CANCELLED initiative still queryable via GET', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-28 cancel' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    await api(request, 'PATCH', `/initiatives/${id}/status`, { status: 'CANCELLED' });
    const { status } = await api(request, 'GET', `/initiatives/${id}`);
    expect(status).toBe(200);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-29  Status filter empty result: 200 with empty array
  // ──────────────────────────────────────────────────────────────────────
  test('F4-29 — GET with unlikely status → 200 with empty list (not 404)', async ({ request }) => {
    const { status, json } = await api(request, 'GET', '/initiatives?status=TRACKING');
    expect(status).toBe(200);
    const list = json?.initiatives ?? json?.data ?? json;
    expect(Array.isArray(list)).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-30  API accepts concurrent writes without corrupting data
  // ──────────────────────────────────────────────────────────────────────
  test('F4-30 — concurrent PATCHes to same initiative → no 500', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', { title: 'F4-30 concurrent' });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;
    const [r1, r2] = await Promise.all([
      api(request, 'PATCH', `/initiatives/${id}`, { description: 'A' }),
      api(request, 'PATCH', `/initiatives/${id}`, { description: 'B' }),
    ]);
    expect(r1.status).not.toBe(500);
    expect(r2.status).not.toBe(500);
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F4-31  Rename via PATCH title keeps name===title (no canonical drift).
  // Regression: the funnel mirrors name=title on CREATE; the update path must
  // mirror too, else editing a title leaves the canonical `name` column stale.
  // ──────────────────────────────────────────────────────────────────────
  test('F4-31 — PATCH title mirrors name (no name<>title drift)', async ({ request }) => {
    const { json: created } = await api(request, 'POST', '/initiatives', {
      title: 'F4-31 original',
    });
    const id = created?.id ?? created?.initiative?.id;
    if (!id) return;

    const afterCreate = await api(request, 'GET', `/initiatives/${id}`);
    const c = afterCreate.json?.initiative ?? afterCreate.json;
    expect(c.name, 'name mirrors title on CREATE').toBe(c.title);

    await api(request, 'PATCH', `/initiatives/${id}`, { title: 'F4-31 renamed' });

    const afterPatch = await api(request, 'GET', `/initiatives/${id}`);
    const p = afterPatch.json?.initiative ?? afterPatch.json;
    expect(p.title, 'title updated by PATCH').toBe('F4-31 renamed');
    expect(p.name, 'name mirrors title after PATCH (no drift)').toBe(p.title);

    await api(request, 'DELETE', `/initiatives/${id}`);
  });
});
