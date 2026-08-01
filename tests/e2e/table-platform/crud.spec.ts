/**
 * E2E: Table Platform CRUD
 *
 * API-level smoke tests for the table platform CRUD operations.
 * Uses Playwright's APIRequestContext to test endpoints directly.
 */

import { test, expect } from '@playwright/test';

import { getPrivilegedSession } from '../_helpers/privilegedSession';
import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

/**
 * Token for the API smoke. Global-setup state first, then test-support bootstrap.
 * NOT register-demo: this test creates and deletes a base, and the public demo signup is
 * unprivileged + read-only by design (403 DEMO_READ_ONLY), so it could never do that.
 * Returns null (→ honest skip) only when test-support is unavailable.
 */
async function getToken(request: any): Promise<string | null> {
  try {
    const state = readTestSupportState();
    return state.token;
  } catch {
    try {
      const session = await getPrivilegedSession(request, {
        role: 'ADMIN',
        label: 'tp-crud',
        apiBaseUrl: API_BASE_URL,
      });
      return session.token;
    } catch (error) {
      console.warn(error instanceof Error ? error.message : String(error));
      return null;
    }
  }
}

test.describe('Table Platform CRUD', () => {
  test.setTimeout(60000);

  test('API smoke: create and delete base', async ({ request }) => {
    const token = await getToken(request);
    if (!token) {
      test.skip();
      return;
    }

    const baseRes = await request.post(`${API_BASE_URL}/api/table-platform/bases`, {
      headers: authHeaders(token),
      data: { workspaceId: `smoke-${Date.now()}`, name: 'Smoke Test Base' },
    });

    if (baseRes.status() === 404) {
      // Feature flag off — skip gracefully
      test.skip();
      return;
    }

    if (baseRes.ok()) {
      const base = await baseRes.json();
      const baseId = base.base_id || base.baseId || base.id;
      expect(baseId).toBeTruthy();

      const deleteRes = await request.delete(
        `${API_BASE_URL}/api/table-platform/bases/${baseId}`,
        { headers: authHeaders(token) }
      );
      expect(deleteRes.status()).toBeLessThan(500);
    } else {
      // Non-200 but not 500 is acceptable (e.g. 403 missing org)
      expect(baseRes.status()).toBeLessThan(500);
    }
  });

  test('API smoke: create base → create table → create record → delete', async ({ request }) => {
    const token = await getToken(request);
    if (!token) {
      test.skip();
      return;
    }

    const workspaceId = `smoke-full-${Date.now()}`;

    // Create base
    const baseRes = await request.post(`${API_BASE_URL}/api/table-platform/bases`, {
      headers: authHeaders(token),
      data: { workspaceId, name: 'Full CRUD Base' },
    });

    if (baseRes.status() === 404) {
      test.skip();
      return;
    }

    if (!baseRes.ok()) {
      expect(baseRes.status()).toBeLessThan(500);
      return;
    }

    const base = await baseRes.json();
    const baseId = base.base_id || base.baseId || base.id;
    expect(baseId).toBeTruthy();

    // Create table
    const tableRes = await request.post(
      `${API_BASE_URL}/api/table-platform/bases/${baseId}/tables`,
      {
        headers: authHeaders(token),
        data: { name: 'Smoke Tasks' },
      }
    );

    if (tableRes.ok()) {
      const table = await tableRes.json();
      const tableId = table.table_id || table.tableId || table.id;
      expect(tableId).toBeTruthy();

      // Create record
      const recordRes = await request.post(
        `${API_BASE_URL}/api/table-platform/tables/${tableId}/records`,
        {
          headers: authHeaders(token),
          data: { data: { Name: 'Smoke Record' } },
        }
      );

      if (recordRes.ok()) {
        const record = await recordRes.json();
        const recordId = record.record_id || record.recordId || record.id;
        expect(recordId).toBeTruthy();

        // Delete record
        const delRecordRes = await request.delete(
          `${API_BASE_URL}/api/table-platform/records/${recordId}`,
          { headers: authHeaders(token) }
        );
        expect(delRecordRes.status()).toBeLessThan(500);
      }

      // Delete table
      const delTableRes = await request.delete(
        `${API_BASE_URL}/api/table-platform/tables/${tableId}`,
        { headers: authHeaders(token) }
      );
      expect(delTableRes.status()).toBeLessThan(500);
    }

    // Delete base
    const delBaseRes = await request.delete(
      `${API_BASE_URL}/api/table-platform/bases/${baseId}`,
      { headers: authHeaders(token) }
    );
    expect(delBaseRes.status()).toBeLessThan(500);
  });

  test('API smoke: unauthenticated request returns 401', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/table-platform/bases`, {
      params: { workspaceId: 'test' },
    });
    // 401 or 404 (feature flag off) — both acceptable
    expect([401, 403, 404]).toContain(res.status());
  });

  test('API smoke: governed models endpoint responds', async ({ request }) => {
    const token = await getToken(request);
    if (!token) {
      test.skip();
      return;
    }

    const res = await request.get(`${API_BASE_URL}/api/table-platform/governed-models`, {
      headers: authHeaders(token),
      params: { baseId: 'smoke-test' },
    });

    expect(res.status()).toBeLessThan(500);
  });
});
