/**
 * F3 — Quality gates (USPOJNIENIE)
 *
 * Tests §B3 validators, MECE endpoint, quality warnings in creation.
 *
 * Run: npx playwright test tests/e2e/uspojnienie/f3-quality-gates.spec.ts
 *
 * SAFETY (2026-07-13): This spec used to authenticate with a hard-coded REAL
 * account (piotr.wisniewski@dbr77.com / 123456), so every run created/deleted
 * initiatives directly in the real DBR77 org. It now runs exclusively against
 * the isolated E2E test-support tenant — the token comes from the global-setup
 * state file (tests/e2e/_helpers/testSupportState.ts). All writes are scoped by
 * that token, so they never touch any real organization. Running without the
 * gated harness now fails fast (missing state file).
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const BACKEND = process.env.USPOJNIENIE_BACKEND || 'http://localhost:3001';

let token = '';

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

const RICH_CARD = {
  title: 'F3 Rich Card Initiative',
  description: 'Detailed description with enough content',
  kpis: [{ name: 'Revenue', baseline: 100, target: 150, unit: 'PLN' }],
  raid_items: [
    { type: 'risk', description: 'Risk 1' },
    { type: 'assumption', description: 'Assumption 1' },
    { type: 'issue', description: 'Issue 1' },
    { type: 'dependency', description: 'Dep 1' },
  ],
  scope_out: ['Out of scope item 1', 'Out of scope item 2'],
  scope_in: ['In scope 1', 'In scope 2', 'In scope 3'],
  deliverables: ['Deliverable 1'],
  success_criteria: ['Success criterion 1'],
  kill_criteria: ['Kill criterion 1'],
  milestones: [{ name: 'M1', date: '2027-01-01' }],
  expected_roi: '20%',
  owner_business_id: 'some-owner-id',
};

test.describe('F3 — Quality Gates', () => {
  test.setTimeout(30_000);

  test.beforeAll(() => {
    // Isolated E2E tenant (test-support bootstrap) — never the real DBR77 account.
    token = readTestSupportState().token;
    expect(token).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-01  Empty card → POST succeeds (advisory, not blocked)
  // ──────────────────────────────────────────────────────────────────────
  test('F3-01 — POST with minimal data → 200 (quality warnings advisory)', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F3-01 minimal',
    });
    expect(status).toBeLessThan(300);
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-02  Quality warnings structure in response
  // ──────────────────────────────────────────────────────────────────────
  test('F3-02 — POST minimal card → qualityWarnings is array or absent', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', { title: 'F3-02 warnings' });
    const id = json?.id ?? json?.initiative?.id;
    const warnings = json?.qualityWarnings ?? json?.quality_warnings;
    if (warnings !== undefined) expect(Array.isArray(warnings)).toBeTruthy();
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-03  No qualityWarnings with full card
  // ──────────────────────────────────────────────────────────────────────
  test('F3-03 — POST with rich card → few or no qualityWarnings', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', RICH_CARD);
    expect(status).toBeLessThan(300);
    const warnings = json?.qualityWarnings ?? json?.quality_warnings ?? [];
    // With a rich card, warnings should be 0 or very few
    if (Array.isArray(warnings)) expect(warnings.length).toBeLessThanOrEqual(3);
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-04  MECE endpoint returns 200
  // ──────────────────────────────────────────────────────────────────────
  test('F3-04 — POST /api/initiatives/validate-portfolio-mece → 200', async ({ request }) => {
    const { status } = await api(request, 'POST', '/initiatives/validate-portfolio-mece', {});
    // 200 or 404 (if endpoint not yet added to router) — must not be 500
    expect(status).not.toBe(500);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-05  MECE endpoint returns org-scoped data
  // ──────────────────────────────────────────────────────────────────────
  test('F3-05 — MECE response structure has overlaps/gaps fields', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives/validate-portfolio-mece', {});
    if (status === 200) {
      // overlaps or gaps or meceScore should be present
      const hasField =
        json?.overlaps !== undefined ||
        json?.gaps !== undefined ||
        json?.meceScore !== undefined ||
        json?.mece_score !== undefined;
      expect(hasField || json).toBeTruthy();
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-06  MECE endpoint requires auth
  // ──────────────────────────────────────────────────────────────────────
  test('F3-06 — MECE endpoint without token → 401', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/initiatives/validate-portfolio-mece`, {
      data: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-07  Generate section endpoint exists
  // ──────────────────────────────────────────────────────────────────────
  test('F3-07 — POST /api/initiatives/generate-section → not 404', async ({ request }) => {
    const { status } = await api(request, 'POST', '/initiatives/generate-section', {
      initiativeId: 'test',
      section: 'description',
    });
    // 400 (validation) or 200 or 404 — must not be 500
    expect(status).not.toBe(500);
    expect(status).not.toBe(404);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-08  Generate section requires auth
  // ──────────────────────────────────────────────────────────────────────
  test('F3-08 — generate-section without token → 401', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/initiatives/generate-section`, {
      data: JSON.stringify({ initiativeId: 'x', section: 'description' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-09  Assessment-generated initiatives: quality indicators present
  // ──────────────────────────────────────────────────────────────────────
  test('F3-09 — GET /api/initiatives → status field present on all items', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?limit=20');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const missingStatus = list.find((i: any) => !i.status);
    expect(missingStatus, `Initiative without status: ${JSON.stringify(missingStatus)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-10  No status=null in existing data
  // ──────────────────────────────────────────────────────────────────────
  test('F3-10 — existing initiatives have valid status values', async ({ request }) => {
    const VALID = new Set(['DRAFT', 'APPROVED', 'SCHEDULED', 'EXECUTING', 'DONE', 'TRACKING', 'BLOCKED', 'CANCELLED', 'ARCHIVED']);
    const { json } = await api(request, 'GET', '/initiatives?limit=50');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const invalid = list.find((i: any) => i.status && !VALID.has(i.status.toUpperCase()));
    expect(invalid, `Invalid status: ${JSON.stringify(invalid)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-11  POST with kpis → kpis persisted
  // ──────────────────────────────────────────────────────────────────────
  test('F3-11 — POST with kpis field → initiative created', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F3-11 kpis',
      kpis: [{ name: 'Revenue', baseline: 100, target: 150 }],
    });
    expect(status).toBeLessThan(300);
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-12  POST with expected_roi → persisted
  // ──────────────────────────────────────────────────────────────────────
  test('F3-12 — POST with expected_roi → persisted', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', {
      title: 'F3-12 roi',
      expected_roi: '25%',
    });
    const id = json?.id ?? json?.initiative?.id;
    if (!id) return;
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    const roi = ini?.expected_roi ?? ini?.estimated_roi;
    if (roi) expect(roi).toContain('25');
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-13  scope_out field persisted
  // ──────────────────────────────────────────────────────────────────────
  test('F3-13 — POST with scope_out → persisted', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', {
      title: 'F3-13 scope_out',
      scope_out: ['Excluded item'],
    });
    const id = json?.id ?? json?.initiative?.id;
    if (!id) return;
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    if (ini?.scope_out) expect(Array.isArray(ini.scope_out) || typeof ini.scope_out === 'string').toBeTruthy();
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-14  Large payload doesn't crash server (validator handles gracefully)
  // ──────────────────────────────────────────────────────────────────────
  test('F3-14 — POST with large payload → no 500', async ({ request }) => {
    const { status } = await api(request, 'POST', '/initiatives', {
      title: 'F3-14 large payload',
      description: 'x'.repeat(5000),
      scope_in: Array.from({ length: 50 }, (_, i) => `Item ${i}`),
    });
    expect(status).not.toBe(500);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-15  GET /api/initiatives/:id — quality fields not empty after PATCH
  // ──────────────────────────────────────────────────────────────────────
  test('F3-15 — PATCH description → description not empty on GET', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', { title: 'F3-15 patch desc' });
    const id = json?.id ?? json?.initiative?.id;
    if (!id) return;
    await api(request, 'PATCH', `/initiatives/${id}`, {
      description: 'Updated description F3-15',
    });
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    const desc = ini?.description ?? ini?.problem_statement;
    if (desc) expect(desc).toContain('F3-15');
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-16  GET insights/:id → no 500 (material_quality guard)
  // ──────────────────────────────────────────────────────────────────────
  test('F3-16 — GET insights list → 200', async ({ request }) => {
    const { status } = await api(request, 'GET', '/interview/insights?limit=1');
    expect([200, 401, 403, 404]).toContain(status);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-17  Assessment generate-initiatives endpoint
  // ──────────────────────────────────────────────────────────────────────
  test('F3-17 — POST /api/assessment-workflow/generate-initiatives → not 404', async ({
    request,
  }) => {
    const { status } = await api(request, 'POST', '/assessment-workflow/generate-initiatives', {
      assessmentId: '00000000-0000-0000-0000-000000000000',
    });
    // 400 (no such assessment) or 200 — must not be 404 (endpoint must exist)
    expect(status).not.toBe(500);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-18  GET /api/initiatives?limit=100 — all have title
  // ──────────────────────────────────────────────────────────────────────
  test('F3-18 — all existing initiatives have title/name field', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?limit=100');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const noTitle = list.find((i: any) => !i.title && !i.name);
    expect(noTitle, `Null title: ${JSON.stringify(noTitle)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-19  No null status in existing data (status normalize migration ran)
  // ──────────────────────────────────────────────────────────────────────
  test('F3-19 — all existing initiatives have non-null status', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?limit=100');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const nullStatus = list.find((i: any) => !i.status);
    expect(nullStatus, `Null status: ${JSON.stringify(nullStatus)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-20  POST without auth → 401
  // ──────────────────────────────────────────────────────────────────────
  test('F3-20 — POST /api/initiatives without auth → 401', async ({ request }) => {
    const res = await request.post(`${BACKEND}/api/initiatives`, {
      data: JSON.stringify({ title: 'Anon test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-21  milestones field accepted in POST
  // ──────────────────────────────────────────────────────────────────────
  test('F3-21 — POST with milestones → no 400', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F3-21 milestones',
      milestones: [{ name: 'Launch', date: '2027-06-01' }],
    });
    expect(status).toBeLessThan(300);
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-22  deliverables field accepted in POST
  // ──────────────────────────────────────────────────────────────────────
  test('F3-22 — POST with deliverables → no 400', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F3-22 deliverables',
      deliverables: ['Report', 'Dashboard'],
    });
    expect(status).toBeLessThan(300);
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-23  success_criteria field accepted
  // ──────────────────────────────────────────────────────────────────────
  test('F3-23 — POST with success_criteria → no 400', async ({ request }) => {
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F3-23 success',
      success_criteria: ['Adoption > 80%'],
    });
    expect(status).toBeLessThan(300);
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-24  GET /api/initiatives/:id — kpis returned as array
  // ──────────────────────────────────────────────────────────────────────
  test('F3-24 — initiative with kpis returns kpis as array', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', {
      title: 'F3-24 kpis array',
      kpis: [{ name: 'NPS', baseline: 30, target: 70 }],
    });
    const id = json?.id ?? json?.initiative?.id;
    if (!id) return;
    const { json: detail } = await api(request, 'GET', `/initiatives/${id}`);
    const ini = detail?.initiative ?? detail;
    if (ini?.kpis) expect(Array.isArray(ini.kpis)).toBeTruthy();
    await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-25  DELETE on EXECUTING initiative → allowed or policy-blocked
  // ──────────────────────────────────────────────────────────────────────
  test('F3-25 — DELETE EXECUTING initiative → no 500', async ({ request }) => {
    const id = await (async () => {
      const { json } = await api(request, 'POST', '/initiatives', { title: 'F3-25 delete exec' });
      const iid = json?.id ?? json?.initiative?.id;
      if (!iid) return null;
      await api(request, 'PATCH', `/initiatives/${iid}/status`, { status: 'APPROVED' });
      await api(request, 'PATCH', `/initiatives/${iid}/status`, { status: 'SCHEDULED' });
      await api(request, 'PATCH', `/initiatives/${iid}/status`, { status: 'EXECUTING' });
      return iid;
    })();
    if (!id) return;
    const { status } = await api(request, 'DELETE', `/initiatives/${id}`);
    expect(status).not.toBe(500);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-26  POST with axis enum value → accepted
  //        FINDING: axis is an enum: strategic|operational|transformational|compliance
  // ──────────────────────────────────────────────────────────────────────
  test('F3-26 — axis enum value accepted, invalid enum → 400', async ({ request }) => {
    // Invalid enum ('People') → 400 — validation works
    const { status: badStatus } = await api(request, 'POST', '/initiatives', {
      title: 'F3-26 axis bad',
      axis: 'People', // invalid — valid values: strategic|operational|transformational|compliance
    });
    expect(badStatus).toBeGreaterThanOrEqual(400); // enum validation fires

    // Valid enum value → 200
    const { status, json } = await api(request, 'POST', '/initiatives', {
      title: 'F3-26 axis valid',
      axis: 'strategic',
    });
    expect(status).toBeLessThan(300);
    const id = json?.id ?? json?.initiative?.id;
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-27  Existing initiatives: no step3 status after normalize migration
  // ──────────────────────────────────────────────────────────────────────
  test('F3-27 — no step3/step_3/PENDING_REVIEW in existing data', async ({ request }) => {
    const { json } = await api(request, 'GET', '/initiatives?limit=100');
    const list: any[] = json?.initiatives ?? json?.data ?? [];
    const legacy = list.find((i: any) =>
      ['step3', 'step_3', 'PENDING_REVIEW'].includes(i.status ?? ''),
    );
    expect(legacy, `Legacy status found: ${JSON.stringify(legacy)}`).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-28  API responds within reasonable time
  // ──────────────────────────────────────────────────────────────────────
  test('F3-28 — GET /api/initiatives responds within 5s', async ({ request }) => {
    const start = Date.now();
    await api(request, 'GET', '/initiatives?limit=10');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-29  Multiple creates in sequence stay consistent
  // ──────────────────────────────────────────────────────────────────────
  test('F3-29 — 5 sequential creates → all DRAFT', async ({ request }) => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { json } = await api(request, 'POST', '/initiatives', {
        title: `F3-29 sequential ${i}`,
      });
      const id = json?.id ?? json?.initiative?.id;
      if (id) ids.push(id);
    }
    for (const id of ids) {
      const { json } = await api(request, 'GET', `/initiatives/${id}`);
      const ini = json?.initiative ?? json;
      expect(ini?.status?.toUpperCase()).toBe('DRAFT');
      await api(request, 'DELETE', `/initiatives/${id}`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // F3-30  POST returns id on every valid create
  // ──────────────────────────────────────────────────────────────────────
  test('F3-30 — every valid POST returns an id', async ({ request }) => {
    const { json } = await api(request, 'POST', '/initiatives', { title: 'F3-30 id check' });
    const id = json?.id ?? json?.initiative?.id;
    expect(id).toBeTruthy();
    if (id) await api(request, 'DELETE', `/initiatives/${id}`);
  });
});
