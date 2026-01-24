import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase, RunResult } from '../../database/IDatabase.js';

export interface TagRecord {
  id: string;
  name: string;
  slug: string;
  content_type: string;
  color: string;
  organization_id?: string | null;
  usage_count: number;
  is_active: number;
  created_at?: string;
  created_by?: string | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  contentType: string;
  color: string;
  organizationId?: string | null;
  usageCount: number;
  isActive: boolean;
  createdAt?: string;
  createdBy?: string | null;
}

export interface CreateTagData {
  name: string;
  slug?: string | null;
  contentType?: string;
  color?: string;
  organizationId?: string | null;
  createdBy?: string | null;
}

export interface UpdateTagData {
  name?: string;
  slug?: string;
  color?: string;
  isActive?: boolean;
}

export interface ListTagsOptions {
  contentType?: string | null;
  organizationId?: string | null;
  search?: string | null;
  includeInactive?: boolean;
  sortBy?: 'name' | 'usage_count' | 'created_at';
  limit?: number;
}
export type ListTagsParams = ListTagsOptions;

export interface TagServiceDependencies {
  db: IDatabase;
  uuidv4: () => string;
}

export class TagService {
  private deps: TagServiceDependencies;

  constructor(deps?: Partial<TagServiceDependencies>) {
    this.deps = {
      db: deps?.db ?? getDatabase(),
      uuidv4: deps?.uuidv4 ?? uuidv4,
    };
  }

  async createTag(data: CreateTagData): Promise<Tag> {
    const {
      name,
      slug = null,
      contentType = 'ALL',
      color = '#10B981',
      organizationId = null,
      createdBy = null,
    } = data;

    if (!name) {
      throw new Error('name is required');
    }

    const id = `tag-${this.deps.uuidv4()}`;
    const tagSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const now = new Date().toISOString();

    try {
      await this.deps.db.run(
        `INSERT INTO content_tags (
                    id, name, slug, content_type, color, organization_id,
                    usage_count, is_active, created_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
        [id, name, tagSlug, contentType, color, organizationId, now, createdBy]
      );
    } catch (err: any) {
      const error = err as Error;
      if (error.message.includes('UNIQUE')) {
        throw new Error(`Tag with slug '${tagSlug}' already exists`);
      }
      throw err;
    }

    return {
      id,
      name,
      slug: tagSlug,
      contentType,
      color,
      organizationId,
      usageCount: 0,
      isActive: true,
      createdAt: now,
      createdBy,
    };
  }

  async getTagById(id: string): Promise<Tag | null> {
    const row = (await this.deps.db.get<TagRecord>('SELECT * FROM content_tags WHERE id = ?', [
      id,
    ])) as TagRecord | null;

    if (!row) return null;
    return this._mapTagRow(row);
  }

  async listTags(options: ListTagsOptions = {}): Promise<Tag[]> {
    const {
      contentType = null,
      organizationId = null,
      search = null,
      includeInactive = false,
      sortBy = 'name',
      limit = 100,
    } = options;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (contentType) {
      conditions.push("(content_type = ? OR content_type = 'ALL')");
      params.push(contentType);
    }

    if (organizationId !== null) {
      conditions.push('(organization_id = ? OR organization_id IS NULL)');
      params.push(organizationId);
    }

    if (search) {
      conditions.push('(name LIKE ? OR slug LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (!includeInactive) {
      conditions.push('is_active = 1');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const validSortColumns = ['name', 'usage_count', 'created_at'];
    const orderBy = validSortColumns.includes(sortBy) ? sortBy : 'name';

    const rows = (await this.deps.db.all<TagRecord>(
      `SELECT * FROM content_tags ${whereClause} ORDER BY ${orderBy} DESC LIMIT ?`,
      [...params, limit]
    )) as TagRecord[];

    return (rows || []).map((row) => this._mapTagRow(row));
  }

  async updateTag(id: string, updates: UpdateTagData): Promise<Tag> {
    const allowedFields = ['name', 'slug', 'color', 'isActive'];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbColumn = this._camelToSnake(key);
        setClauses.push(`${dbColumn} = ?`);
        values.push(key === 'isActive' ? (value ? 1 : 0) : value);
      }
    }

    if (setClauses.length === 0) {
      const existing = await this.getTagById(id);
      if (!existing) {
        throw new Error('Tag not found');
      }
      return existing;
    }

    values.push(id);

    const result = (await this.deps.db.run(
      `UPDATE content_tags SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    )) as RunResult;

    if (result.changes === 0) {
      throw new Error('Tag not found');
    }

    const updated = await this.getTagById(id);
    if (!updated) {
      throw new Error('Failed to retrieve updated tag');
    }
    return updated;
  }

  async deleteTag(id: string): Promise<boolean> {
    // First delete mappings
    await this.deps.db.run('DELETE FROM content_tag_mappings WHERE tag_id = ?', [id]);

    const result = (await this.deps.db.run('DELETE FROM content_tags WHERE id = ?', [
      id,
    ])) as RunResult;

    return result.changes > 0;
  }

  async getContentTags(contentId: string, contentType: string): Promise<Tag[]> {
    const rows = (await this.deps.db.all<TagRecord>(
      `SELECT ct.* FROM content_tags ct
             JOIN content_tag_mappings ctm ON ct.id = ctm.tag_id
             WHERE ctm.content_id = ? AND ctm.content_type = ?`,
      [contentId, contentType]
    )) as TagRecord[];

    return (rows || []).map((row) => this._mapTagRow(row));
  }

  async addTagToContent(
    contentId: string,
    contentType: string,
    tagId: string,
    userId: string | null = null
  ): Promise<boolean> {
    const id = `ctm-${this.deps.uuidv4()}`;
    const now = new Date().toISOString();

    const result = (await this.deps.db.run(
      `INSERT OR IGNORE INTO content_tag_mappings (id, content_id, content_type, tag_id, created_at, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [id, contentId, contentType, tagId, now, userId]
    )) as RunResult;

    if (result.changes > 0) {
      await this.deps.db.run('UPDATE content_tags SET usage_count = usage_count + 1 WHERE id = ?', [
        tagId,
      ]);
      return true;
    }
    return false;
  }

  async removeTagFromContent(
    contentId: string,
    contentType: string,
    tagId: string
  ): Promise<boolean> {
    const result = (await this.deps.db.run(
      `DELETE FROM content_tag_mappings WHERE content_id = ? AND content_type = ? AND tag_id = ?`,
      [contentId, contentType, tagId]
    )) as RunResult;

    if (result.changes > 0) {
      await this.deps.db.run(
        'UPDATE content_tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?',
        [tagId]
      );
      return true;
    }

    return false;
  }

  private _mapTagRow(row: TagRecord): Tag {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      contentType: row.content_type,
      color: row.color,
      organizationId: row.organization_id ?? null,
      usageCount: row.usage_count || 0,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      createdBy: row.created_by ?? null,
    };
  }

  private _camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
