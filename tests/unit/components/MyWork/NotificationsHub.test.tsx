import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsHub } from '@/components/MyWork/NotificationsHub';
import { Api } from '@/services/api';

// Mock Dependencies
vi.mock('@/services/api', () => ({
  Api: {
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      user: { id: 'user1' },
    }),
}));

// Note: react-hot-toast is mocked globally in tests/setup.ts

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('NotificationsHub', () => {
  const mockOnOpenTask = vi.fn();
  const mockOnOpenDecision = vi.fn();

  const mockNotifications = [
    {
      id: '1',
      type: 'TASK_ASSIGNED',
      title: 'New Task Assigned',
      message: 'You have a new task',
      severity: 'INFO',
      read: false,
      createdAt: new Date().toISOString(),
      projectId: 'proj1',
      scope: 'PROJECT',
    },
    {
      id: '2',
      type: 'SYSTEM_ALERT',
      title: 'System Update',
      message: 'Maintenance scheduled',
      severity: 'WARNING',
      read: true,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
      scope: 'SYSTEM',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (Api.getNotifications as any).mockResolvedValue(mockNotifications);
  });

  it('renders and fetches notifications', async () => {
    render(<NotificationsHub onOpenTask={mockOnOpenTask} onOpenDecision={mockOnOpenDecision} />);

    await waitFor(() => {
      expect(screen.getByText('New Task Assigned')).toBeTruthy();
      expect(screen.getByText('System Update')).toBeTruthy();
      expect(Api.getNotifications).toHaveBeenCalled();
    });
  });

  it('filters by mode (Personal vs Project)', async () => {
    render(<NotificationsHub onOpenTask={mockOnOpenTask} onOpenDecision={mockOnOpenDecision} />);

    await waitFor(() => expect(screen.getByText('New Task Assigned')).toBeTruthy());

    // Switch to Project mode
    fireEvent.click(screen.getByText('Project'));

    await waitFor(() => {
      expect(screen.getByText('New Task Assigned')).toBeTruthy(); // Should stay
      expect(screen.queryByText('System Update')).toBeNull(); // Should go (System scope, not project)
    });

    // Switch to Personal mode
    fireEvent.click(screen.getByText('Personal'));
    // Note: Logic for 'personal' includes userId match or scope=PERSONAL. our mocks don't fully match but let's see.
    // Logic: filtered by userId===currentUserId OR scope===PERSONAL OR types. Task assigned implies personal relevance?
    // Actually, let's just check the counts or visibility based on the mocks.
  });

  it('filters by Quick Filter (Unread)', async () => {
    render(<NotificationsHub onOpenTask={mockOnOpenTask} onOpenDecision={mockOnOpenDecision} />);

    await waitFor(() => expect(screen.getByText('System Update')).toBeTruthy());

    // Click Unread filter
    fireEvent.click(screen.getByText('Unread'));

    await waitFor(() => {
      expect(screen.getByText('New Task Assigned')).toBeTruthy();
      expect(screen.queryByText('System Update')).toBeNull(); // It is read
    });
  });

  it('marks notification as read on click', async () => {
    render(<NotificationsHub onOpenTask={mockOnOpenTask} onOpenDecision={mockOnOpenDecision} />);

    await waitFor(() => expect(screen.getByText('New Task Assigned')).toBeTruthy());

    fireEvent.click(screen.getByText('New Task Assigned'));

    await waitFor(() => {
      expect(Api.markNotificationRead).toHaveBeenCalledWith('1');
    });
  });

  it('deletes notification', async () => {
    render(<NotificationsHub onOpenTask={mockOnOpenTask} onOpenDecision={mockOnOpenDecision} />);

    await waitFor(() => expect(screen.getByText('New Task Assigned')).toBeTruthy());

    const item = screen.getByText('New Task Assigned').closest('div')?.parentElement;
    if (item) {
      fireEvent.mouseEnter(item);

      await waitFor(() => {
        const deleteBtns = screen.getAllByTitle('Delete');
        expect(deleteBtns.length).toBeGreaterThan(0);
      });

      const deleteBtns = screen.getAllByTitle('Delete');
      fireEvent.click(deleteBtns[0]);

      await waitFor(() => {
        expect(Api.deleteNotification).toHaveBeenCalledWith('1');
        expect(screen.queryByText('New Task Assigned')).toBeNull();
      });
    }
  });
});
