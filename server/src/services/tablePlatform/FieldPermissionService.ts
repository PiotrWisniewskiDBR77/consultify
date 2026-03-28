/**
 * Table Platform Field Permission Service
 * Opt-in field-level read/write permissions based on user roles.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export interface FieldPermission {
  fieldId: string;
  role: 'editor' | 'viewer' | 'none';
}

export class FieldPermissionService {
  /**
   * Quick check: does any field in this table have permissions configured?
   */
  async tableHasFieldPermissions(tableId: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT EXISTS(
        SELECT 1 FROM tp_fields
        WHERE table_id = $1 AND options ? 'permissions'
      ) as has_field_perms`,
      [tableId]
    );
    return (result.rows[0] as { has_field_perms: boolean })?.has_field_perms === true;
  }

  /**
   * Check if user can read a specific field.
   * Default: all fields readable when no permissions are set.
   */
  async canReadField(userId: string, fieldId: string, userRole: string): Promise<boolean> {
    const db = getDatabase();
    const field = await db.query('SELECT options FROM tp_fields WHERE id = $1', [fieldId]);
    if (!field.rows[0]) return false;

    const perms = (
      field.rows[0] as {
        options?: { permissions?: { readRoles?: string[]; writeRoles?: string[] } };
      }
    ).options?.permissions;
    if (!perms || !perms.readRoles) return true;

    return perms.readRoles.includes(userRole) || perms.readRoles.includes('*');
  }

  /**
   * Check if user can write to a specific field.
   */
  async canWriteField(userId: string, fieldId: string, userRole: string): Promise<boolean> {
    const db = getDatabase();
    const field = await db.query('SELECT options FROM tp_fields WHERE id = $1', [fieldId]);
    if (!field.rows[0]) return false;

    const perms = (
      field.rows[0] as {
        options?: { permissions?: { readRoles?: string[]; writeRoles?: string[] } };
      }
    ).options?.permissions;
    if (!perms || !perms.writeRoles) return true;

    return perms.writeRoles.includes(userRole) || perms.writeRoles.includes('*');
  }

  /**
   * Filter record data to only include fields the user can read.
   */
  async filterRecordFields(
    record: { data: Record<string, unknown> },
    tableId: string,
    userRole: string
  ): Promise<Record<string, unknown>> {
    const db = getDatabase();
    const fields = await db.query('SELECT id, options FROM tp_fields WHERE table_id = $1', [
      tableId,
    ]);

    type FieldRow = {
      id: string;
      options?: { permissions?: { readRoles?: string[]; writeRoles?: string[] } };
    };
    const filtered: Record<string, unknown> = {};
    for (const field of fields.rows as FieldRow[]) {
      const perms = field.options?.permissions;
      const allowed =
        !perms ||
        !perms.readRoles ||
        perms.readRoles.includes(userRole) ||
        perms.readRoles.includes('*');

      if (allowed && record.data[field.id] !== undefined) {
        filtered[field.id] = record.data[field.id];
      }
    }
    return filtered;
  }

  /**
   * Validate that user can write to all fields in the update payload.
   */
  async validateWritePermissions(
    data: Record<string, unknown>,
    tableId: string,
    userRole: string
  ): Promise<{ allowed: boolean; deniedFields: string[] }> {
    const db = getDatabase();
    const fields = await db.query('SELECT id, name, options FROM tp_fields WHERE table_id = $1', [
      tableId,
    ]);

    const deniedFields: string[] = [];
    for (const fieldId of Object.keys(data)) {
      const field = fields.rows.find((f: any) => f.id === fieldId);
      if (!field) continue;

      const perms = (field as any).options?.permissions;
      if (
        perms?.writeRoles &&
        !perms.writeRoles.includes(userRole) &&
        !perms.writeRoles.includes('*')
      ) {
        deniedFields.push((field as any).name);
      }
    }

    return { allowed: deniedFields.length === 0, deniedFields };
  }
}

export const fieldPermissionService = new FieldPermissionService();
