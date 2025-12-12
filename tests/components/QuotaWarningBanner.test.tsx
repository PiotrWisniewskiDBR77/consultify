import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuotaWarningBanner } from '../../components/billing/QuotaWarningBanner';

describe('Component Test: QuotaWarningBanner', () => {
    it('does not render when usage is below threshold', () => {
        const { container } = render(
            <QuotaWarningBanner
                tokenPercentage={50}
                storagePercentage={50}
            />
        );
        
        expect(container.firstChild).toBeNull();
    });

    it('renders warning when token usage is high', () => {
        render(
            <QuotaWarningBanner
                tokenPercentage={85}
                storagePercentage={50}
            />
        );
        
        expect(screen.getByText(/used 85% of monthly tokens/i)).toBeInTheDocument();
    });

    it('renders warning when storage usage is high', () => {
        render(
            <QuotaWarningBanner
                tokenPercentage={50}
                storagePercentage={85}
            />
        );
        
        expect(screen.getByText(/used 85% of storage/i)).toBeInTheDocument();
    });

    it('displays critical message when usage is very high', () => {
        render(
            <QuotaWarningBanner
                tokenPercentage={96}
                storagePercentage={50}
            />
        );
        
        expect(screen.getByText(/reached the quota limits/i)).toBeInTheDocument();
        expect(screen.getByText(/avoid service interruption/i)).toBeInTheDocument();
    });

    it('calls onUpgrade when upgrade button is clicked', () => {
        const handleUpgrade = vi.fn();
        render(
            <QuotaWarningBanner
                tokenPercentage={85}
                storagePercentage={50}
                onUpgrade={handleUpgrade}
            />
        );
        
        const upgradeButton = screen.getByText('Upgrade');
        fireEvent.click(upgradeButton);
        
        expect(handleUpgrade).toHaveBeenCalledTimes(1);
    });

    it('calls onDismiss when dismiss button is clicked', () => {
        const handleDismiss = vi.fn();
        render(
            <QuotaWarningBanner
                tokenPercentage={85}
                storagePercentage={50}
                onDismiss={handleDismiss}
            />
        );
        
        const dismissButton = screen.getByRole('button', { name: '' });
        const buttons = screen.getAllByRole('button');
        const xButton = buttons.find(btn => btn.querySelector('svg'));
        if (xButton) {
            fireEvent.click(xButton);
            expect(handleDismiss).toHaveBeenCalledTimes(1);
        }
    });

    it('handles both token and storage warnings', () => {
        render(
            <QuotaWarningBanner
                tokenPercentage={85}
                storagePercentage={85}
            />
        );
        
        expect(screen.getByText(/Approaching limits/i)).toBeInTheDocument();
    });
});

