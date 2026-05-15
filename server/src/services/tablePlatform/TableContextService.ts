/**
 * Table Context Service
 * Builds concise summaries of the user's table platform data for AI context injection.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

class TableContextServiceImpl {
  /**
   * Build a concise summary of the user's table bases/tables for AI system prompts.
   */
  async getTableContextForOrg(orgId: string, workspaceId?: string): Promise<string> {
    const db = getDatabase();

    try {
      const params: string[] = [orgId];
      let basesQuery = 'SELECT id, name FROM tp_bases WHERE organization_id = $1';

      if (workspaceId) {
        basesQuery += ' AND workspace_id = $2';
        params.push(workspaceId);
      }
      basesQuery += ' ORDER BY updated_at DESC LIMIT 10';

      const basesResult = await db.query<{ id: string; name: string }>(basesQuery, params);
      if (!basesResult.rows.length) return '';

      const lines: string[] = ['The user has these structured data bases in their workspace:'];

      for (const base of basesResult.rows) {
        const tablesResult = await db.query<{
          name: string;
          field_count: string;
          record_count: string;
        }>(
          `SELECT t.name,
            (SELECT COUNT(*) FROM tp_fields WHERE table_id = t.id) as field_count,
            (SELECT COUNT(*) FROM tp_records WHERE table_id = t.id) as record_count
           FROM tp_tables t WHERE t.base_id = $1 ORDER BY t.name LIMIT 20`,
          [base.id]
        );

        if (tablesResult.rows.length) {
          const tableList = tablesResult.rows
            .map((t) => `${t.name} (${t.field_count} fields, ${t.record_count} records)`)
            .join(', ');
          lines.push(`- Base "${base.name}": ${tableList}`);
        }
      }

      if (lines.length <= 1) return '';

      lines.push('');
      lines.push(
        'You can reference this data when helping the user. They can use the Table tool to manage and query this data.'
      );

      return lines.join('\n');
    } catch (e) {
      logger.warn('[TableContext] Failed to build org context', e);
      return '';
    }
  }

  /**
   * Get field-level detail for a specific table (used when the chat has active table context).
   */
  async getTableDetailContext(tableId: string): Promise<string> {
    const db = getDatabase();

    try {
      const tableResult = await db.query<{ name: string }>(
        'SELECT name FROM tp_tables WHERE id = $1',
        [tableId]
      );
      if (!tableResult.rows.length) return '';

      const fieldsResult = await db.query<{
        name: string;
        field_type: string;
        options: Record<string, unknown> | null;
      }>(
        'SELECT name, field_type, options FROM tp_fields WHERE table_id = $1 ORDER BY field_order, created_at',
        [tableId]
      );

      const countResult = await db.query<{ cnt: string }>(
        'SELECT COUNT(*) as cnt FROM tp_records WHERE table_id = $1',
        [tableId]
      );

      const lines: string[] = [
        `Currently viewing table "${tableResult.rows[0].name}" with ${countResult.rows[0]?.cnt || 0} records.`,
        'Fields:',
      ];

      for (const f of fieldsResult.rows) {
        const required = f.options?.required ? ' (required)' : '';
        lines.push(`  - ${f.name}: ${f.field_type}${required}`);
      }

      return lines.join('\n');
    } catch (e) {
      logger.warn('[TableContext] Failed to build table detail context', e);
      return '';
    }
  }
}

const TableContextService = new TableContextServiceImpl();
export default TableContextService;
