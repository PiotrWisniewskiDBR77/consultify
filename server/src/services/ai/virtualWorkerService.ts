/**
 * Virtual Worker Service
 *
 * CRUD operations for virtual workers, profiles, and knowledge assignments.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkerRole = 'sales_lp' | 'internal_consultant' | 'onboarding' | 'custom';
export type WorkerStatus = 'active' | 'draft' | 'disabled';
export type WorkerSurface = 'landing_page' | 'in_platform' | 'both';

export interface VirtualWorker {
  id: string;
  slug: string;
  name: string;
  role: WorkerRole;
  status: WorkerStatus;
  surface: WorkerSurface;
  voice_enabled: boolean;
  voice_name: string | null;
  locale_default: string;
  avatar_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface VirtualWorkerProfile {
  id: string;
  worker_id: string;
  version: number;
  persona_description: string | null;
  tone_description: string | null;
  system_prompt: string;
  priority_rules: Record<string, unknown> | null;
  boundaries: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  activated_at: string | null;
}

export interface KnowledgeAssignment {
  id: string;
  worker_id: string;
  knowledge_source_type: string;
  knowledge_doc_id: string | null;
  product_slug: string | null;
  priority_weight: number;
  assigned_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function db() {
  return getDatabase();
}

function parseJsonb<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

function rowToWorker(row: Record<string, unknown>): VirtualWorker {
  return {
    id: String(row.id || ''),
    slug: String(row.slug || ''),
    name: String(row.name || ''),
    role: String(row.role || 'custom') as WorkerRole,
    status: String(row.status || 'draft') as WorkerStatus,
    surface: String(row.surface || 'landing_page') as WorkerSurface,
    voice_enabled: Boolean(row.voice_enabled),
    voice_name: row.voice_name ? String(row.voice_name) : null,
    locale_default: String(row.locale_default || 'pl'),
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    description: row.description ? String(row.description) : null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function rowToProfile(row: Record<string, unknown>): VirtualWorkerProfile {
  return {
    id: String(row.id || ''),
    worker_id: String(row.worker_id || ''),
    version: Number(row.version || 1),
    persona_description: row.persona_description ? String(row.persona_description) : null,
    tone_description: row.tone_description ? String(row.tone_description) : null,
    system_prompt: String(row.system_prompt || ''),
    priority_rules: parseJsonb<Record<string, unknown>>(row.priority_rules),
    boundaries: parseJsonb<Record<string, unknown>>(row.boundaries),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at || ''),
    activated_at: row.activated_at ? String(row.activated_at) : null,
  };
}

function rowToAssignment(row: Record<string, unknown>): KnowledgeAssignment {
  return {
    id: String(row.id || ''),
    worker_id: String(row.worker_id || ''),
    knowledge_source_type: String(row.knowledge_source_type || 'product_pill'),
    knowledge_doc_id: row.knowledge_doc_id ? String(row.knowledge_doc_id) : null,
    product_slug: row.product_slug ? String(row.product_slug) : null,
    priority_weight: Number(row.priority_weight ?? 1.0),
    assigned_at: String(row.assigned_at || ''),
  };
}

// ---------------------------------------------------------------------------
// Workers CRUD
// ---------------------------------------------------------------------------

export async function listWorkers(): Promise<VirtualWorker[]> {
  const result = await db().query<Record<string, unknown>>(
    'SELECT * FROM virtual_workers ORDER BY created_at ASC'
  );
  return (result.rows || []).map(rowToWorker);
}

export async function getWorkerById(id: string): Promise<VirtualWorker | null> {
  const result = await db().query<Record<string, unknown>>(
    'SELECT * FROM virtual_workers WHERE id = $1',
    [id]
  );
  return result.rows[0] ? rowToWorker(result.rows[0]) : null;
}

export async function getWorkerBySlug(slug: string): Promise<VirtualWorker | null> {
  const result = await db().query<Record<string, unknown>>(
    'SELECT * FROM virtual_workers WHERE slug = $1',
    [slug]
  );
  return result.rows[0] ? rowToWorker(result.rows[0]) : null;
}

export async function createWorker(data: {
  slug: string;
  name: string;
  role?: WorkerRole;
  status?: WorkerStatus;
  surface?: WorkerSurface;
  voice_enabled?: boolean;
  voice_name?: string | null;
  locale_default?: string;
  avatar_url?: string | null;
  description?: string | null;
}): Promise<VirtualWorker> {
  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_workers (id, slug, name, role, status, surface, voice_enabled, voice_name, locale_default, avatar_url, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      data.slug,
      data.name,
      data.role || 'custom',
      data.status || 'draft',
      data.surface || 'landing_page',
      data.voice_enabled ? 1 : 0,
      data.voice_name || null,
      data.locale_default || 'pl',
      data.avatar_url || null,
      data.description || null,
    ]
  );
  logger.info(`[VirtualWorkerService] Created worker: ${data.slug} (${id})`);
  return (await getWorkerById(id))!;
}

export async function updateWorker(
  id: string,
  data: Partial<Omit<VirtualWorker, 'id' | 'created_at' | 'updated_at'>>
): Promise<VirtualWorker | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const dbKey = key === 'voice_enabled' ? key : key;
    const dbValue = key === 'voice_enabled' ? (value ? 1 : 0) : value;
    sets.push(`${dbKey} = $${idx}`);
    params.push(dbValue);
    idx++;
  }

  if (sets.length === 0) return getWorkerById(id);

  sets.push(`updated_at = NOW()`);
  params.push(id);

  await db().query(`UPDATE virtual_workers SET ${sets.join(', ')} WHERE id = $${idx}`, params);
  return getWorkerById(id);
}

export async function deleteWorker(id: string): Promise<boolean> {
  const result = await db().query('DELETE FROM virtual_workers WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function getActiveProfile(workerId: string): Promise<VirtualWorkerProfile | null> {
  const result = await db().query<Record<string, unknown>>(
    'SELECT * FROM virtual_worker_profiles WHERE worker_id = $1 AND is_active = TRUE ORDER BY version DESC LIMIT 1',
    [workerId]
  );
  return result.rows[0] ? rowToProfile(result.rows[0]) : null;
}

export async function listProfiles(workerId: string): Promise<VirtualWorkerProfile[]> {
  const result = await db().query<Record<string, unknown>>(
    'SELECT * FROM virtual_worker_profiles WHERE worker_id = $1 ORDER BY version DESC',
    [workerId]
  );
  return (result.rows || []).map(rowToProfile);
}

export async function createProfile(data: {
  worker_id: string;
  persona_description?: string;
  tone_description?: string;
  system_prompt: string;
  priority_rules?: Record<string, unknown>;
  boundaries?: Record<string, unknown>;
  activate?: boolean;
}): Promise<VirtualWorkerProfile> {
  const id = uuidv4();

  const maxVersionResult = await db().query<{ max_v: number }>(
    'SELECT COALESCE(MAX(version), 0) as max_v FROM virtual_worker_profiles WHERE worker_id = $1',
    [data.worker_id]
  );
  const nextVersion = (maxVersionResult.rows[0]?.max_v ?? 0) + 1;
  const shouldActivate = data.activate !== false;

  if (shouldActivate) {
    await db().query('UPDATE virtual_worker_profiles SET is_active = FALSE WHERE worker_id = $1', [
      data.worker_id,
    ]);
  }

  await db().query(
    `INSERT INTO virtual_worker_profiles
     (id, worker_id, version, persona_description, tone_description, system_prompt, priority_rules, boundaries, is_active, activated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      data.worker_id,
      nextVersion,
      data.persona_description || null,
      data.tone_description || null,
      data.system_prompt,
      data.priority_rules ? JSON.stringify(data.priority_rules) : null,
      data.boundaries ? JSON.stringify(data.boundaries) : null,
      shouldActivate,
      shouldActivate ? new Date().toISOString() : null,
    ]
  );

  logger.info(
    `[VirtualWorkerService] Created profile v${nextVersion} for worker ${data.worker_id}`
  );
  return rowToProfile({
    id,
    worker_id: data.worker_id,
    version: nextVersion,
    persona_description: data.persona_description || null,
    tone_description: data.tone_description || null,
    system_prompt: data.system_prompt,
    priority_rules: data.priority_rules || null,
    boundaries: data.boundaries || null,
    is_active: shouldActivate,
    created_at: new Date().toISOString(),
    activated_at: shouldActivate ? new Date().toISOString() : null,
  });
}

export async function activateProfile(profileId: string): Promise<void> {
  const result = await db().query<Record<string, unknown>>(
    'SELECT worker_id FROM virtual_worker_profiles WHERE id = $1',
    [profileId]
  );
  const workerId = result.rows[0]?.worker_id;
  if (!workerId) return;

  await db().query('UPDATE virtual_worker_profiles SET is_active = FALSE WHERE worker_id = $1', [
    workerId,
  ]);
  await db().query(
    'UPDATE virtual_worker_profiles SET is_active = TRUE, activated_at = NOW() WHERE id = $1',
    [profileId]
  );
}

// ---------------------------------------------------------------------------
// Knowledge Assignments
// ---------------------------------------------------------------------------

export async function listKnowledgeAssignments(workerId: string): Promise<KnowledgeAssignment[]> {
  const result = await db().query<Record<string, unknown>>(
    'SELECT * FROM virtual_worker_knowledge_assignments WHERE worker_id = $1 ORDER BY priority_weight DESC',
    [workerId]
  );
  return (result.rows || []).map(rowToAssignment);
}

export async function assignKnowledge(data: {
  worker_id: string;
  knowledge_source_type?: string;
  knowledge_doc_id?: string | null;
  product_slug?: string | null;
  priority_weight?: number;
}): Promise<KnowledgeAssignment> {
  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_worker_knowledge_assignments
     (id, worker_id, knowledge_source_type, knowledge_doc_id, product_slug, priority_weight)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      data.worker_id,
      data.knowledge_source_type || 'product_pill',
      data.knowledge_doc_id || null,
      data.product_slug || null,
      data.priority_weight ?? 1.0,
    ]
  );
  return rowToAssignment({
    id,
    worker_id: data.worker_id,
    knowledge_source_type: data.knowledge_source_type || 'product_pill',
    knowledge_doc_id: data.knowledge_doc_id || null,
    product_slug: data.product_slug || null,
    priority_weight: data.priority_weight ?? 1.0,
    assigned_at: new Date().toISOString(),
  });
}

export async function removeKnowledgeAssignment(assignmentId: string): Promise<boolean> {
  const result = await db().query(
    'DELETE FROM virtual_worker_knowledge_assignments WHERE id = $1',
    [assignmentId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function bulkAssignProductPills(
  workerId: string,
  productSlugs: Array<{ slug: string; weight: number }>
): Promise<number> {
  let count = 0;
  for (const { slug, weight } of productSlugs) {
    const existing = await db().query<{ id: string }>(
      `SELECT id FROM virtual_worker_knowledge_assignments
       WHERE worker_id = $1 AND product_slug = $2 AND knowledge_source_type = 'product_pill'`,
      [workerId, slug]
    );
    if (existing.rows.length > 0) {
      await db().query(
        'UPDATE virtual_worker_knowledge_assignments SET priority_weight = $1 WHERE id = $2',
        [weight, existing.rows[0].id]
      );
    } else {
      await assignKnowledge({
        worker_id: workerId,
        knowledge_source_type: 'product_pill',
        product_slug: slug,
        priority_weight: weight,
      });
    }
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Convenience: get worker with active profile
// ---------------------------------------------------------------------------

export async function getWorkerWithProfile(
  slugOrId: string
): Promise<{ worker: VirtualWorker; profile: VirtualWorkerProfile | null } | null> {
  let worker = await getWorkerBySlug(slugOrId);
  if (!worker) worker = await getWorkerById(slugOrId);
  if (!worker) return null;

  const profile = await getActiveProfile(worker.id);
  return { worker, profile };
}
