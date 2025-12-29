/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserTaskList } from '../../../components/dashboard/UserTaskList';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

const mockTasks = [
    { id: 'task-1', title: 'Task 1', status: 'TODO', dueDate: '2024-01-15' },
    { id: 'task-2', title: 'Task 2', status: 'IN_PROGRESS', dueDate: '2024-01-20' }
];

describe('UserTaskList Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ tasks: mockTasks });
    });

    it('renders user task list', async () => {
        render(<UserTaskList />);

        await waitFor(() => {
            expect(screen.getByText(/Tasks/i) || screen.getByText(/My Tasks/i)).toBeInTheDocument();
        });
    });

    it('loads tasks on mount', async () => {
        render(<UserTaskList />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });

    it('displays task items', async () => {
        render(<UserTaskList />);

        await waitFor(() => {
            expect(screen.getByText('Task 1')).toBeInTheDocument();
            expect(screen.getByText('Task 2')).toBeInTheDocument();
        });
    });
});

