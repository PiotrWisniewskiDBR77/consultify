/**
 * Unit Tests for TrialCron
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupOldUsageCounters,
  getTrialCron,
  runDailyTrialTasks,
} from '../../../../src/cron/TrialCron.js';
import type { IDatabase } from '../../../../src/database/IDatabase.js';

describe('TrialCron', () => {
  let mockDb: IDatabase;
  let mockDemoService: { cleanupExpiredDemos: () => Promise<number> };
  let mockTrialService: {
    sendTrialWarnings: () => Promise<number>;
    processExpiredTrials: () => Promise<number>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database
    const mockDbWithChanges = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
        // Simulate SQLite behavior: db.run() returns the database object with 'changes' property
        const dbObj = {
          ...mockDbWithChanges,
          changes: 5, // Simulate 5 deleted records
        };
        if (callback) {
          callback(null);
        }
        return dbObj;
      }),
      exec: vi.fn(),
      serialize: vi.fn(),
      close: vi.fn(),
    } as unknown as IDatabase;
    mockDb = mockDbWithChanges;

    // Mock services
    mockDemoService = {
      cleanupExpiredDemos: vi.fn().mockResolvedValue(3),
    };

    mockTrialService = {
      sendTrialWarnings: vi.fn().mockResolvedValue(2),
      processExpiredTrials: vi.fn().mockResolvedValue(1),
    };
  });

  describe('runDailyTrialTasks', () => {
    it('should run all trial tasks successfully', async () => {
      const result = await runDailyTrialTasks({
        db: mockDb,
        demoService: mockDemoService,
        trialService: mockTrialService,
      });

      expect(result).toEqual({
        demosCleanedUp: 3,
        warningsSent: 2,
        trialsLocked: 1,
      });

      expect(mockDemoService.cleanupExpiredDemos).toHaveBeenCalledOnce();
      expect(mockTrialService.sendTrialWarnings).toHaveBeenCalledOnce();
      expect(mockTrialService.processExpiredTrials).toHaveBeenCalledOnce();
    });

    it('should throw error if demo cleanup fails', async () => {
      mockDemoService.cleanupExpiredDemos = vi
        .fn()
        .mockRejectedValue(new Error('Demo cleanup failed'));

      await expect(
        runDailyTrialTasks({
          db: mockDb,
          demoService: mockDemoService,
          trialService: mockTrialService,
        })
      ).rejects.toThrow('Demo cleanup failed');
    });

    it('should throw error if trial warnings fail', async () => {
      mockTrialService.sendTrialWarnings = vi
        .fn()
        .mockRejectedValue(new Error('Warning send failed'));

      await expect(
        runDailyTrialTasks({
          db: mockDb,
          demoService: mockDemoService,
          trialService: mockTrialService,
        })
      ).rejects.toThrow('Warning send failed');
    });

    it('should throw error if trial processing fails', async () => {
      mockTrialService.processExpiredTrials = vi
        .fn()
        .mockRejectedValue(new Error('Trial processing failed'));

      await expect(
        runDailyTrialTasks({
          db: mockDb,
          demoService: mockDemoService,
          trialService: mockTrialService,
        })
      ).rejects.toThrow('Trial processing failed');
    });
  });

  describe('cleanupOldUsageCounters', () => {
    it('should cleanup old usage counters successfully', async () => {
      const deleted = await cleanupOldUsageCounters({
        db: mockDb,
      });

      expect(deleted).toBe(5);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM usage_counters'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should handle database errors', async () => {
      const errorMockDb = {
        ...mockDb,
        run: vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
          const dbObj = {
            ...errorMockDb,
            changes: 0,
          };
          if (callback) {
            callback(new Error('Database error'));
          }
          return dbObj;
        }),
      } as unknown as IDatabase;

      await expect(
        cleanupOldUsageCounters({
          db: errorMockDb,
        })
      ).rejects.toThrow('Database error');
    });

    it('should calculate correct cutoff date (30 days ago)', async () => {
      await cleanupOldUsageCounters({
        db: mockDb,
      });

      const callArgs = (mockDb.run as ReturnType<typeof vi.fn>).mock.calls[0];
      const params = callArgs[1] as string[];
      const cutoffDate = params[0];

      const expectedDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      expect(cutoffDate).toBe(expectedDate);
    });
  });

  describe('getTrialCron', () => {
    it('should return singleton instance', () => {
      const instance1 = getTrialCron({ db: mockDb });
      const instance2 = getTrialCron({ db: mockDb });

      expect(instance1).toBe(instance2);
    });
  });
});
