import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UsageMeters } from '../../components/billing/UsageMeters';

describe('Component Test: UsageMeters', () => {
    const mockUsage = {
        tokens: {
            used: 5000,
            limit: 10000,
            remaining: 5000,
            percentage: 50,
        },
        storage: {
            usedGB: 5,
            limitGB: 10,
            percentage: 50,
        },
        plan: 'Basic',
    };

    it('renders token and storage meters', () => {
        render(<UsageMeters usage={mockUsage} />);
        
        expect(screen.getByText('Token Usage')).toBeInTheDocument();
        expect(screen.getByText('Storage Usage')).toBeInTheDocument();
    });

    it('displays usage percentages', () => {
        render(<UsageMeters usage={mockUsage} />);
        
        // There might be multiple 50% elements, use getAllByText
        const percentages = screen.getAllByText(/50%/);
        expect(percentages.length).toBeGreaterThan(0);
    });

    it('renders compact version', () => {
        const { container } = render(<UsageMeters usage={mockUsage} compact={true} />);
        
        // Compact version should have different structure
        expect(container.querySelector('.flex.items-center.gap-4')).toBeInTheDocument();
    });

    it('displays warning when usage is high', () => {
        const highUsage = {
            ...mockUsage,
            tokens: { ...mockUsage.tokens, percentage: 85 },
        };
        
        render(<UsageMeters usage={highUsage} />);
        
        expect(screen.getByText(/Warning/i)).toBeInTheDocument();
    });

    it('displays critical warning when usage is very high', () => {
        const criticalUsage = {
            ...mockUsage,
            tokens: { ...mockUsage.tokens, percentage: 96 },
        };
        
        render(<UsageMeters usage={criticalUsage} />);
        
        expect(screen.getByText(/Critical/i)).toBeInTheDocument();
    });
});

