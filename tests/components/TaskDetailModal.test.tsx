/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDetailModal } from '../../components/TaskDetailModal';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        generateTaskInsight: vi.fn()
    }
}));

const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    status: 'TODO',
    priority: 'high'
} as any;

const mockUser = {
    id: 'user-1',
    email: 'test@example.com'
} as any;

describe('TaskDetailModal Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders modal when open', () => {
        render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} currentUser={mockUser} />);

        expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<TaskDetailModal task={mockTask} isOpen={false} onClose={vi.fn()} onSave={vi.fn()} currentUser={mockUser} />);
        expect(container.firstChild).toBeNull();
    });

    it('displays task title', () => {
        render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} currentUser={mockUser} />);

        expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
    });

    it('displays tabs', () => {
        render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} currentUser={mockUser} />);

        expect(screen.getByText(/Strategic Context/i)).toBeInTheDocument();
        expect(screen.getByText(/Execution Plan/i)).toBeInTheDocument();
    });

    it('validates required fields on save', async () => {
        const onSave = vi.fn();
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => { });

        render(<TaskDetailModal task={{ ...mockTask, title: '' }} isOpen={true} onClose={vi.fn()} onSave={onSave} currentUser={mockUser} />);

        const saveButton = screen.getByRole('button', { name: /Save Changes/i });
        await user.click(saveButton);

        expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(/required/i));

        alertMock.mockRestore();
    });

    it('calls onClose when close clicked', async () => {
        const onClose = vi.fn();
        render(<TaskDetailModal task={mockTask} isOpen={true} onClose={onClose} onSave={vi.fn()} currentUser={mockUser} />);

        const closeButton = screen.getByText(/Cancel/i);
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalled();
    });
});














