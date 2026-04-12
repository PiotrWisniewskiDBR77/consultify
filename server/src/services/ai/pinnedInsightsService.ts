/**
 * Pinned Insights Service
 *
 * Allows users to bookmark key insights from AI conversations.
 * Pinned insights are visible on the dashboard and can be
 * integrated with the Notebook module.
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface PinnedInsight {
  id: string;
  organizationId: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
  content: string;
  tags: string[];
  isShared: boolean;
  createdAt: string;
}

class PinnedInsightsService {
  async pinInsight(input: {
    organizationId: string;
    userId: string;
    conversationId?: string;
    messageId?: string;
    content: string;
    tags?: string[];
    isShared?: boolean;
  }): Promise<PinnedInsight> {
    const id = randomUUID();

    await dbRun(
      `INSERT INTO pinned_insights
        (id, organization_id, user_id, conversation_id, message_id, content, tags, is_shared, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        input.organizationId,
        input.userId,
        input.conversationId || null,
        input.messageId || null,
        input.content,
        JSON.stringify(input.tags || []),
        input.isShared ? 1 : 0,
      ]
    );

    return {
      id,
      organizationId: input.organizationId,
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      content: input.content,
      tags: input.tags || [],
      isShared: input.isShared || false,
      createdAt: new Date().toISOString(),
    };
  }

  async listInsights(input: {
    userId: string;
    organizationId: string;
    includeShared?: boolean;
    tags?: string[];
    limit?: number;
  }): Promise<PinnedInsight[]> {
    const conditions = ['organization_id = ?'];
    const params: unknown[] = [input.organizationId];

    if (input.includeShared) {
      conditions.push('(user_id = ? OR is_shared = 1)');
      params.push(input.userId);
    } else {
      conditions.push('user_id = ?');
      params.push(input.userId);
    }

    const rows = await dbAll(
      `SELECT * FROM pinned_insights
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ?`,
      [...params, input.limit || 50]
    ).catch(() => []) as any[];

    return (rows || []).map(this.mapRow);
  }

  async unpinInsight(insightId: string, userId: string): Promise<boolean> {
    await dbRun(
      `DELETE FROM pinned_insights WHERE id = ? AND user_id = ?`,
      [insightId, userId]
    );
    return true;
  }

  async updateInsight(insightId: string, userId: string, updates: {
    content?: string;
    tags?: string[];
    isShared?: boolean;
  }): Promise<PinnedInsight | null> {
    const existing = await dbGet(
      `SELECT * FROM pinned_insights WHERE id = ? AND user_id = ?`,
      [insightId, userId]
    ) as any;

    if (!existing) return null;

    await dbRun(
      `UPDATE pinned_insights
       SET content = COALESCE(?, content),
           tags = COALESCE(?, tags),
           is_shared = COALESCE(?, is_shared)
       WHERE id = ?`,
      [
        updates.content || null,
        updates.tags ? JSON.stringify(updates.tags) : null,
        updates.isShared !== undefined ? (updates.isShared ? 1 : 0) : null,
        insightId,
      ]
    );

    const updated = await dbGet(`SELECT * FROM pinned_insights WHERE id = ?`, [insightId]) as any;
    return updated ? this.mapRow(updated) : null;
  }

  private mapRow(row: any): PinnedInsight {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      conversationId: row.conversation_id || undefined,
      messageId: row.message_id || undefined,
      content: row.content,
      tags: JSON.parse(row.tags || '[]'),
      isShared: Boolean(row.is_shared),
      createdAt: row.created_at,
    };
  }
}

export const pinnedInsightsService = new PinnedInsightsService();
export default pinnedInsightsService;
