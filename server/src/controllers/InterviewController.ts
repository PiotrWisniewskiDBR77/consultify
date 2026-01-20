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

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';

// 5 Interview Categories (new spec)
const INTERVIEW_CATEGORIES = ['strategy', 'operations', 'digital', 'people', 'finance'] as const;
type InterviewCategory = typeof INTERVIEW_CATEGORIES[number];

// Question statuses (task-list style)
const QUESTION_STATUSES = ['not_started', 'in_progress', 'answered', 'needs_follow_up'] as const;
type QuestionStatus = typeof QUESTION_STATUSES[number];

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
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id || undefined,
    name: row.name || 'Discovery Interview',
    ownerId: row.owner_id,
    status: row.status,
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

export const InterviewController = {
  // ==========================================
  // SESSIONS
  // ==========================================

  getSessions: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { status } = req.query;

    let query = `SELECT * FROM interview_sessions WHERE organization_id = ?`;
    const params: unknown[] = [user.organizationId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY last_activity_at DESC`;

    const rows = await queryHelpers.queryAll(query, params);
    res.json(rows.map(buildSessionResponse));
  }),

  getSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;

    const row = await queryHelpers.queryOne(
      `SELECT * FROM interview_sessions WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(buildSessionResponse(row));
  }),

  createSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { name, projectId } = req.body;

    const id = uuidv4();
    const now = new Date().toISOString();

    // Create session
    await queryHelpers.queryRun(
      `INSERT INTO interview_sessions
       (id, organization_id, project_id, name, owner_id, status, progress_json,
        started_at, last_activity_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user.organizationId,
        projectId || null,
        name || 'Discovery Interview',
        user.id,
        'in_progress',
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
    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET total_questions = ? WHERE id = ?`,
      [questionCount, id]
    );

    const session = await queryHelpers.queryOne(`SELECT * FROM interview_sessions WHERE id = ?`, [id]);
    logger.info(`[InterviewController] Created session ${id} with ${questionCount} questions`);
    res.status(201).json(buildSessionResponse(session));
  }),

  updateSession: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params;
    const { name, status, summaryFacts, summaryGaps, summaryConstraints, summaryPainPoints } = req.body;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'completed') {
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

    updates.push('last_activity_at = ?', 'updated_at = ?');
    params.push(new Date().toISOString(), new Date().toISOString());
    params.push(id, user.organizationId);

    await queryHelpers.queryRun(
      `UPDATE interview_sessions SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );

    const updated = await queryHelpers.queryOne(`SELECT * FROM interview_sessions WHERE id = ?`, [id]);
    res.json(buildSessionResponse(updated));
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
    const question = await queryHelpers.queryOne(
      `SELECT session_id FROM interview_questions WHERE id = ?`,
      [questionId]
    ) as { session_id: string } | null;

    if (question) {
      await InterviewController.updateSessionProgress(question.session_id);
    }

    const updated = await queryHelpers.queryOne(`SELECT * FROM interview_questions WHERE id = ?`, [questionId]);
    res.json(buildQuestionResponse(updated));
  }),

  addQuestion: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { sessionId } = req.params;
    const { category, questionText } = req.body;

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
    const maxOrder = await queryHelpers.queryOne(
      `SELECT MAX(sort_order) as max_order FROM interview_questions WHERE session_id = ? AND category = ?`,
      [sessionId, category]
    ) as { max_order: number } | null;

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

    const created = await queryHelpers.queryOne(`SELECT * FROM interview_questions WHERE id = ?`, [id]);
    res.status(201).json(buildQuestionResponse(created));
  }),

  // Helper to update session progress
  updateSessionProgress: async (sessionId: string) => {
    const questions = await queryHelpers.queryAll(
      `SELECT category, status FROM interview_questions WHERE session_id = ?`,
      [sessionId]
    ) as { category: string; status: string }[];

    const progress: Record<string, number> = { strategy: 0, operations: 0, digital: 0, people: 0, finance: 0 };
    const categoryCount: Record<string, number> = { strategy: 0, operations: 0, digital: 0, people: 0, finance: 0 };
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

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO interview_notes (id, session_id, organization_id, category, title, content, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sessionId, user.organizationId, category || null, title || null, content, user.id, now, now]
    );

    const created = await queryHelpers.queryOne(`SELECT * FROM interview_notes WHERE id = ?`, [id]);
    res.status(201).json(buildNoteResponse(created));
  }),

  updateNote: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { noteId } = req.params;
    const { title, content } = req.body;

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

    const updated = await queryHelpers.queryOne(`SELECT * FROM interview_notes WHERE id = ?`, [noteId]);
    res.json(buildNoteResponse(updated));
  }),

  deleteNote: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { noteId } = req.params;

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
    const { questionId, evidenceType, title, description, fileName, fileSize, fileType, url } = req.body;

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

    const created = await queryHelpers.queryOne(`SELECT * FROM interview_evidence WHERE id = ?`, [id]);
    res.status(201).json(buildEvidenceResponse(created));
  }),

  deleteEvidence: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { evidenceId } = req.params;

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
      companyName, industry, companySize, location, employeeCount, annualRevenue,
      keyMetrics, stakeholders, openGaps, lastInterviewId
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
      [id, sessionId, user.organizationId, targetType, targetId, JSON.stringify(context || {}), user.id, now]
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

    // Get all answered questions
    const questions = await queryHelpers.queryAll(
      `SELECT * FROM interview_questions WHERE session_id = ? AND status = 'answered' ORDER BY category, sort_order`,
      [sessionId]
    ) as any[];

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
    const allQuestions = await queryHelpers.queryAll(
      `SELECT * FROM interview_questions WHERE session_id = ?`,
      [sessionId]
    ) as any[];

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
};

export default InterviewController;
