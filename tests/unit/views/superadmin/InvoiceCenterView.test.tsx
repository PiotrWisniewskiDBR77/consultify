import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { InvoiceCenterView } from '@/views/superadmin/InvoiceCenterView';

vi.mock('@/services/api', () => ({
  Api: {
    getSuperAdminInvoices: vi.fn().mockResolvedValue({ invoices: [] }),
    getSuperAdminInvoiceStats: vi.fn().mockResolvedValue({}),
    getUsagePricingTiers: vi.fn().mockResolvedValue({ tiers: [] }),
  },
}));

vi.mock('@/components/billing', () => ({
  CreditNotesPanel: () => <div>Credit notes</div>,
  InvoiceTemplateEditor: () => <div>Invoice templates</div>,
  TaxSettingsPanel: () => <div>Tax settings</div>,
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

describe('InvoiceCenterView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the selected invoice period using the API filter contract', async () => {
    render(<InvoiceCenterView />);

    await waitFor(() => {
      expect(Api.getSuperAdminInvoices).toHaveBeenCalledWith({ period: '30d' });
    });
  });
});
