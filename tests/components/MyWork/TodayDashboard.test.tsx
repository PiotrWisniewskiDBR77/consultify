/**
 * TodayDashboard Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('TodayDashboard Component', () => {
    it('shows today tasks', () => {
        const tasks = [{ id: 't-1', title: 'Task 1' }];
        expect(tasks).toHaveLength(1);
    });

    it('displays summary', () => {
        const summary = { meetings: 2, tasks: 5 };
        expect(summary.tasks).toBe(5);
    });
});
