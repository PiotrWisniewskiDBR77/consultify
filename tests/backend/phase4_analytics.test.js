import { describe, it, expect, afterAll } from 'vitest';
import AnalyticsService from '../../server/services/analyticsService';
import db from '../../server/database';

describe('Phase 4: Analytics & Benchmarking', () => {

    // Cleanup helper
    const cleanup = async () => {
        return new Promise(resolve => {
            db.run("DELETE FROM maturity_scores WHERE Organization_id = 'test-org-bench'", resolve);
        });
    }

    it('should save maturity scores and retrieve aggregated benchmarks', async () => {
        const orgId = 'test-org-bench';
        const axis = 'Data & AI';

        // 1. Save Scores (Sample Data)
        await new Promise(r => setTimeout(r, 100)); // Small delay to ensure DB ready
        AnalyticsService.saveMaturityScore(orgId, axis, 2.0, 'Technology');
        AnalyticsService.saveMaturityScore(orgId, axis, 4.0, 'Technology');

        // Wait for async insert (sqlite is usually fast but strictly it's async without callback in void function)
        // We might need to wait a bit because saveMaturityScore is void and fire-and-forget in implementation?
        // Ah, implementation: stmt.run(..., cb). It's async. We should probably export a promise version or wait.
        // For test, we can just wait 500ms.
        await new Promise(r => setTimeout(r, 500));

        // 2. Get Benchmarks
        const benchmarks = await AnalyticsService.getIndustryBenchmarks('Technology');

        // 3. Verify
        const axisStats = benchmarks.find(b => b.axis === axis);
        expect(axisStats).toBeDefined();
        // Avg of 2.0 and 4.0 is 3.0
        expect(axisStats.avg_score).toBe(3);
        expect(axisStats.sample_size).toBeGreaterThanOrEqual(2);

        await cleanup();
    });

    it('should filter benchmarks by industry', async () => {
        const benchmarks = await AnalyticsService.getIndustryBenchmarks('NonExistentIndustry');
        expect(benchmarks.length).toBe(0);
    });

});
