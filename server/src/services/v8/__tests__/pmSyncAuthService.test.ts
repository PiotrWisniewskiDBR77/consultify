import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  RecordAdminReBindParams,
  RecordRefreshResultParams,
  SetRefreshTimingPolicyParams,
  StoreCredentialParams,
} from '../../../types/pmSyncAuthBaseline.js';
import {
  AdminReBindRecordSchema,
  AUTH_BREAK_FAILURE_TYPES,
  AuthBreakFailureTypeValues,
  ConnectionCredentialRefSchema,
  DEFAULT_ESCALATION_LADDER,
  EscalationLevelValues,
  FailureActionValues,
  LastRefreshResultValues,
  ProviderFamilyValues,
  RecordAdminReBindParamsSchema,
  RecordRefreshResultParamsSchema,
  RefreshTimingPolicySchema,
  SetRefreshTimingPolicyParamsSchema,
  StoreCredentialParamsSchema,
  TRANSIENT_FAILURE_TYPES,
  TransientFailureTypeValues,
} from '../../../types/pmSyncAuthBaseline.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  checkEscalationLevel,
  classifyFailure,
  getActiveEscalations,
  getCredential,
  getCredentialHealth,
  getReBindHistory,
  getRefreshTimingPolicy,
  recordAdminReBind,
  recordAuthEscalation,
  recordRefreshResult,
  resolveAuthEscalation,
  resolveAuthEscalationsForConnector,
  setRefreshTimingPolicy,
  storeCredential,
} from '../pmSyncAuthService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ORG_ID_2 = '00000000-0000-4000-8000-000000000099';
const CONNECTOR_ID = 'jira-connector-1';
const CONNECTOR_ID_2 = 'asana-connector-1';
const ACTOR_ID = 'admin-user-1';
const CRED_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const CRED_ID_2 = '00000000-0000-4000-8000-bbbbbbbbbbbb';
const POLICY_ID = '00000000-0000-4000-8000-cccccccccccc';

function makeStoreCredentialParams(
  overrides?: Partial<StoreCredentialParams>
): StoreCredentialParams {
  return {
    connectorId: CONNECTOR_ID,
    organizationId: ORG_ID,
    providerAccountId: 'provider-acct-123',
    workspaceOrTenantId: 'workspace-456',
    scopesGranted: ['read:jira-work', 'write:jira-work'],
    tokenExpiresAt: '2026-03-23T11:00:00.000Z',
    ...overrides,
  };
}

function makeCredentialRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    credential_id: CRED_ID,
    connector_id: CONNECTOR_ID,
    organization_id: ORG_ID,
    provider_account_id: 'provider-acct-123',
    workspace_or_tenant_id: 'workspace-456',
    scopes_granted: JSON.stringify(['read:jira-work', 'write:jira-work']),
    token_expires_at: '2026-03-23T11:00:00.000Z',
    last_verification_at: '2026-03-23T10:00:00.000Z',
    last_refresh_at: '2026-03-23T10:30:00.000Z',
    last_refresh_result: 'success',
    created_at: '2026-03-23T09:00:00.000Z',
    updated_at: '2026-03-23T10:30:00.000Z',
    ...overrides,
  };
}

function makePolicyRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    policy_id: POLICY_ID,
    provider_family: 'atlassian',
    organization_id: ORG_ID,
    typical_token_lifetime_minutes: 60,
    refresh_window_minutes: 10,
    max_retry_attempts: 3,
    created_at: '2026-03-23T09:00:00.000Z',
    updated_at: '2026-03-23T09:00:00.000Z',
    ...overrides,
  };
}

function makeReBindRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    rebind_id: '00000000-0000-4000-8000-dddddddddddd',
    connector_id: CONNECTOR_ID,
    organization_id: ORG_ID,
    old_credential_ref: CRED_ID,
    new_credential_ref: CRED_ID_2,
    actor_id: ACTOR_ID,
    reason: 'Original user left the organization',
    audit_timestamp: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

function makeAuthStateRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    auth_state: 'degraded_reauth_needed',
    transitioned_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function makeEscalationRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    escalation_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    organization_id: ORG_ID,
    connector_id: CONNECTOR_ID,
    reason: 'token expired',
    escalated_at: '2026-03-23T12:00:00.000Z',
    resolved_at: null,
    resolved_by: null,
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------
// CREDENTIAL STORAGE
// ------------------------------------------

describe('storeCredential', () => {
  it('creates a new credential reference', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await storeCredential(makeStoreCredentialParams());

    expect(result.connectorId).toBe(CONNECTOR_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.providerAccountId).toBe('provider-acct-123');
    expect(result.workspaceOrTenantId).toBe('workspace-456');
    expect(result.scopesGranted).toEqual(['read:jira-work', 'write:jira-work']);
    expect(result.tokenExpiresAt).toBe('2026-03-23T11:00:00.000Z');
    expect(result.lastRefreshAt).toBeNull();
    expect(result.lastRefreshResult).toBeNull();
    expect(result.credentialId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('updates an existing credential reference (upsert)', async () => {
    mockDbGet.mockResolvedValueOnce(makeCredentialRow());

    const result = await storeCredential(
      makeStoreCredentialParams({
        providerAccountId: 'new-acct-789',
        scopesGranted: ['read:jira-work'],
      })
    );

    expect(result.credentialId).toBe(CRED_ID);
    expect(result.providerAccountId).toBe('new-acct-789');
    expect(result.scopesGranted).toEqual(['read:jira-work']);
    expect(result.lastRefreshAt).toBe('2026-03-23T10:30:00.000Z');
    expect(result.lastRefreshResult).toBe('success');
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE');
  });

  it('stores credential with null tokenExpiresAt', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await storeCredential(makeStoreCredentialParams({ tokenExpiresAt: null }));

    expect(result.tokenExpiresAt).toBeNull();
  });

  it('rejects empty scopesGranted via Zod', async () => {
    await expect(storeCredential(makeStoreCredentialParams({ scopesGranted: [] }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects empty connectorId via Zod', async () => {
    await expect(storeCredential(makeStoreCredentialParams({ connectorId: '' }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(
      storeCredential(makeStoreCredentialParams({ organizationId: 'not-a-uuid' }))
    ).rejects.toThrow(ZodError);
  });
});

describe('getCredential', () => {
  it('returns credential with parsed scopes', async () => {
    mockDbGet.mockResolvedValueOnce(makeCredentialRow());

    const result = await getCredential(CONNECTOR_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.credentialId).toBe(CRED_ID);
    expect(result!.scopesGranted).toEqual(['read:jira-work', 'write:jira-work']);
    expect(result!.lastRefreshResult).toBe('success');
  });

  it('returns null when no credential exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getCredential(CONNECTOR_ID, ORG_ID);
    expect(result).toBeNull();
  });

  it('handles malformed scopes JSON gracefully', async () => {
    mockDbGet.mockResolvedValueOnce(makeCredentialRow({ scopes_granted: 'not-json' }));

    const result = await getCredential(CONNECTOR_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(result!.scopesGranted).toEqual([]);
  });
});

// ------------------------------------------
// REFRESH RESULT TRACKING
// ------------------------------------------

describe('recordRefreshResult', () => {
  it('records a successful refresh', async () => {
    mockDbGet.mockResolvedValueOnce(makeCredentialRow());

    const result = await recordRefreshResult({
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      result: 'success',
    });

    expect(result.lastRefreshResult).toBe('success');
    expect(result.lastRefreshAt).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('records a transient_failure refresh result', async () => {
    mockDbGet.mockResolvedValueOnce(makeCredentialRow());

    const result = await recordRefreshResult({
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      result: 'transient_failure',
    });

    expect(result.lastRefreshResult).toBe('transient_failure');
  });

  it('records a credential_expired refresh result', async () => {
    mockDbGet.mockResolvedValueOnce(makeCredentialRow());

    const result = await recordRefreshResult({
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      result: 'credential_expired',
    });

    expect(result.lastRefreshResult).toBe('credential_expired');
  });

  it('records a scope_revoked refresh result', async () => {
    mockDbGet.mockResolvedValueOnce(makeCredentialRow());

    const result = await recordRefreshResult({
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      result: 'scope_revoked',
    });

    expect(result.lastRefreshResult).toBe('scope_revoked');
  });

  it('throws when no credential exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      recordRefreshResult({
        connectorId: 'nonexistent',
        organizationId: ORG_ID,
        result: 'success',
      })
    ).rejects.toThrow('No credential found');
  });

  it('rejects invalid result via Zod', async () => {
    await expect(
      recordRefreshResult({
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        result: 'invalid_result' as any,
      })
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// FAILURE CLASSIFICATION (Decision W5-2)
// ------------------------------------------

describe('classifyFailure', () => {
  describe('transient failures → retry_later', () => {
    it('classifies network_timeout as retry_later', () => {
      expect(classifyFailure('network_timeout')).toBe('retry_later');
    });

    it('classifies rate_limit as retry_later', () => {
      expect(classifyFailure('rate_limit')).toBe('retry_later');
    });

    it('classifies transient_5xx as retry_later', () => {
      expect(classifyFailure('transient_5xx')).toBe('retry_later');
    });

    it('classifies temporary_outage as retry_later', () => {
      expect(classifyFailure('temporary_outage')).toBe('retry_later');
    });

    it('classifies webhook_delivery_issue as retry_later', () => {
      expect(classifyFailure('webhook_delivery_issue')).toBe('retry_later');
    });
  });

  describe('auth break failures → reauth_now', () => {
    it('classifies expired_token as reauth_now', () => {
      expect(classifyFailure('expired_token')).toBe('reauth_now');
    });

    it('classifies revoked_token as reauth_now', () => {
      expect(classifyFailure('revoked_token')).toBe('reauth_now');
    });

    it('classifies missing_scope as reauth_now', () => {
      expect(classifyFailure('missing_scope')).toBe('reauth_now');
    });

    it('classifies invalid_refresh as reauth_now', () => {
      expect(classifyFailure('invalid_refresh')).toBe('reauth_now');
    });

    it('classifies account_disconnected as reauth_now', () => {
      expect(classifyFailure('account_disconnected')).toBe('reauth_now');
    });

    it('classifies user_removed as reauth_now', () => {
      expect(classifyFailure('user_removed')).toBe('reauth_now');
    });
  });

  it('defaults unknown failure types to reauth_now (safe fallback)', () => {
    expect(classifyFailure('unknown_error')).toBe('reauth_now');
  });

  it('covers all 5 transient failure types', () => {
    for (const ft of TransientFailureTypeValues) {
      expect(classifyFailure(ft)).toBe('retry_later');
    }
  });

  it('covers all 6 auth break failure types', () => {
    for (const ft of AuthBreakFailureTypeValues) {
      expect(classifyFailure(ft)).toBe('reauth_now');
    }
  });
});

// ------------------------------------------
// ESCALATION LADDER (Decision W5-3)
// ------------------------------------------

describe('checkEscalationLevel', () => {
  it('returns healthy when no auth state exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('healthy');
  });

  it('returns healthy when connector is in healthy state', async () => {
    mockDbGet.mockResolvedValueOnce(makeAuthStateRow({ auth_state: 'healthy' }));

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('healthy');
  });

  it('returns healthy when degraded for less than 4 hours', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeAuthStateRow({
        auth_state: 'degraded_reauth_needed',
        transitioned_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      })
    );

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('healthy');
  });

  it('returns degraded when degraded for 4-24 hours', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeAuthStateRow({
        auth_state: 'degraded_reauth_needed',
        transitioned_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      })
    );

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('degraded');
  });

  it('returns critical when degraded for 24-72 hours', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeAuthStateRow({
        auth_state: 'degraded_reauth_needed',
        transitioned_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      })
    );

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('critical');
  });

  it('returns disconnected_candidate when degraded for >72 hours', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeAuthStateRow({
        auth_state: 'degraded_reauth_needed',
        transitioned_at: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(),
      })
    );

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('disconnected_candidate');
  });

  it('handles degraded_scope_limited as degraded state', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeAuthStateRow({
        auth_state: 'degraded_scope_limited',
        transitioned_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      })
    );

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('degraded');
  });

  it('returns healthy for non-degraded states (connecting)', async () => {
    mockDbGet.mockResolvedValueOnce(makeAuthStateRow({ auth_state: 'connecting' }));

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('healthy');
  });

  it('returns healthy for suspended state', async () => {
    mockDbGet.mockResolvedValueOnce(makeAuthStateRow({ auth_state: 'suspended' }));

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('healthy');
  });

  it('returns degraded at exact 4h boundary', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeAuthStateRow({
        auth_state: 'degraded_reauth_needed',
        transitioned_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      })
    );

    const result = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(result).toBe('degraded');
  });
});

// ------------------------------------------
// REFRESH TIMING POLICIES
// ------------------------------------------

describe('setRefreshTimingPolicy', () => {
  it('creates a new refresh timing policy', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setRefreshTimingPolicy({
      providerFamily: 'atlassian',
      organizationId: ORG_ID,
      typicalTokenLifetimeMinutes: 60,
      refreshWindowMinutes: 10,
      maxRetryAttempts: 3,
    });

    expect(result.providerFamily).toBe('atlassian');
    expect(result.typicalTokenLifetimeMinutes).toBe(60);
    expect(result.refreshWindowMinutes).toBe(10);
    expect(result.maxRetryAttempts).toBe(3);
    expect(result.policyId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('updates an existing refresh timing policy (upsert)', async () => {
    mockDbGet.mockResolvedValueOnce(makePolicyRow());

    const result = await setRefreshTimingPolicy({
      providerFamily: 'atlassian',
      organizationId: ORG_ID,
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
    });

    expect(result.policyId).toBe(POLICY_ID);
    expect(result.typicalTokenLifetimeMinutes).toBe(120);
    expect(result.refreshWindowMinutes).toBe(15);
    expect(result.maxRetryAttempts).toBe(5);
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE');
  });

  it('supports all 7 provider families', async () => {
    for (const family of ProviderFamilyValues) {
      expect(() =>
        SetRefreshTimingPolicyParamsSchema.parse({
          providerFamily: family,
          organizationId: ORG_ID,
          typicalTokenLifetimeMinutes: 60,
          refreshWindowMinutes: 10,
          maxRetryAttempts: 3,
        })
      ).not.toThrow();
    }
  });

  it('rejects invalid provider family via Zod', async () => {
    await expect(
      setRefreshTimingPolicy({
        providerFamily: 'invalid_provider' as any,
        organizationId: ORG_ID,
        typicalTokenLifetimeMinutes: 60,
        refreshWindowMinutes: 10,
        maxRetryAttempts: 3,
      })
    ).rejects.toThrow(ZodError);
  });

  it('rejects zero refreshWindowMinutes via Zod', async () => {
    await expect(
      setRefreshTimingPolicy({
        providerFamily: 'atlassian',
        organizationId: ORG_ID,
        typicalTokenLifetimeMinutes: 60,
        refreshWindowMinutes: 0,
        maxRetryAttempts: 3,
      })
    ).rejects.toThrow(ZodError);
  });

  it('rejects zero maxRetryAttempts via Zod', async () => {
    await expect(
      setRefreshTimingPolicy({
        providerFamily: 'atlassian',
        organizationId: ORG_ID,
        typicalTokenLifetimeMinutes: 60,
        refreshWindowMinutes: 10,
        maxRetryAttempts: 0,
      })
    ).rejects.toThrow(ZodError);
  });

  it('accepts non-UUID organizationId values for staging tenants', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setRefreshTimingPolicy({
      providerFamily: 'atlassian',
      organizationId: 'dbr77',
      typicalTokenLifetimeMinutes: 120,
      refreshWindowMinutes: 15,
      maxRetryAttempts: 5,
    });

    expect(result.organizationId).toBe('dbr77');
    expect(mockDbRun).toHaveBeenCalledOnce();
  });
});

describe('getRefreshTimingPolicy', () => {
  it('returns a policy for a provider family', async () => {
    mockDbGet.mockResolvedValueOnce(makePolicyRow());

    const result = await getRefreshTimingPolicy('atlassian', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.providerFamily).toBe('atlassian');
    expect(result!.typicalTokenLifetimeMinutes).toBe(60);
    expect(result!.refreshWindowMinutes).toBe(10);
  });

  it('returns null when no policy exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getRefreshTimingPolicy('linear', ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// ADMIN RE-BIND (Decision W5-1)
// ------------------------------------------

describe('recordAdminReBind', () => {
  it('records an admin re-bind event', async () => {
    const result = await recordAdminReBind({
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      oldCredentialRef: CRED_ID,
      newCredentialRef: CRED_ID_2,
      actorId: ACTOR_ID,
      reason: 'Original user left the organization',
    });

    expect(result.connectorId).toBe(CONNECTOR_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.oldCredentialRef).toBe(CRED_ID);
    expect(result.newCredentialRef).toBe(CRED_ID_2);
    expect(result.actorId).toBe(ACTOR_ID);
    expect(result.reason).toBe('Original user left the organization');
    expect(result.reBindId).toBeDefined();
    expect(result.auditTimestamp).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('captures audit timestamp on creation', async () => {
    const before = new Date().toISOString();

    const result = await recordAdminReBind({
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      oldCredentialRef: CRED_ID,
      newCredentialRef: CRED_ID_2,
      actorId: ACTOR_ID,
      reason: 'Credential rotation policy',
    });

    const after = new Date().toISOString();
    expect(result.auditTimestamp >= before).toBe(true);
    expect(result.auditTimestamp <= after).toBe(true);
  });

  it('rejects empty reason via Zod', async () => {
    await expect(
      recordAdminReBind({
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        oldCredentialRef: CRED_ID,
        newCredentialRef: CRED_ID_2,
        actorId: ACTOR_ID,
        reason: '',
      })
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty actorId via Zod', async () => {
    await expect(
      recordAdminReBind({
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        oldCredentialRef: CRED_ID,
        newCredentialRef: CRED_ID_2,
        actorId: '',
        reason: 'Some reason',
      })
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid oldCredentialRef (not UUID) via Zod', async () => {
    await expect(
      recordAdminReBind({
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        oldCredentialRef: 'not-a-uuid',
        newCredentialRef: CRED_ID_2,
        actorId: ACTOR_ID,
        reason: 'Some reason',
      })
    ).rejects.toThrow(ZodError);
  });
});

describe('getReBindHistory', () => {
  it('returns re-bind history ordered by most recent', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeReBindRow({ audit_timestamp: '2026-03-23T14:00:00.000Z' }),
      makeReBindRow({
        rebind_id: 'rebind-2',
        audit_timestamp: '2026-03-23T12:00:00.000Z',
        reason: 'Earlier re-bind',
      }),
    ]);

    const results = await getReBindHistory(CONNECTOR_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].auditTimestamp).toBe('2026-03-23T14:00:00.000Z');
    expect(results[1].reason).toBe('Earlier re-bind');
  });

  it('returns empty array when no re-bind history exists', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const results = await getReBindHistory(CONNECTOR_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('credential and auth escalation health', () => {
  it('getCredentialHealth counts credentials and unresolved auth escalations', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeCredentialRow({ last_refresh_result: 'success' }),
      makeCredentialRow({
        credential_id: CRED_ID_2,
        last_refresh_result: 'credential_expired',
      }),
    ]);
    mockDbGet.mockResolvedValueOnce({ n: 1 });

    const result = await getCredentialHealth(ORG_ID);

    expect(result).toEqual({
      total: 2,
      healthy: 1,
      failing: 1,
      escalated: 1,
    });
  });

  it('getActiveEscalations returns unresolved auth escalations', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeEscalationRow(),
      makeEscalationRow({
        escalation_id: '00000000-0000-4000-8000-ffffffffffff',
        connector_id: CONNECTOR_ID_2,
      }),
    ]);

    const result = await getActiveEscalations(ORG_ID);

    expect(result).toHaveLength(2);
    expect(result[0].escalationId).toBe('00000000-0000-4000-8000-eeeeeeeeeeee');
    expect(result[1].connectorId).toBe(CONNECTOR_ID_2);
  });

  it('recordAuthEscalation inserts a new unresolved auth escalation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await recordAuthEscalation(CONNECTOR_ID, ORG_ID, 'credential_expired');

    expect(result.connectorId).toBe(CONNECTOR_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.reason).toBe('credential_expired');
    expect(result.resolvedAt).toBeNull();
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO v8_auth_escalations'),
      expect.arrayContaining([ORG_ID, CONNECTOR_ID, 'credential_expired'])
    );
  });

  it('recordAuthEscalation reuses an unresolved escalation for the same connector and org', async () => {
    mockDbGet.mockResolvedValueOnce(makeEscalationRow({ reason: 'credential_expired' }));

    const result = await recordAuthEscalation(CONNECTOR_ID, ORG_ID, 'scope_revoked');

    expect(result.escalationId).toBe('00000000-0000-4000-8000-eeeeeeeeeeee');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('resolveAuthEscalation resolves an active auth escalation', async () => {
    mockDbGet.mockResolvedValueOnce(makeEscalationRow());

    const result = await resolveAuthEscalation(
      '00000000-0000-4000-8000-eeeeeeeeeeee',
      ACTOR_ID,
      ORG_ID
    );

    expect(result.resolvedBy).toBe(ACTOR_ID);
    expect(result.resolvedAt).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('resolveAuthEscalation scopes queries by organization', async () => {
    mockDbGet.mockResolvedValueOnce(makeEscalationRow());

    await resolveAuthEscalation('00000000-0000-4000-8000-eeeeeeeeeeee', ACTOR_ID, ORG_ID);

    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('organization_id = ?'),
      ['00000000-0000-4000-8000-eeeeeeeeeeee', ORG_ID],
      { fallback: true }
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id = ?'),
      expect.arrayContaining([ACTOR_ID, '00000000-0000-4000-8000-eeeeeeeeeeee', ORG_ID])
    );
  });

  it('resolveAuthEscalation throws when escalation does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(resolveAuthEscalation('missing-escalation', ACTOR_ID, ORG_ID)).rejects.toThrow(
      'not found'
    );
  });

  it('resolveAuthEscalation throws when escalation is already resolved', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeEscalationRow({
        resolved_at: '2026-03-23T13:00:00.000Z',
        resolved_by: ACTOR_ID,
      })
    );

    await expect(
      resolveAuthEscalation('00000000-0000-4000-8000-eeeeeeeeeeee', ACTOR_ID, ORG_ID)
    ).rejects.toThrow('already resolved');
  });

  it('resolveAuthEscalationsForConnector resolves all active escalations for connector and org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeEscalationRow(),
      makeEscalationRow({
        escalation_id: '00000000-0000-4000-8000-ffffffffffff',
        connector_id: CONNECTOR_ID,
        organization_id: ORG_ID,
      }),
    ]);

    const result = await resolveAuthEscalationsForConnector(CONNECTOR_ID, ACTOR_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(result[0]?.resolvedBy).toBe(ACTOR_ID);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining(
        'WHERE connector_id = ? AND organization_id = ? AND resolved_at IS NULL'
      ),
      expect.arrayContaining([ACTOR_ID, CONNECTOR_ID, ORG_ID])
    );
  });

  it('resolveAuthEscalationsForConnector returns empty array when connector has no active escalations', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await resolveAuthEscalationsForConnector(CONNECTOR_ID, ACTOR_ID, ORG_ID);

    expect(result).toEqual([]);
    expect(mockDbRun).not.toHaveBeenCalled();
  });
});

// ------------------------------------------
// ORG ISOLATION
// ------------------------------------------

describe('org isolation', () => {
  it('credential queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getCredential(CONNECTOR_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('refresh policy queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getRefreshTimingPolicy('atlassian', ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('re-bind history queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getReBindHistory(CONNECTOR_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('escalation check queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await checkEscalationLevel(CONNECTOR_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('storeCredential uses org-scoped upsert', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await storeCredential(makeStoreCredentialParams());

    const selectQuery = mockDbGet.mock.calls[0][0] as string;
    expect(selectQuery).toContain('organization_id');
  });
});

// ------------------------------------------
// ZOD SCHEMA VALIDATION
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates ConnectionCredentialRef', () => {
    expect(() =>
      ConnectionCredentialRefSchema.parse({
        credentialId: CRED_ID,
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        providerAccountId: 'acct-1',
        workspaceOrTenantId: 'ws-1',
        scopesGranted: ['read'],
        tokenExpiresAt: '2026-03-23T11:00:00.000Z',
        lastVerificationAt: null,
        lastRefreshAt: null,
        lastRefreshResult: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates RefreshTimingPolicy', () => {
    expect(() =>
      RefreshTimingPolicySchema.parse({
        policyId: POLICY_ID,
        providerFamily: 'atlassian',
        organizationId: ORG_ID,
        typicalTokenLifetimeMinutes: 60,
        refreshWindowMinutes: 10,
        maxRetryAttempts: 3,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates AdminReBindRecord', () => {
    expect(() =>
      AdminReBindRecordSchema.parse({
        reBindId: '00000000-0000-4000-8000-dddddddddddd',
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        oldCredentialRef: CRED_ID,
        newCredentialRef: CRED_ID_2,
        actorId: ACTOR_ID,
        reason: 'User left org',
        auditTimestamp: '2026-03-23T12:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates all 4 LastRefreshResult values', () => {
    expect(LastRefreshResultValues).toHaveLength(4);
    expect(LastRefreshResultValues).toContain('success');
    expect(LastRefreshResultValues).toContain('transient_failure');
    expect(LastRefreshResultValues).toContain('credential_expired');
    expect(LastRefreshResultValues).toContain('scope_revoked');
  });

  it('validates all 5 TransientFailureType values', () => {
    expect(TransientFailureTypeValues).toHaveLength(5);
  });

  it('validates all 6 AuthBreakFailureType values', () => {
    expect(AuthBreakFailureTypeValues).toHaveLength(6);
  });

  it('validates all 4 EscalationLevel values', () => {
    expect(EscalationLevelValues).toHaveLength(4);
  });

  it('validates all 7 ProviderFamily values', () => {
    expect(ProviderFamilyValues).toHaveLength(7);
  });

  it('validates all 2 FailureAction values', () => {
    expect(FailureActionValues).toHaveLength(2);
    expect(FailureActionValues).toContain('retry_later');
    expect(FailureActionValues).toContain('reauth_now');
  });
});

// ------------------------------------------
// DEFAULT ESCALATION LADDER (Decision W5-3)
// ------------------------------------------

describe('DEFAULT_ESCALATION_LADDER', () => {
  it('has degradedThresholdHours = 4', () => {
    expect(DEFAULT_ESCALATION_LADDER.degradedThresholdHours).toBe(4);
  });

  it('has criticalThresholdHours = 24', () => {
    expect(DEFAULT_ESCALATION_LADDER.criticalThresholdHours).toBe(24);
  });

  it('has disconnectedCandidateHours = 72', () => {
    expect(DEFAULT_ESCALATION_LADDER.disconnectedCandidateHours).toBe(72);
  });
});

// ------------------------------------------
// FAILURE CLASSIFICATION MAPS (Decision W5-2)
// ------------------------------------------

describe('failure classification maps', () => {
  it('TRANSIENT_FAILURE_TYPES contains all 5 transient types', () => {
    expect(TRANSIENT_FAILURE_TYPES.size).toBe(5);
    for (const ft of TransientFailureTypeValues) {
      expect(TRANSIENT_FAILURE_TYPES.has(ft)).toBe(true);
    }
  });

  it('AUTH_BREAK_FAILURE_TYPES contains all 6 auth break types', () => {
    expect(AUTH_BREAK_FAILURE_TYPES.size).toBe(6);
    for (const ft of AuthBreakFailureTypeValues) {
      expect(AUTH_BREAK_FAILURE_TYPES.has(ft)).toBe(true);
    }
  });

  it('transient and auth break sets are disjoint', () => {
    for (const ft of TransientFailureTypeValues) {
      expect(AUTH_BREAK_FAILURE_TYPES.has(ft)).toBe(false);
    }
    for (const ft of AuthBreakFailureTypeValues) {
      expect(TRANSIENT_FAILURE_TYPES.has(ft)).toBe(false);
    }
  });
});
