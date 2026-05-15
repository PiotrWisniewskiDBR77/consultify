/**
 * Virtual Worker Service
 *
 * CRUD operations for workers, governed knowledge pills,
 * runtime profiles, evaluations and releases.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export type WorkerRole = 'sales_lp' | 'internal_consultant' | 'onboarding' | 'custom';
export type WorkerStatus = 'active' | 'draft' | 'disabled';
export type WorkerSurface = 'landing_page' | 'in_platform' | 'both';
export type KnowledgeUsageMode =
  | 'full_pill'
  | 'selected_sections'
  | 'retrieval_only'
  | 'fallback_only';
export type WorkerEvalStatus = 'draft' | 'running' | 'passed' | 'failed';
export type WorkerReleaseStatus = 'draft' | 'ready' | 'active' | 'rolled_back';

export class VirtualWorkerValidationError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code = 'VW_VALIDATION_ERROR', statusCode = 400) {
    super(message);
    this.name = 'VirtualWorkerValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

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
  memory_policy: Record<string, unknown>;
  channel_policy: Record<string, unknown>;
  retrieval_policy: Record<string, unknown>;
  cta_policy: Record<string, unknown>;
  release_notes: string | null;
  is_active: boolean;
  created_at: string;
  activated_at: string | null;
}

export interface KnowledgeAssignment {
  id: string;
  worker_id: string;
  knowledge_source_type: string;
  knowledge_doc_id: string | null;
  knowledge_pill_id: string | null;
  product_slug: string | null;
  priority_weight: number;
  usage_mode: KnowledgeUsageMode;
  section_keys: string[];
  language_policy: string;
  fallback_policy: string;
  hard_required: boolean;
  max_context_chars: number | null;
  metadata: Record<string, unknown>;
  assigned_at: string;
}

export interface KnowledgePillSectionInput {
  section_key: string;
  title?: string;
  content: string;
  sort_order?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgePillSection extends KnowledgePillSectionInput {
  id: string;
  pill_version_id: string;
  created_at: string;
}

export interface KnowledgePillVersion {
  id: string;
  pill_id: string;
  version: number;
  status: string;
  summary: string | null;
  sections_json: Record<string, unknown>;
  authored_by: string | null;
  change_notes: string | null;
  created_at: string;
  sections: KnowledgePillSection[];
}

export interface KnowledgePill {
  id: string;
  slug: string;
  product_slug: string | null;
  title: string;
  summary: string | null;
  language: string;
  status: string;
  source_type: string;
  metadata: Record<string, unknown>;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  current_version: KnowledgePillVersion | null;
}

export interface WorkerEvaluation {
  id: string;
  worker_id: string;
  name: string;
  status: WorkerEvalStatus;
  dataset_json: unknown[];
  results_json: Record<string, unknown>;
  score: number | null;
  created_by: string | null;
  created_at: string;
  run_at: string | null;
}

export interface WorkerRelease {
  id: string;
  worker_id: string;
  profile_id: string | null;
  evaluation_id: string | null;
  release_type: string;
  status: WorkerReleaseStatus;
  notes: string | null;
  payload_json: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  activated_at: string | null;
}

export interface WorkerReleaseReadiness {
  workerId: string;
  activeProfileId: string | null;
  activeProfileVersion: number | null;
  latestPassedEvaluationId: string | null;
  latestPassedEvaluationName: string | null;
  latestPassedEvaluationScore: number | null;
  passedEvaluationCount: number;
  releaseable: boolean;
  blockers: string[];
}

type Row = Record<string, unknown>;

const DEFAULT_PRODUCT_PILLS: Array<{
  slug: string;
  product_slug: string;
  title: string;
  summary: string;
  sections: KnowledgePillSectionInput[];
}> = [
  {
    slug: 'consultify-core',
    product_slug: 'consultify',
    title: 'Consultify',
    summary: 'AI platform for structured digital transformation and execution.',
    sections: [
      {
        section_key: 'overview',
        title: 'Overview',
        content:
          'Consultify is the primary public product. It helps diagnose transformation opportunities, define roadmaps, coordinate initiatives, support execution, and report business impact.',
        sort_order: 1,
      },
      {
        section_key: 'value',
        title: 'Business Value',
        content:
          'Consultify focuses on measurable business outcomes: alignment, speed, transparency, ROI logic, and better governance of transformation programs.',
        sort_order: 2,
      },
      {
        section_key: 'sales_motion',
        title: 'Demo and Adoption',
        content:
          'Public conversations should emphasize fast understanding, guided demos, safe onboarding, and how Consultify becomes the operating layer for transformation work.',
        sort_order: 3,
      },
      {
        section_key: 'buyer_fit',
        title: 'Buyer Fit',
        content:
          'Consultify is a strong fit for transformation leaders, PMO owners, operations leaders and management teams that need one governed environment for diagnosis, roadmap, initiatives, execution visibility and value tracking instead of disconnected slide decks, spreadsheets and generic AI chat.',
        sort_order: 4,
      },
    ],
  },
  {
    slug: 'vector-core',
    product_slug: 'vector',
    title: 'DBR77 Vector',
    summary: 'Industrial reasoning and proprietary LLM layer.',
    sections: [
      {
        section_key: 'overview',
        title: 'Overview',
        content:
          'DBR77 Vector is the intelligence layer in the ecosystem. It supports industrial reasoning, enterprise deployments, and domain-specific assistance around operations and transformation.',
        sort_order: 1,
      },
      {
        section_key: 'positioning',
        title: 'Positioning',
        content:
          'In public answers, Vector should usually be positioned as the intelligence layer that can strengthen Consultify and other DBR77 products.',
        sort_order: 2,
      },
      {
        section_key: 'enterprise_fit',
        title: 'Enterprise Fit',
        content:
          'Vector should be described as a governed industrial AI layer for enterprise-grade reasoning, domain context, deployment flexibility and controlled use inside DBR77 workflows rather than as a generic public chatbot.',
        sort_order: 3,
      },
    ],
  },
  {
    slug: 'dbr77-ecosystem',
    product_slug: 'dbr77',
    title: 'DBR77 Ecosystem',
    summary: 'Connected ecosystem of products for industrial transformation.',
    sections: [
      {
        section_key: 'portfolio',
        title: 'Portfolio',
        content:
          'DBR77 includes Consultify, Vector, IRIS, Digital Twin, IIoT, Marketplace and other products that can work together as one transformation ecosystem.',
        sort_order: 1,
      },
      {
        section_key: 'operating_model',
        title: 'Operating Model',
        content:
          'The ecosystem should be explained as one connected system: Consultify coordinates transformation work, Vector adds reasoning, IIoT and Digital Twin provide operational signals and scenarios, IRIS surfaces intelligence, and Marketplace accelerates delivery through reusable modules and partner solutions.',
        sort_order: 2,
      },
    ],
  },
  {
    slug: 'iris-core',
    product_slug: 'iris',
    title: 'IRIS',
    summary: 'Operational intelligence for anomaly detection and predictive maintenance.',
    sections: [
      {
        section_key: 'overview',
        title: 'Overview',
        content:
          'IRIS is the intelligence engine for operational insights, anomaly detection, predictive maintenance and risk scoring across industrial operations.',
        sort_order: 1,
      },
      {
        section_key: 'use_cases',
        title: 'Use Cases',
        content:
          'IRIS is relevant when the client wants earlier detection of operational risk, clearer anomaly visibility, predictive maintenance signals and better interpretation of industrial data in day-to-day operations.',
        sort_order: 2,
      },
    ],
  },
  {
    slug: 'digital-twin-core',
    product_slug: 'digital-twin',
    title: 'Digital Twin',
    summary: 'Simulation and optimization layer for physical processes.',
    sections: [
      {
        section_key: 'overview',
        title: 'Overview',
        content:
          'Digital Twin creates virtual replicas of real processes to simulate scenarios, optimize performance and reduce risk before physical change is made.',
        sort_order: 1,
      },
      {
        section_key: 'use_cases',
        title: 'Use Cases',
        content:
          'Digital Twin is useful for scenario testing, capacity planning, flow optimization, layout decisions, what-if analysis and reducing implementation risk before a physical change hits production or logistics.',
        sort_order: 2,
      },
    ],
  },
  {
    slug: 'iiot-core',
    product_slug: 'iiot',
    title: 'IIoT',
    summary: 'Industrial data collection and connectivity layer.',
    sections: [
      {
        section_key: 'overview',
        title: 'Overview',
        content:
          'IIoT collects real-time sensor and machine data from production environments and feeds the rest of the DBR77 stack with current operational signals.',
        sort_order: 1,
      },
      {
        section_key: 'use_cases',
        title: 'Use Cases',
        content:
          'IIoT matters when the client needs trustworthy real-time data from machines, lines, utilities or logistics flows to support alerts, KPIs, anomaly detection, Digital Twin models or operational decision-making.',
        sort_order: 2,
      },
    ],
  },
  {
    slug: 'marketplace-core',
    product_slug: 'marketplace',
    title: 'Marketplace',
    summary: 'Catalog of reusable modules, partner solutions and integrations.',
    sections: [
      {
        section_key: 'overview',
        title: 'Overview',
        content:
          'Marketplace is the curated catalog of pre-built modules, integrations and partner solutions that can accelerate delivery around Consultify-led programs.',
        sort_order: 1,
      },
      {
        section_key: 'delivery_value',
        title: 'Delivery Value',
        content:
          'Marketplace should be positioned as a way to reduce delivery risk and time-to-value by reusing proven modules, partner capabilities and integration building blocks instead of starting every transformation stream from zero.',
        sort_order: 2,
      },
    ],
  },
];

function db() {
  return getDatabase();
}

function ensure(condition: unknown, message: string, code?: string): asserts condition {
  if (!condition) {
    throw new VirtualWorkerValidationError(message, code);
  }
}

function parseJsonb<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function rowToWorker(row: Row): VirtualWorker {
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

function rowToProfile(row: Row): VirtualWorkerProfile {
  return {
    id: String(row.id || ''),
    worker_id: String(row.worker_id || ''),
    version: Number(row.version || 1),
    persona_description: row.persona_description ? String(row.persona_description) : null,
    tone_description: row.tone_description ? String(row.tone_description) : null,
    system_prompt: String(row.system_prompt || ''),
    priority_rules: parseJsonb<Record<string, unknown> | null>(row.priority_rules, null),
    boundaries: parseJsonb<Record<string, unknown> | null>(row.boundaries, null),
    memory_policy: parseJsonb<Record<string, unknown>>(row.memory_policy, {}),
    channel_policy: parseJsonb<Record<string, unknown>>(row.channel_policy, {}),
    retrieval_policy: parseJsonb<Record<string, unknown>>(row.retrieval_policy, {}),
    cta_policy: parseJsonb<Record<string, unknown>>(row.cta_policy, {}),
    release_notes: row.release_notes ? String(row.release_notes) : null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at || ''),
    activated_at: row.activated_at ? String(row.activated_at) : null,
  };
}

function rowToAssignment(row: Row): KnowledgeAssignment {
  return {
    id: String(row.id || ''),
    worker_id: String(row.worker_id || ''),
    knowledge_source_type: String(row.knowledge_source_type || 'product_pill'),
    knowledge_doc_id: row.knowledge_doc_id ? String(row.knowledge_doc_id) : null,
    knowledge_pill_id: row.knowledge_pill_id ? String(row.knowledge_pill_id) : null,
    product_slug: row.product_slug ? String(row.product_slug) : null,
    priority_weight: Number(row.priority_weight ?? 1.0),
    usage_mode: String(row.usage_mode || 'full_pill') as KnowledgeUsageMode,
    section_keys: parseJsonb<string[]>(row.section_keys, []),
    language_policy: String(row.language_policy || 'prefer_same_language'),
    fallback_policy: String(row.fallback_policy || 'allow_fallback'),
    hard_required: Boolean(row.hard_required),
    max_context_chars:
      row.max_context_chars == null ? null : Math.max(0, Number(row.max_context_chars)),
    metadata: parseJsonb<Record<string, unknown>>(row.metadata, {}),
    assigned_at: String(row.assigned_at || ''),
  };
}

function rowToSection(row: Row): KnowledgePillSection {
  return {
    id: String(row.id || ''),
    pill_version_id: String(row.pill_version_id || ''),
    section_key: String(row.section_key || ''),
    title: row.title ? String(row.title) : undefined,
    content: String(row.content || ''),
    sort_order: Number(row.sort_order || 0),
    metadata: parseJsonb<Record<string, unknown> | undefined>(row.metadata, undefined),
    created_at: String(row.created_at || ''),
  };
}

function rowToVersion(row: Row, sections: KnowledgePillSection[]): KnowledgePillVersion {
  return {
    id: String(row.id || ''),
    pill_id: String(row.pill_id || ''),
    version: Number(row.version || 1),
    status: String(row.status || 'draft'),
    summary: row.summary ? String(row.summary) : null,
    sections_json: parseJsonb<Record<string, unknown>>(row.sections_json, {}),
    authored_by: row.authored_by ? String(row.authored_by) : null,
    change_notes: row.change_notes ? String(row.change_notes) : null,
    created_at: String(row.created_at || ''),
    sections,
  };
}

function rowToPill(row: Row, version: KnowledgePillVersion | null): KnowledgePill {
  return {
    id: String(row.id || ''),
    slug: String(row.slug || ''),
    product_slug: row.product_slug ? String(row.product_slug) : null,
    title: String(row.title || ''),
    summary: row.summary ? String(row.summary) : null,
    language: String(row.language || 'en'),
    status: String(row.status || 'draft'),
    source_type: String(row.source_type || 'virtual_worker'),
    metadata: parseJsonb<Record<string, unknown>>(row.metadata, {}),
    current_version_id: row.current_version_id ? String(row.current_version_id) : null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
    current_version: version,
  };
}

function rowToEvaluation(row: Row): WorkerEvaluation {
  return {
    id: String(row.id || ''),
    worker_id: String(row.worker_id || ''),
    name: String(row.name || ''),
    status: String(row.status || 'draft') as WorkerEvalStatus,
    dataset_json: parseJsonb<unknown[]>(row.dataset_json, []),
    results_json: parseJsonb<Record<string, unknown>>(row.results_json, {}),
    score: row.score == null ? null : Number(row.score),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at || ''),
    run_at: row.run_at ? String(row.run_at) : null,
  };
}

function rowToRelease(row: Row): WorkerRelease {
  return {
    id: String(row.id || ''),
    worker_id: String(row.worker_id || ''),
    profile_id: row.profile_id ? String(row.profile_id) : null,
    evaluation_id: row.evaluation_id ? String(row.evaluation_id) : null,
    release_type: String(row.release_type || 'profile'),
    status: String(row.status || 'draft') as WorkerReleaseStatus,
    notes: row.notes ? String(row.notes) : null,
    payload_json: parseJsonb<Record<string, unknown>>(row.payload_json, {}),
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at || ''),
    activated_at: row.activated_at ? String(row.activated_at) : null,
  };
}

async function getPillVersion(versionId: string | null): Promise<KnowledgePillVersion | null> {
  if (!versionId) return null;
  const versionResult = await db().query<Row>(
    'SELECT * FROM knowledge_pill_versions WHERE id = $1 LIMIT 1',
    [versionId]
  );
  const versionRow = versionResult.rows[0];
  if (!versionRow) return null;
  const sectionsResult = await db().query<Row>(
    'SELECT * FROM knowledge_pill_sections WHERE pill_version_id = $1 ORDER BY sort_order ASC, created_at ASC',
    [versionId]
  );
  return rowToVersion(versionRow, (sectionsResult.rows || []).map(rowToSection));
}

async function getProfileById(profileId: string): Promise<VirtualWorkerProfile | null> {
  const result = await db().query<Row>(
    'SELECT * FROM virtual_worker_profiles WHERE id = $1 LIMIT 1',
    [profileId]
  );
  return result.rows[0] ? rowToProfile(result.rows[0]) : null;
}

async function getWorkerEvaluationById(evaluationId: string): Promise<WorkerEvaluation | null> {
  const result = await db().query<Row>(
    'SELECT * FROM virtual_worker_evaluations WHERE id = $1 LIMIT 1',
    [evaluationId]
  );
  return result.rows[0] ? rowToEvaluation(result.rows[0]) : null;
}

export async function listWorkers(): Promise<VirtualWorker[]> {
  const result = await db().query<Row>('SELECT * FROM virtual_workers ORDER BY created_at ASC');
  return (result.rows || []).map(rowToWorker);
}

export async function getWorkerById(id: string): Promise<VirtualWorker | null> {
  const result = await db().query<Row>('SELECT * FROM virtual_workers WHERE id = $1', [id]);
  return result.rows[0] ? rowToWorker(result.rows[0]) : null;
}

export async function getWorkerBySlug(slug: string): Promise<VirtualWorker | null> {
  const result = await db().query<Row>('SELECT * FROM virtual_workers WHERE slug = $1', [slug]);
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
    `INSERT INTO virtual_workers
     (id, slug, name, role, status, surface, voice_enabled, voice_name, locale_default, avatar_url, description)
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
    sets.push(`${key} = $${idx}`);
    params.push(key === 'voice_enabled' ? (value ? 1 : 0) : value);
    idx += 1;
  }

  if (sets.length === 0) return getWorkerById(id);

  sets.push('updated_at = NOW()');
  params.push(id);
  await db().query(`UPDATE virtual_workers SET ${sets.join(', ')} WHERE id = $${idx}`, params);
  return getWorkerById(id);
}

export async function deleteWorker(id: string): Promise<boolean> {
  const result = await db().query('DELETE FROM virtual_workers WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getActiveProfile(workerId: string): Promise<VirtualWorkerProfile | null> {
  const result = await db().query<Row>(
    'SELECT * FROM virtual_worker_profiles WHERE worker_id = $1 AND is_active = 1 ORDER BY version DESC LIMIT 1',
    [workerId]
  );
  return result.rows[0] ? rowToProfile(result.rows[0]) : null;
}

export async function listProfiles(workerId: string): Promise<VirtualWorkerProfile[]> {
  const result = await db().query<Row>(
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
  memory_policy?: Record<string, unknown>;
  channel_policy?: Record<string, unknown>;
  retrieval_policy?: Record<string, unknown>;
  cta_policy?: Record<string, unknown>;
  release_notes?: string | null;
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
    await db().query('UPDATE virtual_worker_profiles SET is_active = 0 WHERE worker_id = $1', [
      data.worker_id,
    ]);
  }

  await db().query(
    `INSERT INTO virtual_worker_profiles
     (id, worker_id, version, persona_description, tone_description, system_prompt, priority_rules, boundaries,
      memory_policy, channel_policy, retrieval_policy, cta_policy, release_notes, is_active, activated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      data.worker_id,
      nextVersion,
      data.persona_description || null,
      data.tone_description || null,
      data.system_prompt,
      data.priority_rules ? JSON.stringify(data.priority_rules) : null,
      data.boundaries ? JSON.stringify(data.boundaries) : null,
      JSON.stringify(data.memory_policy || {}),
      JSON.stringify(data.channel_policy || {}),
      JSON.stringify(data.retrieval_policy || {}),
      JSON.stringify(data.cta_policy || {}),
      data.release_notes || null,
      shouldActivate,
      shouldActivate ? new Date().toISOString() : null,
    ]
  );

  logger.info(
    `[VirtualWorkerService] Created profile v${nextVersion} for worker ${data.worker_id}`
  );
  return (await db()
    .query<Row>('SELECT * FROM virtual_worker_profiles WHERE id = $1', [id])
    .then((result) => rowToProfile(result.rows[0])))!;
}

export async function activateProfile(profileId: string): Promise<void> {
  const result = await db().query<Row>(
    'SELECT worker_id FROM virtual_worker_profiles WHERE id = $1',
    [profileId]
  );
  const workerId = result.rows[0]?.worker_id;
  if (!workerId) return;
  await db().query('UPDATE virtual_worker_profiles SET is_active = 0 WHERE worker_id = $1', [
    workerId,
  ]);
  await db().query(
    'UPDATE virtual_worker_profiles SET is_active = 1, activated_at = NOW() WHERE id = $1',
    [profileId]
  );
}

export async function listKnowledgeAssignments(workerId: string): Promise<KnowledgeAssignment[]> {
  const result = await db().query<Row>(
    `SELECT * FROM virtual_worker_knowledge_assignments
     WHERE worker_id = $1
     ORDER BY hard_required DESC, priority_weight DESC, assigned_at ASC`,
    [workerId]
  );
  return (result.rows || []).map(rowToAssignment);
}

export async function assignKnowledge(data: {
  worker_id: string;
  knowledge_source_type?: string;
  knowledge_doc_id?: string | null;
  knowledge_pill_id?: string | null;
  product_slug?: string | null;
  priority_weight?: number;
  usage_mode?: KnowledgeUsageMode;
  section_keys?: string[];
  language_policy?: string;
  fallback_policy?: string;
  hard_required?: boolean;
  max_context_chars?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<KnowledgeAssignment> {
  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_worker_knowledge_assignments
     (id, worker_id, knowledge_source_type, knowledge_doc_id, knowledge_pill_id, product_slug, priority_weight,
      usage_mode, section_keys, language_policy, fallback_policy, hard_required, max_context_chars, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      data.worker_id,
      data.knowledge_source_type || 'product_pill',
      data.knowledge_doc_id || null,
      data.knowledge_pill_id || null,
      data.product_slug || null,
      data.priority_weight ?? 1.0,
      data.usage_mode || 'full_pill',
      JSON.stringify(data.section_keys || []),
      data.language_policy || 'prefer_same_language',
      data.fallback_policy || 'allow_fallback',
      Boolean(data.hard_required),
      data.max_context_chars ?? null,
      JSON.stringify(data.metadata || {}),
    ]
  );
  const result = await db().query<Row>(
    'SELECT * FROM virtual_worker_knowledge_assignments WHERE id = $1',
    [id]
  );
  return rowToAssignment(result.rows[0]);
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
  const pills = await listKnowledgePills();
  const pillByProduct = new Map(pills.map((pill) => [pill.product_slug, pill]));

  for (const { slug, weight } of productSlugs) {
    const existing = await db().query<{ id: string }>(
      `SELECT id FROM virtual_worker_knowledge_assignments
       WHERE worker_id = $1 AND product_slug = $2 AND knowledge_source_type = 'product_pill'`,
      [workerId, slug]
    );
    const pill = pillByProduct.get(slug) || null;
    if (existing.rows.length > 0) {
      await db().query(
        `UPDATE virtual_worker_knowledge_assignments
         SET priority_weight = $1,
             knowledge_pill_id = COALESCE($2, knowledge_pill_id),
             usage_mode = 'full_pill'
         WHERE id = $3`,
        [weight, pill?.id || null, existing.rows[0].id]
      );
    } else {
      await assignKnowledge({
        worker_id: workerId,
        knowledge_source_type: 'product_pill',
        product_slug: slug,
        knowledge_pill_id: pill?.id || null,
        priority_weight: weight,
        usage_mode: 'full_pill',
      });
    }
    count += 1;
  }
  return count;
}

export async function listKnowledgePills(opts?: {
  workerId?: string;
  includeUnassigned?: boolean;
}): Promise<KnowledgePill[]> {
  const includeUnassigned = opts?.includeUnassigned !== false;
  let rows: Row[] = [];

  if (opts?.workerId && !includeUnassigned) {
    const result = await db().query<Row>(
      `SELECT DISTINCT kp.*
       FROM knowledge_pills kp
       JOIN virtual_worker_knowledge_assignments a ON a.knowledge_pill_id = kp.id
       WHERE a.worker_id = $1
       ORDER BY kp.title ASC`,
      [opts.workerId]
    );
    rows = result.rows || [];
  } else {
    const result = await db().query<Row>('SELECT * FROM knowledge_pills ORDER BY title ASC');
    rows = result.rows || [];
  }

  const versions = await Promise.all(
    rows.map((row) =>
      getPillVersion(row.current_version_id ? String(row.current_version_id) : null)
    )
  );
  return rows.map((row, index) => rowToPill(row, versions[index]));
}

export async function createKnowledgePill(data: {
  slug: string;
  product_slug?: string | null;
  title: string;
  summary?: string | null;
  language?: string;
  status?: string;
  source_type?: string;
  metadata?: Record<string, unknown>;
  authored_by?: string | null;
  change_notes?: string | null;
  sections?: KnowledgePillSectionInput[];
}): Promise<KnowledgePill> {
  const pillId = uuidv4();
  const versionId = uuidv4();
  const sections = data.sections || [];

  await db().query(
    `INSERT INTO knowledge_pills
     (id, slug, product_slug, title, summary, language, status, source_type, metadata, current_version_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      pillId,
      data.slug,
      data.product_slug || null,
      data.title,
      data.summary || null,
      data.language || 'en',
      data.status || 'active',
      data.source_type || 'virtual_worker',
      JSON.stringify(data.metadata || {}),
      versionId,
    ]
  );

  await db().query(
    `INSERT INTO knowledge_pill_versions
     (id, pill_id, version, status, summary, sections_json, authored_by, change_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      versionId,
      pillId,
      1,
      data.status || 'active',
      data.summary || null,
      JSON.stringify(
        sections.reduce<Record<string, unknown>>((acc, section) => {
          acc[section.section_key] = {
            title: section.title || null,
            content: section.content,
            sort_order: section.sort_order || 0,
            metadata: section.metadata || {},
          };
          return acc;
        }, {})
      ),
      data.authored_by || null,
      data.change_notes || null,
    ]
  );

  for (const [index, section] of sections.entries()) {
    await db().query(
      `INSERT INTO knowledge_pill_sections
       (id, pill_version_id, section_key, title, content, sort_order, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        versionId,
        section.section_key,
        section.title || null,
        section.content,
        section.sort_order ?? index,
        JSON.stringify(section.metadata || {}),
      ]
    );
  }

  const result = await db().query<Row>('SELECT * FROM knowledge_pills WHERE id = $1', [pillId]);
  return rowToPill(result.rows[0], await getPillVersion(versionId));
}

export async function updateKnowledgePill(
  pillId: string,
  data: {
    title?: string;
    summary?: string | null;
    language?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    authored_by?: string | null;
    change_notes?: string | null;
    sections?: KnowledgePillSectionInput[];
  }
): Promise<KnowledgePill | null> {
  const current = await db().query<Row>('SELECT * FROM knowledge_pills WHERE id = $1', [pillId]);
  const pillRow = current.rows[0];
  if (!pillRow) return null;

  const versionResult = await db().query<{ max_v: number }>(
    'SELECT COALESCE(MAX(version), 0) as max_v FROM knowledge_pill_versions WHERE pill_id = $1',
    [pillId]
  );
  const nextVersion = Number(versionResult.rows[0]?.max_v || 0) + 1;
  const newVersionId = uuidv4();
  const sections =
    data.sections ||
    (await getPillVersion(String(pillRow.current_version_id || '')))?.sections ||
    [];

  await db().query(
    `INSERT INTO knowledge_pill_versions
     (id, pill_id, version, status, summary, sections_json, authored_by, change_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      newVersionId,
      pillId,
      nextVersion,
      data.status || String(pillRow.status || 'active'),
      data.summary ?? (pillRow.summary ? String(pillRow.summary) : null),
      JSON.stringify(
        sections.reduce<Record<string, unknown>>((acc, section) => {
          acc[section.section_key] = {
            title: section.title || null,
            content: section.content,
            sort_order: section.sort_order || 0,
            metadata: section.metadata || {},
          };
          return acc;
        }, {})
      ),
      data.authored_by || null,
      data.change_notes || null,
    ]
  );

  for (const [index, section] of sections.entries()) {
    await db().query(
      `INSERT INTO knowledge_pill_sections
       (id, pill_version_id, section_key, title, content, sort_order, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        newVersionId,
        section.section_key,
        section.title || null,
        section.content,
        section.sort_order ?? index,
        JSON.stringify(section.metadata || {}),
      ]
    );
  }

  await db().query(
    `UPDATE knowledge_pills
     SET title = COALESCE($2, title),
         summary = COALESCE($3, summary),
         language = COALESCE($4, language),
         status = COALESCE($5, status),
         metadata = COALESCE($6, metadata),
         current_version_id = $7,
         updated_at = NOW()
     WHERE id = $1`,
    [
      pillId,
      data.title || null,
      data.summary ?? null,
      data.language || null,
      data.status || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      newVersionId,
    ]
  );

  const updated = await db().query<Row>('SELECT * FROM knowledge_pills WHERE id = $1', [pillId]);
  return rowToPill(updated.rows[0], await getPillVersion(newVersionId));
}

export async function bootstrapDefaultKnowledgePills(workerId?: string): Promise<KnowledgePill[]> {
  const existing = await listKnowledgePills();
  const bySlug = new Map(existing.map((pill) => [pill.slug, pill]));
  const createdOrExisting: KnowledgePill[] = [];

  for (const template of DEFAULT_PRODUCT_PILLS) {
    const current = bySlug.get(template.slug);
    if (current) {
      createdOrExisting.push(current);
      continue;
    }

    const created = await createKnowledgePill({
      slug: template.slug,
      product_slug: template.product_slug,
      title: template.title,
      summary: template.summary,
      status: 'active',
      sections: template.sections,
    });
    createdOrExisting.push(created);
  }

  if (workerId) {
    for (const pill of createdOrExisting) {
      const assignmentExists = await db().query<{ id: string }>(
        `SELECT id FROM virtual_worker_knowledge_assignments
         WHERE worker_id = $1 AND knowledge_pill_id = $2 LIMIT 1`,
        [workerId, pill.id]
      );
      if (assignmentExists.rows[0]) continue;
      await assignKnowledge({
        worker_id: workerId,
        knowledge_source_type: 'product_pill',
        knowledge_pill_id: pill.id,
        product_slug: pill.product_slug,
        usage_mode: 'full_pill',
        priority_weight: pill.product_slug === 'consultify' ? 1.2 : 1.0,
      });
    }
  }

  return createdOrExisting;
}

export async function listWorkerEvaluations(workerId: string): Promise<WorkerEvaluation[]> {
  const result = await db().query<Row>(
    'SELECT * FROM virtual_worker_evaluations WHERE worker_id = $1 ORDER BY created_at DESC',
    [workerId]
  );
  return (result.rows || []).map(rowToEvaluation);
}

export async function createWorkerEvaluation(data: {
  worker_id: string;
  name: string;
  dataset_json?: unknown[];
  results_json?: Record<string, unknown>;
  score?: number | null;
  status?: WorkerEvalStatus;
  created_by?: string | null;
}): Promise<WorkerEvaluation> {
  const normalizedStatus = (data.status || 'draft') as WorkerEvalStatus;
  const dataset = Array.isArray(data.dataset_json) ? data.dataset_json : [];
  const results = isNonEmptyRecord(data.results_json) ? data.results_json : {};
  const score =
    data.score == null ? null : Number.isFinite(Number(data.score)) ? Number(data.score) : null;

  ensure(
    String(data.name || '').trim().length > 0,
    'Evaluation name is required',
    'VW_EVAL_NAME_REQUIRED'
  );

  if (normalizedStatus === 'passed' || normalizedStatus === 'failed') {
    ensure(
      isNonEmptyArray(dataset),
      'Passed or failed evaluations require a non-empty dataset',
      'VW_EVAL_DATASET_REQUIRED'
    );
    ensure(
      isNonEmptyRecord(results),
      'Passed or failed evaluations require non-empty results',
      'VW_EVAL_RESULTS_REQUIRED'
    );
    ensure(
      score !== null,
      'Passed or failed evaluations require a numeric score',
      'VW_EVAL_SCORE_REQUIRED'
    );
  }

  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_worker_evaluations
     (id, worker_id, name, status, dataset_json, results_json, score, created_by, run_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      data.worker_id,
      data.name,
      normalizedStatus,
      JSON.stringify(dataset),
      JSON.stringify(results),
      score,
      data.created_by || null,
      normalizedStatus !== 'draft' ? new Date().toISOString() : null,
    ]
  );
  const result = await db().query<Row>('SELECT * FROM virtual_worker_evaluations WHERE id = $1', [
    id,
  ]);
  return rowToEvaluation(result.rows[0]);
}

export async function listWorkerReleases(workerId: string): Promise<WorkerRelease[]> {
  const result = await db().query<Row>(
    'SELECT * FROM virtual_worker_releases WHERE worker_id = $1 ORDER BY created_at DESC',
    [workerId]
  );
  return (result.rows || []).map(rowToRelease);
}

export async function getWorkerReleaseReadiness(workerId: string): Promise<WorkerReleaseReadiness> {
  const activeProfile = await getActiveProfile(workerId);
  const evaluations = await listWorkerEvaluations(workerId);
  const passedEvaluations = evaluations.filter(
    (evaluation) =>
      evaluation.status === 'passed' &&
      isNonEmptyArray(evaluation.dataset_json) &&
      isNonEmptyRecord(evaluation.results_json) &&
      evaluation.score != null
  );
  const latestPassed = passedEvaluations[0] || null;
  const blockers: string[] = [];

  if (!activeProfile) {
    blockers.push('No active worker profile');
  }
  if (!latestPassed) {
    blockers.push('No passed evaluation with dataset, results, and score');
  }

  return {
    workerId,
    activeProfileId: activeProfile?.id || null,
    activeProfileVersion: activeProfile?.version || null,
    latestPassedEvaluationId: latestPassed?.id || null,
    latestPassedEvaluationName: latestPassed?.name || null,
    latestPassedEvaluationScore: latestPassed?.score || null,
    passedEvaluationCount: passedEvaluations.length,
    releaseable: blockers.length === 0,
    blockers,
  };
}

export async function createWorkerRelease(data: {
  worker_id: string;
  profile_id?: string | null;
  evaluation_id?: string | null;
  release_type?: string;
  status?: WorkerReleaseStatus;
  notes?: string | null;
  payload_json?: Record<string, unknown>;
  created_by?: string | null;
}): Promise<WorkerRelease> {
  const normalizedStatus = (data.status || 'draft') as WorkerReleaseStatus;
  ensure(
    normalizedStatus !== 'active',
    'Create the release first, then activate it explicitly',
    'VW_RELEASE_ACTIVATE_EXPLICIT'
  );

  const worker = await getWorkerById(data.worker_id);
  ensure(worker, 'Worker not found', 'VW_WORKER_NOT_FOUND');

  const profile = data.profile_id ? await getProfileById(data.profile_id) : null;
  if (data.profile_id) {
    ensure(profile, 'Referenced profile was not found', 'VW_RELEASE_PROFILE_NOT_FOUND');
    ensure(
      profile?.worker_id === data.worker_id,
      'Referenced profile does not belong to this worker',
      'VW_RELEASE_PROFILE_MISMATCH'
    );
  }

  const evaluation = data.evaluation_id ? await getWorkerEvaluationById(data.evaluation_id) : null;
  if (data.evaluation_id) {
    ensure(evaluation, 'Referenced evaluation was not found', 'VW_RELEASE_EVAL_NOT_FOUND');
    ensure(
      evaluation?.worker_id === data.worker_id,
      'Referenced evaluation does not belong to this worker',
      'VW_RELEASE_EVAL_MISMATCH'
    );
  }

  if (normalizedStatus === 'ready') {
    ensure(profile, 'A ready release requires a profile', 'VW_RELEASE_PROFILE_REQUIRED');
    ensure(evaluation, 'A ready release requires a passed evaluation', 'VW_RELEASE_EVAL_REQUIRED');
    ensure(
      evaluation?.status === 'passed',
      'Only passed evaluations can back a ready release',
      'VW_RELEASE_EVAL_NOT_PASSED'
    );
    ensure(
      isNonEmptyArray(evaluation?.dataset_json),
      'Passed evaluation must include a non-empty dataset',
      'VW_RELEASE_EVAL_DATASET_REQUIRED'
    );
    ensure(
      isNonEmptyRecord(evaluation?.results_json),
      'Passed evaluation must include non-empty results',
      'VW_RELEASE_EVAL_RESULTS_REQUIRED'
    );
    ensure(
      evaluation?.score != null,
      'Passed evaluation must include a score',
      'VW_RELEASE_EVAL_SCORE_REQUIRED'
    );
  }

  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_worker_releases
     (id, worker_id, profile_id, evaluation_id, release_type, status, notes, payload_json, created_by, activated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      data.worker_id,
      data.profile_id || null,
      data.evaluation_id || null,
      data.release_type || 'profile',
      normalizedStatus,
      data.notes || null,
      JSON.stringify(data.payload_json || {}),
      data.created_by || null,
      null,
    ]
  );
  const result = await db().query<Row>('SELECT * FROM virtual_worker_releases WHERE id = $1', [id]);
  return rowToRelease(result.rows[0]);
}

export async function activateWorkerRelease(releaseId: string): Promise<WorkerRelease | null> {
  const releaseResult = await db().query<Row>(
    'SELECT * FROM virtual_worker_releases WHERE id = $1 LIMIT 1',
    [releaseId]
  );
  const release = releaseResult.rows[0];
  if (!release) return null;
  ensure(
    release.status === 'ready',
    'Only ready releases can be activated',
    'VW_RELEASE_NOT_READY'
  );
  ensure(
    release.profile_id,
    'Release must reference a profile before activation',
    'VW_RELEASE_PROFILE_REQUIRED'
  );
  ensure(
    release.evaluation_id,
    'Release must reference a passed evaluation before activation',
    'VW_RELEASE_EVAL_REQUIRED'
  );

  const profile = await getProfileById(String(release.profile_id));
  ensure(profile, 'Release profile was not found', 'VW_RELEASE_PROFILE_NOT_FOUND');
  ensure(
    profile.worker_id === String(release.worker_id),
    'Release profile does not belong to this worker',
    'VW_RELEASE_PROFILE_MISMATCH'
  );

  const evaluation = await getWorkerEvaluationById(String(release.evaluation_id));
  ensure(evaluation, 'Release evaluation was not found', 'VW_RELEASE_EVAL_NOT_FOUND');
  ensure(
    evaluation.worker_id === String(release.worker_id),
    'Release evaluation does not belong to this worker',
    'VW_RELEASE_EVAL_MISMATCH'
  );
  ensure(
    evaluation.status === 'passed',
    'Only passed evaluations can activate a release',
    'VW_RELEASE_EVAL_NOT_PASSED'
  );
  ensure(
    isNonEmptyArray(evaluation.dataset_json),
    'Passed evaluation must include a non-empty dataset',
    'VW_RELEASE_EVAL_DATASET_REQUIRED'
  );
  ensure(
    isNonEmptyRecord(evaluation.results_json),
    'Passed evaluation must include non-empty results',
    'VW_RELEASE_EVAL_RESULTS_REQUIRED'
  );
  ensure(
    evaluation.score != null,
    'Passed evaluation must include a score',
    'VW_RELEASE_EVAL_SCORE_REQUIRED'
  );

  await activateProfile(String(release.profile_id));
  await db().query(
    `UPDATE virtual_worker_releases
     SET status = CASE
           WHEN id = $1 THEN 'active'
           WHEN status = 'active' THEN 'rolled_back'
           ELSE status
         END,
         activated_at = CASE WHEN id = $1 THEN NOW() ELSE activated_at END
     WHERE worker_id = $2`,
    [releaseId, release.worker_id]
  );
  const updated = await db().query<Row>('SELECT * FROM virtual_worker_releases WHERE id = $1', [
    releaseId,
  ]);
  return updated.rows[0] ? rowToRelease(updated.rows[0]) : null;
}

export async function getWorkerWithProfile(
  slugOrId: string
): Promise<{ worker: VirtualWorker; profile: VirtualWorkerProfile | null } | null> {
  let worker = await getWorkerBySlug(slugOrId);
  if (!worker) worker = await getWorkerById(slugOrId);
  if (!worker) return null;
  const profile = await getActiveProfile(worker.id);
  return { worker, profile };
}
