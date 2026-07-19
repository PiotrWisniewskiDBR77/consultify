// @ts-nocheck
/**
 * Permissions Matrix Service
 * Manages role-permission mappings and provides audit/comparison tools.
 *
 * Schema note (RED-D W5/W6, 2026-07-19): the live `role_permissions` table
 * has columns (id, role, permission_key, description, created_at) with a
 * UNIQUE(role, permission_key) constraint — NOT (role_id, enabled) as this
 * service originally assumed. There is no `enabled` boolean column; a row's
 * presence IS "enabled" (same convention already used by the seeders in
 * ToolController.ts / AssessmentController.ts: "role_permissions may have
 * (id, role, permission_key) only in Postgres; description optional").
 */

import { randomUUID } from 'crypto';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';

class PermissionsMatrixServiceClass {
  private db: IDatabase;
  private logger: any;

  constructor(deps?: { db?: IDatabase; logger?: any }) {
    this.db = deps?.db || getDatabase();
    this.logger = deps?.logger || _logger;
  }

  setDependencies(deps: { db?: IDatabase; logger?: any }) {
    if (deps.db) this.db = deps.db;
    if (deps.logger) this.logger = deps.logger;
  }

  async getMatrix(): Promise<any[]> {
    return await this.db.all(
      'SELECT id, role AS role_id, permission_key, description, created_at FROM role_permissions'
    );
  }

  async updateRolePermissions(roleId: string, permissions: any[]): Promise<boolean> {
    // Clear existing and insert only the enabled ones (row presence = enabled).
    await this.db.run('DELETE FROM role_permissions WHERE role = ?', [roleId]);
    for (const p of permissions) {
      if (!p.enabled) continue;
      await this.db.run(
        `INSERT INTO role_permissions (id, role, permission_key)
             VALUES (?, ?, ?)
             ON CONFLICT (role, permission_key) DO NOTHING`,
        [randomUUID(), roleId, p.key]
      );
    }
    return true;
  }

  async togglePermission(
    roleId: string,
    permissionKey: string,
    enabled: boolean
  ): Promise<boolean> {
    if (enabled) {
      await this.db.run(
        `INSERT INTO role_permissions (id, role, permission_key)
             VALUES (?, ?, ?)
             ON CONFLICT (role, permission_key) DO NOTHING`,
        [randomUUID(), roleId, permissionKey]
      );
    } else {
      await this.db.run('DELETE FROM role_permissions WHERE role = ? AND permission_key = ?', [
        roleId,
        permissionKey,
      ]);
    }
    return true;
  }

  async copyRolePermissions(sourceRole: string, targetRole: string): Promise<boolean> {
    const sourcePerms = await this.db.all(
      'SELECT permission_key FROM role_permissions WHERE role = ?',
      [sourceRole]
    );
    await this.db.run('DELETE FROM role_permissions WHERE role = ?', [targetRole]);
    for (const p of sourcePerms) {
      await this.db.run(
        `INSERT INTO role_permissions (id, role, permission_key)
             VALUES (?, ?, ?)
             ON CONFLICT (role, permission_key) DO NOTHING`,
        [randomUUID(), targetRole, p.permission_key]
      );
    }
    return true;
  }

  async compareRoles(role1: string, role2: string): Promise<any> {
    const p1 = await this.db.all('SELECT permission_key FROM role_permissions WHERE role = ?', [
      role1,
    ]);
    const p2 = await this.db.all('SELECT permission_key FROM role_permissions WHERE role = ?', [
      role2,
    ]);
    return { role1, role2, diff: [] }; // Minimal implementation
  }

  async getStats(): Promise<any> {
    return await this.db.get(
      'SELECT COUNT(DISTINCT role) as role_count, COUNT(*) as total_permissions FROM role_permissions'
    );
  }
}

const permissionsMatrixService = new PermissionsMatrixServiceClass();
export default permissionsMatrixService;
