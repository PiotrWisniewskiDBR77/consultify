import { describe, expect, it, vi } from 'vitest';

import {
  previewSignature,
  rotateSubscriptionSecret,
  sendTestDelivery,
  type ServiceOverrides,
} from '../presentationGovernanceAlertSubscriberService.js';

interface SubscriptionRow {
  id: string;
  organization_id: string;
  channel: string;
  target: string;
  min_severity: string;
  active: unknown;
  signing_secret: string | null;
}

function makeRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 'sub_1',
    organization_id: 'org_acme',
    channel: 'webhook',
    target: 'https://hooks.example.com/services/T123/B456/abcdefghijklmnop',
    min_severity: 'BLOCKED_P1',
    active: true,
    signing_secret: 'a'.repeat(64),
    ...overrides,
  };
}

function makeOverrides(
  opts: {
    row?: SubscriptionRow | null;
    fetch?: ServiceOverrides['fetch'];
    onRun?: (sql: string, params: unknown[]) => void;
  } = {}
): ServiceOverrides & { runCalls: Array<{ sql: string; params: unknown[] }> } {
  const runCalls: Array<{ sql: string; params: unknown[] }> = [];
  const dbGet = vi.fn(async () => (opts.row === undefined ? makeRow() : opts.row));
  const dbRun = vi.fn(async (sql: string, params: unknown[] = []) => {
    runCalls.push({ sql, params });
    if (opts.onRun) opts.onRun(sql, params);
    return { success: true, changes: 1 };
  });
  return {
    dbGet: dbGet as unknown as ServiceOverrides['dbGet'],
    dbRun: dbRun as unknown as ServiceOverrides['dbRun'],
    fetch: opts.fetch,
    runCalls,
  };
}

describe('presentationGovernanceAlertSubscriberService - previewSignature', () => {
  it('returns the input verbatim when shorter than 12 chars', () => {
    expect(previewSignature('abc123')).toBe('abc123');
    expect(previewSignature('')).toBe('');
  });

  it('truncates a 64-char hex signature to 12 chars + ellipsis', () => {
    const sig = 'a'.repeat(64);
    const out = previewSignature(sig);
    expect(out).toBe('a'.repeat(12) + '...');
    expect(out.length).toBe(15);
    expect(out).not.toContain(sig.slice(13));
  });
});

describe('rotateSubscriptionSecret', () => {
  it('returns ok with a 64-char hex secret when row exists and is active', async () => {
    const overrides = makeOverrides({ row: makeRow({ active: true }) });

    const result = await rotateSubscriptionSecret(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );

    expect(result.status).toBe('ok');
    expect(result.oneTimeSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(result.subscription).toEqual({
      id: 'sub_1',
      organizationId: 'org_acme',
      channel: 'webhook',
      targetRedacted: expect.any(String),
      minSeverity: 'BLOCKED_P1',
    });
    expect(overrides.runCalls).toHaveLength(1);
    expect(overrides.runCalls[0].sql).toMatch(
      /UPDATE\s+presentation_governance_alert_subscriptions/
    );
    expect(overrides.runCalls[0].sql).toMatch(/signing_secret_rotated_at\s*=\s*CURRENT_TIMESTAMP/);
    // The masked target must NOT echo the full URL path/query.
    expect(result.subscription?.targetRedacted).not.toContain('abcdefghijklmnop');
  });

  it('returns not_found when the DB row does not exist', async () => {
    const overrides = makeOverrides({ row: null });

    const result = await rotateSubscriptionSecret(
      { subscriptionId: 'missing', organizationId: 'org_acme' },
      overrides
    );

    expect(result.status).toBe('not_found');
    expect(result.oneTimeSecret).toBeUndefined();
    expect(overrides.runCalls).toHaveLength(0);
  });

  it('returns inactive (no UPDATE issued) when the subscription is deactivated', async () => {
    const overrides = makeOverrides({ row: makeRow({ active: false }) });

    const result = await rotateSubscriptionSecret(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );

    expect(result.status).toBe('inactive');
    expect(result.oneTimeSecret).toBeUndefined();
    expect(overrides.runCalls).toHaveLength(0);
  });

  it('returns not_found when input is missing required ids', async () => {
    const overrides = makeOverrides();

    const result = await rotateSubscriptionSecret(
      { subscriptionId: '', organizationId: '' },
      overrides
    );

    expect(result.status).toBe('not_found');
    expect(overrides.runCalls).toHaveLength(0);
  });
});

describe('sendTestDelivery', () => {
  it('returns unsigned when subscription has no signing_secret', async () => {
    const overrides = makeOverrides({
      row: makeRow({ signing_secret: null }),
    });

    const result = await sendTestDelivery(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );

    expect(result.status).toBe('unsigned');
    expect(result.attempted).toBe(false);
    expect(result.signed).toBe(false);
    expect(result.payloadPreview?.toVerdict).toBe('BLOCKED_P0');
  });

  it('returns fetch_unavailable when no global fetch and no override fetch', async () => {
    const overrides = makeOverrides({
      row: makeRow(),
      fetch: undefined,
    });
    // Force-shadow the global fetch by passing an explicit `null` override
    // would be ambiguous; instead simulate by deleting the global only when
    // it is not defined in the test runtime.
    const hadFetch = typeof (globalThis as any).fetch === 'function';
    const original = (globalThis as any).fetch;
    if (hadFetch) (globalThis as any).fetch = undefined;

    try {
      const result = await sendTestDelivery(
        { subscriptionId: 'sub_1', organizationId: 'org_acme' },
        overrides
      );
      expect(result.status).toBe('fetch_unavailable');
      expect(result.attempted).toBe(false);
      expect(result.signed).toBe(true);
      expect(result.signaturePreview).toMatch(/^[0-9a-f]{12}\.\.\.$/);
      expect(result.payloadPreview?.eventId).toMatch(/^test_/);
    } finally {
      if (hadFetch) (globalThis as any).fetch = original;
    }
  });

  it('returns ok with httpStatus + signaturePreview on a 200 response', async () => {
    // Declare the parameters so `mock.calls[0]` is the recorded (url, init) pair.
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit & { headers: Record<string, string> }) => ({
        status: 200,
        ok: true,
      })
    );
    const overrides = makeOverrides({
      row: makeRow(),
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await sendTestDelivery(
      {
        subscriptionId: 'sub_1',
        organizationId: 'org_acme',
        syntheticDeckId: 'deck_42',
        syntheticVerdict: 'BLOCKED_P1',
      },
      overrides
    );

    expect(result.status).toBe('ok');
    expect(result.attempted).toBe(true);
    expect(result.signed).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.signaturePreview).toMatch(/^[0-9a-f]{12}\.\.\.$/);
    expect(result.payloadPreview).toEqual({
      eventId: expect.stringMatching(/^test_/),
      toVerdict: 'BLOCKED_P1',
      deckId: 'deck_42',
      generatedAt: expect.any(String),
    });
    expect(typeof result.durationMs).toBe('number');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers['x-consultify-signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(init.headers['x-consultify-signature-algorithm']).toBe('HMAC-SHA256');
    expect(init.headers['x-consultify-event-id']).toMatch(/^test_/);
  });

  it('returns http_error on a non-2xx response and surfaces the http status', async () => {
    const fetchMock = vi.fn(async () => ({ status: 503, ok: false }));
    const overrides = makeOverrides({
      row: makeRow(),
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await sendTestDelivery(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );

    expect(result.status).toBe('http_error');
    expect(result.attempted).toBe(true);
    expect(result.signed).toBe(true);
    expect(result.httpStatus).toBe(503);
    expect(result.errorCategory).toBe('non_2xx_status');
  });

  it('returns network_error when fetch throws', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const overrides = makeOverrides({
      row: makeRow(),
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await sendTestDelivery(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );

    expect(result.status).toBe('network_error');
    expect(result.attempted).toBe(true);
    expect(result.signed).toBe(true);
    expect(result.errorCategory).toBe('fetch_failed');
    expect(typeof result.durationMs).toBe('number');
  });

  it('returns timeout error category when AbortError is thrown', async () => {
    const fetchMock = vi.fn(async () => {
      const err = new Error('aborted');
      (err as any).name = 'AbortError';
      throw err;
    });
    const overrides = makeOverrides({
      row: makeRow(),
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await sendTestDelivery(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );

    expect(result.status).toBe('network_error');
    expect(result.errorCategory).toBe('timeout');
  });

  it('returns not_found when row does not exist', async () => {
    const overrides = makeOverrides({ row: null });

    const result = await sendTestDelivery(
      { subscriptionId: 'missing', organizationId: 'org_acme' },
      overrides
    );

    expect(result.status).toBe('not_found');
    expect(result.attempted).toBe(false);
    expect(result.signed).toBe(false);
  });

  it('returns inactive when subscription is deactivated, never fires fetch', async () => {
    const fetchMock = vi.fn();
    const overrides = makeOverrides({
      row: makeRow({ active: false }),
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await sendTestDelivery(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );

    expect(result.status).toBe('inactive');
    expect(result.attempted).toBe(false);
    expect(result.signed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
