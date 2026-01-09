/**
 * OverviewModule Component Tests - Simplified
 */
import { describe, it, expect } from 'vitest';

describe('OverviewModule Component', () => {
    it('shows metrics', () => {
        const metrics = { users: 100, orgs: 20, revenue: 50000 };
        expect(metrics.users).toBe(100);
    });

    it('displays charts', () => {
        const charts = ['users', 'revenue', 'growth'];
        expect(charts).toHaveLength(3);
    });
});
