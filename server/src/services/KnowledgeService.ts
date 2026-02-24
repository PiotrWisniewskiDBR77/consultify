/**
 * Knowledge Service — provides strategic knowledge context for AI.
 *
 * Replaces the stub in aiContextBuilder.ts with real database queries
 * for knowledge documents, strategic directions, and approved ideas.
 */

import { dbAll, dbGet } from '../database/db.js';
import logger from '../utils/Logger.js';
import { queryRun } from '../utils/queryHelpers.js';

// Use dbAll/dbGet helpers; fall back to raw if needed
const all = async (sql: string, params: any[] = []): Promise<any[]> => {
  try {
    return (await dbAll(sql, params)) || [];
  } catch {
    return [];
  }
};

const get = async (sql: string, params: any[] = []): Promise<any> => {
  try {
    return await dbGet(sql, params);
  } catch {
    return null;
  }
};

const run = async (sql: string, params: any[] = []): Promise<{ changes: number; lastID?: number }> => {
  try {
    return (await queryRun(sql, params)) as { changes: number; lastID?: number };
  } catch {
    return { changes: 0 };
  }
};

export const knowledgeService = {
  /**
   * Get active strategic directions for an organization.
   * Queries organization_context for strategic goals/challenges.
   */
  async getActiveStrategies(organizationId?: string): Promise<any[]> {
    if (!organizationId) return [];

    try {
      // Try organization_context table (strategic goals, challenges, megatrends)
      const ctx = await get(
        `SELECT strategic_goals, challenges, megatrends, company_name, industry
         FROM organization_context
         WHERE organization_id = ?`,
        [organizationId]
      );

      if (!ctx) return [];

      const strategies: any[] = [];

      // Parse strategic goals
      if (ctx.strategic_goals) {
        try {
          const goals =
            typeof ctx.strategic_goals === 'string'
              ? JSON.parse(ctx.strategic_goals)
              : ctx.strategic_goals;
          if (Array.isArray(goals)) {
            goals.forEach((g: any, i: number) => {
              strategies.push({
                title: typeof g === 'string' ? g : g.title || g.name || `Goal ${i + 1}`,
                description: typeof g === 'string' ? g : g.description || '',
                priority: g.priority || 'medium',
                type: 'strategic_goal',
              });
            });
          }
        } catch {
          // Might be a plain text field
          strategies.push({
            title: 'Strategic Goals',
            description: String(ctx.strategic_goals).slice(0, 500),
            priority: 'high',
            type: 'strategic_goal',
          });
        }
      }

      // Parse challenges
      if (ctx.challenges) {
        try {
          const challenges =
            typeof ctx.challenges === 'string' ? JSON.parse(ctx.challenges) : ctx.challenges;
          if (Array.isArray(challenges)) {
            challenges.forEach((c: any, i: number) => {
              strategies.push({
                title: typeof c === 'string' ? c : c.title || c.name || `Challenge ${i + 1}`,
                description: typeof c === 'string' ? c : c.description || '',
                priority: c.priority || 'medium',
                type: 'challenge',
              });
            });
          }
        } catch {
          strategies.push({
            title: 'Key Challenges',
            description: String(ctx.challenges).slice(0, 500),
            priority: 'high',
            type: 'challenge',
          });
        }
      }

      return strategies;
    } catch (err: any) {
      logger.warn('[KnowledgeService] Failed to load strategies:', err?.message);
      return [];
    }
  },

  /**
   * Get approved ideas / generated initiatives from assessment batches.
   */
  async getApprovedIdeas(options: {
    organizationId?: string;
    projectId?: string;
    limit?: number;
  }): Promise<any[]> {
    const { organizationId, projectId, limit = 10 } = options;

    try {
      // Query initiative batches that have been generated from assessments
      let sql = `
        SELECT aib.id, aib.assessment_id, aib.methodology_id, aib.initiatives_count,
               aib.status, aib.created_at
        FROM assessment_initiative_batches aib
      `;
      const params: any[] = [];

      if (projectId) {
        sql += ` JOIN maturity_assessments ma ON aib.assessment_id = ma.id WHERE ma.project_id = ?`;
        params.push(projectId);
      } else if (organizationId) {
        sql += ` JOIN maturity_assessments ma ON aib.assessment_id = ma.id 
                 JOIN projects p ON ma.project_id = p.id 
                 WHERE p.organization_id = ?`;
        params.push(organizationId);
      }

      sql += ` ORDER BY aib.created_at DESC LIMIT ?`;
      params.push(limit);

      const batches = await all(sql, params);

      return batches.map((b: any) => ({
        id: b.id,
        content: `Initiative batch from assessment (${b.methodology_id})`,
        category: b.methodology_id,
        count: b.initiatives_count,
        status: b.status,
      }));
    } catch (err: any) {
      logger.warn('[KnowledgeService] Failed to load approved ideas:', err?.message);
      return [];
    }
  },

  /**
   * Get knowledge documents for an organization.
   * R10: Queries unified schema (knowledge_documents) with fallback to legacy (knowledge_docs).
   */
  async getDocuments(organizationId: string, projectId?: string): Promise<any[]> {
    if (!organizationId) return [];

    // Try new schema first
    try {
      const sqlWithGovernance = `
        SELECT id, title, original_filename as filename, document_type,
               description, category, tags, language, word_count,
               processing_status, created_at,
               ai_visibility, sensitivity
        FROM knowledge_documents
        WHERE (organization_id = ? OR organization_id IS NULL)
          AND processing_status IN ('completed', 'processed', 'indexed')
      `;
      const sqlBasic = `
        SELECT id, title, original_filename as filename, document_type,
               description, category, tags, language, word_count,
               processing_status, created_at
        FROM knowledge_documents
        WHERE (organization_id = ? OR organization_id IS NULL)
          AND processing_status IN ('completed', 'processed', 'indexed')
      `;
      const params: any[] = [organizationId];

      let sql = sqlWithGovernance;
      if (projectId) {
        sql += ` AND (project_id = ? OR project_id IS NULL)`;
        params.push(projectId);
      }

      sql += ` ORDER BY created_at DESC LIMIT 50`;

      let docs: any[] = [];
      try {
        docs = await all(sql, params);
      } catch {
        // Columns may not exist in some deployments yet — retry without governance fields.
        let sql2 = sqlBasic;
        const params2: any[] = [organizationId];
        if (projectId) {
          sql2 += ` AND (project_id = ? OR project_id IS NULL)`;
          params2.push(projectId);
        }
        sql2 += ` ORDER BY created_at DESC LIMIT 50`;
        docs = await all(sql2, params2);
      }
      if (docs.length > 0) return docs;
    } catch {
      // knowledge_documents table may not exist — try legacy
    }

    // Fallback to legacy knowledge_docs schema
    try {
      let sql = `
        SELECT id, filename, filepath, status as processing_status,
               filename as title, 'document' as document_type,
               created_at,
               'allowed' as ai_visibility,
               'internal' as sensitivity
        FROM knowledge_docs
        WHERE status IN ('completed', 'processed', 'indexed', 'ready')
      `;
      const params: any[] = [];

      if (projectId) {
        sql += ` AND project_id = ?`;
        params.push(projectId);
      }

      sql += ` ORDER BY created_at DESC LIMIT 50`;

      return await all(sql, params);
    } catch (err: any) {
      logger.warn('[KnowledgeService] Failed to load documents from both schemas:', err?.message);
      return [];
    }
  },

  /**
   * Update knowledge document metadata (SuperAdmin/Admin).
   * Updates unified schema (knowledge_documents) only.
   */
  async updateDocumentMetadata(
    organizationId: string,
    docId: string,
    updates: { category?: string | null; tags?: string[] | null }
  ): Promise<{ updated: boolean }> {
    if (!organizationId || !docId) return { updated: false };
    const category = updates.category ?? null;
    const tagsJson = Array.isArray(updates.tags) ? JSON.stringify(updates.tags) : null;

    try {
      const res = await run(
        `UPDATE knowledge_documents
         SET category = COALESCE(?, category),
             tags = COALESCE(?, tags),
             updated_at = datetime('now')
         WHERE id = ?
           AND (organization_id = ? OR organization_id IS NULL)`,
        [category, tagsJson, docId, organizationId]
      );
      return { updated: (res?.changes || 0) > 0 };
    } catch (err: any) {
      logger.warn('[KnowledgeService] Failed to update document metadata:', err?.message);
      return { updated: false };
    }
  },
};

export default knowledgeService;
