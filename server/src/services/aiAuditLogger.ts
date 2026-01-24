/**
 * AI Audit Logger - Full audit trail for AI actions
 * AI Core Layer — Enterprise PMO Brain
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

let all = dbAll;
let get = dbGet;
let run = dbRun;

// ==========================================
// TYPES & CONSTANTS
// ==========================================

export interface AIAuditEntry {
  userId: string;
  organizationId: string;
  projectId: string | null;
  actionType: string;
  actionDescription: string;
  contextSnapshot?: any;
  dataSourcesUsed?: string[];
  aiRole: string;
  policyLevel: string;
  confidenceLevel?: string;
  aiSuggestion?: string;
  userDecision?: string | null;
  userFeedback?: string | null;
  // AI Roles Model fields
  aiProjectRole?: string;
  justification?: string | null;
  approvingUser?: string | null;
  // AI Trust & Explainability fields
  regulatoryMode?: boolean;
  reasoningSummary?: string | null;
  dataUsed?: any;
  constraintsApplied?: any[];
  // Observability
  correlationId?: string | null;
}

export interface AIAuditLogRecord extends AIAuditEntry {
  id: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  data_used_json?: string;
  constraints_applied_json?: string;
  context_snapshot?: string;
  data_sources_used?: string;
  ai_role?: string;
  policy_level?: string;
  confidence_level?: string;
  ai_project_role?: string;
  regulatory_mode?: number;
  reasoning_summary?: string;
  explanation?: any;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

export const AIAuditLogger = {
  /**
   * Set dependencies for testing
   */
  _setDependencies(deps: any) {
    if (deps.db) {
      all = deps.db.all;
      get = deps.db.get;
      run = deps.db.run;
    }
  },

  /**
   * Log an AI interaction with full explainability support
   */
  logInteraction: async (entry: AIAuditEntry) => {
    const id = uuidv4();
    const {
      userId,
      organizationId,
      projectId,
      actionType,
      actionDescription,
      contextSnapshot,
      dataSourcesUsed,
      aiRole,
      policyLevel,
      confidenceLevel,
      aiSuggestion,
      userDecision,
      userFeedback,
      aiProjectRole,
      justification,
      approvingUser,
      regulatoryMode,
      reasoningSummary,
      dataUsed,
      constraintsApplied,
      correlationId,
    } = entry;

    const result = await run(
      `INSERT INTO ai_audit_logs 
            (id, user_id, organization_id, project_id, action_type, action_description,
             context_snapshot, data_sources_used, ai_role, policy_level, confidence_level,
             ai_suggestion, user_decision, user_feedback,
             ai_project_role, justification, approving_user,
             regulatory_mode, reasoning_summary, data_used_json, constraints_applied_json, correlation_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        organizationId,
        projectId,
        actionType,
        actionDescription,
        typeof contextSnapshot === 'string'
          ? contextSnapshot
          : JSON.stringify(contextSnapshot || {}),
        JSON.stringify(dataSourcesUsed || []),
        aiRole,
        policyLevel,
        confidenceLevel || 'MEDIUM',
        aiSuggestion || null,
        userDecision || null,
        userFeedback || null,
        aiProjectRole || 'ADVISOR',
        justification || null,
        approvingUser || null,
        regulatoryMode ? 1 : 0,
        reasoningSummary || null,
        dataUsed ? JSON.stringify(dataUsed) : null,
        constraintsApplied ? JSON.stringify(constraintsApplied) : null,
        correlationId || null,
      ]
    );

    if (!result.success) {
      throw new Error(`Failed to log AI interaction: ${result.error}`);
    }

    return { id, actionType, aiProjectRole: aiProjectRole || 'ADVISOR' };
  },

  /**
   * Log AI interaction with full AIExplanation object
   */
  logWithExplanation: async ({
    userId,
    organizationId,
    projectId,
    explanation,
    aiResponse,
    actionType = 'AI_RESPONSE',
    correlationId,
  }: any) => {
    return AIAuditLogger.logInteraction({
      userId,
      organizationId,
      projectId,
      actionType,
      actionDescription: 'AI response with explainability metadata',
      contextSnapshot: null,
      dataSourcesUsed: explanation?.dataUsed?.externalSources || [],
      aiRole: explanation?.aiRole || 'ADVISOR',
      policyLevel: 'ADVISORY',
      confidenceLevel: explanation?.confidenceLevel || 'MEDIUM',
      aiSuggestion: aiResponse,
      aiProjectRole: explanation?.aiRole || 'ADVISOR',
      regulatoryMode: explanation?.regulatoryMode || false,
      reasoningSummary: explanation?.reasoningSummary || null,
      dataUsed: explanation?.dataUsed || null,
      constraintsApplied: explanation?.constraintsApplied || [],
      correlationId,
    });
  },

  /**
   * Log AI suggestion
   */
  logSuggestion: async (
    userId: string,
    organizationId: string,
    projectId: string | null,
    aiRole: string,
    suggestion: string,
    context: any
  ) => {
    return AIAuditLogger.logInteraction({
      userId,
      organizationId,
      projectId,
      actionType: 'SUGGESTION',
      actionDescription: 'AI provided suggestion',
      contextSnapshot: context,
      aiRole,
      policyLevel: 'ADVISORY',
      aiSuggestion: suggestion,
      confidenceLevel: 'MEDIUM',
    });
  },

  /**
   * Update user decision on a logged suggestion
   */
  recordUserDecision: async (auditId: string, decision: string, feedback: string | null = null) => {
    const result = await run(
      `UPDATE ai_audit_logs 
                SET user_decision = ?, user_feedback = ?
                WHERE id = ?`,
      [decision, feedback, auditId]
    );

    return { updated: result.success && (result.changes || 0) > 0 };
  },

  /**
   * Get audit logs for organization with explainability data
   */
  getAuditLogs: async (organizationId: string, options: any = {}): Promise<AIAuditLogRecord[]> => {
    const { projectId, userId, actionType, limit, offset, includeExplanation } = options;

    let sql = `SELECT al.*, u.first_name, u.last_name 
                   FROM ai_audit_logs al
                   LEFT JOIN users u ON al.user_id = u.id
                   WHERE al.organization_id = ?`;
    const params: any[] = [organizationId];

    if (projectId) {
      sql += ` AND al.project_id = ?`;
      params.push(projectId);
    }
    if (userId) {
      sql += ` AND al.user_id = ?`;
      params.push(userId);
    }
    if (actionType) {
      sql += ` AND al.action_type = ?`;
      params.push(actionType);
    }

    sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit || 50, offset || 0);

    const rows = await all<AIAuditLogRecord>(sql, params);

    return (rows || []).map((row) => {
      try {
        row.contextSnapshot = JSON.parse(row.context_snapshot || '{}');
        row.dataSourcesUsed = JSON.parse(row.data_sources_used || '[]');

        if (includeExplanation !== false) {
          row.dataUsed = row.data_used_json ? JSON.parse(row.data_used_json) : null;
          row.constraintsApplied = row.constraints_applied_json
            ? JSON.parse(row.constraints_applied_json)
            : [];

          row.explanation = {
            aiRole: row.ai_project_role || row.ai_role || row.aiRole,
            regulatoryMode: row.regulatory_mode === 1 || (row as any).regulatoryMode === true,
            confidenceLevel: row.confidence_level || row.confidenceLevel,
            reasoningSummary: row.reasoning_summary || row.reasoningSummary,
            dataUsed: row.dataUsed,
            constraintsApplied: row.constraintsApplied,
            timestamp: row.created_at,
          };
        }
      } catch (e: unknown) {}
      return row;
    });
  },

  /**
   * Get audit statistics
   */
  getAuditStats: async (organizationId: string, projectId: string | null = null) => {
    let sql = `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN user_decision = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
                    SUM(CASE WHEN user_decision = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN user_decision = 'MODIFIED' THEN 1 ELSE 0 END) as modified,
                    SUM(CASE WHEN user_decision = 'IGNORED' THEN 1 ELSE 0 END) as ignored,
                    SUM(CASE WHEN user_decision IS NULL THEN 1 ELSE 0 END) as pending
                   FROM ai_audit_logs WHERE organization_id = ?`;
    const params = [organizationId];

    if (projectId) {
      sql += ` AND project_id = ?`;
      params.push(projectId);
    }

    const row: any = await get(sql, params);

    const total = row?.total || 0;
    const accepted = row?.accepted || 0;

    return {
      total,
      accepted,
      rejected: row?.rejected || 0,
      modified: row?.modified || 0,
      ignored: row?.ignored || 0,
      pending: row?.pending || 0,
      acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
    };
  },

  /**
   * Get role distribution
   */
  getRoleDistribution: async (organizationId: string) => {
    return all<any>(
      `SELECT ai_role, COUNT(*) as count 
                FROM ai_audit_logs WHERE organization_id = ?
                GROUP BY ai_role`,
      [organizationId]
    );
  },

  /**
   * Clear old audit logs (retention policy)
   */
  clearOldLogs: async (organizationId: string, daysToKeep = 90) => {
    const result = await run(
      `DELETE FROM ai_audit_logs 
                WHERE organization_id = ? 
                AND created_at < datetime('now', '-' || ? || ' days')`,
      [organizationId, daysToKeep]
    );

    return { deleted: result.changes };
  },
};

export default AIAuditLogger;
