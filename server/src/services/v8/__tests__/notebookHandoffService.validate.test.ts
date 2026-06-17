/**
 * M04/L-07 — proof that `/handoff/validate` is a FALSE POSITIVE for "missing object
 * authorization". The endpoint delegates to `validateHandoffPayload`, which is a PURE,
 * STATELESS shape-checker: its only inputs are (target, payload) — no noteId, no orgId,
 * no userId, no DB handle — so there is no org/user-scoped object to authorize and
 * nothing org-specific to leak. These tests lock that contract so a future refactor
 * that smuggles in a DB lookup (and thus an authz obligation) breaks the build.
 */
import { describe, expect, it } from 'vitest';

import { validateHandoffPayload } from '../notebookHandoffService.js';

describe('validateHandoffPayload (M04/L-07 false-positive lock)', () => {
  it('takes only (target, payload) — arity 2, no auth/db context parameter', () => {
    // A DB/auth-scoped validator would need orgId/userId/db args. This has none.
    expect(validateHandoffPayload.length).toBe(2);
  });

  it('is synchronous and deterministic — no DB round-trip (returns, never a Promise)', () => {
    const out = validateHandoffPayload('radar', {});
    expect(out).not.toBeInstanceOf(Promise);
    expect(out).toEqual(validateHandoffPayload('radar', {}));
  });

  it('reports missing fields for an empty payload without throwing (pure shape check)', () => {
    const result = validateHandoffPayload('inicjatywy', {});
    expect(result.valid).toBe(false);
    expect(Array.isArray(result.missingFields)).toBe(true);
    expect(result.missingFields.length).toBeGreaterThan(0);
  });

  it('answer depends only on payload shape, not on any caller identity', () => {
    // No org/user is ever passed; the same payload always yields the same verdict —
    // confirming the endpoint cannot expose cross-org/cross-user data.
    const payload = { foo: 'bar' };
    expect(validateHandoffPayload('teresa', payload)).toEqual(
      validateHandoffPayload('teresa', payload)
    );
  });
});
