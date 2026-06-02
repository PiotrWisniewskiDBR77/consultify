import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { InvoiceCenterView } from '@/views/superadmin/InvoiceCenterView';

vi.mock('@/components/billing', () => ({
  CreditNotesPanel: () => <div>Credit notes</div>,
  InvoiceTemplateEditor: () => <div>Invoice templates</div>,
  TaxSettingsPanel: () => <div>Tax settings</div>,
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getSuperAdminInvoices: vi.fn(),
    getSuperAdminInvoiceStats: vi.fn(),
    getUsagePricingTiers: vi.fn(),
    post: vi.fn(),
  },
}));

describe('InvoiceCenterView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.getSuperAdminInvoices).mockRejectedValue(new Error('Invoice backend down'));
    vi.mocked(Api.getSuperAdminInvoiceStats).mockRejectedValue(new Error('Stats backend down'));
    vi.mocked(Api.getUsagePricingTiers).mockRejectedValue(new Error('Tiers backend down'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render failed invoice loads as zero stats or an empty invoice list', async () => {
    render(<InvoiceCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Invoice overview unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Invoices unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('No invoices found')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search invoices...')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Create Invoice/i })).toBeDisabled();
  });

  it('does not render failed usage tier loads as no pricing tiers configured', async () => {
    render(<InvoiceCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Invoice overview unavailable')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Usage Billing/i }));

    await waitFor(() => {
      expect(screen.getByText('Usage pricing tiers unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No pricing tiers configured')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Tier/i })).toBeDisabled();
  });
});
