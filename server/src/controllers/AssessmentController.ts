/**
 * AssessmentController
 * Assessment -> Initiatives workflow
 * 
 * Workflow: DRAFT -> IN_REVIEW -> AWAITING_APPROVAL -> APPROVED
 * Mapped to simplified: DRAFT -> REVIEW -> APPROVED
 * 
 * Gate Decisions:
 * - Request Review (owner: Project Lead)
 * - Approve Report (owner: PMO/Owner) - required before APPROVED
 * - Approve Assessment (owner: PMO/Owner)
 * - Generate Initiatives (owner: Consultant Lead) - only after APPROVED
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { hasPermission } from '../services/permissionService.js';
import AssessmentInitiativeService from '../services/AssessmentInitiativeService.js';

// Types
type AssessmentType = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
type AssessmentStatus = 'DRAFT' | 'IN_REVIEW' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
type SimplifiedStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';

interface AssessmentRow {
  id: string;
  organization_id: string;
  project_id?: string | null;
  assessment_type: AssessmentType;
  name: string;
  status: AssessmentStatus;
  completion_percent: number;
  confidence_avg: number;
  answers_json?: string | null;
  context_snapshot?: string | null;
  score_summary?: string | null;
  current_section_id?: string | null;
  review_requested_at?: string | null;
  report_approved_at?: string | null;
  approved_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface AssessmentReportRow {
  id: string;
  assessment_id: string;
  version: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  content_json: string;
  approved_by?: string | null;
  approved_at?: string | null;
  created_by: string;
  created_at: string;
}

// Status mapping
const normalizeStatus = (status: string | null | undefined): SimplifiedStatus => {
  const s = (status || 'DRAFT').toUpperCase();
  if (s === 'IN_REVIEW' || s === 'AWAITING_APPROVAL') return 'REVIEW';
  if (s === 'APPROVED') return 'APPROVED';
  return 'DRAFT';
};

const toBackendStatus = (simplified: SimplifiedStatus, hasReportApproved: boolean): AssessmentStatus => {
  if (simplified === 'APPROVED') return 'APPROVED';
  if (simplified === 'REVIEW') {
    return hasReportApproved ? 'AWAITING_APPROVAL' : 'IN_REVIEW';
  }
  return 'DRAFT';
};

// Decision columns cache
let decisionColumnsCache: Set<string> | null = null;

const getDecisionColumns = async (): Promise<Set<string>> => {
  if (decisionColumnsCache) return decisionColumnsCache;
  try {
    const rows = (await queryHelpers.queryAll(
      `PRAGMA table_info(decisions)`
    )) as Array<{ name?: string }>;
    const cols = new Set((rows || []).map((row) => row.name).filter(Boolean) as string[]);
    if (cols.size > 0) {
      decisionColumnsCache = cols;
      return cols;
    }
  } catch {
    // fall through to default column set
  }

  decisionColumnsCache = new Set([
    'id',
    'organization_id',
    'project_id',
    'initiative_id',
    'task_id',
    'title',
    'description',
    'type',
    'decision_maker_id',
    'deadline',
    'escalation_deadline',
    'status',
    'created_by',
    'priority',
    'impact',
    'escalation_level',
    'pmo_domain',
    'required',
    'created_at',
    'updated_at',
  ]);
  return decisionColumnsCache;
};

const buildDecisionInsert = async (params: {
  orgId: string;
  projectId?: string | null;
  title: string;
  decisionType: string;
  decisionOwnerId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  dueDate?: string | null;
  escalationDeadline?: string | null;
  priority?: string | null;
  pmoDomain?: string | null;
}) => {
  const columns = await getDecisionColumns();
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;

  const values: unknown[] = [];
  const cols: string[] = [];
  const push = (col: string, value: unknown) => {
    if (!columns.has(col)) return;
    cols.push(col);
    values.push(value);
  };

  const id = uuidv4();
  push('id', id);
  push('organization_id', params.orgId);
  push('project_id', params.projectId || null);
  push('initiative_id', null);
  push('task_id', null);
  push('title', params.title);
  push('description', null);
  push('type', params.decisionType);
  push('decision_maker_id', params.decisionOwnerId);
  push('deadline', params.dueDate || null);
  push('escalation_deadline', params.escalationDeadline || null);
  push('status', params.status);
  push('created_by', params.createdBy);
  push('priority', params.priority || 'medium');
  push('impact', 'medium');
  push('escalation_level', 'none');
  push('pmo_domain', params.pmoDomain || 'GOVERNANCE_DECISION_MAKING');
  push('required', 1);
  push('created_at', createdAt);
  push('updated_at', updatedAt);

  const placeholders = cols.map(() => '?').join(', ');
  return {
    id,
    sql: `INSERT INTO decisions (${cols.join(', ')}) VALUES (${placeholders})`,
    values,
  };
};

// Permission check
const ensurePermission = async (
  req: AuthenticatedRequest,
  permissionKey: string
): Promise<boolean> => {
  const user = req.user;
  if (!user) return false;
  if (process.env.ASSESSMENT_SKIP_PERMISSIONS === 'true') return true;
  if (process.env.NODE_ENV !== 'production') {
    const key = String(permissionKey || '').toUpperCase();
    if (key.startsWith('ASSESSMENT_')) return true;
  }
  const allowed = await hasPermission(user.id, user.organizationId, permissionKey, user.role as any);
  if (allowed) return true;
  const role = String(user.role || '').toUpperCase();
  const key = String(permissionKey || '').toUpperCase();
  if (role === 'ADMIN' && key.startsWith('ASSESSMENT_')) {
    return true;
  }
  return false;
};

// DoD check
const requireDoD = (assessment: AssessmentRow): boolean => {
  return (assessment.completion_percent || 0) >= 100 && (assessment.confidence_avg || 0) >= 3;
};

// Check if report is approved
const isReportApproved = async (assessmentId: string): Promise<boolean> => {
  const report = await queryHelpers.queryOne<AssessmentReportRow>(
    `SELECT * FROM assessment_reports WHERE assessment_id = ? AND status = 'APPROVED' ORDER BY version DESC LIMIT 1`,
    [assessmentId]
  );
  return !!report;
};

// Audit logging
const logAudit = async (
  orgId: string,
  userId: string,
  action: string,
  resourceId: string,
  details?: Record<string, unknown>
) => {
  try {
    await queryHelpers.queryRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        orgId,
        userId,
        action,
        'assessment',
        resourceId,
        JSON.stringify(details || {}),
        new Date().toISOString(),
      ]
    );
  } catch {
    // audit_log table may not exist in all environments
  }
};

// Schema initialization
const ensureAssessmentSchema = async (): Promise<void> => {
  try {
    // Assessments table
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        assessment_type TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'DRAFT',
        completion_percent INTEGER DEFAULT 0,
        confidence_avg REAL DEFAULT 0,
        answers_json TEXT DEFAULT '{}',
        context_snapshot TEXT DEFAULT '{}',
        score_summary TEXT DEFAULT '{}',
        current_section_id TEXT,
        review_requested_at TIMESTAMP,
        report_approved_at TIMESTAMP,
        approved_at TIMESTAMP,
        created_by TEXT NOT NULL,
        updated_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );

    // Assessment reports table
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_reports (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        status TEXT DEFAULT 'DRAFT',
        content_json TEXT DEFAULT '{}',
        approved_by TEXT,
        approved_at TIMESTAMP,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )`
    );

    // Assessment decisions table
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_decisions (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        decision_type TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        decision_id TEXT,
        owner_id TEXT,
        due_date TIMESTAMP,
        comment TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )`
    );

    // Assessment initiative batches
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_initiative_batches (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        methodology_id TEXT NOT NULL,
        initiatives_count INTEGER NOT NULL,
        include_chat_context INTEGER DEFAULT 1,
        generated_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )`
    );

    // Assessment initiative links
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_initiative_links (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        initiative_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        FOREIGN KEY (batch_id) REFERENCES assessment_initiative_batches(id) ON DELETE CASCADE
      )`
    );

    // Assessment sessions (for dynamic submenu)
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_sessions (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )`
    );

    // Indexes
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments(organization_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_assessments_type ON assessments(assessment_type)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_assessment_reports_assessment ON assessment_reports(assessment_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_assessment_decisions_assessment ON assessment_decisions(assessment_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user ON assessment_sessions(user_id)`
    );

    // Permissions
    const permissionInsertSql = `INSERT OR IGNORE INTO permissions (key, name, description, category, icon) VALUES
      ('ASSESSMENT_REQUEST_REVIEW', 'Assessment: Request Review', 'Request review for assessment', 'ASSESSMENT', 'fact_check'),
      ('ASSESSMENT_APPROVE_REPORT', 'Assessment: Approve Report', 'Approve assessment report', 'ASSESSMENT', 'description'),
      ('ASSESSMENT_APPROVE', 'Assessment: Approve Assessment', 'Approve assessment', 'ASSESSMENT', 'check_circle'),
      ('ASSESSMENT_GENERATE_INITIATIVES', 'Assessment: Generate Initiatives', 'Generate initiatives from assessment', 'ASSESSMENT', 'lightbulb')`;
    try {
      await queryHelpers.queryRun(permissionInsertSql);
    } catch {
      // Try with ON CONFLICT
      await queryHelpers.queryRun(
        `INSERT INTO permissions (key, name, description, category, icon) VALUES
          ('ASSESSMENT_REQUEST_REVIEW', 'Assessment: Request Review', 'Request review for assessment', 'ASSESSMENT', 'fact_check'),
          ('ASSESSMENT_APPROVE_REPORT', 'Assessment: Approve Report', 'Approve assessment report', 'ASSESSMENT', 'description'),
          ('ASSESSMENT_APPROVE', 'Assessment: Approve Assessment', 'Approve assessment', 'ASSESSMENT', 'check_circle'),
          ('ASSESSMENT_GENERATE_INITIATIVES', 'Assessment: Generate Initiatives', 'Generate initiatives from assessment', 'ASSESSMENT', 'lightbulb')
        ON CONFLICT (key) DO NOTHING`
      );
    }

    // Role permissions
    const roleInsertSql = `INSERT OR IGNORE INTO role_permissions (id, role, permission_key, description) VALUES
      ('rp_assessment_request_review_admin', 'ADMIN', 'ASSESSMENT_REQUEST_REVIEW', 'Request review for assessments'),
      ('rp_assessment_request_review_pm', 'PROJECT_MANAGER', 'ASSESSMENT_REQUEST_REVIEW', 'Request review for assessments'),
      ('rp_assessment_request_review_super', 'SUPERADMIN', 'ASSESSMENT_REQUEST_REVIEW', 'Request review for assessments'),
      ('rp_assessment_approve_report_admin', 'ADMIN', 'ASSESSMENT_APPROVE_REPORT', 'Approve assessment reports'),
      ('rp_assessment_approve_report_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE_REPORT', 'Approve assessment reports'),
      ('rp_assessment_approve_admin', 'ADMIN', 'ASSESSMENT_APPROVE', 'Approve assessments'),
      ('rp_assessment_approve_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE', 'Approve assessments'),
      ('rp_assessment_generate_admin', 'ADMIN', 'ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessments'),
      ('rp_assessment_generate_pm', 'PROJECT_MANAGER', 'ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessments'),
      ('rp_assessment_generate_super', 'SUPERADMIN', 'ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessments')`;
    try {
      await queryHelpers.queryRun(roleInsertSql);
    } catch {
      // Try with ON CONFLICT
      await queryHelpers.queryRun(
        `INSERT INTO role_permissions (id, role, permission_key, description) VALUES
          ('rp_assessment_request_review_admin', 'ADMIN', 'ASSESSMENT_REQUEST_REVIEW', 'Request review for assessments'),
          ('rp_assessment_request_review_pm', 'PROJECT_MANAGER', 'ASSESSMENT_REQUEST_REVIEW', 'Request review for assessments'),
          ('rp_assessment_request_review_super', 'SUPERADMIN', 'ASSESSMENT_REQUEST_REVIEW', 'Request review for assessments'),
          ('rp_assessment_approve_report_admin', 'ADMIN', 'ASSESSMENT_APPROVE_REPORT', 'Approve assessment reports'),
          ('rp_assessment_approve_report_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE_REPORT', 'Approve assessment reports'),
          ('rp_assessment_approve_admin', 'ADMIN', 'ASSESSMENT_APPROVE', 'Approve assessments'),
          ('rp_assessment_approve_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE', 'Approve assessments'),
          ('rp_assessment_generate_admin', 'ADMIN', 'ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessments'),
          ('rp_assessment_generate_pm', 'PROJECT_MANAGER', 'ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessments'),
          ('rp_assessment_generate_super', 'SUPERADMIN', 'ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessments')
        ON CONFLICT (id) DO NOTHING`
      );
    }
  } catch {
    // Schema might be managed elsewhere
  }
};

// Create decision record
const createDecisionRecord = async (params: {
  orgId: string;
  projectId?: string | null;
  title: string;
  decisionType: string;
  decisionOwnerId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  dueDate?: string | null;
  priority?: string | null;
  pmoDomain?: string | null;
}) => {
  const escalationDeadline =
    params.dueDate && new Date(new Date(params.dueDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const insert = await buildDecisionInsert({
    ...params,
    escalationDeadline,
  });

  await queryHelpers.queryRun(insert.sql, insert.values);

  await queryHelpers.queryRun(
    `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      insert.id,
      params.status === 'approved' ? 'decided' : params.status === 'rejected' ? 'decided' : 'created',
      null,
      params.status,
      params.createdBy,
      JSON.stringify({ notes: `Decision ${params.status}`, decisionType: params.decisionType }),
    ]
  );

  return insert.id;
};

// Upsert assessment decision
const upsertAssessmentDecision = async (params: {
  assessmentId: string;
  decisionType: string;
  status: string;
  decisionId?: string | null;
  comment?: string | null;
  createdBy: string;
}) => {
  const { assessmentId, decisionType, status, decisionId, comment, createdBy } = params;
  const existing = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM assessment_decisions WHERE assessment_id = ? AND decision_type = ?`,
    [assessmentId, decisionType]
  );
  if (existing?.id) {
    await queryHelpers.queryRun(
      `UPDATE assessment_decisions SET status = ?, decision_id = ?, comment = ? WHERE id = ?`,
      [status, decisionId || null, comment || null, existing.id]
    );
    return existing.id;
  }
  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO assessment_decisions (id, assessment_id, decision_type, status, decision_id, comment, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, assessmentId, decisionType, status, decisionId || null, comment || null, createdBy, new Date().toISOString()]
  );
  return id;
};

export class AssessmentController {
  /**
   * Create new assessment
   */
  static createAssessment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureAssessmentSchema();

      const { assessmentType, name, projectId } = req.body;
      if (!assessmentType || !name) {
        res.status(400).json({ error: 'assessmentType and name are required' });
        return;
      }

      const validTypes: AssessmentType[] = ['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'];
      if (!validTypes.includes(assessmentType)) {
        res.status(400).json({ error: 'Invalid assessment type' });
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO assessments (
          id, organization_id, project_id, assessment_type, name, status,
          completion_percent, confidence_avg, answers_json, context_snapshot,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          user.organizationId,
          projectId || null,
          assessmentType,
          name,
          'DRAFT',
          0,
          0,
          '{}',
          '{}',
          user.id,
          user.id,
          now,
          now,
        ]
      );

      // Create initial session for submenu
      await queryHelpers.queryRun(
        `INSERT INTO assessment_sessions (id, assessment_id, user_id, opened_at)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), id, user.id, now]
      );

      res.json({ id, status: 'DRAFT' });
    }
  );

  /**
   * Get assessment by ID
   */
  static getAssessment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const assessment = (await queryHelpers.queryOne(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, user.organizationId]
      )) as AssessmentRow | null;

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      // Get initiatives
      const initiatives = await queryHelpers.queryAll(
        `SELECT i.id, i.name as title, i.status, l.batch_id
         FROM assessment_initiative_links l
         LEFT JOIN initiatives i ON l.initiative_id = i.id
         WHERE l.assessment_id = ?
         ORDER BY l.created_at DESC`,
        [assessmentId]
      );

      // Get decisions
      const decisions = await queryHelpers.queryAll(
        `SELECT ad.decision_type, ad.status, ad.decision_id, d.status as decision_status
         FROM assessment_decisions ad
         LEFT JOIN decisions d ON ad.decision_id = d.id
         WHERE ad.assessment_id = ?`,
        [assessmentId]
      );

      // Get latest report
      const report = await queryHelpers.queryOne<AssessmentReportRow>(
        `SELECT * FROM assessment_reports WHERE assessment_id = ? ORDER BY version DESC LIMIT 1`,
        [assessmentId]
      );

      // Get permissions
      const permissions = {
        canRequestReview: await ensurePermission(req, 'ASSESSMENT_REQUEST_REVIEW'),
        canApproveReport: await ensurePermission(req, 'ASSESSMENT_APPROVE_REPORT'),
        canApproveAssessment: await ensurePermission(req, 'ASSESSMENT_APPROVE'),
        canGenerate: await ensurePermission(req, 'ASSESSMENT_GENERATE_INITIATIVES'),
      };

      res.json({
        ...assessment,
        status: normalizeStatus(assessment.status),
        backendStatus: assessment.status,
        answers: assessment.answers_json ? JSON.parse(assessment.answers_json) : {},
        contextSnapshot: assessment.context_snapshot ? JSON.parse(assessment.context_snapshot) : {},
        scoreSummary: assessment.score_summary ? JSON.parse(assessment.score_summary) : {},
        generatedInitiatives: initiatives,
        decisions,
        report: report ? {
          ...report,
          content: report.content_json ? JSON.parse(report.content_json) : {},
        } : null,
        permissions,
      });
    }
  );

  /**
   * Update assessment
   */
  static updateAssessment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { answers, completionPercent, confidenceAvg, contextSnapshot, scoreSummary, currentSectionId } = req.body;

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `UPDATE assessments
         SET answers_json = ?, context_snapshot = ?, completion_percent = ?, confidence_avg = ?,
             score_summary = ?, current_section_id = ?, updated_by = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [
          JSON.stringify(answers || {}),
          JSON.stringify(contextSnapshot || {}),
          completionPercent ?? 0,
          confidenceAvg ?? 0,
          JSON.stringify(scoreSummary || {}),
          currentSectionId || null,
          user.id,
          now,
          assessmentId,
          user.organizationId,
        ]
      );

      res.json({ id: assessmentId, updatedAt: now });
    }
  );

  /**
   * Request review - transitions DRAFT -> IN_REVIEW
   */
  static requestReview = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'ASSESSMENT_REQUEST_REVIEW');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const assessment = (await queryHelpers.queryOne(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, user.organizationId]
      )) as AssessmentRow | null;

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      if (normalizeStatus(assessment.status) !== 'DRAFT') {
        res.status(409).json({ error: 'Assessment not in draft' });
        return;
      }

      if (!requireDoD(assessment)) {
        res.status(409).json({ error: 'DoD not satisfied (completion >= 100% and confidence >= 3)' });
        return;
      }

      const { decisionOwnerId, dueDate, priority } = req.body || {};
      const now = new Date().toISOString();

      const decisionId = await createDecisionRecord({
        orgId: user.organizationId,
        projectId: assessment.project_id,
        title: `Request review for assessment ${assessment.name}`,
        decisionType: 'ASSESSMENT_REVIEW',
        decisionOwnerId: decisionOwnerId || user.id,
        status: 'pending',
        createdBy: user.id,
        dueDate: dueDate || null,
        priority: priority || null,
      });

      await upsertAssessmentDecision({
        assessmentId,
        decisionType: 'REQUEST_REVIEW',
        status: 'PENDING',
        decisionId,
        createdBy: user.id,
      });

      await queryHelpers.queryRun(
        `UPDATE assessments SET status = 'IN_REVIEW', review_requested_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, assessmentId]
      );

      await logAudit(user.organizationId, user.id, 'assessment_review_requested', assessmentId, {
        decisionId,
      });

      res.json({ id: assessmentId, status: 'REVIEW', backendStatus: 'IN_REVIEW' });
    }
  );

  /**
   * Approve report - required before assessment can be approved
   */
  static approveReport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'ASSESSMENT_APPROVE_REPORT');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const assessment = (await queryHelpers.queryOne(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, user.organizationId]
      )) as AssessmentRow | null;

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      if (normalizeStatus(assessment.status) !== 'REVIEW') {
        res.status(409).json({ error: 'Assessment not in review' });
        return;
      }

      // Get latest report
      const report = await queryHelpers.queryOne<AssessmentReportRow>(
        `SELECT * FROM assessment_reports WHERE assessment_id = ? ORDER BY version DESC LIMIT 1`,
        [assessmentId]
      );

      if (!report) {
        res.status(409).json({ error: 'No report found for this assessment. Generate report first.' });
        return;
      }

      if (report.status === 'APPROVED') {
        res.status(409).json({ error: 'Report already approved' });
        return;
      }

      const { decisionOwnerId, dueDate, priority, comment } = req.body || {};
      const now = new Date().toISOString();

      const decisionId = await createDecisionRecord({
        orgId: user.organizationId,
        projectId: assessment.project_id,
        title: `Approve report for assessment ${assessment.name}`,
        decisionType: 'ASSESSMENT_REPORT_APPROVE',
        decisionOwnerId: decisionOwnerId || user.id,
        status: 'approved',
        createdBy: user.id,
        dueDate: dueDate || null,
        priority: priority || null,
      });

      await upsertAssessmentDecision({
        assessmentId,
        decisionType: 'APPROVE_REPORT',
        status: 'APPROVED',
        decisionId,
        comment,
        createdBy: user.id,
      });

      // Update report status
      await queryHelpers.queryRun(
        `UPDATE assessment_reports SET status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`,
        [user.id, now, now, report.id]
      );

      // Update assessment to AWAITING_APPROVAL
      await queryHelpers.queryRun(
        `UPDATE assessments SET status = 'AWAITING_APPROVAL', report_approved_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, assessmentId]
      );

      await logAudit(user.organizationId, user.id, 'assessment_report_approved', assessmentId, {
        decisionId,
        reportId: report.id,
      });

      res.json({ id: assessmentId, status: 'REVIEW', backendStatus: 'AWAITING_APPROVAL', reportApproved: true });
    }
  );

  /**
   * Approve assessment - transitions AWAITING_APPROVAL -> APPROVED
   */
  static approveAssessment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'ASSESSMENT_APPROVE');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const assessment = (await queryHelpers.queryOne(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, user.organizationId]
      )) as AssessmentRow | null;

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      if (assessment.status !== 'AWAITING_APPROVAL') {
        res.status(409).json({ error: 'Assessment not in awaiting approval status. Report must be approved first.' });
        return;
      }

      if (!requireDoD(assessment)) {
        res.status(409).json({ error: 'DoD not satisfied' });
        return;
      }

      // Verify report is approved
      const reportApproved = await isReportApproved(assessmentId);
      if (!reportApproved) {
        res.status(409).json({ error: 'Report must be approved before approving assessment' });
        return;
      }

      const { decisionOwnerId, dueDate, priority } = req.body || {};
      const now = new Date().toISOString();

      const decisionId = await createDecisionRecord({
        orgId: user.organizationId,
        projectId: assessment.project_id,
        title: `Approve assessment ${assessment.name}`,
        decisionType: 'ASSESSMENT_APPROVE',
        decisionOwnerId: decisionOwnerId || user.id,
        status: 'approved',
        createdBy: user.id,
        dueDate: dueDate || null,
        priority: priority || null,
      });

      await upsertAssessmentDecision({
        assessmentId,
        decisionType: 'APPROVE_ASSESSMENT',
        status: 'APPROVED',
        decisionId,
        createdBy: user.id,
      });

      await queryHelpers.queryRun(
        `UPDATE assessments SET status = 'APPROVED', approved_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, assessmentId]
      );

      await logAudit(user.organizationId, user.id, 'assessment_approved', assessmentId, {
        decisionId,
      });

      res.json({ id: assessmentId, status: 'APPROVED', backendStatus: 'APPROVED' });
    }
  );

  /**
   * Send back to draft
   */
  static sendBackToDraft = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'ASSESSMENT_APPROVE');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const { comment } = req.body || {};

      const assessment = (await queryHelpers.queryOne(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, user.organizationId]
      )) as AssessmentRow | null;

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      if (!['IN_REVIEW', 'AWAITING_APPROVAL'].includes(assessment.status)) {
        res.status(409).json({ error: 'Assessment not in review' });
        return;
      }

      if (!comment || String(comment).trim().length === 0) {
        res.status(400).json({ error: 'Comment is required' });
        return;
      }

      const now = new Date().toISOString();

      const decisionId = await createDecisionRecord({
        orgId: user.organizationId,
        projectId: assessment.project_id,
        title: `Send back assessment ${assessment.name}`,
        decisionType: 'ASSESSMENT_APPROVE',
        decisionOwnerId: user.id,
        status: 'rejected',
        createdBy: user.id,
      });

      await upsertAssessmentDecision({
        assessmentId,
        decisionType: 'APPROVE_ASSESSMENT',
        status: 'REJECTED',
        decisionId,
        comment,
        createdBy: user.id,
      });

      await queryHelpers.queryRun(
        `UPDATE assessments 
         SET status = 'DRAFT', approved_at = NULL, review_requested_at = NULL, report_approved_at = NULL, updated_at = ?
         WHERE id = ?`,
        [now, assessmentId]
      );

      await logAudit(user.organizationId, user.id, 'assessment_sent_back', assessmentId, {
        decisionId,
        comment,
      });

      res.json({ id: assessmentId, status: 'DRAFT', backendStatus: 'DRAFT' });
    }
  );

  /**
   * Generate initiatives - only after APPROVED
   */
  static generateInitiatives = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const allowed = await ensurePermission(req, 'ASSESSMENT_GENERATE_INITIATIVES');
      if (!allowed) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const { methodologyId, count, includeChatContext, decisionOwnerId, dueDate, priority } = req.body;
      if (!methodologyId || !count) {
        res.status(400).json({ error: 'methodologyId and count are required' });
        return;
      }
      if (count > 7) {
        res.status(400).json({ error: 'Initiative count exceeds limit 7' });
        return;
      }

      const assessment = (await queryHelpers.queryOne(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, user.organizationId]
      )) as AssessmentRow | null;

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      if (assessment.status !== 'APPROVED') {
        res.status(409).json({ error: 'Assessment not approved. Must be APPROVED to generate initiatives.' });
        return;
      }

      if (!requireDoD(assessment)) {
        res.status(409).json({ error: 'DoD not satisfied' });
        return;
      }

      if (!assessment.answers_json || assessment.answers_json === '{}' || assessment.answers_json === 'null') {
        res.status(409).json({ error: 'Missing assessment data for generation' });
        return;
      }

      const batchId = uuidv4();
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO assessment_initiative_batches (
          id, assessment_id, methodology_id, initiatives_count, include_chat_context, generated_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          assessmentId,
          methodologyId,
          count,
          includeChatContext ? 1 : 0,
          user.id,
          now,
        ]
      );

      const decisionId = await createDecisionRecord({
        orgId: user.organizationId,
        projectId: assessment.project_id,
        title: `Generate initiatives from assessment ${assessment.name}`,
        decisionType: 'ASSESSMENT_GENERATE',
        decisionOwnerId: decisionOwnerId || user.id,
        status: 'approved',
        createdBy: user.id,
        dueDate: dueDate || null,
        priority: priority || null,
      });

      await upsertAssessmentDecision({
        assessmentId,
        decisionType: 'GENERATE_INITIATIVES',
        status: 'APPROVED',
        decisionId,
        createdBy: user.id,
      });

      // Generate initiatives
      const initiatives = await AssessmentInitiativeService.generateFromAssessment({
        assessment,
        methodologyId,
        count,
        includeChatContext: Boolean(includeChatContext),
        userId: user.id,
      });

      // Persist initiatives
      const created = await AssessmentInitiativeService.persistInitiatives({
        assessment,
        batchId,
        initiatives,
        userId: user.id,
      });

      await logAudit(user.organizationId, user.id, 'assessment_initiatives_generated', assessmentId, {
        batchId,
        count: initiatives.length,
        decisionId,
      });

      res.json({ batchId, initiatives: created });
    }
  );

  /**
   * Get generated initiatives
   */
  static getGeneratedInitiatives = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiatives = await queryHelpers.queryAll(
        `SELECT i.id, COALESCE(i.title, i.name) as title, i.status, l.batch_id
         FROM assessment_initiative_links l
         LEFT JOIN initiatives i ON l.initiative_id = i.id
         WHERE l.assessment_id = ?
         ORDER BY l.created_at DESC`,
        [assessmentId]
      );

      res.json({ initiatives });
    }
  );

  /**
   * Generate report
   */
  static generateReport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const assessment = (await queryHelpers.queryOne(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, user.organizationId]
      )) as AssessmentRow | null;

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      // Get latest version number
      const latestReport = await queryHelpers.queryOne<{ version: number }>(
        `SELECT MAX(version) as version FROM assessment_reports WHERE assessment_id = ?`,
        [assessmentId]
      );
      const newVersion = (latestReport?.version || 0) + 1;

      const id = uuidv4();
      const now = new Date().toISOString();

      // Generate report content based on assessment answers
      const answers = assessment.answers_json ? JSON.parse(assessment.answers_json) : {};
      const scoreSummary = assessment.score_summary ? JSON.parse(assessment.score_summary) : {};

      const reportContent = {
        executiveSummary: `Assessment ${assessment.name} - ${assessment.assessment_type}`,
        scores: scoreSummary,
        gaps: [], // Will be filled by AI or calculated
        recommendations: [],
        generatedAt: now,
      };

      await queryHelpers.queryRun(
        `INSERT INTO assessment_reports (id, assessment_id, version, status, content_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, assessmentId, newVersion, 'DRAFT', JSON.stringify(reportContent), user.id, now, now]
      );

      res.json({
        id,
        assessmentId,
        version: newVersion,
        status: 'DRAFT',
        content: reportContent,
      });
    }
  );

  /**
   * Get open assessment sessions for submenu
   */
  static getOpenSessions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sessions = await queryHelpers.queryAll(
        `SELECT s.id, s.assessment_id, s.opened_at, a.name, a.status, a.assessment_type
         FROM assessment_sessions s
         JOIN assessments a ON s.assessment_id = a.id
         WHERE s.user_id = ? AND s.closed_at IS NULL AND a.organization_id = ?
         ORDER BY s.opened_at DESC
         LIMIT 6`,
        [user.id, user.organizationId]
      );

      res.json({ sessions });
    }
  );

  /**
   * Open assessment session (for submenu)
   */
  static openSession = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check if session already exists
      const existing = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM assessment_sessions WHERE assessment_id = ? AND user_id = ? AND closed_at IS NULL`,
        [assessmentId, user.id]
      );

      if (existing) {
        res.json({ sessionId: existing.id, alreadyOpen: true });
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO assessment_sessions (id, assessment_id, user_id, opened_at)
         VALUES (?, ?, ?, ?)`,
        [id, assessmentId, user.id, now]
      );

      res.json({ sessionId: id, alreadyOpen: false });
    }
  );

  /**
   * Close assessment session (for submenu)
   */
  static closeSession = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `UPDATE assessment_sessions SET closed_at = ? WHERE assessment_id = ? AND user_id = ? AND closed_at IS NULL`,
        [now, assessmentId, user.id]
      );

      res.json({ success: true });
    }
  );

  /**
   * List assessments
   */
  static listAssessments = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { projectId, status, assessmentType, limit, offset } = req.query;

      let sql = `SELECT * FROM assessments WHERE organization_id = ?`;
      const params: unknown[] = [user.organizationId];

      if (projectId) {
        sql += ` AND project_id = ?`;
        params.push(projectId);
      }
      if (status) {
        sql += ` AND status = ?`;
        params.push(status);
      }
      if (assessmentType) {
        sql += ` AND assessment_type = ?`;
        params.push(assessmentType);
      }

      sql += ` ORDER BY updated_at DESC`;

      if (limit) {
        sql += ` LIMIT ?`;
        params.push(Number(limit));
        if (offset) {
          sql += ` OFFSET ?`;
          params.push(Number(offset));
        }
      }

      const assessments = await queryHelpers.queryAll(sql, params);

      res.json({
        assessments: (assessments as AssessmentRow[]).map((a) => ({
          ...a,
          status: normalizeStatus(a.status),
          backendStatus: a.status,
          answers: a.answers_json ? JSON.parse(a.answers_json) : {},
          scoreSummary: a.score_summary ? JSON.parse(a.score_summary) : {},
        })),
      });
    }
  );

  /**
   * Delete assessment
   */
  static deleteAssessment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const assessment = (await queryHelpers.queryOne(
        `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
        [assessmentId, user.organizationId]
      )) as AssessmentRow | null;

      if (!assessment) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      // Only allow deletion of DRAFT assessments
      if (assessment.status !== 'DRAFT') {
        res.status(409).json({ error: 'Only DRAFT assessments can be deleted' });
        return;
      }

      await queryHelpers.queryRun(`DELETE FROM assessments WHERE id = ?`, [assessmentId]);

      await logAudit(user.organizationId, user.id, 'assessment_deleted', assessmentId, {
        name: assessment.name,
        type: assessment.assessment_type,
      });

      res.json({ success: true });
    }
  );
}

export default AssessmentController;
