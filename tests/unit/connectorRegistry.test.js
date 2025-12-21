import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('ConnectorRegistry', () => {
    let connectorRegistry;

    beforeEach(async () => {
        vi.resetModules();
        connectorRegistry = require('../../server/services/connectorRegistry');
    });

    describe('getAllConnectors', () => {
        it('should return all available connectors', () => {
            const connectors = connectorRegistry.getAllConnectors();

            expect(Array.isArray(connectors)).toBe(true);
            expect(connectors.length).toBeGreaterThan(0);

            // Verify expected connectors exist
            const keys = connectors.map(c => c.key);
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
            expect(communication.length).toBeGreaterThanOrEqual(2); // slack, teams

            communication.forEach(c => {
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
                api_token: 'token123'
            });

            expect(result.valid).toBe(true);
            expect(result.missing).toEqual([]);
        });

        it('should identify missing required credentials', () => {
            const result = connectorRegistry.validateCredentials('jira', {
                domain: 'mycompany.atlassian.net'
                // missing email and api_token
            });

            expect(result.valid).toBe(false);
            expect(result.missing).toContain('email');
            expect(result.missing).toContain('api_token');
        });

        it('should handle unknown connector', () => {
            const result = connectorRegistry.validateCredentials('unknown', { token: 'x' });

            expect(result.valid).toBe(true); // No required fields for unknown
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
