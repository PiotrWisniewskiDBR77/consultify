import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockDbRun = vi.fn().mockResolvedValue({ success: true, changes: 1 });
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

import {
  getIngestionPipeline,
  getFailedIngestions,
  retryIngestion,
  getLinkageHealth,
  getUnresolvedEscalations,
  resolveEscalation,
  getStaleSourceRefreshes,
  getFinanceDashboard,
} from '../financeIntegrationService.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const INGESTION_ID = '22222222-2222-4222-8222-222222222222';
const ESCALATION_ID = '33333333-3333-4333-8333-333333333333';
const RESOLVER_ID = '44444444-4444-4444-8444-444444444444';

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true, changes: 1 });
});

describe('getIngestionPipeline', () => {
  it('aggregates counts by state, confidence bands, and average confidence', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY readiness_state')) {
        return [
          { state: 'uploaded', cnt: 2 },
          { state: 'ready', cnt: 1 },
        ];
      }
      return [];
    });
    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('AVG(recognition_confidence)')) {
        return {
          total: 10,
          unknown_cnt: 1,
          high_cnt: 4,
          medium_cnt: 3,
          low_cnt: 2,
          avg_conf: 0.72,
        };
      }
      return null;
    });

    const summary = await getIngestionPipeline(ORG_ID);

    expect(summary.totalCount).toBe(10);
    expect(summary.byState.uploaded).toBe(2);
    expect(summary.byState.ready).toBe(1);
    expect(summary.confidenceBands).toEqual({
      high: 4,
      medium: 3,
      low: 2,
      unknown: 1,
    });
    expect(summary.averageConfidence).toBeCloseTo(0.72);
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID]);
    expect(mockDbGet.mock.calls[0][1]).toEqual([ORG_ID]);
  });

  it('returns zeroed bands when there are no ingestions', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    mockDbGet.mockResolvedValueOnce({
      total: 0,
      unknown_cnt: 0,
      high_cnt: 0,
      medium_cnt: 0,
      low_cnt: 0,
      avg_conf: null,
    });

    const summary = await getIngestionPipeline(ORG_ID);
    expect(summary.totalCount).toBe(0);
    expect(summary.averageConfidence).toBeNull();
    expect(summary.confidenceBands).toEqual({ high: 0, medium: 0, low: 0, unknown: 0 });
  });
});

describe('getFailedIngestions', () => {
  it('returns only failed and rejected ingestions for the org', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        ingestion_id: INGESTION_ID,
        organization_id: ORG_ID,
        document_ref: 'doc.pdf',
        recognition_confidence: null,
        readiness_state: 'failed',
        first_model_ref: null,
        created_at: '2026-03-23T10:00:00.000Z',
        updated_at: '2026-03-23T11:00:00.000Z',
      },
    ]);

    const rows = await getFailedIngestions(ORG_ID, 50);

    expect(rows).toHaveLength(1);
    expect(rows[0].readinessState).toBe('failed');
    expect(rows[0].ingestionId).toBe(INGESTION_ID);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain("IN ('failed', 'rejected')");
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID, 50]);
  });

  it('clamps limit to a safe range', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getFailedIngestions(ORG_ID, 9999);
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID, 500]);
  });
});

describe('retryIngestion', () => {
  it('resets failed ingestion to uploaded', async () => {
    mockDbGet.mockResolvedValueOnce({
      ingestion_id: INGESTION_ID,
      organization_id: ORG_ID,
      document_ref: 'doc.pdf',
      recognition_confidence: 0.4,
      readiness_state: 'failed',
      first_model_ref: null,
      created_at: '2026-03-23T10:00:00.000Z',
      updated_at: '2026-03-23T11:00:00.000Z',
    });

    const result = await retryIngestion(INGESTION_ID, ORG_ID);

    expect(result.readinessState).toBe('uploaded');
    expect(mockDbRun).toHaveBeenCalledOnce();
    const runArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(runArgs).toContain(INGESTION_ID);
    expect(runArgs).toContain(ORG_ID);
  });

  it('throws when ingestion is not in a retryable state', async () => {
    mockDbGet.mockResolvedValueOnce({
      ingestion_id: INGESTION_ID,
      organization_id: ORG_ID,
      document_ref: 'doc.pdf',
      recognition_confidence: null,
      readiness_state: 'ready',
      first_model_ref: null,
      created_at: '2026-03-23T10:00:00.000Z',
      updated_at: '2026-03-23T11:00:00.000Z',
    });

    await expect(retryIngestion(INGESTION_ID, ORG_ID)).rejects.toThrow('not in a retryable state');
  });
});

describe('getLinkageHealth', () => {
  it('returns linkage totals, per-type counts, and unlinked initiatives', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('v8_initiative_economics_linkages') && sql.includes('GROUP BY linkage_type')) {
        return [
          { linkage_type: 'budget', cnt: 2 },
          { linkage_type: 'forecast', cnt: 1 },
        ];
      }
      return [];
    });
    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM initiatives i')) {
        return { c: 5 };
      }
      return null;
    });

    const health = await getLinkageHealth(ORG_ID);

    expect(health.totalLinkages).toBe(3);
    expect(health.byLinkageType.budget).toBe(2);
    expect(health.byLinkageType.forecast).toBe(1);
    expect(health.unlinkedInitiativesCount).toBe(5);
  });
});

describe('getUnresolvedEscalations', () => {
  it('returns escalations where resolved_at IS NULL', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        escalation_id: ESCALATION_ID,
        organization_id: ORG_ID,
        initiative_id: 'init-1',
        finance_ref: 'fin-1',
        delta_magnitude: 0.2,
        delta_duration: 40,
        materiality_level: 'high',
        escalated_to_cfo: 1,
        threshold_breached: 1,
        created_at: '2026-03-23T10:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
        resolution: null,
      },
    ]);

    const list = await getUnresolvedEscalations(ORG_ID);

    expect(list).toHaveLength(1);
    expect(list[0].escalationId).toBe(ESCALATION_ID);
    expect(list[0].resolvedAt).toBeNull();
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('resolved_at IS NULL');
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID]);
  });
});

describe('resolveEscalation', () => {
  it('writes resolution metadata when row is unresolved', async () => {
    mockDbRun.mockResolvedValueOnce({ success: true, changes: 1 });
    mockDbGet.mockResolvedValueOnce({
      escalation_id: ESCALATION_ID,
      organization_id: ORG_ID,
      initiative_id: 'init-1',
      finance_ref: 'fin-1',
      delta_magnitude: 0.2,
      delta_duration: 40,
      materiality_level: 'high',
      escalated_to_cfo: 1,
      threshold_breached: 1,
      created_at: '2026-03-23T10:00:00.000Z',
      resolved_at: '2026-03-23T12:00:00.000Z',
      resolved_by: RESOLVER_ID,
      resolution: 'Explained timing variance',
    });

    const out = await resolveEscalation(
      ESCALATION_ID,
      ORG_ID,
      'Explained timing variance',
      RESOLVER_ID,
    );

    expect(out?.resolution).toBe('Explained timing variance');
    expect(out?.resolvedBy).toBe(RESOLVER_ID);
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('rejects empty resolution', async () => {
    await expect(
      resolveEscalation(ESCALATION_ID, ORG_ID, '   ', RESOLVER_ID),
    ).rejects.toThrow('resolution is required');
  });

  it('returns null when escalation does not exist', async () => {
    mockDbRun.mockResolvedValueOnce({ success: true, changes: 0 });
    mockDbGet.mockResolvedValueOnce(null);

    const out = await resolveEscalation(ESCALATION_ID, ORG_ID, 'done', RESOLVER_ID);
    expect(out).toBeNull();
  });
});

describe('getStaleSourceRefreshes', () => {
  it('selects refreshes older than cutoff by created_at', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        refresh_id: '55555555-5555-4555-8555-555555555555',
        organization_id: ORG_ID,
        promoted_artifact_ref: 'art-1',
        source_model_ref: 'src-1',
        source_updated_at: '2026-03-01T00:00:00.000Z',
        stale_warning_shown: 1,
        re_review_path: null,
        created_at: '2026-03-01T00:00:00.000Z',
      },
    ]);

    const rows = await getStaleSourceRefreshes(ORG_ID, 48);

    expect(rows).toHaveLength(1);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('created_at < ?');
    expect(mockDbAll.mock.calls[0][1][0]).toBe(ORG_ID);
    expect(typeof mockDbAll.mock.calls[0][1][1]).toBe('string');
  });
});

describe('getFinanceDashboard', () => {
  it('aggregates pipeline, linkage, escalations, stale refreshes, and gate pass rate', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY readiness_state')) {
        return [{ state: 'ready', cnt: 3 }];
      }
      if (sql.includes('v8_initiative_economics_linkages') && sql.includes('GROUP BY linkage_type')) {
        return [{ linkage_type: 'budget', cnt: 1 }];
      }
      if (sql.includes('v8_unreconciled_delta_escalations') && sql.includes('resolved_at IS NULL')) {
        return [
          {
            escalation_id: ESCALATION_ID,
            organization_id: ORG_ID,
            initiative_id: 'i',
            finance_ref: 'f',
            delta_magnitude: 1,
            delta_duration: 1,
            materiality_level: 'low',
            escalated_to_cfo: 0,
            threshold_breached: 0,
            created_at: '2026-03-23T10:00:00.000Z',
            resolved_at: null,
            resolved_by: null,
            resolution: null,
          },
        ];
      }
      if (sql.includes('v8_cloud_linked_source_refreshes') && sql.includes('created_at <')) {
        return [
          {
            refresh_id: '66666666-6666-4666-8666-666666666666',
            organization_id: ORG_ID,
            promoted_artifact_ref: 'a',
            source_model_ref: 's',
            source_updated_at: '2026-01-01T00:00:00.000Z',
            stale_warning_shown: 0,
            re_review_path: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
          {
            refresh_id: '77777777-7777-4777-8777-777777777777',
            organization_id: ORG_ID,
            promoted_artifact_ref: 'a2',
            source_model_ref: 's2',
            source_updated_at: '2026-01-02T00:00:00.000Z',
            stale_warning_shown: 0,
            re_review_path: null,
            created_at: '2026-01-02T00:00:00.000Z',
          },
        ];
      }
      return [];
    });

    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('AVG(recognition_confidence)')) {
        return {
          total: 3,
          unknown_cnt: 0,
          high_cnt: 2,
          medium_cnt: 1,
          low_cnt: 0,
          avg_conf: 0.9,
        };
      }
      if (sql.includes('FROM initiatives i')) {
        return { c: 2 };
      }
      if (sql.includes('FROM v8_promotion_gates')) {
        return { total: 4, approved: 3 };
      }
      return null;
    });

    const dash = await getFinanceDashboard(ORG_ID);

    expect(dash.ingestionPipeline.totalCount).toBe(3);
    expect(dash.linkageHealth.totalLinkages).toBe(1);
    expect(dash.unresolvedEscalationsCount).toBe(1);
    expect(dash.staleSourceRefreshesCount).toBe(2);
    expect(dash.promotionGatePassRate).toBeCloseTo(0.75);
  });

  it('uses null promotion pass rate when there are no gates', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY readiness_state')) return [];
      if (sql.includes('GROUP BY linkage_type')) return [];
      if (sql.includes('resolved_at IS NULL')) return [];
      if (sql.includes('v8_cloud_linked_source_refreshes') && sql.includes('created_at <')) {
        return [];
      }
      return [];
    });
    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('AVG(recognition_confidence)')) {
        return {
          total: 0,
          unknown_cnt: 0,
          high_cnt: 0,
          medium_cnt: 0,
          low_cnt: 0,
          avg_conf: null,
        };
      }
      if (sql.includes('FROM initiatives i')) return { c: 0 };
      if (sql.includes('FROM v8_promotion_gates')) return { total: 0, approved: 0 };
      return null;
    });

    const dash = await getFinanceDashboard(ORG_ID);
    expect(dash.promotionGatePassRate).toBeNull();
  });
});
