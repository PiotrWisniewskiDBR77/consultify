/**
 * Report Builder Service
 *
 * Handles report creation, section management, and AI content generation.
 * Generic service designed to work with multiple source types (Assessment, Interview, Tool).
 */

import { v4 as uuidv4 } from 'uuid';

import { DRD_STRUCTURE } from '../../shared/drdStructure.js';
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
    db.get(sql, params, (err: Error | null, row: T) => {
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
  framework?: string
): Promise<{ id: string; sections: unknown[] } | null> {
  const reportType = framework ? `${sourceType}_${framework}` : sourceType;

  const row = await queryOne<{ id: string; sections_json: string }>(
    `
    SELECT id, sections_json
    FROM report_builder_templates
    WHERE source_type = ? AND (report_type = ? OR report_type IS NULL)
    AND is_default = 1
    ORDER BY CASE WHEN report_type IS NULL THEN 1 ELSE 0 END, report_type DESC
    LIMIT 1
  `,
    [sourceType, reportType]
  );

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
  const { organizationId, sourceType, sourceId, title, description, createdBy, templateId } =
    params;

  // Get source data
  let sourceName = '';
  let sourceFramework = '';
  let companyContext: Record<string, unknown> = {};

  if (sourceType === 'ASSESSMENT') {
    const assessment = await getAssessmentSourceData(sourceId);
    if (!assessment) throw new Error('Assessment not found');
    if (assessment.status !== 'APPROVED') throw new Error('Assessment is not approved');

    sourceName = assessment.name;
    sourceFramework = assessment.assessmentType;
    companyContext = {
      organizationName: assessment.organizationName,
      assessmentType: assessment.assessmentType,
      ...assessment.context,
    };
  }

  // Get template
  const template = await getTemplateForSource(sourceType, sourceFramework);
  if (!template) throw new Error('No template found for this source type');

  const reportId = uuidv4();
  const reportType = sourceFramework ? `${sourceType}_${sourceFramework}` : sourceType;
  const now = new Date().toISOString();

  // Create report
  await queryRun(
    `
    INSERT INTO report_builder_reports (
      id, organization_id, source_type, source_id, source_name, source_framework,
      title, description, report_type, company_context_json, status,
      created_by, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, 1)
  `,
    [
      reportId,
      organizationId,
      sourceType,
      sourceId,
      sourceName,
      sourceFramework,
      title,
      description,
      reportType,
      JSON.stringify(companyContext),
      createdBy,
      now,
      now,
    ]
  );

  // Create sections from template
  const templateSections = template.sections as Array<{
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

  for (const tplSection of templateSections) {
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
    sourceType,
    sourceId,
    sourceName,
    sourceFramework,
    title,
    description,
    reportType,
    companyContext,
    status: 'DRAFT',
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
  filters?: { status?: ReportStatus; sourceType?: ReportSourceType; search?: string }
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
  if (filters?.sourceType) {
    sql += ` AND r.source_type = ?`;
    params.push(filters.sourceType);
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
  }
): Promise<SectionRecord> {
  const {
    title,
    sectionType = 'custom',
    afterSectionKey,
    length = 'medium',
    language = 'business',
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
      enabled, required, length, language, content_format, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, 'markdown', ?, ?)
  `,
    [sectionId, reportId, sectionKey, sectionType, title, orderIndex, length, language, now, now]
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
  } else if (status === 'APPROVED') {
    additionalFields = ', approved_at = ?, approved_by = ?';
    params.push(now, userId);
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
      title, description, report_type, config_json, company_context_json, status,
      created_by, created_at, updated_at, version, parent_report_id
    )
    SELECT 
      ?, organization_id, project_id, source_type, source_id, source_name, source_framework,
      ?, description, report_type, config_json, company_context_json, 'DRAFT',
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
// EXPORTS
// ==========================================

const ReportBuilderService = {
  setDependencies,
  listAssessmentSources,
  getTemplateForSource,
  createReport,
  getReport,
  listReports,
  updateSectionConfig,
  addCustomSection,
  removeSection,
  updateSectionContent,
  updateReportStatus,
  duplicateReport,
  getSourceDataForReport,
};

export default ReportBuilderService;
