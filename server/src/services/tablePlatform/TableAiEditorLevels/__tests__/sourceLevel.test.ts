/**
 * Unit tests for source level handler (Block C · C-S3).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('../../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { proposeSourceEdit } from '../sourceLevel.js';
import type { LlmProvider } from '../llmProvider.js';

const TABLE = 'tbl-1';
const ORG = 'org-A';
const WS = 'ws-A';
const ACTOR = 'admin-1';

function setupTenantOk(records: Array<{ id: string; data: Record<string, unknown> }>) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('JOIN tp_bases'))
      return { rows: [{ workspace_id: WS, organization_id: ORG }] };
    if (sql.includes('FROM tp_fields'))
      return {
        rows: [{ id: 'f-name', name: 'Name', field_type: 'singleLineText', options: {} }],
      };
    if (sql.includes('LEFT JOIN tp_record_sources'))
      return { rows: records.map((r) => ({ id: r.id })) };
    if (sql.includes('FROM tp_records WHERE table_id') && sql.includes('LIMIT'))
      return { rows: records.map((r) => ({ id: r.id })) };
    if (sql.includes('FROM tp_records'))
      return { rows: records.map((r) => ({ id: r.id, table_id: TABLE, data: r.data })) };
    return { rows: [] };
  });
}

function makeProvider(text: string): LlmProvider {
  return {
    generate: async () => ({ text, tokensInput: 50, tokensOutput: 25, model: 'mock', source: 'live' }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sourceLevel.proposeSourceEdit', () => {
  it('1) emits op_source_suggest per scanned record', async () => {
    setupTenantOk([{ id: 'r1', data: { 'f-name': 'Topic A' } }]);
    const provider = makeProvider(
      JSON.stringify({
        suggestions: [
          {
            recordId: 'r1',
            candidates: [
              { kind: 'url', ref: 'https://example.com/a', confidence: 0.7 },
              { kind: 'internal_record', ref: 'rec-x', confidence: 0.4 },
            ],
          },
        ],
        confidence: 0.75,
      })
    );

    const out = await proposeSourceEdit({
      level: 'source',
      tableId: TABLE,
      prompt: 'find sources',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_source_suggest');
    const candidates = (op.payload as Record<string, unknown>).candidates as Array<
      Record<string, unknown>
    >;
    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.kind).toBe('url');
    expect(candidates[0]!.ref).toBe('https://example.com/a');
  });

  it('2) drops candidates with empty ref', async () => {
    setupTenantOk([{ id: 'r1', data: {} }]);
    const provider = makeProvider(
      JSON.stringify({
        suggestions: [
          {
            recordId: 'r1',
            candidates: [
              { kind: 'url', ref: 'https://x.com', confidence: 0.6 },
              { kind: 'url', ref: '', confidence: 0.3 },
            ],
          },
        ],
      })
    );
    const out = await proposeSourceEdit({
      level: 'source',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: provider,
    });
    expect(out.operations).toHaveLength(1);
    const candidates = ((out.operations[0] as Record<string, unknown>).payload as Record<
      string,
      unknown
    >).candidates as Array<Record<string, unknown>>;
    expect(candidates).toHaveLength(1);
  });

  it('3) drops suggestions for unknown recordId (LLM injection defense)', async () => {
    setupTenantOk([{ id: 'r1', data: {} }]);
    const provider = makeProvider(
      JSON.stringify({
        suggestions: [
          { recordId: 'r1', candidates: [{ kind: 'url', ref: 'https://x.com', confidence: 0.7 }] },
          {
            recordId: 'r-FAKE',
            candidates: [{ kind: 'url', ref: 'https://leak.com', confidence: 0.9 }],
          },
        ],
      })
    );
    const out = await proposeSourceEdit({
      level: 'source',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: provider,
    });
    expect(out.operations).toHaveLength(1);
    expect(out.warnings.some((w) => w.startsWith('source_unknown_record_id'))).toBe(true);
  });

  it('4) tenant violation', async () => {
    mockQuery.mockImplementation(async () => ({
      rows: [{ workspace_id: 'other', organization_id: 'other' }],
    }));
    const out = await proposeSourceEdit({
      level: 'source',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('source_tenant_violation');
  });

  it('5) caps candidates at 5 per record', async () => {
    setupTenantOk([{ id: 'r1', data: {} }]);
    const tooMany = Array.from({ length: 10 }, (_, i) => ({
      kind: 'url',
      ref: `https://x.com/${i}`,
      confidence: 0.5,
    }));
    const provider = makeProvider(
      JSON.stringify({
        suggestions: [{ recordId: 'r1', candidates: tooMany }],
      })
    );
    const out = await proposeSourceEdit({
      level: 'source',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: provider,
    });
    const candidates = ((out.operations[0] as Record<string, unknown>).payload as Record<
      string,
      unknown
    >).candidates as Array<Record<string, unknown>>;
    expect(candidates.length).toBeLessThanOrEqual(5);
  });

  it('6) no records to scan → empty + warning', async () => {
    setupTenantOk([]);
    const out = await proposeSourceEdit({
      level: 'source',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('source_no_records_to_scan');
  });
});
