// @ts-nocheck
/**
 * Connector Adapter
 * Step 17: Integrations & Secrets Platform
 *
 * Unified interface for executors to call external integrations.
 * Respects sandbox mode and dry-run flags.
 */

// TODO(T7): dead self-import wrapper (real impl never existed) — this path is a 503/fallback victim. Build a real service before relying on it. Ref: finding_42_self_import_wrappers_services_2026-07-15.
import * as connectorRegistry from '../services/connectorRegistry.js';
import * as connectorService from '../services/connectorService.js';
import * as auditLogger from '../utils/auditLogger.js';

// Dependency injection container (for deterministic unit tests)
const deps = {
  connectorService,
  connectorRegistry,
  auditLogger,
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
        error_code: 'UNKNOWN_CONNECTOR',
      };
    }

    // Check capability
    if (!connector.capabilities.includes(action)) {
      return {
        success: false,
        error: `Connector ${connectorKey} does not support action: ${action}`,
        error_code: 'UNSUPPORTED_ACTION',
      };
    }

    // Get org config
    const config = await deps.connectorService.getConfig(orgId, connectorKey);

    if (!config || config.status !== 'CONNECTED') {
      return {
        success: false,
        error: `Connector ${connectorKey} is not configured for this organization`,
        error_code: 'NOT_CONFIGURED',
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
        explicit_dry_run: dry_run,
      });

      return {
        success: true,
        dry_run: true,
        sandbox_mode: config.sandbox_mode,
        connector_key: connectorKey,
        action,
        ...plan,
        duration_ms: Date.now() - startTime,
      };
    }

    // No mock “real execution” in runtime.
    // If a connector is not in sandbox/dry-run mode, be explicit that the feature is unavailable.
    deps.auditLogger.warn('CONNECTOR_EXECUTION_UNAVAILABLE', {
      org_id: orgId,
      connector_key: connectorKey,
      action,
      duration_ms: Date.now() - startTime,
    });

    return {
      success: false,
      error: 'Connector execution is not available (dry-run only)',
      error_code: 'FEATURE_UNAVAILABLE',
      connector_key: connectorKey,
      action,
      duration_ms: Date.now() - startTime,
    };
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
          payload_preview: { summary: payload.title, description: payload.description },
        },
        issue_update: {
          would_do: ['Update Jira issue'],
          external_calls: ['PUT /rest/api/3/issue/{issueId}'],
          payload_preview: payload,
        },
      },
      google_calendar: {
        event_create: {
          would_do: ['Create Google Calendar event'],
          external_calls: ['POST /calendar/v3/calendars/primary/events'],
          payload_preview: {
            summary: payload.summary,
            start: payload.start_time,
            end: payload.end_time,
          },
        },
      },
      slack: {
        message_send: {
          would_do: ['Send Slack message'],
          external_calls: ['POST /api/chat.postMessage'],
          payload_preview: {
            channel: payload.channel,
            text: payload.text?.substring(0, 50) + '...',
          },
        },
      },
      teams: {
        message_send: {
          would_do: ['Send Teams message'],
          external_calls: ['POST /v1.0/chats/{chatId}/messages'],
          payload_preview: { body: { content: payload.text?.substring(0, 50) + '...' } },
        },
      },
      hubspot: {
        contact_create: {
          would_do: ['Create HubSpot contact'],
          external_calls: ['POST /crm/v3/objects/contacts'],
          payload_preview: { email: payload.email },
        },
        deal_create: {
          would_do: ['Create HubSpot deal'],
          external_calls: ['POST /crm/v3/objects/deals'],
          payload_preview: { dealname: payload.name, amount: payload.amount },
        },
      },
    };

    return (
      plans[connectorKey]?.[action] || {
        would_do: [`Execute ${action} on ${connectorKey}`],
        external_calls: [`${connectorKey.toUpperCase()} API`],
        payload_preview: payload,
      }
    );
  },

  // NOTE: No “real execution” implementation here. When adding it, ensure it is
  // truly calling external APIs and is covered by integration tests.
};

export default ConnectorAdapter;
