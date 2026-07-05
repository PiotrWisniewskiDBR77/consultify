import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * N+1 fix guard for pmSyncInventoryService.listGovernedIntegrations.
 *
 * Previously the "last sync run" for each integration was fetched with a
 * separate `... ORDER BY started_at DESC LIMIT 1` query PER integration row
 * (one extra round-trip per item — ~150ms each on staging). This pins the fix:
 * regardless of how many integrations are returned, the last-run lookup issues
 * exactly ONE batched query (ROW_NUMBER() over integration_sync_runs), and each
 * integration is still mapped to its own most-recent run.
 */

const dbAll = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAll(...args),
}));

vi.mock('../../../server/src/services/integrationHubService.js', () => ({
  CONNECTORS: {},
}));

vi.mock('../../../server/src/services/v8/pmSyncAuthService.js', () => ({
  getCredential: vi.fn(async () => null),
}));

vi.mock('../../../server/src/services/v8/pmSyncExternalAuthMaterializationService.js', () => ({
  getGovernedExternalAuthConfigFields: vi.fn((_id: string, base: unknown[]) => base ?? []),
}));

vi.mock('../../../server/src/services/v8/pmSyncTruthService.js', () => ({
  getConnectorHealth: vi.fn(async () => ({
    authState: 'connected',
    syncStatus: 'synced',
    healthy: true,
    conflictCount: 0,
    lastSyncAt: null,
  })),
}));

function integrationRow(id: string) {
  return {
    id,
    organization_id: 'org-1',
    connector_id: `connector-${id}`,
    name: `Integration ${id}`,
    category: 'collaboration',
    status: 'active',
    config: null,
    capabilities: null,
    auth_type: 'oauth2',
    sync_settings: null,
    last_sync_at: null,
    last_error: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('pmSyncInventoryService last-run batching (N+1 fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches last runs in ONE batched query and maps each to its integration', async () => {
    // First dbAll call = the integrations list; second = the batched last-run query.
    dbAll
      .mockResolvedValueOnce([integrationRow('int-a'), integrationRow('int-b')])
      .mockResolvedValueOnce([
        {
          id: 'run-a',
          integration_id: 'int-a',
          status: 'success',
          items_processed: 5,
          duration_ms: 100,
          started_at: '2026-02-02T00:00:00Z',
          completed_at: '2026-02-02T00:01:00Z',
          error_summary: null,
        },
        {
          id: 'run-b',
          integration_id: 'int-b',
          status: 'error',
          items_processed: 0,
          duration_ms: 50,
          started_at: '2026-02-01T00:00:00Z',
          completed_at: null,
          error_summary: 'boom',
        },
      ]);

    const { listGovernedIntegrations } = await import(
      '../../../server/src/services/v8/pmSyncInventoryService.js'
    );

    const result = await listGovernedIntegrations('org-1');

    // Exactly two dbAll calls total: list + ONE batched last-run query (not 1 per row).
    expect(dbAll).toHaveBeenCalledTimes(2);

    // The batched query must target integration_sync_runs with an IN (...) list
    // scoped by organization, and use ROW_NUMBER to keep the latest per integration.
    const secondSql = String(dbAll.mock.calls[1][0]);
    expect(secondSql).toMatch(/integration_sync_runs/);
    expect(secondSql).toMatch(/ROW_NUMBER\(\)/i);
    expect(secondSql).toMatch(/integration_id IN \(/);
    const secondParams = dbAll.mock.calls[1][1] as unknown[];
    expect(secondParams).toEqual(['org-1', 'int-a', 'int-b']);

    // Each integration is mapped to its own most-recent run.
    const byId = Object.fromEntries(result.map((r) => [r.id, r]));
    expect(byId['int-a'].lastRun?.id).toBe('run-a');
    expect(byId['int-b'].lastRun?.id).toBe('run-b');
    // The integration_id helper column must not leak into the SyncRunRow.
    expect((byId['int-a'].lastRun as any).integration_id).toBeUndefined();
  });

  it('returns null lastRun for integrations with no runs, still one batched query', async () => {
    dbAll
      .mockResolvedValueOnce([integrationRow('int-a'), integrationRow('int-b')])
      .mockResolvedValueOnce([
        {
          id: 'run-a',
          integration_id: 'int-a',
          status: 'success',
          items_processed: 1,
          duration_ms: 10,
          started_at: '2026-02-02T00:00:00Z',
          completed_at: '2026-02-02T00:00:10Z',
          error_summary: null,
        },
      ]);

    const { listGovernedIntegrations } = await import(
      '../../../server/src/services/v8/pmSyncInventoryService.js'
    );

    const result = await listGovernedIntegrations('org-1');
    expect(dbAll).toHaveBeenCalledTimes(2);
    const byId = Object.fromEntries(result.map((r) => [r.id, r]));
    expect(byId['int-a'].lastRun?.id).toBe('run-a');
    expect(byId['int-b'].lastRun).toBeNull();
  });

  it('does not issue the last-run query when there are no integrations', async () => {
    dbAll.mockResolvedValueOnce([]);

    const { listGovernedIntegrations } = await import(
      '../../../server/src/services/v8/pmSyncInventoryService.js'
    );

    const result = await listGovernedIntegrations('org-1');
    expect(result).toEqual([]);
    // Only the list query ran; the batched last-run query is skipped for an empty set.
    expect(dbAll).toHaveBeenCalledTimes(1);
  });
});
