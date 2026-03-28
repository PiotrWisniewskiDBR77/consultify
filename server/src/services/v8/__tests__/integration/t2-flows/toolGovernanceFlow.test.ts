/**
 * F09 — Tool session governance flow
 *
 * Services: toolGovernanceService, toolsOrgAdminService, toolCollaborationService
 *
 * Flow: registerTool() (toolGovernance) → registerTool() (toolsOrgAdmin shared registry)
 *       → createSessionGovernance() → createActionGovernance() → registerAdapter()
 *       → verify tool identity consistent across governance + registry + adapter
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock DB layer ──────────────────────────────────────────────────────────

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Real service imports ───────────────────────────────────────────────────

import { registerAdapter } from '../../../toolCollaborationService.js';
import { registerTool as registerToolGovernance } from '../../../toolGovernanceService.js';
import {
  createActionGovernance,
  createSessionGovernance,
  registerTool as registerToolRegistry,
} from '../../../toolsOrgAdminService.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000010';
const TOOL_NAME = 'Idea Workspace';

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('F09 — Tool session governance', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Register tool in governance catalog (toolGovernanceService)
    const govTool = await registerToolGovernance({
      organizationId: ORG_ID,
      name: TOOL_NAME,
      description: 'Visual ideation workspace with AI suggestions',
      category: 'artifact_write',
      mutationType: 'bounded_write',
      version: '1.0.0',
    });

    expect(govTool.toolId).toBeDefined();
    expect(govTool.name).toBe(TOOL_NAME);
    expect(govTool.classificationStatus).toBe('proposed');
    expect(govTool.defaultApprovalMode).toBe('requires_human_approval');
    expect(govTool.riskClass).toBe('medium_risk');

    // Step 2: Register tool in shared registry (toolsOrgAdminService)
    const registryTool = await registerToolRegistry({
      organizationId: ORG_ID,
      toolName: TOOL_NAME,
      toolFamily: 'custom',
      toolSubtype: 'idea_workspace',
      isClassicFrameworkTemplate: false,
      knowledgeBankRef: 'kb-ref-001',
      catalogVisibility: 'published',
    });

    expect(registryTool.toolId).toBeDefined();
    expect(registryTool.toolName).toBe(TOOL_NAME);
    expect(registryTool.toolFamily).toBe('custom');
    expect(registryTool.organizationId).toBe(ORG_ID);

    // Step 3: Create session governance sandbox
    const session = await createSessionGovernance({
      toolId: registryTool.toolId,
      userId: USER_ID,
      organizationId: ORG_ID,
      sessionMode: 'expert',
      permissionScope: 'full_access',
      contextBoundary: 'project_scoped',
      aiEnabled: true,
    });

    expect(session.sessionId).toBeDefined();
    expect(session.toolId).toBe(registryTool.toolId);
    expect(session.sessionMode).toBe('expert');
    expect(session.aiEnabled).toBe(true);

    // Step 4: Create action governance gate within the session
    const action = await createActionGovernance({
      sessionId: session.sessionId,
      organizationId: ORG_ID,
      actionType: 'create_item',
      gateDecision: 'execute',
      gateReason: 'User has full access in expert mode',
    });

    expect(action.actionId).toBeDefined();
    expect(action.sessionId).toBe(session.sessionId);
    expect(action.gateDecision).toBe('execute');

    // Step 5: Register collaboration adapter for the tool
    mockDbGet.mockResolvedValueOnce(null);

    const adapter = await registerAdapter({
      toolName: 'idea_workspace',
      resourceType: 'workspace_canvas',
      organizationId: ORG_ID,
      readinessLevel: 'complete',
      roomGranularity: 'canvas',
      presenceTypes: ['cursor', 'selection', 'viewport'],
      cursorStateSchema: { type: 'point', fields: ['x', 'y'] },
      supportedLockTypes: ['optimistic_section', 'advisory_object'],
      versioningPolicy: {
        autoSnapshotCadence: 'on_significant_change',
        snapshotGranularity: 'full_document',
        retentionTier: 'warm',
        compareDiffSupport: true,
        restoreSupport: true,
      },
      offlinePolicy: 'queue_and_merge',
      collaborationMode: 'realtime_coediting',
    });

    expect(adapter.adapterId).toBeDefined();
    expect(adapter.toolName).toBe('idea_workspace');
    expect(adapter.readinessLevel).toBe('complete');
    expect(adapter.collaborationMode).toBe('realtime_coediting');

    // Verify tool identity consistency across all three services
    expect(govTool.name).toBe(registryTool.toolName);
    expect(govTool.organizationId).toBe(registryTool.organizationId);
    expect(registryTool.organizationId).toBe(session.organizationId);
    expect(session.organizationId).toBe(action.organizationId);
    expect(adapter.organizationId).toBe(ORG_ID);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // Governance tool output → registry tool input (same name + org)
    const govTool = await registerToolGovernance({
      organizationId: ORG_ID,
      name: 'Process Flow',
      description: 'Visual process flow designer',
      category: 'artifact_write',
      mutationType: 'bounded_write',
      version: '2.0.0',
    });

    const registryTool = await registerToolRegistry({
      organizationId: govTool.organizationId,
      toolName: govTool.name,
      toolFamily: 'custom',
      toolSubtype: 'process_flow',
      isClassicFrameworkTemplate: false,
      catalogVisibility: 'published',
    });

    expect(registryTool.toolName).toBe(govTool.name);
    expect(registryTool.organizationId).toBe(govTool.organizationId);

    // Registry tool output → session governance input (toolId)
    const session = await createSessionGovernance({
      toolId: registryTool.toolId,
      userId: USER_ID,
      organizationId: registryTool.organizationId,
      sessionMode: 'guided',
      permissionScope: 'read_only',
      contextBoundary: 'organization_wide',
      aiEnabled: false,
    });

    expect(session.toolId).toBe(registryTool.toolId);
    expect(session.organizationId).toBe(registryTool.organizationId);

    // Session output → action governance input (sessionId)
    const action = await createActionGovernance({
      sessionId: session.sessionId,
      organizationId: session.organizationId,
      actionType: 'export',
      gateDecision: 'blocked',
      gateReason: 'Export not allowed in view_only mode',
    });

    expect(action.sessionId).toBe(session.sessionId);
    expect(action.gateDecision).toBe('blocked');

    // Adapter registration uses same org
    mockDbGet.mockResolvedValueOnce(null);
    const adapter = await registerAdapter({
      toolName: 'process_flow',
      resourceType: 'flow_diagram',
      organizationId: registryTool.organizationId,
      readinessLevel: 'partial',
      roomGranularity: 'document',
      presenceTypes: ['cursor'],
      cursorStateSchema: { type: 'offset' },
      supportedLockTypes: ['exclusive_document'],
      versioningPolicy: {
        autoSnapshotCadence: 'periodic',
        snapshotGranularity: 'full_document',
        retentionTier: 'cold',
        compareDiffSupport: false,
        restoreSupport: false,
      },
      offlinePolicy: 'stale_warning',
      collaborationMode: 'review_first',
    });

    expect(adapter.organizationId).toBe(registryTool.organizationId);
  });
});
