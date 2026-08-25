import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SuperAdminOrgDetailsModal } from '@/views/superadmin/SuperAdminOrgDetailsModal';

vi.mock('@/services/api', () => ({
  Api: {
    getOrganizationBillingDetails: vi.fn(),
    getOrganizations: vi.fn(),
    updateOrganization: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const baseOrg = {
  id: 'org-1',
  name: 'Acme',
  plan: 'free',
  status: 'active',
  user_count: 3,
  discount_percent: 0,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('SuperAdminOrgDetailsModal honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not claim general info save success when read-back is stale', async () => {
    const onUpdate = vi.fn();
    vi.mocked(Api.updateOrganization).mockResolvedValue({ success: true });
    vi.mocked(Api.getOrganizations).mockResolvedValue([baseOrg]);

    render(<SuperAdminOrgDetailsModal org={baseOrg} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Organization update was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not render billing load failures as no billing details', async () => {
    vi.mocked(Api.getOrganizationBillingDetails).mockRejectedValue(new Error('Billing API down'));

    render(<SuperAdminOrgDetailsModal org={baseOrg} onClose={vi.fn()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Billing & Settlement/i }));

    await waitFor(() => {
      expect(screen.getByText('Billing details unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Billing API down')).toBeInTheDocument();
    expect(screen.queryByText('No billing details available.')).not.toBeInTheDocument();
  });

  it('renders invalid organization creation dates as Unknown date', () => {
    render(
      <SuperAdminOrgDetailsModal
        org={{ ...baseOrg, created_at: 'not-a-date' }}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Unknown date')).toBeInTheDocument();
  });

  it('does not render invalid billing numbers as NaN or Infinity', async () => {
    vi.mocked(Api.getOrganizationBillingDetails).mockResolvedValue({
      billing: {
        plan_name: 'Free',
        status: 'active',
        price_monthly: 'bad-price',
        billing_email: 'billing@example.com',
        current_period_end: 'not-a-date',
      },
      usage: {
        tokens_used: 'bad-used',
        tokens_included: 'bad-limit',
        tokens_overage: 'bad-overage',
        overage_amount: 'bad-cost',
      },
      invoices: [
        {
          id: 'invoice-1',
          created_at: 'not-a-date',
          amount_due: 'bad-amount',
          status: 'open',
        },
      ],
    });

    render(<SuperAdminOrgDetailsModal org={baseOrg} onClose={vi.fn()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Billing & Settlement/i }));

    await waitFor(() => {
      expect(screen.getByText('Current Subscription')).toBeInTheDocument();
    });

    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
    expect(screen.getAllByText('$0.00').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText('Unknown date').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('accepts wrapped organization read-back after save', async () => {
    const onUpdate = vi.fn();
    vi.mocked(Api.updateOrganization).mockResolvedValue({ success: true });
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: {
        data: {
          organizations: [
            {
              ...baseOrg,
              discount_percent: 10,
            },
          ],
        },
      },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);

    render(<SuperAdminOrgDetailsModal org={baseOrg} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
    });
    expect(
      screen.queryByText('Organization update was not confirmed by the server')
    ).not.toBeInTheDocument();
  });

  it('does not claim general info save success when read-back payload is malformed', async () => {
    const onUpdate = vi.fn();
    vi.mocked(Api.updateOrganization).mockResolvedValue({ success: true });
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { unexpected: true } },
    } as unknown as Awaited<ReturnType<typeof Api.getOrganizations>>);

    render(<SuperAdminOrgDetailsModal org={baseOrg} onClose={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Organization update could not be confirmed by read-back')
      ).toBeInTheDocument();
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('accepts wrapped billing details payloads', async () => {
    vi.mocked(Api.getOrganizationBillingDetails).mockResolvedValue({
      data: {
        data: {
          billing: {
            plan_name: 'Pro',
            status: 'active',
            price_monthly: 99,
            billing_email: 'billing@example.com',
            current_period_end: 'not-a-date',
          },
          usage: {
            tokens_used: 5,
            tokens_included: 10,
            tokens_overage: 0,
            overage_amount: 0,
          },
          invoices: [],
        },
      },
    });

    render(<SuperAdminOrgDetailsModal org={baseOrg} onClose={vi.fn()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Billing & Settlement/i }));

    await waitFor(() => {
      expect(screen.getByText('Current Subscription')).toBeInTheDocument();
    });
    expect(screen.getByText('$99.00')).toBeInTheDocument();
    expect(screen.queryByText('Billing details unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed billing payloads as missing billing details', async () => {
    vi.mocked(Api.getOrganizationBillingDetails).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<SuperAdminOrgDetailsModal org={baseOrg} onClose={vi.fn()} onUpdate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Billing & Settlement/i }));

    await waitFor(() => {
      expect(screen.getByText('Billing details unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Billing details response was incomplete')).toBeInTheDocument();
    expect(screen.queryByText('No billing details available.')).not.toBeInTheDocument();
  });

  it('keeps the critical status confirmation button visibly disabled until a reason is typed', async () => {
    render(<SuperAdminOrgDetailsModal org={baseOrg} onClose={vi.fn()} onUpdate={vi.fn()} />);

    const [, statusSelect] = screen.getAllByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'blocked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    const confirmBtn = await screen.findByRole('button', { name: 'Confirm status change' });
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn.className).toMatch(/disabled:opacity-50/);

    fireEvent.change(screen.getByRole('textbox', { name: /Reason/i }), {
      target: { value: 'ab' },
    });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: /Reason/i }), {
      target: { value: 'Security incident' },
    });
    expect(confirmBtn).not.toBeDisabled();
  });
});
