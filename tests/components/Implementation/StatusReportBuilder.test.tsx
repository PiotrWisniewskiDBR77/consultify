/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StatusReportBuilder } from '../../components/Implementation/StatusReportBuilder';
import { Api } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

describe('StatusReportBuilder Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ initiatives: [] });
    });

    it('renders status report builder', async () => {
        render(<StatusReportBuilder />);

        await waitFor(() => {
            expect(screen.getByText(/Status Report/i) || screen.getByText(/Report/i)).toBeInTheDocument();
        });
    });

    it('allows building report', async () => {
        render(<StatusReportBuilder />);

        await waitFor(() => {
            expect(screen.getByText(/Build/i) || screen.getByText(/Generate/i)).toBeInTheDocument();
        });
    });
});











