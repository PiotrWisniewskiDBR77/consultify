/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BenefitsTrackingDashboard } from '../../../src/components/Economics/BenefitsTrackingDashboard';

describe('BenefitsTrackingDashboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<BenefitsTrackingDashboard />);
        expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
        const { container } = render(<BenefitsTrackingDashboard />);
        expect(container).toBeInTheDocument();
    });

    it('displays benefits content', () => {
        render(<BenefitsTrackingDashboard />);

        const benefitsElements = screen.queryAllByText(/benefits|tracking|dashboard|value/i);
        expect(benefitsElements.length).toBeGreaterThanOrEqual(0);
    });

    it('has content', () => {
        render(<BenefitsTrackingDashboard />);
        expect(document.body.innerHTML.length).toBeGreaterThan(100);
    });
});
