import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IntegrationsManagementPanel } from '@/components/Admin/IntegrationsManagementPanel';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    promise: vi.fn(),
    success: vi.fn(),
  },
}));

describe('IntegrationsManagementPanel honest UI', () => {
  it('disables webhook mutations instead of creating local-only records', async () => {
    render(<IntegrationsManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Integrations are read-only')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /Add Webhook/i });
    addButtons.forEach((button) => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute(
        'title',
        expect.stringContaining('tenant admin webhook routes persist data')
      );
    });

    fireEvent.click(addButtons[0]);
    expect(screen.queryByText('Create Webhook')).not.toBeInTheDocument();
  });

  it('disables integration connect actions until OAuth status is backend-backed', async () => {
    render(<IntegrationsManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Integrations are read-only')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Connected Apps/i }));

    const connectButtons = screen.getAllByTitle(/OAuth\/provider status is wired/i);
    expect(connectButtons.length).toBeGreaterThan(0);
    connectButtons.forEach((button) => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute(
        'title',
        expect.stringContaining('OAuth/provider status is wired')
      );
    });
  });
});
