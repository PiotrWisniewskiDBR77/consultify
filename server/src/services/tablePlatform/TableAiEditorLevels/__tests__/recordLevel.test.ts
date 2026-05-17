/**
 * Unit tests for record level handler (Block C · C-S2).
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
import { proposeRecordEdit } from '../recordLevel.js';

const TABLE = '00000000-0000-0000-0000-000000000010';
const RECORD = '00000000-0000-0000-0000-000000000020';
const ORG = 'org-A';
const WS = 'ws-A';
const ACTOR = 'user-1';

function setupTenantOkWithRecord(recordData: Record<string, unknown>) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('JOIN tp_bases'))
      return { rows: [{ workspace_id: WS, organization_id: ORG }] };
    if (sql.includes('FROM tp_fields'))
      return {
        rows: [
          { id: 'fld-name', name: 'Name', field_type: 'singleLineText', options: {} },
          { id: 'fld-status', name: 'Status', field_type: 'singleSelect', options: {} },
          { id: 'fld-impact', name: 'Impact', field_type: 'number', options: {} },
        ],
      };
    if (sql.includes('FROM tp_records'))
      return { rows: [{ id: RECORD, table_id: TABLE, data: recordData }] };
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

describe('recordLevel.proposeRecordEdit', () => {
  it('1) auto-detects empty fields and proposes fills', async () => {
    setupTenantOkWithRecord({ 'fld-name': 'Risk A', 'fld-status': null, 'fld-impact': null });
    const provider = makeProvider(
      JSON.stringify({
        fieldChanges: [
          { fieldId: 'fld-status', after: 'open' },
          { fieldId: 'fld-impact', after: 7 },
        ],
        summary: 'Filled status + impact',
        confidence: 0.7,
      })
    );

    const out = await proposeRecordEdit({
      level: 'record',
      tableId: TABLE,
      prompt: 'Fill missing fields',
      context: { recordId: RECORD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_record_update');
    const changes = op.fieldChanges as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(2);
    expect(changes[0]!.fieldId).toBe('fld-status');
    expect(changes[0]!.before).toBe(null);
    expect(changes[0]!.after).toBe('open');
    expect(changes[1]!.fieldId).toBe('fld-impact');
    expect(changes[1]!.after).toBe(7);
    expect(out.confidence).toBeCloseTo(0.7, 2);
  });

  it('2) drops field changes outside the candidate set (LLM hallucinates a field)', async () => {
    setupTenantOkWithRecord({ 'fld-name': 'X', 'fld-status': null, 'fld-impact': null });
    const provider = makeProvider(
      JSON.stringify({
        fieldChanges: [
          { fieldId: 'fld-status', after: 'open' },
          { fieldId: 'fld-NONEXISTENT', after: 'something' },
          { fieldId: 'fld-name', after: 'New Name' }, // not in candidates (already filled)
        ],
        confidence: 0.5,
      })
    );

    const out = await proposeRecordEdit({
      level: 'record',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    const changes = op.fieldChanges as Array<Record<string, unknown>>;
    expect(changes).toHaveLength(1);
    expect(changes[0]!.fieldId).toBe('fld-status');
  });

  it('3) explicit targetFields overrides auto-detection', async () => {
    setupTenantOkWithRecord({ 'fld-name': 'X', 'fld-status': 'open', 'fld-impact': 5 });
    const provider = makeProvider(
      JSON.stringify({
        fieldChanges: [{ fieldId: 'fld-status', after: 'closed' }],
        confidence: 0.9,
      })
    );

    const out = await proposeRecordEdit({
      level: 'record',
      tableId: TABLE,
      prompt: 'Override status',
      context: { recordId: RECORD, targetFields: ['fld-status'] },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    const changes = op.fieldChanges as Array<Record<string, unknown>>;
    expect(changes[0]!.before).toBe('open');
    expect(changes[0]!.after).toBe('closed');
  });

  it('4) tenant violation', async () => {
    mockQuery.mockImplementation(async () => ({
      rows: [{ workspace_id: 'other', organization_id: 'other' }],
    }));
    const out = await proposeRecordEdit({
      level: 'record',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('record_tenant_violation');
    expect(out.operations).toEqual([]);
  });

  it('5) no candidate fields → empty + warning', async () => {
    setupTenantOkWithRecord({ 'fld-name': 'X', 'fld-status': 'open', 'fld-impact': 5 });
    const out = await proposeRecordEdit({
      level: 'record',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{"fieldChanges":[]}'),
    });
    expect(out.warnings).toContain('record_no_candidate_fields');
    expect(out.operations).toEqual([]);
  });

  it('6) record not found', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN tp_bases'))
        return { rows: [{ workspace_id: WS, organization_id: ORG }] };
      if (sql.includes('FROM tp_fields'))
        return {
          rows: [{ id: 'fld-1', name: 'F', field_type: 'singleLineText', options: {} }],
        };
      if (sql.includes('FROM tp_records')) return { rows: [] };
      return { rows: [] };
    });
    const out = await proposeRecordEdit({
      level: 'record',
      tableId: TABLE,
      prompt: 'p',
      context: { recordId: RECORD },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('record_not_found');
  });
});
