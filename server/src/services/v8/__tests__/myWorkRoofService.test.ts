import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  ClassifyHomeBlockParams,
  RecordInboxMaterializationParams,
  SetCalendarPhaseParams,
  SetCanonicalObjectStateParams,
  SurfaceProjection,
  UpdateSurfaceProjectionParams,
} from '../../../types/myWorkRoofPackage.js';
import {
  CalendarPhaseNameValues,
  CalendarPhaseSchema,
  CalendarPhaseStatusValues,
  CanonicalObjectStateSchema,
  CanonicalObjectTypeValues,
  ClassifyHomeBlockParamsSchema,
  classifyLatencyBand,
  HomeBlockMaturitySchema,
  HomeBlockNameValues,
  InboxMaterializationSchema,
  LATENCY_BAND_THRESHOLDS,
  LatencyBandValues,
  MaturityLevelValues,
  MyWorkSurfaceValues,
  RecordInboxMaterializationParamsSchema,
  SetCalendarPhaseParamsSchema,
  SetCanonicalObjectStateParamsSchema,
  SurfaceProjectionSchema,
  UpdateSurfaceProjectionParamsSchema,
} from '../../../types/myWorkRoofPackage.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbAll = vi.fn().mockResolvedValue([]);
const mockDbGet = vi.fn().mockResolvedValue(null);

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

import {
  classifyHomeBlock,
  getCalendarPhases,
  getCanonicalObjectState,
  getHomeBlockMaturity,
  getInboxMaterializationStats,
  getSurfaceProjection,
  recordInboxMaterialization,
  setCalendarPhase,
  setCanonicalObjectState,
  updateSurfaceProjection,
} from '../myWorkRoofService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = 'dbr77';
const OTHER_ORG_ID = 'atelier';
const USER_ID = '00000000-0000-4000-8000-000000000010';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000020';
const OBJECT_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';

function makeSetStateParams(
  overrides?: Partial<SetCanonicalObjectStateParams>
): SetCanonicalObjectStateParams {
  return {
    objectId: OBJECT_ID,
    objectType: 'task',
    organizationId: ORG_ID,
    canonicalState: 'active',
    ...overrides,
  };
}

function makeClassifyBlockParams(
  overrides?: Partial<ClassifyHomeBlockParams>
): ClassifyHomeBlockParams {
  return {
    blockName: 'aiPulseCore',
    organizationId: ORG_ID,
    maturityLevel: 'backed_by_real_service',
    serviceRef: 'radarService',
    ...overrides,
  };
}

function makeMaterializationParams(
  overrides?: Partial<RecordInboxMaterializationParams>
): RecordInboxMaterializationParams {
  return {
    eventSourceRef: 'notification:pending_review:evt-001',
    inboxItemId: 'inbox-item-001',
    userId: USER_ID,
    organizationId: ORG_ID,
    latencyMs: 1200,
    ...overrides,
  };
}

function makeCalendarPhaseParams(
  overrides?: Partial<SetCalendarPhaseParams>
): SetCalendarPhaseParams {
  return {
    phaseName: 'phase_a_internal',
    organizationId: ORG_ID,
    status: 'active',
    ...overrides,
  };
}

function makeFakeStateRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    object_id: OBJECT_ID,
    object_type: 'task',
    organization_id: ORG_ID,
    canonical_state: 'active',
    last_updated_at: '2026-03-23T10:00:00.000Z',
    surface_projections: JSON.stringify({}),
    ...overrides,
  };
}

function makeFakeBlockRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    block_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    block_name: 'aiPulseCore',
    organization_id: ORG_ID,
    maturity_level: 'backed_by_real_service',
    service_ref: 'radarService',
    last_audited_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeMaterializationRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    materialization_id: '00000000-0000-4000-8000-cccccccccccc',
    event_source_ref: 'notification:pending_review:evt-001',
    inbox_item_id: 'inbox-item-001',
    user_id: USER_ID,
    organization_id: ORG_ID,
    materialized_at: '2026-03-23T10:00:00.000Z',
    latency_ms: 1200,
    latency_band: 'near_realtime',
    ...overrides,
  };
}

function makeFakePhaseRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    phase_id: '00000000-0000-4000-8000-dddddddddddd',
    phase_name: 'phase_a_internal',
    organization_id: ORG_ID,
    status: 'active',
    blocked_by: null,
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbAll.mockResolvedValue([]);
  mockDbGet.mockResolvedValue(null);
});

// ------------------------------------------
// A. TYPE SYSTEM VALIDATION
// ------------------------------------------

describe('MyWork Roof Package — Type System', () => {
  it('T01: MyWorkSurface has exactly 4 values', () => {
    expect(MyWorkSurfaceValues).toEqual(['home', 'calendar', 'inbox', 'radar']);
    expect(MyWorkSurfaceValues.length).toBe(4);
  });

  it('T02: CanonicalObjectType preserves the roof types and append-only Results VNext types', () => {
    expect(CanonicalObjectTypeValues).toEqual([
      'task',
      'decision',
      'initiative',
      'milestone',
      'approval',
      'ai_proposal',
      'notification',
      'signal',
      'kpi',
      'roi_case',
      'okr_set',
      'deviation_case',
      'kpi_scorecard',
      'okr_program',
      'okr_cycle',
      'okr_alignment',
    ]);
  });

  it('T03: MaturityLevel has exactly 3 levels per Decision W7-2', () => {
    expect(MaturityLevelValues).toEqual([
      'backed_by_real_service',
      'partial_stitched',
      'placeholder_non_canonical',
    ]);
  });

  it('T04: LatencyBand has 3 bands per Decision W7-3', () => {
    expect(LatencyBandValues).toEqual(['near_realtime', 'operational', 'degraded']);
  });

  it('T05: CalendarPhaseName has A/B split per Decision W7-4', () => {
    expect(CalendarPhaseNameValues).toEqual(['phase_a_internal', 'phase_b_external_sync']);
  });

  it('T06: HomeBlockName has all 8 canonical blocks', () => {
    expect(HomeBlockNameValues.length).toBe(8);
    expect(HomeBlockNameValues).toContain('aiPulseCore');
    expect(HomeBlockNameValues).toContain('momentum');
    expect(HomeBlockNameValues).toContain('sparkField');
    expect(HomeBlockNameValues).toContain('decisionTemperature');
    expect(HomeBlockNameValues).toContain('industryLens');
    expect(HomeBlockNameValues).toContain('executionCurrent');
    expect(HomeBlockNameValues).toContain('teamSignal');
    expect(HomeBlockNameValues).toContain('commandDock');
  });

  it('T07: classifyLatencyBand returns near_realtime for ≤5000ms', () => {
    expect(classifyLatencyBand(0)).toBe('near_realtime');
    expect(classifyLatencyBand(1200)).toBe('near_realtime');
    expect(classifyLatencyBand(5000)).toBe('near_realtime');
  });

  it('T08: classifyLatencyBand returns operational for 5001–60000ms', () => {
    expect(classifyLatencyBand(5001)).toBe('operational');
    expect(classifyLatencyBand(30000)).toBe('operational');
    expect(classifyLatencyBand(60000)).toBe('operational');
  });

  it('T09: classifyLatencyBand returns degraded for >60000ms', () => {
    expect(classifyLatencyBand(60001)).toBe('degraded');
    expect(classifyLatencyBand(300000)).toBe('degraded');
  });

  it('T10: SetCanonicalObjectStateParamsSchema rejects invalid objectType', () => {
    expect(() =>
      SetCanonicalObjectStateParamsSchema.parse({
        ...makeSetStateParams(),
        objectType: 'invalid_type',
      })
    ).toThrow(ZodError);
  });

  it('T11: ClassifyHomeBlockParamsSchema rejects unknown block name', () => {
    expect(() =>
      ClassifyHomeBlockParamsSchema.parse({
        ...makeClassifyBlockParams(),
        blockName: 'nonexistent_block',
      })
    ).toThrow(ZodError);
  });

  it('T12: RecordInboxMaterializationParamsSchema rejects negative latency', () => {
    expect(() =>
      RecordInboxMaterializationParamsSchema.parse({
        ...makeMaterializationParams(),
        latencyMs: -100,
      })
    ).toThrow(ZodError);
  });

  it('T13: SetCalendarPhaseParamsSchema rejects invalid phase name', () => {
    expect(() =>
      SetCalendarPhaseParamsSchema.parse({
        ...makeCalendarPhaseParams(),
        phaseName: 'phase_c_unknown',
      })
    ).toThrow(ZodError);
  });

  it('T14: SurfaceProjectionSchema validates correctly', () => {
    const result = SurfaceProjectionSchema.parse({
      surface: 'home',
      displayState: 'active',
      isStale: false,
      lastRefreshedAt: '2026-03-23T10:00:00.000Z',
    });
    expect(result.surface).toBe('home');
    expect(result.isStale).toBe(false);
  });
});

// ------------------------------------------
// B. CROSS-SURFACE STATE PROPAGATION (Decision W7-1)
// ------------------------------------------

describe('MyWork Roof — Cross-Surface State (Decision W7-1)', () => {
  it('T15: setCanonicalObjectState creates state with correct fields', async () => {
    const result = await setCanonicalObjectState(makeSetStateParams());

    expect(result.objectId).toBe(OBJECT_ID);
    expect(result.objectType).toBe('task');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.canonicalState).toBe('active');
    expect(result.lastUpdatedAt).toBeDefined();
    expect(result.surfaceProjections).toEqual({});
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('T16: setCanonicalObjectState stores surface projections', async () => {
    const projections: Record<string, SurfaceProjection> = {
      home: {
        surface: 'home',
        displayState: 'active',
        isStale: false,
        lastRefreshedAt: '2026-03-23T10:00:00.000Z',
      },
      inbox: {
        surface: 'inbox',
        displayState: 'pending_triage',
        isStale: false,
        lastRefreshedAt: '2026-03-23T10:00:00.000Z',
      },
    };

    const result = await setCanonicalObjectState(
      makeSetStateParams({ surfaceProjections: projections })
    );

    expect(result.surfaceProjections).toEqual(projections);
    expect(Object.keys(result.surfaceProjections)).toHaveLength(2);
  });

  it('T17: setCanonicalObjectState upserts — calls INSERT ON CONFLICT', async () => {
    await setCanonicalObjectState(makeSetStateParams());
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO UPDATE SET');
  });

  it('T18: setCanonicalObjectState rejects missing canonicalState', async () => {
    await expect(
      setCanonicalObjectState(makeSetStateParams({ canonicalState: '' }))
    ).rejects.toThrow(ZodError);
  });

  it('T19: setCanonicalObjectState accepts non-UUID tenant organizationId', async () => {
    const result = await setCanonicalObjectState(
      makeSetStateParams({ organizationId: 'tenant-dbr77' })
    );

    expect(result.organizationId).toBe('tenant-dbr77');
  });

  it('T20: getCanonicalObjectState returns mapped object when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeStateRow());

    const result = await getCanonicalObjectState(OBJECT_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.objectId).toBe(OBJECT_ID);
    expect(result!.objectType).toBe('task');
    expect(result!.canonicalState).toBe('active');
  });

  it('T21: getCanonicalObjectState returns null when not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getCanonicalObjectState('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('T22: getCanonicalObjectState parses surface_projections JSON', async () => {
    const projections = {
      home: {
        surface: 'home',
        displayState: 'active',
        isStale: false,
        lastRefreshedAt: '2026-03-23T10:00:00.000Z',
      },
    };
    mockDbGet.mockResolvedValueOnce(
      makeFakeStateRow({ surface_projections: JSON.stringify(projections) })
    );

    const result = await getCanonicalObjectState(OBJECT_ID, ORG_ID);
    expect(result!.surfaceProjections).toEqual(projections);
  });

  it('T23: getSurfaceProjection returns projection for existing surface', async () => {
    const projections = {
      calendar: {
        surface: 'calendar',
        displayState: 'overdue',
        isStale: true,
        lastRefreshedAt: '2026-03-23T09:00:00.000Z',
      },
    };
    mockDbGet.mockResolvedValueOnce(
      makeFakeStateRow({ surface_projections: JSON.stringify(projections) })
    );

    const result = await getSurfaceProjection(OBJECT_ID, 'calendar', ORG_ID);
    expect(result).not.toBeNull();
    expect(result!.surface).toBe('calendar');
    expect(result!.displayState).toBe('overdue');
    expect(result!.isStale).toBe(true);
  });

  it('T24: getSurfaceProjection returns null for missing surface', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeStateRow());
    const result = await getSurfaceProjection(OBJECT_ID, 'radar', ORG_ID);
    expect(result).toBeNull();
  });

  it('T25: getSurfaceProjection returns null for nonexistent object', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getSurfaceProjection('nonexistent', 'home', ORG_ID);
    expect(result).toBeNull();
  });

  it('T26: updateSurfaceProjection merges new projection into existing map', async () => {
    const existing = {
      home: {
        surface: 'home',
        displayState: 'active',
        isStale: false,
        lastRefreshedAt: '2026-03-23T09:00:00.000Z',
      },
    };
    mockDbGet.mockResolvedValueOnce(
      makeFakeStateRow({ surface_projections: JSON.stringify(existing) })
    );

    const result = await updateSurfaceProjection({
      objectId: OBJECT_ID,
      organizationId: ORG_ID,
      surface: 'inbox',
      displayState: 'pending_triage',
      isStale: false,
    });

    expect(result).not.toBeNull();
    expect(result!.surfaceProjections).toHaveProperty('home');
    expect(result!.surfaceProjections).toHaveProperty('inbox');
    expect(result!.surfaceProjections.inbox.displayState).toBe('pending_triage');
  });

  it('T27: updateSurfaceProjection returns null for nonexistent object', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await updateSurfaceProjection({
      objectId: '00000000-0000-4000-8000-ffffffffffff',
      organizationId: ORG_ID,
      surface: 'home',
      displayState: 'active',
      isStale: false,
    });
    expect(result).toBeNull();
  });

  it('T28: updateSurfaceProjection overwrites existing surface projection', async () => {
    const existing = {
      home: {
        surface: 'home',
        displayState: 'active',
        isStale: false,
        lastRefreshedAt: '2026-03-23T09:00:00.000Z',
      },
    };
    mockDbGet.mockResolvedValueOnce(
      makeFakeStateRow({ surface_projections: JSON.stringify(existing) })
    );

    const result = await updateSurfaceProjection({
      objectId: OBJECT_ID,
      organizationId: ORG_ID,
      surface: 'home',
      displayState: 'completed',
      isStale: true,
    });

    expect(result!.surfaceProjections.home.displayState).toBe('completed');
    expect(result!.surfaceProjections.home.isStale).toBe(true);
  });

  it('T29: one truth, multiple projections — different display states, same canonical', async () => {
    const projections: Record<string, SurfaceProjection> = {
      home: {
        surface: 'home',
        displayState: 'signal_warning',
        isStale: false,
        lastRefreshedAt: '2026-03-23T10:00:00.000Z',
      },
      inbox: {
        surface: 'inbox',
        displayState: 'pending_triage',
        isStale: false,
        lastRefreshedAt: '2026-03-23T10:00:00.000Z',
      },
      calendar: {
        surface: 'calendar',
        displayState: 'overdue_marker',
        isStale: false,
        lastRefreshedAt: '2026-03-23T10:00:00.000Z',
      },
    };

    const result = await setCanonicalObjectState(
      makeSetStateParams({
        canonicalState: 'blocked',
        surfaceProjections: projections,
      })
    );

    expect(result.canonicalState).toBe('blocked');
    expect(result.surfaceProjections.home.displayState).toBe('signal_warning');
    expect(result.surfaceProjections.inbox.displayState).toBe('pending_triage');
    expect(result.surfaceProjections.calendar.displayState).toBe('overdue_marker');
  });
});

// ------------------------------------------
// C. HOME BLOCK MATURITY (Decision W7-2)
// ------------------------------------------

describe('MyWork Roof — Home Block Maturity (Decision W7-2)', () => {
  it('T30: classifyHomeBlock creates maturity record', async () => {
    const result = await classifyHomeBlock(makeClassifyBlockParams());

    expect(result.blockId).toBeDefined();
    expect(result.blockName).toBe('aiPulseCore');
    expect(result.maturityLevel).toBe('backed_by_real_service');
    expect(result.serviceRef).toBe('radarService');
    expect(result.lastAuditedAt).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('T31: classifyHomeBlock upserts by (blockName, organizationId)', async () => {
    await classifyHomeBlock(makeClassifyBlockParams());
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT');
  });

  it('T32: classifyHomeBlock with backed_by_real_service requires serviceRef', async () => {
    const result = await classifyHomeBlock(
      makeClassifyBlockParams({
        maturityLevel: 'backed_by_real_service',
        serviceRef: 'radarService',
      })
    );
    expect(result.maturityLevel).toBe('backed_by_real_service');
    expect(result.serviceRef).toBe('radarService');
  });

  it('T33: classifyHomeBlock with placeholder_non_canonical has null serviceRef', async () => {
    const result = await classifyHomeBlock(
      makeClassifyBlockParams({
        blockName: 'sparkField',
        maturityLevel: 'placeholder_non_canonical',
        serviceRef: null,
      })
    );
    expect(result.maturityLevel).toBe('placeholder_non_canonical');
    expect(result.serviceRef).toBeNull();
  });

  it('T34: classifyHomeBlock with partial_stitched level', async () => {
    const result = await classifyHomeBlock(
      makeClassifyBlockParams({
        blockName: 'executionCurrent',
        maturityLevel: 'partial_stitched',
        serviceRef: 'executionVisibilityService',
      })
    );
    expect(result.maturityLevel).toBe('partial_stitched');
  });

  it('T35: getHomeBlockMaturity returns all blocks for org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeBlockRow({ block_name: 'aiPulseCore', maturity_level: 'backed_by_real_service' }),
      makeFakeBlockRow({ block_name: 'momentum', maturity_level: 'partial_stitched' }),
      makeFakeBlockRow({
        block_name: 'sparkField',
        maturity_level: 'placeholder_non_canonical',
        service_ref: null,
      }),
    ]);

    const result = await getHomeBlockMaturity(ORG_ID);
    expect(result).toHaveLength(3);
    expect(result[0].blockName).toBe('aiPulseCore');
    expect(result[1].maturityLevel).toBe('partial_stitched');
    expect(result[2].serviceRef).toBeNull();
  });

  it('T36: getHomeBlockMaturity returns empty array for org with no blocks', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const result = await getHomeBlockMaturity(ORG_ID);
    expect(result).toEqual([]);
  });

  it('T37: all 8 blocks can be classified', async () => {
    for (const blockName of HomeBlockNameValues) {
      mockDbRun.mockResolvedValueOnce({ success: true });
      const result = await classifyHomeBlock(
        makeClassifyBlockParams({ blockName, maturityLevel: 'partial_stitched' })
      );
      expect(result.blockName).toBe(blockName);
    }
    expect(mockDbRun).toHaveBeenCalledTimes(8);
  });

  it('T38: classifyHomeBlock rejects invalid maturity level', async () => {
    await expect(
      classifyHomeBlock({
        ...makeClassifyBlockParams(),
        maturityLevel: 'unknown_level' as any,
      })
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// D. INBOX MATERIALIZATION (Decision W7-3)
// ------------------------------------------

describe('MyWork Roof — Inbox Materialization (Decision W7-3)', () => {
  it('T39: recordInboxMaterialization creates record with auto-classified band', async () => {
    const result = await recordInboxMaterialization(makeMaterializationParams({ latencyMs: 1200 }));

    expect(result.materializationId).toBeDefined();
    expect(result.latencyMs).toBe(1200);
    expect(result.latencyBand).toBe('near_realtime');
    expect(result.materializedAt).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('T40: near_realtime band for latency ≤ 5000ms', async () => {
    const result = await recordInboxMaterialization(makeMaterializationParams({ latencyMs: 4999 }));
    expect(result.latencyBand).toBe('near_realtime');
  });

  it('T41: operational band for latency 5001–60000ms', async () => {
    const result = await recordInboxMaterialization(
      makeMaterializationParams({ latencyMs: 30000 })
    );
    expect(result.latencyBand).toBe('operational');
  });

  it('T42: degraded band for latency > 60000ms', async () => {
    const result = await recordInboxMaterialization(
      makeMaterializationParams({ latencyMs: 120000 })
    );
    expect(result.latencyBand).toBe('degraded');
  });

  it('T43: boundary — exactly 5000ms is near_realtime', async () => {
    const result = await recordInboxMaterialization(makeMaterializationParams({ latencyMs: 5000 }));
    expect(result.latencyBand).toBe('near_realtime');
  });

  it('T44: boundary — exactly 60000ms is operational', async () => {
    const result = await recordInboxMaterialization(
      makeMaterializationParams({ latencyMs: 60000 })
    );
    expect(result.latencyBand).toBe('operational');
  });

  it('T45: boundary — 60001ms is degraded', async () => {
    const result = await recordInboxMaterialization(
      makeMaterializationParams({ latencyMs: 60001 })
    );
    expect(result.latencyBand).toBe('degraded');
  });

  it('T46: zero latency is near_realtime', async () => {
    const result = await recordInboxMaterialization(makeMaterializationParams({ latencyMs: 0 }));
    expect(result.latencyBand).toBe('near_realtime');
  });

  it('T47: getInboxMaterializationStats returns avg and distribution', async () => {
    mockDbGet.mockResolvedValueOnce({ avg_latency: 2500 });
    mockDbAll.mockResolvedValueOnce([
      { latency_band: 'near_realtime', cnt: 8 },
      { latency_band: 'operational', cnt: 3 },
      { latency_band: 'degraded', cnt: 1 },
    ]);

    const stats = await getInboxMaterializationStats(USER_ID, ORG_ID);

    expect(stats.avgLatencyMs).toBe(2500);
    expect(stats.latencyBandDistribution.near_realtime).toBe(8);
    expect(stats.latencyBandDistribution.operational).toBe(3);
    expect(stats.latencyBandDistribution.degraded).toBe(1);
  });

  it('T48: getInboxMaterializationStats returns zeros when no data', async () => {
    mockDbGet.mockResolvedValueOnce({ avg_latency: null });
    mockDbAll.mockResolvedValueOnce([]);

    const stats = await getInboxMaterializationStats(USER_ID, ORG_ID);

    expect(stats.avgLatencyMs).toBe(0);
    expect(stats.latencyBandDistribution.near_realtime).toBe(0);
    expect(stats.latencyBandDistribution.operational).toBe(0);
    expect(stats.latencyBandDistribution.degraded).toBe(0);
  });

  it('T48b: getInboxMaterializationStats coerces numeric strings from Postgres', async () => {
    mockDbGet.mockResolvedValueOnce({ avg_latency: '1200.0000000000000000' });
    mockDbAll.mockResolvedValueOnce([{ latency_band: 'near_realtime', cnt: '2' }]);

    const stats = await getInboxMaterializationStats(USER_ID, ORG_ID);

    expect(stats.avgLatencyMs).toBe(1200);
    expect(stats.latencyBandDistribution.near_realtime).toBe(2);
  });

  it('T49: recordInboxMaterialization rejects negative latency', async () => {
    await expect(
      recordInboxMaterialization(makeMaterializationParams({ latencyMs: -1 }))
    ).rejects.toThrow(ZodError);
  });

  it('T50: recordInboxMaterialization rejects empty eventSourceRef', async () => {
    await expect(
      recordInboxMaterialization(makeMaterializationParams({ eventSourceRef: '' }))
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// E. CALENDAR PHASING (Decision W7-4)
// ------------------------------------------

describe('MyWork Roof — Calendar Phasing (Decision W7-4)', () => {
  it('T51: setCalendarPhase creates phase_a_internal as active', async () => {
    const result = await setCalendarPhase(makeCalendarPhaseParams());

    expect(result.phaseId).toBeDefined();
    expect(result.phaseName).toBe('phase_a_internal');
    expect(result.status).toBe('active');
    expect(result.blockedBy).toBeNull();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('T52: setCalendarPhase creates phase_b_external_sync as blocked', async () => {
    const result = await setCalendarPhase(
      makeCalendarPhaseParams({
        phaseName: 'phase_b_external_sync',
        status: 'blocked',
        blockedBy: 'wave_5_connector_platform',
      })
    );

    expect(result.phaseName).toBe('phase_b_external_sync');
    expect(result.status).toBe('blocked');
    expect(result.blockedBy).toBe('wave_5_connector_platform');
  });

  it('T53: setCalendarPhase upserts by (phaseName, organizationId)', async () => {
    await setCalendarPhase(makeCalendarPhaseParams());
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT');
  });

  it('T54: phase A can be completed independently of phase B', async () => {
    const phaseA = await setCalendarPhase(
      makeCalendarPhaseParams({ phaseName: 'phase_a_internal', status: 'completed' })
    );
    expect(phaseA.status).toBe('completed');

    const phaseB = await setCalendarPhase(
      makeCalendarPhaseParams({
        phaseName: 'phase_b_external_sync',
        status: 'blocked',
        blockedBy: 'wave_5_connector_platform',
      })
    );
    expect(phaseB.status).toBe('blocked');
  });

  it('T55: getCalendarPhases returns all phases for org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakePhaseRow({ phase_name: 'phase_a_internal', status: 'completed' }),
      makeFakePhaseRow({
        phase_name: 'phase_b_external_sync',
        status: 'blocked',
        blocked_by: 'wave_5_connector_platform',
      }),
    ]);

    const result = await getCalendarPhases(ORG_ID);
    expect(result).toHaveLength(2);
    expect(result[0].phaseName).toBe('phase_a_internal');
    expect(result[1].blockedBy).toBe('wave_5_connector_platform');
  });

  it('T56: getCalendarPhases returns empty array for org with no phases', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const result = await getCalendarPhases(ORG_ID);
    expect(result).toEqual([]);
  });

  it('T57: setCalendarPhase rejects invalid status', async () => {
    await expect(
      setCalendarPhase({
        ...makeCalendarPhaseParams(),
        status: 'invalid_status' as any,
      })
    ).rejects.toThrow(ZodError);
  });

  it('T58: all 3 statuses are valid', async () => {
    for (const status of CalendarPhaseStatusValues) {
      mockDbRun.mockResolvedValueOnce({ success: true });
      const result = await setCalendarPhase(makeCalendarPhaseParams({ status }));
      expect(result.status).toBe(status);
    }
  });
});

// ------------------------------------------
// F. ORG ISOLATION
// ------------------------------------------

describe('MyWork Roof — Org Isolation', () => {
  it('T59: getCanonicalObjectState passes organizationId to query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getCanonicalObjectState(OBJECT_ID, ORG_ID);

    const args = mockDbGet.mock.calls[0][1] as string[];
    expect(args).toContain(ORG_ID);
  });

  it('T60: getHomeBlockMaturity passes organizationId to query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getHomeBlockMaturity(ORG_ID);

    const args = mockDbAll.mock.calls[0][1] as string[];
    expect(args).toContain(ORG_ID);
  });

  it('T61: getInboxMaterializationStats passes both userId and orgId', async () => {
    mockDbGet.mockResolvedValueOnce({ avg_latency: null });
    mockDbAll.mockResolvedValueOnce([]);
    await getInboxMaterializationStats(USER_ID, ORG_ID);

    const avgArgs = mockDbGet.mock.calls[0][1] as string[];
    expect(avgArgs).toContain(USER_ID);
    expect(avgArgs).toContain(ORG_ID);
  });

  it('T62: getCalendarPhases passes organizationId to query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getCalendarPhases(OTHER_ORG_ID);

    const args = mockDbAll.mock.calls[0][1] as string[];
    expect(args).toContain(OTHER_ORG_ID);
  });

  it('T63: setCanonicalObjectState stores org-scoped data', async () => {
    const result = await setCanonicalObjectState(
      makeSetStateParams({ organizationId: OTHER_ORG_ID })
    );
    expect(result.organizationId).toBe(OTHER_ORG_ID);

    const dbArgs = mockDbRun.mock.calls[0][1] as string[];
    expect(dbArgs).toContain(OTHER_ORG_ID);
  });

  it('T64: classifyHomeBlock stores org-scoped data', async () => {
    const result = await classifyHomeBlock(
      makeClassifyBlockParams({ organizationId: OTHER_ORG_ID })
    );
    expect(result.organizationId).toBe(OTHER_ORG_ID);
  });

  it('T65: recordInboxMaterialization stores org-scoped data', async () => {
    const result = await recordInboxMaterialization(
      makeMaterializationParams({ organizationId: OTHER_ORG_ID })
    );
    expect(result.organizationId).toBe(OTHER_ORG_ID);
  });
});
