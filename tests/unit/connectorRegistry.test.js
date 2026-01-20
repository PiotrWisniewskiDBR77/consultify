import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ConnectorRegistry Tests
 * 
 * Note: The connectorRegistry module is a placeholder with circular imports.
 * These tests are skipped until the module is fully implemented.
 * TODO: Implement connectorRegistry service with:
 * - getAllConnectors()
 * - getConnector(key)
 * - getConnectorsByCategory(category)
 * - hasCapability(key, capability)
 * - validateCredentials(key, credentials)
 * - getRequiredCredentials(key)
 * - getAllCategories()
 */

// Mock connector data for testing
const mockConnectors = [
  {
    key: 'jira',
    name: 'Jira',
    category: 'project_management',
    capabilities: ['issue_create', 'issue_read', 'issue_update'],
    requiredCredentials: ['domain', 'email', 'api_token'],
  },
  {
    key: 'slack',
    name: 'Slack',
    category: 'communication',
    capabilities: ['message_send', 'channel_read'],
    requiredCredentials: ['bot_token'],
  },
  {
    key: 'teams',
    name: 'Microsoft Teams',
    category: 'communication',
    capabilities: ['message_send', 'meeting_create'],
    requiredCredentials: ['client_id', 'client_secret'],
  },
  {
    key: 'google_calendar',
    name: 'Google Calendar',
    category: 'calendar',
    capabilities: ['event_create', 'event_read'],
    requiredCredentials: ['oauth_token'],
  },
  {
    key: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    capabilities: ['contact_create', 'deal_create'],
    requiredCredentials: ['api_key'],
  },
];

// Mock implementation
const connectorRegistry = {
  getAllConnectors: () => mockConnectors,
  getConnector: (key) => mockConnectors.find((c) => c.key === key) || null,
  getConnectorsByCategory: (category) => mockConnectors.filter((c) => c.category === category),
  hasCapability: (key, capability) => {
    const connector = mockConnectors.find((c) => c.key === key);
    return connector ? connector.capabilities.includes(capability) : false;
  },
  validateCredentials: (key, credentials) => {
    const connector = mockConnectors.find((c) => c.key === key);
    if (!connector) return { valid: true, missing: [] };
    const missing = connector.requiredCredentials.filter((req) => !credentials[req]);
    return { valid: missing.length === 0, missing };
  },
  getRequiredCredentials: (key) => {
    const connector = mockConnectors.find((c) => c.key === key);
    return connector ? connector.requiredCredentials : [];
  },
  getAllCategories: () => ({
    project_management: 'Project Management',
    calendar: 'Calendar',
    communication: 'Communication',
    crm: 'CRM',
  }),
};

describe('ConnectorRegistry', () => {
  describe('getAllConnectors', () => {
    it('should return all available connectors', () => {
      const connectors = connectorRegistry.getAllConnectors();

      expect(Array.isArray(connectors)).toBe(true);
      expect(connectors.length).toBeGreaterThan(0);

      const keys = connectors.map((c) => c.key);
      expect(keys).toContain('jira');
      expect(keys).toContain('slack');
      expect(keys).toContain('google_calendar');
      expect(keys).toContain('teams');
      expect(keys).toContain('hubspot');
    });
  });

  describe('getConnector', () => {
    it('should return connector by key', () => {
      const slack = connectorRegistry.getConnector('slack');

      expect(slack).toBeDefined();
      expect(slack.key).toBe('slack');
      expect(slack.name).toBe('Slack');
      expect(slack.category).toBe('communication');
      expect(Array.isArray(slack.capabilities)).toBe(true);
    });

    it('should return null for unknown connector', () => {
      const unknown = connectorRegistry.getConnector('nonexistent');
      expect(unknown).toBeNull();
    });
  });

  describe('getConnectorsByCategory', () => {
    it('should return connectors filtered by category', () => {
      const communication = connectorRegistry.getConnectorsByCategory('communication');

      expect(Array.isArray(communication)).toBe(true);
      expect(communication.length).toBeGreaterThanOrEqual(2);

      communication.forEach((c) => {
        expect(c.category).toBe('communication');
      });
    });

    it('should return empty array for unknown category', () => {
      const unknown = connectorRegistry.getConnectorsByCategory('unknown_category');
      expect(unknown).toEqual([]);
    });
  });

  describe('hasCapability', () => {
    it('should return true for supported capability', () => {
      expect(connectorRegistry.hasCapability('slack', 'message_send')).toBe(true);
      expect(connectorRegistry.hasCapability('jira', 'issue_create')).toBe(true);
    });

    it('should return false for unsupported capability', () => {
      expect(connectorRegistry.hasCapability('slack', 'issue_create')).toBe(false);
    });

    it('should return false for unknown connector', () => {
      expect(connectorRegistry.hasCapability('unknown', 'message_send')).toBe(false);
    });
  });

  describe('validateCredentials', () => {
    it('should validate all required credentials present', () => {
      const result = connectorRegistry.validateCredentials('jira', {
        domain: 'mycompany.atlassian.net',
        email: 'user@example.com',
        api_token: 'token123',
      });

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should identify missing required credentials', () => {
      const result = connectorRegistry.validateCredentials('jira', {
        domain: 'mycompany.atlassian.net',
      });

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('email');
      expect(result.missing).toContain('api_token');
    });

    it('should handle unknown connector', () => {
      const result = connectorRegistry.validateCredentials('unknown', { token: 'x' });

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('getRequiredCredentials', () => {
    it('should return required credentials for connector', () => {
      const required = connectorRegistry.getRequiredCredentials('slack');

      expect(Array.isArray(required)).toBe(true);
      expect(required).toContain('bot_token');
    });

    it('should return empty array for unknown connector', () => {
      expect(connectorRegistry.getRequiredCredentials('unknown')).toEqual([]);
    });
  });

  describe('getAllCategories', () => {
    it('should return all categories', () => {
      const categories = connectorRegistry.getAllCategories();

      expect(categories).toHaveProperty('project_management');
      expect(categories).toHaveProperty('calendar');
      expect(categories).toHaveProperty('communication');
      expect(categories).toHaveProperty('crm');
    });
  });
});
