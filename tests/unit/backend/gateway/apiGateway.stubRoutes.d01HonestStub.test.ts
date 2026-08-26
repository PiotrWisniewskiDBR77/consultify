/* @vitest-environment node */
/**
 * D-01 (Fable sprint 2026-07-19) — "501-honest zamiast fantomu".
 *
 * Context: server/src/Gateway.ts gates ~37 legacy routers behind mountStub().
 * When ENABLE_STUB_ROUTES is not 'true' and NODE_ENV=production (this is the
 * current state on demo — see D-01 worker report), the disabled branch used
 * to do nothing but log — the path was never mounted, so a request fell
 * through to Express's generic, unstructured 404 (or client code silently
 * rendered an empty state).
 *
 * A grep of src/ FE callers (fetch/axios/Api.* call sites), cross-checked
 * against router mount order to rule out shadowing by an earlier non-stub
 * router at an overlapping prefix, confirmed a live demo button/screen
 * reaches each of the paths below. For exactly these paths, mountStub() now
 * mounts an honest 501 (Polish message) instead of leaving the path silently
 * unmounted. This test proves that end-to-end for every confirmed path, and
 * proves a control path with NO live caller is untouched (still unmounted).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// path -> mountStub() `name` argument, and the FE file(s) that were grepped
// as the live-UI evidence (see D-01 worker report for the full trace).
const LIVE_UI_STUB_PATHS: Array<{ path: string; name: string; evidence: string }> = [
  { path: '/api/audit-logs', name: 'auditLogRoutes', evidence: 'src/services/api.ts (audit-logs), organizationContextWorker.api.ts' },
  { path: '/api/integrations', name: 'integrationsRoutes', evidence: 'IntegrationHealthDashboard.tsx, NotificationChannelsSettings.tsx, IntegrationSettings.tsx' },
  { path: '/api/governance', name: 'governanceAdminRoutes', evidence: 'PermissionManager.tsx (users/:id/permissions)' },
  { path: '/api/context', name: 'contextRoutes', evidence: 'ContextReadinessGate.tsx' },
  { path: '/api/rapidlean', name: 'rapidleanRoutes', evidence: 'RapidLeanWorkspace.tsx' },
  { path: '/api/locations', name: 'locationsRoutes', evidence: 'LocationFilter.tsx' },
  { path: '/api/status', name: 'statusRoutes', evidence: 'StatusPageView.tsx' },
  { path: '/api/workqueue', name: 'workqueueRoutes', evidence: 'MyApprovalsView.tsx' },
  { path: '/api/mf-assessments', name: 'multiFrameworkAssessmentRoutes', evidence: 'MultiFrameworkStageGateModal.tsx, useMultiFrameworkStore.ts' },
  { path: '/api/notification-settings', name: 'notificationSettingsRoutes', evidence: 'NotificationSettings.tsx' },
  { path: '/api/help-analytics', name: 'helpAnalyticsRoutes', evidence: 'HelpAnalyticsDashboard.tsx' },
];

// Paths confirmed to have NO live demo caller — these must stay silently
// unmounted, exactly as before. Regression guard against over-broad fixes.
// (Note: '/api/users' is deliberately excluded from this control list — a
// *different*, non-stub router (`userRoutes`) is legitimately mounted at
// that same path for GET /, GET/PUT /:id, so `app.use` IS called with
// '/api/users' regardless of this fix; the stub `userOrgsRoutes` behind it
// is what's confirmed to have no live caller, which isn't observable via
// mounted-paths alone.)
const NO_LIVE_UI_CONTROL_PATHS = [
  '/api/daily-brief', // no FE caller found at all
  '/api/pinned-prompts', // no FE caller found at all
  '/api/task-advisor', // no FE caller found at all
  // 2026-08-28 (owner decision, Consultant Mode UI removal, part a2): the
  // consultants.routes.ts router, its Gateway.ts mount (mountStub +
  // STUB_NAMES_WITH_LIVE_UI_ON_DEMO entry), and its only live-UI evidence —
  // ConsultantPanelView.tsx / ConsultantInviteView.tsx — were all deleted
  // (the front never called GET/POST /api/consultants; it called
  // /consultants/orgs|clients|invites, which this router never served —
  // always a plain 404). '/api/consultants' is no longer mounted at all,
  // by any router, so it now belongs in the "fully unmounted" control list.
  '/api/consultants',
];

function makeMockApp() {
  const app: any = { use: vi.fn(), get: vi.fn() };
  return app;
}

function findMountedHandler(app: any, mountPath: string): any {
  // Some paths (e.g. '/api/governance') are mounted twice: once by an
  // earlier, unrelated real router, and once by mountStub()'s honest-501
  // handler. Take the LAST matching app.use() call — the honest-501 handler
  // is always registered where the original stub router used to be, i.e.
  // after any earlier real router sharing the same prefix.
  const calls = app.use.mock.calls.filter((c: any[]) => c[0] === mountPath);
  const call = calls[calls.length - 1];
  return call ? call[call.length - 1] : undefined;
}

async function bootProductionGateway() {
  vi.resetModules();
  process.env.NODE_ENV = 'production';
  delete process.env.ENABLE_STUB_ROUTES;
  process.env.MOCK_BILLING = 'true';
  process.env.ENCRYPTION_SALT = 'test-encryption-salt';

  const { ApiGateway } = await import('../../../../server/src/Gateway.ts');
  const app = makeMockApp();
  ApiGateway.getInstance().initializeRoutes(app);
  return app;
}

describe('ApiGateway D-01: honest 501 for mountStub paths with a live demo UI caller', () => {
  const origEnv = process.env.NODE_ENV;
  const origEnable = process.env.ENABLE_STUB_ROUTES;
  const origMockBilling = process.env.MOCK_BILLING;
  const origEncryptionSalt = process.env.ENCRYPTION_SALT;

  const restoreEnv = () => {
    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
    if (origEnable === undefined) delete process.env.ENABLE_STUB_ROUTES;
    else process.env.ENABLE_STUB_ROUTES = origEnable;
    if (origMockBilling === undefined) delete process.env.MOCK_BILLING;
    else process.env.MOCK_BILLING = origMockBilling;
    if (origEncryptionSalt === undefined) delete process.env.ENCRYPTION_SALT;
    else process.env.ENCRYPTION_SALT = origEncryptionSalt;
  };

  it.each(LIVE_UI_STUB_PATHS)(
    '$path ($name) is mounted with an honest 501 JSON body, not silently 404',
    async ({ path }) => {
      const app = await bootProductionGateway();

      const handler = findMountedHandler(app, path);
      expect(handler, `expected ${path} to be mounted even though stub routes are disabled`).toBeDefined();

      const res: any = {
        statusCode: undefined,
        body: undefined,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: unknown) {
          this.body = payload;
          return this;
        },
      };
      handler({}, res, () => {});

      expect(res.statusCode).toBe(501);
      expect(res.body).toMatchObject({ error: 'not_implemented' });
      expect(String((res.body as any)?.message || '')).toMatch(/niedostępna/i);

      restoreEnv();
    }
  );

  it.each(NO_LIVE_UI_CONTROL_PATHS)(
    'control: %s stays fully unmounted (no live demo caller — untouched by D-01)',
    async (path) => {
      const app = await bootProductionGateway();

      const mountedPaths = app.use.mock.calls
        .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : null))
        .filter(Boolean);

      expect(mountedPaths).not.toContain(path);

      restoreEnv();
    }
  );
});
