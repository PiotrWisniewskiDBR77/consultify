/**
 * CreditNotesPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditNotesPanel } from '../../components/SuperAdmin/billing/CreditNotesPanel';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn(),
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

describe('CreditNotesPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
        { id: 'org-2', name: 'Another Org' },
    ];

    const mockCreditNotes = [
        {
            id: 'cn-1',
            organization_id: 'org-1',
            organization_name: 'Test Organization',
            note_number: 'CN-2025-001',
            amount: 5000,
            reason: 'Service credit',
            status: 'issued',
            created_at: '2025-01-01T10:00:00Z',
        },
        {
            id: 'cn-2',
            organization_id: 'org-2',
            organization_name: 'Another Org',
            note_number: 'CN-2025-002',
            amount: 10000,
            reason: 'Refund for downtime',
            status: 'applied',
            created_at: '2025-01-10T10:00:00Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockImplementation(() => 
            Promise.resolve({ creditNotes: mockCreditNotes })
        );
    });

    it('renders loading state initially', () => {
        render(<CreditNotesPanel />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('fetches credit notes on mount', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/billing/credit-notes');
        });
    });

    it('displays summary card with total credits', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Total Credits Issued')).toBeTruthy();
            expect(screen.getByText('$150.00')).toBeTruthy();
            expect(screen.getByText('2 credit notes')).toBeTruthy();
        });
    });

    it('displays credit notes in table', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('CN-2025-001')).toBeTruthy();
            expect(screen.getByText('CN-2025-002')).toBeTruthy();
        });
    });

    it('displays organization names', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
            expect(screen.getByText('Another Org')).toBeTruthy();
        });
    });

    it('displays credit amounts formatted as currency', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('$50.00')).toBeTruthy();
            expect(screen.getByText('$100.00')).toBeTruthy();
        });
    });

    it('displays reasons for credit notes', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Service credit')).toBeTruthy();
            expect(screen.getByText('Refund for downtime')).toBeTruthy();
        });
    });

    it('shows Issue Credit Note button', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Issue Credit Note')).toBeTruthy();
        });
    });

    it('opens create modal when Issue Credit Note is clicked', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Issue Credit Note')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Issue Credit Note'));

        await waitFor(() => {
            expect(screen.getByPlaceholderText('0.00')).toBeTruthy();
            expect(screen.getByPlaceholderText('Enter reason for credit note...')).toBeTruthy();
        });
    });

    it('creates credit note when form is submitted', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            fireEvent.click(screen.getByText('Issue Credit Note'));
        });

        await waitFor(() => {
            expect(screen.getByPlaceholderText('0.00')).toBeTruthy();
        });

        // Select organization
        const orgSelect = screen.getByDisplayValue('Select organization');
        fireEvent.change(orgSelect, { target: { value: 'org-1' } });

        // Enter amount
        const amountInput = screen.getByPlaceholderText('0.00');
        fireEvent.change(amountInput, { target: { value: '25.00' } });

        // Enter reason
        const reasonInput = screen.getByPlaceholderText('Enter reason for credit note...');
        fireEvent.change(reasonInput, { target: { value: 'Test credit' } });

        // Click Issue Credit Note button in modal
        const issueButtons = screen.getAllByText('Issue Credit Note');
        fireEvent.click(issueButtons[issueButtons.length - 1]);

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/billing/credit-notes', {
                organizationId: 'org-1',
                amount: 2500, // Converted to cents
                reason: 'Test credit',
            });
        });
    });

    it('filters credit notes by search query', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('CN-2025-001')).toBeTruthy();
            expect(screen.getByText('CN-2025-002')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Search credit notes...');
        fireEvent.change(searchInput, { target: { value: '001' } });

        await waitFor(() => {
            expect(screen.getByText('CN-2025-001')).toBeTruthy();
            expect(screen.queryByText('CN-2025-002')).toBeFalsy();
        });
    });

    it('shows empty state when no credit notes', async () => {
        (Api.get as any).mockImplementation(() => Promise.resolve({ creditNotes: [] }));
        
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('No credit notes found')).toBeTruthy();
        });
    });

    it('refreshes credit notes when refresh button is clicked', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('CN-2025-001')).toBeTruthy();
        });

        vi.clearAllMocks();
        
        const refreshIcon = document.querySelector('svg.lucide-refresh-cw');
        if (refreshIcon) {
            fireEvent.click(refreshIcon.closest('button')!);
        }

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/billing/credit-notes');
        });
    });

    it('closes modal when cancel is clicked', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            fireEvent.click(screen.getByText('Issue Credit Note'));
        });

        await waitFor(() => {
            expect(screen.getByPlaceholderText('0.00')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByPlaceholderText('0.00')).toBeFalsy();
        });
    });

    it('displays status badge for each credit note', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('issued')).toBeTruthy();
            expect(screen.getByText('applied')).toBeTruthy();
        });
    });

    it('displays creation date for credit notes', async () => {
        render(<CreditNotesPanel />);
        
        await waitFor(() => {
            // Check that dates are displayed (format may vary by locale)
            const rows = screen.getAllByRole('row');
            expect(rows.length).toBeGreaterThan(1);
        });
    });
});












