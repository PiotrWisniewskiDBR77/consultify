/**
 * M02-019 FIX 1 — route-level proof that an operator disabling migrations
 * cannot open the app for traffic.
 *
 * `DISABLE_TP_MIGRATIONS=true` previously returned ready:true, so index.ts set
 * dbReady=true and /api/ready answered 200 on a schema nobody had verified —
 * a bypass around the very gate the readiness work introduced.
 *
 * These tests mount the SAME handler factories index.ts uses
 * (server/src/startup/readinessRoutes.ts) rather than re-implementing the
 * gate, so they assert production behaviour and not their own restatement of
 * it. No database is required: the readiness STATE is the input under test.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { establishDatabaseReadiness } from '../../server/src/startup/databaseReadiness.js';
import {
  createMigrationsHealthHandler,
  createReadinessGate,
  createReadyHandler,
  type ReadinessState,
} from '../../server/src/startup/readinessRoutes.js';

/** Builds an app wired exactly like index.ts, over a mutable state object. */
function buildApp(state: ReadinessState): Express {
  const app = express();
  const getState = () => state;

  // Registered before the gate, mirroring index.ts ordering.
  app.get('/api/health/migrations', createMigrationsHealthHandler(getState));
  app.get('/api/ready', createReadyHandler(getState));
  app.use(createReadinessGate(getState));

  // A representative business route, mounted after the gate like the real app.
  app.get('/api/decisions', (_req, res) => res.status(200).json({ decisions: [] }));
  // A non-API path (SPA shell) must stay reachable.
  app.get('/', (_req, res) => res.status(200).send('spa'));

  return app;
}

describe('M02-019 — readiness routes (production handlers)', () => {
  let state: ReadinessState;
  let app: Express;

  beforeEach(() => {
    state = {
      dbReady: false,
      dbInitError: null,
      migrations: { state: 'pending', detail: null },
      // Readiness now requires BOTH ledgers; default the SQL chain to healthy so these cases
      // continue to exercise the Table Platform dimension they were written for.
      sqlMigrations: {
        state: 'ok',
        failed: 0,
        skipped: 0,
        pending: 0,
        unexplainedDrift: 0,
        approvedVariants: 0,
        attestedLegacyVariants: 0,
        detail: 'chain complete',
      },
      buildSha: 'testsha0000',
    };
    app = buildApp(state);
  });

  // ── FIX 1: operator disable must not open readiness ──────────────────────
  describe('DISABLE_TP_MIGRATIONS=true', () => {
    it('never reports ready, never seeds, and demands exit in production', async () => {
      const seedTemplates = vi.fn(async () => {});
      const runMigrations = vi.fn(async () => {
        throw new Error('must not be called');
      });

      const outcome = await establishDatabaseReadiness({
        initializeSchema: async () => ({ success: true, message: 'ok' }),
        runMigrations: runMigrations as any,
        seedTemplates,
        isProduction: true,
        migrationsDisabled: true,
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      });

      expect(outcome.ready).toBe(false); // <- the bypass being closed
      expect(outcome.migrations.state).toBe('disabled_by_operator');
      expect(outcome.seeded).toBe(false);
      expect(seedTemplates).not.toHaveBeenCalled();
      expect(runMigrations).not.toHaveBeenCalled();
      expect(outcome.shouldExitProcess).toBe(true); // production fails the deploy
      expect(outcome.error).toContain('DISABLE_TP_MIGRATIONS');
    });

    it('dev/test may stay alive, but still not ready', async () => {
      const outcome = await establishDatabaseReadiness({
        initializeSchema: async () => ({ success: true, message: 'ok' }),
        runMigrations: (async () => {
          throw new Error('must not be called');
        }) as any,
        seedTemplates: async () => {},
        isProduction: false,
        migrationsDisabled: true,
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      });

      expect(outcome.ready).toBe(false);
      expect(outcome.shouldExitProcess).toBe(false);
    });

    it('/api/ready is 503 and /api/health/migrations is 503', async () => {
      state.dbReady = false;
      state.dbInitError = 'DISABLE_TP_MIGRATIONS=true — migrations skipped; schema unverified';
      state.migrations = { state: 'disabled_by_operator', detail: 'DISABLE_TP_MIGRATIONS=true' };

      const ready = await request(app).get('/api/ready');
      expect(ready.status).toBe(503);
      expect(ready.body.status).toBe('not_ready');
      expect(ready.body.migrations.state).toBe('disabled_by_operator');
      expect(ready.body.error).toContain('DISABLE_TP_MIGRATIONS');

      const health = await request(app).get('/api/health/migrations');
      expect(health.status).toBe(503);
      expect(health.body.status).toBe('degraded');
      expect(health.body.migrations.state).toBe('disabled_by_operator');
    });

    it('a business route is closed with 503 SERVER_STARTING', async () => {
      state.dbReady = false;
      state.migrations = { state: 'disabled_by_operator', detail: 'DISABLE_TP_MIGRATIONS=true' };

      const res = await request(app).get('/api/decisions');
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SERVER_STARTING');
      expect(res.body.decisions).toBeUndefined();
    });

    it('is never reported healthy even if dbReady were somehow true', async () => {
      // Defence in depth: the health probe keys off migration state too, so a
      // second hidden override could not present an unmigrated app as green.
      state.dbReady = true;
      state.migrations = { state: 'disabled_by_operator', detail: 'DISABLE_TP_MIGRATIONS=true' };

      const health = await request(app).get('/api/health/migrations');
      expect(health.status).toBe(503);
      expect(health.body.status).toBe('degraded');
    });
  });

  // ── failed migration ─────────────────────────────────────────────────────
  describe('failed migration', () => {
    beforeEach(() => {
      state.dbReady = false;
      state.dbInitError = 'Table Platform migration failed on 20260804_x.sql: boom';
      state.migrations = { state: 'failed', detail: 'failed on 20260804_x.sql' };
    });

    it('/api/ready 503 with the precise error', async () => {
      const res = await request(app).get('/api/ready');
      expect(res.status).toBe(503);
      expect(res.body.error).toContain('20260804_x.sql');
    });

    it('/api/health/migrations 503', async () => {
      const res = await request(app).get('/api/health/migrations');
      expect(res.status).toBe(503);
      expect(res.body.migrations.state).toBe('failed');
    });

    it('business route 503', async () => {
      const res = await request(app).get('/api/decisions');
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SERVER_STARTING');
    });
  });

  // ── healthy ──────────────────────────────────────────────────────────────
  describe('migrations ok', () => {
    beforeEach(() => {
      state.dbReady = true;
      state.dbInitError = null;
      state.migrations = { state: 'ok', detail: '1 applied, 397 already up to date' };
    });

    it('/api/ready 200', async () => {
      const res = await request(app).get('/api/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.migrations.state).toBe('ok');
    });

    it('/api/health/migrations 200', async () => {
      const res = await request(app).get('/api/health/migrations');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('business route is open', async () => {
      const res = await request(app).get('/api/decisions');
      expect(res.status).toBe(200);
      expect(res.body.decisions).toEqual([]);
    });
  });

  // ── probes and SPA stay reachable while not ready ────────────────────────
  it('health/readiness probes and the SPA shell stay reachable when not ready', async () => {
    state.dbReady = false;
    expect((await request(app).get('/api/ready')).status).toBe(503); // reachable, honest
    expect((await request(app).get('/api/health/migrations')).status).toBe(503);
    expect((await request(app).get('/')).status).toBe(200); // SPA shell still served
  });
});
