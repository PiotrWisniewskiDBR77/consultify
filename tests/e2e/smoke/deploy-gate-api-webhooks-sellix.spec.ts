/**
 * L4 Smoke — deploy gate API (webhooks: sellix inbound)
 *
 * Goal: ensure inbound webhook endpoint never 5xx (even when schema/secrets drift).
 * Keep assertions light and deterministic.
 */

import { expect, test } from '@playwright/test';

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

test.describe('L4 Smoke — deploy gate API (webhooks: sellix inbound)', () => {
  test.setTimeout(60000);

  test('POST /api/webhooks/sellix without signature headers returns 400 (no 5xx)', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/api/webhooks/sellix`, {
      headers: { 'content-type': 'application/json' },
      data: { eventId: 'e2e', eventType: 'sellix.test' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/webhooks/sellix invalid JSON returns 400 (no 5xx)', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/webhooks/sellix`, {
      headers: {
        'content-type': 'application/json',
        'x-sellix-signature': 'invalid',
        'x-sellix-timestamp': String(Date.now()),
      },
      data: '{',
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/webhooks/sellix missing eventId returns 400 or 401 (no 5xx)', async ({
    request,
  }) => {
    const res = await request.post(`${API_BASE_URL}/api/webhooks/sellix`, {
      headers: {
        'content-type': 'application/json',
        'x-sellix-signature': 'invalid',
        'x-sellix-timestamp': String(Date.now()),
      },
      data: { eventType: 'sellix.test' },
    });
    expect(res.status()).toBeLessThan(500);
    expect([400, 401]).toContain(res.status());
  });

  test('POST /api/webhooks/sellix valid-looking payload is accepted or rejected (no 5xx)', async ({
    request,
  }) => {
    const eventId = `e2e-${Date.now()}`;
    const res = await request.post(`${API_BASE_URL}/api/webhooks/sellix`, {
      headers: {
        'content-type': 'application/json',
        // If SELLIX_WEBHOOK_SECRET is configured, this invalid signature should cause 401.
        // If not configured, server may accept (best-effort) and return 200.
        'x-sellix-signature': 'invalid',
        'x-sellix-timestamp': String(Date.now()),
        'x-sellix-event': 'sellix.test',
      },
      data: { eventId, eventType: 'sellix.test', organizationId: null, userId: 'system' },
    });

    expect(res.status()).toBeLessThan(500);
    if (res.status() === 200) {
      const body = await jsonOrText(res);
      expect(body).toEqual(expect.objectContaining({ received: true }));
    } else {
      expect([400, 401]).toContain(res.status());
    }
  });
});

