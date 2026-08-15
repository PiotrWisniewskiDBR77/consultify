/**
 * Assessment Reports Routes
 * API endpoints for assessment report lifecycle
 */

import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';
import { v4 as uuidv4 } from 'uuid';
import * as xlsx from 'xlsx';

import { getAxisById } from '../data/drdStructure.js';
import { getDatabase } from '../database/index.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import AssessmentInitiativeGenerationRunService from '../services/assessmentInitiativeGenerationRunService.js';
import AssessmentPermissionService from '../services/assessmentPermissionService.js';
import { mapReportBuilderStatusToAssessmentReportStatus } from '../services/assessmentReportBuilderLinkService.js';
import ReportBuilderService from '../services/reportBuilderService.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { requireRequestOrganizationId } from '../utils/requestOrganization.js';
import { exportsDir } from '../utils/storagePaths.js';

const router = Router();
const notConfigured = (res: Response, details?: Record<string, unknown>) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
    ...(details || {}),
  });

interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role: string;
  };
}

// Middleware (match other authenticated modules)
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

const safeJsonParse = <T = unknown>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

type DetailedAnalysis = {
  keyFindings?: string[];
  notes?: string;
  [key: string]: any;
};

type ReportStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'FINAL'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'UTILIZED'
  | 'ARCHIVED';
type SectionType =
  | 'cover_page'
  | 'executive_summary'
  | 'methodology'
  | 'maturity_overview'
  | 'axis_detail'
  | 'area_detail'
  | 'gap_analysis'
  | 'initiatives'
  | 'recommendations'
  | 'next_steps'
  | 'roadmap'
  | 'appendix'
  | 'custom';

type TemplateSectionSpec = {
  key?: string;
  type?: string;
  title?: string;
  required?: boolean;
  order?: number;
  repeatFor?: 'axis' | 'area' | string;
  repeatKey?: string;
  defaultLength?: string;
  defaultLanguage?: string;
};

const run = async (sql: string, params: any[] = []) => {
  const db = getDatabase();
  await new Promise<void>((resolve, reject) => {
    db.run(sql, params, (err: Error | null) => (err ? reject(err) : resolve()));
  });
};

const get = async <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  const db = getDatabase();
  return await new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: any) => (err ? reject(err) : resolve(row)));
  });
};

const all = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  const db = getDatabase();
  return await new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) =>
      err ? reject(err) : resolve(rows || [])
    );
  });
};

let ensureAssessmentReportsSchemaPromise: Promise<void> | null = null;
let assessmentReportsSchemaReady = false;

const ensureAssessmentReportsSchema = async (): Promise<void> => {
  if (assessmentReportsSchemaReady) return;
  if (ensureAssessmentReportsSchemaPromise) {
    await ensureAssessmentReportsSchemaPromise;
    return;
  }

  ensureAssessmentReportsSchemaPromise = (async () => {
    // ASM-002: migrations are the only schema writer. These zero-row reads
    // validate the exact runtime contract and fail closed on drift while still
    // allowing the application role to run with no DDL privileges.
    await all(
      `SELECT id, assessment_id, organization_id, project_id, name, status,
              template_id, builder_report_id, axis_data, executive_summary,
              detailed_analysis, recommendations, generated_by,
              generation_params, created_by, updated_by, approved_by,
              approved_at, rejected_by, rejected_at, rejection_reason,
              utilized_by, utilized_at, utilization_notes, created_at, updated_at
         FROM assessment_reports WHERE 1 = 0`
    );
    await all(
      `SELECT id, report_id, section_type, axis_id, area_id, title, content,
              data_snapshot, order_index, is_ai_generated, version, created_by,
              updated_by, created_at, updated_at
         FROM assessment_report_sections WHERE 1 = 0`
    );
    await all(
      `SELECT id, report_id, section_id, version, title, content, created_by, created_at
         FROM assessment_report_section_history WHERE 1 = 0`
    );
    assessmentReportsSchemaReady = true;
  })();

  try {
    await ensureAssessmentReportsSchemaPromise;
  } catch (error) {
    ensureAssessmentReportsSchemaPromise = null;
    throw error;
  }
};

const mapTemplateSectionType = (tplTypeRaw: string | undefined, keyRaw?: string): SectionType => {
  const t = String(tplTypeRaw || '').toLowerCase();
  const k = String(keyRaw || '').toLowerCase();

  if (t === 'cover') return 'cover_page';
  if (t === 'summary' || k.includes('executive')) return 'executive_summary';
  if (t === 'methodology') return 'methodology';
  if (t === 'matrix') return 'maturity_overview';
  if (t === 'axis_analysis') return 'axis_detail';
  if (t === 'area_analysis') return 'area_detail';
  if (t === 'gap' || t === 'heatmap') return 'gap_analysis';
  if (t === 'initiatives') return 'initiatives';
  if (t === 'recommendations') return 'recommendations';
  if (t === 'action_plan' || k.includes('next')) return 'next_steps';
  if (t === 'roadmap') return 'roadmap';
  if (t === 'appendix') return 'appendix';
  if (t === 'list') return k.includes('strength') || k.includes('weak') ? 'gap_analysis' : 'custom';
  return 'custom';
};

const createDraftContent = (opts: {
  sectionType: SectionType;
  sectionTitle: string;
  assessmentName: string;
  assessmentType: string;
  assessmentStatus: string;
  axisId?: string | null;
}): string => {
  const { sectionType, sectionTitle, assessmentName, assessmentType, assessmentStatus, axisId } =
    opts;

  if (sectionType === 'cover_page') {
    return `# ${assessmentName}\n\n**Assessment type:** ${assessmentType}\n\n**Status:** ${assessmentStatus}\n\n---\n\n_Report template draft. Fill in client name, date, authors._\n`;
  }
  if (sectionType === 'executive_summary') {
    return `## Executive Summary\n\nThis first draft summarizes key findings from the assessment context and should be refined during review.\n\n- Current maturity: summarize observed baseline from completed answers and evidence.\n- Target maturity: define a realistic near-term target aligned with business goals.\n- Top gaps: list the most material capability gaps affecting outcomes.\n- Recommended priorities: rank actions by impact, urgency, and implementation feasibility.\n`;
  }
  if (sectionType === 'maturity_overview') {
    return `## Maturity Overview\n\n_This section will summarize maturity levels across axes and highlight key gaps._\n`;
  }
  if (sectionType === 'methodology') {
    return `## Methodology\n\nThis report is based on the assessment tool **${assessmentType}**.\n\n- Scope: document covered domains, teams, and process boundaries.\n- Evidence sources: reference workshops, interviews, system data, and uploaded materials.\n- Scoring approach: explain the scale used, weighting assumptions, and normalization rules.\n`;
  }
  if (sectionType === 'axis_detail') {
    return `## ${sectionTitle}\n\n_Axis ${axisId || '—'} analysis draft._\n\n- Current state: summarize observed operating reality with evidence.\n- Target state: define measurable target capabilities for this axis.\n- Key gaps: list the most important deltas between current and target state.\n- Recommended initiatives: propose actions with owner, horizon, and expected impact.\n`;
  }
  if (sectionType === 'recommendations') {
    return `## Recommendations\n\n- Recommendation 1: highest-impact action with clear owner and timeline.\n- Recommendation 2: dependency action needed to unblock execution risk.\n- Recommendation 3: enabling action to improve sustainability and governance.\n`;
  }
  if (sectionType === 'next_steps') {
    return `## Next Steps\n\n1. Validate findings with stakeholders\n2. Prioritize initiatives (impact vs effort)\n3. Assign owners and timelines\n`;
  }
  if (sectionType === 'appendix') {
    return `## Appendix\n\n- Raw notes\n- Source links\n- Supporting evidence\n`;
  }
  if (sectionType === 'gap_analysis') {
    return `## ${sectionTitle}\n\n- Strengths: capture capabilities that consistently deliver target outcomes.\n- Areas for improvement: capture capability gaps with direct business consequences.\n`;
  }

  return `## ${sectionTitle}\n\nThis draft section is generated from available context and should be refined with concrete evidence, decisions, and implementation detail during review.\n`;
};

/**
 * WRITE-TIME GUARD (finding O1 W7 — client-report absurdity guard).
 *
 * `assessment_reports.axis_data` MUST hold maturity LEVELS, never 0-100
 * percentages: DRD levels are 0..axis.levelCount (5 or 7 depending on the
 * axis — see `DRD_STRUCTURE`), SIRI/ADMA levels are 0..5. Downstream, the
 * report renderer computes `pct(level, maxLevel) = level/maxLevel*100` — a
 * stray percentage here (e.g. from a bad seed/fixture/import writing "60" or
 * "100" instead of a level) blows straight past 100% ("Cybersecurity 600%"),
 * which is exactly the kind of number Piotr will not sign off on for a client
 * report. Clamp every `{actual,target}` cell into its framework's valid range
 * right before persistence, and log loudly — this should never legitimately
 * trigger, so a hit here means the write path upstream is producing the wrong
 * scale and needs fixing at the source.
 */
const clampAxisDataEntries = (
  data: Record<string, any>,
  framework: 'DRD' | 'SIRI' | 'ADMA' | string
): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [key, entry] of Object.entries(data || {})) {
    if (key === '_framework' || !entry || typeof entry !== 'object') {
      out[key] = entry;
      continue;
    }
    let max = 5; // SIRI (0-5) and ADMA (1-5, treated 0-5) default.
    if (framework === 'DRD') {
      const axisId = Number(key);
      const axis = Number.isFinite(axisId) ? getAxisById(axisId) : undefined;
      max = axis?.levelCount ?? 7; // widest DRD axis scale as a safe fallback.
    }
    const clampField = (raw: unknown): number => {
      const n = Number(raw ?? 0);
      const value = Number.isFinite(n) ? n : 0;
      if (value < 0 || value > max) {
        logger.error(
          `[AxisDataGuard] axis_data write out of range — clamping ${framework} axis "${key}" ` +
            `value=${value} to [0,${max}]. axis_data must hold maturity LEVELS, never 0-100 ` +
            `percentages — check the write path (assessment answers / seed / import).`
        );
        return Math.max(0, Math.min(max, value));
      }
      return value;
    };
    out[key] = {
      ...entry,
      actual: clampField((entry as any).actual),
      target: clampField((entry as any).target),
    };
  }
  return out;
};

const computeAxisDataFromAssessment = (assessment: any): Record<string, any> => {
  const type = String(assessment?.assessment_type || assessment?.type || '').toUpperCase();
  const answers = assessment?.answers
    ? safeJsonParse<any>(assessment.answers, {})
    : assessment?.answers;

  const avg = (arr: number[]) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0);

  // ==========================================
  // DRD: 7 axes, areas like "1A", "1B", "2A", etc.
  // ==========================================
  if (type === 'DRD') {
    const drd = answers?.drd || {};
    const areas = drd?.areas || {};
    const axisBuckets: Record<string, { achieved: number[]; target: number[] }> = {};

    Object.entries<any>(areas).forEach(([areaId, s]) => {
      const axisId = String(areaId || '').slice(0, 1); // "1A" -> "1"
      if (!axisId || !/^\d$/.test(axisId)) return;
      if (!axisBuckets[axisId]) axisBuckets[axisId] = { achieved: [], target: [] };
      const a = Number(s?.achievedLevel || 0);
      const t = Number(s?.targetLevel || 0);
      if (a > 0) axisBuckets[axisId].achieved.push(a);
      if (t > 0) axisBuckets[axisId].target.push(t);
    });

    const out: Record<string, any> = {};
    for (const [axisId, bucket] of Object.entries(axisBuckets)) {
      out[axisId] = {
        actual: Number(avg(bucket.achieved).toFixed(2)),
        target: Number(avg(bucket.target).toFixed(2)),
      };
    }
    return clampAxisDataEntries(out, 'DRD');
  }

  // ==========================================
  // SIRI: 3 Building Blocks, 8 Dimensions, 16 Prioritisation Areas
  // ==========================================
  if (type === 'SIRI') {
    const siri = answers?.siri || {};
    const out: Record<string, any> = { _framework: 'SIRI' };

    // Building blocks (PROCESS, TECHNOLOGY, ORGANIZATION)
    const blocks = siri?.buildingBlocks || {};
    for (const [blockId, blockData] of Object.entries<any>(blocks)) {
      out[`block_${blockId}`] = {
        actual: Number(blockData?.current || blockData?.actual || 0),
        target: Number(blockData?.target || 0),
      };
    }

    // Dimensions (8 dimensions)
    const dimensions = siri?.dimensions || {};
    for (const [dimId, dimData] of Object.entries<any>(dimensions)) {
      out[`dim_${dimId}`] = {
        actual: Number(dimData?.current || dimData?.actual || 0),
        target: Number(dimData?.target || 0),
      };
    }

    // Prioritisation matrix (individual area scores)
    const matrix = siri?.prioritisationMatrix || {};
    for (const [areaId, score] of Object.entries<any>(matrix)) {
      if (typeof score === 'number') {
        out[`area_${areaId}`] = { actual: score, target: 0 };
      } else if (score && typeof score === 'object') {
        out[`area_${areaId}`] = {
          actual: Number(score?.current || score?.actual || 0),
          target: Number(score?.target || 0),
        };
      }
    }

    return clampAxisDataEntries(out, 'SIRI');
  }

  // ==========================================
  // ADMA: 5 Pillars, 12 Dimensions
  // ==========================================
  if (type === 'ADMA') {
    const adma = answers?.adma || {};
    const out: Record<string, any> = { _framework: 'ADMA' };

    // Pillars (strategy, smart_products, smart_operations, smart_supply, data_driven)
    const pillars = adma?.pillars || {};
    for (const [pillarId, pillarData] of Object.entries<any>(pillars)) {
      out[`pillar_${pillarId}`] = {
        actual: Number(pillarData?.current || pillarData?.actual || 0),
        target: Number(pillarData?.target || 0),
      };
    }

    // Dimensions (12 dimensions)
    const dimensions = adma?.dimensions || {};
    for (const [dimId, dimData] of Object.entries<any>(dimensions)) {
      out[`dim_${dimId}`] = {
        actual: Number(dimData?.current || dimData?.actual || 0),
        target: Number(dimData?.target || 0),
      };
    }

    return clampAxisDataEntries(out, 'ADMA');
  }

  // Unknown framework - return empty but try to parse any generic structure
  return {};
};

const ensureExportDir = async (): Promise<string> => {
  return exportsDir('assessment-reports');
};

const writePdfReport = async (report: any, filePath: string): Promise<void> => {
  const doc = new PDFDocument({ margin: 48 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(18).text(report.name || 'Assessment Report');
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#555555');
  doc.text(`Assessment: ${report.assessmentName || 'Assessment'}`);
  doc.text(`Status: ${(report.status || 'DRAFT').toUpperCase()}`);
  doc.text(`Created: ${report.created_at || report.createdAt || '-'}`);

  doc.moveDown();
  doc.fillColor('#000000').fontSize(13).text('Executive Summary');
  doc
    .fontSize(11)
    .text(report.executive_summary || report.executiveSummary || 'No summary available.');

  doc.moveDown();
  doc.fontSize(13).text('Key Findings');
  const detailed = safeJsonParse<DetailedAnalysis>(report.detailed_analysis, {});
  const keyFindings = detailed.keyFindings || [];
  if (keyFindings.length === 0) {
    doc.fontSize(11).text('None');
  } else {
    keyFindings.slice(0, 10).forEach((item: string, index: number) => {
      doc.fontSize(11).text(`${index + 1}. ${item}`);
    });
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
};

const writePptxReport = async (report: any, filePath: string): Promise<void> => {
  const pptx = new (PptxGenJS as any)();
  pptx.layout = 'LAYOUT_WIDE';

  const title = report.name || 'Assessment Report';
  const summary = report.executive_summary || report.executiveSummary || 'No summary available.';
  const detailed = safeJsonParse<DetailedAnalysis>(report.detailed_analysis, {});
  const keyFindings = detailed.keyFindings || [];
  const findingsText = keyFindings.length ? keyFindings.slice(0, 10).join('\n') : 'None';

  const titleSlide = pptx.addSlide();
  titleSlide.addText(title, {
    x: 0.6,
    y: 0.6,
    w: 12.0,
    h: 1.0,
    fontSize: 30,
    bold: true,
  });
  titleSlide.addText(summary, {
    x: 0.6,
    y: 1.8,
    w: 12.0,
    h: 3.6,
    fontSize: 16,
    color: '555555',
  });

  const findingsSlide = pptx.addSlide();
  findingsSlide.addText('Key Findings', {
    x: 0.6,
    y: 0.6,
    w: 12.0,
    h: 0.8,
    fontSize: 22,
    bold: true,
  });
  findingsSlide.addText(findingsText, {
    x: 0.6,
    y: 1.6,
    w: 12.0,
    h: 4.5,
    fontSize: 14,
    color: '444444',
  });

  await pptx.writeFile({ fileName: filePath });
};

// =============================================================================
// REPORT LIST
// =============================================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const assessmentId = req.query?.assessmentId ? String(req.query.assessmentId) : null;
    const projectId = req.query?.projectId ? String(req.query.projectId) : null;
    const statusRaw = req.query?.status ? String(req.query.status) : null;
    const statuses = statusRaw
      ? statusRaw
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : [];
    const params: (string | number)[] = [organizationId];

    // Normalize to a UI-friendly shape for both hub + per-assessment views.
    let sql = `
      SELECT 
        r.id,
        r.assessment_id as "assessmentId",
        r.project_id as "projectId",
        r.name as name,
        r.status as status,
        r.template_id as "templateId",
        r.builder_report_id as "builderReportId",
        r.created_by as "createdBy",
        r.created_at as "createdAt",
        r.updated_at as "updatedAt",
        a.name as "assessmentName",
        a.assessment_type as "assessmentType"
      FROM assessment_reports r
      LEFT JOIN assessments a ON r.assessment_id = a.id
      WHERE r.organization_id = ?
    `;
    if (assessmentId) {
      sql += ` AND r.assessment_id = ?`;
      params.push(assessmentId);
    }
    if (projectId) {
      sql += ` AND r.project_id = ?`;
      params.push(projectId);
    }
    if (statuses.length === 1) {
      sql += ` AND UPPER(COALESCE(r.status,'DRAFT')) = ?`;
      params.push(statuses[0]);
    } else if (statuses.length > 1) {
      const placeholders = statuses.map(() => '?').join(', ');
      sql += ` AND UPPER(COALESCE(r.status,'DRAFT')) IN (${placeholders})`;
      params.push(...statuses);
    }
    sql += ` ORDER BY r.updated_at DESC`;

    const reports = await new Promise<any[]>((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json({
      reports: (reports || []).map((r) => ({
        id: r.id,
        name: r.name || `Report - ${r.assessmentName || 'Assessment'}`,
        assessmentId: r.assessmentId,
        assessmentName: r.assessmentName || 'Assessment',
        assessmentType: r.assessmentType || null,
        projectId: r.projectId || null,
        status: String(r.status || 'DRAFT').toUpperCase(),
        templateId: r.templateId || null,
        builderReportId: r.builderReportId || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: r.createdBy || 'system',
      })),
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error listing reports', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać raportów',
      code: 'ASSESSMENT_REPORTS_FETCH_REPORTS_FAILED',
    });
  }
});

// =============================================================================
// TEMPLATE LIST (reuses report builder templates)
// =============================================================================
router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const sourceType = String(req.query?.sourceType || 'ASSESSMENT').toUpperCase();
    if (sourceType !== 'ASSESSMENT') {
      return res.status(400).json({ error: 'Unsupported sourceType', sourceType });
    }

    const templates = await all<any>(
      `SELECT id, name, description, source_type, report_type, is_system, is_default, created_at
       FROM report_builder_templates
       WHERE source_type = 'ASSESSMENT'
         AND (organization_id IS NULL OR organization_id = ?)
       ORDER BY is_default DESC, is_system DESC, created_at DESC
       LIMIT 200`,
      [organizationId]
    ).catch(() => []);

    return res.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        sourceType: t.source_type,
        reportType: t.report_type,
        isSystem: Boolean(t.is_system),
        isDefault: Boolean(t.is_default),
        createdAt: t.created_at,
      })),
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error listing templates', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać szablonów',
      code: 'ASSESSMENT_REPORTS_FETCH_TEMPLATES_FAILED',
    });
  }
});

// =============================================================================
// REPORT → INITIATIVES (Report-only generation run)
// =============================================================================
/**
 * POST /api/assessment-reports/:reportId/generate-initiatives
 * Creates an enterprise generation run in REPORT_ONLY mode.
 *
 * Body:
 * - methodologyId: string
 * - requestedCount: number (1..200)
 * - batchSize?: number (1..7, default 7)
 * - includeChatContext?: boolean
 * - templateId?: string
 * - consultantBrief?: string
 */
router.post('/:reportId/generate-initiatives', async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params as any;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      methodologyId,
      requestedCount,
      batchSize,
      includeChatContext,
      templateId,
      consultantBrief,
    } = req.body || {};

    if (!methodologyId || typeof methodologyId !== 'string') {
      return res.status(400).json({ error: 'methodologyId is required' });
    }
    const countNum = Number(requestedCount);
    if (!Number.isFinite(countNum) || countNum < 1 || countNum > 200) {
      return res.status(400).json({ error: 'requestedCount must be between 1 and 200' });
    }
    const bs = Math.max(1, Math.min(7, Number(batchSize || 7)));

    // Resolve assessment context and ensure the report belongs to this org via assessments
    const reportRow = await queryHelpers.queryOne<any>(
      `SELECT r.*, a.organization_id as "orgId", a.status as "assessmentStatus", a.id as "assessmentId"
       FROM assessment_reports r
       JOIN assessments a ON a.id = r.assessment_id
       WHERE r.id = ? AND a.organization_id = ?
       LIMIT 1`,
      [String(reportId), String(organizationId)]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const assessmentId = String(reportRow.assessmentId || reportRow.assessment_id);
    const assessmentStatus = String(reportRow.assessmentStatus || '').toUpperCase();
    if (assessmentStatus !== 'APPROVED') {
      return res.status(409).json({
        error: 'Assessment must be APPROVED to generate initiatives from report',
        assessmentId,
        assessmentStatus,
      });
    }

    // If report has a status column, require it to be APPROVED for quality/safety.
    const reportStatusRaw = reportRow.status ? String(reportRow.status).toUpperCase() : '';
    if (reportStatusRaw && reportStatusRaw !== 'APPROVED') {
      return res
        .status(409)
        .json({ error: 'Report must be APPROVED first', reportStatus: reportStatusRaw });
    }

    // RBAC: user must have canGenerateInitiatives on this assessment
    const roleInfo = await AssessmentPermissionService.getUserRole(
      String(assessmentId),
      String(userId),
      String(organizationId)
    );
    if (!roleInfo?.permissions?.canGenerateInitiatives) {
      return res
        .status(403)
        .json({ error: 'Permission denied', required: 'canGenerateInitiatives' });
    }

    const run = await AssessmentInitiativeGenerationRunService.createAndStart({
      assessmentId,
      organizationId: String(organizationId),
      userId: String(userId),
      mode: 'REPORT_ONLY',
      methodologyId: String(methodologyId),
      requestedCount: countNum,
      batchSize: bs,
      includeChatContext: includeChatContext !== undefined ? Boolean(includeChatContext) : true,
      reportId: String(reportId),
      templateId: templateId ? String(templateId) : null,
      consultantBrief: consultantBrief ? String(consultantBrief) : null,
      idempotencyKey: req.get('Idempotency-Key') || null,
    } as any);

    return res.status(202).json({ runId: run.runId, assessmentId });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error creating report-only initiatives run', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się rozpocząć generowania',
      code: 'ASSESSMENT_REPORTS_START_GENERATION_FAILED',
    });
  }
});

// =============================================================================
// CREATE REPORT
// =============================================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'user-default';
    const { assessmentId, name: rawName, templateId } = req.body || {};
    // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
    // middleware escaped, before storing.
    const name = typeof rawName === 'string' ? decodeHtmlEntities(rawName) : rawName;

    if (!assessmentId) {
      return res.status(400).json({ error: 'assessmentId is required' });
    }

    const assessment = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT id, name, organization_id, project_id, assessment_type, status, answers_json as answers
         FROM assessments
         WHERE id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const id = `report-${uuidv4()}`;
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessment_reports (
          id, assessment_id, organization_id, project_id, name, status, template_id, builder_report_id, axis_data,
          generation_params, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          id,
          assessmentId,
          organizationId,
          assessment.project_id || null,
          name ? String(name) : `Report - ${assessment.name || 'Assessment'}`,
          'DRAFT',
          templateId ? String(templateId) : null,
          null,
          JSON.stringify(computeAxisDataFromAssessment(assessment)),
          JSON.stringify({ source: 'manual', templateId: templateId || null }),
          userId,
          userId,
        ],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // If assessment is approved, also create a linked Report Builder report (for review/comments/export).
    let builderReportId: string | null = null;
    try {
      const assessmentStatus = String(assessment.status || '').toUpperCase();
      if (assessmentStatus === 'APPROVED') {
        const rb = await ReportBuilderService.createReport({
          organizationId,
          sourceType: 'ASSESSMENT',
          sourceId: String(assessmentId),
          title: name ? String(name) : `Report - ${assessment.name || 'Assessment'}`,
          description: `Assessment report for "${assessment.name || 'Assessment'}"`,
          createdBy: userId,
          templateId: templateId ? String(templateId) : undefined,
        });
        builderReportId = rb?.report?.id ? String(rb.report.id) : null;
        if (builderReportId) {
          const projected = mapReportBuilderStatusToAssessmentReportStatus(
            String(rb.report.status || 'CONFIGURING')
          );
          await run(
            `UPDATE assessment_reports
             SET builder_report_id = ?, status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND organization_id = ?`,
            [builderReportId, projected, userId, id, organizationId]
          );
        }
      }
    } catch (syncErr: any) {
      logger.warn('[AssessmentReports] Failed to create linked report builder report', {
        reportId: id,
        message: syncErr?.message,
      });
    }

    res.status(201).json({ id, builderReportId });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error creating report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się utworzyć raportu',
      code: 'ASSESSMENT_REPORTS_CREATE_REPORT_FAILED',
    });
  }
});

// =============================================================================
// GET FULL REPORT (report + sections)
// =============================================================================
router.get('/:reportId/full', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { reportId } = req.params;

    const reportRow = await get<any>(
      `SELECT r.*, a.name as "assessmentName", a.assessment_type as "assessmentType", a.status as "assessmentStatus"
       FROM assessment_reports r
       LEFT JOIN assessments a ON a.id = r.assessment_id
       WHERE r.id = ? AND r.organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const sections = await all<any>(
      `SELECT *
       FROM assessment_report_sections
       WHERE report_id = ?
       ORDER BY order_index ASC, created_at ASC`,
      [reportId]
    );

    const axisData = safeJsonParse<Record<string, any>>(reportRow.axis_data, {});

    const mappedSections = (sections || []).map((s: any) => ({
      id: s.id,
      reportId: s.report_id,
      sectionType: s.section_type,
      axisId: s.axis_id || undefined,
      areaId: s.area_id || undefined,
      title: s.title,
      content: s.content || '',
      dataSnapshot: safeJsonParse(s.data_snapshot, {}),
      orderIndex: Number(s.order_index || 0),
      isAiGenerated: Boolean(s.is_ai_generated),
      version: Number(s.version || 1),
      lastEditedBy: s.updated_by || undefined,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    // Calculate progress based on sections with content
    const totalSections = mappedSections.length;
    const sectionsWithContent = mappedSections.filter(
      (s: any) => s.content && s.content.trim().length > 10
    ).length;
    const progress =
      totalSections > 0 ? Math.round((sectionsWithContent / totalSections) * 100) : 0;
    const status = String(reportRow.status || 'DRAFT').toUpperCase();
    const isComplete =
      status === 'FINAL' ||
      status === 'PENDING_APPROVAL' ||
      status === 'APPROVED' ||
      status === 'UTILIZED';

    return res.json({
      id: reportRow.id,
      name: reportRow.name || `Report - ${reportRow.assessmentName || 'Assessment'}`,
      status,
      builderReportId: reportRow.builder_report_id || null,
      assessmentId: reportRow.assessment_id,
      assessmentName: reportRow.assessmentName || 'Assessment',
      assessmentType: reportRow.assessmentType || 'DRD',
      axisData,
      content: {},
      sections: mappedSections,
      progress,
      isComplete,
      templateId: reportRow.template_id || null,
      createdAt: reportRow.created_at,
      updatedAt: reportRow.updated_at,
      createdBy: reportRow.created_by || null,
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error fetching full report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać raportu',
      code: 'ASSESSMENT_REPORTS_FETCH_REPORT_FAILED',
    });
  }
});

// =============================================================================
// PUBLISHING-GRADE DRD CLIENT REPORT (HTML → print → PDF), AI narration live
// =============================================================================
/**
 * GET /api/assessment-reports/:reportId/drd-report
 * Generate the standalone, print-CSS DRD client report as HTML. The executive
 * summary + chapter/gap narratives are authored by the fail-safe LLM narrator
 * (`llmService` injected server-side); numbers stay engine-exact. On any LLM
 * failure the narrator falls back to the deterministic stub — the report always
 * renders. Returns `text/html` by default (open in a window and print → PDF);
 * pass `?format=json` to get `{ html, narrative }`.
 */
router.get('/:reportId/drd-report', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { reportId } = req.params;
    const format = String((req.query.format as string) || 'html').toLowerCase();

    const reportRow = await get<any>(
      `SELECT r.*, a.name as "assessmentName", a.assessment_type as "assessmentType"
       FROM assessment_reports r
       LEFT JOIN assessments a ON a.id = r.assessment_id
       WHERE r.id = ? AND r.organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const axisData = safeJsonParse<Record<string, { actual?: number; target?: number }>>(
      reportRow.axis_data,
      {}
    );

    // Resolve the client/organization name for the report cover.
    let organizationName = 'Organizacja';
    try {
      const orgRow = await get<any>(`SELECT name FROM organizations WHERE id = ?`, [
        organizationId,
      ]);
      if (orgRow?.name) organizationName = orgRow.name;
    } catch {
      /* non-fatal — fall back to default label */
    }

    const language: 'pl' | 'en' =
      String((req.query.lang as string) || reportRow.language || 'pl').toLowerCase() === 'en'
        ? 'en'
        : 'pl';

    // Wire the real LLM narrator (fail-safe). If the service is unavailable the
    // narrator is simply omitted and the deterministic stub authors the prose.
    let llm: any = null;
    try {
      const mod = await import('../services/ai/llmService.js');
      llm = mod.llmService || mod.default || null;
    } catch {
      logger.warn(
        '[AssessmentReports] LLM service unavailable for DRD report — using deterministic narrator'
      );
    }

    // Wire RAG grounding on the "Digital Pathfinder" book methodology KB
    // (F14 / §7 KONCEPT_CONTENT_ENGINES, decyzja D-E). Fail-open by design: if
    // the grounding module is unavailable the report still generates, just
    // without book citations — same posture as the LLM wiring above.
    let grounding: any = undefined;
    try {
      const { buildDrdGroundingProvider } =
        await import('../services/report/drdReportGrounding.js');
      grounding = buildDrdGroundingProvider({
        organizationId,
        language,
        logger: { warn: (msg: string, meta?: unknown) => logger.warn(`[DRDReport] ${msg}`, meta) },
      });
    } catch {
      logger.warn(
        '[AssessmentReports] Grounding provider unavailable for DRD report — no book citations'
      );
    }

    const { buildDrdReportHtmlServer } = await import('../services/report/drdReportService.js');
    const { html, narrative, model } = await buildDrdReportHtmlServer({
      axisData,
      meta: {
        organizationName,
        language,
        assessmentName: reportRow.assessmentName || undefined,
        reportDate: reportRow.created_at || undefined,
      },
      llm: llm || undefined,
      grounding,
      logger: {
        warn: (msg: string, meta?: unknown) => logger.warn(`[DRDReport] ${msg}`, meta),
      },
    });

    // CONCLUSION_LAYER bridge: persist the report's executive conclusion as a
    // Conclusion candidate. Fire-and-forget + fail-safe — a Conclusions-layer
    // failure must never break report generation.
    try {
      const { safePersistDrdReportConclusion } =
        await import('../services/conclusions/reportConclusionBridge.js');
      void safePersistDrdReportConclusion(
        {
          organizationId,
          actorUserId: String(req.user?.id || 'system'),
          model,
          source: {
            reportId: String(reportId),
            reportTitle: reportRow.name || reportRow.assessmentName || null,
            projectId: reportRow.project_id || null,
          },
        },
        { logger: { warn: (msg: string, meta?: unknown) => logger.warn(msg, meta) } }
      );
    } catch {
      /* bridge module unavailable — report generation continues */
    }

    // EVIDENCE LAYER bridge (H1 Harvey-gap, §3 KONCEPT_RDZEN): persist the
    // report's full lineage (engine facts + book citations + assumptions +
    // deterministic-fallback flags) as an EvidenceEnvelope so "Źródła i
    // założenia" can render it. Fire-and-forget + fail-safe.
    try {
      const { safePersistDrdReportEvidence } =
        await import('../services/evidence/drdReportEvidenceBridge.js');
      void safePersistDrdReportEvidence(
        {
          model,
          source: {
            reportId: String(reportId),
            organizationId,
            createdBy: req.user?.id ? String(req.user.id) : null,
          },
        },
        { logger: { warn: (msg: string, meta?: unknown) => logger.warn(msg, meta) } }
      );
    } catch {
      /* bridge module unavailable — report generation continues */
    }

    if (format === 'json') {
      return res.json({ html, narrative });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err: any) {
    logger.error('[AssessmentReports] Error generating DRD report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować raportu DRD',
      code: 'ASSESSMENT_REPORTS_GENERATE_DRD_REPORT_FAILED',
    });
  }
});

// =============================================================================
// GENERATE / REGENERATE REPORT SECTIONS FROM TEMPLATE
// =============================================================================
router.post('/:reportId/generate', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'user-default';
    const { reportId } = req.params;
    const { templateId, language } = req.body || {};

    const reportRow = await get<any>(
      `SELECT r.*, a.name as "assessmentName", a.assessment_type as "assessmentType", a.status as "assessmentStatus"
       FROM assessment_reports r
       LEFT JOIN assessments a ON a.id = r.assessment_id
       WHERE r.id = ? AND r.organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const resolvedTemplateId = String(templateId || reportRow.template_id || '');
    if (!resolvedTemplateId) {
      return res.status(400).json({ error: 'templateId is required (or set on report)' });
    }

    const template = await get<any>(
      `SELECT id, name, sections_json
       FROM report_builder_templates
       WHERE id = ?
         AND (organization_id IS NULL OR organization_id = ?)`,
      [resolvedTemplateId, organizationId]
    );
    if (!template) {
      return res.status(404).json({ error: 'Template not found', templateId: resolvedTemplateId });
    }

    const templateSections = safeJsonParse<TemplateSectionSpec[]>(template.sections_json, []);
    if (!Array.isArray(templateSections) || templateSections.length === 0) {
      return res.status(400).json({ error: 'Template has no sections' });
    }

    const axisData = safeJsonParse<Record<string, any>>(reportRow.axis_data, {});

    // Load assessment answers for context
    let assessmentAnswers: Record<string, any> = {};
    try {
      const assessmentRow = await get<any>(
        `SELECT answers_json as answers FROM assessments WHERE id = ?`,
        [reportRow.assessment_id]
      );
      assessmentAnswers = safeJsonParse(assessmentRow?.answers, {});
    } catch {
      /* ignore */
    }

    // Try to load LLM service
    let llmService: any = null;
    try {
      const mod = await import('../services/ai/llmService.js');
      llmService = mod.llmService || mod.default;
    } catch {
      logger.warn('[AssessmentReports] LLM service not available for report generation');
    }

    if (!llmService) {
      return notConfigured(res);
    }

    const lang = language || 'pl';
    const langLabel = lang === 'pl' ? 'Polish' : 'English';
    const assessmentContext = `Assessment: "${reportRow.assessmentName}" (${reportRow.assessmentType || 'DRD'}), Status: ${reportRow.assessmentStatus || 'IN_PROGRESS'}`;
    const axisDataSummary =
      Object.keys(axisData).length > 0
        ? `\nAxis data summary: ${JSON.stringify(axisData).slice(0, 2000)}`
        : '';
    const answersSummary =
      Object.keys(assessmentAnswers).length > 0
        ? `\nAssessment answers summary: ${JSON.stringify(assessmentAnswers).slice(0, 3000)}`
        : '';

    const pendingInserts: Array<{
      sectionId: string;
      sectionType: string;
      axisId: string | null;
      title: string;
      content: string;
      isAiGenerated: number;
      orderIndex: number;
      dataSnapshot: unknown;
    }> = [];

    for (const spec of templateSections) {
      const sectionId = `sec-${uuidv4()}`;
      const sectionType = mapTemplateSectionType(spec.type, spec.key);
      const title = String(spec.title || spec.key || 'Section');
      const orderIndex = Number(spec.order ?? 0);
      const axisId = spec.repeatFor === 'axis' ? String(spec.repeatKey || '') : null;

      const systemPrompt = `You are a professional consulting report writer specializing in digital maturity assessments.
Write in ${langLabel}. Use Markdown formatting. Be professional, insightful, and data-driven.
Do NOT include placeholder text or "TBD" markers. Generate real, professional content.`;

      const userPrompt = `Generate the "${title}" section (type: ${sectionType}) for a digital maturity assessment report.
${assessmentContext}${axisDataSummary}${answersSummary}
${axisId ? `\nThis section focuses on axis: ${axisId}` : ''}

Requirements:
- Section type: ${sectionType}
- Length: ${spec.defaultLength || 'medium'} (${spec.defaultLength === 'short' ? '200-400' : spec.defaultLength === 'long' ? '800-1200' : '400-700'} words)
- Style: ${spec.defaultLanguage || 'business'} (appropriate for ${spec.defaultLanguage === 'technical' ? 'IT/engineering teams' : 'business executives and management'})
- Format: Professional Markdown with headers, bullet points, and structured content
- Write real, actionable content based on the assessment data provided`;

      const result = await llmService.call({
        type: 'text',
        modelConfig: { id: 'standard' },
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens:
          spec.defaultLength === 'short' ? 1024 : spec.defaultLength === 'long' ? 3072 : 2048,
        temperature: 0.7,
      });

      const aiContent = String(result?.content || '');
      if (aiContent.length < 50) {
        return notConfigured(res);
      }

      const dataSnapshot = {
        template: {
          templateId: resolvedTemplateId,
          templateName: template.name,
          sectionKey: spec.key || null,
          sectionTemplateType: spec.type || null,
          defaultLength: spec.defaultLength || null,
          defaultLanguage: spec.defaultLanguage || null,
        },
        assessment: {
          id: reportRow.assessment_id,
          name: reportRow.assessmentName,
          type: reportRow.assessmentType,
          status: reportRow.assessmentStatus,
        },
        axisData,
        language: lang,
      };

      pendingInserts.push({
        sectionId,
        sectionType,
        axisId,
        title,
        content: aiContent,
        isAiGenerated: 1,
        orderIndex,
        dataSnapshot,
      });
    }

    await run('BEGIN');
    try {
      // Wipe and rebuild sections
      await run(`DELETE FROM assessment_report_sections WHERE report_id = ?`, [reportId]);

      for (const row of pendingInserts) {
        await run(
          `INSERT INTO assessment_report_sections (
            id, report_id, section_type, axis_id, area_id, title, content, data_snapshot,
            order_index, is_ai_generated, version, created_by, updated_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            row.sectionId,
            reportId,
            row.sectionType,
            row.axisId,
            null,
            row.title,
            row.content,
            JSON.stringify(row.dataSnapshot),
            row.orderIndex,
            row.isAiGenerated,
            1,
            userId,
            userId,
          ]
        );
      }

      await run(
        `UPDATE assessment_reports
         SET template_id = ?, generation_params = ?, status = 'FINAL', updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [
          resolvedTemplateId,
          JSON.stringify({ templateId: resolvedTemplateId, language: lang }),
          userId,
          reportId,
          organizationId,
        ]
      );

      await run('COMMIT');
    } catch (txErr) {
      await run('ROLLBACK');
      throw txErr;
    }

    return res.json({ success: true, reportId, templateId: resolvedTemplateId });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error generating report', {
      err,
      correlationId: (res.req as any)?.correlationId,
    });
    return notConfigured(res, { details: { code: 'ASSESSMENT_REPORTS_GENERATE_FAILED' } });
  }
});

// =============================================================================
// SECTIONS CRUD
// =============================================================================
router.get('/:reportId/sections', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { reportId } = req.params;

    const reportRow = await get<any>(
      `SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const rows = await all<any>(
      `SELECT * FROM assessment_report_sections WHERE report_id = ? ORDER BY order_index ASC, created_at ASC`,
      [reportId]
    );

    return res.json({
      sections: rows.map((s: any) => ({
        id: s.id,
        reportId: s.report_id,
        sectionType: s.section_type,
        axisId: s.axis_id || undefined,
        areaId: s.area_id || undefined,
        title: s.title,
        content: s.content || '',
        dataSnapshot: safeJsonParse(s.data_snapshot, {}),
        orderIndex: Number(s.order_index || 0),
        isAiGenerated: Boolean(s.is_ai_generated),
        version: Number(s.version || 1),
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error listing sections', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać sekcji',
      code: 'ASSESSMENT_REPORTS_FETCH_SECTIONS_FAILED',
    });
  }
});

router.post('/:reportId/sections', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'user-default';
    const { reportId } = req.params;
    const {
      sectionType,
      axisId,
      areaId,
      title: rawTitle,
      content: rawContent,
      orderIndex,
    } = req.body || {};
    // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
    // middleware escaped, before storing.
    const title = typeof rawTitle === 'string' ? decodeHtmlEntities(rawTitle) : rawTitle;
    const content = typeof rawContent === 'string' ? decodeHtmlEntities(rawContent) : rawContent;

    const reportRow = await get<any>(
      `SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const id = `sec-${uuidv4()}`;
    await run(
      `INSERT INTO assessment_report_sections (
        id, report_id, section_type, axis_id, area_id, title, content, data_snapshot,
        order_index, is_ai_generated, version, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        reportId,
        String(sectionType || 'custom'),
        axisId ? String(axisId) : null,
        areaId ? String(areaId) : null,
        String(title || 'New section'),
        content ? String(content) : '',
        JSON.stringify({}),
        Number.isFinite(Number(orderIndex)) ? Number(orderIndex) : 0,
        0,
        1,
        userId,
        userId,
      ]
    );

    return res.status(201).json({
      section: {
        id,
        reportId,
        sectionType: String(sectionType || 'custom'),
        axisId: axisId || undefined,
        areaId: areaId || undefined,
        title: String(title || 'New section'),
        content: content ? String(content) : '',
        dataSnapshot: {},
        orderIndex: Number.isFinite(Number(orderIndex)) ? Number(orderIndex) : 0,
        isAiGenerated: false,
        version: 1,
      },
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error creating section', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się utworzyć sekcji',
      code: 'ASSESSMENT_REPORTS_CREATE_SECTION_FAILED',
    });
  }
});

router.put('/:reportId/sections/:sectionId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'user-default';
    const { reportId, sectionId } = req.params;
    const { content: rawContent, title: rawTitle, saveHistory } = req.body || {};
    // T5 (Z139 follow-up): decode HTML entities before storing — see POST /sections.
    const title = typeof rawTitle === 'string' ? decodeHtmlEntities(rawTitle) : rawTitle;
    const content = typeof rawContent === 'string' ? decodeHtmlEntities(rawContent) : rawContent;

    const reportRow = await get<any>(
      `SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const sectionRow = await get<any>(
      `SELECT * FROM assessment_report_sections WHERE id = ? AND report_id = ?`,
      [sectionId, reportId]
    );
    if (!sectionRow) return res.status(404).json({ error: 'Section not found' });

    const nextVersion = Number(sectionRow.version || 1) + 1;

    if (saveHistory) {
      await run(
        `INSERT INTO assessment_report_section_history (
          id, report_id, section_id, version, title, content, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          `hist-${uuidv4()}`,
          reportId,
          sectionId,
          Number(sectionRow.version || 1),
          sectionRow.title || null,
          sectionRow.content || null,
          userId,
        ]
      );
    }

    await run(
      `UPDATE assessment_report_sections
       SET title = ?, content = ?, is_ai_generated = 0, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND report_id = ?`,
      [
        title !== undefined ? String(title) : String(sectionRow.title || ''),
        content !== undefined ? String(content) : String(sectionRow.content || ''),
        nextVersion,
        userId,
        sectionId,
        reportId,
      ]
    );

    return res.json({ success: true, version: nextVersion, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error updating section', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zaktualizować sekcji',
      code: 'ASSESSMENT_REPORTS_UPDATE_SECTION_FAILED',
    });
  }
});

router.delete('/:reportId/sections/:sectionId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { reportId, sectionId } = req.params;

    const reportRow = await get<any>(
      `SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    await run(`DELETE FROM assessment_report_sections WHERE id = ? AND report_id = ?`, [
      sectionId,
      reportId,
    ]);

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error deleting section', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się usunąć sekcji',
      code: 'ASSESSMENT_REPORTS_DELETE_SECTION_FAILED',
    });
  }
});

router.put('/:reportId/sections/reorder', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'user-default';
    const { reportId } = req.params;
    const { sectionOrder } = req.body || {};
    if (!Array.isArray(sectionOrder)) {
      return res.status(400).json({ error: 'sectionOrder must be an array' });
    }

    const reportRow = await get<any>(
      `SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    for (const item of sectionOrder) {
      if (!item?.id) continue;
      await run(
        `UPDATE assessment_report_sections
         SET order_index = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND report_id = ?`,
        [Number(item.orderIndex || 0), userId, String(item.id), reportId]
      );
    }

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error reordering sections', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zmienić kolejności sekcji',
      code: 'ASSESSMENT_REPORTS_REORDER_SECTIONS_FAILED',
    });
  }
});

router.post('/:reportId/sections/:sectionId/ai', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'user-default';
    const { reportId, sectionId } = req.params;
    const { action, language, customPrompt } = req.body || {};

    const reportRow = await get<any>(
      `SELECT r.*, a.name as "assessmentName", a.assessment_type as "assessmentType"
       FROM assessment_reports r
       LEFT JOIN assessments a ON a.id = r.assessment_id
       WHERE r.id = ? AND r.organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const sectionRow = await get<any>(
      `SELECT * FROM assessment_report_sections WHERE id = ? AND report_id = ?`,
      [sectionId, reportId]
    );
    if (!sectionRow) return res.status(404).json({ error: 'Section not found' });

    const current = String(sectionRow.content || '');
    const act = String(action || '').toLowerCase();
    let next = current;
    let attempted = false;

    // Try to use LLM service for AI actions
    let llmService: any = null;
    try {
      const mod = await import('../services/ai/llmService.js');
      llmService = mod.llmService || mod.default;
    } catch {
      logger.warn('[AssessmentReports] LLM service not available for AI action');
    }

    if (!llmService) {
      return notConfigured(res);
    }

    const sectionContext = `Section: "${sectionRow.title}" (${sectionRow.section_type})\nAssessment: ${reportRow.assessmentName || 'Assessment'} (${reportRow.assessmentType || 'DRD'})`;

    if (llmService) {
      const aiPrompts: Record<string, { system: string; user: string }> = {
        summarize: {
          system:
            'You are a professional report editor. Summarize the given section content concisely while preserving key insights and data. Output in Markdown format.',
          user: `${sectionContext}\n\nPlease summarize the following section content into a concise version (about 30-40% of original length):\n\n${current}`,
        },
        expand: {
          system:
            'You are a professional consulting report writer. Expand the given section with more detail, examples, metrics, and actionable insights. Output in Markdown format.',
          user: `${sectionContext}\n\nPlease expand the following section with more detail, real-world examples, relevant metrics, and deeper analysis:\n\n${current}`,
        },
        regenerate: {
          system:
            'You are a professional consulting report writer specializing in digital maturity assessments. Generate a comprehensive section for the report. Output in Markdown format.',
          user: `${sectionContext}\n\nPlease regenerate this section from scratch. Create professional, insightful content appropriate for a consulting report. Use the section type and title as guidance:\n\nTitle: ${sectionRow.title}\nType: ${sectionRow.section_type}`,
        },
        improve: {
          system:
            'You are a professional editor. Improve the clarity, structure, tone and overall quality of the given report section. Fix any grammatical issues and enhance readability. Output in Markdown format.',
          user: `${sectionContext}\n\nPlease improve the following section for better clarity, structure, and professional tone:\n\n${current}`,
        },
        translate: {
          system: `You are a professional translator. Translate the following content to ${language === 'en' ? 'English' : language === 'pl' ? 'Polish' : language || 'English'}. Preserve all formatting, structure, and Markdown syntax. Maintain professional consulting tone.`,
          user: `Translate the following report section:\n\n${current}`,
        },
      };

      const prompts = customPrompt
        ? {
            system:
              'You are a professional consulting report writer. Follow the user instructions precisely. Output in Markdown format.',
            user: `${sectionContext}\n\nInstruction: ${customPrompt}\n\nCurrent content:\n${current}`,
          }
        : aiPrompts[act];

      if (prompts) {
        try {
          attempted = true;
          const result = await llmService.call({
            type: 'text',
            modelConfig: { id: 'standard' },
            systemPrompt: prompts.system,
            messages: [{ role: 'user', content: prompts.user }],
            maxTokens: 4096,
            temperature: 0.7,
          });
          next = String(result?.content || current);
          if (next.length < 20) {
            next = current;
          }
        } catch (err: any) {
          attempted = true;
          logger.error('[AssessmentReports] LLM AI action failed:', err?.message);
        }
      }
    }

    if (
      !customPrompt &&
      !['summarize', 'expand', 'regenerate', 'improve', 'translate'].includes(act)
    ) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (attempted && next === current) {
      return notConfigured(res);
    }

    const nextVersion = Number(sectionRow.version || 1) + 1;
    await run(
      `UPDATE assessment_report_sections
       SET content = ?, is_ai_generated = 1, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND report_id = ?`,
      [next, nextVersion, userId, sectionId, reportId]
    );

    return res.json({ success: true, content: next, version: nextVersion });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error AI action', {
      err,
      correlationId: (res.req as any)?.correlationId,
    });
    return notConfigured(res, { details: { code: 'ASSESSMENT_REPORTS_AI_ACTION_FAILED' } });
  }
});

router.get('/:reportId/sections/:sectionId/history', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { reportId, sectionId } = req.params;

    const reportRow = await get<any>(
      `SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const rows = await all<any>(
      `SELECT id, version, title, content, created_by as "createdBy", created_at as "createdAt"
       FROM assessment_report_section_history
       WHERE report_id = ? AND section_id = ?
       ORDER BY version DESC
       LIMIT 50`,
      [reportId, sectionId]
    );
    return res.json({ history: rows });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error fetching history', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać historii',
      code: 'ASSESSMENT_REPORTS_FETCH_HISTORY_FAILED',
    });
  }
});

router.post('/:reportId/ai-edit', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'system';
    const { reportId } = req.params;
    const { sectionId, instruction, content } = req.body || {};

    if (!sectionId || !instruction) {
      return res.status(400).json({ error: 'sectionId and instruction are required' });
    }

    // Verify report exists
    const reportRow = await get<any>(
      `SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    // Get section
    const sectionRow = await get<any>(
      `SELECT id, title, content, version, section_type FROM assessment_report_sections WHERE id = ? AND report_id = ?`,
      [sectionId, reportId]
    );
    if (!sectionRow) return res.status(404).json({ error: 'Section not found' });

    const currentContent = content || sectionRow.content || '';

    // Try LLM
    let llmService: any = null;
    try {
      const mod = await import('../services/ai/llmService.js');
      llmService = mod.llmService || mod.default;
    } catch {
      // LLM not available
    }

    if (!llmService) {
      return notConfigured(res);
    }

    let editedContent = currentContent;
    try {
      const result = await llmService.call({
        type: 'text',
        modelConfig: { id: 'standard' },
        systemPrompt:
          'You are a professional consulting report editor. Apply the user instruction to the provided content. Output only the edited content in Markdown format. Do not add explanations.',
        messages: [
          {
            role: 'user',
            content: `Section: "${sectionRow.title}"\n\nInstruction: ${instruction}\n\nContent:\n${currentContent}`,
          },
        ],
        maxTokens: 4096,
        temperature: 0.7,
      });

      editedContent = String(result?.content || currentContent);
      if (editedContent.length < 20) {
        return notConfigured(res);
      }
    } catch (callErr: any) {
      logger.error('[AssessmentReports] Error ai-edit (LLM call)', {
        err: callErr,
        correlationId: (res.req as any)?.correlationId,
      });
      return notConfigured(res, { details: { code: 'ASSESSMENT_REPORTS_AI_EDIT_CALL_FAILED' } });
    }

    const nextVersion = Number(sectionRow.version || 1) + 1;

    await run(
      `UPDATE assessment_report_sections
       SET content = ?, is_ai_generated = 1, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND report_id = ?`,
      [editedContent, nextVersion, userId, sectionId, reportId]
    );

    return res.json({ success: true, content: editedContent, version: nextVersion });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error ai-edit', {
      err,
      correlationId: (res.req as any)?.correlationId,
    });
    return notConfigured(res, { details: { code: 'ASSESSMENT_REPORTS_AI_EDIT_FAILED' } });
  }
});

// =============================================================================
// GET REPORT DETAILS
// =============================================================================
router.get('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { reportId } = req.params;

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as "assessmentName", a.assessment_type as "assessmentType"
         FROM assessment_reports r
         LEFT JOIN assessments a ON r.assessment_id = a.id
         WHERE r.id = ? AND r.organization_id = ?`,
        [reportId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const detailed = safeJsonParse<DetailedAnalysis>(report.detailed_analysis, {});
    const recommendations = safeJsonParse<string[]>(report.recommendations, []);
    // axis_data is stored at report-creation time by computeAxisDataFromAssessment:
    //  - DRD:  { "1": {actual,target}, … } (numeric axis ids)
    //  - SIRI: { _framework:'SIRI', block_*, dim_*, area_* }
    //  - ADMA: { _framework:'ADMA', pillar_*, dim_* }
    // Returning it (instead of {}) is what lets the report view mount the
    // per-framework template (OXFORD #103/#104). Fail-soft: parse errors → {}.
    const axisData = safeJsonParse<Record<string, any>>(report.axis_data, {});

    res.json({
      id: report.id,
      name: report.name || `Report - ${report.assessmentName || 'Assessment'}`,
      status: (report.status || 'DRAFT').toUpperCase(),
      assessmentId: report.assessment_id,
      assessmentName: report.assessmentName || 'Assessment',
      assessmentType: report.assessmentType || null,
      projectId: report.project_id || null,
      content: {
        executiveSummary: report.executive_summary || '',
        keyFindings: detailed.keyFindings || [],
        recommendations,
        notes: detailed.notes || '',
      },
      axisData: axisData && typeof axisData === 'object' ? axisData : {},
      progress: 0,
      isComplete: false,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error fetching report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się pobrać raportu',
      code: 'ASSESSMENT_REPORTS_FETCH_REPORT_FAILED',
    });
  }
});

// =============================================================================
// UPDATE REPORT
// =============================================================================
router.put('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { reportId } = req.params;
    const { name: rawName, content } = req.body || {};
    // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
    // middleware escaped, before storing.
    const name = typeof rawName === 'string' ? decodeHtmlEntities(rawName) : rawName;

    const detailedAnalysis = JSON.stringify({
      keyFindings: content?.keyFindings || [],
      notes: content?.notes || '',
    });

    const recommendations = JSON.stringify(content?.recommendations || []);

    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reports
         SET name = ?, executive_summary = ?, detailed_analysis = ?, recommendations = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [
          name || null,
          content?.executiveSummary || null,
          detailedAnalysis,
          recommendations,
          reportId,
          organizationId,
        ],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error updating report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zaktualizować raportu',
      code: 'ASSESSMENT_REPORTS_UPDATE_REPORT_FAILED',
    });
  }
});

// =============================================================================
// DELETE REPORT (draft cleanup)
// =============================================================================
router.delete('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { reportId } = req.params;

    const row = await get<any>(
      `SELECT id, builder_report_id as "builderReportId"
       FROM assessment_reports
       WHERE id = ? AND organization_id = ?`,
      [String(reportId), String(organizationId)]
    ).catch(() => null);
    const builderReportId = row?.builderReportId ? String(row.builderReportId) : null;

    // Best-effort cascade
    await run(`DELETE FROM assessment_report_section_history WHERE report_id = ?`, [
      reportId,
    ]).catch((err: unknown) =>
      logger.warn('[AssessmentReports] cascade delete section_history failed', err)
    );
    await run(`DELETE FROM assessment_report_sections WHERE report_id = ?`, [reportId]).catch(
      (err: unknown) => logger.warn('[AssessmentReports] cascade delete sections failed', err)
    );

    await run(`DELETE FROM assessment_reports WHERE id = ? AND organization_id = ?`, [
      reportId,
      organizationId,
    ]);

    // If linked to Report Builder, delete it as well (best-effort).
    if (builderReportId) {
      await run(`DELETE FROM report_builder_reports WHERE id = ? AND organization_id = ?`, [
        builderReportId,
        organizationId,
      ]).catch((err: unknown) =>
        logger.warn('[AssessmentReports] cascade delete builder report failed', err)
      );
    }

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error deleting report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się usunąć raportu',
      code: 'ASSESSMENT_REPORTS_DELETE_REPORT_FAILED',
    });
  }
});

// =============================================================================
// FINALIZE REPORT
// =============================================================================
router.post('/:reportId/finalize', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const userId = req.user?.id || 'user-default';
    const { reportId } = req.params;

    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reports 
         SET status = 'FINAL', updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [userId, reportId, organizationId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error finalizing report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się sfinalizować raportu',
      code: 'ASSESSMENT_REPORTS_FINALIZE_REPORT_FAILED',
    });
  }
});

// =============================================================================
// APPROVE REPORT (FINAL -> APPROVED)
// =============================================================================
router.post('/:reportId/approve', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    const { reportId } = req.params as any;
    if (!organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    // Resolve assessmentId for RBAC check
    const reportRow = await queryHelpers.queryOne<any>(
      `SELECT r.id, r.status, r.assessment_id as "assessmentId"
       FROM assessment_reports r
       WHERE r.id = ? AND r.organization_id = ?`,
      [String(reportId), String(organizationId)]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const currentStatus = String(reportRow.status || 'DRAFT').toUpperCase();
    if (!['FINAL', 'PENDING_APPROVAL'].includes(currentStatus)) {
      return res.status(409).json({
        error: 'Report must be FINAL or PENDING_APPROVAL to approve',
        status: currentStatus,
      });
    }

    const roleInfo = await AssessmentPermissionService.getUserRole(
      String(reportRow.assessmentId),
      String(userId),
      String(organizationId)
    );
    if (!roleInfo?.permissions?.canApprove) {
      return res.status(403).json({ error: 'Permission denied', required: 'canApprove' });
    }

    const db = getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reports
         SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP,
             updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [String(userId), String(userId), String(reportId), String(organizationId)],
        (err: Error | null) => (err ? reject(err) : resolve())
      );
    });

    // ── Auto-sync: mark APPROVE_REPORT gate as APPROVED in assessment workflow ──
    if (reportRow.assessmentId) {
      try {
        // Update the assessment's report_approved_at timestamp
        await new Promise<void>((resolve, reject) => {
          db.run(
            `UPDATE assessments
             SET report_approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND organization_id = ?`,
            [String(reportRow.assessmentId), String(organizationId)],
            (err: Error | null) => (err ? reject(err) : resolve())
          );
        });

        // Update APPROVE_REPORT gate decision to APPROVED (if gate_decisions table exists)
        await new Promise<void>((resolve, reject) => {
          db.run(
            `UPDATE assessment_gate_decisions
             SET status = 'APPROVED', decided_by = ?, decided_at = CURRENT_TIMESTAMP
             WHERE assessment_id = ? AND gate_type = 'APPROVE_REPORT'`,
            [String(userId), String(reportRow.assessmentId)],
            (err: Error | null) => {
              // Ignore errors — table may not exist in all environments
              resolve();
            }
          );
        });

        // Also update GENERATE_REPORT gate if present
        await new Promise<void>((resolve, reject) => {
          db.run(
            `UPDATE assessment_gate_decisions
             SET status = 'APPROVED', decided_by = ?, decided_at = CURRENT_TIMESTAMP
             WHERE assessment_id = ? AND gate_type = 'GENERATE_REPORT' AND status != 'APPROVED'`,
            [String(userId), String(reportRow.assessmentId)],
            (err: Error | null) => {
              resolve();
            }
          );
        });

        logger.info(
          `[AssessmentReports] Auto-synced APPROVE_REPORT gate for assessment ${reportRow.assessmentId}`
        );
      } catch (syncErr: any) {
        // Non-blocking: log but don't fail the approval
        logger.warn(
          `[AssessmentReports] Gate sync failed for assessment ${reportRow.assessmentId}: ${syncErr?.message}`
        );
      }
    }

    return res.json({ success: true, gatesSynced: !!reportRow.assessmentId });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error approving report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się zatwierdzić raportu',
      code: 'ASSESSMENT_REPORTS_APPROVE_REPORT_FAILED',
    });
  }
});

// =============================================================================
// REJECT REPORT (FINAL -> DRAFT with comments)
// =============================================================================
router.post('/:reportId/reject', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    const { reportId } = req.params as any;
    const { reason, comments } = req.body || {};
    if (!organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const reportRow = await queryHelpers.queryOne<any>(
      `SELECT r.id, r.status, r.assessment_id as "assessmentId"
       FROM assessment_reports r
       WHERE r.id = ? AND r.organization_id = ?`,
      [String(reportId), String(organizationId)]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const currentStatus = String(reportRow.status || 'DRAFT').toUpperCase();
    if (
      currentStatus !== 'FINAL' &&
      currentStatus !== 'PENDING_APPROVAL' &&
      currentStatus !== 'APPROVED'
    ) {
      return res.status(409).json({
        error: 'Report must be FINAL, PENDING_APPROVAL or APPROVED to reject',
        status: currentStatus,
      });
    }

    // RBAC check
    const roleInfo = await AssessmentPermissionService.getUserRole(
      String(reportRow.assessmentId),
      String(userId),
      String(organizationId)
    );
    if (!roleInfo?.permissions?.canApprove) {
      return res.status(403).json({ error: 'Permission denied', required: 'canApprove' });
    }

    const db = getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reports
         SET status = 'REJECTED', rejected_by = ?, rejected_at = CURRENT_TIMESTAMP,
             rejection_reason = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [
          String(userId),
          String(reason || comments || ''),
          String(userId),
          String(reportId),
          String(organizationId),
        ],
        (err: Error | null) => (err ? reject(err) : resolve())
      );
    });

    return res.json({ success: true, newStatus: 'DRAFT' });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error rejecting report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się odrzucić raportu',
      code: 'ASSESSMENT_REPORTS_REJECT_REPORT_FAILED',
    });
  }
});

// =============================================================================
// SEND BACK (FINAL -> DRAFT without full rejection)
// =============================================================================
router.post('/:reportId/send-back', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    const { reportId } = req.params as any;
    const { reason } = req.body || {};
    if (!organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const reportRow = await queryHelpers.queryOne<any>(
      `SELECT id, status FROM assessment_reports WHERE id = ? AND organization_id = ?`,
      [String(reportId), String(organizationId)]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const db = getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reports
         SET status = 'DRAFT',
             rejection_reason = ?,
             rejected_by = NULL,
             rejected_at = NULL,
             updated_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [String(reason || ''), String(userId), String(reportId), String(organizationId)],
        (err: Error | null) => (err ? reject(err) : resolve())
      );
    });

    return res.json({ success: true, newStatus: 'DRAFT' });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error sending back report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się odesłać raportu',
      code: 'ASSESSMENT_REPORTS_SEND_BACK_REPORT_FAILED',
    });
  }
});

// =============================================================================
// UTILIZE REPORT (APPROVED -> UTILIZED)
// =============================================================================
router.post('/:reportId/utilize', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    const { reportId } = req.params as any;
    const { notes } = req.body || {};
    if (!organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const reportRow = await queryHelpers.queryOne<any>(
      `SELECT r.id, r.status, r.assessment_id as "assessmentId"
       FROM assessment_reports r
       WHERE r.id = ? AND r.organization_id = ?`,
      [String(reportId), String(organizationId)]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const currentStatus = String(reportRow.status || 'DRAFT').toUpperCase();
    if (currentStatus !== 'APPROVED') {
      return res
        .status(409)
        .json({ error: 'Report must be APPROVED to utilize', status: currentStatus });
    }

    const db = getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE assessment_reports
         SET status = 'UTILIZED', utilized_by = ?, utilized_at = CURRENT_TIMESTAMP,
             utilization_notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [
          String(userId),
          String(notes || ''),
          String(userId),
          String(reportId),
          String(organizationId),
        ],
        (err: Error | null) => (err ? reject(err) : resolve())
      );
    });

    return res.json({ success: true, newStatus: 'UTILIZED' });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error utilizing report', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wykorzystać raportu',
      code: 'ASSESSMENT_REPORTS_UTILIZE_REPORT_FAILED',
    });
  }
});

// =============================================================================
// EXPORT
// =============================================================================
router.get('/:reportId/export/pdf', async (_req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(_req, res);
    if (!organizationId) return;
    const { reportId } = _req.params;

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as "assessmentName"
         FROM assessment_reports r
         LEFT JOIN assessments a ON r.assessment_id = a.id
         WHERE r.id = ? AND r.organization_id = ?`,
        [reportId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const exportDir = await ensureExportDir();
    const filePath = path.join(exportDir, `${reportId}.pdf`);
    await writePdfReport(report, filePath);

    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(filePath);
  } catch (err: any) {
    logger.error('[AssessmentReports] Error exporting PDF', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wyeksportować raportu',
      code: 'ASSESSMENT_REPORTS_EXPORT_REPORT_FAILED',
    });
  }
});

router.get('/:reportId/export/pptx', async (_req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(_req, res);
    if (!organizationId) return;
    const { reportId } = _req.params;

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as "assessmentName"
         FROM assessment_reports r
         LEFT JOIN assessments a ON r.assessment_id = a.id
         WHERE r.id = ? AND r.organization_id = ?`,
        [reportId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const exportDir = await ensureExportDir();
    const filePath = path.join(exportDir, `${reportId}.pptx`);
    await writePptxReport(report, filePath);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    return res.sendFile(filePath);
  } catch (err: any) {
    logger.error('[AssessmentReports] Error exporting PPTX', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wyeksportować raportu',
      code: 'ASSESSMENT_REPORTS_EXPORT_REPORT_FAILED',
    });
  }
});

router.get('/:reportId/export/excel', async (_req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(_req, res);
    if (!organizationId) return;
    const { reportId } = _req.params;

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as "assessmentName"
         FROM assessment_reports r
         LEFT JOIN assessments a ON r.assessment_id = a.id
         WHERE r.id = ? AND r.organization_id = ?`,
        [reportId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const workbook = xlsx.utils.book_new();
    const detailed = safeJsonParse<DetailedAnalysis>(report.detailed_analysis, {});
    const recommendations = safeJsonParse<string[]>(report.recommendations, []);

    const rows = [
      ['Assessment Report', report.name || 'Assessment Report'],
      ['Assessment', report.assessmentName || 'Assessment'],
      ['Status', (report.status || 'DRAFT').toUpperCase()],
      ['Executive Summary', report.executive_summary || ''],
      ['Key Findings', ...(detailed.keyFindings || [])],
      ['Recommendations', ...(recommendations || [])],
    ];

    const sheet = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, sheet, 'Report');

    const exportDir = await ensureExportDir();
    const filePath = path.join(exportDir, `${reportId}.xlsx`);
    xlsx.writeFile(workbook, filePath);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    return res.sendFile(filePath);
  } catch (err: any) {
    logger.error('[AssessmentReports] Error exporting Excel', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wyeksportować raportu',
      code: 'ASSESSMENT_REPORTS_EXPORT_REPORT_FAILED',
    });
  }
});

// =============================================================================
// T027: ASSESSMENT DECK EXPORT (PPTX — sponsor-ready deck from APPROVED assessment)
// =============================================================================

router.get('/:reportId/export/deck', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = requireRequestOrganizationId(req, res);
    if (!organizationId) return;
    const { reportId } = req.params;
    const language = (req.query?.language as string) === 'pl' ? 'pl' : 'en';

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as "assessmentName", a.framework, a.status as "assessmentStatus",
                a.form_data, a.organization_id, a.project_id
         FROM assessment_reports r
         LEFT JOIN assessments a ON r.assessment_id = a.id
         WHERE r.id = ? AND r.organization_id = ?`,
        [reportId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const assessmentStatus = String(report.assessmentStatus || '').toUpperCase();
    if (assessmentStatus !== 'APPROVED') {
      return res.status(409).json({
        error: 'Assessment must be APPROVED to generate deck',
        assessmentStatus,
      });
    }

    const framework = String(report.framework || 'DRD').toUpperCase();
    const formData = safeJsonParse<any>(report.form_data, {});
    const detailedAnalysis = safeJsonParse<DetailedAnalysis>(report.detailed_analysis, {});

    let orgName = 'Organization';
    try {
      const orgRow = await new Promise<any>((resolve, reject) => {
        db.get(
          `SELECT name FROM organizations WHERE id = ?`,
          [organizationId],
          (err: Error | null, row: any) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      if (orgRow?.name) orgName = orgRow.name;
    } catch {
      /* use fallback */
    }

    const categories: Array<{
      id: string;
      name: string;
      score: number;
      dimensions: Array<{ id: string; name: string; current: number; target: number; gap: number }>;
    }> = [];

    const topStrengths: Array<{ name: string; score: number; category: string }> = [];
    const topGaps: Array<{
      name: string;
      current: number;
      target: number;
      gap: number;
      category: string;
    }> = [];
    const dataGaps: Array<{ name: string; reason: string }> = [];

    if (framework === 'SIRI') {
      const dims = formData.dimensions || {};
      const prioritisationMatrix = formData.prioritisationMatrix || {};
      const blocks = [
        {
          id: 'PROCESS',
          name: 'Process',
          dimIds: ['operations', 'supply_chain', 'product_lifecycle'],
        },
        {
          id: 'TECHNOLOGY',
          name: 'Technology',
          dimIds: ['automation', 'connectivity', 'intelligence'],
        },
        {
          id: 'ORGANIZATION',
          name: 'Organization',
          dimIds: ['talent_readiness', 'structure_management'],
        },
      ];
      for (const block of blocks) {
        const blockDims = block.dimIds.map((id) => {
          const d = dims[id] || { current: 0, target: 0, gap: 0 };
          return {
            id,
            name: id.replace(/_/g, ' '),
            current: d.current || 0,
            target: d.target || 0,
            gap: d.gap || 0,
          };
        });
        const avg =
          blockDims.length > 0
            ? blockDims.reduce((s, d) => s + d.current, 0) / blockDims.length
            : 0;
        categories.push({
          id: block.id,
          name: block.name,
          score: Math.round(avg * 10) / 10,
          dimensions: blockDims,
        });
        for (const d of blockDims) {
          if (d.current >= 3)
            topStrengths.push({ name: d.name, score: d.current, category: block.name });
          if (d.gap > 0)
            topGaps.push({
              name: d.name,
              current: d.current,
              target: d.target,
              gap: d.gap,
              category: block.name,
            });
          if (d.current === 0) dataGaps.push({ name: d.name, reason: 'Not assessed' });
        }
      }
      // Attach prioritisation matrix for deck appendix (16 areas)
      (formData as any).__prioritisationMatrixForDeck = prioritisationMatrix;
    } else if (framework === 'ADMA') {
      const pillars = formData.pillars || {};
      const pillarOrder = [
        'strategy',
        'smart_products',
        'smart_operations',
        'smart_supply',
        'data_driven',
      ];
      const pillarNames: Record<string, string> = {
        strategy: 'Strategy',
        smart_products: 'Smart Products',
        smart_operations: 'Smart Operations',
        smart_supply: 'Smart Supply Chain',
        data_driven: 'Data-Driven Services',
      };
      for (const pid of pillarOrder) {
        const p = pillars[pid] || { current: 0, target: 0, gap: 0, dimensionScores: {} };
        const dimEntries = Object.entries(p.dimensionScores || {}).map(
          ([id, d]: [string, any]) => ({
            id,
            name: id.replace(/_/g, ' '),
            current: d?.current || 0,
            target: d?.target || 0,
            gap: (d?.target || 0) - (d?.current || 0),
          })
        );
        categories.push({
          id: pid,
          name: pillarNames[pid] || pid,
          score: p.current || 0,
          dimensions: dimEntries,
        });
        for (const d of dimEntries) {
          if (d.current >= 3)
            topStrengths.push({
              name: d.name,
              score: d.current,
              category: pillarNames[pid] || pid,
            });
          if (d.gap > 0)
            topGaps.push({
              name: d.name,
              current: d.current,
              target: d.target,
              gap: d.gap,
              category: pillarNames[pid] || pid,
            });
          if (d.current === 0) dataGaps.push({ name: d.name, reason: 'Not assessed' });
        }
      }
    } else {
      const axes = formData.axes || formData.areas || {};
      const axisNames = [
        'processes',
        'digitalProducts',
        'businessModels',
        'dataManagement',
        'culture',
        'cybersecurity',
        'aiMaturity',
      ];
      for (const axisId of axisNames) {
        const ax = axes[axisId] || { actual: 0, target: 0 };
        categories.push({
          id: axisId,
          name: axisId.replace(/([A-Z])/g, ' $1').trim(),
          score: ax.actual || 0,
          dimensions: [
            {
              id: axisId,
              name: axisId.replace(/([A-Z])/g, ' $1').trim(),
              current: ax.actual || 0,
              target: ax.target || 0,
              gap: Math.max(0, (ax.target || 0) - (ax.actual || 0)),
            },
          ],
        });
        if ((ax.actual || 0) >= 4)
          topStrengths.push({ name: axisId, score: ax.actual || 0, category: 'DRD' });
        const gap = Math.max(0, (ax.target || 0) - (ax.actual || 0));
        if (gap > 0)
          topGaps.push({
            name: axisId,
            current: ax.actual || 0,
            target: ax.target || 0,
            gap,
            category: 'DRD',
          });
        if ((ax.actual || 0) === 0) dataGaps.push({ name: axisId, reason: 'Not assessed' });
      }
    }

    topStrengths.sort((a, b) => b.score - a.score);
    topGaps.sort((a, b) => b.gap - a.gap);

    const scaleMax = framework === 'DRD' ? 7 : framework === 'SIRI' ? 5 : 5;
    const overallScore =
      formData.overallScore ||
      formData.overallMaturity ||
      (categories.length > 0
        ? Math.round((categories.reduce((s, c) => s + c.score, 0) / categories.length) * 10) / 10
        : 0);

    const { generateAssessmentDeck } = await import('../services/assessmentDeckService.js');
    const result = await generateAssessmentDeck({
      framework: framework as 'DRD' | 'SIRI' | 'ADMA',
      assessmentName: report.assessmentName || report.name || 'Assessment',
      organizationName: orgName,
      assessmentDate: report.created_at || new Date().toISOString(),
      overallScore,
      scaleMax,
      categories,
      topStrengths: topStrengths.slice(0, 8),
      topGaps: topGaps.slice(0, 10),
      dataGaps,
      prioritisationMatrix:
        framework === 'SIRI' ? ((formData as any).__prioritisationMatrixForDeck as any) : undefined,
      language,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  } catch (err: any) {
    logger.error('[AssessmentReports] Error exporting deck', {
      err: err,
      correlationId: (res.req as any)?.correlationId,
    });
    res.status(500).json({
      error: 'Nie udało się wygenerować prezentacji',
      code: 'ASSESSMENT_REPORTS_GENERATE_DECK_FAILED',
    });
  }
});

export default router;
