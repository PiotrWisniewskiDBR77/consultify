/**
 * Table Platform Relation Service
 * Manages record links (linkedRecord), computed fields (count, lookup, rollup), and cleanup.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import auditService from './AuditService.js';

interface FieldOptions {
  fieldType: string;
  options: {
    linkedTableId?: string;
    reverseFieldId?: string;
    isReverse?: boolean;
    linkedFieldId?: string;
    lookupFieldId?: string;
    aggregation?: string;
  };
}

export interface ExpandedRecord {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  linkedRecords: Record<string, ExpandedRecord[]>;
}

const relationService = {
  async getFieldOptions(
    fieldId: string
  ): Promise<{ fieldType: string; options: Record<string, unknown> } | null> {
    const db = getDatabase();
    try {
      const result = await db.query('SELECT field_type, options FROM tp_fields WHERE id = $1', [
        fieldId,
      ]);
      const row = result.rows[0];
      if (!row) return null;
      const r = row as { field_type: string; options: Record<string, unknown> };
      return {
        fieldType: r.field_type,
        options: (r.options ?? {}) as Record<string, unknown>,
      };
    } catch (e) {
      logger.error('[RelationService] getFieldOptions failed', {
        fieldId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async findBacklinkFieldId(
    fromFieldId: string,
    sourceTableId: string,
    targetRecordId: string
  ): Promise<string | null> {
    const fieldOpts = await this.getFieldOptions(fromFieldId);
    if (!fieldOpts) return null;
    const opts = fieldOpts.options as FieldOptions['options'];

    if (opts.reverseFieldId) return opts.reverseFieldId;

    const db = getDatabase();
    const targetRecord = (
      await db.query('SELECT table_id FROM tp_records WHERE id = $1', [targetRecordId])
    ).rows[0] as { table_id: string } | undefined;
    if (!targetRecord) return null;

    const backlinkResult = await db.query(
      `SELECT id FROM tp_fields
       WHERE table_id = $1
         AND field_type = 'linkedRecord'
         AND (options->>'linkedTableId')::text = $2
         AND id != $3
       LIMIT 1`,
      [targetRecord.table_id, sourceTableId, fromFieldId]
    );
    const backlinkRow = backlinkResult.rows[0] as { id: string } | undefined;
    return backlinkRow?.id ?? null;
  },

  async linkRecords(
    fromRecordId: string,
    fromFieldId: string,
    toRecordIds: string[],
    actorId?: string
  ): Promise<void> {
    const db = getDatabase();
    try {
      const fieldOpts = await this.getFieldOptions(fromFieldId);
      if (!fieldOpts || fieldOpts.fieldType !== 'linkedRecord') {
        throw new Error(`Field ${fromFieldId} is not a linkedRecord field`);
      }

      // Cardinality enforcement
      const cardinality =
        ((fieldOpts.options as Record<string, unknown>)?.cardinality as string | undefined) ??
        'many-to-many';
      if (cardinality === 'one-to-one' || cardinality === 'one-to-many') {
        const existingCount = await db.query(
          'SELECT COUNT(*)::int AS cnt FROM tp_record_links WHERE from_record_id = $1 AND from_field_id = $2',
          [fromRecordId, fromFieldId]
        );
        const cnt = (existingCount.rows[0] as { cnt: number }).cnt;
        if (cardinality === 'one-to-one' && cnt + toRecordIds.length > 1) {
          throw new Error(
            `Cardinality violation: field ${fromFieldId} allows only one-to-one links (existing: ${cnt}, adding: ${toRecordIds.length})`
          );
        }
        if (cardinality === 'one-to-many' && toRecordIds.length > 0) {
          for (const toRecordId of toRecordIds) {
            const reverseCount = await db.query(
              `SELECT COUNT(*)::int AS cnt FROM tp_record_links WHERE to_record_id = $1 AND from_field_id = $2 AND from_record_id != $3`,
              [toRecordId, fromFieldId, fromRecordId]
            );
            if ((reverseCount.rows[0] as { cnt: number }).cnt > 0) {
              throw new Error(
                `Cardinality violation: target record ${toRecordId} is already linked from another record (one-to-many constraint on field ${fromFieldId})`
              );
            }
          }
        }
      }

      const sourceRecord = (
        await db.query('SELECT table_id FROM tp_records WHERE id = $1', [fromRecordId])
      ).rows[0] as { table_id: string } | undefined;
      const sourceTableId = sourceRecord?.table_id;

      for (const toRecordId of toRecordIds) {
        await db.query(
          `INSERT INTO tp_record_links (from_record_id, from_field_id, to_record_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (from_record_id, from_field_id, to_record_id) DO NOTHING`,
          [fromRecordId, fromFieldId, toRecordId]
        );

        if (sourceTableId) {
          const backlinkFieldId = await this.findBacklinkFieldId(
            fromFieldId,
            sourceTableId,
            toRecordId
          );
          if (backlinkFieldId) {
            await db.query(
              `INSERT INTO tp_record_links (from_record_id, from_field_id, to_record_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (from_record_id, from_field_id, to_record_id) DO NOTHING`,
              [toRecordId, backlinkFieldId, fromRecordId]
            );
          }
        }
      }

      const linked = await this.getLinkedRecords(fromRecordId, fromFieldId);
      const linkedIds = linked.map((r: { id: string }) => r.id);
      const record = (await db.query('SELECT * FROM tp_records WHERE id = $1', [fromRecordId]))
        .rows[0] as { data?: Record<string, unknown> } | undefined;
      if (record) {
        const data = (record.data ?? {}) as Record<string, unknown>;
        data[fromFieldId] = linkedIds;
        await db.query(`UPDATE tp_records SET data = $2, updated_at = NOW() WHERE id = $1`, [
          fromRecordId,
          JSON.stringify(data),
        ]);
      }

      await auditService.logEvent(
        'link',
        'record_link',
        fromRecordId,
        actorId,
        undefined,
        { fromFieldId, toRecordIds },
        undefined
      );

      await this.recomputeComputedFields(fromRecordId);
      for (const toRecordId of toRecordIds) {
        await this.recomputeComputedFields(toRecordId);
      }
    } catch (e) {
      logger.error('[RelationService] linkRecords failed', {
        fromRecordId,
        fromFieldId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async unlinkRecords(
    fromRecordId: string,
    fromFieldId: string,
    toRecordIds: string[],
    actorId?: string
  ): Promise<void> {
    const db = getDatabase();
    try {
      const sourceRecord = (
        await db.query('SELECT table_id FROM tp_records WHERE id = $1', [fromRecordId])
      ).rows[0] as { table_id: string } | undefined;
      const sourceTableId = sourceRecord?.table_id;

      for (const toRecordId of toRecordIds) {
        await db.query(
          `DELETE FROM tp_record_links
           WHERE from_record_id = $1 AND from_field_id = $2 AND to_record_id = $3`,
          [fromRecordId, fromFieldId, toRecordId]
        );

        if (sourceTableId) {
          const backlinkFieldId = await this.findBacklinkFieldId(
            fromFieldId,
            sourceTableId,
            toRecordId
          );
          if (backlinkFieldId) {
            await db.query(
              `DELETE FROM tp_record_links
               WHERE from_record_id = $1 AND from_field_id = $2 AND to_record_id = $3`,
              [toRecordId, backlinkFieldId, fromRecordId]
            );
          }
        }
      }

      const linked = await this.getLinkedRecords(fromRecordId, fromFieldId);
      const linkedIds = linked.map((r: { id: string }) => r.id);
      const record = (await db.query('SELECT * FROM tp_records WHERE id = $1', [fromRecordId]))
        .rows[0] as { data?: Record<string, unknown> } | undefined;
      if (record) {
        const data = (record.data ?? {}) as Record<string, unknown>;
        data[fromFieldId] = linkedIds;
        await db.query(`UPDATE tp_records SET data = $2, updated_at = NOW() WHERE id = $1`, [
          fromRecordId,
          JSON.stringify(data),
        ]);
      }

      await auditService.logEvent(
        'unlink',
        'record_link',
        fromRecordId,
        actorId,
        undefined,
        { fromFieldId, toRecordIds },
        undefined
      );

      await this.recomputeComputedFields(fromRecordId);
      for (const toRecordId of toRecordIds) {
        await this.recomputeComputedFields(toRecordId);
      }
    } catch (e) {
      logger.error('[RelationService] unlinkRecords failed', {
        fromRecordId,
        fromFieldId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getLinkedRecords(recordId: string, fieldId: string, includeStale = false): Promise<any[]> {
    const db = getDatabase();
    try {
      if (includeStale) {
        // LEFT JOIN to return degraded placeholders for stale/deleted records
        const result = await db.query(
          `SELECT l.to_record_id,
                  r.id IS NOT NULL AS record_exists,
                  CASE WHEN r.id IS NOT NULL THEN r.id ELSE l.to_record_id END AS id,
                  CASE WHEN r.id IS NOT NULL THEN r.table_id ELSE NULL END AS table_id,
                  CASE WHEN r.id IS NOT NULL THEN r.data ELSE '{}' END AS data,
                  CASE WHEN r.id IS NOT NULL THEN r.created_at ELSE l.created_at END AS created_at,
                  CASE WHEN r.id IS NOT NULL THEN r.updated_at ELSE l.created_at END AS updated_at,
                  CASE WHEN r.id IS NULL THEN true ELSE false END AS __stale
           FROM tp_record_links l
           LEFT JOIN tp_records r ON r.id = l.to_record_id
           WHERE l.from_record_id = $1 AND l.from_field_id = $2
           ORDER BY l.created_at ASC`,
          [recordId, fieldId]
        );
        return (result.rows ?? []).map((row: any) => ({
          ...row,
          __stale: row.__stale ?? false,
          __display: row.__stale ? '[Deleted Record]' : undefined,
        }));
      }

      const result = await db.query(
        `SELECT r.* FROM tp_record_links l
         JOIN tp_records r ON r.id = l.to_record_id
         WHERE l.from_record_id = $1 AND l.from_field_id = $2
         ORDER BY l.created_at ASC`,
        [recordId, fieldId]
      );
      return result.rows ?? [];
    } catch (e) {
      logger.error('[RelationService] getLinkedRecords failed', {
        recordId,
        fieldId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getReverseLinks(recordId: string, fieldId: string): Promise<any[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT r.* FROM tp_record_links l
         JOIN tp_records r ON r.id = l.from_record_id
         JOIN tp_fields f ON f.id = l.from_field_id
         WHERE l.to_record_id = $1 AND (f.options->>'reverseFieldId')::text = $2`,
        [recordId, fieldId]
      );
      return result.rows ?? [];
    } catch (e) {
      logger.error('[RelationService] getReverseLinks failed', {
        recordId,
        fieldId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async computeCount(recordId: string, countFieldId: string): Promise<number> {
    const fieldOpts = await this.getFieldOptions(countFieldId);
    if (!fieldOpts || fieldOpts.fieldType !== 'count') return 0;
    const linkedFieldId = (fieldOpts.options as { linkedFieldId?: string }).linkedFieldId;
    if (!linkedFieldId) return 0;

    const db = getDatabase();
    const result = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM tp_record_links
       WHERE from_record_id = $1 AND from_field_id = $2`,
      [recordId, linkedFieldId]
    );
    const row = result.rows[0] as { cnt?: number };
    return row?.cnt ?? 0;
  },

  async computeLookup(recordId: string, lookupFieldId: string): Promise<unknown[]> {
    const fieldOpts = await this.getFieldOptions(lookupFieldId);
    if (!fieldOpts || fieldOpts.fieldType !== 'lookup') return [];
    const opts = fieldOpts.options as { linkedFieldId?: string; lookupFieldId?: string };
    const linkedFieldId = opts.linkedFieldId;
    const targetLookupFieldId = opts.lookupFieldId;
    if (!linkedFieldId || !targetLookupFieldId) return [];

    const linked = await this.getLinkedRecords(recordId, linkedFieldId);
    return linked.map((rec: { data?: Record<string, unknown> }) => {
      const data = rec.data ?? {};
      return data[targetLookupFieldId];
    });
  },

  async computeRollup(recordId: string, rollupFieldId: string): Promise<unknown> {
    const fieldOpts = await this.getFieldOptions(rollupFieldId);
    if (!fieldOpts || fieldOpts.fieldType !== 'rollup') return null;
    const opts = fieldOpts.options as {
      linkedFieldId?: string;
      lookupFieldId?: string;
      aggregation?: string;
    };
    const linkedFieldId = opts.linkedFieldId;
    const lookupFieldId = opts.lookupFieldId;
    const aggregation = opts.aggregation ?? 'count';
    if (!linkedFieldId || !lookupFieldId) return null;

    const linked = await this.getLinkedRecords(recordId, linkedFieldId);
    const values = linked.map(
      (rec: { data?: Record<string, unknown> }) => (rec.data ?? {})[lookupFieldId]
    );
    const filtered = (values as unknown[]).filter((v) => v != null && v !== '');

    switch (aggregation) {
      case 'sum':
        return filtered.reduce((a: number, v) => a + (Number(v) || 0), 0);
      case 'avg': {
        const nums = filtered.map(Number).filter((n) => !isNaN(n));
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      }
      case 'min': {
        const nums = filtered.map(Number).filter((n) => !isNaN(n));
        return nums.length ? Math.min(...nums) : null;
      }
      case 'max': {
        const nums = filtered.map(Number).filter((n) => !isNaN(n));
        return nums.length ? Math.max(...nums) : null;
      }
      case 'count':
        return values.length;
      case 'counta':
        return filtered.filter((v) => v != null && String(v).trim() !== '').length;
      case 'arrayCompact':
        return filtered;
      case 'arrayUnique':
        return [...new Set(filtered.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v)))];
      case 'arrayJoin':
        return filtered.map(String).join(', ');
      case 'concat':
        return filtered.map(String).join(', ');
      default:
        return filtered.length;
    }
  },

  async recomputeComputedFields(recordId: string): Promise<Record<string, unknown>> {
    const db = getDatabase();
    const record = (await db.query('SELECT * FROM tp_records WHERE id = $1', [recordId])).rows[0];
    if (!record) return {};

    const tableId = (record as { table_id: string }).table_id;
    const fieldsResult = await db.query(
      `SELECT id, field_type FROM tp_fields WHERE table_id = $1 AND field_type IN ('count', 'lookup', 'rollup')`,
      [tableId]
    );
    const fields = fieldsResult.rows as Array<{ id: string; field_type: string }>;

    const computed: Record<string, unknown> = {};
    const data = ((record as { data?: Record<string, unknown> }).data ?? {}) as Record<
      string,
      unknown
    >;

    for (const f of fields) {
      try {
        if (f.field_type === 'count') {
          computed[f.id] = await this.computeCount(recordId, f.id);
        } else if (f.field_type === 'lookup') {
          computed[f.id] = await this.computeLookup(recordId, f.id);
        } else if (f.field_type === 'rollup') {
          computed[f.id] = await this.computeRollup(recordId, f.id);
        }
      } catch (e) {
        logger.error('[RelationService] recompute field failed', {
          recordId,
          fieldId: f.id,
          error: (e as Error).message,
        });
      }
    }

    const merged = { ...data, ...computed };
    await db.query(`UPDATE tp_records SET data = $2, updated_at = NOW() WHERE id = $1`, [
      recordId,
      JSON.stringify(merged),
    ]);

    return computed;
  },

  /**
   * Cross-record recompute (root fix for "tabele kłamią").
   *
   * When a source record's cell values change, any *other* records that LINK
   * to it may carry rollup/lookup computed fields whose value is derived from
   * those cells. Historically these only refreshed on link/unlink/delete, so a
   * plain field edit left dependent rollups/lookups stale.
   *
   * This finds the records that link the changed source (rows in
   * `tp_record_links` where `to_record_id = sourceRecordId`), determines which
   * of them own a rollup/lookup that (a) traverses the specific link field that
   * points at the source and (b) reads one of the changed fields, and
   * recomputes those dependents.
   *
   * `count` is intentionally excluded: a count only depends on link
   * cardinality, not on the source record's cell values, so a value change on
   * the source never moves a count.
   *
   * Safety: a shared `visited` set (record ids already recomputed) plus a depth
   * cap prevent infinite cascades / reciprocal-link loops. Returns the set of
   * dependent record ids that were actually recomputed so the caller can emit
   * realtime updates for them.
   */
  async recomputeDependentsOfSource(
    sourceRecordId: string,
    changedFieldIds: string[],
    opts: { visited?: Set<string>; depth?: number; maxDepth?: number } = {}
  ): Promise<Array<{ recordId: string; tableId: string }>> {
    const db = getDatabase();
    const visited = opts.visited ?? new Set<string>([sourceRecordId]);
    const depth = opts.depth ?? 0;
    const maxDepth = opts.maxDepth ?? 5;
    if (depth >= maxDepth) return [];
    if (!changedFieldIds || changedFieldIds.length === 0) return [];

    const changedSet = new Set(changedFieldIds);
    const recomputed: Array<{ recordId: string; tableId: string }> = [];

    try {
      // Records that link the changed source, plus the link field they used.
      const backRefResult = await db.query(
        `SELECT DISTINCT from_record_id, from_field_id
           FROM tp_record_links
          WHERE to_record_id = $1`,
        [sourceRecordId]
      );
      const backRefs = backRefResult.rows as Array<{
        from_record_id: string;
        from_field_id: string;
      }>;
      if (backRefs.length === 0) return [];

      // Group the link fields by the dependent record's table so we only load
      // computed-field metadata once per table.
      const dependentRecordIds = [...new Set(backRefs.map((r) => r.from_record_id))];
      const tableByRecord = new Map<string, string>();
      const recTablesResult = await db.query(
        `SELECT id, table_id FROM tp_records WHERE id = ANY($1)`,
        [dependentRecordIds]
      );
      for (const row of recTablesResult.rows as Array<{ id: string; table_id: string }>) {
        tableByRecord.set(row.id, row.table_id);
      }

      // For each dependent table, the rollup/lookup fields keyed by the link
      // field they traverse (`linkedFieldId`) so we can decide per-record
      // whether the changed source field is actually consumed.
      const computedByTable = new Map<
        string,
        Map<string, Array<{ id: string; lookupFieldId?: string }>>
      >();
      const loadComputedForTable = async (tableId: string) => {
        if (computedByTable.has(tableId)) return computedByTable.get(tableId)!;
        const fieldsResult = await db.query(
          `SELECT id, field_type, options FROM tp_fields
            WHERE table_id = $1 AND field_type IN ('rollup', 'lookup')`,
          [tableId]
        );
        const byLinkField = new Map<string, Array<{ id: string; lookupFieldId?: string }>>();
        for (const f of fieldsResult.rows as Array<{
          id: string;
          field_type: string;
          options: unknown;
        }>) {
          const opts = (f.options ?? {}) as { linkedFieldId?: string; lookupFieldId?: string };
          const linkedFieldId = opts.linkedFieldId;
          if (!linkedFieldId) continue;
          const arr = byLinkField.get(linkedFieldId) ?? [];
          arr.push({ id: f.id, lookupFieldId: opts.lookupFieldId });
          byLinkField.set(linkedFieldId, arr);
        }
        computedByTable.set(tableId, byLinkField);
        return byLinkField;
      };

      for (const ref of backRefs) {
        const dependentId = ref.from_record_id;
        if (visited.has(dependentId)) continue;
        const tableId = tableByRecord.get(dependentId);
        if (!tableId) continue;

        const byLinkField = await loadComputedForTable(tableId);
        const candidates = byLinkField.get(ref.from_field_id);
        if (!candidates || candidates.length === 0) continue;

        // A rollup/lookup is affected only if it reads one of the changed
        // fields on the source record.
        const affected = candidates.some(
          (c) => c.lookupFieldId != null && changedSet.has(c.lookupFieldId)
        );
        if (!affected) continue;

        visited.add(dependentId);
        try {
          await this.recomputeComputedFields(dependentId);
          recomputed.push({ recordId: dependentId, tableId });
        } catch (e) {
          logger.error('[RelationService] recomputeDependentsOfSource recompute failed', {
            dependentId,
            error: (e as Error).message,
          });
        }
      }

      return recomputed;
    } catch (e) {
      logger.error('[RelationService] recomputeDependentsOfSource failed', {
        sourceRecordId,
        error: (e as Error).message,
      });
      // Fail-soft: never let cross-record recompute break the originating write.
      return recomputed;
    }
  },

  async expandRecord(recordId: string, depth: number = 1): Promise<ExpandedRecord | null> {
    const MAX_DEPTH = 3;
    const effectiveDepth = Math.min(Math.max(depth, 0), MAX_DEPTH);
    const db = getDatabase();

    try {
      const recordResult = await db.query('SELECT * FROM tp_records WHERE id = $1', [recordId]);
      const record = recordResult.rows[0] as
        | { id: string; table_id: string; data?: Record<string, unknown> }
        | undefined;
      if (!record) return null;

      const expanded: ExpandedRecord = {
        id: record.id,
        tableId: record.table_id,
        data: (record.data ?? {}) as Record<string, unknown>,
        linkedRecords: {},
      };

      if (effectiveDepth < 1) return expanded;

      const fieldsResult = await db.query(
        `SELECT id FROM tp_fields WHERE table_id = $1 AND field_type = 'linkedRecord'`,
        [record.table_id]
      );
      const linkedFields = fieldsResult.rows as Array<{ id: string }>;

      for (const field of linkedFields) {
        const linked = await this.getLinkedRecords(recordId, field.id);
        const expandedLinked: ExpandedRecord[] = [];

        for (const linkedRec of linked) {
          const lr = linkedRec as { id: string; table_id: string; data?: Record<string, unknown> };
          if (effectiveDepth > 1) {
            const childExpanded = await this.expandRecord(lr.id, effectiveDepth - 1);
            if (childExpanded) expandedLinked.push(childExpanded);
          } else {
            expandedLinked.push({
              id: lr.id,
              tableId: lr.table_id,
              data: (lr.data ?? {}) as Record<string, unknown>,
              linkedRecords: {},
            });
          }
        }

        if (expandedLinked.length > 0) {
          expanded.linkedRecords[field.id] = expandedLinked;
        }
      }

      return expanded;
    } catch (e) {
      logger.error('[RelationService] expandRecord failed', {
        recordId,
        depth,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async getLinkedRecordDisplayNames(recordIds: string[]): Promise<Record<string, string>> {
    if (!recordIds.length) return {};
    const db = getDatabase();

    try {
      const result = await db.query(
        `SELECT r.id, r.data, t.primary_field_id
         FROM tp_records r
         JOIN tp_tables t ON t.id = r.table_id
         WHERE r.id = ANY($1)`,
        [recordIds]
      );

      const displayNames: Record<string, string> = {};
      for (const row of result.rows as Array<{
        id: string;
        data?: Record<string, unknown>;
        primary_field_id?: string;
      }>) {
        const primaryFieldId = row.primary_field_id;
        const data = (row.data ?? {}) as Record<string, unknown>;
        if (primaryFieldId && data[primaryFieldId] != null) {
          displayNames[row.id] = String(data[primaryFieldId]);
        } else {
          displayNames[row.id] = row.id;
        }
      }

      for (const id of recordIds) {
        if (!(id in displayNames)) {
          displayNames[id] = id;
        }
      }

      return displayNames;
    } catch (e) {
      logger.error('[RelationService] getLinkedRecordDisplayNames failed', {
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async onRecordDeleted(recordId: string): Promise<void> {
    const db = getDatabase();
    try {
      const linksFrom = await db.query(
        `SELECT DISTINCT from_record_id FROM tp_record_links WHERE from_record_id = $1 OR to_record_id = $1`,
        [recordId]
      );
      const linksTo = await db.query(
        `SELECT DISTINCT to_record_id, from_record_id FROM tp_record_links WHERE from_record_id = $1 OR to_record_id = $1`,
        [recordId]
      );

      const affected = new Set<string>();
      for (const row of linksFrom.rows as Array<{ from_record_id: string }>) {
        if (row.from_record_id && row.from_record_id !== recordId) affected.add(row.from_record_id);
      }
      for (const row of linksTo.rows as Array<{ to_record_id: string; from_record_id: string }>) {
        if (row.to_record_id && row.to_record_id !== recordId) affected.add(row.to_record_id);
        if (row.from_record_id && row.from_record_id !== recordId) affected.add(row.from_record_id);
      }

      await db.query(`DELETE FROM tp_record_links WHERE from_record_id = $1 OR to_record_id = $1`, [
        recordId,
        recordId,
      ]);

      for (const recId of affected) {
        try {
          await this.recomputeComputedFields(recId);
        } catch (e) {
          logger.error('[RelationService] onRecordDeleted recompute failed', {
            recordId: recId,
            error: (e as Error).message,
          });
        }
      }
    } catch (e) {
      logger.error('[RelationService] onRecordDeleted failed', {
        recordId,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

export default relationService;
