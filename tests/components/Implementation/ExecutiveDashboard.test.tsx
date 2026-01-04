/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ExecutiveDashboard } from '../../components/Implementation/ExecutiveDashboard';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

const mockInitiatives = [
    { id: 'init-1', name: 'Initiative 1', status: 'EXECUTING', progress: 50 },
    { id: 'init-2', name: 'Initiative 2', status: 'BLOCKED', progress: 30 }
];

const mockMetrics = {
    totalActive: 2,
    onTrack: 1,
    atRisk: 0,
    blocked: 1,
    completedThisMonth: 0,
    avgProgress: 40,
    overdueTasks: 5,
    pendingDecisions: 3,
    highRiskItems: 2,
    budgetHealth: 'HEALTHY' as const,
    portfolioBudgetConsumed: 45
};

describe('ExecutiveDashboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            initiatives: mockInitiatives,
            metrics: mockMetrics,
            alerts: []
        });
    });

    it('renders dashboard heading', async () => {
        render(<ExecutiveDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/Executive/i) || screen.getByText(/Dashboard/i)).toBeInTheDocument();
        });
    });

    it('loads initiatives and metrics on mount', async () => {
        render(<ExecutiveDashboard />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });

    it('displays KPI metrics', async () => {
        render(<ExecutiveDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/2/i)).toBeInTheDocument(); // totalActive
            expect(screen.getByText(/1/i)).toBeInTheDocument(); // onTrack
        });
    });

    it('displays initiative list', async () => {
        render(<ExecutiveDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Initiative 1')).toBeInTheDocument();
            expect(screen.getByText('Initiative 2')).toBeInTheDocument();
        });
    });

    it('calls onInitiativeClick when initiative clicked', async () => {
        const onInitiativeClick = vi.fn();
        render(<ExecutiveDashboard onInitiativeClick={onInitiativeClick} />);

        await waitFor(() => {
            expect(screen.getByText('Initiative 1')).toBeInTheDocument();
        });

        const initiative = screen.getByText('Initiative 1');
        initiative.click();

        expect(onInitiativeClick).toHaveBeenCalled();
    });

    it('shows loading state', () => {
        (Api.get as any).mockImplementation(() => new Promise(() => {}));

        render(<ExecutiveDashboard />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('displays alerts when present', async () => {
        (Api.get as any).mockResolvedValue({
            initiatives: mockInitiatives,
            metrics: mockMetrics,
            alerts: [
                { type: 'blocked', severity: 'critical', message: 'Initiative blocked' }
            ]
        });

        render(<ExecutiveDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/blocked/i)).toBeInTheDocument();
        });
    });
});
