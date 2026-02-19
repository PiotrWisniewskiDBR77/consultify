/**
 * RBAC Routes (no-op)
 *
 * This router is mounted as a final `/api` catch-all in `Gateway.ts`.
 * If RBAC is not enabled, it must NOT override normal 404 behavior for unknown endpoints.
 */
import { Router } from 'express';

// import { aiRateLimiter } from '../../middleware/rateLimiting.middleware.js'; // Optional

const router = Router();

export default router;
