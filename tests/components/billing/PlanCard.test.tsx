/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanCard } from '../../../components/billing/PlanCard';

const mockPlan = {
    id: 'pro',
    name: 'Professional',
    price_monthly: 100,
    token_limit: 1000000,
    storage_limit_gb: 50,
    token_overage_rate: 0.05,
    storage_overage_rate: 0.10
};

describe('PlanCard Component', () => {
    const user = userEvent.setup();
    const mockOnSelect = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders plan name', () => {
            render(<PlanCard plan={mockPlan} />);

            expect(screen.getByText('Professional')).toBeInTheDocument();
        });

        it('renders price', () => {
            render(<PlanCard plan={mockPlan} />);

            expect(screen.getByText('$100')).toBeInTheDocument();
            expect(screen.getByText('/month')).toBeInTheDocument();
        });

        it('formats tokens correctly (millions)', () => {
            render(<PlanCard plan={mockPlan} />);

            expect(screen.getByText('1M tokens/month')).toBeInTheDocument();
        });

        it('formats tokens correctly (thousands)', () => {
            render(<PlanCard plan={{ ...mockPlan, token_limit: 50000 }} />);

            expect(screen.getByText('50K tokens/month')).toBeInTheDocument();
        });

        it('displays storage limit', () => {
            render(<PlanCard plan={mockPlan} />);

            expect(screen.getByText('50 GB storage')).toBeInTheDocument();
        });

        it('shows overage rates', () => {
            render(<PlanCard plan={mockPlan} />);

            expect(screen.getByText(/Overage: \$0.05\/1K tokens • \$0.1\/GB/)).toBeInTheDocument();
        });
    });

    describe('Features List', () => {
        it('shows included features', () => {
            render(<PlanCard plan={mockPlan} />);

            expect(screen.getByText('Email support')).toBeInTheDocument();
        });

        it('shows API access for premium plans', () => {
            render(<PlanCard plan={mockPlan} />);

            const apiAccess = screen.getByText('API access');
            expect(apiAccess).toBeInTheDocument();
            expect(apiAccess).not.toHaveClass('line-through');
        });

        it('strikes through excluded features for basic plans', () => {
            render(<PlanCard plan={{ ...mockPlan, price_monthly: 50 }} />);

            const apiAccess = screen.getByText('API access');
            expect(apiAccess).toHaveClass('line-through');
        });
    });

    describe('Current Plan State', () => {
        it('shows Current Plan badge when isCurrentPlan is true', () => {
            render(<PlanCard plan={mockPlan} isCurrentPlan={true} />);

            expect(screen.getByText('Current Plan')).toBeInTheDocument();
        });

        it('shows Your Current Plan text instead of button', () => {
            render(<PlanCard plan={mockPlan} isCurrentPlan={true} onSelect={mockOnSelect} />);

            expect(screen.getByText('Your Current Plan')).toBeInTheDocument();
            expect(screen.queryByText('Select Plan')).not.toBeInTheDocument();
        });

        it('applies gradient styling for current plan', () => {
            render(<PlanCard plan={mockPlan} isCurrentPlan={true} />);

            const card = screen.getByText('Professional').closest('div')?.parentElement;
            expect(card).toHaveClass('bg-gradient-to-br');
        });
    });

    describe('Popular Plan State', () => {
        it('shows Popular badge when isPopular is true', () => {
            render(<PlanCard plan={mockPlan} isPopular={true} />);

            expect(screen.getByText('Popular')).toBeInTheDocument();
        });

        it('does not show Popular badge when isCurrentPlan is true', () => {
            render(<PlanCard plan={mockPlan} isPopular={true} isCurrentPlan={true} />);

            expect(screen.queryByText('Popular')).not.toBeInTheDocument();
        });

        it('applies border styling for popular plan', () => {
            render(<PlanCard plan={mockPlan} isPopular={true} />);

            const card = screen.getByText('Professional').closest('div')?.parentElement;
            expect(card).toHaveClass('border-indigo-500');
        });
    });

    describe('Select Button', () => {
        it('renders Select Plan button when onSelect provided', () => {
            render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} />);

            expect(screen.getByText('Select Plan')).toBeInTheDocument();
        });

        it('does not render button when onSelect not provided', () => {
            render(<PlanCard plan={mockPlan} />);

            expect(screen.queryByText('Select Plan')).not.toBeInTheDocument();
        });

        it('calls onSelect with plan id when clicked', async () => {
            render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} />);

            await user.click(screen.getByText('Select Plan'));

            expect(mockOnSelect).toHaveBeenCalledWith('pro');
        });

        it('disables button when disabled prop is true', () => {
            render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} disabled={true} />);

            const button = screen.getByText('Processing...').closest('button');
            expect(button).toBeDisabled();
        });

        it('shows Processing... text when disabled', () => {
            render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} disabled={true} />);

            expect(screen.getByText('Processing...')).toBeInTheDocument();
        });
    });

    describe('Styling Variants', () => {
        it('applies default styling for regular plan', () => {
            render(<PlanCard plan={mockPlan} />);

            const card = screen.getByText('Professional').closest('div')?.parentElement;
            expect(card).toHaveClass('border-gray-200');
        });

        it('applies popular styling for Select button', () => {
            render(<PlanCard plan={mockPlan} isPopular={true} onSelect={mockOnSelect} />);

            const button = screen.getByText('Select Plan').closest('button');
            expect(button).toHaveClass('bg-indigo-600');
        });
    });

    describe('Dark Mode Support', () => {
        it('includes dark mode classes', () => {
            render(<PlanCard plan={mockPlan} />);

            const card = screen.getByText('Professional').closest('div')?.parentElement;
            expect(card).toHaveClass('dark:bg-gray-800');
        });
    });

    describe('Edge Cases', () => {
        it('handles zero price', () => {
            render(<PlanCard plan={{ ...mockPlan, price_monthly: 0, id: 'free', name: 'Free' }} />);

            expect(screen.getByText('$0')).toBeInTheDocument();
        });

        it('handles very high token limits', () => {
            render(<PlanCard plan={{ ...mockPlan, token_limit: 10000000 }} />);

            expect(screen.getByText('10M tokens/month')).toBeInTheDocument();
        });

        it('handles small token limits', () => {
            render(<PlanCard plan={{ ...mockPlan, token_limit: 500 }} />);

            expect(screen.getByText('500 tokens/month')).toBeInTheDocument();
        });
    });
});

