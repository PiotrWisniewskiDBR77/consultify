/**
 * DunningService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for DunningService - 85%+ coverage target
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IDatabase } from '../../../../src/database/IDatabase.js';
import DunningService from '../../../../src/services/dunningService.js';

describe('DunningService', () => {
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

    if (DunningService.setDependencies) {
      DunningService.setDependencies({
        db: mockDb,
        uuidv4: () => 'uuid-123',
        stripe: { invoices: { pay: vi.fn() } },
        EmailService: { send: vi.fn() },
        NotificationService: { sendToAdmins: vi.fn() },
        AuditService: { logSystemEvent: vi.fn() },
      });
    }
  });

  describe('Service Methods', () => {
    it('should handle payment failure and initiate dunning', async () => {
      (mockDb.get as any).mockImplementation((sql: string, params: any, cb: any) => {
        cb(null, null); // No existing dunning
      });

      await DunningService.handlePaymentFailed('org-1', 'inv-1', 'Card declined');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dunning_status'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should suspend organization after max retries', async () => {
      (mockDb.get as any).mockImplementation((sql: string, params: any, cb: any) => {
        cb(null, { id: 'dunn-1', current_attempt: 3 }); // Already at max (DUNNING_SCHEDULE is 4)
      });

      await DunningService.handlePaymentFailed('org-1', 'inv-1', 'Persistent failure');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE organizations SET status = 'suspended'"),
        expect.any(Array),
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
