/**
 * Connector Registry Unit Tests
 * Tests connector registration, lifecycle, and configuration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Connector Registry implementation
const createConnectorRegistry = () => {
    const connectors = new Map();
    const connections = new Map();
    let counter = 0;

    return {
        register: (id, config) => {
            const connector = {
                id,
                name: config.name,
                type: config.type || 'integration',
                enabled: config.enabled ?? true,
                config: config.config || {},
                createdAt: new Date()
            };
            connectors.set(id, connector);
            return connector;
        },

        get: (id) => connectors.get(id) || null,

        list: (filters = {}) => {
            let result = Array.from(connectors.values());
            if (filters.enabled !== undefined) {
                result = result.filter(c => c.enabled === filters.enabled);
            }
            if (filters.type) {
                result = result.filter(c => c.type === filters.type);
            }
            return result;
        },

        enable: (id) => {
            const connector = connectors.get(id);
            if (!connector) throw new Error('Connector not found');
            connector.enabled = true;
            return connector;
        },

        disable: (id) => {
            const connector = connectors.get(id);
            if (!connector) throw new Error('Connector not found');
            connector.enabled = false;
            // Disconnect any active connections
            for (const [connId, conn] of connections) {
                if (conn.connectorId === id) {
                    conn.status = 'disconnected';
                }
            }
            return connector;
        },

        validateConfig: (id, config) => {
            const connector = connectors.get(id);
            if (!connector) return { valid: false, errors: ['Connector not found'] };

            const errors = [];
            const requiredFields = connector.config.required || [];

            for (const field of requiredFields) {
                if (!config[field]) {
                    errors.push(`Missing required field: ${field}`);
                }
            }

            return { valid: errors.length === 0, errors };
        },

        connect: async (connectorId, credentials = {}) => {
            const connector = connectors.get(connectorId);
            if (!connector) throw new Error('Connector not found');
            if (!connector.enabled) throw new Error('Connector is disabled');

            const connectionId = `conn-${Date.now()}-${++counter}`;
            const connection = {
                id: connectionId,
                connectorId,
                status: 'connected',
                connectedAt: new Date()
            };
            connections.set(connectionId, connection);

            return connection;
        },

        disconnect: (connectionId) => {
            const connection = connections.get(connectionId);
            if (!connection) throw new Error('Connection not found');
            connection.status = 'disconnected';
            connection.disconnectedAt = new Date();
            return connection;
        },

        getConnections: (connectorId) => {
            return Array.from(connections.values())
                .filter(c => c.connectorId === connectorId);
        },

        unregister: (id) => {
            // Disconnect all connections first
            for (const conn of connections.values()) {
                if (conn.connectorId === id) {
                    conn.status = 'disconnected';
                }
            }
            return connectors.delete(id);
        }
    };
};

describe('ConnectorRegistry', () => {
    let registry;

    beforeEach(() => {
        registry = createConnectorRegistry();
    });

    describe('Connector Registration', () => {
        it('should register connector', () => {
            const connector = registry.register('slack', {
                name: 'Slack',
                type: 'messaging'
            });

            expect(connector.id).toBe('slack');
            expect(connector.enabled).toBe(true);
        });

        it('should list connectors', () => {
            registry.register('slack', { name: 'Slack' });
            registry.register('teams', { name: 'Teams' });

            const list = registry.list();
            expect(list).toHaveLength(2);
        });

        it('should filter by type', () => {
            registry.register('slack', { name: 'Slack', type: 'messaging' });
            registry.register('jira', { name: 'Jira', type: 'project' });

            const messaging = registry.list({ type: 'messaging' });
            expect(messaging).toHaveLength(1);
        });
    });

    describe('Enable/Disable', () => {
        it('should enable connector', () => {
            registry.register('test', { name: 'Test', enabled: false });
            registry.enable('test');

            expect(registry.get('test').enabled).toBe(true);
        });

        it('should disable connector', () => {
            registry.register('test', { name: 'Test', enabled: true });
            registry.disable('test');

            expect(registry.get('test').enabled).toBe(false);
        });
    });

    describe('Configuration Validation', () => {
        it('should validate config', () => {
            registry.register('api', {
                name: 'API Connector',
                config: { required: ['apiKey', 'endpoint'] }
            });

            const valid = registry.validateConfig('api', { apiKey: 'key', endpoint: 'http://api.com' });
            const invalid = registry.validateConfig('api', { apiKey: 'key' });

            expect(valid.valid).toBe(true);
            expect(invalid.valid).toBe(false);
        });
    });

    describe('Connection Management', () => {
        it('should connect to connector', async () => {
            registry.register('slack', { name: 'Slack' });
            const connection = await registry.connect('slack');

            expect(connection.status).toBe('connected');
        });

        it('should reject connection to disabled connector', async () => {
            registry.register('disabled', { name: 'Disabled', enabled: false });

            await expect(registry.connect('disabled'))
                .rejects.toThrow('Connector is disabled');
        });

        it('should disconnect', async () => {
            registry.register('test', { name: 'Test' });
            const connection = await registry.connect('test');
            const disconnected = registry.disconnect(connection.id);

            expect(disconnected.status).toBe('disconnected');
        });
    });

    describe('Unregistration', () => {
        it('should unregister connector', () => {
            registry.register('temp', { name: 'Temp' });
            registry.unregister('temp');

            expect(registry.get('temp')).toBeNull();
        });
    });
});
