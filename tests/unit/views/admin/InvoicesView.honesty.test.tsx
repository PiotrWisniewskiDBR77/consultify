import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InvoicesView } from '@/views/admin/InvoicesView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
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

describe('InvoicesView honest UI', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
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

  it('does not render failed billing invoice loads as empty invoice history or zero paid totals', async () => {
    render(<InvoicesView />);

    await waitFor(() => {
      expect(screen.getByText('Invoices unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Billing history unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No Invoices')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Paid (All Time)')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search invoices...')).toBeDisabled();
    screen.getAllByRole('combobox').forEach((combobox) => {
      expect(combobox).toBeDisabled();
    });
  });
});
