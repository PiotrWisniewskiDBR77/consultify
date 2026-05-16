/**
 * Unit tests for cell level handler (Block C · C-S2).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('../../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { proposeCellEdit } from '../cellLevel.js';
import type { LlmProvider } from '../llmProvider.js';

const TABLE = '00000000-0000-0000-0000-000000000001';
const RECORD = '00000000-0000-0000-0000-000000000002';
const FIELD = 'fld-1';
const ORG = 'org-A';
const WS = 'ws-A';
const ACTOR = 'user-1';

function setupTenantOk() {
  mockQuery.mockImplementation(async (sql: string, _params: unknown[]) => {
    if (sql.includes('FROM tp_tables t') && sql.includes('JOIN tp_bases')) {
      return { rows: [{ workspace_id: WS, organization_id: ORG }] };
    }
    if (sql.includes('FROM tp_fields')) {
      return {
        rows: [
          { id: FIELD, name: 'Status', field_type: 'singleSelect', options: { choices: [] } },
          { id: 'fld-2', name: 'Owner', field_type: 'singleLineText', options: {} },
        ],
      };
    }
    if (sql.includes('FROM tp_records')) {
      return {
        rows: [
          {
            id: RECORD,
            table_id: TABLE,
            data: { [FIELD]: 'open', 'fld-2': 'Anna' },
          },
        ],
      };
    }
    return { rows: [] };
  });
}

function makeProvider(text: string): LlmProvider {
  return {
    generate: async () => ({
      text,
      tokensInput: 50,
      tokensOutput: 25,
      model: 'mock',
      source: 'live',
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cellLevel.proposeCellEdit', () => {
  it('1) happy path: builds op_cell_set with before/after diff', async () => {
    setupTenantOk();
    const provider = makeProvider(
      JSON.stringify({ after: 'closed', summary: 'Mark closed', confidence: 0.85 })
    );

    const out = await proposeCellEdit({
      level: 'cell',
      tableId: TABLE,
      prompt: 'Mark this record as closed',
      context: { recordId: RECORD, fieldId: FIELD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.handlerStatus).toBe('live');
    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_cell_set');
    expect((op.target as Record<string, unknown>).recordId).toBe(RECORD);
    expect((op.target as Record<string, unknown>).fieldId).toBe(FIELD);
    expect(op.before).toBe('open');
    expect(op.after).toBe('closed');
    expect(op.manualOverride).toBe(false);
    expect(out.confidence).toBeCloseTo(0.85, 2);
    expect(out.summary).toContain('closed');
  });

  it('2) missing context.recordId → empty operations + warning', async () => {
    const out = await proposeCellEdit({
      level: 'cell',
      tableId: TABLE,
      prompt: 'p',
      context: { fieldId: FIELD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.operations).toEqual([]);
    expect(out.warnings).toContain('cell_context_missing_record_or_field');
  });

  it('3) tenant violation: org/ws mismatch → empty + warning', async () => {
    mockQuery.mockImplementation(async () => ({
      rows: [{ workspace_id: 'other-ws', organization_id: 'other-org' }],
    }));
    const out = await proposeCellEdit({
      level: 'cell',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD, fieldId: FIELD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{"after":"x"}'),
    });
    expect(out.operations).toEqual([]);
    expect(out.warnings).toContain('cell_tenant_violation');
  });

  it('4) unknown field → empty + warning', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN tp_bases'))
        return { rows: [{ workspace_id: WS, organization_id: ORG }] };
      if (sql.includes('FROM tp_fields')) return { rows: [] };
      if (sql.includes('FROM tp_records'))
        return { rows: [{ id: RECORD, table_id: TABLE, data: {} }] };
      return { rows: [] };
    });
    const out = await proposeCellEdit({
      level: 'cell',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD, fieldId: 'fld-missing' },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{"after":"x"}'),
    });
    expect(out.warnings).toContain('cell_field_not_found');
  });

  it('5) record not found → empty + warning', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN tp_bases'))
        return { rows: [{ workspace_id: WS, organization_id: ORG }] };
      if (sql.includes('FROM tp_fields'))
        return {
          rows: [{ id: FIELD, name: 'F', field_type: 'singleLineText', options: {} }],
        };
      if (sql.includes('FROM tp_records')) return { rows: [] };
      return { rows: [] };
    });
    const out = await proposeCellEdit({
      level: 'cell',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD, fieldId: FIELD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{"after":"x"}'),
    });
    expect(out.warnings).toContain('cell_record_not_found');
  });

  it('6) LLM null after → empty operations (no false changes)', async () => {
    setupTenantOk();
    const out = await proposeCellEdit({
      level: 'cell',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD, fieldId: FIELD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider(JSON.stringify({ after: null, confidence: 0 })),
    });
    expect(out.operations).toEqual([]);
  });

  it('7) LLM provider failure → graceful degradation', async () => {
    setupTenantOk();
    const provider: LlmProvider = {
      generate: async () => {
        throw new Error('LLM down');
      },
    };
    const out = await proposeCellEdit({
      level: 'cell',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD, fieldId: FIELD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });
    expect(out.operations).toEqual([]);
    expect(out.warnings).toContain('cell_llm_failure');
  });

  it('8) malformed LLM JSON is treated as empty after', async () => {
    setupTenantOk();
    const out = await proposeCellEdit({
      level: 'cell',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD, fieldId: FIELD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('not json at all'),
    });
    expect(out.operations).toEqual([]);
  });
});
