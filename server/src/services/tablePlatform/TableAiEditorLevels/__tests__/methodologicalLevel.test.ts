/**
 * Unit tests for methodological level handler (Block C · C-S3).
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
import { proposeMethodologicalEdit } from '../methodologicalLevel.js';

const TABLE = 'tbl-1';
const ORG = 'org-A';
const WS = 'ws-A';
const ACTOR = 'admin-1';

function setupTenantOk(records: Array<{ id: string; data: Record<string, unknown> }>) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('JOIN tp_bases'))
      return { rows: [{ workspace_id: WS, organization_id: ORG, governance_rules: null }] };
    if (sql.includes('FROM tp_fields'))
      return {
        rows: [
          { id: 'f-name', name: 'Name', field_type: 'singleLineText', options: {} },
          { id: 'f-impact', name: 'Impact', field_type: 'number', options: {} },
        ],
      };
    if (sql.includes('FROM tp_records WHERE table_id') && sql.includes('LIMIT'))
      return { rows: records.map((r) => ({ id: r.id })) };
    if (sql.includes('FROM tp_records'))
      return { rows: records.map((r) => ({ id: r.id, table_id: TABLE, data: r.data })) };
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

describe('methodologicalLevel.proposeMethodologicalEdit', () => {
  it('1) emits flag operations with severity', async () => {
    setupTenantOk([
      { id: 'r1', data: { 'f-name': 'X', 'f-impact': null } },
      { id: 'r2', data: { 'f-name': 'Y', 'f-impact': 7 } },
    ]);
    const provider = makeProvider(
      JSON.stringify({
        flags: [
          {
            recordId: 'r1',
            fieldId: 'f-impact',
            deviationKind: 'missing_required_field',
            ruleId: 'rule-impact-required',
            message: 'Impact is required',
            severity: 'error',
          },
        ],
        confidence: 0.9,
      })
    );

    const out = await proposeMethodologicalEdit({
      level: 'methodological',
      tableId: TABLE,
      prompt: 'Audit table',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_methodological_flag');
    expect((op.payload as Record<string, unknown>).severity).toBe('error');
    expect((op.payload as Record<string, unknown>).deviationKind).toBe('missing_required_field');
  });

  it('2) drops flags referencing unknown record IDs', async () => {
    setupTenantOk([{ id: 'r1', data: {} }]);
    const provider = makeProvider(
      JSON.stringify({
        flags: [
          { recordId: 'r1', deviationKind: 'rule_violated', message: 'ok', severity: 'warn' },
          {
            recordId: 'r-FAKE',
            deviationKind: 'rule_violated',
            message: 'leak',
            severity: 'warn',
          },
        ],
        confidence: 0.5,
      })
    );

    const out = await proposeMethodologicalEdit({
      level: 'methodological',
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
    expect(out.warnings.some((w) => w.startsWith('methodological_unknown_record_id'))).toBe(true);
  });

  it('3) accepts caller-supplied governanceRules', async () => {
    setupTenantOk([{ id: 'r1', data: {} }]);
    const provider = makeProvider(
      JSON.stringify({
        flags: [
          {
            recordId: 'r1',
            deviationKind: 'schema_mismatch',
            message: 'mismatch',
            severity: 'info',
          },
        ],
        confidence: 0.6,
      })
    );

    const out = await proposeMethodologicalEdit({
      level: 'methodological',
      tableId: TABLE,
      prompt: 'p',
      context: { governanceRules: { audience: ['analyst'], min_records_for_publish: 5 } },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
  });

  it('4) tenant violation', async () => {
    mockQuery.mockImplementation(async () => ({
      rows: [{ workspace_id: 'other', organization_id: 'other' }],
    }));
    const out = await proposeMethodologicalEdit({
      level: 'methodological',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('methodological_tenant_violation');
  });

  it('5) zero flags from LLM is a valid outcome (clean audit)', async () => {
    setupTenantOk([{ id: 'r1', data: {} }]);
    const provider = makeProvider(JSON.stringify({ flags: [], confidence: 0.95 }));
    const out = await proposeMethodologicalEdit({
      level: 'methodological',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: true,
      llmProvider: provider,
    });
    expect(out.operations).toEqual([]);
    expect(out.confidence).toBeCloseTo(0.95, 2);
  });
});
