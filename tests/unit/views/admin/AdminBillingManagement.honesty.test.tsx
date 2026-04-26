import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AdminBillingManagement } from '@/views/admin/AdminBillingManagement';

vi.mock('@/services/api', () => ({
  Api: {
    getCurrentBilling: vi.fn(),
    getSeatConfiguration: vi.fn(),
    getUsage: vi.fn(),
    getInvoices: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
    currentUser: { id: 'user-1', email: 'owner@example.com', firstName: 'Owner', lastName: 'User' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('AdminBillingManagement honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getCurrentBilling).mockRejectedValue(new Error('Billing down'));
    vi.mocked(Api.getSeatConfiguration).mockRejectedValue(new Error('Seats down'));
    vi.mocked(Api.getUsage).mockRejectedValue(new Error('Usage down'));
    vi.mocked(Api.getInvoices).mockRejectedValue(new Error('Invoices down'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not render failed billing hub loads as default plan, zero usage, or no invoices', async () => {
    render(<AdminBillingManagement />);

    await waitFor(() => {
      expect(screen.getByText('Billing summary unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Usage unavailable')).toBeInTheDocument();
    expect(screen.getByText('Invoices unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Professional')).not.toBeInTheDocument();
    expect(screen.queryByText('No invoices found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add-ons/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Change Plan/i })).toBeDisabled();
  });
});
