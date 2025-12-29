/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LowBalanceModal } from '../../../components/Modals/LowBalanceModal';

describe('LowBalanceModal Component', () => {
    const user = userEvent.setup();

    it('renders modal when open', () => {
        render(<LowBalanceModal isOpen={true} onClose={vi.fn()} balance={100} />);

        expect(screen.getByText(/Low Balance/i) || screen.getByText(/100/i)).toBeInTheDocument();
    });

    it('displays balance amount', () => {
        render(<LowBalanceModal isOpen={true} onClose={vi.fn()} balance={100} />);

        expect(screen.getByText(/100/i)).toBeInTheDocument();
    });

    it('calls onClose when close clicked', async () => {
        const onClose = vi.fn();
        render(<LowBalanceModal isOpen={true} onClose={onClose} balance={100} />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalled();
    });
});

