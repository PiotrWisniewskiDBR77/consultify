/**
 * Assessment Workflow Routes v2
 * Assessment -> Initiatives workflow endpoints
 * 
 * Endpoints:
 * - POST /api/assessment-workflow - Create assessment
 * - GET /api/assessment-workflow - List assessments
 * - GET /api/assessment-workflow/sessions - Get open sessions for submenu
 * - GET /api/assessment-workflow/:assessmentId - Get assessment
 * - PUT /api/assessment-workflow/:assessmentId - Update assessment
 * - DELETE /api/assessment-workflow/:assessmentId - Delete assessment
 * - POST /api/assessment-workflow/:assessmentId/session/open - Open session
 * - POST /api/assessment-workflow/:assessmentId/session/close - Close session
 * - POST /api/assessment-workflow/:assessmentId/request-review - Request review (DRAFT -> IN_REVIEW)
 * - POST /api/assessment-workflow/:assessmentId/report - Generate report
 * - POST /api/assessment-workflow/:assessmentId/report/approve - Approve report (required before assessment approval)
 * - POST /api/assessment-workflow/:assessmentId/approve - Approve assessment (IN_REVIEW/AWAITING_APPROVAL -> APPROVED)
 * - POST /api/assessment-workflow/:assessmentId/send-back - Send back to draft
 * - POST /api/assessment-workflow/:assessmentId/generate-initiatives - Generate initiatives (only after APPROVED)
 * - GET /api/assessment-workflow/:assessmentId/generated-initiatives - Get generated initiatives
 */

import { Router } from 'express';

import AssessmentControllerRaw from '../controllers/AssessmentController.js';
const AssessmentController = AssessmentControllerRaw as any;
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
  CreateAssessmentSchema,
  UpdateAssessmentSchema,
  RequestReviewSchema,
  ApproveReportSchema,
  ApproveAssessmentSchema,
  SendBackSchema,
  GenerateInitiativesSchema,
  GenerateReportSchema,
} from '../validators/assessment.validators.js';

const router = Router();

// Apply middleware
router.use(authRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

// List assessments
router.get('/', AssessmentController.listAssessments);

// Get open sessions (for dynamic submenu)
router.get('/sessions', AssessmentController.getOpenSessions);

// Create assessment
router.post('/', validateBody(CreateAssessmentSchema), AssessmentController.createAssessment);

// Get assessment by ID
router.get('/:assessmentId', AssessmentController.getAssessment);

// Update assessment
router.put('/:assessmentId', validateBody(UpdateAssessmentSchema), AssessmentController.updateAssessment);

// Delete assessment
router.delete('/:assessmentId', AssessmentController.deleteAssessment);

// Session management (for dynamic submenu)
router.post('/:assessmentId/session/open', AssessmentController.openSession);
router.post('/:assessmentId/session/close', AssessmentController.closeSession);

// Workflow transitions
router.post('/:assessmentId/request-review', validateBody(RequestReviewSchema), AssessmentController.requestReview);
router.post('/:assessmentId/report', validateBody(GenerateReportSchema), AssessmentController.generateReport);
router.post('/:assessmentId/report/approve', validateBody(ApproveReportSchema), AssessmentController.approveReport);
router.post('/:assessmentId/approve', validateBody(ApproveAssessmentSchema), AssessmentController.approveAssessment);
router.post('/:assessmentId/send-back', validateBody(SendBackSchema), AssessmentController.sendBackToDraft);

// Initiative generation
router.post(
  '/:assessmentId/generate-initiatives',
  validateBody(GenerateInitiativesSchema),
  AssessmentController.generateInitiatives
);
router.get('/:assessmentId/generated-initiatives', AssessmentController.getGeneratedInitiatives);

export default router;
