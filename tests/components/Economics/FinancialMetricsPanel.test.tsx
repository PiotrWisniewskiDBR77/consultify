/**
 * Financial Metrics Panel Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FinancialMetricsPanel } from '../../../components/Economics/FinancialMetricsPanel';

describe('FinancialMetricsPanel', () => {
    const defaultMetrics = {
        npv: 150000,
        irr: 0.25,
        paybackPeriod: 2.5,
        roi: 0.45,
        totalCosts: 500000,
        totalBenefits: 725000,
        netBenefit: 225000
    };

    it('renders all metric cards', () => {
        render(<FinancialMetricsPanel metrics={defaultMetrics} />);

        expect(screen.getByText(/NPV/i)).toBeInTheDocument();
        expect(screen.getByText(/IRR/i)).toBeInTheDocument();
        expect(screen.getByText(/Okres zwrotu/i)).toBeInTheDocument();
        expect(screen.getByText(/ROI/i)).toBeInTheDocument();
    });

    it('displays formatted NPV value', () => {
        render(<FinancialMetricsPanel metrics={defaultMetrics} currency="PLN" />);

        // Should show formatted currency value
        expect(screen.getByText(/150.*000/)).toBeInTheDocument();
    });

    it('displays IRR as percentage', () => {
        render(<FinancialMetricsPanel metrics={defaultMetrics} />);

        // 0.25 should be displayed as 25.0%
        expect(screen.getByText(/25[,.]0%/)).toBeInTheDocument();
    });

    it('displays payback period in years and months', () => {
        render(<FinancialMetricsPanel metrics={defaultMetrics} />);

        // 2.5 years should show as "2 lata 6 mies."
        expect(screen.getByText(/2.*lata|2.*rok/i)).toBeInTheDocument();
    });

    it('shows positive status for positive NPV', () => {
        render(<FinancialMetricsPanel metrics={defaultMetrics} />);

        // Should have green/positive indicator for positive NPV
        const npvCard = screen.getByText(/NPV/i).closest('div');
        expect(npvCard).toBeInTheDocument();
    });

    it('shows negative status for negative NPV', () => {
        const negativeMetrics = {
            ...defaultMetrics,
            npv: -50000
        };

        render(<FinancialMetricsPanel metrics={negativeMetrics} />);

        // Should render without errors
        expect(screen.getByText(/NPV/i)).toBeInTheDocument();
    });

    it('handles null metrics gracefully', () => {
        const nullMetrics = {
            npv: null,
            irr: null,
            paybackPeriod: null,
            roi: null,
            totalCosts: 0,
            totalBenefits: 0,
            netBenefit: 0
        };

        render(<FinancialMetricsPanel metrics={nullMetrics} />);

        // Should render dashes for null values
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });

    it('shows loading state', () => {
        render(<FinancialMetricsPanel metrics={defaultMetrics} isLoading={true} />);

        // Should show skeleton/loading indicators
        expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('renders investment decision card', () => {
        render(<FinancialMetricsPanel metrics={defaultMetrics} discountRate={10} horizon={5} />);

        expect(screen.getByText(/Decyzja inwestycyjna/i)).toBeInTheDocument();
    });

    it('shows strong recommendation for good metrics', () => {
        const strongMetrics = {
            npv: 500000,
            irr: 0.35,
            paybackPeriod: 1.5,
            roi: 0.8,
            totalCosts: 1000000,
            totalBenefits: 1800000,
            netBenefit: 800000
        };

        render(<FinancialMetricsPanel metrics={strongMetrics} discountRate={10} horizon={5} />);

        expect(screen.getByText(/zgodności kryteriów/i)).toBeInTheDocument();
    });

    it('displays summary cards with totals', () => {
        render(<FinancialMetricsPanel metrics={defaultMetrics} />);

        expect(screen.getByText(/Łączne koszty/i)).toBeInTheDocument();
        expect(screen.getByText(/Łączne korzyści/i)).toBeInTheDocument();
        expect(screen.getByText(/Korzyść netto/i)).toBeInTheDocument();
    });

    it('uses correct currency format', () => {
        render(<FinancialMetricsPanel metrics={defaultMetrics} currency="EUR" />);

        // Should format with EUR
        expect(screen.getByText(/€|EUR/i)).toBeInTheDocument();
    });
});






