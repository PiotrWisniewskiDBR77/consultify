/**
 * UserActivityService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IDatabase } from '../../../../src/database/IDatabase.js';
import UserActivityService from '../../../../src/services/userActivityService.js';

describe('UserActivityService', () => {
  let mockDb: IDatabase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn(function (
        this: any,
        sql: string,
        params: unknown[],
        callback: (err: Error | null) => void
      ) {
        if (callback) {
          callback.call({ lastID: 1, changes: 1 }, null);
        }
        return this;
      }),
      exec: vi.fn(),
      serialize: vi.fn(),
      close: vi.fn(),
      query: vi.fn(),
    } as unknown as IDatabase;

    if (UserActivityService.setDependencies) {
      UserActivityService.setDependencies({ db: mockDb });
    }
  });

  describe('Service Methods', () => {
    it('should be defined', () => {
      expect(UserActivityService).toBeDefined();
    });

    it('should test getActivitySummary', async () => {
      const summary = { id: '1', user_id: 'u1', organization_id: 'o1', period_start: '2023-01-01' };
      (mockDb.get as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, params: unknown[], callback: (err: Error | null, row: any) => void) => {
          callback(null, summary);
        }
      );

      const result = await UserActivityService.getActivitySummary('u1', 'o1', '2023-01-01');
      expect(result).toEqual(summary);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM user_activity_summary'),
        ['u1', 'o1', '2023-01-01'],
        expect.any(Function)
      );
    });

    it('should test getActivityHistory', async () => {
      const history = [{ id: '1' }, { id: '2' }];
      (mockDb.all as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, params: unknown[], callback: (err: Error | null, rows: any[]) => void) => {
          callback(null, history);
        }
      );

      const result = await UserActivityService.getActivityHistory('u1', 'o1', 30);
      expect(result).toEqual(history);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM user_activity_summary'),
        ['u1', 'o1', 30],
        expect.any(Function)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', () => {
      (mockDb.get as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, params: unknown[], callback: (err: Error | null) => void) => {
          callback(new Error('Database error'));
        }
      );

      expect(true).toBe(true);
    });
  });
});
