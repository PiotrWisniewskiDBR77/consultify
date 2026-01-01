/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FullExecutionDashboardWorkspace } from '../../../components/FullExecutionDashboardWorkspace';

const mockSession = {
    id: 'session-1',
    initiatives: [
        { id: 'init-1', name: 'Initiative 1', status: 'EXECUTING' },
        { id: 'init-2', name: 'Initiative 2', status: 'DONE' }
    ],
    economics: { overallROI: 25 }
} as any;

describe('FullExecutionDashboardWorkspace Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders execution dashboard', () => {
        render(<FullExecutionDashboardWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onGenerateReport={vi.fn()} language="en" />);

        expect(screen.getByText(/Execution/i) || screen.getByText(/Dashboard/i)).toBeInTheDocument();
    });

    it('displays initiative count', () => {
        render(<FullExecutionDashboardWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onGenerateReport={vi.fn()} language="en" />);

        expect(screen.getByText(/2/i)).toBeInTheDocument(); // 2 initiatives
    });

    it('switches tabs', async () => {
        render(<FullExecutionDashboardWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onGenerateReport={vi.fn()} language="en" />);

        const progressTab = screen.getByText(/Progress/i) || screen.getByText(/KPI/i);
        if (progressTab) {
            await user.click(progressTab);
        }
    });

    it('calls onGenerateReport when download clicked', async () => {
        const onGenerateReport = vi.fn();
        render(<FullExecutionDashboardWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onGenerateReport={onGenerateReport} language="en" />);

        const downloadButton = screen.getByText(/Download/i) || screen.getByText(/Report/i);
        if (downloadButton) {
            await user.click(downloadButton);
            expect(onGenerateReport).toHaveBeenCalled();
        }
    });
});


