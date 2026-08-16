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

import AssessmentEvidenceService from '../services/AssessmentEvidenceService.js';
import AssessmentInitiativeService from '../services/assessmentInitiativeService.js';
import { upsertActiveAssessmentInitiativeBatch } from '../services/assessment/AssessmentWorkbenchService.js';
import { getAssessmentRoles } from '../services/assessmentPermissionService.js';
import NotificationService from '../services/notificationService.js';
import { hasPermission } from '../services/permissionService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { assessmentAuditLogger } from '../utils/AssessmentAuditLogger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// Types
type AssessmentType = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
type AssessmentStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';
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
  navigation_json?: string | null;
  review_requested_at?: string | null;
  report_approved_at?: string | null;
  approved_at?: string | null;
  created_by: string;
  updated_by?: string | null;
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
export const normalizeStatus = (status: string | null | undefined): SimplifiedStatus => {
  const s = (status || 'DRAFT').toUpperCase();
  if (s === 'IN_REVIEW' || s === 'AWAITING_APPROVAL') return 'REVIEW';
  if (s === 'APPROVED') return 'APPROVED';
  return 'DRAFT';
};

const toBackendStatus = (
  simplified: SimplifiedStatus,
  hasReportApproved: boolean
): AssessmentStatus => {
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
    const rows = await queryHelpers.getTableColumns('decisions');
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
  const role = String(user.role || '').toUpperCase();
  const allowed = await hasPermission(user.id, user.organizationId, permissionKey, role as any);
  if (allowed) return true;
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

async function notifyAssessmentTeam(params: {
  assessmentId: string;
  organizationId: string;
  actorId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  audience?: 'approvers' | 'team';
}) {
  try {
    const roles = await getAssessmentRoles(
      String(params.assessmentId),
      String(params.organizationId)
    );
    const unique = new Set<string>();
    for (const r of roles || []) {
      const role = String((r as any).role || '').toLowerCase();
      if (params.audience === 'approvers') {
        if (role !== 'admin' && role !== 'manager') continue;
      } else {
        if (role === 'viewer') continue;
      }
      const uid = String((r as any).userId || '');
      if (!uid || uid === String(params.actorId)) continue;
      unique.add(uid);
    }

    await Promise.all(
      Array.from(unique).map((userId) =>
        NotificationService.send({
          userId,
          organizationId: String(params.organizationId),
          type: params.type,
          title: params.title,
          body: params.body,
          entityType: 'assessment',
          entityId: String(params.assessmentId),
          actionUrl: params.actionUrl,
          actorId: String(params.actorId),
          priority: 'normal',
        }).catch(() => null)
      )
    );
  } catch {
    // non-blocking
  }
}

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
export const ensureAssessmentSchema = async (): Promise<void> => {
  try {
    const tryAddColumn = async (
      table: string,
      _columnName: string,
      columnDefSql: string
    ): Promise<void> => {
      await queryHelpers.queryRun(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${columnDefSql}`);
    };

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

    // If the table already existed (older DB), ensure required columns exist.
    // NOTE: SQLite won't add columns via CREATE TABLE IF NOT EXISTS, so we must ALTER.
    await tryAddColumn('assessments', 'project_id', 'project_id TEXT');
    await tryAddColumn('assessments', 'assessment_type', "assessment_type TEXT DEFAULT 'DRD'");
    await tryAddColumn('assessments', 'name', "name TEXT DEFAULT 'New Assessment'");
    await tryAddColumn('assessments', 'status', "status TEXT DEFAULT 'DRAFT'");
    await tryAddColumn('assessments', 'completion_percent', 'completion_percent INTEGER DEFAULT 0');
    await tryAddColumn('assessments', 'confidence_avg', 'confidence_avg REAL DEFAULT 0');
    await tryAddColumn('assessments', 'answers_json', "answers_json TEXT DEFAULT '{}'");
    await tryAddColumn('assessments', 'context_snapshot', "context_snapshot TEXT DEFAULT '{}'");
    await tryAddColumn('assessments', 'score_summary', "score_summary TEXT DEFAULT '{}'");
    await tryAddColumn('assessments', 'current_section_id', 'current_section_id TEXT');
    await tryAddColumn('assessments', 'navigation_json', "navigation_json TEXT DEFAULT '{}'");
    await tryAddColumn('assessments', 'p28_workbench_v1', 'p28_workbench_v1 TEXT');
    await tryAddColumn('assessments', 'assessment_definition_id', 'assessment_definition_id TEXT');
    await tryAddColumn(
      'assessments',
      'assessment_definition_version',
      'assessment_definition_version TEXT'
    );
    await tryAddColumn('assessments', 'review_requested_at', 'review_requested_at TIMESTAMP');
    await tryAddColumn('assessments', 'report_approved_at', 'report_approved_at TIMESTAMP');
    await tryAddColumn('assessments', 'approved_at', 'approved_at TIMESTAMP');
    await tryAddColumn('assessments', 'created_by', 'created_by TEXT');
    await tryAddColumn('assessments', 'updated_by', 'updated_by TEXT');
    await tryAddColumn('assessments', 'created_at', 'created_at TIMESTAMP');
    await tryAddColumn('assessments', 'updated_at', 'updated_at TIMESTAMP');

    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_definitions (
        id TEXT PRIMARY KEY,
        methodology_id TEXT NOT NULL,
        version TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        is_read_only INTEGER NOT NULL DEFAULT 0,
        definition_json TEXT NOT NULL DEFAULT '{}',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      )`
    );
    await queryHelpers.queryRun(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_definitions_methodology_version
       ON assessment_definitions(methodology_id, version)`
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

    // Per-user state (enterprise): last position, last opened, etc.
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_user_state (
        assessment_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        navigation_json TEXT DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (assessment_id, user_id),
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )`
    );

    // Area assignments (enterprise): who is responsible for which area
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS assessment_area_assignments (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        area_id TEXT NOT NULL,
        assigned_user_id TEXT NOT NULL,
        assigned_by TEXT NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_at TIMESTAMP,
        status TEXT DEFAULT 'ACTIVE',
        UNIQUE (assessment_id, area_id),
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
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_assessment_user_state_user ON assessment_user_state(user_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_assessment_assignments_assessment ON assessment_area_assignments(assessment_id)`
    );

    // Permissions
    // Note: permissions table may not have 'name' and 'icon' columns in PostgreSQL
    const permissionInsertSql = `INSERT OR IGNORE INTO permissions (key, description, category) VALUES
      ('ASSESSMENT_REQUEST_REVIEW', 'Request review for assessment', 'ASSESSMENT'),
      ('ASSESSMENT_APPROVE_REPORT', 'Approve assessment report', 'ASSESSMENT'),
      ('ASSESSMENT_APPROVE', 'Approve assessment', 'ASSESSMENT'),
      ('ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessment', 'ASSESSMENT')`;
    try {
      await queryHelpers.queryRun(permissionInsertSql);
    } catch {
      // Try with ON CONFLICT
      try {
        await queryHelpers.queryRun(
          `INSERT INTO permissions (key, description, category) VALUES
            ('ASSESSMENT_REQUEST_REVIEW', 'Request review for assessment', 'ASSESSMENT'),
            ('ASSESSMENT_APPROVE_REPORT', 'Approve assessment report', 'ASSESSMENT'),
            ('ASSESSMENT_APPROVE', 'Approve assessment', 'ASSESSMENT'),
            ('ASSESSMENT_GENERATE_INITIATIVES', 'Generate initiatives from assessment', 'ASSESSMENT')
          ON CONFLICT (key) DO NOTHING`
        );
      } catch {
        // permissions table may not exist in all environments
      }
    }

    // role_permissions may have (id, role, permission_key) only in Postgres; description optional
    const roleInsertSql = `INSERT OR IGNORE INTO role_permissions (id, role, permission_key) VALUES
      ('rp_assessment_request_review_admin', 'ADMIN', 'ASSESSMENT_REQUEST_REVIEW'),
      ('rp_assessment_request_review_pm', 'PROJECT_MANAGER', 'ASSESSMENT_REQUEST_REVIEW'),
      ('rp_assessment_request_review_super', 'SUPERADMIN', 'ASSESSMENT_REQUEST_REVIEW'),
      ('rp_assessment_approve_report_admin', 'ADMIN', 'ASSESSMENT_APPROVE_REPORT'),
      ('rp_assessment_approve_report_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE_REPORT'),
      ('rp_assessment_approve_admin', 'ADMIN', 'ASSESSMENT_APPROVE'),
      ('rp_assessment_approve_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE'),
      ('rp_assessment_generate_admin', 'ADMIN', 'ASSESSMENT_GENERATE_INITIATIVES'),
      ('rp_assessment_generate_pm', 'PROJECT_MANAGER', 'ASSESSMENT_GENERATE_INITIATIVES'),
      ('rp_assessment_generate_super', 'SUPERADMIN', 'ASSESSMENT_GENERATE_INITIATIVES')`;
    try {
      await queryHelpers.queryRun(roleInsertSql);
    } catch {
      // Try with ON CONFLICT (Postgres)
      try {
        await queryHelpers.queryRun(
          `INSERT INTO role_permissions (id, role, permission_key) VALUES
            ('rp_assessment_request_review_admin', 'ADMIN', 'ASSESSMENT_REQUEST_REVIEW'),
            ('rp_assessment_request_review_pm', 'PROJECT_MANAGER', 'ASSESSMENT_REQUEST_REVIEW'),
            ('rp_assessment_request_review_super', 'SUPERADMIN', 'ASSESSMENT_REQUEST_REVIEW'),
            ('rp_assessment_approve_report_admin', 'ADMIN', 'ASSESSMENT_APPROVE_REPORT'),
            ('rp_assessment_approve_report_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE_REPORT'),
            ('rp_assessment_approve_admin', 'ADMIN', 'ASSESSMENT_APPROVE'),
            ('rp_assessment_approve_super', 'SUPERADMIN', 'ASSESSMENT_APPROVE'),
            ('rp_assessment_generate_admin', 'ADMIN', 'ASSESSMENT_GENERATE_INITIATIVES'),
            ('rp_assessment_generate_pm', 'PROJECT_MANAGER', 'ASSESSMENT_GENERATE_INITIATIVES'),
            ('rp_assessment_generate_super', 'SUPERADMIN', 'ASSESSMENT_GENERATE_INITIATIVES')
          ON CONFLICT (id) DO NOTHING`
        );
      } catch {
        // role_permissions table may not exist in all environments
      }
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
    params.dueDate &&
    new Date(new Date(params.dueDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

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
      params.status === 'approved'
        ? 'decided'
        : params.status === 'rejected'
          ? 'decided'
          : 'created',
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
    [
      id,
      assessmentId,
      decisionType,
      status,
      decisionId || null,
      comment || null,
      createdBy,
      new Date().toISOString(),
    ]
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

      const { assessmentType, name: rawName, projectId } = req.body;
      if (!assessmentType || !rawName) {
        res.status(400).json({ error: 'assessmentType and name are required' });
        return;
      }
      // T5 (Z139 follow-up): decode HTML entities the global input-sanitization
      // middleware escaped, mirroring the notebook/tool_sessions.name fix — the
      // DB should hold plain text, not a literal `&amp;`.
      const name = decodeHtmlEntities(String(rawName));

      const validTypes: AssessmentType[] = ['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'];
      if (!validTypes.includes(assessmentType)) {
        res.status(400).json({ error: 'Invalid assessment type' });
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      // Backward compatibility: some older SQLite DBs may not have `project_id` column.
      // We try the full insert first, and if it fails with "no such column", retry without project_id.
      try {
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
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (msg.includes('no such column') && msg.includes('project_id')) {
          await queryHelpers.queryRun(
            `INSERT INTO assessments (
              id, organization_id, assessment_type, name, status,
              completion_percent, confidence_avg, answers_json, context_snapshot,
              created_by, updated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              user.organizationId,
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
        } else {
          throw e;
        }
      }

      // Create initial session for submenu
      await queryHelpers.queryRun(
        `INSERT INTO assessment_sessions (id, assessment_id, user_id, opened_at)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), id, user.id, now]
      );

      // Log activity (non-blocking)
      assessmentAuditLogger
        .logCreation(req, id, assessmentType)
        .catch((err: unknown) => logger.warn('[Assessment] audit logCreation failed', err));

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

      try {
        // Ensure workflow schema exists even for older DBs (so reads don't fail on missing tables).
        await ensureAssessmentSchema();

        const assessment = (await queryHelpers.queryOne(
          `SELECT * FROM assessments WHERE id = ? AND organization_id = ?`,
          [assessmentId, user.organizationId]
        )) as AssessmentRow | null;

        if (!assessment) {
          res.status(404).json({ error: 'Assessment not found' });
          return;
        }

        // Get initiatives
        const initiatives = await queryHelpers
          .queryAll(
            `SELECT i.id, i.name as title, i.status, l.batch_id
           FROM assessment_initiative_links l
           LEFT JOIN initiatives i ON l.initiative_id = i.id
           WHERE l.assessment_id = ?
           ORDER BY l.created_at DESC`,
            [assessmentId]
          )
          .catch((err) => {
            logger.warn('[AssessmentController] Failed to load initiatives:', err);
            return [];
          });

        // Get decisions
        const decisions = await queryHelpers
          .queryAll(
            `SELECT ad.decision_type, ad.status, ad.decision_id, d.status as decision_status
           FROM assessment_decisions ad
           LEFT JOIN decisions d ON ad.decision_id = d.id
           WHERE ad.assessment_id = ?`,
            [assessmentId]
          )
          .catch((err) => {
            logger.warn('[AssessmentController] Failed to load decisions:', err);
            return [];
          });

        // Get latest report
        const report = await queryHelpers
          .queryOne<AssessmentReportRow>(
            // NOTE: DBs created before workflow v2 may not have `version` column on assessment_reports.
            // Use timestamps to pick the latest row in a backwards-compatible way.
            `SELECT * FROM assessment_reports WHERE assessment_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1`,
            [assessmentId]
          )
          .catch((err) => {
            logger.warn('[AssessmentController] Failed to load report:', err);
            return null;
          });

        // Get permissions
        const permissions = {
          canRequestReview: await ensurePermission(req, 'ASSESSMENT_REQUEST_REVIEW').catch(
            () => false
          ),
          canApproveReport: await ensurePermission(req, 'ASSESSMENT_APPROVE_REPORT').catch(
            () => false
          ),
          canApproveAssessment: await ensurePermission(req, 'ASSESSMENT_APPROVE').catch(
            () => false
          ),
          canGenerate: await ensurePermission(req, 'ASSESSMENT_GENERATE_INITIATIVES').catch(
            () => false
          ),
        };

        // Safe JSON parsing with fallback
        const parseJsonSafely = (
          jsonString: string | null | undefined,
          fallback: any = {}
        ): any => {
          if (!jsonString) return fallback;
          try {
            return JSON.parse(jsonString);
          } catch (e) {
            logger.error(
              '[AssessmentController] Failed to parse JSON:',
              e,
              'Raw:',
              jsonString?.substring(0, 100)
            );
            return fallback;
          }
        };

        res.json({
          ...assessment,
          status: normalizeStatus(assessment.status),
          backendStatus: assessment.status,
          answers: parseJsonSafely(assessment.answers_json, {}),
          contextSnapshot: parseJsonSafely(assessment.context_snapshot, {}),
          scoreSummary: parseJsonSafely(assessment.score_summary, {}),
          navigation: parseJsonSafely((assessment as any).navigation_json, null),
          generatedInitiatives: initiatives,
          decisions,
          report: report
            ? {
                ...report,
                content: parseJsonSafely(report.content_json, {}),
              }
            : null,
          permissions,
        });
      } catch (error: any) {
        logger.error('[AssessmentController] Error in getAssessment:', {
          assessmentId,
          organizationId: user.organizationId,
          error: error?.message,
          stack: error?.stack,
        });
        throw error; // Re-throw to be handled by asyncHandler
      }
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

      // Ensure schema exists (older DBs may miss columns used here)
      await ensureAssessmentSchema();

      const {
        name: rawName,
        answers,
        completionPercent,
        confidenceAvg,
        contextSnapshot,
        scoreSummary,
        currentSectionId,
        navigation,
      } = req.body;
      // T5 (Z139 follow-up): decode HTML entities before storing — see createAssessment.
      const name = typeof rawName === 'string' ? decodeHtmlEntities(rawName) : rawName;

      const now = new Date().toISOString();

      // IMPORTANT:
      // Clients often send partial updates (e.g. autosave answers without contextSnapshot/scoreSummary).
      // Preserve existing fields when omitted to avoid accidental data loss.
      const existing = await queryHelpers.queryOne<{
        answers_json?: string | null;
        context_snapshot?: string | null;
        score_summary?: string | null;
        p28_workbench_v1?: string | null;
        completion_percent?: number | null;
        confidence_avg?: number | null;
        current_section_id?: string | null;
        navigation_json?: string | null;
      }>(
        `SELECT answers_json, context_snapshot, score_summary, p28_workbench_v1, completion_percent, confidence_avg, current_section_id, navigation_json
         FROM assessments
         WHERE id = ? AND organization_id = ?`,
        [assessmentId, user.organizationId]
      );

      if (!existing) {
        res.status(404).json({ error: 'Assessment not found' });
        return;
      }

      if (scoreSummary !== undefined && existing.p28_workbench_v1) {
        res.status(409).json({
          error:
            'P28 assessments require explicit score proposals and review before scores can change',
          code: 'P28_NO_SILENT_SCORING',
          whatNext: [
            'Use the P28 workbench score proposal flow instead of writing scoreSummary directly.',
          ],
        });
        return;
      }

      const parseJsonSafely = (jsonString: string | null | undefined, fallback: any = {}): any => {
        if (!jsonString) return fallback;
        try {
          return JSON.parse(jsonString);
        } catch {
          return fallback;
        }
      };

      const nextAnswers =
        answers !== undefined ? answers : parseJsonSafely(existing.answers_json, {});
      const nextContextSnapshot =
        contextSnapshot !== undefined
          ? contextSnapshot
          : parseJsonSafely(existing.context_snapshot, {});
      const nextScoreSummary =
        scoreSummary !== undefined ? scoreSummary : parseJsonSafely(existing.score_summary, {});
      const nextCompletionPercent =
        completionPercent !== undefined
          ? completionPercent
          : Number(existing.completion_percent || 0);
      const nextConfidenceAvg =
        confidenceAvg !== undefined ? confidenceAvg : Number(existing.confidence_avg || 0);
      const nextCurrentSectionId =
        currentSectionId !== undefined
          ? currentSectionId || null
          : existing.current_section_id || null;
      const nextNavigation =
        navigation !== undefined ? navigation : parseJsonSafely(existing.navigation_json, {});

      await queryHelpers.queryRun(
        `UPDATE assessments
         SET name = COALESCE(?, name),
             answers_json = ?, context_snapshot = ?, completion_percent = ?, confidence_avg = ?,
             score_summary = ?, current_section_id = ?, navigation_json = ?, updated_by = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [
          name ?? null,
          JSON.stringify(nextAnswers || {}),
          JSON.stringify(nextContextSnapshot || {}),
          nextCompletionPercent,
          nextConfidenceAvg,
          JSON.stringify(nextScoreSummary || {}),
          nextCurrentSectionId,
          JSON.stringify(nextNavigation || {}),
          user.id,
          now,
          assessmentId,
          user.organizationId,
        ]
      );

      // Log activity (non-blocking)
      assessmentAuditLogger
        .logUpdate(req, assessmentId, {
          completionPercent: nextCompletionPercent,
          hasAnswers: !!answers,
          hasContextSnapshot: !!contextSnapshot,
        })
        .catch((err: unknown) => logger.warn('[Assessment] non-blocking operation failed', err));

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
        res
          .status(409)
          .json({ error: 'DoD not satisfied (completion >= 100% and confidence >= 3)' });
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

      notifyAssessmentTeam({
        assessmentId,
        organizationId: user.organizationId,
        actorId: user.id,
        type: 'ASSESSMENT_REVIEW_REQUESTED',
        title: 'Assessment submitted for review',
        body: `Assessment "${assessment.name}" was submitted for review.`,
        actionUrl: `/assessment/${String(assessment.assessment_type || 'drd').toLowerCase()}/${assessmentId}`,
        audience: 'approvers',
      }).catch((err: unknown) => logger.warn('[Assessment] non-blocking operation failed', err));

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
        // NOTE: DBs created before workflow v2 may not have `version` column on assessment_reports.
        // Use timestamps to pick the latest row in a backwards-compatible way.
        `SELECT * FROM assessment_reports WHERE assessment_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1`,
        [assessmentId]
      );

      if (!report) {
        res
          .status(409)
          .json({ error: 'No report found for this assessment. Generate report first.' });
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

      notifyAssessmentTeam({
        assessmentId,
        organizationId: user.organizationId,
        actorId: user.id,
        type: 'ASSESSMENT_REPORT_APPROVED',
        title: 'Report approved',
        body: `Report for assessment "${assessment.name}" was approved.`,
        actionUrl: `/assessment/${String(assessment.assessment_type || 'drd').toLowerCase()}/${assessmentId}`,
        audience: 'team',
      }).catch((err: unknown) => logger.warn('[Assessment] non-blocking operation failed', err));

      res.json({
        id: assessmentId,
        status: 'REVIEW',
        backendStatus: 'AWAITING_APPROVAL',
        reportApproved: true,
      });
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
        res.status(409).json({
          error: 'Assessment not in awaiting approval status. Report must be approved first.',
        });
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

      notifyAssessmentTeam({
        assessmentId,
        organizationId: user.organizationId,
        actorId: user.id,
        type: 'ASSESSMENT_APPROVED',
        title: 'Assessment approved',
        body: `Assessment "${assessment.name}" has been approved.`,
        actionUrl: `/assessment/${String(assessment.assessment_type || 'drd').toLowerCase()}/${assessmentId}`,
        audience: 'team',
      }).catch((err: unknown) => logger.warn('[Assessment] non-blocking operation failed', err));

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

      notifyAssessmentTeam({
        assessmentId,
        organizationId: user.organizationId,
        actorId: user.id,
        type: 'ASSESSMENT_SENT_BACK',
        title: 'Assessment sent back to draft',
        body: `Assessment "${assessment.name}" was sent back to draft. Comment: ${String(comment)}`,
        actionUrl: `/assessment/${String(assessment.assessment_type || 'drd').toLowerCase()}/${assessmentId}`,
        audience: 'team',
      }).catch((err: unknown) => logger.warn('[Assessment] non-blocking operation failed', err));

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

      const {
        methodologyId,
        count,
        includeChatContext,
        decisionOwnerId,
        dueDate,
        priority,
        reportId,
      } = req.body;
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
        res
          .status(409)
          .json({ error: 'Assessment not approved. Must be APPROVED to generate initiatives.' });
        return;
      }

      // V4-ASMT-03: Evidence gate — when requireEvidence=true, block if no evidence rows
      const requireEvidence = Boolean((req.body as any)?.requireEvidence);
      if (requireEvidence) {
        try {
          const evidenceReport = await AssessmentEvidenceService.getEvidenceReport(
            assessmentId,
            user.organizationId
          );
          if (!evidenceReport.isReadyForConsolidation) {
            res.status(400).json({
              error: 'Evidence completeness required',
              code: 'EVIDENCE_GATE',
              message:
                evidenceReport.blockers[0] ||
                'Add evidence for required dimensions before generating initiatives.',
              blockers: evidenceReport.blockers,
            });
            return;
          }
        } catch {
          /* assessment_evidence table may not exist */
          res.status(400).json({
            error: 'Evidence gate required but evidence system not configured',
            code: 'EVIDENCE_GATE',
          });
          return;
        }
      }

      if (!requireDoD(assessment)) {
        res.status(409).json({ error: 'DoD not satisfied' });
        return;
      }

      if (
        !assessment.answers_json ||
        assessment.answers_json === '{}' ||
        assessment.answers_json === 'null'
      ) {
        res.status(409).json({ error: 'Missing assessment data for generation' });
        return;
      }

      const proposedBatchId = uuidv4();
      const now = new Date().toISOString();
      const { batchId } = await upsertActiveAssessmentInitiativeBatch({
        batchId: proposedBatchId,
        assessmentId,
        organizationId: user.organizationId,
        fields: {
          methodology_id: methodologyId,
          initiatives_count: count,
          include_chat_context: includeChatContext ? 1 : 0,
          generated_by: user.id,
          created_at: now,
          report_id: reportId ? String(reportId) : null,
        },
      });

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
      // Enrich context snapshot with report context + existing initiatives (dedup),
      // so generation leverages BOTH:
      // - detailed assessment answers (assessment)
      // - synthesized narrative (report)
      const parseJsonSafely = (jsonString: string | null | undefined, fallback: any = {}): any => {
        if (!jsonString) return fallback;
        try {
          return JSON.parse(jsonString);
        } catch {
          return fallback;
        }
      };

      // Fetch report context:
      // - if reportId is provided, use it (and ensure it belongs to this assessment)
      // - else fallback to latest report by updated/created
      const reportColumns = await (async () => {
        try {
          const rows = await queryHelpers.getTableColumns('assessment_reports');
          return new Set((rows || []).map((r) => r.name).filter(Boolean) as string[]);
        } catch {
          return new Set<string>();
        }
      })();

      const fetchReportRow = async (): Promise<any | null> => {
        try {
          if (reportId) {
            return await queryHelpers.queryOne<any>(
              `SELECT * FROM assessment_reports WHERE id = ? AND assessment_id = ? LIMIT 1`,
              [String(reportId), assessmentId]
            );
          }
          return await queryHelpers.queryOne<any>(
            `SELECT * FROM assessment_reports WHERE assessment_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1`,
            [assessmentId]
          );
        } catch {
          return null;
        }
      };

      const reportRow = await fetchReportRow();
      if (reportId && !reportRow) {
        res.status(404).json({ error: 'Report not found for this assessment' });
        return;
      }

      const reportContext = (() => {
        if (!reportRow) return null;
        // Prefer canonical v2 schema: content_json (JSON)
        if (reportColumns.has('content_json')) {
          const content = reportRow.content_json ? parseJsonSafely(reportRow.content_json, {}) : {};
          return {
            id: reportRow.id,
            assessmentId: reportRow.assessment_id || assessmentId,
            version: reportRow.version,
            status: reportRow.status,
            content,
            updatedAt: reportRow.updated_at || reportRow.created_at,
          };
        }
        // Legacy schema variant used by /api/assessment-reports routes (executive_summary, detailed_analysis, recommendations)
        const detailed = reportRow.detailed_analysis
          ? parseJsonSafely(reportRow.detailed_analysis, {})
          : {};
        const recommendations = reportRow.recommendations
          ? parseJsonSafely(reportRow.recommendations, [])
          : [];
        return {
          id: reportRow.id,
          assessmentId: reportRow.assessment_id || assessmentId,
          status: reportRow.status || (reportRow.executive_summary ? 'FINAL' : 'DRAFT'),
          content: {
            executiveSummary: reportRow.executive_summary || '',
            keyFindings: detailed?.keyFindings || [],
            notes: detailed?.notes || '',
            recommendations,
          },
          updatedAt: reportRow.updated_at || reportRow.created_at,
        };
      })();

      // Existing initiatives for dedup guidance (assessment + report)
      const existingByAssessment = await queryHelpers
        .queryAll<any>(
          `SELECT i.id,
                  COALESCE(i.title, i.name) as title,
                  i.status,
                  i.report_id as "reportId"
           FROM assessment_initiative_links l
           LEFT JOIN initiatives i ON l.initiative_id = i.id
           WHERE l.assessment_id = ?
           ORDER BY l.created_at DESC
           LIMIT 200`,
          [assessmentId]
        )
        .catch(() => []);

      const existingByReport = reportContext?.id
        ? await queryHelpers
            .queryAll<any>(
              `SELECT id,
                      COALESCE(title, name) as title,
                      status,
                      report_id as "reportId"
               FROM initiatives
               WHERE report_id = ?
                  OR (source_type = 'assessment_report' AND source_id = ?)
               ORDER BY updated_at DESC
               LIMIT 200`,
              [String(reportContext.id), String(reportContext.id)]
            )
            .catch(() => [])
        : [];

      const existingInitiatives = (() => {
        const map = new Map<string, any>();
        for (const r of [...(existingByReport || []), ...(existingByAssessment || [])]) {
          if (!r?.id) continue;
          map.set(String(r.id), {
            id: String(r.id),
            title: String(r.title || ''),
            status: r.status ? String(r.status) : undefined,
            reportId: r.reportId ? String(r.reportId) : undefined,
          });
        }
        return Array.from(map.values());
      })();

      const baseContext = parseJsonSafely(assessment.context_snapshot, {});

      const enrichedAssessment: AssessmentRow = {
        ...(assessment as any),
        context_snapshot: JSON.stringify({
          ...baseContext,
          ...(reportContext ? { report: reportContext } : {}),
          ...(existingInitiatives.length ? { existingInitiatives } : {}),
        }),
      };

      const initiatives = await AssessmentInitiativeService.generateFromAssessment({
        assessment: enrichedAssessment,
        methodologyId,
        count,
        includeChatContext: Boolean(includeChatContext),
        reportContext: reportContext || null,
        existingInitiatives,
        userId: user.id,
      });

      // Persist initiatives
      const created = await AssessmentInitiativeService.persistInitiatives({
        assessment: enrichedAssessment,
        batchId,
        initiatives,
        reportId: reportContext?.id ? String(reportContext.id) : reportId ? String(reportId) : null,
        userId: user.id,
      });

      await logAudit(
        user.organizationId,
        user.id,
        'assessment_initiatives_generated',
        assessmentId,
        {
          batchId,
          count: initiatives.length,
          decisionId,
        }
      );

      // Log activity for timeline (non-blocking)
      assessmentAuditLogger
        .logInitiativesGenerated(req, assessmentId, initiatives.length)
        .catch((err: unknown) =>
          logger.warn('[Assessment] audit logInitiativesGenerated failed', err)
        );

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

      // --- Compute gaps from dimension scores ---
      type Gap = {
        dimensionId: string;
        dimensionName: string;
        current: number;
        target: number;
        gap: number;
        priority: 'high' | 'medium' | 'low';
      };

      const gaps: Gap[] = [];

      const addGap = (dimId: string, dimName: string, current: number, target: number) => {
        const gap = target - current;
        if (gap <= 0) return;
        const priority: Gap['priority'] = gap >= 3 ? 'high' : gap >= 2 ? 'medium' : 'low';
        gaps.push({ dimensionId: dimId, dimensionName: dimName, current, target, gap, priority });
      };

      const assessmentType = assessment.assessment_type;

      if (assessmentType === 'SIRI' && answers.siri?.dimensions) {
        for (const [dimId, d] of Object.entries(answers.siri.dimensions)) {
          const dim = d as { current?: number; target?: number };
          if (dim && typeof dim.current === 'number' && typeof dim.target === 'number') {
            addGap(dimId, dimId.replace(/_/g, ' '), dim.current, dim.target);
          }
        }
      } else if (assessmentType === 'ADMA' && answers.adma?.dimensions) {
        for (const [dimId, d] of Object.entries(answers.adma.dimensions)) {
          const dim = d as { current?: number; target?: number };
          if (dim && typeof dim.current === 'number' && typeof dim.target === 'number') {
            addGap(dimId, dimId.replace(/_/g, ' '), dim.current, dim.target);
          }
        }
      } else if (assessmentType === 'DRD' && answers.drd?.areas) {
        for (const [areaId, areaData] of Object.entries(answers.drd.areas)) {
          const area = areaData as { achievedLevel?: number; targetLevel?: number; name?: string };
          if (
            area &&
            typeof area.achievedLevel === 'number' &&
            typeof area.targetLevel === 'number'
          ) {
            addGap(areaId, area.name || `Area ${areaId}`, area.achievedLevel, area.targetLevel);
          }
        }
      }

      if (gaps.length === 0 && scoreSummary?.byAxis) {
        for (const [axisId, axisData] of Object.entries(scoreSummary.byAxis)) {
          const axis = axisData as {
            current?: number;
            target?: number;
            actual?: number;
            name?: string;
          };
          const current = axis.current ?? axis.actual ?? 0;
          const target = axis.target ?? 0;
          if (typeof current === 'number' && typeof target === 'number') {
            addGap(axisId, axis.name || axisId.replace(/_/g, ' '), current, target);
          }
        }
      }
      if (gaps.length === 0 && scoreSummary?.byDimension) {
        for (const [dimId, dimData] of Object.entries(scoreSummary.byDimension)) {
          const dim = dimData as {
            current?: number;
            target?: number;
            actual?: number;
            name?: string;
          };
          const current = dim.current ?? dim.actual ?? 0;
          const target = dim.target ?? 0;
          if (typeof current === 'number' && typeof target === 'number') {
            addGap(dimId, dim.name || dimId.replace(/_/g, ' '), current, target);
          }
        }
      }

      gaps.sort((a, b) => b.gap - a.gap);

      // --- Compute recommendations from gaps ---
      type Recommendation = {
        dimensionId: string;
        title: string;
        description: string;
        priority: string;
        estimatedEffort: string;
      };

      const recommendations: Recommendation[] = gaps
        .filter((g) => g.priority === 'high' || g.priority === 'medium')
        .map((g) => {
          const effortMap: Record<string, string> = { high: 'high', medium: 'medium', low: 'low' };
          return {
            dimensionId: g.dimensionId,
            title: `Improve ${g.dimensionName} from level ${g.current} to ${g.target}`,
            description:
              g.gap >= 3
                ? `Critical gap of ${g.gap} levels in ${g.dimensionName}. Requires a dedicated transformation initiative with cross-functional involvement and phased milestones.`
                : `Moderate gap of ${g.gap} levels in ${g.dimensionName}. Targeted improvement actions can close this gap within a structured program.`,
            priority: g.priority,
            estimatedEffort: effortMap[g.priority] || 'medium',
          };
        });

      // --- Compute executive summary ---
      const overallScore = Number(scoreSummary?.overall?.actual || scoreSummary?.overallScore || 0);
      const highGaps = gaps.filter((g) => g.priority === 'high');
      const topAreas = highGaps
        .slice(0, 3)
        .map((g) => g.dimensionName)
        .join(', ');

      const executiveSummary =
        gaps.length > 0
          ? `Assessment "${assessment.name}" (${assessmentType}) achieved an overall score of ${overallScore.toFixed(1)}. ` +
            `${gaps.length} gap${gaps.length !== 1 ? 's' : ''} identified across assessed dimensions` +
            (highGaps.length > 0
              ? `, with ${highGaps.length} high-priority gap${highGaps.length !== 1 ? 's' : ''} requiring immediate attention` +
                (topAreas ? ` in: ${topAreas}` : '') +
                '.'
              : '.') +
            ` ${recommendations.length} recommendation${recommendations.length !== 1 ? 's' : ''} generated.`
          : `Assessment "${assessment.name}" (${assessmentType}) completed with an overall score of ${overallScore.toFixed(1)}. No significant gaps identified between current and target states.`;

      const reportContent = {
        executiveSummary,
        scores: scoreSummary,
        gaps,
        recommendations,
        generatedAt: now,
      };

      // FIX (NOT-NULL sweep): assessment_reports.organization_id is NOT NULL with no
      // DB default (Postgres) — omitting it 500s with 23502. Resolve from the
      // already-fetched assessment (same org already enforced by the WHERE above).
      await queryHelpers.queryRun(
        `INSERT INTO assessment_reports (id, assessment_id, organization_id, version, status, content_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          assessmentId,
          user.organizationId,
          newVersion,
          'DRAFT',
          JSON.stringify(reportContent),
          user.id,
          now,
          now,
        ]
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
   * Get per-user state for an assessment (enterprise resume)
   */
  static getUserState = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureAssessmentSchema();

      const row = (await queryHelpers.queryOne(
        `SELECT navigation_json, updated_at
         FROM assessment_user_state
         WHERE assessment_id = ? AND user_id = ?`,
        [assessmentId, user.id]
      )) as { navigation_json?: string | null; updated_at?: string | null } | null;

      const parseJsonSafely = (
        jsonString: string | null | undefined,
        fallback: any = null
      ): any => {
        if (!jsonString) return fallback;
        try {
          return JSON.parse(jsonString);
        } catch {
          return fallback;
        }
      };

      res.json({
        assessmentId,
        userId: user.id,
        navigation: parseJsonSafely(row?.navigation_json, null),
        updatedAt: row?.updated_at || null,
      });
    }
  );

  /**
   * Update per-user state for an assessment (enterprise resume)
   */
  static updateUserState = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureAssessmentSchema();

      const { navigation } = req.body || {};
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO assessment_user_state (assessment_id, user_id, navigation_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (assessment_id, user_id) DO UPDATE SET
           navigation_json = excluded.navigation_json,
           updated_at = excluded.updated_at`,
        [assessmentId, user.id, JSON.stringify(navigation || {}), now]
      );

      res.json({ assessmentId, userId: user.id, updatedAt: now });
    }
  );

  /**
   * List assignments for an assessment (enterprise)
   */
  static listAssignments = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureAssessmentSchema();

      const rows = await queryHelpers.queryAll(
        `SELECT id, assessment_id, area_id, assigned_user_id, assigned_by, assigned_at, due_at, status
         FROM assessment_area_assignments
         WHERE assessment_id = ?
         ORDER BY area_id ASC`,
        [assessmentId]
      );

      res.json({ assessmentId, assignments: rows || [] });
    }
  );

  /**
   * Upsert assignment for an area (enterprise)
   */
  static upsertAssignment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      const { assessmentId } = req.params;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await ensureAssessmentSchema();

      const { areaId, assignedUserId, dueAt, status } = req.body || {};
      if (!areaId || !assignedUserId) {
        res.status(400).json({ error: 'areaId and assignedUserId are required' });
        return;
      }

      const now = new Date().toISOString();
      const id = uuidv4();
      const nextStatus = status || 'ACTIVE';

      await queryHelpers.queryRun(
        `INSERT INTO assessment_area_assignments (id, assessment_id, area_id, assigned_user_id, assigned_by, assigned_at, due_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (assessment_id, area_id) DO UPDATE SET
           assigned_user_id = excluded.assigned_user_id,
           assigned_by = excluded.assigned_by,
           assigned_at = excluded.assigned_at,
           due_at = excluded.due_at,
           status = excluded.status`,
        [
          id,
          assessmentId,
          String(areaId),
          String(assignedUserId),
          user.id,
          now,
          dueAt || null,
          nextStatus,
        ]
      );

      res.json({
        assessmentId,
        areaId: String(areaId),
        assignedUserId: String(assignedUserId),
        dueAt: dueAt || null,
        status: nextStatus,
        updatedAt: now,
      });
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

      const mapped = (assessments as AssessmentRow[]).map((a) => ({
        ...a,
        status: normalizeStatus(a.status),
        backendStatus: a.status,
        answers: a.answers_json ? JSON.parse(a.answers_json) : {},
        scoreSummary: a.score_summary ? JSON.parse(a.score_summary) : {},
      }));

      const lim = Number(limit ?? 100) || 100;
      const off = Number(offset ?? 0) || 0;

      res.json({
        // Canonical list shape expected by new hubs
        items: mapped,
        total: mapped.length,
        limit: lim,
        offset: off,
        // Backwards-compat for older call sites
        assessments: mapped,
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
