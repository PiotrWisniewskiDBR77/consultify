/**
 * performance-metrics Routes
 * Lightweight runtime metrics for deploy-gate observability.
 */
import os from 'node:os';

import { Router } from 'express';

import logger from '../utils/Logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const startedAt = Number(process.env.SERVER_STARTED_AT || Date.now());
    const uptimeMs = Date.now() - startedAt;

    let dbOk: boolean | null = null;
    try {
      await DbPromise.get('SELECT 1 as ok', [], { fallback: false });
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const payload = {
      ok: true,
      timestamp: new Date().toISOString(),
      node: {
        uptimeMs,
        pid: process.pid,
        platform: process.platform,
        arch: process.arch,
        loadavg: os.loadavg?.() || [],
        memory: {
          rss: process.memoryUsage().rss,
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
        },
      },
      db: {
        ok: dbOk,
        type: process.env.DB_TYPE || (process.env.DATABASE_URL ? 'postgres' : 'unknown'),
      },
    };

    return res.status(200).json(payload);
  })
);

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const db = await DbPromise.get('SELECT 1 as ok', [], { fallback: false })
      .then(() => true)
      .catch(() => false);
    return res.status(db ? 200 : 503).json({ ok: db, timestamp: new Date().toISOString() });
  })
);

export default router;
