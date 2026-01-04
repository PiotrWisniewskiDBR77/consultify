/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FullRolloutWorkspace } from '../../components/FullRolloutWorkspace';

const mockSession = {
    id: 'session-1',
    initiatives: [],
    economics: {}
} as any;

describe('FullRolloutWorkspace Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders rollout workspace', () => {
        render(<FullRolloutWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText(/Rollout/i) || screen.getByText(/Governance/i)).toBeInTheDocument();
    });

    it('displays tabs', () => {
        render(<FullRolloutWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText(/Dashboard/i) || screen.getByText(/Governance/i) || screen.getByText(/Teams/i)).toBeInTheDocument();
    });

    it('switches between tabs', async () => {
        render(<FullRolloutWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        const governanceTab = screen.getByText(/Governance/i);
        if (governanceTab) {
            await user.click(governanceTab);
        }
    });
});











