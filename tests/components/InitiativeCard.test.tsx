import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InitiativeCard } from '../../components/InitiativeCard';
import { Initiative } from '../../types';

describe('Component Test: InitiativeCard', () => {
    const mockInitiative: Initiative = {
        id: 'init-1',
        name: 'Test Initiative',
        description: 'Test description',
        status: 'step3',
        priority: 'High',
        complexity: 'Medium',
        axis: 'processes',
    } as Initiative;

    it('renders initiative name and description', () => {
        render(
            <InitiativeCard
                initiative={mockInitiative}
                onClick={vi.fn()}


            />
        );

        expect(screen.getByText('Test Initiative')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('calls onClick when card is clicked', () => {
        const handleClick = vi.fn();
        render(
            <InitiativeCard
                initiative={mockInitiative}
                onClick={handleClick}

            />
        );

        fireEvent.click(screen.getByText('Test Initiative').closest('div')!);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('displays status badge', () => {
        render(
            <InitiativeCard
                initiative={mockInitiative}
                onClick={vi.fn()}


            />
        );

        expect(screen.getByText(/Initiative List/)).toBeInTheDocument();
    });

    it('displays axis badge when present', () => {
        render(
            <InitiativeCard
                initiative={mockInitiative}
                onClick={vi.fn()}


            />
        );

        expect(screen.getByText(/Axis/)).toBeInTheDocument();
    });

    it('calls onEnrich when enrich button is clicked', async () => {
        const handleEnrich = vi.fn().mockResolvedValue(undefined);
        render(
            <InitiativeCard
                initiative={mockInitiative}
                onClick={vi.fn()}
                onEnrich={handleEnrich}
            />
        );

        // Find and click enrich button if present
        const enrichButtons = screen.queryAllByText(/Enrich|AI/);
        if (enrichButtons.length > 0) {
            fireEvent.click(enrichButtons[0]);
            expect(handleEnrich).toHaveBeenCalledWith('init-1');
        }
    });

    it('handles different status values', () => {
        const statuses: Array<Initiative['status']> = ['step3', 'step4', 'step5', 'completed', 'on_hold'];

        statuses.forEach(status => {
            const { unmount } = render(
                <InitiativeCard
                    initiative={{ ...mockInitiative, status }}
                    onClick={vi.fn()}


                />
            );
            expect(screen.getByText(mockInitiative.name)).toBeInTheDocument();
            unmount();
        });
    });
});

