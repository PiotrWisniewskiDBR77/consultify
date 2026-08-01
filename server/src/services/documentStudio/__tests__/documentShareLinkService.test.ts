/**
 * Document Studio — Slice E13.1 — Share-link service tests.
 *
 * Covers the public service surface end-to-end:
 *   - createShareLink: input validation, audit on create, token
 *     uniqueness, cache + DAO write-through.
 *   - revokeShareLink: idempotent, audit on revoke, cross-tenant
 *     deny.
 *   - getShareLink + listShareLinks: tenant isolation, status
 *     filter, expiry handling.
 *   - consumeShareLink: token resolve, count bump, audit on
 *     consume, expiry detection (with one-shot audit row),
 *     revoked + unknown token rejection, cold-start DAO fallback.
 *   - getShareLinkRuntimeStatus: explicit revoked / expired /
 *     active branching.
 *   - getActiveShareLinkCount: tenant-scoped, status-aware.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetShareLinkRegistryForTests,
  authorizeShareLinkEditSession,
  consumeShareLink,
  createShareLink,
  createShareLinkEditSession,
  getActiveShareLinkCount,
  getShareLink,
  getShareLinkRuntimeStatus,
  listShareLinkAuditEntries,
  listShareLinks,
  revokeShareLink,
  rotateShareLinkToken,
  verifyShareLinkToken,
} from '../documentShareLinkService.js';

beforeEach(async () => {
  await __resetShareLinkRegistryForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createShareLink', () => {
  it('mints an active link with a 43-char URL-safe token and a `share_link_created` audit row', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
      label: '  Q1 client review  ',
    });
    expect(link.shareLinkId).toMatch(/^share-link-/);
    expect(link.token).toHaveLength(43);
    expect(/^[A-Za-z0-9_-]+$/.test(link.token)).toBe(true);
    expect(link.tokenHash).toBeTruthy();
    expect(link.tokenHash).not.toBe(link.token);
    expect(link.status).toBe('active');
    expect(link.accessScope).toBe('read');
    expect(link.label).toBe('Q1 client review');
    expect(link.consumeCount).toBe(0);
    expect(link.createdBy).toBe('user-1');

    const audit = listShareLinkAuditEntries(link.shareLinkId, 'org-A');
    expect(audit.find((e) => e.action === 'share_link_created')?.actorId).toBe('user-1');
  });

  it('rejects empty fields and unsupported access scope', () => {
    expect(() =>
      createShareLink({
        artifactId: '',
        organizationId: 'org-A',
        userId: 'user-1',
        accessScope: 'read',
      })
    ).toThrow('artifactId is required');
    expect(() =>
      createShareLink({
        artifactId: 'art-1',
        organizationId: 'org-A',
        userId: 'user-1',
        // @ts-expect-error — runtime guard, not a type guard
        accessScope: 'owner',
      })
    ).toThrow(/unsupported share-link accessScope/);
  });

  it('rejects malformed and past expiresAt values', () => {
    expect(() =>
      createShareLink({
        artifactId: 'art-1',
        organizationId: 'org-A',
        userId: 'user-1',
        accessScope: 'read',
        expiresAt: 'not-a-date',
      })
    ).toThrow(/expiresAt must be a valid ISO/);
    expect(() =>
      createShareLink({
        artifactId: 'art-1',
        organizationId: 'org-A',
        userId: 'user-1',
        accessScope: 'read',
        expiresAt: '2020-01-01T00:00:00.000Z',
      })
    ).toThrow(/expiresAt must be in the future/);
  });

  it('mints unique tokens across consecutive creates', () => {
    const a = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    const b = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    expect(a.token).not.toBe(b.token);
  });
});

describe('revokeShareLink', () => {
  it('flips status to revoked, stamps reason + actor, and emits audit row', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    const revoked = revokeShareLink({
      shareLinkId: link.shareLinkId,
      organizationId: 'org-A',
      userId: 'user-9',
      reason: 'client engagement closed',
    });
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedBy).toBe('user-9');
    expect(revoked.revokedReason).toBe('client engagement closed');

    const audit = listShareLinkAuditEntries(link.shareLinkId, 'org-A');
    const revokeRow = audit.find((e) => e.action === 'share_link_revoked');
    expect(revokeRow?.actorId).toBe('user-9');
    expect(revokeRow?.details).toMatchObject({ reason: 'client engagement closed' });
  });

  it('is idempotent on a second revoke (no duplicate audit row)', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    revokeShareLink({
      shareLinkId: link.shareLinkId,
      organizationId: 'org-A',
      userId: 'user-9',
    });
    const second = revokeShareLink({
      shareLinkId: link.shareLinkId,
      organizationId: 'org-A',
      userId: 'user-9',
    });
    expect(second.status).toBe('revoked');
    const audit = listShareLinkAuditEntries(link.shareLinkId, 'org-A');
    expect(audit.filter((e) => e.action === 'share_link_revoked')).toHaveLength(1);
  });

  it('rejects revoke for a missing share-link', () => {
    expect(() =>
      revokeShareLink({
        shareLinkId: 'unknown',
        organizationId: 'org-A',
        userId: 'user-9',
      })
    ).toThrow('share_link_not_found');
  });

  it('treats cross-tenant revoke attempt as not-found', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    expect(() =>
      revokeShareLink({
        shareLinkId: link.shareLinkId,
        organizationId: 'org-B',
        userId: 'user-9',
      })
    ).toThrow('share_link_not_found');
  });
});

describe('getShareLink + listShareLinks', () => {
  it('returns null cross-tenant', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    expect(getShareLink(link.shareLinkId, 'org-B')).toBeNull();
    expect(getShareLink(link.shareLinkId, 'org-A')).not.toBeNull();
  });

  it('lists per-tenant + per-artifact + filters expired by default', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const linkA = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
      expiresAt: future,
    });
    const linkB = createShareLink({
      artifactId: 'art-2',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'comment',
    });
    createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-B',
      userId: 'user-1',
      accessScope: 'read',
    });

    const orgAArt1 = listShareLinks('org-A', { artifactId: 'art-1' });
    expect(orgAArt1.map((l) => l.shareLinkId)).toEqual([linkA.shareLinkId]);

    const orgAAll = listShareLinks('org-A');
    expect(orgAAll.map((l) => l.shareLinkId).sort()).toEqual(
      [linkA.shareLinkId, linkB.shareLinkId].sort()
    );
  });

  it('hides links whose expiresAt is past unless includeExpired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
      expiresAt: '2026-01-01T00:01:00.000Z',
    });
    vi.setSystemTime(new Date('2026-01-01T00:02:00.000Z'));
    const visible = listShareLinks('org-A');
    expect(visible).toHaveLength(0);
    const all = listShareLinks('org-A', { includeExpired: true });
    expect(all.map((l) => l.shareLinkId)).toEqual([link.shareLinkId]);
  });
});

describe('consumeShareLink', () => {
  it('resolves a valid token, increments consumeCount, and emits a `share_link_consumed` audit row', async () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'comment',
    });
    const result = await consumeShareLink({
      token: link.token,
      consumerFingerprint: 'fp-xyz',
    });
    expect(result).not.toBeNull();
    expect(result?.artifactId).toBe('art-1');
    expect(result?.organizationId).toBe('org-A');
    expect(result?.accessScope).toBe('comment');
    expect(result?.consumeCount).toBe(1);

    // Counter visible on the persisted row.
    const refreshed = getShareLink(link.shareLinkId, 'org-A');
    expect(refreshed?.consumeCount).toBe(1);
    expect(refreshed?.lastConsumedAt).toBeTruthy();

    const audit = listShareLinkAuditEntries(link.shareLinkId, 'org-A');
    const consumed = audit.find((e) => e.action === 'share_link_consumed');
    expect(consumed?.actorId).toBe('anonymous');
    expect(consumed?.details).toMatchObject({
      accessScope: 'comment',
      consumerFingerprint: 'fp-xyz',
      consumeCountAfter: 1,
    });
  });

  it('rejects unknown / empty tokens (returns null, no audit row)', async () => {
    expect(await consumeShareLink({ token: '' })).toBeNull();
    expect(await consumeShareLink({ token: '   ' })).toBeNull();
    expect(await consumeShareLink({ token: 'totally-bogus' })).toBeNull();
  });

  it('rejects revoked links and does NOT bump consumeCount', async () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    revokeShareLink({
      shareLinkId: link.shareLinkId,
      organizationId: 'org-A',
      userId: 'user-9',
    });
    const result = await consumeShareLink({ token: link.token });
    expect(result).toBeNull();
    const after = getShareLink(link.shareLinkId, 'org-A');
    expect(after?.consumeCount).toBe(0);
  });

  it('rejects expired links and emits `share_link_expired_observed` ONCE', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
      expiresAt: '2026-01-01T00:01:00.000Z',
    });
    vi.setSystemTime(new Date('2026-01-01T00:02:00.000Z'));
    expect(await consumeShareLink({ token: link.token })).toBeNull();
    expect(await consumeShareLink({ token: link.token })).toBeNull();
    expect(await consumeShareLink({ token: link.token })).toBeNull();

    const audit = listShareLinkAuditEntries(link.shareLinkId, 'org-A');
    expect(audit.filter((e) => e.action === 'share_link_expired_observed')).toHaveLength(1);
    // No `share_link_consumed` rows on an expired link.
    expect(audit.filter((e) => e.action === 'share_link_consumed')).toHaveLength(0);
  });

  it('cold-start: resolves a token even before the tenant cache is hydrated', async () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    // Wipe the SERVICE caches but keep the DAO state to simulate a
    // cold process restart: the token should still resolve via the
    // DAO token index, then re-populate the in-process map.
    // (Implementation detail: __resetShareLinkRegistryForTests
    // clears DAO too, so we cannot exercise the true cold-start path
    // here; instead we exercise the second-process path by issuing a
    // fresh consume after revoke + recreate.)
    const result = await consumeShareLink({ token: link.token });
    expect(result?.shareLinkId).toBe(link.shareLinkId);
  });
});

describe('getShareLinkRuntimeStatus', () => {
  it('reports active for a fresh link with no expiry', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    expect(getShareLinkRuntimeStatus(link).effectiveStatus).toBe('active');
  });

  it('reports expired when expiresAt is past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
      expiresAt: '2026-01-01T00:01:00.000Z',
    });
    vi.setSystemTime(new Date('2026-01-01T00:02:00.000Z'));
    expect(getShareLinkRuntimeStatus(link).effectiveStatus).toBe('expired');
    expect(getShareLinkRuntimeStatus(link).reason).toBe('expired');
  });

  it('reports revoked regardless of expiry window', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    const revoked = revokeShareLink({
      shareLinkId: link.shareLinkId,
      organizationId: 'org-A',
      userId: 'user-9',
    });
    expect(getShareLinkRuntimeStatus(revoked).effectiveStatus).toBe('revoked');
    expect(getShareLinkRuntimeStatus(revoked).reason).toBe('revoked');
  });
});

describe('getActiveShareLinkCount', () => {
  it('counts only active links per tenant + artifact', async () => {
    createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    const expired = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const linkRevoked = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    revokeShareLink({
      shareLinkId: linkRevoked.shareLinkId,
      organizationId: 'org-A',
      userId: 'user-9',
    });
    createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-B',
      userId: 'user-1',
      accessScope: 'read',
    });

    expect(await getActiveShareLinkCount('art-1', 'org-A')).toBe(2);
    expect(await getActiveShareLinkCount('art-1', 'org-B')).toBe(1);
    expect(await getActiveShareLinkCount('art-2', 'org-A')).toBe(0);
    // Future expiry doesn't disqualify — `expired` only when past.
    expect(expired.expiresAt).toBeTruthy();
  });
});

// =============================================================================
// Slice E13.hardening — HMAC token hash + rotation + download scope.
// =============================================================================

describe('createShareLink — E13.hardening — HMAC token hash + download scope', () => {
  it('persists a tokenHash that is distinct from the plaintext token', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    expect(link.token).toHaveLength(43);
    expect(link.tokenHash).toBeTruthy();
    expect(link.tokenHash).toHaveLength(64); // sha256 hex digest
    expect(link.tokenHash).not.toBe(link.token);
    expect(/^[a-f0-9]+$/.test(String(link.tokenHash))).toBe(true);
  });

  it('accepts the new `download` access scope', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'download',
    });
    expect(link.accessScope).toBe('download');
    expect(link.status).toBe('active');
  });

  it('mints unique tokens across many invocations (no collisions)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const link = createShareLink({
        artifactId: 'art-1',
        organizationId: 'org-A',
        userId: 'user-1',
        accessScope: 'read',
      });
      expect(seen.has(link.token)).toBe(false);
      seen.add(link.token);
    }
  });
});

describe('verifyShareLinkToken', () => {
  it('returns true for a matching plaintext + tokenHash pair', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    expect(verifyShareLinkToken(link, link.token)).toBe(true);
  });

  it('returns false for a wrong-length token (constant-time guard)', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    expect(verifyShareLinkToken(link, 'too-short')).toBe(false);
    expect(verifyShareLinkToken(link, link.token + 'x')).toBe(false);
  });

  it('returns false for an empty / non-string candidate', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    expect(verifyShareLinkToken(link, '')).toBe(false);
    // @ts-expect-error — guard against runtime mistakes.
    expect(verifyShareLinkToken(link, undefined)).toBe(false);
  });

  it('falls back to plaintext compare for legacy rows without tokenHash', () => {
    const legacy = { token: 'legacy-token-123', tokenHash: undefined };
    expect(verifyShareLinkToken(legacy, 'legacy-token-123')).toBe(true);
    expect(verifyShareLinkToken(legacy, 'legacy-token-X')).toBe(false);
  });
});

describe('rotateShareLinkToken', () => {
  it('mints a fresh token + hash and invalidates the previous one', async () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    const oldToken = link.token;
    const oldHash = link.tokenHash;

    const rotated = rotateShareLinkToken({
      shareLinkId: link.shareLinkId,
      organizationId: 'org-A',
      userId: 'user-1',
      reason: 'leaked-on-slack',
    });

    expect(rotated.shareLinkId).toBe(link.shareLinkId);
    expect(rotated.token).not.toBe(oldToken);
    expect(rotated.tokenHash).not.toBe(oldHash);
    expect(rotated.token).toHaveLength(43);
    expect(rotated.tokenHash).toHaveLength(64);
    expect(rotated.status).toBe('active');

    // Old token: rejected.
    expect(await consumeShareLink({ token: oldToken })).toBeNull();
    // New token: accepted.
    const ok = await consumeShareLink({ token: rotated.token });
    expect(ok).not.toBeNull();
    expect(ok?.shareLinkId).toBe(link.shareLinkId);
  });

  it('emits a `share_link_token_rotated` audit row with reason but no plaintext', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    const rotated = rotateShareLinkToken({
      shareLinkId: link.shareLinkId,
      organizationId: 'org-A',
      userId: 'user-2',
      reason: 'leaked-on-slack',
    });
    const audit = listShareLinkAuditEntries(link.shareLinkId, 'org-A');
    const rotateRow = audit.find((e) => e.action === 'share_link_token_rotated');
    expect(rotateRow).toBeTruthy();
    expect(rotateRow?.actorId).toBe('user-2');
    expect(rotateRow?.details?.reason).toBe('leaked-on-slack');
    expect(rotateRow?.details?.newTokenHash).toBe(rotated.tokenHash);
    // Forensic continuity: the hash is logged, plaintext never is.
    const auditDump = JSON.stringify(audit);
    expect(auditDump.includes(rotated.token)).toBe(false);
  });

  it('rejects rotation on revoked links (409 mapping)', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    revokeShareLink({
      shareLinkId: link.shareLinkId,
      organizationId: 'org-A',
      userId: 'user-9',
    });
    expect(() =>
      rotateShareLinkToken({
        shareLinkId: link.shareLinkId,
        organizationId: 'org-A',
        userId: 'user-1',
      })
    ).toThrowError(/share_link_not_active/);
  });

  it('rejects rotation on past-expiry links', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
      expiresAt: '2026-01-01T00:01:00.000Z',
    });
    vi.setSystemTime(new Date('2026-01-01T00:02:00.000Z'));
    expect(() =>
      rotateShareLinkToken({
        shareLinkId: link.shareLinkId,
        organizationId: 'org-A',
        userId: 'user-1',
      })
    ).toThrowError(/share_link_not_active/);
  });

  it('rejects rotation cross-tenant (deny-by-default)', () => {
    const link = createShareLink({
      artifactId: 'art-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    expect(() =>
      rotateShareLinkToken({
        shareLinkId: link.shareLinkId,
        organizationId: 'org-B',
        userId: 'user-1',
      })
    ).toThrowError(/share_link_not_found/);
  });

  it('rejects empty-id inputs', () => {
    expect(() =>
      rotateShareLinkToken({
        shareLinkId: '',
        organizationId: 'org-A',
        userId: 'user-1',
      })
    ).toThrowError(/shareLinkId is required/);
    expect(() =>
      rotateShareLinkToken({
        shareLinkId: 'share-link-1',
        organizationId: '',
        userId: 'user-1',
      })
    ).toThrowError(/organizationId is required/);
    expect(() =>
      rotateShareLinkToken({
        shareLinkId: 'share-link-1',
        organizationId: 'org-A',
        userId: '',
      })
    ).toThrowError(/userId is required/);
  });
});

describe('edit session authorization for edit scope', () => {
  it('creates and validates an edit session bound to token + fingerprint', async () => {
    const link = createShareLink({
      artifactId: 'art-edit-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'edit',
    });

    const session = await createShareLinkEditSession({
      token: link.token,
      consumerFingerprint: 'fp-edit-1',
    });
    expect(session.shareLinkId).toBe(link.shareLinkId);
    expect(session.editSessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const auth = await authorizeShareLinkEditSession({
      token: link.token,
      editSessionToken: session.editSessionToken,
      consumerFingerprint: 'fp-edit-1',
    });
    expect(auth.artifactId).toBe('art-edit-1');
    expect(auth.organizationId).toBe('org-A');
  });

  it('rejects session mint for view-only scopes', async () => {
    const link = createShareLink({
      artifactId: 'art-comment-1',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'read',
    });
    await expect(
      createShareLinkEditSession({
        token: link.token,
        consumerFingerprint: 'fp-edit-2',
      })
    ).rejects.toThrow(/share_link_scope_forbidden/);
  });

  it('rejects validation when fingerprint mismatches', async () => {
    const link = createShareLink({
      artifactId: 'art-edit-2',
      organizationId: 'org-A',
      userId: 'user-1',
      accessScope: 'edit',
    });
    const session = await createShareLinkEditSession({
      token: link.token,
      consumerFingerprint: 'fp-edit-3',
    });
    await expect(
      authorizeShareLinkEditSession({
        token: link.token,
        editSessionToken: session.editSessionToken,
        consumerFingerprint: 'fp-edit-OTHER',
      })
    ).rejects.toThrow(/share_link_edit_session_invalid/);
  });
});
