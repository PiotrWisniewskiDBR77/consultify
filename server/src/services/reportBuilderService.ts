/**
 * Report Builder Service
 *
 * Handles report creation, section management, and AI content generation.
 * Generic service designed to work with multiple source types (Assessment, Interview, Tool).
 */

import { v4 as uuidv4 } from 'uuid';

import { DRD_STRUCTURE } from '../../src/services/drdStructure.js';
import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type ReportSourceType = 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE';
export type ReportStatus =
  | 'DRAFT'
  | 'CONFIGURING'
  | 'GENERATING'
  | 'GENERATED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'SENT_INTERNAL'
  | 'SENT_EXTERNAL'
  | 'UTILIZED';
export type SectionLength = 'short' | 'medium' | 'long';
export type SectionLanguage = 'technical' | 'business' | 'general';
export type SectionType =
  | 'cover'
  | 'summary'
  | 'methodology'
  | 'matrix'
  | 'axis_analysis'
  | 'list'
  | 'recommendations'
  | 'action_plan'
  | 'appendix'
  | 'custom';

export interface ReportRecord {
  id: string;
  organizationId: string;
  projectId?: string;
  templateId?: string;
  sourceType: ReportSourceType;
  sourceId: string;
  sourceName?: string;
  sourceFramework?: string;
  title: string;
  description?: string;
  reportType: string;
  config?: Record<string, unknown>;
  companyContext?: Record<string, unknown>;
  status: ReportStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  version: number;
}

export interface SectionRecord {
  id: string;
  reportId: string;
  sectionKey: string;
  sectionType: SectionType;
  title: string;
  orderIndex: number;
  enabled: boolean;
  required: boolean;
  length: SectionLength;
  language: SectionLanguage;
  customPrompt?: string;
  blockTypeId?: string;
  blockConfig?: Record<string, unknown>;
  renderKind?: string;
  generatedContent?: string;
  editedContent?: string;
  contentFormat: string;
  tiptapContent?: string;
  sourceDataSnapshot?: string;
  generatedAt?: string;
  tokensUsed?: number;
  editedAt?: string;
  editedBy?: string;
  repeatFor?: string;
  repeatKey?: string;
  repeatName?: string;
  repeatData?: string;
}

export interface CreateReportParams {
  organizationId: string;
  sourceType: ReportSourceType;
  sourceId: string;
  title: string;
  description?: string;
  /**
   * Report-level configuration snapshot captured before generation.
   * Used for "intent" (audience/goal/scope/etc) and invocation profile selection.
   */
  config?: Record<string, unknown>;
  createdBy: string;
  templateId?: string;
}

export interface UpdateSectionConfigParams {
  sectionKey: string;
  enabled?: boolean;
  orderIndex?: number;
  length?: SectionLength;
  language?: SectionLanguage;
  customPrompt?: string;
  title?: string;
}

export interface GenerateSectionParams {
  reportId: string;
  sectionKey: string;
  regenerate?: boolean;
}

export type BlockRenderKind = 'markdown' | 'callout' | 'table' | 'chart' | 'matrix' | 'json';

export interface BlockTypeRecord {
  id: string;
  organizationId?: string | null;
  name: string;
  description?: string | null;
  sourceTypes?: string[] | null;
  renderKind: BlockRenderKind;
  promptTemplate?: string | null;
  inputSchema?: Record<string, unknown> | null;
  defaultLength?: SectionLength;
  defaultLanguage?: SectionLanguage;
  isSystem?: boolean;
  isActive?: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ==========================================
// DATABASE HELPERS
// ==========================================

let db: IDatabase = getDatabase();

export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) db = newDeps.db;
}

function queryAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: T | null) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function queryRun(
  sql: string,
  params: unknown[] = []
): Promise<{ changes: number; lastID: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: { changes: number; lastID: number }, err: Error | null) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

// ==========================================
// ASSESSMENT SOURCE ADAPTER
// ==========================================

interface AssessmentSourceData {
  id: string;
  name: string;
  assessmentType: string;
  status: string;
  projectId?: string;
  organizationName: string;
  answers: Record<string, unknown>;
  scores: Record<string, unknown>;
  context: Record<string, unknown>;
  approvedAt: string;
  createdByName: string;
}

async function getAssessmentSourceData(sourceId: string): Promise<AssessmentSourceData | null> {
  const row = await queryOne<{
    id: string;
    name: string;
    assessment_type: string;
    status: string;
    organization_id: string;
    project_id?: string;
    answers_json: string;
    score_summary: string;
    context_snapshot: string;
    approved_at: string;
    created_by: string;
  }>(
    `
    SELECT a.*, o.name as org_name, u.first_name || ' ' || u.last_name as created_by_name
    FROM assessments a
    LEFT JOIN organizations o ON a.organization_id = o.id
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.id = ?
  `,
    [sourceId]
  );

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    assessmentType: row.assessment_type,
    status: row.status,
    projectId: (row as any).project_id,
    organizationName: (row as any).org_name || 'Unknown',
    answers: JSON.parse(row.answers_json || '{}'),
    scores: JSON.parse(row.score_summary || '{}'),
    context: JSON.parse(row.context_snapshot || '{}'),
    approvedAt: row.approved_at,
    createdByName: (row as any).created_by_name || 'Unknown',
  };
}

function extractAxisData(
  answers: Record<string, unknown>,
  axisId: string
): Record<string, unknown> {
  const drdAnswers = (answers as any)?.drd?.areas || {};
  const axisAreas: Record<string, unknown> = {};

  // Find areas for this axis (e.g., axis 1 has areas 1A, 1B, 1C...)
  for (const [areaId, areaData] of Object.entries(drdAnswers)) {
    if (areaId.startsWith(axisId)) {
      axisAreas[areaId] = areaData;
    }
  }

  return axisAreas;
}

// ==========================================
// CORE SERVICE FUNCTIONS
// ==========================================

/**
 * List available assessment sources (approved only)
 */
export async function listAssessmentSources(organizationId: string): Promise<
  Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    framework: string;
    approvedAt: string;
  }>
> {
  const rows = await queryAll<{
    id: string;
    name: string;
    assessment_type: string;
    status: string;
    approved_at: string;
  }>(
    `
    SELECT id, name, assessment_type, status, approved_at
    FROM assessments
    WHERE organization_id = ? AND status = 'APPROVED'
    ORDER BY approved_at DESC
    LIMIT 50
  `,
    [organizationId]
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: 'ASSESSMENT',
    status: r.status,
    framework: r.assessment_type,
    approvedAt: r.approved_at,
  }));
}

/**
 * Get template for source type
 */
export async function getTemplateForSource(
  sourceType: ReportSourceType,
  framework?: string,
  organizationId?: string
): Promise<{ id: string; sections: unknown[] } | null> {
  const reportType = framework ? `${sourceType}_${framework}` : sourceType;

  let row: { id: string; sections_json: string } | null = null;
  try {
    row = await queryOne<{ id: string; sections_json: string }>(
      `
      SELECT id, sections_json
      FROM report_builder_templates
      WHERE source_type = ?
        AND (report_type = ? OR report_type IS NULL)
        AND (organization_id IS NULL OR organization_id = ?)
      AND is_default = 1
      ORDER BY CASE WHEN report_type IS NULL THEN 1 ELSE 0 END, report_type DESC
      LIMIT 1
    `,
      [sourceType, reportType, organizationId || null]
    );
  } catch (err: any) {
    // Graceful degradation: in some local SQLite DBs this optional table may not exist yet.
    // Returning null lets the route respond 404 instead of crashing the whole UI with 500.
    const msg = String(err?.message || '').toLowerCase();
    const code = String(err?.code || '').toUpperCase();
    if (code === 'SQLITE_ERROR' && msg.includes('no such table: report_builder_templates')) {
      return null;
    }
    throw err;
  }

  if (!row) return null;

  return {
    id: row.id,
    sections: JSON.parse(row.sections_json || '[]'),
  };
}

/**
 * Create a new report from source
 */
export async function createReport(params: CreateReportParams): Promise<{
  report: ReportRecord;
  sections: SectionRecord[];
}> {
  const {
    organizationId,
    sourceType,
    sourceId,
    title,
    description,
    config,
    createdBy,
    templateId,
  } = params;

  // Get source data
  let sourceName = '';
  let sourceFramework = '';
  let projectId: string | null = null;
  let companyContext: Record<string, unknown> = {};

  if (sourceType === 'ASSESSMENT') {
    const assessment = await getAssessmentSourceData(sourceId);
    if (!assessment) throw new Error('Assessment not found');
    if (assessment.status !== 'APPROVED') throw new Error('Assessment is not approved');

    sourceName = assessment.name;
    sourceFramework = assessment.assessmentType;
    projectId = assessment.projectId ? String(assessment.projectId) : null;
    companyContext = {
      organizationName: assessment.organizationName,
      assessmentType: assessment.assessmentType,
      ...assessment.context,
    };
  }

  // Get template
  const derivedReportType = sourceFramework ? `${sourceType}_${sourceFramework}` : sourceType;

  let templateIdToUse: string | undefined;
  let templateSections: unknown[] = [];

  if (templateId) {
    const tpl = await getTemplateById(templateId, organizationId);
    if (!tpl) throw new Error('Template not found');

    // Validate compatibility
    const tplSourceType = String((tpl as any).source_type || '').toUpperCase();
    const tplReportType = (tpl as any).report_type ? String((tpl as any).report_type) : null;
    if (tplSourceType && tplSourceType !== sourceType) {
      throw new Error('Template source type mismatch');
    }
    if (tplReportType && tplReportType !== derivedReportType) {
      throw new Error('Template report type mismatch');
    }

    templateIdToUse = String((tpl as any).id);
    templateSections = (tpl as any).sections_json
      ? JSON.parse(String((tpl as any).sections_json || '[]'))
      : [];
  } else {
    const template = await getTemplateForSource(sourceType, sourceFramework, organizationId);
    if (!template) throw new Error('No template found for this source type');
    templateIdToUse = template.id;
    templateSections = template.sections || [];
  }

  const reportId = uuidv4();
  const reportType = derivedReportType;
  const now = new Date().toISOString();

  // Create report
  await queryRun(
    `
    INSERT INTO report_builder_reports (
      id, organization_id, project_id, source_type, source_id, source_name, source_framework,
      title, description, report_type, template_id, config_json, company_context_json, status,
      created_by, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIGURING', ?, ?, ?, 1)
  `,
    [
      reportId,
      organizationId,
      projectId,
      sourceType,
      sourceId,
      sourceName,
      sourceFramework,
      title,
      description,
      reportType,
      templateIdToUse || null,
      config ? JSON.stringify(config) : null,
      JSON.stringify(companyContext),
      createdBy,
      now,
      now,
    ]
  );

  // Create sections from template
  const typedTemplateSections = templateSections as Array<{
    key: string;
    type: SectionType;
    title: string;
    required: boolean;
    order: number;
    defaultLength?: SectionLength;
    defaultLanguage?: SectionLanguage;
    repeatFor?: string;
    repeatKey?: string;
  }>;

  const sections: SectionRecord[] = [];

  for (const tplSection of typedTemplateSections) {
    const sectionId = uuidv4();

    await queryRun(
      `
      INSERT INTO report_builder_sections (
        id, report_id, section_key, section_type, title, order_index,
        enabled, required, length, language, content_format,
        repeat_for, repeat_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'markdown', ?, ?, ?, ?)
    `,
      [
        sectionId,
        reportId,
        tplSection.key,
        tplSection.type,
        tplSection.title,
        tplSection.order,
        true,
        tplSection.required,
        tplSection.defaultLength || 'medium',
        tplSection.defaultLanguage || 'business',
        tplSection.repeatFor || null,
        tplSection.repeatKey || null,
        now,
        now,
      ]
    );

    sections.push({
      id: sectionId,
      reportId,
      sectionKey: tplSection.key,
      sectionType: tplSection.type,
      title: tplSection.title,
      orderIndex: tplSection.order,
      enabled: true,
      required: tplSection.required,
      length: (tplSection.defaultLength || 'medium') as SectionLength,
      language: (tplSection.defaultLanguage || 'business') as SectionLanguage,
      contentFormat: 'markdown',
      repeatFor: tplSection.repeatFor,
      repeatKey: tplSection.repeatKey,
    });
  }

  // Log activity
  await logActivity(reportId, 'CREATED', createdBy, { sourceType, sourceId });

  const report: ReportRecord = {
    id: reportId,
    organizationId,
    projectId: projectId || undefined,
    templateId: templateIdToUse,
    sourceType,
    sourceId,
    sourceName,
    sourceFramework,
    title,
    description,
    reportType,
    config: config || undefined,
    companyContext,
    status: 'CONFIGURING',
    createdBy,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  return { report, sections };
}

/**
 * Get report with sections
 */
export async function getReport(
  reportId: string,
  organizationId: string
): Promise<{
  report: ReportRecord;
  sections: SectionRecord[];
} | null> {
  const row = await queryOne<any>(
    `
    SELECT r.*, u.first_name || ' ' || u.last_name as created_by_name
    FROM report_builder_reports r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.id = ? AND r.organization_id = ?
  `,
    [reportId, organizationId]
  );

  if (!row) return null;

  const sections = await queryAll<any>(
    `
    SELECT * FROM report_builder_sections
    WHERE report_id = ?
    ORDER BY order_index ASC
  `,
    [reportId]
  );

  return {
    report: {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      templateId: row.template_id || undefined,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceName: row.source_name,
      sourceFramework: row.source_framework,
      title: row.title,
      description: row.description,
      reportType: row.report_type,
      config: row.config_json ? JSON.parse(row.config_json) : undefined,
      companyContext: row.company_context_json ? JSON.parse(row.company_context_json) : undefined,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      generatedAt: row.generated_at,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      version: row.version,
    },
    sections: sections.map((s) => ({
      id: s.id,
      reportId: s.report_id,
      sectionKey: s.section_key,
      sectionType: s.section_type,
      title: s.title,
      orderIndex: s.order_index,
      enabled: Boolean(s.enabled),
      required: Boolean(s.required),
      length: s.length,
      language: s.language,
      customPrompt: s.custom_prompt,
      blockTypeId: (s as any).block_type_id || undefined,
      blockConfig: (s as any).block_config_json
        ? JSON.parse((s as any).block_config_json)
        : undefined,
      renderKind: (s as any).render_kind || undefined,
      generatedContent: s.generated_content,
      editedContent: s.edited_content,
      contentFormat: s.content_format,
      tiptapContent: s.tiptap_content,
      sourceDataSnapshot: s.source_data_snapshot,
      generatedAt: s.generated_at,
      tokensUsed: s.tokens_used,
      editedAt: s.edited_at,
      editedBy: s.edited_by,
      repeatFor: s.repeat_for,
      repeatKey: s.repeat_key,
      repeatName: s.repeat_name,
      repeatData: s.repeat_data,
    })),
  };
}

/**
 * List reports for organization
 */
export async function listReports(
  organizationId: string,
  filters?: {
    status?: ReportStatus;
    statusIn?: ReportStatus[];
    sourceType?: ReportSourceType;
    sourceId?: string;
    search?: string;
  }
): Promise<ReportRecord[]> {
  let sql = `
    SELECT r.*, u.first_name || ' ' || u.last_name as created_by_name
    FROM report_builder_reports r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.organization_id = ?
  `;
  const params: unknown[] = [organizationId];

  if (filters?.status) {
    sql += ` AND r.status = ?`;
    params.push(filters.status);
  }
  if (filters?.statusIn && filters.statusIn.length > 0) {
    sql += ` AND r.status IN (${filters.statusIn.map(() => '?').join(', ')})`;
    params.push(...filters.statusIn);
  }
  if (filters?.sourceType) {
    sql += ` AND r.source_type = ?`;
    params.push(filters.sourceType);
  }
  if (filters?.sourceId) {
    sql += ` AND r.source_id = ?`;
    params.push(filters.sourceId);
  }
  if (filters?.search) {
    sql += ` AND r.title LIKE ?`;
    params.push(`%${filters.search}%`);
  }

  sql += ` ORDER BY r.created_at DESC LIMIT 100`;

  const rows = await queryAll<any>(sql, params);

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    templateId: row.template_id || undefined,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceFramework: row.source_framework,
    title: row.title,
    description: row.description,
    reportType: row.report_type,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    generatedAt: row.generated_at,
    approvedAt: row.approved_at,
    version: row.version,
  }));
}

// ==========================================
// BLOCK TYPES (Library)
// ==========================================

export async function listBlockTypes(organizationId: string): Promise<BlockTypeRecord[]> {
  const rows = await queryAll<any>(
    `
    SELECT *
    FROM report_builder_block_types
    WHERE is_active = 1 AND (organization_id IS NULL OR organization_id = ?)
    ORDER BY is_system DESC, name ASC
  `,
    [organizationId]
  );

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    description: r.description,
    sourceTypes: r.source_types_json ? JSON.parse(r.source_types_json) : null,
    renderKind: (r.render_kind || 'markdown') as BlockRenderKind,
    promptTemplate: r.prompt_template,
    inputSchema: r.input_schema_json ? JSON.parse(r.input_schema_json) : null,
    defaultLength: (r.default_length || 'medium') as SectionLength,
    defaultLanguage: (r.default_language || 'business') as SectionLanguage,
    isSystem: Boolean(r.is_system),
    isActive: Boolean(r.is_active),
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createBlockType(params: {
  organizationId: string;
  userId: string;
  name: string;
  description?: string;
  sourceTypes?: string[];
  renderKind: BlockRenderKind;
  promptTemplate?: string;
  inputSchema?: Record<string, unknown> | null;
  defaultLength?: SectionLength;
  defaultLanguage?: SectionLanguage;
}): Promise<BlockTypeRecord> {
  const id = uuidv4();
  const now = new Date().toISOString();
  await queryRun(
    `
    INSERT INTO report_builder_block_types (
      id, organization_id, name, description,
      source_types_json, render_kind, prompt_template, input_schema_json,
      default_length, default_language,
      is_system, is_active,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)
  `,
    [
      id,
      params.organizationId,
      params.name,
      params.description || null,
      params.sourceTypes ? JSON.stringify(params.sourceTypes) : null,
      params.renderKind,
      params.promptTemplate || null,
      params.inputSchema ? JSON.stringify(params.inputSchema) : null,
      params.defaultLength || 'medium',
      params.defaultLanguage || 'business',
      params.userId,
      now,
      now,
    ]
  );

  return {
    id,
    organizationId: params.organizationId,
    name: params.name,
    description: params.description || null,
    sourceTypes: params.sourceTypes || null,
    renderKind: params.renderKind,
    promptTemplate: params.promptTemplate || null,
    inputSchema: params.inputSchema || null,
    defaultLength: params.defaultLength || 'medium',
    defaultLanguage: params.defaultLanguage || 'business',
    isSystem: false,
    isActive: true,
    createdBy: params.userId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateBlockType(
  blockTypeId: string,
  organizationId: string,
  userId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    sourceTypes: string[] | null;
    renderKind: BlockRenderKind;
    promptTemplate: string | null;
    inputSchema: Record<string, unknown> | null;
    defaultLength: SectionLength;
    defaultLanguage: SectionLanguage;
    isActive: boolean;
  }>
): Promise<void> {
  const existing = await queryOne<any>(
    `SELECT * FROM report_builder_block_types WHERE id = ? AND organization_id = ?`,
    [blockTypeId, organizationId]
  );
  if (!existing) throw new Error('Block type not found');
  if (existing.is_system) throw new Error('System block types cannot be modified');

  const sets: string[] = ['updated_at = ?'];
  const params: unknown[] = [new Date().toISOString()];

  const push = (col: string, value: unknown) => {
    sets.push(`${col} = ?`);
    params.push(value);
  };

  if (patch.name !== undefined) push('name', patch.name);
  if (patch.description !== undefined) push('description', patch.description);
  if (patch.sourceTypes !== undefined)
    push('source_types_json', patch.sourceTypes ? JSON.stringify(patch.sourceTypes) : null);
  if (patch.renderKind !== undefined) push('render_kind', patch.renderKind);
  if (patch.promptTemplate !== undefined) push('prompt_template', patch.promptTemplate);
  if (patch.inputSchema !== undefined)
    push('input_schema_json', patch.inputSchema ? JSON.stringify(patch.inputSchema) : null);
  if (patch.defaultLength !== undefined) push('default_length', patch.defaultLength);
  if (patch.defaultLanguage !== undefined) push('default_language', patch.defaultLanguage);
  if (patch.isActive !== undefined) push('is_active', patch.isActive ? 1 : 0);

  params.push(blockTypeId, organizationId);

  await queryRun(
    `
    UPDATE report_builder_block_types
    SET ${sets.join(', ')}
    WHERE id = ? AND organization_id = ?
  `,
    params
  );
  void userId; // reserved for future auditing
}

export async function deactivateBlockType(
  blockTypeId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  const existing = await queryOne<any>(
    `SELECT * FROM report_builder_block_types WHERE id = ? AND organization_id = ?`,
    [blockTypeId, organizationId]
  );
  if (!existing) throw new Error('Block type not found');
  if (existing.is_system) throw new Error('System block types cannot be deactivated');

  await queryRun(
    `
    UPDATE report_builder_block_types
    SET is_active = 0, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `,
    [new Date().toISOString(), blockTypeId, organizationId]
  );
  void userId; // reserved for future auditing
}

/**
 * Update section configuration
 */
export async function updateSectionConfig(
  reportId: string,
  updates: UpdateSectionConfigParams[]
): Promise<SectionRecord[]> {
  const now = new Date().toISOString();

  for (const update of updates) {
    const setClauses: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (update.enabled !== undefined) {
      setClauses.push('enabled = ?');
      params.push(update.enabled ? 1 : 0);
    }
    if (update.orderIndex !== undefined) {
      setClauses.push('order_index = ?');
      params.push(update.orderIndex);
    }
    if (update.length !== undefined) {
      setClauses.push('length = ?');
      params.push(update.length);
    }
    if (update.language !== undefined) {
      setClauses.push('language = ?');
      params.push(update.language);
    }
    if (update.customPrompt !== undefined) {
      setClauses.push('custom_prompt = ?');
      params.push(update.customPrompt);
    }
    if (update.title !== undefined) {
      setClauses.push('title = ?');
      params.push(update.title);
    }

    params.push(reportId, update.sectionKey);

    await queryRun(
      `
      UPDATE report_builder_sections
      SET ${setClauses.join(', ')}
      WHERE report_id = ? AND section_key = ?
    `,
      params
    );
  }

  const sections = await queryAll<any>(
    `
    SELECT * FROM report_builder_sections
    WHERE report_id = ?
    ORDER BY order_index ASC
  `,
    [reportId]
  );

  return sections.map((s) => ({
    id: s.id,
    reportId: s.report_id,
    sectionKey: s.section_key,
    sectionType: s.section_type,
    title: s.title,
    orderIndex: s.order_index,
    enabled: Boolean(s.enabled),
    required: Boolean(s.required),
    length: s.length,
    language: s.language,
    customPrompt: s.custom_prompt,
    blockTypeId: (s as any).block_type_id || undefined,
    blockConfig: (s as any).block_config_json
      ? JSON.parse((s as any).block_config_json)
      : undefined,
    renderKind: (s as any).render_kind || undefined,
    generatedContent: s.generated_content,
    editedContent: s.edited_content,
    contentFormat: s.content_format,
    tiptapContent: s.tiptap_content,
    generatedAt: s.generated_at,
    tokensUsed: s.tokens_used,
    editedAt: s.edited_at,
    repeatFor: s.repeat_for,
    repeatKey: s.repeat_key,
    repeatName: s.repeat_name,
  }));
}

/**
 * Add custom section to report
 */
export async function addCustomSection(
  reportId: string,
  params: {
    title: string;
    sectionType?: SectionType;
    afterSectionKey?: string;
    length?: SectionLength;
    language?: SectionLanguage;
    blockTypeId?: string;
    blockConfig?: Record<string, unknown> | null;
    renderKind?: string;
  }
): Promise<SectionRecord> {
  const {
    title,
    sectionType = 'custom',
    afterSectionKey,
    length = 'medium',
    language = 'business',
    blockTypeId,
    blockConfig,
    renderKind,
  } = params;

  // Get current max order
  let orderIndex = 50;
  if (afterSectionKey) {
    const afterSection = await queryOne<{ order_index: number }>(
      `
      SELECT order_index FROM report_builder_sections
      WHERE report_id = ? AND section_key = ?
    `,
      [reportId, afterSectionKey]
    );
    if (afterSection) {
      orderIndex = afterSection.order_index + 1;
      // Shift other sections
      await queryRun(
        `
        UPDATE report_builder_sections
        SET order_index = order_index + 1
        WHERE report_id = ? AND order_index >= ?
      `,
        [reportId, orderIndex]
      );
    }
  } else {
    const maxOrder = await queryOne<{ max_order: number }>(
      `
      SELECT MAX(order_index) as max_order FROM report_builder_sections WHERE report_id = ?
    `,
      [reportId]
    );
    orderIndex = (maxOrder?.max_order || 0) + 1;
  }

  const sectionId = uuidv4();
  const sectionKey = `custom_${sectionId.slice(0, 8)}`;
  const now = new Date().toISOString();

  await queryRun(
    `
    INSERT INTO report_builder_sections (
      id, report_id, section_key, section_type, title, order_index,
      enabled, required, length, language, content_format,
      block_type_id, block_config_json, render_kind,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, 'markdown', ?, ?, ?, ?, ?)
  `,
    [
      sectionId,
      reportId,
      sectionKey,
      sectionType,
      title,
      orderIndex,
      length,
      language,
      blockTypeId || null,
      blockConfig ? JSON.stringify(blockConfig) : null,
      renderKind || null,
      now,
      now,
    ]
  );

  return {
    id: sectionId,
    reportId,
    sectionKey,
    sectionType,
    title,
    orderIndex,
    enabled: true,
    required: false,
    length,
    language,
    blockTypeId: blockTypeId || undefined,
    blockConfig: blockConfig || undefined,
    renderKind: renderKind || undefined,
    contentFormat: 'markdown',
  };
}

/**
 * Remove section from report
 */
export async function removeSection(reportId: string, sectionKey: string): Promise<boolean> {
  // Check if section is required
  const section = await queryOne<{ required: number }>(
    `
    SELECT required FROM report_builder_sections WHERE report_id = ? AND section_key = ?
  `,
    [reportId, sectionKey]
  );

  if (!section) return false;
  if (section.required) throw new Error('Cannot remove required section');

  await queryRun(
    `
    DELETE FROM report_builder_sections WHERE report_id = ? AND section_key = ?
  `,
    [reportId, sectionKey]
  );

  return true;
}

/**
 * Update section content (edited by user)
 */
export async function updateSectionContent(
  reportId: string,
  sectionKey: string,
  content: string,
  userId: string,
  contentFormat: 'markdown' | 'tiptap' = 'markdown'
): Promise<void> {
  const now = new Date().toISOString();

  if (contentFormat === 'tiptap') {
    await queryRun(
      `
      UPDATE report_builder_sections
      SET tiptap_content = ?, edited_content = ?, edited_at = ?, edited_by = ?, updated_at = ?
      WHERE report_id = ? AND section_key = ?
    `,
      [content, content, now, userId, now, reportId, sectionKey]
    );
  } else {
    await queryRun(
      `
      UPDATE report_builder_sections
      SET edited_content = ?, edited_at = ?, edited_by = ?, updated_at = ?
      WHERE report_id = ? AND section_key = ?
    `,
      [content, now, userId, now, reportId, sectionKey]
    );
  }
}

/**
 * Activity logging
 */
async function logActivity(
  reportId: string,
  actionType: string,
  actionBy: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await queryRun(
    `
    INSERT INTO report_builder_activity (id, report_id, action_type, action_by, action_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      uuidv4(),
      reportId,
      actionType,
      actionBy,
      new Date().toISOString(),
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

/**
 * Update report status
 */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();

  let additionalFields = '';
  const params: unknown[] = [status, now, userId, now];

  if (status === 'GENERATED') {
    additionalFields = ', generated_at = ?';
    params.push(now);
  } else if (status === 'IN_REVIEW') {
    additionalFields = ', submitted_at = ?';
    params.push(now);
  } else if (status === 'APPROVED') {
    additionalFields = ', approved_at = ?, approved_by = ?';
    params.push(now, userId);
  } else if (status === 'SENT_INTERNAL') {
    additionalFields = ', sent_internal_at = ?, sent_internal_by = ?';
    params.push(now, userId);
  } else if (status === 'SENT_EXTERNAL') {
    additionalFields = ', sent_external_at = ?, sent_external_by = ?';
    params.push(now, userId);
  } else if (status === 'UTILIZED') {
    additionalFields = ', utilized_at = ?';
    params.push(now);
  }

  params.push(reportId);

  await queryRun(
    `
    UPDATE report_builder_reports
    SET status = ?, updated_at = ?, updated_by = ?${additionalFields}
    WHERE id = ?
  `,
    params
  );

  await logActivity(reportId, `STATUS_${status}`, userId);
}

/**
 * Update report-level configuration (intent, invocation profile, etc.).
 * Does not change report status by itself (caller decides).
 */
export async function updateReportConfig(
  reportId: string,
  organizationId: string,
  config: Record<string, unknown> | null,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  await queryRun(
    `
    UPDATE report_builder_reports
    SET config_json = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND organization_id = ?
  `,
    [config ? JSON.stringify(config) : null, now, userId, reportId, organizationId]
  );
  await logActivity(reportId, 'CONFIG_UPDATED', userId);
}

/**
 * Duplicate report
 */
export async function duplicateReport(
  reportId: string,
  organizationId: string,
  userId: string,
  newTitle?: string
): Promise<{ report: ReportRecord; sections: SectionRecord[] }> {
  const original = await getReport(reportId, organizationId);
  if (!original) throw new Error('Report not found');

  const newReportId = uuidv4();
  const now = new Date().toISOString();

  await queryRun(
    `
    INSERT INTO report_builder_reports (
      id, organization_id, project_id, source_type, source_id, source_name, source_framework,
      title, description, report_type, template_id, config_json, company_context_json, status,
      created_by, created_at, updated_at, version, parent_report_id
    )
    SELECT 
      ?, organization_id, project_id, source_type, source_id, source_name, source_framework,
      ?, description, report_type, template_id, config_json, company_context_json, 'DRAFT',
      ?, ?, ?, 1, ?
    FROM report_builder_reports WHERE id = ?
  `,
    [
      newReportId,
      newTitle || `${original.report.title} (Copy)`,
      userId,
      now,
      now,
      reportId,
      reportId,
    ]
  );

  // Copy sections
  const sections: SectionRecord[] = [];
  for (const section of original.sections) {
    const newSectionId = uuidv4();

    await queryRun(
      `
      INSERT INTO report_builder_sections (
        id, report_id, section_key, section_type, title, order_index,
        enabled, required, length, language, custom_prompt,
        generated_content, edited_content, content_format, tiptap_content,
        source_data_snapshot, repeat_for, repeat_key, repeat_name, repeat_data,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        newSectionId,
        newReportId,
        section.sectionKey,
        section.sectionType,
        section.title,
        section.orderIndex,
        section.enabled ? 1 : 0,
        section.required ? 1 : 0,
        section.length,
        section.language,
        section.customPrompt,
        section.generatedContent,
        section.editedContent,
        section.contentFormat,
        section.tiptapContent,
        section.sourceDataSnapshot,
        section.repeatFor,
        section.repeatKey,
        section.repeatName,
        section.repeatData,
        now,
        now,
      ]
    );

    sections.push({
      ...section,
      id: newSectionId,
      reportId: newReportId,
    });
  }

  await logActivity(newReportId, 'DUPLICATED', userId, { originalReportId: reportId });

  return {
    report: {
      ...original.report,
      id: newReportId,
      title: newTitle || `${original.report.title} (Copy)`,
      status: 'DRAFT',
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      generatedAt: undefined,
      approvedAt: undefined,
      version: 1,
    },
    sections,
  };
}

/**
 * Get source data for report (assessment)
 */
export async function getSourceDataForReport(
  reportId: string,
  organizationId: string
): Promise<{
  assessment: AssessmentSourceData | null;
  axesData: Record<string, unknown>;
} | null> {
  const report = await getReport(reportId, organizationId);
  if (!report) return null;

  if (report.report.sourceType !== 'ASSESSMENT') {
    return { assessment: null, axesData: {} };
  }

  const assessment = await getAssessmentSourceData(report.report.sourceId);
  if (!assessment) return null;

  // Extract per-axis data
  const axesData: Record<string, unknown> = {};
  const drdAnswers = (assessment.answers as any)?.drd?.areas || {};

  // Group by axis
  for (let i = 1; i <= 7; i++) {
    const axisKey = String(i);
    const axisAreas: Record<string, unknown> = {};

    for (const [areaId, areaData] of Object.entries(drdAnswers)) {
      if (areaId.startsWith(axisKey)) {
        axisAreas[areaId] = areaData;
      }
    }

    if (Object.keys(axisAreas).length > 0) {
      axesData[axisKey] = axisAreas;
    }
  }

  return { assessment, axesData };
}

// ==========================================
// EXPORT & SHARE TYPES
// ==========================================

export interface ReportExportRecord {
  id: string;
  reportId: string;
  reportType: string;
  format: 'pdf' | 'pptx' | 'docx' | 'xlsx';
  filePath?: string;
  fileSize?: number;
  language: string;
  exportedBy: string;
  exportedAt: string;
  downloadCount: number;
  lastDownloadAt?: string;
}

export interface PublicLinkRecord {
  id: string;
  reportId: string;
  reportType: string;
  organizationId: string;
  linkToken: string;
  passwordHash?: string;
  expiresAt?: string;
  showCompanyLogo: boolean;
  showConsultinityBranding: boolean;
  customMessage?: string;
  viewCount: number;
  lastViewedAt?: string;
  createdBy: string;
  createdAt: string;
  revokedAt?: string;
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

/**
 * Create export record for a report
 */
export async function createExportRecord(params: {
  reportId: string;
  reportType: string;
  format: 'pdf' | 'pptx' | 'docx' | 'xlsx';
  filePath: string;
  fileSize: number;
  language?: string;
  exportedBy: string;
}): Promise<ReportExportRecord> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await queryRun(
    `
    INSERT INTO report_exports (
      id, report_id, report_type, format, file_path, file_size,
      language, exported_by, exported_at, download_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `,
    [
      id,
      params.reportId,
      params.reportType,
      params.format,
      params.filePath,
      params.fileSize,
      params.language || 'en',
      params.exportedBy,
      now,
    ]
  );

  return {
    id,
    reportId: params.reportId,
    reportType: params.reportType,
    format: params.format,
    filePath: params.filePath,
    fileSize: params.fileSize,
    language: params.language || 'en',
    exportedBy: params.exportedBy,
    exportedAt: now,
    downloadCount: 0,
  };
}

/**
 * Get export records for a report
 */
export async function getExportRecords(reportId: string): Promise<ReportExportRecord[]> {
  const rows = await queryAll<any>(
    `
    SELECT * FROM report_exports
    WHERE report_id = ?
    ORDER BY exported_at DESC
  `,
    [reportId]
  );

  return rows.map((r) => ({
    id: r.id,
    reportId: r.report_id,
    reportType: r.report_type,
    format: r.format,
    filePath: r.file_path,
    fileSize: r.file_size,
    language: r.language,
    exportedBy: r.exported_by,
    exportedAt: r.exported_at,
    downloadCount: r.download_count,
    lastDownloadAt: r.last_download_at,
  }));
}

/**
 * Increment download count for an export
 */
export async function incrementExportDownload(exportId: string): Promise<void> {
  await queryRun(
    `
    UPDATE report_exports
    SET download_count = download_count + 1, last_download_at = ?
    WHERE id = ?
  `,
    [new Date().toISOString(), exportId]
  );
}

// ==========================================
// PUBLIC LINK FUNCTIONS
// ==========================================

/**
 * Create a public share link for a report
 */
export async function createPublicLink(params: {
  reportId: string;
  reportType: string;
  organizationId: string;
  createdBy: string;
  passwordHash?: string;
  expiresAt?: string;
  showCompanyLogo?: boolean;
  showConsultinityBranding?: boolean;
  customMessage?: string;
}): Promise<PublicLinkRecord> {
  const id = uuidv4();
  const linkToken = uuidv4().replace(/-/g, ''); // Clean token for URL
  const now = new Date().toISOString();

  await queryRun(
    `
    INSERT INTO report_public_links (
      id, report_id, report_type, organization_id, link_token,
      password_hash, expires_at, show_company_logo, show_consultinity_branding,
      custom_message, view_count, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `,
    [
      id,
      params.reportId,
      params.reportType,
      params.organizationId,
      linkToken,
      params.passwordHash || null,
      params.expiresAt || null,
      params.showCompanyLogo !== false ? 1 : 0,
      params.showConsultinityBranding !== false ? 1 : 0,
      params.customMessage || null,
      params.createdBy,
      now,
    ]
  );

  return {
    id,
    reportId: params.reportId,
    reportType: params.reportType,
    organizationId: params.organizationId,
    linkToken,
    passwordHash: params.passwordHash,
    expiresAt: params.expiresAt,
    showCompanyLogo: params.showCompanyLogo !== false,
    showConsultinityBranding: params.showConsultinityBranding !== false,
    customMessage: params.customMessage,
    viewCount: 0,
    createdBy: params.createdBy,
    createdAt: now,
  };
}

/**
 * Get public links for a report
 */
export async function getPublicLinks(
  reportId: string,
  organizationId: string
): Promise<PublicLinkRecord[]> {
  const rows = await queryAll<any>(
    `
    SELECT * FROM report_public_links
    WHERE report_id = ? AND organization_id = ? AND revoked_at IS NULL
    ORDER BY created_at DESC
  `,
    [reportId, organizationId]
  );

  return rows.map((r) => ({
    id: r.id,
    reportId: r.report_id,
    reportType: r.report_type,
    organizationId: r.organization_id,
    linkToken: r.link_token,
    passwordHash: r.password_hash,
    expiresAt: r.expires_at,
    showCompanyLogo: Boolean(r.show_company_logo),
    showConsultinityBranding: Boolean(r.show_consultinity_branding),
    customMessage: r.custom_message,
    viewCount: r.view_count,
    lastViewedAt: r.last_viewed_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));
}

/**
 * Get public link by token (for public access)
 */
export async function getPublicLinkByToken(linkToken: string): Promise<{
  link: PublicLinkRecord;
  report: ReportRecord;
  sections: SectionRecord[];
} | null> {
  const linkRow = await queryOne<any>(
    `
    SELECT * FROM report_public_links
    WHERE link_token = ? AND revoked_at IS NULL
  `,
    [linkToken]
  );

  if (!linkRow) return null;

  // Check expiration
  if (linkRow.expires_at && new Date(linkRow.expires_at) < new Date()) {
    return null;
  }

  // Get report data
  const reportData = await getReport(linkRow.report_id, linkRow.organization_id);
  if (!reportData) return null;

  // Increment view count
  await queryRun(
    `
    UPDATE report_public_links
    SET view_count = view_count + 1, last_viewed_at = ?
    WHERE id = ?
  `,
    [new Date().toISOString(), linkRow.id]
  );

  return {
    link: {
      id: linkRow.id,
      reportId: linkRow.report_id,
      reportType: linkRow.report_type,
      organizationId: linkRow.organization_id,
      linkToken: linkRow.link_token,
      passwordHash: linkRow.password_hash,
      expiresAt: linkRow.expires_at,
      showCompanyLogo: Boolean(linkRow.show_company_logo),
      showConsultinityBranding: Boolean(linkRow.show_consultinity_branding),
      customMessage: linkRow.custom_message,
      viewCount: linkRow.view_count + 1,
      lastViewedAt: new Date().toISOString(),
      createdBy: linkRow.created_by,
      createdAt: linkRow.created_at,
      revokedAt: linkRow.revoked_at,
    },
    report: reportData.report,
    sections: reportData.sections,
  };
}

/**
 * Revoke a public link
 */
export async function revokePublicLink(linkId: string, organizationId: string): Promise<boolean> {
  const result = await queryRun(
    `
    UPDATE report_public_links
    SET revoked_at = ?
    WHERE id = ? AND organization_id = ? AND revoked_at IS NULL
  `,
    [new Date().toISOString(), linkId, organizationId]
  );

  return result.changes > 0;
}

// ==========================================
// TEMPLATE MARKETPLACE FUNCTIONS
// ==========================================

/**
 * List all templates (system + organization)
 */
export async function listTemplates(
  organizationId: string,
  options?: { sourceType?: string; isPublic?: boolean; isSystem?: boolean }
): Promise<any[]> {
  let sql = `
    SELECT * FROM report_builder_templates
    WHERE (organization_id IS NULL OR organization_id = ? OR is_public = 1)
  `;
  const params: any[] = [organizationId];

  if (options?.sourceType) {
    sql += ` AND source_type = ?`;
    params.push(options.sourceType);
  }

  if (options?.isSystem) {
    sql += ` AND is_system = 1`;
  }

  if (options?.isPublic) {
    sql += ` AND is_public = 1`;
  }

  sql += ` ORDER BY is_system DESC, name ASC`;

  const rows = await queryAll<any>(sql, params);
  return rows.map((row) => ({
    ...row,
    sections: row.sections_json ? JSON.parse(row.sections_json) : [],
    defaultOptions: row.default_options_json ? JSON.parse(row.default_options_json) : null,
  }));
}

/**
 * Get template by ID
 */
export async function getTemplateById(
  templateId: string,
  organizationId: string
): Promise<any | null> {
  const row = await queryOne<any>(
    `
    SELECT * FROM report_builder_templates
    WHERE id = ? AND (organization_id IS NULL OR organization_id = ? OR is_public = 1)
  `,
    [templateId, organizationId]
  );

  return row;
}

/**
 * Create a new template
 */
export async function createTemplate(params: {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  sourceType: string;
  reportType?: string;
  sections: any[];
  defaultOptions?: any;
  isPublic?: boolean;
  createdBy: string;
}): Promise<any> {
  const now = new Date().toISOString();

  await queryRun(
    `
    INSERT INTO report_builder_templates (
      id, organization_id, name, description, source_type, report_type,
      sections_json, default_options_json, is_system, is_default, is_public,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
  `,
    [
      params.id,
      params.organizationId,
      params.name,
      params.description || null,
      params.sourceType,
      params.reportType || null,
      JSON.stringify(params.sections),
      params.defaultOptions ? JSON.stringify(params.defaultOptions) : null,
      params.isPublic ? 1 : 0,
      params.createdBy,
      now,
      now,
    ]
  );

  return getTemplateById(params.id, params.organizationId);
}

/**
 * Update a template
 */
export async function updateTemplate(
  templateId: string,
  organizationId: string,
  updates: {
    name?: string;
    description?: string;
    sections?: any[];
    defaultOptions?: any;
    isPublic?: boolean;
  }
): Promise<any | null> {
  // Check if template exists and is editable (not system)
  const existing = await queryOne<any>(
    `SELECT * FROM report_builder_templates WHERE id = ? AND organization_id = ? AND is_system = 0`,
    [templateId, organizationId]
  );

  if (!existing) return null;

  const setClauses: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    params.push(updates.description);
  }
  if (updates.sections !== undefined) {
    setClauses.push('sections_json = ?');
    params.push(JSON.stringify(updates.sections));
  }
  if (updates.defaultOptions !== undefined) {
    setClauses.push('default_options_json = ?');
    params.push(JSON.stringify(updates.defaultOptions));
  }
  if (updates.isPublic !== undefined) {
    setClauses.push('is_public = ?');
    params.push(updates.isPublic ? 1 : 0);
  }

  if (setClauses.length === 0) return existing;

  setClauses.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(templateId);
  params.push(organizationId);

  await queryRun(
    `UPDATE report_builder_templates SET ${setClauses.join(', ')} WHERE id = ? AND organization_id = ?`,
    params
  );

  return getTemplateById(templateId, organizationId);
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string, organizationId: string): Promise<boolean> {
  const result = await queryRun(
    `DELETE FROM report_builder_templates WHERE id = ? AND organization_id = ? AND is_system = 0`,
    [templateId, organizationId]
  );

  return result.changes > 0;
}

/**
 * Duplicate a template
 */
export async function duplicateTemplate(
  templateId: string,
  organizationId: string,
  userId: string,
  newName?: string
): Promise<any | null> {
  const original = await getTemplateById(templateId, organizationId);
  if (!original) return null;

  const newId = uuidv4();
  const name = newName || `${original.name} (Copy)`;

  return createTemplate({
    id: newId,
    organizationId,
    name,
    description: original.description,
    sourceType: original.source_type,
    reportType: original.report_type,
    sections: original.sections_json ? JSON.parse(original.sections_json) : [],
    defaultOptions: original.default_options_json
      ? JSON.parse(original.default_options_json)
      : null,
    isPublic: false,
    createdBy: userId,
  });
}

// ==========================================
// VERSION HISTORY FUNCTIONS
// ==========================================

/**
 * Create a version snapshot of a report
 */
export async function createVersion(
  reportId: string,
  organizationId: string,
  userId: string,
  options?: {
    changeType?: 'auto' | 'manual' | 'rollback';
    changeSummary?: string;
    previousStatus?: string;
    newStatus?: string;
  }
): Promise<any> {
  // Get current report with sections
  const reportData = await getReport(reportId, organizationId);
  if (!reportData) throw new Error('Report not found');

  // Get next version number
  const lastVersion = await queryOne<{ max_version: number }>(
    `SELECT MAX(version_number) as max_version FROM report_builder_versions WHERE report_id = ?`,
    [reportId]
  );
  const versionNumber = (lastVersion?.max_version || 0) + 1;

  const versionId = uuidv4();
  const snapshot = {
    report: reportData.report,
    sections: reportData.sections,
    snapshotAt: new Date().toISOString(),
  };

  await queryRun(
    `
    INSERT INTO report_builder_versions (
      id, report_id, version_number, snapshot_json,
      change_summary, change_type, previous_status, new_status,
      created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      versionId,
      reportId,
      versionNumber,
      JSON.stringify(snapshot),
      options?.changeSummary || null,
      options?.changeType || 'manual',
      options?.previousStatus || null,
      options?.newStatus || null,
      userId,
      new Date().toISOString(),
    ]
  );

  logger.info('[ReportBuilder] Version created', { reportId, versionNumber, userId });

  return {
    id: versionId,
    reportId,
    versionNumber,
    changeType: options?.changeType || 'manual',
    changeSummary: options?.changeSummary,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * List versions for a report
 */
export async function listVersions(reportId: string, organizationId: string): Promise<any[]> {
  // Verify report belongs to organization
  const report = await queryOne<any>(
    `SELECT id FROM report_builder_reports WHERE id = ? AND organization_id = ?`,
    [reportId, organizationId]
  );
  if (!report) return [];

  const rows = await queryAll<any>(
    `
    SELECT v.*, u.name as created_by_name
    FROM report_builder_versions v
    LEFT JOIN users u ON v.created_by = u.id
    WHERE v.report_id = ?
    ORDER BY v.version_number DESC
  `,
    [reportId]
  );

  return rows.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    versionNumber: row.version_number,
    changeType: row.change_type,
    changeSummary: row.change_summary,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  }));
}

/**
 * Get a specific version
 */
export async function getVersion(versionId: string, organizationId: string): Promise<any | null> {
  const row = await queryOne<any>(
    `
    SELECT v.*, r.organization_id
    FROM report_builder_versions v
    JOIN report_builder_reports r ON v.report_id = r.id
    WHERE v.id = ? AND r.organization_id = ?
  `,
    [versionId, organizationId]
  );

  if (!row) return null;

  return {
    id: row.id,
    reportId: row.report_id,
    versionNumber: row.version_number,
    snapshot: row.snapshot_json ? JSON.parse(row.snapshot_json) : null,
    changeType: row.change_type,
    changeSummary: row.change_summary,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Compare two versions
 */
export async function compareVersions(
  versionId1: string,
  versionId2: string,
  organizationId: string
): Promise<any | null> {
  const v1 = await getVersion(versionId1, organizationId);
  const v2 = await getVersion(versionId2, organizationId);

  if (!v1 || !v2) return null;
  if (v1.reportId !== v2.reportId) return null;

  // Calculate differences
  const differences: any[] = [];

  // Compare report-level fields
  const r1 = v1.snapshot?.report || {};
  const r2 = v2.snapshot?.report || {};

  const reportFields = ['title', 'description', 'status'];
  for (const field of reportFields) {
    if (r1[field] !== r2[field]) {
      differences.push({
        type: 'report',
        field,
        oldValue: r1[field],
        newValue: r2[field],
      });
    }
  }

  // Compare sections
  const s1 = v1.snapshot?.sections || [];
  const s2 = v2.snapshot?.sections || [];

  const s1Map = new Map(s1.map((s: any) => [s.section_key, s]));
  const s2Map = new Map(s2.map((s: any) => [s.section_key, s]));

  // Check for added/removed sections
  for (const [key, section] of s2Map) {
    if (!s1Map.has(key)) {
      differences.push({
        type: 'section_added',
        sectionKey: key,
        title: (section as any).title,
      });
    }
  }

  for (const [key, section] of s1Map) {
    if (!s2Map.has(key)) {
      differences.push({
        type: 'section_removed',
        sectionKey: key,
        title: (section as any).title,
      });
    }
  }

  // Check for modified sections
  for (const [key, section1] of s1Map) {
    const section2 = s2Map.get(key);
    if (section2) {
      const s1Content = (section1 as any).generated_content || '';
      const s2Content = (section2 as any).generated_content || '';
      if (s1Content !== s2Content) {
        differences.push({
          type: 'section_modified',
          sectionKey: key,
          title: (section1 as any).title,
          oldLength: s1Content.length,
          newLength: s2Content.length,
        });
      }
    }
  }

  return {
    version1: {
      id: v1.id,
      versionNumber: v1.versionNumber,
      createdAt: v1.createdAt,
    },
    version2: {
      id: v2.id,
      versionNumber: v2.versionNumber,
      createdAt: v2.createdAt,
    },
    differences,
    totalChanges: differences.length,
  };
}

/**
 * Rollback to a specific version
 */
export async function rollbackToVersion(
  versionId: string,
  organizationId: string,
  userId: string
): Promise<any | null> {
  const version = await getVersion(versionId, organizationId);
  if (!version || !version.snapshot) return null;

  const reportId = version.reportId;
  const snapshot = version.snapshot;

  // Create a new version before rollback
  await createVersion(reportId, organizationId, userId, {
    changeType: 'rollback',
    changeSummary: `Rollback to version ${version.versionNumber}`,
    previousStatus: snapshot.report?.status,
    newStatus: snapshot.report?.status,
  });

  // Update report
  await queryRun(
    `
    UPDATE report_builder_reports
    SET title = ?, description = ?, status = ?, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `,
    [
      snapshot.report?.title,
      snapshot.report?.description,
      snapshot.report?.status,
      new Date().toISOString(),
      reportId,
      organizationId,
    ]
  );

  // Delete existing sections and recreate from snapshot
  await queryRun(`DELETE FROM report_builder_sections WHERE report_id = ?`, [reportId]);

  for (const section of snapshot.sections || []) {
    await queryRun(
      `
      INSERT INTO report_builder_sections (
        id, report_id, section_key, section_type, title, order_index,
        enabled, required, length, language, custom_prompt,
        block_type_id, block_config_json, render_kind,
        generated_content, edited_content, content_format,
        tiptap_content, source_data_snapshot, generated_at,
        tokens_used, edited_at, edited_by,
        repeat_for, repeat_key, repeat_name, repeat_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        uuidv4(),
        reportId,
        section.section_key,
        section.section_type,
        section.title,
        section.order_index,
        section.enabled ? 1 : 0,
        section.required ? 1 : 0,
        section.length,
        section.language,
        section.custom_prompt,
        section.block_type_id,
        section.block_config_json,
        section.render_kind,
        section.generated_content,
        section.edited_content,
        section.content_format || 'markdown',
        section.tiptap_content,
        section.source_data_snapshot,
        section.generated_at,
        section.tokens_used,
        section.edited_at,
        section.edited_by,
        section.repeat_for,
        section.repeat_key,
        section.repeat_name,
        section.repeat_data,
      ]
    );
  }

  logger.info('[ReportBuilder] Rollback completed', {
    reportId,
    toVersion: version.versionNumber,
    userId,
  });

  return getReport(reportId, organizationId);
}

// ==========================================
// EXPORTS
// ==========================================

const ReportBuilderService = {
  setDependencies,
  listAssessmentSources,
  getTemplateForSource,
  createReport,
  getReport,
  listReports,
  listBlockTypes,
  createBlockType,
  updateBlockType,
  deactivateBlockType,
  updateSectionConfig,
  addCustomSection,
  removeSection,
  updateSectionContent,
  updateReportStatus,
  updateReportConfig,
  duplicateReport,
  getSourceDataForReport,
  // Export functions
  createExportRecord,
  getExportRecords,
  incrementExportDownload,
  // Public link functions
  createPublicLink,
  getPublicLinks,
  getPublicLinkByToken,
  revokePublicLink,
  // Template marketplace functions
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  // Version history functions
  createVersion,
  listVersions,
  getVersion,
  compareVersions,
  rollbackToVersion,
};

export default ReportBuilderService;
