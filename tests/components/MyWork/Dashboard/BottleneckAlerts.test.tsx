/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BottleneckAlerts } from '../../../components/MyWork/Dashboard/BottleneckAlerts';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

const mockBottlenecks = [
    { id: 'b1', type: 'overload', message: 'User overloaded', userId: 'user-1' }
];

describe('BottleneckAlerts Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ bottlenecks: mockBottlenecks });
    });

    it('renders bottleneck alerts', async () => {
        render(<BottleneckAlerts />);

        await waitFor(() => {
            expect(screen.getByText(/Bottleneck/i) || screen.getByText(/Alert/i)).toBeInTheDocument();
        });
    });

    it('displays bottlenecks', async () => {
        render(<BottleneckAlerts />);

        await waitFor(() => {
            expect(screen.getByText(/overloaded/i)).toBeInTheDocument();
        });
    });
});



