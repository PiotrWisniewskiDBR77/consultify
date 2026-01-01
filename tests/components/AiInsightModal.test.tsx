/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiInsightModal } from '../../../components/AiInsightModal';

describe('AiInsightModal Component', () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders modal when open', () => {
        render(<AiInsightModal isOpen={true} onClose={mockOnClose} insight={{ type: 'risk', text: 'Test insight', impact: 'High' }} />);

        expect(screen.getByRole('dialog') || screen.getByText(/insight/i)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<AiInsightModal isOpen={false} onClose={mockOnClose} insight={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('displays insight text', () => {
        render(<AiInsightModal isOpen={true} onClose={mockOnClose} insight={{ type: 'risk', text: 'Budget mismatch', impact: 'High' }} />);

        expect(screen.getByText(/Budget mismatch/i)).toBeInTheDocument();
    });

    it('displays insight impact', () => {
        render(<AiInsightModal isOpen={true} onClose={mockOnClose} insight={{ type: 'risk', text: 'Test', impact: 'High' }} />);

        expect(screen.getByText(/High/i)).toBeInTheDocument();
    });

    it('closes when close button clicked', async () => {
        render(<AiInsightModal isOpen={true} onClose={mockOnClose} insight={{ type: 'risk', text: 'Test', impact: 'High' }} />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(mockOnClose).toHaveBeenCalled();
    });
});


