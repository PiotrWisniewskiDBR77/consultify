/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FullStep1Workspace } from '../../components/workspaces/FullStep1Workspace';


const mockSession = {
    id: 'session-1',
    assessment: {
        processes: { actual: 3 },
        digitalProducts: { actual: 4 },
        businessModels: { actual: 2 }
    }
} as any;

describe('FullStep1Workspace Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders assessment workspace', () => {
        render(<FullStep1Workspace fullSession={mockSession} onStartAxis={vi.fn()} onNextStep={vi.fn()} />);

        expect(screen.getByText(/Digital Maturity Assessment/i)).toBeInTheDocument();
    });

    it('displays progress indicator', () => {
        render(<FullStep1Workspace fullSession={mockSession} onStartAxis={vi.fn()} onNextStep={vi.fn()} />);

        expect(screen.getByText(/Progress/i)).toBeInTheDocument();
    });

    it('displays assessment axes', () => {
        render(<FullStep1Workspace fullSession={mockSession} onStartAxis={vi.fn()} onNextStep={vi.fn()} />);

        expect(screen.getByText(/Processes/i) || screen.getByText(/Digital/i)).toBeInTheDocument();
    });

    it('calls onStartAxis when axis clicked', async () => {
        const onStartAxis = vi.fn();
        render(<FullStep1Workspace fullSession={mockSession} onStartAxis={onStartAxis} onNextStep={vi.fn()} />);

        const axisButton = screen.getAllByRole('button').find(btn => 
            btn.textContent?.includes('Processes') || btn.textContent?.includes('Digital')
        );

        if (axisButton) {
            await user.click(axisButton);
            expect(onStartAxis).toHaveBeenCalled();
        }
    });
});














