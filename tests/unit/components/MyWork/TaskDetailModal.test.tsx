
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskDetailModal } from '../../../../components/MyWork/TaskDetailModal';
import { Api } from '../../../../services/api';
import { InitiativeService } from '../../../../services/initiativeService';
import toast from 'react-hot-toast';

// Mock services
vi.mock('../../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn()
    }
}));

vi.mock('../../../../services/initiativeService', () => ({
    InitiativeService: {
        getAll: vi.fn()
    }
}));

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue
    })
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

describe('TaskDetailModal', () => {
    const mockProps = {
        taskId: null,
        isOpen: true,
        onClose: vi.fn(),
        onTaskSaved: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockImplementation((url: string) => {
            if (url === '/users') return Promise.resolve({ users: [{ id: 'u1', firstName: 'John', lastName: 'Doe' }] });
            if (url.startsWith('/tasks/')) return Promise.resolve({
                id: 't1',
                title: 'Existing Task',
                description: 'Description',
                status: 'todo',
                priority: 'medium'
            });
            return Promise.resolve([]);
        });
        (InitiativeService.getAll as any).mockResolvedValue({ initiatives: [{ id: 'i1', name: 'Initiative 1' }] });
    });

    it('renders "New Task" header when taskId is null', async () => {
        render(<TaskDetailModal {...mockProps} taskId={null} />);
        await waitFor(() => {
            expect(screen.getByText('New Task')).toBeTruthy();
        });
    });

    it('renders "Edit Task" header when taskId is provided', async () => {
        render(<TaskDetailModal {...mockProps} taskId="t1" />);
        await waitFor(() => {
            expect(screen.getByText('Edit Task')).toBeTruthy();
            expect((screen.getByPlaceholderText('Enter task title') as HTMLInputElement).value).toBe('Existing Task');
        });
    });

    it('validates required title on save', async () => {
        render(<TaskDetailModal {...mockProps} />);
        await waitFor(() => expect(screen.getByText('New Task')).toBeTruthy());

        const saveBtn = screen.getByText('Save Task');
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Title is required');
        });
        expect(Api.post).not.toHaveBeenCalled();
    });

    it('saves a new task successfully', async () => {
        (Api.post as any).mockResolvedValue({ id: 'new-id' });
        render(<TaskDetailModal {...mockProps} />);
        await waitFor(() => expect(screen.getByText('New Task')).toBeTruthy());

        fireEvent.change(screen.getByPlaceholderText('Enter task title'), { target: { value: 'New Task Title' } });
        fireEvent.click(screen.getByText('Save Task'));

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalled();
            expect(toast.success).toHaveBeenCalledWith('Task created');
            expect(mockProps.onTaskSaved).toHaveBeenCalled();
        });
    });

    it('updates an existing task successfully', async () => {
        (Api.put as any).mockResolvedValue({ success: true });
        render(<TaskDetailModal {...mockProps} taskId="t1" />);

        await waitFor(() => expect(screen.getByDisplayValue('Existing Task')).toBeTruthy());

        fireEvent.change(screen.getByDisplayValue('Existing Task'), { target: { value: 'Updated Task' } });
        fireEvent.click(screen.getByText('Save Task'));

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalledWith('/tasks/t1', expect.objectContaining({ title: 'Updated Task' }));
            expect(toast.success).toHaveBeenCalledWith('Task updated');
            expect(mockProps.onTaskSaved).toHaveBeenCalled();
        });
    });

    it('manages checklist items', async () => {
        render(<TaskDetailModal {...mockProps} />);
        await waitFor(() => expect(screen.getByText('New Task')).toBeTruthy());

        fireEvent.click(screen.getByText('+ Add Item'));
        await waitFor(() => {
            expect(screen.getByPlaceholderText('Subtask...')).toBeTruthy();
        });

        fireEvent.change(screen.getByPlaceholderText('Subtask...'), { target: { value: 'Subtask 1' } });
        fireEvent.click(screen.getByRole('checkbox'));

        await waitFor(() => {
            expect((screen.getByPlaceholderText('Subtask...') as HTMLInputElement).value).toBe('Subtask 1');
        });
    });

    it('calls onClose when cancel or close button is clicked', async () => {
        render(<TaskDetailModal {...mockProps} />);
        await waitFor(() => expect(screen.getByText('New Task')).toBeTruthy());

        fireEvent.click(screen.getByText('Cancel'));
        expect(mockProps.onClose).toHaveBeenCalled();

        fireEvent.click(screen.getAllByRole('button')[0]); // X button is the first one
        expect(mockProps.onClose).toHaveBeenCalledTimes(2);
    });
});
