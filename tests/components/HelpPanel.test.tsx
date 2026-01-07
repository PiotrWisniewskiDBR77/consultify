/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpPanel from '../../src/components/layout/HelpPanel';
import { useHelp } from '../../src/contexts/HelpContext';

vi.mock('../../contexts/HelpContext', () => ({
    useHelp: vi.fn()
}));

vi.mock('../../contexts/AccessPolicyContext', () => ({
    usePolicySnapshot: () => ({
        snapshot: { isPaid: true, isDemo: false, isTrial: false }
    })
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
        render(<HelpPanel isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByText('help.panel.header')).toBeInTheDocument();
    });

    it('displays available playbooks', async () => {
        render(<HelpPanel isOpen={true} onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('Getting Started')).toBeInTheDocument();
        });
    });

    it('closes panel when close button clicked', async () => {
        const setPanelOpen = vi.fn();
        const onCloseMock = vi.fn();
        (useHelp as any).mockReturnValue({
            playbooks: [],
            loading: false,
            isPanelOpen: true,
            setPanelOpen
        });

        render(<HelpPanel isOpen={true} onClose={onCloseMock} />);

        const closeButton = screen.getByRole('button', { name: 'Close help panel' });
        await user.click(closeButton);

        expect(onCloseMock).toHaveBeenCalled();
    });

    it('shows loading state', () => {
        (useHelp as any).mockReturnValue({
            playbooks: [],
            loading: true,
            isPanelOpen: true,
            setPanelOpen: vi.fn()
        });

        render(<HelpPanel isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});




