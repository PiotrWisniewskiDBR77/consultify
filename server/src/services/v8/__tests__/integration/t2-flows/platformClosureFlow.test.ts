/**
 * Platform Closure Flow — Wave 20 (FINAL) Integration Test
 *
 * Proves the entire V8 platform works as a unified system:
 *   F01: Platform health aggregation
 *   F02: Cross-domain integrity
 *   F03: Closure certification
 *   F04: Platform metrics collection
 *   F05: Domain readiness assessment
 *   F06: Degraded platform detection
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ==========================================
// MOCK UPSTREAM SERVICES
// ==========================================

const mockGetOperatingEnvironmentStatus = vi.fn();
const mockGetActiveRoomsByOrg = vi.fn();
const mockGetRoomHealth = vi.fn();
const mockGetGovernanceDashboard = vi.fn();
const mockGetTransformationPipeline = vi.fn();
const mockGetOperatorDashboard = vi.fn();
const mockGetDeliveryPipeline = vi.fn();
const mockGetFinanceDashboard = vi.fn();
const mockGetResultsDashboard = vi.fn();
const mockGetActiveRuns = vi.fn();
const mockRollupSignals = vi.fn();
const mockGetSnapshotsByConversation = vi.fn();
const mockGetModuleLinks = vi.fn();
const mockGetSessionsByWorkspace = vi.fn();
const mockGetLinkedRooms = vi.fn();

vi.mock('../../../aiOperatingEnvironmentService.js', () => ({
  getOperatingEnvironmentStatus: (...args: unknown[]) => mockGetOperatingEnvironmentStatus(...args),
}));

vi.mock('../../../collaborationRoomService.js', () => ({
  getActiveRoomsByOrg: (...args: unknown[]) => mockGetActiveRoomsByOrg(...args),
  getRoomHealth: (...args: unknown[]) => mockGetRoomHealth(...args),
}));

vi.mock('../../../workspaceCollaborationService.js', () => ({
  getSessionsByWorkspace: (...args: unknown[]) => mockGetSessionsByWorkspace(...args),
  getLinkedRooms: (...args: unknown[]) => mockGetLinkedRooms(...args),
}));

vi.mock('../../../workspaceGovernanceService.js', () => ({
  getGovernanceDashboard: (...args: unknown[]) => mockGetGovernanceDashboard(...args),
}));

vi.mock('../../../sourceTruthService.js', () => ({
  getTransformationPipeline: (...args: unknown[]) => mockGetTransformationPipeline(...args),
}));

vi.mock('../../../executionVisibilityService.js', () => ({
  rollupSignals: (...args: unknown[]) => mockRollupSignals(...args),
}));

vi.mock('../../../operatorAdminService.js', () => ({
  getOperatorDashboard: (...args: unknown[]) => mockGetOperatorDashboard(...args),
}));

vi.mock('../../../reportsPresModelService.js', () => ({
  getDeliveryPipeline: (...args: unknown[]) => mockGetDeliveryPipeline(...args),
}));

vi.mock('../../../financeIntegrationService.js', () => ({
  getFinanceDashboard: (...args: unknown[]) => mockGetFinanceDashboard(...args),
}));

vi.mock('../../../resultsROIService.js', () => ({
  getResultsDashboard: (...args: unknown[]) => mockGetResultsDashboard(...args),
}));

vi.mock('../../../contextSnapshotService.js', () => ({
  getSnapshotsByConversation: (...args: unknown[]) => mockGetSnapshotsByConversation(...args),
}));

vi.mock('../../../executionSpineService.js', () => ({
  getActiveRuns: (...args: unknown[]) => mockGetActiveRuns(...args),
}));

vi.mock('../../../workspaceCrossModuleService.js', () => ({
  getModuleLinks: (...args: unknown[]) => mockGetModuleLinks(...args),
}));

import {
  getClosureCertification,
  getCrossDomainIntegrity,
  getDomainReadiness,
  getPlatformHealth,
  getPlatformMetrics,
} from '../../../platformHealthService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';

function setupFullyHealthyPlatform() {
  mockGetOperatingEnvironmentStatus.mockResolvedValue({
    layers: [
      { name: 'context', status: 'active' },
      { name: 'retrieval', status: 'active' },
      { name: 'execution', status: 'active' },
      { name: 'toolGovernance', status: 'active' },
      { name: 'trustAudit', status: 'active' },
    ],
  });

  mockGetActiveRoomsByOrg.mockResolvedValue([
    { roomId: '00000000-0000-4000-8000-aaaaaaaaaaaa', state: 'active' },
    { roomId: '00000000-0000-4000-8000-aaaaaaaaaaab', state: 'active' },
  ]);

  mockGetGovernanceDashboard.mockResolvedValue({
    totalPermissions: 12,
    complianceRate: 0.98,
    activeClassifications: 5,
  });

  mockGetTransformationPipeline.mockResolvedValue({
    totalSources: 25,
    activeSources: 20,
    staleSources: 2,
  });

  mockGetOperatorDashboard.mockResolvedValue({
    totalConnectors: 5,
    healthyConnectors: 5,
    pausedConnectors: 0,
  });

  mockGetDeliveryPipeline.mockResolvedValue({
    totalArtifacts: 42,
    inProgress: 3,
    delivered: 35,
    failed: 0,
  });

  mockGetFinanceDashboard.mockResolvedValue({
    totalIngestions: 120,
    failedIngestions: 0,
    unresolvedEscalations: 0,
  });

  mockGetResultsDashboard.mockResolvedValue({
    totalKPIs: 30,
    activeDeviations: 0,
    reconciliationHealth: 'healthy',
  });

  mockGetActiveRuns.mockResolvedValue([
    {
      runId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      contextSnapshotId: '00000000-0000-4000-8000-cccccccccccc',
      state: 'drafting',
      organizationId: ORG_ID,
    },
    {
      runId: '00000000-0000-4000-8000-bbbbbbbbbbbc',
      contextSnapshotId: '00000000-0000-4000-8000-cccccccccccd',
      state: 'in_review',
      organizationId: ORG_ID,
    },
  ]);

  mockRollupSignals.mockResolvedValue({
    totalSignals: 500,
    byType: { progress: 300, risk: 50, blocker: 10 },
  });
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  setupFullyHealthyPlatform();
});

// ------------------------------------------
// F01: Platform health aggregation
// ------------------------------------------

describe('F01 — Platform health aggregation', () => {
  it('aggregates health from all V8 domains into a unified view', async () => {
    const health = await getPlatformHealth(ORG_ID);

    expect(health.overall).toBe('healthy');
    expect(health.timestamp).toBeDefined();

    const domainNames = Object.keys(health.domains);
    expect(domainNames).toContain('aiCore');
    expect(domainNames).toContain('multiplayer');
    expect(domainNames).toContain('workspace');
    expect(domainNames).toContain('lifecycle');
    expect(domainNames).toContain('pmSync');
    expect(domainNames).toContain('outputs');

    expect(mockGetOperatingEnvironmentStatus).toHaveBeenCalledWith(ORG_ID);
    expect(mockGetActiveRoomsByOrg).toHaveBeenCalledWith(ORG_ID);
    expect(mockGetGovernanceDashboard).toHaveBeenCalled();
    expect(mockGetTransformationPipeline).toHaveBeenCalledWith(ORG_ID);
    expect(mockGetOperatorDashboard).toHaveBeenCalledWith(ORG_ID);
    expect(mockGetDeliveryPipeline).toHaveBeenCalledWith(ORG_ID);
    expect(mockGetFinanceDashboard).toHaveBeenCalledWith(ORG_ID);
    expect(mockGetResultsDashboard).toHaveBeenCalledWith(ORG_ID);
  });

  it('includes domain-specific details in each health entry', async () => {
    const health = await getPlatformHealth(ORG_ID);

    expect(health.domains['multiplayer'].details).toHaveProperty('activeRooms', 2);
    expect(health.domains['multiplayer'].details).toHaveProperty('degradedRooms', 0);
  });
});

// ------------------------------------------
// F02: Cross-domain integrity
// ------------------------------------------

describe('F02 — Cross-domain integrity', () => {
  it('verifies cross-domain links are intact across all domains', async () => {
    const integrity = await getCrossDomainIntegrity(ORG_ID);

    expect(integrity.intact).toBe(true);
    expect(integrity.checks.length).toBeGreaterThanOrEqual(5);

    for (const check of integrity.checks) {
      expect(check).toHaveProperty('domain');
      expect(check).toHaveProperty('check');
      expect(check).toHaveProperty('passed');
      expect(check).toHaveProperty('details');
      expect(check.passed).toBe(true);
    }
  });

  it('detects broken snapshot references in execution runs', async () => {
    mockGetActiveRuns.mockResolvedValue([
      {
        runId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        contextSnapshotId: null,
        state: 'drafting',
      },
    ]);

    const integrity = await getCrossDomainIntegrity(ORG_ID);

    expect(integrity.intact).toBe(false);
    const brokenCheck = integrity.checks.find((c) => c.check === 'runs_reference_valid_snapshots');
    expect(brokenCheck?.passed).toBe(false);
    expect(brokenCheck?.details).toContain('0/1');
  });
});

// ------------------------------------------
// F03: Closure certification
// ------------------------------------------

describe('F03 — Closure certification', () => {
  it('issues certification when platform is healthy and integrity passes', async () => {
    const cert = await getClosureCertification(ORG_ID);

    expect(cert.certified).toBe(true);
    expect(cert.wavesClosed).toBe(20);
    expect(cert.totalWaves).toBe(20);
    expect(cert.certifiedAt).toBeDefined();
    expect(cert.certificationId).toBeDefined();

    // Validate UUID format of certificationId
    expect(cert.certificationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    expect(cert.platformHealth.overall).not.toBe('critical');
    expect(cert.integrityResult.intact).toBe(true);
  });

  it('refuses certification when platform health is critical', async () => {
    mockGetOperatingEnvironmentStatus.mockRejectedValue(new Error('AI Core completely down'));

    const cert = await getClosureCertification(ORG_ID);

    expect(cert.certified).toBe(false);
    expect(cert.certifiedAt).toBeNull();
    expect(cert.certificationId).toBeNull();
    expect(cert.platformHealth.overall).toBe('critical');
  });

  it('refuses certification when integrity checks fail', async () => {
    mockGetActiveRuns.mockResolvedValue([
      {
        runId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        contextSnapshotId: null,
        state: 'drafting',
      },
    ]);

    const cert = await getClosureCertification(ORG_ID);

    expect(cert.certified).toBe(false);
    expect(cert.integrityResult.intact).toBe(false);
  });

  it('certifies even with degraded (non-critical) health', async () => {
    mockGetActiveRoomsByOrg.mockResolvedValue([
      { roomId: '00000000-0000-4000-8000-aaaaaaaaaaaa', state: 'degraded' },
    ]);

    const cert = await getClosureCertification(ORG_ID);

    expect(cert.certified).toBe(true);
    expect(cert.platformHealth.overall).toBe('degraded');
    expect(cert.platformHealth.domains['multiplayer'].status).toBe('degraded');
  });
});

// ------------------------------------------
// F04: Platform metrics collection
// ------------------------------------------

describe('F04 — Platform metrics collection', () => {
  it('collects metrics from all V8 domains', async () => {
    const metrics = await getPlatformMetrics(ORG_ID);

    expect(metrics.collectedAt).toBeDefined();
    expect(metrics.metrics['activeExecutionRuns']).toBe(2);
    expect(metrics.metrics['activeCollaborationRooms']).toBe(2);
    expect(metrics.metrics['outputArtifacts']).toBe(42);
    expect(metrics.metrics['financeIngestions']).toBe(120);
    expect(metrics.metrics['kpisTracked']).toBe(30);
    expect(metrics.metrics['transformationSources']).toBe(25);
  });

  it('gracefully handles domain failures with zero counts', async () => {
    mockGetActiveRuns.mockRejectedValue(new Error('service down'));
    mockGetDeliveryPipeline.mockRejectedValue(new Error('service down'));

    const metrics = await getPlatformMetrics(ORG_ID);

    expect(metrics.metrics['activeExecutionRuns']).toBe(0);
    expect(metrics.metrics['outputArtifacts']).toBe(0);
    // Other metrics still collected
    expect(metrics.metrics['activeCollaborationRooms']).toBe(2);
    expect(metrics.metrics['kpisTracked']).toBe(30);
  });
});

// ------------------------------------------
// F05: Domain readiness assessment
// ------------------------------------------

describe('F05 — Domain readiness assessment', () => {
  it('assesses all domains as ready when platform is healthy', async () => {
    const readiness = await getDomainReadiness(ORG_ID);

    expect(readiness.domains.length).toBe(6);
    for (const domain of readiness.domains) {
      expect(domain.ready).toBe(true);
      expect(domain.checks.length).toBeGreaterThan(0);
      for (const check of domain.checks) {
        expect(check.passed).toBe(true);
      }
    }
  });

  it('provides per-domain readiness with specific checks', async () => {
    const readiness = await getDomainReadiness(ORG_ID);

    const aiCore = readiness.domains.find((d) => d.name === 'aiCore');
    expect(aiCore).toBeDefined();
    expect(aiCore!.checks.some((c) => c.name === 'operating_environment_accessible')).toBe(true);
    expect(aiCore!.checks.some((c) => c.name === 'all_layers_active')).toBe(true);

    const mp = readiness.domains.find((d) => d.name === 'multiplayer');
    expect(mp).toBeDefined();
    expect(mp!.checks.some((c) => c.name === 'rooms_service_accessible')).toBe(true);
    expect(mp!.checks.some((c) => c.name === 'no_degraded_rooms')).toBe(true);

    const outputs = readiness.domains.find((d) => d.name === 'outputs');
    expect(outputs).toBeDefined();
    expect(outputs!.checks.some((c) => c.name === 'delivery_pipeline_accessible')).toBe(true);
    expect(outputs!.checks.some((c) => c.name === 'finance_dashboard_accessible')).toBe(true);
    expect(outputs!.checks.some((c) => c.name === 'results_dashboard_accessible')).toBe(true);
  });

  it('marks specific domain not ready when its service fails', async () => {
    mockGetTransformationPipeline.mockRejectedValue(new Error('lifecycle down'));

    const readiness = await getDomainReadiness(ORG_ID);

    const lifecycle = readiness.domains.find((d) => d.name === 'lifecycle');
    expect(lifecycle?.ready).toBe(false);

    // Other domains remain ready
    const aiCore = readiness.domains.find((d) => d.name === 'aiCore');
    expect(aiCore?.ready).toBe(true);
  });
});

// ------------------------------------------
// F06: Degraded platform detection
// ------------------------------------------

describe('F06 — Degraded platform detection', () => {
  it('correctly detects degraded state from multiplayer domain', async () => {
    mockGetActiveRoomsByOrg.mockResolvedValue([
      { roomId: '00000000-0000-4000-8000-aaaaaaaaaaaa', state: 'active' },
      { roomId: '00000000-0000-4000-8000-aaaaaaaaaaab', state: 'degraded' },
      { roomId: '00000000-0000-4000-8000-aaaaaaaaaaac', state: 'degraded' },
    ]);

    const health = await getPlatformHealth(ORG_ID);

    expect(health.overall).toBe('degraded');
    expect(health.domains['multiplayer'].status).toBe('degraded');
    expect(health.domains['multiplayer'].details).toHaveProperty('degradedRooms', 2);
  });

  it('correctly detects critical state when AI core is down', async () => {
    mockGetOperatingEnvironmentStatus.mockRejectedValue(new Error('Complete AI failure'));

    const health = await getPlatformHealth(ORG_ID);

    expect(health.overall).toBe('critical');
    expect(health.domains['aiCore'].status).toBe('critical');
  });

  it('correctly detects degraded outputs when finance is down', async () => {
    mockGetFinanceDashboard.mockRejectedValue(new Error('Finance service unavailable'));

    const health = await getPlatformHealth(ORG_ID);

    expect(health.domains['outputs'].status).toBe('degraded');
    expect(health.domains['outputs'].details).toHaveProperty('finance');
  });

  it('reports healthy when all degraded conditions are resolved', async () => {
    // Default setup is fully healthy
    const health = await getPlatformHealth(ORG_ID);

    expect(health.overall).toBe('healthy');
    for (const domain of Object.values(health.domains)) {
      expect(domain.status).toBe('healthy');
    }
  });

  it('critical overrides degraded in overall status', async () => {
    // AI Core critical + multiplayer degraded → overall critical
    mockGetOperatingEnvironmentStatus.mockRejectedValue(new Error('AI down'));
    mockGetActiveRoomsByOrg.mockResolvedValue([
      { roomId: '00000000-0000-4000-8000-aaaaaaaaaaaa', state: 'degraded' },
    ]);

    const health = await getPlatformHealth(ORG_ID);

    expect(health.overall).toBe('critical');
    expect(health.domains['aiCore'].status).toBe('critical');
    expect(health.domains['multiplayer'].status).toBe('degraded');
  });
});
