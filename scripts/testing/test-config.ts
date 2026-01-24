/**
 * IRIS 6.0 Testing Configuration
 * Centralized configuration for all testing operations
 */

export interface TestConfig {
  timeouts: {
    unit: number;
    integration: number;
    e2e: number;
    performance: number;
  };
  thresholds: {
    coverageGlobal: number;
    coverageCritical: number;
    passRateUnit: number;
    passRateIntegration: number;
    passRateE2E: number;
    p95LatencyMs: number;
    bundleSizeKb: number;
  };
  paths: {
    unit: string;
    integration: string;
    component: string;
    e2e: string;
    security: string;
    performance: string;
  };
  reporters: {
    outputDir: string;
    formats: ('json' | 'html' | 'junit')[];
  };
}

export const testConfig: TestConfig = {
  timeouts: {
    unit: 30000, // 30s per unit test
    integration: 60000, // 60s per integration test
    e2e: 120000, // 2min per E2E test
    performance: 300000, // 5min for performance tests
  },

  thresholds: {
    coverageGlobal: 85,
    coverageCritical: 95,
    passRateUnit: 98,
    passRateIntegration: 91,
    passRateE2E: 94,
    p95LatencyMs: 200,
    bundleSizeKb: 500,
  },

  paths: {
    unit: 'tests/unit',
    integration: 'tests/integration',
    component: 'tests/components',
    e2e: 'tests/e2e',
    security: 'tests/security',
    performance: 'tests/performance',
  },

  reporters: {
    outputDir: 'test-results',
    formats: ['json', 'html', 'junit'],
  },
};

// Environment detection
export const isCI = (): boolean => {
  return (
    process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.GITLAB_CI === 'true' ||
    process.env.JENKINS_URL !== undefined
  );
};

// Module to test path mapping
export const moduleTestMap: Record<string, string[]> = {
  // Industrial modules
  mes: ['tests/unit/backend/services/mes', 'tests/integration/mes'],
  wms: ['tests/unit/backend/services/wms', 'tests/integration/wms'],
  qms: ['tests/unit/backend/services/qms', 'tests/integration/qms'],
  cmms: ['tests/unit/backend/services/cmms', 'tests/integration/cmms'],
  iot: ['tests/unit/backend/services/iot', 'tests/integration/iot'],
  gemba: ['tests/unit/backend/services/gemba', 'tests/integration/gemba'],
  hse: ['tests/unit/backend/services/hse', 'tests/integration/hse'],
  esg: ['tests/unit/backend/services/esg', 'tests/integration/esg'],
  hrm: ['tests/unit/backend/services/hrm', 'tests/integration/hrm'],
  lms: ['tests/unit/backend/services/lms', 'tests/integration/lms'],

  // Core modules
  auth: ['tests/auth', 'tests/security/auth'],
  api: ['tests/api', 'tests/integration/routes'],
  admin: ['tests/unit/backend/services/admin', 'tests/e2e/admin'],

  // Frontend
  components: ['tests/components'],
  hooks: ['tests/hooks'],
  views: ['tests/views'],
};
