import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlanCard } from '../../components/billing/PlanCard';

describe('Component Test: PlanCard', () => {
    const mockPlan = {
        id: 'plan-1',
        name: 'Basic Plan',
        price_monthly: 29,
        token_limit: 10000,
        storage_limit_gb: 10,
        token_overage_rate: 0.01,
        storage_overage_rate: 0.1,
    };

    it('renders plan name and price', () => {
        render(<PlanCard plan={mockPlan} />);

        expect(screen.getByText('Basic Plan')).toBeInTheDocument();
        expect(screen.getByText('$29')).toBeInTheDocument();
    });

    it('displays current plan badge when isCurrentPlan is true', () => {
        render(<PlanCard plan={mockPlan} isCurrentPlan={true} />);

        expect(screen.getByText('Current Plan')).toBeInTheDocument();
    });

    it('displays popular badge when isPopular is true', () => {
        render(<PlanCard plan={mockPlan} isPopular={true} />);

        expect(screen.getByText('Popular')).toBeInTheDocument();
    });

    it('calls onSelect when select button is clicked', () => {
        const handleSelect = vi.fn();
        render(<PlanCard plan={mockPlan} onSelect={handleSelect} />);

        const selectButton = screen.getByText(/Select|Upgrade/i);
        fireEvent.click(selectButton);

        expect(handleSelect).toHaveBeenCalledWith('plan-1');
    });

    it.skip('disables select button when disabled is true', () => {
        render(<PlanCard plan={mockPlan} onSelect={vi.fn()} disabled={true} />);

        const selectButton = screen.getByText(/Select|Upgrade/i);
        expect(selectButton).toBeDisabled();
    });

    it('displays features list', () => {
        render(<PlanCard plan={mockPlan} />);

        expect(screen.getByText(/tokens\/month/i)).toBeInTheDocument();
        expect(screen.getByText(/GB storage/i)).toBeInTheDocument();
    });

    it('shows API access for premium plans', () => {
        const premiumPlan = {
            ...mockPlan,
            price_monthly: 100,
        };

        render(<PlanCard plan={premiumPlan} />);

        expect(screen.getByText(/API access/i)).toBeInTheDocument();
    });
});

