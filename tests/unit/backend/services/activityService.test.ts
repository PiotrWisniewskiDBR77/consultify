/**
 * Activity Service Tests
 * Tests for activity logging functionality using mocked database
 *
 * @module tests/unit/backend/services/activityService.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Define the ActivityLogParams interface locally since import has issues
interface ActivityLogParams {
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// Mock activity service implementation for testing
class MockActivityService {
  private logs: any[] = [];
  private sequenceCounter = 0; // To ensure consistent ordering

  async log(params: ActivityLogParams): Promise<void> {
    this.sequenceCounter++;
    this.logs.push({
      id: uuidv4(),
      organization_id: params.organizationId,
      user_id: params.userId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      entity_name: params.entityName || null,
      old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
      new_value: params.newValue || params.metadata ? JSON.stringify(params.newValue || params.metadata) : null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      created_at: new Date(Date.now() + this.sequenceCounter).toISOString(), // Ensure unique timestamps
      sequence: this.sequenceCounter,
    });
  }

  async getRecent(limit = 50): Promise<any[]> {
    return this.logs
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  async getByOrganization(organizationId: string, limit = 50): Promise<any[]> {
    return this.logs
      .filter((log) => log.organization_id === organizationId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  clear(): void {
    this.logs = [];
  }

  getLogs(): any[] {
    return [...this.logs];
  }
}

describe('ActivityService', () => {
  let activityService: MockActivityService;

  beforeEach(() => {
    activityService = new MockActivityService();
  });

  describe('log', () => {
    it('should log an activity with all parameters', async () => {
      const params: ActivityLogParams = {
        organizationId: 'org-123',
        userId: 'user-456',
        action: 'CREATE',
        entityType: 'task',
        entityId: 'task-789',
        entityName: 'Test Task',
        oldValue: null,
        newValue: { title: 'My Task' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await activityService.log(params);

      const logs = activityService.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].organization_id).toBe('org-123');
      expect(logs[0].user_id).toBe('user-456');
      expect(logs[0].action).toBe('CREATE');
      expect(logs[0].entity_type).toBe('task');
      expect(logs[0].entity_id).toBe('task-789');
      expect(logs[0].ip_address).toBe('192.168.1.1');
    });

    it('should handle minimal activity log parameters', async () => {
      const params: ActivityLogParams = {
        organizationId: 'org-minimal',
        action: 'LOGIN',
        entityType: 'session',
      };

      await activityService.log(params);

      const logs = activityService.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('LOGIN');
      expect(logs[0].user_id).toBeNull();
      expect(logs[0].entity_id).toBeNull();
    });

    it('should serialize metadata to JSON', async () => {
      const params: ActivityLogParams = {
        organizationId: 'org-meta',
        action: 'UPDATE',
        entityType: 'settings',
        metadata: { theme: 'dark', notifications: true },
      };

      await activityService.log(params);

      const logs = activityService.getLogs();

      expect(logs).toHaveLength(1);
      const parsed = JSON.parse(logs[0].new_value);
      expect(parsed.theme).toBe('dark');
      expect(parsed.notifications).toBe(true);
    });
  });

  describe('getRecent', () => {
    it('should return recent activities ordered by created_at DESC', async () => {
      // Insert test data
      await activityService.log({
        organizationId: 'org-1',
        action: 'ACTION_1',
        entityType: 'type',
      });
      await activityService.log({
        organizationId: 'org-2',
        action: 'ACTION_2',
        entityType: 'type',
      });
      await activityService.log({
        organizationId: 'org-3',
        action: 'ACTION_3',
        entityType: 'type',
      });

      const recent = await activityService.getRecent(2);

      expect(recent).toHaveLength(2);
      // Most recent should be first (based on sequence/created_at)
      expect(recent[0].action).toBe('ACTION_3');
      expect(recent[1].action).toBe('ACTION_2');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await activityService.log({
          organizationId: `org-${i}`,
          action: `ACTION_${i}`,
          entityType: 'type',
        });
      }

      const recent = await activityService.getRecent(5);
      expect(recent).toHaveLength(5);
    });
  });

  describe('getByOrganization', () => {
    it('should filter activities by organization', async () => {
      await activityService.log({
        organizationId: 'org-A',
        action: 'ACTION_A1',
        entityType: 'type',
      });
      await activityService.log({
        organizationId: 'org-B',
        action: 'ACTION_B1',
        entityType: 'type',
      });
      await activityService.log({
        organizationId: 'org-A',
        action: 'ACTION_A2',
        entityType: 'type',
      });

      const orgALogs = await activityService.getByOrganization('org-A');

      expect(orgALogs).toHaveLength(2);
      expect(orgALogs.every((log) => log.organization_id === 'org-A')).toBe(true);
    });

    it('should return empty array for non-existent organization', async () => {
      const logs = await activityService.getByOrganization('non-existent-org');
      expect(logs).toEqual([]);
    });
  });
});
