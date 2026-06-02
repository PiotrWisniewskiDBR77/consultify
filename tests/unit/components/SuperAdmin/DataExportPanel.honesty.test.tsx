import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { DataExportPanel } from '@/components/SuperAdmin/data/DataExportPanel';

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getOrganizations: vi.fn().mockResolvedValue([{ id: 'org-1', name: 'Acme' }]),
  },
}));

describe('DataExportPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Acme' }]);
  });

  it('keeps export requests read-only until the audited bulk-export workflow is wired', async () => {
    render(<DataExportPanel />);

    await waitFor(() => {
      expect(screen.getByText('Data export workflow unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/audited bulk-export workflow/i)).toBeInTheDocument();
    expect(screen.queryByText('No export requests found')).not.toBeInTheDocument();

    const requestExport = screen.getByRole('button', { name: /Request Export/i });
    expect(requestExport).toBeDisabled();

    expect(Api.get).not.toHaveBeenCalledWith(expect.stringContaining('/data-export/requests'));
    expect(Api.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/data-export/requests'),
      expect.anything()
    );
    expect(Api.delete).not.toHaveBeenCalledWith(expect.stringContaining('/data-export/requests'));
  });
});
