/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfidenceBadge from '../../../components/ai/ConfidenceBadge';

describe('ConfidenceBadge Component', () => {
    describe('Percentage Display', () => {
        it('displays confidence as percentage', () => {
            render(<ConfidenceBadge confidence={0.85} />);

            expect(screen.getByText('85%')).toBeInTheDocument();
        });

        it('rounds percentage correctly', () => {
            render(<ConfidenceBadge confidence={0.876} />);

            expect(screen.getByText('88%')).toBeInTheDocument();
        });

        it('handles 0 confidence', () => {
            render(<ConfidenceBadge confidence={0} />);

            expect(screen.getByText('0%')).toBeInTheDocument();
        });

        it('handles 100% confidence', () => {
            render(<ConfidenceBadge confidence={1} />);

            expect(screen.getByText('100%')).toBeInTheDocument();
        });
    });

    describe('Confidence Labels', () => {
        it('shows Low for confidence < 0.4', () => {
            render(<ConfidenceBadge confidence={0.3} />);

            expect(screen.getByText('Low')).toBeInTheDocument();
        });

        it('shows Medium for confidence 0.4-0.7', () => {
            render(<ConfidenceBadge confidence={0.5} />);

            expect(screen.getByText('Medium')).toBeInTheDocument();
        });

        it('shows High for confidence > 0.7', () => {
            render(<ConfidenceBadge confidence={0.85} />);

            expect(screen.getByText('High')).toBeInTheDocument();
        });

        it('hides label when showLabel is false', () => {
            render(<ConfidenceBadge confidence={0.85} showLabel={false} />);

            expect(screen.queryByText('High')).not.toBeInTheDocument();
            expect(screen.getByText('85%')).toBeInTheDocument();
        });
    });

    describe('Color Coding', () => {
        it('applies red colors for low confidence', () => {
            render(<ConfidenceBadge confidence={0.25} />);

            const badge = screen.getByText('Low').closest('span');
            expect(badge).toHaveClass('bg-red-100');
            expect(badge).toHaveClass('text-red-700');
        });

        it('applies amber colors for medium confidence', () => {
            render(<ConfidenceBadge confidence={0.55} />);

            const badge = screen.getByText('Medium').closest('span');
            expect(badge).toHaveClass('bg-amber-100');
            expect(badge).toHaveClass('text-amber-700');
        });

        it('applies green colors for high confidence', () => {
            render(<ConfidenceBadge confidence={0.8} />);

            const badge = screen.getByText('High').closest('span');
            expect(badge).toHaveClass('bg-green-100');
            expect(badge).toHaveClass('text-green-700');
        });
    });

    describe('Boundary Conditions', () => {
        it('treats exactly 0.4 as medium', () => {
            render(<ConfidenceBadge confidence={0.4} />);

            expect(screen.getByText('Medium')).toBeInTheDocument();
        });

        it('treats exactly 0.7 as medium', () => {
            render(<ConfidenceBadge confidence={0.7} />);

            expect(screen.getByText('Medium')).toBeInTheDocument();
        });

        it('treats 0.71 as high', () => {
            render(<ConfidenceBadge confidence={0.71} />);

            expect(screen.getByText('High')).toBeInTheDocument();
        });

        it('treats 0.39 as low', () => {
            render(<ConfidenceBadge confidence={0.39} />);

            expect(screen.getByText('Low')).toBeInTheDocument();
        });
    });

    describe('Normalization', () => {
        it('clamps values above 1 to 100%', () => {
            render(<ConfidenceBadge confidence={1.5} />);

            expect(screen.getByText('100%')).toBeInTheDocument();
        });

        it('clamps negative values to 0%', () => {
            render(<ConfidenceBadge confidence={-0.5} />);

            expect(screen.getByText('0%')).toBeInTheDocument();
        });
    });

    describe('Size Variants', () => {
        it('applies sm size classes', () => {
            render(<ConfidenceBadge confidence={0.5} size="sm" />);

            const badge = screen.getByText('Medium').closest('span');
            expect(badge).toHaveClass('text-xs');
            expect(badge).toHaveClass('px-2');
        });

        it('applies md size classes (default)', () => {
            render(<ConfidenceBadge confidence={0.5} />);

            const badge = screen.getByText('Medium').closest('span');
            expect(badge).toHaveClass('text-sm');
            expect(badge).toHaveClass('px-2.5');
        });

        it('applies lg size classes', () => {
            render(<ConfidenceBadge confidence={0.5} size="lg" />);

            const badge = screen.getByText('Medium').closest('span');
            expect(badge).toHaveClass('text-base');
            expect(badge).toHaveClass('px-3');
        });
    });

    describe('Dot Indicator', () => {
        it('renders colored dot for sm size', () => {
            render(<ConfidenceBadge confidence={0.8} size="sm" />);

            const dot = document.querySelector('.w-1\\.5.h-1\\.5');
            expect(dot).toHaveClass('bg-green-500');
        });

        it('renders colored dot for md size', () => {
            render(<ConfidenceBadge confidence={0.8} />);

            const dot = document.querySelector('.w-2.h-2');
            expect(dot).toHaveClass('bg-green-500');
        });

        it('renders colored dot for lg size', () => {
            render(<ConfidenceBadge confidence={0.8} size="lg" />);

            const dot = document.querySelector('.w-2\\.5.h-2\\.5');
            expect(dot).toHaveClass('bg-green-500');
        });

        it('dot color matches confidence level - red', () => {
            render(<ConfidenceBadge confidence={0.2} />);

            const dot = document.querySelector('.rounded-full.bg-red-500');
            expect(dot).toBeTruthy();
        });

        it('dot color matches confidence level - amber', () => {
            render(<ConfidenceBadge confidence={0.5} />);

            const dot = document.querySelector('.rounded-full.bg-amber-500');
            expect(dot).toBeTruthy();
        });
    });

    describe('Tooltip', () => {
        it('has tooltip with explanation', async () => {
            render(<ConfidenceBadge confidence={0.8} />);

            // Tooltip content is in the component
            const tooltipText = "Confidence score based on evidence consistency and reasoning strength";
            const container = document.querySelector('.group');
            expect(container?.innerHTML).toContain('Confidence score');
        });

        it('has cursor-help styling', () => {
            render(<ConfidenceBadge confidence={0.8} />);

            const badge = screen.getByText('High').closest('span');
            expect(badge).toHaveClass('cursor-help');
        });
    });

    describe('Dark Mode Support', () => {
        it('includes dark mode classes for low confidence', () => {
            render(<ConfidenceBadge confidence={0.2} />);

            const badge = screen.getByText('Low').closest('span');
            expect(badge).toHaveClass('dark:bg-red-900/30');
            expect(badge).toHaveClass('dark:text-red-400');
        });

        it('includes dark mode classes for medium confidence', () => {
            render(<ConfidenceBadge confidence={0.5} />);

            const badge = screen.getByText('Medium').closest('span');
            expect(badge).toHaveClass('dark:bg-amber-900/30');
            expect(badge).toHaveClass('dark:text-amber-400');
        });

        it('includes dark mode classes for high confidence', () => {
            render(<ConfidenceBadge confidence={0.8} />);

            const badge = screen.getByText('High').closest('span');
            expect(badge).toHaveClass('dark:bg-green-900/30');
            expect(badge).toHaveClass('dark:text-green-400');
        });
    });

    describe('Ring Styling', () => {
        it('has ring-inset class', () => {
            render(<ConfidenceBadge confidence={0.8} />);

            const badge = screen.getByText('High').closest('span');
            expect(badge).toHaveClass('ring-1');
            expect(badge).toHaveClass('ring-inset');
        });
    });

    describe('Accessibility', () => {
        it('renders as inline-flex', () => {
            render(<ConfidenceBadge confidence={0.8} />);

            const container = document.querySelector('.inline-flex');
            expect(container).toBeTruthy();
        });

        it('shows percentage as text', () => {
            render(<ConfidenceBadge confidence={0.8} />);

            expect(screen.getByText('80%')).toBeInTheDocument();
        });
    });
});






