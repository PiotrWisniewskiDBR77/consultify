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
  getEntrypointsByOrg,
  getEntrypointsBySource,
  getOrphanedEntrypoints,
  getTransformationPipeline,
  refreshSyncedSources,
  validateMaterializationChain,
} from '../sourceTruthService.js';

const ORG_A = '00000000-0000-4000-8000-000000000001';
const INITIATIVE_ID = '00000000-0000-4000-8000-000000000010';
const EP_ID = '00000000-0000-4000-8000-0000000000aa';
const MAT_ID = '00000000-0000-4000-8000-0000000000bb';
const REF_ID = '00000000-0000-4000-8000-cccccccccccc';
const SOURCE_ID = 'idea-artifact-001';

function makeEntrypointRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    entrypoint_id: EP_ID,
    organization_id: ORG_A,
    source_type: 'idea',
    source_id: SOURCE_ID,
    created_at: '2026-03-23T10:00:00.000Z',
    last_validated_at: null as string | null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getEntrypointsByOrg', () => {
  it('returns entrypoints scoped to organization', async () => {
    mockDbAll.mockResolvedValueOnce([makeEntrypointRow()]);

    const rows = await getEntrypointsByOrg(ORG_A);

    expect(rows).toHaveLength(1);
    expect(rows[0].entrypointId).toBe(EP_ID);
    expect(rows[0].sourceType).toBe('idea');
    expect(rows[0].sourceId).toBe(SOURCE_ID);
    expect(rows[0].lastValidatedAt).toBeNull();

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('v8_initiative_entrypoints');
    expect(sql).toContain('organization_id = ?');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(ORG_A);
  });

  it('filters by source type when provided', async () => {
    mockDbAll.mockResolvedValueOnce([makeEntrypointRow({ source_type: 'interview' })]);

    await getEntrypointsByOrg(ORG_A, 'interview');

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('source_type = ?');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toEqual([ORG_A, 'interview', 500]);
  });

  it('clamps limit between 1 and max', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getEntrypointsByOrg(ORG_A, undefined, 999999);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[params.length - 1]).toBe(5000);
  });

  it('throws on invalid sourceType at runtime', async () => {
    await expect(getEntrypointsByOrg(ORG_A, 'not_an_entrypoint' as 'idea')).rejects.toThrow(
      /Invalid sourceType/
    );
  });
});

describe('getEntrypointsBySource', () => {
  it('queries by source_id and organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([makeEntrypointRow()]);

    const rows = await getEntrypointsBySource(SOURCE_ID, ORG_A);

    expect(rows).toHaveLength(1);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('source_id = ?');
    expect(mockDbAll.mock.calls[0][1]).toEqual([SOURCE_ID, ORG_A]);
  });
});

describe('validateMaterializationChain', () => {
  it('returns invalid when no lifecycle materializations exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await validateMaterializationChain(INITIATIVE_ID, ORG_A);

    expect(result.valid).toBe(false);
    expect(result.chain).toEqual([]);
    expect(result.gaps.some((g) => /No lifecycle materializations/.test(g))).toBe(true);
    expect(mockDbAll).toHaveBeenCalledOnce();
  });

  it('returns valid chain when entrypoint and promotion record exist', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          materialization_id: MAT_ID,
          entrypoint_id: EP_ID,
          initiative_id: INITIATIVE_ID,
          organization_id: ORG_A,
          mat_created_at: '2026-03-23T11:00:00.000Z',
          ep_entrypoint_id: EP_ID,
          ep_organization_id: ORG_A,
          source_type: 'idea',
          source_id: SOURCE_ID,
          ep_created_at: '2026-03-23T10:00:00.000Z',
          ep_last_validated_at: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          record_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
          initiative_id: INITIATIVE_ID,
          organization_id: ORG_A,
          entrypoint: 'idea',
          entrypoint_class: 'derived_source',
          source_artifact_id: SOURCE_ID,
          source_artifact_type: 'Idea',
          context_snapshot_id: null,
          materialization_mode: 'invisible',
          evidence_class: 'strong',
          promoted_by: '00000000-0000-4000-8000-000000000020',
          promoted_at: '2026-03-23T11:00:00.000Z',
          created_at: '2026-03-23T11:00:00.000Z',
        },
      ]);

    const result = await validateMaterializationChain(INITIATIVE_ID, ORG_A);

    expect(result.valid).toBe(true);
    expect(result.gaps).toEqual([]);
    expect(result.chain).toHaveLength(1);
    expect(result.chain[0].source).toEqual({ id: SOURCE_ID, type: 'idea' });
    expect(result.chain[0].materialization.materializationId).toBe(MAT_ID);
  });

  it('records gap when entrypoint is missing', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          materialization_id: MAT_ID,
          entrypoint_id: EP_ID,
          initiative_id: INITIATIVE_ID,
          organization_id: ORG_A,
          mat_created_at: '2026-03-23T11:00:00.000Z',
          ep_entrypoint_id: null,
          ep_organization_id: null,
          source_type: null,
          source_id: null,
          ep_created_at: null,
          ep_last_validated_at: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await validateMaterializationChain(INITIATIVE_ID, ORG_A);

    expect(result.valid).toBe(false);
    expect(result.chain).toEqual([]);
    expect(result.gaps[0]).toContain('no matching entrypoint');
  });

  it('records gap when v8_source_materialization_records row is missing', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          materialization_id: MAT_ID,
          entrypoint_id: EP_ID,
          initiative_id: INITIATIVE_ID,
          organization_id: ORG_A,
          mat_created_at: '2026-03-23T11:00:00.000Z',
          ep_entrypoint_id: EP_ID,
          ep_organization_id: ORG_A,
          source_type: 'idea',
          source_id: SOURCE_ID,
          ep_created_at: '2026-03-23T10:00:00.000Z',
          ep_last_validated_at: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await validateMaterializationChain(INITIATIVE_ID, ORG_A);

    expect(result.valid).toBe(false);
    expect(result.chain).toEqual([]);
    expect(result.gaps[0]).toContain('v8_source_materialization_records');
  });
});

describe('getOrphanedEntrypoints', () => {
  it('returns only entrypoints without materialization rows', async () => {
    mockDbAll.mockResolvedValueOnce([makeEntrypointRow()]);

    const rows = await getOrphanedEntrypoints(ORG_A);

    expect(rows).toHaveLength(1);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('LEFT JOIN v8_initiative_materializations');
    expect(sql).toContain('m.materialization_id IS NULL');
  });
});

describe('refreshSyncedSources', () => {
  it('marks refs stale when no promotion and no lifecycle match', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          ref_id: REF_ID,
          initiative_id: INITIATIVE_ID,
          organization_id: ORG_A,
          external_source_id: 'orphan-ref',
          external_system: 'jira',
          sync_status: 'active',
          last_synced_at: '2026-03-23T09:00:00.000Z',
          created_at: '2026-03-23T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockDbGet.mockResolvedValueOnce({
      ref_id: REF_ID,
      initiative_id: INITIATIVE_ID,
      organization_id: ORG_A,
      external_source_id: 'orphan-ref',
      external_system: 'jira',
      sync_status: 'active',
      last_synced_at: '2026-03-23T09:00:00.000Z',
      created_at: '2026-03-23T08:00:00.000Z',
    });

    const result = await refreshSyncedSources(INITIATIVE_ID, ORG_A);

    expect(result.checked).toBe(1);
    expect(result.markedStale).toEqual([REF_ID]);
    expect(mockDbRun).toHaveBeenCalled();
    const runSql = mockDbRun.mock.calls[0][0] as string;
    expect(runSql).toContain('UPDATE v8_synced_source_refs');
  });

  it('does not mark stale when promotion record matches externalSourceId', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          ref_id: REF_ID,
          initiative_id: INITIATIVE_ID,
          organization_id: ORG_A,
          external_source_id: SOURCE_ID,
          external_system: 'jira',
          sync_status: 'active',
          last_synced_at: '2026-03-23T12:00:00.000Z',
          created_at: '2026-03-23T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          source_artifact_id: SOURCE_ID,
          entrypoint: 'idea',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await refreshSyncedSources(INITIATIVE_ID, ORG_A);

    expect(result.markedStale).toEqual([]);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('marks stale when entrypoint last_validated_at is newer than lastSyncedAt', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          ref_id: REF_ID,
          initiative_id: INITIATIVE_ID,
          organization_id: ORG_A,
          external_source_id: SOURCE_ID,
          external_system: 'jira',
          sync_status: 'active',
          last_synced_at: '2026-03-23T09:00:00.000Z',
          created_at: '2026-03-23T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          source_id: SOURCE_ID,
          source_type: 'idea',
          last_validated_at: '2026-03-23T15:00:00.000Z',
        },
      ]);

    mockDbGet.mockResolvedValueOnce({
      ref_id: REF_ID,
      initiative_id: INITIATIVE_ID,
      organization_id: ORG_A,
      external_source_id: SOURCE_ID,
      external_system: 'jira',
      sync_status: 'active',
      last_synced_at: '2026-03-23T09:00:00.000Z',
      created_at: '2026-03-23T08:00:00.000Z',
    });

    const result = await refreshSyncedSources(INITIATIVE_ID, ORG_A);

    expect(result.markedStale).toEqual([REF_ID]);
    expect(mockDbRun).toHaveBeenCalled();
  });
});

describe('getTransformationPipeline', () => {
  it('aggregates totals and per-source-type counts', async () => {
    mockDbGet.mockResolvedValueOnce({ c: 5 }).mockResolvedValueOnce({ c: 2 });
    mockDbAll.mockResolvedValueOnce([
      { source_type: 'idea', c: 3 },
      { source_type: 'interview', c: 2 },
    ]);

    const summary = await getTransformationPipeline(ORG_A);

    expect(summary.totalEntrypoints).toBe(5);
    expect(summary.materializedCount).toBe(2);
    expect(summary.orphanedCount).toBe(3);
    expect(summary.bySourceType.idea).toBe(3);
    expect(summary.bySourceType.interview).toBe(2);
    expect(summary.bySourceType.chat).toBe(0);
  });
});
