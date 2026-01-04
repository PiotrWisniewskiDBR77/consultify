/**
 * k6 Stress Test - Spike Traffic Scenarios
 * Enterprise SaaS Architecture - Stress Testing
 * 
 * Tests system behavior under sudden traffic spikes
 * 
 * Usage:
 *   k6 run tests/performance/stress-test.js
 * 
 * Environment Variables:
 *   BASE_URL - API base URL (default: http://localhost:3005)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const spikeDuration = new Trend('spike_duration');
const recoveryDuration = new Trend('recovery_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3005';

// Stress test configuration - sudden spikes
export const options = {
  stages: [
    { duration: '10s', target: 10 },      // Baseline
    { duration: '5s', target: 1000 },    // SPIKE 1: Sudden 100x increase
    { duration: '30s', target: 1000 },   // Hold spike
    { duration: '10s', target: 10 },     // Recovery
    { duration: '10s', target: 10 },     // Baseline
    { duration: '3s', target: 2000 },    // SPIKE 2: Extreme spike (200x)
    { duration: '20s', target: 2000 },   // Hold extreme spike
    { duration: '10s', target: 10 },     // Recovery
    { duration: '10s', target: 10 },     // Baseline
    { duration: '2s', target: 5000 },    // SPIKE 3: Maximum stress (500x)
    { duration: '15s', target: 5000 },   // Hold maximum stress
    { duration: '10s', target: 10 },     // Recovery
  ],
  thresholds: {
    // More lenient thresholds for stress test
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    errors: ['rate<0.05'], // Allow up to 5% errors under extreme stress
  },
};

export default function () {
  const startTime = Date.now();

  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'Stress-Health' },
  });

  const duration = Date.now() - startTime;
  spikeDuration.add(duration);

  check(healthRes, {
    'health check responds': (r) => r.status !== 0,
    'health check not 500': (r) => r.status !== 500,
  });

  errorRate.add(healthRes.status >= 500);

  // Try to hit multiple endpoints simultaneously
  const endpoints = [
    '/api/health',
    '/api/health',
    '/api/health',
  ];

  endpoints.forEach((endpoint) => {
    const res = http.get(`${BASE_URL}${endpoint}`, {
      tags: { name: 'Stress-Burst' },
    });
    errorRate.add(res.status >= 500);
  });

  sleep(0.1);
}

export function setup() {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  if (healthRes.status !== 200) {
    throw new Error(`Server not healthy: ${healthRes.status}`);
  }
  console.log('Starting stress test with traffic spikes...');
  return { baseUrl: BASE_URL };
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    testType: 'stress',
    duration: data.state.testRunDurationMs,
    maxVUs: data.metrics.vus_max?.values?.value || 0,
    requests: {
      total: data.metrics.http_reqs?.values?.count || 0,
      rate: data.metrics.http_reqs?.values?.rate || 0,
    },
    errors: {
      rate: data.metrics.errors?.values?.rate || 0,
      count: data.metrics.http_req_failed?.values?.count || 0,
    },
    latency: {
      p95: data.metrics.http_req_duration?.values['p(95)'] || 0,
      p99: data.metrics.http_req_duration?.values['p(99)'] || 0,
      max: data.metrics.http_req_duration?.values?.max || 0,
    },
    spikes: {
      spike1: { target: 1000, duration: '30s' },
      spike2: { target: 2000, duration: '20s' },
      spike3: { target: 5000, duration: '15s' },
    },
  };

  return {
    stdout: `Stress Test Complete\nMax VUs: ${summary.maxVUs}\nError Rate: ${(summary.errors.rate * 100).toFixed(2)}%\n`,
    'tests/performance/results/stress-test-summary.json': JSON.stringify(summary, null, 2),
  };
}

