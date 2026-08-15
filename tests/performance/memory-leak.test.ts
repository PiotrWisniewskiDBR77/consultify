/**
 * Memory Leak Detection Test
 * Enterprise SaaS Architecture - Long-Running Test
 * 
 * Tests system for memory leaks over extended periods
 * Simulates weeks of usage to detect gradual memory growth
 * 
 * Usage:
 *   npm run test:memory-leak
 *   npx vitest run tests/performance/memory-leak.test.ts
 * 
 * Environment Variables:
 *   MEMORY_TEST_DURATION - Test duration in minutes (default: 60)
 *   MEMORY_LEAK_THRESHOLD - Growth threshold percentage (default: 20)
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { getMemoryMonitor } from '../../server/src/services/MemoryMonitor.js';

const TEST_DURATION_MS = parseInt(process.env.MEMORY_TEST_DURATION || '60', 10) * 60 * 1000; // Default 60 minutes
const LEAK_THRESHOLD = parseInt(process.env.MEMORY_LEAK_THRESHOLD || '20', 10); // Default 20%
const SAMPLE_INTERVAL_MS = parseInt(process.env.MEMORY_SAMPLE_INTERVAL_MS || '30000', 10);

describe('Memory Leak Detection', () => {
    let memoryMonitor;
    let testStartTime;
    let initialMemory;

    beforeAll(() => {
        // Initialize memory monitor with shorter check interval for testing
        memoryMonitor = getMemoryMonitor({
            maxSamples: 200,
            checkIntervalMs: 10000, // Check every 10 seconds
            leakThresholdPercent: LEAK_THRESHOLD,
            timeWindowMs: 3600000, // 1 hour window
        });
        // Dedicated harness owns sampling; background samples would make the
        // thresholds depend on scheduler timing and duplicate observations.
        memoryMonitor.stopMonitoring();

        testStartTime = Date.now();
        initialMemory = process.memoryUsage();
    });

    afterAll(() => {
        if (memoryMonitor) {
            memoryMonitor.stopMonitoring();
        }
    });

    it('should monitor memory usage over extended period', async () => {
        // Do not use Vitest's transform/import peak as the baseline. Warm the
        // workload, collect garbage when the dedicated runtime exposes it,
        // and start a fresh monitor window.
        for (let i = 0; i < 5; i++) simulateWorkload();
        // Prime metricsService lazy state before capturing the baseline.
        memoryMonitor.recordSample();
        await new Promise((resolve) => setTimeout(resolve, SAMPLE_INTERVAL_MS));
        global.gc?.();
        memoryMonitor.recordSample();
        memoryMonitor.resetBaseline();

        const startMemory = process.memoryUsage();
        testStartTime = Date.now();
        const samples = [];
        const endTime = Date.now() + TEST_DURATION_MS;

        console.log(`Starting memory leak test for ${TEST_DURATION_MS / 1000 / 60} minutes...`);
        console.log(`Initial memory: ${(startMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

        function simulateWorkload() {
            // Create some objects to simulate memory usage
            const data = [];
            for (let i = 0; i < 1000; i++) {
                data.push({
                    id: i,
                    value: Math.random(),
                    timestamp: Date.now(),
                    metadata: {
                        key: `key-${i}`,
                        value: `value-${i}`,
                    },
                });
            }
            return data;
        }

        // Periodic workload simulation
        const workloadInterval = setInterval(() => {
            simulateWorkload();
        }, 5000); // Every 5 seconds

        // Monitor memory
        while (Date.now() < endTime) {
            await new Promise((resolve) => setTimeout(resolve, SAMPLE_INTERVAL_MS));

            global.gc?.();
            memoryMonitor.recordSample();

            const currentMemory = process.memoryUsage();
            const elapsed = Date.now() - testStartTime;
            const growth = ((currentMemory.heapUsed - startMemory.heapUsed) / startMemory.heapUsed) * 100;

            samples.push({
                timestamp: Date.now(),
                heapUsed: currentMemory.heapUsed,
                growth: Math.round(growth * 100) / 100,
            });

            console.log(
                `[${Math.round(elapsed / 1000 / 60)}m] Memory: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB (${growth > 0 ? '+' : ''}${growth.toFixed(2)}%)`,
            );

            // Check for leaks
            const leakAlert = memoryMonitor.checkForLeaks();
            if (leakAlert && leakAlert.detected) {
                console.warn('[Memory Leak Detected]', leakAlert);
            }
        }

        clearInterval(workloadInterval);

        // Analyze results
        const finalMemory = process.memoryUsage();
        const totalGrowth = ((finalMemory.heapUsed - startMemory.heapUsed) / startMemory.heapUsed) * 100;

        console.log('\n=== Memory Test Results ===');
        console.log(`Initial memory: ${(startMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Total growth: ${totalGrowth > 0 ? '+' : ''}${totalGrowth.toFixed(2)}%`);
        console.log(`Test duration: ${(TEST_DURATION_MS / 1000 / 60).toFixed(2)} minutes`);
        console.log(`Samples collected: ${samples.length}`);

        // Check for memory leak
        const stats = memoryMonitor.getStats();
        console.log(`Growth since baseline: ${stats.growthSinceBaseline}%`);

        // Assertions
        expect(totalGrowth).toBeLessThan(LEAK_THRESHOLD);
        expect(stats.growthSinceBaseline).toBeLessThan(LEAK_THRESHOLD);

        // Check trend - memory should not continuously grow
        const trend = memoryMonitor.getTrend();
        if (trend.length > 10) {
            const recentTrend = trend.slice(-10);
            const first = recentTrend[0].heapUsed;
            const last = recentTrend[recentTrend.length - 1].heapUsed;
            const recentGrowth = ((last - first) / first) * 100;

            console.log(`Recent trend (last 10 samples): ${recentGrowth > 0 ? '+' : ''}${recentGrowth.toFixed(2)}%`);
            expect(Math.abs(recentGrowth)).toBeLessThan(LEAK_THRESHOLD / 2); // Recent growth should be less than half threshold
        }
    }, TEST_DURATION_MS + 60000); // Add 1 minute buffer

    it('should detect memory leaks when they occur', () => {
        // This test intentionally creates a memory leak to verify detection
        const leakyArray = [];
        let counter = 0;

        global.gc?.();
        memoryMonitor.recordSample();
        memoryMonitor.resetBaseline();

        // Create a memory leak by keeping references
        const createLeak = () => {
            const data = {
                id: counter++,
                largeArray: new Array(10000).fill(0),
                timestamp: Date.now(),
            };
            leakyArray.push(data);
        };

        // Create leaks rapidly
        for (let i = 0; i < 300; i++) {
            createLeak();
        }

        // The retained references must be sampled after allocation; the old
        // harness only asserted that an unrelated baseline sample existed.
        memoryMonitor.recordSample();
        const leakAlert = memoryMonitor.checkForLeaks();
        const stats = memoryMonitor.getStats();
        expect(stats.samples).toBe(2);
        expect(stats.growthSinceBaseline).toBeGreaterThan(LEAK_THRESHOLD);
        expect(leakAlert).toMatchObject({ detected: true });
        expect(leakyArray).toHaveLength(300);
    });
});


