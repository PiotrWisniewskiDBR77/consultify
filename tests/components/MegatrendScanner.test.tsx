import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TrendDetailCard from '@/components/Megatrend/TrendDetailCard';
import { IndustryBaselineCard } from '@/components/Megatrend/IndustryBaselineCard';
import type { MegatrendDetail } from '@/components/Megatrend/TrendDetailCard';

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

const mockTrends: Array<{ id: string, label: string, shortDescription: string, type: string, baseImpactScore: number }> = [
    { id: 't1', label: 'Trend 1', shortDescription: 'Desc 1', type: 'Technology', baseImpactScore: 5 },
    { id: 't2', label: 'Trend 2', shortDescription: 'Desc 2', type: 'Business', baseImpactScore: 3 }
];

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

        const buttons = screen.getAllByRole('button');
        const closeBtn = buttons[0];
        fireEvent.click(closeBtn);
        expect(handleClose).toHaveBeenCalled();
    });
});

describe('Component Test: IndustryBaselineCard', () => {
    it('renders list of trends', () => {
        render(<IndustryBaselineCard megatrends={mockTrends} industry="General" onTrendSelect={vi.fn()} />);
        expect(screen.getByText('Trend 1')).toBeInTheDocument();
        expect(screen.getByText('Trend 2')).toBeInTheDocument();
    });

    it('renders loading state', () => {
        render(<IndustryBaselineCard loading={true} industry="General" megatrends={[]} onTrendSelect={vi.fn()} />);
        expect(screen.getByText(/Loading industry baseline/i)).toBeInTheDocument();
    });

    it('calls onTrendSelect when a trend is clicked', () => {
        const handleSelect = vi.fn();
        render(<IndustryBaselineCard megatrends={mockTrends} industry="General" onTrendSelect={handleSelect} />);

        const buttons = screen.getAllByText(/See Strategic Impact/i);
        fireEvent.click(buttons[0]);
        expect(handleSelect).toHaveBeenCalledWith('t1');
    });
});
