/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeRequestModal } from '../../components/Implementation/ChangeRequestModal';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        post: vi.fn()
    }
}));

describe('ChangeRequestModal Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.post as any).mockResolvedValue({});
    });

    it('renders modal when open', () => {
        render(<ChangeRequestModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} projectId="proj-1" />);

        expect(screen.getByText(/Change Request/i)).toBeInTheDocument();
    });

    it('allows entering change request details', async () => {
        render(<ChangeRequestModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} projectId="proj-1" />);

        const descriptionInput = screen.getByPlaceholderText(/description/i) || screen.getByLabelText(/Description/i);
        await user.type(descriptionInput, 'Need to change scope');

        expect(descriptionInput).toHaveValue('Need to change scope');
    });

    it('submits change request', async () => {
        const onSubmit = vi.fn();
        render(<ChangeRequestModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} projectId="proj-1" />);

        const submitButton = screen.getByRole('button', { name: /Submit/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
        });
    });
});














