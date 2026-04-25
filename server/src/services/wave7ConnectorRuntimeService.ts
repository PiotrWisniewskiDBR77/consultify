import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { CONNECTORS } from './integrationHubService.js';

export type Wave7ConnectorStatus = 'available' | 'connected' | 'disconnected' | 'stale' | 'failed';
export type Wave7ToolKind = 'read' | 'search' | 'write' | 'destructive';
export type Wave7RunStatus = 'planned' | 'blocked' | 'running' | 'completed' | 'failed';

export interface RegisterWave7ConnectorInput {
  organizationId: string;
  userId: string;
  provider: string;
  status?: Wave7ConnectorStatus;
  scopes?: string[];
  projectIds?: string[];
  ownerUserId?: string | null;
  tenantPolicy?: Record<string, unknown>;
  freshnessTtlMinutes?: number | null;
}

export interface ExecuteWave7ConnectorInput {
  organizationId: string;
  userId: string;
  connectorId: string;
  toolName: string;
  toolKind: Wave7ToolKind;
  query?: string | null;
  projectId?: string | null;
  aiRunId?: string | null;
  payload?: Record<string, unknown>;
  internalAdminBypass?: boolean;
}

export interface UpdateWave7ConnectorInput {
  organizationId: string;
  connectorId: string;
  status?: Wave7ConnectorStatus;
  externalConnectorId?: string | null;
  projectIds?: string[];
  failureState?: string | null;
}

let schemaReady: Promise<void> | null = null;

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function minutesSince(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return null;
  return Math.floor((Date.now() - time) / 60000);
}

function mapConnector(row: any): any {
  if (!row) return null;
  const ttl = Number(row.freshness_ttl_minutes || 240);
  const age = minutesSince(row.last_sync_at);
  const isStale = age != null && age > ttl;
  return {
    connectorId: row.connector_id,
    organizationId: row.organization_id,
    provider: row.provider,
    displayName: row.display_name,
    status: row.status === 'connected' && isStale ? 'stale' : row.status,
    authState: row.auth_state,
    scopes: safeJsonParse(row.scopes_json, []),
    projectIds: safeJsonParse(row.project_ids_json, []),
    ownerUserId: row.owner_user_id || null,
    tenantPolicy: safeJsonParse(row.tenant_policy_json, {}),
    lastSyncAt: row.last_sync_at || null,
    freshnessTtlMinutes: ttl,
    freshnessAgeMinutes: age,
    failureState: row.failure_state || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRun(row: any): any {
  if (!row) return null;
  return {
    runId: row.run_id,
    organizationId: row.organization_id,
    connectorId: row.connector_id,
    userId: row.user_id,
    projectId: row.project_id || null,
    toolName: row.tool_name,
    toolKind: row.tool_kind,
    status: row.status,
    query: row.query || null,
    aiRunId: row.ai_run_id || null,
    sourceTrace: safeJsonParse(row.source_trace_json, {}),
    aclDecision: safeJsonParse(row.acl_decision_json, {}),
    freshnessWarning: row.freshness_warning || null,
    error: row.error || null,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
  };
}

function providerDisplayName(provider: string): string {
  const catalog = (CONNECTORS as Record<string, any>)[provider];
  return catalog?.name || provider.replace(/_/g, ' ');
}

export async function ensureWave7ConnectorRuntimeSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave7_connectors (
        connector_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL,
        auth_state TEXT NOT NULL DEFAULT 'not_connected',
        scopes_json TEXT NOT NULL DEFAULT '[]',
        project_ids_json TEXT NOT NULL DEFAULT '[]',
        owner_user_id TEXT,
        tenant_policy_json TEXT NOT NULL DEFAULT '{}',
        last_sync_at TEXT,
        freshness_ttl_minutes INTEGER NOT NULL DEFAULT 240,
        failure_state TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave7_connector_runs (
        run_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        project_id TEXT,
        tool_name TEXT NOT NULL,
        tool_kind TEXT NOT NULL,
        status TEXT NOT NULL,
        query TEXT,
        ai_run_id TEXT,
        source_trace_json TEXT NOT NULL DEFAULT '{}',
        acl_decision_json TEXT NOT NULL DEFAULT '{}',
        freshness_warning TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )
    `);
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave7_connectors_org ON wave7_connectors(organization_id, provider)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave7_runs_org ON wave7_connector_runs(organization_id, created_at)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export async function getWave7ConnectorCatalog(): Promise<any[]> {
  return Object.values(CONNECTORS as Record<string, any>).map((connector) => ({
    provider: connector.id,
    displayName: connector.name,
    category: connector.category,
    authType: connector.authType,
    capabilities: connector.capabilities || [],
    configFields: connector.configFields || [],
  }));
}

export async function registerWave7Connector(input: RegisterWave7ConnectorInput): Promise<any> {
  await ensureWave7ConnectorRuntimeSchema();
  const connectorId = `conn7-${uuidv4()}`;
  const status = input.status || 'connected';
  await dbRun(
    `INSERT INTO wave7_connectors (
      connector_id, organization_id, provider, display_name, status, auth_state,
      scopes_json, project_ids_json, owner_user_id, tenant_policy_json, last_sync_at,
      freshness_ttl_minutes, failure_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      connectorId,
      input.organizationId,
      input.provider,
      providerDisplayName(input.provider),
      status,
      status === 'connected' ? 'authorized' : 'not_connected',
      safeJsonStringify(input.scopes || ['read']),
      safeJsonStringify(input.projectIds || []),
      input.ownerUserId || input.userId,
      safeJsonStringify(input.tenantPolicy || { acl: 'tenant' }),
      status === 'connected' ? nowIso() : null,
      input.freshnessTtlMinutes || 240,
      status === 'failed' ? 'registration_failed' : null,
    ]
  );
  const row = await dbGet(`SELECT * FROM wave7_connectors WHERE connector_id = ?`, [connectorId]);
  return mapConnector(row);
}

export async function listWave7Connectors(params: {
  organizationId: string;
  projectId?: string | null;
}): Promise<any[]> {
  await ensureWave7ConnectorRuntimeSchema();
  const rows = await dbAll(
    `SELECT * FROM wave7_connectors WHERE organization_id = ? ORDER BY updated_at DESC`,
    [params.organizationId]
  );
  const connectors = (rows || []).map(mapConnector);
  if (!params.projectId) return connectors;
  return connectors.filter(
    (connector) =>
      connector.projectIds.length === 0 || connector.projectIds.includes(String(params.projectId))
  );
}

export async function updateWave7Connector(input: UpdateWave7ConnectorInput): Promise<any> {
  await ensureWave7ConnectorRuntimeSchema();
  const connector = mapConnector(
    await dbGet(`SELECT * FROM wave7_connectors WHERE connector_id = ? AND organization_id = ?`, [
      input.connectorId,
      input.organizationId,
    ])
  );
  if (!connector) return null;

  const tenantPolicy = {
    ...(connector.tenantPolicy || {}),
    ...(input.externalConnectorId !== undefined
      ? { externalConnectorId: input.externalConnectorId || null }
      : {}),
  };
  await dbRun(
    `UPDATE wave7_connectors
     SET status = COALESCE(?, status),
         auth_state = CASE
           WHEN ? = 'connected' THEN 'authorized'
           WHEN ? IN ('disconnected', 'failed') THEN 'not_connected'
           ELSE auth_state
         END,
         project_ids_json = COALESCE(?, project_ids_json),
         tenant_policy_json = ?,
         failure_state = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE connector_id = ? AND organization_id = ?`,
    [
      input.status || null,
      input.status || null,
      input.status || null,
      input.projectIds ? safeJsonStringify(input.projectIds) : null,
      safeJsonStringify(tenantPolicy),
      input.failureState !== undefined ? input.failureState : connector.failureState || null,
      input.connectorId,
      input.organizationId,
    ]
  );
  return mapConnector(
    await dbGet(`SELECT * FROM wave7_connectors WHERE connector_id = ? AND organization_id = ?`, [
      input.connectorId,
      input.organizationId,
    ])
  );
}

export async function disconnectWave7Connector(params: {
  organizationId: string;
  connectorId: string;
}): Promise<any> {
  return updateWave7Connector({
    organizationId: params.organizationId,
    connectorId: params.connectorId,
    status: 'disconnected',
    failureState: null,
  });
}

export async function linkWave7ConnectorToExternal(input: {
  organizationId: string;
  connectorId: string;
  externalConnectorId: string;
}): Promise<any> {
  const db = getDatabase();
  const external = await db.query(
    'SELECT id FROM tp_connectors WHERE id = $1 AND organization_id = $2',
    [input.externalConnectorId, input.organizationId]
  );
  if (!external.rows[0]) {
    throw new Error('External connector not found for this organization');
  }
  return updateWave7Connector({
    organizationId: input.organizationId,
    connectorId: input.connectorId,
    externalConnectorId: input.externalConnectorId,
    status: 'connected',
    failureState: null,
  });
}

export async function reindexWave7Connector(input: {
  organizationId: string;
  userId: string;
  connectorId: string;
}): Promise<any> {
  return executeWave7ConnectorTool({
    organizationId: input.organizationId,
    userId: input.userId,
    connectorId: input.connectorId,
    toolName: 'connector_reindex',
    toolKind: 'write',
    aiRunId: 'admin-approved-reindex',
    payload: { adminInitiated: true },
    internalAdminBypass: true,
  });
}

function evaluateConnectorAccess(connector: any, input: ExecuteWave7ConnectorInput): any {
  if (!connector) {
    return { allowed: false, reason: 'connector_not_found' };
  }
  if (connector.organizationId !== input.organizationId) {
    return { allowed: false, reason: 'cross_tenant_forbidden' };
  }
  if (connector.status === 'failed' || connector.status === 'disconnected') {
    return { allowed: false, reason: `connector_${connector.status}` };
  }
  if (
    input.projectId &&
    connector.projectIds.length > 0 &&
    !connector.projectIds.includes(String(input.projectId))
  ) {
    return { allowed: false, reason: 'project_acl_denied' };
  }
  if ((input.toolKind === 'write' || input.toolKind === 'destructive') && !input.aiRunId) {
    return { allowed: false, reason: 'mutating_tool_requires_airun' };
  }
  return { allowed: true, reason: 'allowed' };
}

async function validateMutatingAIRun(input: ExecuteWave7ConnectorInput): Promise<any> {
  if (input.toolKind !== 'write' && input.toolKind !== 'destructive') {
    return { valid: true, reason: 'not_mutating' };
  }
  if (input.internalAdminBypass === true && input.aiRunId === 'admin-approved-reindex') {
    return { valid: true, reason: 'admin_initiated_reindex' };
  }
  if (!input.aiRunId) return { valid: false, reason: 'mutating_tool_requires_airun' };
  const row = await dbGet(
    `SELECT run_id, organization_id, status FROM ai_run_ledger
     WHERE run_id = ? AND organization_id = ?`,
    [input.aiRunId, input.organizationId]
  ).catch(() => null);
  const status = String((row as any)?.status || '').toLowerCase();
  if (!row || !['approved', 'executing'].includes(status)) {
    return { valid: false, reason: 'airun_not_approved' };
  }
  return { valid: true, reason: 'approved_airun', runId: input.aiRunId };
}

async function fetchRealConnectorRecords(params: {
  connector: any;
  input: ExecuteWave7ConnectorInput;
}): Promise<{ results: any[]; sourceTracePatch: Record<string, unknown> }> {
  const externalConnectorId =
    String(params.input.payload?.externalConnectorId || '').trim() ||
    String(params.connector?.tenantPolicy?.externalConnectorId || '').trim();
  if (!externalConnectorId) {
    return {
      results: [],
      sourceTracePatch: {
        executionMode: 'registry_only',
        note: 'No externalConnectorId binding; no synthetic connector data returned.',
      },
    };
  }

  const db = getDatabase();
  const connectorResult = await db.query(
    'SELECT * FROM tp_connectors WHERE id = $1 AND organization_id = $2',
    [externalConnectorId, params.input.organizationId]
  );
  const externalConnector = connectorResult.rows[0] as any | undefined;
  if (!externalConnector) {
    return {
      results: [],
      sourceTracePatch: {
        executionMode: 'external_connector_missing',
        externalConnectorId,
      },
    };
  }

  const { connectorRegistry } = await import('./dataCollection/index.js');
  const impl = connectorRegistry.get(String(externalConnector.connector_type));
  const records = await impl.fetchRecords(externalConnector.config || {}, {
    limit: 25,
    ...(params.input.payload?.fetchOptions && typeof params.input.payload.fetchOptions === 'object'
      ? (params.input.payload.fetchOptions as Record<string, unknown>)
      : {}),
  });
  const query = String(params.input.query || '')
    .trim()
    .toLowerCase();
  const filteredRecords = query
    ? records.filter((record: any) =>
        JSON.stringify(record.data || {})
          .toLowerCase()
          .includes(query)
      )
    : records;
  return {
    results: filteredRecords.slice(0, 5).map((record: any, index: number) => ({
      title: `${externalConnector.name || params.connector.displayName} record ${index + 1}`,
      excerpt: JSON.stringify(record.data || {}).slice(0, 500),
      sourceTrace: {
        externalConnectorId,
        connectorType: externalConnector.connector_type,
        externalId: record.externalId || null,
      },
    })),
    sourceTracePatch: {
      executionMode: 'external_connector_fetch',
      externalConnectorId,
      connectorType: externalConnector.connector_type,
      recordsFetched: records.length,
      recordsMatched: filteredRecords.length,
      queryApplied: Boolean(query),
    },
  };
}

async function runRealMutatingConnector(params: {
  connector: any;
  input: ExecuteWave7ConnectorInput;
}): Promise<{ results: any[]; sourceTracePatch: Record<string, unknown> }> {
  const externalConnectorId =
    String(params.input.payload?.externalConnectorId || '').trim() ||
    String(params.connector?.tenantPolicy?.externalConnectorId || '').trim();
  if (!externalConnectorId) {
    return {
      results: [],
      sourceTracePatch: {
        executionMode: 'registry_only',
        note: 'No externalConnectorId binding; approved mutation was not sent to an external connector.',
      },
    };
  }

  const db = getDatabase();
  const connectorResult = await db.query(
    'SELECT id FROM tp_connectors WHERE id = $1 AND organization_id = $2',
    [externalConnectorId, params.input.organizationId]
  );
  if (!connectorResult.rows[0]) {
    return {
      results: [],
      sourceTracePatch: {
        executionMode: 'external_connector_missing',
        externalConnectorId,
      },
    };
  }

  const { connectorRunner } = await import('./dataCollection/index.js');
  const runResult = await connectorRunner.run(externalConnectorId);
  return {
    results: [
      {
        title: 'Connector sync run',
        excerpt: `Status ${runResult.status}; imported ${runResult.recordsImported}; failed ${runResult.recordsFailed}`,
        sourceTrace: {
          externalConnectorId,
          runId: runResult.runId,
        },
      },
    ],
    sourceTracePatch: {
      executionMode: 'external_connector_run',
      externalConnectorId,
      externalRunId: runResult.runId,
      externalRunStatus: runResult.status,
      recordsImported: runResult.recordsImported,
      recordsFailed: runResult.recordsFailed,
    },
  };
}

export async function executeWave7ConnectorTool(input: ExecuteWave7ConnectorInput): Promise<any> {
  await ensureWave7ConnectorRuntimeSchema();
  const connector = mapConnector(
    await dbGet(`SELECT * FROM wave7_connectors WHERE connector_id = ? AND organization_id = ?`, [
      input.connectorId,
      input.organizationId,
    ])
  );
  const aclDecision = evaluateConnectorAccess(connector, input);
  const aiRunDecision = await validateMutatingAIRun(input);
  const effectiveDecision = aclDecision.allowed
    ? aiRunDecision.valid
      ? aclDecision
      : { allowed: false, reason: aiRunDecision.reason }
    : aclDecision;
  const runId = `conn-run7-${uuidv4()}`;
  const freshnessWarning =
    connector?.status === 'stale'
      ? `Connector data is stale: last sync ${connector.lastSyncAt || 'unknown'}`
      : null;
  const status: Wave7RunStatus = effectiveDecision.allowed ? 'completed' : 'blocked';
  const sourceTrace = {
    provider: connector?.provider || null,
    connectorId: connector?.connectorId || input.connectorId,
    projectId: input.projectId || null,
    freshness: freshnessWarning ? 'stale' : 'fresh',
    query: input.query || null,
  };
  const realConnectorResult = effectiveDecision.allowed
    ? input.toolKind === 'read' || input.toolKind === 'search'
      ? await fetchRealConnectorRecords({ connector, input }).catch((err: any) => ({
          results: [],
          sourceTracePatch: {
            executionMode: 'external_connector_error',
            error: err?.message || String(err),
          },
        }))
      : await runRealMutatingConnector({ connector, input }).catch((err: any) => ({
          results: [],
          sourceTracePatch: {
            executionMode: 'external_connector_error',
            error: err?.message || String(err),
          },
        }))
    : { results: [], sourceTracePatch: {} };
  const finalSourceTrace = {
    ...sourceTrace,
    ...(realConnectorResult.sourceTracePatch || {}),
  };
  await dbRun(
    `INSERT INTO wave7_connector_runs (
      run_id, organization_id, connector_id, user_id, project_id, tool_name, tool_kind,
      status, query, ai_run_id, source_trace_json, acl_decision_json, freshness_warning,
      error, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      input.organizationId,
      input.connectorId,
      input.userId,
      input.projectId || null,
      input.toolName,
      input.toolKind,
      status,
      input.query || null,
      input.aiRunId || null,
      safeJsonStringify(finalSourceTrace),
      safeJsonStringify({ ...effectiveDecision, aiRun: aiRunDecision }),
      freshnessWarning,
      effectiveDecision.allowed ? null : effectiveDecision.reason,
      nowIso(),
    ]
  );
  const run = mapRun(await dbGet(`SELECT * FROM wave7_connector_runs WHERE run_id = ?`, [runId]));
  return {
    allowed: effectiveDecision.allowed,
    connector,
    run,
    freshnessWarning,
    sourceTrace: finalSourceTrace,
    results: effectiveDecision.allowed ? realConnectorResult.results : [],
  };
}

export async function listWave7ConnectorRuns(params: {
  organizationId: string;
  limit?: number;
}): Promise<any[]> {
  await ensureWave7ConnectorRuntimeSchema();
  const rows = await dbAll(
    `SELECT * FROM wave7_connector_runs WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`,
    [params.organizationId, params.limit || 50]
  );
  return (rows || []).map(mapRun);
}

export async function buildWave7ConnectorHealth(params: { organizationId: string }): Promise<any> {
  const connectors = await listWave7Connectors({ organizationId: params.organizationId });
  return {
    organizationId: params.organizationId,
    total: connectors.length,
    connected: connectors.filter((connector) => connector.status === 'connected').length,
    stale: connectors.filter((connector) => connector.status === 'stale').length,
    failed: connectors.filter((connector) => connector.status === 'failed').length,
    connectors,
  };
}
