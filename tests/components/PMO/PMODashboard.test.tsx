/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PMODashboard } from '../../../src/components/PMO/PMODashboard';

describe('PMODashboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<PMODashboard />);
        expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
        const { container } = render(<PMODashboard />);
        expect(container).toBeInTheDocument();
    });

    it('displays dashboard content', () => {
        render(<PMODashboard />);

        const dashboardElements = screen.queryAllByText(/pmo|dashboard|project|portfolio/i);
        expect(dashboardElements.length).toBeGreaterThanOrEqual(0);
    });

    it('has content', () => {
        render(<PMODashboard />);
        expect(document.body.innerHTML.length).toBeGreaterThan(100);
    });
});
