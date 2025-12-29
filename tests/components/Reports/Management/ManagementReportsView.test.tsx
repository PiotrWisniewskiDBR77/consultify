/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManagementReportsView } from '../../../../components/Reports/Management/ManagementReportsView';
import { Api } from '../../../../services/api';

// Mock Api service
vi.mock('../../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

describe('ManagementReportsView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock for projects
        (Api.get as any).mockImplementation((url: string) => {
            if (url === '/api/projects') {
                return Promise.resolve({ data: { projects: [{ id: 'p1', name: 'Project 1' }] } });
            }
            if (url.includes('/history')) {
                return Promise.resolve({ data: { reports: [], total: 0 } });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('renders the report type selector by default', () => {
        render(<ManagementReportsView />);
        expect(screen.getByText('Generate Report')).toBeInTheDocument();
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
        expect(screen.getByText('Steering Committee')).toBeInTheDocument();
    });

    it('switches to history view when clicked', async () => {
        render(<ManagementReportsView />);
        const historyBtn = screen.getByRole('button', { name: /history/i });
        fireEvent.click(historyBtn);

        await waitFor(() => {
            expect(screen.getByText(/Report History/i)).toBeInTheDocument();
        });
    });

    it('calls generate API when create button is clicked', async () => {
        (Api.post as any).mockResolvedValue({ data: { report: { id: 'r1', type: 'TEAM_MEETING' } } });
        render(<ManagementReportsView />);

        const generateBtn = screen.getByRole('button', { name: /generate/i });
        fireEvent.click(generateBtn);

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/api/management-reports/generate', expect.any(Object));
        });
    });
});
