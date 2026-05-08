/**
 * Unit tests for relational level handler (Block C · C-S3).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('../../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { proposeRelationalEdit } from '../relationalLevel.js';
import type { LlmProvider } from '../llmProvider.js';

const TABLE = 'tbl-A';
const TARGET = 'tbl-B';
const ORG = 'org-A';
const WS = 'ws-A';
const ACTOR = 'user-1';

function setupHappy(candidates: Array<{ id: string; name: string }>) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('JOIN tp_bases') && sql.includes('WHERE t.id = $1') && !sql.includes('JOIN tp_tables t2'))
      return { rows: [{ workspace_id: WS, organization_id: ORG }] };
    if (sql.includes('FROM tp_fields'))
      return { rows: [{ id: 'f1', name: 'Name', field_type: 'singleLineText', options: {} }] };
    if (sql.includes('JOIN tp_tables t2') || sql.includes('FROM tp_tables'))
      return { rows: candidates.map((c) => ({ id: c.id, name: c.name })) };
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

describe('relationalLevel.proposeRelationalEdit', () => {
  it('1) happy path: emits op_relation_create with valid target', async () => {
    setupHappy([{ id: TARGET, name: 'Contacts' }]);
    const provider = makeProvider(
      JSON.stringify({
        fromTableId: TABLE,
        toTableId: TARGET,
        fromFieldName: 'Owner',
        bidirectional: false,
        confidence: 0.8,
      })
    );

    const out = await proposeRelationalEdit({
      level: 'relational',
      tableId: TABLE,
      prompt: 'Link owner to Contacts',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_relation_create');
    expect((op.payload as Record<string, unknown>).toTableId).toBe(TARGET);
    expect((op.payload as Record<string, unknown>).fromFieldName).toBe('Owner');
  });

  it('2) drops target outside candidate set (cross-tenant defense)', async () => {
    setupHappy([{ id: TARGET, name: 'Contacts' }]);
    const provider = makeProvider(
      JSON.stringify({
        fromTableId: TABLE,
        toTableId: 'tbl-FOREIGN', // not in candidate set
        fromFieldName: 'X',
        confidence: 0.5,
      })
    );

    const out = await proposeRelationalEdit({
      level: 'relational',
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
    expect(out.warnings).toContain('relational_target_not_in_candidates');
  });

  it('3) self-reference rejected', async () => {
    setupHappy([{ id: TARGET, name: 'Contacts' }]);
    const provider = makeProvider(
      JSON.stringify({
        fromTableId: TABLE,
        toTableId: TABLE, // self
        fromFieldName: 'X',
        confidence: 0.5,
      })
    );
    const out = await proposeRelationalEdit({
      level: 'relational',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });
    expect(out.warnings).toContain('relational_target_not_in_candidates');
  });

  it('4) tenant violation', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN tp_bases'))
        return { rows: [{ workspace_id: 'other', organization_id: 'other' }] };
      return { rows: [] };
    });
    const out = await proposeRelationalEdit({
      level: 'relational',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('relational_tenant_violation');
  });

  it('5) no candidate tables → empty + warning', async () => {
    setupHappy([]);
    const out = await proposeRelationalEdit({
      level: 'relational',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('relational_no_candidates');
  });

  it('6) caller-supplied candidateTargetTableIds is filtered through tenant', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('JOIN tp_bases') && !sql.includes('JOIN tp_tables t2') && !sql.includes('= ANY'))
        return { rows: [{ workspace_id: WS, organization_id: ORG }] };
      if (sql.includes('= ANY'))
        return {
          rows: [{ id: TARGET, name: 'Contacts' }], // foreign-id in input filtered out
        };
      if (sql.includes('FROM tp_fields'))
        return { rows: [{ id: 'f1', name: 'Name', field_type: 'singleLineText', options: {} }] };
      return { rows: [] };
    });
    const provider = makeProvider(
      JSON.stringify({
        fromTableId: TABLE,
        toTableId: TARGET,
        fromFieldName: 'Owner',
        confidence: 0.7,
      })
    );
    const out = await proposeRelationalEdit({
      level: 'relational',
      tableId: TABLE,
      prompt: 'p',
      context: { candidateTargetTableIds: [TARGET, 'tbl-FOREIGN'] },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });
    expect(out.operations).toHaveLength(1);
  });
});
