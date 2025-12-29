/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BudgetTrackingView } from '../../../components/Implementation/BudgetTrackingView';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

describe('BudgetTrackingView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            budget: { allocated: 100000, spent: 45000, remaining: 55000 },
            initiatives: []
        });
    });

    it('renders budget tracking heading', async () => {
        render(<BudgetTrackingView />);

        await waitFor(() => {
            expect(screen.getByText(/Budget/i) || screen.getByText(/Tracking/i)).toBeInTheDocument();
        });
    });

    it('loads budget data on mount', async () => {
        render(<BudgetTrackingView />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });

    it('displays budget metrics', async () => {
        render(<BudgetTrackingView />);

        await waitFor(() => {
            expect(screen.getByText(/100,000/i) || screen.getByText(/45,000/i)).toBeInTheDocument();
        });
    });
});
