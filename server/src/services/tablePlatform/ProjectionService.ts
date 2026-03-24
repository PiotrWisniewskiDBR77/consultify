/**
 * Table Platform Projection Service
 *
 * Builds workspace-compatible graph fragments from table platform canonical data.
 * Allows existing workspace tools (IdeaMapWorkspace, mindmap, whiteboard, process_flow)
 * to see table platform data without modification.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface TableExtensions {
  columns: Array<{
    id: string;
    key: string;
    name: string;
    type: string;
    options?: Record<string, unknown>;
    visible?: boolean;
    width?: number;
  }>;
  views: Array<{
    id: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
  }>;
  viewState?: Record<string, unknown>;
}

export interface WorkspaceProjection {
  baseId: string;
  tableId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  extensions: { table: TableExtensions };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: WorkspaceProjection;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const projectionCache = new Map<string, CacheEntry>();

function getCacheKey(ideaId: string, tableId: string): string {
  return `${ideaId}:${tableId}`;
}

function getCached(key: string): WorkspaceProjection | null {
  const entry = projectionCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    projectionCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: WorkspaceProjection): void {
  projectionCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// TP field_type → legacy column type mapping
// ---------------------------------------------------------------------------

const TP_TYPE_TO_LEGACY: Record<string, string> = {
  single_line_text: 'text',
  long_text: 'text',
  number: 'number',
  date: 'date',
  single_select: 'select',
  multi_select: 'multiselect',
  checkbox: 'checkbox',
  url: 'url',
  email: 'email',
  percent: 'progress',
  currency: 'currency',
  phone: 'phone',
  attachment: 'attachment',
  linkedRecord: 'relation',
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const projectionService = {
  /**
   * Resolve an idea_id to the table platform base_id.
   * tp_bases.workspace_id stores the idea_id directly.
   */
  async resolveBaseId(
    ideaId: string,
    organizationId: string,
    _userId: string
  ): Promise<{ baseId: string; tableId: string } | null> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT b.id AS base_id, t.id AS table_id
         FROM tp_bases b
         LEFT JOIN tp_tables t ON t.base_id = b.id
         WHERE b.workspace_id = $1 AND b.organization_id = $2
         ORDER BY b.created_at ASC, t.created_at ASC
         LIMIT 1`,
        [ideaId, organizationId]
      );
      const row = result.rows[0] as { base_id?: string; table_id?: string } | undefined;
      if (!row?.base_id) return null;
      return {
        baseId: row.base_id,
        tableId: row.table_id ?? '',
      };
    } catch (e) {
      logger.error('[ProjectionService] resolveBaseId failed', {
        ideaId,
        organizationId,
        error: (e as Error).message,
      });
      return null;
    }
  },

  /**
   * Build graph-compatible nodes from table platform records.
   */
  async projectRecordsAsNodes(tableId: string): Promise<GraphNode[]> {
    if (!tableId) return [];
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT id, data, created_at FROM tp_records
         WHERE table_id = $1
         ORDER BY created_at ASC`,
        [tableId]
      );
      return result.rows.map((row: any, index: number) => ({
        id: row.id,
        type: 'table_row',
        data: typeof row.data === 'string' ? JSON.parse(row.data) : (row.data ?? {}),
        position: { x: 0, y: index * 40 },
      }));
    } catch (e) {
      logger.error('[ProjectionService] projectRecordsAsNodes failed', {
        tableId,
        error: (e as Error).message,
      });
      return [];
    }
  },

  /**
   * Build graph-compatible edges from record_links.
   */
  async projectLinksAsEdges(tableId: string): Promise<GraphEdge[]> {
    if (!tableId) return [];
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT rl.from_record_id, rl.from_field_id, rl.to_record_id
         FROM tp_record_links rl
         WHERE rl.from_record_id IN (
           SELECT id FROM tp_records WHERE table_id = $1
         )`,
        [tableId]
      );
      return result.rows.map((row: any) => ({
        id: `${row.from_record_id}-${row.from_field_id}-${row.to_record_id}`,
        source: row.from_record_id,
        target: row.to_record_id,
        type: 'relation',
      }));
    } catch (e) {
      logger.error('[ProjectionService] projectLinksAsEdges failed', {
        tableId,
        error: (e as Error).message,
      });
      return [];
    }
  },

  /**
   * Build extensions.table compatible payload from table platform metadata.
   */
  async projectTableExtensions(
    _baseId: string,
    tableId: string
  ): Promise<TableExtensions> {
    if (!tableId) return { columns: [], views: [] };
    const db = getDatabase();
    try {
      const [fieldsResult, viewsResult] = await Promise.all([
        db.query(
          `SELECT id, name, field_type, options, field_order
           FROM tp_fields
           WHERE table_id = $1
           ORDER BY field_order ASC, created_at ASC`,
          [tableId]
        ),
        db.query(
          `SELECT id, name, view_type, config, visible_field_ids
           FROM tp_views
           WHERE table_id = $1
           ORDER BY created_at ASC`,
          [tableId]
        ),
      ]);

      const columns = fieldsResult.rows.map((f: any) => {
        const opts = typeof f.options === 'string' ? JSON.parse(f.options) : (f.options ?? {});
        return {
          id: f.id,
          key: f.id,
          name: f.name,
          type: TP_TYPE_TO_LEGACY[f.field_type] ?? 'text',
          options: Object.keys(opts).length > 0 ? opts : undefined,
          visible: true,
          width: undefined,
        };
      });

      const views = viewsResult.rows.map((v: any) => {
        const cfg = typeof v.config === 'string' ? JSON.parse(v.config) : (v.config ?? {});
        return {
          id: v.id,
          name: v.name,
          type: v.view_type ?? 'grid',
          config: cfg,
        };
      });

      return { columns, views };
    } catch (e) {
      logger.error('[ProjectionService] projectTableExtensions failed', {
        tableId,
        error: (e as Error).message,
      });
      return { columns: [], views: [] };
    }
  },

  /**
   * Full projection: returns a complete workspace-compatible payload
   * that can be merged into the getMyIdeaMap response.
   */
  async getFullProjection(
    ideaId: string,
    organizationId: string,
    userId: string
  ): Promise<WorkspaceProjection | null> {
    const resolved = await this.resolveBaseId(ideaId, organizationId, userId);
    if (!resolved || !resolved.tableId) return null;

    const { baseId, tableId } = resolved;
    const cacheKey = getCacheKey(ideaId, tableId);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const [nodes, edges, extensions] = await Promise.all([
      this.projectRecordsAsNodes(tableId),
      this.projectLinksAsEdges(tableId),
      this.projectTableExtensions(baseId, tableId),
    ]);

    const projection: WorkspaceProjection = {
      baseId,
      tableId,
      nodes,
      edges,
      extensions: { table: extensions },
    };

    setCache(cacheKey, projection);
    return projection;
  },

  /**
   * Invalidate all cache entries for a given base.
   * Called when schema or records mutate.
   */
  invalidateCache(baseId: string): void {
    for (const [key, entry] of projectionCache.entries()) {
      if (entry.data.baseId === baseId) {
        projectionCache.delete(key);
      }
    }
  },

  /**
   * Invalidate a specific cache entry by ideaId + tableId.
   */
  invalidateCacheEntry(ideaId: string, tableId: string): void {
    projectionCache.delete(getCacheKey(ideaId, tableId));
  },

  /**
   * Clear the entire projection cache (for testing / maintenance).
   */
  clearCache(): void {
    projectionCache.clear();
  },
};

export default projectionService;
