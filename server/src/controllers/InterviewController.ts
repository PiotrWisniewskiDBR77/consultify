/**
 * InterviewController - v2.0 ClickUp-like Redesign
 *
 * Handles:
 * - Interview sessions (5 categories: Strategy, Operations, Digital, People, Finance)
 * - Questions (task-list style with status, confidence, tags)
 * - Notes
 * - Evidence (files, links)
 * - Summary (ONLY facts - no recommendations)
 * - Organization context (Company Facts)
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { llmService } from '../services/ai/llmService.js';
import notificationService from '../services/notificationService.js';
import { evaluateGatePolicy } from '../services/workflow/gatePolicy.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// 5 Interview Categories (new spec)
const INTERVIEW_CATEGORIES = ['strategy', 'operations', 'digital', 'people', 'finance'] as const;
type InterviewCategory = (typeof INTERVIEW_CATEGORIES)[number];

// Question statuses (task-list style)
const QUESTION_STATUSES = ['not_started', 'in_progress', 'answered', 'needs_follow_up'] as const;
type QuestionStatus = (typeof QUESTION_STATUSES)[number];

// Helpers
const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const requireUser = (req: AuthenticatedRequest) => {
  const user = req.user;
  if (!user) throw new Error('Unauthorized');
  return user;
};

// Response builders
const buildSessionResponse = (row: any) => {
  if (!row) return null;
  const rawStatus = String(row.status || '').toLowerCase();
  // DB legacy constraint uses: active | completed | paused
  // API contract uses: in_progress | completed | paused (+ derived states at assignment level)
  const normalizedStatus = rawStatus === 'active' ? 'in_progress' : rawStatus;
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id || undefined,
    name: row.name || 'Discovery Interview',
    ownerId: row.owner_id,
    status: normalizedStatus,
    templateId: row.template_id || undefined,
    templateVersion: row.template_version || undefined,
    assignmentId: row.assignment_id || undefined,
    progress: parseJson(row.progress_json, {}),
    totalQuestions: row.total_questions || 0,
    answeredQuestions: row.answered_questions || 0,
    summaryFacts: parseJson(row.summary_facts, []),
    summaryGaps: parseJson(row.summary_gaps, []),
    summaryConstraints: parseJson(row.summary_constraints, []),
    summaryPainPoints: parseJson(row.summary_pain_points, []),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastActivityAt: row.last_activity_at,
  };
};

const buildQuestionResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    category: row.category,
    questionText: row.question_text,
    answerText: row.answer_text || '',
    status: row.status,
    confidenceScore: row.confidence_score || 0,
    answeredBy: row.answered_by,
    answeredAt: row.answered_at,
    tags: parseJson(row.tags, []),
    sortOrder: row.sort_order || 0,
    isTemplate: row.is_template === 1,
  };
};

const buildNoteResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    category: row.category,
    title: row.title,
    content: row.content,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const buildEvidenceResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    questionId: row.question_id,
    evidenceType: row.evidence_type,
    title: row.title,
    description: row.description,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    url: row.url,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
};

// Template response builders (Interview templates library)
const buildTemplateResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    questionCount: row.question_count ?? 0,
    category: typeof row.category === 'string' ? row.category.toLowerCase() : row.category,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    status: row.status || 'approved',
    sessionsUsed: row.sessions_used ?? 0,
  };
};

const buildTemplateQuestionResponse = (row: any) => {
  if (!row) return null;
  return {
    id: row.id,
    templateId: row.template_id,
    category: row.category,
    questionText: row.question_text,
    sortOrder: row.sort_order || 0,
    answerType: row.answer_type || 'open',
    isRequired: row.is_required === 1,
    helpHint: row.help_hint || null,
    answerOptions: parseJson(row.answer_options, [] as unknown[]),
  };
};

async function resolveValidProjectId(params: {
  organizationId: string;
  projectId?: string | null;
}): Promise<string | null> {
  const { organizationId } = params;
  const raw = String(params.projectId || '').trim();
  if (raw) {
    const p = await queryHelpers.queryOne(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
      [raw, organizationId]
    );
    if (p?.id) return String(p.id);
  }
  // Fallback to first project in org (prevents SQLITE_CONSTRAINT on NOT NULL/FK)
  const first = await queryHelpers.queryOne(
    `SELECT id FROM projects WHERE organization_id = ? ORDER BY created_at ASC LIMIT 1`,
    [organizationId]
  );
  return first?.id ? String(first.id) : null;
}

async function createSessionFromTemplate(params: {
  user: any;
  templateId: string;
  projectId?: string;
  name?: string;
  assignmentId?: string;
}): Promise<any> {
  const { user, templateId, projectId, name, assignmentId } = params;

  const template = await queryHelpers.queryOne(
    `SELECT * FROM interview_library_templates
     WHERE id = ?
       AND (organization_id IS NULL OR organization_id = ?)`,
    [templateId, user.organizationId]
  );

  if (!template) throw new Error('Template not found');

  // Minimal visibility guard
  if (template.visibility === 'admin_only' && !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
    throw new Error('Permission denied');
  }

  // Only approved templates can be used to create sessions
  if (String(template.status || '').toLowerCase() !== 'approved') {
    throw new Error('Template is not approved yet');
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const resolvedProjectId = await resolveValidProjectId({
    organizationId: user.organizationId,
    projectId,
  });
  if (!resolvedProjectId) {
    throw new Error('Project not found');
  }

  // Create session from template (snapshot)
  await queryHelpers.queryRun(
    `INSERT INTO interview_sessions
     (id, organization_id, project_id, user_id, topic, name, owner_id, status, progress_json,
      template_id, template_version,
      assignment_id,
      started_at, last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      user.organizationId,
      resolvedProjectId,
      user.id,
      name || `Interview ${new Date().toLocaleDateString()}`,
      name || `Interview ${new Date().toLocaleDateString()}`,
      user.id,
      'active',
      JSON.stringify({ strategy: 0, operations: 0, digital: 0, people: 0, finance: 0 }),
      template.id,
      template.version || 1,
      assignmentId || null,
      now,
      now,
      now,
      now,
    ]
  );

  const templateQuestions = await queryHelpers.queryAll(
    `SELECT * FROM interview_library_template_questions WHERE template_id = ? ORDER BY category, sort_order`,
    [template.id]
  );

  let questionCount = 0;
  for (const tq of templateQuestions as any[]) {
    const questionId = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO interview_questions
       (id, session_id, organization_id, category, question_text, status, sort_order, is_template, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        questionId,
        id,
        user.organizationId,
        tq.category,
        tq.question_text,
        'not_started',
        tq.sort_order,
        1,
        now,
        now,
      ]
    );
    questionCount++;
  }

  await queryHelpers.queryRun(`UPDATE interview_sessions SET total_questions = ? WHERE id = ?`, [
    questionCount,
    id,
  ]);

  const session = await queryHelpers.queryOne(`SELECT * FROM interview_sessions WHERE id = ?`, [
    id,
  ]);
  return buildSessionResponse(session);
}

// ==========================================
// ASSIGNMENTS HELPERS
// ==========================================

const LOCKED_SESSION_STATUSES = ['submitted', 'completed'] as const;

const calcCompletenessRatio = (answered: number, total: number): number => {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(1, answered / total));
};

const isLockedSessionStatus = (status?: string): boolean => {
  const s = String(status || '').toLowerCase();
  return (LOCKED_SESSION_STATUSES as unknown as string[]).includes(s);
};

async function assertSessionEditable(sessionId: string, organizationId: string): Promise<any> {
  const session = await queryHelpers.queryOne(
    `SELECT s.id, s.status, s.user_id as owner_id 
     FROM interview_sessions s
     JOIN projects p ON p.id = s.project_id
     WHERE s.id = ? AND p.organization_id = ?`,
    [sessionId, organizationId]
  );
  if (!session) throw new Error('Session not found');
  if (isLockedSessionStatus((session as any).status)) throw new Error('Session is locked');
  return session;
}

async function assertSessionOwnedByUser(
  sessionId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  const session = await queryHelpers.queryOne(
    `SELECT s.id, s.user_id as owner_id 
     FROM interview_sessions s
     JOIN projects p ON p.id = s.project_id
     WHERE s.id = ? AND p.organization_id = ?`,
    [sessionId, organizationId]
  );
  if (!session) throw new Error('Session not found');
  if (String((session as any).owner_id) !== String(userId)) throw new Error('Forbidden');
}

async function getAssignmentForSession(
  sessionId: string,
  organizationId: string
): Promise<any | null> {
  const row = await queryHelpers.queryOne(
    `SELECT * FROM interview_assignments WHERE session_id = ? AND organization_id = ?`,
    [sessionId, organizationId]
  );
  return row || null;
}

export const InterviewController = {
  // ==========================================
  // SESSIONS
  // ==========================================

  getSessions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { status } = req.query;

    // Filter sessions by organization (project-scoped OR org-scoped)
    let query = `
      SELECT s.*
      FROM interview_sessions s
      LEFT JOIN projects p ON p.id = s.project_id
      WHERE (
        p.organization_id = ?
        OR (s.project_id IS NULL AND s.organization_id = ?)
      )
    `;
    const params: unknown[] = [user.organizationId, user.organizationId];

    if (status) {
      const normalized =
        String(status).toLowerCase() === 'in_progress' ? 'active' : String(status).toLowerCase();
      query += ` AND s.status = ?`;
      params.push(normalized);
    }

    query += ` ORDER BY s.started_at DESC`;

    const rows = await queryHelpers.queryAll(query, params);
    res.json(rows.map(buildSessionResponse));
  }),

  getSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    // Join with projects to filter by organization
    const row = await queryHelpers.queryOne(
      `SELECT s.*
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [id, user.organizationId, user.organizationId]
    );

    if (!row) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(buildSessionResponse(row));
  }),

  createSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { name, projectId, templateId } = req.body;

    // If templateId provided, create from template library (snapshot)
    if (templateId) {
      const resolvedProjectId = await resolveValidProjectId({
        organizationId: user.organizationId,
        projectId,
      });
      if (!resolvedProjectId) {
        res.status(400).json({ error: 'Project required' });
        return;
      }
      const session = await createSessionFromTemplate({
        user,
        templateId,
        projectId: resolvedProjectId,
        name,
      });
      res.status(201).json(session);
      return;
    }

    const resolvedProjectId = await resolveValidProjectId({
      organizationId: user.organizationId,
      projectId,
    });
    if (!resolvedProjectId) {
      res.status(400).json({ error: 'Project required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Create session
    await queryHelpers.queryRun(
      `INSERT INTO interview_sessions
       (id, organization_id, project_id, user_id, topic, name, owner_id, status, progress_json,
        started_at, last_activity_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user.organizationId,
        resolvedProjectId,
        user.id,
        name || 'Discovery Interview',
        name || 'Discovery Interview',
        user.id,
        'active',
        JSON.stringify({ strategy: 0, operations: 0, digital: 0, people: 0, finance: 0 }),
        now,
        now,
        now,
        now,
      ]
    );

    // Load question templates and create questions for session
    const templates = await queryHelpers.queryAll(
      `SELECT * FROM interview_question_templates ORDER BY category, sort_order`
    );

    let questionCount = 0;
    for (const template of templates as any[]) {
      const questionId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, status, sort_order, is_template, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          questionId,
          id,
          user.organizationId,
          template.category,
          template.question_text,
          'not_started',
          template.sort_order,
          1,
          now,
          now,
        ]
      );
      questionCount++;
    }

    // Update total questions
    await queryHelpers.queryRun(`UPDATE interview_sessions SET total_questions = ? WHERE id = ?`, [
      questionCount,
      id,
    ]);

    const session = await queryHelpers.queryOne(`SELECT * FROM interview_sessions WHERE id = ?`, [
      id,
    ]);
    logger.info(`[InterviewController] Created session ${id} with ${questionCount} questions`);
    res.status(201).json(buildSessionResponse(session));
  }),

  updateSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { name, status, summaryFacts, summaryGaps, summaryConstraints, summaryPainPoints } =
      req.body;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (status) {
      // DB constraint allows: active | completed | paused
      // API may send: in_progress (alias for active)
      const normalized =
        String(status).toLowerCase() === 'in_progress' ? 'active' : String(status).toLowerCase();
      const allowed = new Set(['active', 'completed', 'paused']);
      if (!allowed.has(normalized)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      updates.push('status = ?');
      params.push(normalized);
      if (normalized === 'completed') {
        updates.push('completed_at = ?');
        params.push(new Date().toISOString());
      }
    }
    if (summaryFacts) {
      updates.push('summary_facts = ?');
      params.push(JSON.stringify(summaryFacts));
    }
    if (summaryGaps) {
      updates.push('summary_gaps = ?');
      params.push(JSON.stringify(summaryGaps));
    }
    if (summaryConstraints) {
      updates.push('summary_constraints = ?');
      params.push(JSON.stringify(summaryConstraints));
    }
    if (summaryPainPoints) {
      updates.push('summary_pain_points = ?');
      params.push(JSON.stringify(summaryPainPoints));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    updates.push('last_activity_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    // Verify session belongs to user's organization (project-scoped OR org-scoped)
    const sessionCheck = await queryHelpers.queryOne(
      `SELECT s.id
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [id, user.organizationId, user.organizationId]
    );
    if (!sessionCheck) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await queryHelpers.queryOne(`SELECT * FROM interview_sessions WHERE id = ?`, [
      id,
    ]);
    res.json(buildSessionResponse(updated));
  }),

  // ==========================================
  // ASSIGNMENTS (Workflow)
  // ==========================================

  getMyAssignments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { status, includeCompleted } = req.query as any;

    const params: unknown[] = [user.organizationId, user.id];
    let where = `WHERE a.organization_id = ? AND a.assignee_user_id = ?`;

    if (status) {
      where += ` AND a.status = ?`;
      params.push(status);
    } else if (!includeCompleted) {
      where += ` AND a.status != 'completed'`;
    }

    const rows = await queryHelpers.queryAll(
      `SELECT
         a.*,
         t.name as template_name,
         t.description as template_description,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions as answered_questions,
         s.total_questions as total_questions
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       ${where}
       ORDER BY
         CASE a.status WHEN 'assigned' THEN 0 WHEN 'sent_back' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'submitted' THEN 3 ELSE 4 END,
         COALESCE(a.due_at, '9999-12-31') ASC,
         a.created_at DESC`,
      params
    );

    const mapped = (rows || []).map((r: any) => {
      const answered = Number(r.answered_questions || 0);
      const total = Number(r.total_questions || 0);
      const completenessRatio = calcCompletenessRatio(answered, total);
      return {
        id: r.id,
        organizationId: r.organization_id,
        status: r.status,
        projectId: r.project_id || null,
        sessionId: r.session_id || null,
        dueAt: r.due_at || null,
        startedAt: r.started_at || null,
        submittedAt: r.submitted_at || null,
        sentBackAt: r.sent_back_at || null,
        sentBackReason: r.sent_back_reason || null,
        processRef: r.process_ref || null,
        template: {
          id: r.template_id,
          version: r.template_version,
          name: r.template_name || '',
          description: r.template_description || '',
          category:
            typeof r.template_category === 'string'
              ? r.template_category.toLowerCase()
              : r.template_category,
        },
        session: r.session_id
          ? {
              id: r.session_id,
              status: r.session_status,
              answeredQuestions: answered,
              totalQuestions: total,
              completenessPercent: Math.round(completenessRatio * 100),
            }
          : null,
      };
    });

    res.json(mapped);
  }),

  createAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const {
      assigneeUserId, // Single user (legacy support)
      assigneeUserIds, // Array of users (new - supports teams)
      templateId,
      dueAt,
      processRef,
      projectId,
      priority,
      escalateTo,
      notes,
      teamLeadId,
    } = req.body || {};

    // Support both singular and plural assignee fields
    const userIds: string[] = assigneeUserIds
      ? Array.isArray(assigneeUserIds)
        ? assigneeUserIds
        : [assigneeUserIds]
      : assigneeUserId
        ? [assigneeUserId]
        : [];

    if (userIds.length === 0 || !templateId) {
      res.status(400).json({ error: 'assigneeUserId(s) and templateId are required' });
      return;
    }

    // ==========================================
    // SCOPE VALIDATION - Check if user can assign to these users
    // ==========================================
    const creatorRoleRaw = (admin.role || '').toString().trim().toUpperCase();
    // Auth middleware maps roles to app-level labels (e.g. admin -> administrator).
    // Normalize to permission roles used across the backend.
    const creatorRole =
      creatorRoleRaw === 'ADMINISTRATOR'
        ? 'ADMIN'
        : creatorRoleRaw === 'OWNER'
          ? 'SUPERADMIN'
          : creatorRoleRaw === 'PROJECT_MANAGER'
            ? 'PROJECT_MANAGER'
            : creatorRoleRaw;

    const orgRolesWithFullAccess = ['SUPERADMIN', 'ADMIN', 'PROJECT_MANAGER'];
    const projectRolesWithAssign = ['PMO_LEAD', 'WORKSTREAM_OWNER', 'INITIATIVE_OWNER', 'SPONSOR'];

    // If creator has org-level permission, they can assign to anyone in org
    if (!orgRolesWithFullAccess.includes(creatorRole)) {
      // Check project-level permissions
      if (!projectId) {
        // Without projectId, check if user has any project role that allows assignment
        const userProjectRoles = await queryHelpers.queryAll(
          `SELECT project_id, role FROM project_members WHERE user_id = ?`,
          [admin.id]
        );

        const hasAnyManagementRole = (userProjectRoles || []).some((pm: any) =>
          projectRolesWithAssign.includes((pm.role || '').toUpperCase())
        );

        if (!hasAnyManagementRole) {
          res.status(403).json({
            error:
              'You do not have permission to assign interviews. You need PROJECT_MANAGER role or a management role in a project.',
          });
          return;
        }
      } else {
        // With projectId, check if creator has management role in that project
        const creatorProjectRole = await queryHelpers.queryOne(
          `SELECT role FROM project_members WHERE user_id = ? AND project_id = ?`,
          [admin.id, projectId]
        );

        if (
          !creatorProjectRole ||
          !projectRolesWithAssign.includes(((creatorProjectRole as any).role || '').toUpperCase())
        ) {
          res.status(403).json({
            error: 'You do not have a management role in this project to assign interviews.',
          });
          return;
        }

        // Validate that all assignees are members of the project
        const projectMembers = await queryHelpers.queryAll(
          `SELECT user_id FROM project_members WHERE project_id = ?`,
          [projectId]
        );
        const projectMemberIds = (projectMembers || []).map((m: any) => m.user_id);

        const invalidAssignees = userIds.filter((id) => !projectMemberIds.includes(id));
        if (invalidAssignees.length > 0) {
          res.status(403).json({
            error:
              'Some assignees are not members of this project. You can only assign to project members.',
          });
          return;
        }
      }
    }
    // ==========================================

    // Validate template
    const template = await queryHelpers.queryOne(
      `SELECT id, name, version, status FROM interview_library_templates WHERE id = ?`,
      [templateId]
    );
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    if (String((template as any).status || '').toLowerCase() !== 'approved') {
      res.status(400).json({ error: 'Template is not approved yet' });
      return;
    }

    // Use InterviewAssignmentService for proper handling of teams, notifications, escalation
    const { default: interviewAssignmentService } =
      await import('../services/InterviewAssignmentService.js');

    const assignment = await interviewAssignmentService.create({
      organizationId: admin.organizationId,
      projectId: projectId || undefined,
      templateId,
      templateVersion: (template as any).version || 1,
      assigneeUserIds: userIds,
      teamLeadId: teamLeadId || undefined,
      dueAt: dueAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default 7 days
      priority: priority || 'medium',
      escalateTo: escalateTo || admin.id, // Default to creator
      notes: notes || undefined,
      processRef: processRef || undefined,
      createdBy: admin.id,
    });

    // Return with full details
    const assignmentWithDetails = await interviewAssignmentService.getByIdWithDetails(
      assignment.id
    );
    res.status(201).json(assignmentWithDetails);
  }),

  listAssignments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const { status, assigneeUserId, createdBy, projectId, overdue } = req.query as any;

    const params: unknown[] = [admin.organizationId];
    let where = `WHERE a.organization_id = ?`;
    if (status) {
      where += ` AND a.status = ?`;
      params.push(status);
    }
    if (assigneeUserId) {
      where += ` AND a.assignee_user_id = ?`;
      params.push(assigneeUserId);
    }
    if (createdBy) {
      where += ` AND a.created_by = ?`;
      params.push(createdBy);
    }
    if (projectId) {
      where += ` AND a.project_id = ?`;
      params.push(projectId);
    }
    if (String(overdue) === '1' || String(overdue).toLowerCase() === 'true') {
      where += ` AND a.due_at IS NOT NULL AND a.due_at < datetime('now') AND a.status != 'completed'`;
    }

    const rows = await queryHelpers.queryAll(
      `SELECT
         a.*,
         t.name as template_name,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions as answered_questions,
         s.total_questions as total_questions
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       ${where}
       ORDER BY a.updated_at DESC`,
      params
    );

    const mapped = (rows || []).map((r: any) => {
      const answered = Number(r.answered_questions || 0);
      const total = Number(r.total_questions || 0);
      return {
        ...r,
        template: {
          id: r.template_id,
          name: r.template_name || '',
          category:
            typeof r.template_category === 'string'
              ? r.template_category.toLowerCase()
              : r.template_category,
          version: r.template_version,
        },
        session: r.session_id
          ? {
              id: r.session_id,
              status: r.session_status,
              answeredQuestions: answered,
              totalQuestions: total,
              completenessPercent: Math.round(calcCompletenessRatio(answered, total) * 100),
            }
          : null,
      };
    });

    res.json(mapped);
  }),

  startAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { projectId, name } = req.body || {};

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ? AND assignee_user_id = ?`,
      [id, user.organizationId, user.id]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const assignmentStatus = String((assignment as any).status || '');
    if (assignmentStatus === 'approved' || assignmentStatus === 'completed') {
      res.status(409).json({ error: 'Assignment already completed' });
      return;
    }

    if ((assignment as any).session_id) {
      const session = await queryHelpers.queryOne(`SELECT * FROM interview_sessions WHERE id = ?`, [
        (assignment as any).session_id,
      ]);
      res.json({ assignmentId: id, session: buildSessionResponse(session) });
      return;
    }

    const resolvedProjectId = await resolveValidProjectId({
      organizationId: user.organizationId,
      projectId: (assignment as any).project_id || projectId,
    });
    if (!resolvedProjectId) {
      res.status(400).json({ error: 'Project required' });
      return;
    }

    const session = await createSessionFromTemplate({
      user,
      templateId: (assignment as any).template_id,
      projectId: resolvedProjectId,
      name: name || `Interview ${new Date().toLocaleDateString()}`,
      assignmentId: id,
    });

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE interview_assignments
       SET session_id = ?, status = 'in_progress', started_at = ?, updated_at = ?, project_id = COALESCE(project_id, ?)
       WHERE id = ?`,
      [(session as any).id, now, now, resolvedProjectId, id]
    );

    // Mirror into task status/description
    if ((assignment as any).task_id) {
      await queryHelpers.queryRun(
        `UPDATE tasks SET status = ?, description = ?, updated_at = ? WHERE id = ?`,
        [
          'in_progress',
          JSON.stringify({
            type: 'interview_assignment',
            assignmentId: id,
            templateId: (assignment as any).template_id,
            templateVersion: (assignment as any).template_version,
            sessionId: (session as any).id,
          }),
          now,
          (assignment as any).task_id,
        ]
      );
    }

    res.json({ assignmentId: id, session });
  }),

  submitAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ? AND assignee_user_id = ?`,
      [id, user.organizationId, user.id]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const submitGate = evaluateGatePolicy({
      action: 'SUBMIT_INTERVIEW',
      contextType: 'interview_assignment',
      user,
      context: { assignment },
    });
    if (!submitGate.allow) {
      res.status(submitGate.code === 'INVALID_STATE' ? 409 : 400).json({ error: submitGate.error });
      return;
    }

    const sessionRow = await queryHelpers.queryOne(
      `SELECT s.*
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [(assignment as any).session_id, user.organizationId, user.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const answered = Number((sessionRow as any).answered_questions || 0);
    const total = Number((sessionRow as any).total_questions || 0);
    const completenessRatio = calcCompletenessRatio(answered, total);
    const completenessPercent = Math.round(completenessRatio * 100);
    const now = new Date().toISOString();

    // Canon: submit ALWAYS sends to review.
    // Session status remains within DB constraint (active|completed|paused); the "lock" is enforced by assignment status.
    const newAssignmentStatus = 'submitted';

    await queryHelpers.queryRun(
      `UPDATE interview_assignments
       SET status = ?, submitted_at = ?, updated_at = ?
       WHERE id = ?`,
      [newAssignmentStatus, now, now, id]
    );

    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET updated_at = ?, last_activity_at = ? WHERE id = ?`,
      [now, now, (assignment as any).session_id]
    );

    if ((assignment as any).task_id) {
      await queryHelpers.queryRun(
        `UPDATE tasks SET status = ?, progress = ?, updated_at = ? WHERE id = ?`,
        ['in_progress', completenessPercent, now, (assignment as any).task_id]
      );
    }

    const updatedAssignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    const updatedSession = await queryHelpers.queryOne(
      `SELECT * FROM interview_sessions WHERE id = ?`,
      [(assignment as any).session_id]
    );

    // Notify the assignment creator (manager/reviewer) that review is needed
    try {
      const createdBy = (assignment as any).created_by;
      if (createdBy) {
        await notificationService.send({
          userId: createdBy,
          organizationId: user.organizationId,
          type: 'interview_submitted',
          title: 'Interview submitted for review',
          body: `An interview assignment has been submitted and is awaiting your review.`,
          entityType: 'interview_assignment',
          entityId: id,
          actionUrl: `/discovery?assignmentId=${id}&scope=managed`,
          priority: 'high',
          actorId: user.id,
        });
      }
    } catch (e) {
      logger.warn('[InterviewController] Failed to send interview_submitted notification', e);
    }

    res.json({
      assignment: updatedAssignment,
      session: buildSessionResponse(updatedSession),
      completenessPercent,
      entersContext: false,
    });
  }),

  sendBackAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admin = requireUser(req);
    const { id } = req.params;
    const { reason } = req.body || {};

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, admin.organizationId]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const sendBackGate = evaluateGatePolicy({
      action: 'SEND_BACK_INTERVIEW',
      contextType: 'interview_assignment',
      user: admin,
      context: { assignment },
    });
    if (!sendBackGate.allow) {
      res
        .status(sendBackGate.code === 'INVALID_STATE' ? 409 : 400)
        .json({ error: sendBackGate.error });
      return;
    }

    const sessionRow = await queryHelpers.queryOne(
      `SELECT s.*
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [(assignment as any).session_id, admin.organizationId, admin.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Canon: send-back is a quality decision, not a completeness math gate.
    // It requires a reason and sends the session back to editable state.

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE interview_assignments
       SET status = 'sent_back', sent_back_at = ?, sent_back_reason = ?, updated_at = ?
       WHERE id = ?`,
      [now, reason || 'Please complete the interview', now, id]
    );

    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET status = 'active', updated_at = ?, last_activity_at = ? WHERE id = ?`,
      [now, now, (assignment as any).session_id]
    );

    if ((assignment as any).task_id) {
      await queryHelpers.queryRun(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`, [
        'in_progress',
        now,
        (assignment as any).task_id,
      ]);
    }

    const updated = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );

    // Notify assignee that interview was sent back
    try {
      const assigneeId = (assignment as any).assignee_user_id;
      if (assigneeId) {
        await notificationService.send({
          userId: assigneeId,
          organizationId: admin.organizationId,
          type: 'interview_sent_back',
          title: 'Interview sent back for revision',
          body: reason || 'Please complete the interview',
          entityType: 'interview_assignment',
          entityId: id,
          actionUrl: `/discovery?assignmentId=${id}`,
          priority: 'high',
          actorId: admin.id,
        });
      }
    } catch (e) {
      logger.warn('[InterviewController] Failed to send interview_sent_back notification', e);
    }

    res.json(updated);
  }),

  approveAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const reviewer = requireUser(req);
    const { id } = req.params;

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, reviewer.organizationId]
    );
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }
    const approveGate = evaluateGatePolicy({
      action: 'APPROVE_INTERVIEW',
      contextType: 'interview_assignment',
      user: reviewer,
      context: { assignment },
    });
    if (!approveGate.allow) {
      res
        .status(approveGate.code === 'INVALID_STATE' ? 409 : 400)
        .json({ error: approveGate.error });
      return;
    }

    const sessionRow = await queryHelpers.queryOne(
      `SELECT s.*
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?
         AND (
           p.organization_id = ?
           OR (s.project_id IS NULL AND s.organization_id = ?)
         )`,
      [(assignment as any).session_id, reviewer.organizationId, reviewer.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const answered = Number((sessionRow as any).answered_questions || 0);
    const total = Number((sessionRow as any).total_questions || 0);
    const completenessRatio = calcCompletenessRatio(answered, total);
    const completenessPercent = Math.round(completenessRatio * 100);

    // Canon default: require minimum completeness to allow approval
    if (completenessRatio < 0.5) {
      res.status(409).json({ error: 'Cannot approve: completeness is < 50%' });
      return;
    }

    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE interview_assignments
       SET status = 'approved', updated_at = ?
       WHERE id = ?`,
      [now, id]
    );
    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, (assignment as any).session_id]
    );

    if ((assignment as any).task_id) {
      await queryHelpers.queryRun(
        `UPDATE tasks SET status = ?, progress = ?, updated_at = ? WHERE id = ?`,
        ['done', 100, now, (assignment as any).task_id]
      );
    }

    // Notify assignee that interview is approved
    try {
      const assigneeId = (assignment as any).assignee_user_id;
      if (assigneeId) {
        await notificationService.send({
          userId: assigneeId,
          organizationId: reviewer.organizationId,
          type: 'interview_approved',
          title: 'Interview approved',
          body: 'Your interview submission has been approved.',
          entityType: 'interview_assignment',
          entityId: id,
          actionUrl: `/discovery?assignmentId=${id}`,
          priority: 'normal',
          actorId: reviewer.id,
        });
      }
    } catch (e) {
      logger.warn('[InterviewController] Failed to send interview_approved notification', e);
    }

    const updatedAssignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    const updatedSession = await queryHelpers.queryOne(
      `SELECT * FROM interview_sessions WHERE id = ?`,
      [(assignment as any).session_id]
    );

    res.json({
      assignment: updatedAssignment,
      session: buildSessionResponse(updatedSession),
      completenessPercent,
      entersContext: true,
    });
  }),

  // ==========================================
  // EXTENDED ASSIGNMENTS (Team, Reminders, Counts)
  // ==========================================

  getManagedAssignments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { status, projectId } = req.query as any;

    const params: unknown[] = [user.organizationId, user.id];
    let where = `WHERE a.organization_id = ? AND a.created_by = ?`;

    if (status) {
      where += ` AND a.status = ?`;
      params.push(status);
    }
    if (projectId) {
      where += ` AND a.project_id = ?`;
      params.push(projectId);
    }

    const rows = await queryHelpers.queryAll(
      `SELECT
         a.*,
         t.name as template_name,
         t.description as template_description,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         (u.first_name || ' ' || u.last_name) as assignee_name,
         u.email as assignee_email
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       ${where}
       ORDER BY a.created_at DESC`,
      params
    );

    const mapped = (rows || []).map((r: any) => {
      const answered = Number(r.answered_questions || 0);
      const total = Number(r.total_questions || 0);
      return {
        id: r.id,
        organizationId: r.organization_id,
        projectId: r.project_id || null,
        status: r.status,
        sessionId: r.session_id || null,
        priority: r.priority || 'medium',
        dueAt: r.due_at || null,
        startedAt: r.started_at || null,
        submittedAt: r.submitted_at || null,
        sentBackAt: r.sent_back_at || null,
        sentBackReason: r.sent_back_reason || null,
        isTeamAssignment: r.is_team_assignment === 1,
        reminderCount: r.reminder_count || 0,
        escalationCount: r.escalation_count || 0,
        createdAt: r.created_at,
        template: {
          id: r.template_id,
          version: r.template_version,
          name: r.template_name || '',
          description: r.template_description || '',
          category:
            typeof r.template_category === 'string'
              ? r.template_category.toLowerCase()
              : r.template_category,
        },
        session: r.session_id
          ? {
              id: r.session_id,
              status: r.session_status,
              answeredQuestions: answered,
              totalQuestions: total,
              completenessPercent: Math.round(calcCompletenessRatio(answered, total) * 100),
            }
          : null,
        assignee: r.assignee_name
          ? {
              id: r.assignee_user_id,
              name: r.assignee_name,
              email: r.assignee_email,
            }
          : null,
      };
    });

    res.json(mapped);
  }),

  getOverdueAssignments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const now = new Date().toISOString();

    const rows = await queryHelpers.queryAll(
      `SELECT
         a.*,
         t.name as template_name,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         (u.first_name || ' ' || u.last_name) as assignee_name,
         u.email as assignee_email
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       WHERE a.organization_id = ?
         AND a.created_by = ?
         AND a.due_at IS NOT NULL
         AND a.due_at < ?
         AND a.status NOT IN ('completed', 'submitted')
       ORDER BY a.due_at ASC`,
      [user.organizationId, user.id, now]
    );

    const mapped = (rows || []).map((r: any) => {
      const answered = Number(r.answered_questions || 0);
      const total = Number(r.total_questions || 0);
      const dueAt = new Date(r.due_at);
      const overdueDays = Math.floor((Date.now() - dueAt.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: r.id,
        organizationId: r.organization_id,
        projectId: r.project_id || null,
        status: r.status,
        sessionId: r.session_id || null,
        priority: r.priority || 'medium',
        dueAt: r.due_at,
        overdueDays,
        template: {
          id: r.template_id,
          name: r.template_name || '',
          category: r.template_category,
        },
        session: r.session_id
          ? {
              id: r.session_id,
              status: r.session_status,
              completenessPercent: Math.round(calcCompletenessRatio(answered, total) * 100),
            }
          : null,
        assignee: {
          id: r.assignee_user_id,
          name: r.assignee_name,
          email: r.assignee_email,
        },
      };
    });

    res.json(mapped);
  }),

  getAssignmentCounts: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const now = new Date().toISOString();

    // My assignments count (including team memberships)
    const myResult = await queryHelpers.queryOne(
      `SELECT COUNT(DISTINCT a.id) as count
       FROM interview_assignments a
       LEFT JOIN interview_assignment_members m ON m.assignment_id = a.id
       WHERE a.organization_id = ?
         AND (a.assignee_user_id = ? OR m.user_id = ?)
         AND a.status NOT IN ('completed')`,
      [user.organizationId, user.id, user.id]
    );

    // Managed assignments count
    const managedResult = await queryHelpers.queryOne(
      `SELECT COUNT(*) as count
       FROM interview_assignments
       WHERE organization_id = ? AND created_by = ?`,
      [user.organizationId, user.id]
    );

    // Overdue count (managed only)
    const overdueResult = await queryHelpers.queryOne(
      `SELECT COUNT(*) as count
       FROM interview_assignments
       WHERE organization_id = ?
         AND created_by = ?
         AND due_at IS NOT NULL
         AND due_at < ?
         AND status NOT IN ('completed', 'submitted')`,
      [user.organizationId, user.id, now]
    );

    res.json({
      my: (myResult as any)?.count || 0,
      managed: (managedResult as any)?.count || 0,
      overdue: (overdueResult as any)?.count || 0,
    });
  }),

  getAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT
         a.*,
         t.name as template_name,
         t.description as template_description,
         t.category as template_category,
         s.status as session_status,
         s.answered_questions,
         s.total_questions,
         (u.first_name || ' ' || u.last_name) as assignee_name,
         u.email as assignee_email,
         (creator.first_name || ' ' || creator.last_name) as creator_name
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       LEFT JOIN interview_sessions s ON s.id = a.session_id
       LEFT JOIN users u ON u.id = a.assignee_user_id
       LEFT JOIN users creator ON creator.id = a.created_by
       WHERE a.id = ? AND a.organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const r = row as any;
    const answered = Number(r.answered_questions || 0);
    const total = Number(r.total_questions || 0);

    // Load team members if team assignment
    let members: any[] = [];
    if (r.is_team_assignment === 1) {
      members = await queryHelpers.queryAll(
        `SELECT m.*, u.name as user_name, u.email as user_email
         FROM interview_assignment_members m
         LEFT JOIN users u ON u.id = m.user_id
         WHERE m.assignment_id = ?`,
        [id]
      );
    }

    res.json({
      id: r.id,
      organizationId: r.organization_id,
      projectId: r.project_id || null,
      status: r.status,
      priority: r.priority || 'medium',
      dueAt: r.due_at || null,
      startedAt: r.started_at || null,
      submittedAt: r.submitted_at || null,
      sentBackAt: r.sent_back_at || null,
      sentBackReason: r.sent_back_reason || null,
      notes: r.notes || null,
      isTeamAssignment: r.is_team_assignment === 1,
      reminderSentAt: r.reminder_sent_at || null,
      reminderCount: r.reminder_count || 0,
      escalatedAt: r.escalated_at || null,
      escalationCount: r.escalation_count || 0,
      createdBy: r.created_by,
      creatorName: r.creator_name,
      createdAt: r.created_at,
      template: {
        id: r.template_id,
        version: r.template_version,
        name: r.template_name || '',
        description: r.template_description || '',
        category:
          typeof r.template_category === 'string'
            ? r.template_category.toLowerCase()
            : r.template_category,
      },
      session: r.session_id
        ? {
            id: r.session_id,
            status: r.session_status,
            answeredQuestions: answered,
            totalQuestions: total,
            completenessPercent: Math.round(calcCompletenessRatio(answered, total) * 100),
          }
        : null,
      assignee: {
        id: r.assignee_user_id,
        name: r.assignee_name,
        email: r.assignee_email,
      },
      members: (members || []).map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        userName: m.user_name,
        userEmail: m.user_email,
        role: m.role,
        progressPercent: m.progress_percent || 0,
        joinedAt: m.joined_at,
        completedAt: m.completed_at,
      })),
    });
  }),

  updateAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { dueAt, priority, notes, assigneeUserId } = req.body || {};

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    const now = new Date().toISOString();

    if (dueAt !== undefined) {
      updates.push('due_at = ?');
      params.push(dueAt);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (assigneeUserId !== undefined && (existing as any).status === 'assigned') {
      // Can only reassign if not started
      updates.push('assignee_user_id = ?');
      params.push(assigneeUserId);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await queryHelpers.queryRun(
      `UPDATE interview_assignments SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Update mirror task if deadline changed
    if (dueAt !== undefined && (existing as any).task_id) {
      await queryHelpers.queryRun(`UPDATE tasks SET due_date = ?, updated_at = ? WHERE id = ?`, [
        dueAt,
        now,
        (existing as any).task_id,
      ]);
    }

    const updated = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ?`,
      [id]
    );
    res.json(updated);
  }),

  deleteAssignment: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    if ((existing as any).status !== 'assigned') {
      res.status(409).json({ error: 'Cannot delete assignment that has been started' });
      return;
    }

    // Delete mirror task
    if ((existing as any).task_id) {
      await queryHelpers.queryRun(`DELETE FROM tasks WHERE id = ?`, [(existing as any).task_id]);
    }

    // Delete team members
    await queryHelpers.queryRun(
      `DELETE FROM interview_assignment_members WHERE assignment_id = ?`,
      [id]
    );

    // Delete assignment
    await queryHelpers.queryRun(`DELETE FROM interview_assignments WHERE id = ?`, [id]);

    res.json({ success: true, deletedId: id });
  }),

  sendAssignmentReminder: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const assignment = await queryHelpers.queryOne(
      `SELECT a.*, t.name as template_name
       FROM interview_assignments a
       LEFT JOIN interview_library_templates t ON t.id = a.template_id
       WHERE a.id = ? AND a.organization_id = ?`,
      [id, user.organizationId]
    );

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    // Import service dynamically to avoid circular deps
    const { default: interviewAssignmentService } =
      await import('../services/InterviewAssignmentService.js');
    await interviewAssignmentService.sendReminder(id, user.id);

    res.json({ success: true, message: 'Reminder sent' });
  }),

  // ==========================================
  // TEAM MEMBER MANAGEMENT
  // ==========================================

  getAssignmentMembers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    const members = await queryHelpers.queryAll(
      `SELECT m.*, u.name as user_name, u.email as user_email
       FROM interview_assignment_members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.assignment_id = ?`,
      [id]
    );

    res.json(
      (members || []).map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        userName: m.user_name,
        userEmail: m.user_email,
        role: m.role,
        progressPercent: m.progress_percent || 0,
        joinedAt: m.joined_at,
        completedAt: m.completed_at,
      }))
    );
  }),

  addAssignmentMember: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { userId, role = 'member' } = req.body || {};

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    // Check if user already a member
    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignment_members WHERE assignment_id = ? AND user_id = ?`,
      [id, userId]
    );

    if (existing) {
      res.status(409).json({ error: 'User is already a member of this assignment' });
      return;
    }

    const memberId = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_assignment_members
       (id, assignment_id, user_id, role, progress_percent, joined_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, id, userId, role, 0, now, now, now]
    );

    // Mark assignment as team if not already
    await queryHelpers.queryRun(
      `UPDATE interview_assignments SET is_team_assignment = 1, updated_at = ? WHERE id = ?`,
      [now, id]
    );

    const member = await queryHelpers.queryOne(
      `SELECT m.*, u.name as user_name, u.email as user_email
       FROM interview_assignment_members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
      [memberId]
    );

    res.status(201).json({
      id: (member as any).id,
      userId: (member as any).user_id,
      userName: (member as any).user_name,
      userEmail: (member as any).user_email,
      role: (member as any).role,
      progressPercent: 0,
      joinedAt: now,
    });
  }),

  removeAssignmentMember: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id, userId } = req.params;

    const assignment = await queryHelpers.queryOne(
      `SELECT * FROM interview_assignments WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    // Cannot remove primary assignee
    if ((assignment as any).assignee_user_id === userId) {
      res
        .status(409)
        .json({ error: 'Cannot remove primary assignee. Reassign the assignment first.' });
      return;
    }

    await queryHelpers.queryRun(
      `DELETE FROM interview_assignment_members WHERE assignment_id = ? AND user_id = ?`,
      [id, userId]
    );

    // Check remaining members
    const remaining = await queryHelpers.queryOne(
      `SELECT COUNT(*) as count FROM interview_assignment_members WHERE assignment_id = ?`,
      [id]
    );

    // If only one member left, mark as non-team
    if ((remaining as any)?.count <= 1) {
      await queryHelpers.queryRun(
        `UPDATE interview_assignments SET is_team_assignment = 0, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), id]
      );
    }

    res.json({ success: true, removedUserId: userId });
  }),

  // ==========================================
  // TEMPLATES (Library)
  // ==========================================

  getTemplates: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);

    const rows = await queryHelpers.queryAll(
      `SELECT
         t.*,
         (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count,
         (SELECT COUNT(1) FROM interview_sessions s 
          JOIN projects p ON p.id = s.project_id 
          WHERE s.template_id = t.id AND p.organization_id = ?) as sessions_used
       FROM interview_library_templates t
       WHERE (t.organization_id IS NULL OR t.organization_id = ?)
         AND (t.visibility != 'admin_only' OR ? IN ('ADMIN', 'SUPERADMIN'))
       ORDER BY
         CASE t.status WHEN 'approved' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
         t.is_default DESC,
         t.category ASC,
         t.name ASC`,
      [user.organizationId, user.organizationId, user.role]
    );

    res.json((rows || []).map(buildTemplateResponse));
  }),

  getTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT
         t.*,
         (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count
       FROM interview_library_templates t
       WHERE t.id = ?
         AND (t.organization_id IS NULL OR t.organization_id = ?)
         AND (t.visibility != 'admin_only' OR ? IN ('ADMIN', 'SUPERADMIN'))`,
      [id, user.organizationId, user.role]
    );

    if (!row) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json(buildTemplateResponse(row));
  }),

  getTemplateQuestions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const tpl = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates
       WHERE id = ?
         AND (organization_id IS NULL OR organization_id = ?)
         AND (visibility != 'admin_only' OR ? IN ('ADMIN', 'SUPERADMIN'))`,
      [id, user.organizationId, user.role]
    );
    if (!tpl) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const rows = await queryHelpers.queryAll(
      `SELECT * FROM interview_library_template_questions WHERE template_id = ? ORDER BY category, sort_order`,
      [id]
    );

    res.json((rows || []).map(buildTemplateQuestionResponse));
  }),

  useTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { projectId, name } = req.body || {};

    try {
      const tpl = await queryHelpers.queryOne(
        `SELECT status FROM interview_library_templates
         WHERE id = ? AND (organization_id IS NULL OR organization_id = ?)`,
        [id, user.organizationId]
      );
      if (!tpl) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      if (String((tpl as any).status || '').toLowerCase() !== 'approved') {
        res.status(400).json({ error: 'Template is not approved yet' });
        return;
      }

      const session = await createSessionFromTemplate({ user, templateId: id, projectId, name });
      res.status(201).json(session);
    } catch (err: any) {
      const msg = String(err?.message || 'Failed to use template');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: msg });
        return;
      }
      if (msg.toLowerCase().includes('permission')) {
        res.status(403).json({ error: msg });
        return;
      }
      logger.error('[InterviewController] useTemplate error:', err);
      res.status(500).json({ error: msg });
    }
  }),

  // ==========================================
  // TEMPLATES MANAGEMENT (create, edit, delete, clone)
  // ==========================================

  createTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { name, description, category, status, visibility, isDefault } = req.body || {};

    if (!name?.trim()) {
      res.status(400).json({ error: 'Template name is required' });
      return;
    }

    const templateId = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_library_templates
       (id, organization_id, name, description, category, status, visibility, is_default, version, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId,
        user.organizationId, // org-scoped template
        name.trim(),
        description || '',
        category || 'CUSTOM',
        status || 'draft',
        visibility || 'org',
        isDefault ? 1 : 0,
        1,
        user.id,
        now,
        now,
      ]
    );

    const created = await queryHelpers.queryOne(
      `SELECT t.*, (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count
       FROM interview_library_templates t WHERE t.id = ?`,
      [templateId]
    );

    res.status(201).json(buildTemplateResponse(created));
  }),

  cloneTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { name } = req.body || {};

    // Get source template
    const source = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates
       WHERE id = ? AND (organization_id IS NULL OR organization_id = ?)`,
      [id, user.organizationId]
    );
    if (!source) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Get source questions
    const sourceQuestions = await queryHelpers.queryAll(
      `SELECT * FROM interview_library_template_questions WHERE template_id = ? ORDER BY sort_order`,
      [id]
    );

    // Create new template
    const newTemplateId = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_library_templates
       (id, organization_id, name, description, category, status, visibility, is_default, version, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newTemplateId,
        user.organizationId,
        name || `${(source as any).name} (copy)`,
        (source as any).description || '',
        (source as any).category || 'CUSTOM',
        'draft', // cloned templates start as draft
        'org', // cloned templates are org-scoped
        0, // not default
        1,
        user.id,
        now,
        now,
      ]
    );

    // Clone questions
    for (const q of (sourceQuestions || []) as any[]) {
      const newQuestionId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO interview_library_template_questions
         (id, template_id, category, question_text, sort_order, answer_type, is_required, help_hint, answer_options, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newQuestionId,
          newTemplateId,
          q.category,
          q.question_text,
          q.sort_order || 0,
          q.answer_type || 'open',
          q.is_required || 0,
          q.help_hint || '',
          q.answer_options || '[]',
          now,
        ]
      );
    }

    const created = await queryHelpers.queryOne(
      `SELECT t.*, (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count
       FROM interview_library_templates t WHERE t.id = ?`,
      [newTemplateId]
    );

    res.status(201).json(buildTemplateResponse(created));
  }),

  deleteTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates
       WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!existing) {
      res.status(404).json({ error: 'Template not found or cannot be deleted' });
      return;
    }

    // Don't allow deleting global templates
    if (!(existing as any).organization_id) {
      res.status(403).json({ error: 'Cannot delete global templates' });
      return;
    }

    // Don't allow deleting default templates
    if ((existing as any).is_default) {
      res.status(403).json({ error: 'Cannot delete default templates' });
      return;
    }

    // Delete questions first (cascade should handle this, but be explicit)
    await queryHelpers.queryRun(
      `DELETE FROM interview_library_template_questions WHERE template_id = ?`,
      [id]
    );

    // Delete template
    await queryHelpers.queryRun(`DELETE FROM interview_library_templates WHERE id = ?`, [id]);

    res.json({ success: true, deletedId: id });
  }),

  updateTemplate: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { name, description, category, status, visibility, isDefault } = req.body || {};

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates
       WHERE id = ? AND (organization_id IS NULL OR organization_id = ?)`,
      [id, user.organizationId]
    );
    if (!existing) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (visibility !== undefined) {
      updates.push('visibility = ?');
      params.push(visibility);
    }
    if (isDefault !== undefined) {
      updates.push('is_default = ?');
      params.push(isDefault ? 1 : 0);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    // bump version on any edit
    updates.push('version = version + 1', 'updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await queryHelpers.queryOne(
      `SELECT
         t.*,
         (SELECT COUNT(1) FROM interview_library_template_questions q WHERE q.template_id = t.id) as question_count,
         (SELECT COUNT(1) FROM interview_sessions s 
          JOIN projects p ON p.id = s.project_id
          WHERE s.template_id = t.id AND p.organization_id = ?) as sessions_used
       FROM interview_library_templates t
       WHERE t.id = ?`,
      [user.organizationId, id]
    );

    res.json(buildTemplateResponse(updated));
  }),

  addTemplateQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params; // template id
    const { category, questionText, sortOrder, answerType, isRequired, helpHint, answerOptions } =
      req.body || {};

    const template = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_templates WHERE id = ? AND (organization_id IS NULL OR organization_id = ?)`,
      [id, user.organizationId]
    );
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    if (!category || !questionText) {
      res.status(400).json({ error: 'category and questionText are required' });
      return;
    }

    const qid = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO interview_library_template_questions
       (id, template_id, category, question_text, sort_order, answer_type, is_required, help_hint, answer_options, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        qid,
        id,
        category,
        questionText,
        typeof sortOrder === 'number' ? sortOrder : 0,
        answerType || 'open',
        isRequired ? 1 : 0,
        helpHint || null,
        JSON.stringify(Array.isArray(answerOptions) ? answerOptions : []),
        new Date().toISOString(),
      ]
    );

    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET version = version + 1, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    const created = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_template_questions WHERE id = ?`,
      [qid]
    );
    res.status(201).json(buildTemplateQuestionResponse(created));
  }),

  updateTemplateQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id, questionId } = req.params;
    const { category, questionText, sortOrder, answerType, isRequired, helpHint, answerOptions } =
      req.body || {};

    const existing = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_template_questions WHERE id = ? AND template_id = ?`,
      [questionId, id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Template question not found' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (questionText !== undefined) {
      updates.push('question_text = ?');
      params.push(questionText);
    }
    if (sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(sortOrder);
    }
    if (answerType !== undefined) {
      updates.push('answer_type = ?');
      params.push(answerType);
    }
    if (isRequired !== undefined) {
      updates.push('is_required = ?');
      params.push(isRequired ? 1 : 0);
    }
    if (helpHint !== undefined) {
      updates.push('help_hint = ?');
      params.push(helpHint);
    }
    if (answerOptions !== undefined) {
      updates.push('answer_options = ?');
      params.push(JSON.stringify(Array.isArray(answerOptions) ? answerOptions : []));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    await queryHelpers.queryRun(
      `UPDATE interview_library_template_questions SET ${updates.join(', ')} WHERE id = ?`,
      [...params, questionId]
    );

    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET version = version + 1, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    const updated = await queryHelpers.queryOne(
      `SELECT * FROM interview_library_template_questions WHERE id = ?`,
      [questionId]
    );
    res.json(buildTemplateQuestionResponse(updated));
  }),

  deleteTemplateQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id, questionId } = req.params;

    const existing = await queryHelpers.queryOne(
      `SELECT id FROM interview_library_template_questions WHERE id = ? AND template_id = ?`,
      [questionId, id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Template question not found' });
      return;
    }

    await queryHelpers.queryRun(`DELETE FROM interview_library_template_questions WHERE id = ?`, [
      questionId,
    ]);

    await queryHelpers.queryRun(
      `UPDATE interview_library_templates SET version = version + 1, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );

    res.json({ success: true });
  }),

  // ==========================================
  // AI ASSIST (human-in-the-loop)
  // ==========================================

  aiSuggestQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { questionId } = req.params;

    const question = await queryHelpers.queryOne(
      `SELECT q.*, s.owner_id as session_owner_id
       FROM interview_questions q
       JOIN interview_sessions s ON s.id = q.session_id
       WHERE q.id = ? AND q.organization_id = ? AND s.organization_id = ?`,
      [questionId, user.organizationId, user.organizationId]
    );
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    if (String((question as any).session_owner_id) !== String(user.id)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const context = await queryHelpers.queryOne(
      `SELECT * FROM organization_context WHERE organization_id = ?`,
      [user.organizationId]
    );

    const answered = await queryHelpers.queryAll(
      `SELECT category, question_text, answer_text
       FROM interview_questions
       WHERE session_id = ? AND status = 'answered'
       ORDER BY updated_at DESC
       LIMIT 10`,
      [question.session_id]
    );

    const SuggestionSchema = z.object({
      answerText: z.string().min(1),
      tags: z.array(z.enum(['risk', 'opportunity', 'constraint', 'priority'])).default([]),
      confidenceScore: z.number().min(1).max(5).default(3),
    });

    const systemPrompt = `
You are a senior manufacturing transformation consultant helping fill a structured interview.
Goal: Draft a concise, factual answer to the question based on provided context and prior answers.
Rules:
- Facts only. No recommendations or action plans.
- If information is missing, write a short best-effort draft and add one explicit missing-data sentence.
- Keep it practical and business-relevant.
- Return ONLY a JSON object matching the schema: { answerText, tags, confidenceScore }.
`;

    const userPrompt = `
Question category: ${question.category}
Question: ${question.question_text}

Organization context (raw DB row, may include nulls):
${JSON.stringify(context || {}, null, 2)}

Recent answered Q&A (may be empty):
${JSON.stringify(answered || [], null, 2)}
`;

    const result = await llmService.call({
      type: 'structured',
      modelConfig: { id: 'standard' },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      schema: SuggestionSchema,
      maxTokens: 600,
      temperature: 0.3,
      cache: false,
    });

    res.json((result as any).object || { answerText: '', tags: [], confidenceScore: 3 });
  }),

  aiParseSessionAnswers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { text, questionIds } = req.body || {};

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const session = await queryHelpers.queryOne(
      `SELECT s.*, s.user_id as owner_id FROM interview_sessions s
       JOIN projects p ON p.id = s.project_id
       WHERE s.id = ? AND p.organization_id = ?`,
      [sessionId, user.organizationId]
    );
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if (String((session as any).owner_id) !== String(user.id)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const restrict = Array.isArray(questionIds) && questionIds.length > 0;
    const inClause = restrict ? `AND id IN (${questionIds.map(() => '?').join(', ')})` : '';

    const questions = await queryHelpers.queryAll(
      `SELECT id, category, question_text FROM interview_questions
       WHERE session_id = ? AND organization_id = ?
       ${inClause}
       ORDER BY category, sort_order`,
      restrict ? [sessionId, user.organizationId, ...questionIds] : [sessionId, user.organizationId]
    );

    const MappingSchema = z.object({
      answers: z.array(
        z.object({
          questionId: z.string().min(1),
          answerText: z.string().min(1),
        })
      ),
    });

    const systemPrompt = `
You are a senior consultant. Your task is to map a chat transcript into structured interview answers.
Rules:
- Facts only. No recommendations or plans.
- Only answer questions that are clearly supported by the transcript.
- Keep answers concise, in the same language as the transcript.
- Return ONLY JSON: { answers: [{questionId, answerText}] }.
`;

    const userPrompt = `
Transcript:
${text}

Questions to map:
${JSON.stringify(questions || [], null, 2)}
`;

    const result = await llmService.call({
      type: 'structured',
      modelConfig: { id: 'standard' },
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      schema: MappingSchema,
      maxTokens: 1200,
      temperature: 0.2,
      cache: false,
    });

    res.json((result as any).object || { answers: [] });
  }),

  // ==========================================
  // QUESTIONS (Task-list style)
  // ==========================================

  getQuestions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { category } = req.query;

    let query = `SELECT * FROM interview_questions WHERE session_id = ? AND organization_id = ?`;
    const params: unknown[] = [sessionId, user.organizationId];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY category, sort_order`;

    const rows = await queryHelpers.queryAll(query, params);
    res.json(rows.map(buildQuestionResponse));
  }),

  updateQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { questionId } = req.params;
    const { answerText, status, confidenceScore, tags } = req.body;

    // Lock edits when session is submitted/completed
    const qSession = await queryHelpers.queryOne(
      `SELECT q.session_id as session_id, s.status as session_status, s.owner_id as owner_id
       FROM interview_questions q
       JOIN interview_sessions s ON s.id = q.session_id
       WHERE q.id = ? AND q.organization_id = ? AND s.organization_id = ?`,
      [questionId, user.organizationId, user.organizationId]
    );
    if (!qSession) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    if (String((qSession as any).owner_id) !== String(user.id)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (isLockedSessionStatus((qSession as any).session_status)) {
      res.status(409).json({ error: 'Session is locked' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (answerText !== undefined) {
      updates.push('answer_text = ?');
      params.push(answerText);
    }
    if (status && QUESTION_STATUSES.includes(status)) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'answered') {
        updates.push('answered_by = ?', 'answered_at = ?');
        params.push(user.id, new Date().toISOString());
      }
    }
    if (confidenceScore !== undefined) {
      updates.push('confidence_score = ?');
      params.push(Math.max(0, Math.min(5, confidenceScore)));
    }
    if (tags) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(questionId, user.organizationId);

    await queryHelpers.queryRun(
      `UPDATE interview_questions SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );

    // Update session progress
    const question = (await queryHelpers.queryOne(
      `SELECT session_id FROM interview_questions WHERE id = ?`,
      [questionId]
    )) as { session_id: string } | null;

    if (question) {
      await InterviewController.updateSessionProgress(question.session_id);
    }

    const updated = await queryHelpers.queryOne(`SELECT * FROM interview_questions WHERE id = ?`, [
      questionId,
    ]);
    res.json(buildQuestionResponse(updated));
  }),

  addQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { category, questionText } = req.body;

    try {
      await assertSessionEditable(sessionId, user.organizationId);
      await assertSessionOwnedByUser(sessionId, user.organizationId, user.id);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      if (msg.toLowerCase().includes('forbidden')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (msg.toLowerCase().includes('locked')) {
        res.status(409).json({ error: 'Session is locked' });
        return;
      }
      throw e;
    }

    if (!category || !INTERVIEW_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }
    if (!questionText) {
      res.status(400).json({ error: 'questionText is required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    // Get max sort order
    const maxOrder = (await queryHelpers.queryOne(
      `SELECT MAX(sort_order) as max_order FROM interview_questions WHERE session_id = ? AND category = ?`,
      [sessionId, category]
    )) as { max_order: number } | null;

    await queryHelpers.queryRun(
      `INSERT INTO interview_questions
       (id, session_id, organization_id, category, question_text, status, sort_order, is_template, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        user.organizationId,
        category,
        questionText,
        'not_started',
        (maxOrder?.max_order || 0) + 1,
        0,
        now,
        now,
      ]
    );

    // Update total questions
    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET total_questions = total_questions + 1 WHERE id = ?`,
      [sessionId]
    );

    const created = await queryHelpers.queryOne(`SELECT * FROM interview_questions WHERE id = ?`, [
      id,
    ]);
    res.status(201).json(buildQuestionResponse(created));
  }),

  // Helper to update session progress
  updateSessionProgress: async (sessionId: string) => {
    const questions = (await queryHelpers.queryAll(
      `SELECT category, status FROM interview_questions WHERE session_id = ?`,
      [sessionId]
    )) as { category: string; status: string }[];

    const progress: Record<string, number> = {
      strategy: 0,
      operations: 0,
      digital: 0,
      people: 0,
      finance: 0,
    };
    const categoryCount: Record<string, number> = {
      strategy: 0,
      operations: 0,
      digital: 0,
      people: 0,
      finance: 0,
    };
    let answeredTotal = 0;

    for (const q of questions) {
      if (INTERVIEW_CATEGORIES.includes(q.category as InterviewCategory)) {
        categoryCount[q.category]++;
        if (q.status === 'answered') {
          progress[q.category]++;
          answeredTotal++;
        }
      }
    }

    // Calculate percentage per category
    for (const cat of INTERVIEW_CATEGORIES) {
      if (categoryCount[cat] > 0) {
        progress[cat] = Math.round((progress[cat] / categoryCount[cat]) * 100);
      }
    }

    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET progress_json = ?, answered_questions = ?, last_activity_at = ? WHERE id = ?`,
      [JSON.stringify(progress), answeredTotal, new Date().toISOString(), sessionId]
    );
  },

  // ==========================================
  // NOTES
  // ==========================================

  getNotes: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;

    const rows = await queryHelpers.queryAll(
      `SELECT * FROM interview_notes WHERE session_id = ? AND organization_id = ? ORDER BY created_at DESC`,
      [sessionId, user.organizationId]
    );
    res.json(rows.map(buildNoteResponse));
  }),

  createNote: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { category, title, content } = req.body;

    try {
      await assertSessionEditable(sessionId, user.organizationId);
      await assertSessionOwnedByUser(sessionId, user.organizationId, user.id);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      if (msg.toLowerCase().includes('forbidden')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (msg.toLowerCase().includes('locked')) {
        res.status(409).json({ error: 'Session is locked' });
        return;
      }
      throw e;
    }

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_notes (id, session_id, organization_id, category, title, content, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        user.organizationId,
        category || null,
        title || null,
        content,
        user.id,
        now,
        now,
      ]
    );

    const created = await queryHelpers.queryOne(`SELECT * FROM interview_notes WHERE id = ?`, [id]);
    res.status(201).json(buildNoteResponse(created));
  }),

  updateNote: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { noteId } = req.params;
    const { title, content } = req.body;

    // Lock edits when note's session is submitted/completed
    const noteSession = await queryHelpers.queryOne(
      `SELECT n.session_id as session_id, s.status as session_status
       FROM interview_notes n
       JOIN interview_sessions s ON s.id = n.session_id
       JOIN projects p ON p.id = s.project_id
       WHERE n.id = ? AND n.organization_id = ? AND p.organization_id = ?`,
      [noteId, user.organizationId, user.organizationId]
    );
    if (!noteSession) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    if (
      String(
        (
          (await queryHelpers.queryOne(
            `SELECT s.user_id as owner_id FROM interview_sessions s
       JOIN projects p ON p.id = s.project_id
       WHERE s.id = ? AND p.organization_id = ?`,
            [(noteSession as any).session_id, user.organizationId]
          )) as any
        )?.owner_id
      ) !== String(user.id)
    ) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (isLockedSessionStatus((noteSession as any).session_status)) {
      res.status(409).json({ error: 'Session is locked' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(noteId, user.organizationId);

    await queryHelpers.queryRun(
      `UPDATE interview_notes SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );

    const updated = await queryHelpers.queryOne(`SELECT * FROM interview_notes WHERE id = ?`, [
      noteId,
    ]);
    res.json(buildNoteResponse(updated));
  }),

  deleteNote: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { noteId } = req.params;

    // Lock deletes when note's session is submitted/completed
    const noteSession = await queryHelpers.queryOne(
      `SELECT n.session_id as session_id, s.status as session_status
       FROM interview_notes n
       JOIN interview_sessions s ON s.id = n.session_id
       JOIN projects p ON p.id = s.project_id
       WHERE n.id = ? AND n.organization_id = ? AND p.organization_id = ?`,
      [noteId, user.organizationId, user.organizationId]
    );
    if (!noteSession) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    if (
      String(
        (
          (await queryHelpers.queryOne(
            `SELECT s.user_id as owner_id FROM interview_sessions s
       JOIN projects p ON p.id = s.project_id
       WHERE s.id = ? AND p.organization_id = ?`,
            [(noteSession as any).session_id, user.organizationId]
          )) as any
        )?.owner_id
      ) !== String(user.id)
    ) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (isLockedSessionStatus((noteSession as any).session_status)) {
      res.status(409).json({ error: 'Session is locked' });
      return;
    }

    await queryHelpers.queryRun(
      `DELETE FROM interview_notes WHERE id = ? AND organization_id = ?`,
      [noteId, user.organizationId]
    );

    res.json({ success: true });
  }),

  // ==========================================
  // EVIDENCE
  // ==========================================

  getEvidence: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;

    const rows = await queryHelpers.queryAll(
      `SELECT * FROM interview_evidence WHERE session_id = ? AND organization_id = ? ORDER BY created_at DESC`,
      [sessionId, user.organizationId]
    );
    res.json(rows.map(buildEvidenceResponse));
  }),

  createEvidence: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { questionId, evidenceType, title, description, fileName, fileSize, fileType, url } =
      req.body;

    try {
      await assertSessionEditable(sessionId, user.organizationId);
      await assertSessionOwnedByUser(sessionId, user.organizationId, user.id);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('not found')) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      if (msg.toLowerCase().includes('forbidden')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (msg.toLowerCase().includes('locked')) {
        res.status(409).json({ error: 'Session is locked' });
        return;
      }
      throw e;
    }

    if (!evidenceType || !title) {
      res.status(400).json({ error: 'evidenceType and title are required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_evidence
       (id, session_id, organization_id, question_id, evidence_type, title, description, file_name, file_size, file_type, url, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        user.organizationId,
        questionId || null,
        evidenceType,
        title,
        description || null,
        fileName || null,
        fileSize || null,
        fileType || null,
        url || null,
        user.id,
        now,
      ]
    );

    const created = await queryHelpers.queryOne(`SELECT * FROM interview_evidence WHERE id = ?`, [
      id,
    ]);
    res.status(201).json(buildEvidenceResponse(created));
  }),

  deleteEvidence: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { evidenceId } = req.params;

    // Lock deletes when evidence session is submitted/completed
    const evSession = await queryHelpers.queryOne(
      `SELECT e.session_id as session_id, s.status as session_status
       FROM interview_evidence e
       JOIN interview_sessions s ON s.id = e.session_id
       JOIN projects p ON p.id = s.project_id
       WHERE e.id = ? AND e.organization_id = ? AND p.organization_id = ?`,
      [evidenceId, user.organizationId, user.organizationId]
    );
    if (!evSession) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }
    if (
      String(
        (
          (await queryHelpers.queryOne(
            `SELECT s.user_id as owner_id FROM interview_sessions s
       JOIN projects p ON p.id = s.project_id
       WHERE s.id = ? AND p.organization_id = ?`,
            [(evSession as any).session_id, user.organizationId]
          )) as any
        )?.owner_id
      ) !== String(user.id)
    ) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (isLockedSessionStatus((evSession as any).session_status)) {
      res.status(409).json({ error: 'Session is locked' });
      return;
    }

    await queryHelpers.queryRun(
      `DELETE FROM interview_evidence WHERE id = ? AND organization_id = ?`,
      [evidenceId, user.organizationId]
    );

    res.json({ success: true });
  }),

  // ==========================================
  // ORGANIZATION CONTEXT (Company Facts)
  // ==========================================

  getOrganizationContext: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);

    const row = await queryHelpers.queryOne(
      `SELECT * FROM organization_context WHERE organization_id = ?`,
      [user.organizationId]
    );

    if (!row) {
      res.json({
        organizationId: user.organizationId,
        companyName: null,
        industry: null,
        companySize: null,
        location: null,
        employeeCount: null,
        annualRevenue: null,
        keyMetrics: [],
        stakeholders: [],
        openGaps: [],
        completenessPercent: 0,
      });
      return;
    }

    res.json({
      id: (row as any).id,
      organizationId: (row as any).organization_id,
      companyName: (row as any).company_name,
      industry: (row as any).industry,
      companySize: (row as any).company_size,
      location: (row as any).location,
      employeeCount: (row as any).employee_count,
      annualRevenue: (row as any).annual_revenue,
      keyMetrics: parseJson((row as any).key_metrics, []),
      stakeholders: parseJson((row as any).stakeholders, []),
      openGaps: parseJson((row as any).open_gaps, []),
      completenessPercent: (row as any).completeness_percent || 0,
      lastInterviewId: (row as any).last_interview_id,
    });
  }),

  updateOrganizationContext: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const {
      companyName,
      industry,
      companySize,
      location,
      employeeCount,
      annualRevenue,
      keyMetrics,
      stakeholders,
      openGaps,
      lastInterviewId,
    } = req.body;

    const existing = await queryHelpers.queryOne(
      `SELECT id FROM organization_context WHERE organization_id = ?`,
      [user.organizationId]
    );

    const now = new Date().toISOString();

    // Calculate completeness
    let completeness = 0;
    if (companyName) completeness += 15;
    if (industry) completeness += 15;
    if (companySize) completeness += 10;
    if (location) completeness += 10;
    if (employeeCount) completeness += 10;
    if (keyMetrics && keyMetrics.length > 0) completeness += 20;
    if (stakeholders && stakeholders.length > 0) completeness += 20;

    if (existing) {
      await queryHelpers.queryRun(
        `UPDATE organization_context SET
         company_name = COALESCE(?, company_name),
         industry = COALESCE(?, industry),
         company_size = COALESCE(?, company_size),
         location = COALESCE(?, location),
         employee_count = COALESCE(?, employee_count),
         annual_revenue = COALESCE(?, annual_revenue),
         key_metrics = COALESCE(?, key_metrics),
         stakeholders = COALESCE(?, stakeholders),
         open_gaps = COALESCE(?, open_gaps),
         completeness_percent = ?,
         last_interview_id = COALESCE(?, last_interview_id),
         updated_at = ?
         WHERE organization_id = ?`,
        [
          companyName || null,
          industry || null,
          companySize || null,
          location || null,
          employeeCount || null,
          annualRevenue || null,
          keyMetrics ? JSON.stringify(keyMetrics) : null,
          stakeholders ? JSON.stringify(stakeholders) : null,
          openGaps ? JSON.stringify(openGaps) : null,
          completeness,
          lastInterviewId || null,
          now,
          user.organizationId,
        ]
      );
    } else {
      const id = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO organization_context
         (id, organization_id, company_name, industry, company_size, location, employee_count, annual_revenue,
          key_metrics, stakeholders, open_gaps, completeness_percent, last_interview_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          user.organizationId,
          companyName || null,
          industry || null,
          companySize || null,
          location || null,
          employeeCount || null,
          annualRevenue || null,
          JSON.stringify(keyMetrics || []),
          JSON.stringify(stakeholders || []),
          JSON.stringify(openGaps || []),
          completeness,
          lastInterviewId || null,
          now,
          now,
        ]
      );
    }

    const updated = await queryHelpers.queryOne(
      `SELECT * FROM organization_context WHERE organization_id = ?`,
      [user.organizationId]
    );

    res.json({
      id: (updated as any).id,
      organizationId: (updated as any).organization_id,
      companyName: (updated as any).company_name,
      industry: (updated as any).industry,
      companySize: (updated as any).company_size,
      location: (updated as any).location,
      employeeCount: (updated as any).employee_count,
      annualRevenue: (updated as any).annual_revenue,
      keyMetrics: parseJson((updated as any).key_metrics, []),
      stakeholders: parseJson((updated as any).stakeholders, []),
      openGaps: parseJson((updated as any).open_gaps, []),
      completenessPercent: (updated as any).completeness_percent,
    });
  }),

  // ==========================================
  // EXPORT CONTEXT
  // ==========================================

  exportContext: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { targetType, targetId } = req.body;

    if (!targetType || !targetId) {
      res.status(400).json({ error: 'targetType and targetId are required' });
      return;
    }

    // Context gating: only allow when assignment is completed OR completeness>=50% after submit
    const sessionRow = await queryHelpers.queryOne(
      `SELECT id, status, assignment_id, answered_questions, total_questions FROM interview_sessions
       WHERE id = ? AND organization_id = ?`,
      [sessionId, user.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if ((sessionRow as any).assignment_id) {
      const assignment = await queryHelpers.queryOne(
        `SELECT status FROM interview_assignments WHERE id = ? AND organization_id = ?`,
        [(sessionRow as any).assignment_id, user.organizationId]
      );
      const answered = Number((sessionRow as any).answered_questions || 0);
      const total = Number((sessionRow as any).total_questions || 0);
      const ratio = calcCompletenessRatio(answered, total);
      const allowed =
        String((assignment as any)?.status || '').toLowerCase() === 'completed' ||
        (String((assignment as any)?.status || '').toLowerCase() === 'submitted' && ratio >= 0.5);
      if (!allowed) {
        res.status(409).json({ error: 'Interview not completed (>=50%) - cannot export yet' });
        return;
      }
    }

    const context = await queryHelpers.queryOne(
      `SELECT * FROM organization_context WHERE organization_id = ?`,
      [user.organizationId]
    );

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_context_exports
       (id, interview_session_id, organization_id, target_type, target_id, context_snapshot, exported_by, exported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        user.organizationId,
        targetType,
        targetId,
        JSON.stringify(context || {}),
        user.id,
        now,
      ]
    );

    logger.info(`[InterviewController] Exported context to ${targetType}:${targetId}`);
    res.json({ success: true, exportId: id });
  }),

  // ==========================================
  // GENERATE SUMMARY (ONLY FACTS - no recommendations)
  // ==========================================

  generateSummary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;

    // Context gating: only allow when assignment is completed OR completeness>=50% after submit
    const sessionRow = await queryHelpers.queryOne(
      `SELECT id, status, assignment_id, answered_questions, total_questions FROM interview_sessions
       WHERE id = ? AND organization_id = ?`,
      [sessionId, user.organizationId]
    );
    if (!sessionRow) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    if ((sessionRow as any).assignment_id) {
      const assignment = await queryHelpers.queryOne(
        `SELECT status FROM interview_assignments WHERE id = ? AND organization_id = ?`,
        [(sessionRow as any).assignment_id, user.organizationId]
      );
      const answered = Number((sessionRow as any).answered_questions || 0);
      const total = Number((sessionRow as any).total_questions || 0);
      const ratio = calcCompletenessRatio(answered, total);
      const allowed =
        String((assignment as any)?.status || '').toLowerCase() === 'completed' ||
        (String((assignment as any)?.status || '').toLowerCase() === 'submitted' && ratio >= 0.5);
      if (!allowed) {
        res
          .status(409)
          .json({ error: 'Interview not completed (>=50%) - cannot generate summary yet' });
        return;
      }
    }

    // Get all answered questions
    const questions = (await queryHelpers.queryAll(
      `SELECT * FROM interview_questions WHERE session_id = ? AND status = 'answered' ORDER BY category, sort_order`,
      [sessionId]
    )) as any[];

    // Group by category and extract facts
    const facts: { category: string; fact: string }[] = [];
    const gaps: { category: string; gap: string }[] = [];
    const constraints: { category: string; constraint: string }[] = [];
    const painPoints: { category: string; painPoint: string }[] = [];

    for (const q of questions) {
      if (q.answer_text) {
        // Add as fact
        facts.push({ category: q.category, fact: `${q.question_text}: ${q.answer_text}` });

        // Check tags for constraints/pain points
        const tags = parseJson(q.tags, []) as string[];
        if (tags.includes('constraint')) {
          constraints.push({ category: q.category, constraint: q.answer_text });
        }
        if (tags.includes('pain_point') || tags.includes('risk')) {
          painPoints.push({ category: q.category, painPoint: q.answer_text });
        }
      }
    }

    // Find gaps (unanswered required questions or low confidence)
    const allQuestions = (await queryHelpers.queryAll(
      `SELECT * FROM interview_questions WHERE session_id = ?`,
      [sessionId]
    )) as any[];

    for (const q of allQuestions) {
      if (q.status !== 'answered' || (q.confidence_score && q.confidence_score < 3)) {
        gaps.push({ category: q.category, gap: q.question_text });
      }
    }

    // Update session with summary (ONLY FACTS)
    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET
       summary_facts = ?, summary_gaps = ?, summary_constraints = ?, summary_pain_points = ?, updated_at = ?
       WHERE id = ?`,
      [
        JSON.stringify(facts),
        JSON.stringify(gaps),
        JSON.stringify(constraints),
        JSON.stringify(painPoints),
        new Date().toISOString(),
        sessionId,
      ]
    );

    res.json({
      facts,
      gaps,
      constraints,
      painPoints,
      message: 'Summary generated (facts only, no recommendations)',
    });
  }),

  // ==========================================
  // COMPLETED SESSIONS (for Insights tab)
  // ==========================================

  getCompletedSessions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);

    // Filter by organization (project-scoped OR org-scoped) and return lightweight rows for Insights tab
    const rows = await queryHelpers.queryAll(
      `SELECT 
        s.id, s.name as name, s.template_id, s.status, s.completed_at, s.owner_id,
        s.answered_questions, s.total_questions,
        t.name as template_name, t.category as template_category,
        COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') as respondent_name
       FROM interview_sessions s
       LEFT JOIN projects p ON p.id = s.project_id
       LEFT JOIN interview_library_templates t ON t.id = s.template_id
       LEFT JOIN users u ON u.id = s.owner_id
       WHERE (
         p.organization_id = ?
         OR (s.project_id IS NULL AND s.organization_id = ?)
       ) AND s.status = 'completed'
       ORDER BY s.completed_at DESC`,
      [user.organizationId, user.organizationId]
    );

    const sessions = (rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      templateId: row.template_id,
      templateName: row.template_name,
      templateCategory: row.template_category,
      status: row.status,
      completedAt: row.completed_at,
      respondentId: row.owner_id,
      respondentName: row.respondent_name,
      answeredQuestions: row.answered_questions,
      totalQuestions: row.total_questions,
    }));

    res.json(sessions);
  }),

  // ==========================================
  // INSIGHTS (AI-generated summaries)
  // ==========================================

  listInsights: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { limit = 50, offset = 0 } = req.query;

    const interviewInsightService = await import('../services/InterviewInsightService.js');
    const insights = await interviewInsightService.list(user.organizationId, {
      limit: Number(limit),
      offset: Number(offset),
    });

    res.json(insights);
  }),

  getInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const interviewInsightService = await import('../services/InterviewInsightService.js');
    const insight = await interviewInsightService.getById(id);
    if (!insight) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }
    res.json(insight);
  }),

  createInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { title, sessionIds, sessionId, promptType, filters, customPrompt } = req.body || {};

    const normalizedSessionIds: string[] = Array.isArray(sessionIds)
      ? sessionIds.map(String).filter(Boolean)
      : sessionId
        ? [String(sessionId)].filter(Boolean)
        : [];

    if (normalizedSessionIds.length === 0) {
      res.status(400).json({ error: 'sessionId or sessionIds is required' });
      return;
    }

    let normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedPromptType = (
      typeof promptType === 'string' && promptType.trim() ? promptType.trim() : 'summary'
    ) as any;

    // If title is omitted (e.g. quick-generate from a session row), build a reasonable default.
    if (!normalizedTitle) {
      try {
        const sessionRow = await queryHelpers.queryOne(
          `SELECT name FROM interview_sessions WHERE id = ?`,
          [normalizedSessionIds[0]]
        );
        const sessionName = String((sessionRow as any)?.name || '').trim();
        normalizedTitle = sessionName
          ? `${sessionName} — ${normalizedPromptType}`
          : `Interview Insight — ${normalizedPromptType}`;
      } catch {
        normalizedTitle = `Interview Insight — ${normalizedPromptType}`;
      }
    }

    const interviewInsightService = await import('../services/InterviewInsightService.js');
    const insight = await interviewInsightService.create({
      organizationId: user.organizationId,
      title: normalizedTitle,
      sessionIds: normalizedSessionIds,
      promptType: normalizedPromptType,
      filters,
      customPrompt,
      createdBy: user.id,
    });

    res.status(201).json(insight);
  }),

  regenerateInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const interviewInsightService = await import('../services/InterviewInsightService.js');
    const insight = await interviewInsightService.regenerate(id);

    if (!insight) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }

    res.json(insight);
  }),

  deleteInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const interviewInsightService = await import('../services/InterviewInsightService.js');
    const deleted = await interviewInsightService.deleteInsight(id);

    if (!deleted) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }

    res.json({ success: true });
  }),

  // Update insight (status, etc.)
  updateInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status, exportedToTools, exportedToAssessment } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (exportedToTools !== undefined) {
      updates.push('exported_to_tools = ?');
      values.push(exportedToTools ? 1 : 0);
    }
    if (exportedToAssessment !== undefined) {
      updates.push('exported_to_assessment = ?');
      values.push(exportedToAssessment ? 1 : 0);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await queryHelpers.queryRun(
      `UPDATE interview_insights SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ success: true });
  }),

  // Export insight to Tools or Assessment
  exportInsight: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { target } = req.body;

    if (!target || !['tools', 'assessment'].includes(target)) {
      res.status(400).json({ error: 'target must be "tools" or "assessment"' });
      return;
    }

    // Load insight so we can create an actual downstream artifact (Tools/Assessment).
    // NOTE: There are environments with different `interview_insights` schemas.
    // We treat `session_id` as best-effort: export should still work even if session is missing.
    let insightRow: any = null;
    try {
      insightRow = (await queryHelpers.queryOne(
        `SELECT
          id, session_id, organization_id, category, title, description,
          insight_type, status, exported_to_tools, exported_to_assessment
         FROM interview_insights
         WHERE id = ? AND organization_id = ?`,
        [id, user.organizationId]
      )) as any;
    } catch (e: any) {
      // fallback for other schema variants
      try {
        insightRow = (await queryHelpers.queryOne(
          `SELECT
            id, organization_id, title, prompt_type, source_session_ids, content, status
           FROM interview_insights
           WHERE id = ? AND organization_id = ?`,
          [id, user.organizationId]
        )) as any;
      } catch {
        // ignore - handled below
      }
    }

    if (!insightRow) {
      res.status(404).json({ error: 'Insight not found' });
      return;
    }

    // Resolve a usable sessionId (optional).
    let sessionId: string | null = null;
    if (insightRow.session_id) {
      sessionId = String(insightRow.session_id);
    } else if (insightRow.source_session_ids) {
      try {
        const ids = JSON.parse(String(insightRow.source_session_ids || '[]'));
        if (Array.isArray(ids) && ids[0]) sessionId = String(ids[0]);
      } catch {
        // ignore
      }
    }

    // Context gating (best-effort): only enforce when we can actually load the session + assignment.
    let sessionRow: any = null;
    if (sessionId) {
      sessionRow = await queryHelpers.queryOne(
        `SELECT id, status, assignment_id, answered_questions, total_questions, project_id FROM interview_sessions
         WHERE id = ? AND organization_id = ?`,
        [sessionId, user.organizationId]
      );
      if (sessionRow && (sessionRow as any).assignment_id) {
        const assignment = await queryHelpers.queryOne(
          `SELECT status FROM interview_assignments WHERE id = ? AND organization_id = ?`,
          [(sessionRow as any).assignment_id, user.organizationId]
        );
        const answered = Number((sessionRow as any).answered_questions || 0);
        const total = Number((sessionRow as any).total_questions || 0);
        const ratio = calcCompletenessRatio(answered, total);
        const allowed =
          String((assignment as any)?.status || '').toLowerCase() === 'completed' ||
          (String((assignment as any)?.status || '').toLowerCase() === 'submitted' && ratio >= 0.5);
        if (!allowed) {
          res.status(409).json({ error: 'Interview not completed (>=50%) - cannot export yet' });
          return;
        }
      }
    }

    // Ensure mapping table exists (idempotent exports by insight+target).
    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS interview_insight_exports (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        insight_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_interview_insight_exports_org ON interview_insight_exports(organization_id)`
    );
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_interview_insight_exports_insight ON interview_insight_exports(insight_id)`
    );

    const existing = (await queryHelpers.queryOne(
      `SELECT target_id FROM interview_insight_exports
       WHERE organization_id = ? AND insight_id = ? AND target_type = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.organizationId, id, target]
    )) as any;

    // If already exported, just mark flags (if needed) and return the previously created target id.
    if (existing?.target_id) {
      const column = target === 'tools' ? 'exported_to_tools' : 'exported_to_assessment';
      await queryHelpers.queryRun(
        `UPDATE interview_insights SET ${column} = 1, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), id]
      );
      if (target === 'assessment') {
        let assessmentType: string | undefined;
        try {
          const row = (await queryHelpers.queryOne(
            `SELECT assessment_type FROM assessments WHERE id = ? AND organization_id = ?`,
            [existing.target_id, user.organizationId]
          )) as any;
          if (row?.assessment_type) assessmentType = String(row.assessment_type);
        } catch {
          // ignore
        }
        res.json({
          success: true,
          target,
          targetId: existing.target_id,
          assessmentType: assessmentType || 'DRD',
        });
        return;
      }

      res.json({ success: true, target, targetId: existing.target_id });
      return;
    }

    const now = new Date().toISOString();

    if (target === 'tools') {
      // Ensure tool_sessions exists (it should via migrations, but keep it safe in dev).
      await queryHelpers.queryRun(
        `CREATE TABLE IF NOT EXISTS tool_sessions (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          project_id TEXT,
          tool_type TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT DEFAULT 'DRAFT',
          completion_percent INTEGER DEFAULT 0,
          confidence_avg REAL DEFAULT 0,
          answers_json TEXT DEFAULT '{}',
          context_snapshot TEXT DEFAULT '{}',
          review_requested_at TIMESTAMP,
          approved_at TIMESTAMP,
          created_by TEXT NOT NULL,
          updated_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      );

      const projectIdCandidate = (sessionRow as any)?.project_id as string | null | undefined;
      // Best-effort: prefer a valid projectId so Tools hub (project-scoped) can see it.
      // If org has no projects, fall back to NULL (tools still work org-wide).
      let resolvedProjectId: string | null = projectIdCandidate || null;
      try {
        resolvedProjectId = await resolveValidProjectId({
          organizationId: user.organizationId,
          projectId: projectIdCandidate || undefined,
        });
      } catch {
        resolvedProjectId = projectIdCandidate || null;
      }

      const toolSessionId = uuidv4();
      const toolType = 'dynamic-swot';
      const name = `Interview Insight: ${String(insightRow.title || 'Untitled')}`;

      const orgContext = await queryHelpers.queryOne(
        `SELECT * FROM organization_context WHERE organization_id = ?`,
        [user.organizationId]
      );

      const contextSnapshot = {
        source: {
          kind: 'interview_insight',
          insightId: id,
          sessionId: sessionId || null,
          category: insightRow.category,
          title: insightRow.title,
          description: insightRow.description || insightRow.content || null,
          insightType: insightRow.insight_type || insightRow.prompt_type || null,
          exportedAt: now,
        },
        organizationContext: orgContext || {},
      };

      await queryHelpers.queryRun(
        `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent, confidence_avg, answers_json, context_snapshot, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'DRAFT', 0, 0, ?, ?, ?, ?, ?)`,
        [
          toolSessionId,
          user.organizationId,
          resolvedProjectId || null,
          toolType,
          name,
          JSON.stringify({}),
          JSON.stringify(contextSnapshot),
          user.id,
          now,
          now,
        ]
      );

      await queryHelpers.queryRun(
        `INSERT INTO interview_insight_exports
         (id, organization_id, insight_id, session_id, target_type, target_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          user.organizationId,
          id,
          sessionId || 'unknown',
          'tools',
          toolSessionId,
          user.id,
          now,
        ]
      );

      // Only create a context export record when we actually have a session id.
      if (sessionId) {
        await queryHelpers.queryRun(
          `INSERT INTO interview_context_exports
           (id, interview_session_id, organization_id, target_type, target_id, context_snapshot, exported_by, exported_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            sessionId,
            user.organizationId,
            'tools',
            toolSessionId,
            JSON.stringify(orgContext || {}),
            user.id,
            now,
          ]
        );
      }

      // Best-effort flags (some schemas might not have these columns).
      try {
        await queryHelpers.queryRun(
          `UPDATE interview_insights SET exported_to_tools = 1, updated_at = ? WHERE id = ?`,
          [now, id]
        );
      } catch {
        // ignore
      }

      res.json({ success: true, target: 'tools', targetId: toolSessionId });
      return;
    }

    // Create an actual Assessment artifact (so the user can immediately open it).
    // Keep this resilient: the Assessment module can exist in different schema states.
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

    const projectIdCandidate = (sessionRow as any)?.project_id as string | null | undefined;
    let resolvedProjectId: string | null = projectIdCandidate || null;
    try {
      resolvedProjectId = await resolveValidProjectId({
        organizationId: user.organizationId,
        projectId: projectIdCandidate || undefined,
      });
    } catch {
      resolvedProjectId = projectIdCandidate || null;
    }

    const assessmentId = uuidv4();
    const assessmentType = 'DRD';
    const name = `Interview Insight: ${String(insightRow.title || 'Untitled')}`;

    const orgContext = await queryHelpers.queryOne(
      `SELECT * FROM organization_context WHERE organization_id = ?`,
      [user.organizationId]
    );

    const contextSnapshot = {
      source: {
        kind: 'interview_insight',
        insightId: id,
        sessionId: sessionId || null,
        category: insightRow.category,
        title: insightRow.title,
        description: insightRow.description || insightRow.content || null,
        insightType: insightRow.insight_type || insightRow.prompt_type || null,
        exportedAt: now,
      },
      organizationContext: orgContext || {},
    };

    await queryHelpers.queryRun(
      `INSERT INTO assessments
       (id, organization_id, project_id, assessment_type, name, status, completion_percent, confidence_avg, answers_json, context_snapshot, score_summary, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'DRAFT', 0, 0, ?, ?, ?, ?, ?, ?)`,
      [
        assessmentId,
        user.organizationId,
        resolvedProjectId || null,
        assessmentType,
        name,
        JSON.stringify({}),
        JSON.stringify(contextSnapshot),
        JSON.stringify({}),
        user.id,
        now,
        now,
      ]
    );

    await queryHelpers.queryRun(
      `INSERT INTO interview_insight_exports
       (id, organization_id, insight_id, session_id, target_type, target_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        user.organizationId,
        id,
        sessionId || 'unknown',
        'assessment',
        assessmentId,
        user.id,
        now,
      ]
    );

    try {
      await queryHelpers.queryRun(
        `UPDATE interview_insights SET exported_to_assessment = 1, updated_at = ? WHERE id = ?`,
        [now, id]
      );
    } catch {
      // ignore
    }

    res.json({ success: true, target: 'assessment', targetId: assessmentId, assessmentType });
  }),
};

export default InterviewController;
