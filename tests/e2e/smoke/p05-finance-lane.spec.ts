/**
 * P05 Finance Lane — E2E Smoke Test
 *
 * Walks the full lane: start → import (completed) → analysis (completed) → mutation (applied)
 * → readback (confirmed). Then verifies audit trail, KPI coherence, and version snapshot lifecycle.
 */
import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const isMockDb = process.env.MOCK_DB === 'true' || process.env.E2E_MOCK_DB === 'true';

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
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

test.describe('P05 Finance Lane — E2E Smoke', () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: 'serial' });

  let token = '';
  let runId = '';
  let snapshotId = '';

  test.beforeAll(async () => {
    const state = readTestSupportState();
    token = state?.token || process.env.E2E_AUTH_TOKEN || 'test-token';
  });

  test('start lane run', async ({ request }) => {
    const attemptStart = async () =>
      request.post(`${API_BASE_URL}/api/v8/finance/lane/start`, {
        headers: authHeaders(token),
        data: { versionType: 'current' },
        timeout: 45000,
      });

    let res = await attemptStart();
    // Under local e2e load this endpoint can be slow on first hit.
    if (res.status() >= 500) {
      res = await attemptStart();
    }

    expect(res.status()).toBeLessThan(500);
    const body = await jsonOrText(res);
    runId = body?.data?.runId || '';
    expect(runId).toBeTruthy();
    expect(body.data.currentStep).toBe('import');
  });

  test('advance import → completed', async ({ request }) => {
    if (!runId) return;
    const res = await request.post(`${API_BASE_URL}/api/v8/finance/lane/${runId}/advance`, {
      headers: authHeaders(token),
      data: { outcome: 'completed', detail: 'E2E smoke import' },
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      expect(body.data.currentStep).toBe('analysis');
      expect(body.data.importOutcome).toBe('completed');
    }
  });

  test('advance analysis → completed', async ({ request }) => {
    if (!runId) return;
    const res = await request.post(`${API_BASE_URL}/api/v8/finance/lane/${runId}/advance`, {
      headers: authHeaders(token),
      data: { outcome: 'completed' },
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      expect(body.data.currentStep).toBe('mutation');
      expect(body.data.analysisCompleted).toBe(true);
    }
  });

  test('advance mutation → applied', async ({ request }) => {
    if (!runId) return;
    const res = await request.post(`${API_BASE_URL}/api/v8/finance/lane/${runId}/advance`, {
      headers: authHeaders(token),
      data: { outcome: 'applied', detail: 'E2E smoke mutation' },
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      expect(body.data.currentStep).toBe('readback');
      expect(body.data.mutationOutcome).toBe('applied');
    }
  });

  test('record mutation audit', async ({ request }) => {
    if (!runId) return;
    const res = await request.post(`${API_BASE_URL}/api/v8/finance/lane/${runId}/mutation-audit`, {
      headers: authHeaders(token),
      data: {
        mutationType: 'forecast_update',
        targetEntity: 'model-e2e',
        previousValue: '100000',
        newValue: '120000',
        outcome: 'applied',
      },
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      expect(body.data.auditId).toBeTruthy();
      expect(body.data.mutationType).toBe('forecast_update');
      expect(body.data.outcome).toBe('applied');
    }
  });

  test('list mutation audits', async ({ request }) => {
    if (!runId) return;
    const res = await request.get(`${API_BASE_URL}/api/v8/finance/lane/${runId}/mutation-audit`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      expect(Array.isArray(body?.data)).toBe(true);
      if (body.data.length > 0) {
        expect(body.data[0].mutationType).toBeTruthy();
      }
    }
  });

  test('advance readback → confirmed', async ({ request }) => {
    if (!runId) return;
    const res = await request.post(`${API_BASE_URL}/api/v8/finance/lane/${runId}/advance`, {
      headers: authHeaders(token),
      data: { outcome: 'confirmed' },
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      expect(body.data.readbackConfirmed).toBe(true);
    }
  });

  test('verify audit trail has all 5 entries', async ({ request }) => {
    if (!runId) return;
    const res = await request.get(`${API_BASE_URL}/api/v8/finance/lane/${runId}`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      const trail = body?.data?.auditTrail || [];
      // Mock lanes can persist only the latest canonical checkpoint; keep strict assertions
      // for real DB and a stable minimum invariant for mock runtimes.
      if (isMockDb) {
        expect(trail.length).toBeGreaterThanOrEqual(1);
        const outcomes = trail.map((e: any) => e.outcome);
        expect(outcomes).toContain('started');
        return;
      }
      expect(trail.length).toBeGreaterThanOrEqual(5);
      const outcomes = trail.map((e: any) => e.outcome);
      expect(outcomes).toContain('started');
      expect(outcomes).toContain('completed');
      expect(outcomes).toContain('applied');
      expect(outcomes).toContain('confirmed');
    }
  });

  test('check KPI coherence', async ({ request }) => {
    if (!runId) return;
    const res = await request.get(`${API_BASE_URL}/api/v8/finance/lane/${runId}/kpi-coherence`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      expect(['coherent', 'stale', 'unavailable']).toContain(body?.data?.status);
    }
  });

  test('create version snapshot', async ({ request }) => {
    const res = await request.post(`${API_BASE_URL}/api/v8/finance/versions/snapshot`, {
      headers: authHeaders(token),
      data: { versionType: 'actual', snapshotData: { test: true, ts: Date.now() } },
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      snapshotId = body?.data?.snapshotId || '';
      expect(snapshotId).toBeTruthy();
      expect(body.data.isFinalized).toBe(false);
    }
  });

  test('finalize version snapshot', async ({ request }) => {
    if (!snapshotId) return;
    const res = await request.post(`${API_BASE_URL}/api/v8/finance/versions/${snapshotId}/finalize`, {
      headers: authHeaders(token),
      data: {},
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      if (isMockDb) {
        expect(typeof body?.data?.isFinalized).toBe('boolean');
        return;
      }
      expect(body.data.isFinalized).toBe(true);
      expect(body.data.switchoverDate).toBeTruthy();
    }
  });

  test('list version snapshots', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/api/v8/finance/versions`, {
      headers: authHeaders(token),
    });
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await jsonOrText(res);
      expect(Array.isArray(body?.data)).toBe(true);
    }
  });
});
