/**
 * Integration Service
 * 
 * Manages third-party integrations and connectors.
 * Features:
 * - Integration CRUD operations
 * - Sync management
 * - Health monitoring
 * - Error handling and retry logic
 */

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



class IntegrationService {
    /**
     * Get all integrations for an organization
     */
    async getIntegrations(organizationId, filters = {}) {
        const { type, enabled } = filters;

        let query = 'SELECT * FROM integrations WHERE organization_id = ?';
        const params = [organizationId];

        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }

        if (enabled !== undefined) {
            query += ' AND enabled = ?';
            params.push(enabled ? 1 : 0);
        }

        query += ' ORDER BY created_at DESC';

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Integration] Error fetching integrations:', err);
                    return reject(err);
                }

                const integrations = rows.map(row => ({
                    ...row,
                    config: row.config ? JSON.parse(row.config) : {},
                    auth_config: row.auth_config ? JSON.parse(row.auth_config) : {},
                    sync_config: row.sync_config ? JSON.parse(row.sync_config) : {},
                    enabled: row.enabled === 1
                }));

                resolve(integrations);
            });
        });
    }

    /**
     * Get integration by ID
     */
    async getIntegrationById(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM integrations WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('[Integration] Error fetching integration:', err);
                    return reject(err);
                }

                if (!row) {
                    return resolve(null);
                }

                resolve({
                    ...row,
                    config: row.config ? JSON.parse(row.config) : {},
                    auth_config: row.auth_config ? JSON.parse(row.auth_config) : {},
                    sync_config: row.sync_config ? JSON.parse(row.sync_config) : {},
                    enabled: row.enabled === 1
                });
            });
        });
    }

    /**
     * Create a new integration
     */
    async createIntegration(integrationData) {
        const {
            organization_id,
            type,
            name,
            config = {},
            auth_config = {},
            enabled = true,
            sync_config = {}
        } = integrationData;

        const id = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO integrations (
                    id, organization_id, type, name, config, auth_config,
                    enabled, sync_config, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, organization_id, type, name,
                    JSON.stringify(config), JSON.stringify(auth_config),
                    enabled ? 1 : 0, JSON.stringify(sync_config),
                    now, now
                ],
                function (err) {
                    if (err) {
                        console.error('[Integration] Error creating integration:', err);
                        return reject(err);
                    }
                    resolve({ id, ...integrationData });
                }
            );
        });
    }

    /**
     * Update an integration
     */
    async updateIntegration(id, updates) {
        const {
            name,
            config,
            auth_config,
            enabled,
            sync_config
        } = updates;

        const updatesList = [];
        const params = [];

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

        if (updatesList.length === 0) {
            return this.getIntegrationById(id);
        }

        updatesList.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE integrations SET ${updatesList.join(', ')} WHERE id = ?`,
                params,
                function (err) {
                    if (err) {
                        console.error('[Integration] Error updating integration:', err);
                        return reject(err);
                    }
                    resolve(this.getIntegrationById(id));
                }.bind(this)
            );
        });
    }

    /**
     * Delete an integration
     */
    async deleteIntegration(id) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM integrations WHERE id = ?', [id], function (err) {
                if (err) {
                    console.error('[Integration] Error deleting integration:', err);
                    return reject(err);
                }
                resolve({ deleted: this.changes > 0 });
            });
        });
    }

    /**
     * Trigger a sync for an integration
     */
    async syncIntegration(id, syncType = 'incremental') {
        const integration = await this.getIntegrationById(id);
        if (!integration) {
            throw new Error('Integration not found');
        }

        const syncLogId = uuidv4();
        const startedAt = new Date().toISOString();

        // Create sync log entry
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO integration_sync_logs (
                    id, integration_id, sync_type, status, started_at
                ) VALUES (?, ?, ?, ?, ?)`,
                [syncLogId, id, syncType, 'in_progress', startedAt],
                async (err) => {
                    if (err) {
                        console.error('[Integration] Error creating sync log:', err);
                        return reject(err);
                    }

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

                        resolve({ syncLogId, ...result });
                    } catch (error) {
                        // Update sync log with error
                        await this.updateSyncLog(syncLogId, {
                            status: 'failed',
                            errors: JSON.stringify({ error: error.message }),
                            completed_at: new Date().toISOString()
                        });

                        // Update integration last sync info
                        await this.updateIntegration(id, {
                            last_sync_at: new Date().toISOString(),
                            last_sync_status: 'failed'
                        });

                        reject(error);
                    }
                }
            );
        });
    }

    /**
     * Perform actual sync (placeholder - implement per integration type)
     */
    async performSync(integration, syncType) {
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
    async updateSyncLog(syncLogId, updates) {
        const { status, records_processed, errors, completed_at } = updates;

        const updatesList = [];
        const params = [];

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

        if (updatesList.length === 0) return;

        params.push(syncLogId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE integration_sync_logs SET ${updatesList.join(', ')} WHERE id = ?`,
                params,
                function (err) {
                    if (err) {
                        console.error('[Integration] Error updating sync log:', err);
                        return reject(err);
                    }
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Get sync logs for an integration
     */
    async getSyncLogs(integrationId, limit = 50) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM integration_sync_logs 
                 WHERE integration_id = ? 
                 ORDER BY started_at DESC 
                 LIMIT ?`,
                [integrationId, limit],
                (err, rows) => {
                    if (err) {
                        console.error('[Integration] Error fetching sync logs:', err);
                        return reject(err);
                    }

                    const logs = rows.map(row => ({
                        ...row,
                        errors: row.errors ? JSON.parse(row.errors) : null
                    }));

                    resolve(logs);
                }
            );
        });
    }

    /**
     * Check integration health
     */
    async checkHealth(id) {
        const integration = await this.getIntegrationById(id);
        if (!integration) {
            throw new Error('Integration not found');
        }

        // Basic health check - verify connection
        try {
            // This is a placeholder - implement actual health check per integration type
            return {
                status: 'healthy',
                lastSync: integration.last_sync_at,
                lastSyncStatus: integration.last_sync_status
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Get available integration types
     */
    getAvailableTypes() {
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
}

const integrationServiceInstance = new IntegrationService();
export default integrationServiceInstance;








