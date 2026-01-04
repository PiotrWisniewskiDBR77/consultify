/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FullExecutionDashboardWorkspace } from '../../components/FullExecutionDashboardWorkspace';

const mockSession = {
    id: 'session-1',
    initiatives: [
        { id: 'init-1', name: 'Initiative 1', status: 'EXECUTING' },
        { id: 'init-2', name: 'Initiative 2', status: 'DONE' }
    ],
    economics: { overallROI: 25 }
} as any;

// Mock AI Agent
vi.mock('../../services/ai/agent', () => ({
    analyzeSessionForInsights: vi.fn().mockResolvedValue([
        { type: 'risk', text: 'Mock Insight', impact: 'High' }
    ])
}));

describe('FullExecutionDashboardWorkspace Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders execution dashboard', () => {
        render(<FullExecutionDashboardWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onGenerateReport={vi.fn()} language="en" />);

        expect(screen.getByText(/Execution/i)).toBeInTheDocument();
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    });

    it('displays initiative count', () => {
        render(<FullExecutionDashboardWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onGenerateReport={vi.fn()} language="en" />);

        // The dashboard displays "2" for distinct initiative count in StatCard or table
        // We look for "2" text and ensure at least one instance is present.
        const elements = screen.getAllByText('2');
        expect(elements.length).toBeGreaterThan(0);
    });

    it('switches tabs', async () => {
        render(<FullExecutionDashboardWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onGenerateReport={vi.fn()} language="en" />);

        // Find the "Progress" tab button
        // Depending on rendering, it might be "Progress" text inside a button
        const allProgressText = screen.getAllByText(/Progress/i);
        const progressTab = allProgressText.find(el => el.tagName === 'BUTTON' || el.closest('button'));

        if (progressTab) {
            await user.click(progressTab);
            // Verify tab switched by checking content specific to Progress view
            // e.g., "Initiative Tracking" header
            expect(screen.getByText(/Initiative Tracking/i)).toBeInTheDocument();
        } else {
            throw new Error('Progress tab not found');
        }
    });

    it('calls onGenerateReport when download clicked', async () => {
        const onGenerateReport = vi.fn();
        render(<FullExecutionDashboardWorkspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onGenerateReport={onGenerateReport} language="en" />);

        // 1. Switch to Report tab first
        const allReportText = screen.getAllByText(/^Report$/i);
        const reportTab = allReportText.find(el => el.tagName === 'BUTTON' || el.closest('button'));

        if (reportTab) {
            await user.click(reportTab);

            // 2. Click "Generate Final Report" button inside the report tab
            const generateBtn = await screen.findByText(/Generate Final Report/i);
            await user.click(generateBtn);

            expect(onGenerateReport).toHaveBeenCalled();
        } else {
            throw new Error('Report tab not found');
        }
    });
});
