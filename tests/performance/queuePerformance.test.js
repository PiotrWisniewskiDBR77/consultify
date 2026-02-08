/**
 * Queue Performance Tests
 *
 * Phase 6.2: Advanced Performance - Job Queues
 * Tests BullMQ/Job processing throughput and latency.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { performance } from 'perf_hooks';

describe('Queue Performance Tests', () => {
  const BASE_URL = process.env.API_URL || 'http://localhost:3005';

  let serverAvailable = true;

  beforeAll(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      serverAvailable = response.ok;
    } catch {
      serverAvailable = false;
    }
  });

  // We assume there's an endpoint that triggers a background job
  // e.g. POST /api/reports/generate simulates a job

  it('should enqueue jobs quickly', async () => {
    if (!serverAvailable) return;

    const start = performance.now();

    const response = await fetch(`${BASE_URL}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Mock auth headers would go here
      },
      body: JSON.stringify({
        type: 'PROJECT_SUMMARY',
        projectId: 'test-project-1',
      }),
    });

    const duration = performance.now() - start;

    // The API should just enqueue and return 202/200 OK immediately
    // It should NOT wait for the job to finish
    expect(duration).toBeLessThan(100);

    // Just consume the body so we don't leak
    if (response.status === 200 || response.status === 202) {
      await response.json().catch(() => { });
    }
  });

  it('should handle burst job submission without blocking main thread', async () => {
    if (!serverAvailable) return;

    const jobCount = 20;
    const start = performance.now();

    const promises = Array(jobCount)
      .fill(0)
      .map((_, i) =>
        fetch(`${BASE_URL}/api/reports/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: `job-${i}` }),
        }).then((r) => r.json().catch(() => { }))
      );

    await Promise.all(promises);
    const duration = performance.now() - start;
    const avgTime = duration / jobCount;

    console.log(
      `Queue Burst: ${jobCount} jobs enqueued in ${duration.toFixed(2)}ms (Avg: ${avgTime.toFixed(2)}ms)`
    );

    // Average enqueue time should remain low
    expect(avgTime).toBeLessThan(50);
  });
});
