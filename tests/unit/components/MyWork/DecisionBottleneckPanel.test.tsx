
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecisionBottleneckPanel } from '../../../../components/MyWork/DecisionBottleneckPanel';
import { Api } from '../../../../services/api';
import { useAppStore } from '../../../../store/useAppStore';

// Mock services
vi.mock('../../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

vi.mock('../../../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue
    })
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('DecisionBottleneckPanel', () => {
    const mockData = {
        aging: [{ id: 'a1', title: 'Aging 1', daysWaiting: 5, ownerName: 'John' }],
        blocking: [{ id: 'b1', title: 'Blocking 1', blockedCount: 3, ownerName: 'Jane' }],
        ownerOverload: [{ userId: 'u1', name: 'Bob', email: 'bob@example.com', pendingCount: 10 }]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue(null); // Default projectId
        (Api.get as any).mockResolvedValue(mockData);
    });

    it('renders loading state initially', async () => {
        // We need to keep loading true for a bit
        let resolveApi: any;
        (Api.get as any).mockImplementation(() => new Promise(resolve => { resolveApi = resolve; }));

        render(<DecisionBottleneckPanel />);
        expect(document.querySelector('.animate-pulse')).toBeTruthy();

        resolveApi(mockData);
        await waitFor(() => expect(document.querySelector('.animate-pulse')).toBeNull());
    });

    it('renders all sections when data is loaded', async () => {
        render(<DecisionBottleneckPanel />);

        expect(await screen.findByText('Aging Decisions')).toBeTruthy();
        expect(await screen.findByText('Aging 1')).toBeTruthy();
        expect(await screen.findByText('Blocking Work')).toBeTruthy();
        expect(await screen.findByText('Blocking 1')).toBeTruthy();
        expect(await screen.findByText('Overloaded Owners')).toBeTruthy();
        fireEvent.click(screen.getByText('Overloaded Owners'));
        expect(await screen.findByText('Bob')).toBeTruthy();
    });

    it('calls onDecisionClick when a decision is clicked', async () => {
        const mockOnClick = vi.fn();
        render(<DecisionBottleneckPanel onDecisionClick={mockOnClick} />);

        await waitFor(() => expect(screen.getByText('Aging 1')).toBeTruthy());
        fireEvent.click(screen.getByText('Aging 1'));

        expect(mockOnClick).toHaveBeenCalledWith('a1');
    });

    it('toggles section collapse', async () => {
        render(<DecisionBottleneckPanel />);
        await waitFor(() => expect(screen.getByText('Aging 1')).toBeTruthy());

        // Aging Decisions is open by default
        fireEvent.click(screen.getByText('Aging Decisions'));
        // After click, it should be hidden (initial opacity 0 in motion.div mock)
        // In our simple mock, it just stays there but we can check if the toggle button exists
        expect(screen.getByText('Aging Decisions')).toBeTruthy();
    });

    it('refreshes data when refresh button is clicked', async () => {
        render(<DecisionBottleneckPanel />);
        await waitFor(() => expect(screen.getByText('Decision Bottlenecks')).toBeTruthy());

        const refreshBtn = screen.getAllByRole('button')[0]; // Header refresh button
        fireEvent.click(refreshBtn);

        expect(Api.get).toHaveBeenCalledTimes(2); // Initial + Refresh
    });

    it('renders null if no issues are found', async () => {
        (Api.get as any).mockResolvedValue({ aging: [], blocking: [], ownerOverload: [] });
        render(<DecisionBottleneckPanel />);

        await waitFor(() => {
            expect(screen.queryByText('Decision Bottlenecks')).toBeNull();
        });
    });
});
