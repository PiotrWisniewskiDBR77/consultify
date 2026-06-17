import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DataControlsSettings } from '@/components/settings/DataControlsSettings';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    getGdprConsents: vi.fn(),
    getGdprRetention: vi.fn(),
    requestGdprDeletion: vi.fn(),
    requestGdprExport: vi.fn(),
    saveGdprConsents: vi.fn(),
    saveGdprRetention: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const consents = {
  analytics: true,
  personalization: true,
  marketing: false,
  thirdPartySharing: false,
  aiTraining: true,
};

const retention = {
  period: '365',
  autoDelete: false,
};

const renderSettings = () =>
  render(
    <MemoryRouter>
      <DataControlsSettings currentUser={{ id: 'user-1', email: 'user@example.com' } as any} />
    </MemoryRouter>
  );

describe('DataControlsSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed data-control loads as editable defaults', async () => {
    vi.mocked(Api.getGdprConsents).mockRejectedValue(new Error('GDPR API down'));
    vi.mocked(Api.getGdprRetention).mockResolvedValue({ retention });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Data controls unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('GDPR API down')).toBeInTheDocument();
    expect(screen.queryByText('Consent Management')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale consents', async () => {
    vi.mocked(Api.getGdprConsents)
      .mockResolvedValueOnce({ consents })
      .mockResolvedValueOnce({ consents });
    vi.mocked(Api.getGdprRetention).mockResolvedValue({ retention });
    vi.mocked(Api.saveGdprConsents).mockResolvedValue({ success: true });
    vi.mocked(Api.saveGdprRetention).mockResolvedValue({ success: true });

    renderSettings();

    await screen.findByText('Consent Management');
    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Data controls save was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
