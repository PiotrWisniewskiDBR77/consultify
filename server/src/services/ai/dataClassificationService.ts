/**
 * Data Classification Service (V4-AI-05)
 * Classifies artifact data sensitivity, enforces permitted source rules,
 * and manages approval gates for AI processing of sensitive data.
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export const DataClassLevels = ['public', 'internal', 'confidential', 'restricted'] as const;
export type DataClass = (typeof DataClassLevels)[number];

export interface PermittedSourceRule {
  id: string;
  dataClass: DataClass;
  permittedSources: string[];
  blockedSources: string[];
  requiresApproval: boolean;
  approverRoleRequired?: string;
  maxRetentionDays?: number;
}

export interface DataClassificationResult {
  artifactId: string;
  artifactType: string;
  dataClass: DataClass;
  reason: string;
  permittedForAI: boolean;
  requiresApproval: boolean;
}

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  userId: string;
  actionType: string;
  dataClass: DataClass;
  contextJson: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

const FINANCIAL_TYPES = ['financial_analysis', 'valuation', 'budget'];
const HR_TYPES = ['user_profile', 'performance_review', 'salary'];
const STRATEGY_TYPES = ['strategy', 'roadmap', 'competitive_analysis'];
const WORK_TYPES = ['task', 'decision', 'initiative', 'raid_item', 'tool_session'];
const PUBLIC_TYPES = ['knowledge_base', 'help_doc', 'template'];

export function classifyDataClass(
  artifactType: string,
  metadata?: Record<string, any>
): DataClass {
  if (FINANCIAL_TYPES.includes(artifactType)) return 'confidential';
  if (HR_TYPES.includes(artifactType)) return 'restricted';
  if (STRATEGY_TYPES.includes(artifactType)) return 'confidential';
  if (artifactType === 'assessment' && metadata?.hasClientData) return 'confidential';
  if (WORK_TYPES.includes(artifactType)) return 'internal';
  if (PUBLIC_TYPES.includes(artifactType)) return 'public';
  return 'internal';
}

export async function classifyAndPersist(
  orgId: string,
  artifactType: string,
  artifactId: string,
  metadata?: Record<string, any>
): Promise<DataClassificationResult> {
  const dataClass = classifyDataClass(artifactType, metadata);
  const { permitted, requiresApproval, reason } = await checkPermittedSource(
    orgId,
    artifactType,
    dataClass
  );

  try {
    await dbRun(
      `INSERT INTO ai_data_classifications (organization_id, artifact_type, artifact_id, data_class, classified_by, classified_at)
       VALUES (?, ?, ?, ?, 'system', NOW())
       ON CONFLICT (organization_id, artifact_type, artifact_id)
       DO UPDATE SET data_class = EXCLUDED.data_class, classified_at = NOW()`,
      [orgId, artifactType, artifactId, dataClass],
      { fallback: true } as any
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[DataClassification] Failed to persist classification: ${msg}`);
  }

  return {
    artifactId,
    artifactType,
    dataClass,
    reason,
    permittedForAI: permitted,
    requiresApproval,
  };
}

export async function checkPermittedSource(
  orgId: string,
  artifactType: string,
  dataClass: DataClass
): Promise<{ permitted: boolean; requiresApproval: boolean; reason: string }> {
  try {
    const rows = await dbAll<{ config_json: string }>(
      `SELECT config_json FROM ai_governance_policies
       WHERE organization_id = ? AND policy_type = 'data_classification' AND is_active = TRUE`,
      [orgId],
      { fallback: true } as any
    );

    for (const row of rows || []) {
      let config: PermittedSourceRule;
      try {
        config = JSON.parse(row.config_json);
      } catch {
        continue;
      }

      if (config.dataClass !== dataClass) continue;

      if (config.blockedSources?.length && config.blockedSources.includes(artifactType)) {
        return {
          permitted: false,
          requiresApproval: false,
          reason: `Artifact type '${artifactType}' is blocked for data class '${dataClass}' by org policy`,
        };
      }

      if (config.permittedSources?.length && !config.permittedSources.includes(artifactType)) {
        return {
          permitted: false,
          requiresApproval: false,
          reason: `Artifact type '${artifactType}' is not in permitted sources for data class '${dataClass}'`,
        };
      }

      if (config.requiresApproval) {
        return {
          permitted: true,
          requiresApproval: true,
          reason: `Data class '${dataClass}' requires approval per org policy`,
        };
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[DataClassification] Failed to check permitted source: ${msg}`);
  }

  if (dataClass === 'restricted') {
    return {
      permitted: true,
      requiresApproval: true,
      reason: 'Restricted data always requires approval',
    };
  }

  return {
    permitted: true,
    requiresApproval: false,
    reason: 'Permitted by default policy',
  };
}

export async function checkApprovalGate(
  orgId: string,
  actionType: string,
  dataClass: DataClass,
  estimatedImpact?: string
): Promise<{ requiresApproval: boolean; reason: string; approverRole?: string }> {
  if (dataClass === 'restricted') {
    return {
      requiresApproval: true,
      reason: 'Restricted data always requires approval',
      approverRole: 'admin',
    };
  }

  if (dataClass === 'confidential' && estimatedImpact === 'high') {
    return {
      requiresApproval: true,
      reason: 'Confidential data with high impact requires approval',
      approverRole: 'admin',
    };
  }

  const mutatingActions = ['create', 'update', 'delete', 'export', 'share'];
  if (dataClass === 'confidential' && mutatingActions.includes(actionType)) {
    return {
      requiresApproval: true,
      reason: `Mutating action '${actionType}' on confidential data requires approval`,
      approverRole: 'manager',
    };
  }

  try {
    const rows = await dbAll<{ config_json: string }>(
      `SELECT config_json FROM ai_governance_policies
       WHERE organization_id = ? AND policy_type = 'approval_gate' AND is_active = TRUE`,
      [orgId],
      { fallback: true } as any
    );

    for (const row of rows || []) {
      let config: any;
      try {
        config = JSON.parse(row.config_json);
      } catch {
        continue;
      }

      if (config.dataClasses?.includes(dataClass) && config.actionTypes?.includes(actionType)) {
        return {
          requiresApproval: true,
          reason: config.reason || 'Required by custom org approval policy',
          approverRole: config.approverRole || 'admin',
        };
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[DataClassification] Failed to check approval gate: ${msg}`);
  }

  return { requiresApproval: false, reason: 'No approval required' };
}

export async function createApprovalRequest(
  orgId: string,
  userId: string,
  actionType: string,
  dataClass: DataClass,
  context?: Record<string, any>
): Promise<ApprovalRequest> {
  const id = `apr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const contextJson = context ? JSON.stringify(context) : null;

  await dbRun(
    `INSERT INTO ai_approval_requests (id, organization_id, user_id, action_type, data_class, context_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
    [id, orgId, userId, actionType, dataClass, contextJson],
    { fallback: true } as any
  );

  return {
    id,
    organizationId: orgId,
    userId,
    actionType,
    dataClass,
    contextJson,
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: new Date().toISOString(),
  };
}

export async function listApprovalRequests(
  orgId: string,
  status?: string
): Promise<ApprovalRequest[]> {
  const where = status
    ? `WHERE organization_id = ? AND status = ?`
    : `WHERE organization_id = ?`;
  const params = status ? [orgId, status] : [orgId];

  const rows = await dbAll<any>(
    `SELECT id, organization_id, user_id, action_type, data_class, context_json, status,
            approved_by, approved_at, rejection_reason, created_at
     FROM ai_approval_requests ${where} ORDER BY created_at DESC`,
    params,
    { fallback: true } as any
  );

  return (rows || []).map((r: any) => ({
    id: r.id,
    organizationId: r.organization_id,
    userId: r.user_id,
    actionType: r.action_type,
    dataClass: r.data_class,
    contextJson: r.context_json,
    status: r.status,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    rejectionReason: r.rejection_reason,
    createdAt: r.created_at,
  }));
}

export async function approveRequest(
  requestId: string,
  orgId: string,
  approvedBy: string
): Promise<ApprovalRequest | null> {
  await dbRun(
    `UPDATE ai_approval_requests SET status = 'approved', approved_by = ?, approved_at = NOW()
     WHERE id = ? AND organization_id = ? AND status = 'pending'`,
    [approvedBy, requestId, orgId],
    { fallback: true } as any
  );

  const row = await dbGet<any>(
    `SELECT * FROM ai_approval_requests WHERE id = ? AND organization_id = ?`,
    [requestId, orgId],
    { fallback: true } as any
  );

  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    actionType: row.action_type,
    dataClass: row.data_class,
    contextJson: row.context_json,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

export async function rejectRequest(
  requestId: string,
  orgId: string,
  rejectedBy: string,
  reason: string
): Promise<ApprovalRequest | null> {
  await dbRun(
    `UPDATE ai_approval_requests SET status = 'rejected', approved_by = ?, approved_at = NOW(), rejection_reason = ?
     WHERE id = ? AND organization_id = ? AND status = 'pending'`,
    [rejectedBy, reason, requestId, orgId],
    { fallback: true } as any
  );

  const row = await dbGet<any>(
    `SELECT * FROM ai_approval_requests WHERE id = ? AND organization_id = ?`,
    [requestId, orgId],
    { fallback: true } as any
  );

  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    actionType: row.action_type,
    dataClass: row.data_class,
    contextJson: row.context_json,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

export default {
  classifyDataClass,
  classifyAndPersist,
  checkPermittedSource,
  checkApprovalGate,
  createApprovalRequest,
  listApprovalRequests,
  approveRequest,
  rejectRequest,
};
