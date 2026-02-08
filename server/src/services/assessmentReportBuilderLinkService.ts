import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export type AssessmentReportStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'FINAL'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'UTILIZED'
  | 'ARCHIVED';

export function mapReportBuilderStatusToAssessmentReportStatus(
  rbStatusRaw: string | null | undefined
): AssessmentReportStatus {
  const s = String(rbStatusRaw || 'DRAFT').toUpperCase();

  if (s === 'GENERATING') return 'GENERATING';
  if (s === 'GENERATED') return 'FINAL';
  if (s === 'IN_REVIEW') return 'PENDING_APPROVAL';
  if (s === 'APPROVED') return 'APPROVED';
  if (s === 'UTILIZED') return 'UTILIZED';
  if (s === 'REJECTED') return 'REJECTED';

  // Sent statuses are not first-class in Assessment module yet.
  if (s === 'SENT_INTERNAL' || s === 'SENT_EXTERNAL') return 'APPROVED';

  // CONFIGURING, DRAFT, etc.
  return 'DRAFT';
}

async function ensureColumn(table: string, name: string, ddl: string) {
  const cols = (await queryHelpers.queryAll(`PRAGMA table_info(${table})`)) as Array<{
    name: string;
  }>;
  const existing = new Set((cols || []).map((c) => String(c.name)));
  if (existing.has(name)) return;
  await queryHelpers.queryRun(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}

/**
 * Ensure link-related columns exist in `assessment_reports`.\n
 * This is used by Report Builder sync code paths, which may execute without the
 * Assessment Reports route having been hit in the current process lifetime.
 */
export async function ensureAssessmentReportsLinkSchema(): Promise<void> {
  try {
    // If the table doesn't exist yet, don't crash report builder.
    // The Assessment Reports route has the full `CREATE TABLE IF NOT EXISTS`.
    const row = await queryHelpers.queryOne(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='assessment_reports'`
    );
    if (!row) return;
  } catch {
    return;
  }

  try {
    await ensureColumn('assessment_reports', 'builder_report_id', 'builder_report_id TEXT');
    await ensureColumn('assessment_reports', 'rejected_by', 'rejected_by TEXT');
    await ensureColumn('assessment_reports', 'rejected_at', 'rejected_at TIMESTAMP');
    await ensureColumn('assessment_reports', 'rejection_reason', 'rejection_reason TEXT');
    await ensureColumn('assessment_reports', 'utilized_by', 'utilized_by TEXT');
    await ensureColumn('assessment_reports', 'utilized_at', 'utilized_at TIMESTAMP');
    await ensureColumn('assessment_reports', 'utilization_notes', 'utilization_notes TEXT');
  } catch (err: any) {
    logger.warn('[AssessmentReportBuilderLink] Failed ensuring link schema', {
      message: err?.message,
    });
  }
}

export async function upsertAssessmentReportForBuilder(params: {
  organizationId: string;
  assessmentId: string;
  projectId?: string | null;
  builderReportId: string;
  name: string;
  templateId?: string | null;
  rbStatus?: string | null;
  userId?: string | null;
}): Promise<{ assessmentReportId: string; created: boolean }> {
  await ensureAssessmentReportsLinkSchema();

  const organizationId = String(params.organizationId);
  const builderReportId = String(params.builderReportId);
  const assessmentId = String(params.assessmentId);
  const projectId = params.projectId ? String(params.projectId) : null;
  const name = String(params.name || 'Report');
  const templateId = params.templateId ? String(params.templateId) : null;
  const userId = params.userId ? String(params.userId) : null;
  const status =
    params.rbStatus !== undefined
      ? mapReportBuilderStatusToAssessmentReportStatus(params.rbStatus)
      : undefined;
  const now = new Date().toISOString();

  const existing = (await queryHelpers.queryOne(
    `SELECT id FROM assessment_reports WHERE organization_id = ? AND builder_report_id = ?`,
    [organizationId, builderReportId]
  )) as any;

  if (existing?.id) {
    await queryHelpers.queryRun(
      `UPDATE assessment_reports
       SET name = ?,
           status = COALESCE(?, status),
           template_id = COALESCE(?, template_id),
           updated_by = COALESCE(?, updated_by),
           updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [name, status || null, templateId, userId, now, String(existing.id), organizationId]
    );
    return { assessmentReportId: String(existing.id), created: false };
  }

  const id = `report-${uuidv4()}`;
  await queryHelpers.queryRun(
    `INSERT INTO assessment_reports (
      id, assessment_id, organization_id, project_id, name, status, template_id,
      axis_data, generation_params, created_by, updated_by, created_at, updated_at, builder_report_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      assessmentId,
      organizationId,
      projectId,
      name,
      status || 'DRAFT',
      templateId,
      JSON.stringify({}),
      JSON.stringify({ source: 'report_builder_sync', builderReportId }),
      userId || 'system',
      userId || 'system',
      now,
      now,
      builderReportId,
    ]
  );

  return { assessmentReportId: id, created: true };
}
