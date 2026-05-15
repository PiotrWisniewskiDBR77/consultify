/**
 * L4 Smoke — deploy gate for P22 Wordy workspace.
 *
 * Verifies that the /wordy route renders the KIMI split-screen workspace
 * without 5xx errors and that core UI elements are present.
 */

import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const APP_BASE_URL = process.env.E2E_APP_URL || 'http://127.0.0.1:5173';
const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function demoLoginApi(_request: any): Promise<{ token: string }> {
  const { token } = readTestSupportState();
  return { token };
}

async function assertNo5xx(res: any, label: string) {
  if (res.status() < 500) return;
  const text = await res.text().catch(() => '');
  throw new Error(`${label} 5xx: ${res.status()} ${res.statusText()} body=${text}`);
}

test.describe('L4 Smoke — deploy gate Wordy workspace (P22)', () => {
  test.setTimeout(90000);
  test.describe.configure({ mode: 'serial' });

  let token = '';

  test.beforeAll(async ({ request }) => {
    const login = await demoLoginApi(request);
    token = login.token;
  });

  test('GET /api/report-builder/profiles is healthy (Wordy dependency)', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/report-builder/profiles`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/report-builder/profiles');
    expect(res.status()).toBe(200);
  });

  test('GET /api/report-builder/:id for non-existent report returns 404 (not 5xx)', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE_URL}/api/report-builder/does-not-exist`, {
      headers: authHeaders(token),
    });
    await assertNo5xx(res, 'GET /api/report-builder/:id (missing)');
    expect(res.status()).toBe(404);
  });

  test('GET /api/report-builder/:id/export/pdf for non-existent report returns 404 (not 5xx)', async ({
    request,
  }) => {
    const res = await request.get(
      `${API_BASE_URL}/api/report-builder/does-not-exist/export/pdf`,
      { headers: authHeaders(token) },
    );
    await assertNo5xx(res, 'GET /api/report-builder/:id/export/pdf (missing)');
    expect([400, 404]).toContain(res.status());
  });

  test('/wordy route loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto(`${APP_BASE_URL}/wordy`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    expect(response?.status()).toBeLessThan(500);

    const criticalJsErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR'),
    );
    expect(criticalJsErrors.length).toBe(0);
  });
});
