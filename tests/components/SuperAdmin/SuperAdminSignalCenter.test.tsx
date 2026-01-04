/**
 * SuperAdminSignalCenter Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuperAdminSignalCenter } from '../../components/SuperAdmin/SuperAdminSignalCenter';

// Mock Api service
vi.mock('../../../services/api', () => ({
    Api: {
        fetchNotifications: vi.fn(),
        markNotificationRead: vi.fn(),
    },
}));

import { Api } from '../../../services/api';

describe('SuperAdminSignalCenter', () => {
    it('should render signal nodes', () => {
        // Mock return value
        (Api.fetchNotifications as any).mockResolvedValue([
            { id: '1', type: 'SYSTEM_ALERT', isRead: false, title: 'Alert 1' },
            { id: '2', type: 'CLIENT_TICKET', isRead: false, title: 'Ticket 1' }
        ]);

        render(<SuperAdminSignalCenter />);

        // Check for node labels
        expect(screen.getByText('System Alerts')).toBeInTheDocument();
        expect(screen.getByText('Client Tickets')).toBeInTheDocument();
        expect(screen.getByText('Feedback')).toBeInTheDocument();
    });

    it('should toggle popover on click', async () => {
        (Api.fetchNotifications as any).mockResolvedValue([]);
        render(<SuperAdminSignalCenter />);

        const systemNode = screen.getByText('System Alerts').closest('button');
        fireEvent.click(systemNode!);

        // Popover should appear (we can check for specific text inside popover header)
        // Popover should appear
        expect(screen.getByText('0 Active')).toBeInTheDocument();
    });
});
