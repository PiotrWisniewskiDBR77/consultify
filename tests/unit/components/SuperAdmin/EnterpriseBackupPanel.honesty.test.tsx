import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseBackupPanel } from '@/components/SuperAdmin/system/EnterpriseBackupPanel';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getBackups: vi.fn(),
    getBackupSchedules: vi.fn(),
    createBackup: vi.fn(),
    updateBackupSchedule: vi.fn(),
  },
}));

describe('EnterpriseBackupPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.getBackups).mockRejectedValue(new Error('Backup backend down'));
    vi.mocked(Api.getBackupSchedules).mockRejectedValue(new Error('Schedules backend down'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render backup and schedule load failures as zero backup stats or empty lists', async () => {
    render(<EnterpriseBackupPanel />);

    await waitFor(() => {
      expect(screen.getByText('Backup overview unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Backup service unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Total Backups')).not.toBeInTheDocument();
    expect(screen.queryByText('Storage Used')).not.toBeInTheDocument();
    expect(screen.queryByText('No backups available')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Backup/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Schedules/i }));

    await waitFor(() => {
      expect(screen.getByText('Backup schedules unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No backup schedules configured')).not.toBeInTheDocument();
  });

  it('marks backup settings as read-only until persistence is connected', async () => {
    vi.mocked(Api.getBackups).mockResolvedValue([]);
    vi.mocked(Api.getBackupSchedules).mockResolvedValue([]);

    render(<EnterpriseBackupPanel />);

    await waitFor(() => {
      expect(screen.getByText('No backups available')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

    expect(screen.getByText('Backup settings are read-only')).toBeInTheDocument();
    expect(screen.getByLabelText('Retention Days')).toBeDisabled();
    expect(screen.getByLabelText('Max Local Backups')).toBeDisabled();
    expect(screen.getByLabelText('Encrypt backups at rest')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save Settings/i })).toBeDisabled();
  });

  it('refetches backups after creating a backup and avoids invalid backup dates', async () => {
    vi.mocked(Api.getBackups)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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
          createdAt: 'not-a-date',
          expiresAt: 'not-a-date',
        },
      ]);
    vi.mocked(Api.getBackupSchedules).mockResolvedValue([]);
    vi.mocked(Api.createBackup).mockResolvedValue({ id: 'backup-1' });

    render(<EnterpriseBackupPanel />);

    await waitFor(() => {
      expect(screen.getByText('No backups available')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Backup/i }));
    fireEvent.click(screen.getByRole('button', { name: /Full Backup/i }));

    await waitFor(() => {
      expect(Api.createBackup).toHaveBeenCalledWith('full', 'manual');
      expect(screen.getByText('full-backup.tar.gz')).toBeInTheDocument();
    });
    expect(Api.getBackups).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText(/Unknown date/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('keeps create modal open when backup creation read-back is stale', async () => {
    vi.mocked(Api.getBackups).mockResolvedValue([]);
    vi.mocked(Api.getBackupSchedules).mockResolvedValue([]);
    vi.mocked(Api.createBackup).mockResolvedValue({ id: 'backup-1' });

    render(<EnterpriseBackupPanel />);

    await screen.findByText('No backups available');
    fireEvent.click(screen.getByRole('button', { name: /Create Backup/i }));
    fireEvent.click(screen.getByRole('button', { name: /Full Backup/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Backup creation was not confirmed by the server'
      );
    });
    expect(screen.getByText('Select backup type:')).toBeInTheDocument();
  });

  it('keeps create modal open when backup creation response does not include an id', async () => {
    vi.mocked(Api.getBackups).mockResolvedValue([]);
    vi.mocked(Api.getBackupSchedules).mockResolvedValue([]);
    vi.mocked(Api.createBackup).mockResolvedValue({ success: true });

    render(<EnterpriseBackupPanel />);

    await screen.findByText('No backups available');
    fireEvent.click(screen.getByRole('button', { name: /Create Backup/i }));
    fireEvent.click(screen.getByRole('button', { name: /Full Backup/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Backup creation response was incomplete'
      );
    });
    expect(screen.getByText('Select backup type:')).toBeInTheDocument();
  });

  it('refetches schedules after toggling schedule enabled state', async () => {
    vi.mocked(Api.getBackups).mockResolvedValue([]);
    vi.mocked(Api.getBackupSchedules)
      .mockResolvedValueOnce([
        {
          id: 'schedule-1',
          name: 'System Backup',
          type: 'full',
          frequency: 'daily',
          time: '02:00',
          retention_days: 30,
          enabled: true,
          next_run: 'not-a-date',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'schedule-1',
          name: 'System Backup',
          type: 'full',
          frequency: 'daily',
          time: '02:00',
          retention_days: 30,
          enabled: false,
          next_run: null,
        },
      ]);
    vi.mocked(Api.updateBackupSchedule).mockResolvedValue({ success: true });

    render(<EnterpriseBackupPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /Schedules/i }));
    await waitFor(() => {
      expect(screen.getByText('System Backup')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enabled/i }));

    await waitFor(() => {
      expect(Api.updateBackupSchedule).toHaveBeenCalledWith('schedule-1', { enabled: false });
      expect(screen.getByRole('button', { name: /Disabled/i })).toBeInTheDocument();
    });
    expect(Api.getBackupSchedules).toHaveBeenCalledTimes(2);
    expect(
      screen.getByTitle('Schedule editing requires an audited schedule editor workflow.')
    ).toBeDisabled();
  });

  it('does not toggle schedule state when read-back remains stale', async () => {
    vi.mocked(Api.getBackups).mockResolvedValue([]);
    vi.mocked(Api.getBackupSchedules).mockResolvedValue([
      {
        id: 'schedule-1',
        name: 'System Backup',
        type: 'full',
        frequency: 'daily',
        time: '02:00',
        retention_days: 30,
        enabled: true,
        next_run: '2026-04-27T02:00:00.000Z',
      },
    ]);
    vi.mocked(Api.updateBackupSchedule).mockResolvedValue({ success: true });

    render(<EnterpriseBackupPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /Schedules/i }));
    await screen.findByText('System Backup');
    fireEvent.click(screen.getByRole('button', { name: /Enabled/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Backup schedule update was not confirmed by the server'
      );
    });
    expect(screen.getByRole('button', { name: /Enabled/i })).toBeInTheDocument();
  });

  it('does not render invalid backup size, type, or status as NaN or crash', async () => {
    vi.mocked(Api.getBackups).mockResolvedValue([
      {
        id: 'backup-1',
        type: 'unexpected',
        reason: 'manual',
        filename: 'invalid-backup.tar.gz',
        path: '/backups/invalid-backup.tar.gz',
        sizeBytes: 'bad-size',
        sizeMB: 'bad-size',
        encrypted: true,
        hasS3: false,
        status: 'unexpected',
        createdAt: '2026-04-26T10:00:00.000Z',
        expiresAt: 'not-a-date',
      },
    ]);
    vi.mocked(Api.getBackupSchedules).mockResolvedValue([]);

    render(<EnterpriseBackupPanel />);

    await screen.findByText('invalid-backup.tar.gz');

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('unknown')).toBeInTheDocument();
    expect(screen.getAllByText('0 Bytes').length).toBeGreaterThan(0);
    expect(screen.queryByText(/NaN|undefined|bad-size/i)).not.toBeInTheDocument();
  });

  it('accepts wrapped backup and schedule list payloads', async () => {
    vi.mocked(Api.getBackups).mockResolvedValue({
      backups: [
        {
          id: 'backup-1',
          type: 'full',
          reason: 'manual',
          filename: 'wrapped-backup.tar.gz',
          path: '/backups/wrapped-backup.tar.gz',
          sizeBytes: 2048,
          sizeMB: '2',
          encrypted: true,
          hasS3: true,
          status: 'completed',
          createdAt: '2026-04-26T10:00:00.000Z',
          expiresAt: '2026-05-26T10:00:00.000Z',
        },
      ],
    });
    vi.mocked(Api.getBackupSchedules).mockResolvedValue({
      schedules: [
        {
          id: 'schedule-1',
          name: 'Wrapped Schedule',
          type: 'full',
          frequency: 'daily',
          time: '02:00',
          retention_days: 30,
          enabled: true,
        },
      ],
    });

    render(<EnterpriseBackupPanel />);

    expect(await screen.findByText('wrapped-backup.tar.gz')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Schedules/i }));
    expect(await screen.findByText('Wrapped Schedule')).toBeInTheDocument();
  });
});
