/**
 * Knowledge Service
 * Stub implementation for knowledge management
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

export class KnowledgeService {
  static async getCandidates(status: string = 'pending') {
    return dbAll('SELECT * FROM knowledge_candidates WHERE status = ?', [status]);
  }

  static async addCandidate(
    content: string,
    reasoning: string,
    source: string,
    relatedAxis?: string,
    originContext?: string
  ) {
    const id = uuidv4();
    await dbRun(
      `INSERT INTO knowledge_candidates (id, content, reasoning, source, status, related_axis, origin_context, created_at)
             VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))`,
      [id, content, reasoning, source, relatedAxis || null, originContext || null]
    );
    return id;
  }

  static async updateCandidateStatus(id: string, status: string, adminComment?: string) {
    await dbRun('UPDATE knowledge_candidates SET status = ?, admin_comment = ? WHERE id = ?', [
      status,
      adminComment || null,
      id,
    ]);
  }

  static async updateCandidate(id: string, updates: any) {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const params = [...Object.values(updates), id];

    await dbRun(`UPDATE knowledge_candidates SET ${setClause} WHERE id = ?`, params);
  }

  static async getAllStrategies() {
    return dbAll('SELECT * FROM global_strategies', []);
  }

  static async getActiveStrategies() {
    return dbAll('SELECT * FROM global_strategies WHERE is_active = 1', []);
  }

  static async addStrategy(title: string, description: string, createdBy: string, options: any) {
    const id = uuidv4();
    await dbRun(
      `INSERT INTO global_strategies (id, title, description, created_by, success_metrics, priority, target_date, progress_percentage, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      [
        id,
        title,
        description,
        createdBy,
        JSON.stringify(options.success_metrics || []),
        options.priority || 'medium',
        options.target_date || null,
        options.progress_percentage || 0,
      ]
    );
    return id;
  }

  static async updateStrategy(id: string, updates: any) {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const params = [...Object.values(updates), id];

    await dbRun(`UPDATE global_strategies SET ${setClause} WHERE id = ?`, params);
  }

  static async addDocument(
    filename: string,
    filepath: string,
    orgId: string,
    projectId: string | null,
    size: number,
    category: string | null,
    tags: string[]
  ) {
    const id = uuidv4();
    await dbRun(
      `INSERT INTO knowledge_docs (id, filename, filepath, organization_id, project_id, file_size_bytes, status, category, tags, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'indexed', ?, ?, datetime('now'))`,
      [id, filename, filepath, orgId, projectId, size, category, JSON.stringify(tags)]
    );
    return id;
  }

  static async processDocument(docId: string, text: string) {
    // Dummy processing
    return 1;
  }

  static async getDocuments(orgId: string, userId: string, role: string) {
    return dbAll('SELECT * FROM knowledge_docs WHERE organization_id = ?', [orgId]);
  }

  static async getDocumentsByCategory(orgId: string, category: string) {
    return dbAll('SELECT * FROM knowledge_docs WHERE organization_id = ? AND category = ?', [
      orgId,
      category,
    ]);
  }

  static async getDocumentsByStrategy(strategyId: string) {
    // Get strategy's related document IDs and fetch them
    const strategy = await dbGet<{ related_document_ids: string }>(
      'SELECT related_document_ids FROM global_strategies WHERE id = ?',
      [strategyId]
    );
    if (!strategy || !strategy.related_document_ids) return [];

    const docIds =
      typeof strategy.related_document_ids === 'string'
        ? JSON.parse(strategy.related_document_ids)
        : strategy.related_document_ids;

    if (!docIds.length) return [];

    const placeholders = docIds.map(() => '?').join(',');
    return dbAll(`SELECT * FROM knowledge_docs WHERE id IN (${placeholders})`, docIds);
  }

  // ==========================================
  // APPROVED IDEAS / LIBRARY
  // ==========================================

  static async getApprovedIdeas(filters?: { category?: string }) {
    let sql = 'SELECT * FROM knowledge_candidates WHERE status = ?';
    const params: any[] = ['approved'];

    if (filters?.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }

    sql += ' ORDER BY created_at DESC';
    return dbAll(sql, params);
  }

  static async getIdeasByCategory(category: string) {
    return dbAll('SELECT * FROM knowledge_candidates WHERE category = ? AND status = ?', [
      category,
      'approved',
    ]);
  }

  static async getIdeasByProject(projectId: string) {
    // Ideas linked to a project via related_project_ids
    return dbAll('SELECT * FROM knowledge_candidates WHERE related_project_ids LIKE ?', [
      `%${projectId}%`,
    ]);
  }

  static async linkIdeaToProject(ideaId: string, projectId: string, notes: string) {
    // Get current project IDs
    const idea = await dbGet<{ related_project_ids: string }>(
      'SELECT related_project_ids FROM knowledge_candidates WHERE id = ?',
      [ideaId]
    );
    if (!idea) throw new Error('Idea not found');

    const currentIds = idea.related_project_ids
      ? typeof idea.related_project_ids === 'string'
        ? JSON.parse(idea.related_project_ids)
        : idea.related_project_ids
      : [];

    if (!currentIds.includes(projectId)) {
      currentIds.push(projectId);
    }

    await dbRun(
      'UPDATE knowledge_candidates SET related_project_ids = ?, implementation_notes = ? WHERE id = ?',
      [JSON.stringify(currentIds), notes, ideaId]
    );

    return { changes: 1 };
  }

  // ==========================================
  // STRATEGY MANAGEMENT
  // ==========================================

  static async toggleStrategy(id: string, isActive: boolean) {
    await dbRun('UPDATE global_strategies SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
  }

  static async updateStrategyProgress(id: string, progress: number) {
    await dbRun('UPDATE global_strategies SET progress_percentage = ? WHERE id = ?', [
      progress,
      id,
    ]);
    return { changes: 1 };
  }

  static async getStrategyWithRelated(id: string) {
    const strategy = await dbGet<any>('SELECT * FROM global_strategies WHERE id = ?', [id]);
    if (!strategy) return null;

    // Parse JSON fields
    if (strategy.success_metrics && typeof strategy.success_metrics === 'string') {
      strategy.success_metrics = JSON.parse(strategy.success_metrics);
    }
    if (strategy.related_document_ids && typeof strategy.related_document_ids === 'string') {
      strategy.related_document_ids = JSON.parse(strategy.related_document_ids);
    }
    if (strategy.related_idea_ids && typeof strategy.related_idea_ids === 'string') {
      strategy.related_idea_ids = JSON.parse(strategy.related_idea_ids);
    }

    // Fetch related documents
    const relatedDocs = strategy.related_document_ids?.length
      ? await this.getDocumentsByStrategy(id)
      : [];

    // Fetch related ideas
    const relatedIdeas = strategy.related_idea_ids?.length
      ? await dbAll(
          `SELECT * FROM knowledge_candidates WHERE id IN (${strategy.related_idea_ids.map(() => '?').join(',')})`,
          strategy.related_idea_ids
        )
      : [];

    return {
      ...strategy,
      relatedDocuments: relatedDocs,
      relatedIdeas: relatedIdeas,
    };
  }

  static async linkStrategyToDocument(strategyId: string, documentId: string) {
    const strategy = await dbGet<{ related_document_ids: string }>(
      'SELECT related_document_ids FROM global_strategies WHERE id = ?',
      [strategyId]
    );
    if (!strategy) throw new Error('Strategy not found');

    const currentIds = strategy.related_document_ids
      ? typeof strategy.related_document_ids === 'string'
        ? JSON.parse(strategy.related_document_ids)
        : strategy.related_document_ids
      : [];

    if (!currentIds.includes(documentId)) {
      currentIds.push(documentId);
    }

    await dbRun('UPDATE global_strategies SET related_document_ids = ? WHERE id = ?', [
      JSON.stringify(currentIds),
      strategyId,
    ]);
    return { changes: 1 };
  }

  static async linkStrategyToIdea(strategyId: string, ideaId: string) {
    const strategy = await dbGet<{ related_idea_ids: string }>(
      'SELECT related_idea_ids FROM global_strategies WHERE id = ?',
      [strategyId]
    );
    if (!strategy) throw new Error('Strategy not found');

    const currentIds = strategy.related_idea_ids
      ? typeof strategy.related_idea_ids === 'string'
        ? JSON.parse(strategy.related_idea_ids)
        : strategy.related_idea_ids
      : [];

    if (!currentIds.includes(ideaId)) {
      currentIds.push(ideaId);
    }

    await dbRun('UPDATE global_strategies SET related_idea_ids = ? WHERE id = ?', [
      JSON.stringify(currentIds),
      strategyId,
    ]);
    return { changes: 1 };
  }

  static async unlinkStrategyFromDocument(strategyId: string, documentId: string) {
    const strategy = await dbGet<{ related_document_ids: string }>(
      'SELECT related_document_ids FROM global_strategies WHERE id = ?',
      [strategyId]
    );
    if (!strategy) throw new Error('Strategy not found');

    const currentIds = strategy.related_document_ids
      ? typeof strategy.related_document_ids === 'string'
        ? JSON.parse(strategy.related_document_ids)
        : strategy.related_document_ids
      : [];

    const newIds = currentIds.filter((id: string) => id !== documentId);

    await dbRun('UPDATE global_strategies SET related_document_ids = ? WHERE id = ?', [
      JSON.stringify(newIds),
      strategyId,
    ]);
    return { changes: 1 };
  }

  static async unlinkStrategyFromIdea(strategyId: string, ideaId: string) {
    const strategy = await dbGet<{ related_idea_ids: string }>(
      'SELECT related_idea_ids FROM global_strategies WHERE id = ?',
      [strategyId]
    );
    if (!strategy) throw new Error('Strategy not found');

    const currentIds = strategy.related_idea_ids
      ? typeof strategy.related_idea_ids === 'string'
        ? JSON.parse(strategy.related_idea_ids)
        : strategy.related_idea_ids
      : [];

    const newIds = currentIds.filter((id: string) => id !== ideaId);

    await dbRun('UPDATE global_strategies SET related_idea_ids = ? WHERE id = ?', [
      JSON.stringify(newIds),
      strategyId,
    ]);
    return { changes: 1 };
  }
}

export default KnowledgeService;
