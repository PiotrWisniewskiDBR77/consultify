/**
 * Connector Adapter
 * Step 17: Integrations & Secrets Platform
 * 
 * Unified interface for executors to call external integrations.
 * Respects sandbox mode and dry-run flags.
 */

const connectorService = require('../services/connectorService');
const connectorRegistry = require('../services/connectorRegistry');
const auditLogger = require('../utils/auditLogger');

// Dependency injection container (for deterministic unit tests)
const deps = {
    connectorService,
    connectorRegistry,
    auditLogger
};

const ConnectorAdapter = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Execute an action through a connector.
     * @param {string} orgId - Organization ID
     * @param {string} connectorKey - Connector key (e.g., 'slack', 'jira')
     * @param {string} action - Action to perform (e.g., 'message_send', 'issue_create')
     * @param {Object} payload - Action payload
     * @param {Object} options - Execution options
     * @param {boolean} options.dry_run - If true, return plan without execution
     * @returns {Promise<Object>} Execution result
     */
    execute: async (orgId, connectorKey, action, payload, options = {}) => {
        const { dry_run = false } = options;
        const startTime = Date.now();

        // Validate connector exists
        const connector = deps.connectorRegistry.getConnector(connectorKey);
        if (!connector) {
            return {
                success: false,
                error: `Unknown connector: ${connectorKey}`,
                error_code: 'UNKNOWN_CONNECTOR'
            };
        }

        // Check capability
        if (!connector.capabilities.includes(action)) {
            return {
                success: false,
                error: `Connector ${connectorKey} does not support action: ${action}`,
                error_code: 'UNSUPPORTED_ACTION'
            };
        }

        // Get org config
        const config = await deps.connectorService.getConfig(orgId, connectorKey);

        if (!config || config.status !== 'CONNECTED') {
            return {
                success: false,
                error: `Connector ${connectorKey} is not configured for this organization`,
                error_code: 'NOT_CONFIGURED'
            };
        }

        // Check sandbox mode
        const isSandbox = config.sandbox_mode || dry_run;

        if (isSandbox) {
            // Return dry-run plan
            const plan = ConnectorAdapter._generatePlan(connectorKey, action, payload);

            deps.auditLogger.info('CONNECTOR_DRY_RUN', {
                org_id: orgId,
                connector_key: connectorKey,
                action,
                sandbox_mode: config.sandbox_mode,
                explicit_dry_run: dry_run
            });

            return {
                success: true,
                dry_run: true,
                sandbox_mode: config.sandbox_mode,
                connector_key: connectorKey,
                action,
                ...plan,
                duration_ms: Date.now() - startTime
            };
        }

        // Execute real action
        try {
            const secrets = await deps.connectorService.getSecrets(orgId, connectorKey);
            const result = await ConnectorAdapter._executeAction(connectorKey, action, payload, secrets);

            deps.auditLogger.info('CONNECTOR_EXECUTED', {
                org_id: orgId,
                connector_key: connectorKey,
                action,
                success: result.success,
                duration_ms: Date.now() - startTime
            });

            return {
                ...result,
                connector_key: connectorKey,
                action,
                duration_ms: Date.now() - startTime
            };
        } catch (error) {
            deps.auditLogger.error('CONNECTOR_EXECUTION_ERROR', {
                org_id: orgId,
                connector_key: connectorKey,
                action,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                error_code: 'EXECUTION_ERROR',
                connector_key: connectorKey,
                action,
                duration_ms: Date.now() - startTime
            };
        }
    },

    /**
     * Generate a dry-run plan for an action.
     * @private
     */
    _generatePlan: (connectorKey, action, payload) => {
        const plans = {
            jira: {
                issue_create: {
                    would_do: ['Create Jira issue'],
                    external_calls: ['POST /rest/api/3/issue'],
                    payload_preview: { summary: payload.title, description: payload.description }
                },
                issue_update: {
                    would_do: ['Update Jira issue'],
                    external_calls: ['PUT /rest/api/3/issue/{issueId}'],
                    payload_preview: payload
                }
            },
            google_calendar: {
                event_create: {
                    would_do: ['Create Google Calendar event'],
                    external_calls: ['POST /calendar/v3/calendars/primary/events'],
                    payload_preview: { summary: payload.summary, start: payload.start_time, end: payload.end_time }
                }
            },
            slack: {
                message_send: {
                    would_do: ['Send Slack message'],
                    external_calls: ['POST /api/chat.postMessage'],
                    payload_preview: { channel: payload.channel, text: payload.text?.substring(0, 50) + '...' }
                }
            },
            teams: {
                message_send: {
                    would_do: ['Send Teams message'],
                    external_calls: ['POST /v1.0/chats/{chatId}/messages'],
                    payload_preview: { body: { content: payload.text?.substring(0, 50) + '...' } }
                }
            },
            hubspot: {
                contact_create: {
                    would_do: ['Create HubSpot contact'],
                    external_calls: ['POST /crm/v3/objects/contacts'],
                    payload_preview: { email: payload.email }
                },
                deal_create: {
                    would_do: ['Create HubSpot deal'],
                    external_calls: ['POST /crm/v3/objects/deals'],
                    payload_preview: { dealname: payload.name, amount: payload.amount }
                }
            }
        };

        return plans[connectorKey]?.[action] || {
            would_do: [`Execute ${action} on ${connectorKey}`],
            external_calls: [`${connectorKey.toUpperCase()} API`],
            payload_preview: payload
        };
    },

    /**
     * Execute the actual API call (mock implementations).
     * @private
     */
    _executeAction: async (connectorKey, action, payload, secrets) => {
        // Mock implementations - in production these would call real APIs
        switch (connectorKey) {
            case 'jira':
                return ConnectorAdapter._executeJira(action, payload, secrets);
            case 'google_calendar':
                return ConnectorAdapter._executeGoogleCalendar(action, payload, secrets);
            case 'slack':
                return ConnectorAdapter._executeSlack(action, payload, secrets);
            case 'teams':
                return ConnectorAdapter._executeTeams(action, payload, secrets);
            case 'hubspot':
                return ConnectorAdapter._executeHubSpot(action, payload, secrets);
            default:
                return { success: false, error: 'Connector not implemented' };
        }
    },

    // Mock implementations
    _executeJira: async (action, payload, secrets) => {
        // Mock: would use Jira REST API
        return {
            success: true,
            result: {
                id: `JIRA-${Math.random().toString(36).substring(7).toUpperCase()}`,
                key: `PROJ-${Math.floor(Math.random() * 1000)}`,
                self: `https://${secrets.domain}/rest/api/3/issue/PROJ-123`,
                mock: true
            },
            message: `Jira ${action} completed successfully`
        };
    },

    _executeGoogleCalendar: async (action, payload, secrets) => {
        return {
            success: true,
            result: {
                id: `gcal-${Math.random().toString(36).substring(7)}`,
                htmlLink: `https://calendar.google.com/calendar/event?eid=xxx`,
                summary: payload.summary,
                mock: true
            },
            message: `Google Calendar ${action} completed successfully`
        };
    },

    _executeSlack: async (action, payload, secrets) => {
        return {
            success: true,
            result: {
                ok: true,
                ts: `${Date.now()}.000000`,
                channel: payload.channel,
                mock: true
            },
            message: `Slack ${action} completed successfully`
        };
    },

    _executeTeams: async (action, payload, secrets) => {
        return {
            success: true,
            result: {
                id: `teams-${Math.random().toString(36).substring(7)}`,
                mock: true
            },
            message: `Teams ${action} completed successfully`
        };
    },

    _executeHubSpot: async (action, payload, secrets) => {
        return {
            success: true,
            result: {
                id: `hubspot-${Math.random().toString(36).substring(7)}`,
                mock: true
            },
            message: `HubSpot ${action} completed successfully`
        };
    }
};

module.exports = ConnectorAdapter;
