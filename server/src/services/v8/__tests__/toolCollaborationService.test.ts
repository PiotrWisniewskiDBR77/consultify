import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

import type {
  RegisterAdapterParams,
  RecordReadinessAuditParams,
  SetAIProposalVisibilityParams,
  ToolName,
  CollaborationMode,
  LockType,
} from '../../../types/toolCollaborationAdapter.js';
import {
  ToolCollaborationAdapterSchema,
  ToolReadinessAuditSchema,
  AIProposalVisibilitySchema,
  RegisterAdapterParamsSchema,
  RecordReadinessAuditParamsSchema,
  SetAIProposalVisibilityParamsSchema,
  VALID_PROPOSAL_TRANSITIONS,
  TERMINAL_PROPOSAL_STATES,
  CollaborationReadinessLevelValues,
  CollaborationModeValues,
  LockTypeValues,
  OfflinePolicyValues,
  ToolNameValues,
  AIProposalVisibilityStateValues,
} from '../../../types/toolCollaborationAdapter.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  registerAdapter,
  getAdapter,
  getAllAdapters,
  recordReadinessAudit,
  getReadinessAudit,
  setAIProposalVisibility,
  getAIProposalVisibility,
} from '../toolCollaborationService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const ADAPTER_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const AUDIT_ID = '00000000-0000-4000-8000-bbbbbbbbbbbb';
const PROPOSAL_ID = '00000000-0000-4000-8000-cccccccccccc';

function makeAdapterParams(overrides?: Partial<RegisterAdapterParams>): RegisterAdapterParams {
  return {
    toolName: 'whiteboard',
    resourceType: 'workspace',
    organizationId: ORG_ID,
    readinessLevel: 'partial',
    roomGranularity: 'workspace',
    presenceTypes: ['viewer', 'editor', 'facilitator'],
    cursorStateSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
    supportedLockTypes: ['advisory_object'],
    versioningPolicy: {
      autoSnapshotCadence: '5m',
      snapshotGranularity: 'full_document',
      retentionTier: 'warm',
      compareDiffSupport: true,
      restoreSupport: true,
    },
    offlinePolicy: 'queue_and_merge',
    collaborationMode: 'realtime_coediting',
    ...overrides,
  };
}

function makeAuditParams(overrides?: Partial<RecordReadinessAuditParams>): RecordReadinessAuditParams {
  return {
    toolName: 'whiteboard',
    organizationId: ORG_ID,
    primitiveChecks: [
      { primitive: 'room_binding', currentState: 'partial', targetState: 'platform_integrated', gap: 'Normalize V4 sessions' },
      { primitive: 'presence', currentState: 'partial', targetState: 'complete', gap: 'Add typed presence' },
      { primitive: 'cursor_sharing', currentState: 'missing', targetState: 'complete', gap: 'Implement cursor broadcast' },
    ],
    overallReadiness: 'partial',
    auditedBy: USER_ID,
    ...overrides,
  };
}

function makeProposalParams(overrides?: Partial<SetAIProposalVisibilityParams>): SetAIProposalVisibilityParams {
  return {
    organizationId: ORG_ID,
    toolName: 'whiteboard',
    resourceId: 'ws-001',
    authorId: USER_ID,
    visibility: 'personal_draft',
    proposalPayload: { type: 'clustering', clusters: 3 },
    ...overrides,
  };
}

function makeFakeAdapterRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    adapter_id: ADAPTER_ID,
    tool_name: 'whiteboard',
    resource_type: 'workspace',
    organization_id: ORG_ID,
    readiness_level: 'partial',
    room_granularity: 'workspace',
    presence_types: JSON.stringify(['viewer', 'editor', 'facilitator']),
    cursor_state_schema: JSON.stringify({ type: 'object' }),
    supported_lock_types: JSON.stringify(['advisory_object']),
    versioning_policy: JSON.stringify({
      autoSnapshotCadence: '5m',
      snapshotGranularity: 'full_document',
      retentionTier: 'warm',
      compareDiffSupport: true,
      restoreSupport: true,
    }),
    offline_policy: 'queue_and_merge',
    collaboration_mode: 'realtime_coediting',
    registered_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeAuditRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    audit_id: AUDIT_ID,
    tool_name: 'whiteboard',
    organization_id: ORG_ID,
    primitive_checks: JSON.stringify([
      { primitive: 'room_binding', currentState: 'partial', targetState: 'platform_integrated', gap: 'Normalize' },
    ]),
    overall_readiness: 'partial',
    audited_at: '2026-03-23T10:00:00.000Z',
    audited_by: USER_ID,
    ...overrides,
  };
}

function makeFakeProposalRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    proposal_id: PROPOSAL_ID,
    organization_id: ORG_ID,
    tool_name: 'whiteboard',
    resource_id: 'ws-001',
    author_id: USER_ID,
    visibility: 'personal_draft',
    proposal_payload: JSON.stringify({ type: 'clustering' }),
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

// ------------------------------------------
// A. ADAPTER REGISTRATION — ALL 5 TOOLS
// ------------------------------------------

describe('registerAdapter', () => {
  it('registers Idea Workspace adapter with workspace room granularity', async () => {
    const params = makeAdapterParams({
      toolName: 'idea_workspace',
      resourceType: 'workspace',
      roomGranularity: 'workspace',
      collaborationMode: 'realtime_coediting',
      presenceTypes: ['viewer', 'editor', 'facilitator', 'observer', 'ai_agent'],
      supportedLockTypes: ['advisory_object'],
      offlinePolicy: 'queue_and_merge',
    });

    const result = await registerAdapter(params);

    expect(result.toolName).toBe('idea_workspace');
    expect(result.roomGranularity).toBe('workspace');
    expect(result.collaborationMode).toBe('realtime_coediting');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.adapterId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalled();
  });

  it('registers Whiteboard adapter with facilitation support', async () => {
    const params = makeAdapterParams({
      toolName: 'whiteboard',
      resourceType: 'workspace',
      roomGranularity: 'workspace',
      collaborationMode: 'facilitated_input',
      presenceTypes: ['viewer', 'editor', 'facilitator'],
      supportedLockTypes: ['advisory_object', 'phase_lock'],
    });

    const result = await registerAdapter(params);

    expect(result.toolName).toBe('whiteboard');
    expect(result.collaborationMode).toBe('facilitated_input');
    expect(result.supportedLockTypes).toContain('phase_lock');
  });

  it('registers Mind Map adapter with node-level locking', async () => {
    const params = makeAdapterParams({
      toolName: 'mind_map',
      resourceType: 'workspace',
      roomGranularity: 'canvas',
      collaborationMode: 'controlled_coediting',
      presenceTypes: ['viewer', 'editor'],
      supportedLockTypes: ['advisory_object', 'optimistic_section'],
    });

    const result = await registerAdapter(params);

    expect(result.toolName).toBe('mind_map');
    expect(result.roomGranularity).toBe('canvas');
    expect(result.supportedLockTypes).toContain('optimistic_section');
  });

  it('registers Process Flow adapter with lane-aware collaboration', async () => {
    const params = makeAdapterParams({
      toolName: 'process_flow',
      resourceType: 'workspace',
      roomGranularity: 'canvas',
      collaborationMode: 'controlled_coediting',
      presenceTypes: ['viewer', 'editor'],
      supportedLockTypes: ['advisory_object', 'exclusive_document'],
      offlinePolicy: 'reject_on_reconnect',
    });

    const result = await registerAdapter(params);

    expect(result.toolName).toBe('process_flow');
    expect(result.offlinePolicy).toBe('reject_on_reconnect');
    expect(result.supportedLockTypes).toContain('exclusive_document');
  });

  it('registers Table adapter with per-table room granularity (Decision W4-6)', async () => {
    const params = makeAdapterParams({
      toolName: 'table',
      resourceType: 'table',
      roomGranularity: 'table',
      collaborationMode: 'controlled_coediting',
      presenceTypes: ['viewer', 'editor'],
      supportedLockTypes: ['optimistic_row', 'exclusive_schema'],
      offlinePolicy: 'stale_warning',
    });

    const result = await registerAdapter(params);

    expect(result.toolName).toBe('table');
    expect(result.roomGranularity).toBe('table');
    expect(result.resourceType).toBe('table');
    expect(result.supportedLockTypes).toContain('optimistic_row');
    expect(result.supportedLockTypes).toContain('exclusive_schema');
  });

  it('registers Notebook adapter with block-locking mode (Decision W4-4)', async () => {
    const params = makeAdapterParams({
      toolName: 'notebook',
      resourceType: 'notebook',
      roomGranularity: 'notebook',
      collaborationMode: 'controlled_coediting',
      presenceTypes: ['viewer', 'editor'],
      supportedLockTypes: ['optimistic_section', 'exclusive_document'],
      offlinePolicy: 'queue_and_review',
      versioningPolicy: {
        autoSnapshotCadence: '10m',
        snapshotGranularity: 'block',
        retentionTier: 'warm',
        compareDiffSupport: true,
        restoreSupport: true,
      },
    });

    const result = await registerAdapter(params);

    expect(result.toolName).toBe('notebook');
    expect(result.roomGranularity).toBe('notebook');
    expect(result.collaborationMode).toBe('controlled_coediting');
    expect(result.versioningPolicy.compareDiffSupport).toBe(true);
    expect(result.versioningPolicy.restoreSupport).toBe(true);
  });

  it('upserts adapter when registering same tool+org again', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeAdapterRow());

    const params = makeAdapterParams({ readinessLevel: 'platform_integrated' });
    const result = await registerAdapter(params);

    expect(result.adapterId).toBe(ADAPTER_ID);
    expect(result.readinessLevel).toBe('platform_integrated');
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const updateCall = mockDbRun.mock.calls[0][0] as string;
    expect(updateCall).toContain('UPDATE');
  });

  it('rejects invalid tool name', async () => {
    const params = makeAdapterParams({ toolName: 'invalid_tool' as ToolName });
    await expect(registerAdapter(params)).rejects.toThrow(ZodError);
  });

  it('rejects invalid collaboration mode', async () => {
    const params = makeAdapterParams({ collaborationMode: 'yolo' as CollaborationMode });
    await expect(registerAdapter(params)).rejects.toThrow(ZodError);
  });

  it('rejects empty presenceTypes array', async () => {
    const params = makeAdapterParams({ presenceTypes: [] });
    await expect(registerAdapter(params)).rejects.toThrow(ZodError);
  });

  it('rejects empty supportedLockTypes array', async () => {
    const params = makeAdapterParams({ supportedLockTypes: [] as LockType[] });
    await expect(registerAdapter(params)).rejects.toThrow(ZodError);
  });

  it('rejects invalid lock type', async () => {
    const params = makeAdapterParams({ supportedLockTypes: ['invalid_lock' as LockType] });
    await expect(registerAdapter(params)).rejects.toThrow(ZodError);
  });

  it('rejects missing organizationId', async () => {
    const params = makeAdapterParams({ organizationId: '' });
    await expect(registerAdapter(params)).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// B. ADAPTER RETRIEVAL
// ------------------------------------------

describe('getAdapter', () => {
  it('returns adapter when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeAdapterRow());

    const result = await getAdapter('whiteboard', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe('whiteboard');
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.presenceTypes).toEqual(['viewer', 'editor', 'facilitator']);
  });

  it('returns null when adapter not found', async () => {
    const result = await getAdapter('notebook', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getAdapter('whiteboard', OTHER_ORG_ID);
    expect(result).toBeNull();

    const callArgs = mockDbGet.mock.calls[0];
    expect(callArgs[1]).toContain(OTHER_ORG_ID);
  });
});

describe('getAllAdapters', () => {
  it('returns all adapters for an organization', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeAdapterRow({ tool_name: 'whiteboard' }),
      makeFakeAdapterRow({ tool_name: 'table', adapter_id: 'other-id', room_granularity: 'table' }),
    ]);

    const result = await getAllAdapters(ORG_ID);

    expect(result).toHaveLength(2);
    expect(result[0].toolName).toBe('whiteboard');
    expect(result[1].toolName).toBe('table');
  });

  it('returns empty array when no adapters exist', async () => {
    const result = await getAllAdapters(ORG_ID);
    expect(result).toEqual([]);
  });

  it('enforces org isolation in query', async () => {
    await getAllAdapters(OTHER_ORG_ID);

    const callArgs = mockDbAll.mock.calls[0];
    expect(callArgs[1]).toContain(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// C. READINESS AUDIT
// ------------------------------------------

describe('recordReadinessAudit', () => {
  it('records a readiness audit with primitive checks', async () => {
    const params = makeAuditParams();
    const result = await recordReadinessAudit(params);

    expect(result.toolName).toBe('whiteboard');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.overallReadiness).toBe('partial');
    expect(result.primitiveChecks).toHaveLength(3);
    expect(result.primitiveChecks[0].primitive).toBe('room_binding');
    expect(result.auditedBy).toBe(USER_ID);
    expect(result.auditId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalled();
  });

  it('records audit for Table with scaffold-to-missing readiness', async () => {
    const params = makeAuditParams({
      toolName: 'table',
      overallReadiness: 'scaffold',
      primitiveChecks: [
        { primitive: 'room_binding', currentState: 'missing', targetState: 'platform_integrated', gap: 'No room seam' },
        { primitive: 'presence', currentState: 'missing', targetState: 'complete', gap: 'No presence layer' },
        { primitive: 'locking', currentState: 'missing', targetState: 'complete', gap: 'Cell/row locking needed' },
      ],
    });

    const result = await recordReadinessAudit(params);

    expect(result.toolName).toBe('table');
    expect(result.overallReadiness).toBe('scaffold');
    expect(result.primitiveChecks[2].gap).toBe('Cell/row locking needed');
  });

  it('records audit for Notebook with versioning gap (Decision W4-3)', async () => {
    const params = makeAuditParams({
      toolName: 'notebook',
      overallReadiness: 'scaffold',
      primitiveChecks: [
        { primitive: 'versioning', currentState: 'missing', targetState: 'platform_integrated', gap: 'Operational versioning required per W4-3' },
        { primitive: 'locking', currentState: 'missing', targetState: 'partial', gap: 'Block-locking per W4-4' },
      ],
    });

    const result = await recordReadinessAudit(params);

    expect(result.primitiveChecks[0].gap).toContain('W4-3');
    expect(result.primitiveChecks[1].gap).toContain('W4-4');
  });

  it('rejects audit with empty primitive checks', async () => {
    const params = makeAuditParams({ primitiveChecks: [] });
    await expect(recordReadinessAudit(params)).rejects.toThrow(ZodError);
  });

  it('rejects audit with invalid readiness level', async () => {
    const params = makeAuditParams({ overallReadiness: 'invalid' as any });
    await expect(recordReadinessAudit(params)).rejects.toThrow(ZodError);
  });

  it('rejects audit with missing auditedBy', async () => {
    const params = makeAuditParams({ auditedBy: '' });
    await expect(recordReadinessAudit(params)).rejects.toThrow(ZodError);
  });
});

describe('getReadinessAudit', () => {
  it('returns most recent audit when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeAuditRow());

    const result = await getReadinessAudit('whiteboard', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe('whiteboard');
    expect(result!.auditId).toBe(AUDIT_ID);
  });

  it('returns null when no audit exists', async () => {
    const result = await getReadinessAudit('table', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getReadinessAudit('whiteboard', OTHER_ORG_ID);
    expect(result).toBeNull();

    const callArgs = mockDbGet.mock.calls[0];
    expect(callArgs[1]).toContain(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// D. AI PROPOSAL VISIBILITY LIFECYCLE (Decision W4-7)
// ------------------------------------------

describe('setAIProposalVisibility', () => {
  it('creates a new proposal in personal_draft state', async () => {
    const params = makeProposalParams();
    const result = await setAIProposalVisibility(params);

    expect(result.visibility).toBe('personal_draft');
    expect(result.toolName).toBe('whiteboard');
    expect(result.authorId).toBe(USER_ID);
    expect(result.proposalPayload).toEqual({ type: 'clustering', clusters: 3 });
    expect(result.proposalId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalled();
  });

  it('transitions personal_draft → shared_proposal', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'personal_draft' }));

    const result = await setAIProposalVisibility({
      proposalId: PROPOSAL_ID,
      organizationId: ORG_ID,
      toolName: 'whiteboard',
      resourceId: 'ws-001',
      authorId: USER_ID,
      visibility: 'shared_proposal',
    });

    expect(result.visibility).toBe('shared_proposal');
    expect(result.proposalId).toBe(PROPOSAL_ID);
  });

  it('transitions shared_proposal → team_review', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'shared_proposal' }));

    const result = await setAIProposalVisibility({
      proposalId: PROPOSAL_ID,
      organizationId: ORG_ID,
      toolName: 'whiteboard',
      resourceId: 'ws-001',
      authorId: USER_ID,
      visibility: 'team_review',
    });

    expect(result.visibility).toBe('team_review');
  });

  it('transitions team_review → accepted', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'team_review' }));

    const result = await setAIProposalVisibility({
      proposalId: PROPOSAL_ID,
      organizationId: ORG_ID,
      toolName: 'whiteboard',
      resourceId: 'ws-001',
      authorId: USER_ID,
      visibility: 'accepted',
    });

    expect(result.visibility).toBe('accepted');
  });

  it('transitions team_review → rejected', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'team_review' }));

    const result = await setAIProposalVisibility({
      proposalId: PROPOSAL_ID,
      organizationId: ORG_ID,
      toolName: 'whiteboard',
      resourceId: 'ws-001',
      authorId: USER_ID,
      visibility: 'rejected',
    });

    expect(result.visibility).toBe('rejected');
  });

  it('transitions personal_draft → rejected (early rejection)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'personal_draft' }));

    const result = await setAIProposalVisibility({
      proposalId: PROPOSAL_ID,
      organizationId: ORG_ID,
      toolName: 'whiteboard',
      resourceId: 'ws-001',
      authorId: USER_ID,
      visibility: 'rejected',
    });

    expect(result.visibility).toBe('rejected');
  });

  it('transitions shared_proposal → rejected', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'shared_proposal' }));

    const result = await setAIProposalVisibility({
      proposalId: PROPOSAL_ID,
      organizationId: ORG_ID,
      toolName: 'whiteboard',
      resourceId: 'ws-001',
      authorId: USER_ID,
      visibility: 'rejected',
    });

    expect(result.visibility).toBe('rejected');
  });

  it('rejects invalid transition: personal_draft → team_review (skip)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'personal_draft' }));

    await expect(
      setAIProposalVisibility({
        proposalId: PROPOSAL_ID,
        organizationId: ORG_ID,
        toolName: 'whiteboard',
        resourceId: 'ws-001',
        authorId: USER_ID,
        visibility: 'team_review',
      }),
    ).rejects.toThrow('Invalid proposal visibility transition');
  });

  it('rejects invalid transition: personal_draft → accepted (skip)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'personal_draft' }));

    await expect(
      setAIProposalVisibility({
        proposalId: PROPOSAL_ID,
        organizationId: ORG_ID,
        toolName: 'whiteboard',
        resourceId: 'ws-001',
        authorId: USER_ID,
        visibility: 'accepted',
      }),
    ).rejects.toThrow('Invalid proposal visibility transition');
  });

  it('rejects transition from terminal state: accepted → shared_proposal', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'accepted' }));

    await expect(
      setAIProposalVisibility({
        proposalId: PROPOSAL_ID,
        organizationId: ORG_ID,
        toolName: 'whiteboard',
        resourceId: 'ws-001',
        authorId: USER_ID,
        visibility: 'shared_proposal',
      }),
    ).rejects.toThrow('terminal state');
  });

  it('rejects transition from terminal state: rejected → personal_draft', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow({ visibility: 'rejected' }));

    await expect(
      setAIProposalVisibility({
        proposalId: PROPOSAL_ID,
        organizationId: ORG_ID,
        toolName: 'whiteboard',
        resourceId: 'ws-001',
        authorId: USER_ID,
        visibility: 'personal_draft',
      }),
    ).rejects.toThrow('terminal state');
  });

  it('creates new proposal when proposalId not found in DB', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setAIProposalVisibility({
      proposalId: PROPOSAL_ID,
      organizationId: ORG_ID,
      toolName: 'table',
      resourceId: 'tbl-001',
      authorId: USER_ID,
      visibility: 'personal_draft',
      proposalPayload: { type: 'schema_change' },
    });

    expect(result.proposalId).toBe(PROPOSAL_ID);
    expect(result.toolName).toBe('table');
    expect(result.visibility).toBe('personal_draft');
    const insertCall = mockDbRun.mock.calls[0][0] as string;
    expect(insertCall).toContain('INSERT');
  });

  it('creates proposal for each tool type', async () => {
    const tools: ToolName[] = ['idea_workspace', 'whiteboard', 'mind_map', 'process_flow', 'table', 'notebook'];

    for (const tool of tools) {
      vi.clearAllMocks();
      mockDbRun.mockResolvedValue({ success: true });
      mockDbGet.mockResolvedValue(null);

      const result = await setAIProposalVisibility(
        makeProposalParams({ toolName: tool, resourceId: `res-${tool}` }),
      );

      expect(result.toolName).toBe(tool);
      expect(result.visibility).toBe('personal_draft');
    }
  });
});

describe('getAIProposalVisibility', () => {
  it('returns proposal when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeProposalRow());

    const result = await getAIProposalVisibility(PROPOSAL_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.proposalId).toBe(PROPOSAL_ID);
    expect(result!.visibility).toBe('personal_draft');
  });

  it('returns null when proposal not found', async () => {
    const result = await getAIProposalVisibility('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getAIProposalVisibility(PROPOSAL_ID, OTHER_ORG_ID);
    expect(result).toBeNull();

    const callArgs = mockDbGet.mock.calls[0];
    expect(callArgs[1]).toContain(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// E. COLLABORATION MODE VALIDATION
// ------------------------------------------

describe('collaboration mode validation', () => {
  it.each(CollaborationModeValues)('accepts valid collaboration mode: %s', async (mode) => {
    const params = makeAdapterParams({ collaborationMode: mode });
    const result = await registerAdapter(params);
    expect(result.collaborationMode).toBe(mode);
  });

  it('rejects unknown collaboration mode', async () => {
    const params = makeAdapterParams({ collaborationMode: 'unknown_mode' as CollaborationMode });
    await expect(registerAdapter(params)).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// F. LOCK TYPE VALIDATION
// ------------------------------------------

describe('lock type validation', () => {
  it.each(LockTypeValues)('accepts valid lock type: %s', async (lockType) => {
    const params = makeAdapterParams({ supportedLockTypes: [lockType] });
    const result = await registerAdapter(params);
    expect(result.supportedLockTypes).toContain(lockType);
  });

  it('accepts multiple lock types', async () => {
    const params = makeAdapterParams({
      supportedLockTypes: ['advisory_object', 'optimistic_row', 'exclusive_schema'],
    });
    const result = await registerAdapter(params);
    expect(result.supportedLockTypes).toHaveLength(3);
  });

  it('rejects unknown lock type', async () => {
    const params = makeAdapterParams({ supportedLockTypes: ['unknown_lock' as LockType] });
    await expect(registerAdapter(params)).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// G. ORG ISOLATION
// ------------------------------------------

describe('organization isolation', () => {
  it('adapter registration is org-scoped', async () => {
    const params1 = makeAdapterParams({ organizationId: ORG_ID });
    const params2 = makeAdapterParams({ organizationId: OTHER_ORG_ID });

    const result1 = await registerAdapter(params1);
    const result2 = await registerAdapter(params2);

    expect(result1.organizationId).toBe(ORG_ID);
    expect(result2.organizationId).toBe(OTHER_ORG_ID);
    expect(result1.adapterId).not.toBe(result2.adapterId);
  });

  it('audit recording is org-scoped', async () => {
    const params1 = makeAuditParams({ organizationId: ORG_ID });
    const params2 = makeAuditParams({ organizationId: OTHER_ORG_ID });

    const result1 = await recordReadinessAudit(params1);
    const result2 = await recordReadinessAudit(params2);

    expect(result1.organizationId).toBe(ORG_ID);
    expect(result2.organizationId).toBe(OTHER_ORG_ID);
    expect(result1.auditId).not.toBe(result2.auditId);
  });

  it('proposal creation is org-scoped', async () => {
    const params1 = makeProposalParams({ organizationId: ORG_ID });
    const params2 = makeProposalParams({ organizationId: OTHER_ORG_ID });

    const result1 = await setAIProposalVisibility(params1);
    const result2 = await setAIProposalVisibility(params2);

    expect(result1.organizationId).toBe(ORG_ID);
    expect(result2.organizationId).toBe(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// H. ZOD SCHEMA VALIDATION
// ------------------------------------------

describe('Zod schema validation', () => {
  it('ToolCollaborationAdapterSchema validates a complete adapter', () => {
    const adapter = {
      adapterId: ADAPTER_ID,
      toolName: 'whiteboard',
      resourceType: 'workspace',
      organizationId: ORG_ID,
      readinessLevel: 'partial',
      roomGranularity: 'workspace',
      presenceTypes: ['viewer', 'editor'],
      cursorStateSchema: { type: 'object' },
      supportedLockTypes: ['advisory_object'],
      versioningPolicy: {
        autoSnapshotCadence: '5m',
        snapshotGranularity: 'full_document',
        retentionTier: 'warm',
        compareDiffSupport: true,
        restoreSupport: true,
      },
      offlinePolicy: 'queue_and_merge',
      collaborationMode: 'realtime_coediting',
      registeredAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
    };

    expect(() => ToolCollaborationAdapterSchema.parse(adapter)).not.toThrow();
  });

  it('ToolReadinessAuditSchema validates a complete audit', () => {
    const audit = {
      auditId: AUDIT_ID,
      toolName: 'table',
      organizationId: ORG_ID,
      primitiveChecks: [
        { primitive: 'room_binding', currentState: 'missing', targetState: 'complete', gap: 'Build from scratch' },
      ],
      overallReadiness: 'scaffold',
      auditedAt: '2026-03-23T10:00:00.000Z',
      auditedBy: USER_ID,
    };

    expect(() => ToolReadinessAuditSchema.parse(audit)).not.toThrow();
  });

  it('AIProposalVisibilitySchema validates a complete proposal', () => {
    const proposal = {
      proposalId: PROPOSAL_ID,
      organizationId: ORG_ID,
      toolName: 'notebook',
      resourceId: 'note-001',
      authorId: USER_ID,
      visibility: 'personal_draft',
      proposalPayload: { suggestion: 'restructure' },
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
    };

    expect(() => AIProposalVisibilitySchema.parse(proposal)).not.toThrow();
  });

  it('RegisterAdapterParamsSchema rejects invalid offline policy', () => {
    const params = { ...makeAdapterParams(), offlinePolicy: 'invalid' };
    expect(() => RegisterAdapterParamsSchema.parse(params)).toThrow(ZodError);
  });

  it('RecordReadinessAuditParamsSchema rejects invalid primitive check state', () => {
    const params = {
      ...makeAuditParams(),
      primitiveChecks: [
        { primitive: 'room', currentState: 'invalid_state', targetState: 'complete', gap: 'test' },
      ],
    };
    expect(() => RecordReadinessAuditParamsSchema.parse(params)).toThrow(ZodError);
  });

  it('SetAIProposalVisibilityParamsSchema rejects invalid visibility state', () => {
    const params = { ...makeProposalParams(), visibility: 'invalid_state' };
    expect(() => SetAIProposalVisibilityParamsSchema.parse(params)).toThrow(ZodError);
  });
});

// ------------------------------------------
// I. STATE MACHINE CONSTANTS
// ------------------------------------------

describe('AI proposal state machine constants', () => {
  it('VALID_PROPOSAL_TRANSITIONS covers all states', () => {
    for (const state of AIProposalVisibilityStateValues) {
      expect(VALID_PROPOSAL_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    for (const state of TERMINAL_PROPOSAL_STATES) {
      expect(VALID_PROPOSAL_TRANSITIONS[state]).toHaveLength(0);
    }
  });

  it('personal_draft can transition to shared_proposal and rejected', () => {
    const transitions = VALID_PROPOSAL_TRANSITIONS['personal_draft'];
    expect(transitions).toContain('shared_proposal');
    expect(transitions).toContain('rejected');
    expect(transitions).not.toContain('accepted');
    expect(transitions).not.toContain('team_review');
  });

  it('shared_proposal can transition to team_review and rejected', () => {
    const transitions = VALID_PROPOSAL_TRANSITIONS['shared_proposal'];
    expect(transitions).toContain('team_review');
    expect(transitions).toContain('rejected');
  });

  it('team_review can transition to accepted and rejected', () => {
    const transitions = VALID_PROPOSAL_TRANSITIONS['team_review'];
    expect(transitions).toContain('accepted');
    expect(transitions).toContain('rejected');
  });

  it('TERMINAL_PROPOSAL_STATES contains accepted and rejected', () => {
    expect(TERMINAL_PROPOSAL_STATES.has('accepted')).toBe(true);
    expect(TERMINAL_PROPOSAL_STATES.has('rejected')).toBe(true);
    expect(TERMINAL_PROPOSAL_STATES.has('personal_draft')).toBe(false);
  });
});

// ------------------------------------------
// J. ENUM COMPLETENESS
// ------------------------------------------

describe('enum completeness', () => {
  it('CollaborationReadinessLevelValues has 5 levels', () => {
    expect(CollaborationReadinessLevelValues).toHaveLength(5);
    expect(CollaborationReadinessLevelValues).toContain('missing');
    expect(CollaborationReadinessLevelValues).toContain('complete');
  });

  it('CollaborationModeValues has 5 modes', () => {
    expect(CollaborationModeValues).toHaveLength(5);
  });

  it('LockTypeValues has 7 lock types', () => {
    expect(LockTypeValues).toHaveLength(7);
    expect(LockTypeValues).toContain('none');
    expect(LockTypeValues).toContain('phase_lock');
  });

  it('OfflinePolicyValues has 4 policies', () => {
    expect(OfflinePolicyValues).toHaveLength(4);
  });

  it('ToolNameValues has 6 tool names', () => {
    expect(ToolNameValues).toHaveLength(6);
    expect(ToolNameValues).toContain('idea_workspace');
    expect(ToolNameValues).toContain('whiteboard');
    expect(ToolNameValues).toContain('mind_map');
    expect(ToolNameValues).toContain('process_flow');
    expect(ToolNameValues).toContain('table');
    expect(ToolNameValues).toContain('notebook');
  });

  it('AIProposalVisibilityStateValues has 5 states', () => {
    expect(AIProposalVisibilityStateValues).toHaveLength(5);
  });
});
