import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';

export type AssessmentDefinitionStatus = 'draft' | 'published' | 'deprecated';

export interface AssessmentDefinitionRecord {
  id: string;
  methodologyId: string;
  version: string;
  title: string;
  status: AssessmentDefinitionStatus;
  isReadOnly: boolean;
  definition: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

type EnsurePublishedInput = {
  methodologyId: string;
  createdBy: string;
  organizationId?: string | null;
};

let schemaEnsured = false;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeMethodologyId(methodologyId: string): string {
  return (
    String(methodologyId || 'DRD')
      .trim()
      .toUpperCase() || 'DRD'
  );
}

function buildBuiltinDefinition(methodologyId: string): Record<string, unknown> {
  return {
    methodologyId,
    governance: {
      noSilentScoring: true,
      interpretationRequiresReview: true,
      outputsHandoff: 'bounded_with_promotion_trace',
      insightsHandoff: 'proposal_only',
    },
    builtIn: true,
  };
}

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  // ASM-002: schema ownership belongs exclusively to ordered migrations.
  // This read assertion intentionally fails closed when a deployment skipped
  // migrations and works for runtime roles without CREATE/ALTER privileges.
  await queryHelpers.queryOne(
    `SELECT id, methodology_id, version, status
       FROM assessment_definitions
      WHERE 1 = 0`
  );
  schemaEnsured = true;
}

function mapRow(row: any): AssessmentDefinitionRecord {
  return {
    id: String(row.id),
    methodologyId: String(row.methodology_id),
    version: String(row.version),
    title: String(row.title || `${row.methodology_id} definition`),
    status: String(row.status || 'draft') as AssessmentDefinitionStatus,
    isReadOnly: Boolean(row.is_read_only),
    definition: (() => {
      try {
        return JSON.parse(String(row.definition_json || '{}'));
      } catch {
        return {};
      }
    })(),
    createdBy: String(row.created_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

async function getPublishedDefinitionByMethodology(
  methodologyId: string
): Promise<AssessmentDefinitionRecord | null> {
  await ensureSchema();
  const row = await queryHelpers.queryOne(
    `SELECT *
       FROM assessment_definitions
      WHERE methodology_id = ? AND status = 'published'
      ORDER BY published_at DESC, created_at DESC
      LIMIT 1`,
    [normalizeMethodologyId(methodologyId)]
  );
  return row ? mapRow(row) : null;
}

export async function ensurePublishedDefinition(
  input: EnsurePublishedInput
): Promise<AssessmentDefinitionRecord> {
  const methodologyId = normalizeMethodologyId(input.methodologyId);
  const existing = await getPublishedDefinitionByMethodology(methodologyId);
  if (existing) return existing;

  await ensureSchema();
  const now = nowIso();
  const version = '1.0';
  const id = `asdef_${methodologyId.toLowerCase()}_${version.replace(/\./g, '_')}`;

  await queryHelpers.queryRun(
    `INSERT OR IGNORE INTO assessment_definitions
      (id, methodology_id, version, title, status, is_read_only, definition_json, created_by, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, 'published', 1, ?, ?, ?, ?, ?)`,
    [
      id,
      methodologyId,
      version,
      `${methodologyId} canonical definition`,
      JSON.stringify(buildBuiltinDefinition(methodologyId)),
      input.createdBy,
      now,
      now,
      now,
    ]
  );

  const published = await getPublishedDefinitionByMethodology(methodologyId);
  if (!published) {
    throw Object.assign(new Error('Failed to ensure published definition'), {
      code: 'P28_DEFINITION_BOOTSTRAP_FAILED',
      methodologyId,
    });
  }
  return published;
}

export async function listDefinitionVersions(
  methodologyId: string
): Promise<AssessmentDefinitionRecord[]> {
  await ensureSchema();
  const rows = await queryHelpers.queryAll(
    `SELECT *
       FROM assessment_definitions
      WHERE methodology_id = ?
      ORDER BY created_at DESC`,
    [normalizeMethodologyId(methodologyId)]
  );
  return rows.map(mapRow);
}

export async function getDefinitionById(
  definitionId: string
): Promise<AssessmentDefinitionRecord | null> {
  await ensureSchema();
  const row = await queryHelpers.queryOne(`SELECT * FROM assessment_definitions WHERE id = ?`, [
    definitionId,
  ]);
  return row ? mapRow(row) : null;
}

/**
 * ASM-001A: returns a definition ONLY if it is published — used by the
 * POST /api/v8/assessment create-path to validate a `definitionId`/
 * `definitionVersion` pair supplied by the Library tab before an assessment
 * is allowed to bind to it. Narrow/additive: unlike `listDefinitionVersions`,
 * this filters out draft/deprecated rows instead of leaving that check to callers.
 * Definitions are global (not org-scoped) by design — same as every other
 * method in this service.
 */
export async function getPublishedDefinition(
  methodologyId: string,
  version?: string
): Promise<AssessmentDefinitionRecord | null> {
  await ensureSchema();
  const normalizedMethodologyId = normalizeMethodologyId(methodologyId);
  const normalizedVersion =
    version === undefined || version === null ? undefined : String(version).trim();

  if (normalizedVersion) {
    const row = await queryHelpers.queryOne(
      `SELECT *
         FROM assessment_definitions
        WHERE methodology_id = ? AND version = ? AND status = 'published'
        LIMIT 1`,
      [normalizedMethodologyId, normalizedVersion]
    );
    return row ? mapRow(row) : null;
  }

  return getPublishedDefinitionByMethodology(normalizedMethodologyId);
}

export async function createDraftDefinitionVersion(input: {
  methodologyId: string;
  version: string;
  title?: string;
  definition?: Record<string, unknown>;
  createdBy: string;
}): Promise<AssessmentDefinitionRecord> {
  await ensureSchema();
  const methodologyId = normalizeMethodologyId(input.methodologyId);
  const version = String(input.version || '').trim();
  if (!version) {
    throw Object.assign(new Error('Definition version required'), {
      code: 'P28_DEFINITION_VERSION_REQUIRED',
    });
  }

  const existing = await queryHelpers.queryOne(
    `SELECT id FROM assessment_definitions WHERE methodology_id = ? AND version = ?`,
    [methodologyId, version]
  );
  if (existing) {
    throw Object.assign(new Error('Definition version already exists'), {
      code: 'P28_DEFINITION_VERSION_EXISTS',
      methodologyId,
      version,
    });
  }

  const now = nowIso();
  const id = `asdef_${uuidv4()}`;
  await queryHelpers.queryRun(
    `INSERT INTO assessment_definitions
      (id, methodology_id, version, title, status, is_read_only, definition_json, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?)`,
    [
      id,
      methodologyId,
      version,
      input.title?.trim() || `${methodologyId} definition ${version}`,
      JSON.stringify(input.definition || buildBuiltinDefinition(methodologyId)),
      input.createdBy,
      now,
      now,
    ]
  );

  const created = await getDefinitionById(id);
  if (!created) {
    throw Object.assign(new Error('Definition draft not found after create'), {
      code: 'P28_DEFINITION_CREATE_FAILED',
    });
  }
  return created;
}

export async function publishDefinitionVersion(input: {
  definitionId: string;
  publishedBy: string;
}): Promise<AssessmentDefinitionRecord> {
  await ensureSchema();
  const existing = await getDefinitionById(input.definitionId);
  if (!existing) {
    throw Object.assign(new Error('Definition not found'), { code: 'P28_DEFINITION_NOT_FOUND' });
  }

  if (existing.status === 'published' && existing.isReadOnly) {
    return existing;
  }

  const now = nowIso();
  await queryHelpers.queryRun(
    `UPDATE assessment_definitions
        SET status = 'published',
            is_read_only = 1,
            updated_at = ?,
            published_at = COALESCE(published_at, ?)
      WHERE id = ?`,
    [now, now, input.definitionId]
  );

  const published = await getDefinitionById(input.definitionId);
  if (!published) {
    throw Object.assign(new Error('Published definition not found'), {
      code: 'P28_DEFINITION_PUBLISH_FAILED',
    });
  }
  return published;
}

const AssessmentDefinitionService = {
  ensurePublishedDefinition,
  listDefinitionVersions,
  getDefinitionById,
  getPublishedDefinition,
  createDraftDefinitionVersion,
  publishDefinitionVersion,
};

export default AssessmentDefinitionService;
