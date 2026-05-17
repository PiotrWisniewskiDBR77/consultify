/**
 * Unit tests for structure level handler (Block C · C-S2).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('../../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { LlmProvider } from '../llmProvider.js';
import { proposeStructureEdit } from '../structureLevel.js';

const TABLE = 'tbl-1';
const ORG = 'org-A';
const WS = 'ws-A';
const ACTOR = 'user-1';

function setupTenantOkSchema(fields: Array<{ id: string; name: string; field_type: string }>) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('JOIN tp_bases'))
      return { rows: [{ workspace_id: WS, organization_id: ORG }] };
    if (sql.includes('FROM tp_fields')) return { rows: fields.map((f) => ({ ...f, options: {} })) };
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

describe('structureLevel.proposeStructureEdit', () => {
  it('1) ADD field: produces op_schema_add_field', async () => {
    setupTenantOkSchema([{ id: 'f1', name: 'Name', field_type: 'singleLineText' }]);
    const provider = makeProvider(
      JSON.stringify({
        operations: [
          {
            type: 'op_schema_add_field',
            id: 'op_1',
            name: 'Owner',
            fieldType: 'singleLineText',
          },
        ],
        summary: 'Add Owner',
        confidence: 0.9,
      })
    );

    const out = await proposeStructureEdit({
      level: 'structure',
      tableId: TABLE,
      prompt: 'Add an Owner column',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_schema_add_field');
    expect((op.payload as Record<string, unknown>).name).toBe('Owner');
    expect((op.payload as Record<string, unknown>).fieldType).toBe('singleLineText');
  });

  it('2) RENAME field: validates fieldId is known', async () => {
    setupTenantOkSchema([{ id: 'f1', name: 'Name', field_type: 'singleLineText' }]);
    const provider = makeProvider(
      JSON.stringify({
        operations: [
          {
            type: 'op_schema_rename_field',
            id: 'op_1',
            fieldId: 'f1',
            from: 'Name',
            to: 'Title',
          },
        ],
        confidence: 0.9,
      })
    );

    const out = await proposeStructureEdit({
      level: 'structure',
      tableId: TABLE,
      prompt: 'Rename Name to Title',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_schema_rename_field');
  });

  it('3) RENAME with unknown fieldId is dropped + warning', async () => {
    setupTenantOkSchema([{ id: 'f1', name: 'Name', field_type: 'singleLineText' }]);
    const provider = makeProvider(
      JSON.stringify({
        operations: [
          {
            type: 'op_schema_rename_field',
            id: 'op_1',
            fieldId: 'f-FAKE',
            from: 'X',
            to: 'Y',
          },
        ],
        confidence: 0.9,
      })
    );

    const out = await proposeStructureEdit({
      level: 'structure',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toEqual([]);
    expect(out.warnings.some((w) => w.startsWith('structure_unknown_field_id:'))).toBe(true);
  });

  it('4) RETYPE flags data risk warning', async () => {
    setupTenantOkSchema([{ id: 'f1', name: 'Status', field_type: 'singleLineText' }]);
    const provider = makeProvider(
      JSON.stringify({
        operations: [
          {
            type: 'op_schema_retype_field',
            id: 'op_1',
            fieldId: 'f1',
            fromType: 'singleLineText',
            toType: 'singleSelect',
          },
        ],
        warnings: ['LLM-warning'],
        confidence: 0.5,
      })
    );

    const out = await proposeStructureEdit({
      level: 'structure',
      tableId: TABLE,
      prompt: 'Convert status to select',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    expect(out.warnings).toContain('structure_retype_data_risk');
    expect(out.warnings).toContain('LLM-warning');
  });

  it('5) DROP flags data loss warning', async () => {
    setupTenantOkSchema([{ id: 'f1', name: 'Old', field_type: 'singleLineText' }]);
    const provider = makeProvider(
      JSON.stringify({
        operations: [{ type: 'op_schema_drop_field', id: 'op_1', fieldId: 'f1' }],
        confidence: 0.6,
      })
    );

    const out = await proposeStructureEdit({
      level: 'structure',
      tableId: TABLE,
      prompt: 'Drop old field',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    expect(out.warnings).toContain('structure_drop_data_loss_risk');
  });

  it('6) tenant violation', async () => {
    mockQuery.mockImplementation(async () => ({
      rows: [{ workspace_id: 'other', organization_id: 'other' }],
    }));
    const out = await proposeStructureEdit({
      level: 'structure',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('structure_tenant_violation');
    expect(out.operations).toEqual([]);
  });

  it('7) malformed LLM payload yields zero operations gracefully', async () => {
    setupTenantOkSchema([{ id: 'f1', name: 'Name', field_type: 'singleLineText' }]);
    const out = await proposeStructureEdit({
      level: 'structure',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('not-json'),
    });
    expect(out.operations).toEqual([]);
  });
});
