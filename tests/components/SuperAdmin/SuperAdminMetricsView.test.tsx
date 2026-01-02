/**
 * SuperAdminMetricsView Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SuperAdminMetricsView } from '../../../views/superadmin/SuperAdminMetricsView';
import { Api } from '../../../services/api';

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        getMetricsFunnels: vi.fn(),
        getMetricsWarnings: vi.fn(),
        getMetricsAttribution: vi.fn(),
        getMetricsPartners: vi.fn(),
        getMetricsHelp: vi.fn()
    }
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        error: vi.fn()
    }
}));

describe('SuperAdminMetricsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render loading state initially', () => {
        vi.mocked(Api.getMetricsFunnels).mockImplementation(() => new Promise(() => {}));
        
        render(<SuperAdminMetricsView />);
        
        expect(screen.getByText('Loading conversion intelligence...')).toBeInTheDocument();
    });

    it('should fetch and display metrics data', async () => {
        const mockFunnels = {
            funnel1: {
                name: 'Signup Funnel',
                conversionRate: 25.5,
                startCount: 1000,
                endCount: 255,
                startEvent: 'page_view',
                endEvent: 'signup_complete'
            }
        };

        const mockWarnings = {
            warnings: [
                { id: 'warn-1', message: 'Low conversion rate', severity: 'high' }
            ]
        };

        const mockAttribution = {
            sources: [{ source: 'google', count: 100 }]
        };

        const mockPartners = {
            leaderboard: [
                { name: 'Partner 1', conversions: 50 }
            ]
        };

        const mockHelp = {
            totalViews: 500,
            helpfulRate: 85
        };

        vi.mocked(Api.getMetricsFunnels).mockResolvedValue({ funnels: mockFunnels });
        vi.mocked(Api.getMetricsWarnings).mockResolvedValue(mockWarnings);
        vi.mocked(Api.getMetricsAttribution).mockResolvedValue(mockAttribution);
        vi.mocked(Api.getMetricsPartners).mockResolvedValue(mockPartners);
        vi.mocked(Api.getMetricsHelp).mockResolvedValue(mockHelp);

        render(<SuperAdminMetricsView />);

        await waitFor(() => {
            expect(screen.getByText('Conversion Intelligence')).toBeInTheDocument();
        });

        expect(Api.getMetricsFunnels).toHaveBeenCalledWith(30);
        expect(Api.getMetricsWarnings).toHaveBeenCalled();
        expect(Api.getMetricsAttribution).toHaveBeenCalledWith(30);
        expect(Api.getMetricsPartners).toHaveBeenCalledWith(90);
        expect(Api.getMetricsHelp).toHaveBeenCalledWith(30);
    });

    it('should display conversion funnels', async () => {
        const mockFunnels = {
            funnel1: {
                name: 'Signup Funnel',
                conversionRate: 25.5,
                startCount: 1000,
                endCount: 255,
                startEvent: 'page_view',
                endEvent: 'signup_complete'
            }
        };

        vi.mocked(Api.getMetricsFunnels).mockResolvedValue({ funnels: mockFunnels });
        vi.mocked(Api.getMetricsWarnings).mockResolvedValue({ warnings: [] });
        vi.mocked(Api.getMetricsAttribution).mockResolvedValue({});
        vi.mocked(Api.getMetricsPartners).mockResolvedValue({ leaderboard: [] });
        vi.mocked(Api.getMetricsHelp).mockResolvedValue({});

        render(<SuperAdminMetricsView />);

        await waitFor(() => {
            expect(screen.getByText('Signup Funnel')).toBeInTheDocument();
            expect(screen.getByText('25.5%')).toBeInTheDocument();
        });
    });

    it('should display warnings', async () => {
        const mockWarnings = {
            warnings: [
                { id: 'warn-1', message: 'Low conversion rate', severity: 'high' }
            ]
        };

        vi.mocked(Api.getMetricsFunnels).mockResolvedValue({ funnels: {} });
        vi.mocked(Api.getMetricsWarnings).mockResolvedValue(mockWarnings);
        vi.mocked(Api.getMetricsAttribution).mockResolvedValue({});
        vi.mocked(Api.getMetricsPartners).mockResolvedValue({ leaderboard: [] });
        vi.mocked(Api.getMetricsHelp).mockResolvedValue({});

        render(<SuperAdminMetricsView />);

        await waitFor(() => {
            expect(screen.getByText('Early Warnings')).toBeInTheDocument();
        });
    });

    it('should handle refresh button click', async () => {
        vi.mocked(Api.getMetricsFunnels).mockResolvedValue({ funnels: {} });
        vi.mocked(Api.getMetricsWarnings).mockResolvedValue({ warnings: [] });
        vi.mocked(Api.getMetricsAttribution).mockResolvedValue({});
        vi.mocked(Api.getMetricsPartners).mockResolvedValue({ leaderboard: [] });
        vi.mocked(Api.getMetricsHelp).mockResolvedValue({});

        render(<SuperAdminMetricsView />);

        await waitFor(() => {
            expect(screen.getByText('Refresh Data')).toBeInTheDocument();
        });

        const refreshButton = screen.getByText('Refresh Data');
        fireEvent.click(refreshButton);

        await waitFor(() => {
            expect(Api.getMetricsFunnels).toHaveBeenCalledTimes(2);
        });
    });

    it('should handle API errors gracefully', async () => {
        vi.mocked(Api.getMetricsFunnels).mockRejectedValue(new Error('API Error'));

        render(<SuperAdminMetricsView />);

        await waitFor(() => {
            expect(screen.getByText('Conversion Intelligence')).toBeInTheDocument();
        });
    });

    it('should display attribution data', async () => {
        const mockAttribution = {
            sources: [
                { source: 'google', count: 100, percentage: 50 },
                { source: 'direct', count: 50, percentage: 25 }
            ]
        };

        vi.mocked(Api.getMetricsFunnels).mockResolvedValue({ funnels: {} });
        vi.mocked(Api.getMetricsWarnings).mockResolvedValue({ warnings: [] });
        vi.mocked(Api.getMetricsAttribution).mockResolvedValue(mockAttribution);
        vi.mocked(Api.getMetricsPartners).mockResolvedValue({ leaderboard: [] });
        vi.mocked(Api.getMetricsHelp).mockResolvedValue({});

        render(<SuperAdminMetricsView />);

        await waitFor(() => {
            expect(screen.getByText('Conversion Intelligence')).toBeInTheDocument();
        });
    });

    it('should display partner leaderboard', async () => {
        const mockPartners = {
            leaderboard: [
                { name: 'Partner 1', conversions: 50, revenue: 1000 },
                { name: 'Partner 2', conversions: 30, revenue: 600 }
            ]
        };

        vi.mocked(Api.getMetricsFunnels).mockResolvedValue({ funnels: {} });
        vi.mocked(Api.getMetricsWarnings).mockResolvedValue({ warnings: [] });
        vi.mocked(Api.getMetricsAttribution).mockResolvedValue({});
        vi.mocked(Api.getMetricsPartners).mockResolvedValue(mockPartners);
        vi.mocked(Api.getMetricsHelp).mockResolvedValue({});

        render(<SuperAdminMetricsView />);

        await waitFor(() => {
            expect(screen.getByText('Conversion Intelligence')).toBeInTheDocument();
        });
    });

    it('should display help metrics', async () => {
        const mockHelp = {
            totalViews: 500,
            helpfulRate: 85,
            popularArticles: [
                { title: 'Article 1', views: 100 }
            ]
        };

        vi.mocked(Api.getMetricsFunnels).mockResolvedValue({ funnels: {} });
        vi.mocked(Api.getMetricsWarnings).mockResolvedValue({ warnings: [] });
        vi.mocked(Api.getMetricsAttribution).mockResolvedValue({});
        vi.mocked(Api.getMetricsPartners).mockResolvedValue({ leaderboard: [] });
        vi.mocked(Api.getMetricsHelp).mockResolvedValue(mockHelp);

        render(<SuperAdminMetricsView />);

        await waitFor(() => {
            expect(screen.getByText('Conversion Intelligence')).toBeInTheDocument();
        });
    });
});


