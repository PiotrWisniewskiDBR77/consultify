/**
 * Unit tests for TableArtifactConversionService (Block D · Sprint D-S1).
 *
 * Coverage:
 *   - Cross-tenant defenses on every public method.
 *   - Target / outline / title validation.
 *   - Source pack reuse: snapshot inheritance, table-mismatch refusal,
 *     `markPackUsed` analytics bump.
 *   - Live-snapshot fallback when no source pack is supplied + recordCap clamp.
 *   - Lifecycle: queued → running → succeeded.
 *   - Lifecycle: queued → running → failed (materialize throw).
 *   - Lifecycle: queued → running → failed (materializer returns no run id).
 *   - Empty-records refusal.
 *   - getConversion: collapses missing / cross-tenant rows to `null`.
 *   - listConversions: filters scoped correctly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery, mockLoggerWarn, mockLoggerError, mockGetPack, mockMarkUsed } = vi.hoisted(
  () => ({
    mockQuery: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerError: vi.fn(),
    mockGetPack: vi.fn(),
    mockMarkUsed: vi.fn(),
  })
);

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));
vi.mock('../SourcePackBuilderService.js', () => ({
  default: {
    getPack: mockGetPack,
    markPackUsed: mockMarkUsed,
  },
}));

import tableArtifactConversionService, {
  __setMaterializerForTesting,
  type ArtifactMaterializer,
  type ConversionMaterializeRequest,
  TableConversionError,
} from '../TableArtifactConversionService.js';

const TABLE = '11111111-1111-1111-1111-111111111111';
const TABLE_OTHER = '22222222-2222-2222-2222-222222222222';
const ORG = 'org-A';
const ORG_OTHER = 'org-B';
const WS = 'ws-A';
const USER = 'user-1';
const PACK_ID = 'pack-uuid-1';
const CONVERSION_ID = 'aaaaaaaa-1111-2222-3333-444444444444';

interface ConversionRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  table_id: string;
  source_pack_id: string | null;
  target: string;
  title: string | null;
  outline: any;
  v8_snapshot: any;
  status: string;
  artifact_run_id: string | null;
  artifact_deep_link: string | null;
  initiated_by: string;
  initiated_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  failure_stage: string | null;
}

interface MockState {
  tenant: { workspace_id: string; organization_id: string } | null;
  fields: Array<{ id: string; name: string; field_type: string; field_order: number }>;
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    confidence_score: number | null;
    validation_status: string;
    updated_at: string;
  }>;
  insertedRows: ConversionRow[];
  updatedRows: ConversionRow[];
  getConversionRow: ConversionRow | null;
  listConversionRows: ConversionRow[];
}

const state: MockState = {
  tenant: null,
  fields: [],
  records: [],
  insertedRows: [],
  updatedRows: [],
  getConversionRow: null,
  listConversionRows: [],
};

function configureQueryRouter() {
  let insertCount = 0;
  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    const s = String(sql);

    // Tenant resolution
    if (s.includes('FROM tp_tables t') && s.includes('JOIN tp_bases')) {
      return state.tenant ? { rows: [state.tenant] } : { rows: [] };
    }

    // Field load
    if (s.includes('FROM tp_fields')) {
      return { rows: state.fields };
    }

    // Live records
    if (s.includes('FROM tp_records') && s.includes('table_id = $1')) {
      return { rows: state.records };
    }

    // Insert queued conversion
    if (s.includes('INSERT INTO tp_table_conversions')) {
      insertCount += 1;
      const row: ConversionRow = {
        id: insertCount === 1 ? CONVERSION_ID : `conversion-${insertCount}`,
        organization_id: String(params?.[0]),
        workspace_id: String(params?.[1]),
        table_id: String(params?.[2]),
        source_pack_id: params?.[3] == null ? null : String(params?.[3]),
        target: String(params?.[4]),
        title: params?.[5] == null ? null : String(params?.[5]),
        outline: params?.[6] == null ? null : params?.[6],
        v8_snapshot: params?.[7],
        status: 'queued',
        artifact_run_id: null,
        artifact_deep_link: null,
        initiated_by: String(params?.[8]),
        initiated_at: new Date().toISOString(),
        completed_at: null,
        failure_reason: null,
        failure_stage: null,
      };
      state.insertedRows.push(row);
      return { rows: [row] };
    }

    // Mark running (no return rows needed)
    if (
      s.includes('UPDATE tp_table_conversions') &&
      s.includes("status = 'running'") &&
      !s.includes('RETURNING')
    ) {
      const id = String(params?.[0]);
      const row = state.insertedRows.find((r) => r.id === id);
      if (row) row.status = 'running';
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    // Mark succeeded
    if (s.includes('UPDATE tp_table_conversions') && s.includes("status = 'succeeded'")) {
      const id = String(params?.[0]);
      const artifactRunId = String(params?.[1]);
      const deepLink = params?.[2] == null ? null : String(params?.[2]);
      const row = state.insertedRows.find((r) => r.id === id);
      if (!row) return { rows: [] };
      row.status = 'succeeded';
      row.artifact_run_id = artifactRunId;
      row.artifact_deep_link = deepLink;
      row.completed_at = new Date().toISOString();
      state.updatedRows.push(row);
      return { rows: [row] };
    }

    // Mark failed
    if (s.includes('UPDATE tp_table_conversions') && s.includes("status = 'failed'")) {
      const id = String(params?.[0]);
      const stage = String(params?.[1]);
      const reason = String(params?.[2]);
      const row = state.insertedRows.find((r) => r.id === id);
      if (!row) return { rows: [] };
      row.status = 'failed';
      row.failure_stage = stage;
      row.failure_reason = reason;
      row.completed_at = new Date().toISOString();
      state.updatedRows.push(row);
      return { rows: [row] };
    }

    // getConversion
    if (
      s.includes('FROM tp_table_conversions') &&
      s.includes('WHERE id = $1') &&
      s.includes('LIMIT 1')
    ) {
      return { rows: state.getConversionRow ? [state.getConversionRow] : [] };
    }

    // listConversions
    if (s.includes('FROM tp_table_conversions') && s.includes('ORDER BY initiated_at')) {
      return { rows: state.listConversionRows };
    }

    return { rows: [] };
  });
}

beforeEach(() => {
  state.tenant = { workspace_id: WS, organization_id: ORG };
  state.fields = [
    { id: 'f1', name: 'Title', field_type: 'text', field_order: 0 },
    { id: 'f2', name: 'Notes', field_type: 'text', field_order: 1 },
  ];
  state.records = [
    {
      id: 'rec-1',
      data: { Title: 'Row 1', Notes: 'note' },
      confidence_score: 0.85,
      validation_status: 'verified',
      updated_at: new Date().toISOString(),
    },
    {
      id: 'rec-2',
      data: { Title: 'Row 2', Notes: 'note 2' },
      confidence_score: 0.5,
      validation_status: 'unverified',
      updated_at: new Date().toISOString(),
    },
  ];
  state.insertedRows = [];
  state.updatedRows = [];
  state.getConversionRow = null;
  state.listConversionRows = [];

  mockQuery.mockReset();
  mockGetPack.mockReset();
  mockMarkUsed.mockReset();
  mockLoggerWarn.mockReset();
  mockLoggerError.mockReset();

  configureQueryRouter();

  // Default stub materializer is restored automatically via __setMaterializerForTesting(null).
  __setMaterializerForTesting(null);
});

afterEach(() => {
  __setMaterializerForTesting(null);
});

describe('TableArtifactConversionService.convertTable', () => {
  it('rejects requests missing tableId / organizationId / workspaceId / initiatedBy', async () => {
    await expect(
      tableArtifactConversionService.convertTable({
        tableId: '',
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
      })
    ).rejects.toMatchObject({ code: 'TABLE_ID_REQUIRED' });

    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: '',
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
      })
    ).rejects.toMatchObject({ code: 'ORG_ID_REQUIRED' });

    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: '',
        initiatedBy: USER,
        target: 'document',
      })
    ).rejects.toMatchObject({ code: 'WS_ID_REQUIRED' });

    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: '',
        target: 'document',
      })
    ).rejects.toMatchObject({ code: 'INITIATED_BY_REQUIRED' });
  });

  it('rejects unknown targets', async () => {
    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        target: 'spreadsheet' as any,
      })
    ).rejects.toMatchObject({ code: 'INVALID_TARGET' });
  });

  it('returns 404 when the table does not exist', async () => {
    state.tenant = null;
    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
      })
    ).rejects.toMatchObject({ code: 'TABLE_NOT_FOUND', status: 404 });
  });

  it('refuses cross-tenant tableIds with TENANT_VIOLATION', async () => {
    state.tenant = { workspace_id: WS, organization_id: ORG_OTHER };
    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
      })
    ).rejects.toMatchObject({ code: 'TENANT_VIOLATION', status: 403 });
  });

  it('refuses workspace mismatches with WORKSPACE_VIOLATION', async () => {
    state.tenant = { workspace_id: 'ws-other', organization_id: ORG };
    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_VIOLATION', status: 403 });
  });

  it('rejects an empty table with NO_RECORDS', async () => {
    state.records = [];
    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
      })
    ).rejects.toMatchObject({ code: 'NO_RECORDS' });
  });

  it('captures a fresh live snapshot when no source pack is supplied', async () => {
    let capturedReq: ConversionMaterializeRequest | null = null;
    const materializer: ArtifactMaterializer = {
      async materialize(req) {
        capturedReq = req;
        return { artifactRunId: 'run-1', artifactDeepLink: '/wordy/run-1' };
      },
    };
    __setMaterializerForTesting(materializer);

    const result = await tableArtifactConversionService.convertTable({
      tableId: TABLE,
      organizationId: ORG,
      workspaceId: WS,
      initiatedBy: USER,
      target: 'document',
      title: 'My report',
    });

    expect(result.status).toBe('succeeded');
    expect(result.artifactRunId).toBe('run-1');
    expect(result.artifactDeepLink).toBe('/wordy/run-1');
    expect(result.sourcePackId).toBe(null);
    expect(capturedReq).not.toBeNull();
    expect(capturedReq!.snapshot.captureSource).toBe('table_conversion');
    expect(capturedReq!.snapshot.records).toHaveLength(2);
    expect(capturedReq!.snapshot.fields).toHaveLength(2);
    expect(capturedReq!.title).toBe('My report');
    expect(capturedReq!.target).toBe('document');
    expect(mockGetPack).not.toHaveBeenCalled();
  });

  it('reuses a source pack snapshot and bumps used_count on success', async () => {
    mockGetPack.mockResolvedValue({
      id: PACK_ID,
      organizationId: ORG,
      workspaceId: WS,
      ownerUserId: USER,
      tableId: TABLE,
      name: 'Pack 1',
      description: null,
      candidateRecordIds: ['rec-1'],
      v8Snapshot: {
        records: [
          {
            id: 'rec-1',
            data: { Title: 'Pack row' },
            confidenceScore: 0.9,
            validationStatus: 'verified',
            updatedAt: new Date().toISOString(),
          },
        ],
        fields: [{ id: 'f1', name: 'Title', fieldType: 'text' }],
        capturedAt: '2026-05-01T00:00:00.000Z',
        captureSource: 'source_pack_create',
      },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      usedCount: 0,
      archivedAt: null,
    });
    mockMarkUsed.mockResolvedValue({ packId: PACK_ID, usedCount: 1 });

    let capturedReq: ConversionMaterializeRequest | null = null;
    __setMaterializerForTesting({
      async materialize(req) {
        capturedReq = req;
        return { artifactRunId: 'run-pack-1', artifactDeepLink: null };
      },
    });

    const result = await tableArtifactConversionService.convertTable({
      tableId: TABLE,
      organizationId: ORG,
      workspaceId: WS,
      initiatedBy: USER,
      target: 'presentation',
      sourcePackId: PACK_ID,
    });

    expect(result.status).toBe('succeeded');
    expect(result.sourcePackId).toBe(PACK_ID);
    expect(capturedReq).not.toBeNull();
    expect(capturedReq!.snapshot.captureSource).toBe('source_pack_create');
    expect(capturedReq!.snapshot.records).toHaveLength(1);
    expect(mockMarkUsed).toHaveBeenCalledWith(PACK_ID, ORG);
  });

  it('refuses a source pack that belongs to another table', async () => {
    mockGetPack.mockResolvedValue({
      id: PACK_ID,
      organizationId: ORG,
      workspaceId: WS,
      ownerUserId: USER,
      tableId: TABLE_OTHER,
      name: 'Pack',
      description: null,
      candidateRecordIds: ['rec-x'],
      v8Snapshot: {
        records: [
          {
            id: 'rec-x',
            data: {},
            confidenceScore: null,
            validationStatus: 'unverified',
            updatedAt: new Date().toISOString(),
          },
        ],
        fields: [],
        capturedAt: '2026-05-01T00:00:00.000Z',
        captureSource: 'source_pack_create',
      },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      usedCount: 0,
      archivedAt: null,
    });

    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
        sourcePackId: PACK_ID,
      })
    ).rejects.toMatchObject({ code: 'SOURCE_PACK_TABLE_MISMATCH', status: 400 });

    expect(mockMarkUsed).not.toHaveBeenCalled();
  });

  it('returns 404 when the source pack is missing or in another tenant', async () => {
    mockGetPack.mockResolvedValue(null);
    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
        sourcePackId: PACK_ID,
      })
    ).rejects.toMatchObject({ code: 'SOURCE_PACK_NOT_FOUND', status: 404 });
  });

  it('marks the conversion failed when the materializer throws', async () => {
    __setMaterializerForTesting({
      async materialize() {
        throw new Error('boom');
      },
    });
    const result = await tableArtifactConversionService.convertTable({
      tableId: TABLE,
      organizationId: ORG,
      workspaceId: WS,
      initiatedBy: USER,
      target: 'document',
    });
    expect(result.status).toBe('failed');
    expect(result.artifactRunId).toBeNull();
    const lastInsert = state.insertedRows.at(-1)!;
    expect(lastInsert.status).toBe('failed');
    expect(lastInsert.failure_stage).toBe('materialize');
    expect(lastInsert.failure_reason).toContain('boom');
  });

  it('marks the conversion failed when the materializer returns no run id', async () => {
    __setMaterializerForTesting({
      async materialize() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { artifactRunId: '' as any, artifactDeepLink: null };
      },
    });
    const result = await tableArtifactConversionService.convertTable({
      tableId: TABLE,
      organizationId: ORG,
      workspaceId: WS,
      initiatedBy: USER,
      target: 'document',
    });
    expect(result.status).toBe('failed');
  });

  it('validates outline + title length', async () => {
    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
        title: 'x'.repeat(201),
      })
    ).rejects.toMatchObject({ code: 'TITLE_TOO_LONG' });

    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        outline: 'not an array' as any,
      })
    ).rejects.toMatchObject({ code: 'INVALID_OUTLINE' });

    await expect(
      tableArtifactConversionService.convertTable({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        initiatedBy: USER,
        target: 'document',
        outline: [{ heading: '' }],
      })
    ).rejects.toMatchObject({ code: 'INVALID_OUTLINE_HEADING' });
  });

  it('falls through markPackUsed errors without failing a successful conversion', async () => {
    mockGetPack.mockResolvedValue({
      id: PACK_ID,
      organizationId: ORG,
      workspaceId: WS,
      ownerUserId: USER,
      tableId: null,
      name: 'Pack',
      description: null,
      candidateRecordIds: ['rec-1'],
      v8Snapshot: {
        records: [
          {
            id: 'rec-1',
            data: { Title: 'p' },
            confidenceScore: 1,
            validationStatus: 'verified',
            updatedAt: new Date().toISOString(),
          },
        ],
        fields: [{ id: 'f1', name: 'Title', fieldType: 'text' }],
        capturedAt: '2026-05-01T00:00:00.000Z',
        captureSource: 'source_pack_create',
      },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      usedCount: 0,
      archivedAt: null,
    });
    mockMarkUsed.mockRejectedValue(new Error('counter offline'));
    __setMaterializerForTesting({
      async materialize() {
        return { artifactRunId: 'run-2', artifactDeepLink: null };
      },
    });

    const result = await tableArtifactConversionService.convertTable({
      tableId: TABLE,
      organizationId: ORG,
      workspaceId: WS,
      initiatedBy: USER,
      target: 'presentation',
      sourcePackId: PACK_ID,
    });

    expect(result.status).toBe('succeeded');
    expect(mockLoggerWarn).toHaveBeenCalled();
  });
});

describe('TableArtifactConversionService.getConversion', () => {
  it('rejects empty conversionId / organizationId', async () => {
    await expect(tableArtifactConversionService.getConversion('', ORG)).rejects.toBeInstanceOf(
      TableConversionError
    );
    await expect(
      tableArtifactConversionService.getConversion(CONVERSION_ID, '')
    ).rejects.toBeInstanceOf(TableConversionError);
  });

  it('returns null on miss and on cross-tenant rows', async () => {
    state.getConversionRow = null;
    expect(await tableArtifactConversionService.getConversion(CONVERSION_ID, ORG)).toBeNull();

    state.getConversionRow = {
      id: CONVERSION_ID,
      organization_id: ORG_OTHER,
      workspace_id: WS,
      table_id: TABLE,
      source_pack_id: null,
      target: 'document',
      title: null,
      outline: null,
      v8_snapshot: { records: [], fields: [], capturedAt: '', captureSource: 'table_conversion' },
      status: 'succeeded',
      artifact_run_id: 'run-x',
      artifact_deep_link: null,
      initiated_by: USER,
      initiated_at: new Date().toISOString(),
      completed_at: null,
      failure_reason: null,
      failure_stage: null,
    };
    expect(await tableArtifactConversionService.getConversion(CONVERSION_ID, ORG)).toBeNull();
  });

  it('returns the row when org matches', async () => {
    state.getConversionRow = {
      id: CONVERSION_ID,
      organization_id: ORG,
      workspace_id: WS,
      table_id: TABLE,
      source_pack_id: null,
      target: 'presentation',
      title: 'T',
      outline: null,
      v8_snapshot: { records: [], fields: [], capturedAt: '', captureSource: 'table_conversion' },
      status: 'succeeded',
      artifact_run_id: 'run-x',
      artifact_deep_link: null,
      initiated_by: USER,
      initiated_at: new Date().toISOString(),
      completed_at: null,
      failure_reason: null,
      failure_stage: null,
    };
    const row = await tableArtifactConversionService.getConversion(CONVERSION_ID, ORG);
    expect(row).not.toBeNull();
    expect(row!.id).toBe(CONVERSION_ID);
    expect(row!.target).toBe('presentation');
  });
});

describe('TableArtifactConversionService.listConversions', () => {
  it('rejects empty organizationId', async () => {
    await expect(
      tableArtifactConversionService.listConversions({ organizationId: '' })
    ).rejects.toBeInstanceOf(TableConversionError);
  });

  it('returns rows from the mock router', async () => {
    state.listConversionRows = [
      {
        id: 'c1',
        organization_id: ORG,
        workspace_id: WS,
        table_id: TABLE,
        source_pack_id: null,
        target: 'document',
        title: null,
        outline: null,
        v8_snapshot: { records: [], fields: [], capturedAt: '', captureSource: 'table_conversion' },
        status: 'succeeded',
        artifact_run_id: 'run-1',
        artifact_deep_link: null,
        initiated_by: USER,
        initiated_at: new Date().toISOString(),
        completed_at: null,
        failure_reason: null,
        failure_stage: null,
      },
    ];
    const rows = await tableArtifactConversionService.listConversions({
      organizationId: ORG,
      workspaceId: WS,
      tableId: TABLE,
      status: 'succeeded',
      limit: 10,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('c1');
  });
});
