import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateActionGovernanceParams,
  CreateBridgingContractParams,
  CreateSessionGovernanceParams,
  RegisterAdminSurfaceParams,
  RegisterToolParams,
} from '../../../types/toolsOrgAdminHardening.js';
import {
  AdminSurfaceOwnershipSchema,
  BridgingStatusValues,
  CatalogVisibilityValues,
  CreateActionGovernanceParamsSchema,
  CreateBridgingContractParamsSchema,
  CreateSessionGovernanceParamsSchema,
  GateDecisionValues,
  OwnerLayerValues,
  RegisterAdminSurfaceParamsSchema,
  RegisterToolParamsSchema,
  SessionModeValues,
  SharedToolsRegistryEntrySchema,
  ToolActionGovernanceSchema,
  ToolFamilyValues,
  ToolSessionGovernanceSchema,
  ToolsV8BridgingContractSchema,
} from '../../../types/toolsOrgAdminHardening.js';

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
  createActionGovernance,
  createBridgingContract,
  createSessionGovernance,
  getActionsBySession,
  getAdminSurfaces,
  getBridgingContract,
  getTool,
  getToolsByFamily,
  registerAdminSurface,
  registerTool,
} from '../toolsOrgAdminService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const TOOL_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const SESSION_ID = '00000000-0000-4000-8000-bbbbbbbbbbbb';

function makeRegisterParams(overrides?: Partial<RegisterToolParams>): RegisterToolParams {
  return {
    organizationId: ORG_ID,
    toolName: 'Dynamic SWOT',
    toolFamily: 'consulting_framework',
    ...overrides,
  };
}

function makeSessionParams(
  overrides?: Partial<CreateSessionGovernanceParams>
): CreateSessionGovernanceParams {
  return {
    toolId: TOOL_ID,
    userId: USER_ID,
    organizationId: ORG_ID,
    sessionMode: 'guided',
    permissionScope: 'tool:swot:read_write',
    contextBoundary: 'initiative:proj-123',
    ...overrides,
  };
}

function makeActionParams(
  overrides?: Partial<CreateActionGovernanceParams>
): CreateActionGovernanceParams {
  return {
    sessionId: SESSION_ID,
    organizationId: ORG_ID,
    actionType: 'ai_draft_summary',
    gateDecision: 'propose',
    ...overrides,
  };
}

function makeAdminSurfaceParams(
  overrides?: Partial<RegisterAdminSurfaceParams>
): RegisterAdminSurfaceParams {
  return {
    surfaceName: 'AI Governance Settings',
    organizationId: ORG_ID,
    ownerLayer: 'organization_settings',
    ...overrides,
  };
}

function makeBridgingParams(
  overrides?: Partial<CreateBridgingContractParams>
): CreateBridgingContractParams {
  return {
    toolId: TOOL_ID,
    organizationId: ORG_ID,
    v3ToolContractRef: 'CONSULTING_TOOLS_V3:dynamic_swot',
    v8PlatformRequirements: ['context_snapshot', 'governed_retrieval', 'prompt_os'],
    ...overrides,
  };
}

function makeRegistryRow(overrides?: Record<string, unknown>) {
  return {
    tool_id: TOOL_ID,
    organization_id: ORG_ID,
    tool_name: 'Dynamic SWOT',
    tool_family: 'consulting_framework',
    tool_subtype: null,
    is_classic_framework_template: 0,
    knowledge_bank_ref: null,
    catalog_visibility: 'published',
    created_at: '2026-03-23T00:00:00.000Z',
    updated_at: '2026-03-23T00:00:00.000Z',
    ...overrides,
  };
}

function makeSessionRow(overrides?: Record<string, unknown>) {
  return {
    session_id: SESSION_ID,
    tool_id: TOOL_ID,
    user_id: USER_ID,
    organization_id: ORG_ID,
    session_mode: 'guided',
    permission_scope: 'tool:swot:read_write',
    context_boundary: 'initiative:proj-123',
    ai_enabled: 1,
    created_at: '2026-03-23T00:00:00.000Z',
    updated_at: '2026-03-23T00:00:00.000Z',
    ...overrides,
  };
}

function makeActionRow(overrides?: Record<string, unknown>) {
  return {
    action_id: '00000000-0000-4000-8000-cccccccccccc',
    session_id: SESSION_ID,
    organization_id: ORG_ID,
    action_type: 'ai_draft_summary',
    gate_decision: 'propose',
    gate_reason: null,
    created_at: '2026-03-23T00:00:00.000Z',
    ...overrides,
  };
}

function makeAdminSurfaceRow(overrides?: Record<string, unknown>) {
  return {
    surface_id: '00000000-0000-4000-8000-dddddddddddd',
    surface_name: 'AI Governance Settings',
    organization_id: ORG_ID,
    owner_layer: 'organization_settings',
    module_name: null,
    horizontal_layer_ref: null,
    created_at: '2026-03-23T00:00:00.000Z',
    updated_at: '2026-03-23T00:00:00.000Z',
    ...overrides,
  };
}

function makeBridgingRow(overrides?: Record<string, unknown>) {
  return {
    contract_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    tool_id: TOOL_ID,
    organization_id: ORG_ID,
    v3_tool_contract_ref: 'CONSULTING_TOOLS_V3:dynamic_swot',
    v8_platform_requirements: JSON.stringify(['context_snapshot', 'governed_retrieval']),
    v8_ai_governance_ref: null,
    v8_session_knowledge_rules: null,
    bridging_status: 'draft',
    created_at: '2026-03-23T00:00:00.000Z',
    updated_at: '2026-03-23T00:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// SETUP
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

// ==========================================
// SECTION 1: ZOD SCHEMA VALIDATION
// ==========================================

describe('Zod schemas — type family validation', () => {
  it('validates SharedToolsRegistryEntry with all fields', () => {
    const data = {
      toolId: TOOL_ID,
      organizationId: ORG_ID,
      toolName: 'Dynamic SWOT',
      toolFamily: 'consulting_framework',
      toolSubtype: null,
      isClassicFrameworkTemplate: false,
      knowledgeBankRef: null,
      catalogVisibility: 'published',
      createdAt: '2026-03-23T00:00:00Z',
      updatedAt: '2026-03-23T00:00:00Z',
    };
    expect(() => SharedToolsRegistryEntrySchema.parse(data)).not.toThrow();
  });

  it('rejects SharedToolsRegistryEntry with invalid toolFamily', () => {
    const data = {
      toolId: TOOL_ID,
      organizationId: ORG_ID,
      toolName: 'Test',
      toolFamily: 'invalid_family',
      toolSubtype: null,
      isClassicFrameworkTemplate: false,
      knowledgeBankRef: null,
      catalogVisibility: 'published',
      createdAt: '2026-03-23T00:00:00Z',
      updatedAt: '2026-03-23T00:00:00Z',
    };
    expect(() => SharedToolsRegistryEntrySchema.parse(data)).toThrow(ZodError);
  });

  it('validates ToolSessionGovernance with all session modes', () => {
    for (const mode of SessionModeValues) {
      const data = {
        sessionId: SESSION_ID,
        toolId: TOOL_ID,
        userId: USER_ID,
        organizationId: ORG_ID,
        sessionMode: mode,
        permissionScope: 'scope',
        contextBoundary: 'boundary',
        aiEnabled: true,
        createdAt: '2026-03-23T00:00:00Z',
        updatedAt: '2026-03-23T00:00:00Z',
      };
      expect(() => ToolSessionGovernanceSchema.parse(data)).not.toThrow();
    }
  });

  it('validates ToolActionGovernance with all gate decisions', () => {
    for (const decision of GateDecisionValues) {
      const data = {
        actionId: TOOL_ID,
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        actionType: 'test_action',
        gateDecision: decision,
        gateReason: null,
        createdAt: '2026-03-23T00:00:00Z',
      };
      expect(() => ToolActionGovernanceSchema.parse(data)).not.toThrow();
    }
  });

  it('validates AdminSurfaceOwnership with all owner layers', () => {
    for (const layer of OwnerLayerValues) {
      const data = {
        surfaceId: TOOL_ID,
        surfaceName: 'Test Surface',
        organizationId: ORG_ID,
        ownerLayer: layer,
        moduleName: layer === 'module_embedded' ? 'tools' : null,
        horizontalLayerRef: null,
        createdAt: '2026-03-23T00:00:00Z',
        updatedAt: '2026-03-23T00:00:00Z',
      };
      expect(() => AdminSurfaceOwnershipSchema.parse(data)).not.toThrow();
    }
  });

  it('validates ToolsV8BridgingContract with all statuses', () => {
    for (const status of BridgingStatusValues) {
      const data = {
        contractId: TOOL_ID,
        toolId: TOOL_ID,
        organizationId: ORG_ID,
        v3ToolContractRef: 'ref',
        v8PlatformRequirements: ['req1'],
        v8AIGovernanceRef: null,
        v8SessionKnowledgeRules: null,
        bridgingStatus: status,
        createdAt: '2026-03-23T00:00:00Z',
        updatedAt: '2026-03-23T00:00:00Z',
      };
      expect(() => ToolsV8BridgingContractSchema.parse(data)).not.toThrow();
    }
  });

  it('rejects ToolActionGovernance with invalid gateDecision', () => {
    const data = {
      actionId: TOOL_ID,
      sessionId: SESSION_ID,
      organizationId: ORG_ID,
      actionType: 'test',
      gateDecision: 'invalid_gate',
      gateReason: null,
      createdAt: '2026-03-23T00:00:00Z',
    };
    expect(() => ToolActionGovernanceSchema.parse(data)).toThrow(ZodError);
  });

  it('rejects AdminSurfaceOwnership with invalid ownerLayer', () => {
    const data = {
      surfaceId: TOOL_ID,
      surfaceName: 'Test',
      organizationId: ORG_ID,
      ownerLayer: 'nonexistent_layer',
      moduleName: null,
      horizontalLayerRef: null,
      createdAt: '2026-03-23T00:00:00Z',
      updatedAt: '2026-03-23T00:00:00Z',
    };
    expect(() => AdminSurfaceOwnershipSchema.parse(data)).toThrow(ZodError);
  });

  it('rejects BridgingContract with empty v8PlatformRequirements via input schema', () => {
    const data = {
      toolId: TOOL_ID,
      organizationId: ORG_ID,
      v3ToolContractRef: 'ref',
      v8PlatformRequirements: [],
    };
    expect(() => CreateBridgingContractParamsSchema.parse(data)).toThrow(ZodError);
  });
});

// ==========================================
// SECTION 2: INPUT SCHEMA VALIDATION
// ==========================================

describe('Input schemas — param validation', () => {
  it('RegisterToolParams defaults catalogVisibility to draft', () => {
    const result = RegisterToolParamsSchema.parse({
      organizationId: ORG_ID,
      toolName: 'Test',
      toolFamily: 'assessment',
    });
    expect(result.catalogVisibility).toBe('draft');
    expect(result.isClassicFrameworkTemplate).toBe(false);
    expect(result.toolSubtype).toBeNull();
  });

  it('RegisterToolParams rejects empty toolName', () => {
    expect(() =>
      RegisterToolParamsSchema.parse({
        organizationId: ORG_ID,
        toolName: '',
        toolFamily: 'assessment',
      })
    ).toThrow(ZodError);
  });

  it('CreateSessionGovernanceParams defaults aiEnabled to true', () => {
    const result = CreateSessionGovernanceParamsSchema.parse({
      toolId: TOOL_ID,
      userId: USER_ID,
      organizationId: ORG_ID,
      sessionMode: 'expert',
      permissionScope: 'scope',
      contextBoundary: 'boundary',
    });
    expect(result.aiEnabled).toBe(true);
  });

  it('CreateActionGovernanceParams defaults gateReason to null', () => {
    const result = CreateActionGovernanceParamsSchema.parse({
      sessionId: SESSION_ID,
      organizationId: ORG_ID,
      actionType: 'test',
      gateDecision: 'execute',
    });
    expect(result.gateReason).toBeNull();
  });

  it('RegisterAdminSurfaceParams defaults moduleName and horizontalLayerRef to null', () => {
    const result = RegisterAdminSurfaceParamsSchema.parse({
      surfaceName: 'Test',
      organizationId: ORG_ID,
      ownerLayer: 'superadmin',
    });
    expect(result.moduleName).toBeNull();
    expect(result.horizontalLayerRef).toBeNull();
  });

  it('CreateBridgingContractParams defaults bridgingStatus to draft', () => {
    const result = CreateBridgingContractParamsSchema.parse({
      toolId: TOOL_ID,
      organizationId: ORG_ID,
      v3ToolContractRef: 'ref',
      v8PlatformRequirements: ['req1'],
    });
    expect(result.bridgingStatus).toBe('draft');
    expect(result.v8AIGovernanceRef).toBeNull();
    expect(result.v8SessionKnowledgeRules).toBeNull();
  });
});

// ==========================================
// SECTION 3: SHARED TOOLS REGISTRY (W7-5)
// ==========================================

describe('Shared Tools Registry — W7-5', () => {
  it('registerTool creates entry with UUID and timestamps', async () => {
    const result = await registerTool(makeRegisterParams());

    expect(result.toolId).toBeDefined();
    expect(result.toolId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.toolName).toBe('Dynamic SWOT');
    expect(result.toolFamily).toBe('consulting_framework');
    expect(result.catalogVisibility).toBe('draft');
    expect(result.isClassicFrameworkTemplate).toBe(false);
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('registerTool stores consulting_framework family correctly', async () => {
    const result = await registerTool(makeRegisterParams({ toolFamily: 'consulting_framework' }));
    expect(result.toolFamily).toBe('consulting_framework');
  });

  it('registerTool stores assessment family correctly', async () => {
    const result = await registerTool(makeRegisterParams({ toolFamily: 'assessment' }));
    expect(result.toolFamily).toBe('assessment');
  });

  it('registerTool stores diagnostic family correctly', async () => {
    const result = await registerTool(makeRegisterParams({ toolFamily: 'diagnostic' }));
    expect(result.toolFamily).toBe('diagnostic');
  });

  it('registerTool stores workshop family correctly', async () => {
    const result = await registerTool(makeRegisterParams({ toolFamily: 'workshop' }));
    expect(result.toolFamily).toBe('workshop');
  });

  it('registerTool stores custom family correctly', async () => {
    const result = await registerTool(makeRegisterParams({ toolFamily: 'custom' }));
    expect(result.toolFamily).toBe('custom');
  });

  it('registerTool marks classic framework template', async () => {
    const result = await registerTool(
      makeRegisterParams({
        isClassicFrameworkTemplate: true,
        toolSubtype: 'porter_five_forces',
      })
    );
    expect(result.isClassicFrameworkTemplate).toBe(true);
    expect(result.toolSubtype).toBe('porter_five_forces');
  });

  it('registerTool stores knowledgeBankRef when provided', async () => {
    const result = await registerTool(makeRegisterParams({ knowledgeBankRef: 'kb:swot-pack-v2' }));
    expect(result.knowledgeBankRef).toBe('kb:swot-pack-v2');
  });

  it('registerTool supports published visibility', async () => {
    const result = await registerTool(makeRegisterParams({ catalogVisibility: 'published' }));
    expect(result.catalogVisibility).toBe('published');
  });

  it('registerTool supports internal_only visibility', async () => {
    const result = await registerTool(makeRegisterParams({ catalogVisibility: 'internal_only' }));
    expect(result.catalogVisibility).toBe('internal_only');
  });

  it('registerTool rejects invalid family via Zod', async () => {
    await expect(
      registerTool(makeRegisterParams({ toolFamily: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('getTool returns entry when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeRegistryRow());

    const result = await getTool(TOOL_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.toolId).toBe(TOOL_ID);
    expect(result!.toolFamily).toBe('consulting_framework');
    expect(result!.isClassicFrameworkTemplate).toBe(false);
  });

  it('getTool returns null when not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getTool(TOOL_ID, ORG_ID);
    expect(result).toBeNull();
  });

  it('getTool enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getTool(TOOL_ID, OTHER_ORG_ID);
    expect(result).toBeNull();

    const callArgs = mockDbGet.mock.calls[0];
    expect(callArgs[1]).toContain(OTHER_ORG_ID);
  });

  it('getToolsByFamily returns matching entries', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeRegistryRow({ tool_id: 'a1a1a1a1-0000-4000-8000-000000000001', tool_name: 'SWOT' }),
      makeRegistryRow({ tool_id: 'a1a1a1a1-0000-4000-8000-000000000002', tool_name: 'Porter' }),
    ]);

    const results = await getToolsByFamily('consulting_framework', ORG_ID);
    expect(results).toHaveLength(2);
    expect(results[0].toolFamily).toBe('consulting_framework');
  });

  it('getToolsByFamily returns empty for no matches', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const results = await getToolsByFamily('workshop', ORG_ID);
    expect(results).toHaveLength(0);
  });

  it('getToolsByFamily enforces org isolation', async () => {
    await getToolsByFamily('assessment', OTHER_ORG_ID);

    const callArgs = mockDbAll.mock.calls[0];
    expect(callArgs[1]).toContain(OTHER_ORG_ID);
  });
});

// ==========================================
// SECTION 4: SESSION GOVERNANCE (W7-6)
// ==========================================

describe('Session Governance — W7-6', () => {
  it('createSessionGovernance creates session with guided mode', async () => {
    const result = await createSessionGovernance(makeSessionParams({ sessionMode: 'guided' }));

    expect(result.sessionId).toBeDefined();
    expect(result.sessionMode).toBe('guided');
    expect(result.aiEnabled).toBe(true);
    expect(result.permissionScope).toBe('tool:swot:read_write');
    expect(result.contextBoundary).toBe('initiative:proj-123');
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('createSessionGovernance creates session with expert mode', async () => {
    const result = await createSessionGovernance(makeSessionParams({ sessionMode: 'expert' }));
    expect(result.sessionMode).toBe('expert');
  });

  it('createSessionGovernance creates session with ai_assisted mode', async () => {
    const result = await createSessionGovernance(makeSessionParams({ sessionMode: 'ai_assisted' }));
    expect(result.sessionMode).toBe('ai_assisted');
  });

  it('createSessionGovernance respects aiEnabled=false', async () => {
    const result = await createSessionGovernance(makeSessionParams({ aiEnabled: false }));
    expect(result.aiEnabled).toBe(false);
  });

  it('createSessionGovernance binds to correct tool and user', async () => {
    const result = await createSessionGovernance(makeSessionParams());
    expect(result.toolId).toBe(TOOL_ID);
    expect(result.userId).toBe(USER_ID);
    expect(result.organizationId).toBe(ORG_ID);
  });

  it('createSessionGovernance rejects invalid sessionMode via Zod', async () => {
    await expect(
      createSessionGovernance(makeSessionParams({ sessionMode: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('createSessionGovernance rejects empty permissionScope', async () => {
    await expect(
      createSessionGovernance(makeSessionParams({ permissionScope: '' }))
    ).rejects.toThrow(ZodError);
  });

  it('createSessionGovernance rejects empty contextBoundary', async () => {
    await expect(
      createSessionGovernance(makeSessionParams({ contextBoundary: '' }))
    ).rejects.toThrow(ZodError);
  });
});

// ==========================================
// SECTION 5: ACTION GOVERNANCE (W7-6)
// ==========================================

describe('Action Governance — W7-6', () => {
  it('createActionGovernance creates action with execute gate', async () => {
    const result = await createActionGovernance(makeActionParams({ gateDecision: 'execute' }));
    expect(result.actionId).toBeDefined();
    expect(result.gateDecision).toBe('execute');
    expect(result.sessionId).toBe(SESSION_ID);
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('createActionGovernance creates action with propose gate', async () => {
    const result = await createActionGovernance(makeActionParams({ gateDecision: 'propose' }));
    expect(result.gateDecision).toBe('propose');
  });

  it('createActionGovernance creates action with requires_approval gate', async () => {
    const result = await createActionGovernance(
      makeActionParams({ gateDecision: 'requires_approval' })
    );
    expect(result.gateDecision).toBe('requires_approval');
  });

  it('createActionGovernance creates action with blocked gate', async () => {
    const result = await createActionGovernance(
      makeActionParams({ gateDecision: 'blocked', gateReason: 'policy_denied' })
    );
    expect(result.gateDecision).toBe('blocked');
    expect(result.gateReason).toBe('policy_denied');
  });

  it('createActionGovernance stores actionType correctly', async () => {
    const result = await createActionGovernance(
      makeActionParams({ actionType: 'ai_generate_output' })
    );
    expect(result.actionType).toBe('ai_generate_output');
  });

  it('createActionGovernance defaults gateReason to null', async () => {
    const result = await createActionGovernance(makeActionParams());
    expect(result.gateReason).toBeNull();
  });

  it('createActionGovernance rejects invalid gateDecision via Zod', async () => {
    await expect(
      createActionGovernance(makeActionParams({ gateDecision: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('getActionsBySession returns actions for a session', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeActionRow({
        action_id: '00000000-0000-4000-8000-cc0000000001',
        gate_decision: 'execute',
      }),
      makeActionRow({
        action_id: '00000000-0000-4000-8000-cc0000000002',
        gate_decision: 'propose',
      }),
      makeActionRow({
        action_id: '00000000-0000-4000-8000-cc0000000003',
        gate_decision: 'blocked',
      }),
    ]);

    const results = await getActionsBySession(SESSION_ID, ORG_ID);
    expect(results).toHaveLength(3);
    expect(results[0].gateDecision).toBe('execute');
    expect(results[1].gateDecision).toBe('propose');
    expect(results[2].gateDecision).toBe('blocked');
  });

  it('getActionsBySession returns empty for no actions', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getActionsBySession(SESSION_ID, ORG_ID);
    expect(results).toHaveLength(0);
  });

  it('getActionsBySession enforces org isolation', async () => {
    await getActionsBySession(SESSION_ID, OTHER_ORG_ID);
    const callArgs = mockDbAll.mock.calls[0];
    expect(callArgs[1]).toContain(OTHER_ORG_ID);
  });
});

// ==========================================
// SECTION 6: ADMIN SURFACE OWNERSHIP (W7-7)
// ==========================================

describe('Admin Surface Ownership — W7-7', () => {
  it('registerAdminSurface creates organization_settings surface', async () => {
    const result = await registerAdminSurface(
      makeAdminSurfaceParams({ ownerLayer: 'organization_settings' })
    );
    expect(result.surfaceId).toBeDefined();
    expect(result.ownerLayer).toBe('organization_settings');
    expect(result.moduleName).toBeNull();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('registerAdminSurface creates superadmin surface', async () => {
    const result = await registerAdminSurface(
      makeAdminSurfaceParams({
        surfaceName: 'Platform Operator Dashboard',
        ownerLayer: 'superadmin',
      })
    );
    expect(result.ownerLayer).toBe('superadmin');
    expect(result.surfaceName).toBe('Platform Operator Dashboard');
  });

  it('registerAdminSurface creates module_embedded surface with moduleName', async () => {
    const result = await registerAdminSurface(
      makeAdminSurfaceParams({
        surfaceName: 'Tools Knowledge Bank Admin',
        ownerLayer: 'module_embedded',
        moduleName: 'consulting_tools',
      })
    );
    expect(result.ownerLayer).toBe('module_embedded');
    expect(result.moduleName).toBe('consulting_tools');
  });

  it('registerAdminSurface stores horizontalLayerRef', async () => {
    const result = await registerAdminSurface(
      makeAdminSurfaceParams({ horizontalLayerRef: 'ai_governance_layer' })
    );
    expect(result.horizontalLayerRef).toBe('ai_governance_layer');
  });

  it('registerAdminSurface rejects invalid ownerLayer via Zod', async () => {
    await expect(
      registerAdminSurface(makeAdminSurfaceParams({ ownerLayer: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('registerAdminSurface rejects empty surfaceName', async () => {
    await expect(registerAdminSurface(makeAdminSurfaceParams({ surfaceName: '' }))).rejects.toThrow(
      ZodError
    );
  });

  it('getAdminSurfaces returns all surfaces for org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeAdminSurfaceRow({
        surface_id: '00000000-0000-4000-8000-dd0000000001',
        owner_layer: 'organization_settings',
      }),
      makeAdminSurfaceRow({
        surface_id: '00000000-0000-4000-8000-dd0000000002',
        owner_layer: 'superadmin',
      }),
      makeAdminSurfaceRow({
        surface_id: '00000000-0000-4000-8000-dd0000000003',
        owner_layer: 'module_embedded',
        module_name: 'tools',
      }),
    ]);

    const results = await getAdminSurfaces(ORG_ID);
    expect(results).toHaveLength(3);
  });

  it('getAdminSurfaces returns empty for org with no surfaces', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getAdminSurfaces(ORG_ID);
    expect(results).toHaveLength(0);
  });

  it('getAdminSurfaces enforces org isolation', async () => {
    await getAdminSurfaces(OTHER_ORG_ID);
    const callArgs = mockDbAll.mock.calls[0];
    expect(callArgs[1]).toContain(OTHER_ORG_ID);
  });
});

// ==========================================
// SECTION 7: BRIDGING CONTRACTS (W7-8)
// ==========================================

describe('Bridging Contracts — W7-8', () => {
  it('createBridgingContract creates contract with draft status', async () => {
    const result = await createBridgingContract(makeBridgingParams());

    expect(result.contractId).toBeDefined();
    expect(result.toolId).toBe(TOOL_ID);
    expect(result.v3ToolContractRef).toBe('CONSULTING_TOOLS_V3:dynamic_swot');
    expect(result.v8PlatformRequirements).toEqual([
      'context_snapshot',
      'governed_retrieval',
      'prompt_os',
    ]);
    expect(result.bridgingStatus).toBe('draft');
    expect(mockDbRun).toHaveBeenCalledTimes(1);
  });

  it('createBridgingContract creates contract with active status', async () => {
    const result = await createBridgingContract(makeBridgingParams({ bridgingStatus: 'active' }));
    expect(result.bridgingStatus).toBe('active');
  });

  it('createBridgingContract creates contract with superseded status', async () => {
    const result = await createBridgingContract(
      makeBridgingParams({ bridgingStatus: 'superseded' })
    );
    expect(result.bridgingStatus).toBe('superseded');
  });

  it('createBridgingContract stores AI governance ref', async () => {
    const result = await createBridgingContract(
      makeBridgingParams({ v8AIGovernanceRef: 'tool_governance:swot_ai_policy' })
    );
    expect(result.v8AIGovernanceRef).toBe('tool_governance:swot_ai_policy');
  });

  it('createBridgingContract stores session knowledge rules', async () => {
    const result = await createBridgingContract(
      makeBridgingParams({ v8SessionKnowledgeRules: 'kb:swot-session-rules-v1' })
    );
    expect(result.v8SessionKnowledgeRules).toBe('kb:swot-session-rules-v1');
  });

  it('createBridgingContract serializes v8PlatformRequirements as JSON', async () => {
    await createBridgingContract(makeBridgingParams());

    const insertArgs = mockDbRun.mock.calls[0][1] as unknown[];
    const requirementsArg = insertArgs[4];
    expect(typeof requirementsArg).toBe('string');
    expect(JSON.parse(requirementsArg as string)).toEqual([
      'context_snapshot',
      'governed_retrieval',
      'prompt_os',
    ]);
  });

  it('createBridgingContract rejects empty v8PlatformRequirements', async () => {
    await expect(
      createBridgingContract(makeBridgingParams({ v8PlatformRequirements: [] }))
    ).rejects.toThrow(ZodError);
  });

  it('createBridgingContract rejects invalid bridgingStatus via Zod', async () => {
    await expect(
      createBridgingContract(makeBridgingParams({ bridgingStatus: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('getBridgingContract returns contract when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeBridgingRow());

    const result = await getBridgingContract(TOOL_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.toolId).toBe(TOOL_ID);
    expect(result!.v8PlatformRequirements).toEqual(['context_snapshot', 'governed_retrieval']);
    expect(result!.bridgingStatus).toBe('draft');
  });

  it('getBridgingContract returns null when not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getBridgingContract(TOOL_ID, ORG_ID);
    expect(result).toBeNull();
  });

  it('getBridgingContract enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getBridgingContract(TOOL_ID, OTHER_ORG_ID);

    const callArgs = mockDbGet.mock.calls[0];
    expect(callArgs[1]).toContain(OTHER_ORG_ID);
  });

  it('getBridgingContract handles malformed JSON in v8_platform_requirements', async () => {
    mockDbGet.mockResolvedValueOnce(makeBridgingRow({ v8_platform_requirements: 'not-json' }));

    const result = await getBridgingContract(TOOL_ID, ORG_ID);
    expect(result).not.toBeNull();
    expect(result!.v8PlatformRequirements).toEqual([]);
  });
});

// ==========================================
// SECTION 8: ORG ISOLATION CROSS-CUTTING
// ==========================================

describe('Organization isolation — cross-cutting', () => {
  it('registerTool binds to the provided organizationId', async () => {
    const result = await registerTool(makeRegisterParams({ organizationId: OTHER_ORG_ID }));
    expect(result.organizationId).toBe(OTHER_ORG_ID);
  });

  it('createSessionGovernance binds to the provided organizationId', async () => {
    const result = await createSessionGovernance(
      makeSessionParams({ organizationId: OTHER_ORG_ID })
    );
    expect(result.organizationId).toBe(OTHER_ORG_ID);
  });

  it('createActionGovernance binds to the provided organizationId', async () => {
    const result = await createActionGovernance(makeActionParams({ organizationId: OTHER_ORG_ID }));
    expect(result.organizationId).toBe(OTHER_ORG_ID);
  });

  it('registerAdminSurface binds to the provided organizationId', async () => {
    const result = await registerAdminSurface(
      makeAdminSurfaceParams({ organizationId: OTHER_ORG_ID })
    );
    expect(result.organizationId).toBe(OTHER_ORG_ID);
  });

  it('createBridgingContract binds to the provided organizationId', async () => {
    const result = await createBridgingContract(
      makeBridgingParams({ organizationId: OTHER_ORG_ID })
    );
    expect(result.organizationId).toBe(OTHER_ORG_ID);
  });
});

// ==========================================
// SECTION 9: ENUM COMPLETENESS
// ==========================================

describe('Enum completeness', () => {
  it('ToolFamilyValues has 5 members', () => {
    expect(ToolFamilyValues).toHaveLength(5);
    expect(ToolFamilyValues).toContain('consulting_framework');
    expect(ToolFamilyValues).toContain('assessment');
    expect(ToolFamilyValues).toContain('diagnostic');
    expect(ToolFamilyValues).toContain('workshop');
    expect(ToolFamilyValues).toContain('custom');
  });

  it('CatalogVisibilityValues has 3 members', () => {
    expect(CatalogVisibilityValues).toHaveLength(3);
  });

  it('SessionModeValues has 3 members', () => {
    expect(SessionModeValues).toHaveLength(3);
  });

  it('GateDecisionValues has 4 members', () => {
    expect(GateDecisionValues).toHaveLength(4);
  });

  it('OwnerLayerValues has 3 members', () => {
    expect(OwnerLayerValues).toHaveLength(3);
  });

  it('BridgingStatusValues has 3 members', () => {
    expect(BridgingStatusValues).toHaveLength(3);
  });
});
