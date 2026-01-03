/**
 * DataExportPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataExportPanel } from '../../../components/SuperAdmin/data/DataExportPanel';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
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

describe('DataExportPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
        { id: 'org-2', name: 'Another Org' },
    ];

    const mockRequests = [
        {
            id: 'req-1',
            organization_id: 'org-1',
            organization_name: 'Test Organization',
            user_id: 'user-1',
            requester_email: 'admin@test.com',
            requester_first_name: 'Admin',
            export_type: 'full',
            status: 'completed',
            include_data: ['users', 'projects', 'tasks'],
            exclude_data: [],
            file_url: 'https://example.com/export.zip',
            file_size: 1024000,
            file_expires_at: '2025-02-01T10:00:00Z',
            created_at: '2025-01-01T10:00:00Z',
            completed_at: '2025-01-01T10:05:00Z',
        },
        {
            id: 'req-2',
            organization_id: 'org-2',
            organization_name: 'Another Org',
            user_id: 'user-2',
            requester_email: 'user@test.com',
            export_type: 'partial',
            status: 'processing',
            include_data: ['users'],
            exclude_data: [],
            created_at: '2025-01-10T10:00:00Z',
        },
        {
            id: 'req-3',
            organization_id: 'org-1',
            organization_name: 'Test Organization',
            user_id: 'user-1',
            export_type: 'full',
            status: 'failed',
            include_data: ['users', 'projects'],
            exclude_data: [],
            error_message: 'Export failed due to timeout',
            created_at: '2025-01-05T10:00:00Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockImplementation(() => 
            Promise.resolve({ requests: mockRequests })
        );
    });

    it('renders loading state initially', () => {
        render(<DataExportPanel />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('fetches export requests on mount', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/data-export/requests?');
        });
    });

    it('displays export requests', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
            expect(screen.getByText('Another Org')).toBeTruthy();
        });
    });

    it('shows status badges for each request', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Completed')).toBeTruthy();
            expect(screen.getByText('Processing')).toBeTruthy();
            expect(screen.getByText('Failed')).toBeTruthy();
        });
    });

    it('shows export type badges', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            const fullBadges = screen.getAllByText('FULL');
            expect(fullBadges.length).toBeGreaterThan(0);
            expect(screen.getByText('PARTIAL')).toBeTruthy();
        });
    });

    it('shows file size for completed exports', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('1000.0 KB')).toBeTruthy();
        });
    });

    it('shows download button for completed exports', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Download')).toBeTruthy();
        });
    });

    it('shows error message for failed exports', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Export failed due to timeout')).toBeTruthy();
        });
    });

    it('shows Request Export button', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Request Export')).toBeTruthy();
        });
    });

    it('opens create modal when Request Export is clicked', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Request Export')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Request Export'));

        await waitFor(() => {
            expect(screen.getByText('Request Data Export')).toBeTruthy();
            expect(screen.getByText('Export Type')).toBeTruthy();
            expect(screen.getByText('Include Data')).toBeTruthy();
        });
    });

    it('shows data type checkboxes in create modal', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            fireEvent.click(screen.getByText('Request Export'));
        });

        await waitFor(() => {
            expect(screen.getByText('Users')).toBeTruthy();
            expect(screen.getByText('Projects')).toBeTruthy();
            expect(screen.getByText('Tasks')).toBeTruthy();
            expect(screen.getByText('Documents')).toBeTruthy();
            expect(screen.getByText('Audit Logs')).toBeTruthy();
        });
    });

    it('creates export request when form is submitted', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<DataExportPanel />);
        
        await waitFor(() => {
            fireEvent.click(screen.getByText('Request Export'));
        });

        await waitFor(() => {
            expect(screen.getByText('Request Data Export')).toBeTruthy();
        });

        // Click Request Export button in modal
        const requestButtons = screen.getAllByText('Request Export');
        fireEvent.click(requestButtons[requestButtons.length - 1]);

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/data-export/requests', expect.objectContaining({
                exportType: 'full',
                includeData: expect.any(Array),
            }));
        });
    });

    it('filters by organization', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
        });

        const orgSelect = screen.getByDisplayValue('All Organizations');
        fireEvent.change(orgSelect, { target: { value: 'org-1' } });

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/data-export/requests?organizationId=org-1');
        });
    });

    it('filters by status', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Completed')).toBeTruthy();
        });

        const statusSelect = screen.getByDisplayValue('All Status');
        fireEvent.change(statusSelect, { target: { value: 'completed' } });

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/data-export/requests?status=completed');
        });
    });

    it('shows cancel button for pending/processing requests', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            const cancelButtons = screen.getAllByTitle('Cancel');
            expect(cancelButtons.length).toBeGreaterThan(0);
        });
    });

    it('cancels request when cancel button is clicked', async () => {
        (Api.delete as any).mockResolvedValue({ success: true });
        
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Processing')).toBeTruthy();
        });

        const cancelButtons = screen.getAllByTitle('Cancel');
        fireEvent.click(cancelButtons[0]);

        await waitFor(() => {
            expect(Api.delete).toHaveBeenCalledWith('/data-export/requests/req-2');
        });
    });

    it('shows empty state when no requests', async () => {
        (Api.get as any).mockImplementation(() => Promise.resolve({ requests: [] }));
        
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('No export requests found')).toBeTruthy();
        });
    });

    it('refreshes requests when refresh button is clicked', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
        });

        vi.clearAllMocks();
        
        const refreshIcon = document.querySelector('svg.lucide-refresh-cw');
        if (refreshIcon) {
            fireEvent.click(refreshIcon.closest('button')!);
        }

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });

    it('shows expiration date for files with expiry', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            expect(screen.getByText(/Expires/)).toBeTruthy();
        });
    });

    it('closes modal when cancel is clicked', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            fireEvent.click(screen.getByText('Request Export'));
        });

        await waitFor(() => {
            expect(screen.getByText('Request Data Export')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByText('Request Data Export')).toBeFalsy();
        });
    });

    it('allows selecting export type in modal', async () => {
        render(<DataExportPanel />);
        
        await waitFor(() => {
            fireEvent.click(screen.getByText('Request Export'));
        });

        await waitFor(() => {
            const fullButton = screen.getByRole('button', { name: 'Full' });
            const partialButton = screen.getByRole('button', { name: 'Partial' });
            expect(fullButton).toBeTruthy();
            expect(partialButton).toBeTruthy();
        });
    });
});






