/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecisionBoard } from '../../../components/Implementation/DecisionBoard';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        patch: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

const mockDecisions = [
    {
        id: 'dec-1',
        title: 'Approve budget increase',
        description: 'Need approval for additional budget',
        status: 'PENDING' as const,
        priority: 'HIGH' as const,
        createdAt: new Date().toISOString()
    },
    {
        id: 'dec-2',
        title: 'Change scope',
        description: 'Scope modification request',
        status: 'APPROVED' as const,
        priority: 'MEDIUM' as const,
        createdAt: new Date().toISOString()
    }
];

describe('DecisionBoard Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ decisions: mockDecisions });
        (Api.patch as any).mockResolvedValue({});
    });

    it('renders decision board heading', async () => {
        render(<DecisionBoard />);

        await waitFor(() => {
            expect(screen.getByText(/Decision/i) || screen.getByText(/Board/i)).toBeInTheDocument();
        });
    });

    it('loads decisions on mount', async () => {
        render(<DecisionBoard />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/decisions');
        });
    });

    it('filters by initiative when initiativeId provided', async () => {
        render(<DecisionBoard initiativeId="init-1" />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/decisions?initiativeId=init-1');
        });
    });

    it('displays pending decisions', async () => {
        render(<DecisionBoard />);

        await waitFor(() => {
            expect(screen.getByText('Approve budget increase')).toBeInTheDocument();
        });
    });

    it('allows approving decision', async () => {
        render(<DecisionBoard />);

        await waitFor(() => {
            expect(screen.getByText('Approve budget increase')).toBeInTheDocument();
        });

        const approveButton = screen.getByRole('button', { name: /approve/i });
        await user.click(approveButton);

        await waitFor(() => {
            expect(Api.patch).toHaveBeenCalled();
        });
    });

    it('shows loading state', () => {
        (Api.get as any).mockImplementation(() => new Promise(() => {}));

        render(<DecisionBoard />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});






