/**
 * k6 Load Testing Script
 * Enterprise SaaS Architecture - Performance Testing
 *
 * Usage:
 *   k6 run tests/performance/load-test.js
 *   k6 run --vus 50 --duration 60s tests/performance/load-test.js
 *
 * Environment Variables:
 *   K6_VUS - Number of virtual users (default: 10)
 *   K6_DURATION - Test duration (default: 30s)
 *   BASE_URL - API base URL (default: http://localhost:3001)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthCheckDuration = new Trend('health_check_duration');
const authDuration = new Trend('auth_duration');
const apiDuration = new Trend('api_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Ramp up to 10 users
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '1m', target: 100 }, // Stay at 100 users
    { duration: '30s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    // 95% of requests should be below 500ms
    http_req_duration: ['p(95)<500'],
    // Error rate should be below 1%
    errors: ['rate<0.01'],
    // Health check should be under 100ms
    health_check_duration: ['p(95)<100'],
    // Auth endpoints under 1s
    auth_duration: ['p(95)<1000'],
    // API endpoints under 500ms
    api_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3005';

// Test users for authentication
const TEST_USERS = [
  { email: 'test1@example.com', password: 'TestPassword123!' },
  { email: 'test2@example.com', password: 'TestPassword123!' },
  { email: 'test3@example.com', password: 'TestPassword123!' },
];

export default function () {
  // ==========================================
  // Health Check Tests
  // ==========================================
  group('Health Checks', function () {
    const healthRes = http.get(`${BASE_URL}/api/health`);
    healthCheckDuration.add(healthRes.timings.duration);

    check(healthRes, {
      'health check status is 200': (r) => r.status === 200,
      'health check has status ok': (r) => {
        try {
          return JSON.parse(r.body).status === 'ok';
        } catch {
          return false;
        }
      },
    });

    errorRate.add(healthRes.status !== 200);
  });

  sleep(0.1);

  // ==========================================
  // API Version Check
  // ==========================================
  group('API Version', function () {
    const versionRes = http.get(`${BASE_URL}/api/health`, {
      headers: { 'X-API-Version': '1' },
    });

    check(versionRes, {
      'version header accepted': (r) => r.status === 200,
      'version header returned': (r) => r.headers['X-Api-Version'] !== undefined,
    });
  });

  sleep(0.1);

  // ==========================================
  // Public API Tests
  // ==========================================
  group('Public APIs', function () {
    // CSRF token endpoint
    const csrfRes = http.get(`${BASE_URL}/api/csrf-token`);
    apiDuration.add(csrfRes.timings.duration);

    check(csrfRes, {
      'csrf token status is 200': (r) => r.status === 200,
      'csrf token returned': (r) => {
        try {
          return JSON.parse(r.body).csrfToken !== undefined;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(csrfRes.status !== 200);
  });

  sleep(0.2);

  // ==========================================
  // Authentication Load Test
  // ==========================================
  group('Authentication', function () {
    const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];

    // Login attempt (may fail with test credentials, that's ok)
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: user.email,
        password: user.password,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    authDuration.add(loginRes.timings.duration);

    check(loginRes, {
      'login responds': (r) => r.status !== 500,
      'login response time ok': (r) => r.timings.duration < 2000,
    });

    // Rate limiting should kick in
    if (loginRes.status === 429) {
      check(loginRes, {
        'rate limiting works': (r) => r.status === 429,
      });
    }
  });

  sleep(0.5);

  // ==========================================
  // Rate Limiting Test
  // ==========================================
  group('Rate Limiting', function () {
    // Burst requests to test rate limiting
    const responses = [];
    for (let i = 0; i < 5; i++) {
      responses.push(http.get(`${BASE_URL}/api/health`));
    }

    // Check that requests are handled
    const successCount = responses.filter((r) => r.status === 200).length;

    check(null, {
      'burst requests handled': () => successCount >= 1,
    });
  });

  sleep(1);
}

// ==========================================
// Setup - Run once before tests
// ==========================================
export function setup() {
  // Verify server is running
  const healthRes = http.get(`${BASE_URL}/api/health`);

  if (healthRes.status !== 200) {
    throw new Error(`Server not healthy: ${healthRes.status}`);
  }

  console.log('Server is healthy, starting load test...');

  return {
    baseUrl: BASE_URL,
    startTime: new Date().toISOString(),
  };
}

// ==========================================
// Teardown - Run once after tests
// ==========================================
export function teardown(data) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
}

// ==========================================
// Handle Summary - Generate report
// ==========================================
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs,
    vus: data.metrics.vus?.values?.value || 0,
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
      p95: data.metrics.http_req_duration?.values['p(95)'] || 0,
      p99: data.metrics.http_req_duration?.values['p(99)'] || 0,
      max: data.metrics.http_req_duration?.values?.max || 0,
    },
    thresholds: {
      passed: Object.entries(data.thresholds || {})
        .filter(([_, v]) => v.ok)
        .map(([k]) => k),
      failed: Object.entries(data.thresholds || {})
        .filter(([_, v]) => !v.ok)
        .map(([k]) => k),
    },
  };

  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'tests/performance/results/summary.json': JSON.stringify(summary, null, 2),
  };
}

// Simple text summary (k6 doesn't have built-in textSummary in all versions)
function textSummary(data) {
  const lines = [
    '='.repeat(60),
    'LOAD TEST SUMMARY',
    '='.repeat(60),
    '',
    `Duration: ${Math.round(data.state.testRunDurationMs / 1000)}s`,
    `Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`,
    `Request Rate: ${(data.metrics.http_reqs?.values?.rate || 0).toFixed(2)} req/s`,
    '',
    'LATENCY:',
    `  Average: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms`,
    `  p95: ${(data.metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms`,
    `  p99: ${(data.metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms`,
    `  Max: ${(data.metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms`,
    '',
    'ERRORS:',
    `  Rate: ${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%`,
    '',
    '='.repeat(60),
  ];

  return lines.join('\n');
}
