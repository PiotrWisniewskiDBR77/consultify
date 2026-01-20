/**
 * Assessment Routes Index
 * Aggregates all assessment-related routes
 */

import { Router } from 'express';

import assessmentAIRoutes from './assessment-ai.routes.js';
import assessmentRoutes from './assessment.routes.js';
import assessmentHubRoutes from './assessment-hub.routes.js';
import assessmentLevelAttachmentsRoutes from './assessment-level-attachments.routes.js';
import assessmentReportsRoutes from './assessment-reports.routes.js';
import assessmentWorkflowRoutes from './assessment-workflow.routes.js';
import assessmentsRoutes from './assessments.routes.js';

const router = Router();

// Mount all assessment sub-routes
// AI routes mounted at root to match frontend hook expectations: /api/assessment/:projectId/ai/*
router.use('/', assessmentAIRoutes);
router.use('/hub', assessmentHubRoutes);
router.use('/attachments', assessmentLevelAttachmentsRoutes);
router.use('/reports', assessmentReportsRoutes);
router.use('/workflow', assessmentWorkflowRoutes);
router.use('/main', assessmentRoutes);
router.use('/', assessmentsRoutes);

export default router;
