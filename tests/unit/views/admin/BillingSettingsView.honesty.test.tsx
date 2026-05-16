import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingSettingsView } from '@/views/admin/BillingSettingsView';

vi.mock('@/components/Admin/PartnerCodeInput', () => ({
  PartnerCodeInput: () => <div>Partner code input</div>,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('BillingSettingsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not render failed billing settings loads as editable fallback settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    render(<BillingSettingsView />);

    await waitFor(() => {
      expect(screen.getByText('Billing settings unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Tax settings unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Company Information')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Export Data/i }));
    expect(screen.getByText('Billing export unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export Invoices/i })).not.toBeInTheDocument();
  });

  it('keeps local-only billing contact edits read-only when settings load successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          taxSettings: { billing_name: 'Acme Inc.' },
          notifications: {
            invoice_email: true,
            payment_success: true,
            payment_failed: true,
            usage_warning: true,
            renewal_reminder: true,
            reminder_days_before: 7,
          },
          contacts: [],
        }),
      })
    );

    render(<BillingSettingsView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme Inc.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));

    expect(screen.getByText('Billing contacts are read-only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Contact/i })).toBeDisabled();
  });
});
