import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APIManagementView } from '@/views/superadmin/APIManagementView';
import { Api } from '@/services/api';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getOrganizations: vi.fn().mockResolvedValue([{ id: 'org-1', name: 'Acme' }]),
  },
}));

describe('APIManagementView webhooks honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue({ keys: [] });
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Acme' }]);
  });

  it('keeps webhooks read-only until the superadmin webhook workflow is reconciled', async () => {
    render(<APIManagementView />);

    await waitFor(() => {
      expect(screen.getByText('API Management')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Webhooks/i }));

    expect(screen.getByText('Webhook management unavailable')).toBeInTheDocument();
    expect(screen.getByText(/routes are reconciled/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Webhook/i })).toBeDisabled();
    expect(screen.queryByText('Create Webhook')).not.toBeInTheDocument();
    expect(screen.queryByText('No webhooks configured')).not.toBeInTheDocument();
    expect(Api.post).not.toHaveBeenCalledWith(expect.stringContaining('/webhooks'), expect.anything());
    expect(Api.delete).not.toHaveBeenCalledWith(expect.stringContaining('/webhooks'));
  });
});
