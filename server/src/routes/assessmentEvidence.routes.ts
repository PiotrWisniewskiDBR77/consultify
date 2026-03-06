import { Router } from 'express';

import AssessmentEvidenceController from '../controllers/AssessmentEvidenceController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);

router.get('/:assessmentId', AssessmentEvidenceController.getEvidence);
router.post('/:assessmentId', requireAudit, AssessmentEvidenceController.upsertEvidence);
router.get('/:assessmentId/report', AssessmentEvidenceController.getEvidenceReport);

export default router;
