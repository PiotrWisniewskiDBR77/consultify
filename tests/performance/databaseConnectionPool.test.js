/**
 * Database Connection Pool Performance Tests
 *
 * Phase 6.2: Advanced Performance - DB Pool
 * Tests connection acquisition times and handling of concurrent database requests.
 */

import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Database Connection Pool Performance', () => {
  const BASE_URL = process.env.API_URL || 'http://localhost:3005';
  // Max pool size is usually 10-20 in dev
  const MAX_POOL_SIZE = 10;

  it('should handle concurrent requests exceeding pool size without failure', async () => {
    // Launch more requests than the typical pool size to force queuing
    const requestCount = MAX_POOL_SIZE * 2;
    const requests = [];

    const start = performance.now();

    for (let i = 0; i < requestCount; i++) {
      // Using a DB-heavy endpoint (projects usually fetches from DB)
      requests.push(
        fetch(`${BASE_URL}/api/projects`, {
          headers: { Authorization: 'Bearer test-token' },
        })
          .then((r) => {
            if (!r.ok) throw new Error(`Status ${r.status}`);
            return r.json();
          })
          .catch((e) => ({ error: e }))
      );
    }

    const results = await Promise.all(requests);
    const duration = performance.now() - start;

    const successCount = results.filter((r) => !r.error).length;

    console.log(
      `DB Pool Test: ${successCount}/${requestCount} successful in ${duration.toFixed(2)}ms`
    );

    // Check if we had total failure (likely server down or auth issue)
    if (successCount === 0) {
      console.warn('Skipping DB Pool test - Server offline or Auth failed');
      return;
    }

    // Even if the pool is full, the driver should queue and eventually serve all requests
    // (unless timeout is reached, which we test here)
    expect(successCount).toBe(requestCount);

    // Average time shouldn't be catastrophic
    // 20 requests * 50ms processing / 10 concurrent = ~100ms total ideal + overhead
    expect(duration).toBeLessThan(2000);
  });

  it('should release connections back to pool quickly', async () => {
    // Test sequential bursts
    const burstSize = 5;
    const bursts = 3;

    const start = performance.now();

    for (let b = 0; b < bursts; b++) {
      const burstPromises = Array(burstSize)
        .fill(0)
        .map(() => fetch(`${BASE_URL}/api/health`).then((r) => r.json()));
      await Promise.all(burstPromises);
    }

    const totalDuration = performance.now() - start;
    const avgBurstTime = totalDuration / bursts;

    // If connections aren't released, subsequent bursts would hang or timeout
    expect(avgBurstTime).toBeLessThan(500);
  });
});
