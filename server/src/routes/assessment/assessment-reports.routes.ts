/**
 * assessment-reports Routes
 * Reuse main assessment-reports router for /api/assessment/reports
 */
import { Router } from 'express';

import assessmentReportsRouter from '../assessment-reports.routes.js';

const router = Router();
router.use(assessmentReportsRouter);

export default router;
