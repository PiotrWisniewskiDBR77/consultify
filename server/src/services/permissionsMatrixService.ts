// @ts-nocheck
/**
 * Permissions Matrix Service
 * Manages role-permission mappings and provides audit/comparison tools.
 */

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
    return await this.db.all('SELECT * FROM role_permissions');
  }

  async updateRolePermissions(roleId: string, permissions: any[]): Promise<boolean> {
    // Clear existing and insert new
    await this.db.run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    for (const p of permissions) {
      await this.db.run(
        'INSERT INTO role_permissions (role_id, permission_key, enabled) VALUES (?, ?, ?)',
        [roleId, p.key, p.enabled ? 1 : 0]
      );
    }
    return true;
  }

  async togglePermission(
    roleId: string,
    permissionKey: string,
    enabled: boolean
  ): Promise<boolean> {
    const result = await this.db.run(
      `INSERT INTO role_permissions (role_id, permission_key, enabled) 
             VALUES (?, ?, ?)
             ON CONFLICT(role_id, permission_key) DO UPDATE SET enabled = excluded.enabled`,
      [roleId, permissionKey, enabled ? 1 : 0]
    );
    return (result as any).changes > 0;
  }

  async copyRolePermissions(sourceRole: string, targetRole: string): Promise<boolean> {
    const sourcePerms = await this.db.all(
      'SELECT permission_key, enabled FROM role_permissions WHERE role_id = ?',
      [sourceRole]
    );
    await this.db.run('DELETE FROM role_permissions WHERE role_id = ?', [targetRole]);
    for (const p of sourcePerms) {
      await this.db.run(
        'INSERT INTO role_permissions (role_id, permission_key, enabled) VALUES (?, ?, ?)',
        [targetRole, p.permission_key, p.enabled]
      );
    }
    return true;
  }

  async compareRoles(role1: string, role2: string): Promise<any> {
    const p1 = await this.db.all(
      'SELECT permission_key, enabled FROM role_permissions WHERE role_id = ?',
      [role1]
    );
    const p2 = await this.db.all(
      'SELECT permission_key, enabled FROM role_permissions WHERE role_id = ?',
      [role2]
    );
    return { role1, role2, diff: [] }; // Minimal implementation
  }

  async getStats(): Promise<any> {
    return await this.db.get(
      'SELECT COUNT(DISTINCT role_id) as role_count, COUNT(*) as total_permissions FROM role_permissions'
    );
  }
}

const permissionsMatrixService = new PermissionsMatrixServiceClass();
export default permissionsMatrixService;
