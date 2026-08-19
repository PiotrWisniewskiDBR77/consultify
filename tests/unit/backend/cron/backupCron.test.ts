import { beforeEach, describe, expect, it, vi } from 'vitest';
import BackupCron from '../../../../server/src/cron/BackupCron.js';

const makeDeps = () => {
  const backupService = {
    claimBackupRun: vi.fn().mockResolvedValue({ claimed: true, receiptId: 'receipt-1', leaseToken: 'lease-1', fence: 1 }),
    finishBackupRun: vi.fn().mockResolvedValue({ status: 'COMPLETED', rpoSeconds: 10 }),
    createBackup: vi.fn().mockResolvedValue({ id: 'backup-1' }),
    runRetentionPolicy: vi.fn().mockResolvedValue({ deleted: 0 }),
    reconcileUnboundBackup: vi.fn().mockResolvedValue(undefined),
    getBackupStatus: vi.fn(),
  };
  return { backupService, sentry: { captureException: vi.fn() } };
};

describe('DATA-DR BackupCron tick coordinator', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('claims and completes one durable scheduled slot', async () => {
    const deps = makeDeps();
    const coordinator = new BackupCron(deps as any);
    await expect(coordinator.runBackupTick({ scheduleName: 'internal-beta-15m', scheduledFor: '2026-08-19T12:00:00.000Z' }))
      .resolves.toMatchObject({ claimed: true, backupId: 'backup-1' });
    expect(deps.backupService.createBackup).toHaveBeenCalledWith('full', 'scheduled-rpo-15m', { actorId: 'backup-cron', organizationId: undefined, tables: undefined });
    expect(deps.backupService.finishBackupRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED', backupId: 'backup-1' }));
  });

  it('replays an occupied schedule slot without a second artifact', async () => {
    const deps = makeDeps();
    deps.backupService.claimBackupRun.mockResolvedValue({ claimed: false } as any);
    const coordinator = new BackupCron(deps as any);
    await expect(coordinator.runBackupTick({ scheduleName: 'internal-beta-15m', scheduledFor: '2026-08-19T12:00:00.000Z' }))
      .resolves.toEqual({ claimed: false });
    expect(deps.backupService.createBackup).not.toHaveBeenCalled();
  });

  it('single-flights concurrent ticks before a second durable claim', async () => {
    const deps = makeDeps();
    let release!: () => void;
    deps.backupService.createBackup.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ id: 'backup-1' }); }));
    const coordinator = new BackupCron(deps as any);
    const first = coordinator.runBackupTick({ scheduleName: 'internal-beta-15m', scheduledFor: '2026-08-19T12:00:00.000Z' });
    await vi.waitFor(() => expect(coordinator.getMetrics().running).toBe(true));
    await expect(coordinator.runBackupTick({ scheduleName: 'internal-beta-15m', scheduledFor: '2026-08-19T12:15:00.000Z' }))
      .resolves.toEqual({ claimed: false });
    expect(deps.backupService.claimBackupRun).toHaveBeenCalledTimes(2);
    expect(deps.backupService.finishBackupRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'FAILED', error: 'BACKUP_SKIPPED_OVERLAP' }));
    release();
    await first;
  });

  it('persists FAILED and releases idle waiters', async () => {
    const deps = makeDeps();
    deps.backupService.createBackup.mockRejectedValue(new Error('missing key'));
    const coordinator = new BackupCron(deps as any);
    await expect(coordinator.runBackupTick({ scheduleName: 'internal-beta-15m', scheduledFor: '2026-08-19T12:00:00.000Z' }))
      .resolves.toEqual({ claimed: true });
    expect(deps.backupService.finishBackupRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'FAILED', error: 'missing key' }));
    await expect(coordinator.waitForIdle()).resolves.toBeUndefined();
  });

  it('reconciles a created artifact when the terminal receipt fence is lost', async () => {
    const deps = makeDeps();
    deps.backupService.finishBackupRun.mockRejectedValueOnce(new Error('BACKUP_RUN_FENCE_LOST'));
    const coordinator = new BackupCron(deps as any);
    await expect(coordinator.runBackupTick({ scheduleName: 'internal-beta-15m', scheduledFor: '2026-08-19T12:00:00.000Z' }))
      .resolves.toEqual({ claimed: true });
    expect(deps.backupService.reconcileUnboundBackup).toHaveBeenCalledWith('backup-1', 'BACKUP_RUN_FENCE_LOST');
  });

  it('routes manual backup through the same durable coordinator', async () => {
    const deps = makeDeps();
    const coordinator = new BackupCron(deps as any);
    await expect(coordinator.triggerManualBackup('operator')).resolves.toEqual({ id: 'backup-1' });
    expect(deps.backupService.claimBackupRun).toHaveBeenCalledWith(expect.objectContaining({ scheduleName: 'manual' }));
    expect(deps.backupService.createBackup).toHaveBeenCalledWith('full', 'operator', { actorId: 'manual-backup', organizationId: undefined, tables: undefined });
  });

  it('preserves tenant scope and actor through the shared manual coordinator', async () => {
    const deps = makeDeps();
    const coordinator = new BackupCron(deps as any);
    await coordinator.triggerManualBackup('tenant-export', {
      type: 'full',
      organizationId: 'org-a',
      actorId: 'admin-a',
    });
    expect(deps.backupService.createBackup).toHaveBeenCalledWith('full', 'tenant-export', {
      actorId: 'admin-a',
      organizationId: 'org-a',
      tables: undefined,
    });
  });
});
