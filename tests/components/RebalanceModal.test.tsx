/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RebalanceModal } from '../../../components/RebalanceModal';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        post: vi.fn()
    }
}));

const mockInitiatives = [
    { id: 'init-1', name: 'Initiative 1' }
];

const mockOptions = [
    { type: 'Balanced', description: 'Balanced approach' },
    { type: 'Aggressive', description: 'Aggressive timeline' }
];

describe('RebalanceModal Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.post as any).mockResolvedValue({ options: mockOptions });
    });

    it('renders modal when open', async () => {
        render(<RebalanceModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} initiatives={mockInitiatives} />);

        await waitFor(() => {
            expect(screen.getByText(/Rebalance Roadmap/i)).toBeInTheDocument();
        });
    });

    it('loads rebalance options on open', async () => {
        render(<RebalanceModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} initiatives={mockInitiatives} />);

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/ai/rebalance-roadmap', { initiatives: mockInitiatives });
        });
    });

    it('displays rebalance options', async () => {
        render(<RebalanceModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} initiatives={mockInitiatives} />);

        await waitFor(() => {
            expect(screen.getByText('Balanced')).toBeInTheDocument();
            expect(screen.getByText('Aggressive')).toBeInTheDocument();
        });
    });

    it('allows selecting option', async () => {
        render(<RebalanceModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} initiatives={mockInitiatives} />);

        await waitFor(() => {
            expect(screen.getByText('Aggressive')).toBeInTheDocument();
        });

        const aggressiveOption = screen.getByText('Aggressive');
        await user.click(aggressiveOption);

        await waitFor(() => {
            expect(aggressiveOption.closest('div')).toHaveClass(/border-blue-500/);
        });
    });

    it('calls onApply when confirm clicked', async () => {
        const onApply = vi.fn();
        render(<RebalanceModal isOpen={true} onClose={vi.fn()} onApply={onApply} initiatives={mockInitiatives} />);

        await waitFor(() => {
            expect(screen.getByText('Balanced')).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole('button', { name: /Apply/i });
        await user.click(confirmButton);

        expect(onApply).toHaveBeenCalled();
    });
});


