/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIAnalyticsDashboard } from '../../../components/AIAnalyticsDashboard';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

const mockDashboardData = {
    actions: {
        total_executions: 100,
        success_count: 85,
        failed_count: 15,
        success_rate: 85,
        by_action_type: {
            'create_task': { success: 20, failed: 2, total: 22 },
            'update_status': { success: 30, failed: 5, total: 35 }
        }
    },
    approvals: {
        total_decisions: 50,
        approved: 40,
        rejected: 5,
        modified: 5,
        auto_approved: 30,
        manual_approved: 10,
        auto_approval_rate: 60,
        approval_rate: 80
    },
    playbooks: {
        total_runs: 25,
        completed: 20,
        failed: 5,
        completion_rate: 80,
        by_playbook: {
            'onboarding': { name: 'Onboarding', total: 10, completed: 8, failed: 2, completion_rate: 80, avg_duration_mins: 15 }
        }
    },
    deadLetter: {
        total_jobs: 1000,
        dead_letter_count: 10,
        dead_letter_rate: 1,
        by_error_code: {
            'TIMEOUT': 5,
            'VALIDATION_ERROR': 5
        }
    },
    timeToResolution: {
        avg_resolution_mins: 30,
        min_resolution_mins: 5,
        max_resolution_mins: 120,
        sample_count: 50
    },
    roi: {
        hours_saved: 100,
        cost_saved: 5000,
        currency: 'USD',
        actions_executed: 100,
        playbooks_completed: 20
    }
};

describe('AIAnalyticsDashboard Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue(mockDashboardData);
    });

    it('renders dashboard heading', async () => {
        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/AI Analytics/i)).toBeInTheDocument();
        });
    });

    it('loads dashboard data on mount', async () => {
        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });

    it('displays success rate metrics', async () => {
        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/85%/i)).toBeInTheDocument();
        });
    });

    it('displays ROI metrics', async () => {
        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/100 hours/i)).toBeInTheDocument();
            expect(screen.getByText(/\$5,000/i)).toBeInTheDocument();
        });
    });

    it('displays approval breakdown', async () => {
        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/Auto Approval/i)).toBeInTheDocument();
            expect(screen.getByText(/60%/i)).toBeInTheDocument();
        });
    });

    it('displays playbook completion rate', async () => {
        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/80%/i)).toBeInTheDocument();
        });
    });

    it('shows date range selector', async () => {
        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByLabelText(/From/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/To/i)).toBeInTheDocument();
        });
    });

    it('refreshes data when date range changes', async () => {
        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });

        const fromInput = screen.getByLabelText(/From/i);
        await user.clear(fromInput);
        await user.type(fromInput, '2024-01-01');

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledTimes(2);
        });
    });

    it('shows export button', async () => {
        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/Export/i)).toBeInTheDocument();
        });
    });

    it('shows loading state while fetching', () => {
        (Api.get as any).mockImplementation(() => new Promise(() => {}));

        render(<AIAnalyticsDashboard />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('displays error message on failure', async () => {
        (Api.get as any).mockRejectedValue(new Error('Failed to load'));

        render(<AIAnalyticsDashboard />);

        await waitFor(() => {
            expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
        });
    });
});









