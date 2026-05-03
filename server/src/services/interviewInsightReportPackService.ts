import crypto from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';

export type InterviewReportWorksheetStatus = 'generated' | 'partial' | 'empty' | 'degraded';

export type InterviewReportPackStatus = 'draft' | 'in_review' | 'published';

export type InterviewReportWorksheetKey =
  | 'executive_summary'
  | 'scope_and_method'
  | 'material_quality'
  | 'source_register'
  | 'respondent_profile'
  | 'topic_synthesis'
  | 'person_topic_matrix'
  | 'findings_p10'
  | 'evidence_register'
  | 'contradictions_and_gaps'
  | 'opportunities'
  | 'recommendations_and_action_plan'
  | 'initiative_candidates'
  | 'open_questions'
  | 'appendix_provenance';

export interface InterviewReportWorksheet {
  key: InterviewReportWorksheetKey;
  title: string;
  required: true;
  status: InterviewReportWorksheetStatus;
  completenessScore: number;
  warnings: string[];
  rows: Array<Record<string, unknown>>;
  markdown?: string;
}

export interface InterviewReportPackDraft {
  id: string;
  insightId: string;
  title: string;
  status: InterviewReportPackStatus;
  worksheets: InterviewReportWorksheet[];
  completenessScore: number;
  degraded: boolean;
  degradedReasons: string[];
}

export type InterviewReportPackReadinessStatus =
  | 'blocked'
  | 'ready_with_warnings'
  | 'ready_for_review';

export interface InterviewReportPackReadinessIssue {
  worksheetKey?: InterviewReportWorksheetKey;
  severity: 'blocker' | 'warning';
  message: string;
}

export interface InterviewReportPackReadiness {
  reportPackId: string;
  insightId: string;
  status: InterviewReportPackReadinessStatus;
  completenessScore: number;
  blockers: InterviewReportPackReadinessIssue[];
  warnings: InterviewReportPackReadinessIssue[];
  worksheetBreakdown: Array<{
    key: InterviewReportWorksheetKey;
    title: string;
    status: InterviewReportWorksheetStatus;
    completenessScore: number;
    ready: boolean;
  }>;
}

export interface SubmitInterviewReportPackForReviewResult {
  reportPack: InterviewReportPackDraft;
  readiness: InterviewReportPackReadiness;
  submitted: boolean;
  blocked: boolean;
  alreadyInReview: boolean;
}

export interface PublishInterviewReportPackResult {
  reportPack: InterviewReportPackDraft;
  readiness: InterviewReportPackReadiness;
  published: boolean;
  blocked: boolean;
  alreadyPublished: boolean;
}

export interface InterviewReportPackExportManifest {
  reportPackId: string;
  insightId: string;
  title: string;
  status: 'published';
  exportedAt: string;
  manifestHash: string;
  completenessScore: number;
  degraded: boolean;
  degradedReasons: string[];
  readiness: InterviewReportPackReadiness;
  worksheetCount: number;
  worksheets: InterviewReportWorksheet[];
}

export interface InterviewReportPackRevision {
  id: string;
  reportPackId: string;
  insightId: string;
  version: number;
  manifestHash: string;
  createdAt: string;
}

export interface CreateInterviewReportPackRevisionResult {
  reportPack: InterviewReportPackDraft;
  revision: InterviewReportPackRevision;
}

export class InterviewReportPackMutationBlockedError extends Error {
  code = 'INTERVIEW_REPORT_PACK_IMMUTABLE';
  statusCode = 409;

  constructor(message = 'Published report packs cannot be edited.') {
    super(message);
    this.name = 'InterviewReportPackMutationBlockedError';
  }
}

export class InterviewReportPackExportBlockedError extends Error {
  code = 'INTERVIEW_REPORT_PACK_EXPORT_BLOCKED';
  statusCode = 409;

  constructor(message = 'Only published report packs can be exported as client-ready material.') {
    super(message);
    this.name = 'InterviewReportPackExportBlockedError';
  }
}

export class InterviewReportPackRevisionBlockedError extends Error {
  code = 'INTERVIEW_REPORT_PACK_REVISION_BLOCKED';
  statusCode = 409;

  constructor(message = 'Only published report packs can create a new editable revision.') {
    super(message);
    this.name = 'InterviewReportPackRevisionBlockedError';
  }
}

interface ReportPackRow {
  id: string;
  organization_id: string;
  insight_id: string;
  title: string;
  status: InterviewReportPackStatus;
  completeness_score: number;
  degraded: number;
  degraded_reasons_json?: string | null;
}

interface ReportPackWorksheetRow {
  worksheet_key: InterviewReportWorksheetKey;
  title: string;
  required: number;
  status: InterviewReportWorksheetStatus;
  completeness_score: number;
  warnings_json?: string | null;
  rows_json?: string | null;
  markdown?: string | null;
  sort_order: number;
}

export interface ReportPackSourceInsight {
  id: string;
  title?: string;
  executiveSummary?: string;
  sourceSessionIds?: string[];
  analysisScope?: Record<string, unknown>;
  materialQuality?: Record<string, unknown> | null;
  themes?: Array<Record<string, unknown>>;
  issues?: Array<Record<string, unknown>>;
  opportunities?: Array<Record<string, unknown>>;
  signals?: Array<Record<string, unknown>>;
  evidenceMap?: Array<Record<string, unknown>>;
  missingData?: string[];
  generationContext?: Record<string, unknown>;
}

export interface UpdateInterviewReportWorksheetInput {
  status?: InterviewReportWorksheetStatus;
  completenessScore?: number;
  warnings?: string[];
  rows?: Array<Record<string, unknown>>;
  markdown?: string | null;
}

export const REQUIRED_INTERVIEW_REPORT_WORKSHEETS: Array<{
  key: InterviewReportWorksheetKey;
  title: string;
}> = [
  { key: 'executive_summary', title: 'Executive Summary' },
  { key: 'scope_and_method', title: 'Scope And Method' },
  { key: 'material_quality', title: 'Material Quality' },
  { key: 'source_register', title: 'Source Register' },
  { key: 'respondent_profile', title: 'Respondent Profile' },
  { key: 'topic_synthesis', title: 'Topic Synthesis' },
  { key: 'person_topic_matrix', title: 'Person x Topic Matrix' },
  { key: 'findings_p10', title: 'P10 Findings' },
  { key: 'evidence_register', title: 'Evidence Register' },
  { key: 'contradictions_and_gaps', title: 'Contradictions And Gaps' },
  { key: 'opportunities', title: 'Opportunities' },
  { key: 'recommendations_and_action_plan', title: 'Recommendations And Action Plan' },
  { key: 'initiative_candidates', title: 'Initiative Candidates' },
  { key: 'open_questions', title: 'Open Questions' },
  { key: 'appendix_provenance', title: 'Appendix: Provenance' },
];

export async function ensureInterviewReportPackSchema(): Promise<void> {
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS interview_report_packs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      insight_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      completeness_score INTEGER NOT NULL DEFAULT 0,
      degraded INTEGER NOT NULL DEFAULT 0,
      degraded_reasons_json TEXT DEFAULT '[]',
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await queryHelpers.queryRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_report_packs_insight
     ON interview_report_packs(organization_id, insight_id)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_interview_report_packs_org
     ON interview_report_packs(organization_id)`
  );
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS interview_report_pack_worksheets (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      report_pack_id TEXT NOT NULL,
      insight_id TEXT NOT NULL,
      worksheet_key TEXT NOT NULL,
      title TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'empty',
      completeness_score INTEGER NOT NULL DEFAULT 0,
      warnings_json TEXT DEFAULT '[]',
      rows_json TEXT DEFAULT '[]',
      markdown TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await queryHelpers.queryRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_report_pack_worksheets_key
     ON interview_report_pack_worksheets(report_pack_id, worksheet_key)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_interview_report_pack_worksheets_org
     ON interview_report_pack_worksheets(organization_id)`
  );
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS interview_report_pack_revisions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      report_pack_id TEXT NOT NULL,
      insight_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      manifest_hash TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await queryHelpers.queryRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_report_pack_revisions_version
     ON interview_report_pack_revisions(report_pack_id, version)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_interview_report_pack_revisions_insight
     ON interview_report_pack_revisions(organization_id, insight_id)`
  );
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS interview_insight_audit_log (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      insight_id TEXT NOT NULL,
      finding_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      action TEXT NOT NULL,
      actor_user_id TEXT,
      detail_json TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_interview_insight_audit_org
     ON interview_insight_audit_log(organization_id)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_interview_insight_audit_insight
     ON interview_insight_audit_log(insight_id)`
  );
}

function parseJsonArray<T>(value: string | null | undefined, fallback: T[] = []): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function createReportPackManifestHash(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function mapRowsToReportPack(
  packRow: ReportPackRow,
  worksheetRows: ReportPackWorksheetRow[]
): InterviewReportPackDraft {
  return {
    id: packRow.id,
    insightId: packRow.insight_id,
    title: packRow.title,
    status: isReportPackStatus(packRow.status) ? packRow.status : 'draft',
    completenessScore: Number(packRow.completeness_score || 0),
    degraded: Boolean(packRow.degraded),
    degradedReasons: parseJsonArray<string>(packRow.degraded_reasons_json),
    worksheets: worksheetRows
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map((row) => ({
        key: row.worksheet_key,
        title: row.title,
        required: true,
        status: row.status,
        completenessScore: Number(row.completeness_score || 0),
        warnings: parseJsonArray<string>(row.warnings_json),
        rows: parseJsonArray<Record<string, unknown>>(row.rows_json),
        ...(row.markdown ? { markdown: row.markdown } : {}),
      })),
  };
}

function isReportPackStatus(value: unknown): value is InterviewReportPackStatus {
  return value === 'draft' || value === 'in_review' || value === 'published';
}

function isWorksheetStatus(value: unknown): value is InterviewReportWorksheetStatus {
  return value === 'generated' || value === 'partial' || value === 'empty' || value === 'degraded';
}

function normalizeCompletenessScore(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function hasRows(rows: Array<Record<string, unknown>>): boolean {
  return rows.length > 0;
}

function worksheet(params: {
  key: InterviewReportWorksheetKey;
  title: string;
  rows?: Array<Record<string, unknown>>;
  markdown?: string;
  warnings?: string[];
  degraded?: boolean;
}): InterviewReportWorksheet {
  const rows = params.rows || [];
  const hasContent = hasRows(rows) || Boolean(params.markdown?.trim());
  const warnings = params.warnings || [];
  const status: InterviewReportWorksheetStatus = params.degraded
    ? 'degraded'
    : hasContent
      ? warnings.length > 0
        ? 'partial'
        : 'generated'
      : 'empty';

  return {
    key: params.key,
    title: params.title,
    required: true,
    status,
    completenessScore:
      status === 'generated' ? 100 : status === 'partial' ? 70 : status === 'degraded' ? 40 : 0,
    warnings,
    rows,
    ...(params.markdown ? { markdown: params.markdown } : {}),
  };
}

function evidenceRefsFrom(items: Array<Record<string, unknown>> = []): string[] {
  return Array.from(
    new Set(
      items.flatMap((item) =>
        Array.isArray(item.evidence_refs)
          ? item.evidence_refs.map((ref) => String(ref || '').trim()).filter(Boolean)
          : []
      )
    )
  );
}

export function buildInterviewReportPackDraft(
  insight: ReportPackSourceInsight
): InterviewReportPackDraft {
  const themes = insight.themes || [];
  const issues = insight.issues || [];
  const opportunities = insight.opportunities || [];
  const signals = insight.signals || [];
  const evidenceMap = insight.evidenceMap || [];
  const missingData = insight.missingData || [];
  const sourceMaterial = (insight.generationContext?.sourceMaterial || {}) as Record<
    string,
    unknown
  >;
  const evidenceValidation = (insight.generationContext?.evidenceValidation || {}) as Record<
    string,
    unknown
  >;
  const evidenceWarnings = Array.isArray(evidenceValidation.warnings)
    ? evidenceValidation.warnings.map(String)
    : [];

  const topicRows = [...themes, ...issues, ...signals].map((item) => ({ ...item }));
  const contradictionRows = signals
    .filter((signal) => signal.type === 'contradiction' || signal.type === 'gap')
    .map((signal) => ({ ...signal }));
  const allEvidenceRefs = evidenceRefsFrom([...themes, ...issues, ...opportunities]);

  const worksheets = REQUIRED_INTERVIEW_REPORT_WORKSHEETS.map(({ key, title }) => {
    switch (key) {
      case 'executive_summary':
        return worksheet({
          key,
          title,
          markdown: insight.executiveSummary,
          warnings: insight.executiveSummary ? [] : ['Executive summary is missing.'],
        });
      case 'scope_and_method':
        return worksheet({
          key,
          title,
          rows: [insight.analysisScope || {}],
        });
      case 'material_quality':
        return worksheet({
          key,
          title,
          rows: insight.materialQuality ? [insight.materialQuality] : [],
          warnings: insight.materialQuality ? [] : ['Material Quality was not generated.'],
        });
      case 'source_register':
        return worksheet({
          key,
          title,
          rows: [
            {
              sourceSessionIds: insight.sourceSessionIds || [],
              sourceMaterial,
            },
          ],
        });
      case 'respondent_profile':
        return worksheet({
          key,
          title,
          rows: Array.isArray(sourceMaterial.includedSessionIds)
            ? sourceMaterial.includedSessionIds.map((sessionId) => ({ sessionId }))
            : [],
          warnings: ['Respondent profile requires enriched respondent metadata in the next phase.'],
        });
      case 'topic_synthesis':
        return worksheet({ key, title, rows: topicRows });
      case 'person_topic_matrix':
        return worksheet({
          key,
          title,
          rows: topicRows.filter((item) => item.perspective_labels || item.divergence_note),
          warnings: ['Matrix is partial until respondent x topic rows are generated natively.'],
        });
      case 'findings_p10':
        return worksheet({
          key,
          title,
          warnings: [
            'P10 findings are governed separately and must be attached in the next phase.',
          ],
        });
      case 'evidence_register':
        return worksheet({
          key,
          title,
          rows: evidenceMap,
          warnings: evidenceWarnings,
          degraded: evidenceWarnings.length > 0,
        });
      case 'contradictions_and_gaps':
        return worksheet({ key, title, rows: contradictionRows });
      case 'opportunities':
        return worksheet({ key, title, rows: opportunities });
      case 'recommendations_and_action_plan':
        return worksheet({
          key,
          title,
          rows: opportunities.map((opportunity) => ({
            recommendationType: 'hypothesis',
            ...opportunity,
          })),
          warnings: ['Recommendations are hypotheses until reviewed by an operator.'],
        });
      case 'initiative_candidates':
        return worksheet({
          key,
          title,
          rows: opportunities.map((opportunity) => ({
            target: 'Interview > Initiatives',
            status: 'draft_candidate',
            ...opportunity,
          })),
        });
      case 'open_questions':
        return worksheet({
          key,
          title,
          rows: missingData.map((item) => ({ questionOrGap: item })),
        });
      case 'appendix_provenance':
        return worksheet({
          key,
          title,
          rows: [
            {
              insightId: insight.id,
              generationContext: insight.generationContext || {},
              allEvidenceRefs,
            },
          ],
          degraded: evidenceWarnings.length > 0,
          warnings: evidenceWarnings,
        });
      default:
        return worksheet({ key, title });
    }
  });

  const completenessScore = Math.round(
    worksheets.reduce((sum, item) => sum + item.completenessScore, 0) / worksheets.length
  );
  const degradedReasons = worksheets.flatMap((item) =>
    item.status === 'degraded' ? item.warnings : []
  );

  return {
    id: `irp_${insight.id}`,
    insightId: insight.id,
    title: insight.title ? `Report Pack: ${insight.title}` : 'Interview Insight Report Pack',
    status: 'draft',
    worksheets,
    completenessScore,
    degraded: degradedReasons.length > 0,
    degradedReasons,
  };
}

export async function getPersistedInterviewReportPack(
  organizationId: string,
  insightId: string
): Promise<InterviewReportPackDraft | null> {
  await ensureInterviewReportPackSchema();
  const packRow = await queryHelpers.queryOne<ReportPackRow>(
    `SELECT * FROM interview_report_packs WHERE organization_id = ? AND insight_id = ?`,
    [organizationId, insightId]
  );
  if (!packRow) return null;

  const worksheetRows = await queryHelpers.queryAll<ReportPackWorksheetRow>(
    `SELECT * FROM interview_report_pack_worksheets
     WHERE organization_id = ? AND report_pack_id = ?
     ORDER BY sort_order ASC`,
    [organizationId, packRow.id]
  );

  return mapRowsToReportPack(packRow, worksheetRows);
}

export function evaluateInterviewReportPackReadiness(
  reportPack: InterviewReportPackDraft
): InterviewReportPackReadiness {
  const requiredKeys = new Set(REQUIRED_INTERVIEW_REPORT_WORKSHEETS.map((item) => item.key));
  const worksheetsByKey = new Map(reportPack.worksheets.map((item) => [item.key, item]));
  const blockers: InterviewReportPackReadinessIssue[] = [];
  const warnings: InterviewReportPackReadinessIssue[] = [];

  for (const key of requiredKeys) {
    const worksheet = worksheetsByKey.get(key);
    if (!worksheet) {
      blockers.push({
        worksheetKey: key,
        severity: 'blocker',
        message: `Required worksheet ${key} is missing.`,
      });
      continue;
    }
    if (worksheet.status === 'empty') {
      blockers.push({
        worksheetKey: key,
        severity: 'blocker',
        message: `Required worksheet ${key} is empty.`,
      });
    }
    if (worksheet.status === 'degraded') {
      blockers.push({
        worksheetKey: key,
        severity: 'blocker',
        message: `Required worksheet ${key} is degraded.`,
      });
    }
    if (worksheet.status === 'partial') {
      warnings.push({
        worksheetKey: key,
        severity: 'warning',
        message: `Worksheet ${key} is partial and should be reviewed before publish.`,
      });
    }
  }

  if (reportPack.completenessScore < 80) {
    blockers.push({
      severity: 'blocker',
      message: `Report pack completeness is ${reportPack.completenessScore}%, below the 80% review gate.`,
    });
  }

  const status: InterviewReportPackReadinessStatus =
    blockers.length > 0
      ? 'blocked'
      : warnings.length > 0
        ? 'ready_with_warnings'
        : 'ready_for_review';

  return {
    reportPackId: reportPack.id,
    insightId: reportPack.insightId,
    status,
    completenessScore: reportPack.completenessScore,
    blockers,
    warnings,
    worksheetBreakdown: reportPack.worksheets.map((worksheet) => ({
      key: worksheet.key,
      title: worksheet.title,
      status: worksheet.status,
      completenessScore: worksheet.completenessScore,
      ready: worksheet.status === 'generated' && worksheet.completenessScore >= 80,
    })),
  };
}

export async function getInterviewReportPackReadiness(
  organizationId: string,
  insightId: string
): Promise<InterviewReportPackReadiness | null> {
  const reportPack = await getPersistedInterviewReportPack(organizationId, insightId);
  return reportPack ? evaluateInterviewReportPackReadiness(reportPack) : null;
}

export async function submitInterviewReportPackForReview(params: {
  organizationId: string;
  insightId: string;
  actorUserId?: string;
}): Promise<SubmitInterviewReportPackForReviewResult | null> {
  await ensureInterviewReportPackSchema();
  const reportPack = await getPersistedInterviewReportPack(params.organizationId, params.insightId);
  if (!reportPack) return null;

  const readiness = evaluateInterviewReportPackReadiness(reportPack);
  const now = new Date().toISOString();

  if (readiness.blockers.length > 0) {
    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_audit_log
       (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        params.insightId,
        'interview_report_pack',
        reportPack.id,
        'report_pack_review_blocked',
        params.actorUserId || null,
        JSON.stringify({
          reportPackId: reportPack.id,
          readiness,
        }),
        now,
      ]
    );
    return {
      reportPack,
      readiness,
      submitted: false,
      blocked: true,
      alreadyInReview: false,
    };
  }

  if (reportPack.status !== 'in_review') {
    await queryHelpers.queryRun(
      `UPDATE interview_report_packs
       SET status = ?, updated_at = ?
       WHERE organization_id = ? AND id = ?`,
      ['in_review', now, params.organizationId, reportPack.id]
    );
    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_audit_log
       (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        params.insightId,
        'interview_report_pack',
        reportPack.id,
        'report_pack_submitted_for_review',
        params.actorUserId || null,
        JSON.stringify({
          reportPackId: reportPack.id,
          previousStatus: reportPack.status,
          nextStatus: 'in_review',
          readiness,
        }),
        now,
      ]
    );
  }

  return {
    reportPack: {
      ...reportPack,
      status: 'in_review',
    },
    readiness,
    submitted: reportPack.status !== 'in_review',
    blocked: false,
    alreadyInReview: reportPack.status === 'in_review',
  };
}

export async function publishInterviewReportPack(params: {
  organizationId: string;
  insightId: string;
  actorUserId?: string;
}): Promise<PublishInterviewReportPackResult | null> {
  await ensureInterviewReportPackSchema();
  const reportPack = await getPersistedInterviewReportPack(params.organizationId, params.insightId);
  if (!reportPack) return null;

  const readiness = evaluateInterviewReportPackReadiness(reportPack);
  const now = new Date().toISOString();

  if (reportPack.status === 'published') {
    return {
      reportPack,
      readiness,
      published: false,
      blocked: false,
      alreadyPublished: true,
    };
  }

  const publishBlockers: InterviewReportPackReadinessIssue[] = [];
  if (reportPack.status !== 'in_review') {
    publishBlockers.push({
      severity: 'blocker',
      message: 'Report pack must be submitted for review before publish.',
    });
  }
  if (readiness.status !== 'ready_for_review') {
    publishBlockers.push({
      severity: 'blocker',
      message: 'Report pack must pass readiness without blockers or warnings before publish.',
    });
  }

  if (publishBlockers.length > 0) {
    const blockedReadiness: InterviewReportPackReadiness = {
      ...readiness,
      status: 'blocked',
      blockers: [...readiness.blockers, ...publishBlockers],
    };
    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_audit_log
       (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        params.insightId,
        'interview_report_pack',
        reportPack.id,
        'report_pack_publish_blocked',
        params.actorUserId || null,
        JSON.stringify({
          reportPackId: reportPack.id,
          previousStatus: reportPack.status,
          readiness: blockedReadiness,
        }),
        now,
      ]
    );
    return {
      reportPack,
      readiness: blockedReadiness,
      published: false,
      blocked: true,
      alreadyPublished: false,
    };
  }

  await queryHelpers.queryRun(
    `UPDATE interview_report_packs
     SET status = ?, updated_at = ?
     WHERE organization_id = ? AND id = ?`,
    ['published', now, params.organizationId, reportPack.id]
  );
  await queryHelpers.queryRun(
    `INSERT INTO interview_insight_audit_log
     (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.organizationId,
      params.insightId,
      'interview_report_pack',
      reportPack.id,
      'report_pack_published',
      params.actorUserId || null,
      JSON.stringify({
        reportPackId: reportPack.id,
        previousStatus: reportPack.status,
        nextStatus: 'published',
        readiness,
      }),
      now,
    ]
  );

  return {
    reportPack: {
      ...reportPack,
      status: 'published',
    },
    readiness,
    published: true,
    blocked: false,
    alreadyPublished: false,
  };
}

export async function buildInterviewReportPackExportManifest(params: {
  organizationId: string;
  insightId: string;
}): Promise<InterviewReportPackExportManifest | null> {
  const reportPack = await getPersistedInterviewReportPack(params.organizationId, params.insightId);
  if (!reportPack) return null;
  if (reportPack.status !== 'published') {
    throw new InterviewReportPackExportBlockedError();
  }

  const readiness = evaluateInterviewReportPackReadiness(reportPack);
  const manifestHash = createReportPackManifestHash({
    reportPackId: reportPack.id,
    insightId: reportPack.insightId,
    title: reportPack.title,
    status: 'published',
    completenessScore: reportPack.completenessScore,
    degraded: reportPack.degraded,
    degradedReasons: reportPack.degradedReasons,
    readiness,
    worksheetCount: reportPack.worksheets.length,
    worksheets: reportPack.worksheets,
  });

  return {
    reportPackId: reportPack.id,
    insightId: reportPack.insightId,
    title: reportPack.title,
    status: 'published',
    exportedAt: new Date().toISOString(),
    manifestHash,
    completenessScore: reportPack.completenessScore,
    degraded: reportPack.degraded,
    degradedReasons: reportPack.degradedReasons,
    readiness,
    worksheetCount: reportPack.worksheets.length,
    worksheets: reportPack.worksheets,
  };
}

export async function createInterviewReportPackRevision(params: {
  organizationId: string;
  insightId: string;
  actorUserId?: string;
}): Promise<CreateInterviewReportPackRevisionResult | null> {
  await ensureInterviewReportPackSchema();
  const reportPack = await getPersistedInterviewReportPack(params.organizationId, params.insightId);
  if (!reportPack) return null;
  if (reportPack.status !== 'published') {
    throw new InterviewReportPackRevisionBlockedError();
  }

  const manifest = await buildInterviewReportPackExportManifest({
    organizationId: params.organizationId,
    insightId: params.insightId,
  });
  if (!manifest) return null;

  const versionRow = await queryHelpers.queryOne<{ next_version?: number }>(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
     FROM interview_report_pack_revisions
     WHERE organization_id = ? AND report_pack_id = ?`,
    [params.organizationId, reportPack.id]
  );
  const version = Number(versionRow?.next_version || 1);
  const revisionId = uuidv4();
  const now = new Date().toISOString();

  await queryHelpers.queryRun(
    `INSERT INTO interview_report_pack_revisions
     (id, organization_id, report_pack_id, insight_id, version, manifest_hash, manifest_json, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      revisionId,
      params.organizationId,
      reportPack.id,
      params.insightId,
      version,
      manifest.manifestHash,
      JSON.stringify(manifest),
      params.actorUserId || null,
      now,
    ]
  );

  await queryHelpers.queryRun(
    `UPDATE interview_report_packs
     SET status = ?, updated_at = ?
     WHERE organization_id = ? AND id = ?`,
    ['draft', now, params.organizationId, reportPack.id]
  );

  await queryHelpers.queryRun(
    `INSERT INTO interview_insight_audit_log
     (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.organizationId,
      params.insightId,
      'interview_report_pack',
      reportPack.id,
      'report_pack_revision_created',
      params.actorUserId || null,
      JSON.stringify({
        reportPackId: reportPack.id,
        revisionId,
        version,
        previousStatus: 'published',
        nextStatus: 'draft',
        manifestHash: manifest.manifestHash,
      }),
      now,
    ]
  );

  return {
    reportPack: {
      ...reportPack,
      status: 'draft',
    },
    revision: {
      id: revisionId,
      reportPackId: reportPack.id,
      insightId: params.insightId,
      version,
      manifestHash: manifest.manifestHash,
      createdAt: now,
    },
  };
}

export async function createInterviewReportPackDraft(params: {
  organizationId: string;
  insight: ReportPackSourceInsight;
  createdBy?: string;
}): Promise<InterviewReportPackDraft> {
  await ensureInterviewReportPackSchema();
  const existing = await getPersistedInterviewReportPack(params.organizationId, params.insight.id);
  if (existing) return existing;

  const draft = buildInterviewReportPackDraft(params.insight);
  const now = new Date().toISOString();

  await queryHelpers.queryRun(
    `INSERT INTO interview_report_packs
     (id, organization_id, insight_id, title, status, completeness_score, degraded, degraded_reasons_json, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.id,
      params.organizationId,
      draft.insightId,
      draft.title,
      draft.status,
      draft.completenessScore,
      draft.degraded ? 1 : 0,
      JSON.stringify(draft.degradedReasons),
      params.createdBy || null,
      now,
      now,
    ]
  );

  for (const [index, item] of draft.worksheets.entries()) {
    await queryHelpers.queryRun(
      `INSERT INTO interview_report_pack_worksheets
       (id, organization_id, report_pack_id, insight_id, worksheet_key, title, required, status, completeness_score, warnings_json, rows_json, markdown, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        draft.id,
        draft.insightId,
        item.key,
        item.title,
        item.required ? 1 : 0,
        item.status,
        item.completenessScore,
        JSON.stringify(item.warnings),
        JSON.stringify(item.rows),
        item.markdown || null,
        index,
        now,
        now,
      ]
    );
  }

  return draft;
}

export async function updateInterviewReportWorksheet(params: {
  organizationId: string;
  insightId: string;
  worksheetKey: string;
  actorUserId?: string;
  updates: UpdateInterviewReportWorksheetInput;
}): Promise<InterviewReportPackDraft | null> {
  await ensureInterviewReportPackSchema();
  const packRow = await queryHelpers.queryOne<ReportPackRow>(
    `SELECT * FROM interview_report_packs WHERE organization_id = ? AND insight_id = ?`,
    [params.organizationId, params.insightId]
  );
  if (!packRow) return null;

  if (packRow.status === 'published') {
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_audit_log
       (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.organizationId,
        params.insightId,
        'interview_report_worksheet',
        `${packRow.id}:${params.worksheetKey}`,
        'worksheet_update_blocked',
        params.actorUserId || null,
        JSON.stringify({
          reportPackId: packRow.id,
          worksheetKey: params.worksheetKey,
          reason: 'published_report_pack_immutable',
          attemptedUpdates: Object.keys(params.updates),
        }),
        now,
      ]
    );
    throw new InterviewReportPackMutationBlockedError();
  }

  const existingWorksheet = await queryHelpers.queryOne<ReportPackWorksheetRow>(
    `SELECT * FROM interview_report_pack_worksheets
     WHERE organization_id = ? AND report_pack_id = ? AND worksheet_key = ?`,
    [params.organizationId, packRow.id, params.worksheetKey]
  );
  if (!existingWorksheet) return null;

  const assignments: string[] = [];
  const values: unknown[] = [];
  const normalizedScore = normalizeCompletenessScore(params.updates.completenessScore);

  if (params.updates.status !== undefined && isWorksheetStatus(params.updates.status)) {
    assignments.push('status = ?');
    values.push(params.updates.status);
  }
  if (normalizedScore !== undefined) {
    assignments.push('completeness_score = ?');
    values.push(normalizedScore);
  }
  if (params.updates.warnings !== undefined) {
    assignments.push('warnings_json = ?');
    values.push(JSON.stringify(params.updates.warnings.map(String)));
  }
  if (params.updates.rows !== undefined) {
    assignments.push('rows_json = ?');
    values.push(JSON.stringify(params.updates.rows));
  }
  if (params.updates.markdown !== undefined) {
    assignments.push('markdown = ?');
    values.push(params.updates.markdown || null);
  }

  if (assignments.length > 0) {
    assignments.push('updated_at = ?');
    values.push(new Date().toISOString(), params.organizationId, packRow.id, params.worksheetKey);
    await queryHelpers.queryRun(
      `UPDATE interview_report_pack_worksheets
       SET ${assignments.join(', ')}
       WHERE organization_id = ? AND report_pack_id = ? AND worksheet_key = ?`,
      values
    );
  }

  const worksheetRows = await queryHelpers.queryAll<ReportPackWorksheetRow>(
    `SELECT * FROM interview_report_pack_worksheets
     WHERE organization_id = ? AND report_pack_id = ?
     ORDER BY sort_order ASC`,
    [params.organizationId, packRow.id]
  );
  const completenessScore =
    worksheetRows.length > 0
      ? Math.round(
          worksheetRows.reduce((sum, item) => sum + Number(item.completeness_score || 0), 0) /
            worksheetRows.length
        )
      : 0;
  const degradedReasons = worksheetRows.flatMap((item) =>
    item.status === 'degraded' ? parseJsonArray<string>(item.warnings_json) : []
  );
  const now = new Date().toISOString();

  await queryHelpers.queryRun(
    `UPDATE interview_report_packs
     SET completeness_score = ?, degraded = ?, degraded_reasons_json = ?, updated_at = ?
     WHERE organization_id = ? AND id = ?`,
    [
      completenessScore,
      degradedReasons.length > 0 ? 1 : 0,
      JSON.stringify(degradedReasons),
      now,
      params.organizationId,
      packRow.id,
    ]
  );

  await queryHelpers.queryRun(
    `INSERT INTO interview_insight_audit_log
     (id, organization_id, insight_id, entity_type, entity_id, action, actor_user_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.organizationId,
      params.insightId,
      'interview_report_worksheet',
      `${packRow.id}:${params.worksheetKey}`,
      'worksheet_updated',
      params.actorUserId || null,
      JSON.stringify({
        reportPackId: packRow.id,
        worksheetKey: params.worksheetKey,
        previous: {
          status: existingWorksheet.status,
          completenessScore: existingWorksheet.completeness_score,
          warnings: parseJsonArray<string>(existingWorksheet.warnings_json),
        },
        updates: params.updates,
        nextPack: {
          completenessScore,
          degraded: degradedReasons.length > 0,
          degradedReasons,
        },
      }),
      now,
    ]
  );

  return {
    ...mapRowsToReportPack(
      {
        ...packRow,
        completeness_score: completenessScore,
        degraded: degradedReasons.length > 0 ? 1 : 0,
        degraded_reasons_json: JSON.stringify(degradedReasons),
      },
      worksheetRows
    ),
  };
}
