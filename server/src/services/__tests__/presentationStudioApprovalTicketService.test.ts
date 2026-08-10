/**
 * Unit tests for `presentationStudioApprovalTicketService` (Sprint S6).
 *
 * Covers the proposal -> approval invariant for the first mutating Studio
 * endpoint. Each test must reset the in-memory ticket store via
 * `_clearApprovalTicketStoreForTests` to avoid cross-test bleed.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  _approvalTicketStoreSizeForTests,
  _clearApprovalTicketStoreForTests,
  computePayloadFingerprint,
  consumeApprovalTicket,
  mintApprovalTicket,
} from '../presentationStudioApprovalTicketService.js';

describe('presentationStudioApprovalTicketService', () => {
  beforeEach(() => {
    _clearApprovalTicketStoreForTests();
  });

  it('mints a ticket with stable fields and adds it to the store', () => {
    const fingerprint = computePayloadFingerprint({ title: 'A', goal: 'decide' });
    const now = new Date('2026-05-08T20:00:00.000Z');
    const ticket = mintApprovalTicket({
      organizationId: 'org-A',
      userId: 'user-1',
      payloadFingerprint: fingerprint,
      now,
    });
    expect(ticket.ticketId).toMatch(/^pssa_/);
    expect(ticket.organizationId).toBe('org-A');
    expect(ticket.userId).toBe('user-1');
    expect(ticket.payloadFingerprint).toBe(fingerprint);
    expect(ticket.consumedAt).toBeNull();
    expect(_approvalTicketStoreSizeForTests()).toBe(1);
  });

  it('redeems a ticket once and rejects subsequent redemptions with consumed', () => {
    const fp = computePayloadFingerprint({ a: 1 });
    const ticket = mintApprovalTicket({
      organizationId: 'org-A',
      userId: 'user-1',
      payloadFingerprint: fp,
    });
    const first = consumeApprovalTicket({
      ticketId: ticket.ticketId,
      organizationId: 'org-A',
      userId: 'user-1',
      expectedFingerprint: fp,
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.ticket.consumedAt).not.toBeNull();
    }
    const second = consumeApprovalTicket({
      ticketId: ticket.ticketId,
      organizationId: 'org-A',
      userId: 'user-1',
      expectedFingerprint: fp,
    });
    expect(second).toEqual({ ok: false, reason: 'consumed' });
  });

  it('rejects unknown ticket ids with not_found', () => {
    const result = consumeApprovalTicket({
      ticketId: 'pssa_does-not-exist',
      organizationId: 'org-A',
      userId: 'user-1',
      expectedFingerprint: 'fp',
    });
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects redemption from a different tenant with tenant_mismatch', () => {
    const fp = computePayloadFingerprint({ a: 1 });
    const ticket = mintApprovalTicket({
      organizationId: 'org-A',
      userId: 'user-1',
      payloadFingerprint: fp,
    });
    const result = consumeApprovalTicket({
      ticketId: ticket.ticketId,
      organizationId: 'org-B',
      userId: 'user-1',
      expectedFingerprint: fp,
    });
    expect(result).toEqual({ ok: false, reason: 'tenant_mismatch' });
  });

  it('rejects redemption from a different user with user_mismatch', () => {
    const fp = computePayloadFingerprint({ a: 1 });
    const ticket = mintApprovalTicket({
      organizationId: 'org-A',
      userId: 'user-1',
      payloadFingerprint: fp,
    });
    const result = consumeApprovalTicket({
      ticketId: ticket.ticketId,
      organizationId: 'org-A',
      userId: 'user-2',
      expectedFingerprint: fp,
    });
    expect(result).toEqual({ ok: false, reason: 'user_mismatch' });
  });

  it('rejects expired tickets with expired', () => {
    const fp = computePayloadFingerprint({ a: 1 });
    const ticket = mintApprovalTicket({
      organizationId: 'org-A',
      userId: 'user-1',
      payloadFingerprint: fp,
      ttlMs: 1000,
      now: new Date('2026-05-08T20:00:00.000Z'),
    });
    const later = new Date('2026-05-08T20:30:00.000Z');
    const result = consumeApprovalTicket({
      ticketId: ticket.ticketId,
      organizationId: 'org-A',
      userId: 'user-1',
      expectedFingerprint: fp,
      now: later,
    });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects mismatched payload fingerprints with payload_mismatch', () => {
    const fp = computePayloadFingerprint({ a: 1 });
    const otherFp = computePayloadFingerprint({ a: 2 });
    const ticket = mintApprovalTicket({
      organizationId: 'org-A',
      userId: 'user-1',
      payloadFingerprint: fp,
    });
    const result = consumeApprovalTicket({
      ticketId: ticket.ticketId,
      organizationId: 'org-A',
      userId: 'user-1',
      expectedFingerprint: otherFp,
    });
    expect(result).toEqual({ ok: false, reason: 'payload_mismatch' });
  });

  it('produces stable fingerprints regardless of object key order', () => {
    const a = computePayloadFingerprint({
      goal: 'decide',
      title: 'A',
      sourceArtifacts: [{ a: 1 }],
    });
    const b = computePayloadFingerprint({
      sourceArtifacts: [{ a: 1 }],
      title: 'A',
      goal: 'decide',
    });
    expect(a).toBe(b);
  });
});
