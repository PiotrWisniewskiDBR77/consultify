/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WorkloadView } from '../../../components/MyWork/WorkloadView';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

describe('WorkloadView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ tasks: [], workload: {} });
    });

    it('renders workload view', async () => {
        render(<WorkloadView />);

        await waitFor(() => {
            expect(screen.getByText(/Workload/i)).toBeInTheDocument();
        });
    });

    it('loads workload data', async () => {
        render(<WorkloadView />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });
});






