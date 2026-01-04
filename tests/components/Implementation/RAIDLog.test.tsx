/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RAIDLog } from '../../components/Implementation/RAIDLog';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

describe('RAIDLog Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            risks: [],
            issues: [],
            assumptions: [],
            dependencies: []
        });
    });

    it('renders RAID log heading', async () => {
        render(<RAIDLog />);

        await waitFor(() => {
            expect(screen.getByText(/RAID/i) || screen.getByText(/Log/i)).toBeInTheDocument();
        });
    });

    it('displays RAID tabs', async () => {
        render(<RAIDLog />);

        await waitFor(() => {
            expect(screen.getByText(/Risks/i) || screen.getByText(/Issues/i)).toBeInTheDocument();
        });
    });

    it('loads RAID items on mount', async () => {
        render(<RAIDLog />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });
});














