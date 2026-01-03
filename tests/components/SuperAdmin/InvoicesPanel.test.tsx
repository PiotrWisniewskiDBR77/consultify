/**
 * InvoicesPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvoicesPanel } from '../../../components/SuperAdmin/billing/InvoicesPanel';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        getOrganizations: vi.fn(),
    },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('InvoicesPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
        { id: 'org-2', name: 'Another Org' },
    ];

    const mockInvoices = [
        {
            id: 'inv-1',
            organization_id: 'org-1',
            organization_name: 'Test Organization',
            invoice_number: 'INV-2025-001',
            status: 'paid',
            currency: 'USD',
            subtotal: 10000,
            tax_amount: 1000,
            total: 11000,
            amount_paid: 11000,
            amount_due: 0,
            due_date: '2025-01-15',
            paid_at: '2025-01-10T12:00:00Z',
            line_items: [
                { description: 'Pro Plan', quantity: 1, unitPrice: 10000, amount: 10000 }
            ],
            pdf_url: 'https://example.com/invoice.pdf',
            created_at: '2025-01-01T10:00:00Z',
        },
        {
            id: 'inv-2',
            organization_id: 'org-2',
            organization_name: 'Another Org',
            invoice_number: 'INV-2025-002',
            status: 'open',
            currency: 'USD',
            subtotal: 20000,
            tax_amount: 2000,
            total: 22000,
            amount_paid: 0,
            amount_due: 22000,
            due_date: '2025-02-01',
            line_items: [
                { description: 'Enterprise Plan', quantity: 1, unitPrice: 20000, amount: 20000 }
            ],
            created_at: '2025-01-15T10:00:00Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/billing/invoices')) {
                return Promise.resolve({ invoices: mockInvoices });
            }
            return Promise.resolve({});
        });
    });

    it('renders loading state initially', () => {
        render(<InvoicesPanel />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('fetches invoices on mount', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/billing/invoices?');
        });
    });

    it('displays invoices in table', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('INV-2025-001')).toBeTruthy();
            expect(screen.getByText('INV-2025-002')).toBeTruthy();
        });
    });

    it('displays organization names', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
            expect(screen.getByText('Another Org')).toBeTruthy();
        });
    });

    it('displays invoice amounts formatted as currency', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('$110.00')).toBeTruthy();
            expect(screen.getByText('$220.00')).toBeTruthy();
        });
    });

    it('shows paid status badge for paid invoices', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Paid')).toBeTruthy();
        });
    });

    it('shows open status badge for open invoices', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Open')).toBeTruthy();
        });
    });

    it('shows amount due for open invoices', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Due: $220.00')).toBeTruthy();
        });
    });

    it('shows Create Invoice button', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Create Invoice')).toBeTruthy();
        });
    });

    it('filters invoices by status', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('INV-2025-001')).toBeTruthy();
        });

        const statusSelect = screen.getByDisplayValue('All Status');
        fireEvent.change(statusSelect, { target: { value: 'paid' } });

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/billing/invoices?status=paid');
        });
    });

    it('filters invoices by organization', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('INV-2025-001')).toBeTruthy();
        });

        const orgSelect = screen.getByDisplayValue('All Organizations');
        fireEvent.change(orgSelect, { target: { value: 'org-1' } });

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/billing/invoices?organizationId=org-1');
        });
    });

    it('filters invoices by search query', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('INV-2025-001')).toBeTruthy();
            expect(screen.getByText('INV-2025-002')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Search invoices...');
        fireEvent.change(searchInput, { target: { value: '001' } });

        await waitFor(() => {
            expect(screen.getByText('INV-2025-001')).toBeTruthy();
            expect(screen.queryByText('INV-2025-002')).toBeFalsy();
        });
    });

    it('shows view details button', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            const viewButtons = screen.getAllByTitle('View Details');
            expect(viewButtons.length).toBe(2);
        });
    });

    it('opens invoice detail modal when view is clicked', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('INV-2025-001')).toBeTruthy();
        });

        const viewButtons = screen.getAllByTitle('View Details');
        fireEvent.click(viewButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('Line Items')).toBeTruthy();
            expect(screen.getByText('Pro Plan')).toBeTruthy();
        });
    });

    it('shows PDF download link when available', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            const downloadLinks = screen.getAllByTitle('Download PDF');
            expect(downloadLinks.length).toBeGreaterThan(0);
        });
    });

    it('shows send button for draft invoices', async () => {
        const draftInvoice = {
            ...mockInvoices[0],
            id: 'inv-draft',
            invoice_number: 'INV-DRAFT',
            status: 'draft',
        };
        (Api.get as any).mockImplementation(() => 
            Promise.resolve({ invoices: [draftInvoice] })
        );
        
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByTitle('Send Invoice')).toBeTruthy();
        });
    });

    it('sends invoice when send button is clicked', async () => {
        const draftInvoice = {
            ...mockInvoices[0],
            id: 'inv-draft',
            status: 'draft',
        };
        (Api.get as any).mockImplementation(() => 
            Promise.resolve({ invoices: [draftInvoice] })
        );
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByTitle('Send Invoice')).toBeTruthy();
        });

        fireEvent.click(screen.getByTitle('Send Invoice'));

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/billing/invoices/inv-draft/send');
        });
    });

    it('marks invoice as paid when mark paid button is clicked', async () => {
        (Api.put as any).mockResolvedValue({ success: true });
        
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByTitle('Mark as Paid')).toBeTruthy();
        });

        fireEvent.click(screen.getByTitle('Mark as Paid'));

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalledWith('/billing/invoices/inv-2', { status: 'paid' });
        });
    });

    it('shows empty state when no invoices', async () => {
        (Api.get as any).mockImplementation(() => Promise.resolve({ invoices: [] }));
        
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('No invoices found')).toBeTruthy();
        });
    });

    it('refreshes invoices when refresh button is clicked', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('INV-2025-001')).toBeTruthy();
        });

        vi.clearAllMocks();
        
        const refreshButton = screen.getByRole('button', { name: '' });
        const refreshIcon = document.querySelector('svg.lucide-refresh-cw');
        if (refreshIcon) {
            fireEvent.click(refreshIcon.closest('button')!);
        }

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });

    it('closes detail modal when close is clicked', async () => {
        render(<InvoicesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('INV-2025-001')).toBeTruthy();
        });

        const viewButtons = screen.getAllByTitle('View Details');
        fireEvent.click(viewButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('Line Items')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Close'));

        await waitFor(() => {
            expect(screen.queryByText('Line Items')).toBeFalsy();
        });
    });
});




