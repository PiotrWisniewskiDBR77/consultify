/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProgressView } from '../../../components/MyWork/ProgressView';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

describe('ProgressView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ progress: {} });
    });

    it('renders progress view', async () => {
        render(<ProgressView />);

        await waitFor(() => {
            expect(screen.getByText(/Progress/i)).toBeInTheDocument();
        });
    });
});



