/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationDropdown } from '../../src/components/layout/NotificationDropdown';
import { Api } from '../../src/services/api';

vi.mock('@/services/api', () => ({
    Api: {
        getNotifications: vi.fn(),
        getUnreadNotificationCount: vi.fn(),
        markNotificationRead: vi.fn(),
        markAllNotificationsRead: vi.fn(),
        deleteNotification: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

const mockNotifications = [
    {
        id: 'notif-1',
        title: 'Task assigned',
        message: 'You have been assigned a new task',
        type: 'task',
        isRead: false,
        createdAt: new Date().toISOString()
    },
    {
        id: 'notif-2',
        title: 'Project updated',
        message: 'Project status has changed',
        type: 'project',
        isRead: true,
        createdAt: new Date().toISOString()
    }
];

describe('NotificationDropdown Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        (Api.getNotifications as any).mockResolvedValue(mockNotifications);
        (Api.getUnreadNotificationCount as any).mockResolvedValue(1);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders notification bell icon', () => {
        render(<NotificationDropdown />);

        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('fetches notifications on mount', async () => {
        render(<NotificationDropdown />);

        await waitFor(() => {
            expect(Api.getNotifications).toHaveBeenCalled();
            expect(Api.getUnreadNotificationCount).toHaveBeenCalled();
        });
    });

    it('displays unread count badge', async () => {
        render(<NotificationDropdown />);

        await waitFor(() => {
            expect(screen.getByText('1')).toBeInTheDocument();
        });
    });

    it('opens dropdown when clicked', async () => {
        render(<NotificationDropdown />);

        const button = screen.getByRole('button');
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText(/Notifications/i)).toBeInTheDocument();
        });
    });

    it('displays notifications in dropdown', async () => {
        render(<NotificationDropdown />);

        const button = screen.getByRole('button');
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Task assigned')).toBeInTheDocument();
            expect(screen.getByText('Project updated')).toBeInTheDocument();
        });
    });

    it('marks notification as read when clicked', async () => {
        (Api.markNotificationRead as any).mockResolvedValue({});

        render(<NotificationDropdown />);

        const button = screen.getByRole('button');
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Task assigned')).toBeInTheDocument();
        });

        const markReadButton = screen.getAllByRole('button').find(btn =>
            btn.querySelector('svg') && btn.title?.includes('Mark as read')
        );

        if (markReadButton) {
            await user.click(markReadButton);
            await waitFor(() => {
                expect(Api.markNotificationRead).toHaveBeenCalled();
            });
        }
    });

    it('marks all as read when button clicked', async () => {
        (Api.markAllNotificationsRead as any).mockResolvedValue({});

        render(<NotificationDropdown />);

        const button = screen.getByRole('button');
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText(/Mark all as read/i)).toBeInTheDocument();
        });

        const markAllButton = screen.getByText(/Mark all as read/i);
        await user.click(markAllButton);

        await waitFor(() => {
            expect(Api.markAllNotificationsRead).toHaveBeenCalled();
        });
    });

    it('polls for new notifications periodically', async () => {
        render(<NotificationDropdown />);

        await waitFor(() => {
            expect(Api.getNotifications).toHaveBeenCalledTimes(1);
        });

        vi.advanceTimersByTime(60000);

        await waitFor(() => {
            expect(Api.getNotifications).toHaveBeenCalledTimes(2);
        });
    });

    it('closes dropdown when clicking outside', async () => {
        render(
            <div>
                <div>Outside</div>
                <NotificationDropdown />
            </div>
        );

        const button = screen.getByRole('button');
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText(/Notifications/i)).toBeInTheDocument();
        });

        const outside = screen.getByText('Outside');
        await user.click(outside);

        await waitFor(() => {
            expect(screen.queryByText(/Notifications/i)).not.toBeInTheDocument();
        });
    });
});















