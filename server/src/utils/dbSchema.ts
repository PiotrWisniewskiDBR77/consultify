/**
 * Lightweight DB schema helpers (SQLite + Postgres).
 *
 * Used to make queries resilient to schema drift between environments.
 */

import * as queryHelpers from './queryHelpers.js';

const cache = new Map<string, Promise<Set<string>>>();
const MOCK_TABLE_FALLBACK_COLUMNS: Record<string, string[]> = {
  tasks: [
    'id',
    'organization_id',
    'title',
    'description',
    'status',
    'priority',
    'assignee_id',
    'reporter_id',
    'due_date',
    'tags',
    'task_type',
    'source_type',
    'source_id',
    'created_at',
    'updated_at',
    'completed_at',
  ],
  canonical_inbox_items: [
    'id',
    'user_id',
    'organization_id',
    'item_type',
    'source_entity_type',
    'source_entity_id',
    'title',
    'description',
    'priority',
    'section',
    'status',
    'sla_deadline',
    'sla_status',
    'delegated_to',
    'delegated_at',
    'delegated_by',
    'delegation_notes',
    'metadata_json',
    'created_at',
    'updated_at',
    'resolved_at',
  ],
  my_idea_maps: [
    'id',
    'idea_id',
    'user_id',
    'organization_id',
    'nodes_json',
    'edges_json',
    'version',
    'created_at',
    'updated_at',
    'preferred_tool',
    'extensions_json',
    'schema_version',
    // DP-3 shared idea maps (20260705_dp3_shared_idea_maps.sql):
    'is_canonical',
    'last_editor_user_id',
    'archived_from_user_id',
  ],
  my_ideas: [
    'id',
    'user_id',
    'organization_id',
    'title',
    'body',
    'tags',
    'source_type',
    'source_conversation_id',
    'source_message_id',
    'created_at',
    'updated_at',
    'action_contract_json',
    'source_pack_json',
    'evidence_refs_json',
    // M2 home-shell columns (migration 20260602). Without these in the fallback,
    // folder assignment (folder_id) silently no-ops under mock-DB / tests.
    'folder_id',
    'is_favorite',
    'last_opened_at',
  ],
};

function isMockDbEnabled(): boolean {
  return (
    process.env.MOCK_DB === 'true' ||
    (process.env.NODE_ENV === 'test' &&
      process.env.RUN_DB_TESTS !== '1' &&
      process.env.MOCK_DB !== 'false')
  );
}

async function getPostgresColumns(table: string): Promise<Set<string>> {
  const rows = await queryHelpers.queryAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set((rows || []).map((r) => String(r.column_name)));
}

async function getMockColumns(table: string): Promise<Set<string>> {
  try {
    const rows = await queryHelpers.queryAll<{ name?: string }>(
      `PRAGMA table_info("${String(table || '').trim()}")`,
      []
    );
    const columns = new Set((rows || []).map((r) => String(r.name || '')).filter(Boolean));
    if (columns.size > 0) return columns;
    const fallback =
      MOCK_TABLE_FALLBACK_COLUMNS[
        String(table || '')
          .trim()
          .toLowerCase()
      ] || [];
    return new Set(fallback);
  } catch {
    const fallback =
      MOCK_TABLE_FALLBACK_COLUMNS[
        String(table || '')
          .trim()
          .toLowerCase()
      ] || [];
    return new Set(fallback);
  }
}

export async function getTableColumns(table: string): Promise<Set<string>> {
  const mode = isMockDbEnabled() ? 'mock' : 'postgres';
  const key = `${mode}:${table}`;
  if (!cache.has(key)) {
    cache.set(key, isMockDbEnabled() ? getMockColumns(table) : getPostgresColumns(table));
  }
  return await cache.get(key)!;
}

export async function hasColumn(table: string, column: string): Promise<boolean> {
  const cols = await getTableColumns(table);
  return cols.has(column);
}

export function clearSchemaCache(): number {
  const size = cache.size;
  cache.clear();
  return size;
}
