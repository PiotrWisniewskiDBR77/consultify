import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskDropdown } from '../../../components/TaskDropdown';
import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';

// Mock dependencies
vi.mock('../../../services/api', () => ({
    Api: {
        getTasks: vi.fn()
    }
}));

const mockSetCurrentView = vi.fn();
vi.mock('../../../store/useAppStore', () => ({
    useAppStore: () => ({
        setCurrentView: mockSetCurrentView
    })
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

describe('TaskDropdown', () => {
    const mockTasks = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 'high', dueDate: new Date(Date.now() + 86400000).toISOString() },
        { id: '2', title: 'Task 2', status: 'in_progress', priority: 'medium' },
        { id: '3', title: 'Overdue Task', status: 'todo', priority: 'low', dueDate: '2020-01-01' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getTasks as any).mockResolvedValue(mockTasks);
    });

    it('renders closed by default', () => {
        render(<TaskDropdown />);
        expect(screen.queryByText('My Action Plan')).not.toBeInTheDocument();
    });

    it('opens dropdown when clicked', async () => {
        const user = userEvent.setup();
        render(<TaskDropdown />);

        const triggerBtn = screen.getByTitle('Tasks');
        await user.click(triggerBtn);

        await waitFor(() => {
            expect(screen.getByText('My Action Plan')).toBeInTheDocument();
        });
    });

    it('displays task stats', async () => {
        const user = userEvent.setup();
        render(<TaskDropdown />);

        // Wait for tasks fetch (useEffect)
        await waitFor(() => expect(Api.getTasks).toHaveBeenCalled());

        const triggerBtn = screen.getByTitle('Tasks');
        await user.click(triggerBtn);

        await waitFor(() => {
            // Check for pending count (Task 1 + Task 3 = 2, Task 2 is in_progress so it is pending too? 
            // Logic: pending = status !== 'done'. So all 3 are pending.
            expect(screen.getByText('3 Pending')).toBeInTheDocument();
            // Check overdue
            expect(screen.getByText('1')).toBeInTheDocument(); // 1 overdue
        });
    });

    it('displays tasks in list', async () => {
        const user = userEvent.setup();
        render(<TaskDropdown />);

        const triggerBtn = screen.getByTitle('Tasks');
        await user.click(triggerBtn);

        await waitFor(() => {
            expect(screen.getByText('Task 1')).toBeInTheDocument();
            expect(screen.getByText('Task 2')).toBeInTheDocument();
        });
    });

    it('navigates to tasks view when clicking View All', async () => {
        const user = userEvent.setup();
        render(<TaskDropdown />);

        const triggerBtn = screen.getByTitle('Tasks');
        await user.click(triggerBtn);

        const viewAllBtn = await screen.findByText(/View all/i);
        await user.click(viewAllBtn);

        expect(mockSetCurrentView).toHaveBeenCalledWith('MY_WORK');
    });
});
