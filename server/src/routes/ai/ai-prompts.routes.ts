import { Router } from 'express';

import canonicalAIPromptsRoutes from '../ai-prompts.routes.js';
import logger from '../../utils/Logger.js';

const router = Router();

router.use((req, res, next) => {
  try {
    res.setHeader('X-Deprecated-Endpoint', '/api/ai/ai-prompts');
    res.setHeader('X-Deprecated-Replacement', '/api/ai-prompts');
  } catch {
    // ignore
  }
  logger.warn(`[DEPRECATED] ${req.method} ${req.originalUrl} → use /api/ai-prompts`);
  next();
});

router.get('/capabilities', (_req, res) => {
  return res.json({
    success: true,
    capabilities: ['chat', 'strategic', 'pmo', 'advisor', 'report'],
  });
});

router.use('/', canonicalAIPromptsRoutes);

export default router;
