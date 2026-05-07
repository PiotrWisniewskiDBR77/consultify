import { describe, expect, it } from 'vitest';

import {
  type BuildSnapshotDispatchInput,
  type BuildSnapshotInput,
  buildSubscriberDashboardSnapshot,
  generateRawToken,
  hashToken,
  maskDeckId,
  maskTarget,
} from '../presentationSubscriberDashboardService.js';

const FIXED_NOW = '2026-05-07T12:00:00.000Z';
const FIXED_NOW_MS = Date.parse(FIXED_NOW);

function isoOffset(daysAgo: number): string {
  return new Date(FIXED_NOW_MS - daysAgo * 86_400_000).toISOString();
}

function makeDispatch(
  overrides: Partial<BuildSnapshotDispatchInput> = {}
): BuildSnapshotDispatchInput {
  return {
    id: 'd_1',
    dispatchedAt: isoOffset(0),
    status: 'sent',
    httpStatus: 200,
    toVerdict: 'BLOCKED_P0',
    deckId: 'deck_abcdef0123',
    signaturePresent: true,
    signatureAlgorithm: 'HMAC-SHA256',
    ...overrides,
  };
}

function makeInput(overrides: Partial<BuildSnapshotInput> = {}): BuildSnapshotInput {
  return {
    subscription: {
      id: 'sub_1',
      channel: 'webhook',
      target: 'https://hooks.slack.com/services/T123/B456/abcdefghijklmnop',
      minSeverity: 'BLOCKED_P1',
      active: true,
      signingSecretRotatedAt: isoOffset(10),
    },
    dispatches: [],
    nowIso: FIXED_NOW,
    ...overrides,
  };
}

// ============================================================================
// Token primitives
// ============================================================================

describe('generateRawToken', () => {
  it('returns 64 lowercase hex chars', () => {
    const t = generateRawToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(t.length).toBe(64);
  });

  it('produces distinct values on consecutive calls', () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
  });
});

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    const raw = 'a'.repeat(64);
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it('produces a 64-char hex sha256 digest', () => {
    const raw = 'b'.repeat(64);
    const h = hashToken(raw);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    // Known SHA-256("bbbb…") value (Node's crypto round-trip)
    expect(h.length).toBe(64);
  });

  it('handles non-string-like input without throwing', () => {
    // The function coerces to string internally — empty string / null fall
    // back to the sha256 of '' rather than crashing the route.
    expect(() => hashToken('')).not.toThrow();
    expect(() => hashToken(null as unknown as string)).not.toThrow();
  });
});

// ============================================================================
// PII masking
// ============================================================================

describe('maskTarget', () => {
  it('masks an HTTPS slack webhook URL keeping scheme + first 12 host chars + last 4 chars', () => {
    const out = maskTarget('https://hooks.slack.com/services/T123/B456/abcdefghijklmnop');
    expect(out.startsWith('https://hooks.slack.')).toBe(true);
    expect(out).toContain('****');
    expect(out.endsWith('mnop')).toBe(true);
    expect(out).not.toContain('abcdefghij');
  });

  it('masks an email address using the bare-string fallback', () => {
    const out = maskTarget('client@example.com');
    expect(out).toContain('****');
    expect(out.endsWith('.com')).toBe(true);
    // Local-part must not appear in full
    expect(out).not.toContain('client@example.c');
  });

  it('masks a non-URL slack-style token without crashing', () => {
    const out = maskTarget('xoxb-1234567890-ABCDEFGHIJKL');
    expect(out).toContain('****');
    expect(out.endsWith('IJKL')).toBe(true);
  });

  it('returns empty string for empty input', () => {
    expect(maskTarget('')).toBe('');
    expect(maskTarget(null as unknown as string)).toBe('');
  });
});

describe('maskDeckId', () => {
  it('keeps first 4 chars + ****', () => {
    expect(maskDeckId('deck_abcdef0123')).toBe('deck****');
  });

  it('returns **** for short ids (< 6 chars)', () => {
    expect(maskDeckId('abc')).toBe('****');
    expect(maskDeckId('abcd5')).toBe('****');
  });

  it('returns **** for null', () => {
    expect(maskDeckId(null)).toBe('****');
  });
});

// ============================================================================
// Snapshot assembly
// ============================================================================

describe('buildSubscriberDashboardSnapshot — aggregation', () => {
  it('aggregates last7Days and last30Days correctly across mixed timestamps', () => {
    const dispatches: BuildSnapshotDispatchInput[] = [
      makeDispatch({ id: 'd_old', dispatchedAt: isoOffset(45), status: 'sent' }),
      makeDispatch({ id: 'd_25', dispatchedAt: isoOffset(25), status: 'sent' }),
      makeDispatch({ id: 'd_25b', dispatchedAt: isoOffset(25), status: 'failed' }),
      makeDispatch({ id: 'd_5', dispatchedAt: isoOffset(5), status: 'sent' }),
      makeDispatch({ id: 'd_2', dispatchedAt: isoOffset(2), status: 'failed' }),
      makeDispatch({ id: 'd_1', dispatchedAt: isoOffset(1), status: 'suppressed' }),
      makeDispatch({ id: 'd_0', dispatchedAt: isoOffset(0), status: 'dry_run' }),
    ];

    const snap = buildSubscriberDashboardSnapshot(makeInput({ dispatches }));

    expect(snap.delivery.last7Days).toEqual({
      sent: 1,
      failed: 1,
      suppressed: 1,
      dryRun: 1,
    });
    expect(snap.delivery.last30Days).toEqual({
      sent: 2,
      failed: 2,
      suppressed: 1,
      dryRun: 1,
    });
    expect(snap.delivery.lastDispatchAt).toBe(isoOffset(0));
    expect(snap.delivery.lastFailureAt).toBe(isoOffset(2));
  });

  it('counts consecutiveFailures from the END of the dispatches array', () => {
    const dispatches: BuildSnapshotDispatchInput[] = [
      makeDispatch({ id: 'a', status: 'sent', dispatchedAt: isoOffset(6) }),
      makeDispatch({ id: 'b', status: 'failed', dispatchedAt: isoOffset(5) }),
      makeDispatch({ id: 'c', status: 'failed', dispatchedAt: isoOffset(4) }),
      makeDispatch({ id: 'd', status: 'sent', dispatchedAt: isoOffset(3) }),
      makeDispatch({ id: 'e', status: 'failed', dispatchedAt: isoOffset(2) }),
      makeDispatch({ id: 'f', status: 'failed', dispatchedAt: isoOffset(1) }),
      makeDispatch({ id: 'g', status: 'failed', dispatchedAt: isoOffset(0) }),
    ];
    const snap = buildSubscriberDashboardSnapshot(makeInput({ dispatches }));
    // Tail of array: failed,failed,failed → 3
    expect(snap.delivery.consecutiveFailures).toBe(3);
  });

  it('flags health as degraded when consecutiveFailures >= 5', () => {
    const dispatches: BuildSnapshotDispatchInput[] = Array.from({ length: 6 }, (_, i) =>
      makeDispatch({
        id: `f_${i}`,
        status: 'failed',
        dispatchedAt: isoOffset(6 - i),
      })
    );
    const snap = buildSubscriberDashboardSnapshot(makeInput({ dispatches }));
    expect(snap.delivery.consecutiveFailures).toBeGreaterThanOrEqual(5);
    expect(snap.health.overall).toBe('degraded');
    expect(snap.health.reasons).toContain('5+ consecutive failures');
  });

  it('flags health as unhealthy when consecutiveFailures >= 10', () => {
    const dispatches: BuildSnapshotDispatchInput[] = Array.from({ length: 12 }, (_, i) =>
      makeDispatch({
        id: `f_${i}`,
        status: 'failed',
        dispatchedAt: isoOffset(12 - i),
      })
    );
    const snap = buildSubscriberDashboardSnapshot(makeInput({ dispatches }));
    expect(snap.delivery.consecutiveFailures).toBeGreaterThanOrEqual(10);
    expect(snap.health.overall).toBe('unhealthy');
    expect(snap.health.reasons).toContain('5+ consecutive failures');
  });
});

describe('buildSubscriberDashboardSnapshot — rotation pressure', () => {
  it('emits a soft warning when daysSinceRotation > 60 but health stays healthy', () => {
    const snap = buildSubscriberDashboardSnapshot(
      makeInput({
        subscription: {
          id: 'sub_1',
          channel: 'webhook',
          target: 'https://example.com/hook/abcdef',
          minSeverity: 'BLOCKED_P1',
          active: true,
          signingSecretRotatedAt: isoOffset(75),
        },
        dispatches: [makeDispatch({ status: 'sent', dispatchedAt: isoOffset(1) })],
      })
    );
    expect(snap.signature.daysSinceRotation).toBeGreaterThan(60);
    expect(snap.warnings).toContain('Signing secret should be rotated within 30 days');
    expect(snap.health.overall).toBe('healthy');
    expect(snap.signature.rotationDueWithinDays).toBeGreaterThanOrEqual(0);
  });

  it('flips overall to degraded with overdue reason when daysSinceRotation > 90', () => {
    const snap = buildSubscriberDashboardSnapshot(
      makeInput({
        subscription: {
          id: 'sub_1',
          channel: 'webhook',
          target: 'https://example.com/hook/abcdef',
          minSeverity: 'BLOCKED_P1',
          active: true,
          signingSecretRotatedAt: isoOffset(120),
        },
        dispatches: [makeDispatch({ status: 'sent', dispatchedAt: isoOffset(1) })],
      })
    );
    expect(snap.signature.daysSinceRotation).toBeGreaterThan(90);
    expect(snap.health.overall).toBe('degraded');
    expect(snap.health.reasons).toContain('Signing secret overdue (>90 days since rotation)');
  });
});

describe('buildSubscriberDashboardSnapshot — empty + recent + serializability', () => {
  it('keeps health=healthy but reports "No recent dispatches" for an active subscription with no traffic', () => {
    const snap = buildSubscriberDashboardSnapshot(
      makeInput({
        subscription: {
          id: 'sub_1',
          channel: 'webhook',
          target: 'https://example.com/hook',
          minSeverity: 'BLOCKED_P1',
          active: true,
          signingSecretRotatedAt: isoOffset(10),
        },
        dispatches: [],
      })
    );
    expect(snap.delivery.last7Days).toEqual({
      sent: 0,
      failed: 0,
      suppressed: 0,
      dryRun: 0,
    });
    expect(snap.health.overall).toBe('healthy');
    expect(snap.health.reasons).toContain('No recent dispatches');
    expect(snap.delivery.consecutiveFailures).toBe(0);
  });

  it('caps recentDispatches at 5 and orders most-recent first', () => {
    const dispatches: BuildSnapshotDispatchInput[] = Array.from({ length: 8 }, (_, i) =>
      makeDispatch({
        id: `d_${i}`,
        // Older first; the newest is i=7 → offset 0 days.
        dispatchedAt: isoOffset(7 - i),
        status: 'sent',
      })
    );
    const snap = buildSubscriberDashboardSnapshot(makeInput({ dispatches }));
    expect(snap.recentDispatches).toHaveLength(5);
    // Most-recent first = d_7, d_6, d_5, d_4, d_3
    expect(snap.recentDispatches.map((d) => d.id)).toEqual(['d_7', 'd_6', 'd_5', 'd_4', 'd_3']);
    // deck id is masked
    expect(snap.recentDispatches[0].deckIdMasked).toBe('deck****');
  });

  it('produces a JSON-serializable snapshot (no Map / Date instances)', () => {
    const snap = buildSubscriberDashboardSnapshot(
      makeInput({
        dispatches: [
          makeDispatch({ status: 'sent', dispatchedAt: isoOffset(2) }),
          makeDispatch({ status: 'failed', dispatchedAt: isoOffset(1) }),
        ],
      })
    );
    const json = JSON.stringify(snap);
    const reparsed = JSON.parse(json);
    expect(reparsed).toEqual(snap);
    // No prototype-leakage: the snapshot only has plain enumerable keys.
    expect(Object.getPrototypeOf(snap)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snap.subscription)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snap.delivery)).toBe(Object.prototype);
  });
});
