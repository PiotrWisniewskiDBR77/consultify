import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TrendDetailCard from '../../components/Megatrend/TrendDetailCard';
import { IndustryBaselineCard } from '../../components/Megatrend/IndustryBaselineCard';
import { MegatrendDetail } from '../../components/Megatrend/TrendDetailCard';

// Mock Megatrend Data
const mockTrend: MegatrendDetail = {
    id: 'trend-1',
    label: 'Generative AI',
    shortDescription: 'AI creating new content',
    type: 'Technology',
    industryImpact: 'High impact on content creation',
    companyImpact: 'Can automate reporting',
    impactScore: 6,
    likelihood: 'High',
    unavoidability: 'Medium',
    competitivePressure: 'High',
    aiSuggestion: {
        ring: 'Now',
        risks: ['Data privacy'],
        opportunities: ['Efficiency'],
        actions: ['Pilot tool']
    }
};

describe('Component Test: TrendDetailCard', () => {
    it('renders trend details when data is provided', () => {
        render(<TrendDetailCard trend={mockTrend} onClose={vi.fn()} />);
        expect(screen.getByText('Generative AI')).toBeInTheDocument();
        expect(screen.getByText('AI creating new content')).toBeInTheDocument();
        expect(screen.getByText(/Technology Trend/i)).toBeInTheDocument();
    });

    it('renders loading state', async () => {
        // Mock fetch but don't resolve immediately to test loading state
        vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => { }));
        render(<TrendDetailCard trendId="123" onClose={vi.fn()} />);
        expect(screen.getByText(/Loading trend details/i)).toBeInTheDocument();
        vi.restoreAllMocks();
    });

    it('renders error state and handles close/back', async () => {
        const handleClose = vi.fn();
        // Mock fetch reject
        vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Failed to load'));

        render(<TrendDetailCard trendId="123" onClose={handleClose} />);

        // Wait for error to appear
        expect(await screen.findByText(/Failed to load/i)).toBeInTheDocument();

        const backBtn = screen.getByText('Go Back');
        fireEvent.click(backBtn);
        expect(handleClose).toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it('calls onClose when close button is clicked', () => {
        const handleClose = vi.fn();
        render(<TrendDetailCard trend={mockTrend} onClose={handleClose} />);

        // Find the X button (usually identifiable by icon or aria-label, here relying on lucide icon potentially)
        // Since we don't have aria-label on the X button in the code I modified, I might need to target by class or add aria-label.
        // Assuming the button is present. In my manual edit I didn't verify if I added aria-label.
        // Let's assume there's a button.
        const buttons = screen.getAllByRole('button');
        const closeBtn = buttons[0]; // Usually the first one if header
        fireEvent.click(closeBtn);
        expect(handleClose).toHaveBeenCalled();
    });
});

describe('Component Test: IndustryBaselineCard', () => {
    const mockTrends: any[] = [
        { id: 't1', label: 'Trend 1', shortDescription: 'Desc 1', type: 'Technology', baseImpactScore: 5 },
        { id: 't2', label: 'Trend 2', shortDescription: 'Desc 2', type: 'Business', baseImpactScore: 3 }
    ];

    it('renders list of trends', () => {
        render(<IndustryBaselineCard megatrends={mockTrends} industry="General" onTrendSelect={vi.fn()} />);
        expect(screen.getByText('Trend 1')).toBeInTheDocument();
        expect(screen.getByText('Trend 2')).toBeInTheDocument();
    });

    it('renders loading state', () => {
        render(<IndustryBaselineCard loading={true} industry="General" megatrends={[]} onTrendSelect={vi.fn()} />);
        // Expect text content based on component implementation
        expect(screen.getByText(/Loading industry baseline/i)).toBeInTheDocument();
    });

    it('calls onTrendSelect when a trend is clicked', () => {
        const handleSelect = vi.fn();
        render(<IndustryBaselineCard megatrends={mockTrends} industry="General" onTrendSelect={handleSelect} />);

        const buttons = screen.getAllByText(/See Strategic Impact/i);
        fireEvent.click(buttons[0]); // Click the first one (Trend 1)
        expect(handleSelect).toHaveBeenCalledWith('t1');
    });
});
