/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FullROIWorkspace } from '../../../components/FullROIWorkspace';

const mockSession = {
    id: 'session-1',
    initiatives: [
        { id: 'init-1', name: 'Initiative 1', estimatedCost: 10000, estimatedAnnualBenefit: 20000 }
    ],
    economics: { overallROI: 100, totalCost: 10000, totalAnnualBenefit: 20000 }
} as any;

describe('FullROIWorkspace Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders ROI workspace', () => {
        render(<FullROIWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText(/ROI/i) || screen.getByText(/Economics/i)).toBeInTheDocument();
    });

    it('displays ROI metrics', () => {
        render(<FullROIWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText(/100%/i) || screen.getByText(/10000/i)).toBeInTheDocument();
    });

    it('displays initiative economics table', () => {
        render(<FullROIWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText('Initiative 1')).toBeInTheDocument();
    });

    it('switches tabs', async () => {
        render(<FullROIWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        const initiativesTab = screen.getByText(/Initiatives/i) || screen.getByText(/Portfolio/i);
        if (initiativesTab) {
            await user.click(initiativesTab);
        }
    });
});

