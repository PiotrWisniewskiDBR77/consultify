
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecisionsList } from '../../../../components/MyWork/DecisionsList';
import { Api } from '../../../../services/api';

// Mock dependencies
vi.mock('../../../../services/api', () => ({
    Api: {
        get: vi.fn(),
    }
}));

const mockUseAppStore = vi.fn();
vi.mock('../../../../store/useAppStore', () => ({
    useAppStore: (selector: any) => mockUseAppStore(selector)
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key
    })
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('DecisionsList', () => {
    const mockOnCountsChange = vi.fn();
    const mockOnDecisionClick = vi.fn();

    const mockDecisions = [
        {
            id: 'd1',
            title: 'My Decision',
            status: 'PENDING',
            decisionType: 'GENERAL',
            decisionOwnerId: 'user1',
            ownerName: 'User 1',
            createdAt: new Date().toISOString()
        },
        {
            id: 'd2',
            title: 'Awaiting Decision',
            status: 'PENDING',
            decisionType: 'GENERAL',
            requestedById: 'user1',
            requestedByName: 'User 1',
            decisionOwnerId: 'user2',
            ownerName: 'User 2',
            createdAt: new Date().toISOString()
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        // Use deterministic mock to prevent race conditions
        (Api.get as any).mockImplementation(() => Promise.resolve(mockDecisions));
        
        // Setup store mock
        mockUseAppStore.mockImplementation((selector: any) => {
            const state = {
                currentProjectId: 'proj1',
                currentUser: { id: 'user1', name: 'User 1' }
            };
            return selector(state);
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders and fetches decisions', async () => {
        render(
            <DecisionsList
                activeGroup="all"
                onCountsChange={mockOnCountsChange}
                onDecisionClick={mockOnDecisionClick}
            />
        );

        // Wait for API call and then for rendering
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        }, { timeout: 5000 });

        // Wait for decisions to be rendered
        await waitFor(() => {
            expect(screen.getByText('My Decision')).toBeInTheDocument();
            expect(screen.getByText('Awaiting Decision')).toBeInTheDocument();
        }, { timeout: 5000 });

        // Wait for counts callback
        await waitFor(() => {
            expect(mockOnCountsChange).toHaveBeenCalledWith({
                total: 2,
                my: 1,
                awaiting: 1
            });
        }, { timeout: 5000 });
    });

    it('filters by "my" decisions', async () => {
        render(
            <DecisionsList
                activeGroup="my"
                onCountsChange={mockOnCountsChange}
                onDecisionClick={mockOnDecisionClick}
            />
        );

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        }, { timeout: 3000 });

        await waitFor(() => {
            expect(screen.getByText('My Decision')).toBeInTheDocument();
            expect(screen.queryByText('Awaiting Decision')).not.toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('filters by "awaiting" decisions', async () => {
        render(
            <DecisionsList
                activeGroup="awaiting"
                onCountsChange={mockOnCountsChange}
                onDecisionClick={mockOnDecisionClick}
            />
        );

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        }, { timeout: 3000 });

        await waitFor(() => {
            expect(screen.getByText('Awaiting Decision')).toBeInTheDocument();
            expect(screen.queryByText('My Decision')).not.toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('calls onDecisionClick when a card is clicked', async () => {
        render(
            <DecisionsList
                activeGroup="all"
                onCountsChange={mockOnCountsChange}
                onDecisionClick={mockOnDecisionClick}
            />
        );

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        }, { timeout: 3000 });

        await waitFor(() => {
            expect(screen.getByText('My Decision')).toBeInTheDocument();
        }, { timeout: 3000 });

        const decisionCard = screen.getByText('My Decision').closest('div[class*="cursor-pointer"]');
        if (decisionCard) {
            fireEvent.click(decisionCard);
            expect(mockOnDecisionClick).toHaveBeenCalledWith('d1');
        } else {
            // Fallback: click on the text itself
            fireEvent.click(screen.getByText('My Decision'));
            expect(mockOnDecisionClick).toHaveBeenCalledWith('d1');
        }
    });

    it('shows empty state when no decisions found', async () => {
        (Api.get as any).mockResolvedValue([]);
        render(
            <DecisionsList
                activeGroup="my"
                onCountsChange={mockOnCountsChange}
                onDecisionClick={mockOnDecisionClick}
            />
        );

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        }, { timeout: 3000 });

        await waitFor(() => {
            expect(screen.getByText('No decisions awaiting your action')).toBeInTheDocument();
            expect(screen.getByText('All caught up!')).toBeInTheDocument();
        }, { timeout: 3000 });
    });
});
