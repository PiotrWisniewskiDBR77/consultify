/**
 * Document Governance (T121)
 * Per-project overrides, per-document ai_visibility, sensitivity, audit.
 */
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export type AIVisibility = 'allowed' | 'blocked' | 'requires_approval';
export type Sensitivity = 'public' | 'internal' | 'confidential';

export interface DocumentAccessResult {
  allowed: string[];
  blocked: string[];
  requiresApproval: string[];
  approvedViaConversation?: string[];
}

export async function filterDocumentsByVisibility(
  docIds: string[],
  projectId?: string,
  conversationId?: string
): Promise<DocumentAccessResult> {
  const result: DocumentAccessResult = {
    allowed: [],
    blocked: [],
    requiresApproval: [],
    approvedViaConversation: [],
  };
  if (!docIds.length) return result;

  try {
    const placeholders = docIds.map(() => '?').join(',');
    const rows = (await dbAll(
      `SELECT id, ai_visibility, sensitivity FROM knowledge_docs WHERE id IN (${placeholders})`,
      docIds
    )) as Array<{
      id: string;
      ai_visibility?: string;
      sensitivity?: string;
    }>;

    let projectDocPolicy: { ai_documents_disabled?: boolean } | null = null;
    if (projectId) {
      try {
        const proj = (await dbGet(`SELECT governance_settings FROM projects WHERE id = ?`, [
          projectId,
        ])) as { governance_settings?: string } | undefined;
        if (proj?.governance_settings) {
          projectDocPolicy =
            typeof proj.governance_settings === 'string'
              ? JSON.parse(proj.governance_settings)
              : proj.governance_settings;
        }
      } catch {
        /* governance_settings may not exist */
      }
    }

    if (projectDocPolicy?.ai_documents_disabled) {
      for (const id of docIds) result.blocked.push(id);
      return result;
    }

    for (const row of rows || []) {
      const vis = row.ai_visibility || 'allowed';
      const sens = row.sensitivity || 'internal';
      if (vis === 'blocked' || sens === 'confidential') {
        result.blocked.push(row.id);
      } else if (vis === 'requires_approval') {
        result.requiresApproval.push(row.id);
      } else {
        result.allowed.push(row.id);
      }
    }

    // Conversation-scoped HITL: allow requires_approval documents only after explicit approval.
    if (conversationId && result.requiresApproval.length > 0) {
      try {
        const placeholders = result.requiresApproval.map(() => '?').join(',');
        const rows = (await dbAll(
          `SELECT document_id FROM ai_doc_access_approvals
           WHERE conversation_id = ?
             AND document_id IN (${placeholders})
             AND status = 'approved'`,
          [conversationId, ...result.requiresApproval]
        )) as Array<{ document_id: string }>;
        const approved = (rows || []).map((r) => r.document_id).filter(Boolean);
        if (approved.length > 0) {
          result.approvedViaConversation = approved;
          // Move approved docs from requiresApproval to allowed
          result.allowed.push(...approved);
          result.requiresApproval = result.requiresApproval.filter((id) => !approved.includes(id));
        }
      } catch {
        // approvals table may not exist yet
      }
    }

    for (const id of docIds) {
      if (
        !result.allowed.includes(id) &&
        !result.blocked.includes(id) &&
        !result.requiresApproval.includes(id)
      ) {
        result.blocked.push(id);
      }
    }
  } catch {
    logger.warn('[DocGov] filterDocumentsByVisibility failed — fail-closed');
    return { allowed: [], blocked: docIds, requiresApproval: [] };
  }

  return result;
}

export async function setDocumentVisibility(
  docId: string,
  visibility: AIVisibility
): Promise<void> {
  try {
    await dbRun(
      `UPDATE knowledge_docs SET ai_visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [visibility, docId]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[DocGov] Failed to set visibility: ${msg}`);
    throw err;
  }
}

export async function setDocumentSensitivity(
  docId: string,
  sensitivity: Sensitivity
): Promise<void> {
  try {
    await dbRun(
      `UPDATE knowledge_docs SET sensitivity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [sensitivity, docId]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[DocGov] Failed to set sensitivity: ${msg}`);
    throw err;
  }
}

export async function logDocumentUsage(
  chatRunId: string,
  organizationId: string,
  projectId: string | null,
  userId: string,
  usedDocIds: string[],
  blockedDocIds: string[]
): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO ai_doc_usage_log (id, chat_run_id, organization_id, project_id, user_id, used_document_ids_json, blocked_document_ids_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        `dul_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        chatRunId,
        organizationId,
        projectId,
        userId,
        JSON.stringify(usedDocIds),
        JSON.stringify(blockedDocIds),
      ]
    );
  } catch {
    // Non-critical — table may not exist yet
  }
}

async function ensureApprovalsTable(): Promise<void> {
  // Minimal, SQLite-friendly DDL (Postgres will also accept IF NOT EXISTS in most setups).
  // If the environment uses migrations instead, this is a harmless no-op.
  try {
    await dbRun(
      `CREATE TABLE IF NOT EXISTS ai_doc_access_approvals (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        document_id TEXT,
        user_id TEXT,
        organization_id TEXT,
        status TEXT DEFAULT 'approved',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      []
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_ai_doc_access_approvals_conv ON ai_doc_access_approvals(conversation_id)`,
      []
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_ai_doc_access_approvals_doc ON ai_doc_access_approvals(document_id)`,
      []
    );
  } catch {
    // ignore
  }
}

export async function approveDocumentForConversation(params: {
  conversationId: string;
  documentId: string;
  userId: string;
  organizationId: string;
}): Promise<void> {
  const { conversationId, documentId, userId, organizationId } = params;
  if (!conversationId || !documentId) return;

  await ensureApprovalsTable();
  try {
    await dbRun(
      `INSERT INTO ai_doc_access_approvals (id, conversation_id, document_id, user_id, organization_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'approved', datetime('now'))`,
      [
        `dapp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        conversationId,
        documentId,
        userId,
        organizationId,
      ]
    );
  } catch {
    // ignore duplicates / schema differences
  }
}

export default {
  filterDocumentsByVisibility,
  setDocumentVisibility,
  setDocumentSensitivity,
  logDocumentUsage,
  approveDocumentForConversation,
};
