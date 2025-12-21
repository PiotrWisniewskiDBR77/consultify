/**
 * Connector Health Service
 * Step 17: Integrations & Secrets Platform
 * 
 * Health monitoring for connector integrations.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const connectorService = require('./connectorService');

const ConnectorHealthService = {
    /**
     * Test connection for a connector.
     * Validates credentials by attempting a simple API call.
     * @param {string} orgId - Organization ID
     * @param {string} connectorKey - Connector key
     * @returns {Promise<Object>} Health check result
     */
    testConnection: async (orgId, connectorKey) => {
        const startTime = Date.now();

        try {
            // Get decrypted secrets
            const secrets = await connectorService.getSecrets(orgId, connectorKey);

            if (!secrets) {
                return ConnectorHealthService._recordHealth(orgId, connectorKey, false, 'NOT_CONFIGURED', 'Connector not configured or disconnected');
            }

            // Test based on connector type
            let testResult;
            switch (connectorKey) {
                case 'jira':
                    testResult = await ConnectorHealthService._testJira(secrets);
                    break;
                case 'slack':
                    testResult = await ConnectorHealthService._testSlack(secrets);
                    break;
                case 'google_calendar':
                    testResult = await ConnectorHealthService._testGoogleCalendar(secrets);
                    break;
                case 'teams':
                    testResult = await ConnectorHealthService._testTeams(secrets);
                    break;
                case 'hubspot':
                    testResult = await ConnectorHealthService._testHubSpot(secrets);
                    break;
                default:
                    // Generic test - just verify secrets exist
                    testResult = { ok: true };
            }

            const duration = Date.now() - startTime;

            if (testResult.ok) {
                await ConnectorHealthService._recordHealth(orgId, connectorKey, true, null, null);
                return {
                    status: 'healthy',
                    connector_key: connectorKey,
                    duration_ms: duration,
                    message: 'Connection successful'
                };
            } else {
                await ConnectorHealthService._recordHealth(orgId, connectorKey, false, testResult.error_code, testResult.error_message);
                return {
                    status: 'unhealthy',
                    connector_key: connectorKey,
                    duration_ms: duration,
                    error_code: testResult.error_code,
                    message: testResult.error_message
                };
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            await ConnectorHealthService._recordHealth(orgId, connectorKey, false, 'TEST_ERROR', error.message);

            return {
                status: 'error',
                connector_key: connectorKey,
                duration_ms: duration,
                error_code: 'TEST_ERROR',
                message: error.message
            };
        }
    },

    /**
     * Record health check result.
     * @private
     */
    _recordHealth: async (orgId, connectorKey, ok, errorCode, errorMessage) => {
        const now = new Date().toISOString();
        const id = `health-${uuidv4()}`;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO connector_health 
                 (id, org_id, connector_key, last_check_at, last_ok_at, last_error_code, last_error_message, consecutive_failures)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(org_id, connector_key) DO UPDATE SET
                    last_check_at = excluded.last_check_at,
                    last_ok_at = CASE WHEN ? THEN excluded.last_check_at ELSE last_ok_at END,
                    last_error_code = excluded.last_error_code,
                    last_error_message = excluded.last_error_message,
                    consecutive_failures = CASE WHEN ? THEN 0 ELSE consecutive_failures + 1 END`,
                [id, orgId, connectorKey, now, ok ? now : null, errorCode, errorMessage, ok ? 0 : 1, ok, ok],
                function (err) {
                    if (err) return reject(err);
                    resolve({ ok, error_code: errorCode, error_message: errorMessage });
                }
            );
        });
    },

    /**
     * Get health status for org's connectors.
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object[]>} Array of health statuses
     */
    getHealth: async (orgId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT ch.*, c.name 
                 FROM connector_health ch
                 JOIN connectors c ON ch.connector_key = c.key
                 WHERE ch.org_id = ?
                 ORDER BY ch.last_check_at DESC`,
                [orgId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    // ==========================================
    // Connector-specific test implementations
    // These are mock implementations for now
    // ==========================================

    /**
     * Test Jira connection.
     */
    _testJira: async (secrets) => {
        // Mock test - in production would call Jira API
        if (!secrets.domain || !secrets.email || !secrets.api_token) {
            return { ok: false, error_code: 'INVALID_CREDENTIALS', error_message: 'Missing required Jira credentials' };
        }
        // Simulate API call
        return { ok: true };
    },

    /**
     * Test Slack connection.
     */
    _testSlack: async (secrets) => {
        if (!secrets.bot_token) {
            return { ok: false, error_code: 'INVALID_CREDENTIALS', error_message: 'Missing Slack bot token' };
        }
        // Mock: would call slack.api.test
        return { ok: true };
    },

    /**
     * Test Google Calendar connection.
     */
    _testGoogleCalendar: async (secrets) => {
        if (!secrets.client_id || !secrets.client_secret || !secrets.refresh_token) {
            return { ok: false, error_code: 'INVALID_CREDENTIALS', error_message: 'Missing Google Calendar credentials' };
        }
        // Mock: would call calendar.calendarList.list
        return { ok: true };
    },

    /**
     * Test Microsoft Teams connection.
     */
    _testTeams: async (secrets) => {
        if (!secrets.tenant_id || !secrets.client_id || !secrets.client_secret) {
            return { ok: false, error_code: 'INVALID_CREDENTIALS', error_message: 'Missing Teams credentials' };
        }
        // Mock: would call MS Graph API
        return { ok: true };
    },

    /**
     * Test HubSpot connection.
     */
    _testHubSpot: async (secrets) => {
        if (!secrets.access_token) {
            return { ok: false, error_code: 'INVALID_CREDENTIALS', error_message: 'Missing HubSpot access token' };
        }
        // Mock: would call HubSpot API
        return { ok: true };
    }
};

module.exports = ConnectorHealthService;
