/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpButton from '../../components/HelpButton';
import { useHelp } from '../../contexts/HelpContext';

vi.mock('../../contexts/HelpContext', () => ({
    useHelp: vi.fn()
}));

describe('HelpButton Component', () => {
    const mockOnClick = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders help button', () => {
        (useHelp as any).mockReturnValue({
            playbooks: [],
            loading: false
        });

        render(<HelpButton onClick={mockOnClick} />);

        const button = screen.getByLabelText(/Open Help Panel/i);
        expect(button).toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
        const user = userEvent.setup();
        (useHelp as any).mockReturnValue({
            playbooks: [],
            loading: false
        });

        render(<HelpButton onClick={mockOnClick} />);

        const button = screen.getByLabelText(/Open Help Panel/i);
        await user.click(button);

        expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('shows badge when playbooks available', () => {
        (useHelp as any).mockReturnValue({
            playbooks: [
                { id: '1', status: 'AVAILABLE' },
                { id: '2', status: 'AVAILABLE' },
                { id: '3', status: 'COMPLETED' }
            ],
            loading: false
        });

        render(<HelpButton onClick={mockOnClick} />);

        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows 9+ when more than 9 playbooks', () => {
        const playbooks = Array.from({ length: 15 }, (_, i) => ({
            id: `pb-${i}`,
            status: 'AVAILABLE' as const
        }));

        (useHelp as any).mockReturnValue({
            playbooks,
            loading: false
        });

        render(<HelpButton onClick={mockOnClick} />);

        expect(screen.getByText('9+')).toBeInTheDocument();
    });

    it('does not show badge when loading', () => {
        (useHelp as any).mockReturnValue({
            playbooks: [
                { id: '1', status: 'AVAILABLE' }
            ],
            loading: true
        });

        render(<HelpButton onClick={mockOnClick} />);

        expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('does not show badge when no available playbooks', () => {
        (useHelp as any).mockReturnValue({
            playbooks: [
                { id: '1', status: 'COMPLETED' },
                { id: '2', status: 'DISMISSED' }
            ],
            loading: false
        });

        render(<HelpButton onClick={mockOnClick} />);

        expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
    });
});














