import { describe, expect, it } from 'vitest';

import {
  type AlertSubscription,
  type AlertTransitionInput,
  buildAlertPayload,
  buildCanonicalSigningString,
  buildSignedRequestHeaders,
  generateSigningSecret,
  maskTarget,
  shouldDispatch,
  signWebhookBody,
  verifyWebhookSignature,
} from '../presentationGovernanceAlertService.js';

function makeTransition(
  overrides: Partial<AlertTransitionInput> = {}
): AlertTransitionInput {
  return {
    deckId: 'deck_123',
    deckTitle: 'Q3 Strategy Deck',
    fromVerdict: 'PASS_WITH_P2',
    toVerdict: 'BLOCKED_P0',
    organizationId: 'org_acme',
    generatedAt: '2026-05-07T07:00:00.000Z',
    ...overrides,
  };
}

function makeSubscription(
  overrides: Partial<AlertSubscription> = {}
): AlertSubscription {
  return {
    id: 'sub_1',
    organizationId: 'org_acme',
    channel: 'webhook',
    target: 'https://hooks.slack.com/services/T123/B456/abcdefghijklmnop',
    minSeverity: 'BLOCKED_P1',
    active: true,
    ...overrides,
  };
}

describe('presentationGovernanceAlertService - buildAlertPayload', () => {
  it('returns a deterministic payload with severityRank=4 for BLOCKED_P0', () => {
    const transition = makeTransition({ toVerdict: 'BLOCKED_P0' });

    const payload = buildAlertPayload(transition);

    expect(payload).toEqual({
      schema: 'consultify.governance.alert.v1',
      type: 'deck_blocked',
      organizationId: 'org_acme',
      deckId: 'deck_123',
      deckTitle: 'Q3 Strategy Deck',
      fromVerdict: 'PASS_WITH_P2',
      toVerdict: 'BLOCKED_P0',
      generatedAt: '2026-05-07T07:00:00.000Z',
      severityRank: 4,
    });
    // Calling twice with the same input must produce structurally equal output.
    expect(buildAlertPayload(transition)).toEqual(payload);
  });

  it('returns severityRank=3 for BLOCKED_P1', () => {
    const payload = buildAlertPayload(makeTransition({ toVerdict: 'BLOCKED_P1' }));
    expect(payload.severityRank).toBe(3);
    expect(payload.toVerdict).toBe('BLOCKED_P1');
  });
});

describe('presentationGovernanceAlertService - shouldDispatch', () => {
  it('returns true when org matches and transition severity equals subscription threshold', () => {
    const sub = makeSubscription({ minSeverity: 'BLOCKED_P1' });
    const transition = makeTransition({ toVerdict: 'BLOCKED_P1' });

    expect(shouldDispatch(sub, transition)).toBe(true);
  });

  it('returns true when transition severity is strictly above subscription threshold', () => {
    const sub = makeSubscription({ minSeverity: 'BLOCKED_P1' });
    const transition = makeTransition({ toVerdict: 'BLOCKED_P0' });

    expect(shouldDispatch(sub, transition)).toBe(true);
  });

  it('returns false for an inactive subscription even if severity matches', () => {
    const sub = makeSubscription({ active: false, minSeverity: 'BLOCKED_P1' });
    const transition = makeTransition({ toVerdict: 'BLOCKED_P0' });

    expect(shouldDispatch(sub, transition)).toBe(false);
  });

  it('returns false when subscription belongs to a different organization', () => {
    const sub = makeSubscription({ organizationId: 'org_other' });
    const transition = makeTransition({ organizationId: 'org_acme' });

    expect(shouldDispatch(sub, transition)).toBe(false);
  });

  it('returns false when transition severity is below subscription threshold', () => {
    const sub = makeSubscription({ minSeverity: 'BLOCKED_P0' });
    const transition = makeTransition({ toVerdict: 'BLOCKED_P1' });

    expect(shouldDispatch(sub, transition)).toBe(false);
  });
});

describe('presentationGovernanceAlertService - maskTarget', () => {
  it('masks Slack/webhook URLs while preserving scheme + host', () => {
    const masked = maskTarget('https://hooks.slack.com/services/T123/B456/abcdefghijklmnop');

    expect(masked.startsWith('https://hooks.slack.com')).toBe(true);
    expect(masked).toContain('***');
    expect(masked).not.toContain('abcdefghijklmnop');
    expect(masked).not.toContain('B456');
    // Only the very first 8 path chars (`/services`) should leak.
    expect(masked).toBe('https://hooks.slack.com/service***');
  });

  it('masks emails keeping the first 2 chars of the local-part and full domain', () => {
    expect(maskTarget('piotr@dbr77.com')).toBe('pi***@dbr77.com');
    expect(maskTarget('a@dbr77.com')).toBe('a***@dbr77.com');
  });

  it('falls back to character-level redaction for bare strings', () => {
    expect(maskTarget('opaque-token-xyz')).toBe('****************');
    expect(maskTarget('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Sprint 9: HMAC signing primitives
// ---------------------------------------------------------------------------

describe('presentationGovernanceAlertService - generateSigningSecret', () => {
  it('returns a 64-char lowercase hex string and is unique per call', () => {
    const a = generateSigningSecret();
    const b = generateSigningSecret();

    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe('presentationGovernanceAlertService - buildCanonicalSigningString', () => {
  it('joins timestamp, eventId, and bodyJson with literal "\\n" separators', () => {
    const canonical = buildCanonicalSigningString({
      timestamp: '2026-05-07T07:00:00.000Z',
      eventId: 'evt_abc123',
      bodyJson: '{"foo":1}',
    });

    expect(canonical).toBe('2026-05-07T07:00:00.000Z\nevt_abc123\n{"foo":1}');
    expect(canonical.split('\n')).toHaveLength(3);
  });

  it('does NOT re-encode the body JSON (byte-stable)', () => {
    const bodyJson = '{"a":1,  "b":  2}';
    const canonical = buildCanonicalSigningString({
      timestamp: 't',
      eventId: 'e',
      bodyJson,
    });
    expect(canonical.endsWith(bodyJson)).toBe(true);
  });
});

describe('presentationGovernanceAlertService - signWebhookBody / verifyWebhookSignature', () => {
  const SECRET = '0'.repeat(64);
  const CANONICAL = '2026-05-07T07:00:00.000Z\nevt_1\n{"hello":"world"}';

  it('signWebhookBody is deterministic for the same secret + canonical input', () => {
    const a = signWebhookBody(SECRET, CANONICAL);
    const b = signWebhookBody(SECRET, CANONICAL);

    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifyWebhookSignature returns true for the matching signature', () => {
    const sig = signWebhookBody(SECRET, CANONICAL);
    expect(verifyWebhookSignature(SECRET, CANONICAL, sig)).toBe(true);
  });

  it('verifyWebhookSignature returns false (no throw) for an incorrect signature of equal length', () => {
    const wrong = 'a'.repeat(64);
    expect(verifyWebhookSignature(SECRET, CANONICAL, wrong)).toBe(false);
  });

  it('verifyWebhookSignature returns false (no throw) when provided signature length differs', () => {
    expect(verifyWebhookSignature(SECRET, CANONICAL, 'deadbeef')).toBe(false);
  });

  it('verifyWebhookSignature returns false when secret is empty', () => {
    const sig = signWebhookBody(SECRET, CANONICAL);
    expect(verifyWebhookSignature('', CANONICAL, sig)).toBe(false);
  });

  it('verifyWebhookSignature returns false when provided signature is empty', () => {
    expect(verifyWebhookSignature(SECRET, CANONICAL, '')).toBe(false);
  });
});

describe('presentationGovernanceAlertService - buildSignedRequestHeaders', () => {
  const BODY = '{"deckId":"d1"}';
  const NOW = '2026-05-07T07:00:00.000Z';

  it('returns ONLY content-type when secret is null', () => {
    const headers = buildSignedRequestHeaders({
      eventId: 'evt_1',
      bodyJson: BODY,
      secret: null,
    });

    expect(headers).toEqual({ 'content-type': 'application/json' });
    expect(headers['x-consultify-signature']).toBeUndefined();
    expect(headers['x-consultify-signature-algorithm']).toBeUndefined();
    expect(headers['x-consultify-timestamp']).toBeUndefined();
    expect(headers['x-consultify-event-id']).toBeUndefined();
  });

  it('returns ONLY content-type when secret is empty string', () => {
    const headers = buildSignedRequestHeaders({
      eventId: 'evt_1',
      bodyJson: BODY,
      secret: '',
    });

    expect(headers).toEqual({ 'content-type': 'application/json' });
  });

  it('returns all four x-consultify-* headers when a secret is provided', () => {
    const secret = '0'.repeat(64);

    const headers = buildSignedRequestHeaders({
      eventId: 'evt_1',
      bodyJson: BODY,
      secret,
      nowIso: NOW,
    });

    expect(headers['content-type']).toBe('application/json');
    expect(headers['x-consultify-signature-algorithm']).toBe('HMAC-SHA256');
    expect(headers['x-consultify-timestamp']).toBe(NOW);
    expect(headers['x-consultify-event-id']).toBe('evt_1');
    expect(headers['x-consultify-signature']).toMatch(/^[0-9a-f]{64}$/);

    const expected = signWebhookBody(
      secret,
      buildCanonicalSigningString({ timestamp: NOW, eventId: 'evt_1', bodyJson: BODY })
    );
    expect(headers['x-consultify-signature']).toBe(expected);
  });

  it('signature roundtrips: receiver-side verifyWebhookSignature accepts the header bag', () => {
    const secret = generateSigningSecret();
    const headers = buildSignedRequestHeaders({
      eventId: 'evt_2',
      bodyJson: BODY,
      secret,
      nowIso: NOW,
    });
    const canonical = buildCanonicalSigningString({
      timestamp: headers['x-consultify-timestamp']!,
      eventId: headers['x-consultify-event-id']!,
      bodyJson: BODY,
    });

    expect(verifyWebhookSignature(secret, canonical, headers['x-consultify-signature']!)).toBe(true);
  });
});
