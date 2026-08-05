/**
 * The HTTP surface of readiness: the probes and the gate that keeps business
 * routes closed until the database is genuinely ready.
 *
 * Extracted from index.ts so route-level tests exercise THESE handlers rather
 * than a re-implementation. A test that rebuilds the gate by hand proves only
 * that the test agrees with itself.
 */
import type { NextFunction, Request, Response } from 'express';

import type { TpMigrationStatus } from './databaseReadiness.js';

export interface ReadinessState {
  dbReady: boolean;
  dbInitError: string | null;
  migrations: TpMigrationStatus;
}

export type ReadinessStateGetter = () => ReadinessState;

/** GET /api/ready — 200 only when the database is ready. */
export function createReadyHandler(getState: ReadinessStateGetter) {
  return (_req: Request, res: Response) => {
    const { dbReady, dbInitError, migrations } = getState();
    if (dbReady) {
      return res.status(200).json({
        status: 'ready',
        database: 'ready',
        migrations,
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(503).json({
      status: 'not_ready',
      database: 'initializing',
      error: dbInitError,
      migrations,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * GET /api/health/migrations — 200 only when migrations actually ran and
 * succeeded. `disabled_by_operator` is NOT healthy: the schema is unverified,
 * so an operator override must never present as a green probe.
 */
export function createMigrationsHealthHandler(getState: ReadinessStateGetter) {
  return (_req: Request, res: Response) => {
    const { dbReady, migrations } = getState();
    const healthy = migrations.state === 'ok' && dbReady;
    return res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      migrations,
      databaseReady: dbReady,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Gate for everything else. While the database is not ready, API routes get
 * 503 SERVER_STARTING; only health/readiness probes pass. Non-API paths (the
 * SPA shell, static assets) are left alone so the frontend can still load and
 * show a sensible state.
 */
export function createReadinessGate(getState: ReadinessStateGetter) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (getState().dbReady) return next();
    if (!req.path.startsWith('/api')) return next();
    if (req.path.startsWith('/api/health') || req.path === '/api/ready') return next();

    return res.status(503).json({
      error: 'Server starting',
      code: 'SERVER_STARTING',
      database: 'initializing',
      timestamp: new Date().toISOString(),
    });
  };
}
