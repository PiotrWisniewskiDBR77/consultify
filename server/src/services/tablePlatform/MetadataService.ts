/**
 * Table Platform Metadata Service
 * Skeleton implementation for bases, tables, fields, and views CRUD
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import auditService from './AuditService.js';
import { NotFoundError, PermissionError } from './ErrorHandling.js';
import OrgMemberSyncService from './OrgMemberSyncService.js';
import projectionService from './ProjectionService.js';
import { webhookDispatcher } from './WebhookDispatcherService.js';

function convertValue(value: unknown, fromType: string, toType: string): unknown {
  if (value === null || value === undefined) return null;
  if (fromType === toType) return value;

  const key = `${fromType}->${toType}`;
  switch (key) {
    case 'single_line_text->number':
    case 'text->number': {
      const n = parseFloat(String(value));
      if (isNaN(n)) throw new Error(`Cannot convert "${value}" to number`);
      return n;
    }
    case 'number->single_line_text':
    case 'number->text':
      return String(value);
    case 'single_line_text->checkbox':
    case 'text->checkbox': {
      const s = String(value).toLowerCase().trim();
      return s === 'true' || s === '1' || s === 'yes';
    }
    case 'checkbox->single_line_text':
    case 'checkbox->text':
      return value ? 'true' : 'false';
    case 'date->single_line_text':
    case 'date->text':
      return new Date(value as string | number).toISOString();
    case 'single_line_text->date':
    case 'text->date': {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) throw new Error(`Cannot parse "${value}" as date`);
      return d.toISOString();
    }
    case 'number->date': {
      const d = new Date(value as number);
      if (isNaN(d.getTime())) throw new Error(`Cannot convert ${value} to date`);
      return d.toISOString();
    }
    case 'date->number':
      return new Date(value as string).getTime();
    case 'number->checkbox':
      return Boolean(value);
    case 'checkbox->number':
      return value ? 1 : 0;
    default:
      break;
  }

  if (toType === 'single_line_text' || toType === 'text') {
    return String(value);
  }

  throw new Error(`Unsupported conversion from ${fromType} to ${toType}`);
}

async function bumpSchemaVersion(
  baseId: string,
  changeSummary: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const db = getDatabase();
  try {
    const result = await db.query(
      `UPDATE tp_bases SET schema_version = schema_version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING schema_version`,
      [baseId]
    );
    const newVersion = (result.rows[0] as { schema_version: number })?.schema_version;
    if (newVersion != null) {
      await db.query(
        `INSERT INTO tp_schema_versions (base_id, version, change_summary, applied_by)
         VALUES ($1, $2, $3, $4)`,
        [baseId, newVersion, JSON.stringify(changeSummary), userId ?? null]
      );
    }
  } catch (e) {
    logger.error('[MetadataService] bumpSchemaVersion failed', {
      baseId,
      error: (e as Error).message,
    });
  }
}

async function assertNotGoverned(tableId: string): Promise<void> {
  const db = getDatabase();
  const result = await db.query('SELECT governance_mode FROM tp_tables WHERE id = $1', [tableId]);
  const mode = (result.rows[0] as { governance_mode?: string } | undefined)?.governance_mode;
  if (mode === 'governed') {
    throw new PermissionError(
      'This table is governed. Schema changes require approval via Chat-to-Schema.'
    );
  }
}

const metadataService = {
  async createBase(
    workspaceId: string,
    orgId: string,
    name: string,
    createdBy?: string
  ): Promise<any> {
    const db = getDatabase();
    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO tp_bases (id, workspace_id, organization_id, name, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, workspaceId, orgId, name, createdBy ?? null]
      );
      const row = (await db.query('SELECT * FROM tp_bases WHERE id = $1', [id])).rows[0];
      await auditService.logEvent('create', 'base', id, createdBy, undefined, row, undefined);

      // Ensure the creator can write schema/data immediately after base creation.
      if (createdBy) {
        await db
          .query(
            `INSERT INTO tp_base_members (base_id, user_id, role)
             VALUES ($1, $2, 'base_owner')
             ON CONFLICT (base_id, user_id)
             DO UPDATE SET role = 'base_owner', updated_at = NOW()`,
            [id, createdBy]
          )
          .catch((err) =>
            logger.warn('[MetadataService] Failed to grant base_owner to creator', {
              baseId: id,
              userId: createdBy,
              error: (err as Error).message,
            })
          );
      }

      await OrgMemberSyncService.syncOrgMembersToBase(id, orgId).catch((err) =>
        logger.warn('[MetadataService] Org member sync failed after createBase', {
          error: (err as Error).message,
        })
      );

      return (row ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] createBase failed', {
        workspaceId,
        orgId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getBase(baseId: string): Promise<any> {
    const db = getDatabase();
    try {
      const baseResult = await db.query('SELECT * FROM tp_bases WHERE id = $1', [baseId]);
      const base = baseResult.rows[0];
      if (!base) return null;
      const tablesResult = await db.query(
        'SELECT * FROM tp_tables WHERE base_id = $1 ORDER BY created_at ASC',
        [baseId]
      );
      (base as Record<string, unknown>).tables = tablesResult.rows;
      return base as Record<string, unknown>;
    } catch (e) {
      logger.error('[MetadataService] getBase failed', { baseId, error: (e as Error).message });
      throw e;
    }
  },

  async listBases(workspaceId: string, organizationId?: string): Promise<any[]> {
    const db = getDatabase();
    try {
      const result = organizationId
        ? await db.query(
            'SELECT * FROM tp_bases WHERE workspace_id = $1 AND organization_id = $2 ORDER BY created_at ASC',
            [workspaceId, organizationId]
          )
        : await db.query('SELECT * FROM tp_bases WHERE workspace_id = $1 ORDER BY created_at ASC', [
            workspaceId,
          ]);
      return result.rows;
    } catch (e) {
      logger.error('[MetadataService] listBases failed', {
        workspaceId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async updateBase(baseId: string, updates: { name?: string }, updatedBy?: string): Promise<any> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_bases WHERE id = $1', [baseId])).rows[0];
      if (!before) return null;
      if (updates.name !== undefined) {
        await db.query(`UPDATE tp_bases SET name = $2, updated_at = NOW() WHERE id = $1`, [
          baseId,
          updates.name,
        ]);
      }
      const after = (await db.query('SELECT * FROM tp_bases WHERE id = $1', [baseId])).rows[0];
      await auditService.logEvent('update', 'base', baseId, updatedBy, before, after, undefined);
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] updateBase failed', { baseId, error: (e as Error).message });
      throw e;
    }
  },

  async deleteBase(baseId: string, deletedBy?: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_bases WHERE id = $1', [baseId])).rows[0];
      if (!before) return false;
      await db.query('DELETE FROM tp_bases WHERE id = $1', [baseId]);
      await auditService.logEvent(
        'delete',
        'base',
        baseId,
        deletedBy,
        before,
        undefined,
        undefined
      );
      return true;
    } catch (e) {
      logger.error('[MetadataService] deleteBase failed', { baseId, error: (e as Error).message });
      throw e;
    }
  },

  async updateTable(
    tableId: string,
    updates: { name?: string; description?: string },
    updatedBy?: string
  ): Promise<any> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_tables WHERE id = $1', [tableId])).rows[0];
      if (!before) return null;
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      if (updates.name !== undefined) {
        setClauses.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${idx++}`);
        values.push(updates.description);
      }
      if (setClauses.length === 0) return before;
      setClauses.push(`updated_at = NOW()`);
      values.push(tableId);
      await db.query(`UPDATE tp_tables SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);
      const after = (await db.query('SELECT * FROM tp_tables WHERE id = $1', [tableId])).rows[0];
      await auditService.logEvent('update', 'table', tableId, updatedBy, before, after, undefined);
      const baseId = (before as { base_id?: string }).base_id;
      if (baseId) {
        await bumpSchemaVersion(baseId, { action: 'updateTable', tableId, updates }, updatedBy);
      }
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] updateTable failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async deleteTable(tableId: string, deletedBy?: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_tables WHERE id = $1', [tableId])).rows[0];
      if (!before) return false;
      const baseId = (before as { base_id?: string }).base_id;
      await db.query('DELETE FROM tp_tables WHERE id = $1', [tableId]);
      await auditService.logEvent(
        'delete',
        'table',
        tableId,
        deletedBy,
        before,
        undefined,
        undefined
      );
      if (baseId) {
        await bumpSchemaVersion(baseId, { action: 'deleteTable', tableId }, deletedBy);
        await this.notifySchemaMutated(baseId, [tableId]);

        webhookDispatcher
          .dispatchEvent(baseId, {
            source: 'publicApi',
            sourceMetadata: { userId: deletedBy },
            actionType: 'deleteTable',
            tableId,
          })
          .catch((err: unknown) => logger.warn('[MetadataService] event dispatch failed', err));
      }
      return true;
    } catch (e) {
      logger.error('[MetadataService] deleteTable failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async deleteField(fieldId: string, deletedBy?: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_fields WHERE id = $1', [fieldId])).rows[0];
      if (!before) return false;
      const tableId = (before as { table_id?: string }).table_id;
      if (tableId) await assertNotGoverned(tableId);

      // Cascade: keep field id in visible_field_ids; mark as missing in view config (degraded UI)
      if (tableId) {
        const fieldName = (before as { name?: string }).name ?? 'Unknown';
        await db.query(
          `UPDATE tp_views
           SET config = jsonb_set(
             COALESCE(config, '{}'::jsonb),
             '{missing_fields}',
             COALESCE(config->'missing_fields', '[]'::jsonb) || jsonb_build_array($1::text)
           ),
           updated_at = NOW()
           WHERE table_id = $2 AND $1 = ANY(visible_field_ids)`,
          [fieldId, tableId]
        );
        await db.query(
          `UPDATE tp_views
           SET config = jsonb_set(
             COALESCE(config, '{}'::jsonb),
             '{missing_field_names}',
             COALESCE(config->'missing_field_names', '{}'::jsonb) || jsonb_build_object($1::text, $2::text)
           ),
           updated_at = NOW()
           WHERE table_id = $3 AND $1 = ANY(visible_field_ids)`,
          [fieldId, fieldName, tableId]
        );
        await db.query(
          `UPDATE tp_views
           SET visible_field_ids = array_remove(visible_field_ids, $1),
           updated_at = NOW()
           WHERE table_id = $2 AND $1 = ANY(visible_field_ids)`,
          [fieldId, tableId]
        );
      }

      // Cascade: remove field references from form configs
      if (tableId) {
        try {
          const formsResult = await db.query(
            'SELECT id, config FROM tp_forms WHERE table_id = $1',
            [tableId]
          );
          for (const form of formsResult.rows as Array<{ id: string; config: any }>) {
            const config = form.config;
            if (config && Array.isArray(config.fields)) {
              const filtered = config.fields.filter(
                (f: any) => f.fieldId !== fieldId && f.id !== fieldId
              );
              if (filtered.length !== config.fields.length) {
                await db.query(
                  `UPDATE tp_forms SET config = jsonb_set(config, '{fields}', $2::jsonb), updated_at = NOW() WHERE id = $1`,
                  [form.id, JSON.stringify(filtered)]
                );
              }
            }
          }
        } catch (formErr) {
          logger.warn('[MetadataService] deleteField form cascade failed', {
            fieldId,
            error: (formErr as Error).message,
          });
        }
      }

      // Cascade: clean up record links if this was a linkedRecord field
      const fieldType = (before as { field_type?: string }).field_type;
      if (fieldType === 'linkedRecord') {
        await db.query('DELETE FROM tp_record_links WHERE from_field_id = $1', [fieldId]);
      }

      await db.query('DELETE FROM tp_fields WHERE id = $1', [fieldId]);
      await auditService.logEvent('delete', 'field', fieldId, deletedBy, before, undefined, {
        fieldName: (before as { name?: string }).name,
      });
      if (tableId) {
        const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]))
          .rows[0] as { base_id?: string } | undefined;
        if (tableRow?.base_id) {
          await bumpSchemaVersion(
            tableRow.base_id,
            { action: 'deleteField', fieldId, tableId },
            deletedBy
          );
          await this.notifySchemaMutated(tableRow.base_id, [tableId]);

          webhookDispatcher
            .dispatchEvent(tableRow.base_id, {
              source: 'publicApi',
              sourceMetadata: { userId: deletedBy },
              actionType: 'deleteField',
              tableId,
              fieldId,
            })
            .catch((err: unknown) => logger.warn('[MetadataService] event dispatch failed', err));
        }
      }
      return true;
    } catch (e) {
      logger.error('[MetadataService] deleteField failed', {
        fieldId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async deleteView(viewId: string, deletedBy?: string): Promise<boolean> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_views WHERE id = $1', [viewId])).rows[0];
      if (!before) return false;
      const tableId = (before as { table_id?: string }).table_id;
      await db.query('DELETE FROM tp_views WHERE id = $1', [viewId]);
      await auditService.logEvent(
        'delete',
        'view',
        viewId,
        deletedBy,
        before,
        undefined,
        undefined
      );
      if (tableId) {
        const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]))
          .rows[0] as { base_id?: string } | undefined;
        if (tableRow?.base_id) {
          await bumpSchemaVersion(
            tableRow.base_id,
            { action: 'deleteView', viewId, tableId },
            deletedBy
          );
        }
      }
      return true;
    } catch (e) {
      logger.error('[MetadataService] deleteView failed', { viewId, error: (e as Error).message });
      throw e;
    }
  },

  async createTable(
    baseId: string,
    name: string,
    description?: string,
    createdBy?: string
  ): Promise<any> {
    const db = getDatabase();
    const tableId = uuidv4();
    const fieldId = uuidv4();
    const viewId = uuidv4();
    try {
      await db.query(
        `INSERT INTO tp_tables (id, base_id, name, description, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [tableId, baseId, name, description ?? null, createdBy ?? null]
      );
      await db.query(
        `INSERT INTO tp_fields (id, table_id, name, field_type, options, field_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [fieldId, tableId, 'Name', 'single_line_text', '{}', 0]
      );
      await db.query(
        `UPDATE tp_tables SET primary_field_id = $1, updated_at = NOW() WHERE id = $2`,
        [fieldId, tableId]
      );
      await db.query(
        `INSERT INTO tp_views (id, table_id, name, view_type, visible_field_ids, is_default, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [viewId, tableId, 'Grid view', 'grid', [fieldId], true, createdBy ?? null]
      );
      const table = await this.getTable(tableId);
      await auditService.logEvent('create', 'table', tableId, createdBy, undefined, table, {
        base_id: baseId,
      });
      await bumpSchemaVersion(baseId, { action: 'createTable', tableId, name }, createdBy);
      await this.notifySchemaMutated(baseId, [tableId]);

      webhookDispatcher
        .dispatchEvent(baseId, {
          source: 'publicApi',
          sourceMetadata: { userId: createdBy },
          actionType: 'createTable',
          tableId,
        })
        .catch((err: unknown) => logger.warn('[MetadataService] event dispatch failed', err));

      return table;
    } catch (e) {
      logger.error('[MetadataService] createTable failed', {
        baseId,
        name,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getTable(tableId: string): Promise<any> {
    const db = getDatabase();
    try {
      const tableResult = await db.query('SELECT * FROM tp_tables WHERE id = $1', [tableId]);
      const table = tableResult.rows[0];
      if (!table) return null;
      const fieldsResult = await db.query(
        'SELECT * FROM tp_fields WHERE table_id = $1 ORDER BY field_order ASC, created_at ASC',
        [tableId]
      );
      const viewsResult = await db.query(
        'SELECT * FROM tp_views WHERE table_id = $1 ORDER BY created_at ASC',
        [tableId]
      );
      (table as Record<string, unknown>).fields = fieldsResult.rows;
      (table as Record<string, unknown>).views = viewsResult.rows;
      return table as Record<string, unknown>;
    } catch (e) {
      logger.error('[MetadataService] getTable failed', { tableId, error: (e as Error).message });
      throw e;
    }
  },

  async createField(
    tableId: string,
    name: string,
    fieldType: string,
    options?: Record<string, unknown>,
    createdBy?: string
  ): Promise<any> {
    const db = getDatabase();
    const id = uuidv4();
    try {
      await assertNotGoverned(tableId);
      const maxOrderResult = await db.query(
        'SELECT COALESCE(MAX(field_order), -1) + 1 AS next_order FROM tp_fields WHERE table_id = $1',
        [tableId]
      );
      const fieldOrder = (maxOrderResult.rows[0] as { next_order?: number })?.next_order ?? 0;
      await db.query(
        `INSERT INTO tp_fields (id, table_id, name, field_type, options, field_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, tableId, name, fieldType, options ? JSON.stringify(options) : '{}', fieldOrder]
      );
      const field = (await db.query('SELECT * FROM tp_fields WHERE id = $1', [id])).rows[0];
      await auditService.logEvent('create', 'field', id, createdBy, undefined, field, {
        table_id: tableId,
      });
      const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]))
        .rows[0] as { base_id?: string } | undefined;
      if (tableRow?.base_id) {
        await bumpSchemaVersion(
          tableRow.base_id,
          { action: 'createField', fieldId: id, tableId, name, fieldType },
          createdBy
        );
        await this.notifySchemaMutated(tableRow.base_id, [tableId]);

        webhookDispatcher
          .dispatchEvent(tableRow.base_id, {
            source: 'publicApi',
            sourceMetadata: { userId: createdBy },
            actionType: 'createField',
            tableId,
            fieldId: id,
          })
          .catch((err: unknown) => logger.warn('[MetadataService] event dispatch failed', err));
      }
      return (field ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] createField failed', {
        tableId,
        name,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async updateField(
    fieldId: string,
    updates: { name?: string; options?: Record<string, unknown> }
  ): Promise<any> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_fields WHERE id = $1', [fieldId])).rows[0];
      if (!before) return null;
      const tableId = (before as { table_id?: string }).table_id;
      if (tableId) await assertNotGoverned(tableId);
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      if (updates.name !== undefined) {
        setClauses.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.options !== undefined) {
        setClauses.push(`options = $${idx++}`);
        values.push(JSON.stringify(updates.options));
      }
      if (setClauses.length === 0) return before;
      setClauses.push(`updated_at = NOW()`);
      values.push(fieldId);
      await db.query(`UPDATE tp_fields SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);
      const after = (await db.query('SELECT * FROM tp_fields WHERE id = $1', [fieldId])).rows[0];
      await auditService.logEvent('update', 'field', fieldId, undefined, before, after, undefined);
      if (tableId) {
        const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]))
          .rows[0] as { base_id?: string } | undefined;
        if (tableRow?.base_id) {
          await bumpSchemaVersion(tableRow.base_id, { action: 'updateField', fieldId, updates });
          await this.notifySchemaMutated(tableRow.base_id, [tableId]);

          webhookDispatcher
            .dispatchEvent(tableRow.base_id, {
              source: 'publicApi',
              actionType: 'updateField',
              tableId,
              fieldId,
            })
            .catch((err: unknown) => logger.warn('[MetadataService] event dispatch failed', err));
        }
      }
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] updateField failed', {
        fieldId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listViews(tableId: string, userId?: string): Promise<any[]> {
    const db = getDatabase();
    try {
      if (userId) {
        const result = await db.query(
          `SELECT * FROM tp_views WHERE table_id = $1 AND (is_personal = false OR owner_id = $2) ORDER BY created_at ASC`,
          [tableId, userId]
        );
        return result.rows;
      }
      const result = await db.query(
        'SELECT * FROM tp_views WHERE table_id = $1 ORDER BY created_at ASC',
        [tableId]
      );
      return result.rows;
    } catch (e) {
      logger.error('[MetadataService] listViews failed', { tableId, error: (e as Error).message });
      throw e;
    }
  },

  async createView(
    tableId: string,
    name: string,
    viewType = 'grid',
    config?: Record<string, unknown>,
    createdBy?: string,
    isPersonal = false,
    ownerId?: string
  ): Promise<any> {
    const db = getDatabase();
    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO tp_views (id, table_id, name, view_type, config, created_by, is_personal, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          tableId,
          name,
          viewType,
          config ? JSON.stringify(config) : '{}',
          createdBy ?? null,
          isPersonal,
          ownerId ?? null,
        ]
      );
      const view = (await db.query('SELECT * FROM tp_views WHERE id = $1', [id])).rows[0];
      await auditService.logEvent('create', 'view', id, createdBy, undefined, view, {
        table_id: tableId,
      });
      const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]))
        .rows[0] as { base_id?: string } | undefined;
      if (tableRow?.base_id) {
        await bumpSchemaVersion(
          tableRow.base_id,
          { action: 'createView', viewId: id, tableId, name, viewType },
          createdBy
        );
      }
      return (view ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] createView failed', {
        tableId,
        name,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async updateView(
    viewId: string,
    updates: { name?: string; config?: Record<string, unknown>; visibleFieldIds?: string[] }
  ): Promise<any> {
    const db = getDatabase();
    try {
      const viewLockRow = await db.query('SELECT locked, locked_by FROM tp_views WHERE id = $1', [
        viewId,
      ]);
      if ((viewLockRow.rows[0] as any)?.locked) {
        const lockedBy = (viewLockRow.rows[0] as { locked_by?: string }).locked_by;
        throw new PermissionError(
          `View is locked${lockedBy ? ` by user ${lockedBy}` : ''}. Unlock it before editing.`
        );
      }
      const before = (await db.query('SELECT * FROM tp_views WHERE id = $1', [viewId])).rows[0];
      if (!before) return null;
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      if (updates.name !== undefined) {
        setClauses.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.config !== undefined) {
        setClauses.push(`config = $${idx++}`);
        values.push(JSON.stringify(updates.config));
      }
      if (updates.visibleFieldIds !== undefined) {
        setClauses.push(`visible_field_ids = $${idx++}`);
        values.push(updates.visibleFieldIds);
      }
      if (setClauses.length === 0) return before;
      setClauses.push(`updated_at = NOW()`);
      values.push(viewId);
      await db.query(`UPDATE tp_views SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);
      const after = (await db.query('SELECT * FROM tp_views WHERE id = $1', [viewId])).rows[0];
      await auditService.logEvent('update', 'view', viewId, undefined, before, after, undefined);
      const tableId = (before as { table_id?: string }).table_id;
      if (tableId) {
        const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId]))
          .rows[0] as { base_id?: string } | undefined;
        if (tableRow?.base_id) {
          await bumpSchemaVersion(tableRow.base_id, { action: 'updateView', viewId, updates });
        }
      }
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] updateView failed', { viewId, error: (e as Error).message });
      throw e;
    }
  },

  // ==========================================
  // VIEW LOCKS
  // ==========================================

  async lockView(viewId: string, userId: string): Promise<void> {
    const db = getDatabase();
    await db.query(
      'UPDATE tp_views SET locked = true, locked_by = $1, locked_at = NOW() WHERE id = $2',
      [userId, viewId]
    );
  },

  async unlockView(viewId: string, userId: string): Promise<void> {
    const db = getDatabase();
    const row = await db.query('SELECT locked_by FROM tp_views WHERE id = $1', [viewId]);
    const lockedBy = (row.rows[0] as { locked_by?: string } | undefined)?.locked_by;
    if (lockedBy && lockedBy !== userId) {
      throw new PermissionError('Only the user who locked this view can unlock it.');
    }
    await db.query(
      'UPDATE tp_views SET locked = false, locked_by = NULL, locked_at = NULL WHERE id = $1',
      [viewId]
    );
  },

  // ==========================================
  // INTERFACE LOCKS
  // ==========================================

  async lockInterface(interfaceId: string, userId: string): Promise<void> {
    const db = getDatabase();
    await db.query(
      'UPDATE tp_interfaces SET locked = true, locked_by = $1, locked_at = NOW() WHERE id = $2',
      [userId, interfaceId]
    );
  },

  async unlockInterface(interfaceId: string, userId: string): Promise<void> {
    const db = getDatabase();
    const row = await db.query('SELECT locked_by FROM tp_interfaces WHERE id = $1', [interfaceId]);
    const lockedBy = (row.rows[0] as { locked_by?: string } | undefined)?.locked_by;
    if (lockedBy && lockedBy !== userId) {
      throw new PermissionError('Only the user who locked this interface can unlock it.');
    }
    await db.query(
      'UPDATE tp_interfaces SET locked = false, locked_by = NULL, locked_at = NULL WHERE id = $1',
      [interfaceId]
    );
  },

  // ==========================================
  // FIELD TYPE CHANGE
  // ==========================================

  async changeFieldType(
    fieldId: string,
    newType: string,
    userId: string,
    options?: Record<string, unknown>,
    preview?: boolean
  ): Promise<
    | {
        compatible: number;
        incompatible: number;
        samples: Array<{
          recordId: string;
          currentValue: unknown;
          convertedValue: unknown;
          error?: string;
        }>;
      }
    | { success: boolean }
  > {
    const db = getDatabase();

    const field = await db.query('SELECT * FROM tp_fields WHERE id = $1', [fieldId]);
    if (!field.rows[0]) throw new NotFoundError('field', fieldId);

    const fieldRow = field.rows[0] as Record<string, unknown>;
    const currentType = fieldRow.field_type as string;
    const tableId = fieldRow.table_id as string;

    const records = await db.query(
      'SELECT id, data FROM tp_records WHERE table_id = $1 LIMIT 100',
      [tableId]
    );

    const results = (
      records.rows as Array<{ id: string; data: Record<string, unknown> | null }>
    ).map((r) => {
      const val = r.data?.[fieldId];
      try {
        const converted = convertValue(val, currentType, newType);
        return { recordId: r.id, currentValue: val, convertedValue: converted };
      } catch (e) {
        return {
          recordId: r.id,
          currentValue: val,
          convertedValue: null,
          error: (e as Error).message,
        };
      }
    });

    const compatible = results.filter((r) => !r.error).length;
    const incompatible = results.filter((r) => r.error).length;

    if (preview) {
      return { compatible, incompatible, samples: results.slice(0, 10) };
    }

    await db.query('BEGIN');
    try {
      await db.query(
        'UPDATE tp_fields SET field_type = $1, options = $2, updated_at = NOW() WHERE id = $3',
        [newType, JSON.stringify(options || fieldRow.options || {}), fieldId]
      );

      for (const r of records.rows as Array<{ id: string; data: Record<string, unknown> | null }>) {
        const val = r.data?.[fieldId];
        try {
          const converted = convertValue(val, currentType, newType);
          if (converted !== val) {
            const newData = { ...r.data, [fieldId]: converted };
            await db.query('UPDATE tp_records SET data = $1, updated_at = NOW() WHERE id = $2', [
              JSON.stringify(newData),
              r.id,
            ]);
          }
        } catch {
          const newData = { ...r.data, [fieldId]: null };
          await db.query('UPDATE tp_records SET data = $1, updated_at = NOW() WHERE id = $2', [
            JSON.stringify(newData),
            r.id,
          ]);
        }
      }

      await db.query(
        'UPDATE tp_bases SET schema_version = schema_version + 1 WHERE id = (SELECT base_id FROM tp_tables WHERE id = $1)',
        [tableId]
      );

      await db.query('COMMIT');

      try {
        await auditService.logEvent('update', 'field', fieldId, userId, undefined, undefined, {
          action: 'field_type_changed',
          from: currentType,
          to: newType,
          compatible,
          incompatible,
        });
      } catch {
        // audit is best-effort
      }

      return { success: true };
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  },

  /**
   * Notify that schema has been mutated — clears projection cache for affected base.
   * Future: will emit WebSocket events to subscribers.
   */
  async notifySchemaMutated(baseId: string, _tableIds: string[]): Promise<void> {
    try {
      projectionService.invalidateCache(baseId);
    } catch (e) {
      logger.warn('[MetadataService] notifySchemaMutated failed', {
        baseId,
        error: (e as Error).message,
      });
    }
  },

  // ==========================================
  // GOVERNANCE
  // ==========================================

  async setGovernanceMode(
    tableId: string,
    mode: 'operational' | 'governed',
    updatedBy?: string
  ): Promise<any> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_tables WHERE id = $1', [tableId])).rows[0];
      if (!before) return null;
      await db.query(
        `UPDATE tp_tables SET governance_mode = $2, updated_at = NOW() WHERE id = $1`,
        [tableId, mode]
      );
      const after = (await db.query('SELECT * FROM tp_tables WHERE id = $1', [tableId])).rows[0];
      await auditService.logEvent('update', 'table', tableId, updatedBy, before, after, {
        action: 'setGovernanceMode',
        mode,
      });
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] setGovernanceMode failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getGovernanceMode(tableId: string): Promise<string> {
    const db = getDatabase();
    const result = await db.query('SELECT governance_mode FROM tp_tables WHERE id = $1', [tableId]);
    return (
      (result.rows[0] as { governance_mode?: string } | undefined)?.governance_mode ?? 'operational'
    );
  },

  // ==========================================
  // FIELD REORDER
  // ==========================================

  async reorderFields(
    tableId: string,
    fieldOrder: Array<{ fieldId: string; ordinal: number }>
  ): Promise<void> {
    const db = getDatabase();
    try {
      await db.query('BEGIN');
      for (const item of fieldOrder) {
        await db.query(
          `UPDATE tp_fields SET field_order = $2, updated_at = NOW()
           WHERE id = $1 AND table_id = $3`,
          [item.fieldId, item.ordinal, tableId]
        );
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      logger.error('[MetadataService] reorderFields failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  // ==========================================
  // VIEW REORDER
  // ==========================================

  async reorderViews(
    tableId: string,
    viewOrder: Array<{ viewId: string; ordinal: number }>
  ): Promise<void> {
    const db = getDatabase();
    try {
      await db.query('BEGIN');
      for (const item of viewOrder) {
        await db.query(
          `UPDATE tp_views SET ordinal = $2, updated_at = NOW()
           WHERE id = $1 AND table_id = $3`,
          [item.viewId, item.ordinal, tableId]
        );
      }
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      logger.error('[MetadataService] reorderViews failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  // ==========================================
  // COLUMN CONFIG PERSISTENCE
  // ==========================================

  // ==========================================
  // DUPLICATE BASE / TABLE
  // ==========================================

  async duplicateBase(baseId: string, newName: string, userId?: string): Promise<any> {
    const db = getDatabase();
    try {
      const original = await this.getBase(baseId);
      if (!original) return null;

      const origBase = original as Record<string, unknown>;
      const newBaseId = uuidv4();
      await db.query(
        `INSERT INTO tp_bases (id, workspace_id, organization_id, name, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [newBaseId, origBase.workspace_id, origBase.organization_id, newName, userId ?? null]
      );

      const tables = (origBase.tables ?? []) as Array<Record<string, unknown>>;
      for (const table of tables) {
        await this.duplicateTableInternal(String(table.id), newBaseId, String(table.name), userId);
      }

      const newBase = await this.getBase(newBaseId);
      await auditService.logEvent('create', 'base', newBaseId, userId, undefined, newBase, {
        duplicatedFrom: baseId,
      });
      return newBase;
    } catch (e) {
      logger.error('[MetadataService] duplicateBase failed', {
        baseId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async duplicateTable(tableId: string, newName: string, userId?: string): Promise<any> {
    const db = getDatabase();
    try {
      const tableResult = await db.query('SELECT * FROM tp_tables WHERE id = $1', [tableId]);
      const original = tableResult.rows[0] as Record<string, unknown> | undefined;
      if (!original) return null;

      const baseId = String(original.base_id);
      const newTable = await this.duplicateTableInternal(tableId, baseId, newName, userId);

      await bumpSchemaVersion(
        baseId,
        {
          action: 'duplicateTable',
          sourceTableId: tableId,
          newTableId: (newTable as Record<string, unknown>)?.id,
        },
        userId
      );
      await this.notifySchemaMutated(baseId, [String((newTable as Record<string, unknown>)?.id)]);
      return newTable;
    } catch (e) {
      logger.error('[MetadataService] duplicateTable failed', {
        tableId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async duplicateTableInternal(
    sourceTableId: string,
    targetBaseId: string,
    newName: string,
    userId?: string
  ): Promise<any> {
    const db = getDatabase();
    const newTableId = uuidv4();

    const fieldsResult = await db.query(
      'SELECT * FROM tp_fields WHERE table_id = $1 ORDER BY field_order ASC, created_at ASC',
      [sourceTableId]
    );
    const fields = fieldsResult.rows as Array<Record<string, unknown>>;

    const fieldIdMap = new Map<string, string>();
    for (const f of fields) {
      fieldIdMap.set(String(f.id), uuidv4());
    }

    const sourceTable = (await db.query('SELECT * FROM tp_tables WHERE id = $1', [sourceTableId]))
      .rows[0] as Record<string, unknown>;
    const newPrimaryFieldId = sourceTable?.primary_field_id
      ? (fieldIdMap.get(String(sourceTable.primary_field_id)) ?? null)
      : null;

    await db.query(
      `INSERT INTO tp_tables (id, base_id, name, description, primary_field_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        newTableId,
        targetBaseId,
        newName,
        sourceTable?.description ?? null,
        newPrimaryFieldId,
        userId ?? null,
      ]
    );

    for (const f of fields) {
      const newFieldId = fieldIdMap.get(String(f.id))!;
      await db.query(
        `INSERT INTO tp_fields (id, table_id, name, field_type, options, field_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newFieldId,
          newTableId,
          f.name,
          f.field_type,
          typeof f.options === 'string' ? f.options : JSON.stringify(f.options ?? {}),
          f.field_order ?? 0,
        ]
      );
    }

    const viewsResult = await db.query(
      'SELECT * FROM tp_views WHERE table_id = $1 ORDER BY created_at ASC',
      [sourceTableId]
    );
    for (const v of viewsResult.rows as Array<Record<string, unknown>>) {
      const newViewId = uuidv4();
      const visibleFieldIds = Array.isArray(v.visible_field_ids)
        ? (v.visible_field_ids as string[]).map((fid) => fieldIdMap.get(fid) ?? fid)
        : v.visible_field_ids;
      await db.query(
        `INSERT INTO tp_views (id, table_id, name, view_type, visible_field_ids, config, is_default, is_personal, owner_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          newViewId,
          newTableId,
          v.name,
          v.view_type,
          visibleFieldIds,
          typeof v.config === 'string' ? v.config : JSON.stringify(v.config ?? {}),
          v.is_default ?? false,
          v.is_personal ?? false,
          v.owner_id ?? null,
          userId ?? null,
        ]
      );
    }

    const recordsResult = await db.query('SELECT * FROM tp_records WHERE table_id = $1', [
      sourceTableId,
    ]);
    for (const r of recordsResult.rows as Array<Record<string, unknown>>) {
      const newRecordId = uuidv4();
      const originalData = (
        typeof r.data === 'string' ? JSON.parse(r.data) : (r.data ?? {})
      ) as Record<string, unknown>;
      const remappedData: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(originalData)) {
        const newKey = fieldIdMap.get(key) ?? key;
        remappedData[newKey] = val;
      }
      await db.query(
        `INSERT INTO tp_records (id, table_id, data, created_by)
         VALUES ($1, $2, $3, $4)`,
        [newRecordId, newTableId, JSON.stringify(remappedData), userId ?? null]
      );
    }

    const newTable = await this.getTable(newTableId);
    await auditService.logEvent('create', 'table', newTableId, userId, undefined, newTable, {
      duplicatedFrom: sourceTableId,
    });
    return newTable;
  },

  async updateViewColumnConfig(
    viewId: string,
    columnConfig: Array<{ fieldId: string; visible: boolean; width: number }>
  ): Promise<any> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_views WHERE id = $1', [viewId])).rows[0];
      if (!before) return null;

      await db.query(
        `UPDATE tp_views
         SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{columnConfig}', $2::jsonb),
             updated_at = NOW()
         WHERE id = $1`,
        [viewId, JSON.stringify(columnConfig)]
      );

      const after = (await db.query('SELECT * FROM tp_views WHERE id = $1', [viewId])).rows[0];
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] updateViewColumnConfig failed', {
        viewId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  // ==========================================
  // VIEW SHARING
  // ==========================================

  async shareView(
    viewId: string,
    options?: { password?: string; expiresAt?: string }
  ): Promise<{ token: string; url: string }> {
    const db = getDatabase();
    try {
      const { randomUUID } = await import('crypto');
      const token = randomUUID();
      // L-03: hash the share password at rest (bcrypt) instead of plaintext.
      const passwordHash = options?.password ? await bcrypt.hash(options.password, 10) : null;
      await db.query(
        `UPDATE tp_views
         SET share_token = $2, is_shared = true, share_password = $3, share_expires_at = $4, updated_at = NOW()
         WHERE id = $1`,
        [viewId, token, passwordHash, options?.expiresAt ?? null]
      );
      return { token, url: `/public/views/${token}` };
    } catch (e) {
      logger.error('[MetadataService] shareView failed', { viewId, error: (e as Error).message });
      throw e;
    }
  },

  /**
   * L-03: verify a share-view password against the stored value.
   * New shares store a bcrypt hash (`$2*`); legacy rows may hold plaintext,
   * so we fall back to a constant-time string compare for those — no existing
   * share breaks, and new ones are hashed at rest.
   */
  async verifySharePassword(provided: string, stored: string | null): Promise<boolean> {
    if (!stored) return true; // no password set
    if (!provided) return false;
    if (/^\$2[aby]?\$/.test(stored)) {
      try {
        return await bcrypt.compare(provided, stored);
      } catch {
        return false;
      }
    }
    // Legacy plaintext: constant-time-ish compare to avoid trivial timing leak.
    const { timingSafeEqual } = await import('crypto');
    const a = Buffer.from(provided);
    const b = Buffer.from(stored);
    return a.length === b.length && timingSafeEqual(a, b);
  },

  async unshareView(viewId: string): Promise<void> {
    const db = getDatabase();
    try {
      await db.query(
        `UPDATE tp_views
         SET share_token = NULL, is_shared = false, share_password = NULL, share_expires_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [viewId]
      );
    } catch (e) {
      logger.error('[MetadataService] unshareView failed', { viewId, error: (e as Error).message });
      throw e;
    }
  },

  async getSharedView(token: string): Promise<{
    viewId: string;
    tableId: string;
    viewName: string;
    viewType: string;
    config: any;
    tableName: string;
    fields: any[];
    hasPassword: boolean;
  } | null> {
    const db = getDatabase();
    try {
      const viewResult = await db.query(
        `SELECT v.*, t.name as table_name, t.id as table_id_ref
         FROM tp_views v
         JOIN tp_tables t ON t.id = v.table_id
         WHERE v.share_token = $1 AND v.is_shared = true`,
        [token]
      );
      const view = viewResult.rows[0] as Record<string, any> | undefined;
      if (!view) return null;

      if (view.share_expires_at && new Date(view.share_expires_at) < new Date()) {
        return null;
      }

      const fieldsResult = await db.query(
        'SELECT id, name, field_type, options FROM tp_fields WHERE table_id = $1 ORDER BY field_order ASC',
        [view.table_id]
      );

      return {
        viewId: view.id,
        tableId: view.table_id,
        viewName: view.name,
        viewType: view.view_type,
        config: view.config,
        tableName: view.table_name,
        fields: fieldsResult.rows,
        hasPassword: !!view.share_password,
        _sharePassword: view.share_password as string | null,
      } as any;
    } catch (e) {
      logger.error('[MetadataService] getSharedView failed', {
        token,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

export default metadataService;
