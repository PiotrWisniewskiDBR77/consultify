/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PMODashboard } from '../../components/PMO/PMODashboard';

// Mock lucide icons to avoid rendering complexities in snapshots
vi.mock('lucide-react', () => ({
    LayoutDashboard: () => <div data-testid="icon-dashboard" />,
    Target: () => <div data-testid="icon-target" />,
    Briefcase: () => <div data-testid="icon-briefcase" />,
    Activity: () => <div data-testid="icon-activity" />
}));

describe('PMODashboard Component', () => {
    it('renders the dashboard title', () => {
        render(<PMODashboard />);
        expect(screen.getByText('PMO Portfolio Dashboard')).toBeInTheDocument();
    });

    it('renders all four statistic cards', () => {
        render(<PMODashboard />);
        expect(screen.getByText('Active Initiatives')).toBeInTheDocument();
        expect(screen.getByText('Portfolio Health')).toBeInTheDocument();
        expect(screen.getByText('Strategic Alignment')).toBeInTheDocument();
        expect(screen.getByText('Risk Level')).toBeInTheDocument();
    });

    it('displays the correct values in statistic cards', () => {
        render(<PMODashboard />);
        expect(screen.getByText('24')).toBeInTheDocument();
        expect(screen.getByText('86%')).toBeInTheDocument();
        expect(screen.getByText('92%')).toBeInTheDocument();
        expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('renders the portfolio overview section with placeholder', () => {
        render(<PMODashboard />);
        expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
        expect(screen.getByText('Portfolio Visualization Placeholder')).toBeInTheDocument();
    });

    it('renders the "New Initiative" button', () => {
        render(<PMODashboard />);
        const button = screen.getByRole('button', { name: /new initiative/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('bg-blue-600');
    });
});













