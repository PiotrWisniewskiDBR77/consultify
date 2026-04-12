/**
 * Prompt Library Service
 *
 * Manages personal and organizational prompt templates:
 * - Personal: user-saved frequently used prompts
 * - Organization: admin-published templates for the team
 * - Marketplace: cross-org sharing (superadmin)
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export type PromptScope = 'personal' | 'organization' | 'marketplace';

export interface PromptTemplate {
  id: string;
  scope: PromptScope;
  organizationId?: string;
  userId?: string;
  title: string;
  content: string;
  category?: string;
  tags: string[];
  usageCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

class PromptLibraryService {
  async createPrompt(input: {
    userId: string;
    organizationId: string;
    title: string;
    content: string;
    scope?: PromptScope;
    category?: string;
    tags?: string[];
  }): Promise<PromptTemplate> {
    const id = randomUUID();
    const scope = input.scope || 'personal';

    await dbRun(
      `INSERT INTO prompt_library
        (id, organization_id, user_id, scope, title, content, category, tags,
         usage_count, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))`,
      [
        id,
        scope === 'personal' ? null : input.organizationId,
        input.userId,
        scope,
        input.title,
        input.content,
        input.category || null,
        JSON.stringify(input.tags || []),
        scope !== 'personal' ? 1 : 0,
      ]
    );

    return {
      id,
      scope,
      organizationId: scope !== 'personal' ? input.organizationId : undefined,
      userId: input.userId,
      title: input.title,
      content: input.content,
      category: input.category,
      tags: input.tags || [],
      usageCount: 0,
      isPublished: scope !== 'personal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async listPrompts(input: {
    userId: string;
    organizationId: string;
    scope?: PromptScope;
    category?: string;
    search?: string;
  }): Promise<PromptTemplate[]> {
    let conditions = '1=1';
    const params: unknown[] = [];

    if (input.scope === 'personal') {
      conditions += ' AND scope = ? AND user_id = ?';
      params.push('personal', input.userId);
    } else if (input.scope === 'organization') {
      conditions += ' AND scope = ? AND organization_id = ? AND is_published = 1';
      params.push('organization', input.organizationId);
    } else if (input.scope === 'marketplace') {
      conditions += ' AND scope = ? AND is_published = 1';
      params.push('marketplace');
    } else {
      conditions += ' AND ((scope = ? AND user_id = ?) OR (scope = ? AND organization_id = ? AND is_published = 1))';
      params.push('personal', input.userId, 'organization', input.organizationId);
    }

    if (input.category) {
      conditions += ' AND category = ?';
      params.push(input.category);
    }

    if (input.search) {
      conditions += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${input.search}%`, `%${input.search}%`);
    }

    const rows = await dbAll(
      `SELECT * FROM prompt_library WHERE ${conditions} ORDER BY usage_count DESC, updated_at DESC LIMIT 100`,
      params
    ).catch(() => []) as any[];

    return (rows || []).map(this.mapRow);
  }

  async usePrompt(promptId: string, userId: string): Promise<PromptTemplate | null> {
    const row = await dbGet(
      `SELECT * FROM prompt_library WHERE id = ?`,
      [promptId]
    ) as any;

    if (!row) return null;

    await dbRun(
      `UPDATE prompt_library SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?`,
      [promptId]
    ).catch(() => {});

    return this.mapRow(row);
  }

  async updatePrompt(input: {
    promptId: string;
    userId: string;
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    isPublished?: boolean;
  }): Promise<PromptTemplate | null> {
    const existing = await dbGet(
      `SELECT * FROM prompt_library WHERE id = ? AND user_id = ?`,
      [input.promptId, input.userId]
    ) as any;

    if (!existing) return null;

    await dbRun(
      `UPDATE prompt_library
       SET title = COALESCE(?, title),
           content = COALESCE(?, content),
           category = COALESCE(?, category),
           tags = COALESCE(?, tags),
           is_published = COALESCE(?, is_published),
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        input.title || null,
        input.content || null,
        input.category || null,
        input.tags ? JSON.stringify(input.tags) : null,
        input.isPublished !== undefined ? (input.isPublished ? 1 : 0) : null,
        input.promptId,
      ]
    );

    const updated = await dbGet(`SELECT * FROM prompt_library WHERE id = ?`, [input.promptId]) as any;
    return updated ? this.mapRow(updated) : null;
  }

  async deletePrompt(promptId: string, userId: string): Promise<boolean> {
    await dbRun(
      `DELETE FROM prompt_library WHERE id = ? AND user_id = ?`,
      [promptId, userId]
    );
    return true;
  }

  private mapRow(row: any): PromptTemplate {
    return {
      id: row.id,
      scope: row.scope as PromptScope,
      organizationId: row.organization_id || undefined,
      userId: row.user_id || undefined,
      title: row.title,
      content: row.content,
      category: row.category || undefined,
      tags: JSON.parse(row.tags || '[]'),
      usageCount: Number(row.usage_count) || 0,
      isPublished: Boolean(row.is_published),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const promptLibraryService = new PromptLibraryService();
export default promptLibraryService;
