import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
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

  it('does not claim billing info success when ownership read-back is stale', async () => {
    vi.mocked(Api.getCurrentBilling).mockResolvedValue({
      plan: { name: 'Team', price_monthly: 99 },
      status: 'active',
      current_period_end: '2026-05-01T00:00:00Z',
    });
    vi.mocked(Api.getSeatConfiguration).mockResolvedValue({
      seats_used: 3,
      total_seats_available: 10,
    });
    vi.mocked(Api.getUsage).mockResolvedValue({
      structuredUsage: {
        tokens: { used: 10, limit: 100 },
        storage: { used_gb: 1, limit_gb: 10 },
      },
    });
    vi.mocked(Api.getInvoices).mockResolvedValue([]);

    const staleOwnership = {
      billingName: 'Old Billing',
      billingEmail: 'old@example.com',
      taxId: 'OLD-TAX',
      vatNumber: 'OLD-VAT',
      billingAddress: {
        line1: 'Old Street',
        city: 'Old City',
        postalCode: '00-000',
        country: 'PL',
      },
    };
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/organizations/org-1/billing-info' && options?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      if (url === '/api/organizations/org-1/ownership') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ownership: staleOwnership }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminBillingManagement />);

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Edit$/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Acme Corp'), {
      target: { value: 'New Billing' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Billing information update was not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Edit Billing Information')).toBeInTheDocument();
  });
});
