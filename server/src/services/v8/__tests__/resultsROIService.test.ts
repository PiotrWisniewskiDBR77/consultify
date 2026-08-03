import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateExecutiveReviewPackParams,
  CreateKPIParams,
  DeviationHighlight,
  InitiateReconciliationParams,
  KPISummary,
  RecordDeviationParams,
  RecordROIRealizationParams,
  ROISnapshot,
} from '../../../types/resultsROIContinuity.js';
import {
  CreateExecutiveReviewPackParamsSchema,
  CreateKPIParamsSchema,
  DeviationHighlightSchema,
  DeviationRecordSchema,
  DeviationSeverityValues,
  DeviationTypeValues,
  ExecutiveReviewPackSchema,
  InitiateReconciliationParamsSchema,
  KPI_STATUS_TRANSITIONS,
  KPIDefinitionSchema,
  KPIFinanceReconciliationSchema,
  KPIModeValues,
  KPIStatusValues,
  KPISummarySchema,
  MeasurementCadenceValues,
  MetricTypeValues,
  ReconciliationInitiatorValues,
  ReconciliationStatusValues,
  RecordDeviationParamsSchema,
  RecordROIRealizationParamsSchema,
  ReviewPackStatusValues,
  ROIRealizationEntrySchema,
  ROISnapshotSchema,
} from '../../../types/resultsROIContinuity.js';

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

vi.mock('../../../services/notificationService.js', () => ({
  send: vi.fn().mockResolvedValue(undefined),
}));

// RES-02: createKPI now mints its canonical initiative_kpis definition
// through kpiDefinitionService.createDefinition instead of only writing
// v8_kpi_definitions. That call uses a real pinned pg connection (not
// mockable through the DbPromise mock above), so it must be mocked at the
// module boundary — otherwise it would try to reach a real Postgres pool
// and crash with "process.exit" from DatabaseConfig in this unit-test
// environment.
const mockCreateKpiDefinition = vi
  .fn()
  .mockResolvedValue({ id: '00000000-0000-4000-8000-eeeeeeeeeeee' });
vi.mock('../../results/kpiDefinitionService.js', () => ({
  createDefinition: (...args: unknown[]) => mockCreateKpiDefinition(...args),
}));

import {
  createExecutiveReviewPack,
  createKPI,
  getDeviationsByKPI,
  getExecutiveReviewPack,
  getKPI,
  getROIByInitiative,
  initiateReconciliation,
  recordDeviation,
  recordROIRealization,
  resolveReconciliation,
  updateKPIStatus,
} from '../resultsROIService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const KPI_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const INITIATIVE_ID = '00000000-0000-4000-8000-bbbbbbbbbbbb';
const PACK_ID = '00000000-0000-4000-8000-cccccccccccc';
const RECON_ID = '00000000-0000-4000-8000-dddddddddddd';
const DEVIATION_ID = '00000000-0000-4000-8000-eeeeeeeeeeee';

function makeCreateKPIParams(overrides?: Partial<CreateKPIParams>): CreateKPIParams {
  return {
    organizationId: ORG_ID,
    name: 'Revenue Growth Rate',
    mode: 'initiative_linked',
    initiativeId: INITIATIVE_ID,
    metricType: 'percentage',
    baselineValue: 5.0,
    targetValue: 15.0,
    currentValue: null,
    measurementCadence: 'monthly',
    ...overrides,
  };
}

function makeStandaloneKPIParams(overrides?: Partial<CreateKPIParams>): CreateKPIParams {
  return {
    organizationId: ORG_ID,
    name: 'Customer Satisfaction Score',
    mode: 'standalone',
    initiativeId: null,
    metricType: 'score',
    baselineValue: 72,
    targetValue: 85,
    currentValue: 72,
    measurementCadence: 'quarterly',
    ...overrides,
  };
}

function makeDeviationParams(overrides?: Partial<RecordDeviationParams>): RecordDeviationParams {
  return {
    organizationId: ORG_ID,
    kpiId: KPI_ID,
    deviationType: 'underperformance',
    severity: 'high',
    actionRequired: 'Investigate root cause and propose corrective plan within 5 business days',
    escalatedTo: null,
    ...overrides,
  };
}

function makeROIParams(
  overrides?: Partial<RecordROIRealizationParams>
): RecordROIRealizationParams {
  return {
    organizationId: ORG_ID,
    kpiId: KPI_ID,
    initiativeId: INITIATIVE_ID,
    realizedValue: 150000,
    period: '2026-Q1',
    provenanceRef: null,
    verifiedBy: null,
    ...overrides,
  };
}

function makeKPISummary(overrides?: Partial<KPISummary>): KPISummary {
  return {
    kpiId: KPI_ID,
    name: 'Revenue Growth Rate',
    status: 'active',
    currentValue: 12.5,
    targetValue: 15.0,
    ...overrides,
  };
}

function makeDeviationHighlight(overrides?: Partial<DeviationHighlight>): DeviationHighlight {
  return {
    deviationId: DEVIATION_ID,
    kpiId: KPI_ID,
    deviationType: 'underperformance',
    severity: 'high',
    ...overrides,
  };
}

function makeROISnapshot(overrides?: Partial<ROISnapshot>): ROISnapshot {
  return {
    totalRealized: 450000,
    entriesCount: 3,
    period: '2026-Q1',
    ...overrides,
  };
}

function makeReviewPackParams(
  overrides?: Partial<CreateExecutiveReviewPackParams>
): CreateExecutiveReviewPackParams {
  return {
    organizationId: ORG_ID,
    reviewPeriod: '2026-Q1',
    kpiSummaries: [makeKPISummary()],
    deviationHighlights: [makeDeviationHighlight()],
    roiSnapshot: makeROISnapshot(),
    ...overrides,
  };
}

function makeReconciliationParams(
  overrides?: Partial<InitiateReconciliationParams>
): InitiateReconciliationParams {
  return {
    organizationId: ORG_ID,
    kpiId: KPI_ID,
    financeRef: 'FIN-2026-Q1-001',
    initiatedBy: 'results',
    ...overrides,
  };
}

function makeFakeKPIRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    kpi_id: KPI_ID,
    organization_id: ORG_ID,
    name: 'Revenue Growth Rate',
    mode: 'initiative_linked',
    initiative_id: INITIATIVE_ID,
    metric_type: 'percentage',
    baseline_value: 5.0,
    target_value: 15.0,
    current_value: null,
    measurement_cadence: 'monthly',
    status: 'design',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeDeviationRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    deviation_id: DEVIATION_ID,
    organization_id: ORG_ID,
    kpi_id: KPI_ID,
    deviation_type: 'underperformance',
    severity: 'high',
    action_required: 'Investigate root cause',
    escalated_to: null,
    created_at: '2026-03-23T10:00:00.000Z',
    resolved_at: null,
    resolved_by: null,
    resolution: null,
    observed_actual: null,
    observed_target: null,
    ...overrides,
  };
}

function makeFakeROIRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    entry_id: '00000000-0000-4000-8000-ffffffffffff',
    organization_id: ORG_ID,
    kpi_id: KPI_ID,
    initiative_id: INITIATIVE_ID,
    realized_value: 150000,
    period: '2026-Q1',
    provenance_ref: null,
    verified_by: null,
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeReviewPackRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    pack_id: PACK_ID,
    organization_id: ORG_ID,
    review_period: '2026-Q1',
    kpi_summaries: JSON.stringify([makeKPISummary()]),
    deviation_highlights: JSON.stringify([makeDeviationHighlight()]),
    roi_snapshot: JSON.stringify(makeROISnapshot()),
    status: 'draft',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeReconciliationRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    reconciliation_id: RECON_ID,
    organization_id: ORG_ID,
    kpi_id: KPI_ID,
    finance_ref: 'FIN-2026-Q1-001',
    reconciliation_status: 'pending',
    initiated_by: 'results',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------
// Dual-mode KPI creation (Decision W6-6)
// ------------------------------------------

describe('createKPI', () => {
  it('creates an initiative-linked KPI with all required fields', async () => {
    const result = await createKPI(makeCreateKPIParams());

    expect(result.kpiId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.name).toBe('Revenue Growth Rate');
    expect(result.mode).toBe('initiative_linked');
    expect(result.initiativeId).toBe(INITIATIVE_ID);
    expect(result.metricType).toBe('percentage');
    expect(result.baselineValue).toBe(5.0);
    expect(result.targetValue).toBe(15.0);
    expect(result.status).toBe('design');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_kpi_definitions');
  });

  it('creates a standalone KPI without initiative reference (Decision W6-6)', async () => {
    const result = await createKPI(makeStandaloneKPIParams());

    expect(result.mode).toBe('standalone');
    expect(result.initiativeId).toBeNull();
    expect(result.name).toBe('Customer Satisfaction Score');
    expect(result.metricType).toBe('score');
    expect(result.status).toBe('design');
  });

  it('always starts in design status', async () => {
    const result = await createKPI(makeCreateKPIParams());
    expect(result.status).toBe('design');
  });

  it('supports all metric types', async () => {
    for (const metricType of MetricTypeValues) {
      vi.clearAllMocks();
      const result = await createKPI(makeCreateKPIParams({ metricType }));
      expect(result.metricType).toBe(metricType);
    }
  });

  it('supports all measurement cadences', async () => {
    for (const measurementCadence of MeasurementCadenceValues) {
      vi.clearAllMocks();
      const result = await createKPI(makeCreateKPIParams({ measurementCadence }));
      expect(result.measurementCadence).toBe(measurementCadence);
    }
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(createKPI(makeCreateKPIParams({ organizationId: 'not-uuid' }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects empty name via Zod', async () => {
    await expect(createKPI(makeCreateKPIParams({ name: '' }))).rejects.toThrow(ZodError);
  });

  it('rejects invalid mode via Zod', async () => {
    await expect(createKPI(makeCreateKPIParams({ mode: 'invalid' as any }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid metricType via Zod', async () => {
    await expect(createKPI(makeCreateKPIParams({ metricType: 'invalid' as any }))).rejects.toThrow(
      ZodError
    );
  });
});

// ------------------------------------------
// KPI retrieval
// ------------------------------------------

describe('getKPI', () => {
  it('returns a KPI with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow());

    const result = await getKPI(KPI_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.kpiId).toBe(KPI_ID);
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.mode).toBe('initiative_linked');

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when KPI not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getKPI('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getKPI(KPI_ID, OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// KPI status lifecycle
// ------------------------------------------

describe('updateKPIStatus', () => {
  it('transitions design → baseline', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'design' }));

    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'baseline');

    expect(result.status).toBe('baseline');
    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_kpi_definitions');
  });

  it('transitions baseline → active', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'baseline' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'active');
    expect(result.status).toBe('active');
  });

  it('transitions active → measurement', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'active' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'measurement');
    expect(result.status).toBe('measurement');
  });

  it('transitions measurement → review', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'measurement' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'review');
    expect(result.status).toBe('review');
  });

  it('transitions review → deviation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'review' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'deviation');
    expect(result.status).toBe('deviation');
  });

  it('transitions review → improvement', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'review' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'improvement');
    expect(result.status).toBe('improvement');
  });

  it('transitions review → benefits_realization', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'review' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'benefits_realization');
    expect(result.status).toBe('benefits_realization');
  });

  it('transitions deviation → improvement', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'deviation' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'improvement');
    expect(result.status).toBe('improvement');
  });

  it('transitions deviation → review', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'deviation' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'review');
    expect(result.status).toBe('review');
  });

  it('transitions improvement → measurement', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'improvement' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'measurement');
    expect(result.status).toBe('measurement');
  });

  it('transitions improvement → benefits_realization', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'improvement' }));
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'benefits_realization');
    expect(result.status).toBe('benefits_realization');
  });

  it('rejects invalid transition design → active', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'design' }));
    await expect(updateKPIStatus(KPI_ID, ORG_ID, 'active')).rejects.toThrow(
      'Invalid status transition'
    );
  });

  it('rejects transition from terminal state benefits_realization', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeKPIRow({ status: 'benefits_realization' }));
    await expect(updateKPIStatus(KPI_ID, ORG_ID, 'review')).rejects.toThrow(
      'none (terminal state)'
    );
  });

  it('throws when KPI not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await expect(updateKPIStatus('nonexistent', ORG_ID, 'baseline')).rejects.toThrow('not found');
  });

  it('throws for invalid status value', async () => {
    await expect(updateKPIStatus(KPI_ID, ORG_ID, 'invalid_status' as any)).rejects.toThrow(
      'Invalid KPI status'
    );
  });
});

// ------------------------------------------
// Deviation governance
// ------------------------------------------

describe('recordDeviation', () => {
  it('records an underperformance deviation', async () => {
    const result = await recordDeviation(makeDeviationParams());

    expect(result.deviationId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.kpiId).toBe(KPI_ID);
    expect(result.deviationType).toBe('underperformance');
    expect(result.severity).toBe('high');
    expect(result.escalatedTo).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_deviation_records');
    expect(sql).toContain('observed_actual');
    const args = mockDbRun.mock.calls[0][1] as unknown[];
    expect(args).toHaveLength(13);
  });

  it('records a deviation with escalation', async () => {
    const result = await recordDeviation(
      makeDeviationParams({ escalatedTo: 'VP Operations', severity: 'critical' })
    );
    expect(result.escalatedTo).toBe('VP Operations');
    expect(result.severity).toBe('critical');
  });

  it('supports all deviation types', async () => {
    for (const deviationType of DeviationTypeValues) {
      vi.clearAllMocks();
      const result = await recordDeviation(makeDeviationParams({ deviationType }));
      expect(result.deviationType).toBe(deviationType);
    }
  });

  it('supports all severity levels', async () => {
    for (const severity of DeviationSeverityValues) {
      vi.clearAllMocks();
      const result = await recordDeviation(makeDeviationParams({ severity }));
      expect(result.severity).toBe(severity);
    }
  });

  it('rejects invalid deviationType via Zod', async () => {
    await expect(
      recordDeviation(makeDeviationParams({ deviationType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty actionRequired via Zod', async () => {
    await expect(recordDeviation(makeDeviationParams({ actionRequired: '' }))).rejects.toThrow(
      ZodError
    );
  });
});

describe('getDeviationsByKPI', () => {
  it('returns deviations scoped to organization', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeDeviationRow()]);

    const results = await getDeviationsByKPI(KPI_ID, ORG_ID);

    expect(results).toHaveLength(1);
    expect(results[0].deviationId).toBe(DEVIATION_ID);
    expect(results[0].kpiId).toBe(KPI_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns empty array when no deviations exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getDeviationsByKPI(KPI_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation — different org returns empty', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getDeviationsByKPI(KPI_ID, OTHER_ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// ROI realization tracking
// ------------------------------------------

describe('recordROIRealization', () => {
  it('records a ROI realization entry with initiative link', async () => {
    const result = await recordROIRealization(makeROIParams());

    expect(result.entryId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.kpiId).toBe(KPI_ID);
    expect(result.initiativeId).toBe(INITIATIVE_ID);
    expect(result.realizedValue).toBe(150000);
    expect(result.period).toBe('2026-Q1');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_roi_realization_entries');
  });

  it('records a standalone ROI entry without initiative (Decision W6-6)', async () => {
    const result = await recordROIRealization(makeROIParams({ initiativeId: null }));
    expect(result.initiativeId).toBeNull();
  });

  it('records with provenance and verification', async () => {
    const result = await recordROIRealization(
      makeROIParams({
        provenanceRef: 'PROV-2026-001',
        verifiedBy: 'CFO Office',
      })
    );
    expect(result.provenanceRef).toBe('PROV-2026-001');
    expect(result.verifiedBy).toBe('CFO Office');
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(recordROIRealization(makeROIParams({ organizationId: 'bad' }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects empty period via Zod', async () => {
    await expect(recordROIRealization(makeROIParams({ period: '' }))).rejects.toThrow(ZodError);
  });
});

describe('getROIByInitiative', () => {
  it('returns ROI entries scoped to initiative and org', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeROIRow()]);

    const results = await getROIByInitiative(INITIATIVE_ID, ORG_ID);

    expect(results).toHaveLength(1);
    expect(results[0].initiativeId).toBe(INITIATIVE_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('initiative_id');
    expect(query).toContain('organization_id');
  });

  it('returns empty array when no entries exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getROIByInitiative(INITIATIVE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation — different org returns empty', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getROIByInitiative(INITIATIVE_ID, OTHER_ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// Executive review pack (Decision W6-7)
// ------------------------------------------

describe('createExecutiveReviewPack', () => {
  it('creates a review pack with all components (Decision W6-7)', async () => {
    const result = await createExecutiveReviewPack(makeReviewPackParams());

    expect(result.packId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.reviewPeriod).toBe('2026-Q1');
    expect(result.kpiSummaries).toHaveLength(1);
    expect(result.deviationHighlights).toHaveLength(1);
    expect(result.roiSnapshot.totalRealized).toBe(450000);
    expect(result.status).toBe('draft');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_executive_review_packs');
  });

  it('always starts in draft status', async () => {
    const result = await createExecutiveReviewPack(makeReviewPackParams());
    expect(result.status).toBe('draft');
  });

  it('creates a pack with empty summaries', async () => {
    const result = await createExecutiveReviewPack(
      makeReviewPackParams({
        kpiSummaries: [],
        deviationHighlights: [],
        roiSnapshot: { totalRealized: 0, entriesCount: 0, period: '2026-Q1' },
      })
    );
    expect(result.kpiSummaries).toEqual([]);
    expect(result.deviationHighlights).toEqual([]);
    expect(result.roiSnapshot.totalRealized).toBe(0);
  });

  it('creates a pack with multiple KPI summaries', async () => {
    const summaries: KPISummary[] = [
      makeKPISummary({ kpiId: '00000000-0000-4000-8000-111111111111', name: 'KPI A' }),
      makeKPISummary({ kpiId: '00000000-0000-4000-8000-222222222222', name: 'KPI B' }),
      makeKPISummary({ kpiId: '00000000-0000-4000-8000-333333333333', name: 'KPI C' }),
    ];
    const result = await createExecutiveReviewPack(
      makeReviewPackParams({ kpiSummaries: summaries })
    );
    expect(result.kpiSummaries).toHaveLength(3);
  });

  it('rejects invalid organizationId via Zod', async () => {
    await expect(
      createExecutiveReviewPack(makeReviewPackParams({ organizationId: 'bad' }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty reviewPeriod via Zod', async () => {
    await expect(
      createExecutiveReviewPack(makeReviewPackParams({ reviewPeriod: '' }))
    ).rejects.toThrow(ZodError);
  });
});

describe('getExecutiveReviewPack', () => {
  it('returns a review pack with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeReviewPackRow());

    const result = await getExecutiveReviewPack(PACK_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.packId).toBe(PACK_ID);
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.kpiSummaries).toHaveLength(1);
    expect(result!.deviationHighlights).toHaveLength(1);
    expect(result!.roiSnapshot.totalRealized).toBe(450000);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when pack not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getExecutiveReviewPack('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getExecutiveReviewPack(PACK_ID, OTHER_ORG_ID);
    expect(result).toBeNull();
  });

  it('handles malformed JSON gracefully', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeReviewPackRow({
        kpi_summaries: 'not-json',
        deviation_highlights: 'not-json',
        roi_snapshot: 'not-json',
      })
    );

    const result = await getExecutiveReviewPack(PACK_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(result!.kpiSummaries).toEqual([]);
    expect(result!.deviationHighlights).toEqual([]);
    expect(result!.roiSnapshot.totalRealized).toBe(0);
  });
});

// ------------------------------------------
// KPI-Finance reconciliation (Decision W6-5)
// ------------------------------------------

describe('initiateReconciliation', () => {
  it('initiates reconciliation from Results side (Decision W6-5)', async () => {
    const result = await initiateReconciliation(makeReconciliationParams());

    expect(result.reconciliationId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.kpiId).toBe(KPI_ID);
    expect(result.financeRef).toBe('FIN-2026-Q1-001');
    expect(result.reconciliationStatus).toBe('pending');
    expect(result.initiatedBy).toBe('results');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_kpi_finance_reconciliations');
  });

  it('initiates reconciliation from Finance side', async () => {
    const result = await initiateReconciliation(
      makeReconciliationParams({ initiatedBy: 'finance' })
    );
    expect(result.initiatedBy).toBe('finance');
    expect(result.reconciliationStatus).toBe('pending');
  });

  it('always starts in pending status', async () => {
    const result = await initiateReconciliation(makeReconciliationParams());
    expect(result.reconciliationStatus).toBe('pending');
  });

  it('rejects invalid initiatedBy via Zod', async () => {
    await expect(
      initiateReconciliation(makeReconciliationParams({ initiatedBy: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty financeRef via Zod', async () => {
    await expect(
      initiateReconciliation(makeReconciliationParams({ financeRef: '' }))
    ).rejects.toThrow(ZodError);
  });
});

describe('resolveReconciliation', () => {
  it('resolves reconciliation to reconciled (Finance resolves — Decision W6-5)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeReconciliationRow());

    const result = await resolveReconciliation(RECON_ID, ORG_ID, 'reconciled');

    expect(result.reconciliationStatus).toBe('reconciled');
    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_kpi_finance_reconciliations');
  });

  it('resolves reconciliation to disputed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeReconciliationRow());
    const result = await resolveReconciliation(RECON_ID, ORG_ID, 'disputed');
    expect(result.reconciliationStatus).toBe('disputed');
  });

  it('resolves reconciliation to escalated', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeReconciliationRow());
    const result = await resolveReconciliation(RECON_ID, ORG_ID, 'escalated');
    expect(result.reconciliationStatus).toBe('escalated');
  });

  it('throws when reconciliation not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await expect(resolveReconciliation('nonexistent', ORG_ID, 'reconciled')).rejects.toThrow(
      'not found'
    );
  });

  it('throws for invalid status value', async () => {
    await expect(resolveReconciliation(RECON_ID, ORG_ID, 'invalid_status' as any)).rejects.toThrow(
      'Invalid reconciliation status'
    );
  });
});

// ------------------------------------------
// Standalone mode (Decision W6-6)
// ------------------------------------------

describe('standalone mode (Decision W6-6)', () => {
  it('creates standalone KPI without initiative dependency', async () => {
    const result = await createKPI(makeStandaloneKPIParams());
    expect(result.mode).toBe('standalone');
    expect(result.initiativeId).toBeNull();
  });

  it('records ROI for standalone KPI without initiative', async () => {
    const result = await recordROIRealization(makeROIParams({ initiativeId: null }));
    expect(result.initiativeId).toBeNull();
    expect(result.realizedValue).toBe(150000);
  });

  it('records deviation for standalone KPI', async () => {
    const result = await recordDeviation(makeDeviationParams());
    expect(result.kpiId).toBe(KPI_ID);
    expect(result.deviationType).toBe('underperformance');
  });

  it('standalone KPI follows same lifecycle as initiative-linked', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeKPIRow({ mode: 'standalone', initiative_id: null, status: 'design' })
    );
    const result = await updateKPIStatus(KPI_ID, ORG_ID, 'baseline');
    expect(result.status).toBe('baseline');
  });
});

// ------------------------------------------
// Organization isolation
// ------------------------------------------

describe('organization isolation', () => {
  it('getKPI includes org in query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getKPI(KPI_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(query).toContain('organization_id');
    expect(params).toContain(ORG_ID);
  });

  it('getDeviationsByKPI includes org in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getDeviationsByKPI(KPI_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(query).toContain('organization_id');
    expect(params).toContain(ORG_ID);
  });

  it('getROIByInitiative includes org in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getROIByInitiative(INITIATIVE_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(query).toContain('organization_id');
    expect(params).toContain(ORG_ID);
  });

  it('getExecutiveReviewPack includes org in query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getExecutiveReviewPack(PACK_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(query).toContain('organization_id');
    expect(params).toContain(ORG_ID);
  });

  it('resolveReconciliation includes org in query', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeReconciliationRow());
    await resolveReconciliation(RECON_ID, ORG_ID, 'reconciled');

    const selectQuery = mockDbGet.mock.calls[0][0] as string;
    expect(selectQuery).toContain('organization_id');
    const updateQuery = mockDbRun.mock.calls[0][0] as string;
    expect(updateQuery).toContain('organization_id');
  });
});

// ------------------------------------------
// Zod schema validation
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates KPIDefinition', () => {
    const kpi = {
      kpiId: KPI_ID,
      organizationId: ORG_ID,
      name: 'Test KPI',
      mode: 'initiative_linked' as const,
      initiativeId: INITIATIVE_ID,
      metricType: 'percentage' as const,
      baselineValue: 5.0,
      targetValue: 15.0,
      currentValue: null,
      measurementCadence: 'monthly' as const,
      status: 'design' as const,
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => KPIDefinitionSchema.parse(kpi)).not.toThrow();
  });

  it('validates DeviationRecord', () => {
    const deviation = {
      deviationId: DEVIATION_ID,
      organizationId: ORG_ID,
      kpiId: KPI_ID,
      deviationType: 'underperformance' as const,
      severity: 'high' as const,
      actionRequired: 'Investigate',
      escalatedTo: null,
      createdAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => DeviationRecordSchema.parse(deviation)).not.toThrow();
  });

  it('validates ROIRealizationEntry', () => {
    const entry = {
      entryId: '00000000-0000-4000-8000-ffffffffffff',
      organizationId: ORG_ID,
      kpiId: KPI_ID,
      initiativeId: INITIATIVE_ID,
      realizedValue: 150000,
      period: '2026-Q1',
      provenanceRef: null,
      verifiedBy: null,
      createdAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => ROIRealizationEntrySchema.parse(entry)).not.toThrow();
  });

  it('validates ExecutiveReviewPack', () => {
    const pack = {
      packId: PACK_ID,
      organizationId: ORG_ID,
      reviewPeriod: '2026-Q1',
      kpiSummaries: [makeKPISummary()],
      deviationHighlights: [makeDeviationHighlight()],
      roiSnapshot: makeROISnapshot(),
      status: 'draft' as const,
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => ExecutiveReviewPackSchema.parse(pack)).not.toThrow();
  });

  it('validates KPIFinanceReconciliation', () => {
    const recon = {
      reconciliationId: RECON_ID,
      organizationId: ORG_ID,
      kpiId: KPI_ID,
      financeRef: 'FIN-2026-Q1-001',
      reconciliationStatus: 'pending' as const,
      initiatedBy: 'results' as const,
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
    };
    expect(() => KPIFinanceReconciliationSchema.parse(recon)).not.toThrow();
  });

  it('validates KPISummary', () => {
    expect(() => KPISummarySchema.parse(makeKPISummary())).not.toThrow();
  });

  it('validates DeviationHighlight', () => {
    expect(() => DeviationHighlightSchema.parse(makeDeviationHighlight())).not.toThrow();
  });

  it('validates ROISnapshot', () => {
    expect(() => ROISnapshotSchema.parse(makeROISnapshot())).not.toThrow();
  });

  it('rejects invalid KPI status in schema', () => {
    expect(() =>
      KPIDefinitionSchema.parse({
        kpiId: KPI_ID,
        organizationId: ORG_ID,
        name: 'Test',
        mode: 'standalone',
        initiativeId: null,
        metricType: 'count',
        baselineValue: null,
        targetValue: null,
        currentValue: null,
        measurementCadence: 'monthly',
        status: 'invalid_status',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('rejects invalid reconciliation status in schema', () => {
    expect(() =>
      KPIFinanceReconciliationSchema.parse({
        reconciliationId: RECON_ID,
        organizationId: ORG_ID,
        kpiId: KPI_ID,
        financeRef: 'FIN-001',
        reconciliationStatus: 'invalid',
        initiatedBy: 'results',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('validates CreateKPIParams', () => {
    expect(() => CreateKPIParamsSchema.parse(makeCreateKPIParams())).not.toThrow();
  });

  it('validates RecordDeviationParams', () => {
    expect(() => RecordDeviationParamsSchema.parse(makeDeviationParams())).not.toThrow();
  });

  it('validates RecordROIRealizationParams', () => {
    expect(() => RecordROIRealizationParamsSchema.parse(makeROIParams())).not.toThrow();
  });

  it('validates CreateExecutiveReviewPackParams', () => {
    expect(() => CreateExecutiveReviewPackParamsSchema.parse(makeReviewPackParams())).not.toThrow();
  });

  it('validates InitiateReconciliationParams', () => {
    expect(() =>
      InitiateReconciliationParamsSchema.parse(makeReconciliationParams())
    ).not.toThrow();
  });
});

// ------------------------------------------
// KPI status transition map
// ------------------------------------------

describe('KPI_STATUS_TRANSITIONS', () => {
  it('covers all KPI statuses', () => {
    for (const status of KPIStatusValues) {
      expect(KPI_STATUS_TRANSITIONS).toHaveProperty(status);
    }
  });

  it('benefits_realization is terminal', () => {
    expect(KPI_STATUS_TRANSITIONS.benefits_realization).toEqual([]);
  });

  it('design only allows baseline', () => {
    expect(KPI_STATUS_TRANSITIONS.design).toEqual(['baseline']);
  });

  it('review allows deviation, improvement, benefits_realization', () => {
    expect(KPI_STATUS_TRANSITIONS.review).toContain('deviation');
    expect(KPI_STATUS_TRANSITIONS.review).toContain('improvement');
    expect(KPI_STATUS_TRANSITIONS.review).toContain('benefits_realization');
  });

  it('deviation allows improvement and review', () => {
    expect(KPI_STATUS_TRANSITIONS.deviation).toContain('improvement');
    expect(KPI_STATUS_TRANSITIONS.deviation).toContain('review');
  });
});
