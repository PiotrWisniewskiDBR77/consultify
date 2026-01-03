/**
 * AI Infrastructure Routes
 * 
 * Module 1: AI Infrastructure & Configuration
 * Routes for LLM providers, model tiers, global settings, and health monitoring
 * 
 * This module proxies to existing endpoints for backward compatibility
 * while providing new organized endpoints.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
const { requireRole } = require('../middleware/rbac');

// Import existing route handlers
const llmRoutes = require('./llm');
const aiSettingsRoutes = require('./ai-settings');

// ==========================================
// PROVIDERS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-infrastructure/providers
 * List all LLM providers
 */
router.get('/providers', verifyToken, async (req, res, next) => {
    req.url = '/providers';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * POST /api/ai-infrastructure/providers
 * Create new LLM provider
 */
router.post('/providers', verifyToken, async (req, res, next) => {
    req.url = '/providers';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * PUT /api/ai-infrastructure/providers/:id
 * Update LLM provider
 */
router.put('/providers/:id', verifyToken, async (req, res, next) => {
    req.url = `/providers/${req.params.id}`;
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * DELETE /api/ai-infrastructure/providers/:id
 * Delete LLM provider
 */
router.delete('/providers/:id', verifyToken, async (req, res, next) => {
    req.url = `/providers/${req.params.id}`;
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * POST /api/ai-infrastructure/providers/test
 * Test LLM connection
 */
router.post('/providers/test', verifyToken, async (req, res, next) => {
    req.url = '/test';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

// ==========================================
// TIERS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-infrastructure/tiers/assignments
 * Get all model-to-tier assignments
 */
router.get('/tiers/assignments', verifyToken, async (req, res, next) => {
    req.url = '/tiers/assignments';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * POST /api/ai-infrastructure/tiers/assign
 * Assign model to tier
 */
router.post('/tiers/assign', verifyToken, async (req, res, next) => {
    req.url = '/tiers/assign';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * DELETE /api/ai-infrastructure/tiers/assign
 * Remove model from tier
 */
router.delete('/tiers/assign', verifyToken, async (req, res, next) => {
    req.url = '/tiers/assign';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * PUT /api/ai-infrastructure/tiers/priority
 * Update tier priority
 */
router.put('/tiers/priority', verifyToken, async (req, res, next) => {
    req.url = '/tiers/priority';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

// ==========================================
// SETTINGS ENDPOINTS
// ==========================================

/**
 * GET /api/ai-infrastructure/settings
 * Get global AI settings
 */
router.get('/settings', verifyToken, requireRole('superadmin'), async (req, res, next) => {
    req.url = '/superadmin';
    return aiSettingsRoutes.handle(req, res, next) || aiSettingsRoutes(req, res, next);
});

/**
 * PUT /api/ai-infrastructure/settings
 * Update global AI settings
 */
router.put('/settings', verifyToken, requireRole('superadmin'), async (req, res, next) => {
    req.url = '/superadmin';
    return aiSettingsRoutes.handle(req, res, next) || aiSettingsRoutes(req, res, next);
});

// ==========================================
// HEALTH ENDPOINTS
// ==========================================

/**
 * GET /api/ai-infrastructure/health/detailed
 * Get detailed health status
 */
router.get('/health/detailed', verifyToken, async (req, res, next) => {
    req.url = '/health/detailed';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * GET /api/ai-infrastructure/health/status
 * Get system health status
 */
router.get('/health/status', verifyToken, async (req, res, next) => {
    req.url = '/health/status';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * POST /api/ai-infrastructure/health/test-provider
 * Test specific provider
 */
router.post('/health/test-provider', verifyToken, async (req, res, next) => {
    req.url = '/health/test-provider';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

/**
 * GET /api/ai-infrastructure/health/alerts
 * Get health alerts
 */
router.get('/health/alerts', verifyToken, async (req, res, next) => {
    req.url = '/health/alerts';
    return llmRoutes.handle(req, res, next) || llmRoutes(req, res, next);
});

export default router;






