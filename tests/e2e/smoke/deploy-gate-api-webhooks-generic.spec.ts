/**
 * L4 Smoke — deploy gate API (webhooks: generic/github/events)
 *
 * Goal: ensure inbound webhook endpoints never 5xx (schema drift-safe).
 */

import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

async function jsonOrText(res: any): Promise<any> {
  const ct = String(res.headers()?.['content-type'] || '');
  if (ct.includes('application/json')) return res.json().catch(() => null);
  const text = await res.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function assertNo5xx(res: any, label: string) {
  if (res.status() < 500) return;
  const body = await jsonOrText(res);
  throw new Error(`${label} failed: ${res.status()} ${res.statusText()} body=${JSON.stringify(body)}`);
}

test.describe('L4 Smoke — deploy gate API (webhooks: generic/github/events)', () => {
  test.setTimeout(60000);

  test('POST /api/webhooks/github accepts payload (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/webhooks/github`, {
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'ping',
        'x-github-delivery': `e2e-${Date.now()}`,
      },
      data: { hello: 'world' },
    });
    await assertNo5xx(res, 'POST /api/webhooks/github');
    const data = await jsonOrText(res);
    expect(data).toEqual(expect.objectContaining({ received: true }));
  });

  test('POST /api/webhooks/:provider accepts payload (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/webhooks/e2e-provider`, {
      headers: { 'content-type': 'application/json' },
      data: { ts: Date.now() },
    });
    await assertNo5xx(res, 'POST /api/webhooks/:provider');
    const data = await jsonOrText(res);
    expect(data).toEqual(expect.objectContaining({ received: true }));
  });

  test('GET /api/webhooks/events is admin-only but must not 5xx', async ({ request }) => {
    const { token } = readTestSupportState();
    const res = await request.get(`${API_BASE_URL}/api/webhooks/events`, { headers: authHeaders(token) });
    await assertNo5xx(res, 'GET /api/webhooks/events');
    if (res.ok()) {
      const data = await jsonOrText(res);
      expect(Array.isArray(data)).toBe(true);
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });
});

