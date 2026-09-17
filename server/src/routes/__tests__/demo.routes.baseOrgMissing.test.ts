/**
 * B4 / DEC-576 pkt 4 — `DEMO_ORG_ID` pointing at a deleted organization must
 * answer `409 DEMO_BASE_ORG_MISSING`, not the blanket `503` every demo poll used
 * to fall through to.
 *
 * ROOT CAUSE (KANAL Wpis 13, measured by the CTO on staging): `DEMO_ORG_ID=
 * ateliertoys-demo` referenced an org removed in the 09.09 cleanup. Each
 * demo-mode `GET /api/demo/status` then ran `resolveOrCreateDemoSession`, whose
 * `demo_sessions` INSERT carries a FK to the base org; the FK failed, the handler
 * caught it and returned 503 on EVERY poll. A missing base org is a configuration
 * conflict an operator can act on, so the demo routes now preflight its existence
 * and answer 409 with an actionable code plus one log line naming the org.
 *
 * SCOPE OF THE ASSERTIONS
 *  - base org missing + demo enabled  → 409 DEMO_BASE_ORG_MISSING (status & toggle)
 *  - base org present + demo enabled  → the existing 200 path, unchanged
 *  - demo NOT enabled                 → 200, preflight never runs (no behaviour change)
 *  - the session is never created when the preflight short-circuits
 *
 * The REAL demo router and the REAL `demoGuard.middleware` preflight run here;
 * only auth, rate limiting, the logger, the session service, telemetry and the
 * DbPromise seam are mocked (the established pattern in routes/__tests__).
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable control surface, hoisted above the vi.mock factories (which run during
// import, before top-level `let` initialisers would exist).
const state = vi.hoisted(() => ({
  baseOrgExists: true,
  demoEnabled: true,
}));

const loggerMock = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('../../utils/Logger.js', () => ({ default: loggerMock }));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'u-demo' };
    next();
  },
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/demo/demoSessionService.js', () => ({
  cleanupExpiredDemoSessions: vi.fn(async () => undefined),
  resolveOrCreateDemoSession: vi.fn(async () => ({
    id: 'sess-1',
    session_org_id: 'demo-org',
    locale: 'en',
    expires_at: '2026-09-17T12:00:00.000Z',
    anchor_date: '2026-06-01T00:00:00.000Z',
    source: 'status_refresh',
  })),
  getActiveDemoSession: vi.fn(async () => null),
  endDemoSession: vi.fn(async () => undefined),
}));

vi.mock('../../services/demoTrialTelemetryService.js', () => ({
  recordDemoTrialEvent: vi.fn(async () => undefined),
  DEMO_TRIAL_EVENT_TYPES: {
    DEMO_MODE_ENABLED: 'demo_mode_enabled',
    DEMO_STARTED: 'demo_started',
  },
}));

// The DbPromise seam backs the REAL demoGuard.middleware helpers: the preflight
// (`SELECT id FROM organizations WHERE id = ?`), `getDemoOrganization`
// (`SELECT id, name FROM organizations ...`), `checkUserDemoPreference`
// (user_preferences) and `getDemoStats` (COUNT(*)). Routing on the SQL text keeps
// the real helper logic under test while the data is controlled.
vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(async (sql: string) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (s.includes('FROM organizations WHERE id =')) {
      return state.baseOrgExists ? { id: 'demo-org', name: 'Demo Organization' } : undefined;
    }
    if (s.includes('FROM user_preferences')) {
      return { value: JSON.stringify(state.demoEnabled) };
    }
    if (s.includes('COUNT(*)')) {
      return { c: 0 };
    }
    return undefined;
  }),
  run: vi.fn(async () => ({ success: true })),
  all: vi.fn(async () => []),
}));

import { resolveOrCreateDemoSession } from '../../services/demo/demoSessionService.js';
import demoRouter from '../demo.routes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/demo', demoRouter);
  return app;
}

function warnedMessages(): string {
  return loggerMock.warn.mock.calls.map((c) => String(c[0])).join('\n');
}

beforeEach(() => {
  vi.clearAllMocks();
  state.baseOrgExists = true;
  state.demoEnabled = true;
});

describe('B4/DEC-576 pkt 4 — demo routes answer 409 when the base org is missing', () => {
  it('GET /status: missing base org → 409 DEMO_BASE_ORG_MISSING, no session created, one log line names the org', async () => {
    state.baseOrgExists = false;
    state.demoEnabled = true;

    const response = await request(buildApp()).get('/api/demo/status');

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('DEMO_BASE_ORG_MISSING');
    expect(response.body.success).toBe(false);
    // The preflight short-circuits BEFORE the FK-bearing session insert.
    expect(vi.mocked(resolveOrCreateDemoSession)).not.toHaveBeenCalled();
    // Exactly the actionable log line, naming the missing org id.
    expect(warnedMessages()).toContain('demo-org');
    expect(warnedMessages()).toContain('DEMO_BASE_ORG_MISSING');
  });

  it('GET /status: base org present → the existing 200 demo path is unchanged', async () => {
    state.baseOrgExists = true;
    state.demoEnabled = true;

    const response = await request(buildApp()).get('/api/demo/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isDemoMode).toBe(true);
    expect(response.body.demoOrganization?.id).toBe('demo-org');
    expect(vi.mocked(resolveOrCreateDemoSession)).toHaveBeenCalledTimes(1);
    expect(response.body.code).toBeUndefined();
  });

  it('GET /status: demo not enabled → 200 and the preflight never runs (no behaviour change)', async () => {
    state.baseOrgExists = false; // would 409 IF the preflight ran
    state.demoEnabled = false;

    const response = await request(buildApp()).get('/api/demo/status');

    expect(response.status).toBe(200);
    expect(response.body.isDemoMode).toBe(false);
    expect(response.body.code).toBeUndefined();
    expect(vi.mocked(resolveOrCreateDemoSession)).not.toHaveBeenCalled();
    expect(warnedMessages()).not.toContain('DEMO_BASE_ORG_MISSING');
  });

  it('POST /toggle: enabling demo against a missing base org → 409 DEMO_BASE_ORG_MISSING', async () => {
    state.baseOrgExists = false;

    const response = await request(buildApp())
      .post('/api/demo/toggle')
      .send({ enabled: true, source: 'demo_toggle' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('DEMO_BASE_ORG_MISSING');
    expect(response.body.success).toBe(false);
    expect(vi.mocked(resolveOrCreateDemoSession)).not.toHaveBeenCalled();
    expect(warnedMessages()).toContain('demo-org');
  });
});
