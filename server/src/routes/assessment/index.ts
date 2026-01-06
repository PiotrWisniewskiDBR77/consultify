/**
 * Assessment Routes Index
 * Aggregates all assessment-related routes
 */

import { Router } from 'express';

import assessmentHubRoutes from './assessment-hub.routes.js';
import assessmentLevelAttachmentsRoutes from './assessment-level-attachments.routes.js';
import assessmentReportsRoutes from './assessment-reports.routes.js';
import assessmentWorkflowRoutes from './assessment-workflow.routes.js';
import assessmentRoutes from './assessment.routes.js';
import assessmentsRoutes from './assessments.routes.js';

const router = Router();

// Mount all assessment sub-routes
router.use('/hub', assessmentHubRoutes);
router.use('/attachments', assessmentLevelAttachmentsRoutes);
router.use('/reports', assessmentReportsRoutes);
router.use('/workflow', assessmentWorkflowRoutes);
router.use('/main', assessmentRoutes);
router.use('/', assessmentsRoutes);

export default router;


