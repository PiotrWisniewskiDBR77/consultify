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
});
