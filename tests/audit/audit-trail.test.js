/**
 * Audit Trail and Logging Tests
 * Tests for audit logging and activity tracking
 *
 * @module tests/audit/audit-trail.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Audit logger
const createAuditLogger = () => {
  const logs = [];
  const subscribers = [];

  return {
    log: (action, details = {}) => {
      const entry = {
        id: crypto.randomUUID(),
        action,
        userId: details.userId || null,
        resourceType: details.resourceType || null,
        resourceId: details.resourceId || null,
        changes: details.changes || null,
        metadata: details.metadata || {},
        ip: details.ip || null,
        userAgent: details.userAgent || null,
        timestamp: Date.now(),
      };

      logs.push(entry);
      subscribers.forEach((fn) => fn(entry));
      return entry;
    },

    query: (filters = {}) => {
      let results = [...logs];

      if (filters.action) results = results.filter((l) => l.action === filters.action);
      if (filters.userId) results = results.filter((l) => l.userId === filters.userId);
      if (filters.resourceType)
        results = results.filter((l) => l.resourceType === filters.resourceType);
      if (filters.resourceId) results = results.filter((l) => l.resourceId === filters.resourceId);
      if (filters.since) results = results.filter((l) => l.timestamp >= filters.since);
      if (filters.until) results = results.filter((l) => l.timestamp <= filters.until);

      return results.sort((a, b) => b.timestamp - a.timestamp);
    },

    getByResource: (resourceType, resourceId) => {
      return logs.filter((l) => l.resourceType === resourceType && l.resourceId === resourceId);
    },

    getByUser: (userId) => {
      return logs.filter((l) => l.userId === userId);
    },

    subscribe: (callback) => {
      subscribers.push(callback);
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    },

    export: () => [...logs],

    getCount: () => logs.length,
  };
};

// Change tracker
const createChangeTracker = () => {
  return {
    diff: (before, after) => {
      const changes = [];

      const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

      for (const key of allKeys) {
        const oldVal = before?.[key];
        const newVal = after?.[key];

        if (oldVal !== newVal) {
          changes.push({ field: key, from: oldVal, to: newVal });
        }
      }

      return changes;
    },

    format: (changes) => {
      return changes.map((c) => `${c.field}: ${c.from} → ${c.to}`).join(', ');
    },

    hasChanges: (changes) => changes.length > 0,
  };
};

// Activity feed
const createActivityFeed = () => {
  const activities = new Map(); // userId -> activities[]

  return {
    record: (userId, activity) => {
      const list = activities.get(userId) || [];
      list.unshift({
        id: crypto.randomUUID(),
        ...activity,
        timestamp: Date.now(),
      });
      activities.set(userId, list);
    },

    getFeed: (userId, limit = 20) => {
      const list = activities.get(userId) || [];
      return list.slice(0, limit);
    },

    getGlobalFeed: (limit = 50) => {
      const all = [];
      for (const list of activities.values()) {
        all.push(...list);
      }
      return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    },

    clear: (userId) => {
      activities.delete(userId);
    },
  };
};

describe('Audit Logger Tests', () => {
  let audit;

  beforeEach(() => {
    audit = createAuditLogger();
  });

  it('should log action', () => {
    const entry = audit.log('user.create', {
      userId: 'admin-1',
      resourceType: 'user',
      resourceId: 'user-123',
    });

    expect(entry.id).toBeTruthy();
    expect(entry.action).toBe('user.create');
  });

  it('should query by action', () => {
    audit.log('user.create', {});
    audit.log('user.update', {});
    audit.log('user.create', {});

    const results = audit.query({ action: 'user.create' });
    expect(results).toHaveLength(2);
  });

  it('should query by user', () => {
    audit.log('action', { userId: 'user-1' });
    audit.log('action', { userId: 'user-2' });

    const results = audit.getByUser('user-1');
    expect(results).toHaveLength(1);
  });

  it('should subscribe to new logs', () => {
    const handler = vi.fn();
    audit.subscribe(handler);

    audit.log('test.action', {});

    expect(handler).toHaveBeenCalled();
  });

  it('should export logs', () => {
    audit.log('a', {});
    audit.log('b', {});

    const exported = audit.export();
    expect(exported).toHaveLength(2);
  });
});

describe('Change Tracker Tests', () => {
  let tracker;

  beforeEach(() => {
    tracker = createChangeTracker();
  });

  it('should detect changes', () => {
    const before = { name: 'Alice', age: 30 };
    const after = { name: 'Alice', age: 31 };

    const changes = tracker.diff(before, after);

    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('age');
  });

  it('should detect additions', () => {
    const before = { a: 1 };
    const after = { a: 1, b: 2 };

    const changes = tracker.diff(before, after);

    expect(changes).toHaveLength(1);
    expect(changes[0].to).toBe(2);
  });

  it('should format changes', () => {
    const changes = [{ field: 'status', from: 'active', to: 'inactive' }];

    const formatted = tracker.format(changes);

    expect(formatted).toContain('status');
    expect(formatted).toContain('active');
  });
});

describe('Activity Feed Tests', () => {
  let feed;

  beforeEach(() => {
    feed = createActivityFeed();
  });

  it('should record activity', () => {
    feed.record('user-1', { type: 'login' });

    const activities = feed.getFeed('user-1');
    expect(activities).toHaveLength(1);
  });

  it('should get global feed', () => {
    feed.record('user-1', { type: 'a' });
    feed.record('user-2', { type: 'b' });

    const global = feed.getGlobalFeed();
    expect(global).toHaveLength(2);
  });

  it('should limit feed size', () => {
    for (let i = 0; i < 50; i++) {
      feed.record('user-1', { type: 'action' });
    }

    const limited = feed.getFeed('user-1', 10);
    expect(limited).toHaveLength(10);
  });
});
