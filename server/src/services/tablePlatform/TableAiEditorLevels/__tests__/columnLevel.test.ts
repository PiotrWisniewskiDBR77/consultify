/**
 * Unit tests for column level handler (Block C · C-S2).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('../../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { proposeColumnEdit } from '../columnLevel.js';
import type { LlmProvider } from '../llmProvider.js';

const TABLE = 'tbl-1';
const FIELD = 'fld-priority';
const ORG = 'org-A';
const WS = 'ws-A';
const ACTOR = 'user-1';

function setupTenantOkRecords(records: Array<{ id: string; data: Record<string, unknown> }>) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('JOIN tp_bases'))
      return { rows: [{ workspace_id: WS, organization_id: ORG }] };
    if (sql.includes('FROM tp_fields'))
      return {
        rows: [{ id: FIELD, name: 'Priority', field_type: 'priority', options: {} }],
      };
    if (sql.includes('FROM tp_records'))
      return {
        rows: records.map((r) => ({ id: r.id, table_id: TABLE, data: r.data })),
      };
    return { rows: [] };
  });
}

function makeProvider(text: string): LlmProvider {
  return {
    generate: async () => ({
      text,
      tokensInput: 100,
      tokensOutput: 50,
      model: 'mock',
      source: 'live',
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('columnLevel.proposeColumnEdit', () => {
  it('1) bulk fill across visible records (one cell per LLM proposal)', async () => {
    setupTenantOkRecords([
      { id: 'r1', data: { 'fld-name': 'A', [FIELD]: null } },
      { id: 'r2', data: { 'fld-name': 'B', [FIELD]: null } },
      { id: 'r3', data: { 'fld-name': 'C', [FIELD]: 'P1' } },
    ]);
    const provider = makeProvider(
      JSON.stringify({
        cells: [
          { recordId: 'r1', after: 'P0' },
          { recordId: 'r2', after: 'P2' },
        ],
        summary: 'Set priorities',
        confidence: 0.6,
      })
    );

    const out = await proposeColumnEdit({
      level: 'column',
      tableId: TABLE,
      prompt: 'Score priority',
      context: { fieldId: FIELD, visibleRecordIds: ['r1', 'r2', 'r3'] },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_column_fill');
    const cells = op.cells as Array<Record<string, unknown>>;
    expect(cells).toHaveLength(2);
    expect(cells[0]!.recordId).toBe('r1');
    expect(cells[0]!.before).toBe(null);
    expect(cells[0]!.after).toBe('P0');
    expect(cells[1]!.recordId).toBe('r2');
    expect(cells[1]!.after).toBe('P2');
  });

  it('2) drops cells targeting records outside visible set (LLM injection defense)', async () => {
    setupTenantOkRecords([{ id: 'r1', data: { [FIELD]: null } }]);
    const provider = makeProvider(
      JSON.stringify({
        cells: [
          { recordId: 'r1', after: 'P0' },
          { recordId: 'r-secret', after: 'leaked' }, // outside visible set
        ],
        confidence: 0.5,
      })
    );

    const out = await proposeColumnEdit({
      level: 'column',
      tableId: TABLE,
      prompt: 'p',
      context: { fieldId: FIELD, visibleRecordIds: ['r1'] },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const cells = (out.operations[0] as Record<string, unknown>).cells as Array<
      Record<string, unknown>
    >;
    expect(cells).toHaveLength(1);
    expect(cells[0]!.recordId).toBe('r1');
  });

  it('3) missing fieldId → empty + warning', async () => {
    const out = await proposeColumnEdit({
      level: 'column',
      tableId: TABLE,
      prompt: 'p',
      context: { visibleRecordIds: ['r1'] },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('column_context_missing_field');
  });

  it('4) empty visibleRecordIds → empty + warning', async () => {
    const out = await proposeColumnEdit({
      level: 'column',
      tableId: TABLE,
      prompt: 'p',
      context: { fieldId: FIELD, visibleRecordIds: [] },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('column_context_no_visible_records');
  });

  it('5) tenant violation', async () => {
    mockQuery.mockImplementation(async () => ({
      rows: [{ workspace_id: 'other', organization_id: 'other' }],
    }));
    const out = await proposeColumnEdit({
      level: 'column',
      tableId: TABLE,
      prompt: 'p',
      context: { fieldId: FIELD, visibleRecordIds: ['r1'] },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('column_tenant_violation');
  });

  it('6) >200 visibleRecordIds is truncated with warning', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `r${i}`);
    setupTenantOkRecords(ids.slice(0, 200).map((id) => ({ id, data: { [FIELD]: null } })));
    const provider = makeProvider(
      JSON.stringify({
        cells: [{ recordId: 'r0', after: 'P0' }],
        confidence: 0.4,
      })
    );

    const out = await proposeColumnEdit({
      level: 'column',
      tableId: TABLE,
      prompt: 'p',
      context: { fieldId: FIELD, visibleRecordIds: ids },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.warnings).toContain('column_visible_records_truncated_to_200');
  });
});
