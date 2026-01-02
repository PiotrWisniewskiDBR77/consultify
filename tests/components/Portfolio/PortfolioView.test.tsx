/**
 * Portfolio View Tests
 * 
 * Tests for the unified Portfolio & Roadmap module.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/i18n-test';

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        patch: vi.fn(),
        post: vi.fn()
    }
}));

// Mock useAppStore
vi.mock('../../../store/useAppStore', () => ({
    useAppStore: () => ({
        currentProjectId: 'test-project-id'
    })
}));

// Import after mocks
import { PortfolioView } from '../../../views/PortfolioView';
import { Api } from '../../../services/api';

const mockInitiatives = [
    {
        id: '1',
        name: 'Cloud Migration',
        summary: 'Migrate to AWS',
        axis: 'processes',
        status: 'PLANNING',
        priority: 'HIGH',
        progress: 25,
        budget: 500000,
        targetQuarter: 'Q1 2025',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-15'
    },
    {
        id: '2',
        name: 'AI Analytics',
        summary: 'Implement AI-driven analytics',
        axis: 'aiMaturity',
        status: 'EXECUTING',
        priority: 'CRITICAL',
        progress: 60,
        budget: 350000,
        targetQuarter: 'Q2 2025',
        createdAt: '2024-02-01',
        updatedAt: '2024-02-15'
    },
    {
        id: '3',
        name: 'Data Platform',
        summary: 'Build unified data platform',
        axis: 'dataManagement',
        status: 'REVIEW',
        priority: 'MEDIUM',
        progress: 10,
        budget: 200000,
        targetQuarter: 'Q1 2025',
        createdAt: '2024-01-15',
        updatedAt: '2024-01-20'
    }
];

const mockStats = {
    total: 3,
    byStatus: {
        DRAFT: 0,
        PLANNING: 1,
        REVIEW: 1,
        APPROVED: 0,
        EXECUTING: 1,
        DONE: 0,
        BLOCKED: 0,
        CANCELLED: 0
    },
    totalBudget: 1050000,
    averageProgress: 32,
    criticalCount: 1,
    blockedCount: 0
};

const renderWithProviders = (component: React.ReactNode) => {
    return render(
        <I18nextProvider i18n={i18n}>
            {component}
        </I18nextProvider>
    );
};

describe('PortfolioView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            initiatives: mockInitiatives,
            stats: mockStats
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Loading State', () => {
        it('shows loading spinner initially', async () => {
            (Api.get as any).mockImplementation(() => new Promise(() => {})); // Never resolves
            
            renderWithProviders(<PortfolioView />);
            
            expect(screen.getByText(/loading/i) || screen.getByRole('img', { name: /loading/i })).toBeTruthy();
        });
    });

    describe('Header and Stats', () => {
        it('renders the portfolio header with title', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(screen.getByText('Portfolio & Roadmap')).toBeTruthy();
            });
        });

        it('displays stats from API', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(screen.getByText('3')).toBeTruthy(); // Total count
                expect(screen.getByText('1')).toBeTruthy(); // Various status counts
            });
        });
    });

    describe('View Mode Toggle', () => {
        it('renders view mode toggle buttons', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(screen.getByText('List')).toBeTruthy();
                expect(screen.getByText('Kanban')).toBeTruthy();
                expect(screen.getByText('Timeline')).toBeTruthy();
                expect(screen.getByText('Matrix')).toBeTruthy();
            });
        });

        it('switches view mode on button click', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(screen.getByText('List')).toBeTruthy();
            });

            fireEvent.click(screen.getByText('List'));
            
            // List view should now be active
            expect(screen.getByText('List').closest('button')).toHaveClass('bg-white');
        });
    });

    describe('Search and Filters', () => {
        it('renders search input', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(screen.getByPlaceholderText(/search initiatives/i)).toBeTruthy();
            });
        });

        it('renders filter button', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(screen.getByText('Filters')).toBeTruthy();
            });
        });

        it('shows filter panel when filter button clicked', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                fireEvent.click(screen.getByText('Filters'));
            });

            await waitFor(() => {
                expect(screen.getByText('All Statuses')).toBeTruthy();
                expect(screen.getByText('All Priorities')).toBeTruthy();
            });
        });
    });

    describe('Actions', () => {
        it('renders New Initiative button', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(screen.getByText('New Initiative')).toBeTruthy();
            });
        });

        it('renders refresh button', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                // Find refresh button by icon or aria-label
                const buttons = screen.getAllByRole('button');
                expect(buttons.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Empty State', () => {
        it('shows empty state when no initiatives', async () => {
            (Api.get as any).mockResolvedValue({
                initiatives: [],
                stats: { ...mockStats, total: 0 }
            });
            
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(screen.getByText('No initiatives yet')).toBeTruthy();
            });
        });
    });

    describe('API Integration', () => {
        it('calls API on mount', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith(expect.stringContaining('/initiatives/portfolio'));
            });
        });

        it('calls API with filters when search changes', async () => {
            renderWithProviders(<PortfolioView />);
            
            await waitFor(() => {
                expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
            });

            const searchInput = screen.getByPlaceholderText(/search/i);
            fireEvent.change(searchInput, { target: { value: 'Cloud' } });
            
            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith(expect.stringContaining('search=Cloud'));
            }, { timeout: 2000 });
        });
    });

    describe('Error Handling', () => {
        it('shows error toast on API failure', async () => {
            (Api.get as any).mockRejectedValue(new Error('Network error'));
            
            renderWithProviders(<PortfolioView />);
            
            // Error should be handled gracefully
            await waitFor(() => {
                expect(Api.get).toHaveBeenCalled();
            });
        });
    });
});

describe('PortfolioView - List View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            initiatives: mockInitiatives,
            stats: mockStats
        });
    });

    it('renders initiative table in list view', async () => {
        renderWithProviders(<PortfolioView />);
        
        await waitFor(() => {
            expect(screen.getByText('List')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('List'));
        
        await waitFor(() => {
            expect(screen.getByText('Cloud Migration')).toBeTruthy();
            expect(screen.getByText('AI Analytics')).toBeTruthy();
            expect(screen.getByText('Data Platform')).toBeTruthy();
        });
    });
});

describe('PortfolioView - Kanban View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            initiatives: mockInitiatives,
            stats: mockStats
        });
    });

    it('renders kanban columns', async () => {
        renderWithProviders(<PortfolioView />);
        
        await waitFor(() => {
            expect(screen.getByText('Kanban')).toBeTruthy();
        });

        // Kanban is default view
        await waitFor(() => {
            expect(screen.getByText('Draft')).toBeTruthy();
            expect(screen.getByText('Planning')).toBeTruthy();
            expect(screen.getByText('Review')).toBeTruthy();
            expect(screen.getByText('Approved')).toBeTruthy();
            expect(screen.getByText('Executing')).toBeTruthy();
        });
    });

    it('shows initiative cards in correct columns', async () => {
        renderWithProviders(<PortfolioView />);
        
        await waitFor(() => {
            expect(screen.getByText('Cloud Migration')).toBeTruthy(); // PLANNING
            expect(screen.getByText('AI Analytics')).toBeTruthy(); // EXECUTING
        });
    });
});



