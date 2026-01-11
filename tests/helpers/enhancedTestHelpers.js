/**
 * Enhanced Test Helpers
 * Utility functions for testing across all test levels
 *
 * @module tests/helpers/enhancedTestHelpers.js
 */

import { vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a mock user with customizable properties
 */
export function mockUser(overrides = {}) {
  const id = overrides.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    email: `user-${id}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    organizationId: 'org-test',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate a mock organization
 */
export function mockOrganization(overrides = {}) {
  const id = overrides.id || `org-${Date.now()}`;
  return {
    id,
    name: `Test Organization ${id}`,
    status: 'active',
    plan: 'enterprise',
    userCount: 10,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate a mock project
 */
export function mockProject(overrides = {}) {
  const id = overrides.id || `project-${Date.now()}`;
  return {
    id,
    name: `Test Project ${id}`,
    description: 'Test project description',
    status: 'active',
    organizationId: 'org-test',
    createdBy: 'user-test',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate a mock API response
 */
export function mockApiResponse(data, overrides = {}) {
  return {
    success: true,
    data,
    message: null,
    ...overrides,
  };
}

/**
 * Generate a mock error response
 */
export function mockErrorResponse(message, code, overrides = {}) {
  return {
    success: false,
    error: message,
    code,
    ...overrides,
  };
}

/**
 * Generate mock pagination
 */
export function mockPagination(page = 1, limit = 20, total = 100) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page < Math.ceil(total / limit),
    hasPrev: page > 1,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition, options = {}) {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Retry a function until it succeeds or times out
 */
export async function retry(fn, options = {}) {
  const { maxAttempts = 3, delay = 100, backoff = 2 } = options;
  let lastError;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, currentDelay));
        currentDelay *= backoff;
      }
    }
  }

  throw lastError;
}

/**
 * Delay execution
 */
export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSERTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assert response matches expected API format
 */
export function assertApiResponse(response, expectedStatus = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers['content-type']).toMatch(/json/);

  if (expectedStatus >= 200 && expectedStatus < 300) {
    expect(response.body).toHaveProperty('success', true);
  } else {
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  }
}

/**
 * Assert object has required fields
 */
export function assertHasFields(obj, fields) {
  for (const field of fields) {
    expect(obj).toHaveProperty(field);
  }
}

/**
 * Assert arrays are equal ignoring order
 */
export function assertArraysEqualIgnoringOrder(actual, expected) {
  expect(actual.sort()).toEqual(expected.sort());
}

/**
 * Assert object matches schema
 */
export function assertMatchesSchema(obj, schema) {
  for (const [key, type] of Object.entries(schema)) {
    if (key in obj) {
      if (Array.isArray(type)) {
        expect(type).toContain(typeof obj[key]);
      } else {
        expect(typeof obj[key]).toBe(type);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SERVICE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a mock database service
 */
export function createMockDatabase() {
  const data = new Map();

  return {
    get: vi.fn((key) => data.get(key)),
    set: vi.fn((key, value) => data.set(key, value)),
    delete: vi.fn((key) => data.delete(key)),
    all: vi.fn((query) => Array.from(data.values())),
    run: vi.fn(() => ({ changes: 1 })),
    prepare: vi.fn(() => ({
      get: vi.fn(),
      all: vi.fn(() => []),
      run: vi.fn(() => ({ changes: 1 })),
    })),
    clear: () => data.clear(),
    _data: data,
  };
}

/**
 * Create a mock cache service
 */
export function createMockCache() {
  const cache = new Map();

  return {
    get: vi.fn((key) => cache.get(key)),
    set: vi.fn((key, value, ttl) => cache.set(key, value)),
    delete: vi.fn((key) => cache.delete(key)),
    clear: vi.fn(() => cache.clear()),
    has: vi.fn((key) => cache.has(key)),
    _cache: cache,
  };
}

/**
 * Create a mock HTTP client
 */
export function createMockHttpClient(responses = {}) {
  return {
    get: vi.fn((url) => Promise.resolve(responses[url] || { data: {} })),
    post: vi.fn((url, data) => Promise.resolve(responses[url] || { data: {} })),
    put: vi.fn((url, data) => Promise.resolve(responses[url] || { data: {} })),
    delete: vi.fn((url) => Promise.resolve(responses[url] || { data: {} })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate random string
 */
export function randomString(length = 10) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * Generate random email
 */
export function randomEmail(domain = 'test.com') {
  return `${randomString(8)}@${domain}`;
}

/**
 * Generate random number in range
 */
export function randomNumber(min = 0, max = 100) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate unique ID
 */
export function uniqueId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${randomString(6)}`;
}

/**
 * Generate array of mock items
 */
export function generateMockArray(generator, count = 10) {
  return Array.from({ length: count }, (_, i) => generator(i));
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a cleanup tracker for test resources
 */
export function createCleanupTracker() {
  const cleanupFns = [];

  return {
    track: (fn) => cleanupFns.push(fn),
    cleanup: async () => {
      for (const fn of cleanupFns.reverse()) {
        await fn();
      }
      cleanupFns.length = 0;
    },
  };
}

/**
 * Run with cleanup
 */
export async function withCleanup(setupFn, testFn) {
  const cleanup = createCleanupTracker();
  const resource = await setupFn(cleanup);
  try {
    await testFn(resource);
  } finally {
    await cleanup.cleanup();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Measure execution time
 */
export async function measureTime(fn) {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Assert operation completes within time limit
 */
export async function assertCompletesWithin(fn, maxMs) {
  const { duration } = await measureTime(fn);
  expect(duration).toBeLessThan(maxMs);
}

export default {
  mockUser,
  mockOrganization,
  mockProject,
  mockApiResponse,
  mockErrorResponse,
  mockPagination,
  waitFor,
  retry,
  delay,
  assertApiResponse,
  assertHasFields,
  assertArraysEqualIgnoringOrder,
  assertMatchesSchema,
  createMockDatabase,
  createMockCache,
  createMockHttpClient,
  randomString,
  randomEmail,
  randomNumber,
  uniqueId,
  generateMockArray,
  createCleanupTracker,
  withCleanup,
  measureTime,
  assertCompletesWithin,
};
