/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ROIPaybackChart } from '../../components/ROIPaybackChart';

const mockEconomics = {
    totalCost: 100000,
    totalAnnualBenefit: 50000,
    overallROI: 50,
    paybackPeriodYears: 2
};

describe('ROIPaybackChart Component', () => {
    it('renders ROI payback chart', () => {
        render(<ROIPaybackChart economics={mockEconomics} />);

        expect(screen.getByText(/Cumulative Cash Flow/i)).toBeInTheDocument();
    });

    it('displays chart SVG', () => {
        const { container } = render(<ROIPaybackChart economics={mockEconomics} />);

        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders data points for 5 years', () => {
        const { container } = render(<ROIPaybackChart economics={mockEconomics} />);

        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(6); // Year 0-5
    });
});














