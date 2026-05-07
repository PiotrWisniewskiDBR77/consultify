import { describe, expect, it } from 'vitest';

import {
  buildCanonicalSigningString,
  signWebhookBody,
} from '../presentationGovernanceAlertService.js';
import {
  buildPlaygroundDispatchPlan,
  verifyInboxRequest,
  type PlaygroundDispatchPlan,
} from '../presentationAlertPlaygroundService.js';

function makePlan(overrides: { signingSecret?: string | null } = {}): PlaygroundDispatchPlan {
  return buildPlaygroundDispatchPlan({
    organizationId: 'org_acme',
    syntheticVerdict: 'BLOCKED_P0',
    syntheticDeckId: 'playground_deck',
    signingSecret: overrides.signingSecret,
  });
}

function inboxFromPlan(
  plan: PlaygroundDispatchPlan,
  overrides: Partial<{
    bodyJson: string;
    signature: string | null;
    signatureAlgorithm: string | null;
    timestamp: string | null;
    eventId: string | null;
    signingSecret: string;
  }> = {}
) {
  return {
    bodyJson: plan.bodyJson,
    signature: plan.signature,
    signatureAlgorithm: 'HMAC-SHA256',
    timestamp: plan.generatedAt,
    eventId: plan.eventId,
    signingSecret: plan.signingSecret,
    ...overrides,
  };
}

describe('presentationAlertPlaygroundService - buildPlaygroundDispatchPlan', () => {
  it('generates a fresh 64-hex signing secret when none is provided', () => {
    const plan = buildPlaygroundDispatchPlan({
      organizationId: 'org_acme',
      signingSecret: null,
    });

    expect(plan.signingSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(plan.eventId).toMatch(/^playground_/);
    expect(plan.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(plan.headers['x-consultify-signature']).toBe(plan.signature);
  });

  it('reuses the provided signing secret verbatim', () => {
    const secret = 'b'.repeat(64);
    const plan = buildPlaygroundDispatchPlan({
      organizationId: 'org_acme',
      signingSecret: secret,
    });

    expect(plan.signingSecret).toBe(secret);
  });

  it('emits headers including x-consultify-signature that match the bodyJson used for signing', () => {
    const plan = makePlan();

    expect(plan.headers['x-consultify-signature']).toBe(plan.signature);
    expect(plan.headers['x-consultify-signature-algorithm']).toBe('HMAC-SHA256');
    expect(plan.headers['x-consultify-event-id']).toBe(plan.eventId);
    expect(plan.headers['x-consultify-timestamp']).toBe(plan.generatedAt);
    expect(plan.canonicalString).toBe(
      `${plan.generatedAt}\n${plan.eventId}\n${plan.bodyJson}`
    );
    // bodyJson must round-trip parse and contain the synthetic verdict.
    const payload = JSON.parse(plan.bodyJson);
    expect(payload.toVerdict).toBe('BLOCKED_P0');
    expect(payload.deckId).toBe('playground_deck');
  });

  it('defaults synthetic deck id and severity when omitted', () => {
    const plan = buildPlaygroundDispatchPlan({ organizationId: 'org_acme' });

    expect(plan.payloadPreview.deckId).toBe('playground_deck');
    expect(plan.payloadPreview.toVerdict).toBe('BLOCKED_P0');
  });
});

describe('presentationAlertPlaygroundService - verifyInboxRequest', () => {
  it('round-trips a freshly built dispatch plan to verified=true', () => {
    const plan = makePlan();

    const result = verifyInboxRequest(inboxFromPlan(plan));

    expect(result.status).toBe('verified');
    expect(result.verified).toBe(true);
    expect(result.reason).toBe('Signature OK');
    expect(result.payloadPreview).toEqual({
      eventId: plan.eventId,
      toVerdict: 'BLOCKED_P0',
      deckId: 'playground_deck',
    });
  });

  it('returns unsigned when no signing secret is provided', () => {
    const plan = makePlan();

    const result = verifyInboxRequest(inboxFromPlan(plan, { signingSecret: '' }));

    expect(result.status).toBe('unsigned');
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/no signing secret/i);
  });

  it('returns missing_headers when the signature header is absent', () => {
    const plan = makePlan();

    const result = verifyInboxRequest(inboxFromPlan(plan, { signature: null }));

    expect(result.status).toBe('missing_headers');
    expect(result.verified).toBe(false);
  });

  it('returns missing_headers when the timestamp header is absent', () => {
    const plan = makePlan();

    const result = verifyInboxRequest(inboxFromPlan(plan, { timestamp: null }));

    expect(result.status).toBe('missing_headers');
  });

  it('returns missing_headers when the eventId header is absent', () => {
    const plan = makePlan();

    const result = verifyInboxRequest(inboxFromPlan(plan, { eventId: null }));

    expect(result.status).toBe('missing_headers');
  });

  it('returns invalid_signature when the receiver uses a different secret', () => {
    const plan = makePlan();
    const wrongSecret = 'c'.repeat(64);

    const result = verifyInboxRequest(inboxFromPlan(plan, { signingSecret: wrongSecret }));

    expect(result.status).toBe('invalid_signature');
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/HMAC/);
  });

  it('returns invalid_signature when a single hex char of the signature is tampered', () => {
    const plan = makePlan();
    const tampered =
      plan.signature.slice(0, -1) + (plan.signature.endsWith('0') ? '1' : '0');

    const result = verifyInboxRequest(inboxFromPlan(plan, { signature: tampered }));

    expect(result.status).toBe('invalid_signature');
  });

  it('returns mismatched_event when header eventId differs from body eventId', () => {
    const plan = makePlan();
    // Inject an eventId field into the body so the playground inbox can
    // detect the mismatch. Re-sign with the body's eventId so the HMAC
    // verifies but the header/body eventIds disagree.
    const tamperedBody = JSON.stringify({
      ...JSON.parse(plan.bodyJson),
      eventId: 'event_in_body_only',
    });
    // We need the signature to match the tampered body but use the
    // ORIGINAL header eventId so the mismatch surfaces as the failure
    // (not invalid_signature).
    const canonical = buildCanonicalSigningString({
      eventId: plan.eventId,
      timestamp: plan.generatedAt,
      bodyJson: tamperedBody,
    });
    const reSignature = signWebhookBody(plan.signingSecret, canonical);

    const result = verifyInboxRequest(
      inboxFromPlan(plan, { bodyJson: tamperedBody, signature: reSignature })
    );

    expect(result.status).toBe('mismatched_event');
    expect(result.verified).toBe(false);
  });

  it('returns parse_error when the body is malformed JSON', () => {
    const plan = makePlan();

    const result = verifyInboxRequest(inboxFromPlan(plan, { bodyJson: '{not json' }));

    expect(result.status).toBe('parse_error');
    expect(result.verified).toBe(false);
  });

  it('returns missing_headers when signatureAlgorithm is HMAC-SHA1 (rejected)', () => {
    const plan = makePlan();

    const result = verifyInboxRequest(
      inboxFromPlan(plan, { signatureAlgorithm: 'HMAC-SHA1' })
    );

    expect(result.status).toBe('missing_headers');
    expect(result.reason).toMatch(/algorithm/i);
  });

  it('verifies even when signatureAlgorithm header is empty string (treated as default)', () => {
    const plan = makePlan();

    const result = verifyInboxRequest(inboxFromPlan(plan, { signatureAlgorithm: '' }));

    expect(result.status).toBe('verified');
  });
});
