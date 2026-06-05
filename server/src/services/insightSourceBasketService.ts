/**
 * insightSourceBasketService — backend for reusable "Source Baskets" used by the
 * AI Insight Creator (InsightCreatorModal).
 *
 * Why this exists (audit #28c/#28d — _IV_TEST_NOTES.md #28):
 * Every new insight forced the consultant to re-pick the same source sessions in
 * the wizard's "Source" step. The owner wants "z jednych źródeł różne insighty
 * pod różnym kątem" — i.e. build the source selection once, save it as a named
 * "basket", and reuse it across many insights/lenses. This service persists those
 * baskets (org-scoped) and exposes simple CRUD + a usage "touch".
 *
 * Persistence model: the basket stores the selected session ids plus the optional
 * people/filter selections as JSON, alongside light bookkeeping columns
 * (created_by, timestamps, usage_count, last_used_at). DB_MANAGED_SCHEMA is off,
 * so the table is created lazily via CREATE TABLE IF NOT EXISTS (same pattern as
 * discovery.routes.ts / KnowledgeService.ts).
 */

import { randomUUID } from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InsightSourceBasket {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  sessionIds: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  peopleFilter: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterCriteria: any | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  usageCount: number;
}

export interface CreateBasketInput {
  name: string;
  sessionIds: string[];
  projectId?: string | null;
  description?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  peopleFilter?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterCriteria?: any;
}

export interface UpdateBasketInput {
  name?: string;
  sessionIds?: string[];
  projectId?: string | null;
  description?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  peopleFilter?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterCriteria?: any;
}

// ---------------------------------------------------------------------------
// Lazy schema (DB_MANAGED_SCHEMA is off — create on first use)
// ---------------------------------------------------------------------------

let schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await dbRun(
    `CREATE TABLE IF NOT EXISTS insight_source_baskets (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      selected_session_ids_json TEXT NOT NULL,
      people_filter_json TEXT,
      filter_criteria_json TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP,
      usage_count INTEGER DEFAULT 0
    )`,
    []
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_insight_source_baskets_org
       ON insight_source_baskets(organization_id)`,
    []
  ).catch(() => {});
  schemaReady = true;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJson(raw: unknown, fallback: any): any {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    return JSON.parse(String(raw));
  } catch {
    return fallback;
  }
}

function mapRow(row: Record<string, unknown> | undefined | null): InsightSourceBasket | null {
  if (!row) return null;
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    projectId: (row.project_id as string) ?? null,
    name: String(row.name ?? ''),
    description: (row.description as string) ?? null,
    sessionIds: parseJson(row.selected_session_ids_json, []) as string[],
    peopleFilter: parseJson(row.people_filter_json, null),
    filterCriteria: parseJson(row.filter_criteria_json, null),
    createdBy: String(row.created_by ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    lastUsedAt: (row.last_used_at as string) ?? null,
    usageCount: Number(row.usage_count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listBaskets(organizationId: string): Promise<InsightSourceBasket[]> {
  await ensureSchema();
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT * FROM insight_source_baskets
       WHERE organization_id = ?
       ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC`,
    [organizationId],
    { fallback: false }
  );
  return (rows || []).map(mapRow).filter((b): b is InsightSourceBasket => b !== null);
}

export async function getBasket(
  organizationId: string,
  id: string
): Promise<InsightSourceBasket | null> {
  await ensureSchema();
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM insight_source_baskets WHERE id = ? AND organization_id = ?`,
    [id, organizationId],
    { fallback: false }
  );
  return mapRow(row);
}

export async function createBasket(
  organizationId: string,
  userId: string,
  input: CreateBasketInput
): Promise<InsightSourceBasket> {
  await ensureSchema();
  const id = randomUUID();
  const now = new Date().toISOString();
  const sessionIds = Array.isArray(input.sessionIds) ? input.sessionIds.map(String) : [];

  await dbRun(
    `INSERT INTO insight_source_baskets
       (id, organization_id, project_id, name, description,
        selected_session_ids_json, people_filter_json, filter_criteria_json,
        created_by, created_at, updated_at, last_used_at, usage_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      input.projectId ?? null,
      String(input.name || '').trim(),
      input.description ?? null,
      JSON.stringify(sessionIds),
      input.peopleFilter != null ? JSON.stringify(input.peopleFilter) : null,
      input.filterCriteria != null ? JSON.stringify(input.filterCriteria) : null,
      userId,
      now,
      now,
      null,
      0,
    ],
    { fallback: false }
  );

  const created = await getBasket(organizationId, id);
  if (!created) throw new Error('Failed to create source basket');
  return created;
}

export async function updateBasket(
  organizationId: string,
  id: string,
  input: UpdateBasketInput
): Promise<InsightSourceBasket | null> {
  await ensureSchema();
  const existing = await getBasket(organizationId, id);
  if (!existing) return null;

  const next = {
    name: input.name !== undefined ? String(input.name).trim() : existing.name,
    description: input.description !== undefined ? input.description : existing.description,
    projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
    sessionIds: input.sessionIds !== undefined ? input.sessionIds.map(String) : existing.sessionIds,
    peopleFilter: input.peopleFilter !== undefined ? input.peopleFilter : existing.peopleFilter,
    filterCriteria:
      input.filterCriteria !== undefined ? input.filterCriteria : existing.filterCriteria,
  };
  const now = new Date().toISOString();

  await dbRun(
    `UPDATE insight_source_baskets
       SET name = ?, description = ?, project_id = ?,
           selected_session_ids_json = ?, people_filter_json = ?, filter_criteria_json = ?,
           updated_at = ?
       WHERE id = ? AND organization_id = ?`,
    [
      next.name,
      next.description ?? null,
      next.projectId ?? null,
      JSON.stringify(next.sessionIds),
      next.peopleFilter != null ? JSON.stringify(next.peopleFilter) : null,
      next.filterCriteria != null ? JSON.stringify(next.filterCriteria) : null,
      now,
      id,
      organizationId,
    ],
    { fallback: false }
  );

  return getBasket(organizationId, id);
}

export async function deleteBasket(organizationId: string, id: string): Promise<boolean> {
  await ensureSchema();
  const existing = await getBasket(organizationId, id);
  if (!existing) return false;
  await dbRun(
    `DELETE FROM insight_source_baskets WHERE id = ? AND organization_id = ?`,
    [id, organizationId],
    { fallback: false }
  );
  return true;
}

/**
 * Bump usage_count + last_used_at. Call when an insight is generated from a
 * basket so the list can surface "used X×" and most-recently-used ordering.
 */
export async function touchBasket(
  organizationId: string,
  id: string
): Promise<InsightSourceBasket | null> {
  await ensureSchema();
  const existing = await getBasket(organizationId, id);
  if (!existing) return null;
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE insight_source_baskets
       SET usage_count = usage_count + 1, last_used_at = ?
       WHERE id = ? AND organization_id = ?`,
    [now, id, organizationId],
    { fallback: false }
  );
  return getBasket(organizationId, id);
}
