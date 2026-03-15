/**
 * Table Platform Metadata Service
 * Skeleton implementation for bases, tables, fields, and views CRUD
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import auditService from './AuditService.js';
import { PermissionError } from './ErrorHandling.js';
import projectionService from './ProjectionService.js';
import { webhookDispatcher } from './WebhookDispatcherService.js';

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
  const result = await db.query(
    'SELECT governance_mode FROM tp_tables WHERE id = $1',
    [tableId]
  );
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
      return (row ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] createBase failed', { workspaceId, orgId, error: (e as Error).message });
      throw e;
    }
  },

  async getBase(baseId: string): Promise<any> {
    const db = getDatabase();
    try {
      const baseResult = await db.query('SELECT * FROM tp_bases WHERE id = $1', [baseId]);
      const base = baseResult.rows[0];
      if (!base) return null;
      const tablesResult = await db.query('SELECT * FROM tp_tables WHERE base_id = $1 ORDER BY created_at ASC', [baseId]);
      (base as Record<string, unknown>).tables = tablesResult.rows;
      return base as Record<string, unknown>;
    } catch (e) {
      logger.error('[MetadataService] getBase failed', { baseId, error: (e as Error).message });
      throw e;
    }
  },

  async listBases(workspaceId: string): Promise<any[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        'SELECT * FROM tp_bases WHERE workspace_id = $1 ORDER BY created_at ASC',
        [workspaceId]
      );
      return result.rows;
    } catch (e) {
      logger.error('[MetadataService] listBases failed', { workspaceId, error: (e as Error).message });
      throw e;
    }
  },

  async updateBase(
    baseId: string,
    updates: { name?: string },
    updatedBy?: string
  ): Promise<any> {
    const db = getDatabase();
    try {
      const before = (await db.query('SELECT * FROM tp_bases WHERE id = $1', [baseId])).rows[0];
      if (!before) return null;
      if (updates.name !== undefined) {
        await db.query(
          `UPDATE tp_bases SET name = $2, updated_at = NOW() WHERE id = $1`,
          [baseId, updates.name]
        );
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
      await auditService.logEvent('delete', 'base', baseId, deletedBy, before, undefined, undefined);
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
      await db.query(
        `UPDATE tp_tables SET ${setClauses.join(', ')} WHERE id = $${idx}`,
        values
      );
      const after = (await db.query('SELECT * FROM tp_tables WHERE id = $1', [tableId])).rows[0];
      await auditService.logEvent('update', 'table', tableId, updatedBy, before, after, undefined);
      const baseId = (before as { base_id?: string }).base_id;
      if (baseId) {
        await bumpSchemaVersion(baseId, { action: 'updateTable', tableId, updates }, updatedBy);
      }
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] updateTable failed', { tableId, error: (e as Error).message });
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
      await auditService.logEvent('delete', 'table', tableId, deletedBy, before, undefined, undefined);
      if (baseId) {
        await bumpSchemaVersion(baseId, { action: 'deleteTable', tableId }, deletedBy);
        await this.notifySchemaMutated(baseId, [tableId]);

        webhookDispatcher.dispatchEvent(baseId, {
          source: 'publicApi',
          sourceMetadata: { userId: deletedBy },
          actionType: 'deleteTable',
          tableId,
        }).catch(() => {});
      }
      return true;
    } catch (e) {
      logger.error('[MetadataService] deleteTable failed', { tableId, error: (e as Error).message });
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
      await db.query('DELETE FROM tp_fields WHERE id = $1', [fieldId]);
      await auditService.logEvent('delete', 'field', fieldId, deletedBy, before, undefined, undefined);
      if (tableId) {
        const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId])).rows[0] as { base_id?: string } | undefined;
        if (tableRow?.base_id) {
          await bumpSchemaVersion(tableRow.base_id, { action: 'deleteField', fieldId, tableId }, deletedBy);
          await this.notifySchemaMutated(tableRow.base_id, [tableId]);

          webhookDispatcher.dispatchEvent(tableRow.base_id, {
            source: 'publicApi',
            sourceMetadata: { userId: deletedBy },
            actionType: 'deleteField',
            tableId,
            fieldId,
          }).catch(() => {});
        }
      }
      return true;
    } catch (e) {
      logger.error('[MetadataService] deleteField failed', { fieldId, error: (e as Error).message });
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
      await auditService.logEvent('delete', 'view', viewId, deletedBy, before, undefined, undefined);
      if (tableId) {
        const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId])).rows[0] as { base_id?: string } | undefined;
        if (tableRow?.base_id) {
          await bumpSchemaVersion(tableRow.base_id, { action: 'deleteView', viewId, tableId }, deletedBy);
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
      await auditService.logEvent('create', 'table', tableId, createdBy, undefined, table, { base_id: baseId });
      await bumpSchemaVersion(baseId, { action: 'createTable', tableId, name }, createdBy);
      await this.notifySchemaMutated(baseId, [tableId]);

      webhookDispatcher.dispatchEvent(baseId, {
        source: 'publicApi',
        sourceMetadata: { userId: createdBy },
        actionType: 'createTable',
        tableId,
      }).catch(() => {});

      return table;
    } catch (e) {
      logger.error('[MetadataService] createTable failed', { baseId, name, error: (e as Error).message });
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
      const viewsResult = await db.query('SELECT * FROM tp_views WHERE table_id = $1 ORDER BY created_at ASC', [
        tableId,
      ]);
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
      await auditService.logEvent('create', 'field', id, createdBy, undefined, field, { table_id: tableId });
      const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId])).rows[0] as { base_id?: string } | undefined;
      if (tableRow?.base_id) {
        await bumpSchemaVersion(tableRow.base_id, { action: 'createField', fieldId: id, tableId, name, fieldType }, createdBy);
        await this.notifySchemaMutated(tableRow.base_id, [tableId]);

        webhookDispatcher.dispatchEvent(tableRow.base_id, {
          source: 'publicApi',
          sourceMetadata: { userId: createdBy },
          actionType: 'createField',
          tableId,
          fieldId: id,
        }).catch(() => {});
      }
      return (field ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] createField failed', { tableId, name, error: (e as Error).message });
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
      await db.query(
        `UPDATE tp_fields SET ${setClauses.join(', ')} WHERE id = $${idx}`,
        values
      );
      const after = (await db.query('SELECT * FROM tp_fields WHERE id = $1', [fieldId])).rows[0];
      await auditService.logEvent('update', 'field', fieldId, undefined, before, after, undefined);
      if (tableId) {
        const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId])).rows[0] as { base_id?: string } | undefined;
        if (tableRow?.base_id) {
          await bumpSchemaVersion(tableRow.base_id, { action: 'updateField', fieldId, updates });
          await this.notifySchemaMutated(tableRow.base_id, [tableId]);

          webhookDispatcher.dispatchEvent(tableRow.base_id, {
            source: 'publicApi',
            actionType: 'updateField',
            tableId,
            fieldId,
          }).catch(() => {});
        }
      }
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] updateField failed', { fieldId, error: (e as Error).message });
      throw e;
    }
  },

  async createView(
    tableId: string,
    name: string,
    viewType = 'grid',
    config?: Record<string, unknown>,
    createdBy?: string
  ): Promise<any> {
    const db = getDatabase();
    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO tp_views (id, table_id, name, view_type, config, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, tableId, name, viewType, config ? JSON.stringify(config) : '{}', createdBy ?? null]
      );
      const view = (await db.query('SELECT * FROM tp_views WHERE id = $1', [id])).rows[0];
      await auditService.logEvent('create', 'view', id, createdBy, undefined, view, { table_id: tableId });
      const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId])).rows[0] as { base_id?: string } | undefined;
      if (tableRow?.base_id) {
        await bumpSchemaVersion(tableRow.base_id, { action: 'createView', viewId: id, tableId, name, viewType }, createdBy);
      }
      return (view ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] createView failed', { tableId, name, error: (e as Error).message });
      throw e;
    }
  },

  async updateView(
    viewId: string,
    updates: { name?: string; config?: Record<string, unknown>; visibleFieldIds?: string[] }
  ): Promise<any> {
    const db = getDatabase();
    try {
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
      await db.query(
        `UPDATE tp_views SET ${setClauses.join(', ')} WHERE id = $${idx}`,
        values
      );
      const after = (await db.query('SELECT * FROM tp_views WHERE id = $1', [viewId])).rows[0];
      await auditService.logEvent('update', 'view', viewId, undefined, before, after, undefined);
      const tableId = (before as { table_id?: string }).table_id;
      if (tableId) {
        const tableRow = (await db.query('SELECT base_id FROM tp_tables WHERE id = $1', [tableId])).rows[0] as { base_id?: string } | undefined;
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
      await auditService.logEvent('update', 'table', tableId, updatedBy, before, after, { action: 'setGovernanceMode', mode });
      return (after ?? null) as Record<string, unknown> | null;
    } catch (e) {
      logger.error('[MetadataService] setGovernanceMode failed', { tableId, error: (e as Error).message });
      throw e;
    }
  },

  async getGovernanceMode(tableId: string): Promise<string> {
    const db = getDatabase();
    const result = await db.query('SELECT governance_mode FROM tp_tables WHERE id = $1', [tableId]);
    return (result.rows[0] as { governance_mode?: string } | undefined)?.governance_mode ?? 'operational';
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
      logger.error('[MetadataService] reorderFields failed', { tableId, error: (e as Error).message });
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
      logger.error('[MetadataService] reorderViews failed', { tableId, error: (e as Error).message });
      throw e;
    }
  },

  // ==========================================
  // COLUMN CONFIG PERSISTENCE
  // ==========================================

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
      logger.error('[MetadataService] updateViewColumnConfig failed', { viewId, error: (e as Error).message });
      throw e;
    }
  },
};

export default metadataService;
