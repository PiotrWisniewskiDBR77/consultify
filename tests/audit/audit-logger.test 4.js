/**
 * Audit Logger Tests
 * Tests for audit logging and tracking
 *
 * @module tests/audit/audit-logger.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Audit logger implementation
const createAuditLogger = (options = {}) => {
  const {
    storage = [],
    maxEntries = 10000,
    retention = 30 * 24 * 60 * 60 * 1000, // 30 days
  } = options;

  const subscribers = [];

  return {
    log: (event) => {
      const entry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...event,
      };

      storage.push(entry);

      // Enforce max entries
      while (storage.length > maxEntries) {
        storage.shift();
      }

      // Notify subscribers
      subscribers.forEach((fn) => fn(entry));

      return entry;
    },

    logAction: (actor, action, resource, details = {}) => {
      return this.log({
        type: 'action',
        actor,
        action,
        resource,
        details,
        success: true,
      });
    },

    logError: (actor, action, resource, error, details = {}) => {
      return this.log({
        type: 'error',
        actor,
        action,
        resource,
        error: error.message || error,
        details,
        success: false,
      });
    },

    logAccess: (actor, resource, granted, reason) => {
      return this.log({
        type: 'access',
        actor,
        resource,
        granted,
        reason,
      });
    },

    logAuthentication: (actor, method, success, metadata = {}) => {
      return this.log({
        type: 'authentication',
        actor,
        method,
        success,
        metadata,
      });
    },

    logDataChange: (actor, entity, entityId, changes) => {
      return this.log({
        type: 'data_change',
        actor,
        entity,
        entityId,
        changes,
      });
    },

    query: (filters = {}) => {
      let results = [...storage];

      if (filters.type) {
        results = results.filter((e) => e.type === filters.type);
      }
      if (filters.actor) {
        results = results.filter((e) => e.actor === filters.actor);
      }
      if (filters.action) {
        results = results.filter((e) => e.action === filters.action);
      }
      if (filters.resource) {
        results = results.filter((e) => e.resource === filters.resource);
      }
      if (filters.success !== undefined) {
        results = results.filter((e) => e.success === filters.success);
      }
      if (filters.from) {
        results = results.filter((e) => new Date(e.timestamp) >= new Date(filters.from));
      }
      if (filters.to) {
        results = results.filter((e) => new Date(e.timestamp) <= new Date(filters.to));
      }

      // Pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 100;

      return {
        entries: results.slice(offset, offset + limit),
        total: results.length,
        offset,
        limit,
      };
    },

    getById: (id) => {
      return storage.find((e) => e.id === id) || null;
    },

    getForActor: (actorId, limit = 100) => {
      return storage.filter((e) => e.actor === actorId).slice(-limit);
    },

    getForResource: (resource, limit = 100) => {
      return storage.filter((e) => e.resource === resource).slice(-limit);
    },

    subscribe: (callback) => {
      subscribers.push(callback);
      return () => {
        const index = subscribers.indexOf(callback);
        if (index !== -1) subscribers.splice(index, 1);
      };
    },

    cleanup: () => {
      const cutoff = Date.now() - retention;
      const before = storage.length;

      for (let i = storage.length - 1; i >= 0; i--) {
        if (new Date(storage[i].timestamp).getTime() < cutoff) {
          storage.splice(i, 1);
        }
      }

      return before - storage.length;
    },

    getStats: () => {
      return {
        total: storage.length,
        byType: storage.reduce((acc, e) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        }, {}),
        successRate:
          storage.length > 0 ? storage.filter((e) => e.success).length / storage.length : 1,
      };
    },

    export: (format = 'json') => {
      if (format === 'json') {
        return JSON.stringify(storage, null, 2);
      }
      if (format === 'csv') {
        const headers = ['id', 'timestamp', 'type', 'actor', 'action', 'resource', 'success'];
        const rows = storage.map((e) => headers.map((h) => e[h] ?? '').join(','));
        return [headers.join(','), ...rows].join('\n');
      }
      throw new Error(`Unknown format: ${format}`);
    },

    clear: () => {
      storage.length = 0;
    },
  };
};

describe('Audit Logger Tests', () => {
  let auditLogger;

  beforeEach(() => {
    auditLogger = createAuditLogger();
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOG
  // ═══════════════════════════════════════════════════════════════════

  describe('log', () => {
    it('should log event', () => {
      const entry = auditLogger.log({ type: 'test', message: 'Hello' });

      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.message).toBe('Hello');
    });

    it('should enforce max entries', () => {
      const logger = createAuditLogger({ storage: [], maxEntries: 5 });

      for (let i = 0; i < 10; i++) {
        logger.log({ index: i });
      }

      const stats = logger.getStats();
      expect(stats.total).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOG ACTION
  // ═══════════════════════════════════════════════════════════════════

  describe('logAction', () => {
    it('should log action', () => {
      const entry = auditLogger.logAction('user-1', 'create', 'document', { id: 'doc-1' });

      expect(entry.type).toBe('action');
      expect(entry.actor).toBe('user-1');
      expect(entry.action).toBe('create');
      expect(entry.resource).toBe('document');
      expect(entry.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOG ERROR
  // ═══════════════════════════════════════════════════════════════════

  describe('logError', () => {
    it('should log error', () => {
      const entry = auditLogger.logError('user-1', 'delete', 'document', new Error('Not found'));

      expect(entry.type).toBe('error');
      expect(entry.success).toBe(false);
      expect(entry.error).toBe('Not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOG ACCESS
  // ═══════════════════════════════════════════════════════════════════

  describe('logAccess', () => {
    it('should log access granted', () => {
      const entry = auditLogger.logAccess('user-1', 'admin-panel', true, 'Has admin role');

      expect(entry.type).toBe('access');
      expect(entry.granted).toBe(true);
    });

    it('should log access denied', () => {
      const entry = auditLogger.logAccess('user-2', 'admin-panel', false, 'Missing admin role');

      expect(entry.granted).toBe(false);
      expect(entry.reason).toBe('Missing admin role');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOG AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════

  describe('logAuthentication', () => {
    it('should log successful auth', () => {
      const entry = auditLogger.logAuthentication('user@example.com', 'password', true, {
        ip: '127.0.0.1',
      });

      expect(entry.type).toBe('authentication');
      expect(entry.success).toBe(true);
      expect(entry.metadata.ip).toBe('127.0.0.1');
    });

    it('should log failed auth', () => {
      const entry = auditLogger.logAuthentication('user@example.com', 'password', false);

      expect(entry.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOG DATA CHANGE
  // ═══════════════════════════════════════════════════════════════════

  describe('logDataChange', () => {
    it('should log data change', () => {
      const entry = auditLogger.logDataChange('user-1', 'user', 'user-2', {
        before: { name: 'Old Name' },
        after: { name: 'New Name' },
      });

      expect(entry.type).toBe('data_change');
      expect(entry.entity).toBe('user');
      expect(entry.entityId).toBe('user-2');
      expect(entry.changes.before.name).toBe('Old Name');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // QUERY
  // ═══════════════════════════════════════════════════════════════════

  describe('query', () => {
    beforeEach(() => {
      auditLogger.logAction('user-1', 'create', 'doc');
      auditLogger.logAction('user-1', 'update', 'doc');
      auditLogger.logAction('user-2', 'delete', 'doc');
      auditLogger.logError('user-1', 'update', 'settings', new Error('Failed'));
    });

    it('should filter by type', () => {
      const result = auditLogger.query({ type: 'action' });
      expect(result.entries.length).toBe(3);
    });

    it('should filter by actor', () => {
      const result = auditLogger.query({ actor: 'user-1' });
      expect(result.entries.length).toBe(3);
    });

    it('should filter by success', () => {
      const result = auditLogger.query({ success: false });
      expect(result.entries.length).toBe(1);
    });

    it('should paginate results', () => {
      const result = auditLogger.query({ limit: 2, offset: 1 });
      expect(result.entries.length).toBe(2);
      expect(result.total).toBe(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUBSCRIBE
  // ═══════════════════════════════════════════════════════════════════

  describe('subscribe', () => {
    it('should notify subscribers', () => {
      const callback = vi.fn();
      auditLogger.subscribe(callback);

      auditLogger.log({ test: true });

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = auditLogger.subscribe(callback);

      unsubscribe();
      auditLogger.log({ test: true });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET BY ID / FOR ACTOR / FOR RESOURCE
  // ═══════════════════════════════════════════════════════════════════

  describe('Get Methods', () => {
    it('should get by id', () => {
      const entry = auditLogger.log({ test: true });
      const found = auditLogger.getById(entry.id);

      expect(found.id).toBe(entry.id);
    });

    it('should get for actor', () => {
      auditLogger.logAction('user-1', 'a', 'r');
      auditLogger.logAction('user-1', 'b', 'r');
      auditLogger.logAction('user-2', 'c', 'r');

      const entries = auditLogger.getForActor('user-1');
      expect(entries.length).toBe(2);
    });

    it('should get for resource', () => {
      auditLogger.logAction('u', 'a', 'doc-1');
      auditLogger.logAction('u', 'b', 'doc-1');
      auditLogger.logAction('u', 'c', 'doc-2');

      const entries = auditLogger.getForResource('doc-1');
      expect(entries.length).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════

  describe('getStats', () => {
    it('should return stats', () => {
      auditLogger.logAction('u', 'a', 'r');
      auditLogger.logAction('u', 'b', 'r');
      auditLogger.logError('u', 'c', 'r', new Error());

      const stats = auditLogger.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.action).toBe(2);
      expect(stats.byType.error).toBe(1);
      expect(stats.successRate).toBeCloseTo(0.67, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════════

  describe('export', () => {
    it('should export as JSON', () => {
      auditLogger.log({ test: true });

      const json = auditLogger.export('json');
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should export as CSV', () => {
      auditLogger.logAction('user-1', 'create', 'doc');

      const csv = auditLogger.export('csv');

      expect(csv).toContain('id,timestamp');
      expect(csv).toContain('user-1');
    });
  });
});
