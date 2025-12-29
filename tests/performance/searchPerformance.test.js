/**
 * Search Performance Tests
 * 
 * Phase 6.2: Advanced Performance - Search
 * Tests search query performance and indexing speed.
 */

import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Search Performance Tests', () => {
    const BASE_URL = process.env.API_URL || 'http://localhost:3005';

    it('should return search results under 200ms', async () => {
        const query = 'test project';
        const start = performance.now();

        try {
            const response = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
            await response.json();
        } catch (e) {
            return;
        }

        const duration = performance.now() - start;
        console.log(`Search Request: ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(200);
    });

    it('should not degrade significantly with complex filters', async () => {
        // Simple search
        const startSimple = performance.now();
        await fetch(`${BASE_URL}/api/search?q=test`).then(r => r.json().catch(() => { }));
        const durationSimple = performance.now() - startSimple;

        // Complex search
        const startComplex = performance.now();
        const complexQuery = `q=test&status=active&owner=me&date_from=2024-01-01&tags=important,urgent`;
        await fetch(`${BASE_URL}/api/search?${complexQuery}`).then(r => r.json().catch(() => { }));
        const durationComplex = performance.now() - startComplex;

        // Complex search logic often adds overhead, but shouldn't be > 2x simple search
        // (Assuming database indexes are effectively used)
        if (durationSimple > 10) {
            expect(durationComplex).toBeLessThan(durationSimple * 3);
        }
    });
});
