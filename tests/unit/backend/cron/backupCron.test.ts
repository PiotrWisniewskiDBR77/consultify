/**
 * Backup Cron Job Tests
 * ETAP 6: Testy dla cron jobs (80%+ coverage)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Removed createRequire

describe('BackupCron', () => {
    let BackupCron;
    let mockBackupService;
    let mockCron;

    beforeEach(async () => { // Async beforeEach
        vi.resetModules();

        // Mock BackupService
        mockBackupService = {
            createBackup: vi.fn().mockResolvedValue({ id: 'backup-123' }),
            runRetentionPolicy: vi.fn().mockResolvedValue({ deleted: 5 })
        };

        vi.doMock('../../../../server/services/backupService', () => ({
            default: mockBackupService
        }));

        // Mock node-cron
        mockCron = {
            schedule: vi.fn().mockReturnValue({
                stop: vi.fn()
            })
        };

        vi.doMock('node-cron', () => ({
            default: mockCron
        }));

        // Mock Sentry
        vi.doMock('../../../../server/config/sentry', () => ({
            captureException: vi.fn()
        }));

        // Dynamic import
        const module = await import('../../../../server/cron/backupCron.ts');
        BackupCron = module.default;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../../server/services/backupService');
        vi.doUnmock('node-cron');
        vi.doUnmock('../../../../server/config/sentry');
    });

    describe('startBackupJob', () => {
        it('should schedule backup job when not disabled', () => {
            delete process.env.DISABLE_BACKUP_CRON;

            BackupCron.startBackupJob();

            expect(mockCron.schedule).toHaveBeenCalledWith(
                '*/15 * * * *',
                expect.any(Function),
                { timezone: 'UTC' }
            );
        });

        it('should not schedule job when DISABLE_BACKUP_CRON is true', () => {
            process.env.DISABLE_BACKUP_CRON = 'true';

            BackupCron.startBackupJob();

            expect(mockCron.schedule).not.toHaveBeenCalled();

            delete process.env.DISABLE_BACKUP_CRON;
        });

        it('should create backup when scheduled job runs', async () => {
            delete process.env.DISABLE_BACKUP_CRON;

            BackupCron.startBackupJob();

            // Get the scheduled callback
            const scheduledCallback = mockCron.schedule.mock.calls[0][1];

            await scheduledCallback();

            expect(mockBackupService.createBackup).toHaveBeenCalledWith('incremental', 'scheduled-rpo-15m');
            expect(mockBackupService.runRetentionPolicy).toHaveBeenCalled();
        });

        it('should handle backup errors gracefully', async () => {
            delete process.env.DISABLE_BACKUP_CRON;
            mockBackupService.createBackup.mockRejectedValue(new Error('Backup failed'));

            BackupCron.startBackupJob();

            const scheduledCallback = mockCron.schedule.mock.calls[0][1];

            // Should not throw
            await expect(scheduledCallback()).resolves.not.toThrow();
        });
    });

    describe('stopBackupJob', () => {
        it('should stop scheduled job', () => {
            delete process.env.DISABLE_BACKUP_CRON;
            const mockJob = { stop: vi.fn() };
            mockCron.schedule.mockReturnValue(mockJob);

            BackupCron.startBackupJob();
            BackupCron.stopBackupJob();

            expect(mockJob.stop).toHaveBeenCalled();
        });

        it('should handle stop when no job is running', () => {
            // Should not throw
            expect(() => BackupCron.stopBackupJob()).not.toThrow();
        });
    });

    describe('triggerManualBackup', () => {
        it('should trigger manual backup', async () => {
            const result = await BackupCron.triggerManualBackup('test-reason');

            expect(mockBackupService.createBackup).toHaveBeenCalledWith('full', 'test-reason');
            expect(result.id).toBe('backup-123');
        });

        it('should use default reason when not provided', async () => {
            await BackupCron.triggerManualBackup();

            expect(mockBackupService.createBackup).toHaveBeenCalledWith('full', 'manual');
        });
    });
});









