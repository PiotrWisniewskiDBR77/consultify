import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseBackupPanel } from '@/components/SuperAdmin/system/EnterpriseBackupPanel';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getBackups: vi.fn().mockRejectedValue(new Error('Backup service not configured')),
    getBackupSchedules: vi.fn().mockResolvedValue([]),
    restoreBackup: vi.fn(),
    deleteBackup: vi.fn(),
  },
}));

describe('EnterpriseBackupPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getBackups).mockRejectedValue(new Error('Backup service not configured'));
    vi.mocked(Api.getBackupSchedules).mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a degraded state and disables backup creation when backups cannot load', async () => {
    render(<EnterpriseBackupPanel />);

    await waitFor(() => {
      expect(screen.getByText('Backup service unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Backup service not configured').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Create Backup/i })).toBeDisabled();
    expect(Api.getBackups).toHaveBeenCalled();
  });

  it('keeps restore, download, and delete disabled until destructive workflows are wired', async () => {
    vi.mocked(Api.getBackups).mockResolvedValue([
      {
        id: 'backup-1',
        type: 'full',
        reason: 'manual',
        filename: 'full-backup.tar.gz',
        path: '/backups/full-backup.tar.gz',
        sizeBytes: 1024,
        sizeMB: '1',
        encrypted: true,
        hasS3: false,
        status: 'completed',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
    ]);

    render(<EnterpriseBackupPanel />);

    await waitFor(() => {
      expect(screen.getByText('full-backup.tar.gz')).toBeInTheDocument();
    });

    const disabledActions = screen.getAllByTitle(/confirmation, audit and recovery/i);
    expect(disabledActions).toHaveLength(3);
    disabledActions.forEach((action) => {
      expect(action).toBeDisabled();
    });
    expect(Api.restoreBackup).not.toHaveBeenCalled();
    expect(Api.deleteBackup).not.toHaveBeenCalled();
  });

  it('marks disaster recovery testing as read-only instead of showing fake pass metrics', async () => {
    render(<EnterpriseBackupPanel />);

    fireEvent.click(screen.getByRole('button', { name: /DR Testing/i }));

    await waitFor(() => {
      expect(screen.getByText('Disaster recovery workflow unavailable')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Start DR Test/i })).toBeDisabled();
    expect(screen.queryByText('Passed')).not.toBeInTheDocument();
    expect(screen.queryByText('4m 32s')).not.toBeInTheDocument();
  });
});
