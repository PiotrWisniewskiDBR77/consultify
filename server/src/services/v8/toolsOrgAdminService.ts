/**
 * V8 Tools / Org / Admin Hardening Service
 *
 * Shared tools registry, session + action governance,
 * admin surface ownership, and V3→V8 bridging contracts.
 *
 * All queries enforce organization-level isolation.
 *
 * Decisions implemented:
 *  W7-5 — one shared registry, typed families
 *  W7-6 — session sets the sandbox, action decides the gate
 *  W7-7 — shared IA at top, module settings underneath
 *  W7-8 — bridging Tools V8 SSOT
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  SharedToolsRegistryEntry,
  ToolSessionGovernance,
  ToolActionGovernance,
  AdminSurfaceOwnership,
  ToolsV8BridgingContract,
  RegisterToolParams,
  CreateSessionGovernanceParams,
  CreateActionGovernanceParams,
  RegisterAdminSurfaceParams,
  CreateBridgingContractParams,
} from '../../types/toolsOrgAdminHardening.js';
import {
  RegisterToolParamsSchema,
  CreateSessionGovernanceParamsSchema,
  CreateActionGovernanceParamsSchema,
  RegisterAdminSurfaceParamsSchema,
  CreateBridgingContractParamsSchema,
} from '../../types/toolsOrgAdminHardening.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ToolsOrgAdmin]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface RegistryRow {
  tool_id: string;
  organization_id: string;
  tool_name: string;
  tool_family: string;
  tool_subtype: string | null;
  is_classic_framework_template: number;
  knowledge_bank_ref: string | null;
  catalog_visibility: string;
  created_at: string;
  updated_at: string;
}

interface SessionGovRow {
  session_id: string;
  tool_id: string;
  user_id: string;
  organization_id: string;
  session_mode: string;
  permission_scope: string;
  context_boundary: string;
  ai_enabled: number;
  created_at: string;
  updated_at: string;
}

interface ActionGovRow {
  action_id: string;
  session_id: string;
  organization_id: string;
  action_type: string;
  gate_decision: string;
  gate_reason: string | null;
  created_at: string;
}

interface AdminSurfaceRow {
  surface_id: string;
  surface_name: string;
  organization_id: string;
  owner_layer: string;
  module_name: string | null;
  horizontal_layer_ref: string | null;
  created_at: string;
  updated_at: string;
}

interface BridgingRow {
  contract_id: string;
  tool_id: string;
  organization_id: string;
  v3_tool_contract_ref: string;
  v8_platform_requirements: string;
  v8_ai_governance_ref: string | null;
  v8_session_knowledge_rules: string | null;
  bridging_status: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToRegistryEntry(row: RegistryRow): SharedToolsRegistryEntry {
  return {
    toolId: row.tool_id,
    organizationId: row.organization_id,
    toolName: row.tool_name,
    toolFamily: row.tool_family as SharedToolsRegistryEntry['toolFamily'],
    toolSubtype: row.tool_subtype,
    isClassicFrameworkTemplate: row.is_classic_framework_template === 1,
    knowledgeBankRef: row.knowledge_bank_ref,
    catalogVisibility: row.catalog_visibility as SharedToolsRegistryEntry['catalogVisibility'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSessionGov(row: SessionGovRow): ToolSessionGovernance {
  return {
    sessionId: row.session_id,
    toolId: row.tool_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    sessionMode: row.session_mode as ToolSessionGovernance['sessionMode'],
    permissionScope: row.permission_scope,
    contextBoundary: row.context_boundary,
    aiEnabled: row.ai_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToActionGov(row: ActionGovRow): ToolActionGovernance {
  return {
    actionId: row.action_id,
    sessionId: row.session_id,
    organizationId: row.organization_id,
    actionType: row.action_type,
    gateDecision: row.gate_decision as ToolActionGovernance['gateDecision'],
    gateReason: row.gate_reason,
    createdAt: row.created_at,
  };
}

function rowToAdminSurface(row: AdminSurfaceRow): AdminSurfaceOwnership {
  return {
    surfaceId: row.surface_id,
    surfaceName: row.surface_name,
    organizationId: row.organization_id,
    ownerLayer: row.owner_layer as AdminSurfaceOwnership['ownerLayer'],
    moduleName: row.module_name,
    horizontalLayerRef: row.horizontal_layer_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBridging(row: BridgingRow): ToolsV8BridgingContract {
  return {
    contractId: row.contract_id,
    toolId: row.tool_id,
    organizationId: row.organization_id,
    v3ToolContractRef: row.v3_tool_contract_ref,
    v8PlatformRequirements: safeJsonParse<string[]>(row.v8_platform_requirements, []),
    v8AIGovernanceRef: row.v8_ai_governance_ref,
    v8SessionKnowledgeRules: row.v8_session_knowledge_rules,
    bridgingStatus: row.bridging_status as ToolsV8BridgingContract['bridgingStatus'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// PUBLIC API — Shared Tools Registry (W7-5)
// ==========================================

/**
 * Register a tool in the shared registry.
 * W7-5: one shared registry, typed families.
 */
export async function registerTool(params: RegisterToolParams): Promise<SharedToolsRegistryEntry> {
  const validated = RegisterToolParamsSchema.parse(params);

  const toolId = uuidv4();
  const now = new Date().toISOString();

  const entry: SharedToolsRegistryEntry = {
    toolId,
    organizationId: validated.organizationId,
    toolName: validated.toolName,
    toolFamily: validated.toolFamily,
    toolSubtype: validated.toolSubtype,
    isClassicFrameworkTemplate: validated.isClassicFrameworkTemplate,
    knowledgeBankRef: validated.knowledgeBankRef,
    catalogVisibility: validated.catalogVisibility,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_shared_tools_registry (
      tool_id, organization_id, tool_name, tool_family, tool_subtype,
      is_classic_framework_template, knowledge_bank_ref, catalog_visibility,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.toolId,
      entry.organizationId,
      entry.toolName,
      entry.toolFamily,
      entry.toolSubtype,
      entry.isClassicFrameworkTemplate ? 1 : 0,
      entry.knowledgeBankRef,
      entry.catalogVisibility,
      entry.createdAt,
      entry.updatedAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Registered tool ${toolId} "${validated.toolName}" family=${validated.toolFamily}`);
  return entry;
}

/**
 * Retrieve a single tool by ID with org isolation.
 */
export async function getTool(
  toolId: string,
  organizationId: string,
): Promise<SharedToolsRegistryEntry | null> {
  const row = await dbGet<RegistryRow>(
    `SELECT * FROM v8_shared_tools_registry
     WHERE tool_id = ? AND organization_id = ?`,
    [toolId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToRegistryEntry(row);
}

/**
 * Retrieve tools by family with org isolation.
 */
export async function getToolsByFamily(
  family: string,
  organizationId: string,
): Promise<SharedToolsRegistryEntry[]> {
  const rows = await dbAll<RegistryRow>(
    `SELECT * FROM v8_shared_tools_registry
     WHERE tool_family = ? AND organization_id = ?
     ORDER BY tool_name ASC`,
    [family, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToRegistryEntry);
}

// ==========================================
// PUBLIC API — Session Governance (W7-6)
// ==========================================

/**
 * Create session-level governance sandbox.
 * W7-6: session sets the sandbox.
 */
export async function createSessionGovernance(
  params: CreateSessionGovernanceParams,
): Promise<ToolSessionGovernance> {
  const validated = CreateSessionGovernanceParamsSchema.parse(params);

  const sessionId = uuidv4();
  const now = new Date().toISOString();

  const session: ToolSessionGovernance = {
    sessionId,
    toolId: validated.toolId,
    userId: validated.userId,
    organizationId: validated.organizationId,
    sessionMode: validated.sessionMode,
    permissionScope: validated.permissionScope,
    contextBoundary: validated.contextBoundary,
    aiEnabled: validated.aiEnabled,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_tool_session_governance (
      session_id, tool_id, user_id, organization_id,
      session_mode, permission_scope, context_boundary, ai_enabled,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.sessionId,
      session.toolId,
      session.userId,
      session.organizationId,
      session.sessionMode,
      session.permissionScope,
      session.contextBoundary,
      session.aiEnabled ? 1 : 0,
      session.createdAt,
      session.updatedAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Session ${sessionId} mode=${validated.sessionMode} tool=${validated.toolId}`);
  return session;
}

// ==========================================
// PUBLIC API — Action Governance (W7-6)
// ==========================================

/**
 * Create action-level governance gate.
 * W7-6: action decides the gate.
 */
export async function createActionGovernance(
  params: CreateActionGovernanceParams,
): Promise<ToolActionGovernance> {
  const validated = CreateActionGovernanceParamsSchema.parse(params);

  const actionId = uuidv4();
  const now = new Date().toISOString();

  const action: ToolActionGovernance = {
    actionId,
    sessionId: validated.sessionId,
    organizationId: validated.organizationId,
    actionType: validated.actionType,
    gateDecision: validated.gateDecision,
    gateReason: validated.gateReason,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_tool_action_governance (
      action_id, session_id, organization_id,
      action_type, gate_decision, gate_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      action.actionId,
      action.sessionId,
      action.organizationId,
      action.actionType,
      action.gateDecision,
      action.gateReason,
      action.createdAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Action ${actionId} gate=${validated.gateDecision} session=${validated.sessionId}`);
  return action;
}

/**
 * Retrieve all actions for a session with org isolation.
 */
export async function getActionsBySession(
  sessionId: string,
  organizationId: string,
): Promise<ToolActionGovernance[]> {
  const rows = await dbAll<ActionGovRow>(
    `SELECT * FROM v8_tool_action_governance
     WHERE session_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [sessionId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToActionGov);
}

// ==========================================
// PUBLIC API — Admin Surface Ownership (W7-7)
// ==========================================

/**
 * Register an admin surface in the ownership model.
 * W7-7: shared IA at top, module settings underneath.
 */
export async function registerAdminSurface(
  params: RegisterAdminSurfaceParams,
): Promise<AdminSurfaceOwnership> {
  const validated = RegisterAdminSurfaceParamsSchema.parse(params);

  const surfaceId = uuidv4();
  const now = new Date().toISOString();

  const surface: AdminSurfaceOwnership = {
    surfaceId,
    surfaceName: validated.surfaceName,
    organizationId: validated.organizationId,
    ownerLayer: validated.ownerLayer,
    moduleName: validated.moduleName,
    horizontalLayerRef: validated.horizontalLayerRef,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_admin_surface_ownership (
      surface_id, surface_name, organization_id,
      owner_layer, module_name, horizontal_layer_ref,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      surface.surfaceId,
      surface.surfaceName,
      surface.organizationId,
      surface.ownerLayer,
      surface.moduleName,
      surface.horizontalLayerRef,
      surface.createdAt,
      surface.updatedAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Admin surface ${surfaceId} "${validated.surfaceName}" layer=${validated.ownerLayer}`);
  return surface;
}

/**
 * Retrieve all admin surfaces for an organization.
 */
export async function getAdminSurfaces(
  organizationId: string,
): Promise<AdminSurfaceOwnership[]> {
  const rows = await dbAll<AdminSurfaceRow>(
    `SELECT * FROM v8_admin_surface_ownership
     WHERE organization_id = ?
     ORDER BY owner_layer ASC, surface_name ASC`,
    [organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToAdminSurface);
}

// ==========================================
// PUBLIC API — Bridging Contracts (W7-8)
// ==========================================

/**
 * Create a V3→V8 bridging contract.
 * W7-8: connects V3 tool contracts with V8 platform requirements.
 */
export async function createBridgingContract(
  params: CreateBridgingContractParams,
): Promise<ToolsV8BridgingContract> {
  const validated = CreateBridgingContractParamsSchema.parse(params);

  const contractId = uuidv4();
  const now = new Date().toISOString();

  const contract: ToolsV8BridgingContract = {
    contractId,
    toolId: validated.toolId,
    organizationId: validated.organizationId,
    v3ToolContractRef: validated.v3ToolContractRef,
    v8PlatformRequirements: validated.v8PlatformRequirements,
    v8AIGovernanceRef: validated.v8AIGovernanceRef,
    v8SessionKnowledgeRules: validated.v8SessionKnowledgeRules,
    bridgingStatus: validated.bridgingStatus,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_tools_v8_bridging_contracts (
      contract_id, tool_id, organization_id,
      v3_tool_contract_ref, v8_platform_requirements,
      v8_ai_governance_ref, v8_session_knowledge_rules,
      bridging_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contract.contractId,
      contract.toolId,
      contract.organizationId,
      contract.v3ToolContractRef,
      JSON.stringify(contract.v8PlatformRequirements),
      contract.v8AIGovernanceRef,
      contract.v8SessionKnowledgeRules,
      contract.bridgingStatus,
      contract.createdAt,
      contract.updatedAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Bridging contract ${contractId} tool=${validated.toolId} status=${validated.bridgingStatus}`);
  return contract;
}

/**
 * Retrieve the bridging contract for a tool with org isolation.
 */
export async function getBridgingContract(
  toolId: string,
  organizationId: string,
): Promise<ToolsV8BridgingContract | null> {
  const row = await dbGet<BridgingRow>(
    `SELECT * FROM v8_tools_v8_bridging_contracts
     WHERE tool_id = ? AND organization_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [toolId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToBridging(row);
}
