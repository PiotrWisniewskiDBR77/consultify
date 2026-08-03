import crypto from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import {
  type ArtifactContentEnvelope,
  type CanonicalFormat,
  createArtifactContentEnvelope,
} from './artifacts/contentProjectionService.js';

export const WAVE5_ARTIFACT_TYPES = [
  'note',
  'decision',
  'task',
  'initiative',
  'report',
  'research_report',
  'slide_deck',
  'spreadsheet',
  'diagram',
  'survey_insight',
  'financial_model',
] as const;

export type Wave5ArtifactType = (typeof WAVE5_ARTIFACT_TYPES)[number];

export const WAVE5_ARTIFACT_LIFECYCLE = [
  'draft',
  'proposed',
  'under_review',
  'approved',
  'committed',
  'exported',
  'archived',
] as const;

export type Wave5ArtifactStatus = (typeof WAVE5_ARTIFACT_LIFECYCLE)[number];
export type Wave5MutationStatus = 'proposed' | 'approved' | 'rejected' | 'committed';

export interface CreateWave5ArtifactInput {
  organizationId: string;
  userId: string;
  artifactType: Wave5ArtifactType;
  title: string;
  content: string;
  canonicalFormat?: CanonicalFormat;
  contentMd?: string;
  contentJson?: unknown;
  contentSchemaVersion?: string;
  projectId?: string | null;
  conversationId?: string | null;
  researchSessionId?: string | null;
  aiRunId?: string | null;
  trustBundleId?: string | null;
  citations?: unknown[];
  sourceRefs?: unknown[];
  metadata?: Record<string, unknown>;
  externalArtifactId?: string | null;
}

export interface ProposeWave5MutationInput {
  organizationId: string;
  userId: string;
  artifactId: string;
  proposedContent: string;
  summary?: string | null;
  mutationType?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MirrorLegacyArtifactInput {
  organizationId: string;
  userId: string;
  legacyArtifactId: string;
  outputType: 'report' | 'presentation' | 'sheet';
  title: string;
  originRuntime?: string | null;
  originRecordId?: string | null;
  executionRunId?: string | null;
  contextSnapshotId?: string | null;
}

export interface GenerateWave5ArtifactInput {
  organizationId: string;
  userId: string;
  outputKind: 'executive_report' | 'board_deck' | 'kpi_table';
  prompt: string;
  title?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  researchSessionId?: string | null;
  aiRunId?: string | null;
  trustBundleId?: string | null;
  citations?: unknown[];
  sourceRefs?: unknown[];
}

let schemaReady: Promise<void> | null = null;

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

function normalizeArtifactType(value: string): Wave5ArtifactType {
  if ((WAVE5_ARTIFACT_TYPES as readonly string[]).includes(value)) {
    return value as Wave5ArtifactType;
  }
  throw new Error(`Unsupported artifact type: ${value}`);
}

function appendProvenanceFooter(content: string, provenance: Record<string, unknown>): string {
  const stamp = [
    '',
    '',
    '---',
    '<!-- Consultify Artifact Provenance',
    safeJsonStringify(provenance),
    '-->',
  ].join('\n');
  return content.includes('Consultify Artifact Provenance') ? content : `${content}${stamp}`;
}

function buildLineDiff(
  before: string,
  after: string
): Array<{
  line: number;
  type: 'unchanged' | 'added' | 'removed' | 'changed';
  before?: string;
  after?: string;
}> {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const max = Math.max(beforeLines.length, afterLines.length);
  const diff = [];
  for (let i = 0; i < max; i += 1) {
    const left = beforeLines[i];
    const right = afterLines[i];
    if (left === right) {
      diff.push({ line: i + 1, type: 'unchanged' as const, before: left, after: right });
    } else if (left === undefined) {
      diff.push({ line: i + 1, type: 'added' as const, after: right });
    } else if (right === undefined) {
      diff.push({ line: i + 1, type: 'removed' as const, before: left });
    } else {
      diff.push({ line: i + 1, type: 'changed' as const, before: left, after: right });
    }
  }
  return diff;
}

export function buildWave5LineDiffForPreview(
  before: string,
  after: string
): ReturnType<typeof buildLineDiff> {
  return buildLineDiff(before, after);
}

function detectTemplateFields(template: string): string[] {
  const fields = new Set<string>();
  const pattern = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    fields.add(match[1]);
  }
  return [...fields];
}

function fillTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, field) =>
    String(values[field] ?? '')
  );
}

function buildExportManifest(artifact: any): Record<string, unknown> {
  const artifactType = artifact.artifact_type || artifact.artifactType;
  const content = String(artifact.content || '');
  const checksum = crypto.createHash('sha256').update(content).digest('hex');
  const formatsByType: Record<string, string[]> = {
    spreadsheet: ['json', 'csv', 'xlsx_ready_json'],
    slide_deck: ['markdown', 'deck_outline_json', 'pptx_ready_json'],
    diagram: ['markdown', 'mermaid'],
  };
  return {
    artifactId: artifact.artifact_id || artifact.artifactId,
    artifactType,
    title: artifact.title,
    version: Number(artifact.current_version || artifact.version || 1),
    formats: formatsByType[artifactType] || ['markdown', 'pdf_print'],
    generatedAt: new Date().toISOString(),
    checksumSha256: checksum,
    byteLength: Buffer.byteLength(content, 'utf8'),
    provenance: safeJsonParse(artifact.provenance_json || artifact.provenance, {}),
    citations: safeJsonParse(artifact.citations_json || artifact.citations, []),
  };
}

function buildExecutiveReportContent(input: GenerateWave5ArtifactInput): string {
  return [
    `# ${input.title || 'Executive Report'}`,
    '',
    '## Executive Summary',
    input.prompt,
    '',
    '## Key Findings',
    '- Finding 1: clarify the strategic implication and supporting evidence.',
    '- Finding 2: identify operational impact, owner and risk.',
    '- Finding 3: define measurable business outcome.',
    '',
    '## Recommendations',
    '- Convert the highest-confidence finding into an initiative.',
    '- Assign owner, deadline and KPI acceptance criteria.',
    '- Review evidence freshness before executive distribution.',
    '',
    '## Assumptions And Risks',
    '- Assumptions must be validated before commit to client-facing use.',
    '- Risks with weak evidence should remain marked for review.',
  ].join('\n');
}

function buildBoardDeckContent(input: GenerateWave5ArtifactInput): string {
  const title = input.title || 'Board Deck';
  const slides = [
    ['Executive Context', 'Why this topic matters now', 'Decision needed from the board'],
    ['Current State', 'Baseline facts', 'Constraints and operating risks'],
    ['Options', 'Strategic option A', 'Strategic option B', 'Trade-offs'],
    ['Recommendation', 'Preferred path', 'Expected impact', 'Risk controls'],
    ['Next Steps', 'Owner', 'Timeline', 'KPI acceptance criteria'],
  ];
  return [
    `# ${title}`,
    '',
    '```json',
    JSON.stringify(
      {
        deckTitle: title,
        sourcePrompt: input.prompt,
        slides: slides.map(([slideTitle, ...bullets], index) => ({
          slideNumber: index + 1,
          title: slideTitle,
          bullets,
          speakerNotes: `Narrate ${slideTitle.toLowerCase()} using cited evidence and explicit assumptions.`,
        })),
      },
      null,
      2
    ),
    '```',
  ].join('\n');
}

function buildKpiTableContent(input: GenerateWave5ArtifactInput): string {
  const rows = [
    ['KPI', 'Baseline', 'Target', 'Owner', 'Cadence', 'Evidence'],
    ['Revenue impact', 'TBD', 'TBD', 'CFO', 'Monthly', 'Requires finance source'],
    ['Cycle time', 'TBD', 'TBD', 'COO', 'Weekly', 'Requires process source'],
    ['Adoption', 'TBD', 'TBD', 'Transformation Lead', 'Bi-weekly', 'Requires usage source'],
  ];
  return [
    `# ${input.title || 'KPI Table'}`,
    '',
    `Source prompt: ${input.prompt}`,
    '',
    rows.map((row) => row.join(',')).join('\n'),
  ].join('\n');
}

function artifactTypeForGeneratedKind(
  kind: GenerateWave5ArtifactInput['outputKind']
): Wave5ArtifactType {
  if (kind === 'board_deck') return 'slide_deck';
  if (kind === 'kpi_table') return 'spreadsheet';
  return 'report';
}

function contentForGeneratedKind(input: GenerateWave5ArtifactInput): string {
  if (input.outputKind === 'board_deck') return buildBoardDeckContent(input);
  if (input.outputKind === 'kpi_table') return buildKpiTableContent(input);
  return buildExecutiveReportContent(input);
}

function mapArtifact(row: any, versions: any[] = [], mutations: any[] = []): any {
  if (!row) return null;
  const provenance = safeJsonParse<Record<string, unknown>>(row.provenance_json, {});
  const quarantinedMirror = (provenance as any)?.metadata?.contentAuthority === 'origin_runtime';
  const contentEnvelope: ArtifactContentEnvelope = createArtifactContentEnvelope({
    artifactType: row.artifact_type,
    canonicalFormat: row.canonical_format || undefined,
    contentMd: quarantinedMirror ? '' : (row.content_md ?? row.content),
    contentJson: safeJsonParse(row.content_json_native, undefined),
    contentSchemaVersion: row.content_schema_version || undefined,
  });
  return {
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    artifactType: row.artifact_type,
    status: row.status,
    title: row.title,
    content: row.content,
    contentEnvelope,
    canonicalFormat: contentEnvelope.canonicalFormat,
    contentMd: contentEnvelope.contentMd,
    contentJson: contentEnvelope.contentJson,
    markdownProjectionStatus: quarantinedMirror
      ? 'missing'
      : contentEnvelope.markdownProjectionStatus,
    markdownProjectedAt: row.markdown_projected_at || contentEnvelope.markdownProjectedAt || null,
    projectionError: row.projection_error || contentEnvelope.projectionError || null,
    version: Number(row.current_version || 1),
    projectId: row.project_id || null,
    conversationId: row.conversation_id || null,
    researchSessionId: row.research_session_id || null,
    aiRunId: row.ai_run_id || null,
    trustBundleId: row.trust_bundle_id || null,
    citations: safeJsonParse(row.citations_json, []),
    sourceRefs: safeJsonParse(row.source_refs_json, []),
    provenance,
    exportManifest: buildExportManifest(row),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    committedAt: row.committed_at || null,
    versions,
    mutations,
  };
}

function mapMutation(row: any): any {
  if (!row) return null;
  return {
    mutationId: row.mutation_id,
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    status: row.status,
    mutationType: row.mutation_type,
    summary: row.summary,
    beforeContent: row.before_content,
    proposedContent: row.proposed_content,
    diff: safeJsonParse(row.diff_json, []),
    metadata: safeJsonParse(row.metadata_json, {}),
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by || null,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || null,
    committedAt: row.committed_at || null,
  };
}

export async function ensureWave5ArtifactRuntimeSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave5_artifacts (
        artifact_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        current_version INTEGER NOT NULL DEFAULT 1,
        project_id TEXT,
        conversation_id TEXT,
        research_session_id TEXT,
        ai_run_id TEXT,
        trust_bundle_id TEXT,
        citations_json TEXT NOT NULL DEFAULT '[]',
        source_refs_json TEXT NOT NULL DEFAULT '[]',
        provenance_json TEXT NOT NULL DEFAULT '{}',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        committed_at TEXT
      )
    `);
    const artifactContentColumns = [
      "ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS canonical_format TEXT DEFAULT 'markdown'",
      'ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS content_md TEXT',
      'ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS content_json_native TEXT',
      'ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS content_schema_version TEXT',
      "ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT DEFAULT 'synced'",
      'ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT',
      'ALTER TABLE wave5_artifacts ADD COLUMN IF NOT EXISTS projection_error TEXT',
    ];
    for (const statement of artifactContentColumns) {
      await dbRun(statement);
    }
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave5_artifact_versions (
        version_id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        content TEXT NOT NULL,
        mutation_id TEXT,
        provenance_json TEXT NOT NULL DEFAULT '{}',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const versionContentColumns = [
      "ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS canonical_format TEXT DEFAULT 'markdown'",
      'ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS content_md TEXT',
      'ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS content_json_native TEXT',
      'ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS content_schema_version TEXT',
      "ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT DEFAULT 'synced'",
      'ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT',
      'ALTER TABLE wave5_artifact_versions ADD COLUMN IF NOT EXISTS projection_error TEXT',
    ];
    for (const statement of versionContentColumns) {
      await dbRun(statement);
    }
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave5_mutation_proposals (
        mutation_id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        status TEXT NOT NULL,
        mutation_type TEXT NOT NULL,
        summary TEXT,
        before_content TEXT NOT NULL,
        proposed_content TEXT NOT NULL,
        diff_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by TEXT NOT NULL,
        reviewed_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TEXT,
        committed_at TEXT
      )
    `);
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave5_artifacts_org_status ON wave5_artifacts(organization_id, status)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave5_versions_artifact ON wave5_artifact_versions(artifact_id, version)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave5_mutations_artifact ON wave5_mutation_proposals(artifact_id, status)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export async function createWave5Artifact(input: CreateWave5ArtifactInput): Promise<any> {
  await ensureWave5ArtifactRuntimeSchema();
  const artifactType = normalizeArtifactType(input.artifactType);
  const artifactId = input.externalArtifactId || `artifact-${uuidv4()}`;
  const provenance = {
    createdBy: input.userId,
    createdAt: new Date().toISOString(),
    source: 'wave5_artifact_runtime',
    projectId: input.projectId || null,
    conversationId: input.conversationId || null,
    researchSessionId: input.researchSessionId || null,
    aiRunId: input.aiRunId || null,
    trustBundleId: input.trustBundleId || null,
    sourceRefs: input.sourceRefs || [],
    metadata: input.metadata || {},
  };
  const content = appendProvenanceFooter(input.content, provenance);
  const contentEnvelope = createArtifactContentEnvelope({
    artifactType,
    canonicalFormat: input.canonicalFormat,
    contentMd: input.contentMd ?? content,
    contentJson: input.contentJson,
    contentSchemaVersion: input.contentSchemaVersion,
  });
  await dbRun(
    `INSERT INTO wave5_artifacts (
      artifact_id, organization_id, artifact_type, status, title, content, current_version,
      canonical_format, content_md, content_json_native, content_schema_version,
      markdown_projection_status, markdown_projected_at, projection_error,
      project_id, conversation_id, research_session_id, ai_run_id, trust_bundle_id,
      citations_json, source_refs_json, provenance_json, created_by
    ) VALUES (?, ?, ?, 'draft', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      artifactId,
      input.organizationId,
      artifactType,
      input.title,
      content,
      contentEnvelope.canonicalFormat,
      contentEnvelope.contentMd,
      contentEnvelope.contentJson === undefined
        ? null
        : safeJsonStringify(contentEnvelope.contentJson),
      contentEnvelope.contentSchemaVersion || null,
      contentEnvelope.markdownProjectionStatus,
      contentEnvelope.markdownProjectedAt || null,
      contentEnvelope.projectionError || null,
      input.projectId || null,
      input.conversationId || null,
      input.researchSessionId || null,
      input.aiRunId || null,
      input.trustBundleId || null,
      safeJsonStringify(input.citations || []),
      safeJsonStringify(input.sourceRefs || []),
      safeJsonStringify(provenance),
      input.userId,
    ]
  );
  await dbRun(
    `INSERT INTO wave5_artifact_versions (
      version_id, artifact_id, organization_id, version, content, canonical_format, content_md,
      content_json_native, content_schema_version, markdown_projection_status, markdown_projected_at,
      projection_error, mutation_id, provenance_json, created_by
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      uuidv4(),
      artifactId,
      input.organizationId,
      content,
      contentEnvelope.canonicalFormat,
      contentEnvelope.contentMd,
      contentEnvelope.contentJson === undefined
        ? null
        : safeJsonStringify(contentEnvelope.contentJson),
      contentEnvelope.contentSchemaVersion || null,
      contentEnvelope.markdownProjectionStatus,
      contentEnvelope.markdownProjectedAt || null,
      contentEnvelope.projectionError || null,
      safeJsonStringify(provenance),
      input.userId,
    ]
  );
  return getWave5Artifact(artifactId, input.organizationId);
}

export async function listWave5Artifacts(params: {
  organizationId: string;
  status?: string | null;
  artifactType?: string | null;
  limit?: number;
}): Promise<any[]> {
  await ensureWave5ArtifactRuntimeSchema();
  const filters = ['organization_id = ?'];
  const values: unknown[] = [params.organizationId];
  if (params.status) {
    filters.push('status = ?');
    values.push(params.status);
  }
  if (params.artifactType) {
    filters.push('artifact_type = ?');
    values.push(params.artifactType);
  }
  values.push(Math.min(Math.max(params.limit || 50, 1), 200));
  const rows = await dbAll(
    `SELECT * FROM wave5_artifacts
     WHERE ${filters.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT ?`,
    values
  );
  return (rows || []).map((row: any) => mapArtifact(row));
}

export async function getWave5Artifact(
  artifactId: string,
  organizationId: string
): Promise<any | null> {
  await ensureWave5ArtifactRuntimeSchema();
  const row = await dbGet(
    `SELECT * FROM wave5_artifacts WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId]
  );
  if (!row) return null;
  const versions = await listWave5ArtifactVersions(artifactId, organizationId);
  const mutations = await listWave5Mutations(artifactId, organizationId);
  return mapArtifact(row, versions, mutations);
}

export async function listWave5ArtifactVersions(
  artifactId: string,
  organizationId: string
): Promise<any[]> {
  await ensureWave5ArtifactRuntimeSchema();
  const rows = await dbAll(
    `SELECT version_id, artifact_id, organization_id, version, content, canonical_format,
            content_md, content_json_native, content_schema_version, markdown_projection_status,
            markdown_projected_at, projection_error, mutation_id, provenance_json, created_by, created_at
     FROM wave5_artifact_versions
     WHERE artifact_id = ? AND organization_id = ?
     ORDER BY version ASC`,
    [artifactId, organizationId]
  );
  return (rows || []).map((row: any) => {
    const contentEnvelope = createArtifactContentEnvelope({
      artifactType: 'version',
      canonicalFormat: row.canonical_format || undefined,
      contentMd: row.content_md || row.content,
      contentJson: safeJsonParse(row.content_json_native, undefined),
      contentSchemaVersion: row.content_schema_version || undefined,
    });
    return {
      versionId: row.version_id,
      artifactId: row.artifact_id,
      organizationId: row.organization_id,
      version: Number(row.version),
      content: row.content,
      contentEnvelope,
      canonicalFormat: contentEnvelope.canonicalFormat,
      contentMd: contentEnvelope.contentMd,
      contentJson: contentEnvelope.contentJson,
      markdownProjectionStatus:
        row.markdown_projection_status || contentEnvelope.markdownProjectionStatus,
      markdownProjectedAt: row.markdown_projected_at || contentEnvelope.markdownProjectedAt || null,
      projectionError: row.projection_error || contentEnvelope.projectionError || null,
      mutationId: row.mutation_id || null,
      provenance: safeJsonParse(row.provenance_json, {}),
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  });
}

export async function proposeWave5Mutation(input: ProposeWave5MutationInput): Promise<any> {
  await ensureWave5ArtifactRuntimeSchema();
  const artifact = await getWave5Artifact(input.artifactId, input.organizationId);
  if (!artifact) throw new Error('Artifact not found');
  const active = (artifact.mutations || []).find((mutation: any) =>
    ['proposed', 'approved'].includes(mutation.status)
  );
  if (active) {
    throw new Error(`Artifact already has active mutation proposal: ${active.mutationId}`);
  }
  const mutationId = `mutation-${uuidv4()}`;
  const diff = buildLineDiff(artifact.content, input.proposedContent);
  await dbRun(
    `INSERT INTO wave5_mutation_proposals (
      mutation_id, artifact_id, organization_id, status, mutation_type, summary,
      before_content, proposed_content, diff_json, metadata_json, created_by
    ) VALUES (?, ?, ?, 'proposed', ?, ?, ?, ?, ?, ?, ?)`,
    [
      mutationId,
      input.artifactId,
      input.organizationId,
      input.mutationType || 'content_update',
      input.summary || 'Proposed artifact content change',
      artifact.content,
      input.proposedContent,
      safeJsonStringify(diff),
      safeJsonStringify(input.metadata || {}),
      input.userId,
    ]
  );
  await dbRun(
    `UPDATE wave5_artifacts
     SET status = 'proposed', updated_at = CURRENT_TIMESTAMP
     WHERE artifact_id = ? AND organization_id = ?`,
    [input.artifactId, input.organizationId]
  );
  return getWave5Mutation(mutationId, input.organizationId);
}

export async function getWave5Mutation(
  mutationId: string,
  organizationId: string
): Promise<any | null> {
  await ensureWave5ArtifactRuntimeSchema();
  const row = await dbGet(
    `SELECT * FROM wave5_mutation_proposals WHERE mutation_id = ? AND organization_id = ?`,
    [mutationId, organizationId]
  );
  return mapMutation(row);
}

export async function listWave5Mutations(
  artifactId: string,
  organizationId: string
): Promise<any[]> {
  await ensureWave5ArtifactRuntimeSchema();
  const rows = await dbAll(
    `SELECT * FROM wave5_mutation_proposals
     WHERE artifact_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [artifactId, organizationId]
  );
  return (rows || []).map(mapMutation);
}

export async function rejectWave5Mutation(params: {
  mutationId: string;
  organizationId: string;
  userId: string;
}): Promise<any> {
  await ensureWave5ArtifactRuntimeSchema();
  const mutation = await getWave5Mutation(params.mutationId, params.organizationId);
  if (!mutation) throw new Error('Mutation proposal not found');
  await dbRun(
    `UPDATE wave5_mutation_proposals
     SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE mutation_id = ? AND organization_id = ?`,
    [params.userId, params.mutationId, params.organizationId]
  );
  await dbRun(
    `UPDATE wave5_artifacts
     SET status = 'draft', updated_at = CURRENT_TIMESTAMP
     WHERE artifact_id = ? AND organization_id = ?`,
    [mutation.artifactId, params.organizationId]
  );
  return getWave5Mutation(params.mutationId, params.organizationId);
}

export async function approveWave5Mutation(params: {
  mutationId: string;
  organizationId: string;
  userId: string;
}): Promise<any> {
  await ensureWave5ArtifactRuntimeSchema();
  const mutation = await getWave5Mutation(params.mutationId, params.organizationId);
  if (!mutation) throw new Error('Mutation proposal not found');
  if (mutation.status !== 'proposed')
    throw new Error(`Mutation is ${mutation.status}, not proposed`);
  await dbRun(
    `UPDATE wave5_mutation_proposals
     SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE mutation_id = ? AND organization_id = ?`,
    [params.userId, params.mutationId, params.organizationId]
  );
  await dbRun(
    `UPDATE wave5_artifacts
     SET status = 'approved', updated_at = CURRENT_TIMESTAMP
     WHERE artifact_id = ? AND organization_id = ?`,
    [mutation.artifactId, params.organizationId]
  );
  return getWave5Mutation(params.mutationId, params.organizationId);
}

export async function commitWave5Mutation(params: {
  mutationId: string;
  organizationId: string;
  userId: string;
}): Promise<any> {
  await ensureWave5ArtifactRuntimeSchema();
  const mutation = await getWave5Mutation(params.mutationId, params.organizationId);
  if (!mutation) throw new Error('Mutation proposal not found');
  if (mutation.status !== 'approved')
    throw new Error(`Mutation is ${mutation.status}, not approved`);
  const artifact = await getWave5Artifact(mutation.artifactId, params.organizationId);
  if (!artifact) throw new Error('Artifact not found');
  const nextVersion = Number(artifact.version || 1) + 1;
  const provenance = {
    ...(artifact.provenance || {}),
    committedBy: params.userId,
    committedAt: new Date().toISOString(),
    mutationId: params.mutationId,
    previousVersion: artifact.version,
    version: nextVersion,
  };
  const committedContent = appendProvenanceFooter(mutation.proposedContent, provenance);
  await dbRun(
    `UPDATE wave5_mutation_proposals
     SET status = 'committed', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
         committed_at = CURRENT_TIMESTAMP
     WHERE mutation_id = ? AND organization_id = ?`,
    [params.userId, params.mutationId, params.organizationId]
  );
  await dbRun(
    `UPDATE wave5_artifacts
     SET content = ?, current_version = ?, status = 'committed',
         provenance_json = ?, updated_at = CURRENT_TIMESTAMP, committed_at = CURRENT_TIMESTAMP
     WHERE artifact_id = ? AND organization_id = ?`,
    [
      committedContent,
      nextVersion,
      safeJsonStringify(provenance),
      mutation.artifactId,
      params.organizationId,
    ]
  );
  await dbRun(
    `INSERT INTO wave5_artifact_versions (
      version_id, artifact_id, organization_id, version, content, mutation_id, provenance_json, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      mutation.artifactId,
      params.organizationId,
      nextVersion,
      committedContent,
      params.mutationId,
      safeJsonStringify(provenance),
      params.userId,
    ]
  );
  return getWave5Artifact(mutation.artifactId, params.organizationId);
}

export async function approveAndCommitWave5Mutation(params: {
  mutationId: string;
  organizationId: string;
  userId: string;
}): Promise<any> {
  await approveWave5Mutation(params);
  return commitWave5Mutation(params);
}

export async function buildWave5ExportManifest(
  artifactId: string,
  organizationId: string
): Promise<Record<string, unknown>> {
  const artifact = await getWave5Artifact(artifactId, organizationId);
  if (!artifact) throw new Error('Artifact not found');
  return buildExportManifest(artifact);
}

export async function markWave5ArtifactExported(
  artifactId: string,
  organizationId: string
): Promise<any> {
  await ensureWave5ArtifactRuntimeSchema();
  const artifact = await getWave5Artifact(artifactId, organizationId);
  if (!artifact) throw new Error('Artifact not found');
  await dbRun(
    `UPDATE wave5_artifacts
     SET status = 'exported', updated_at = CURRENT_TIMESTAMP
     WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId]
  );
  return getWave5Artifact(artifactId, organizationId);
}

export async function fillWave5DocumentTemplate(params: {
  organizationId: string;
  userId: string;
  artifactId?: string | null;
  artifactType?: Wave5ArtifactType;
  title?: string;
  template: string;
  fields?: Record<string, unknown>;
  projectId?: string | null;
  conversationId?: string | null;
}): Promise<any> {
  await ensureWave5ArtifactRuntimeSchema();
  const fields = params.fields || {};
  const requiredFields = detectTemplateFields(params.template);
  const missingFields = requiredFields.filter(
    (field) => fields[field] == null || fields[field] === ''
  );
  if (missingFields.length > 0) {
    return {
      success: true,
      needsInput: true,
      missingFields,
      questions: missingFields.map((field) => ({
        field,
        question: `Provide value for "${field}" before Consultify fills this document.`,
      })),
    };
  }
  const filledContent = fillTemplate(params.template, fields);
  if (params.artifactId) {
    const mutation = await proposeWave5Mutation({
      organizationId: params.organizationId,
      userId: params.userId,
      artifactId: params.artifactId,
      proposedContent: filledContent,
      summary: 'Document filling proposal',
      mutationType: 'document_fill',
      metadata: { requiredFields, filledFields: Object.keys(fields) },
    });
    return { success: true, needsInput: false, mutation };
  }
  const artifact = await createWave5Artifact({
    organizationId: params.organizationId,
    userId: params.userId,
    artifactType: params.artifactType || 'report',
    title: params.title || 'Filled document',
    content: filledContent,
    projectId: params.projectId || null,
    conversationId: params.conversationId || null,
    metadata: { documentFill: { requiredFields, filledFields: Object.keys(fields) } },
  });
  return { success: true, needsInput: false, artifact };
}

export async function generateWave5StructuredArtifact(
  input: GenerateWave5ArtifactInput
): Promise<any> {
  await ensureWave5ArtifactRuntimeSchema();
  const artifactType = artifactTypeForGeneratedKind(input.outputKind);
  const content = contentForGeneratedKind(input);
  return createWave5Artifact({
    organizationId: input.organizationId,
    userId: input.userId,
    artifactType,
    title:
      input.title ||
      (input.outputKind === 'board_deck'
        ? 'Board deck'
        : input.outputKind === 'kpi_table'
          ? 'KPI table'
          : 'Executive report'),
    content,
    projectId: input.projectId || null,
    conversationId: input.conversationId || null,
    researchSessionId: input.researchSessionId || null,
    aiRunId: input.aiRunId || null,
    trustBundleId: input.trustBundleId || null,
    citations: input.citations || [],
    sourceRefs: input.sourceRefs || [],
    metadata: {
      generatedBy: 'wave5_structured_generator',
      outputKind: input.outputKind,
      prompt: input.prompt,
    },
  });
}

export async function mirrorLegacyArtifactIntoWave5(
  input: MirrorLegacyArtifactInput
): Promise<any> {
  const existing = await getWave5Artifact(input.legacyArtifactId, input.organizationId).catch(
    () => null
  );
  const authorityMetadata = {
    mirroredFrom: 'v8_output_artifacts',
    legacyArtifactId: input.legacyArtifactId,
    contentAuthority: 'origin_runtime',
    quarantineStatus: 'legacy_mirror',
    canonicalContent: false,
    originRuntime: input.originRuntime || null,
    originRecordId: input.originRecordId || null,
  };
  if (existing) {
    const isLegacyMirror =
      existing.provenance?.metadata?.mirroredFrom === 'v8_output_artifacts' ||
      existing.sourceRefs?.some?.((ref: any) => ref?.sourceClass === 'legacy_artifact') ||
      String(existing.content || '').includes('Legacy artifact mirrored into Wave 5 runtime.');
    if (!isLegacyMirror) return existing;
    const provenance = {
      ...(existing.provenance || {}),
      metadata: { ...(existing.provenance?.metadata || {}), ...authorityMetadata },
    };
    await dbRun(
      `UPDATE wave5_artifacts SET provenance_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE artifact_id = ? AND organization_id = ?`,
      [safeJsonStringify(provenance), input.legacyArtifactId, input.organizationId]
    );
    return getWave5Artifact(input.legacyArtifactId, input.organizationId);
  }
  const artifactType =
    input.outputType === 'presentation'
      ? 'slide_deck'
      : input.outputType === 'sheet'
        ? 'spreadsheet'
        : 'report';
  return createWave5Artifact({
    organizationId: input.organizationId,
    userId: input.userId,
    artifactType,
    title: input.title,
    content: '',
    canonicalFormat: 'markdown',
    contentMd: '',
    contentSchemaVersion: 'legacy-mirror-link/v1',
    aiRunId: input.executionRunId || null,
    sourceRefs: [
      {
        sourceClass: 'legacy_artifact',
        artifactId: input.legacyArtifactId,
        outputType: input.outputType,
        originRuntime: input.originRuntime || null,
        originRecordId: input.originRecordId || null,
        contextSnapshotId: input.contextSnapshotId || null,
      },
    ],
    metadata: authorityMetadata,
    externalArtifactId: input.legacyArtifactId,
  });
}
