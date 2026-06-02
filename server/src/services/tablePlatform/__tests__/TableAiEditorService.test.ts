/**
 * Unit tests for TableAiEditorService skeleton (Block C · Sprint C-S1).
 *
 * Focus: orchestration contract — every proposeEdit must
 *   1. consume the budget BEFORE writing the proposal row,
 *   2. dispatch to the level handler,
 *   3. insert one tp_schema_proposals row with status='pending' + level=<L>,
 *   4. write one tp_audit_events row.
 *
 * applyProposal/rejectProposal: status flip + audit row, with idempotent
 * apply and a no-op for already-rejected.
 *
 * Hard-cap path: when AiUsageService throws AiBudgetExhaustedError, NO
 * proposal row may be written (cost-control invariant).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery, mockConsume, mockLogEvent, mockDispatchStub, mockLoggerError } = vi.hoisted(
  () => ({
    mockQuery: vi.fn(),
    mockConsume: vi.fn(),
    mockLogEvent: vi.fn(),
    mockDispatchStub: vi.fn(),
    mockLoggerError: vi.fn(),
  })
);

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));
vi.mock('../AiUsageService.js', async () => {
  const actual =
    await vi.importActual<typeof import('../AiUsageService.js')>('../AiUsageService.js');
  return {
    ...actual,
    default: { consume: (...args: unknown[]) => mockConsume(...args) },
  };
});
vi.mock('../AuditService.js', () => ({
  default: { logEvent: (...args: unknown[]) => mockLogEvent(...args) },
}));
vi.mock('../TableAiEditorLevels/index.js', () => ({
  dispatchLevelStub: (...args: unknown[]) => mockDispatchStub(...args),
}));

import { AiBudgetExhaustedError } from '../AiUsageService.js';
import tableAiEditorService, {
  AI_EDITOR_LEVELS,
  TableAiEditorError,
} from '../TableAiEditorService.js';

const TABLE = 'tbl-1';
const WS = 'ws-A';
const ORG = 'org-A';
const ACTOR = 'user-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockConsume.mockResolvedValue({
    status: 'success',
    tokensUsedToday: 1000,
    budget: 2_000_000,
    softWarn: false,
  });
  mockDispatchStub.mockResolvedValue({
    handlerStatus: 'stub',
    summary: '[stub]',
    operations: [],
    warnings: ['handler_is_stub_c_s1'],
    confidence: 0,
  });
  mockLogEvent.mockResolvedValue(undefined);
  mockQuery.mockResolvedValue({ rows: [] });
});

describe('TableAiEditorService.proposeEdit', () => {
  it('1) happy path: consumes budget, dispatches stub, inserts proposal, audits', async () => {
    const result = await tableAiEditorService.proposeEdit({
      tableId: TABLE,
      level: 'cell',
      prompt: 'Set status to Done for record 42',
      workspaceId: WS,
      organizationId: ORG,
      actorUserId: ACTOR,
      estimatedTokensInput: 500,
      estimatedTokensOutput: 1000,
      model: 'gpt-test',
    });

    expect(result.proposalId).toMatch(/[0-9a-f-]{36}/);
    expect(result.level).toBe('cell');
    expect(result.softWarn).toBe(false);
    expect(result.handlerStatus).toBe('stub');

    expect(mockConsume).toHaveBeenCalledTimes(1);
    expect(mockConsume.mock.calls[0]![0]).toMatchObject({
      workspaceId: WS,
      surface: 'ai_editor',
      level: 'cell',
      tokensInput: 500,
      tokensOutput: 1000,
      model: 'gpt-test',
    });

    expect(mockDispatchStub).toHaveBeenCalledTimes(1);
    expect(mockDispatchStub.mock.calls[0]![0]).toMatchObject({
      level: 'cell',
      tableId: TABLE,
      organizationId: ORG,
    });

    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_schema_proposals')
    );
    expect(insertCall).toBeTruthy();
    const params = insertCall![1] as unknown[];
    // Param order: id, workspace, intent, confidence, summary, ops, warnings, status, created_by, level
    expect(params[1]).toBe(WS);
    expect(params[2]).toBe('Set status to Done for record 42');
    expect(params[7]).toBe('pending');
    expect(params[8]).toBe(ACTOR);
    expect(params[9]).toBe('cell');

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    expect(mockLogEvent.mock.calls[0]![0]).toBe('ai_editor_propose');
  });

  it('2) consume() runs BEFORE proposal insert (cost-control invariant)', async () => {
    let consumeOrder = -1;
    let insertOrder = -1;
    let counter = 0;
    mockConsume.mockImplementation(async () => {
      consumeOrder = counter++;
      return { status: 'success', tokensUsedToday: 0, budget: 1, softWarn: false };
    });
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('INSERT INTO tp_schema_proposals')) {
        insertOrder = counter++;
      }
      return { rows: [] };
    });

    await tableAiEditorService.proposeEdit({
      tableId: TABLE,
      level: 'record',
      prompt: 'p',
      workspaceId: WS,
      organizationId: ORG,
      actorUserId: ACTOR,
      estimatedTokensInput: 1,
      estimatedTokensOutput: 1,
      model: 'gpt-test',
    });

    expect(consumeOrder).toBeLessThan(insertOrder);
  });

  it('3) hard cap: AiBudgetExhaustedError → no proposal row written', async () => {
    mockConsume.mockRejectedValueOnce(new AiBudgetExhaustedError(3600));

    await expect(
      tableAiEditorService.proposeEdit({
        tableId: TABLE,
        level: 'cell',
        prompt: 'too expensive',
        workspaceId: WS,
        organizationId: ORG,
        actorUserId: ACTOR,
        estimatedTokensInput: 9_999_999,
        estimatedTokensOutput: 0,
        model: 'gpt-test',
      })
    ).rejects.toBeInstanceOf(AiBudgetExhaustedError);

    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_schema_proposals')
    );
    expect(insertCall).toBeUndefined();
    expect(mockDispatchStub).not.toHaveBeenCalled();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it('4) propagates softWarn from AiUsageService', async () => {
    mockConsume.mockResolvedValueOnce({
      status: 'soft_warn',
      tokensUsedToday: 700,
      budget: 1000,
      softWarn: true,
    });

    const result = await tableAiEditorService.proposeEdit({
      tableId: TABLE,
      level: 'cell',
      prompt: 'p',
      workspaceId: WS,
      organizationId: ORG,
      actorUserId: ACTOR,
      estimatedTokensInput: 100,
      estimatedTokensOutput: 100,
      model: 'gpt-test',
    });

    expect(result.softWarn).toBe(true);
  });

  it('5) rejects all 8 levels are valid + invalid level rejected', async () => {
    for (const level of AI_EDITOR_LEVELS) {
      mockConsume.mockResolvedValue({
        status: 'success',
        tokensUsedToday: 1,
        budget: 1000,
        softWarn: false,
      });
      const out = await tableAiEditorService.proposeEdit({
        tableId: TABLE,
        level,
        prompt: 'p',
        workspaceId: WS,
        organizationId: ORG,
        actorUserId: ACTOR,
        actorIsSuperAdmin: true, // covers methodological + source admin gate
        estimatedTokensInput: 1,
        estimatedTokensOutput: 1,
        model: 'gpt-test',
      });
      expect(out.level).toBe(level);
    }

    await expect(
      tableAiEditorService.proposeEdit({
        tableId: TABLE,
        // @ts-expect-error -- intentional bad input
        level: 'nonsense',
        prompt: 'p',
        workspaceId: WS,
        organizationId: ORG,
        actorUserId: ACTOR,
        estimatedTokensInput: 1,
        estimatedTokensOutput: 1,
        model: 'gpt-test',
      })
    ).rejects.toBeInstanceOf(TableAiEditorError);
  });

  it('5b) rejects methodological/source levels for non-super-admin', async () => {
    for (const level of ['methodological', 'source'] as const) {
      await expect(
        tableAiEditorService.proposeEdit({
          tableId: TABLE,
          level,
          prompt: 'p',
          workspaceId: WS,
          organizationId: ORG,
          actorUserId: ACTOR,
          actorIsSuperAdmin: false,
          estimatedTokensInput: 1,
          estimatedTokensOutput: 1,
          model: 'gpt-test',
        })
      ).rejects.toMatchObject({ code: 'SUPER_ADMIN_REQUIRED', status: 403 });
    }
    // Budget MUST NOT be consumed when admin gate fails.
    expect(mockConsume).not.toHaveBeenCalled();
  });

  it('6) rejects missing required fields', async () => {
    const base = {
      tableId: TABLE,
      level: 'cell' as const,
      prompt: 'p',
      workspaceId: WS,
      organizationId: ORG,
      actorUserId: ACTOR,
      estimatedTokensInput: 1,
      estimatedTokensOutput: 1,
      model: 'gpt-test',
    };
    await expect(tableAiEditorService.proposeEdit({ ...base, tableId: '' })).rejects.toMatchObject({
      code: 'TABLE_ID_REQUIRED',
    });
    await expect(tableAiEditorService.proposeEdit({ ...base, prompt: '' })).rejects.toMatchObject({
      code: 'PROMPT_REQUIRED',
    });
    await expect(
      tableAiEditorService.proposeEdit({ ...base, workspaceId: '' })
    ).rejects.toMatchObject({ code: 'WORKSPACE_ID_REQUIRED' });
    await expect(
      tableAiEditorService.proposeEdit({ ...base, organizationId: '' })
    ).rejects.toMatchObject({ code: 'ORG_ID_REQUIRED' });
    await expect(
      tableAiEditorService.proposeEdit({ ...base, actorUserId: '' })
    ).rejects.toMatchObject({ code: 'ACTOR_REQUIRED' });
  });
});

describe('TableAiEditorService.applyProposal', () => {
  it('7) applies pending proposal: flips status + audits', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SELECT id, workspace_id, status, level')) {
        return { rows: [{ id: 'p-1', workspace_id: WS, status: 'pending', level: 'cell' }] };
      }
      return { rows: [] };
    });

    const result = await tableAiEditorService.applyProposal({
      proposalId: 'p-1',
      workspaceId: WS,
      actorUserId: ACTOR,
    });

    expect(result.applied).toBe(true);
    expect(result.reason).toBe('stub_handler_no_op');

    const updateCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE tp_schema_proposals')
    );
    expect(updateCall).toBeTruthy();
    expect(mockLogEvent).toHaveBeenCalledWith(
      'ai_editor_apply',
      'tp_schema_proposals',
      'p-1',
      ACTOR,
      { status: 'pending' },
      { status: 'applied' },
      expect.objectContaining({ level: 'cell', handlerStatus: 'stub' })
    );
  });

  it('8) idempotent apply: returns reason=already_applied without throwing', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SELECT id, workspace_id, status, level')) {
        return { rows: [{ id: 'p-1', workspace_id: WS, status: 'applied', level: 'cell' }] };
      }
      return { rows: [] };
    });

    const result = await tableAiEditorService.applyProposal({
      proposalId: 'p-1',
      workspaceId: WS,
      actorUserId: ACTOR,
      idempotent: true,
    });

    expect(result.applied).toBe(true);
    expect(result.reason).toBe('already_applied');
  });

  it('8b) non-idempotent apply on already-applied: throws PROPOSAL_ALREADY_APPLIED', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SELECT id, workspace_id, status, level')) {
        return { rows: [{ id: 'p-1', workspace_id: WS, status: 'applied', level: 'cell' }] };
      }
      return { rows: [] };
    });

    await expect(
      tableAiEditorService.applyProposal({
        proposalId: 'p-1',
        workspaceId: WS,
        actorUserId: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'PROPOSAL_ALREADY_APPLIED' });
  });

  it('9) rejects apply on rejected proposal', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SELECT id, workspace_id, status, level')) {
        return { rows: [{ id: 'p-1', workspace_id: WS, status: 'rejected', level: 'cell' }] };
      }
      return { rows: [] };
    });

    await expect(
      tableAiEditorService.applyProposal({
        proposalId: 'p-1',
        workspaceId: WS,
        actorUserId: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'PROPOSAL_REJECTED' });
  });

  it('10) returns 404 when proposal not in workspace (cross-tenant defense)', async () => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));

    await expect(
      tableAiEditorService.applyProposal({
        proposalId: 'p-1',
        workspaceId: WS,
        actorUserId: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND', status: 404 });
  });
});

describe('TableAiEditorService.rejectProposal', () => {
  it('11) rejects pending proposal: flips status + audits', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SELECT id, workspace_id, status, level')) {
        return { rows: [{ id: 'p-1', workspace_id: WS, status: 'pending', level: 'view' }] };
      }
      return { rows: [] };
    });

    const result = await tableAiEditorService.rejectProposal({
      proposalId: 'p-1',
      workspaceId: WS,
      actorUserId: ACTOR,
      note: 'wrong target record',
    });

    expect(result.rejected).toBe(true);
    expect(mockLogEvent).toHaveBeenCalledWith(
      'ai_editor_reject',
      'tp_schema_proposals',
      'p-1',
      ACTOR,
      { status: 'pending' },
      { status: 'rejected' },
      expect.objectContaining({ note: 'wrong target record', level: 'view' })
    );
  });

  it('12) idempotent reject: already-rejected returns rejected=true', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SELECT id, workspace_id, status, level')) {
        return { rows: [{ id: 'p-1', workspace_id: WS, status: 'rejected', level: 'view' }] };
      }
      return { rows: [] };
    });

    const result = await tableAiEditorService.rejectProposal({
      proposalId: 'p-1',
      workspaceId: WS,
      actorUserId: ACTOR,
    });
    expect(result.rejected).toBe(true);
  });

  it('13) cannot reject already-applied proposal', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (String(sql).includes('SELECT id, workspace_id, status, level')) {
        return { rows: [{ id: 'p-1', workspace_id: WS, status: 'applied', level: 'view' }] };
      }
      return { rows: [] };
    });

    await expect(
      tableAiEditorService.rejectProposal({
        proposalId: 'p-1',
        workspaceId: WS,
        actorUserId: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'PROPOSAL_ALREADY_APPLIED' });
  });
});
