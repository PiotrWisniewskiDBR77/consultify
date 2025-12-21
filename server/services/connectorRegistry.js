/**
 * Connector Registry
 * Step 17: Integrations & Secrets Platform
 * 
 * Static catalog of supported connectors with their capabilities,
 * required credentials, and configuration schemas.
 */

/**
 * Connector catalog with metadata and capability definitions.
 */
const CONNECTOR_CATALOG = {
    jira: {
        key: 'jira',
        name: 'Jira Cloud',
        category: 'project_management',
        description: 'Atlassian Jira for issue tracking and project management',
        capabilities: ['issue_create', 'issue_update', 'issue_read', 'webhook'],
        requiredCredentials: ['domain', 'email', 'api_token'],
        defaultScopes: ['read:jira-work', 'write:jira-work'],
        iconUrl: '/icons/jira.svg',
        documentationUrl: 'https://developer.atlassian.com/cloud/jira/platform/'
    },
    google_calendar: {
        key: 'google_calendar',
        name: 'Google Calendar',
        category: 'calendar',
        description: 'Google Calendar for scheduling meetings and events',
        capabilities: ['event_create', 'event_update', 'event_read', 'event_delete'],
        requiredCredentials: ['client_id', 'client_secret', 'refresh_token'],
        defaultScopes: ['https://www.googleapis.com/auth/calendar'],
        iconUrl: '/icons/google-calendar.svg',
        documentationUrl: 'https://developers.google.com/calendar/api'
    },
    slack: {
        key: 'slack',
        name: 'Slack',
        category: 'communication',
        description: 'Slack for team messaging and notifications',
        capabilities: ['message_send', 'channel_read', 'webhook'],
        requiredCredentials: ['bot_token'],
        optionalCredentials: ['webhook_url'],
        defaultScopes: ['chat:write', 'channels:read'],
        iconUrl: '/icons/slack.svg',
        documentationUrl: 'https://api.slack.com/docs'
    },
    teams: {
        key: 'teams',
        name: 'Microsoft Teams',
        category: 'communication',
        description: 'Microsoft Teams for enterprise communication',
        capabilities: ['message_send', 'channel_read'],
        requiredCredentials: ['tenant_id', 'client_id', 'client_secret'],
        defaultScopes: ['https://graph.microsoft.com/.default'],
        iconUrl: '/icons/teams.svg',
        documentationUrl: 'https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview'
    },
    hubspot: {
        key: 'hubspot',
        name: 'HubSpot',
        category: 'crm',
        description: 'HubSpot CRM for contact and deal management',
        capabilities: ['contact_create', 'contact_update', 'deal_create', 'deal_update'],
        requiredCredentials: ['access_token'],
        defaultScopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
        iconUrl: '/icons/hubspot.svg',
        documentationUrl: 'https://developers.hubspot.com/docs/api/overview'
    }
};

/**
 * Connector categories with display labels.
 */
const CONNECTOR_CATEGORIES = {
    project_management: { label: 'Project Management', description: 'Issue tracking and project tools' },
    calendar: { label: 'Calendar', description: 'Scheduling and calendar integrations' },
    communication: { label: 'Communication', description: 'Messaging and notification platforms' },
    crm: { label: 'CRM', description: 'Customer relationship management' }
};

/**
 * Get all available connectors.
 * @returns {Object[]} Array of connector definitions
 */
function getAllConnectors() {
    return Object.values(CONNECTOR_CATALOG);
}

/**
 * Get a connector by key.
 * @param {string} key - Connector key
 * @returns {Object|null} Connector definition or null
 */
function getConnector(key) {
    return CONNECTOR_CATALOG[key] || null;
}

/**
 * Get connectors by category.
 * @param {string} category - Category key
 * @returns {Object[]} Array of connectors in the category
 */
function getConnectorsByCategory(category) {
    return Object.values(CONNECTOR_CATALOG).filter(c => c.category === category);
}

/**
 * Check if a connector supports a specific capability.
 * @param {string} key - Connector key
 * @param {string} capability - Capability to check
 * @returns {boolean}
 */
function hasCapability(key, capability) {
    const connector = CONNECTOR_CATALOG[key];
    return connector ? connector.capabilities.includes(capability) : false;
}

/**
 * Get required credentials for a connector.
 * @param {string} key - Connector key
 * @returns {string[]} List of required credential field names
 */
function getRequiredCredentials(key) {
    const connector = CONNECTOR_CATALOG[key];
    return connector ? connector.requiredCredentials : [];
}

/**
 * Validate credentials for a connector.
 * @param {string} key - Connector key
 * @param {Object} credentials - Credentials object
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateCredentials(key, credentials) {
    const required = getRequiredCredentials(key);
    const missing = required.filter(field => !credentials || !credentials[field]);

    return {
        valid: missing.length === 0,
        missing
    };
}

/**
 * Get all categories.
 * @returns {Object} Categories with labels
 */
function getAllCategories() {
    return CONNECTOR_CATEGORIES;
}

module.exports = {
    CONNECTOR_CATALOG,
    CONNECTOR_CATEGORIES,
    getAllConnectors,
    getConnector,
    getConnectorsByCategory,
    hasCapability,
    getRequiredCredentials,
    validateCredentials,
    getAllCategories
};
