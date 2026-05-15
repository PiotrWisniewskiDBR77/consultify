/**
 * Table Platform Interface Designer Service
 * Manages interface CRUD, layout persistence, publishing with share tokens, and role-based access.
 */

import crypto from 'crypto';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { PermissionError } from './ErrorHandling.js';

export interface InterfaceBlock {
  id: string;
  type:
    | 'table_grid'
    | 'record_detail'
    | 'chart'
    | 'text'
    | 'button'
    | 'filter'
    | 'search'
    | 'summary';
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface InterfaceLayout {
  blocks: InterfaceBlock[];
  theme?: { primaryColor?: string; backgroundColor?: string; fontFamily?: string };
}

export class InterfaceService {
  async createInterface(
    baseId: string,
    data: { name: string; description?: string; createdBy?: string }
  ): Promise<any> {
    const db = getDatabase();
    const result = await db.query(
      `INSERT INTO tp_interfaces (base_id, name, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [baseId, data.name, data.description ?? null, data.createdBy ?? null]
    );
    logger.info('[InterfaceService] Created interface', {
      baseId,
      name: data.name,
      id: (result.rows[0] as { id: string })?.id,
    });
    return result.rows[0];
  }

  async listInterfaces(baseId: string): Promise<any[]> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM tp_interfaces WHERE base_id = $1 ORDER BY created_at DESC',
      [baseId]
    );
    return result.rows;
  }

  async getInterface(interfaceId: string): Promise<any> {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM tp_interfaces WHERE id = $1', [interfaceId]);
    return result.rows[0] || null;
  }

  async updateLayout(interfaceId: string, layout: InterfaceLayout): Promise<any> {
    const db = getDatabase();
    const lockRow = await db.query('SELECT locked, locked_by FROM tp_interfaces WHERE id = $1', [
      interfaceId,
    ]);
    if ((lockRow.rows[0] as any)?.locked) {
      const lockedBy = (lockRow.rows[0] as { locked_by?: string }).locked_by;
      throw new PermissionError(
        `Interface is locked${lockedBy ? ` by user ${lockedBy}` : ''}. Unlock it before editing.`
      );
    }
    const result = await db.query(
      `UPDATE tp_interfaces SET layout = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [interfaceId, JSON.stringify(layout)]
    );
    return result.rows[0] || null;
  }

  async publishInterface(interfaceId: string): Promise<{ shareToken: string }> {
    const db = getDatabase();
    const shareToken = crypto.randomBytes(16).toString('hex');
    await db.query(
      `UPDATE tp_interfaces SET published = true, share_token = $2, updated_at = NOW() WHERE id = $1`,
      [interfaceId, shareToken]
    );
    logger.info('[InterfaceService] Published interface', { interfaceId, shareToken });
    return { shareToken };
  }

  async unpublishInterface(interfaceId: string): Promise<void> {
    const db = getDatabase();
    await db.query(
      `UPDATE tp_interfaces SET published = false, share_token = NULL, updated_at = NOW() WHERE id = $1`,
      [interfaceId]
    );
    logger.info('[InterfaceService] Unpublished interface', { interfaceId });
  }

  async getPublicInterface(shareToken: string): Promise<any> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM tp_interfaces WHERE share_token = $1 AND published = true',
      [shareToken]
    );
    return result.rows[0] || null;
  }

  async deleteInterface(interfaceId: string): Promise<void> {
    const db = getDatabase();
    await db.query('DELETE FROM tp_interfaces WHERE id = $1', [interfaceId]);
    logger.info('[InterfaceService] Deleted interface', { interfaceId });
  }

  async updateAllowedRoles(interfaceId: string, roles: string[]): Promise<void> {
    const db = getDatabase();
    await db.query(
      'UPDATE tp_interfaces SET allowed_roles = $2, updated_at = NOW() WHERE id = $1',
      [interfaceId, roles]
    );
  }
}

export const interfaceService = new InterfaceService();
export default interfaceService;
