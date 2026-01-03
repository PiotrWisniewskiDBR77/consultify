/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageMeters } from '../../../components/billing/UsageMeters';

const mockUsageNormal = {
    tokens: {
        used: 500000,
        limit: 1000000,
        remaining: 500000,
        percentage: 50
    },
    storage: {
        usedGB: 10,
        limitGB: 50,
        percentage: 20
    },
    plan: 'Professional',
    periodEnd: '2024-02-01T00:00:00Z'
};

const mockUsageWarning = {
    tokens: {
        used: 850000,
        limit: 1000000,
        remaining: 150000,
        percentage: 85
    },
    storage: {
        usedGB: 40,
        limitGB: 50,
        percentage: 80
    },
    plan: 'Professional'
};

const mockUsageCritical = {
    tokens: {
        used: 980000,
        limit: 1000000,
        remaining: 20000,
        percentage: 98
    },
    storage: {
        usedGB: 49,
        limitGB: 50,
        percentage: 98
    },
    plan: 'Professional'
};

describe('UsageMeters Component', () => {
    describe('Compact Mode', () => {
        it('renders compact version', () => {
            render(<UsageMeters usage={mockUsageNormal} compact={true} />);

            // Should have progress bars
            const progressBars = document.querySelectorAll('.w-24');
            expect(progressBars.length).toBe(2);
        });

        it('shows percentage in compact mode', () => {
            render(<UsageMeters usage={mockUsageNormal} compact={true} />);

            expect(screen.getByText('50%')).toBeInTheDocument();
            expect(screen.getByText('20%')).toBeInTheDocument();
        });
    });

    describe('Full Mode', () => {
        it('renders Token Usage section', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByText('Token Usage')).toBeInTheDocument();
        });

        it('renders Storage Usage section', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByText('Storage Usage')).toBeInTheDocument();
        });

        it('displays plan name', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByText('Professional Plan')).toBeInTheDocument();
        });

        it('formats token counts correctly', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByText('500K / 1M tokens')).toBeInTheDocument();
        });

        it('formats storage correctly', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByText('10.00 GB / 50 GB')).toBeInTheDocument();
        });

        it('shows remaining tokens', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByText('500K tokens remaining this period')).toBeInTheDocument();
        });

        it('shows remaining storage', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByText('40.00 GB available')).toBeInTheDocument();
        });
    });

    describe('Period End Display', () => {
        it('shows period end date when provided', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByText(/Usage resets on/)).toBeInTheDocument();
        });

        it('does not show period end when not provided', () => {
            render(<UsageMeters usage={mockUsageWarning} />);

            expect(screen.queryByText(/Usage resets on/)).not.toBeInTheDocument();
        });
    });

    describe('Status Colors', () => {
        it('applies emerald color for normal usage (<60%)', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            const progressBars = document.querySelectorAll('.bg-emerald-500');
            expect(progressBars.length).toBeGreaterThan(0);
        });

        it('applies orange color for warning usage (80-95%)', () => {
            render(<UsageMeters usage={mockUsageWarning} />);

            const progressBars = document.querySelectorAll('.bg-orange-500');
            expect(progressBars.length).toBeGreaterThan(0);
        });

        it('applies red color for critical usage (>=95%)', () => {
            render(<UsageMeters usage={mockUsageCritical} />);

            const progressBars = document.querySelectorAll('.bg-red-500');
            expect(progressBars.length).toBeGreaterThan(0);
        });
    });

    describe('Warning Indicators', () => {
        it('shows Warning badge at 80% usage', () => {
            render(<UsageMeters usage={mockUsageWarning} />);

            expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
        });

        it('shows Critical badge at 95% usage', () => {
            render(<UsageMeters usage={mockUsageCritical} />);

            expect(screen.getAllByText('Critical').length).toBeGreaterThan(0);
        });

        it('does not show warning at normal usage', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.queryByText('Warning')).not.toBeInTheDocument();
            expect(screen.queryByText('Critical')).not.toBeInTheDocument();
        });
    });

    describe('Number Formatting', () => {
        it('formats millions correctly', () => {
            const usage = {
                ...mockUsageNormal,
                tokens: {
                    used: 5000000,
                    limit: 10000000,
                    remaining: 5000000,
                    percentage: 50
                }
            };

            render(<UsageMeters usage={usage} />);

            expect(screen.getByText('5M / 10M tokens')).toBeInTheDocument();
        });

        it('formats thousands correctly', () => {
            const usage = {
                ...mockUsageNormal,
                tokens: {
                    used: 5000,
                    limit: 10000,
                    remaining: 5000,
                    percentage: 50
                }
            };

            render(<UsageMeters usage={usage} />);

            expect(screen.getByText('5K / 10K tokens')).toBeInTheDocument();
        });

        it('keeps small numbers as-is', () => {
            const usage = {
                ...mockUsageNormal,
                tokens: {
                    used: 500,
                    limit: 1000,
                    remaining: 500,
                    percentage: 50
                }
            };

            render(<UsageMeters usage={usage} />);

            expect(screen.getByText('500 / 1000 tokens')).toBeInTheDocument();
        });
    });

    describe('Progress Bar Width', () => {
        it('caps progress bar at 100%', () => {
            const usage = {
                ...mockUsageCritical,
                tokens: {
                    used: 1100000,
                    limit: 1000000,
                    remaining: -100000,
                    percentage: 110
                }
            };

            render(<UsageMeters usage={usage} />);

            // The progress bar should be capped at 100%
            const progressBar = document.querySelector('[style*="width: 100%"]');
            expect(progressBar).toBeTruthy();
        });
    });

    describe('Accessibility', () => {
        it('has heading for Token Usage', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByRole('heading', { level: 3, name: 'Token Usage' })).toBeInTheDocument();
        });

        it('has heading for Storage Usage', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            expect(screen.getByRole('heading', { level: 3, name: 'Storage Usage' })).toBeInTheDocument();
        });
    });

    describe('Dark Mode Support', () => {
        it('includes dark mode classes', () => {
            render(<UsageMeters usage={mockUsageNormal} />);

            const containers = document.querySelectorAll('.dark\\:bg-gray-800');
            expect(containers.length).toBeGreaterThan(0);
        });
    });
});






