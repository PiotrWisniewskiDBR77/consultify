/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PilotDecisionWorkspace } from '../../../components/PilotDecisionWorkspace';

const mockSession = {
    id: 'session-1',
    initiatives: [
        { id: 'init-1', name: 'High Priority Initiative', priority: 'High', complexity: 'High', businessValue: 'High' }
    ]
} as any;

describe('PilotDecisionWorkspace Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders pilot decision workspace', () => {
        render(<PilotDecisionWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} />);

        expect(screen.getByText(/Pilot/i) || screen.getByText(/Decision/i)).toBeInTheDocument();
    });

    it('displays pilot candidates', () => {
        render(<PilotDecisionWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} />);

        expect(screen.getByText('High Priority Initiative')).toBeInTheDocument();
    });

    it('allows selecting pilot candidate', async () => {
        render(<PilotDecisionWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} />);

        const candidate = screen.getByText('High Priority Initiative');
        await user.click(candidate);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Confirm/i })).toBeInTheDocument();
        });
    });

    it('confirms pilot selection', async () => {
        const onNextStep = vi.fn();
        render(<PilotDecisionWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={onNextStep} />);

        const candidate = screen.getByText('High Priority Initiative');
        await user.click(candidate);

        await waitFor(() => {
            const confirmButton = screen.getByRole('button', { name: /Confirm/i });
            expect(confirmButton).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole('button', { name: /Confirm/i });
        await user.click(confirmButton);

        expect(onNextStep).toHaveBeenCalled();
    });
});


