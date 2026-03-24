/**
 * V8 Tool Collaboration Adapter Service
 *
 * Manages per-tool collaboration adapter declarations, readiness audits,
 * and AI proposal visibility lifecycle for the V8 multiplayer runtime.
 *
 * Each workspace tool (Idea Workspace, Whiteboard, Mind Map, Process Flow,
 * Table, Notebook) registers its collaboration capabilities through this service.
 * All queries enforce organization-level isolation.
 *
 * Decisions applied:
 *   W4-6: Table room = per-table
 *   W4-7: AI proposals — personal_draft → shared_proposal → team_review → accepted/rejected
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ToolCollaborationAdapter,
  ToolReadinessAudit,
  AIProposalVisibility,
  AIProposalVisibilityState,
  RegisterAdapterParams,
  RecordReadinessAuditParams,
  SetAIProposalVisibilityParams,
  VersioningPolicy,
  LockType,
  PrimitiveCheck,
} from '../../types/toolCollaborationAdapter.js';
import {
  RegisterAdapterParamsSchema,
  RecordReadinessAuditParamsSchema,
  SetAIProposalVisibilityParamsSchema,
  VALID_PROPOSAL_TRANSITIONS,
  TERMINAL_PROPOSAL_STATES,
} from '../../types/toolCollaborationAdapter.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ToolCollaboration]';

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

interface AdapterRow {
  adapter_id: string;
  tool_name: string;
  resource_type: string;
  organization_id: string;
  readiness_level: string;
  room_granularity: string;
  presence_types: string;
  cursor_state_schema: string;
  supported_lock_types: string;
  versioning_policy: string;
  offline_policy: string;
  collaboration_mode: string;
  registered_at: string;
  updated_at: string;
}

interface AuditRow {
  audit_id: string;
  tool_name: string;
  organization_id: string;
  primitive_checks: string;
  overall_readiness: string;
  audited_at: string;
  audited_by: string;
}

interface ProposalRow {
  proposal_id: string;
  organization_id: string;
  tool_name: string;
  resource_id: string;
  author_id: string;
  visibility: string;
  proposal_payload: string;
  created_at: string;
  updated_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToAdapter(row: AdapterRow): ToolCollaborationAdapter {
  return {
    adapterId: row.adapter_id,
    toolName: row.tool_name as ToolCollaborationAdapter['toolName'],
    resourceType: row.resource_type,
    organizationId: row.organization_id,
    readinessLevel: row.readiness_level as ToolCollaborationAdapter['readinessLevel'],
    roomGranularity: row.room_granularity as ToolCollaborationAdapter['roomGranularity'],
    presenceTypes: safeJsonParse<string[]>(row.presence_types, []),
    cursorStateSchema: safeJsonParse<Record<string, unknown>>(row.cursor_state_schema, {}),
    supportedLockTypes: safeJsonParse<LockType[]>(row.supported_lock_types, []),
    versioningPolicy: safeJsonParse<VersioningPolicy>(row.versioning_policy, {
      autoSnapshotCadence: 'none',
      snapshotGranularity: 'full_document',
      retentionTier: 'warm',
      compareDiffSupport: false,
      restoreSupport: false,
    }),
    offlinePolicy: row.offline_policy as ToolCollaborationAdapter['offlinePolicy'],
    collaborationMode: row.collaboration_mode as ToolCollaborationAdapter['collaborationMode'],
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
  };
}

function rowToAudit(row: AuditRow): ToolReadinessAudit {
  return {
    auditId: row.audit_id,
    toolName: row.tool_name as ToolReadinessAudit['toolName'],
    organizationId: row.organization_id,
    primitiveChecks: safeJsonParse<PrimitiveCheck[]>(row.primitive_checks, []),
    overallReadiness: row.overall_readiness as ToolReadinessAudit['overallReadiness'],
    auditedAt: row.audited_at,
    auditedBy: row.audited_by,
  };
}

function rowToProposal(row: ProposalRow): AIProposalVisibility {
  return {
    proposalId: row.proposal_id,
    organizationId: row.organization_id,
    toolName: row.tool_name as AIProposalVisibility['toolName'],
    resourceId: row.resource_id,
    authorId: row.author_id,
    visibility: row.visibility as AIProposalVisibility['visibility'],
    proposalPayload: safeJsonParse<Record<string, unknown>>(row.proposal_payload, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// STATE MACHINE VALIDATION
// ==========================================

function isValidProposalTransition(
  from: AIProposalVisibilityState,
  to: AIProposalVisibilityState,
): boolean {
  const allowed = VALID_PROPOSAL_TRANSITIONS[from];
  return allowed.includes(to);
}

// ==========================================
// PUBLIC API — ADAPTERS
// ==========================================

/**
 * Register (or update) a tool's collaboration adapter declaration.
 * Upserts on (organization_id, tool_name).
 */
export async function registerAdapter(
  params: RegisterAdapterParams,
): Promise<ToolCollaborationAdapter> {
  const validated = RegisterAdapterParamsSchema.parse(params);

  const now = new Date().toISOString();

  const existing = await dbGet<AdapterRow>(
    `SELECT * FROM v8_tool_collaboration_adapters
     WHERE organization_id = ? AND tool_name = ?`,
    [validated.organizationId, validated.toolName],
    { fallback: true },
  );

  if (existing) {
    await dbRun(
      `UPDATE v8_tool_collaboration_adapters
       SET resource_type = ?, readiness_level = ?, room_granularity = ?,
           presence_types = ?, cursor_state_schema = ?, supported_lock_types = ?,
           versioning_policy = ?, offline_policy = ?, collaboration_mode = ?,
           updated_at = ?
       WHERE organization_id = ? AND tool_name = ?`,
      [
        validated.resourceType,
        validated.readinessLevel,
        validated.roomGranularity,
        JSON.stringify(validated.presenceTypes),
        JSON.stringify(validated.cursorStateSchema),
        JSON.stringify(validated.supportedLockTypes),
        JSON.stringify(validated.versioningPolicy),
        validated.offlinePolicy,
        validated.collaborationMode,
        now,
        validated.organizationId,
        validated.toolName,
      ],
    );

    logger.info(
      `${LOG_PREFIX} Updated adapter for ${validated.toolName} in org ${validated.organizationId}`,
    );

    return {
      adapterId: existing.adapter_id,
      toolName: validated.toolName,
      resourceType: validated.resourceType,
      organizationId: validated.organizationId,
      readinessLevel: validated.readinessLevel,
      roomGranularity: validated.roomGranularity,
      presenceTypes: validated.presenceTypes,
      cursorStateSchema: validated.cursorStateSchema,
      supportedLockTypes: validated.supportedLockTypes,
      versioningPolicy: validated.versioningPolicy,
      offlinePolicy: validated.offlinePolicy,
      collaborationMode: validated.collaborationMode,
      registeredAt: existing.registered_at,
      updatedAt: now,
    };
  }

  const adapterId = uuidv4();

  const adapter: ToolCollaborationAdapter = {
    adapterId,
    toolName: validated.toolName,
    resourceType: validated.resourceType,
    organizationId: validated.organizationId,
    readinessLevel: validated.readinessLevel,
    roomGranularity: validated.roomGranularity,
    presenceTypes: validated.presenceTypes,
    cursorStateSchema: validated.cursorStateSchema,
    supportedLockTypes: validated.supportedLockTypes,
    versioningPolicy: validated.versioningPolicy,
    offlinePolicy: validated.offlinePolicy,
    collaborationMode: validated.collaborationMode,
    registeredAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_tool_collaboration_adapters (
      adapter_id, tool_name, resource_type, organization_id,
      readiness_level, room_granularity, presence_types, cursor_state_schema,
      supported_lock_types, versioning_policy, offline_policy, collaboration_mode,
      registered_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adapter.adapterId,
      adapter.toolName,
      adapter.resourceType,
      adapter.organizationId,
      adapter.readinessLevel,
      adapter.roomGranularity,
      JSON.stringify(adapter.presenceTypes),
      JSON.stringify(adapter.cursorStateSchema),
      JSON.stringify(adapter.supportedLockTypes),
      JSON.stringify(adapter.versioningPolicy),
      adapter.offlinePolicy,
      adapter.collaborationMode,
      adapter.registeredAt,
      adapter.updatedAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Registered adapter ${adapterId} for ${validated.toolName} in org ${validated.organizationId}`,
  );

  return adapter;
}

/**
 * Get a single adapter by tool name with org isolation.
 */
export async function getAdapter(
  toolName: string,
  organizationId: string,
): Promise<ToolCollaborationAdapter | null> {
  const row = await dbGet<AdapterRow>(
    `SELECT * FROM v8_tool_collaboration_adapters
     WHERE tool_name = ? AND organization_id = ?`,
    [toolName, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToAdapter(row);
}

/**
 * Get all adapters for an organization.
 */
export async function getAllAdapters(
  organizationId: string,
): Promise<ToolCollaborationAdapter[]> {
  const rows = await dbAll<AdapterRow>(
    `SELECT * FROM v8_tool_collaboration_adapters
     WHERE organization_id = ?
     ORDER BY tool_name ASC`,
    [organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToAdapter);
}

// ==========================================
// PUBLIC API — READINESS AUDITS
// ==========================================

/**
 * Record a readiness audit for a tool. Creates a new audit record each time
 * (append-only audit trail).
 */
export async function recordReadinessAudit(
  params: RecordReadinessAuditParams,
): Promise<ToolReadinessAudit> {
  const validated = RecordReadinessAuditParamsSchema.parse(params);

  const auditId = uuidv4();
  const now = new Date().toISOString();

  const audit: ToolReadinessAudit = {
    auditId,
    toolName: validated.toolName,
    organizationId: validated.organizationId,
    primitiveChecks: validated.primitiveChecks,
    overallReadiness: validated.overallReadiness,
    auditedAt: now,
    auditedBy: validated.auditedBy,
  };

  await dbRun(
    `INSERT INTO v8_tool_readiness_audits (
      audit_id, tool_name, organization_id, primitive_checks,
      overall_readiness, audited_at, audited_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      audit.auditId,
      audit.toolName,
      audit.organizationId,
      JSON.stringify(audit.primitiveChecks),
      audit.overallReadiness,
      audit.auditedAt,
      audit.auditedBy,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recorded readiness audit ${auditId} for ${validated.toolName} in org ${validated.organizationId}: ${validated.overallReadiness}`,
  );

  return audit;
}

/**
 * Get the most recent readiness audit for a tool in an org.
 */
export async function getReadinessAudit(
  toolName: string,
  organizationId: string,
): Promise<ToolReadinessAudit | null> {
  const row = await dbGet<AuditRow>(
    `SELECT * FROM v8_tool_readiness_audits
     WHERE tool_name = ? AND organization_id = ?
     ORDER BY audited_at DESC
     LIMIT 1`,
    [toolName, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToAudit(row);
}

// ==========================================
// PUBLIC API — AI PROPOSAL VISIBILITY (Decision W4-7)
// ==========================================

/**
 * Set AI proposal visibility. Creates a new proposal if proposalId is not provided
 * or the proposal doesn't exist. Otherwise transitions the existing proposal's
 * visibility state, validating the state machine.
 */
export async function setAIProposalVisibility(
  params: SetAIProposalVisibilityParams,
): Promise<AIProposalVisibility> {
  const validated = SetAIProposalVisibilityParamsSchema.parse(params);

  const now = new Date().toISOString();

  if (validated.proposalId) {
    const existing = await dbGet<ProposalRow>(
      `SELECT * FROM v8_ai_proposal_visibility
       WHERE proposal_id = ? AND organization_id = ?`,
      [validated.proposalId, validated.organizationId],
      { fallback: true },
    );

    if (existing) {
      const currentVisibility = existing.visibility as AIProposalVisibilityState;

      if (TERMINAL_PROPOSAL_STATES.has(currentVisibility)) {
        throw new Error(
          `Proposal ${validated.proposalId} is in terminal state '${currentVisibility}' and cannot be transitioned`,
        );
      }

      if (!isValidProposalTransition(currentVisibility, validated.visibility)) {
        throw new Error(
          `Invalid proposal visibility transition: ${currentVisibility} → ${validated.visibility}. ` +
            `Allowed from ${currentVisibility}: [${VALID_PROPOSAL_TRANSITIONS[currentVisibility].join(', ')}]`,
        );
      }

      await dbRun(
        `UPDATE v8_ai_proposal_visibility
         SET visibility = ?, updated_at = ?
         WHERE proposal_id = ? AND organization_id = ?`,
        [validated.visibility, now, validated.proposalId, validated.organizationId],
      );

      logger.info(
        `${LOG_PREFIX} Proposal ${validated.proposalId}: ${currentVisibility} → ${validated.visibility}`,
      );

      return {
        proposalId: existing.proposal_id,
        organizationId: existing.organization_id,
        toolName: existing.tool_name as AIProposalVisibility['toolName'],
        resourceId: existing.resource_id,
        authorId: existing.author_id,
        visibility: validated.visibility,
        proposalPayload: safeJsonParse<Record<string, unknown>>(existing.proposal_payload, {}),
        createdAt: existing.created_at,
        updatedAt: now,
      };
    }
  }

  const proposalId = validated.proposalId || uuidv4();

  const proposal: AIProposalVisibility = {
    proposalId,
    organizationId: validated.organizationId,
    toolName: validated.toolName,
    resourceId: validated.resourceId,
    authorId: validated.authorId,
    visibility: validated.visibility,
    proposalPayload: validated.proposalPayload,
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO v8_ai_proposal_visibility (
      proposal_id, organization_id, tool_name, resource_id,
      author_id, visibility, proposal_payload, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proposal.proposalId,
      proposal.organizationId,
      proposal.toolName,
      proposal.resourceId,
      proposal.authorId,
      proposal.visibility,
      JSON.stringify(proposal.proposalPayload),
      proposal.createdAt,
      proposal.updatedAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created proposal ${proposalId} for ${validated.toolName} as ${validated.visibility}`,
  );

  return proposal;
}

/**
 * Get AI proposal visibility by proposal ID with org isolation.
 */
export async function getAIProposalVisibility(
  proposalId: string,
  organizationId: string,
): Promise<AIProposalVisibility | null> {
  const row = await dbGet<ProposalRow>(
    `SELECT * FROM v8_ai_proposal_visibility
     WHERE proposal_id = ? AND organization_id = ?`,
    [proposalId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToProposal(row);
}
