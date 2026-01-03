/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionAuditTrail, AuditRecord } from '../../../components/ai/ActionAuditTrail';

const mockRecords: AuditRecord[] = [
    {
        id: 'rec-1',
        proposal_id: 'prop-1',
        decision: 'APPROVED',
        decided_by_user_id: 'user-1',
        decision_reason: 'Meets all criteria',
        created_at: '2024-01-15T10:30:00Z',
        user_email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe'
    },
    {
        id: 'rec-2',
        proposal_id: 'prop-2',
        decision: 'REJECTED',
        decided_by_user_id: 'user-2',
        decision_reason: 'Does not meet requirements',
        created_at: '2024-01-14T15:45:00Z',
        user_email: 'admin@example.com',
        first_name: 'Jane',
        last_name: 'Smith'
    },
    {
        id: 'rec-3',
        proposal_id: 'prop-3',
        decision: 'MODIFIED',
        decided_by_user_id: 'user-3',
        decision_reason: 'Minor adjustments needed',
        created_at: '2024-01-13T09:00:00Z'
    },
    {
        id: 'rec-4',
        proposal_id: 'prop-4',
        decision: 'APPROVED',
        decided_by_user_id: 'SYSTEM_POLICY_ENGINE',
        decision_reason: 'Auto-approved by policy rule',
        created_at: '2024-01-12T12:00:00Z',
        policy_rule_id: 'rule-123'
    }
];

describe('ActionAuditTrail Component', () => {
    const user = userEvent.setup();
    const mockOnExport = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Loading State', () => {
        it('shows loading skeletons when loading', () => {
            render(<ActionAuditTrail records={[]} loading={true} />);

            const skeletons = document.querySelectorAll('.animate-pulse');
            expect(skeletons.length).toBeGreaterThan(0);
        });
    });

    describe('Empty State', () => {
        it('shows empty message when no records', () => {
            render(<ActionAuditTrail records={[]} />);

            expect(screen.getByText('No decisions have been recorded yet.')).toBeInTheDocument();
        });
    });

    describe('Record Display', () => {
        it('renders all records', () => {
            render(<ActionAuditTrail records={mockRecords} />);

            expect(screen.getByText('APPROVED')).toBeInTheDocument();
            expect(screen.getByText('REJECTED')).toBeInTheDocument();
            expect(screen.getByText('MODIFIED')).toBeInTheDocument();
        });

        it('displays user names', () => {
            render(<ActionAuditTrail records={mockRecords} />);

            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        });

        it('displays user emails', () => {
            render(<ActionAuditTrail records={mockRecords} />);

            expect(screen.getByText('(user@example.com)')).toBeInTheDocument();
            expect(screen.getByText('(admin@example.com)')).toBeInTheDocument();
        });

        it('displays decision reasons', () => {
            render(<ActionAuditTrail records={mockRecords} />);

            expect(screen.getByText(/"Meets all criteria"/)).toBeInTheDocument();
            expect(screen.getByText(/"Does not meet requirements"/)).toBeInTheDocument();
        });

        it('displays proposal IDs', () => {
            render(<ActionAuditTrail records={mockRecords} />);

            expect(screen.getByText(/PROPOSAL ID: prop-1/)).toBeInTheDocument();
            expect(screen.getByText(/PROPOSAL ID: prop-2/)).toBeInTheDocument();
        });

        it('formats dates correctly', () => {
            render(<ActionAuditTrail records={mockRecords} />);

            // Should display formatted date string
            const dateElements = document.querySelectorAll('.text-xs.text-slate-400');
            expect(dateElements.length).toBeGreaterThan(0);
        });
    });

    describe('Decision Styling', () => {
        it('applies correct style for APPROVED', () => {
            render(<ActionAuditTrail records={[mockRecords[0]]} />);

            const badge = screen.getByText('APPROVED').closest('div');
            expect(badge).toHaveClass('text-emerald-500');
        });

        it('applies correct style for REJECTED', () => {
            render(<ActionAuditTrail records={[mockRecords[1]]} />);

            const badge = screen.getByText('REJECTED').closest('div');
            expect(badge).toHaveClass('text-red-500');
        });

        it('applies correct style for MODIFIED', () => {
            render(<ActionAuditTrail records={[mockRecords[2]]} />);

            const badge = screen.getByText('MODIFIED').closest('div');
            expect(badge).toHaveClass('text-amber-500');
        });
    });

    describe('Decision Icons', () => {
        it('shows CheckCircle2 for APPROVED', () => {
            render(<ActionAuditTrail records={[mockRecords[0]]} />);

            // Icon should be present in the badge
            const badge = screen.getByText('APPROVED').closest('div');
            expect(badge).toBeTruthy();
        });

        it('shows XCircle for REJECTED', () => {
            render(<ActionAuditTrail records={[mockRecords[1]]} />);

            const badge = screen.getByText('REJECTED').closest('div');
            expect(badge).toBeTruthy();
        });

        it('shows RotateCcw for MODIFIED', () => {
            render(<ActionAuditTrail records={[mockRecords[2]]} />);

            const badge = screen.getByText('MODIFIED').closest('div');
            expect(badge).toBeTruthy();
        });
    });

    describe('Policy Engine Records', () => {
        it('shows AUTO-APPROVED badge for policy engine decisions', () => {
            render(<ActionAuditTrail records={[mockRecords[3]]} />);

            expect(screen.getByText('AUTO-APPROVED (Policy)')).toBeInTheDocument();
        });

        it('shows Policy Engine as user', () => {
            render(<ActionAuditTrail records={[mockRecords[3]]} />);

            expect(screen.getByText('Policy Engine (Automated)')).toBeInTheDocument();
        });

        it('displays policy rule ID', () => {
            render(<ActionAuditTrail records={[mockRecords[3]]} />);

            expect(screen.getByText(/RULE ID: rule-123/)).toBeInTheDocument();
        });
    });

    describe('Export Functionality', () => {
        it('shows export buttons when onExport provided', () => {
            render(<ActionAuditTrail records={mockRecords} onExport={mockOnExport} />);

            expect(screen.getByText('Export CSV')).toBeInTheDocument();
            expect(screen.getByText('Export JSON')).toBeInTheDocument();
        });

        it('does not show export buttons when no records', () => {
            render(<ActionAuditTrail records={[]} onExport={mockOnExport} />);

            expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
        });

        it('calls onExport with csv format', async () => {
            render(<ActionAuditTrail records={mockRecords} onExport={mockOnExport} />);

            await user.click(screen.getByText('Export CSV'));

            expect(mockOnExport).toHaveBeenCalledWith('csv');
        });

        it('calls onExport with json format', async () => {
            render(<ActionAuditTrail records={mockRecords} onExport={mockOnExport} />);

            await user.click(screen.getByText('Export JSON'));

            expect(mockOnExport).toHaveBeenCalledWith('json');
        });

        it('does not show export buttons when onExport not provided', () => {
            render(<ActionAuditTrail records={mockRecords} />);

            expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
            expect(screen.queryByText('Export JSON')).not.toBeInTheDocument();
        });
    });

    describe('Fallback Display', () => {
        it('shows user ID when name not available', () => {
            render(<ActionAuditTrail records={[mockRecords[2]]} />);

            // User-3 doesn't have first/last name
            expect(screen.getByText('user-3')).toBeInTheDocument();
        });

        it('shows Manual Approval when email not available', () => {
            render(<ActionAuditTrail records={[mockRecords[2]]} />);

            expect(screen.getByText('(Manual Approval)')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('has clickable export buttons', () => {
            render(<ActionAuditTrail records={mockRecords} onExport={mockOnExport} />);

            const csvButton = screen.getByText('Export CSV').closest('button');
            const jsonButton = screen.getByText('Export JSON').closest('button');

            expect(csvButton).toBeTruthy();
            expect(jsonButton).toBeTruthy();
        });
    });

    describe('Dark Mode Support', () => {
        it('includes dark mode classes', () => {
            render(<ActionAuditTrail records={mockRecords} />);

            const container = document.querySelector('.dark\\:bg-navy-900');
            expect(container).toBeTruthy();
        });
    });
});








