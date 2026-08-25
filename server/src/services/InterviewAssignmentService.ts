/**
 * Interview Assignment Service
 *
 * Manages interview assignments workflow with:
 * - Single and team assignments
 * - Reminder system (48h, 24h, 2h before deadline)
 * - Auto-escalation after deadline
 * - Notification dispatch (email + in-app)
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';
import emailService from './emailService.js';
import {
  buildAssignmentManagerScopeClause,
  type InterviewManagerScope,
} from './interviewManagerScope.js';
import notificationService from './notificationService.js';

import {
  canonicalStatusToken,
  statusEqualsSql,
  statusInSql,
} from './interview/interviewStatusNormalization.js';

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

// Robust 0/1 flag coercion — is_team_assignment is BIGINT on Postgres, returned
// by node-pg as a STRING ("1"/"0"), so a bare `x === 1` is always false.
const flagOn = (v: unknown): boolean => v === true || Number(v) === 1;

// ==========================================
// TYPES
// ==========================================

// NOTE: 'completed' is kept for backward compatibility (legacy). Canon uses 'approved' as final reviewed state.
export type AssignmentStatus =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'sent_back'
  | 'approved'
  | 'completed';
export type AssignmentPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TeamMemberRole = 'lead' | 'member';
export type InterviewAiFixType =
  | 'clarify'
  | 'add_evidence'
  | 'expand_answer'
  | 'make_specific'
  | 'complete_required_fields'
  | 'correct_meaning';
export type InterviewAiAnswerVerdict =
  | 'sufficient'
  | 'needs_improvement'
  | 'insufficient'
  | 'unanswered';
export type InterviewAiOverallVerdict =
  | 'ready_for_approval'
  | 'needs_improvement'
  | 'insufficient'
  | 'empty';
export type InterviewReviewAlignment =
  | 'aligned'
  | 'manager_stricter_than_ai'
  | 'manager_overrode_ai_warning'
  | 'no_ai_signal';

// #48a — objective scoring rubric (Oxford style): each answer is judged on
// named criteria (concreteness/evidence/depth/measurability/coherence),
// 0-4 each, with a per-criterion justification. See INTERVIEW_RUBRIC_CRITERIA
// in InterviewController.ts (the rubric is code, not a black box).
export interface InterviewAiRubricCriterionResult {
  criterion: string;
  label: string;
  score: number;
  maxScore: number;
  justification: string;
}

export interface InterviewAiWeakAnswerItem {
  key: string;
  label: string;
  questionId?: string;
  sectionId?: string;
  score: number;
  verdict: InterviewAiAnswerVerdict;
  feedback: string;
  fixType: InterviewAiFixType;
  isRequired: boolean;
  rubric?: InterviewAiRubricCriterionResult[];
}

export interface InterviewAiReviewSnapshot {
  overallScore: number;
  overallVerdict: InterviewAiOverallVerdict;
  questionEvaluations: Array<{
    questionId: string;
    score: number;
    verdict: InterviewAiAnswerVerdict;
    feedback: string;
    fixType: InterviewAiFixType;
    rubric?: InterviewAiRubricCriterionResult[];
    rubricTotal?: number;
    rubricMax?: number;
  }>;
  recommendations: string[];
  weakAnswerMap: InterviewAiWeakAnswerItem[];
  rubricVersion?: string;
  rubricCriteria?: Array<{ key: string; label: string; description: string; maxScore: number }>;
}

export interface InterviewReviewDecisionMemoryEntry {
  id: string;
  action: 'approve' | 'send_back';
  actorId: string;
  actorRole?: string;
  createdAt: string;
  aiOverallVerdict: InterviewAiOverallVerdict;
  aiOverallScore: number | null;
  aiWeakAnswerCount: number;
  alignment: InterviewReviewAlignment;
  reason?: string;
  missingItems?: Array<{
    key: string;
    label: string;
    questionId?: string;
    sectionId?: string;
  }>;
}

export interface CreateAssignmentInput {
  organizationId: string;
  projectId?: string;
  templateId: string;
  templateVersion?: number;
  assigneeUserIds: string[]; // Can be single or multiple for team
  teamLeadId?: string; // If team assignment, who is lead
  dueAt: string; // ISO date string
  priority?: AssignmentPriority;
  escalateTo?: string; // User ID for escalation (defaults to createdBy)
  notes?: string;
  createdBy: string;
  processRef?: string;
  isAnonymous?: boolean; // D18-A — anonymous survey mode (default false)
  createRequestKey?: string;
  createRequestFingerprint?: string;
}

export interface Assignment {
  id: string;
  organizationId: string;
  projectId?: string;
  assigneeUserId: string; // Primary assignee (or lead for team)
  templateId: string;
  templateVersion: number;
  processRef?: string;
  status: AssignmentStatus;
  sessionId?: string;
  taskId?: string;
  dueAt?: string;
  startedAt?: string;
  submittedAt?: string;
  sentBackAt?: string;
  sentBackReason?: string;
  aiReview?: InterviewAiReviewSnapshot | null;
  aiReviewedAt?: string;
  reviewDecisionMemory?: InterviewReviewDecisionMemoryEntry[];
  priority: AssignmentPriority;
  reminderSentAt?: string;
  reminderCount: number;
  lastReminderType?: string;
  escalatedAt?: string;
  escalationCount: number;
  escalateTo?: string; // User ID for escalation target
  isTeamAssignment: boolean;
  isAnonymous: boolean; // D18-A — anonymous survey mode (default false)
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentMember {
  id: string;
  assignmentId: string;
  userId: string;
  role: TeamMemberRole;
  progressPercent: number;
  joinedAt: string;
  completedAt?: string;
}

export interface AssignmentWithDetails extends Assignment {
  template?: {
    id: string;
    name: string;
    description?: string;
    category?: string;
  };
  session?: {
    id: string;
    status: string;
    answeredQuestions: number;
    totalQuestions: number;
    completenessPercent: number;
  } | null;
  members?: AssignmentMember[];
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
}

// ==========================================
// REMINDER WINDOWS (in hours before deadline)
// ==========================================

const REMINDER_WINDOWS = {
  REMINDER_48H: 48,
  REMINDER_24H: 24,
  REMINDER_2H: 2,
} as const;

// ==========================================
// SERVICE CLASS
// ==========================================

class InterviewAssignmentService {
  private db: IDatabase | null = null;
  private schemaCompatibilityPromise: Promise<void> | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    if (!this.schemaCompatibilityPromise) {
      this.schemaCompatibilityPromise = this.ensureSchemaCompatibility(this.db).catch((error) => {
        this.schemaCompatibilityPromise = null;
        throw error;
      });
    }
    await this.schemaCompatibilityPromise;
    return this.db;
  }

  private async ensureSchemaCompatibility(db: IDatabase): Promise<void> {
    const querySafe = async (sql: string, params: unknown[] = []) => {
      try {
        await db.query(sql, params);
      } catch (error) {
        const message = String((error as Error)?.message || error || '');
        if (
          message.includes('already exists') ||
          message.includes('duplicate column') ||
          message.includes('multiple primary keys')
        ) {
          return;
        }
        throw error;
      }
    };

    const tableExists = async (tableName: string): Promise<boolean> => {
      const result = await db.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
         LIMIT 1`,
        [tableName]
      );
      return result.rows.length > 0;
    };

    const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
      const result = await db.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
         LIMIT 1`,
        [tableName, columnName]
      );
      return result.rows.length > 0;
    };

    await querySafe(`
      CREATE TABLE IF NOT EXISTS interview_assignments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT,
        assignee_user_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        template_version INTEGER NOT NULL DEFAULT 1,
        process_ref TEXT,
        status TEXT NOT NULL DEFAULT 'assigned',
        session_id TEXT,
        task_id TEXT,
        due_at TIMESTAMP,
        started_at TIMESTAMP,
        submitted_at TIMESTAMP,
        sent_back_at TIMESTAMP,
        sent_back_reason TEXT,
        priority TEXT DEFAULT 'medium',
        reminder_sent_at TIMESTAMP,
        reminder_count INTEGER DEFAULT 0,
        last_reminder_type TEXT,
        escalated_at TIMESTAMP,
        escalation_count INTEGER DEFAULT 0,
        is_team_assignment INTEGER DEFAULT 0,
        notes TEXT,
        escalate_to TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const ensureAssignmentColumn = async (columnName: string, ddl: string) => {
      if (!(await columnExists('interview_assignments', columnName))) {
        await querySafe(`ALTER TABLE interview_assignments ADD COLUMN ${ddl}`);
      }
    };

    await ensureAssignmentColumn('project_id', 'project_id TEXT');
    await ensureAssignmentColumn('priority', `priority TEXT DEFAULT 'medium'`);
    await ensureAssignmentColumn('reminder_sent_at', 'reminder_sent_at TIMESTAMP');
    await ensureAssignmentColumn('reminder_count', 'reminder_count INTEGER DEFAULT 0');
    await ensureAssignmentColumn('last_reminder_type', 'last_reminder_type TEXT');
    await ensureAssignmentColumn('escalated_at', 'escalated_at TIMESTAMP');
    await ensureAssignmentColumn('escalation_count', 'escalation_count INTEGER DEFAULT 0');
    await ensureAssignmentColumn('is_team_assignment', 'is_team_assignment INTEGER DEFAULT 0');
    await ensureAssignmentColumn('notes', 'notes TEXT');
    await ensureAssignmentColumn('escalate_to', 'escalate_to TEXT');
    await ensureAssignmentColumn('ai_review_snapshot_json', 'ai_review_snapshot_json TEXT');
    await ensureAssignmentColumn('ai_reviewed_at', 'ai_reviewed_at TIMESTAMP');
    await ensureAssignmentColumn('review_decision_memory_json', 'review_decision_memory_json TEXT');
    // D18-A — anonymous survey mode. Default FALSE: zero behavior change for
    // existing assignments. Canonical migration:
    // server/migrations/922_interview_anonymity_wall.sql (not auto-applied).
    await ensureAssignmentColumn('is_anonymous', 'is_anonymous BOOLEAN DEFAULT FALSE');

    await querySafe(`
      CREATE TABLE IF NOT EXISTS interview_assignment_members (
        id TEXT PRIMARY KEY,
        assignment_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        progress_percent INTEGER DEFAULT 0,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(assignment_id, user_id)
      )
    `);

    await querySafe(`
      CREATE TABLE IF NOT EXISTS interview_notifications (
        id TEXT PRIMARY KEY,
        assignment_id TEXT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        channel TEXT NOT NULL,
        title TEXT,
        body TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (await tableExists('interview_assignments')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_interview_assignments_org_assignee_status
         ON interview_assignments(organization_id, assignee_user_id, status)`
      );
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_interview_assignments_due_status
         ON interview_assignments(due_at, status)`
      );
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_interview_assignments_project
         ON interview_assignments(project_id)`
      );
    }

    if (await tableExists('interview_assignment_members')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_interview_assignment_members_assignment
         ON interview_assignment_members(assignment_id)`
      );
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_interview_assignment_members_user
         ON interview_assignment_members(user_id)`
      );
    }

    if (await tableExists('interview_notifications')) {
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_interview_notifications_assignment
         ON interview_notifications(assignment_id)`
      );
      await querySafe(
        `CREATE INDEX IF NOT EXISTS idx_interview_notifications_user
         ON interview_notifications(user_id)`
      );
    }
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  /**
   * Create a new assignment (single or team)
   */
  async create(input: CreateAssignmentInput): Promise<Assignment> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const id = `ia_${uuidv4()}`;

    const isTeam = input.assigneeUserIds.length > 1;
    const primaryAssignee = input.teamLeadId || input.assigneeUserIds[0];

    // Create main assignment record
    await db.run(
      `INSERT INTO interview_assignments
       (id, organization_id, project_id, assignee_user_id, template_id, template_version,
        process_ref, status, due_at, priority, is_team_assignment, is_anonymous, notes, escalate_to,
        created_by, create_request_key, create_request_fingerprint, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.projectId || null,
        primaryAssignee,
        input.templateId,
        input.templateVersion || 1,
        input.processRef || null,
        'assigned',
        input.dueAt,
        input.priority || 'medium',
        isTeam ? 1 : 0,
        input.isAnonymous === true, // D18-A — default false, zero change for existing callers
        input.notes || null,
        input.escalateTo || input.createdBy, // Default to creator if not specified
        input.createdBy,
        input.createRequestKey || null,
        input.createRequestFingerprint || null,
        now,
        now,
      ]
    );

    // If team assignment, create member records
    if (isTeam) {
      for (const userId of input.assigneeUserIds) {
        const memberId = `iam_${uuidv4()}`;
        const role: TeamMemberRole = userId === input.teamLeadId ? 'lead' : 'member';

        await db.run(
          `INSERT INTO interview_assignment_members
           (id, assignment_id, user_id, role, progress_percent, joined_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [memberId, id, userId, role, 0, now, now, now]
        );
      }
    }

    // Create mirrored task in MyWork module
    await this.createMirrorTask(db, {
      assignmentId: id,
      organizationId: input.organizationId,
      projectId: input.projectId,
      templateId: input.templateId,
      assigneeId: primaryAssignee,
      reporterId: input.createdBy,
      dueAt: input.dueAt,
      priority: input.priority || 'medium',
    });

    // Send notification to all assignees
    await this.sendAssignmentNotification(id, input.assigneeUserIds, input.organizationId);

    logger.info(
      `[InterviewAssignmentService] Created assignment ${id} for ${input.assigneeUserIds.length} user(s)`
    );

    return this.getById(id) as Promise<Assignment>;
  }

  /**
   * Get assignment by ID
   */
  async getById(id: string): Promise<Assignment | null> {
    const db = await this.getDb();
    const row = await db.get<any>(`SELECT * FROM interview_assignments WHERE id = ?`, [id]);
    return row ? this.mapRowToAssignment(row) : null;
  }

  /**
   * Get assignment with full details (template, session, members)
   */
  async getByIdWithDetails(id: string): Promise<AssignmentWithDetails | null> {
    const db = await this.getDb();

    const row = await db.get<any>(
      `SELECT
         a.*,
         t.name as template_name,
         t.description as template_description,
         t.category as template_category,
         s.id as session_id,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as assignee_name,
         u.email as assignee_email
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       WHERE a.id = ?`,
      [id]
    );

    if (!row) return null;

    const assignment = this.mapRowToAssignment(row) as AssignmentWithDetails;

    // Add template info
    assignment.template = row.template_name
      ? {
          id: row.template_id,
          name: row.template_name,
          description: row.template_description,
          category: row.template_category,
        }
      : undefined;

    // Add session info
    if (row.session_id) {
      const total = row.total_questions || 0;
      const answered = row.answered_questions || 0;
      assignment.session = {
        id: row.session_id,
        status: row.session_status,
        answeredQuestions: answered,
        totalQuestions: total,
        completenessPercent: total > 0 ? Math.round((answered / total) * 100) : 0,
      };
    }

    // Add assignee info
    if (row.assignee_name) {
      assignment.assignee = {
        id: row.assignee_user_id,
        name: row.assignee_name,
        email: row.assignee_email,
      };
    }

    // Load team members if team assignment
    if (assignment.isTeamAssignment) {
      const members = await db.all<any>(
        `SELECT * FROM interview_assignment_members WHERE assignment_id = ?`,
        [id]
      );
      assignment.members = (members || []).map(this.mapRowToMember);
    }

    return assignment;
  }

  /**
   * Update assignment
   */
  async update(id: string, updates: Partial<Assignment>): Promise<Assignment | null> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.status !== undefined) {
      // M03R-004: zapis zawsze w kanonicznej postaci — to jedyne miejsce, które
      // wpuszcza status do kolumny przez `update()`.
      fields.push('status = ?');
      values.push(canonicalStatusToken(updates.status));
    }
    if (updates.dueAt !== undefined) {
      fields.push('due_at = ?');
      values.push(updates.dueAt);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.sessionId !== undefined) {
      fields.push('session_id = ?');
      values.push(updates.sessionId);
    }
    if (updates.startedAt !== undefined) {
      fields.push('started_at = ?');
      values.push(updates.startedAt);
    }
    if (updates.submittedAt !== undefined) {
      fields.push('submitted_at = ?');
      values.push(updates.submittedAt);
    }
    if (updates.sentBackAt !== undefined) {
      fields.push('sent_back_at = ?');
      values.push(updates.sentBackAt);
    }
    if (updates.sentBackReason !== undefined) {
      fields.push('sent_back_reason = ?');
      values.push(updates.sentBackReason);
    }

    values.push(id);

    await db.run(`UPDATE interview_assignments SET ${fields.join(', ')} WHERE id = ?`, values);

    return this.getById(id);
  }

  /**
   * Delete assignment (only if not started)
   */
  async delete(id: string): Promise<boolean> {
    const db = await this.getDb();
    const assignment = await this.getById(id);

    if (!assignment) return false;
    if (canonicalStatusToken(assignment.status) !== 'assigned') {
      throw new Error('Cannot delete assignment that has been started');
    }

    // Delete mirror task
    if (assignment.taskId) {
      await db.run(`DELETE FROM tasks WHERE id = ?`, [assignment.taskId]);
    }

    // Delete members (cascade should handle this, but explicit)
    await db.run(`DELETE FROM interview_assignment_members WHERE assignment_id = ?`, [id]);

    // Delete assignment
    await db.run(`DELETE FROM interview_assignments WHERE id = ?`, [id]);

    logger.info(`[InterviewAssignmentService] Deleted assignment ${id}`);
    return true;
  }

  // ==========================================
  // TEAM MEMBER MANAGEMENT
  // ==========================================

  /**
   * Add team member to assignment
   */
  async addTeamMember(
    assignmentId: string,
    userId: string,
    role: TeamMemberRole = 'member'
  ): Promise<AssignmentMember> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const id = `iam_${uuidv4()}`;

    await db.run(
      `INSERT INTO interview_assignment_members
       (id, assignment_id, user_id, role, progress_percent, joined_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, assignmentId, userId, role, 0, now, now, now]
    );

    // Mark assignment as team if not already
    await db.run(
      `UPDATE interview_assignments SET is_team_assignment = 1, updated_at = ? WHERE id = ?`,
      [now, assignmentId]
    );

    // Send notification to new member
    const assignment = await this.getById(assignmentId);
    if (assignment) {
      await this.sendAssignmentNotification(assignmentId, [userId], assignment.organizationId);
    }

    logger.info(
      `[InterviewAssignmentService] Added member ${userId} to assignment ${assignmentId}`
    );

    return { id, assignmentId, userId, role, progressPercent: 0, joinedAt: now };
  }

  /**
   * Remove team member from assignment
   */
  async removeTeamMember(assignmentId: string, userId: string): Promise<boolean> {
    const db = await this.getDb();

    // Check if this is the primary assignee
    const assignment = await this.getById(assignmentId);
    if (assignment?.assigneeUserId === userId) {
      throw new Error('Cannot remove primary assignee. Reassign the assignment first.');
    }

    await db.run(
      `DELETE FROM interview_assignment_members WHERE assignment_id = ? AND user_id = ?`,
      [assignmentId, userId]
    );

    // Check remaining members
    const remaining = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM interview_assignment_members WHERE assignment_id = ?`,
      [assignmentId]
    );

    // If only one member left, mark as non-team
    if (remaining && remaining.count <= 1) {
      await db.run(
        `UPDATE interview_assignments SET is_team_assignment = 0, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), assignmentId]
      );
    }

    logger.info(
      `[InterviewAssignmentService] Removed member ${userId} from assignment ${assignmentId}`
    );
    return true;
  }

  /**
   * Get team members for assignment
   */
  async getTeamMembers(assignmentId: string): Promise<AssignmentMember[]> {
    const db = await this.getDb();
    // I2 — the users table has first_name/last_name, NOT a `name` column. The
    // previous `u.name` threw `column u.name does not exist` on Postgres,
    // 500-ing the GET /assignments/:id/members route for every team assignment.
    const rows = await db.all<any>(
      `SELECT m.*,
              TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as user_name,
              u.email as user_email
       FROM interview_assignment_members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.assignment_id = ?`,
      [assignmentId]
    );
    return (rows || []).map(this.mapRowToMember);
  }

  // ==========================================
  // QUERY METHODS
  // ==========================================

  /**
   * Get assignments for a user (their tasks to do)
   */
  async getMyAssignments(
    userId: string,
    organizationId: string,
    options?: {
      status?: AssignmentStatus;
      includeCompleted?: boolean;
    }
  ): Promise<AssignmentWithDetails[]> {
    const db = await this.getDb();
    const params: any[] = [organizationId, userId, userId];

    let where = `WHERE a.organization_id = ? AND (a.assignee_user_id = ? OR EXISTS (
      SELECT 1
      FROM interview_assignment_members m
      WHERE m.assignment_id = a.id AND m.user_id = ?
    ))`;

    if (options?.status) {
      // Compatibility read: historyczne wiersze mają wariant WIELKIMI literami.
      where += ` AND ${statusEqualsSql('a.status')}`;
      params.push(canonicalStatusToken(options.status));
    } else if (!options?.includeCompleted) {
      where += ` AND NOT ${statusEqualsSql('a.status')}`;
      params.push(canonicalStatusToken('completed'));
    }

    const rows = await db.all<any>(
      `SELECT
         a.*,
         t.name as template_name,
         t.description as template_description,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as assignee_name,
         u.email as assignee_email
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       ${where}
       ORDER BY
         CASE a.status WHEN 'assigned' THEN 0 WHEN 'sent_back' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'submitted' THEN 3 ELSE 4 END,
         COALESCE(a.due_at, '9999-12-31') ASC`,
      params
    );

    return (rows || []).map((row: any) => this.mapRowToAssignmentWithDetails(row));
  }

  /**
   * Get assignments managed by a user.
   * Elevated roles (OWNER/ADMIN/SUPERADMIN) can see org-wide assignments.
   */
  async getManagedAssignments(
    managerId: string,
    organizationId: string,
    options?: {
      projectId?: string;
      status?: AssignmentStatus;
      elevated?: boolean;
      scope?: InterviewManagerScope;
    }
  ): Promise<AssignmentWithDetails[]> {
    const db = await this.getDb();
    const params: any[] = [organizationId];
    const scope =
      options?.scope ||
      (options?.elevated ? { kind: 'organization' } : { kind: 'creator', creatorId: managerId });
    const scopeClause = buildAssignmentManagerScopeClause(scope, { assignmentAlias: 'a' });

    let where = `WHERE a.organization_id = ?${scopeClause.clause}`;
    params.push(...scopeClause.params);

    if (options?.projectId) {
      where += ` AND a.project_id = ?`;
      params.push(options.projectId);
    }

    if (options?.status) {
      where += ` AND ${statusEqualsSql('a.status')}`;
      params.push(canonicalStatusToken(options.status));
    }

    const rows = await db.all<any>(
      `SELECT
         a.*,
         t.name as template_name,
         t.description as template_description,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as assignee_name,
         u.email as assignee_email
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       ${where}
       ORDER BY a.created_at DESC`,
      params
    );

    return (rows || []).map((row: any) => this.mapRowToAssignmentWithDetails(row));
  }

  /**
   * Get overdue assignments
   */
  async getOverdueAssignments(
    organizationId?: string,
    options?: { scope?: InterviewManagerScope }
  ): Promise<AssignmentWithDetails[]> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const params: any[] = [now];

    let where = `WHERE a.due_at < ? AND a.status NOT IN ('completed', 'submitted')`;

    if (organizationId) {
      where += ` AND a.organization_id = ?`;
      params.push(organizationId);
    }
    if (options?.scope) {
      const scopeClause = buildAssignmentManagerScopeClause(options.scope, {
        assignmentAlias: 'a',
      });
      where += scopeClause.clause;
      params.push(...scopeClause.params);
    }

    const rows = await db.all<any>(
      `SELECT
         a.*,
         t.name as template_name,
         t.description as template_description,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as assignee_name,
         u.email as assignee_email,
         TRIM(COALESCE(creator.first_name, '') || ' ' || COALESCE(creator.last_name, '')) as creator_name,
         creator.email as creator_email
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       LEFT JOIN users creator ON creator.id = a.created_by
       ${where}
       ORDER BY a.due_at ASC`,
      params
    );

    return (rows || []).map((row: any) => this.mapRowToAssignmentWithDetails(row));
  }

  /**
   * Get overdue count for a manager
   */
  async getOverdueCount(
    managerId: string,
    organizationId: string,
    options?: { scope?: InterviewManagerScope }
  ): Promise<number> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const scope = options?.scope || { kind: 'creator', creatorId: managerId };
    const scopeClause = buildAssignmentManagerScopeClause(scope, {
      assignmentAlias: 'interview_assignments',
    });

    const result = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM interview_assignments
       WHERE organization_id = ?
         ${scopeClause.clause}
         AND due_at < ?
         AND status NOT IN ('completed', 'submitted')`,
      [organizationId, ...scopeClause.params, now]
    );

    return result?.count || 0;
  }

  // ==========================================
  // REMINDER SYSTEM
  // ==========================================

  /**
   * Send manual reminder for an assignment
   */
  async sendReminder(assignmentId: string, senderId: string): Promise<boolean> {
    const assignment = await this.getByIdWithDetails(assignmentId);
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const recipients =
      assignment.isTeamAssignment && assignment.members
        ? assignment.members.map((m) => m.userId)
        : [assignment.assigneeUserId];

    await this.dispatchReminder(assignment, recipients, 'manual', senderId);

    logger.info(
      `[InterviewAssignmentService] Manual reminder sent for ${assignmentId} by ${senderId}`
    );
    return true;
  }

  /**
   * Check and send automatic reminders (called by cron job)
   */
  async checkAndSendReminders(): Promise<{ sent: number; errors: number }> {
    const db = await this.getDb();
    const now = new Date();
    let sent = 0;
    let errors = 0;

    // Get assignments that need reminders
    const assignments = await db.all<any>(
      `SELECT a.*, t.name as template_name
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       WHERE ${statusInSql('a.status', ['assigned', 'in_progress', 'sent_back'])}
         AND a.due_at IS NOT NULL
         AND a.due_at > ?`,
      [now.toISOString()]
    );

    for (const row of assignments || []) {
      try {
        const dueAt = new Date(row.due_at);
        const hoursUntilDue = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
        const lastReminderType = row.last_reminder_type;

        let reminderType: string | null = null;

        // Determine which reminder to send based on time window
        if (hoursUntilDue <= REMINDER_WINDOWS.REMINDER_2H && lastReminderType !== 'reminder_2h') {
          reminderType = 'reminder_2h';
        } else if (
          hoursUntilDue <= REMINDER_WINDOWS.REMINDER_24H &&
          hoursUntilDue > REMINDER_WINDOWS.REMINDER_2H &&
          lastReminderType !== 'reminder_24h' &&
          lastReminderType !== 'reminder_2h'
        ) {
          reminderType = 'reminder_24h';
        } else if (
          hoursUntilDue <= REMINDER_WINDOWS.REMINDER_48H &&
          hoursUntilDue > REMINDER_WINDOWS.REMINDER_24H &&
          !lastReminderType
        ) {
          reminderType = 'reminder_48h';
        }

        if (reminderType) {
          const assignment = this.mapRowToAssignment(row) as AssignmentWithDetails;
          assignment.template = { id: row.template_id, name: row.template_name };

          // Get recipients
          let recipients = [assignment.assigneeUserId];
          if (assignment.isTeamAssignment) {
            const members = await this.getTeamMembers(assignment.id);
            recipients = members.map((m) => m.userId);
          }

          await this.dispatchReminder(assignment, recipients, reminderType);

          // Update assignment
          await db.run(
            `UPDATE interview_assignments
             SET reminder_sent_at = ?, reminder_count = reminder_count + 1, last_reminder_type = ?, updated_at = ?
             WHERE id = ?`,
            [now.toISOString(), reminderType, now.toISOString(), assignment.id]
          );

          sent++;
        }
      } catch (err) {
        logger.error(`[InterviewAssignmentService] Reminder error for ${row.id}:`, err);
        errors++;
      }
    }

    logger.info(
      `[InterviewAssignmentService] Reminder check complete: ${sent} sent, ${errors} errors`
    );
    return { sent, errors };
  }

  /**
   * Check and escalate overdue assignments (called by cron job)
   */
  async checkAndEscalate(): Promise<{ escalated: number; errors: number }> {
    const db = await this.getDb();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    let escalated = 0;
    let errors = 0;

    // Get overdue assignments that need escalation
    const assignments = await db.all<any>(
      `SELECT a.*, t.name as template_name, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as assignee_name, 
              escalation_target.id as escalation_user_id,
              escalation_target.email as escalation_email,
              (escalation_target.first_name || ' ' || escalation_target.last_name) as escalation_name
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       LEFT JOIN users escalation_target ON escalation_target.id = COALESCE(a.escalate_to, a.created_by)
       WHERE ${statusInSql('a.status', ['assigned', 'in_progress', 'sent_back'])}
         AND a.due_at IS NOT NULL
         AND a.due_at < ?
         AND (a.escalated_at IS NULL OR a.escalated_at < ?)`,
      [oneHourAgo.toISOString(), new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()]
    );

    for (const row of assignments || []) {
      try {
        // Send escalation to the designated escalation target (or creator as fallback)
        if (row.escalation_user_id && row.escalation_email) {
          const dueAt = new Date(row.due_at);
          const overdueDays = Math.floor((now.getTime() - dueAt.getTime()) / (1000 * 60 * 60 * 24));

          await notificationService.send({
            userId: row.escalation_user_id,
            organizationId: row.organization_id,
            type: 'interview_escalation',
            title: 'Interview Assignment Overdue',
            body: `The interview "${row.template_name}" assigned to ${row.assignee_name} is overdue by ${overdueDays} day(s).`,
            entityType: 'interview_assignment',
            entityId: row.id,
            actionUrl: `/interview?assignmentId=${row.id}`,
            priority: 'high',
          });

          // N2 (DEC-2026-08-25-21): the manual sendEscalationEmail() call
          // and its interview_notifications 'email' log row that used to
          // live here were a DUPLICATE, preference-blind send:
          // `interview_escalation` is already registered
          // (server/migrations/303_interview_assignments_extended.sql:89-98)
          // with default_channels ["in_app","email"], so the
          // notificationService.send() call above already emails the
          // escalation target once, respecting their preferences.
          // Removing the second, unconditional send fixes both the
          // double-email bug and the audit's §1C bypass finding for this
          // call site in the same change.

          // Update assignment
          await db.run(
            `UPDATE interview_assignments
             SET escalated_at = ?, escalation_count = escalation_count + 1, updated_at = ?
             WHERE id = ?`,
            [now.toISOString(), now.toISOString(), row.id]
          );

          escalated++;
        }
      } catch (err) {
        logger.error(`[InterviewAssignmentService] Escalation error for ${row.id}:`, err);
        errors++;
      }
    }

    logger.info(
      `[InterviewAssignmentService] Escalation check complete: ${escalated} escalated, ${errors} errors`
    );
    return { escalated, errors };
  }

  // ==========================================
  // NOTIFICATION HELPERS
  // ==========================================

  private async sendAssignmentNotification(
    assignmentId: string,
    userIds: string[],
    organizationId: string
  ): Promise<void> {
    const assignment = await this.getByIdWithDetails(assignmentId);
    if (!assignment || !assignment.template) return;

    for (const userId of userIds) {
      try {
        await notificationService.send({
          userId,
          organizationId,
          type: 'interview_assigned',
          title: 'New Interview Assignment',
          body: `You have been assigned the interview: ${assignment.template.name}`,
          entityType: 'interview_assignment',
          entityId: assignmentId,
          actionUrl: `/interview?assignmentId=${assignmentId}`,
          priority: assignment.priority === 'urgent' ? 'urgent' : 'normal',
        });
      } catch (err) {
        logger.error(
          `[InterviewAssignmentService] Failed to send assignment notification to ${userId}:`,
          err
        );
      }
    }
  }

  private async dispatchReminder(
    assignment: AssignmentWithDetails,
    recipients: string[],
    reminderType: string,
    senderId?: string
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const templateName = assignment.template?.name || 'Interview';

    const titleMap: Record<string, string> = {
      reminder_48h: '48 Hours Until Deadline',
      reminder_24h: '24 Hours Until Deadline',
      reminder_2h: '2 Hours Until Deadline!',
      manual: 'Reminder: Interview Pending',
    };

    const bodyMap: Record<string, string> = {
      reminder_48h: `Your interview "${templateName}" is due in 48 hours.`,
      reminder_24h: `Your interview "${templateName}" is due tomorrow!`,
      reminder_2h: `URGENT: Your interview "${templateName}" is due in 2 hours!`,
      manual: `This is a reminder to complete your interview: ${templateName}`,
    };

    for (const userId of recipients) {
      try {
        // In-app notification
        await notificationService.send({
          userId,
          organizationId: assignment.organizationId,
          type: `interview_${reminderType}`,
          title: titleMap[reminderType] || 'Interview Reminder',
          body: bodyMap[reminderType] || `Please complete your interview: ${templateName}`,
          entityType: 'interview_assignment',
          entityId: assignment.id,
          actionUrl: `/interview?assignmentId=${assignment.id}`,
          priority: reminderType === 'reminder_2h' ? 'urgent' : 'high',
          actorId: senderId,
        });

        // Record in interview_notifications
        await db.run(
          `INSERT INTO interview_notifications (id, assignment_id, user_id, type, channel, title, body, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `in_${uuidv4()}`,
            assignment.id,
            userId,
            reminderType,
            'in_app',
            titleMap[reminderType],
            bodyMap[reminderType],
            now,
          ]
        );

        // N2 (DEC-2026-08-25-21): the manual email send that used to live
        // here (sendReminderEmail(), a direct emailService.send() call
        // with its own interview_notifications 'email' log row) was a
        // DUPLICATE, preference-blind send: `interview_${reminderType}` is
        // already registered (server/migrations/303_interview_assignments_extended.sql:89-98)
        // with default_channels including "email" for 48h/24h (and
        // correctly excluding it for 2h — too late for email, same as
        // this comment always said), so the notificationService.send()
        // call above already emails the recipient once, respecting their
        // preferences. Removing the second, unconditional send fixes both
        // the double-email bug and the audit's §1C bypass finding for
        // this call site in the same change — there is nothing left here
        // that needs a separate, unguarded email path.
      } catch (err) {
        logger.error(`[InterviewAssignmentService] Failed to send reminder to ${userId}:`, err);
      }
    }
  }

  /**
   * N2 (DEC-2026-08-25-21): no longer called — dispatchReminder() used to
   * call this in addition to notificationService.send(), sending every
   * 48h/24h reminder email twice and bypassing preferences on the second
   * send. Left in place (unused) rather than deleted, since removing it
   * is out of this ticket's scope.
   */
  private async sendReminderEmail(
    to: string,
    data: {
      userName: string;
      templateName: string;
      reminderType: string;
      dueAt?: string;
      assignmentId: string;
    }
  ): Promise<void> {
    const dueDate = data.dueAt ? new Date(data.dueAt).toLocaleDateString() : 'soon';

    await emailService.send({
      to,
      subject: `Reminder: Interview "${data.templateName}" due ${dueDate}`,
      html: `
        <h2>Interview Reminder</h2>
        <p>Hi ${data.userName},</p>
        <p>This is a reminder that your interview <strong>"${data.templateName}"</strong> is due on <strong>${dueDate}</strong>.</p>
        <p>Please complete it as soon as possible.</p>
        <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/interview?assignmentId=${data.assignmentId}">Click here to continue the interview</a></p>
        <p>Best regards,<br>The Consultify Team</p>
      `,
    });
  }

  /**
   * N2 (DEC-2026-08-25-21): no longer called — checkAndEscalate() used to
   * call this in addition to notificationService.send(), sending every
   * escalation email twice and bypassing preferences on the second send.
   * Left in place (unused) rather than deleted, since removing it is out
   * of this ticket's scope.
   */
  private async sendEscalationEmail(
    to: string,
    data: {
      templateName: string;
      assigneeName: string;
      overdueDays: number;
      assignmentId: string;
    }
  ): Promise<void> {
    await emailService.send({
      to,
      subject: `[Action Required] Interview Overdue: ${data.templateName}`,
      html: `
        <h2>Interview Assignment Overdue</h2>
        <p>The interview <strong>"${data.templateName}"</strong> assigned to <strong>${data.assigneeName}</strong> is overdue by <strong>${data.overdueDays} day(s)</strong>.</p>
        <p>Please follow up with the assignee or reassign the task.</p>
        <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/interview?assignmentId=${data.assignmentId}&scope=managed">View Assignment</a></p>
        <p>Best regards,<br>The Consultify Team</p>
      `,
    });
  }

  // ==========================================
  // HELPER: Create mirror task in MyWork
  // ==========================================

  private async createMirrorTask(
    db: IDatabase,
    data: {
      assignmentId: string;
      organizationId: string;
      projectId?: string;
      templateId: string;
      assigneeId: string;
      reporterId: string;
      dueAt: string;
      priority: string;
    }
  ): Promise<void> {
    const taskId = `t_interview_${uuidv4()}`;
    const now = new Date().toISOString();

    // Get template name for task title
    const template = await db.get<{ name: string }>(
      `SELECT name FROM interview_library_templates WHERE id = ?`,
      [data.templateId]
    );

    await db.run(
      `INSERT INTO tasks
       (id, project_id, organization_id, title, description, status, priority, assignee_id, reporter_id, due_date, task_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        data.projectId || null,
        data.organizationId,
        `Interview: ${template?.name || 'Discovery Interview'}`,
        JSON.stringify({
          type: 'interview_assignment',
          assignmentId: data.assignmentId,
          templateId: data.templateId,
        }),
        'todo',
        data.priority,
        data.assigneeId,
        data.reporterId,
        data.dueAt,
        'interview',
        now,
        now,
      ]
    );

    // Link task to assignment
    await db.run(`UPDATE interview_assignments SET task_id = ? WHERE id = ?`, [
      taskId,
      data.assignmentId,
    ]);
  }

  // ==========================================
  // ROW MAPPERS
  // ==========================================

  private mapRowToAssignment(row: any): Assignment {
    return {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id || undefined,
      assigneeUserId: row.assignee_user_id,
      templateId: row.template_id,
      templateVersion: row.template_version || 1,
      processRef: row.process_ref || undefined,
      // Powierzchnia API zawsze kanoniczna, niezależnie od tego, jak wiersz
      // został zapisany historycznie.
      status: canonicalStatusToken(row.status) as AssignmentStatus,
      sessionId: row.session_id || undefined,
      taskId: row.task_id || undefined,
      dueAt: row.due_at || undefined,
      startedAt: row.started_at || undefined,
      submittedAt: row.submitted_at || undefined,
      sentBackAt: row.sent_back_at || undefined,
      sentBackReason: row.sent_back_reason || undefined,
      aiReview: parseJson<InterviewAiReviewSnapshot | null>(row.ai_review_snapshot_json, null),
      aiReviewedAt: row.ai_reviewed_at || undefined,
      reviewDecisionMemory: parseJson<InterviewReviewDecisionMemoryEntry[]>(
        row.review_decision_memory_json,
        []
      ),
      priority: (row.priority || 'medium') as AssignmentPriority,
      reminderSentAt: row.reminder_sent_at || undefined,
      reminderCount: row.reminder_count || 0,
      lastReminderType: row.last_reminder_type || undefined,
      escalatedAt: row.escalated_at || undefined,
      escalationCount: row.escalation_count || 0,
      escalateTo: row.escalate_to || undefined,
      isTeamAssignment: flagOn(row.is_team_assignment), // bigint on PG → coerce
      isAnonymous: flagOn(row.is_anonymous),
      notes: row.notes || undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToAssignmentWithDetails(row: any): AssignmentWithDetails {
    const assignment = this.mapRowToAssignment(row) as AssignmentWithDetails;

    if (row.template_name) {
      assignment.template = {
        id: row.template_id,
        name: row.template_name,
        description: row.template_description,
        category: row.template_category,
      };
    }

    if (row.session_id) {
      const total = row.total_questions || 0;
      const answered = row.answered_questions || 0;
      assignment.session = {
        id: row.session_id,
        status: row.session_status,
        answeredQuestions: answered,
        totalQuestions: total,
        completenessPercent: total > 0 ? Math.round((answered / total) * 100) : 0,
      };
    }

    // V-A S2 — attach the assignee whenever the row carries an assignee_user_id.
    // Use the trimmed name, falling back to email when the user has no
    // first/last name (the TRIM(COALESCE(...)) projection yields '' in that
    // case, which would otherwise drop the assignee and render "Unknown").
    if (row.assignee_user_id) {
      const name = (row.assignee_name && String(row.assignee_name).trim()) || row.assignee_email;
      assignment.assignee = {
        id: row.assignee_user_id,
        name: name || '',
        email: row.assignee_email,
      };
    }

    return assignment;
  }

  private mapRowToMember(row: any): AssignmentMember {
    return {
      id: row.id,
      assignmentId: row.assignment_id,
      userId: row.user_id,
      role: row.role as TeamMemberRole,
      progressPercent: row.progress_percent || 0,
      joinedAt: row.joined_at,
      completedAt: row.completed_at || undefined,
    };
  }
}

// Export singleton
const interviewAssignmentService = new InterviewAssignmentService();
export default interviewAssignmentService;

// Named exports for convenience
export const create = (input: CreateAssignmentInput) => interviewAssignmentService.create(input);
export const getById = (id: string) => interviewAssignmentService.getById(id);
export const getByIdWithDetails = (id: string) => interviewAssignmentService.getByIdWithDetails(id);
export const update = (id: string, updates: Partial<Assignment>) =>
  interviewAssignmentService.update(id, updates);
export const deleteAssignment = (id: string) => interviewAssignmentService.delete(id);
export const addTeamMember = (assignmentId: string, userId: string, role?: TeamMemberRole) =>
  interviewAssignmentService.addTeamMember(assignmentId, userId, role);
export const removeTeamMember = (assignmentId: string, userId: string) =>
  interviewAssignmentService.removeTeamMember(assignmentId, userId);
export const getTeamMembers = (assignmentId: string) =>
  interviewAssignmentService.getTeamMembers(assignmentId);
export const getMyAssignments = (userId: string, organizationId: string, options?: any) =>
  interviewAssignmentService.getMyAssignments(userId, organizationId, options);
export const getManagedAssignments = (managerId: string, organizationId: string, options?: any) =>
  interviewAssignmentService.getManagedAssignments(managerId, organizationId, options);
export const getOverdueAssignments = (organizationId?: string, options?: any) =>
  interviewAssignmentService.getOverdueAssignments(organizationId, options);
export const getOverdueCount = (managerId: string, organizationId: string, options?: any) =>
  interviewAssignmentService.getOverdueCount(managerId, organizationId, options);
export const sendReminder = (assignmentId: string, senderId: string) =>
  interviewAssignmentService.sendReminder(assignmentId, senderId);
export const checkAndSendReminders = () => interviewAssignmentService.checkAndSendReminders();
export const checkAndEscalate = () => interviewAssignmentService.checkAndEscalate();
