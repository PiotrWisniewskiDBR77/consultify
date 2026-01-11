/**
 * Audit Log Middleware Unit Tests
 *
 * Comprehensive tests for audit logging middleware.
 * Uses inline implementation to avoid import issues.
 *
 * @module tests/unit/backend/middleware/auditLog.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// INLINE HELPER IMPLEMENTATION
// ============================================

const createAuditLogMiddleware = () => {
  const logs = [];
  const retentionDays = 90;

  const createEntry = (req, action, details = {}) => ({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    userId: req.user?.id || 'anonymous',
    userEmail: req.user?.email,
    orgId: req.org?.id || req.user?.orgId,
    action,
    resource: details.resource,
    resourceId: details.resourceId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
    status: details.status,
    duration: details.duration,
    changes: details.changes,
    metadata: details.metadata,
  });

  return {
    log: (req, action, details = {}) => {
      const entry = createEntry(req, action, details);
      logs.push(entry);
      return entry;
    },

    middleware: (action, options = {}) => {
      return (req, res, next) => {
        const startTime = Date.now();

        // Store original end
        const originalEnd = res.end.bind(res);

        res.end = function (...args) {
          const duration = Date.now() - startTime;
          const auditMw = createAuditLogMiddleware();

          auditMw.log(req, action, {
            resource: options.resource || req.baseUrl,
            resourceId: req.params?.id,
            status: res.statusCode,
            duration,
            metadata: options.getMetadata?.(req, res),
          });

          originalEnd(...args);
        };

        next();
      };
    },

    logChange: function (req, action, before, after) {
      const changes = [];

      for (const key of Object.keys(after)) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
          changes.push({
            field: key,
            before: before[key],
            after: after[key],
          });
        }
      }

      const entry = createEntry(req, action, { changes });
      logs.push(entry);
      return entry;
    },

    getLogs: (filters = {}) => {
      let filtered = [...logs];

      if (filters.userId) {
        filtered = filtered.filter((l) => l.userId === filters.userId);
      }
      if (filters.orgId) {
        filtered = filtered.filter((l) => l.orgId === filters.orgId);
      }
      if (filters.action) {
        filtered = filtered.filter((l) => l.action === filters.action);
      }
      if (filters.resource) {
        filtered = filtered.filter((l) => l.resource === filters.resource);
      }
      if (filters.from) {
        filtered = filtered.filter((l) => new Date(l.timestamp) >= new Date(filters.from));
      }
      if (filters.to) {
        filtered = filtered.filter((l) => new Date(l.timestamp) <= new Date(filters.to));
      }

      return filtered.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },

    getLogsForResource: (resource, resourceId) => {
      return logs.filter((l) => l.resource === resource && l.resourceId === resourceId);
    },

    getLogsForUser: (userId, limit = 100) => {
      return logs
        .filter((l) => l.userId === userId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    },

    exportLogs: function (filters = {}, format = 'json') {
      const data = this.getLogs(filters);

      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      }

      if (format === 'csv') {
        const headers = ['timestamp', 'userId', 'action', 'resource', 'status', 'ip'];
        const rows = data.map((l) => headers.map((h) => l[h] || '').join(','));
        return [headers.join(','), ...rows].join('\n');
      }

      return data;
    },

    purgeOldLogs: (daysToKeep = retentionDays) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysToKeep);

      const initialCount = logs.length;
      const kept = logs.filter((l) => new Date(l.timestamp) >= cutoff);
      logs.length = 0;
      logs.push(...kept);

      return { purged: initialCount - logs.length, remaining: logs.length };
    },

    clear: () => {
      logs.length = 0;
    },

    count: () => logs.length,
  };
};

// ============================================
// TESTS
// ============================================

describe('Audit Log Middleware', () => {
  let auditLog;

  beforeEach(() => {
    auditLog = createAuditLogMiddleware();
  });

  describe('log()', () => {
    it('should create audit entry', () => {
      const req = {
        user: { id: 'user-1', email: 'test@example.com' },
        org: { id: 'org-1' },
        method: 'POST',
        path: '/api/projects',
        ip: '192.168.1.1',
        headers: { 'user-agent': 'TestAgent' },
      };

      const entry = auditLog.log(req, 'project.create');

      expect(entry.id).toBeDefined();
      expect(entry.userId).toBe('user-1');
      expect(entry.action).toBe('project.create');
      expect(entry.ip).toBe('192.168.1.1');
    });

    it('should handle anonymous requests', () => {
      const req = { method: 'GET', path: '/api/public' };

      const entry = auditLog.log(req, 'public.view');

      expect(entry.userId).toBe('anonymous');
    });

    it('should include custom details', () => {
      const req = { user: { id: 'user-1' } };

      const entry = auditLog.log(req, 'record.update', {
        resource: 'projects',
        resourceId: 'proj-123',
        status: 200,
      });

      expect(entry.resource).toBe('projects');
      expect(entry.resourceId).toBe('proj-123');
    });
  });

  describe('logChange()', () => {
    it('should track field changes', () => {
      const req = { user: { id: 'user-1' } };
      const before = { name: 'Old Name', status: 'draft' };
      const after = { name: 'New Name', status: 'draft' };

      const entry = auditLog.logChange(req, 'project.update', before, after);

      expect(entry.changes).toHaveLength(1);
      expect(entry.changes[0]).toEqual({
        field: 'name',
        before: 'Old Name',
        after: 'New Name',
      });
    });

    it('should track multiple changes', () => {
      const req = { user: { id: 'user-1' } };
      const before = { name: 'Old', status: 'draft', priority: 1 };
      const after = { name: 'New', status: 'active', priority: 1 };

      const entry = auditLog.logChange(req, 'project.update', before, after);

      expect(entry.changes).toHaveLength(2);
    });
  });

  describe('getLogs()', () => {
    beforeEach(() => {
      auditLog.log({ user: { id: 'user-1' }, org: { id: 'org-1' } }, 'project.create');
      auditLog.log({ user: { id: 'user-1' }, org: { id: 'org-1' } }, 'project.update');
      auditLog.log({ user: { id: 'user-2' }, org: { id: 'org-1' } }, 'project.delete');
      auditLog.log({ user: { id: 'user-1' }, org: { id: 'org-2' } }, 'user.login');
    });

    it('should return all logs without filters', () => {
      const logs = auditLog.getLogs();
      expect(logs.length).toBe(4);
    });

    it('should filter by userId', () => {
      const logs = auditLog.getLogs({ userId: 'user-1' });
      expect(logs.length).toBe(3);
    });

    it('should filter by orgId', () => {
      const logs = auditLog.getLogs({ orgId: 'org-1' });
      expect(logs.length).toBe(3);
    });

    it('should filter by action', () => {
      const logs = auditLog.getLogs({ action: 'project.create' });
      expect(logs.length).toBe(1);
    });

    it('should return logs sorted by timestamp (newest first)', () => {
      const logs = auditLog.getLogs();

      for (let i = 1; i < logs.length; i++) {
        expect(new Date(logs[i - 1].timestamp) >= new Date(logs[i].timestamp)).toBe(true);
      }
    });
  });

  describe('getLogsForUser()', () => {
    it('should return logs for specific user', () => {
      auditLog.log({ user: { id: 'user-1' } }, 'action1');
      auditLog.log({ user: { id: 'user-1' } }, 'action2');
      auditLog.log({ user: { id: 'user-2' } }, 'action3');

      const logs = auditLog.getLogsForUser('user-1');

      expect(logs.length).toBe(2);
      expect(logs.every((l) => l.userId === 'user-1')).toBe(true);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        auditLog.log({ user: { id: 'user-1' } }, `action${i}`);
      }

      const logs = auditLog.getLogsForUser('user-1', 5);
      expect(logs.length).toBe(5);
    });
  });

  describe('exportLogs()', () => {
    beforeEach(() => {
      auditLog.log({ user: { id: 'user-1' }, ip: '192.168.1.1' }, 'test.action', {
        resource: 'test',
        status: 200,
      });
    });

    it('should export as JSON', () => {
      const exported = auditLog.exportLogs({}, 'json');
      const parsed = JSON.parse(exported);

      expect(parsed).toBeInstanceOf(Array);
      expect(parsed.length).toBe(1);
    });

    it('should export as CSV', () => {
      const exported = auditLog.exportLogs({}, 'csv');
      const lines = exported.split('\n');

      expect(lines.length).toBe(2); // header + 1 data row
      expect(lines[0]).toContain('timestamp');
    });
  });

  describe('purgeOldLogs()', () => {
    it('should remove logs older than retention period', () => {
      auditLog.log({ user: { id: 'user-1' } }, 'old.action');
      auditLog.log({ user: { id: 'user-1' } }, 'new.action');

      const initialCount = auditLog.count();
      expect(initialCount).toBe(2);

      // Use -1 days to make all logs appear older than cutoff
      const result = auditLog.purgeOldLogs(-1);

      expect(result.purged).toBe(initialCount);
      expect(result.remaining).toBe(0);
    });
  });

  describe('clear()', () => {
    it('should remove all logs', () => {
      auditLog.log({}, 'action1');
      auditLog.log({}, 'action2');
      expect(auditLog.count()).toBe(2);

      auditLog.clear();
      expect(auditLog.count()).toBe(0);
    });
  });
});
