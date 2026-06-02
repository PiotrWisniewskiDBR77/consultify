import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { BackupConfigPanel } from '@/components/SuperAdmin/data/BackupConfigPanel';

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    getOrganizations: vi.fn().mockResolvedValue([{ id: 'org-1', name: 'Acme' }]),
  },
}));

describe('BackupConfigPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Acme' }]);
  });

  it('keeps legacy data-export backup configuration read-only', async () => {
    render(<BackupConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText('Backup configuration workflow unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/audited SuperAdmin backup schedule workflow/i)).toBeInTheDocument();
    expect(screen.queryByText('Backup Configuration')).not.toBeInTheDocument();
    expect(screen.queryByText('No backup history available')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Run Backup Now/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeDisabled();

    expect(Api.get).not.toHaveBeenCalledWith(expect.stringContaining('/data-export/backup-config'));
    expect(Api.get).not.toHaveBeenCalledWith(expect.stringContaining('/data-export/backup-history'));
    expect(Api.put).not.toHaveBeenCalledWith(
      expect.stringContaining('/data-export/backup-config'),
      expect.anything()
    );
    expect(Api.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/data-export/backup-config/trigger'),
      expect.anything()
    );
  });
});
