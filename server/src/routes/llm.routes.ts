/**
 * LLM Routes
 * API endpoints for LLM provider management and testing
 */

import { Router } from 'express';
import { LLMController } from '../controllers/ai/LLMController.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/**
 * GET /api/llm/providers
 * List all configured providers
 */
router.get(
    '/providers',
    verifyToken,
    asyncHandler(LLMController.listProviders)
);

/**
 * GET /api/llm/providers/public
 * List public providers
 */
router.get(
    '/providers/public',
    asyncHandler(LLMController.listPublicProviders)
);

/**
 * POST /api/llm/test
 * Test a provider connection
 */
router.post(
    '/test',
    verifyToken,
    asyncHandler(LLMController.testProvider)
);

/**
 * POST /api/llm/test-ollama
 * Test Ollama connection
 */
router.post(
    '/test-ollama',
    verifyToken,
    asyncHandler(LLMController.testOllama)
);

/**
 * GET /api/llm/ollama-models
 * Get available Ollama models
 */
router.get(
    '/ollama-models',
    verifyToken,
    asyncHandler(LLMController.getOllamaModels)
);

export default router;
