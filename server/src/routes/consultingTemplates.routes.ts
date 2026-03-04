import { Router } from 'express';

import ConsultingTemplatesController from '../controllers/ConsultingTemplatesController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);

router.get('/', ConsultingTemplatesController.listTemplates);
router.get('/:slug', ConsultingTemplatesController.getTemplate);

export default router;
