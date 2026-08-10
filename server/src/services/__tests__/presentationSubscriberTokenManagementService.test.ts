import { describe, expect, it, vi } from 'vitest';

import {
  classifyTokenStatus,
  listSubscriberTokens,
  normalizeRevocationReason,
  revokeSubscriberToken,
  type ServiceOverrides,
} from '../presentationSubscriberTokenManagementService.js';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

interface TokenRowFixture {
  id: string;
  subscription_id: string;
  organization_id: string;
  token_prefix: string;
  issued_by: string | null;
  issued_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  scope: unknown;
}

function makeTokenRow(overrides: Partial<TokenRowFixture> = {}): TokenRowFixture {
  return {
    id: 'tok_1',
    subscription_id: 'sub_1',
    organization_id: 'org_acme',
    token_prefix: '1a2b3c4d',
    issued_by: 'user_admin',
    issued_at: '2026-04-01T12:00:00.000Z',
    expires_at: '2026-12-31T12:00:00.000Z',
    last_used_at: null,
    revoked_at: null,
    revoked_reason: null,
    scope: { read: true },
    ...overrides,
  };
}

interface OverridesShape extends ServiceOverrides {
  runCalls: Array<{ sql: string; params: unknown[] }>;
}

function makeOverrides(
  opts: {
    subscriptionExists?: boolean;
    tokenRows?: TokenRowFixture[];
    tokenById?: Record<string, TokenRowFixture | null>;
    schemaMissing?: 'list' | 'revoke' | 'sub' | 'none';
    runResult?: { success: boolean; error?: string };
    now?: Date;
  } = {}
): OverridesShape {
  const {
    subscriptionExists = true,
    tokenRows = [],
    tokenById = {},
    schemaMissing = 'none',
    runResult = { success: true, changes: 1 },
    now,
  } = opts;

  const runCalls: Array<{ sql: string; params: unknown[] }> = [];

  const dbGet = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/FROM\s+presentation_governance_alert_subscriptions/i.test(sql)) {
      if (schemaMissing === 'sub') {
        const err = new Error(
          'relation "presentation_governance_alert_subscriptions" does not exist'
        );
        throw err;
      }
      return subscriptionExists ? { id: params[0], organization_id: params[1] } : null;
    }
    if (/FROM\s+presentation_governance_subscriber_tokens/i.test(sql)) {
      if (schemaMissing === 'revoke') {
        throw new Error('relation "presentation_governance_subscriber_tokens" does not exist');
      }
      const id = String(params[0]);
      if (Object.prototype.hasOwnProperty.call(tokenById, id)) {
        return tokenById[id] ?? null;
      }
      return null;
    }
    return null;
  });

  const dbAll = vi.fn(async (sql: string, _params: unknown[] = []) => {
    if (/FROM\s+presentation_governance_subscriber_tokens/i.test(sql)) {
      if (schemaMissing === 'list') {
        throw new Error('no such table: presentation_governance_subscriber_tokens');
      }
      return tokenRows;
    }
    return [];
  });

  const dbRun = vi.fn(async (sql: string, params: unknown[] = []) => {
    runCalls.push({ sql, params });
    if (schemaMissing === 'revoke' && /UPDATE/i.test(sql)) {
      return { success: false, error: 'relation does not exist' };
    }
    return runResult;
  });

  return {
    dbGet: dbGet as unknown as ServiceOverrides['dbGet'],
    dbAll: dbAll as unknown as ServiceOverrides['dbAll'],
    dbRun: dbRun as unknown as ServiceOverrides['dbRun'],
    now: now ? () => now : undefined,
    runCalls,
  };
}

// ----------------------------------------------------------------------------
// classifyTokenStatus
// ----------------------------------------------------------------------------

describe('classifyTokenStatus', () => {
  it('returns "revoked" when revokedAt is set, even if expired', () => {
    const status = classifyTokenStatus(
      { expiresAt: '2026-01-01T00:00:00.000Z', revokedAt: '2026-02-01T00:00:00.000Z' },
      '2026-05-07T12:00:00.000Z'
    );
    expect(status).toBe('revoked');
  });

  it('returns "expired" when expiresAt is strictly in the past', () => {
    const status = classifyTokenStatus(
      { expiresAt: '2026-04-01T00:00:00.000Z', revokedAt: null },
      '2026-05-07T12:00:00.000Z'
    );
    expect(status).toBe('expired');
  });

  it('returns "active" when expiresAt is in the future and not revoked', () => {
    const status = classifyTokenStatus(
      { expiresAt: '2027-01-01T00:00:00.000Z', revokedAt: null },
      '2026-05-07T12:00:00.000Z'
    );
    expect(status).toBe('active');
  });

  it('treats unparseable expiresAt as active (defensive)', () => {
    expect(
      classifyTokenStatus({ expiresAt: 'not-a-date', revokedAt: null }, '2026-05-07T12:00:00.000Z')
    ).toBe('active');
  });
});

// ----------------------------------------------------------------------------
// normalizeRevocationReason
// ----------------------------------------------------------------------------

describe('normalizeRevocationReason', () => {
  it('rejects non-string input', () => {
    const result = normalizeRevocationReason(undefined);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('reason_required');
  });

  it('rejects empty / whitespace-only strings', () => {
    const result = normalizeRevocationReason('   \n  ');
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('reason_required');
  });

  it('rejects reasons shorter than 5 chars after trim', () => {
    const result = normalizeRevocationReason('  hi  ');
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('reason_too_short');
  });

  it('truncates reasons longer than 500 chars after trim', () => {
    const huge = 'x'.repeat(800);
    const result = normalizeRevocationReason(`  ${huge}  `);
    expect(result.ok).toBe(true);
    expect(result.reason.length).toBe(500);
    expect(result.reason).toBe('x'.repeat(500));
  });

  it('returns canonical trimmed reason on the happy path', () => {
    const result = normalizeRevocationReason('  Subscriber rotation requested by ops  ');
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('Subscriber rotation requested by ops');
    expect(result.errors).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// listSubscriberTokens
// ----------------------------------------------------------------------------

describe('listSubscriberTokens', () => {
  it('returns subscription_not_found when the subscription does not belong to the org', async () => {
    const overrides = makeOverrides({ subscriptionExists: false });
    const result = await listSubscriberTokens(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );
    expect(result.status).toBe('subscription_not_found');
    expect(result.tokens).toBeUndefined();
  });

  it('returns storage_error/migration_pending when the tokens table is missing', async () => {
    const overrides = makeOverrides({ schemaMissing: 'list' });
    const result = await listSubscriberTokens(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );
    expect(result.status).toBe('storage_error');
    expect(result.reason).toBe('migration_pending');
  });

  it('returns ok with revoked-first ordering and respects includeRevoked filter', async () => {
    const tokenRows: TokenRowFixture[] = [
      makeTokenRow({
        id: 'tok_active_old',
        token_prefix: 'old11111',
        issued_at: '2026-03-01T00:00:00.000Z',
      }),
      makeTokenRow({
        id: 'tok_active_new',
        token_prefix: 'new22222',
        issued_at: '2026-04-01T00:00:00.000Z',
      }),
      makeTokenRow({
        id: 'tok_revoked_a',
        token_prefix: 'reva3333',
        issued_at: '2026-02-01T00:00:00.000Z',
        revoked_at: '2026-04-15T00:00:00.000Z',
        revoked_reason: 'Compromised',
      }),
      makeTokenRow({
        id: 'tok_revoked_b',
        token_prefix: 'revb4444',
        issued_at: '2026-02-10T00:00:00.000Z',
        revoked_at: '2026-04-20T00:00:00.000Z',
        revoked_reason: 'Personnel rotation',
      }),
    ];

    const withRevoked = makeOverrides({
      tokenRows,
      now: new Date('2026-05-07T12:00:00.000Z'),
    });
    const withRevokedResult = await listSubscriberTokens(
      { subscriptionId: 'sub_1', organizationId: 'org_acme', includeRevoked: true },
      withRevoked
    );
    expect(withRevokedResult.status).toBe('ok');
    expect(withRevokedResult.tokens).toHaveLength(4);
    const ids = (withRevokedResult.tokens ?? []).map((t) => t.id);
    expect(ids).toEqual(['tok_revoked_b', 'tok_revoked_a', 'tok_active_new', 'tok_active_old']);

    const withoutRevoked = makeOverrides({
      tokenRows,
      now: new Date('2026-05-07T12:00:00.000Z'),
    });
    const withoutRevokedResult = await listSubscriberTokens(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      withoutRevoked
    );
    expect(withoutRevokedResult.status).toBe('ok');
    expect(withoutRevokedResult.tokens?.map((t) => t.id)).toEqual([
      'tok_active_new',
      'tok_active_old',
    ]);
  });

  it('classifies expired vs active tokens against `now`', async () => {
    const overrides = makeOverrides({
      tokenRows: [
        makeTokenRow({
          id: 'tok_expired',
          expires_at: '2026-04-01T00:00:00.000Z',
        }),
        makeTokenRow({
          id: 'tok_active',
          expires_at: '2027-01-01T00:00:00.000Z',
        }),
      ],
      now: new Date('2026-05-07T12:00:00.000Z'),
    });

    const result = await listSubscriberTokens(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );
    expect(result.status).toBe('ok');
    const byId = new Map(result.tokens?.map((t) => [t.id, t]));
    expect(byId.get('tok_expired')?.status).toBe('expired');
    expect(byId.get('tok_active')?.status).toBe('active');
  });

  it('clamps the limit to 1..200 and applies it after sorting', async () => {
    const tokenRows: TokenRowFixture[] = Array.from({ length: 5 }, (_, i) =>
      makeTokenRow({
        id: `tok_${i}`,
        issued_at: `2026-04-0${i + 1}T00:00:00.000Z`,
      })
    );
    const overrides = makeOverrides({
      tokenRows,
      now: new Date('2026-05-07T12:00:00.000Z'),
    });

    const result = await listSubscriberTokens(
      { subscriptionId: 'sub_1', organizationId: 'org_acme', limit: 2 },
      overrides
    );
    expect(result.status).toBe('ok');
    expect(result.tokens).toHaveLength(2);
    expect(result.tokens?.[0].id).toBe('tok_4');
    expect(result.tokens?.[1].id).toBe('tok_3');
  });

  it('never echoes a token_hash field in the result (only token_prefix)', async () => {
    const overrides = makeOverrides({
      tokenRows: [makeTokenRow()],
      now: new Date('2026-05-07T12:00:00.000Z'),
    });
    const result = await listSubscriberTokens(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );
    expect(result.status).toBe('ok');
    const t = result.tokens?.[0];
    expect(t).toBeDefined();
    const tokenRecord: Record<string, unknown> = { ...t };
    expect(tokenRecord.tokenHash).toBeUndefined();
    expect(JSON.stringify(t)).not.toContain('token_hash');
  });

  it('produces JSON-serializable summaries (no Date / Map / class instances)', async () => {
    const overrides = makeOverrides({
      tokenRows: [makeTokenRow({ scope: { read: true, custom: 1 } })],
      now: new Date('2026-05-07T12:00:00.000Z'),
    });
    const result = await listSubscriberTokens(
      { subscriptionId: 'sub_1', organizationId: 'org_acme' },
      overrides
    );
    expect(result.status).toBe('ok');
    expect(() => JSON.parse(JSON.stringify(result.tokens))).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(result.tokens));
    expect(roundTripped[0].scope).toEqual({ read: true, custom: 1 });
  });
});

// ----------------------------------------------------------------------------
// revokeSubscriberToken
// ----------------------------------------------------------------------------

describe('revokeSubscriberToken', () => {
  it('returns invalid_reason when reason is too short', async () => {
    const overrides = makeOverrides({
      tokenById: { tok_1: makeTokenRow({ id: 'tok_1' }) },
    });
    const result = await revokeSubscriberToken(
      {
        tokenId: 'tok_1',
        subscriptionId: 'sub_1',
        organizationId: 'org_acme',
        actorId: 'user_admin',
        reason: 'no',
      },
      overrides
    );
    expect(result.status).toBe('invalid_reason');
    expect(overrides.runCalls).toHaveLength(0);
  });

  it('returns not_found when the token row does not exist for the org', async () => {
    const overrides = makeOverrides({ tokenById: { tok_missing: null } });
    const result = await revokeSubscriberToken(
      {
        tokenId: 'tok_missing',
        subscriptionId: 'sub_1',
        organizationId: 'org_acme',
        actorId: 'user_admin',
        reason: 'Operator-requested kill switch',
      },
      overrides
    );
    expect(result.status).toBe('not_found');
    expect(overrides.runCalls).toHaveLength(0);
  });

  it('returns already_revoked (idempotent) when revoked_at is set', async () => {
    const existing = makeTokenRow({
      id: 'tok_already',
      revoked_at: '2026-04-10T00:00:00.000Z',
      revoked_reason: 'previously killed',
    });
    const overrides = makeOverrides({
      tokenById: { tok_already: existing },
      now: new Date('2026-05-07T12:00:00.000Z'),
    });
    const result = await revokeSubscriberToken(
      {
        tokenId: 'tok_already',
        subscriptionId: 'sub_1',
        organizationId: 'org_acme',
        actorId: 'user_admin',
        reason: 'Operator double-checking',
      },
      overrides
    );
    expect(result.status).toBe('already_revoked');
    expect(result.token?.status).toBe('revoked');
    expect(result.token?.revokedAt).toBe('2026-04-10T00:00:00.000Z');
    expect(result.token?.revokedReason).toBe('previously killed');
    expect(overrides.runCalls).toHaveLength(0);
  });

  it('returns ok with the revoked summary on the happy path', async () => {
    const overrides = makeOverrides({
      tokenById: { tok_1: makeTokenRow({ id: 'tok_1' }) },
      now: new Date('2026-05-07T12:00:00.000Z'),
    });
    const result = await revokeSubscriberToken(
      {
        tokenId: 'tok_1',
        subscriptionId: 'sub_1',
        organizationId: 'org_acme',
        actorId: 'user_admin',
        reason: 'Subscriber rotation requested by ops',
      },
      overrides
    );

    expect(result.status).toBe('ok');
    expect(result.token).toBeDefined();
    expect(result.token?.status).toBe('revoked');
    expect(result.token?.revokedAt).toBe('2026-05-07T12:00:00.000Z');
    expect(result.token?.revokedReason).toBe('Subscriber rotation requested by ops');
    expect(result.token?.scope).toMatchObject({ revoked_by: 'user_admin' });

    expect(overrides.runCalls).toHaveLength(1);
    expect(overrides.runCalls[0].sql).toMatch(/UPDATE\s+presentation_governance_subscriber_tokens/);
    expect(overrides.runCalls[0].sql).toMatch(/revoked_at\s*=\s*\?/);
    expect(overrides.runCalls[0].sql).toMatch(/revoked_reason\s*=\s*\?/);
    expect(overrides.runCalls[0].sql).toMatch(/revoked_at IS NULL/);
  });

  it('never returns the token_hash on the revoked summary', async () => {
    const overrides = makeOverrides({
      tokenById: { tok_1: makeTokenRow({ id: 'tok_1' }) },
      now: new Date('2026-05-07T12:00:00.000Z'),
    });
    const result = await revokeSubscriberToken(
      {
        tokenId: 'tok_1',
        subscriptionId: 'sub_1',
        organizationId: 'org_acme',
        actorId: 'user_admin',
        reason: 'Subscriber rotation requested by ops',
      },
      overrides
    );
    expect(result.status).toBe('ok');
    const serialized = JSON.stringify(result.token);
    expect(serialized).not.toContain('token_hash');
    expect(serialized).not.toContain('tokenHash');
  });
});
