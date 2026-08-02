/**
 * Interview Routes - v2.0 ClickUp-like Redesign
 *
 * 5 Categories: Strategy, Operations, Digital, People, Finance
 * Task-list style questions with status, confidence, tags
 * Notes, Evidence, Summary (ONLY facts, no recommendations)
 */

import { Router } from 'express';
import multer from 'multer';

import { InterviewController } from '../controllers/InterviewController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { requireAnyPermission, requirePermission } from '../middleware/permission.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';

const router = Router();
const templateSourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
      cb(null, true);
      return;
    }
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

// Middleware
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ==========================================
// KNOWLEDGE SEARCH
// ==========================================

/** GET /interview/knowledge/search - Search across interview knowledge */
router.get('/knowledge/search', InterviewController.searchInterviewKnowledge);

// ==========================================
// SESSION ROUTES
// ==========================================

/** GET /interview/sessions - Get all sessions */
router.get('/sessions', InterviewController.getSessions);

/** GET /interview/sessions/completed - Get completed sessions (for Insights tab) */
router.get('/sessions/completed', InterviewController.getCompletedSessions);

/** GET /interview/sessions/accepted - Get accepted sessions (manager pipeline) */
router.get(
  '/sessions/accepted',
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getAcceptedSessions
);

/** GET /interview/sessions/managed - Get manager workflow sessions */
router.get(
  '/sessions/managed',
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getManagedSessions
);

/** GET /interview/sessions/:id - Get single session */
router.get('/sessions/:id', InterviewController.getSession);

/** POST /interview/sessions - Create new session */
router.post('/sessions', InterviewController.createSession);

/** PATCH /interview/sessions/:id - Update session */
router.patch('/sessions/:id', InterviewController.updateSession);

// ==========================================
// SESSION LIFECYCLE (Archive / Trash)
// ==========================================

/** POST /interview/sessions/bulk - Bulk archive/restore/trash/untrash (must precede /:id) */
router.post('/sessions/bulk', InterviewController.bulkSessionLifecycle);

/** POST /interview/sessions/:id/archive - Archive a session */
router.post('/sessions/:id/archive', InterviewController.archiveSession);

/** POST /interview/sessions/:id/restore - Un-archive a session */
router.post('/sessions/:id/restore', InterviewController.restoreSession);

/** POST /interview/sessions/:id/trash - Move a session to trash */
router.post('/sessions/:id/trash', InterviewController.trashSession);

/** POST /interview/sessions/:id/untrash - Restore a session from trash */
router.post('/sessions/:id/untrash', InterviewController.untrashSession);

/** DELETE /interview/sessions/:id - Permanently delete a trashed session */
router.delete('/sessions/:id', InterviewController.deleteSession);

// ==========================================
// ASSIGNMENTS ROUTES (Workflow)
// ==========================================

/** GET /interview/assignments/my - Get my assigned interviews */
router.get('/assignments/my', InterviewController.getMyAssignments);

/** GET /interview/assignments/managed - Get assignments created by current user (manager view) */
router.get(
  '/assignments/managed',
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getManagedAssignments
);

/** GET /interview/assignments/overdue - Get overdue assignments */
router.get(
  '/assignments/overdue',
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getOverdueAssignments
);

/** GET /interview/assignments/counts - Get assignment counts for current user */
router.get('/assignments/counts', InterviewController.getAssignmentCounts);

/** POST /interview/assignments/:id/start - Start assigned interview (create session) */
router.post('/assignments/:id/start', InterviewController.startAssignment);

/** POST /interview/assignments/:id/submit - Submit assigned interview */
router.post('/assignments/:id/submit', InterviewController.submitAssignment);

/** POST /interview/assignments/:id/remind - Send reminder to assignees */
router.post(
  '/assignments/:id/remind',
  requirePermission('INTERVIEW_REMIND'),
  InterviewController.sendAssignmentReminder
);

/** POST /interview/assignments - Admin create assignment */
router.post(
  '/assignments',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.createAssignment
);

/** GET /interview/assignments - Admin list assignments */
router.get(
  '/assignments',
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.listAssignments
);

/** GET /interview/assignments/:id - Get single assignment with details */
router.get(
  '/assignments/:id',
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getAssignment
);

/** PATCH /interview/assignments/:id - Update assignment (deadline, priority, etc) */
router.patch(
  '/assignments/:id',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.updateAssignment
);

/** DELETE /interview/assignments/:id - Delete assignment (only if not started) */
router.delete(
  '/assignments/:id',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.deleteAssignment
);

/** POST /interview/assignments/:id/send-back - Admin send back incomplete submission */
router.post(
  '/assignments/:id/send-back',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.sendBackAssignment
);

/** GET /interview/assignments/:id/answer-history - #48B previous-version read (send-back snapshots) */
router.get(
  '/assignments/:id/answer-history',
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getAnswerHistory
);

/** POST /interview/assignments/:id/approve - Admin/PM approve submission */
router.post(
  '/assignments/:id/approve',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.approveAssignment
);

/** POST /interview/assignments/:id/escalate - Manual "escalate now" (#9b) */
router.post(
  '/assignments/:id/escalate',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.escalateAssignment
);

/** POST /interview/assignments/:id/archive - Archive an assignment (#8) */
router.post(
  '/assignments/:id/archive',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.archiveAssignment
);

/** POST /interview/assignments/:id/restore - Un-archive an assignment (#8) */
router.post(
  '/assignments/:id/restore',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.restoreAssignment
);

// ==========================================
// TEAM MEMBER ROUTES (for team assignments)
// ==========================================

/** GET /interview/assignments/:id/members - Get team members for assignment */
router.get(
  '/assignments/:id/members',
  requireAnyPermission(['INTERVIEW_ASSIGN_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getAssignmentMembers
);

/** POST /interview/assignments/:id/members - Add team member to assignment */
router.post(
  '/assignments/:id/members',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.addAssignmentMember
);

/** DELETE /interview/assignments/:id/members/:userId - Remove team member from assignment */
router.delete(
  '/assignments/:id/members/:userId',
  requirePermission('INTERVIEW_ASSIGN_MANAGE'),
  InterviewController.removeAssignmentMember
);

// ==========================================
// TEMPLATES ROUTES (Library)
// ==========================================

/** GET /interview/templates - List templates (library) */
router.get(
  '/templates',
  // Assign flow needs to list templates too; allow either template viewing or assignment managing.
  requireAnyPermission(['INTERVIEW_TEMPLATE_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getTemplates
);

/** POST /interview/templates - Create new template */
router.post(
  '/templates',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.createTemplate
);

/** POST /interview/templates/import-source - Extract TXT/PDF text for AI builder */
router.post(
  '/templates/import-source',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  templateSourceUpload.single('file'),
  InterviewController.importTemplateSource
);

/** POST /interview/templates/evaluate-quality - Evaluate template question quality (V6-B04) */
router.post(
  '/templates/evaluate-quality',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.evaluateTemplateQuality
);

/** GET /interview/templates/:id - Get template metadata */
router.get(
  '/templates/:id',
  requireAnyPermission(['INTERVIEW_TEMPLATE_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getTemplate
);

/** GET /interview/templates/:id/questions - Get template questions (read-only) */
router.get(
  '/templates/:id/questions',
  requireAnyPermission(['INTERVIEW_TEMPLATE_VIEW', 'INTERVIEW_ASSIGN_MANAGE']),
  InterviewController.getTemplateQuestions
);

/** POST /interview/templates/:id/use - Create new session from template */
router.post(
  '/templates/:id/use',
  requirePermission('INTERVIEW_TEMPLATE_USE'),
  InterviewController.useTemplate
);

/** POST /interview/templates/:id/clone - Clone template */
router.post(
  '/templates/:id/clone',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.cloneTemplate
);

/** PATCH /interview/templates/:id - Update template (metadata, status) */
router.patch(
  '/templates/:id',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.updateTemplate
);

router.post(
  '/templates/:id/publish',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.publishTemplate
);

/** DELETE /interview/templates/:id - Delete template */
router.delete(
  '/templates/:id',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.deleteTemplate
);

/** POST /interview/templates/:id/archive - Archive template */
router.post(
  '/templates/:id/archive',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.archiveTemplate
);

/** POST /interview/templates/:id/restore - Restore archived template to draft */
router.post(
  '/templates/:id/restore',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.restoreTemplate
);

/** POST /interview/templates/:id/default - Set/unset template as org default */
router.post(
  '/templates/:id/default',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.setTemplateDefault
);

/** POST /interview/templates/:id/questions - Add template question */
router.post(
  '/templates/:id/questions',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.addTemplateQuestion
);

/** PATCH /interview/templates/:id/questions/:questionId - Update template question */
router.patch(
  '/templates/:id/questions/:questionId',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.updateTemplateQuestion
);

/** DELETE /interview/templates/:id/questions/:questionId - Delete template question */
router.delete(
  '/templates/:id/questions/:questionId',
  requirePermission('INTERVIEW_TEMPLATE_MANAGE'),
  InterviewController.deleteTemplateQuestion
);

// ==========================================
// QUESTION ROUTES (Task-list style)
// ==========================================

/** GET /interview/sessions/:sessionId/questions - Get all questions */
router.get('/sessions/:sessionId/questions', InterviewController.getQuestions);

/** POST /interview/sessions/:sessionId/questions - Add custom question */
router.post('/sessions/:sessionId/questions', InterviewController.addQuestion);

/** PATCH /interview/questions/:questionId - Update question (answer, status, confidence) */
router.patch('/questions/:questionId', InterviewController.updateQuestion);

// ==========================================
// AI ASSIST ROUTES (human-in-the-loop)
// ==========================================

/** POST /interview/questions/:questionId/ai-suggest - Suggest answer draft for a question */
router.post('/questions/:questionId/ai-suggest', InterviewController.aiSuggestQuestion);

/** GET /interview/questions/:questionId/ai-suggestions - Durable Teresa provenance */
router.get('/questions/:questionId/ai-suggestions', InterviewController.getAiSuggestionAudit);

/** POST /interview/questions/:questionId/ai-suggestions/:suggestionId/reject - Reject draft */
router.post(
  '/questions/:questionId/ai-suggestions/:suggestionId/reject',
  InterviewController.rejectAiSuggestion
);

/** POST /interview/questions/:questionId/ai-improve - Improve/clean up user's answer */
router.post('/questions/:questionId/ai-improve', InterviewController.aiImproveAnswer);

/** POST /interview/questions/:questionId/ai-explain - Explain question in plain language */
router.post('/questions/:questionId/ai-explain', InterviewController.aiExplainQuestion);

/** POST /interview/sessions/:sessionId/evaluate-answers - AI evaluation of answer quality/sufficiency */
router.post('/sessions/:sessionId/evaluate-answers', InterviewController.evaluateSessionAnswers);

/** POST /interview/sessions/:sessionId/ai-parse - Map chat transcript to answers */
router.post('/sessions/:sessionId/ai-parse', InterviewController.aiParseSessionAnswers);

// ==========================================
// TRANSCRIPT ROUTES (T013 Conversational)
// ==========================================

/** GET /interview/sessions/:sessionId/transcript - Get transcript messages */
router.get('/sessions/:sessionId/transcript', InterviewController.getTranscript);

/** POST /interview/sessions/:sessionId/transcript - Add transcript message */
router.post('/sessions/:sessionId/transcript', InterviewController.addTranscriptMessage);

// ==========================================
// INFERENCE ROUTES (T016 Structured Insights)
// ==========================================

/** POST /interview/inference/run - Start new inference run */
router.post('/inference/run', InterviewController.startInferenceRun);

/** GET /interview/inference/runs - List inference runs */
router.get('/inference/runs', InterviewController.getInferenceRuns);

/** GET /interview/inference/runs/:runId - Get inference run status */
router.get('/inference/runs/:runId', InterviewController.getInferenceRun);

// ==========================================
// NOTES ROUTES
// ==========================================

/** GET /interview/sessions/:sessionId/notes - Get all notes */
router.get('/sessions/:sessionId/notes', InterviewController.getNotes);

/** POST /interview/sessions/:sessionId/notes - Create note */
router.post('/sessions/:sessionId/notes', InterviewController.createNote);

/** PATCH /interview/notes/:noteId - Update note */
router.patch('/notes/:noteId', InterviewController.updateNote);

/** DELETE /interview/notes/:noteId - Delete note */
router.delete('/notes/:noteId', InterviewController.deleteNote);

// ==========================================
// EVIDENCE ROUTES
// ==========================================

/** GET /interview/sessions/:sessionId/evidence - Get all evidence */
router.get('/sessions/:sessionId/evidence', InterviewController.getEvidence);

/** POST /interview/sessions/:sessionId/evidence - Upload evidence */
router.post('/sessions/:sessionId/evidence', InterviewController.createEvidence);

/** DELETE /interview/evidence/:evidenceId - Delete evidence */
router.delete('/evidence/:evidenceId', InterviewController.deleteEvidence);

/** GET /interview/sessions/:sessionId/linked-items - Get persisted object links */
router.get('/sessions/:sessionId/linked-items', InterviewController.getLinkedItems);

/** POST /interview/sessions/:sessionId/linked-items - Add persisted object link */
router.post('/sessions/:sessionId/linked-items', InterviewController.addLinkedItem);

/** DELETE /interview/sessions/:sessionId/linked-items/:edgeId - Delete persisted object link */
router.delete('/sessions/:sessionId/linked-items/:edgeId', InterviewController.deleteLinkedItem);

// ==========================================
// ORGANIZATION CONTEXT ROUTES (Company Facts)
// ==========================================

/** GET /interview/context - Get organization context */
router.get('/context', InterviewController.getOrganizationContext);

/** PUT /interview/context - Update organization context */
router.put('/context', InterviewController.updateOrganizationContext);

// ==========================================
// SUMMARY & EXPORT ROUTES
// ==========================================

/** POST /interview/sessions/:sessionId/summary - Generate summary (FACTS ONLY) */
router.post('/sessions/:sessionId/summary', InterviewController.generateSummary);

/** GET /interview/sessions/:sessionId/summary - Get stored summary */
router.get('/sessions/:sessionId/summary', InterviewController.getSummary);

/** POST /interview/sessions/:sessionId/export - Export context to Tools/Assessment */
router.post('/sessions/:sessionId/export', InterviewController.exportContext);

// ==========================================
// INSIGHTS ROUTES (AI-generated summaries)
// ==========================================

/** GET /interview/insights - List insights */
router.get(
  '/insights',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  InterviewController.listInsights
);

/** GET /interview/insights/:id - Get single insight */
router.get(
  '/insights/:id',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  InterviewController.getInsight
);

/** POST /interview/insights - Create new insight (starts AI generation) */
router.post(
  '/insights',
  requirePermission('INTERVIEW_INSIGHTS_CREATE'),
  InterviewController.createInsight
);

/** POST /interview/insights/:id/regenerate - Regenerate an insight */
router.post(
  '/insights/:id/regenerate',
  requirePermission('INTERVIEW_INSIGHTS_CREATE'),
  InterviewController.regenerateInsight
);

/** PATCH /interview/insights/:id - Update insight (status, etc.) */
router.patch(
  '/insights/:id',
  requirePermission('INTERVIEW_INSIGHTS_REVIEW'),
  InterviewController.updateInsight
);

/** POST /interview/insights/:id/export - Export insight to Tools or Assessment */
router.post(
  '/insights/:id/export',
  requirePermission('INTERVIEW_INSIGHTS_HANDOFF'),
  InterviewController.exportInsight
);

/** GET /interview/insights/:id/activity - Activity log for insight */
router.get(
  '/insights/:id/activity',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  InterviewController.getInsightActivity
);

/** GET/POST/DELETE /interview/insights/:id/comments - Comments for insight */
router.get(
  '/insights/:id/comments',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  InterviewController.getInsightComments
);
router.post(
  '/insights/:id/comments',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  InterviewController.createInsightComment
);
router.delete(
  '/insights/:id/comments/:commentId',
  requirePermission('INTERVIEW_INSIGHTS_VIEW'),
  InterviewController.deleteInsightComment
);

/** DELETE /interview/insights/:id - Delete insight */
router.delete(
  '/insights/:id',
  requirePermission('INTERVIEW_INSIGHTS_PUBLISH'),
  InterviewController.deleteInsight
);

export default router;
