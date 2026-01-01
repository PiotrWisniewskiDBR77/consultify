/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GovernanceDashboard } from '../../../components/governance/GovernanceDashboard';

vi.mock('lucide-react', () => ({
    ShieldCheck: () => <div data-testid="icon-shield" />,
    Lock: () => <div data-testid="icon-lock" />,
    History: () => <div data-testid="icon-history" />,
    UserCheck: () => <div data-testid="icon-usercheck" />
}));

describe('GovernanceDashboard Component', () => {
    it('renders the governance title', () => {
        render(<GovernanceDashboard />);
        expect(screen.getByText('Governance & Security Control')).toBeInTheDocument();
    });

    it('renders the control statistics cards', () => {
        render(<GovernanceDashboard />);
        expect(screen.getByText('Audit Events (24h)')).toBeInTheDocument();
        expect(screen.getByText('Active Permissions')).toBeInTheDocument();
        expect(screen.getByText('Compliance Score')).toBeInTheDocument();
    });

    it('displays operational status badges', () => {
        render(<GovernanceDashboard />);
        expect(screen.getByText('Operational')).toBeInTheDocument();
        expect(screen.getByText('Verified')).toBeInTheDocument();
        expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('renders the recent audit log section', () => {
        render(<GovernanceDashboard />);
        expect(screen.getByText('Recent Audit Log')).toBeInTheDocument();
        expect(screen.getAllByText('User updated Role permissions')).toHaveLength(3);
    });

    it('renders the security alerts section with empty state', () => {
        render(<GovernanceDashboard />);
        expect(screen.getByText('Security Alerts')).toBeInTheDocument();
        expect(screen.getByText('No critical alerts detected')).toBeInTheDocument();
    });
});

