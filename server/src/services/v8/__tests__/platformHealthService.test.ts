import { beforeEach, describe, expect, it, vi } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
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
const mockGetRoomHealth = vi.fn();
const mockGetSessionsByWorkspace = vi.fn();
const mockGetLinkedRooms = vi.fn();

vi.mock('../aiOperatingEnvironmentService.js', () => ({
  getOperatingEnvironmentStatus: (...args: unknown[]) => mockGetOperatingEnvironmentStatus(...args),
}));

vi.mock('../collaborationRoomService.js', () => ({
  getActiveRoomsByOrg: (...args: unknown[]) => mockGetActiveRoomsByOrg(...args),
  getRoomHealth: (...args: unknown[]) => mockGetRoomHealth(...args),
}));

vi.mock('../workspaceCollaborationService.js', () => ({
  getSessionsByWorkspace: (...args: unknown[]) => mockGetSessionsByWorkspace(...args),
  getLinkedRooms: (...args: unknown[]) => mockGetLinkedRooms(...args),
}));

vi.mock('../workspaceGovernanceService.js', () => ({
  getGovernanceDashboard: (...args: unknown[]) => mockGetGovernanceDashboard(...args),
}));

vi.mock('../sourceTruthService.js', () => ({
  getTransformationPipeline: (...args: unknown[]) => mockGetTransformationPipeline(...args),
}));

vi.mock('../executionVisibilityService.js', () => ({
  rollupSignals: (...args: unknown[]) => mockRollupSignals(...args),
}));

vi.mock('../operatorAdminService.js', () => ({
  getOperatorDashboard: (...args: unknown[]) => mockGetOperatorDashboard(...args),
}));

vi.mock('../reportsPresModelService.js', () => ({
  getDeliveryPipeline: (...args: unknown[]) => mockGetDeliveryPipeline(...args),
}));

vi.mock('../financeIntegrationService.js', () => ({
  getFinanceDashboard: (...args: unknown[]) => mockGetFinanceDashboard(...args),
}));

vi.mock('../resultsROIService.js', () => ({
  getResultsDashboard: (...args: unknown[]) => mockGetResultsDashboard(...args),
}));

vi.mock('../contextSnapshotService.js', () => ({
  getSnapshotsByConversation: (...args: unknown[]) => mockGetSnapshotsByConversation(...args),
}));

vi.mock('../executionSpineService.js', () => ({
  getActiveRuns: (...args: unknown[]) => mockGetActiveRuns(...args),
}));

vi.mock('../workspaceCrossModuleService.js', () => ({
  getModuleLinks: (...args: unknown[]) => mockGetModuleLinks(...args),
}));

import {
  getClosureCertification,
  getCrossDomainIntegrity,
  getDomainReadiness,
  getPlatformHealth,
  getPlatformMetrics,
} from '../platformHealthService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const SLUG_ORG_ID = 'dbr77';
const INVALID_ORG = '';

function setupAllHealthy() {
  mockGetOperatingEnvironmentStatus.mockResolvedValue({
    layers: {
      context: 'healthy',
      retrieval: 'healthy',
      execution: 'healthy',
    },
  });
  mockGetActiveRoomsByOrg.mockResolvedValue([
    { roomId: '00000000-0000-4000-8000-aaaaaaaaaaaa', roomState: 'active' },
  ]);
  mockGetGovernanceDashboard.mockResolvedValue({
    totalPermissions: 5,
    complianceRate: 1.0,
  });
  mockGetTransformationPipeline.mockResolvedValue({
    totalSources: 10,
    activeSources: 8,
  });
  mockGetOperatorDashboard.mockResolvedValue({
    totalConnectors: 3,
    healthyConnectors: 3,
  });
  mockGetDeliveryPipeline.mockResolvedValue({
    totalArtifacts: 15,
    inProgress: 2,
  });
  mockGetFinanceDashboard.mockResolvedValue({
    totalIngestions: 50,
    failedIngestions: 0,
  });
  mockGetResultsDashboard.mockResolvedValue({
    totalKPIs: 12,
    activeDeviations: 0,
  });
  mockGetActiveRuns.mockResolvedValue([
    {
      runId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      contextSnapshotId: '00000000-0000-4000-8000-cccccccccccc',
      state: 'drafting',
    },
  ]);
  mockRollupSignals.mockResolvedValue({ totalSignals: 100 });
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  setupAllHealthy();
});

// ------------------------------------------
// getPlatformHealth
// ------------------------------------------

describe('getPlatformHealth', () => {
  it('returns healthy when all domains respond successfully', async () => {
    const result = await getPlatformHealth(ORG_ID);

    expect(result.overall).toBe('healthy');
    expect(result.domains).toHaveProperty('aiCore');
    expect(result.domains).toHaveProperty('multiplayer');
    expect(result.domains).toHaveProperty('workspace');
    expect(result.domains).toHaveProperty('lifecycle');
    expect(result.domains).toHaveProperty('pmSync');
    expect(result.domains).toHaveProperty('outputs');
    expect(result.timestamp).toBeDefined();
    expect(result.domains['aiCore'].status).toBe('healthy');
    expect(result.domains['multiplayer'].status).toBe('healthy');
  });

  it('reports degraded when AI layers are not all active', async () => {
    mockGetOperatingEnvironmentStatus.mockResolvedValue({
      layers: {
        context: 'healthy',
        retrieval: 'degraded',
      },
    });

    const result = await getPlatformHealth(ORG_ID);

    expect(result.domains['aiCore'].status).toBe('degraded');
    expect(result.overall).toBe('degraded');
  });

  it('reports degraded when multiplayer has degraded rooms', async () => {
    mockGetActiveRoomsByOrg.mockResolvedValue([
      { roomId: '00000000-0000-4000-8000-aaaaaaaaaaaa', roomState: 'error' },
    ]);

    const result = await getPlatformHealth(ORG_ID);

    expect(result.domains['multiplayer'].status).toBe('degraded');
  });

  it('reports critical when a domain call throws', async () => {
    mockGetOperatingEnvironmentStatus.mockRejectedValue(new Error('AI service down'));

    const result = await getPlatformHealth(ORG_ID);

    expect(result.domains['aiCore'].status).toBe('critical');
    expect(result.overall).toBe('critical');
  });

  it('reports degraded outputs when one output sub-domain fails', async () => {
    mockGetFinanceDashboard.mockRejectedValue(new Error('Finance unavailable'));

    const result = await getPlatformHealth(ORG_ID);

    expect(result.domains['outputs'].status).toBe('degraded');
  });

  it('accepts non-empty organization slugs used by live auth contexts', async () => {
    const result = await getPlatformHealth(SLUG_ORG_ID);

    expect(result.overall).toBe('healthy');
  });

  it('rejects invalid organizationId', async () => {
    await expect(getPlatformHealth(INVALID_ORG)).rejects.toThrow();
  });
});

// ------------------------------------------
// getCrossDomainIntegrity
// ------------------------------------------

describe('getCrossDomainIntegrity', () => {
  it('returns intact when all checks pass', async () => {
    const result = await getCrossDomainIntegrity(ORG_ID);

    expect(result.intact).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('returns not intact when execution runs lack snapshot references', async () => {
    mockGetActiveRuns.mockResolvedValue([
      {
        runId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        contextSnapshotId: null,
        state: 'drafting',
      },
    ]);

    const result = await getCrossDomainIntegrity(ORG_ID);

    const snapshotCheck = result.checks.find((c) => c.check === 'runs_reference_valid_snapshots');
    expect(snapshotCheck?.passed).toBe(false);
    expect(result.intact).toBe(false);
  });

  it('returns not intact when a domain is unreachable', async () => {
    mockGetActiveRuns.mockRejectedValue(new Error('DB timeout'));

    const result = await getCrossDomainIntegrity(ORG_ID);

    const runCheck = result.checks.find((c) => c.check === 'execution_runs_accessible');
    expect(runCheck?.passed).toBe(false);
    expect(result.intact).toBe(false);
  });

  it('passes when there are no active runs', async () => {
    mockGetActiveRuns.mockResolvedValue([]);

    const result = await getCrossDomainIntegrity(ORG_ID);

    const snapshotCheck = result.checks.find((c) => c.check === 'runs_reference_valid_snapshots');
    expect(snapshotCheck?.passed).toBe(true);
  });

  it('accepts non-empty organization slugs used by live auth contexts', async () => {
    const result = await getCrossDomainIntegrity(SLUG_ORG_ID);

    expect(result.intact).toBe(true);
  });

  it('rejects invalid organizationId', async () => {
    await expect(getCrossDomainIntegrity(INVALID_ORG)).rejects.toThrow();
  });
});

// ------------------------------------------
// getClosureCertification
// ------------------------------------------

describe('getClosureCertification', () => {
  it('certifies when health is not critical and integrity passes', async () => {
    const result = await getClosureCertification(ORG_ID);

    expect(result.certified).toBe(true);
    expect(result.wavesClosed).toBe(20);
    expect(result.totalWaves).toBe(20);
    expect(result.certifiedAt).toBeDefined();
    expect(result.certificationId).toBeDefined();
    expect(result.platformHealth.overall).not.toBe('critical');
    expect(result.integrityResult.intact).toBe(true);
  });

  it('does not certify when health is critical', async () => {
    mockGetOperatingEnvironmentStatus.mockRejectedValue(new Error('AI down'));

    const result = await getClosureCertification(ORG_ID);

    expect(result.certified).toBe(false);
    expect(result.certifiedAt).toBeNull();
    expect(result.certificationId).toBeNull();
  });

  it('does not certify when integrity fails', async () => {
    mockGetActiveRuns.mockResolvedValue([
      {
        runId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        contextSnapshotId: null,
        state: 'drafting',
      },
    ]);

    const result = await getClosureCertification(ORG_ID);

    expect(result.certified).toBe(false);
    expect(result.certifiedAt).toBeNull();
  });

  it('still certifies when health is degraded (not critical)', async () => {
    mockGetOperatingEnvironmentStatus.mockResolvedValue({
      layers: { context: 'degraded' },
    });

    const result = await getClosureCertification(ORG_ID);

    expect(result.platformHealth.overall).toBe('degraded');
    expect(result.certified).toBe(true);
  });

  it('accepts non-empty organization slugs used by live auth contexts', async () => {
    const result = await getClosureCertification(SLUG_ORG_ID);

    expect(result.certified).toBe(true);
  });

  it('rejects invalid organizationId', async () => {
    await expect(getClosureCertification(INVALID_ORG)).rejects.toThrow();
  });
});

// ------------------------------------------
// getPlatformMetrics
// ------------------------------------------

describe('getPlatformMetrics', () => {
  it('collects metrics from all domains', async () => {
    const result = await getPlatformMetrics(ORG_ID);

    expect(result.metrics).toHaveProperty('activeExecutionRuns');
    expect(result.metrics).toHaveProperty('activeCollaborationRooms');
    expect(result.metrics).toHaveProperty('outputArtifacts');
    expect(result.metrics).toHaveProperty('financeIngestions');
    expect(result.metrics).toHaveProperty('kpisTracked');
    expect(result.metrics).toHaveProperty('transformationSources');
    expect(result.collectedAt).toBeDefined();
  });

  it('returns counts from service responses', async () => {
    const result = await getPlatformMetrics(ORG_ID);

    expect(result.metrics['activeExecutionRuns']).toBe(1);
    expect(result.metrics['activeCollaborationRooms']).toBe(1);
    expect(result.metrics['outputArtifacts']).toBe(15);
    expect(result.metrics['financeIngestions']).toBe(50);
    expect(result.metrics['kpisTracked']).toBe(12);
    expect(result.metrics['transformationSources']).toBe(10);
  });

  it('returns 0 for domains that fail', async () => {
    mockGetActiveRuns.mockRejectedValue(new Error('timeout'));
    mockGetActiveRoomsByOrg.mockRejectedValue(new Error('timeout'));

    const result = await getPlatformMetrics(ORG_ID);

    expect(result.metrics['activeExecutionRuns']).toBe(0);
    expect(result.metrics['activeCollaborationRooms']).toBe(0);
  });

  it('accepts non-empty organization slugs used by live auth contexts', async () => {
    const result = await getPlatformMetrics(SLUG_ORG_ID);

    expect(result.metrics['activeExecutionRuns']).toBe(1);
  });

  it('rejects invalid organizationId', async () => {
    await expect(getPlatformMetrics(INVALID_ORG)).rejects.toThrow();
  });
});

// ------------------------------------------
// getDomainReadiness
// ------------------------------------------

describe('getDomainReadiness', () => {
  it('returns all domains ready when services are healthy', async () => {
    const result = await getDomainReadiness(ORG_ID);

    expect(result.domains.length).toBe(6);
    expect(result.domains.every((d) => d.ready)).toBe(true);

    const domainNames = result.domains.map((d) => d.name);
    expect(domainNames).toContain('aiCore');
    expect(domainNames).toContain('multiplayer');
    expect(domainNames).toContain('workspace');
    expect(domainNames).toContain('lifecycle');
    expect(domainNames).toContain('pmSync');
    expect(domainNames).toContain('outputs');
  });

  it('marks aiCore not ready when layers are not all active', async () => {
    mockGetOperatingEnvironmentStatus.mockResolvedValue({
      layers: { context: 'degraded' },
    });

    const result = await getDomainReadiness(ORG_ID);

    const aiCore = result.domains.find((d) => d.name === 'aiCore');
    expect(aiCore?.ready).toBe(false);
    const layerCheck = aiCore?.checks.find((c) => c.name === 'all_layers_active');
    expect(layerCheck?.passed).toBe(false);
  });

  it('marks multiplayer not ready when degraded rooms exist', async () => {
    mockGetActiveRoomsByOrg.mockResolvedValue([
      { roomId: '00000000-0000-4000-8000-aaaaaaaaaaaa', roomState: 'error' },
    ]);

    const result = await getDomainReadiness(ORG_ID);

    const mp = result.domains.find((d) => d.name === 'multiplayer');
    expect(mp?.ready).toBe(false);
  });

  it('marks domain not ready when service is unreachable', async () => {
    mockGetOperatorDashboard.mockRejectedValue(new Error('unreachable'));

    const result = await getDomainReadiness(ORG_ID);

    const pmSync = result.domains.find((d) => d.name === 'pmSync');
    expect(pmSync?.ready).toBe(false);
  });

  it('marks outputs not ready when any sub-service fails', async () => {
    mockGetFinanceDashboard.mockRejectedValue(new Error('down'));

    const result = await getDomainReadiness(ORG_ID);

    const outputs = result.domains.find((d) => d.name === 'outputs');
    expect(outputs?.ready).toBe(false);
    const finCheck = outputs?.checks.find((c) => c.name === 'finance_dashboard_accessible');
    expect(finCheck?.passed).toBe(false);
  });

  it('accepts non-empty organization slugs used by live auth contexts', async () => {
    const result = await getDomainReadiness(SLUG_ORG_ID);

    expect(result.domains.length).toBe(6);
  });

  it('rejects invalid organizationId', async () => {
    await expect(getDomainReadiness(INVALID_ORG)).rejects.toThrow();
  });
});
