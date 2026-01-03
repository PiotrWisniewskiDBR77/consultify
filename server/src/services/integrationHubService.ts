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

import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/Logger.js';

// ==========================================
// CONSTANTS
// ==========================================

export const CATEGORIES = {
    ERP: 'erp',
    CRM: 'crm',
    PROJECT_MANAGEMENT: 'project_management',
    BI: 'business_intelligence',
    COMMUNICATION: 'communication',
    HRIS: 'hris',
    FINANCE: 'finance',
    COLLABORATION: 'collaboration'
} as const;

export const STATUS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error',
    PENDING: 'pending',
    REQUIRES_REAUTH: 'requires_reauth'
} as const;

export type IntegrationCategory = typeof CATEGORIES[keyof typeof CATEGORIES];
export type IntegrationStatus = typeof STATUS[keyof typeof STATUS];

export interface Connector {
    id: string;
    name: string;
    category: IntegrationCategory;
    capabilities: string[];
    authType: 'oauth2' | 'api_key' | 'token';
    configFields: string[];
}

export const CONNECTORS: Record<string, Connector> = {
    // ERP
    sap: {
        id: 'sap',
        name: 'SAP',
        category: CATEGORIES.ERP,
        capabilities: ['finance', 'procurement', 'inventory', 'projects'],
        authType: 'oauth2',
        configFields: ['instance_url', 'client_id', 'client_secret']
    },
    oracle_erp: {
        id: 'oracle_erp',
        name: 'Oracle ERP Cloud',
        category: CATEGORIES.ERP,
        capabilities: ['finance', 'projects', 'procurement'],
        authType: 'oauth2',
        configFields: ['tenant_id', 'client_id', 'client_secret']
    },
    dynamics_365: {
        id: 'dynamics_365',
        name: 'Microsoft Dynamics 365',
        category: CATEGORIES.ERP,
        capabilities: ['finance', 'sales', 'projects'],
        authType: 'oauth2',
        configFields: ['tenant_id', 'environment_url']
    },

    // CRM
    salesforce: {
        id: 'salesforce',
        name: 'Salesforce',
        category: CATEGORIES.CRM,
        capabilities: ['contacts', 'opportunities', 'accounts', 'campaigns'],
        authType: 'oauth2',
        configFields: ['instance_url', 'client_id', 'client_secret']
    },
    hubspot: {
        id: 'hubspot',
        name: 'HubSpot',
        category: CATEGORIES.CRM,
        capabilities: ['contacts', 'deals', 'companies', 'marketing'],
        authType: 'oauth2',
        configFields: ['portal_id']
    },
    zoho_crm: {
        id: 'zoho_crm',
        name: 'Zoho CRM',
        category: CATEGORIES.CRM,
        capabilities: ['leads', 'contacts', 'deals', 'accounts'],
        authType: 'oauth2',
        configFields: ['organization_id']
    },

    // Project Management
    jira: {
        id: 'jira',
        name: 'Jira',
        category: CATEGORIES.PROJECT_MANAGEMENT,
        capabilities: ['issues', 'projects', 'sprints', 'boards'],
        authType: 'oauth2',
        configFields: ['site_url', 'cloud_id']
    },
    asana: {
        id: 'asana',
        name: 'Asana',
        category: CATEGORIES.PROJECT_MANAGEMENT,
        capabilities: ['tasks', 'projects', 'workspaces', 'portfolios'],
        authType: 'oauth2',
        configFields: ['workspace_gid']
    },
    monday: {
        id: 'monday',
        name: 'Monday.com',
        category: CATEGORIES.PROJECT_MANAGEMENT,
        capabilities: ['boards', 'items', 'updates', 'workspaces'],
        authType: 'api_key',
        configFields: ['api_token']
    },
    azure_devops: {
        id: 'azure_devops',
        name: 'Azure DevOps',
        category: CATEGORIES.PROJECT_MANAGEMENT,
        capabilities: ['work_items', 'projects', 'pipelines', 'repos'],
        authType: 'oauth2',
        configFields: ['organization_url']
    },

    // BI
    powerbi: {
        id: 'powerbi',
        name: 'Microsoft Power BI',
        category: CATEGORIES.BI,
        capabilities: ['reports', 'dashboards', 'datasets'],
        authType: 'oauth2',
        configFields: ['workspace_id']
    },
    tableau: {
        id: 'tableau',
        name: 'Tableau',
        category: CATEGORIES.BI,
        capabilities: ['workbooks', 'views', 'datasources'],
        authType: 'token',
        configFields: ['site_url', 'site_id']
    },
    looker: {
        id: 'looker',
        name: 'Looker',
        category: CATEGORIES.BI,
        capabilities: ['dashboards', 'looks', 'explores'],
        authType: 'api_key',
        configFields: ['base_url', 'client_id', 'client_secret']
    },

    // Communication
    slack: {
        id: 'slack',
        name: 'Slack',
        category: CATEGORIES.COMMUNICATION,
        capabilities: ['messages', 'channels', 'notifications'],
        authType: 'oauth2',
        configFields: ['workspace_id']
    },
    teams: {
        id: 'teams',
        name: 'Microsoft Teams',
        category: CATEGORIES.COMMUNICATION,
        capabilities: ['messages', 'channels', 'meetings', 'notifications'],
        authType: 'oauth2',
        configFields: ['tenant_id']
    },
    gmail: {
        id: 'gmail',
        name: 'Gmail / Google Workspace',
        category: CATEGORIES.COMMUNICATION,
        capabilities: ['email', 'calendar', 'contacts'],
        authType: 'oauth2',
        configFields: ['domain']
    }
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

    constructor(deps?: Partial<IntegrationHubServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4
        };
    }

    /**
     * Set dependencies (for testing)
     */
    setDependencies(newDeps: Partial<IntegrationHubServiceDependencies>): void {
        this.deps = { ...this.deps, ...newDeps };
    }

    /**
     * Get all available connectors
     */
    async getAvailableConnectors(category: IntegrationCategory | null = null): Promise<AvailableConnector[]> {
        let connectors = Object.values(CONNECTORS);
        
        if (category) {
            connectors = connectors.filter(c => c.category === category);
        }

        return connectors.map(c => ({
            ...c,
            isAvailable: true
        }));
    }

    /**
     * Get organization's connected integrations
     */
    async getConnectedIntegrations(organizationId: string): Promise<Integration[]> {
        const rows = await this.deps.db.all<IntegrationRecord>(
            `SELECT * FROM integrations
             WHERE organization_id = ?
             ORDER BY created_at DESC`,
            [organizationId]
        ) as IntegrationRecord[];

        return (rows || []).map(r => ({
            id: r.id,
            organizationId: r.organization_id,
            connectorId: r.connector_id,
            name: r.name,
            category: r.category,
            status: r.status,
            config: JSON.parse(r.config || '{}') as Record<string, unknown>,
            capabilities: JSON.parse(r.capabilities || '[]') as string[],
            authType: r.auth_type,
            syncSettings: r.sync_settings ? JSON.parse(r.sync_settings) as Record<string, unknown> : undefined,
            lastSyncAt: r.last_sync_at || undefined,
            lastError: r.last_error || undefined,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));
    }

    /**
     * Connect a new integration
     */
    async connectIntegration(organizationId: string, connectorId: string, config: Record<string, unknown>): Promise<ConnectIntegrationResult> {
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

        await this.deps.db.run(
            `INSERT INTO integrations (
                id, organization_id, connector_id, name, category,
                status, config, capabilities, auth_type, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                integrationId,
                organizationId,
                connectorId,
                connector.name,
                connector.category,
                STATUS.PENDING,
                JSON.stringify(config),
                JSON.stringify(connector.capabilities),
                connector.authType
            ]
        );

        return {
            id: integrationId,
            connectorId,
            name: connector.name,
            category: connector.category,
            status: STATUS.PENDING,
            capabilities: connector.capabilities
        };
    }

    /**
     * Update integration status
     */
    async updateIntegrationStatus(integrationId: string, status: IntegrationStatus | string, error: string | null = null): Promise<{ success: boolean }> {
        const result = await this.deps.db.run(
            `UPDATE integrations
             SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, error, integrationId]
        ) as RunResult;

        return { success: result.changes > 0 };
    }

    /**
     * Disconnect integration
     */
    async disconnectIntegration(integrationId: string): Promise<{ success: boolean }> {
        const result = await this.deps.db.run(
            `UPDATE integrations
             SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [STATUS.DISCONNECTED, integrationId]
        ) as RunResult;

        return { success: result.changes > 0 };
    }

    /**
     * Delete integration
     */
    async deleteIntegration(integrationId: string): Promise<{ success: boolean }> {
        const result = await this.deps.db.run(
            `DELETE FROM integrations WHERE id = ?`,
            [integrationId]
        ) as RunResult;

        return { success: result.changes > 0 };
    }

    /**
     * Sync data from integration
     */
    async syncIntegration(integrationId: string, options: Record<string, unknown> = {}): Promise<SyncResult> {
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
            options
        });

        try {
            // This would call the actual connector sync logic
            // Simplified implementation
            const result: SyncResult = {
                syncId,
                integrationId,
                connector: integration.connectorId,
                status: 'completed',
                recordsSynced: 0,
                duration: 0
            };

            // Update last sync time
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
                result
            });

            return result;

        } catch (error) {
            await this.logSyncEvent(integrationId, {
                syncId,
                event: 'sync_failed',
                error: (error as Error).message
            });

            await this.updateIntegrationStatus(
                integrationId, 
                STATUS.ERROR, 
                (error as Error).message
            );

            throw error;
        }
    }

    /**
     * Get integration by ID
     */
    async getIntegration(integrationId: string): Promise<Integration | null> {
        const row = await this.deps.db.get<IntegrationRecord>(
            `SELECT * FROM integrations WHERE id = ?`,
            [integrationId]
        ) as IntegrationRecord | null;

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
            syncSettings: row.sync_settings ? JSON.parse(row.sync_settings) as Record<string, unknown> : undefined,
            lastSyncAt: row.last_sync_at || undefined,
            lastError: row.last_error || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at
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
        const rows = await this.deps.db.all<SyncLogRecord>(
            `SELECT * FROM integration_sync_logs
             WHERE integration_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [integrationId, limit]
        ) as SyncLogRecord[];

        return (rows || []).map(r => ({
            id: r.id,
            integrationId: r.integration_id,
            event: r.event,
            data: JSON.parse(r.data || '{}') as Record<string, unknown>,
            createdAt: r.created_at
        }));
    }

    /**
     * Get integration statistics
     */
    async getIntegrationStats(organizationId: string): Promise<IntegrationStats[]> {
        const rows = await this.deps.db.all<IntegrationStats>(
            `SELECT 
                category,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as connected,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
             FROM integrations
             WHERE organization_id = ?
             GROUP BY category`,
            [organizationId]
        ) as IntegrationStats[];

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

        await this.deps.db.run(`CREATE INDEX IF NOT EXISTS idx_int_org ON integrations(organization_id)`);
        await this.deps.db.run(`CREATE INDEX IF NOT EXISTS idx_int_status ON integrations(status)`);
        await this.deps.db.run(`CREATE INDEX IF NOT EXISTS idx_sync_int ON integration_sync_logs(integration_id)`);
    }
}

// Create singleton instance
const integrationHubServiceInstance = new IntegrationHubServiceClass();

// Export constants
export { CATEGORIES, STATUS, CONNECTORS };

// Export individual functions for backward compatibility
export const getAvailableConnectors = (category?: IntegrationCategory | null) =>
    integrationHubServiceInstance.getAvailableConnectors(category);
export const getConnectedIntegrations = (organizationId: string) =>
    integrationHubServiceInstance.getConnectedIntegrations(organizationId);
export const connectIntegration = (organizationId: string, connectorId: string, config: Record<string, unknown>) =>
    integrationHubServiceInstance.connectIntegration(organizationId, connectorId, config);
export const updateIntegrationStatus = (integrationId: string, status: IntegrationStatus | string, error?: string | null) =>
    integrationHubServiceInstance.updateIntegrationStatus(integrationId, status, error);
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
    setDependencies: (newDeps: Partial<IntegrationHubServiceDependencies>) => integrationHubServiceInstance.setDependencies(newDeps)
};

export default integrationHubService;
