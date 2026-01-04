/**
 * Integration Service
 * 
 * Manages third-party integrations and connectors.
 * Features:
 * - Integration CRUD operations
 * - Sync management
 * - Health monitoring
 * - Error handling and retry logic
 * 
 * Fully migrated from server/services/integrationService.js to TypeScript
 */

import type { IDatabase, RunResult } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/Logger.js';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface IntegrationFilters {
    type?: string;
    enabled?: boolean;
}

export interface IntegrationRecord {
    id: string;
    organization_id: string;
    type: string;
    name: string;
    config: string;
    auth_config: string;
    enabled: number;
    sync_config: string;
    last_sync_at?: string | null;
    last_sync_status?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface Integration {
    id: string;
    organizationId: string;
    type: string;
    name: string;
    config: Record<string, unknown>;
    authConfig: Record<string, unknown>;
    enabled: boolean;
    syncConfig: Record<string, unknown>;
    lastSyncAt?: string | null;
    lastSyncStatus?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateIntegrationData {
    organization_id: string;
    type: string;
    name: string;
    config?: Record<string, unknown>;
    auth_config?: Record<string, unknown>;
    enabled?: boolean;
    sync_config?: Record<string, unknown>;
}

export interface UpdateIntegrationData {
    name?: string;
    config?: Record<string, unknown>;
    auth_config?: Record<string, unknown>;
    enabled?: boolean;
    sync_config?: Record<string, unknown>;
    last_sync_at?: string;
    last_sync_status?: string;
}

export interface SyncLogRecord {
    id: string;
    integration_id: string;
    sync_type: string;
    status: string;
    started_at: string;
    completed_at?: string | null;
    records_processed?: number | null;
    errors?: string | null;
}

export interface SyncLog {
    id: string;
    integrationId: string;
    syncType: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    recordsProcessed?: number | null;
    errors?: Record<string, unknown> | null;
}

export interface SyncResult {
    recordsProcessed: number;
    message?: string;
}

export interface HealthCheckResult {
    status: 'healthy' | 'unhealthy';
    lastSync?: string | null;
    lastSyncStatus?: string | null;
    error?: string;
}

export interface IntegrationType {
    id: string;
    name: string;
    description: string;
}

export interface UpdateSyncLogData {
    status?: string;
    records_processed?: number;
    errors?: string;
    completed_at?: string;
}

// Dependency injection interface for testing
export interface IntegrationServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class IntegrationServiceClass {
    private deps: IntegrationServiceDependencies;

    constructor(deps?: Partial<IntegrationServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4
        };
    }

    /**
     * Set dependencies (for testing)
     */
    setDependencies(newDeps: Partial<IntegrationServiceDependencies>): void {
        this.deps = { ...this.deps, ...newDeps };
    }

    /**
     * Get all integrations for an organization
     */
    async getIntegrations(organizationId: string, filters: IntegrationFilters = {}): Promise<Integration[]> {
        const { type, enabled } = filters;

        let query = 'SELECT * FROM integrations WHERE organization_id = ?';
        const params: unknown[] = [organizationId];

        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }

        if (enabled !== undefined) {
            query += ' AND enabled = ?';
            params.push(enabled ? 1 : 0);
        }

        query += ' ORDER BY created_at DESC';

        const rows = await this.deps.db.all<IntegrationRecord>(query, params) as IntegrationRecord[];
        
        return rows.map(row => this._formatIntegration(row));
    }

    /**
     * Get integration by ID
     */
    async getIntegrationById(id: string): Promise<Integration | null> {
        const row = await this.deps.db.get<IntegrationRecord>(
            'SELECT * FROM integrations WHERE id = ?',
            [id]
        ) as IntegrationRecord | null;

        if (!row) {
            return null;
        }

        return this._formatIntegration(row);
    }

    /**
     * Create a new integration
     */
    async createIntegration(integrationData: CreateIntegrationData): Promise<Integration> {
        const {
            organization_id,
            type,
            name,
            config = {},
            auth_config = {},
            enabled = true,
            sync_config = {}
        } = integrationData;

        const id = this.deps.uuidv4();
        const now = new Date().toISOString();

        await this.deps.db.run(
            `INSERT INTO integrations (
                id, organization_id, type, name, config, auth_config,
                enabled, sync_config, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, organization_id, type, name,
                JSON.stringify(config), JSON.stringify(auth_config),
                enabled ? 1 : 0, JSON.stringify(sync_config),
                now, now
            ]
        );

        const created = await this.getIntegrationById(id);
        if (!created) {
            throw new Error('Failed to retrieve created integration');
        }
        return created;
    }

    /**
     * Update an integration
     */
    async updateIntegration(id: string, updates: UpdateIntegrationData): Promise<Integration> {
        const {
            name,
            config,
            auth_config,
            enabled,
            sync_config,
            last_sync_at,
            last_sync_status
        } = updates;

        const updatesList: string[] = [];
        const params: unknown[] = [];

        if (name !== undefined) {
            updatesList.push('name = ?');
            params.push(name);
        }

        if (config !== undefined) {
            updatesList.push('config = ?');
            params.push(JSON.stringify(config));
        }

        if (auth_config !== undefined) {
            updatesList.push('auth_config = ?');
            params.push(JSON.stringify(auth_config));
        }

        if (enabled !== undefined) {
            updatesList.push('enabled = ?');
            params.push(enabled ? 1 : 0);
        }

        if (sync_config !== undefined) {
            updatesList.push('sync_config = ?');
            params.push(JSON.stringify(sync_config));
        }

        if (last_sync_at !== undefined) {
            updatesList.push('last_sync_at = ?');
            params.push(last_sync_at);
        }

        if (last_sync_status !== undefined) {
            updatesList.push('last_sync_status = ?');
            params.push(last_sync_status);
        }

        if (updatesList.length === 0) {
            const existing = await this.getIntegrationById(id);
            if (!existing) {
                throw new Error('Integration not found');
            }
            return existing;
        }

        updatesList.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);

        await this.deps.db.run(
            `UPDATE integrations SET ${updatesList.join(', ')} WHERE id = ?`,
            params
        );

        const updated = await this.getIntegrationById(id);
        if (!updated) {
            throw new Error('Failed to retrieve updated integration');
        }
        return updated;
    }

    /**
     * Delete an integration
     */
    async deleteIntegration(id: string): Promise<{ deleted: boolean }> {
        const result = await this.deps.db.run(
            'DELETE FROM integrations WHERE id = ?',
            [id]
        ) as RunResult;

        return { deleted: result.changes > 0 };
    }

    /**
     * Trigger a sync for an integration
     */
    async syncIntegration(id: string, syncType: string = 'incremental'): Promise<{ syncLogId: string } & SyncResult> {
        const integration = await this.getIntegrationById(id);
        if (!integration) {
            throw new Error('Integration not found');
        }

        const syncLogId = this.deps.uuidv4();
        const startedAt = new Date().toISOString();

        // Create sync log entry
        await this.deps.db.run(
            `INSERT INTO integration_sync_logs (
                id, integration_id, sync_type, status, started_at
            ) VALUES (?, ?, ?, ?, ?)`,
            [syncLogId, id, syncType, 'in_progress', startedAt]
        );

        try {
            // Perform actual sync based on integration type
            const result = await this.performSync(integration, syncType);

            // Update sync log with results
            await this.updateSyncLog(syncLogId, {
                status: 'success',
                records_processed: result.recordsProcessed || 0,
                completed_at: new Date().toISOString()
            });

            // Update integration last sync info
            await this.updateIntegration(id, {
                last_sync_at: new Date().toISOString(),
                last_sync_status: 'success'
            });

            return { syncLogId, ...result };
        } catch (error: unknown) {
            // Update sync log with error
            await this.updateSyncLog(syncLogId, {
                status: 'failed',
                errors: JSON.stringify({ error: (error as Error).message }),
                completed_at: new Date().toISOString()
            });

            // Update integration last sync info
            await this.updateIntegration(id, {
                last_sync_at: new Date().toISOString(),
                last_sync_status: 'failed'
            });

            throw error;
        }
    }

    /**
     * Perform actual sync (placeholder - implement per integration type)
     */
    async performSync(integration: Integration, syncType: string): Promise<SyncResult> {
        // This is a placeholder - implement actual sync logic per integration type
        // For now, return a mock result
        return {
            recordsProcessed: 0,
            message: `Sync for ${integration.type} not yet implemented`
        };
    }

    /**
     * Update sync log
     */
    async updateSyncLog(syncLogId: string, updates: UpdateSyncLogData): Promise<{ updated: boolean }> {
        const { status, records_processed, errors, completed_at } = updates;

        const updatesList: string[] = [];
        const params: unknown[] = [];

        if (status !== undefined) {
            updatesList.push('status = ?');
            params.push(status);
        }

        if (records_processed !== undefined) {
            updatesList.push('records_processed = ?');
            params.push(records_processed);
        }

        if (errors !== undefined) {
            updatesList.push('errors = ?');
            params.push(errors);
        }

        if (completed_at !== undefined) {
            updatesList.push('completed_at = ?');
            params.push(completed_at);
        }

        if (updatesList.length === 0) {
            return { updated: false };
        }

        params.push(syncLogId);

        const result = await this.deps.db.run(
            `UPDATE integration_sync_logs SET ${updatesList.join(', ')} WHERE id = ?`,
            params
        ) as RunResult;

        return { updated: result.changes > 0 };
    }

    /**
     * Get sync logs for an integration
     */
    async getSyncLogs(integrationId: string, limit: number = 50): Promise<SyncLog[]> {
        const rows = await this.deps.db.all<SyncLogRecord>(
            `SELECT * FROM integration_sync_logs 
             WHERE integration_id = ? 
             ORDER BY started_at DESC 
             LIMIT ?`,
            [integrationId, limit]
        ) as SyncLogRecord[];

        return rows.map(row => ({
            id: row.id,
            integrationId: row.integration_id,
            syncType: row.sync_type,
            status: row.status,
            startedAt: row.started_at,
            completedAt: row.completed_at || undefined,
            recordsProcessed: row.records_processed || undefined,
            errors: row.errors ? JSON.parse(row.errors) as Record<string, unknown> : null
        }));
    }

    /**
     * Check integration health
     */
    async checkHealth(id: string): Promise<HealthCheckResult> {
        const integration = await this.getIntegrationById(id);
        if (!integration) {
            throw new Error('Integration not found');
        }

        // Basic health check - verify connection
        try {
            // This is a placeholder - implement actual health check per integration type
            return {
                status: 'healthy',
                lastSync: integration.lastSyncAt,
                lastSyncStatus: integration.lastSyncStatus
            };
        } catch (error: unknown) {
            return {
                status: 'unhealthy',
                error: (error as Error).message
            };
        }
    }

    /**
     * Get available integration types
     */
    getAvailableTypes(): IntegrationType[] {
        return [
            { id: 'slack', name: 'Slack', description: 'Slack notifications and commands' },
            { id: 'microsoft_teams', name: 'Microsoft Teams', description: 'Teams notifications' },
            { id: 'jira', name: 'Jira', description: 'Bi-directional Jira sync' },
            { id: 'confluence', name: 'Confluence', description: 'Confluence integration' },
            { id: 'google_workspace', name: 'Google Workspace', description: 'Calendar, Drive, Gmail' },
            { id: 'microsoft_365', name: 'Microsoft 365', description: 'Office 365 integration' },
            { id: 'github', name: 'GitHub', description: 'GitHub integration' },
            { id: 'gitlab', name: 'GitLab', description: 'GitLab integration' },
            { id: 'salesforce', name: 'Salesforce', description: 'Salesforce CRM integration' },
            { id: 'hubspot', name: 'HubSpot', description: 'HubSpot CRM integration' }
        ];
    }

    /**
     * Format integration from DB record to API response
     * @private
     */
    private _formatIntegration(row: IntegrationRecord): Integration {
        return {
            id: row.id,
            organizationId: row.organization_id,
            type: row.type,
            name: row.name,
            config: row.config ? JSON.parse(row.config) as Record<string, unknown> : {},
            authConfig: row.auth_config ? JSON.parse(row.auth_config) as Record<string, unknown> : {},
            enabled: row.enabled === 1,
            syncConfig: row.sync_config ? JSON.parse(row.sync_config) as Record<string, unknown> : {},
            lastSyncAt: row.last_sync_at || undefined,
            lastSyncStatus: row.last_sync_status || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

// Create singleton instance
const integrationServiceInstance = new IntegrationServiceClass();

// Export individual functions for backward compatibility
export const getIntegrations = (organizationId: string, filters?: IntegrationFilters) =>
    integrationServiceInstance.getIntegrations(organizationId, filters);
export const getIntegrationById = (id: string) =>
    integrationServiceInstance.getIntegrationById(id);
export const createIntegration = (integrationData: CreateIntegrationData) =>
    integrationServiceInstance.createIntegration(integrationData);
export const updateIntegration = (id: string, updates: UpdateIntegrationData) =>
    integrationServiceInstance.updateIntegration(id, updates);
export const deleteIntegration = (id: string) =>
    integrationServiceInstance.deleteIntegration(id);
export const syncIntegration = (id: string, syncType?: string) =>
    integrationServiceInstance.syncIntegration(id, syncType);
export const performSync = (integration: Integration, syncType: string) =>
    integrationServiceInstance.performSync(integration, syncType);
export const updateSyncLog = (syncLogId: string, updates: UpdateSyncLogData) =>
    integrationServiceInstance.updateSyncLog(syncLogId, updates);
export const getSyncLogs = (integrationId: string, limit?: number) =>
    integrationServiceInstance.getSyncLogs(integrationId, limit);
export const checkHealth = (id: string) =>
    integrationServiceInstance.checkHealth(id);
export const getAvailableTypes = () =>
    integrationServiceInstance.getAvailableTypes();

// Default export for backward compatibility
const integrationService = {
    getIntegrations,
    getIntegrationById,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    syncIntegration,
    performSync,
    updateSyncLog,
    getSyncLogs,
    checkHealth,
    getAvailableTypes
};

export default integrationService;
