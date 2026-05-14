import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  cloneArtifact,
  getArtifactsByOrg,
  getArtifactsByTemplate,
  getDeliveryPipeline,
  getExportHistory,
  getQualityScores,
  getRecurringProgramHealth,
  getTemplateUsageStats,
  recordCompletedExport,
  recordFailedExport,
  scheduleExport,
  scoreArtifactQuality,
} from '../reportsPresModelService.js';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const ARTIFACT_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const FAMILY_ID = '00000000-0000-4000-8000-ffffffffffff';
const PROGRAM_ID = '00000000-0000-4000-8000-bbbbbbbbbbbb';

function artifactRow(overrides: Record<string, unknown> = {}) {
  return {
    artifact_id: ARTIFACT_ID,
    organization_id: ORG_ID,
    output_type: 'report',
    delivery_state: 'draft',
    template_family_ref: FAMILY_ID,
    source_initiative_id: null,
    ai_governance_preset_ref: null,
    created_by: USER_ID,
    created_at: '2026-03-23T10:00:00.000Z',
    last_transition_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockReset();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockReset();
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockReset();
  mockDbAll.mockResolvedValue([]);
});

describe('getArtifactsByOrg', () => {
  it('queries by organization with default limit 100', async () => {
    mockDbAll.mockResolvedValueOnce([artifactRow()]);

    const results = await getArtifactsByOrg(ORG_ID);

    expect(results).toHaveLength(1);
    expect(results[0].artifactId).toBe(ARTIFACT_ID);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('FROM v8_output_artifacts');
    expect(sql).toContain('organization_id = ?');
    expect(sql).toContain('LIMIT ?');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(ORG_ID);
    expect(params[params.length - 1]).toBe(100);
  });

  it('applies outputType and state filters', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getArtifactsByOrg(ORG_ID, 'presentation', 'ready', 5);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('output_type = ?');
    expect(sql).toContain('delivery_state = ?');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toEqual([ORG_ID, 'presentation', 'ready', 5]);
  });

  it('rejects invalid outputType filter', async () => {
    await expect(getArtifactsByOrg(ORG_ID, 'deck' as 'report')).rejects.toThrow(
      'Invalid outputType filter'
    );
  });

  it('rejects invalid state filter', async () => {
    await expect(getArtifactsByOrg(ORG_ID, undefined, 'shipped' as 'draft')).rejects.toThrow(
      'Invalid delivery state filter'
    );
  });

  it('clamps limit to 1..1000', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getArtifactsByOrg(ORG_ID, undefined, undefined, 5000);
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[params.length - 1]).toBe(1000);

    vi.clearAllMocks();
    mockDbAll.mockResolvedValueOnce([]);
    await getArtifactsByOrg(ORG_ID, undefined, undefined, 0);
    const params2 = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params2[params2.length - 1]).toBe(1);
  });
});

describe('getArtifactsByTemplate', () => {
  it('filters by template family and org', async () => {
    mockDbAll.mockResolvedValueOnce([artifactRow()]);

    const results = await getArtifactsByTemplate(FAMILY_ID, ORG_ID, 20);

    expect(results[0].templateFamilyRef).toBe(FAMILY_ID);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('template_family_ref = ?');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toEqual([FAMILY_ID, ORG_ID, 20]);
  });
});

describe('cloneArtifact', () => {
  it('inserts a draft copy with new id', async () => {
    const cloner = '00000000-0000-4000-8000-000000000099';
    mockDbGet.mockResolvedValueOnce(artifactRow({ delivery_state: 'ready' }));

    const clone = await cloneArtifact(ARTIFACT_ID, ORG_ID, cloner);

    expect(clone.deliveryState).toBe('draft');
    expect(clone.createdBy).toBe(cloner);
    expect(clone.artifactId).not.toBe(ARTIFACT_ID);
    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_output_artifacts');
    expect(sql).toContain('quality_scores');
  });

  it('throws when source artifact missing', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await expect(cloneArtifact(ARTIFACT_ID, ORG_ID, USER_ID)).rejects.toThrow('not found');
  });
});

describe('scoreArtifactQuality', () => {
  it('updates quality_scores JSON', async () => {
    mockDbGet.mockResolvedValueOnce(artifactRow());

    await scoreArtifactQuality(ARTIFACT_ID, ORG_ID, {
      contentScore: 0.8,
      designScore: 0.7,
      dataAccuracy: 0.9,
      overallScore: 0.82,
    });

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('quality_scores');
    const params = mockDbRun.mock.calls[0][1] as unknown[];
    const json = JSON.parse(params[0] as string);
    expect(json.contentScore).toBe(0.8);
    expect(json.overallScore).toBe(0.82);
    expect(json.recordedAt).toBeDefined();
  });

  it('throws on non-finite score', async () => {
    mockDbGet.mockResolvedValueOnce(artifactRow());
    await expect(
      scoreArtifactQuality(ARTIFACT_ID, ORG_ID, {
        contentScore: NaN,
        designScore: 1,
        dataAccuracy: 1,
        overallScore: 1,
      })
    ).rejects.toThrow('Invalid quality score field');
  });

  it('throws when artifact missing', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await expect(
      scoreArtifactQuality(ARTIFACT_ID, ORG_ID, {
        contentScore: 1,
        designScore: 1,
        dataAccuracy: 1,
        overallScore: 1,
      })
    ).rejects.toThrow('not found');
  });
});

describe('getQualityScores', () => {
  it('returns parsed scores when present', async () => {
    mockDbGet.mockResolvedValueOnce({
      quality_scores: JSON.stringify({
        contentScore: 0.5,
        designScore: 0.6,
        dataAccuracy: 0.7,
        overallScore: 0.65,
        recordedAt: '2026-03-23T12:00:00.000Z',
      }),
    });

    const scores = await getQualityScores(ARTIFACT_ID, ORG_ID);
    expect(scores).toEqual({
      contentScore: 0.5,
      designScore: 0.6,
      dataAccuracy: 0.7,
      overallScore: 0.65,
    });
  });

  it('returns null when column empty', async () => {
    mockDbGet.mockResolvedValueOnce({ quality_scores: null });
    expect(await getQualityScores(ARTIFACT_ID, ORG_ID)).toBeNull();
  });

  it('returns null when scores incomplete', async () => {
    mockDbGet.mockResolvedValueOnce({
      quality_scores: JSON.stringify({ contentScore: 1 }),
    });
    expect(await getQualityScores(ARTIFACT_ID, ORG_ID)).toBeNull();
  });
});

describe('scheduleExport', () => {
  it('inserts pending export row', async () => {
    mockDbGet.mockResolvedValueOnce(artifactRow());

    const rec = await scheduleExport(ARTIFACT_ID, ORG_ID, 'pdf', USER_ID);

    expect(rec.format).toBe('pdf');
    expect(rec.status).toBe('pending');
    expect(rec.completedAt).toBeNull();
    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_output_exports');
  });

  it('rejects invalid format', async () => {
    mockDbGet.mockResolvedValueOnce(artifactRow());
    await expect(scheduleExport(ARTIFACT_ID, ORG_ID, 'docx' as 'pdf', USER_ID)).rejects.toThrow(
      'Invalid export format'
    );
  });

  it('throws when artifact missing', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await expect(scheduleExport(ARTIFACT_ID, ORG_ID, 'html', USER_ID)).rejects.toThrow('not found');
  });
});

describe('recordCompletedExport', () => {
  it('inserts completed export row', async () => {
    mockDbGet.mockResolvedValueOnce(artifactRow());

    const rec = await recordCompletedExport(ARTIFACT_ID, ORG_ID, 'pdf', USER_ID);

    expect(rec.format).toBe('pdf');
    expect(rec.status).toBe('completed');
    expect(rec.completedAt).toBeTruthy();
    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_output_exports');
    const params = mockDbRun.mock.calls[0][1] as unknown[];
    expect(params[5]).toBe('completed');
  });
});

describe('recordFailedExport', () => {
  it('inserts failed export row', async () => {
    mockDbGet.mockResolvedValueOnce(artifactRow());

    const rec = await recordFailedExport(ARTIFACT_ID, ORG_ID, 'pdf', USER_ID);

    expect(rec.format).toBe('pdf');
    expect(rec.status).toBe('failed');
    expect(rec.completedAt).toBeTruthy();
    expect(mockDbRun).toHaveBeenCalledOnce();
    const params = mockDbRun.mock.calls[0][1] as unknown[];
    expect(params[5]).toBe('failed');
  });
});

describe('getExportHistory', () => {
  it('lists exports newest first', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        export_id: '00000000-0000-4000-8000-111111111111',
        artifact_id: ARTIFACT_ID,
        organization_id: ORG_ID,
        format: 'pptx',
        requested_by: USER_ID,
        status: 'pending',
        created_at: '2026-03-23T11:00:00.000Z',
        completed_at: null,
      },
    ]);

    const list = await getExportHistory(ARTIFACT_ID, ORG_ID);
    expect(list).toHaveLength(1);
    expect(list[0].exportId).toBe('00000000-0000-4000-8000-111111111111');
    expect(list[0].format).toBe('pptx');
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY created_at DESC');
  });
});

describe('getDeliveryPipeline', () => {
  it('aggregates states, types, avg quality, pending exports', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        { delivery_state: 'draft', cnt: 2 },
        { delivery_state: 'ready', cnt: 1 },
      ])
      .mockResolvedValueOnce([
        { output_type: 'report', cnt: 2 },
        { output_type: 'presentation', cnt: 1 },
      ]);
    mockDbGet.mockResolvedValueOnce({ avg: 0.75 }).mockResolvedValueOnce({ cnt: 4 });

    const summary = await getDeliveryPipeline(ORG_ID);

    expect(summary.artifactsByState).toEqual({ draft: 2, ready: 1 });
    expect(summary.artifactsByOutputType).toEqual({ report: 2, presentation: 1 });
    expect(summary.averageQualityScore).toBe(0.75);
    expect(summary.pendingExports).toBe(4);
  });

  it('returns null average when no quality data', async () => {
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockDbGet.mockResolvedValueOnce({ avg: null }).mockResolvedValueOnce({ cnt: 0 });

    const summary = await getDeliveryPipeline(ORG_ID);
    expect(summary.averageQualityScore).toBeNull();
  });
});

describe('getRecurringProgramHealth', () => {
  it('returns null when program not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    expect(await getRecurringProgramHealth(PROGRAM_ID, ORG_ID)).toBeNull();
  });

  it('returns schedule fields and null successRate without template ref', async () => {
    mockDbGet.mockResolvedValueOnce({
      program_id: PROGRAM_ID,
      organization_id: ORG_ID,
      output_type: 'report',
      template_family_ref: null,
      cadence: 'monthly',
      source_data_binding: '{}',
      is_active: 1,
      last_run_at: '2026-03-20T00:00:00.000Z',
      next_run_at: '2026-04-01T00:00:00.000Z',
      governance_level: 'standard',
      created_at: '2026-03-01T00:00:00.000Z',
    });

    const health = await getRecurringProgramHealth(PROGRAM_ID, ORG_ID);
    expect(health!.lastExecution).toBe('2026-03-20T00:00:00.000Z');
    expect(health!.nextScheduled).toBe('2026-04-01T00:00:00.000Z');
    expect(health!.successRate).toBeNull();
    expect(health!.isActive).toBe(true);
  });

  it('computes successRate from completed vs failed exports for template', async () => {
    mockDbGet.mockResolvedValueOnce({
      program_id: PROGRAM_ID,
      organization_id: ORG_ID,
      output_type: 'report',
      template_family_ref: FAMILY_ID,
      cadence: 'weekly',
      source_data_binding: '{}',
      is_active: 1,
      last_run_at: null,
      next_run_at: null,
      governance_level: 'standard',
      created_at: '2026-03-01T00:00:00.000Z',
    });
    mockDbAll.mockResolvedValueOnce([
      { status: 'completed', c: 3 },
      { status: 'failed', c: 1 },
    ]);

    const health = await getRecurringProgramHealth(PROGRAM_ID, ORG_ID);
    expect(health!.successRate).toBe(0.75);
  });
});

describe('getTemplateUsageStats', () => {
  it('returns families ordered by usage', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        family_id: FAMILY_ID,
        family_name: 'executive_steering_pack',
        usage_count: 5,
      },
      {
        family_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
        family_name: 'diagnostic_assessment_pack',
        usage_count: 0,
      },
    ]);

    const stats = await getTemplateUsageStats(ORG_ID);
    expect(stats[0].usageCount).toBe(5);
    expect(stats[0].familyName).toBe('executive_steering_pack');
    expect(stats[1].usageCount).toBe(0);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('v8_template_families');
    expect(sql).toContain('usage_count');
  });
});
