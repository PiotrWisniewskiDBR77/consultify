/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DashboardExecutionSnapshot } from '../../components/dashboard/DashboardExecutionSnapshot';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

const mockSnapshot = {
    activeInitiatives: 5,
    completedThisMonth: 2,
    atRisk: 1,
    blocked: 0
};

describe('DashboardExecutionSnapshot Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue(mockSnapshot);
    });

    it('renders execution snapshot', async () => {
        render(<DashboardExecutionSnapshot />);

        await waitFor(() => {
            expect(screen.getByText(/Execution/i) || screen.getByText(/Snapshot/i)).toBeInTheDocument();
        });
    });

    it('displays metrics', async () => {
        render(<DashboardExecutionSnapshot />);

        await waitFor(() => {
            expect(screen.getByText(/5/i)).toBeInTheDocument(); // activeInitiatives
        });
    });
});










