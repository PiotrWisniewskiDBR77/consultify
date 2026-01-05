
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
    PMOPriorityBadge,
    PMOCategoryDot,
    getPMOCategory,
    PMO_CATEGORY_CONFIG
} from '@/components/MyWork/shared/PMOPriorityBadge';
import { PMOCategory } from '@/types/myWork';

describe('PMOPriorityBadge', () => {
    it('renders with correct label and icon for each category', () => {
        const categories: PMOCategory[] = [
            'blocking_phase',
            'blocking_initiative',
            'decision_required',
            'deadline_critical',
            'high_strategic',
            'routine'
        ];

        categories.forEach(category => {
            const { unmount } = render(<PMOPriorityBadge category={category} />);
            expect(screen.getByText(PMO_CATEGORY_CONFIG[category].label)).toBeTruthy();
            unmount();
        });
    });

    it('renders different sizes correctly', () => {
        const { unmount } = render(<PMOPriorityBadge category="routine" size="lg" />);
        expect(screen.getByText(PMO_CATEGORY_CONFIG.routine.label)).toBeTruthy();
        unmount();
    });

    it('hides label when showLabel is false', () => {
        render(<PMOPriorityBadge category="routine" showLabel={false} />);
        expect(screen.queryByText(PMO_CATEGORY_CONFIG.routine.label)).toBeNull();
    });

    it('renders emoji when both label and icon are hidden', () => {
        render(<PMOPriorityBadge category="routine" showLabel={false} showIcon={false} />);
        expect(screen.getByText(PMO_CATEGORY_CONFIG.routine.emoji)).toBeTruthy();
    });
});

describe('PMOCategoryDot', () => {
    it('renders correctly', () => {
        render(<PMOCategoryDot category="blocking_phase" />);
        const dot = screen.getByTitle(PMO_CATEGORY_CONFIG.blocking_phase.label);
        expect(dot).toBeTruthy();
    });
});

describe('getPMOCategory', () => {
    it('returns blocking_phase for explicit flag', () => {
        expect(getPMOCategory({ isBlockingPhase: true })).toBe('blocking_phase');
    });

    it('returns blocking_initiative for explicit flag', () => {
        expect(getPMOCategory({ isBlockingInitiative: true })).toBe('blocking_initiative');
    });

    it('returns decision_required for explicit flag', () => {
        expect(getPMOCategory({ awaitingDecision: true })).toBe('decision_required');
    });

    it('returns deadline_critical if due within 48 hours', () => {
        const soon = new Date();
        soon.setHours(soon.getHours() + 24);
        expect(getPMOCategory({ dueDate: soon.toISOString() })).toBe('deadline_critical');
    });

    it('returns high_strategic for high priority', () => {
        expect(getPMOCategory({ priority: 'high' })).toBe('high_strategic');
    });

    it('returns routine as default', () => {
        expect(getPMOCategory({})).toBe('routine');
    });

    it('handles labels correctly', () => {
        expect(getPMOCategory({ labels: [{ code: 'GATE_BLOCKER' }] })).toBe('blocking_phase');
        expect(getPMOCategory({ labels: [{ code: 'BLOCKING_PROGRESS' }] })).toBe('blocking_initiative');
        expect(getPMOCategory({ labels: [{ code: 'DECISION_REQUIRED' }] })).toBe('decision_required');
    });
});
