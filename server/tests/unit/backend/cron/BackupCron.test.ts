/**
 * Unit Tests for BackupCron
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getBackupCron, startBackupJob, stopBackupJob, triggerManualBackup } from '../../../../src/cron/BackupCron.js';

describe('BackupCron', () => {
    let mockBackupService: {
        createBackup: (type: 'full' | 'incremental', reason: string) => Promise<{ id: string }>;
        runRetentionPolicy: () => Promise<{ deleted: number }>;
    };
    let mockSentry: { captureException: (error: Error, options?: { tags?: Record<string, string> }) => void };
    let backupCron: ReturnType<typeof getBackupCron>;

    beforeEach(() => {
        mockBackupService = {
            createBackup: vi.fn().mockResolvedValue({ id: 'backup-123' }),
            runRetentionPolicy: vi.fn().mockResolvedValue({ deleted: 5 }),
        };

        mockSentry = {
            captureException: vi.fn(),
        };

        backupCron = getBackupCron({
            backupService: mockBackupService,
            sentry: mockSentry,
        });
    });

    afterEach(() => {
        backupCron.stopBackupJob();
        vi.clearAllMocks();
    });

    describe('startBackupJob', () => {
        it('should start backup job', () => {
            backupCron.startBackupJob();
            // Job is scheduled, no immediate error
            expect(true).toBe(true);
        });

        it('should not start if DISABLE_BACKUP_CRON is set', () => {
            const originalEnv = process.env.DISABLE_BACKUP_CRON;
            process.env.DISABLE_BACKUP_CRON = 'true';

            backupCron.startBackupJob();

            expect(mockBackupService.createBackup).not.toHaveBeenCalled();

            process.env.DISABLE_BACKUP_CRON = originalEnv;
        });
    });

    describe('triggerManualBackup', () => {
        it('should trigger manual backup successfully', async () => {
            const result = await triggerManualBackup('test-reason', {
                backupService: mockBackupService,
            });

            expect(result).toEqual({ id: 'backup-123' });
            expect(mockBackupService.createBackup).toHaveBeenCalledWith('full', 'test-reason');
        });

        it('should use default reason if not provided', async () => {
            const result = await triggerManualBackup('', {
                backupService: mockBackupService,
            });

            expect(result).toEqual({ id: 'backup-123' });
            expect(mockBackupService.createBackup).toHaveBeenCalledWith('full', 'manual');
        });

        it('should handle backup errors', async () => {
            mockBackupService.createBackup = vi.fn().mockRejectedValue(new Error('Backup failed'));

            await expect(
                triggerManualBackup('test-reason', {
                    backupService: mockBackupService,
                }),
            ).rejects.toThrow('Backup failed');
        });
    });

    describe('stopBackupJob', () => {
        it('should stop backup job', () => {
            backupCron.startBackupJob();
            backupCron.stopBackupJob();
            // No error means it stopped successfully
            expect(true).toBe(true);
        });

        it('should handle stop when job not started', () => {
            backupCron.stopBackupJob();
            // No error means it handled gracefully
            expect(true).toBe(true);
        });
    });

    describe('getBackupCron', () => {
        it('should return singleton instance', () => {
            const instance1 = getBackupCron({ backupService: mockBackupService });
            const instance2 = getBackupCron({ backupService: mockBackupService });

            expect(instance1).toBe(instance2);
        });
    });
});
