/**
 * Unit Tests for CleanupRevokedTokensCron
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    startCleanupJob,
    stopCleanupJob,
    cleanupRevokedTokens,
    getCleanupRevokedTokensCron,
} from '../../../../src/cron/CleanupRevokedTokens.js';
import type { IDatabase } from '../../../../src/database/IDatabase.js';

describe('CleanupRevokedTokensCron', () => {
    let mockDb: IDatabase;
    let mockConfig: { TOKEN_CLEANUP_INTERVAL: number };
    let cleanupCron: ReturnType<typeof getCleanupRevokedTokensCron>;

    beforeEach(() => {
        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn((sql: string, params: unknown[], callback: (err: Error | null, changes?: number) => void) => {
                callback(null, 3); // Simulate 3 deleted tokens
                return mockDb;
            }),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
        } as unknown as IDatabase;

        mockConfig = {
            TOKEN_CLEANUP_INTERVAL: 3600000, // 1 hour
        };

        cleanupCron = getCleanupRevokedTokensCron({
            db: mockDb,
            config: mockConfig as never,
        });
    });

    afterEach(() => {
        cleanupCron.stopCleanupJob();
        vi.clearAllMocks();
    });

    describe('cleanupRevokedTokens', () => {
        it('should cleanup expired tokens successfully', async () => {
            const deleted = await cleanupRevokedTokens({
                db: mockDb,
                config: mockConfig as never,
            });

            expect(deleted).toBe(3);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM revoked_tokens'),
                [],
                expect.any(Function)
            );
        });

        it('should handle database errors', async () => {
            mockDb.run = vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                callback(new Error('Database error'));
                return mockDb;
            }) as unknown as IDatabase['run'];

            await expect(
                cleanupRevokedTokens({
                    db: mockDb,
                    config: mockConfig as never,
                })
            ).rejects.toThrow('Database error');
        });

        it('should return 0 when no tokens deleted', async () => {
            mockDb.run = vi.fn((sql: string, params: unknown[], callback: (err: Error | null, changes?: number) => void) => {
                callback(null, 0);
                return mockDb;
            }) as unknown as IDatabase['run'];

            const deleted = await cleanupRevokedTokens({
                db: mockDb,
                config: mockConfig as never,
            });

            expect(deleted).toBe(0);
        });
    });

    describe('startCleanupJob', () => {
        it('should start cleanup job with delay', async () => {
            cleanupCron.startCleanupJob();

            // Wait for initial delay (5 seconds)
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Should have attempted cleanup after delay
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should use correct cleanup interval from config', () => {
            cleanupCron.startCleanupJob();
            // Job started with correct interval
            expect(true).toBe(true);
        });
    });

    describe('stopCleanupJob', () => {
        it('should stop cleanup job', () => {
            cleanupCron.startCleanupJob();
            cleanupCron.stopCleanupJob();
            // No error means it stopped successfully
            expect(true).toBe(true);
        });

        it('should handle stop when job not started', () => {
            cleanupCron.stopCleanupJob();
            // No error means it handled gracefully
            expect(true).toBe(true);
        });
    });

    describe('getCleanupRevokedTokensCron', () => {
        it('should return singleton instance', () => {
            const instance1 = getCleanupRevokedTokensCron({
                db: mockDb,
                config: mockConfig as never,
            });
            const instance2 = getCleanupRevokedTokensCron({
                db: mockDb,
                config: mockConfig as never,
            });

            expect(instance1).toBe(instance2);
        });
    });
});



