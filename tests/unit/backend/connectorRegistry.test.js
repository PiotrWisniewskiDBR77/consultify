/**
 * ConnectorRegistry Tests
 * 
 * Tests for connector catalog and registry service.
 */

const { describe, it, expect } = require('vitest');
const ConnectorRegistry = require('../../../server/services/connectorRegistry');

describe('ConnectorRegistry', () => {
    describe('getAllConnectors', () => {
        it('should return all connectors', () => {
            const connectors = ConnectorRegistry.getAllConnectors();

            expect(Array.isArray(connectors)).toBe(true);
            expect(connectors.length).toBeGreaterThan(0);
        });

        it('should return connectors with required fields', () => {
            const connectors = ConnectorRegistry.getAllConnectors();

            connectors.forEach(connector => {
                expect(connector).toHaveProperty('key');
                expect(connector).toHaveProperty('name');
                expect(connector).toHaveProperty('category');
                expect(connector).toHaveProperty('capabilities');
            });
        });
    });

    describe('getConnector', () => {
        it('should return connector by key', () => {
            const connector = ConnectorRegistry.getConnector('jira');

            expect(connector).toBeDefined();
            expect(connector.key).toBe('jira');
            expect(connector.name).toBe('Jira Cloud');
        });

        it('should return null for non-existent connector', () => {
            const connector = ConnectorRegistry.getConnector('non_existent');

            expect(connector).toBeNull();
        });
    });

    describe('getConnectorsByCategory', () => {
        it('should return connectors for category', () => {
            const connectors = ConnectorRegistry.getConnectorsByCategory('project_management');

            expect(Array.isArray(connectors)).toBe(true);
            expect(connectors.every(c => c.category === 'project_management')).toBe(true);
        });

        it('should return empty array for non-existent category', () => {
            const connectors = ConnectorRegistry.getConnectorsByCategory('non_existent');

            expect(connectors).toEqual([]);
        });
    });

    describe('getCategories', () => {
        it('should return all categories', () => {
            const categories = ConnectorRegistry.getCategories();

            expect(Array.isArray(categories)).toBe(true);
            expect(categories.length).toBeGreaterThan(0);
        });

        it('should return categories with labels', () => {
            const categories = ConnectorRegistry.getCategories();

            categories.forEach(category => {
                expect(category).toHaveProperty('key');
                expect(category).toHaveProperty('label');
                expect(category).toHaveProperty('description');
            });
        });
    });

    describe('validateCredentials', () => {
        it('should validate required credentials', () => {
            const connector = ConnectorRegistry.getConnector('jira');
            const credentials = {
                domain: 'example.atlassian.net',
                email: 'user@example.com',
                api_token: 'token123'
            };

            const isValid = ConnectorRegistry.validateCredentials(connector.key, credentials);

            expect(isValid).toBe(true);
        });

        it('should reject missing required credentials', () => {
            const connector = ConnectorRegistry.getConnector('jira');
            const credentials = {
                domain: 'example.atlassian.net'
                // Missing email and api_token
            };

            const isValid = ConnectorRegistry.validateCredentials(connector.key, credentials);

            expect(isValid).toBe(false);
        });

        it('should allow optional credentials', () => {
            const connector = ConnectorRegistry.getConnector('slack');
            const credentials = {
                bot_token: 'token123'
                // webhook_url is optional
            };

            const isValid = ConnectorRegistry.validateCredentials(connector.key, credentials);

            expect(isValid).toBe(true);
        });
    });
});

