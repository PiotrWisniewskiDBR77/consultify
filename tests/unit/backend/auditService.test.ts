/**
 * AuditService - Unit Tests (L1)
 * Tests for audit logging functionality
 *
 * Coverage target: 95%+
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock database
const mockDb = vi.hoisted(() => ({
  run: vi.fn(),
  all: vi.fn(),
  get: vi.fn(),
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-audit-uuid'),
}));

// Mock logger
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import auditService, { log, getLogs, getEntry } from '../../../server/src/services/auditService';

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.run.mockResolvedValue({ lastID: 1, changes: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log', () => {
    it('should create audit log entry successfully', async () => {
      const input = {
        actorType: 'user' as const,
        actorId: 'user-1',
        actorEmail: 'test@example.com',
        action: 'CREATE',
        actionCategory: 'data' as const,
        resourceType: 'project',
        resourceId: 'project-1',
        organizationId: 'org-1',
        result: 'success' as const,
      };

      const logId = await log(input);

      expect(logId).toBeDefined();
      expect(logId).toContain('audit-');
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should determine changed fields from previous and new values', async () => {
      const input = {
        actorType: 'user' as const,
        actorId: 'user-1',
        action: 'UPDATE',
        actionCategory: 'data' as const,
        resourceType: 'project',
        resourceId: 'project-1',
        previousValues: { name: 'Old Name', status: 'draft' },
        newValues: { name: 'New Name', status: 'active' },
        result: 'success' as const,
      };

      await log(input);

      expect(mockDb.run).toHaveBeenCalled();
      const callArgs = mockDb.run.mock.calls[0];
      expect(callArgs[0]).toContain('changed_fields');
    });

    it('should handle error result', async () => {
      const input = {
        actorType: 'system' as const,
        action: 'BACKUP',
        actionCategory: 'system' as const,
        resourceType: 'database',
        result: 'failure' as const,
        errorMessage: 'Backup failed',
      };

      const logId = await log(input);

      expect(logId).toBeDefined();
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should handle all actor types', async () => {
      const actorTypes = ['user', 'system', 'ai', 'integration', 'superadmin', 'cron'] as const;

      for (const actorType of actorTypes) {
        const input = {
          actorType,
          action: 'TEST',
          actionCategory: 'system' as const,
          resourceType: 'test',
          result: 'success' as const,
        };

        const logId = await log(input);
        expect(logId).toBeDefined();
      }
    });
  });

  describe('getLogs', () => {
    it('should retrieve audit logs with filters', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          actor_type: 'user',
          action: 'CREATE',
          resource_type: 'project',
          organization_id: 'org-1',
        },
      ];

      mockDb.get.mockResolvedValue({ count: mockLogs.length });
      mockDb.all.mockResolvedValue(mockLogs);

      const filters = {
        organizationId: 'org-1',
        limit: 10,
      };

      const logs = await getLogs(filters);

      expect(logs).toBeDefined();
      expect(Array.isArray(logs.entries)).toBe(true);
      expect(logs.entries).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should handle empty filters', async () => {
      mockDb.get.mockResolvedValue({ count: 0 });
      mockDb.all.mockResolvedValue([]);

      const logs = await getLogs({});

      expect(logs).toBeDefined();
      expect(Array.isArray(logs.entries)).toBe(true);
      expect(logs.entries).toHaveLength(0);
    });

    it('should filter by date range', async () => {
      mockDb.get.mockResolvedValue({ count: 0 });
      mockDb.all.mockResolvedValue([]);

      const filters = {
        fromDate: new Date('2026-01-01'),
        toDate: new Date('2026-01-31'),
      };

      await getLogs(filters);

      expect(mockDb.all).toHaveBeenCalled();
      const sql = mockDb.all.mock.calls[0][0];
      expect(sql).toContain('timestamp');
    });
  });

  describe('getLogById', () => {
    it('should retrieve single audit log by id', async () => {
      const mockLog = {
        id: 'audit-1',
        actor_type: 'user',
        action: 'CREATE',
      };

      mockDb.get.mockResolvedValue(mockLog);

      const logEntry = await getEntry('audit-1');

      expect(logEntry).toBeDefined();
      expect(logEntry?.id).toBe('audit-1');
    });

    it('should return null if log not found', async () => {
      mockDb.get.mockResolvedValue(null);

      const logEntry = await getEntry('non-existent');

      expect(logEntry).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.run.mockRejectedValue(new Error('Database error'));

      await expect(
        log({
          actorType: 'user',
          action: 'TEST',
          actionCategory: 'system',
          resourceType: 'test',
        })
      ).rejects.toThrow();
    });
  });
});
