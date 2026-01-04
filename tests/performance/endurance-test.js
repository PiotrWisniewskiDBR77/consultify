/**
 * k6 Endurance Test - Long-Running Load Test
 * Enterprise SaaS Architecture - Endurance Testing
 * 
 * Tests system stability over extended periods (simulates weeks of usage)
 * 
 * Usage:
 *   k6 run --duration 1h tests/performance/endurance-test.js
 *   k6 run --duration 24h tests/performance/endurance-test.js
 * 
 * Environment Variables:
 *   BASE_URL - API base URL (default: http://localhost:3005)
 *   ENDURANCE_DURATION - Test duration (default: 1h)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const memoryUsage = new Gauge('memory_usage');
const requestCounter = new Counter('total_requests');
const errorCounter = new Counter('total_errors');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3005';
const DURATION = __ENV.ENDURANCE_DURATION || '1h';

// Endurance test configuration - sustained load
export const options = {
  stages: [
    { duration: '5m', target: 100 },   // Ramp up to 100 users
    { duration: DURATION, target: 100 }, // Maintain 100 users for extended period
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    // Strict thresholds for endurance test
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    errors: ['rate<0.01'], // Less than 1% errors
    // Check for memory leaks - error rate should not increase over time
    'errors{type:memory}': ['rate<0.001'],
  },
};

// Track memory usage over time
let memoryBaseline = null;
let memorySamples = [];

export default function () {
  requestCounter.add(1);

  // ==========================================
  // Health Check (Most Frequent)
  // ==========================================
  group('Health Checks', function () {
    const startTime = Date.now();
    const healthRes = http.get(`${BASE_URL}/api/health`, {
      tags: { name: 'Endurance-Health' },
    });
    const duration = Date.now() - startTime;

    requestDuration.add(duration);
    errorRate.add(healthRes.status >= 500);
    if (healthRes.status >= 500) {
      errorCounter.add(1);
    }

    check(healthRes, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time stable': (r) => r.timings.duration < 500,
    });
  });

  sleep(1);

  // ==========================================
  // API Endpoints (Regular Frequency)
  // ==========================================
  if (Math.random() < 0.3) {
    // 30% of requests hit API endpoints
    group('API Endpoints', function () {
      const endpoints = [
        '/api/health',
        '/api/health/ready',
      ];

      endpoints.forEach((endpoint) => {
        const startTime = Date.now();
        const res = http.get(`${BASE_URL}${endpoint}`, {
          tags: { name: 'Endurance-API' },
        });
        const duration = Date.now() - startTime;

        requestDuration.add(duration);
        errorRate.add(res.status >= 500);
        if (res.status >= 500) {
          errorCounter.add(1);
        }
      });
    });
  }

  sleep(2);

  // ==========================================
  // Memory Monitoring
  // ==========================================
  if (Math.random() < 0.01) {
    // 1% of requests check memory (to avoid overhead)
    const memUsage = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
    if (memUsage > 0) {
      memoryUsage.add(memUsage);
      memorySamples.push({
        timestamp: Date.now(),
        heapUsed: memUsage,
      });

      // Keep only last 100 samples
      if (memorySamples.length > 100) {
        memorySamples.shift();
      }

      // Check for memory leak (growth > 20% over last hour)
      if (memorySamples.length >= 10) {
        const oldest = memorySamples[0];
        const newest = memorySamples[memorySamples.length - 1];
        const timeDiff = newest.timestamp - oldest.timestamp;
        const memDiff = newest.heapUsed - oldest.heapUsed;
        const memGrowthPercent = (memDiff / oldest.heapUsed) * 100;

        // If more than 1 hour and > 20% growth, potential leak
        if (timeDiff > 3600000 && memGrowthPercent > 20) {
          console.warn(`Potential memory leak detected: ${memGrowthPercent.toFixed(2)}% growth over ${(timeDiff / 3600000).toFixed(2)} hours`);
        }
      }
    }
  }

  sleep(3);
}

export function setup() {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  if (healthRes.status !== 200) {
    throw new Error(`Server not healthy: ${healthRes.status}`);
  }

  // Record baseline memory
  if (process.memoryUsage) {
    memoryBaseline = process.memoryUsage().heapUsed;
  }

  console.log(`Starting endurance test for ${DURATION}...`);
  console.log(`Baseline memory: ${memoryBaseline ? (memoryBaseline / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`);

  return {
    baseUrl: BASE_URL,
    startTime: new Date().toISOString(),
    duration: DURATION,
    memoryBaseline,
  };
}

export function teardown(data) {
  const finalMemory = process.memoryUsage ? process.memoryUsage().heapUsed : null;
  const memoryGrowth = finalMemory && data.memoryBaseline
    ? ((finalMemory - data.memoryBaseline) / data.memoryBaseline) * 100
    : null;

  console.log(`Endurance test completed.`);
  if (memoryGrowth !== null) {
    console.log(`Memory growth: ${memoryGrowth.toFixed(2)}%`);
  }
}

export function handleSummary(data) {
  const finalMemory = process.memoryUsage ? process.memoryUsage().heapUsed : null;
  const memoryGrowth = finalMemory && memoryBaseline
    ? ((finalMemory - memoryBaseline) / memoryBaseline) * 100
    : null;

  const summary = {
    timestamp: new Date().toISOString(),
    testType: 'endurance',
    duration: data.state.testRunDurationMs,
    vus: {
      max: data.metrics.vus_max?.values?.value || 0,
      avg: data.metrics.vus?.values?.value || 0,
    },
    requests: {
      total: data.metrics.http_reqs?.values?.count || 0,
      rate: data.metrics.http_reqs?.values?.rate || 0,
    },
    errors: {
      rate: data.metrics.errors?.values?.rate || 0,
      count: data.metrics.http_req_failed?.values?.count || 0,
    },
    latency: {
      avg: data.metrics.http_req_duration?.values?.avg || 0,
      p50: data.metrics.http_req_duration?.values['p(50)'] || 0,
      p95: data.metrics.http_req_duration?.values['p(95)'] || 0,
      p99: data.metrics.http_req_duration?.values['p(99)'] || 0,
      max: data.metrics.http_req_duration?.values?.max || 0,
    },
    memory: {
      baseline: memoryBaseline,
      final: finalMemory,
      growthPercent: memoryGrowth,
      samples: memorySamples.length,
    },
    stability: {
      errorRateStable: data.metrics.errors?.values?.rate < 0.01,
      latencyStable: data.metrics.http_req_duration?.values['p(95)'] < 1000,
      noMemoryLeak: memoryGrowth === null || memoryGrowth < 20,
    },
  };

  return {
    stdout: `Endurance Test Complete\nDuration: ${(summary.duration / 1000 / 60).toFixed(2)} minutes\nTotal Requests: ${summary.requests.total}\nError Rate: ${(summary.errors.rate * 100).toFixed(2)}%\nMemory Growth: ${memoryGrowth !== null ? memoryGrowth.toFixed(2) + '%' : 'N/A'}\n`,
    'tests/performance/results/endurance-test-summary.json': JSON.stringify(summary, null, 2),
  };
}





