/**
 * Interview Routes - v2.0 ClickUp-like Redesign
 * 
 * 5 Categories: Strategy, Operations, Digital, People, Finance
 * Task-list style questions with status, confidence, tags
 * Notes, Evidence, Summary (ONLY facts, no recommendations)
 */

import { Router } from 'express';

import { InterviewController } from '../controllers/InterviewController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';

const router = Router();

// Middleware
router.use(authRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

// ==========================================
// SESSION ROUTES
// ==========================================

/** GET /interview/sessions - Get all sessions */
router.get('/sessions', InterviewController.getSessions);

/** GET /interview/sessions/:id - Get single session */
router.get('/sessions/:id', InterviewController.getSession);

/** POST /interview/sessions - Create new session */
router.post('/sessions', InterviewController.createSession);

/** PATCH /interview/sessions/:id - Update session */
router.patch('/sessions/:id', InterviewController.updateSession);

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

/** POST /interview/sessions/:sessionId/export - Export context to Tools/Assessment */
router.post('/sessions/:sessionId/export', InterviewController.exportContext);

export default router;
