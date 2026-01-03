/**
 * WebhookDeliveriesModal Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WebhookDeliveriesModal } from '../../../components/SuperAdmin/integrations/WebhookDeliveriesModal';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('WebhookDeliveriesModal', () => {
    const mockDeliveries = [
        {
            id: 'delivery-1',
            webhook_id: 'webhook-1',
            event_type: 'user.created',
            payload: '{"user_id": "123", "email": "test@example.com"}',
            request_headers: '{"Content-Type": "application/json"}',
            response_status: 200,
            response_body: '{"success": true}',
            response_headers: '{"Content-Type": "application/json"}',
            attempt_count: 1,
            duration_ms: 150,
            success: 1,
            delivered_at: '2025-01-01T12:00:00Z',
        },
        {
            id: 'delivery-2',
            webhook_id: 'webhook-1',
            event_type: 'project.updated',
            payload: '{"project_id": "456"}',
            request_headers: '{"Content-Type": "application/json"}',
            response_status: 500,
            response_body: '{"error": "Internal Server Error"}',
            response_headers: '{}',
            attempt_count: 3,
            duration_ms: 2500,
            success: 0,
            error_message: 'Server returned 500 error',
            delivered_at: '2025-01-01T11:00:00Z',
            next_retry_at: '2025-01-01T12:00:00Z',
        },
        {
            id: 'delivery-3',
            webhook_id: 'webhook-1',
            event_type: 'task.completed',
            payload: '{"task_id": "789"}',
            request_headers: '{}',
            response_status: 404,
            response_body: '{"error": "Not Found"}',
            attempt_count: 5,
            duration_ms: 100,
            success: 0,
            error_message: 'Endpoint not found',
            delivered_at: '2025-01-01T10:00:00Z',
        },
    ];

    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ deliveries: mockDeliveries });
    });

    it('renders modal with title', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('Delivery History')).toBeTruthy();
            expect(screen.getByText('Recent webhook deliveries and their status')).toBeTruthy();
        });
    });

    it('fetches deliveries on mount', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/settings/webhooks/webhook-1/deliveries');
        });
    });

    it('displays deliveries with event types', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('user.created')).toBeTruthy();
            expect(screen.getByText('project.updated')).toBeTruthy();
            expect(screen.getByText('task.completed')).toBeTruthy();
        });
    });

    it('shows success indicator for successful deliveries', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            // Check for success status code
            expect(screen.getByText('200')).toBeTruthy();
        });
    });

    it('shows error status codes for failed deliveries', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('500')).toBeTruthy();
            expect(screen.getByText('404')).toBeTruthy();
        });
    });

    it('shows retry attempt count', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('Attempt #3')).toBeTruthy();
            expect(screen.getByText('Attempt #5')).toBeTruthy();
        });
    });

    it('shows duration in milliseconds', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('150ms')).toBeTruthy();
            expect(screen.getByText('2500ms')).toBeTruthy();
        });
    });

    it('shows Retry button for failed deliveries', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            const retryButtons = screen.getAllByText('Retry');
            expect(retryButtons.length).toBe(2); // Two failed deliveries
        });
    });

    it('does not show Retry button for successful deliveries', async () => {
        (Api.get as any).mockResolvedValue({ deliveries: [mockDeliveries[0]] });
        
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.queryByText('Retry')).toBeFalsy();
        });
    });

    it('retries delivery when Retry button is clicked', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('project.updated')).toBeTruthy();
        });

        const retryButtons = screen.getAllByText('Retry');
        fireEvent.click(retryButtons[0]);

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/settings/webhooks/deliveries/delivery-2/retry');
        });
    });

    it('expands delivery details when clicked', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('user.created')).toBeTruthy();
        });

        // Click on a delivery row to expand
        fireEvent.click(screen.getByText('user.created'));

        await waitFor(() => {
            expect(screen.getByText('Request Payload')).toBeTruthy();
        });
    });

    it('shows payload in expanded view', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('user.created')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('user.created'));

        await waitFor(() => {
            expect(screen.getByText(/user_id/)).toBeTruthy();
            expect(screen.getByText(/test@example.com/)).toBeTruthy();
        });
    });

    it('shows response body in expanded view', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('user.created')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('user.created'));

        await waitFor(() => {
            expect(screen.getByText('Response Body')).toBeTruthy();
        });
    });

    it('shows error message for failed deliveries', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('project.updated')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('project.updated'));

        await waitFor(() => {
            expect(screen.getByText('Server returned 500 error')).toBeTruthy();
        });
    });

    it('closes modal when close button is clicked', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('Delivery History')).toBeTruthy();
        });

        // Find close button (X icon)
        const closeButton = document.querySelector('svg.lucide-x')?.closest('button');
        if (closeButton) {
            fireEvent.click(closeButton);
        }

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('refreshes deliveries when refresh button is clicked', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('user.created')).toBeTruthy();
        });

        vi.clearAllMocks();
        
        const refreshIcon = document.querySelector('svg.lucide-refresh-cw');
        if (refreshIcon) {
            fireEvent.click(refreshIcon.closest('button')!);
        }

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/settings/webhooks/webhook-1/deliveries');
        });
    });

    it('shows loading state initially', () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('shows empty state when no deliveries', async () => {
        (Api.get as any).mockResolvedValue({ deliveries: [] });
        
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('No deliveries yet')).toBeTruthy();
        });
    });

    it('collapses delivery when clicked again', async () => {
        render(<WebhookDeliveriesModal webhookId="webhook-1" onClose={mockOnClose} />);
        
        await waitFor(() => {
            expect(screen.getByText('user.created')).toBeTruthy();
        });

        // Expand
        fireEvent.click(screen.getByText('user.created'));
        await waitFor(() => {
            expect(screen.getByText('Request Payload')).toBeTruthy();
        });

        // Collapse
        fireEvent.click(screen.getByText('user.created'));
        await waitFor(() => {
            expect(screen.queryByText('Request Payload')).toBeFalsy();
        });
    });
});






