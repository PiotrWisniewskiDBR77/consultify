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
}

export async function filterDocumentsByVisibility(
  docIds: string[],
  projectId?: string
): Promise<DocumentAccessResult> {
  const result: DocumentAccessResult = {
    allowed: [],
    blocked: [],
    requiresApproval: [],
  };
  if (!docIds.length) return result;

  try {
    const placeholders = docIds.map(() => '?').join(',');
    const rows = (await dbAll(
      `SELECT id, ai_visibility, sensitivity FROM knowledge_documents WHERE id IN (${placeholders})`,
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

    for (const id of docIds) {
      if (
        !result.allowed.includes(id) &&
        !result.blocked.includes(id) &&
        !result.requiresApproval.includes(id)
      ) {
        result.allowed.push(id);
      }
    }
  } catch {
    logger.warn('[DocGov] filterDocumentsByVisibility failed — fail-open');
    return { allowed: docIds, blocked: [], requiresApproval: [] };
  }

  return result;
}

export async function setDocumentVisibility(
  docId: string,
  visibility: AIVisibility
): Promise<void> {
  try {
    await dbRun(
      `UPDATE knowledge_documents SET ai_visibility = ?, updated_at = datetime('now') WHERE id = ?`,
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
      `UPDATE knowledge_documents SET sensitivity = ?, updated_at = datetime('now') WHERE id = ?`,
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

export default {
  filterDocumentsByVisibility,
  setDocumentVisibility,
  setDocumentSensitivity,
  logDocumentUsage,
};
