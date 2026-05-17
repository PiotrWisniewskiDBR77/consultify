import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import ContractManagementView from '@/views/superadmin/customers/ContractManagementView';

vi.mock('@/services/api', () => ({
  default: {
    createCustomerContract: vi.fn(),
    deleteCustomerContract: vi.fn(),
    getContractStats: vi.fn(),
    getCustomerContracts: vi.fn(),
    getUpcomingRenewals: vi.fn(),
    updateCustomerContract: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title, description }: { title: string; description: string }) => (
    <div role="alert">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => <span data-testid="info-button" />,
}));

const stats = {
  active_contracts: 0,
  renewals_30d: 0,
  total_contracts: 0,
  total_value: 0,
};

describe('ContractManagementView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed contract loads as an empty contract list', async () => {
    vi.mocked(Api.getCustomerContracts).mockRejectedValue(new Error('Contracts API down'));
    vi.mocked(Api.getContractStats).mockResolvedValue(stats);
    vi.mocked(Api.getUpcomingRenewals).mockResolvedValue([]);

    const { container } = render(<ContractManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Contract management unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Contracts API down')).toBeInTheDocument();
    expect(screen.queryByText('No contracts found')).not.toBeInTheDocument();
  });

  it('does not claim contract creation success when read-back is stale', async () => {
    vi.mocked(Api.getCustomerContracts).mockResolvedValue([]);
    vi.mocked(Api.getContractStats).mockResolvedValue(stats);
    vi.mocked(Api.getUpcomingRenewals).mockResolvedValue([]);
    vi.mocked(Api.createCustomerContract).mockResolvedValue({ success: true });

    const { container } = render(<ContractManagementView />);

    await screen.findByText('No contracts found');
    fireEvent.click(screen.getByRole('button', { name: /New Contract/i }));
    fireEvent.change(screen.getByPlaceholderText('Enter organization ID'), {
      target: { value: 'org-1' },
    });
    const startDateInput = container.querySelector('input[type="date"]');
    expect(startDateInput).not.toBeNull();
    fireEvent.change(startDateInput as HTMLInputElement, {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '100' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Contract/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Contract creation was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('uses safe contract dates', async () => {
    vi.mocked(Api.getCustomerContracts).mockResolvedValue([
      {
        id: 'contract-1',
        organization_id: 'org-1',
        organization_name: 'Org One',
        contract_type: 'subscription',
        start_date: 'not-a-date',
        value: 100,
        currency: 'USD',
        status: 'active',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]);
    vi.mocked(Api.getContractStats).mockResolvedValue({ ...stats, total_contracts: 1 });
    vi.mocked(Api.getUpcomingRenewals).mockResolvedValue([]);

    render(<ContractManagementView />);

    expect(await screen.findByText(/Unknown date/i)).toBeInTheDocument();
  });

  it('accepts wrapped contract, stats, renewal, and nested create payloads', async () => {
    const contract = {
      id: 'contract-1',
      organization_id: 'org-1',
      organization_name: 'Org One',
      contract_type: 'subscription',
      start_date: 'not-a-date',
      value: 'bad-value',
      currency: 'USD',
      status: 'active',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    const createdContract = {
      ...contract,
      id: 'contract-2',
      value: 100,
      start_date: '2026-01-01',
    };
    vi.mocked(Api.getCustomerContracts)
      .mockResolvedValueOnce({ data: { data: { contracts: [contract] } } })
      .mockResolvedValueOnce({ data: { data: { contracts: [contract, createdContract] } } });
    vi.mocked(Api.getContractStats).mockResolvedValue({
      data: {
        data: {
          active_contracts: 1,
          renewals_30d: 'bad-renewals',
          total_contracts: 1,
          total_value: 'bad-total',
        },
      },
    });
    vi.mocked(Api.getUpcomingRenewals).mockResolvedValue({
      data: {
        data: {
          renewals: [
            {
              id: 'renewal-1',
              organization_name: 'Org One',
              renewal_date: 'not-a-date',
              value: 'bad-renewal-value',
              days_until: 'bad-days',
            },
          ],
        },
      },
    });
    vi.mocked(Api.createCustomerContract).mockResolvedValue({
      data: { data: { contract: { id: 'contract-2' } } },
    });

    const { container } = render(<ContractManagementView />);

    expect((await screen.findAllByText('Org One')).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('bad-');

    fireEvent.click(screen.getByRole('button', { name: /New Contract/i }));
    fireEvent.change(screen.getByPlaceholderText('Enter organization ID'), {
      target: { value: 'org-1' },
    });
    const startDateInput = container.querySelector('input[type="date"]');
    expect(startDateInput).not.toBeNull();
    fireEvent.change(startDateInput as HTMLInputElement, {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '100' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Contract/i }));

    await waitFor(() => {
      expect(screen.queryByText('Create Contract')).not.toBeInTheDocument();
    });
    expect(Api.createCustomerContract).toHaveBeenCalledTimes(1);
  });

  it('does not claim delete success when contract read-back is unavailable', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(Api.getCustomerContracts)
      .mockResolvedValueOnce([
        {
          id: 'contract-1',
          organization_id: 'org-1',
          organization_name: 'Org One',
          contract_type: 'subscription',
          start_date: '2026-01-01',
          value: 100,
          currency: 'USD',
          status: 'active',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ])
      .mockRejectedValueOnce(new Error('Contracts refresh down'));
    vi.mocked(Api.getContractStats).mockResolvedValue({ ...stats, total_contracts: 1 });
    vi.mocked(Api.getUpcomingRenewals).mockResolvedValue([]);
    vi.mocked(Api.deleteCustomerContract).mockResolvedValue({ success: true });

    render(<ContractManagementView />);

    fireEvent.click(await screen.findByText('Org One'));
    fireEvent.click(screen.getByRole('button', { name: /Delete customer contract contract-1/i }));

    await waitFor(() => {
      expect(screen.getByText('Contracts refresh down')).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('does not render malformed contract payloads as an empty contract list', async () => {
    vi.mocked(Api.getCustomerContracts).mockResolvedValue({ unexpected: true });
    vi.mocked(Api.getContractStats).mockResolvedValue(stats);
    vi.mocked(Api.getUpcomingRenewals).mockResolvedValue([]);

    render(<ContractManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Contract management unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Contract response was missing list data')).toBeInTheDocument();
    expect(screen.queryByText('No contracts found')).not.toBeInTheDocument();
  });
});
