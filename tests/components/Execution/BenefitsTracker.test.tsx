/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BenefitsTracker } from '@/components/Execution/BenefitsTracker';

describe('BenefitsTracker Component', () => {
    it('renders the component title', () => {
        render(<BenefitsTracker projectId="test-project" />);
        expect(screen.getByText('Benefits Realization Tracker')).toBeInTheDocument();
    });

    it('renders the summary statistics', () => {
        render(<BenefitsTracker projectId="test-project" />);
        expect(screen.getByText('Total Realized')).toBeInTheDocument();
        expect(screen.getByText('320k PLN')).toBeInTheDocument();
        expect(screen.getByText('Efficiency')).toBeInTheDocument();
    });

    it('renders benefit categories', () => {
        render(<BenefitsTracker projectId="test-project" />);
        expect(screen.getAllByText('Financial').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Efficiency').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Quality').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Strategic').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Compliance').length).toBeGreaterThan(0);
    });

    it('renders the benefits list', () => {
        render(<BenefitsTracker projectId="test-project" />);
        expect(screen.getByText('Cloud Migration Efficiency')).toBeInTheDocument();
        expect(screen.getByText('Mobile App Satisfaction')).toBeInTheDocument();
    });
});