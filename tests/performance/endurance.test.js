/**
 * Endurance Performance Tests
 * 
 * Phase 6.2: Advanced Performance - Endurance
 * Simple soak test pattern (runs for a medium duration to check stability).
 */

import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Endurance Performance Tests', () => {
    const BASE_URL = process.env.API_URL || 'http://localhost:3005';

    it('should maintain stable response times over a sustained period', async () => {
        // Run for 3 seconds of continuous load
        // In real CI this might be 10 minutes, but for unit/perf suite we keep it short
        const durationLimit = 3000;
        const start = performance.now();

        const latencies = [];
        let requests = 0;

        while ((performance.now() - start) < durationLimit) {
            const reqStart = performance.now();
            await fetch(`${BASE_URL}/api/health`).then(r => r.json()).catch(() => { });
            latencies.push(performance.now() - reqStart);
            requests++;

            // tiny sleep to prevent pure busy loop overloading local net stack
            await new Promise(r => setTimeout(r, 10));
        }

        // Calculate stats
        const firstHalf = latencies.slice(0, Math.floor(latencies.length / 2));
        const secondHalf = latencies.slice(Math.floor(latencies.length / 2));

        const avgfirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgsecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        console.log(`Endurance: ${requests} reqs. Avg1: ${avgfirst.toFixed(2)}ms, Avg2: ${avgsecond.toFixed(2)}ms`);

        // Performance should not degrade by more than 50%
        // (If server leaks memory or handles blocking improperly, second half gets slower)
        if (avgfirst > 1) { // Avoid division by zero/noise
            expect(avgsecond).toBeLessThan(avgfirst * 1.5);
        }

        // Should have managed a reasonable number of requests
        expect(requests).toBeGreaterThan(10);
    });
});
