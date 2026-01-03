/**
 * Integration Hub Service
 * 
 * Centralized integration management for:
 * - ERP Systems (SAP, Oracle, Microsoft Dynamics)
 * - CRM Platforms (Salesforce, HubSpot, Zoho)
 * - Project Management (Jira, Monday, Asana, Azure DevOps)
 * - BI Tools (Power BI, Tableau, Looker)
 * - Communication (Slack, Microsoft Teams, Email)
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Integration categories
const CATEGORIES = {
    ERP: 'erp',
    CRM: 'crm',
    PROJECT_MANAGEMENT: 'project_management',
    BI: 'business_intelligence',
    COMMUNICATION: 'communication',
    HRIS: 'hris',
    FINANCE: 'finance',
    COLLABORATION: 'collaboration'
};

// Connection status
const STATUS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error',
    PENDING: 'pending',
    REQUIRES_REAUTH: 'requires_reauth'
};

// Available connectors
const CONNECTORS = {
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

const IntegrationHubService = {
    CATEGORIES,
    STATUS,
    CONNECTORS,

    /**
     * Get all available connectors
     */
    getAvailableConnectors: async (category = null) => {
        let connectors = Object.values(CONNECTORS);
        
        if (category) {
            connectors = connectors.filter(c => c.category === category);
        }

        return connectors.map(c => ({
            ...c,
            isAvailable: true
        }));
    },

    /**
     * Get organization's connected integrations
     */
    getConnectedIntegrations: async (organizationId) => {
        return new Promise((resolve) => {
            db.all(`
                SELECT * FROM integrations
                WHERE organization_id = ?
                ORDER BY created_at DESC
            `, [organizationId], (err, rows) => {
                if (err) return resolve([]);

                const integrations = (rows || []).map(r => ({
                    ...r,
                    config: JSON.parse(r.config || '{}'),
                    capabilities: JSON.parse(r.capabilities || '[]'),
                    syncSettings: JSON.parse(r.sync_settings || '{}')
                }));

                resolve(integrations);
            });
        });
    },

    /**
     * Connect a new integration
     */
    connectIntegration: async (organizationId, connectorId, config) => {
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

        const integrationId = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO integrations (
                    id, organization_id, connector_id, name, category,
                    status, config, capabilities, auth_type, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                integrationId,
                organizationId,
                connectorId,
                connector.name,
                connector.category,
                STATUS.PENDING,
                JSON.stringify(config),
                JSON.stringify(connector.capabilities),
                connector.authType
            ], function(err) {
                if (err) return reject(err);

                resolve({
                    id: integrationId,
                    connectorId,
                    name: connector.name,
                    category: connector.category,
                    status: STATUS.PENDING,
                    capabilities: connector.capabilities
                });
            });
        });
    },

    /**
     * Update integration status
     */
    updateIntegrationStatus: async (integrationId, status, error = null) => {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE integrations
                SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status, error, integrationId], function(err) {
                if (err) return reject(err);
                resolve({ success: this.changes > 0 });
            });
        });
    },

    /**
     * Disconnect integration
     */
    disconnectIntegration: async (integrationId) => {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE integrations
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [STATUS.DISCONNECTED, integrationId], function(err) {
                if (err) return reject(err);
                resolve({ success: this.changes > 0 });
            });
        });
    },

    /**
     * Delete integration
     */
    deleteIntegration: async (integrationId) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM integrations WHERE id = ?`, [integrationId], function(err) {
                if (err) return reject(err);
                resolve({ success: this.changes > 0 });
            });
        });
    },

    /**
     * Sync data from integration
     */
    syncIntegration: async (integrationId, options = {}) => {
        const integration = await IntegrationHubService.getIntegration(integrationId);
        if (!integration) {
            throw new Error('Integration not found');
        }

        const syncId = uuidv4();
        const startTime = new Date();

        // Log sync start
        await IntegrationHubService.logSyncEvent(integrationId, {
            syncId,
            event: 'sync_started',
            options
        });

        try {
            // This would call the actual connector sync logic
            // Simplified implementation
            const result = {
                syncId,
                integrationId,
                connector: integration.connector_id,
                status: 'completed',
                recordsSynced: 0,
                duration: 0
            };

            // Update last sync time
            await new Promise((resolve) => {
                db.run(`
                    UPDATE integrations 
                    SET last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [integrationId], resolve);
            });

            result.duration = Date.now() - startTime.getTime();

            await IntegrationHubService.logSyncEvent(integrationId, {
                syncId,
                event: 'sync_completed',
                result
            });

            return result;

        } catch (error) {
            await IntegrationHubService.logSyncEvent(integrationId, {
                syncId,
                event: 'sync_failed',
                error: error.message
            });

            await IntegrationHubService.updateIntegrationStatus(
                integrationId, 
                STATUS.ERROR, 
                error.message
            );

            throw error;
        }
    },

    /**
     * Get integration by ID
     */
    getIntegration: async (integrationId) => {
        return new Promise((resolve) => {
            db.get(`SELECT * FROM integrations WHERE id = ?`, [integrationId], (err, row) => {
                if (!row) return resolve(null);
                resolve({
                    ...row,
                    config: JSON.parse(row.config || '{}'),
                    capabilities: JSON.parse(row.capabilities || '[]')
                });
            });
        });
    },

    /**
     * Log sync event
     */
    logSyncEvent: async (integrationId, event) => {
        return new Promise((resolve) => {
            db.run(`
                INSERT INTO integration_sync_logs (id, integration_id, event, data, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [uuidv4(), integrationId, event.event, JSON.stringify(event)], resolve);
        });
    },

    /**
     * Get sync history
     */
    getSyncHistory: async (integrationId, limit = 20) => {
        return new Promise((resolve) => {
            db.all(`
                SELECT * FROM integration_sync_logs
                WHERE integration_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `, [integrationId, limit], (err, rows) => {
                resolve((rows || []).map(r => ({
                    ...r,
                    data: JSON.parse(r.data || '{}')
                })));
            });
        });
    },

    /**
     * Get integration statistics
     */
    getIntegrationStats: async (organizationId) => {
        return new Promise((resolve) => {
            db.all(`
                SELECT 
                    category,
                    COUNT(*) as count,
                    SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as connected,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
                FROM integrations
                WHERE organization_id = ?
                GROUP BY category
            `, [organizationId], (err, rows) => {
                resolve(rows || []);
            });
        });
    },

    /**
     * Initialize database tables
     */
    initialize: async () => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS integrations (
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
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS integration_sync_logs (
                        id TEXT PRIMARY KEY,
                        integration_id TEXT NOT NULL,
                        event TEXT NOT NULL,
                        data TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                db.run(`CREATE INDEX IF NOT EXISTS idx_int_org ON integrations(organization_id)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_int_status ON integrations(status)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_sync_int ON integration_sync_logs(integration_id)`);

                resolve();
            });
        });
    }
};

module.exports = IntegrationHubService;






