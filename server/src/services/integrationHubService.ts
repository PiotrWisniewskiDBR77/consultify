/**
 * Integration Hub Service
 *
 * Centralized integration management for:
 * - ERP Systems (SAP, Oracle, Microsoft Dynamics)
 * - CRM Platforms (Salesforce, HubSpot, Zoho)
 * - Project Management (Jira, Monday, Asana, Azure DevOps)
 * - BI Tools (Power BI, Tableau, Looker)
 * - Communication (Slack, Microsoft Teams, Email)
 *
 * Fully migrated from server/services/integrationHubService.js to TypeScript
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { getTableColumns } from '../utils/dbSchema.js';
import _logger from '../utils/Logger.js';

// ==========================================
// CONSTANTS
// ==========================================

export const CATEGORIES = {
  EMAIL: 'communication',
  CALENDAR: 'calendar',
  TASK_MANAGEMENT: 'project_management',
  CLOUD_STORAGE: 'cloud_storage',
} as const;

export const STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  PENDING: 'pending',
  REQUIRES_REAUTH: 'requires_reauth',
} as const;

export type IntegrationCategory = (typeof CATEGORIES)[keyof typeof CATEGORIES];
export type IntegrationStatus = (typeof STATUS)[keyof typeof STATUS];

export interface Connector {
  id: string;
  name: string;
  category: IntegrationCategory;
  capabilities: string[];
  authType: 'oauth2' | 'api_key' | 'token';
  configFields: string[];
}

export const CONNECTORS: Record<string, Connector> = {
  // ── Email & Communication ─────────────────────────────────────
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    category: CATEGORIES.EMAIL,
    capabilities: ['email', 'contacts', 'labels'],
    authType: 'oauth2',
    configFields: ['domain'],
  },
  outlook: {
    id: 'outlook',
    name: 'Microsoft Outlook',
    category: CATEGORIES.EMAIL,
    capabilities: ['email', 'contacts', 'folders'],
    authType: 'oauth2',
    configFields: [],
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    category: CATEGORIES.EMAIL,
    capabilities: ['messages', 'channels', 'notifications'],
    authType: 'oauth2',
    configFields: ['workspace_id'],
  },
  teams: {
    id: 'teams',
    name: 'Microsoft Teams',
    category: CATEGORIES.EMAIL,
    capabilities: ['messages', 'channels', 'meetings'],
    authType: 'oauth2',
    configFields: ['tenant_id'],
  },

  // ── Calendar ──────────────────────────────────────────────────
  google_calendar: {
    id: 'google_calendar',
    name: 'Google Calendar',
    category: CATEGORIES.CALENDAR,
    capabilities: ['events', 'reminders', 'shared_calendars'],
    authType: 'oauth2',
    configFields: [],
  },
  outlook_calendar: {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    category: CATEGORIES.CALENDAR,
    capabilities: ['events', 'reminders', 'shared_calendars'],
    authType: 'oauth2',
    configFields: [],
  },
  apple_calendar: {
    id: 'apple_calendar',
    name: 'Apple Calendar (iCal)',
    category: CATEGORIES.CALENDAR,
    capabilities: ['events', 'reminders'],
    authType: 'token',
    configFields: ['caldav_url'],
  },
  calendly: {
    id: 'calendly',
    name: 'Calendly',
    category: CATEGORIES.CALENDAR,
    capabilities: ['scheduling', 'events', 'availability'],
    authType: 'oauth2',
    configFields: [],
  },

  // ── Task Management ───────────────────────────────────────────
  jira: {
    id: 'jira',
    name: 'Jira',
    category: CATEGORIES.TASK_MANAGEMENT,
    capabilities: ['issues', 'projects', 'sprints', 'boards'],
    authType: 'oauth2',
    configFields: ['site_url', 'cloud_id'],
  },
  asana: {
    id: 'asana',
    name: 'Asana',
    category: CATEGORIES.TASK_MANAGEMENT,
    capabilities: ['tasks', 'projects', 'portfolios'],
    authType: 'oauth2',
    configFields: ['workspace_gid'],
  },
  trello: {
    id: 'trello',
    name: 'Trello',
    category: CATEGORIES.TASK_MANAGEMENT,
    capabilities: ['boards', 'cards', 'lists'],
    authType: 'oauth2',
    configFields: [],
  },
  clickup: {
    id: 'clickup',
    name: 'ClickUp',
    category: CATEGORIES.TASK_MANAGEMENT,
    capabilities: ['tasks', 'spaces', 'lists', 'goals'],
    authType: 'oauth2',
    configFields: [],
  },
  monday: {
    id: 'monday',
    name: 'Monday.com',
    category: CATEGORIES.TASK_MANAGEMENT,
    capabilities: ['boards', 'items', 'workspaces'],
    authType: 'api_key',
    configFields: ['api_token'],
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    category: CATEGORIES.TASK_MANAGEMENT,
    capabilities: ['databases', 'pages', 'tasks'],
    authType: 'oauth2',
    configFields: [],
  },
  todoist: {
    id: 'todoist',
    name: 'Todoist',
    category: CATEGORIES.TASK_MANAGEMENT,
    capabilities: ['tasks', 'projects', 'labels'],
    authType: 'oauth2',
    configFields: [],
  },
  linear: {
    id: 'linear',
    name: 'Linear',
    category: CATEGORIES.TASK_MANAGEMENT,
    capabilities: ['issues', 'projects', 'cycles'],
    authType: 'oauth2',
    configFields: [],
  },

  // ── Cloud Storage ─────────────────────────────────────────────
  google_drive: {
    id: 'google_drive',
    name: 'Google Drive',
    category: CATEGORIES.CLOUD_STORAGE,
    capabilities: ['files', 'folders', 'sharing'],
    authType: 'oauth2',
    configFields: [],
  },
  onedrive: {
    id: 'onedrive',
    name: 'OneDrive',
    category: CATEGORIES.CLOUD_STORAGE,
    capabilities: ['files', 'folders', 'sharing'],
    authType: 'oauth2',
    configFields: [],
  },
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    category: CATEGORIES.CLOUD_STORAGE,
    capabilities: ['files', 'folders', 'sharing'],
    authType: 'oauth2',
    configFields: [],
  },
  box: {
    id: 'box',
    name: 'Box',
    category: CATEGORIES.CLOUD_STORAGE,
    capabilities: ['files', 'folders', 'sharing', 'workflows'],
    authType: 'oauth2',
    configFields: [],
  },
};

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface IntegrationRecord {
  id: string;
  organization_id: string;
  connector_id: string;
  name: string;
  category: string;
  status: string;
  config: string;
  capabilities: string;
  auth_type: string;
  sync_settings?: string | null;
  last_sync_at?: string | null;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;
  // Legacy schemas
  createdAt?: string;
  updatedAt?: string;
}

export interface Integration {
  id: string;
  organizationId: string;
  connectorId: string;
  name: string;
  category: string;
  status: IntegrationStatus | string;
  config: Record<string, unknown>;
  capabilities: string[];
  authType: string;
  syncSettings?: Record<string, unknown>;
  lastSyncAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AvailableConnector extends Connector {
  isAvailable: boolean;
}

export interface ConnectIntegrationResult {
  id: string;
  connectorId: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  capabilities: string[];
}

export interface SyncResult {
  syncId: string;
  integrationId: string;
  connector: string;
  status: string;
  recordsSynced: number;
  duration: number;
  error?: string | null;
}

export interface SyncEvent {
  syncId?: string;
  event: string;
  options?: Record<string, unknown>;
  result?: SyncResult;
  error?: string;
}

export interface SyncLogRecord {
  id: string;
  integration_id: string;
  event: string;
  data: string;
  created_at: string;
}

export interface SyncLog {
  id: string;
  integrationId: string;
  event: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrationStats {
  category: string;
  count: number;
  connected: number;
  errors: number;
}

// Dependency injection interface for testing
export interface IntegrationHubServiceDependencies {
  db: IDatabase;
  uuidv4: () => string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class IntegrationHubServiceClass {
  private deps: IntegrationHubServiceDependencies;
  private integrationsColumnsPromise: Promise<Set<string>> | null = null;

  constructor(deps?: Partial<IntegrationHubServiceDependencies>) {
    this.deps = {
      db: deps?.db ?? getDatabase(),
      uuidv4: deps?.uuidv4 ?? uuidv4,
    };
  }

  /**
   * Set dependencies (for testing)
   */
  setDependencies(newDeps: Partial<IntegrationHubServiceDependencies>): void {
    this.deps = { ...this.deps, ...newDeps };
  }

  private async getIntegrationsColumns(): Promise<Set<string>> {
    if (!this.integrationsColumnsPromise) {
      this.integrationsColumnsPromise = getTableColumns('integrations').catch(() => new Set());
    }
    return await this.integrationsColumnsPromise;
  }

  /**
   * Get all available connectors
   */
  async getAvailableConnectors(
    category: IntegrationCategory | null = null
  ): Promise<AvailableConnector[]> {
    let connectors = Object.values(CONNECTORS);

    if (category) {
      connectors = connectors.filter((c) => c.category === category);
    }

    return connectors.map((c) => ({
      ...c,
      isAvailable: true,
    }));
  }

  /**
   * Get organization's connected integrations
   */
  async getConnectedIntegrations(organizationId: string): Promise<Integration[]> {
    const cols = await this.getIntegrationsColumns();
    const orderBy = cols.has('created_at')
      ? 'created_at'
      : cols.has('updated_at')
        ? 'updated_at'
        : 'id';
    const rows = (await this.deps.db.all<IntegrationRecord>(
      `SELECT * FROM integrations
             WHERE organization_id = ?
             ORDER BY ${orderBy} DESC`,
      [organizationId]
    )) as IntegrationRecord[];

    return (rows || []).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      connectorId: r.connector_id,
      name: r.name,
      category: r.category,
      status: r.status,
      config: JSON.parse(r.config || '{}') as Record<string, unknown>,
      capabilities: JSON.parse(r.capabilities || '[]') as string[],
      authType: r.auth_type,
      syncSettings: r.sync_settings
        ? (JSON.parse(r.sync_settings) as Record<string, unknown>)
        : undefined,
      lastSyncAt: r.last_sync_at || undefined,
      lastError: r.last_error || undefined,
      createdAt: r.created_at ?? (r as any).createdAt,
      updatedAt: r.updated_at ?? (r as any).updatedAt,
    }));
  }

  /**
   * Connect a new integration
   */
  async connectIntegration(
    organizationId: string,
    connectorId: string,
    config: Record<string, unknown>
  ): Promise<ConnectIntegrationResult> {
    const connector = CONNECTORS[connectorId];
    if (!connector) {
      throw new Error(`Unknown connector: ${connectorId}`);
    }

    // Validate required config fields
    for (const field of connector.configFields) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const integrationId = this.deps.uuidv4();
    const cols = await this.getIntegrationsColumns();
    const hasCreatedAt = cols.has('created_at');
    const hasUpdatedAt = cols.has('updated_at');
    const hasLegacyCreatedAt = cols.has('createdAt');
    const hasLegacyUpdatedAt = cols.has('updatedAt');

    const timestampCols: string[] = [];
    const timestampValues: string[] = [];
    if (hasCreatedAt) {
      timestampCols.push('created_at');
      timestampValues.push('CURRENT_TIMESTAMP');
    } else if (hasLegacyCreatedAt) {
      timestampCols.push('"createdAt"');
      timestampValues.push('CURRENT_TIMESTAMP');
    }
    if (hasUpdatedAt) {
      timestampCols.push('updated_at');
      timestampValues.push('CURRENT_TIMESTAMP');
    } else if (hasLegacyUpdatedAt) {
      timestampCols.push('"updatedAt"');
      timestampValues.push('CURRENT_TIMESTAMP');
    }

    const baseCols = [
      'id',
      'organization_id',
      'connector_id',
      'name',
      'category',
      'status',
      'config',
      'capabilities',
      'auth_type',
    ];
    const columns = [...baseCols, ...timestampCols];
    const values = ['?', '?', '?', '?', '?', '?', '?', '?', '?', ...timestampValues];
    const params = [
      integrationId,
      organizationId,
      connectorId,
      connector.name,
      connector.category,
      STATUS.PENDING,
      JSON.stringify(config),
      JSON.stringify(connector.capabilities),
      connector.authType,
    ];

    await this.deps.db.run(
      `INSERT INTO integrations (${columns.join(', ')}) VALUES (${values.join(', ')})`,
      params
    );

    return {
      id: integrationId,
      connectorId,
      name: connector.name,
      category: connector.category,
      status: STATUS.PENDING,
      capabilities: connector.capabilities,
    };
  }

  /**
   * Update integration status
   */
  async updateIntegrationStatus(
    integrationId: string,
    status: IntegrationStatus | string,
    error: string | null = null
  ): Promise<{ success: boolean }> {
    const result = (await this.deps.db.run(
      `UPDATE integrations
             SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
      [status, error, integrationId]
    )) as RunResult;

    return { success: result.changes > 0 };
  }

  /**
   * Disconnect integration
   */
  async disconnectIntegration(integrationId: string): Promise<{ success: boolean }> {
    const result = (await this.deps.db.run(
      `UPDATE integrations
             SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
      [STATUS.DISCONNECTED, integrationId]
    )) as RunResult;

    return { success: result.changes > 0 };
  }

  /**
   * Delete integration
   */
  async deleteIntegration(integrationId: string): Promise<{ success: boolean }> {
    const result = (await this.deps.db.run(`DELETE FROM integrations WHERE id = ?`, [
      integrationId,
    ])) as RunResult;

    return { success: result.changes > 0 };
  }

  /**
   * Sync data from integration
   */
  async syncIntegration(
    integrationId: string,
    options: Record<string, unknown> = {}
  ): Promise<SyncResult> {
    const integration = await this.getIntegration(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const syncId = this.deps.uuidv4();
    const startTime = new Date();

    // Log sync start
    await this.logSyncEvent(integrationId, {
      syncId,
      event: 'sync_started',
      options,
    });

    try {
      const result: SyncResult = {
        syncId,
        integrationId,
        connector: integration.connectorId,
        status: 'completed',
        recordsSynced: 0,
        duration: 0,
      };

      const connectorId = integration.connectorId;
      const config = integration.config || {};

      const dispatched = await dispatchProviderSync(connectorId, integrationId, config, options);
      result.recordsSynced = dispatched.recordsSynced;
      if (dispatched.error) {
        result.status = 'partial';
        result.error = dispatched.error;
      }

      await this.deps.db.run(
        `UPDATE integrations 
                 SET last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
        [integrationId]
      );

      result.duration = Date.now() - startTime.getTime();

      await this.logSyncEvent(integrationId, {
        syncId,
        event: 'sync_completed',
        result,
      });

      return result;
    } catch (error: unknown) {
      await this.logSyncEvent(integrationId, {
        syncId,
        event: 'sync_failed',
        error: (error as Error).message,
      });

      await this.updateIntegrationStatus(integrationId, STATUS.ERROR, (error as Error).message);

      throw error;
    }
  }

  /**
   * Get integration by ID
   */
  async getIntegration(integrationId: string): Promise<Integration | null> {
    const row = (await this.deps.db.get<IntegrationRecord>(
      `SELECT * FROM integrations WHERE id = ?`,
      [integrationId]
    )) as IntegrationRecord | null;

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      connectorId: row.connector_id,
      name: row.name,
      category: row.category,
      status: row.status,
      config: JSON.parse(row.config || '{}') as Record<string, unknown>,
      capabilities: JSON.parse(row.capabilities || '[]') as string[],
      authType: row.auth_type,
      syncSettings: row.sync_settings
        ? (JSON.parse(row.sync_settings) as Record<string, unknown>)
        : undefined,
      lastSyncAt: row.last_sync_at || undefined,
      lastError: row.last_error || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Log sync event
   */
  async logSyncEvent(integrationId: string, event: SyncEvent): Promise<void> {
    await this.deps.db.run(
      `INSERT INTO integration_sync_logs (id, integration_id, event, data, created_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [this.deps.uuidv4(), integrationId, event.event, JSON.stringify(event)]
    );
  }

  /**
   * Get sync history
   */
  async getSyncHistory(integrationId: string, limit: number = 20): Promise<SyncLog[]> {
    const rows = (await this.deps.db.all<SyncLogRecord>(
      `SELECT * FROM integration_sync_logs
             WHERE integration_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
      [integrationId, limit]
    )) as SyncLogRecord[];

    return (rows || []).map((r) => ({
      id: r.id,
      integrationId: r.integration_id,
      event: r.event,
      data: JSON.parse(r.data || '{}') as Record<string, unknown>,
      createdAt: r.created_at,
    }));
  }

  /**
   * Get integration statistics
   */
  async getIntegrationStats(organizationId: string): Promise<IntegrationStats[]> {
    const rows = (await this.deps.db.all<IntegrationStats>(
      `SELECT 
                category,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as connected,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
             FROM integrations
             WHERE organization_id = ?
             GROUP BY category`,
      [organizationId]
    )) as IntegrationStats[];

    return rows || [];
  }

  /**
   * Initialize database tables
   */
  async initialize(): Promise<void> {
    await this.deps.db.run(
      `CREATE TABLE IF NOT EXISTS integrations (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                connector_id TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                config TEXT,
                capabilities TEXT,
                auth_type TEXT,
                sync_settings TEXT,
                last_sync_at DATETIME,
                last_error TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
    );

    await this.deps.db.run(
      `CREATE TABLE IF NOT EXISTS integration_sync_logs (
                id TEXT PRIMARY KEY,
                integration_id TEXT NOT NULL,
                event TEXT NOT NULL,
                data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
    );

    await this.deps.db.run(
      `CREATE INDEX IF NOT EXISTS idx_int_org ON integrations(organization_id)`
    );
    await this.deps.db.run(`CREATE INDEX IF NOT EXISTS idx_int_status ON integrations(status)`);
    await this.deps.db.run(
      `CREATE INDEX IF NOT EXISTS idx_sync_int ON integration_sync_logs(integration_id)`
    );
  }
}

// ==========================================
// PROVIDER SYNC DISPATCH ENGINE
// ==========================================

type ProviderSyncResult = {
  recordsSynced: number;
  error?: string;
};

type ProviderAdapter = (
  integrationId: string,
  config: Record<string, unknown>,
  options: Record<string, unknown>
) => Promise<ProviderSyncResult>;

async function jiraSyncAdapter(
  integrationId: string,
  config: Record<string, unknown>,
  _options: Record<string, unknown>
): Promise<ProviderSyncResult> {
  try {
    const { parseJiraConfig } = await import('./integrations/jiraOrgClient.js');
    const jiraCfg = parseJiraConfig(config);
    if (!jiraCfg) return { recordsSynced: 0, error: 'Invalid Jira configuration' };

    const baseUrl = jiraCfg.baseUrl;
    const auth = Buffer.from(`${jiraCfg.email}:${jiraCfg.apiToken}`).toString('base64');

    const resp = await fetch(
      `${baseUrl}/rest/api/3/search?jql=project=${jiraCfg.projectKey}&maxResults=50&fields=summary,status,assignee,updated`,
      { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      return { recordsSynced: 0, error: `Jira API ${resp.status}: ${errText.slice(0, 200)}` };
    }

    const data = (await resp.json()) as { issues?: unknown[]; total?: number };
    const issues = data.issues || [];

    const db = getDatabase();
    let synced = 0;
    for (const issue of issues as Array<{ key: string; fields?: Record<string, unknown> }>) {
      await db.run(
        `INSERT INTO integration_sync_mappings (id, integration_id, external_id, external_type, local_type, local_id, last_sync_at)
         VALUES (gen_random_uuid()::TEXT, ?, ?, 'jira_issue', 'task', ?, NOW())
         ON CONFLICT (integration_id, external_type, external_id) DO UPDATE SET last_sync_at = NOW()`,
        [integrationId, issue.key, issue.key]
      );
      synced++;
    }

    return { recordsSynced: synced };
  } catch (err) {
    return { recordsSynced: 0, error: `Jira sync error: ${(err as Error).message}` };
  }
}

async function slackSyncAdapter(
  integrationId: string,
  config: Record<string, unknown>,
  _options: Record<string, unknown>
): Promise<ProviderSyncResult> {
  try {
    const token = String(
      config.botToken || config.bot_token || config.accessToken || config.access_token || ''
    );
    if (!token) return { recordsSynced: 0, error: 'No Slack bot token configured' };

    const resp = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=100',
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }
    );

    if (!resp.ok) return { recordsSynced: 0, error: `Slack API ${resp.status}` };

    const data = (await resp.json()) as {
      ok?: boolean;
      channels?: Array<{ id: string; name: string }>;
      error?: string;
    };
    if (!data.ok) return { recordsSynced: 0, error: `Slack error: ${data.error || 'unknown'}` };

    const channels = data.channels || [];
    const db = getDatabase();
    let synced = 0;
    for (const ch of channels) {
      await db.run(
        `INSERT INTO integration_sync_mappings (id, integration_id, external_id, external_type, local_type, local_id, metadata, last_sync_at)
         VALUES (gen_random_uuid()::TEXT, ?, ?, 'slack_channel', 'channel', ?, ?::JSONB, NOW())
         ON CONFLICT (integration_id, external_type, external_id) DO UPDATE SET metadata = EXCLUDED.metadata, last_sync_at = NOW()`,
        [integrationId, ch.id, ch.id, JSON.stringify({ name: ch.name })]
      );
      synced++;
    }

    return { recordsSynced: synced };
  } catch (err) {
    return { recordsSynced: 0, error: `Slack sync error: ${(err as Error).message}` };
  }
}

async function teamsSyncAdapter(
  integrationId: string,
  config: Record<string, unknown>,
  _options: Record<string, unknown>
): Promise<ProviderSyncResult> {
  try {
    const token = String(config.accessToken || config.access_token || config.bearerToken || '');
    if (!token) return { recordsSynced: 0, error: 'No Teams access token configured' };

    const resp = await fetch('https://graph.microsoft.com/v1.0/me/joinedTeams', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!resp.ok) {
      if (resp.status === 401)
        return { recordsSynced: 0, error: 'Teams token expired — reauth required' };
      return { recordsSynced: 0, error: `Graph API ${resp.status}` };
    }

    const data = (await resp.json()) as { value?: Array<{ id: string; displayName: string }> };
    const teams = data.value || [];
    const db = getDatabase();
    let synced = 0;
    for (const team of teams) {
      await db.run(
        `INSERT INTO integration_sync_mappings (id, integration_id, external_id, external_type, local_type, local_id, metadata, last_sync_at)
         VALUES (gen_random_uuid()::TEXT, ?, ?, 'teams_team', 'team', ?, ?::JSONB, NOW())
         ON CONFLICT (integration_id, external_type, external_id) DO UPDATE SET metadata = EXCLUDED.metadata, last_sync_at = NOW()`,
        [integrationId, team.id, team.id, JSON.stringify({ displayName: team.displayName })]
      );
      synced++;
    }

    return { recordsSynced: synced };
  } catch (err) {
    return { recordsSynced: 0, error: `Teams sync error: ${(err as Error).message}` };
  }
}

async function googleSyncAdapter(
  integrationId: string,
  config: Record<string, unknown>,
  _options: Record<string, unknown>
): Promise<ProviderSyncResult> {
  try {
    const token = String(config.accessToken || config.access_token || '');
    if (!token) return { recordsSynced: 0, error: 'No Google access token configured' };

    const resp = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!resp.ok) {
      if (resp.status === 401)
        return { recordsSynced: 0, error: 'Google token expired — reauth required' };
      return { recordsSynced: 0, error: `Google API ${resp.status}` };
    }

    const data = (await resp.json()) as { items?: Array<{ id: string; summary: string }> };
    const calendars = data.items || [];
    const db = getDatabase();
    let synced = 0;
    for (const cal of calendars) {
      await db.run(
        `INSERT INTO integration_sync_mappings (id, integration_id, external_id, external_type, local_type, local_id, metadata, last_sync_at)
         VALUES (gen_random_uuid()::TEXT, ?, ?, 'google_calendar', 'calendar', ?, ?::JSONB, NOW())
         ON CONFLICT (integration_id, external_type, external_id) DO UPDATE SET metadata = EXCLUDED.metadata, last_sync_at = NOW()`,
        [integrationId, cal.id, cal.id, JSON.stringify({ summary: cal.summary })]
      );
      synced++;
    }

    return { recordsSynced: synced };
  } catch (err) {
    return { recordsSynced: 0, error: `Google sync error: ${(err as Error).message}` };
  }
}

async function genericWebhookSyncAdapter(
  integrationId: string,
  config: Record<string, unknown>,
  _options: Record<string, unknown>
): Promise<ProviderSyncResult> {
  const crypto = await import('crypto');
  const db = getDatabase();

  try {
    const orgId = String(config._organizationId || config.organizationId || '');
    if (!orgId) return { recordsSynced: 0, error: 'No organization ID for webhook sync' };

    const registrations = (await db.all(
      `SELECT registration_id, endpoint_url, secret_key, direction, event_types, is_active, consecutive_failures
       FROM v8_webhook_registrations
       WHERE integration_id = ? AND organization_id = ? AND is_active = TRUE`,
      [integrationId, orgId]
    )) as Array<{
      registration_id: string;
      endpoint_url: string;
      secret_key: string | null;
      direction: string;
      event_types: string;
      is_active: boolean;
      consecutive_failures: number;
    }> | null;

    if (!registrations?.length) {
      return { recordsSynced: 0 };
    }

    let delivered = 0;
    for (const reg of registrations) {
      if (reg.direction !== 'outbound') continue;

      const payload = JSON.stringify({
        event: 'sync_heartbeat',
        integrationId,
        timestamp: new Date().toISOString(),
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'sync_heartbeat',
      };

      if (reg.secret_key) {
        const signature = crypto.createHmac('sha256', reg.secret_key).update(payload).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const deliveryId = `wd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      try {
        const resp = await fetch(reg.endpoint_url, {
          method: 'POST',
          headers,
          body: payload,
          signal: AbortSignal.timeout(10000),
        });

        const httpStatus = resp.status;
        const responseBody = await resp.text().catch(() => '');

        await db.run(
          `INSERT INTO v8_webhook_deliveries
             (delivery_id, registration_id, organization_id, event_type, payload_hash, status, http_status, response_body, attempt_count, completed_at)
           VALUES (?, ?, ?, 'sync_heartbeat', ?, ?, ?, ?, 1, NOW())`,
          [
            deliveryId,
            reg.registration_id,
            orgId,
            crypto.createHash('sha256').update(payload).digest('hex'),
            resp.ok ? 'delivered' : 'failed',
            httpStatus,
            responseBody.slice(0, 500),
          ]
        );

        if (resp.ok) {
          delivered++;
          await db.run(
            `UPDATE v8_webhook_registrations
             SET last_delivery_at = NOW(), consecutive_failures = 0, updated_at = NOW()
             WHERE registration_id = ?`,
            [reg.registration_id]
          );
        } else {
          const newFailures = reg.consecutive_failures + 1;
          const deactivate = newFailures >= 5;
          await db.run(
            `UPDATE v8_webhook_registrations
             SET consecutive_failures = ?, is_active = ?, updated_at = NOW()
             WHERE registration_id = ?`,
            [newFailures, !deactivate, reg.registration_id]
          );
        }
      } catch (deliveryErr) {
        await db.run(
          `INSERT INTO v8_webhook_deliveries
             (delivery_id, registration_id, organization_id, event_type, status, response_body, attempt_count)
           VALUES (?, ?, ?, 'sync_heartbeat', 'failed', ?, 1)`,
          [deliveryId, reg.registration_id, orgId, (deliveryErr as Error).message.slice(0, 500)]
        );

        const newFailures = reg.consecutive_failures + 1;
        const deactivate = newFailures >= 5;
        await db.run(
          `UPDATE v8_webhook_registrations
           SET consecutive_failures = ?, is_active = ?, updated_at = NOW()
           WHERE registration_id = ?`,
          [newFailures, !deactivate, reg.registration_id]
        );
      }
    }

    return { recordsSynced: delivered };
  } catch (err) {
    return { recordsSynced: 0, error: `Webhook sync error: ${(err as Error).message}` };
  }
}

async function cloudStorageSyncAdapter(
  integrationId: string,
  config: Record<string, unknown>,
  _options: Record<string, unknown>
): Promise<ProviderSyncResult> {
  try {
    const { listCloudSources } = await import('./cloudDataService.js');
    const orgId = String(config._organizationId || config.organizationId || '');
    if (!orgId) return { recordsSynced: 0, error: 'No organization ID for cloud sync' };

    const sources = await listCloudSources(orgId);
    const matchingSource = sources.find(
      (s: any) => s.id === integrationId || s.status === 'active'
    );
    if (!matchingSource) return { recordsSynced: 0 };

    const { listCloudFiles } = await import('./cloudDataService.js');
    const files = await listCloudFiles(matchingSource.id, orgId);

    const db = getDatabase();
    let synced = 0;
    for (const file of files.slice(0, 100)) {
      await db.run(
        `INSERT INTO integration_sync_mappings (id, integration_id, external_id, external_type, local_type, local_id, metadata, last_sync_at)
         VALUES (gen_random_uuid()::TEXT, ?, ?, 'cloud_file', 'file', ?, ?::JSONB, NOW())
         ON CONFLICT (integration_id, external_type, external_id) DO UPDATE SET metadata = EXCLUDED.metadata, last_sync_at = NOW()`,
        [
          integrationId,
          file.id,
          file.id,
          JSON.stringify({
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            isFolder: file.isFolder,
          }),
        ]
      );
      synced++;
    }

    return { recordsSynced: synced };
  } catch (err) {
    return { recordsSynced: 0, error: `Cloud storage sync error: ${(err as Error).message}` };
  }
}

const PROVIDER_ADAPTERS: Record<string, ProviderAdapter> = {
  jira: jiraSyncAdapter,
  slack: slackSyncAdapter,
  teams: teamsSyncAdapter,
  gmail: googleSyncAdapter,
  google_calendar: googleSyncAdapter,
  google_drive: cloudStorageSyncAdapter,
  onedrive: cloudStorageSyncAdapter,
  dropbox: cloudStorageSyncAdapter,
};

async function dispatchProviderSync(
  connectorId: string,
  integrationId: string,
  config: Record<string, unknown>,
  options: Record<string, unknown>
): Promise<ProviderSyncResult> {
  const adapter = PROVIDER_ADAPTERS[connectorId];
  if (!adapter) {
    return genericWebhookSyncAdapter(integrationId, config, options);
  }
  return adapter(integrationId, config, options);
}

// Create singleton instance
const integrationHubServiceInstance = new IntegrationHubServiceClass();

// Export individual functions for backward compatibility
export const getAvailableConnectors = (category?: IntegrationCategory | null) =>
  integrationHubServiceInstance.getAvailableConnectors(category);
export const getConnectedIntegrations = (organizationId: string) =>
  integrationHubServiceInstance.getConnectedIntegrations(organizationId);
export const connectIntegration = (
  organizationId: string,
  connectorId: string,
  config: Record<string, unknown>
) => integrationHubServiceInstance.connectIntegration(organizationId, connectorId, config);
export const updateIntegrationStatus = (
  integrationId: string,
  status: IntegrationStatus | string,
  error?: string | null
) => integrationHubServiceInstance.updateIntegrationStatus(integrationId, status, error);
export const disconnectIntegration = (integrationId: string) =>
  integrationHubServiceInstance.disconnectIntegration(integrationId);
export const deleteIntegration = (integrationId: string) =>
  integrationHubServiceInstance.deleteIntegration(integrationId);
export const syncIntegration = (integrationId: string, options?: Record<string, unknown>) =>
  integrationHubServiceInstance.syncIntegration(integrationId, options);
export const getIntegration = (integrationId: string) =>
  integrationHubServiceInstance.getIntegration(integrationId);
export const logSyncEvent = (integrationId: string, event: SyncEvent) =>
  integrationHubServiceInstance.logSyncEvent(integrationId, event);
export const getSyncHistory = (integrationId: string, limit?: number) =>
  integrationHubServiceInstance.getSyncHistory(integrationId, limit);
export const getIntegrationStats = (organizationId: string) =>
  integrationHubServiceInstance.getIntegrationStats(organizationId);
export const initialize = () => integrationHubServiceInstance.initialize();

// Default export for backward compatibility
const integrationHubService = {
  CATEGORIES,
  STATUS,
  CONNECTORS,
  getAvailableConnectors,
  getConnectedIntegrations,
  connectIntegration,
  updateIntegrationStatus,
  disconnectIntegration,
  deleteIntegration,
  syncIntegration,
  getIntegration,
  logSyncEvent,
  getSyncHistory,
  getIntegrationStats,
  initialize,
  setDependencies: (newDeps: Partial<IntegrationHubServiceDependencies>) =>
    integrationHubServiceInstance.setDependencies(newDeps),
};

export default integrationHubService;
