/**
 * PMO Standards Service
 * FLOW-PMO-001: PMO Standards Configuration
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface PMOStandard {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isActive: boolean;
}

export interface PMORoleDefinition {
  id: string;
  standardId: string;
  roleKey: string;
  displayName: string;
  description?: string;
  permissions: string[];
  level: number;
  isRequired: boolean;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class PMOStandardsService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Get all available PMO standards
   */
  async getStandards(): Promise<PMOStandard[]> {
    const db = await this.getDb();

    const rows = await db.all<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      is_active: number;
    }>('SELECT * FROM pmo_standards WHERE is_active = 1 ORDER BY name');

    return (rows || []).map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description || undefined,
      isActive: row.is_active === 1,
    }));
  }

  /**
   * Get role definitions for a specific standard
   */
  async getRoleDefinitions(standardId: string): Promise<PMORoleDefinition[]> {
    const db = await this.getDb();

    const rows = await db.all<{
      id: string;
      standard_id: string;
      role_key: string;
      display_name: string;
      description: string | null;
      permissions: string | null;
      level: number;
      is_required: number;
    }>(
      `SELECT * FROM pmo_role_definitions 
             WHERE standard_id = ? 
             ORDER BY level, display_name`,
      [standardId]
    );

    return (rows || []).map((row) => ({
      id: row.id,
      standardId: row.standard_id,
      roleKey: row.role_key,
      displayName: row.display_name,
      description: row.description || undefined,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      level: row.level,
      isRequired: row.is_required === 1,
    }));
  }

  /**
   * Get standard by ID
   */
  async getStandard(id: string): Promise<PMOStandard | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      name: string;
      display_name: string;
      description: string | null;
      is_active: number;
    }>('SELECT * FROM pmo_standards WHERE id = ?', [id]);

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description || undefined,
      isActive: row.is_active === 1,
    };
  }

  /**
   * Get permissions for a specific role in a standard
   */
  async getRolePermissions(standardId: string, roleKey: string): Promise<string[]> {
    const db = await this.getDb();

    const row = await db.get<{ permissions: string | null }>(
      `SELECT permissions FROM pmo_role_definitions 
             WHERE standard_id = ? AND role_key = ?`,
      [standardId, roleKey]
    );

    if (!row || !row.permissions) return [];

    try {
      return JSON.parse(row.permissions);
    } catch {
      return [];
    }
  }

  /**
   * Check if user has a specific permission in project context
   */
  async checkProjectPermission(
    userId: string,
    projectId: string,
    permission: string
  ): Promise<boolean> {
    const db = await this.getDb();

    // Get project's PMO standard
    const project = await db.get<{ pmo_standard: string }>(
      'SELECT pmo_standard FROM projects WHERE id = ?',
      [projectId]
    );

    if (!project) return false;

    const standard = project.pmo_standard || 'pmbok';

    // Get user's roles in this project
    const userRoles = await db.all<{ pmo_role_key: string }>(
      'SELECT pmo_role_key FROM project_role_assignments WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    if (!userRoles || userRoles.length === 0) return false;

    // Check if any role has the required permission
    for (const role of userRoles) {
      const permissions = await this.getRolePermissions(standard, role.pmo_role_key);
      if (permissions.includes(permission) || permissions.includes('*')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all permissions for a user in a project
   */
  async getUserProjectPermissions(userId: string, projectId: string): Promise<string[]> {
    const db = await this.getDb();

    // Get project's PMO standard
    const project = await db.get<{ pmo_standard: string }>(
      'SELECT pmo_standard FROM projects WHERE id = ?',
      [projectId]
    );

    if (!project) return [];

    const standard = project.pmo_standard || 'pmbok';

    // Get user's roles in this project
    const userRoles = await db.all<{ pmo_role_key: string }>(
      'SELECT pmo_role_key FROM project_role_assignments WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    if (!userRoles || userRoles.length === 0) return [];

    // Collect all permissions
    const allPermissions = new Set<string>();

    for (const role of userRoles) {
      const permissions = await this.getRolePermissions(standard, role.pmo_role_key);
      permissions.forEach((p) => allPermissions.add(p));
    }

    return Array.from(allPermissions);
  }
}

// Export singleton
const pmoStandardsService = new PMOStandardsService();
export default pmoStandardsService;

// Named exports
export const getStandards = () => pmoStandardsService.getStandards();
export const getRoleDefinitions = (standardId: string) =>
  pmoStandardsService.getRoleDefinitions(standardId);
export const getStandard = (id: string) => pmoStandardsService.getStandard(id);
export const getRolePermissions = (standardId: string, roleKey: string) =>
  pmoStandardsService.getRolePermissions(standardId, roleKey);
export const checkProjectPermission = (userId: string, projectId: string, permission: string) =>
  pmoStandardsService.checkProjectPermission(userId, projectId, permission);
export const getUserProjectPermissions = (userId: string, projectId: string) =>
  pmoStandardsService.getUserProjectPermissions(userId, projectId);
