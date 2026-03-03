/**
 * Usage Tracking Service Unit Tests
 *
 * Tests for usage and analytics tracking.
 *
 * @module tests/unit/backend/usageTrackingService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create usage tracking service implementation
const createUsageTrackingService = () => {
  const events = [];
  const usageCounters = new Map();
  const quotas = new Map();

  // Helper function for quota status
  const getQuotaStatusInternal = (orgId, resource) => {
    const key = `${orgId}:${resource}`;
    const quota = quotas.get(key);

    if (!quota) {
      return { orgId, resource, limit: Infinity, used: 0, remaining: Infinity, exceeded: false };
    }

    return {
      orgId,
      resource,
      limit: quota.limit,
      used: quota.used,
      remaining: Math.max(0, quota.limit - quota.used),
      percentUsed: quota.limit > 0 ? Math.round((quota.used / quota.limit) * 100) : 0,
      exceeded: quota.used > quota.limit,
    };
  };

  return {
    // Track event
    trackEvent: async (data) => {
      const event = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: data.userId,
        orgId: data.orgId,
        action: data.action,
        resource: data.resource,
        metadata: data.metadata || {},
        timestamp: new Date().toISOString(),
      };

      events.push(event);

      // Update counters
      const key = `${data.orgId}:${data.action}`;
      usageCounters.set(key, (usageCounters.get(key) || 0) + 1);

      return event;
    },

    // Get events
    getEvents: async (filters = {}) => {
      let filtered = [...events];

      if (filters.userId) {
        filtered = filtered.filter((e) => e.userId === filters.userId);
      }
      if (filters.orgId) {
        filtered = filtered.filter((e) => e.orgId === filters.orgId);
      }
      if (filters.action) {
        filtered = filtered.filter((e) => e.action === filters.action);
      }
      if (filters.from) {
        filtered = filtered.filter((e) => new Date(e.timestamp) >= new Date(filters.from));
      }
      if (filters.to) {
        filtered = filtered.filter((e) => new Date(e.timestamp) <= new Date(filters.to));
      }

      return filtered.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },

    // Get usage summary
    getUsageSummary: async (orgId, period = 'day') => {
      const orgEvents = events.filter((e) => e.orgId === orgId);

      const actionCounts = new Map();
      const userCounts = new Set();

      for (const event of orgEvents) {
        actionCounts.set(event.action, (actionCounts.get(event.action) || 0) + 1);
        userCounts.add(event.userId);
      }

      return {
        orgId,
        period,
        totalEvents: orgEvents.length,
        uniqueUsers: userCounts.size,
        byAction: Array.from(actionCounts.entries())
          .map(([action, count]) => ({
            action,
            count,
          }))
          .sort((a, b) => b.count - a.count),
      };
    },

    // Set quota
    setQuota: async (orgId, resource, limit) => {
      const key = `${orgId}:${resource}`;
      quotas.set(key, { limit, used: 0 });
      return { orgId, resource, limit, used: 0 };
    },

    // Track resource usage
    trackResourceUsage: async (orgId, resource, amount = 1) => {
      const key = `${orgId}:${resource}`;
      const quota = quotas.get(key) || { limit: Infinity, used: 0 };

      quota.used += amount;
      quotas.set(key, quota);

      return {
        orgId,
        resource,
        used: quota.used,
        limit: quota.limit,
        remaining: Math.max(0, quota.limit - quota.used),
        exceeded: quota.used > quota.limit,
      };
    },

    // Get quota status
    getQuotaStatus: async (orgId, resource) => {
      return getQuotaStatusInternal(orgId, resource);
    },

    // Reset quota
    resetQuota: async (orgId, resource) => {
      const key = `${orgId}:${resource}`;
      const quota = quotas.get(key);
      if (quota) {
        quota.used = 0;
        quotas.set(key, quota);
      }
      return getQuotaStatusInternal(orgId, resource);
    },

    // Get usage trends
    getUsageTrends: async (orgId, resource, days = 7) => {
      const trends = [];
      const now = new Date();

      for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dayEvents = events.filter(
          (e) => e.orgId === orgId && e.resource === resource && e.timestamp.startsWith(dateStr)
        );

        trends.push({
          date: dateStr,
          count: dayEvents.length,
        });
      }

      return trends.reverse();
    },

    // Clear for testing
    clear: () => {
      events.length = 0;
      usageCounters.clear();
      quotas.clear();
    },
  };
};

describe('UsageTrackingService', () => {
  let usageService;

  beforeEach(() => {
    usageService = createUsageTrackingService();
  });

  describe('Event Tracking', () => {
    it('should track events', async () => {
      const event = await usageService.trackEvent({
        userId: 'user-1',
        orgId: 'org-1',
        action: 'project.create',
        resource: 'projects',
      });

      expect(event.id).toBeDefined();
      expect(event.action).toBe('project.create');
      expect(event.timestamp).toBeDefined();
    });

    it('should retrieve events with filters', async () => {
      await usageService.trackEvent({ userId: 'user-1', orgId: 'org-1', action: 'login' });
      await usageService.trackEvent({ userId: 'user-2', orgId: 'org-1', action: 'project.create' });
      await usageService.trackEvent({ userId: 'user-1', orgId: 'org-2', action: 'login' });

      const userEvents = await usageService.getEvents({ userId: 'user-1' });
      const orgEvents = await usageService.getEvents({ orgId: 'org-1' });
      const actionEvents = await usageService.getEvents({ action: 'login' });

      expect(userEvents).toHaveLength(2);
      expect(orgEvents).toHaveLength(2);
      expect(actionEvents).toHaveLength(2);
    });
  });

  describe('Usage Summary', () => {
    beforeEach(async () => {
      await usageService.trackEvent({ userId: 'user-1', orgId: 'org-1', action: 'login' });
      await usageService.trackEvent({ userId: 'user-1', orgId: 'org-1', action: 'project.create' });
      await usageService.trackEvent({ userId: 'user-2', orgId: 'org-1', action: 'login' });
      await usageService.trackEvent({ userId: 'user-2', orgId: 'org-1', action: 'login' });
    });

    it('should generate usage summary', async () => {
      const summary = await usageService.getUsageSummary('org-1');

      expect(summary.totalEvents).toBe(4);
      expect(summary.uniqueUsers).toBe(2);
      expect(summary.byAction.find((a) => a.action === 'login').count).toBe(3);
    });
  });

  describe('Quota Management', () => {
    it('should set and track quota', async () => {
      await usageService.setQuota('org-1', 'ai_calls', 100);

      await usageService.trackResourceUsage('org-1', 'ai_calls', 10);
      await usageService.trackResourceUsage('org-1', 'ai_calls', 20);

      const status = await usageService.getQuotaStatus('org-1', 'ai_calls');

      expect(status.used).toBe(30);
      expect(status.remaining).toBe(70);
      expect(status.percentUsed).toBe(30);
      expect(status.exceeded).toBe(false);
    });

    it('should detect quota exceeded', async () => {
      await usageService.setQuota('org-1', 'api_calls', 50);

      await usageService.trackResourceUsage('org-1', 'api_calls', 60);

      const status = await usageService.getQuotaStatus('org-1', 'api_calls');

      expect(status.exceeded).toBe(true);
      expect(status.remaining).toBe(0);
    });

    it('should reset quota', async () => {
      await usageService.setQuota('org-1', 'storage', 1000);
      await usageService.trackResourceUsage('org-1', 'storage', 500);

      await usageService.resetQuota('org-1', 'storage');

      const status = await usageService.getQuotaStatus('org-1', 'storage');
      expect(status.used).toBe(0);
    });
  });

  describe('Usage Trends', () => {
    it('should return usage trends', async () => {
      const trends = await usageService.getUsageTrends('org-1', 'api', 7);

      expect(trends).toHaveLength(7);
      expect(trends[0]).toHaveProperty('date');
      expect(trends[0]).toHaveProperty('count');
    });
  });
});
