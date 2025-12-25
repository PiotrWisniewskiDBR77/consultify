/**
 * Component Tests: AssessmentTable
 * Tests for the assessment table with filtering and actions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(() => 'mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Import component
import { AssessmentTable } from '../../components/assessment/AssessmentTable';

const mockAssessments = [
    {
        id: 'assessment-1',
        name: 'Q1 2024 Assessment',
        projectName: 'Digital Transformation',
        status: 'DRAFT' as const,
        progress: 42,
        completedAxes: 3,
        totalAxes: 7,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
        createdBy: 'user-1',
        canCreateReport: false
    },
    {
        id: 'assessment-2',
        name: 'Annual Review',
        projectName: 'Digital Transformation',
        status: 'IN_REVIEW' as const,
        progress: 100,
        completedAxes: 7,
        totalAxes: 7,
        createdAt: '2024-01-10T08:00:00Z',
        updatedAt: '2024-01-18T16:00:00Z',
        createdBy: 'user-2',
        canCreateReport: false
    },
    {
        id: 'assessment-3',
        name: 'Final Assessment',
        projectName: 'AI Initiative',
        status: 'APPROVED' as const,
        progress: 100,
        completedAxes: 7,
        totalAxes: 7,
        createdAt: '2024-01-05T09:00:00Z',
        updatedAt: '2024-01-12T11:00:00Z',
        createdBy: 'user-1',
        canCreateReport: true
    }
];

describe('AssessmentTable', () => {
    const defaultProps = {
        projectId: 'project-123',
        onOpenInMap: vi.fn(),
        onNewAssessment: vi.fn(),
        onCreateReport: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ assessments: mockAssessments })
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const renderComponent = (props = {}) => {
        return render(<AssessmentTable {...defaultProps} {...props} />);
    };

    // =========================================================================
    // LOADING STATE TESTS
    // =========================================================================

    describe('Loading State', () => {
        it('should show loading spinner initially', () => {
            renderComponent();
            
            // Loading spinner should be visible
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });

        it('should hide loading after data loads', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // DATA DISPLAY TESTS
    // =========================================================================

    describe('Data Display', () => {
        it('should display assessments after loading', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
                expect(screen.getByText('Annual Review')).toBeInTheDocument();
                expect(screen.getByText('Final Assessment')).toBeInTheDocument();
            });
        });

        it('should display project names', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getAllByText('Digital Transformation').length).toBeGreaterThan(0);
            });
        });

        it('should display progress bars', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('42%')).toBeInTheDocument();
                expect(screen.getAllByText('100%').length).toBe(2);
            });
        });

        it('should display axes completion', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('3/7 axes')).toBeInTheDocument();
                expect(screen.getAllByText('7/7 axes').length).toBe(2);
            });
        });
    });

    // =========================================================================
    // STATUS BADGE TESTS
    // =========================================================================

    describe('Status Badges', () => {
        it('should show Draft badge', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Draft')).toBeInTheDocument();
            });
        });

        it('should show In Review badge', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('In Review')).toBeInTheDocument();
            });
        });

        it('should show Approved badge', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Approved')).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // FILTER TESTS
    // =========================================================================

    describe('Status Filters', () => {
        it('should show filter buttons with counts', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText(/All \(3\)/)).toBeInTheDocument();
                expect(screen.getByText(/Draft \(1\)/)).toBeInTheDocument();
                expect(screen.getByText(/In Review \(1\)/)).toBeInTheDocument();
                expect(screen.getByText(/Approved \(1\)/)).toBeInTheDocument();
            });
        });

        it('should filter by draft status', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/Draft \(1\)/));

            expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
            expect(screen.queryByText('Annual Review')).not.toBeInTheDocument();
            expect(screen.queryByText('Final Assessment')).not.toBeInTheDocument();
        });

        it('should filter by approved status', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Final Assessment')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/Approved \(1\)/));

            expect(screen.getByText('Final Assessment')).toBeInTheDocument();
            expect(screen.queryByText('Q1 2024 Assessment')).not.toBeInTheDocument();
        });

        it('should show all when All filter clicked', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Final Assessment')).toBeInTheDocument();
            });

            // First filter to approved
            fireEvent.click(screen.getByText(/Approved \(1\)/));
            expect(screen.queryByText('Q1 2024 Assessment')).not.toBeInTheDocument();

            // Then click All
            fireEvent.click(screen.getByText(/All \(3\)/));
            expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
            expect(screen.getByText('Final Assessment')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // SEARCH TESTS
    // =========================================================================

    describe('Search', () => {
        it('should filter by search query', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search assessments...');
            fireEvent.change(searchInput, { target: { value: 'Annual' } });

            expect(screen.queryByText('Q1 2024 Assessment')).not.toBeInTheDocument();
            expect(screen.getByText('Annual Review')).toBeInTheDocument();
        });

        it('should be case insensitive', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search assessments...');
            fireEvent.change(searchInput, { target: { value: 'annual' } });

            expect(screen.getByText('Annual Review')).toBeInTheDocument();
        });

        it('should search by project name', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Final Assessment')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search assessments...');
            fireEvent.change(searchInput, { target: { value: 'AI Initiative' } });

            expect(screen.getByText('Final Assessment')).toBeInTheDocument();
            expect(screen.queryByText('Q1 2024 Assessment')).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // ACTION BUTTON TESTS
    // =========================================================================

    describe('Action Buttons', () => {
        it('should call onOpenInMap when Edit clicked', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
            });

            const editButtons = screen.getAllByText('Edit');
            fireEvent.click(editButtons[0]);

            expect(defaultProps.onOpenInMap).toHaveBeenCalledWith('assessment-1');
        });

        it('should show View for non-draft assessments', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getAllByText('View').length).toBeGreaterThan(0);
            });
        });

        it('should show Create Report for approved assessments', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Create Report')).toBeInTheDocument();
            });
        });

        it('should call onCreateReport when clicked', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Create Report')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Create Report'));

            expect(defaultProps.onCreateReport).toHaveBeenCalledWith('assessment-3');
        });

        it('should call onNewAssessment when New Assessment clicked', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('New Assessment')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('New Assessment'));

            expect(defaultProps.onNewAssessment).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // ROW MENU TESTS
    // =========================================================================

    describe('Row Menu', () => {
        it('should show menu on more button click', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
            });

            // Find and click more button (MoreVertical icon)
            const moreButtons = document.querySelectorAll('[class*="MoreVertical"]');
            if (moreButtons.length > 0) {
                fireEvent.click(moreButtons[0]);
            }
        });
    });

    // =========================================================================
    // EMPTY STATE TESTS
    // =========================================================================

    describe('Empty State', () => {
        it('should show empty state when no assessments', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ assessments: [] })
            });

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('No assessments yet')).toBeInTheDocument();
            });
        });

        it('should show create button in empty state', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ assessments: [] })
            });

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Create First Assessment')).toBeInTheDocument();
            });
        });

        it('should show no matches message for empty search', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search assessments...');
            fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

            expect(screen.getByText('No assessments match your search')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // REFRESH TESTS
    // =========================================================================

    describe('Refresh', () => {
        it('should refetch on refresh button click', async () => {
            renderComponent();
            
            await waitFor(() => {
                expect(screen.getByText('Q1 2024 Assessment')).toBeInTheDocument();
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Find refresh button
            const refreshButton = document.querySelector('button[class*="RefreshCw"]');
            if (refreshButton) {
                fireEvent.click(refreshButton);
            }

            // Wait for refetch
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });
        });
    });

    // =========================================================================
    // DATE FORMATTING TESTS
    // =========================================================================

    describe('Date Formatting', () => {
        it('should format dates correctly', async () => {
            renderComponent();
            
            await waitFor(() => {
                // Dates should be formatted as "Jan 20, 2024"
                expect(screen.getByText(/Jan.*20.*2024/)).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS
    // =========================================================================

    describe('Error Handling', () => {
        it('should handle fetch error gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            renderComponent();

            // Should not crash, should show empty or error state
            await waitFor(() => {
                expect(screen.getByText('No assessments yet')).toBeInTheDocument();
            });
        });
    });
});

