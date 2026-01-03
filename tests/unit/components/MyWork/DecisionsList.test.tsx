
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

vi.mock('../../../../store/useAppStore', () => ({
    useAppStore: (selector: any) => selector({
        user: { id: 'user1', name: 'User 1' },
        currentProjectId: 'proj1'
    })
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue
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
            decisionOwnerId: 'user1',
            ownerName: 'User 1',
            createdAt: new Date().toISOString()
        },
        {
            id: 'd2',
            title: 'Awaiting Decision',
            status: 'PENDING',
            requestedById: 'user1',
            requestedByName: 'User 1',
            decisionOwnerId: 'user2',
            ownerName: 'User 2',
            createdAt: new Date().toISOString()
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue(mockDecisions);
    });

    it('renders and fetches decisions', async () => {
        render(
            <DecisionsList
                activeGroup="all"
                onCountsChange={mockOnCountsChange}
                onDecisionClick={mockOnDecisionClick}
            />
        );

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/decisions?projectId=proj1&includeAll=true');
            expect(screen.getByText('My Decision')).toBeTruthy();
            expect(screen.getByText('Awaiting Decision')).toBeTruthy();
        });

        expect(mockOnCountsChange).toHaveBeenCalledWith({
            total: 2,
            my: 1,
            awaiting: 1
        });
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
            expect(screen.getByText('My Decision')).toBeTruthy();
            expect(screen.queryByText('Awaiting Decision')).toBeNull();
        });
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
            expect(screen.getByText('Awaiting Decision')).toBeTruthy();
            expect(screen.queryByText('My Decision')).toBeNull();
        });
    });

    it('calls onDecisionClick when a card is clicked', async () => {
        render(
            <DecisionsList
                activeGroup="all"
                onCountsChange={mockOnCountsChange}
                onDecisionClick={mockOnDecisionClick}
            />
        );

        await waitFor(() => expect(screen.getByText('My Decision')).toBeTruthy());

        fireEvent.click(screen.getByText('My Decision'));
        expect(mockOnDecisionClick).toHaveBeenCalledWith('d1');
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
            expect(screen.getByText('No decisions awaiting your action')).toBeTruthy();
            expect(screen.getByText('All caught up!')).toBeTruthy();
        });
    });
});
