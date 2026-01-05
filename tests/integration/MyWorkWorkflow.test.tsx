
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyWorkView } from '@/views/MyWorkView';
import { Api } from '../../services/api';

// Mock Api
vi.mock('../../services/api', () => ({
    Api: {
        getTasks: vi.fn(),
        getNotifications: vi.fn(),
        markNotificationRead: vi.fn(),
    }
}));

// Mock SplitLayout to avoid complex AI chat dependencies
vi.mock('@/components/SplitLayout', () => ({
    SplitLayout: ({ children }: any) => <div data-testid="split-layout">{children}</div>
}));

// Mock useAppStore (only what's needed by MyWork components)
vi.mock('@/store/useAppStore', () => {
    const defaultState = {
        user: { id: 'user1', name: 'Test User' },
        currentView: 'my-work',
    };
    return {
        useAppStore: (selector?: (state: any) => any) => {
            if (selector) return selector(defaultState);
            return defaultState;
        }
    };
});

// Mock Framer Motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock React Hot Toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock Child Components if necessary? 
// Actually, for integration, we want to render them REAL.
// Only Mock leaf components that are troublesome or external.
// TaskDetailModal might contain complex logic/API calls. We might want to mock it OR mock its internal API calls.
// Let's mock TaskDetailModal to simplify checking if it "opened".
vi.mock('@/components/MyWork/TaskDetailModal', () => ({
    TaskDetailModal: ({ isOpen, taskId, onClose }: any) => isOpen ? (
        <div data-testid="task-detail-modal">
            <h1>Task Detail Modal</h1>
            <p>Task ID: {taskId}</p>
            <button onClick={onClose}>Close</button>
        </div>
    ) : null
}));

describe('Integration: MyWork Workflow', () => {
    const mockTasks = [
        { id: '1', title: 'Integration Task 1', status: 'todo', dueDate: new Date().toISOString() },
        { id: '2', title: 'Integration Task 2', status: 'completed' }
    ];

    const mockNotifications = [
        {
            id: 'n1',
            type: 'TASK_ASSIGNED',
            title: 'New Task Assigned',
            message: 'Check this task',
            read: false,
            createdAt: new Date().toISOString(),
            relatedObjectType: 'TASK',
            relatedObjectId: '1'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getTasks as any).mockResolvedValue(mockTasks);
        (Api.getNotifications as any).mockResolvedValue(mockNotifications);
    });

    it('renders WorkCenter and NotificationsHub', async () => {
        render(<MyWorkView />);

        // Check Work Center (MyTasksList)
        await waitFor(() => {
            expect(screen.getByText('Integration Task 1')).toBeTruthy();
        });

        // Check Notifications Hub
        await waitFor(() => {
            expect(screen.getByText('New Task Assigned')).toBeTruthy();
        });
    });

    it('opens Task Detail Modal when "Create Task" is clicked', async () => {
        render(<MyWorkView />);

        await waitFor(() => expect(screen.getByText('Integration Task 1')).toBeTruthy());

        // Find "New Task" button in PillNavigation
        const createBtn = await screen.findByRole('button', { name: /New Task/i });
        fireEvent.click(createBtn);

        await waitFor(() => {
            expect(screen.getByTestId('task-detail-modal')).toBeTruthy();
            expect(screen.getByText('Task ID:')).toBeTruthy(); // taskId should be null/empty for new task
        });
    });

    it('opens Task Detail Modal when clicking a task in list', async () => {
        render(<MyWorkView />);

        // Wait for tasks to be loaded and rendered
        const taskElement = await screen.findByText('Integration Task 1');
        expect(taskElement).toBeTruthy();

        // Click Task 1
        fireEvent.click(taskElement);

        // Check if modal opens with correct task ID
        await waitFor(() => {
            expect(screen.getByTestId('task-detail-modal')).toBeTruthy();
            expect(screen.getByText('Task ID: 1')).toBeTruthy();
        });
    });

    it('opens Task Detail Modal when clicking "View Task" in notification', async () => {
        render(<MyWorkView />);

        // Wait for notifications to be loaded
        const notificationElement = await screen.findByText('New Task Assigned');
        expect(notificationElement).toBeTruthy();

        // Click notification to expand it
        fireEvent.click(notificationElement);

        // Now "View Task" should be visible (it's inside the expanded details)
        const viewTaskBtn = await screen.findByText(/View Task/i);
        fireEvent.click(viewTaskBtn);

        // Check if modal opens with correct task ID from notification
        await waitFor(() => {
            expect(screen.getByTestId('task-detail-modal')).toBeTruthy();
            expect(screen.getByText('Task ID: 1')).toBeTruthy();
        });
    });
});
