/**
 * Table Platform Extension Service
 * Manages extension registry, installation lifecycle, config persistence, and marketplace queries.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export const VALID_SCOPES = [
  'records:read',
  'records:write',
  'metadata:read',
  'metadata:write',
  'network',
  'ui',
] as const;

export type ExtensionScope = (typeof VALID_SCOPES)[number];

export const VALID_STATUSES = ['draft', 'review', 'published', 'rejected'] as const;
export type ExtensionStatus = (typeof VALID_STATUSES)[number];

export const VALID_CATEGORIES = ['utility', 'visualization', 'integration', 'automation'] as const;
export type ExtensionCategory = (typeof VALID_CATEGORIES)[number];

export interface Extension {
  id: string;
  name: string;
  description: string | null;
  version: string;
  author: string | null;
  icon_url: string | null;
  source_url: string;
  scopes: string[];
  status: ExtensionStatus;
  category: ExtensionCategory;
  install_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExtensionInstall {
  id: string;
  extension_id: string;
  base_id: string;
  installed_by: string | null;
  config: Record<string, unknown>;
  created_at: string;
}

export class ExtensionService {
  async registerExtension(data: {
    name: string;
    description?: string;
    version?: string;
    author?: string;
    sourceUrl: string;
    scopes?: string[];
    category?: string;
  }): Promise<Extension> {
    const db = getDatabase();
    const scopes = (data.scopes ?? ['records:read']).filter((s) =>
      (VALID_SCOPES as readonly string[]).includes(s)
    );
    const category = (VALID_CATEGORIES as readonly string[]).includes(data.category ?? '')
      ? data.category
      : 'utility';

    const result = await db.query(
      `INSERT INTO tp_extensions (name, description, version, author, source_url, scopes, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.version ?? '1.0.0',
        data.author ?? null,
        data.sourceUrl,
        scopes,
        category,
      ]
    );
    logger.info('[ExtensionService] Registered extension', { name: data.name });
    return result.rows[0] as Extension;
  }

  async getExtension(extensionId: string): Promise<Extension | null> {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM tp_extensions WHERE id = $1', [extensionId]);
    return (result.rows[0] as Extension) ?? null;
  }

  async listPublishedExtensions(category?: string): Promise<Extension[]> {
    const db = getDatabase();
    let query = "SELECT * FROM tp_extensions WHERE status = 'published'";
    const params: unknown[] = [];
    if (category && (VALID_CATEGORIES as readonly string[]).includes(category)) {
      query += ' AND category = $1';
      params.push(category);
    }
    query += ' ORDER BY install_count DESC, name ASC';
    const result = await db.query(query, params);
    return result.rows as Extension[];
  }

  async installExtension(
    extensionId: string,
    baseId: string,
    installedBy?: string
  ): Promise<ExtensionInstall | null> {
    const db = getDatabase();
    const client = await (db as any).connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO tp_extension_installs (extension_id, base_id, installed_by)
         VALUES ($1, $2, $3) ON CONFLICT (extension_id, base_id) DO NOTHING RETURNING *`,
        [extensionId, baseId, installedBy ?? null]
      );
      if (result.rows[0]) {
        await client.query(
          'UPDATE tp_extensions SET install_count = install_count + 1 WHERE id = $1',
          [extensionId]
        );
      }
      await client.query('COMMIT');
      logger.info('[ExtensionService] Installed extension', { extensionId, baseId });
      return result.rows[0] ?? null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async uninstallExtension(extensionId: string, baseId: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db.query(
      'DELETE FROM tp_extension_installs WHERE extension_id = $1 AND base_id = $2 RETURNING id',
      [extensionId, baseId]
    );
    if (result.rows.length > 0) {
      await db.query(
        'UPDATE tp_extensions SET install_count = GREATEST(install_count - 1, 0) WHERE id = $1',
        [extensionId]
      );
      logger.info('[ExtensionService] Uninstalled extension', { extensionId, baseId });
      return true;
    }
    return false;
  }

  async getInstalledExtensions(baseId: string): Promise<(Extension & { install_config: Record<string, unknown>; installed_at: string })[]> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT e.*, ei.config as install_config, ei.created_at as installed_at
       FROM tp_extension_installs ei
       JOIN tp_extensions e ON e.id = ei.extension_id
       WHERE ei.base_id = $1
       ORDER BY ei.created_at DESC`,
      [baseId]
    );
    return result.rows as (Extension & { install_config: Record<string, unknown>; installed_at: string })[];
  }

  async updateExtensionConfig(
    extensionId: string,
    baseId: string,
    config: Record<string, unknown>
  ): Promise<void> {
    const db = getDatabase();
    await db.query(
      'UPDATE tp_extension_installs SET config = $3 WHERE extension_id = $1 AND base_id = $2',
      [extensionId, baseId, JSON.stringify(config)]
    );
  }

  async submitForReview(extensionId: string): Promise<void> {
    const db = getDatabase();
    await db.query(
      "UPDATE tp_extensions SET status = 'review', updated_at = NOW() WHERE id = $1 AND status = 'draft'",
      [extensionId]
    );
    logger.info('[ExtensionService] Extension submitted for review', { extensionId });
  }

  async publishExtension(extensionId: string): Promise<void> {
    const db = getDatabase();
    await db.query(
      "UPDATE tp_extensions SET status = 'published', updated_at = NOW() WHERE id = $1",
      [extensionId]
    );
    logger.info('[ExtensionService] Extension published', { extensionId });
  }

  async rejectExtension(extensionId: string): Promise<void> {
    const db = getDatabase();
    await db.query(
      "UPDATE tp_extensions SET status = 'rejected', updated_at = NOW() WHERE id = $1",
      [extensionId]
    );
  }
}

export const extensionService = new ExtensionService();
