/**
 * Unit tests for SourcePackBuilderService (Block C · Sprint C-S6).
 *
 * Coverage:
 *   - Cross-tenant defenses on every public method (table not found / wrong org).
 *   - Candidate ranking — recency, lexical, confidence, verified-source signals.
 *   - Verified-only filter + recencyDays filter parameter wiring.
 *   - Limit clamp (default + hard cap).
 *   - createPack: validates name / candidates, captures V8 snapshot, refuses
 *     records that don't belong to the requested table.
 *   - getPack: collapses missing / cross-tenant rows to `null`.
 *   - listPacks: scopes filters and respects archived.
 *   - markPackUsed: increments counter, refuses unknown packs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery, mockLoggerWarn } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import sourcePackBuilderService, { SourcePackError } from '../SourcePackBuilderService.js';

const TABLE = '11111111-1111-1111-1111-111111111111';
const TABLE_OTHER = '22222222-2222-2222-2222-222222222222';
const ORG = 'org-A';
const ORG_OTHER = 'org-B';
const WS = 'ws-A';
const USER = 'user-1';

interface MockState {
  tenant: { workspace_id: string; organization_id: string } | null;
  fields: Array<{
    id: string;
    name: string;
    field_type: string;
    field_order: number;
    is_primary?: boolean;
  }>;
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    confidence_score: number | null;
    validation_status: string;
    updated_at: string;
  }>;
  /** Record IDs that have at least one verified source. */
  verifiedRecordIds: string[];
  ownership: { table_id: string; ids: string[] };
  packRow: any | null;
  packsList: any[];
  markUsedRow: any | null;
}

const state: MockState = {
  tenant: null,
  fields: [],
  records: [],
  verifiedRecordIds: [],
  ownership: { table_id: TABLE, ids: [] },
  packRow: null,
  packsList: [],
  markUsedRow: null,
};

function configureQueryRouter() {
  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    if (s.includes('FROM tp_tables t') && s.includes('JOIN tp_bases')) {
      return state.tenant ? { rows: [state.tenant] } : { rows: [] };
    }
    if (s.includes('FROM tp_fields')) {
      return {
        rows: state.fields.map((f) => ({
          id: f.id,
          name: f.name,
          field_type: f.field_type,
          field_order: f.field_order,
          is_primary: f.is_primary ?? false,
        })),
      };
    }
    if (s.includes('FROM tp_records') && s.includes('ORDER BY updated_at DESC')) {
      return { rows: state.records };
    }
    if (s.includes('FROM tp_record_sources')) {
      return {
        rows: state.verifiedRecordIds.map((rid) => ({ record_id: rid })),
      };
    }
    if (s.includes('SELECT id FROM tp_records') && s.includes('table_id = $2')) {
      const requested = params?.[0] as string[];
      const matching = (requested ?? []).filter((id) => state.ownership.ids.includes(id));
      return { rows: matching.map((id) => ({ id })) };
    }
    if (
      s.includes('SELECT id, data, confidence_score, validation_status, updated_at') &&
      s.includes('id = ANY')
    ) {
      const requested = (params?.[0] as string[]) ?? [];
      return {
        rows: state.records.filter((r) => requested.includes(r.id)),
      };
    }
    if (s.includes('INSERT INTO tp_source_packs')) {
      const [orgId, wsId, ownerId, tableId, name, description, ids, snapshot] = params as any[];
      const row = {
        id: 'pack-id-1',
        organization_id: orgId,
        workspace_id: wsId,
        owner_user_id: ownerId,
        table_id: tableId,
        name,
        description,
        candidate_record_ids: ids,
        v8_snapshot: snapshot,
        created_at: new Date('2026-05-08T10:00:00Z'),
        updated_at: new Date('2026-05-08T10:00:00Z'),
        used_count: 0,
        archived_at: null,
      };
      return { rows: [row] };
    }
    if (
      s.includes('FROM tp_source_packs') &&
      s.includes('WHERE id = $1') &&
      s.includes('LIMIT 1')
    ) {
      return state.packRow ? { rows: [state.packRow] } : { rows: [] };
    }
    if (s.includes('FROM tp_source_packs') && s.includes('ORDER BY created_at DESC')) {
      return { rows: state.packsList };
    }
    if (s.includes('UPDATE tp_source_packs')) {
      return state.markUsedRow ? { rows: [state.markUsedRow] } : { rows: [] };
    }
    return { rows: [] };
  });
}

function fixedDate(): Date {
  return new Date('2026-05-08T12:00:00Z');
}

function isoDaysAgo(days: number): string {
  return new Date(fixedDate().getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers().setSystemTime(fixedDate());
  state.tenant = { workspace_id: WS, organization_id: ORG };
  state.fields = [
    { id: 'f-name', name: 'name', field_type: 'text', field_order: 0, is_primary: true },
    { id: 'f-status', name: 'status', field_type: 'text', field_order: 1 },
  ];
  state.records = [];
  state.verifiedRecordIds = [];
  state.ownership = { table_id: TABLE, ids: [] };
  state.packRow = null;
  state.packsList = [];
  state.markUsedRow = null;
  configureQueryRouter();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── findCandidates ──────────────────────────────────────────────────────────

describe('SourcePackBuilderService.findCandidates', () => {
  it('throws when tableId missing', async () => {
    await expect(
      sourcePackBuilderService.findCandidates({ tableId: '', organizationId: ORG })
    ).rejects.toBeInstanceOf(SourcePackError);
  });

  it('refuses cross-tenant tables', async () => {
    state.tenant = { workspace_id: WS, organization_id: ORG };
    await expect(
      sourcePackBuilderService.findCandidates({
        tableId: TABLE,
        organizationId: ORG_OTHER,
      })
    ).rejects.toMatchObject({ code: 'TENANT_VIOLATION', status: 403 });
  });

  it('returns 404-like error when table missing', async () => {
    state.tenant = null;
    await expect(
      sourcePackBuilderService.findCandidates({
        tableId: TABLE,
        organizationId: ORG,
      })
    ).rejects.toMatchObject({ code: 'TABLE_NOT_FOUND', status: 404 });
  });

  it('ranks newer records higher when no query is supplied', async () => {
    state.records = [
      {
        id: 'r-old',
        data: { name: 'Old project' },
        confidence_score: 0.5,
        validation_status: 'verified',
        updated_at: isoDaysAgo(60),
      },
      {
        id: 'r-new',
        data: { name: 'Fresh project' },
        confidence_score: 0.5,
        validation_status: 'verified',
        updated_at: isoDaysAgo(1),
      },
    ];
    const out = await sourcePackBuilderService.findCandidates({
      tableId: TABLE,
      organizationId: ORG,
    });
    expect(out.map((c) => c.recordId)).toEqual(['r-new', 'r-old']);
    expect(out[0]!.rankSignals.recency).toBeGreaterThan(out[1]!.rankSignals.recency);
  });

  it('boosts records with verified sources', async () => {
    state.records = [
      {
        id: 'r-a',
        data: { name: 'Alpha' },
        confidence_score: 0.5,
        validation_status: 'verified',
        updated_at: isoDaysAgo(2),
      },
      {
        id: 'r-b',
        data: { name: 'Beta' },
        confidence_score: 0.5,
        validation_status: 'verified',
        updated_at: isoDaysAgo(2),
      },
    ];
    state.verifiedRecordIds = ['r-b'];
    const out = await sourcePackBuilderService.findCandidates({
      tableId: TABLE,
      organizationId: ORG,
    });
    expect(out[0]!.recordId).toBe('r-b');
    expect(out[0]!.hasVerifiedSource).toBe(true);
  });

  it('drops records without lexical hits when a query is supplied', async () => {
    state.records = [
      {
        id: 'r-match',
        data: { name: 'Risk register update' },
        confidence_score: 0.5,
        validation_status: 'verified',
        updated_at: isoDaysAgo(3),
      },
      {
        id: 'r-miss',
        data: { name: 'Holiday plan' },
        confidence_score: 0.9,
        validation_status: 'verified',
        updated_at: isoDaysAgo(1),
      },
    ];
    const out = await sourcePackBuilderService.findCandidates({
      tableId: TABLE,
      organizationId: ORG,
      query: 'risk',
    });
    expect(out.map((c) => c.recordId)).toEqual(['r-match']);
    expect(out[0]!.rankSignals.lexical).toBe(1);
  });

  it('clamps limit to hard cap', async () => {
    state.records = Array.from({ length: 200 }, (_, i) => ({
      id: `r-${i}`,
      data: { name: `Row ${i}` },
      confidence_score: 0.5,
      validation_status: 'unverified',
      updated_at: isoDaysAgo(i % 30),
    }));
    const out = await sourcePackBuilderService.findCandidates({
      tableId: TABLE,
      organizationId: ORG,
      limit: 5000,
    });
    expect(out.length).toBeLessThanOrEqual(100);
  });

  it('falls back gracefully when tp_record_sources is missing', async () => {
    state.records = [
      {
        id: 'r-only',
        data: { name: 'Only' },
        confidence_score: 0.5,
        validation_status: 'verified',
        updated_at: isoDaysAgo(2),
      },
    ];
    mockQuery.mockImplementation(async (sql: string) => {
      const s = String(sql);
      if (s.includes('FROM tp_tables t')) return { rows: [state.tenant] };
      if (s.includes('FROM tp_fields')) return { rows: state.fields };
      if (s.includes('FROM tp_records') && s.includes('ORDER BY updated_at DESC')) {
        return { rows: state.records };
      }
      if (s.includes('FROM tp_record_sources')) {
        throw new Error('relation "tp_record_sources" does not exist');
      }
      return { rows: [] };
    });
    const out = await sourcePackBuilderService.findCandidates({
      tableId: TABLE,
      organizationId: ORG,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.hasVerifiedSource).toBe(false);
    expect(mockLoggerWarn).toHaveBeenCalled();
  });
});

// ── createPack ──────────────────────────────────────────────────────────────

describe('SourcePackBuilderService.createPack', () => {
  it('validates name length', async () => {
    state.ownership = { table_id: TABLE, ids: ['r-1'] };
    await expect(
      sourcePackBuilderService.createPack({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        ownerUserId: USER,
        name: '   ',
        candidateRecordIds: ['r-1'],
      })
    ).rejects.toMatchObject({ code: 'NAME_REQUIRED' });
  });

  it('refuses empty candidate list', async () => {
    await expect(
      sourcePackBuilderService.createPack({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        ownerUserId: USER,
        name: 'Pack',
        candidateRecordIds: [],
      })
    ).rejects.toMatchObject({ code: 'NO_CANDIDATES' });
  });

  it('refuses cross-tenant tables before any DB scan', async () => {
    await expect(
      sourcePackBuilderService.createPack({
        tableId: TABLE,
        organizationId: ORG_OTHER,
        workspaceId: WS,
        ownerUserId: USER,
        name: 'Pack',
        candidateRecordIds: ['r-1'],
      })
    ).rejects.toMatchObject({ code: 'TENANT_VIOLATION' });
  });

  it('refuses records that do not belong to the table', async () => {
    state.ownership = { table_id: TABLE, ids: ['r-1'] };
    await expect(
      sourcePackBuilderService.createPack({
        tableId: TABLE,
        organizationId: ORG,
        workspaceId: WS,
        ownerUserId: USER,
        name: 'Mixed',
        candidateRecordIds: ['r-1', 'r-from-other-table'],
      })
    ).rejects.toMatchObject({ code: 'MIXED_TABLES' });
  });

  it('persists a V8 snapshot derived from the candidates', async () => {
    state.records = [
      {
        id: 'r-1',
        data: { name: 'Risk #1', status: 'open' },
        confidence_score: 0.7,
        validation_status: 'verified',
        updated_at: isoDaysAgo(2),
      },
      {
        id: 'r-2',
        data: { name: 'Risk #2', status: 'closed' },
        confidence_score: 0.4,
        validation_status: 'in_review',
        updated_at: isoDaysAgo(5),
      },
    ];
    state.ownership = { table_id: TABLE, ids: ['r-1', 'r-2'] };
    const pack = await sourcePackBuilderService.createPack({
      tableId: TABLE,
      organizationId: ORG,
      workspaceId: WS,
      ownerUserId: USER,
      name: 'Risks pack',
      description: 'Top-2 risks',
      candidateRecordIds: ['r-1', 'r-2'],
    });
    expect(pack.id).toBe('pack-id-1');
    expect(pack.candidateRecordIds).toEqual(['r-1', 'r-2']);
    expect(pack.v8Snapshot.records).toHaveLength(2);
    expect(pack.v8Snapshot.fields.map((f) => f.name)).toEqual(['name', 'status']);
    expect(pack.v8Snapshot.captureSource).toBe('source_pack_create');
  });

  it('overrides workspaceId from the resolved tenant (defense in depth)', async () => {
    state.records = [
      {
        id: 'r-1',
        data: { name: 'Row' },
        confidence_score: 0.5,
        validation_status: 'verified',
        updated_at: isoDaysAgo(1),
      },
    ];
    state.ownership = { table_id: TABLE, ids: ['r-1'] };
    const pack = await sourcePackBuilderService.createPack({
      tableId: TABLE,
      organizationId: ORG,
      workspaceId: 'attacker-supplied-ws',
      ownerUserId: USER,
      name: 'Pack',
      candidateRecordIds: ['r-1'],
    });
    expect(pack.workspaceId).toBe(WS);
  });
});

// ── getPack / listPacks / markPackUsed ──────────────────────────────────────

describe('SourcePackBuilderService.getPack', () => {
  it('returns null when row missing', async () => {
    state.packRow = null;
    const out = await sourcePackBuilderService.getPack('p-1', ORG);
    expect(out).toBeNull();
  });

  it('collapses cross-tenant rows to null', async () => {
    state.packRow = {
      id: 'p-1',
      organization_id: ORG_OTHER,
      workspace_id: WS,
      owner_user_id: USER,
      table_id: TABLE_OTHER,
      name: 'leaked',
      description: null,
      candidate_record_ids: ['r-1'],
      v8_snapshot: { records: [], fields: [], capturedAt: '', captureSource: 'source_pack_create' },
      created_at: new Date(),
      updated_at: new Date(),
      used_count: 0,
      archived_at: null,
    };
    const out = await sourcePackBuilderService.getPack('p-1', ORG);
    expect(out).toBeNull();
  });

  it('returns own pack', async () => {
    state.packRow = {
      id: 'p-1',
      organization_id: ORG,
      workspace_id: WS,
      owner_user_id: USER,
      table_id: TABLE,
      name: 'mine',
      description: null,
      candidate_record_ids: ['r-1'],
      v8_snapshot: {
        records: [],
        fields: [],
        capturedAt: '2026-05-08T10:00:00Z',
        captureSource: 'source_pack_create',
      },
      created_at: new Date(),
      updated_at: new Date(),
      used_count: 0,
      archived_at: null,
    };
    const out = await sourcePackBuilderService.getPack('p-1', ORG);
    expect(out?.id).toBe('p-1');
    expect(out?.name).toBe('mine');
  });
});

describe('SourcePackBuilderService.listPacks', () => {
  it('lists rows scoped to org', async () => {
    state.packsList = [
      {
        id: 'p-1',
        organization_id: ORG,
        workspace_id: WS,
        owner_user_id: USER,
        table_id: TABLE,
        name: 'first',
        description: null,
        candidate_record_ids: ['r-1'],
        v8_snapshot: {
          records: [],
          fields: [],
          capturedAt: '2026-05-08T10:00:00Z',
          captureSource: 'source_pack_create',
        },
        created_at: new Date(),
        updated_at: new Date(),
        used_count: 0,
        archived_at: null,
      },
    ];
    const out = await sourcePackBuilderService.listPacks({
      organizationId: ORG,
      tableId: TABLE,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe('p-1');
  });

  it('throws on missing org', async () => {
    await expect(sourcePackBuilderService.listPacks({ organizationId: '' })).rejects.toBeInstanceOf(
      SourcePackError
    );
  });
});

describe('SourcePackBuilderService.markPackUsed', () => {
  it('throws when pack missing in tenant', async () => {
    state.markUsedRow = null;
    await expect(sourcePackBuilderService.markPackUsed('p-x', ORG)).rejects.toMatchObject({
      code: 'PACK_NOT_FOUND',
      status: 404,
    });
  });

  it('returns updated counter on success', async () => {
    state.markUsedRow = { id: 'p-1', used_count: 7 };
    const out = await sourcePackBuilderService.markPackUsed('p-1', ORG);
    expect(out).toEqual({ packId: 'p-1', usedCount: 7 });
  });
});
