/**
 * Chaos Engineering Routes (Development Only)
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides endpoints to simulate failures for testing resilience
 * ONLY AVAILABLE IN DEVELOPMENT MODE
 * 
 * Endpoints:
 *   POST /api/chaos/simulate-redis-failure - Simulate Redis failure
 *   POST /api/chaos/simulate-db-failure - Simulate database failure
 *   POST /api/chaos/inject-latency - Inject network latency
 *   POST /api/chaos/reset - Reset all chaos simulations
 */

import { Router, type Request, type Response } from 'express';

const router = Router();

// ==========================================
// SECURITY CHECK
// ==========================================

// Only allow in development
if (process.env.NODE_ENV === 'production') {
    router.use((_req: Request, res: Response) => {
        res.status(403).json({ error: 'Chaos endpoints are not available in production' });
    });
}

// ==========================================
// CHAOS STATE
// ==========================================

interface ChaosState {
    redisFailure: boolean;
    dbFailure: boolean;
    latencyMs: number;
}

const chaosState: ChaosState = {
    redisFailure: false,
    dbFailure: false,
    latencyMs: 0,
};

// ==========================================
// MIDDLEWARE - Inject latency if enabled
// ==========================================

router.use((req: Request, res: Response, next) => {
    if (chaosState.latencyMs > 0) {
        setTimeout(() => {
            next();
        }, chaosState.latencyMs);
    } else {
        next();
    }
});

// ==========================================
// ROUTES
// ==========================================

/**
 * POST /api/chaos/simulate-redis-failure
 * Simulate Redis connection failure
 */
router.post('/simulate-redis-failure', async (_req: Request, res: Response) => {
    try {
        chaosState.redisFailure = true;

        // Disconnect Redis if connected
        try {
            const { getRedisClient, isRedisConnected } = await import('../services/ai/redisClient.js');
            if (isRedisConnected()) {
                const client = getRedisClient();
                if (client && typeof client.quit === 'function') {
                    await client.quit();
                }
            }
        } catch (error) {
            // Redis not available or already disconnected
        }

        res.status(200).json({
            message: 'Redis failure simulated',
            state: chaosState,
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return res.status(500).json({
            error: 'Failed to simulate Redis failure',
            details: err.message,
        });
    }
});

/**
 * POST /api/chaos/simulate-db-failure
 * Simulate database connection failure
 */
router.post('/simulate-db-failure', async (_req: Request, res: Response) => {
    try {
        chaosState.dbFailure = true;

        // Note: Actual DB disconnection would require more complex setup
        // This is a flag that can be checked by middleware

        res.status(200).json({
            message: 'Database failure simulated (flag set)',
            state: chaosState,
            note: 'Actual DB disconnection requires application restart',
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return res.status(500).json({
            error: 'Failed to simulate database failure',
            details: err.message,
        });
    }
});

/**
 * POST /api/chaos/inject-latency
 * Inject network latency to all requests
 * Body: { latencyMs: number }
 */
router.post('/inject-latency', (req: Request, res: Response) => {
    try {
        const { latencyMs } = req.body;

        if (typeof latencyMs !== 'number' || latencyMs < 0 || latencyMs > 10000) {
            res.status(400).json({
                error: 'Invalid latencyMs. Must be a number between 0 and 10000',
            });
            return;
        }

        chaosState.latencyMs = latencyMs;

        res.status(200).json({
            message: `Latency injection ${latencyMs > 0 ? 'enabled' : 'disabled'}`,
            latencyMs,
            state: chaosState,
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return res.status(500).json({
            error: 'Failed to inject latency',
            details: err.message,
        });
    }
});

/**
 * POST /api/chaos/reset
 * Reset all chaos simulations
 */
router.post('/reset', async (_req: Request, res: Response) => {
    try {
        chaosState.redisFailure = false;
        chaosState.dbFailure = false;
        chaosState.latencyMs = 0;

        // Reconnect Redis if it was disconnected
        try {
            const { getRedisClient, isRedisConnected } = await import('../services/ai/redisClient.js');
            if (!isRedisConnected()) {
                // Redis client should auto-reconnect, but we can trigger reconnection
                console.log('[Chaos] Redis should auto-reconnect');
            }
        } catch (error) {
            // Redis not available
        }

        res.status(200).json({
            message: 'All chaos simulations reset',
            state: chaosState,
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return res.status(500).json({
            error: 'Failed to reset chaos simulations',
            details: err.message,
        });
    }
});

/**
 * GET /api/chaos/status
 * Get current chaos state
 */
router.get('/status', (_req: Request, res: Response) => {
    res.status(200).json({
        state: chaosState,
        environment: process.env.NODE_ENV,
    });
});

export default router;

