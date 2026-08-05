/**
 * Client-side idempotency key lifecycle for "create" submissions (M02-003).
 *
 * The server now enforces one task per (organization_id, idempotency_key)
 * — `idx_tasks_idempotency_org`, migration 20260804_m02a_tasks_tenant_idempotency.sql
 * — but that only helps if the client sends a key, and sends the SAME key for
 * what is genuinely the same submission. The rules Master Codex set:
 *
 *   1. one stable request id generated when a create submission STARTS;
 *   2. the same key across a double-click and across a network retry;
 *   3. a NEW key after success, or after a deliberate new intention;
 *   4. NEVER the same key for a changed payload.
 *
 * Rule 4 is the subtle one: if the user's first attempt fails, they edit the
 * title, and retry, that is a different task — reusing the key would make the
 * server return the FIRST payload's row and silently discard the edit. So the
 * key is bound to a fingerprint of the payload, and any payload change mints a
 * new key.
 *
 * Deliberately framework-free so it can be unit-tested directly and reused by
 * any other create surface that needs the same contract.
 */

/** Stable, order-independent fingerprint of a create payload. */
export function fingerprintPayload(payload: unknown): string {
  const stable = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(stable);
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = stable((value as Record<string, unknown>)[k]);
        return acc;
      }, {});
  };
  return JSON.stringify(stable(payload));
}

function newKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // Non-crypto fallback is fine: the key only needs to be unique per tenant,
  // and the server's unique index is the real guarantee.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface IdempotencyState {
  key: string;
  fingerprint: string;
}

/**
 * Returns the key to send for this submission, plus the state to carry forward.
 *
 * Pass the previous state (or null). If the payload fingerprint is unchanged,
 * the previous key is reused — that is the double-click / retry case. If it
 * changed, or there is no previous state, a fresh key is minted.
 */
export function resolveIdempotencyKey(
  previous: IdempotencyState | null,
  payload: unknown
): IdempotencyState {
  const fingerprint = fingerprintPayload(payload);
  if (previous && previous.fingerprint === fingerprint) return previous;
  return { key: newKey(), fingerprint };
}
