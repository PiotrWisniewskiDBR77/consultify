/**
 * Draft Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Manages AI-generated draft documents with DB persistence.
 */
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

class DraftServiceImpl {
  async createDraft(data: any) {
    const id = data.id || uuidv4();
    const now = new Date().toISOString();
    try {
      await dbRun(
        `INSERT INTO ai_drafts (id,user_id,organization_id,title,content,type,metadata,conversation_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          data.userId || null,
          data.organizationId || null,
          data.title || 'Untitled',
          data.content || '',
          data.type || 'other',
          JSON.stringify(data.metadata || {}),
          data.conversationId || null,
          'draft',
          now,
          now,
        ]
      );
    } catch (e) {
      logger.debug(`[DraftService] ${(e as Error).message}`);
    }
    return { id, ...data, status: 'draft', createdAt: now, updatedAt: now };
  }

  async getDraft(id: string, userId?: string) {
    try {
      const params: any[] = [id];
      let q = `SELECT * FROM ai_drafts WHERE id=?`;
      if (userId) {
        q += ' AND user_id=?';
        params.push(userId);
      }
      const row = (await dbGet(q, params)) as any;
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        organizationId: row.organization_id,
        title: row.title,
        content: row.content,
        type: row.type,
        metadata: JSON.parse(row.metadata || '{}'),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch {
      return null;
    }
  }

  async updateDraft(id: string, data: any, userId?: string) {
    const existing = await this.getDraft(id, userId);
    if (!existing) return null;
    const now = new Date().toISOString();
    try {
      await dbRun(
        `UPDATE ai_drafts SET title=?, content=?, type=?, metadata=?, status=?, updated_at=? WHERE id=?`,
        [
          data.title || existing.title,
          data.content || existing.content,
          data.type || existing.type,
          JSON.stringify(data.metadata || existing.metadata),
          data.status || existing.status,
          now,
          id,
        ]
      );
    } catch {}
    return { ...existing, ...data, updatedAt: now };
  }

  async deleteDraft(id: string, userId?: string) {
    try {
      const params: any[] = [id];
      let q = `DELETE FROM ai_drafts WHERE id=?`;
      if (userId) {
        q += ' AND user_id=?';
        params.push(userId);
      }
      const r = await dbRun(q, params);
      return { deleted: (r?.changes || 0) > 0 };
    } catch {
      return { deleted: false };
    }
  }

  async getDrafts(filter: any = {}) {
    try {
      const conds: string[] = [];
      const params: any[] = [];
      if (filter.userId) {
        conds.push('user_id=?');
        params.push(filter.userId);
      }
      if (filter.organizationId) {
        conds.push('organization_id=?');
        params.push(filter.organizationId);
      }
      if (filter.type) {
        conds.push('type=?');
        params.push(filter.type);
      }
      if (filter.status) {
        conds.push('status=?');
        params.push(filter.status);
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = (await dbAll(
        `SELECT * FROM ai_drafts ${where} ORDER BY updated_at DESC LIMIT ?`,
        [...params, filter.limit || 50]
      )) as any[];
      return (rows || []).map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        content: r.content,
        type: r.type,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch {
      return [];
    }
  }
}

export const draftService = new DraftServiceImpl();
export default draftService;
