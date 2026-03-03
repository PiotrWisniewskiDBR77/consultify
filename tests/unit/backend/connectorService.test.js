/**
 * Connector Service Unit Tests
 * Tests third-party integrations, sync, and connection management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Connector Service implementation
const createConnectorService = () => {
  const connections = new Map();
  const syncHistory = [];
  let counter = 0;

  return {
    connect: async (provider, credentials) => {
      if (!credentials.apiKey && !credentials.token) {
        throw new Error('AUTH_FAILED');
      }

      const id = `conn-${Date.now()}-${++counter}`;
      const connection = {
        id,
        provider,
        status: 'connected',
        lastSync: null,
        createdAt: new Date(),
      };
      connections.set(id, connection);
      return connection;
    },

    disconnect: (connectionId) => {
      const conn = connections.get(connectionId);
      if (!conn) throw new Error('Connection not found');
      conn.status = 'disconnected';
      conn.disconnectedAt = new Date();
      return conn;
    },

    getConnection: (id) => connections.get(id) || null,

    listConnections: (filters = {}) => {
      let result = Array.from(connections.values());
      if (filters.provider) result = result.filter((c) => c.provider === filters.provider);
      if (filters.status) result = result.filter((c) => c.status === filters.status);
      return result;
    },

    sync: async (connectionId, options = {}) => {
      const conn = connections.get(connectionId);
      if (!conn) throw new Error('Connection not found');
      if (conn.status !== 'connected') throw new Error('Connection not active');

      const syncResult = {
        id: `sync-${Date.now()}-${++counter}`,
        connectionId,
        items: options.items || Math.floor(Math.random() * 100) + 1,
        status: 'completed',
        direction: options.direction || 'pull',
        startedAt: new Date(),
        completedAt: new Date(),
      };

      conn.lastSync = new Date();
      syncHistory.push(syncResult);

      return syncResult;
    },

    getSyncHistory: (connectionId) => {
      return syncHistory.filter((s) => s.connectionId === connectionId);
    },

    testConnection: async (provider, credentials) => {
      if (!credentials.apiKey && !credentials.token) {
        return { success: false, error: 'Missing credentials' };
      }
      // Simulate connection test
      return { success: true, latency: 150 };
    },

    getProviders: () => ['slack', 'jira', 'salesforce', 'hubspot', 'teams'],
  };
};

describe('ConnectorService', () => {
  let connectorService;

  beforeEach(() => {
    connectorService = createConnectorService();
  });

  describe('Connection Management', () => {
    it('should connect to provider', async () => {
      const conn = await connectorService.connect('slack', { token: 'xoxb-123' });

      expect(conn.id).toBeDefined();
      expect(conn.provider).toBe('slack');
      expect(conn.status).toBe('connected');
    });

    it('should fail without credentials', async () => {
      await expect(connectorService.connect('slack', {})).rejects.toThrow('AUTH_FAILED');
    });

    it('should disconnect', async () => {
      const conn = await connectorService.connect('jira', { apiKey: 'key' });
      connectorService.disconnect(conn.id);

      expect(connectorService.getConnection(conn.id).status).toBe('disconnected');
    });
  });

  describe('Data Sync', () => {
    it('should sync data', async () => {
      const conn = await connectorService.connect('salesforce', { apiKey: 'key' });
      const sync = await connectorService.sync(conn.id, { items: 50 });

      expect(sync.status).toBe('completed');
      expect(sync.items).toBe(50);
    });

    it('should track sync history', async () => {
      const conn = await connectorService.connect('hubspot', { apiKey: 'key' });
      await connectorService.sync(conn.id);
      await connectorService.sync(conn.id);

      const history = connectorService.getSyncHistory(conn.id);
      expect(history).toHaveLength(2);
    });

    it('should fail sync for disconnected', async () => {
      const conn = await connectorService.connect('teams', { token: 't' });
      connectorService.disconnect(conn.id);

      await expect(connectorService.sync(conn.id)).rejects.toThrow('Connection not active');
    });
  });

  describe('Connection Testing', () => {
    it('should test valid connection', async () => {
      const result = await connectorService.testConnection('slack', { token: 't' });
      expect(result.success).toBe(true);
    });

    it('should fail test without credentials', async () => {
      const result = await connectorService.testConnection('slack', {});
      expect(result.success).toBe(false);
    });
  });

  describe('Provider Listing', () => {
    it('should list available providers', () => {
      const providers = connectorService.getProviders();
      expect(providers).toContain('slack');
      expect(providers.length).toBeGreaterThan(0);
    });
  });
});
