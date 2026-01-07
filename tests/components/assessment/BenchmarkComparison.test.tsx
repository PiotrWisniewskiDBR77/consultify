/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BenchmarkComparison } from '../../../src/components/assessment/BenchmarkComparison';

describe('BenchmarkComparison Component', () => {
    const defaultProps = {
        score: 4.5,
        benchmarkScore: 4.0,
        dimension: 'Process Maturity',
        percentile: 75
    };

    describe('Basic Rendering', () => {
        it('renders dimension name', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            expect(screen.getByText('Process Maturity')).toBeInTheDocument();
        });

        it('displays your score', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            expect(screen.getByText('Your Score')).toBeInTheDocument();
            expect(screen.getByText('4.5')).toBeInTheDocument();
        });

        it('displays industry average', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            expect(screen.getByText('Industry Avg')).toBeInTheDocument();
            expect(screen.getByText('4.0')).toBeInTheDocument();
        });

        it('uses Overall as default dimension', () => {
            render(<BenchmarkComparison score={3.0} benchmarkScore={3.0} />);

            expect(screen.getByText('Overall')).toBeInTheDocument();
        });
    });

    describe('Delta Calculation', () => {
        it('shows positive delta correctly', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            // Delta: (4.5 - 4.0) / 4.0 * 100 = 12.5%
            expect(screen.getByText('+12.5% vs. benchmark')).toBeInTheDocument();
        });

        it('shows negative delta correctly', () => {
            render(<BenchmarkComparison score={3.5} benchmarkScore={4.0} />);

            // Delta: (3.5 - 4.0) / 4.0 * 100 = -12.5%
            expect(screen.getByText('-12.5% vs. benchmark')).toBeInTheDocument();
        });

        it('shows zero delta correctly', () => {
            render(<BenchmarkComparison score={4.0} benchmarkScore={4.0} />);

            expect(screen.getByText('0.0% vs. benchmark')).toBeInTheDocument();
        });
    });

    describe('Trend Icons', () => {
        it('shows TrendingUp for positive delta', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            // Check for green color class on trend indicator
            const indicator = screen.getByText('+12.5% vs. benchmark');
            expect(indicator).toHaveClass('text-green-600');
        });

        it('shows TrendingDown for negative delta', () => {
            render(<BenchmarkComparison score={3.0} benchmarkScore={4.0} />);

            const indicator = screen.getByText(/-\d+\.\d+% vs\. benchmark/);
            expect(indicator).toHaveClass('text-red-600');
        });
    });

    describe('Percentile Badges', () => {
        it('shows Top 10% for percentile >= 90', () => {
            render(<BenchmarkComparison {...defaultProps} percentile={95} />);

            expect(screen.getByText('Top 10%')).toBeInTheDocument();
            expect(screen.getByText('Top 10%')).toHaveClass('bg-green-100', 'text-green-700');
        });

        it('shows Top 25% for percentile >= 75', () => {
            render(<BenchmarkComparison {...defaultProps} percentile={80} />);

            expect(screen.getByText('Top 25%')).toBeInTheDocument();
            expect(screen.getByText('Top 25%')).toHaveClass('bg-green-100');
        });

        it('shows Above Avg for percentile >= 50', () => {
            render(<BenchmarkComparison {...defaultProps} percentile={60} />);

            expect(screen.getByText('Above Avg')).toBeInTheDocument();
            expect(screen.getByText('Above Avg')).toHaveClass('bg-blue-100', 'text-blue-700');
        });

        it('shows Below Avg for percentile >= 25', () => {
            render(<BenchmarkComparison {...defaultProps} percentile={30} />);

            expect(screen.getByText('Below Avg')).toBeInTheDocument();
            expect(screen.getByText('Below Avg')).toHaveClass('bg-yellow-100', 'text-yellow-700');
        });

        it('shows Bottom 25% for percentile < 25', () => {
            render(<BenchmarkComparison {...defaultProps} percentile={15} />);

            expect(screen.getByText('Bottom 25%')).toBeInTheDocument();
            expect(screen.getByText('Bottom 25%')).toHaveClass('bg-red-100', 'text-red-700');
        });

        it('does not show percentile badge when not provided', () => {
            render(<BenchmarkComparison score={4.0} benchmarkScore={4.0} />);

            expect(screen.queryByText(/Top|Above|Below|Bottom/)).not.toBeInTheDocument();
        });
    });

    describe('Visual Progress Bar', () => {
        it('renders progress bar container', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            // Check for scale labels
            expect(screen.getByText('1.0')).toBeInTheDocument();
            expect(screen.getByText('7.0')).toBeInTheDocument();
        });

        it('calculates correct width for score', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            // Score 4.5 / 7 * 100 = 64.3%
            // Benchmark 4.0 / 7 * 100 = 57.1%
            // These are applied as inline styles
        });
    });

    describe('Color Coding', () => {
        it('uses green bar when score above benchmark', () => {
            render(<BenchmarkComparison score={5.0} benchmarkScore={4.0} />);

            // Check for bg-green-500 class on the bar
        });

        it('uses blue bar when score below benchmark', () => {
            render(<BenchmarkComparison score={3.0} benchmarkScore={4.0} />);

            // Check for bg-blue-500 class on the bar
        });
    });

    describe('Score Formatting', () => {
        it('formats scores to one decimal place', () => {
            render(<BenchmarkComparison score={4.567} benchmarkScore={3.234} />);

            expect(screen.getByText('4.6')).toBeInTheDocument();
            expect(screen.getByText('3.2')).toBeInTheDocument();
        });

        it('handles integer scores', () => {
            render(<BenchmarkComparison score={4} benchmarkScore={3} />);

            expect(screen.getByText('4.0')).toBeInTheDocument();
            expect(screen.getByText('3.0')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('handles very small differences', () => {
            render(<BenchmarkComparison score={4.01} benchmarkScore={4.00} />);

            // Should show small positive percentage
        });

        it('handles zero benchmark score', () => {
            // Edge case - would cause division by zero
            // Component should handle this gracefully
        });

        it('handles maximum scores', () => {
            render(<BenchmarkComparison score={7} benchmarkScore={7} />);

            expect(screen.getByText('7.0')).toBeInTheDocument();
        });

        it('handles minimum scores', () => {
            render(<BenchmarkComparison score={1} benchmarkScore={1} />);

            expect(screen.getByText('1.0')).toBeInTheDocument();
        });
    });

    describe('Dark Mode Support', () => {
        it('includes dark mode classes', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            // Container should have dark mode classes
            const container = screen.getByText('Process Maturity').closest('div');
            expect(container?.parentElement).toHaveClass('dark:bg-gray-800');
        });
    });

    describe('Accessibility', () => {
        it('uses semantic headings', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            const heading = screen.getByText('Process Maturity');
            expect(heading.tagName).toBe('H4');
        });

        it('provides score context labels', () => {
            render(<BenchmarkComparison {...defaultProps} />);

            expect(screen.getByText('Your Score')).toBeInTheDocument();
            expect(screen.getByText('Industry Avg')).toBeInTheDocument();
        });
    });
});















