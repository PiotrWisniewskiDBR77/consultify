/**
 * Presentation Studio Approval Ticket Service (Sprint S6)
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *
 * Implements the proposal -> approval -> execution -> audit invariant for
 * the first mutating Studio endpoint (S6 generate). Tickets are:
 *   - Single-use: consumed atomically on first successful redemption.
 *   - Tenant-scoped: a ticket minted for org A can NEVER be redeemed by org B.
 *   - User-scoped: a ticket minted by user U is bound to U; another user from
 *     the same tenant cannot redeem it (this is a deliberate invariant — the
 *     user who proposed the generation is the user who must execute it).
 *   - Time-bounded: tickets expire after `ttlMs` (default 10 minutes).
 *   - Payload-bound: each ticket commits to a payload fingerprint at mint
 *     time. Redemption MUST present the same fingerprint, otherwise the
 *     ticket is rejected with `payload_mismatch`. This blocks the trivial
 *     "approve a small deck, swap to a big deck before execute" attack.
 *
 * Storage is intentionally in-memory: no DB migration in Phase 2 (Q2=A).
 * Tickets do not survive a server restart, which is acceptable given the
 * 10-minute TTL and the explicit "request approval just before execute" UX.
 */

import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

export type ApprovalTicketRejectionReason =
  | 'not_found'
  | 'expired'
  | 'consumed'
  | 'tenant_mismatch'
  | 'user_mismatch'
  | 'payload_mismatch';

export interface PresentationStudioApprovalTicket {
  ticketId: string;
  organizationId: string;
  userId: string;
  payloadFingerprint: string;
  createdAt: string;
  expiresAt: string;
  /** Set to the timestamp at which the ticket was redeemed. Once set the ticket can never be redeemed again. */
  consumedAt: string | null;
}

export interface MintApprovalTicketInput {
  organizationId: string;
  userId: string;
  payloadFingerprint: string;
  ttlMs?: number;
  now?: Date;
}

export interface ConsumeApprovalTicketInput {
  ticketId: string;
  organizationId: string;
  userId: string;
  expectedFingerprint: string;
  now?: Date;
}

export type ConsumeApprovalTicketResult =
  | { ok: true; ticket: PresentationStudioApprovalTicket }
  | { ok: false; reason: ApprovalTicketRejectionReason };

const DEFAULT_TTL_MS = 10 * 60 * 1000;

/**
 * In-memory ticket store. Module-level so that the same store is shared by
 * the route handler and tests inside a single Node process. A future sprint
 * may replace this with a Redis or DB-backed store; the public surface here
 * is designed to be swap-compatible.
 */
const ticketStore = new Map<string, PresentationStudioApprovalTicket>();

/**
 * Compute a stable fingerprint over an arbitrary JSON payload. We use SHA-256
 * over a sorted-key JSON serialization so that {a:1,b:2} and {b:2,a:1} hash
 * to the same value. Returns the hex digest.
 */
export function computePayloadFingerprint(payload: unknown): string {
  const stable = stableStringify(payload);
  return createHash('sha256').update(stable).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/**
 * Mint a new approval ticket. Returns the full ticket object including the
 * opaque `ticketId` that the client MUST present to redeem.
 */
export function mintApprovalTicket(
  input: MintApprovalTicketInput
): PresentationStudioApprovalTicket {
  const now = input.now || new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
  const ticket: PresentationStudioApprovalTicket = {
    ticketId: `pssa_${randomUUID()}`,
    organizationId: input.organizationId,
    userId: input.userId,
    payloadFingerprint: input.payloadFingerprint,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    consumedAt: null,
  };
  ticketStore.set(ticket.ticketId, ticket);
  return ticket;
}

/**
 * Atomically redeem (consume) an approval ticket. Returns a discriminated
 * union with the ticket on success or a typed rejection reason on failure.
 *
 * On success the ticket is marked consumed BEFORE the function returns;
 * subsequent calls with the same ticket id are guaranteed to fail with
 * `consumed`.
 */
export function consumeApprovalTicket(
  input: ConsumeApprovalTicketInput
): ConsumeApprovalTicketResult {
  const ticket = ticketStore.get(input.ticketId);
  if (!ticket) {
    return { ok: false, reason: 'not_found' };
  }
  if (ticket.consumedAt) {
    return { ok: false, reason: 'consumed' };
  }
  if (ticket.organizationId !== input.organizationId) {
    return { ok: false, reason: 'tenant_mismatch' };
  }
  if (ticket.userId !== input.userId) {
    return { ok: false, reason: 'user_mismatch' };
  }
  const now = input.now || new Date();
  if (now.getTime() > Date.parse(ticket.expiresAt)) {
    return { ok: false, reason: 'expired' };
  }
  if (ticket.payloadFingerprint !== input.expectedFingerprint) {
    return { ok: false, reason: 'payload_mismatch' };
  }
  ticket.consumedAt = now.toISOString();
  return { ok: true, ticket };
}

/**
 * Test-only helper. Clears the in-memory ticket store. Tests MUST call this
 * in `beforeEach` to avoid cross-test ticket leakage.
 */
export function _clearApprovalTicketStoreForTests(): void {
  ticketStore.clear();
}

/**
 * Test-only helper. Returns the current size of the ticket store. Used by
 * the orchestrator test suite to verify single-use semantics.
 */
export function _approvalTicketStoreSizeForTests(): number {
  return ticketStore.size;
}
