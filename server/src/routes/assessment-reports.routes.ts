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

import { getDatabase } from '../database/index.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import AssessmentInitiativeGenerationRunService from '../services/assessmentInitiativeGenerationRunService.js';
import AssessmentPermissionService from '../services/assessmentPermissionService.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role: string;
  };
}

// Middleware (match other authenticated modules)
router.use(authRateLimiter);
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

type ReportStatus = 'DRAFT' | 'FINAL' | 'ARCHIVED';
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

const ensureAssessmentReportsSchema = async (): Promise<void> => {
  await run(
    `CREATE TABLE IF NOT EXISTS assessment_reports (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      name TEXT,
      status TEXT DEFAULT 'DRAFT',
      template_id TEXT,
      axis_data TEXT,
      executive_summary TEXT,
      detailed_analysis TEXT,
      recommendations TEXT,
      generated_by TEXT,
      generation_params TEXT,
      created_by TEXT,
      updated_by TEXT,
      approved_by TEXT,
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // SQLite migrations in this repo vary; patch missing columns (best-effort).
  try {
    const cols = await all<any>(`PRAGMA table_info(assessment_reports)`, []);
    const existing = new Set((cols || []).map((c: any) => String(c.name)));
    const add = async (name: string, type: string) => {
      if (existing.has(name)) return;
      await run(`ALTER TABLE assessment_reports ADD COLUMN ${name} ${type}`);
      existing.add(name);
    };
    await add('project_id', 'TEXT');
    await add('name', 'TEXT');
    await add('status', "TEXT DEFAULT 'DRAFT'");
    await add('template_id', 'TEXT');
    await add('axis_data', 'TEXT');
    await add('executive_summary', 'TEXT');
    await add('detailed_analysis', 'TEXT');
    await add('recommendations', 'TEXT');
    await add('generated_by', 'TEXT');
    await add('generation_params', 'TEXT');
    await add('created_by', 'TEXT');
    await add('updated_by', 'TEXT');
    await add('approved_by', 'TEXT');
    await add('approved_at', 'TIMESTAMP');
  } catch (e) {
    // ignore; table might be locked or pragma not available in some environments
  }

  await run(
    `CREATE TABLE IF NOT EXISTS assessment_report_sections (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      section_type TEXT NOT NULL,
      axis_id TEXT,
      area_id TEXT,
      title TEXT NOT NULL,
      content TEXT,
      data_snapshot TEXT,
      order_index INTEGER DEFAULT 0,
      is_ai_generated INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await run(`CREATE INDEX IF NOT EXISTS idx_ars_report ON assessment_report_sections(report_id)`);
  await run(
    `CREATE INDEX IF NOT EXISTS idx_ars_report_order ON assessment_report_sections(report_id, order_index)`
  );

  try {
    const cols = await all<any>(`PRAGMA table_info(assessment_report_sections)`, []);
    const existing = new Set((cols || []).map((c: any) => String(c.name)));
    const add = async (name: string, type: string) => {
      if (existing.has(name)) return;
      await run(`ALTER TABLE assessment_report_sections ADD COLUMN ${name} ${type}`);
      existing.add(name);
    };
    await add('section_type', 'TEXT');
    await add('axis_id', 'TEXT');
    await add('area_id', 'TEXT');
    await add('content', 'TEXT');
    await add('data_snapshot', 'TEXT');
    await add('order_index', 'INTEGER DEFAULT 0');
    await add('is_ai_generated', 'INTEGER DEFAULT 0');
    await add('version', 'INTEGER DEFAULT 1');
    await add('created_by', 'TEXT');
    await add('updated_by', 'TEXT');
  } catch {
    // ignore
  }

  await run(
    `CREATE TABLE IF NOT EXISTS assessment_report_section_history (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      title TEXT,
      content TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_arsh_section ON assessment_report_section_history(report_id, section_id, version)`
  );
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
    return `## Executive Summary\n\nThis is a first draft generated from the assessment context.\n\n- Current maturity: _TBD_\n- Target maturity: _TBD_\n- Top gaps: _TBD_\n- Recommended priorities: _TBD_\n`;
  }
  if (sectionType === 'maturity_overview') {
    return `## Maturity Overview\n\n_This section will summarize maturity levels across axes and highlight key gaps._\n`;
  }
  if (sectionType === 'methodology') {
    return `## Methodology\n\nThis report is based on the assessment tool **${assessmentType}**.\n\n- Scope: _TBD_\n- Evidence sources: _TBD_\n- Scoring approach: _TBD_\n`;
  }
  if (sectionType === 'axis_detail') {
    return `## ${sectionTitle}\n\n_Axis ${axisId || '—'} analysis draft._\n\n- Current state: _TBD_\n- Target state: _TBD_\n- Key gaps: _TBD_\n- Recommended initiatives: _TBD_\n`;
  }
  if (sectionType === 'recommendations') {
    return `## Recommendations\n\n- Recommendation 1: _TBD_\n- Recommendation 2: _TBD_\n- Recommendation 3: _TBD_\n`;
  }
  if (sectionType === 'next_steps') {
    return `## Next Steps\n\n1. Validate findings with stakeholders\n2. Prioritize initiatives (impact vs effort)\n3. Assign owners and timelines\n`;
  }
  if (sectionType === 'appendix') {
    return `## Appendix\n\n- Raw notes\n- Source links\n- Supporting evidence\n`;
  }
  if (sectionType === 'gap_analysis') {
    return `## ${sectionTitle}\n\n- Strengths: _TBD_\n- Areas for improvement: _TBD_\n`;
  }

  return `## ${sectionTitle}\n\n_Draft content to be completed._\n`;
};

const computeAxisDataFromAssessment = (assessment: any): Record<string, any> => {
  const type = String(assessment?.assessment_type || assessment?.type || '').toUpperCase();
  const answers = assessment?.answers
    ? safeJsonParse<any>(assessment.answers, {})
    : assessment?.answers;
  if (type !== 'DRD') return {};

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

  const avg = (arr: number[]) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0);
  const out: Record<string, any> = {};
  for (const [axisId, bucket] of Object.entries(axisBuckets)) {
    out[axisId] = {
      actual: Number(avg(bucket.achieved).toFixed(2)),
      target: Number(avg(bucket.target).toFixed(2)),
    };
  }
  return out;
};

// Best-effort init (avoid breaking route in case of migrations ordering)
ensureAssessmentReportsSchema().catch((e) =>
  logger.error('[AssessmentReports] Failed ensuring schema:', e)
);

const ensureExportDir = async (): Promise<string> => {
  const exportDir = path.resolve(process.cwd(), 'exports', 'assessment-reports');
  await fs.promises.mkdir(exportDir, { recursive: true });
  return exportDir;
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
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
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
        r.assessment_id as assessmentId,
        r.project_id as projectId,
        r.name as name,
        r.status as status,
        r.template_id as templateId,
        r.created_by as createdBy,
        r.created_at as createdAt,
        r.updated_at as updatedAt,
        a.name as assessmentName,
        a.assessment_type as assessmentType
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
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        createdBy: r.createdBy || 'system',
      })),
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error listing reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports', message: err.message });
  }
});

// =============================================================================
// TEMPLATE LIST (reuses report builder templates)
// =============================================================================
router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
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
    logger.error('[AssessmentReports] Error listing templates:', err);
    return res.status(500).json({ error: 'Failed to fetch templates', message: err.message });
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
      `SELECT r.*, a.organization_id as orgId, a.status as assessmentStatus, a.id as assessmentId
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
    } as any);

    return res.status(202).json({ runId: run.runId, assessmentId });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error creating report-only initiatives run:', err);
    return res.status(500).json({ error: 'Failed to start generation', message: err.message });
  }
});

// =============================================================================
// CREATE REPORT
// =============================================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const userId = req.user?.id || 'user-default';
    const { assessmentId, name, templateId } = req.body || {};

    if (!assessmentId) {
      return res.status(400).json({ error: 'assessmentId is required' });
    }

    const assessment = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT id, name, organization_id, project_id, assessment_type, status, answers
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

    const existing = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT id FROM assessment_reports WHERE assessment_id = ? AND organization_id = ?`,
        [assessmentId, organizationId],
        (err: Error | null, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existing?.id) {
      return res.status(200).json({ id: existing.id });
    }

    const id = `report-${uuidv4()}`;
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO assessment_reports (
          id, assessment_id, organization_id, project_id, name, status, template_id, axis_data,
          generation_params, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          id,
          assessmentId,
          organizationId,
          assessment.project_id || null,
          name ? String(name) : `Report - ${assessment.name || 'Assessment'}`,
          'DRAFT',
          templateId ? String(templateId) : null,
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

    res.status(201).json({ id });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error creating report:', err);
    res.status(500).json({ error: 'Failed to create report', message: err.message });
  }
});

// =============================================================================
// GET FULL REPORT (report + sections)
// =============================================================================
router.get('/:reportId/full', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { reportId } = req.params;

    const reportRow = await get<any>(
      `SELECT r.*, a.name as assessmentName, a.assessment_type as assessmentType, a.status as assessmentStatus
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

    return res.json({
      id: reportRow.id,
      name: reportRow.name || `Report - ${reportRow.assessmentName || 'Assessment'}`,
      status: String(reportRow.status || 'DRAFT').toUpperCase(),
      assessmentId: reportRow.assessment_id,
      assessmentName: reportRow.assessmentName || 'Assessment',
      axisData,
      content: {},
      sections: (sections || []).map((s: any) => ({
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
      })),
      progress: 0,
      isComplete: false,
      templateId: reportRow.template_id || null,
      createdAt: reportRow.created_at,
      updatedAt: reportRow.updated_at,
      createdBy: reportRow.created_by || null,
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error fetching full report:', err);
    return res.status(500).json({ error: 'Failed to fetch report', message: err.message });
  }
});

// =============================================================================
// GENERATE / REGENERATE REPORT SECTIONS FROM TEMPLATE
// =============================================================================
router.post('/:reportId/generate', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const userId = req.user?.id || 'user-default';
    const { reportId } = req.params;
    const { templateId, language } = req.body || {};

    const reportRow = await get<any>(
      `SELECT r.*, a.name as assessmentName, a.assessment_type as assessmentType, a.status as assessmentStatus
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

    // Wipe and rebuild sections
    await run(`DELETE FROM assessment_report_sections WHERE report_id = ?`, [reportId]);

    for (const spec of templateSections) {
      const sectionId = `sec-${uuidv4()}`;
      const sectionType = mapTemplateSectionType(spec.type, spec.key);
      const title = String(spec.title || spec.key || 'Section');
      const orderIndex = Number(spec.order ?? 0);
      const axisId = spec.repeatFor === 'axis' ? String(spec.repeatKey || '') : null;

      const content = createDraftContent({
        sectionType,
        sectionTitle: title,
        assessmentName: reportRow.assessmentName || 'Assessment',
        assessmentType: String(reportRow.assessmentType || ''),
        assessmentStatus: String(reportRow.assessmentStatus || ''),
        axisId,
      });

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
        language: language || null,
      };

      await run(
        `INSERT INTO assessment_report_sections (
          id, report_id, section_type, axis_id, area_id, title, content, data_snapshot,
          order_index, is_ai_generated, version, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          sectionId,
          reportId,
          sectionType,
          axisId,
          null,
          title,
          content,
          JSON.stringify(dataSnapshot),
          orderIndex,
          1,
          1,
          userId,
          userId,
        ]
      );
    }

    await run(
      `UPDATE assessment_reports
       SET template_id = ?, generation_params = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [
        resolvedTemplateId,
        JSON.stringify({ templateId: resolvedTemplateId, language: language || null }),
        userId,
        reportId,
        organizationId,
      ]
    );

    return res.json({ success: true, reportId, templateId: resolvedTemplateId });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error generating report:', err);
    return res.status(500).json({ error: 'Failed to generate report', message: err.message });
  }
});

// =============================================================================
// SECTIONS CRUD
// =============================================================================
router.get('/:reportId/sections', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
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
    logger.error('[AssessmentReports] Error listing sections:', err);
    return res.status(500).json({ error: 'Failed to fetch sections', message: err.message });
  }
});

router.post('/:reportId/sections', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const userId = req.user?.id || 'user-default';
    const { reportId } = req.params;
    const { sectionType, axisId, areaId, title, content, orderIndex } = req.body || {};

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
    logger.error('[AssessmentReports] Error creating section:', err);
    return res.status(500).json({ error: 'Failed to create section', message: err.message });
  }
});

router.put('/:reportId/sections/:sectionId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const userId = req.user?.id || 'user-default';
    const { reportId, sectionId } = req.params;
    const { content, title, saveHistory } = req.body || {};

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
    logger.error('[AssessmentReports] Error updating section:', err);
    return res.status(500).json({ error: 'Failed to update section', message: err.message });
  }
});

router.delete('/:reportId/sections/:sectionId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
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
    logger.error('[AssessmentReports] Error deleting section:', err);
    return res.status(500).json({ error: 'Failed to delete section', message: err.message });
  }
});

router.put('/:reportId/sections/reorder', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
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
    logger.error('[AssessmentReports] Error reordering sections:', err);
    return res.status(500).json({ error: 'Failed to reorder sections', message: err.message });
  }
});

router.post('/:reportId/sections/:sectionId/ai', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const userId = req.user?.id || 'user-default';
    const { reportId, sectionId } = req.params;
    const { action } = req.body || {};

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

    const current = String(sectionRow.content || '');
    const act = String(action || '').toLowerCase();
    let next = current;

    if (act === 'summarize') {
      next = current.slice(0, 600) + (current.length > 600 ? '\n\n_(summary truncated)_\n' : '');
    } else if (act === 'expand') {
      next = `${current}\n\n---\n\n_TODO: expand this section with examples, metrics and context._\n`;
    } else if (act === 'regenerate') {
      next = createDraftContent({
        sectionType: sectionRow.section_type as SectionType,
        sectionTitle: sectionRow.title || 'Section',
        assessmentName: 'Assessment',
        assessmentType: '',
        assessmentStatus: '',
        axisId: sectionRow.axis_id || null,
      });
    } else if (act === 'improve') {
      next = `${current}\n\n---\n\n_TODO: improve clarity, structure and tone._\n`;
    } else if (act === 'translate') {
      next = `${current}\n\n---\n\n_TODO: translation requested (not yet implemented)._\n`;
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
    logger.error('[AssessmentReports] Error AI action:', err);
    return res.status(500).json({ error: 'Failed AI action', message: err.message });
  }
});

router.get('/:reportId/sections/:sectionId/history', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { reportId, sectionId } = req.params;

    const reportRow = await get<any>(
      `SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?`,
      [reportId, organizationId]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const rows = await all<any>(
      `SELECT id, version, title, content, created_by as createdBy, created_at as createdAt
       FROM assessment_report_section_history
       WHERE report_id = ? AND section_id = ?
       ORDER BY version DESC
       LIMIT 50`,
      [reportId, sectionId]
    );
    return res.json({ history: rows });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error fetching history:', err);
    return res.status(500).json({ error: 'Failed to fetch history', message: err.message });
  }
});

router.post('/:reportId/ai-edit', async (_req: AuthRequest, res: Response) => {
  // Minimal stub for now (UI expects endpoint)
  return res.json({ success: true });
});

// =============================================================================
// GET REPORT DETAILS
// =============================================================================
router.get('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { reportId } = req.params;

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as assessmentName
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

    res.json({
      id: report.id,
      name: report.name || `Report - ${report.assessmentName || 'Assessment'}`,
      status: (report.status || 'DRAFT').toUpperCase(),
      assessmentId: report.assessment_id,
      assessmentName: report.assessmentName || 'Assessment',
      content: {
        executiveSummary: report.executive_summary || '',
        keyFindings: detailed.keyFindings || [],
        recommendations,
        notes: detailed.notes || '',
      },
      axisData: {},
      progress: 0,
      isComplete: false,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
    });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error fetching report:', err);
    res.status(500).json({ error: 'Failed to fetch report', message: err.message });
  }
});

// =============================================================================
// UPDATE REPORT
// =============================================================================
router.put('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { reportId } = req.params;
    const { name, content } = req.body || {};

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
    logger.error('[AssessmentReports] Error updating report:', err);
    res.status(500).json({ error: 'Failed to update report', message: err.message });
  }
});

// =============================================================================
// DELETE REPORT (draft cleanup)
// =============================================================================
router.delete('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
    const { reportId } = req.params;

    // Best-effort cascade
    await run(`DELETE FROM assessment_report_section_history WHERE report_id = ?`, [
      reportId,
    ]).catch(() => {});
    await run(`DELETE FROM assessment_report_sections WHERE report_id = ?`, [reportId]).catch(
      () => {}
    );

    await run(`DELETE FROM assessment_reports WHERE id = ? AND organization_id = ?`, [
      reportId,
      organizationId,
    ]);

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error deleting report:', err);
    return res.status(500).json({ error: 'Failed to delete report', message: err.message });
  }
});

// =============================================================================
// FINALIZE REPORT
// =============================================================================
router.post('/:reportId/finalize', async (req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = req.user?.organizationId || 'org-dbr77-system';
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
    logger.error('[AssessmentReports] Error finalizing report:', err);
    res.status(500).json({ error: 'Failed to finalize report', message: err.message });
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
      `SELECT r.id, r.status, r.assessment_id as assessmentId
       FROM assessment_reports r
       WHERE r.id = ? AND r.organization_id = ?`,
      [String(reportId), String(organizationId)]
    );
    if (!reportRow) return res.status(404).json({ error: 'Report not found' });

    const currentStatus = String(reportRow.status || 'DRAFT').toUpperCase();
    if (currentStatus !== 'FINAL') {
      return res
        .status(409)
        .json({ error: 'Report must be FINAL to approve', status: currentStatus });
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

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[AssessmentReports] Error approving report:', err);
    return res.status(500).json({ error: 'Failed to approve report', message: err.message });
  }
});

// =============================================================================
// EXPORT
// =============================================================================
router.get('/:reportId/export/pdf', async (_req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = _req.user?.organizationId || 'org-dbr77-system';
    const { reportId } = _req.params;

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as assessmentName
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
    logger.error('[AssessmentReports] Error exporting PDF:', err);
    return res.status(500).json({ error: 'Failed to export report', message: err.message });
  }
});

router.get('/:reportId/export/pptx', async (_req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = _req.user?.organizationId || 'org-dbr77-system';
    const { reportId } = _req.params;

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as assessmentName
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
    logger.error('[AssessmentReports] Error exporting PPTX:', err);
    return res.status(500).json({ error: 'Failed to export report', message: err.message });
  }
});

router.get('/:reportId/export/excel', async (_req: AuthRequest, res: Response) => {
  try {
    await ensureAssessmentReportsSchema();
    const db = getDatabase();
    const organizationId = _req.user?.organizationId || 'org-dbr77-system';
    const { reportId } = _req.params;

    const report = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT r.*, a.name as assessmentName
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
    logger.error('[AssessmentReports] Error exporting Excel:', err);
    return res.status(500).json({ error: 'Failed to export report', message: err.message });
  }
});

export default router;
