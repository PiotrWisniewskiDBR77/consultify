/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpPanel } from '../../../components/HelpPanel';
import { useHelp } from '../../../contexts/HelpContext';

vi.mock('../../../contexts/HelpContext', () => ({
    useHelp: vi.fn()
}));


describe('HelpPanel Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (useHelp as any).mockReturnValue({
            playbooks: [
                { id: 'pb-1', title: 'Getting Started', status: 'AVAILABLE' },
                { id: 'pb-2', title: 'Advanced Features', status: 'COMPLETED' }
            ],
            loading: false,
            isPanelOpen: true,
            setPanelOpen: vi.fn()
        });
    });

    it('renders help panel when open', () => {
        render(<HelpPanel />);

        expect(screen.getByText(/Help/i) || screen.getByText(/Training/i)).toBeInTheDocument();
    });

    it('displays available playbooks', async () => {
        render(<HelpPanel />);

        await waitFor(() => {
            expect(screen.getByText('Getting Started')).toBeInTheDocument();
        });
    });

    it('closes panel when close button clicked', async () => {
        const setPanelOpen = vi.fn();
        (useHelp as any).mockReturnValue({
            playbooks: [],
            loading: false,
            isPanelOpen: true,
            setPanelOpen
        });

        render(<HelpPanel />);

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(setPanelOpen).toHaveBeenCalledWith(false);
    });

    it('shows loading state', () => {
        (useHelp as any).mockReturnValue({
            playbooks: [],
            loading: true,
            isPanelOpen: true,
            setPanelOpen: vi.fn()
        });

        render(<HelpPanel />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});

