/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConversionModal from '../../components/ConversionModal';

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn()
}));

describe('ConversionModal Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders modal when open', () => {
        render(<ConversionModal isOpen={true} onClose={vi.fn()} triggerReason="manual" />);

        expect(screen.getByText(/Ready to Upgrade/i) || screen.getByText(/Demo/i)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<ConversionModal isOpen={false} onClose={vi.fn()} triggerReason="manual" />);
        expect(container.firstChild).toBeNull();
    });

    it('displays time limit message', () => {
        render(<ConversionModal isOpen={true} onClose={vi.fn()} triggerReason="time_limit" />);

        expect(screen.getByText(/Demo Time Limit/i)).toBeInTheDocument();
    });

    it('displays action blocked message', () => {
        render(<ConversionModal isOpen={true} onClose={vi.fn()} triggerReason="action_blocked" />);

        expect(screen.getByText(/Feature Locked/i) || screen.getByText(/read-only/i)).toBeInTheDocument();
    });

    it('calls onClose when close clicked', async () => {
        const onClose = vi.fn();
        render(<ConversionModal isOpen={true} onClose={onClose} triggerReason="manual" />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalled();
    });
});











