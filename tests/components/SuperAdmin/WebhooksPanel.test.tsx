/**
 * WebhooksPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WebhooksPanel } from '../../components/SuperAdmin/integrations/WebhooksPanel';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
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

describe('WebhooksPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
        { id: 'org-2', name: 'Another Org' },
    ];

    const mockWebhooks = [
        {
            id: 'webhook-1',
            organization_id: 'org-1',
            organization_name: 'Test Organization',
            name: 'My Webhook',
            url: 'https://example.com/webhook',
            events: ['user.created', 'project.completed'],
            is_active: 1,
            retry_count: 3,
            timeout_ms: 30000,
            last_delivery_at: '2025-01-01T10:00:00Z',
            last_delivery_status: 'success',
            created_at: '2024-12-01T00:00:00Z',
            updated_at: '2025-01-01T10:00:00Z',
        },
        {
            id: 'webhook-2',
            organization_id: 'org-1',
            organization_name: 'Test Organization',
            name: 'Failed Webhook',
            url: 'https://failing.com/webhook',
            events: ['task.created'],
            is_active: 1,
            retry_count: 3,
            timeout_ms: 30000,
            last_delivery_at: '2025-01-01T09:00:00Z',
            last_delivery_status: 'failed',
            created_at: '2024-12-01T00:00:00Z',
            updated_at: '2025-01-01T09:00:00Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockResolvedValue({ webhooks: mockWebhooks });
    });

    it('renders loading state initially', () => {
        render(<WebhooksPanel />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('fetches and displays webhooks', async () => {
        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('My Webhook')).toBeTruthy();
        });
    });

    it('displays webhook URL', async () => {
        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('https://example.com/webhook')).toBeTruthy();
        });
    });

    it('displays webhook events', async () => {
        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('user.created')).toBeTruthy();
            expect(screen.getByText('project.completed')).toBeTruthy();
        });
    });

    it('shows active status for successful webhook', async () => {
        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Active')).toBeTruthy();
        });
    });

    it('shows failing status for failed webhook', async () => {
        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Failing')).toBeTruthy();
        });
    });

    it('opens create webhook modal when button is clicked', async () => {
        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Create Webhook')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Create Webhook'));

        expect(screen.getByText('Create Webhook')).toBeTruthy();
        expect(screen.getByPlaceholderText('My Webhook')).toBeTruthy();
    });

    it('allows searching webhooks', async () => {
        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('My Webhook')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Search webhooks...');
        fireEvent.change(searchInput, { target: { value: 'Failed' } });

        await waitFor(() => {
            expect(screen.getByText('Failed Webhook')).toBeTruthy();
        });
    });

    it('deletes webhook when delete button is clicked', async () => {
        (Api.delete as any).mockResolvedValue({ success: true });

        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('My Webhook')).toBeTruthy();
        });

        // Find delete buttons (Trash2 icons)
        const deleteButtons = screen.getAllByTitle('Delete');
        fireEvent.click(deleteButtons[0]);

        await waitFor(() => {
            expect(Api.delete).toHaveBeenCalledWith('/settings/webhooks/webhook-1');
        });
    });

    it('sends test webhook when test button is clicked', async () => {
        (Api.post as any).mockResolvedValue({ success: true });

        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('My Webhook')).toBeTruthy();
        });

        // Find test buttons (Send icons)
        const testButtons = screen.getAllByTitle('Send Test');
        fireEvent.click(testButtons[0]);

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/settings/webhooks/webhook-1/test');
        });
    });

    it('displays empty state when no webhooks', async () => {
        (Api.get as any).mockResolvedValue({ webhooks: [] });

        render(<WebhooksPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('No webhooks configured')).toBeTruthy();
        });
    });
});












