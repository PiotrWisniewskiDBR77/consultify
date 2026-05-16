/**
 * Unit tests for view level handler (Block C · C-S3).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock('../../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { proposeViewEdit } from '../viewLevel.js';
import type { LlmProvider } from '../llmProvider.js';

const TABLE = 'tbl-1';
const ORG = 'org-A';
const WS = 'ws-A';
const ACTOR = 'user-1';

function setupTenantOk() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('JOIN tp_bases'))
      return { rows: [{ workspace_id: WS, organization_id: ORG }] };
    if (sql.includes('FROM tp_fields'))
      return {
        rows: [
          { id: 'f-name', name: 'Name', field_type: 'singleLineText', options: {} },
          { id: 'f-status', name: 'Status', field_type: 'singleSelect', options: {} },
        ],
      };
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

describe('viewLevel.proposeViewEdit', () => {
  it('1) create mode: emits op_view_create', async () => {
    setupTenantOk();
    const provider = makeProvider(
      JSON.stringify({
        mode: 'create',
        name: 'Open items',
        viewType: 'grid',
        config: { filter: { conditions: [{ fieldId: 'f-status', op: '=', value: 'open' }] } },
        confidence: 0.85,
      })
    );

    const out = await proposeViewEdit({
      level: 'view',
      tableId: TABLE,
      prompt: 'show only open items',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });

    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_view_create');
    expect((op.payload as Record<string, unknown>).name).toBe('Open items');
    expect((op.payload as Record<string, unknown>).viewType).toBe('grid');
  });

  it('2) update mode requires viewId in context', async () => {
    setupTenantOk();
    const provider = makeProvider(
      JSON.stringify({ mode: 'update', config: { sort: [] }, confidence: 0.7 })
    );
    const out = await proposeViewEdit({
      level: 'view',
      tableId: TABLE,
      prompt: 'p',
      context: {}, // no viewId → must fail with warning
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });
    expect(out.warnings).toContain('view_update_missing_viewId');
    expect(out.operations).toEqual([]);
  });

  it('3) update mode with viewId emits op_view_update', async () => {
    setupTenantOk();
    const provider = makeProvider(
      JSON.stringify({
        mode: 'update',
        config: { hiddenFields: ['f-name'] },
        confidence: 0.9,
      })
    );
    const out = await proposeViewEdit({
      level: 'view',
      tableId: TABLE,
      prompt: 'hide name',
      context: { viewId: 'v-1' },
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });
    expect(out.operations).toHaveLength(1);
    const op = out.operations[0] as Record<string, unknown>;
    expect(op.type).toBe('op_view_update');
    expect((op.target as Record<string, unknown>).viewId).toBe('v-1');
  });

  it('4) tenant violation', async () => {
    mockQuery.mockImplementation(async () => ({
      rows: [{ workspace_id: 'other', organization_id: 'other' }],
    }));
    const out = await proposeViewEdit({
      level: 'view',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: makeProvider('{}'),
    });
    expect(out.warnings).toContain('view_tenant_violation');
  });

  it('5) create without name → empty + warning', async () => {
    setupTenantOk();
    const provider = makeProvider(JSON.stringify({ mode: 'create', viewType: 'grid' }));
    const out = await proposeViewEdit({
      level: 'view',
      tableId: TABLE,
      prompt: 'p',
      context: {},
      organizationId: ORG,
      workspaceId: WS,
      actorUserId: ACTOR,
      actorIsSuperAdmin: false,
      llmProvider: provider,
    });
    expect(out.warnings).toContain('view_create_missing_name');
  });
});
