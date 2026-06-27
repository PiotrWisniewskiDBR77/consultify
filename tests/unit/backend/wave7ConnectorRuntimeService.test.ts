import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  connectors: new Map<string, Row>(),
  runs: new Map<string, Row>(),
  airuns: new Map<string, Row>(),
  uuidCounter: 0,
}));

function nextUuid() {
  db.uuidCounter += 1;
  return `wave7-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({
  v4: () => nextUuid(),
}));

vi.mock('../../../server/src/services/integrationHubService.js', () => ({
  CONNECTORS: {
    google_drive: {
      id: 'google_drive',
      name: 'Google Drive',
      category: 'cloud_storage',
      capabilities: ['files', 'folders'],
      authType: 'oauth2',
      configFields: [],
    },
    jira: {
      id: 'jira',
      name: 'Jira',
      category: 'project_management',
      capabilities: ['issues', 'projects'],
      authType: 'oauth2',
      configFields: ['site_url'],
    },
  },
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    query: async (sql: string, params: any[] = []) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      if (normalized.includes('FROM tp_connectors')) {
        if (params[0] === 'tp-connector-1' && params[1] === 'org-1') {
          return {
            rows: [
              {
                id: 'tp-connector-1',
                organization_id: 'org-1',
                name: 'Jira production connector',
                connector_type: 'jira',
                config: { token: 'test' },
              },
            ],
          };
        }
        return { rows: [] };
      }
      throw new Error(`Unhandled getDatabase SQL: ${normalized}`);
    },
  }),
}));

vi.mock('../../../server/src/services/dataCollection/index.js', () => ({
  connectorRegistry: {
    get: () => ({
      fetchRecords: async () => [
        {
          externalId: 'issue-1',
          data: { key: 'DRD-1', summary: 'Real connector-backed issue' },
        },
        {
          externalId: 'issue-2',
          data: { key: 'OTHER-2', summary: 'Should be filtered out' },
        },
      ],
    }),
  },
  connectorRunner: {
    run: async (connectorId: string) => ({
      runId: `runner-${connectorId}`,
      status: 'success',
      recordsFetched: 2,
      recordsImported: 2,
      recordsSkipped: 0,
      recordsFailed: 0,
      errors: [],
      durationMs: 10,
    }),
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (
      normalized.startsWith('CREATE TABLE') ||
      normalized.startsWith('CREATE INDEX') ||
      normalized.startsWith('ALTER TABLE')
    ) {
      return { changes: 0 };
    }
    if (normalized.startsWith('INSERT INTO wave7_connectors')) {
      const [
        connectorId,
        organizationId,
        provider,
        displayName,
        status,
        authState,
        scopesJson,
        projectIdsJson,
        ownerUserId,
        tenantPolicyJson,
        lastSyncAt,
        tokenExpiresAt,
        reconnectRequired,
        accessRevokedAt,
        revokedReason,
        freshnessTtlMinutes,
        failureState,
      ] = params;
      db.connectors.set(connectorId, {
        connector_id: connectorId,
        organization_id: organizationId,
        provider,
        display_name: displayName,
        status,
        auth_state: authState,
        scopes_json: scopesJson,
        project_ids_json: projectIdsJson,
        owner_user_id: ownerUserId,
        tenant_policy_json: tenantPolicyJson,
        last_sync_at: lastSyncAt,
        token_expires_at: tokenExpiresAt,
        reconnect_required: reconnectRequired,
        access_revoked_at: accessRevokedAt,
        revoked_reason: revokedReason,
        freshness_ttl_minutes: freshnessTtlMinutes,
        failure_state: failureState,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave7_connector_runs')) {
      const [
        runId,
        organizationId,
        connectorId,
        userId,
        projectId,
        toolName,
        toolKind,
        status,
        query,
        aiRunId,
        sourceTraceJson,
        aclDecisionJson,
        freshnessWarning,
        error,
        completedAt,
      ] = params;
      db.runs.set(runId, {
        run_id: runId,
        organization_id: organizationId,
        connector_id: connectorId,
        user_id: userId,
        project_id: projectId,
        tool_name: toolName,
        tool_kind: toolKind,
        status,
        query,
        ai_run_id: aiRunId,
        source_trace_json: sourceTraceJson,
        acl_decision_json: aclDecisionJson,
        freshness_warning: freshnessWarning,
        error,
        created_at: new Date().toISOString(),
        completed_at: completedAt,
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('UPDATE wave7_connectors')) {
      const [
        status,
        authStatusA,
        authRevokedAt,
        authStatusB,
        projectIdsJson,
        tenantPolicyJson,
        failureState,
        tokenExpiresAt,
        reconnectRequired,
        accessRevokedAt,
        revokedReason,
        lastSyncAt,
        connectorId,
        organizationId,
      ] = params;
      const row = db.connectors.get(connectorId);
      if (!row || row.organization_id !== organizationId) return { changes: 0 };
      if (status) row.status = status;
      if (authStatusA === 'connected') row.auth_state = 'authorized';
      if (authRevokedAt) row.auth_state = 'revoked';
      if (authStatusB === 'disconnected' || authStatusB === 'failed') {
        row.auth_state = 'not_connected';
      }
      if (projectIdsJson) row.project_ids_json = projectIdsJson;
      row.tenant_policy_json = tenantPolicyJson;
      row.failure_state = failureState;
      row.token_expires_at = tokenExpiresAt;
      row.reconnect_required = reconnectRequired;
      row.access_revoked_at = accessRevokedAt;
      row.revoked_reason = revokedReason;
      if (lastSyncAt) row.last_sync_at = lastSyncAt;
      row.updated_at = new Date().toISOString();
      return { changes: 1 };
    }
    throw new Error(`Unhandled dbRun SQL: ${normalized}`);
  },
  get: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM wave7_connectors')) {
      return db.connectors.get(params[0]) || null;
    }
    if (normalized.includes('FROM wave7_connector_runs')) {
      return db.runs.get(params[0]) || null;
    }
    if (normalized.includes('FROM ai_run_ledger')) {
      const row = db.airuns.get(params[0]);
      return row && row.organization_id === params[1] ? row : null;
    }
    throw new Error(`Unhandled dbGet SQL: ${normalized}`);
  },
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM wave7_connectors')) {
      return Array.from(db.connectors.values()).filter((row) => row.organization_id === params[0]);
    }
    if (normalized.includes('FROM wave7_connector_runs')) {
      return Array.from(db.runs.values()).filter((row) => row.organization_id === params[0]);
    }
    throw new Error(`Unhandled dbAll SQL: ${normalized}`);
  },
}));

describe('Wave 7 connector runtime', () => {
  beforeEach(() => {
    db.connectors.clear();
    db.runs.clear();
    db.airuns.clear();
    db.uuidCounter = 0;
    vi.resetModules();
  });

  it('registers connectors and blocks project ACL leakage', async () => {
    const { executeWave7ConnectorTool, registerWave7Connector } =
      await import('../../../server/src/services/wave7ConnectorRuntimeService.js');

    const connector = await registerWave7Connector({
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'google_drive',
      projectIds: ['project-a'],
    });

    const denied = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      projectId: 'project-b',
      toolName: 'connector_search',
      toolKind: 'search',
      query: 'secret project docs',
    });

    expect(denied.allowed).toBe(false);
    expect(denied.run.status).toBe('blocked');
    expect(denied.run.error).toBe('project_acl_denied');
  });

  it('marks stale connector data and preserves source trace', async () => {
    const { executeWave7ConnectorTool, registerWave7Connector } =
      await import('../../../server/src/services/wave7ConnectorRuntimeService.js');

    const connector = await registerWave7Connector({
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'jira',
      freshnessTtlMinutes: 0.001,
    });
    Object.assign(db.connectors.get(connector.connectorId), {
      last_sync_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const result = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      projectId: null,
      toolName: 'connector_search',
      toolKind: 'search',
      query: 'meeting follow-up',
    });

    expect(result.allowed).toBe(true);
    expect(result.freshnessWarning).toContain('stale');
    expect(result.run.sourceTrace).toEqual(
      expect.objectContaining({ provider: 'jira', freshness: 'stale' })
    );
  });

  it('blocks expired OAuth sessions and keeps reconnect audit fields visible', async () => {
    const { executeWave7ConnectorTool, registerWave7Connector } =
      await import('../../../server/src/services/wave7ConnectorRuntimeService.js');

    const connector = await registerWave7Connector({
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'jira',
      tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const result = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      toolName: 'connector_search',
      toolKind: 'search',
      query: 'blocked until reconnect',
    });

    expect(result.allowed).toBe(false);
    expect(result.connector.accessState).toBe('token_expired');
    expect(result.connector.tokenExpired).toBe(true);
    expect(result.run.error).toBe('connector_token_expired');
    expect(result.run.sourceTrace).toEqual(
      expect.objectContaining({
        accessState: 'token_expired',
        tokenExpiresAt: connector.tokenExpiresAt,
      })
    );
  });

  it('tracks revoked connector access and clears it on reconnect', async () => {
    const { executeWave7ConnectorTool, registerWave7Connector, updateWave7Connector } =
      await import('../../../server/src/services/wave7ConnectorRuntimeService.js');

    const connector = await registerWave7Connector({
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'jira',
    });

    const revoked = await updateWave7Connector({
      organizationId: 'org-1',
      connectorId: connector.connectorId,
      status: 'disconnected',
      reconnectRequired: true,
      accessRevokedAt: '2026-04-25T10:00:00.000Z',
      revokedReason: 'oauth_access_revoked',
      failureState: 'revoked_access',
    });
    expect(revoked.accessState).toBe('revoked');
    expect(revoked.accessRevokedAt).toBe('2026-04-25T10:00:00.000Z');

    const blocked = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      toolName: 'connector_search',
      toolKind: 'search',
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.run.error).toBe('connector_access_revoked');

    const reconnected = await updateWave7Connector({
      organizationId: 'org-1',
      connectorId: connector.connectorId,
      status: 'connected',
      reconnectRequired: false,
      accessRevokedAt: null,
      revokedReason: null,
      failureState: null,
      tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(reconnected.accessState).toBe('authorized');
    expect(reconnected.reconnectRequired).toBe(false);
    expect(reconnected.accessRevokedAt).toBeNull();
  });

  it('uses a real dataCollection connector binding instead of synthetic results', async () => {
    const { executeWave7ConnectorTool, registerWave7Connector } =
      await import('../../../server/src/services/wave7ConnectorRuntimeService.js');

    const connector = await registerWave7Connector({
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'jira',
      tenantPolicy: { acl: 'tenant', externalConnectorId: 'tp-connector-1' },
    });

    const result = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      toolName: 'connector_search',
      toolKind: 'search',
      query: 'DRD-1',
    });

    expect(result.allowed).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].excerpt).toContain('Real connector-backed issue');
    expect(result.sourceTrace).toEqual(
      expect.objectContaining({
        executionMode: 'external_connector_fetch',
        externalConnectorId: 'tp-connector-1',
        queryApplied: true,
        recordsMatched: 1,
      })
    );
  });

  it('does not fabricate connector results when no external binding exists', async () => {
    const { executeWave7ConnectorTool, registerWave7Connector } =
      await import('../../../server/src/services/wave7ConnectorRuntimeService.js');

    const connector = await registerWave7Connector({
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'google_drive',
    });

    const result = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      toolName: 'connector_search',
      toolKind: 'search',
      query: 'board memo',
    });

    expect(result.allowed).toBe(true);
    expect(result.results).toEqual([]);
    expect(result.sourceTrace.executionMode).toBe('registry_only');
  });

  it('requires AIRun for mutating connector tools', async () => {
    const { executeWave7ConnectorTool, registerWave7Connector } =
      await import('../../../server/src/services/wave7ConnectorRuntimeService.js');

    const connector = await registerWave7Connector({
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'jira',
    });

    const blocked = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      toolName: 'create_issue',
      toolKind: 'write',
      query: 'create Jira issue',
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.run.error).toBe('mutating_tool_requires_airun');

    db.airuns.set('airun-1', {
      run_id: 'airun-1',
      organization_id: 'org-1',
      status: 'approved',
    });

    const approved = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      toolName: 'create_issue',
      toolKind: 'write',
      query: 'create Jira issue',
      aiRunId: 'airun-1',
    });
    expect(approved.allowed).toBe(true);
    expect(approved.run.aiRunId).toBe('airun-1');
    expect(approved.sourceTrace.executionMode).toBe('registry_only');

    const fakeRun = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      toolName: 'create_issue',
      toolKind: 'write',
      query: 'create Jira issue',
      aiRunId: 'airun-missing',
    });
    expect(fakeRun.allowed).toBe(false);
    expect(fakeRun.run.error).toBe('airun_not_approved');
  });

  it('runs a real dataCollection connector for approved mutating tools when bound', async () => {
    const { executeWave7ConnectorTool, registerWave7Connector } =
      await import('../../../server/src/services/wave7ConnectorRuntimeService.js');

    db.airuns.set('airun-2', {
      run_id: 'airun-2',
      organization_id: 'org-1',
      status: 'approved',
    });
    const connector = await registerWave7Connector({
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'jira',
      tenantPolicy: { acl: 'tenant', externalConnectorId: 'tp-connector-1' },
    });

    const result = await executeWave7ConnectorTool({
      organizationId: 'org-1',
      userId: 'user-1',
      connectorId: connector.connectorId,
      toolName: 'connector_sync',
      toolKind: 'write',
      aiRunId: 'airun-2',
    });

    expect(result.allowed).toBe(true);
    expect(result.sourceTrace).toEqual(
      expect.objectContaining({
        executionMode: 'external_connector_run',
        externalRunId: 'runner-tp-connector-1',
      })
    );
    expect(result.results[0].excerpt).toContain('imported 2');
  });

  it('links, disconnects and admin-reindexes connectors through governed operations', async () => {
    const {
      disconnectWave7Connector,
      linkWave7ConnectorToExternal,
      registerWave7Connector,
      reindexWave7Connector,
    } = await import('../../../server/src/services/wave7ConnectorRuntimeService.js');

    const connector = await registerWave7Connector({
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'jira',
    });

    const linked = await linkWave7ConnectorToExternal({
      organizationId: 'org-1',
      connectorId: connector.connectorId,
      externalConnectorId: 'tp-connector-1',
    });
    expect(linked.tenantPolicy.externalConnectorId).toBe('tp-connector-1');

    const reindex = await reindexWave7Connector({
      organizationId: 'org-1',
      userId: 'admin-1',
      connectorId: connector.connectorId,
    });
    expect(reindex.allowed).toBe(true);
    expect(reindex.sourceTrace.executionMode).toBe('external_connector_run');

    const disconnected = await disconnectWave7Connector({
      organizationId: 'org-1',
      connectorId: connector.connectorId,
    });
    expect(disconnected.status).toBe('disconnected');
    expect(disconnected.authState).toBe('not_connected');
  });

  it('exposes Wave 7 API and UI contract', () => {
    const gateway = readFileSync('server/src/Gateway.ts', 'utf8');
    const routes = readFileSync('server/src/routes/wave7-connectors.routes.ts', 'utf8');
    const api = readFileSync('src/services/api.ts', 'utf8');
    const panel = readFileSync('src/components/AIChat/Wave7ConnectorAdminPanel.tsx', 'utf8');
    const appRoutes = readFileSync('src/routes/AppRoutes.tsx', 'utf8');
    const tools = readFileSync('server/src/services/ai/toolDefinitions.ts', 'utf8');
    const migration = readFileSync(
      'server/migrations/20260425_wave7_connector_runtime.sql',
      'utf8'
    );

    expect(gateway).toContain('/api/ai-connectors');
    expect(routes).toContain('/execute');
    expect(routes).toContain('/health');
    expect(routes).toContain('/reindex');
    expect(routes).toContain('/disconnect');
    expect(routes).toContain('/link');
    expect(api).toContain('executeWave7ConnectorTool');
    expect(api).toContain('getWave7ConnectorHealth');
    expect(api).toContain('linkWave7Connector');
    expect(api).toContain('reindexWave7Connector');
    expect(panel).toContain('connectorrunAudit');
    expect(panel).toContain('Api.getWave7ConnectorHealth');
    expect(panel).toContain('/api/ai-connectors/health');
    expect(panel).toContain('writeRequiresAirun');
    expect(panel).toContain('realSourceBinding');
    expect(panel).toContain('oauthSessionLifecycle');
    expect(appRoutes).toContain('path={ROUTES.AI_OS.CONNECTORS}');
    expect(tools).toContain('list_enterprise_connectors');
    expect(tools).toContain('search_enterprise_connector');
    expect(migration).toContain('wave7_connector_runs');
  });
});
