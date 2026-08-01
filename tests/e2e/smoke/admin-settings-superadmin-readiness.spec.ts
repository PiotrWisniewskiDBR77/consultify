/**
 * Admin + SuperAdmin readiness smoke.
 *
 * This spec walks /settings/*, /admin/* and /superadmin/* — routes that are guarded by real
 * privilege. Its sessions therefore come ONLY from test-support bootstrap
 * (tests/e2e/_helpers/privilegedSession.ts). The public `register-demo` signup used to be a
 * fallback here; it is unprivileged by design (TEAM_MEMBER in the read-only demo org), and the
 * old code papered over that by overwriting `role` in localStorage — so the guards passed on
 * the client and the routes redirected/403'd underneath. Requires ENABLE_TEST_SUPPORT=true and
 * a matching TEST_SUPPORT_KEY on the target backend.
 */
import { expect, Page, request, test } from '@playwright/test';

import { getPrivilegedSession, privilegedAuthUser } from '../_helpers/privilegedSession';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

const SETTINGS_FLOW_ROUTES: Array<{ path: string; expected: RegExp }> = [
  { path: '/settings/profile', expected: /\/settings\/profile$/ },
  { path: '/settings/billing', expected: /\/admin\/billing$/ },
  { path: '/settings/ai', expected: /\/settings\/ai-behavior$/ },
  { path: '/settings/notifications', expected: /\/settings\/notifications-overview$/ },
  { path: '/settings/security', expected: /\/settings\/security-dashboard$/ },
  { path: '/settings/auth-access', expected: /\/settings\/auth-access$/ },
  { path: '/settings/connected-apps', expected: /\/settings\/connected-apps$/ },
  { path: '/settings/api-keys', expected: /\/settings\/api-keys$/ },
  { path: '/settings/privacy', expected: /\/settings\/privacy$/ },
  { path: '/settings/theme', expected: /\/settings\/theme$/ },
  { path: '/settings/accessibility', expected: /\/settings\/accessibility$/ },
  { path: '/settings/import-export', expected: /\/settings\/import-export$/ },
  { path: '/settings/settings-history', expected: /\/settings\/settings-history$/ },
  { path: '/settings/tenant-defaults', expected: /\/settings\/tenant-defaults$/ },
  { path: '/settings/module-preferences', expected: /\/settings\/module-preferences$/ },
];

const ADMIN_FLOW_ROUTES: Array<{ path: string; expected: RegExp }> = [
  { path: '/admin/overview', expected: /\/admin\/overview$/ },
  { path: '/admin/people', expected: /\/admin\/people$/ },
  { path: '/admin/security', expected: /\/admin\/security$/ },
  { path: '/admin/billing', expected: /\/admin\/billing$/ },
  { path: '/admin/ai', expected: /\/admin\/ai$/ },
  { path: '/admin/integrations', expected: /\/admin\/integrations$/ },
  { path: '/admin/audit', expected: /\/admin\/audit$/ },
  { path: '/admin/operations', expected: /\/admin\/operations$/ },
];

const SUPERADMIN_FLOW_ROUTES: Array<{ path: string; expected: RegExp }> = [
  { path: '/superadmin/overview', expected: /\/superadmin\/overview$/ },
  { path: '/superadmin/customers', expected: /\/superadmin\/customers$/ },
  { path: '/superadmin/ai-platform', expected: /\/superadmin\/ai-platform$/ },
  { path: '/superadmin/system', expected: /\/superadmin\/system$/ },
  { path: '/superadmin/content', expected: /\/superadmin\/content$/ },
  { path: '/superadmin/security', expected: /\/superadmin\/security$/ },
  { path: '/superadmin/revenue', expected: /\/superadmin\/revenue$/ },
  { path: '/superadmin/analytics', expected: /\/superadmin\/analytics$/ },
];

async function dismissTourModal(page: Page) {
  const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  for (let i = 0; i < 12; i++) {
    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);

    if (hasSkip) await skipTour.click({ timeout: 1500, force: true }).catch(() => {});
    if (hasWelcome) await consultantCard.click({ timeout: 1500, force: true }).catch(() => {});

    await page.keyboard.press('Escape').catch(() => {});

    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;
    await page.waitForTimeout(200);
  }
}

/**
 * Mint the privileged persona this spec needs. Bootstrap-only, no fallback: the routes under
 * test are privilege-gated, so a degraded session must fail loudly rather than be masked by a
 * fabricated `role` in localStorage.
 */
async function bootstrapSession(role: 'ADMIN' | 'SUPERADMIN') {
  const req = await request.newContext({
    baseURL: API_BASE_URL,
  });

  const runId = `smoke-${role.toLowerCase()}-${Date.now().toString(36)}`;

  try {
    const session = await getPrivilegedSession(req, {
      role,
      label: `smoke-${role.toLowerCase()}`,
      runId,
      apiBaseUrl: API_BASE_URL,
    });

    return {
      req,
      token: session.token,
      // Role/isSuperAdmin come from the SERVER-signed token via privilegedAuthUser — never
      // overridden with the requested role.
      user: privilegedAuthUser(session, {
        name: role === 'SUPERADMIN' ? 'E2E SuperAdmin' : 'E2E Admin',
      }),
    };
  } catch (error) {
    await req.dispose();
    throw error;
  }
}

async function authenticateAdminDemo(page: Page) {
  const auth = await bootstrapSession('ADMIN');

  const demoSession = JSON.stringify({
    sessionId: 'smoke-admin',
    startTime: new Date().toISOString(),
    hasCompletedTour: true,
    hasSeenWelcome: true,
    hasInteractedWithAI: false,
    aiInteractionsUsed: 0,
    featuresExplored: [],
    upgradePromptsShown: 0,
    exitIntentTriggered: false,
    milestones: [],
  });

  await page.addInitScript(
    ({ token, user, demoSessionValue }) => {
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('user', JSON.stringify(user));
      window.localStorage.setItem('consultinity_demo_session', demoSessionValue);
    },
    { token: auth.token, user: auth.user, demoSessionValue: demoSession }
  );

  await auth.req.dispose();
}

async function authenticateSyntheticSuperAdmin(page: Page) {
  const auth = await bootstrapSession('SUPERADMIN');
  const user = auth.user;

  const fulfillJson = async (route: any, json: unknown) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(json),
    });
  };

  await page.route('**/api/auth/me', async (route) => {
    await fulfillJson(route, { user });
  });

  await page.route('**/api/superadmin/dashboard**', async (route) => {
    await fulfillJson(route, {
      counts: { total_users: 0, total_orgs: 0, active_users_7d: 0 },
      activity: { total: 0, last_hour: 0, last_24h: 0, last_7d: 0 },
      ai: { total_ai_calls: 0, total_tokens: 0, active_users: 0 },
      activities: [],
      live: { total_active_connections: 0 },
    });
  });

  await page.route('**/api/superadmin/access-requests**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/superadmin/organizations**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/feedback**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/superadmin/operator/overview**', async (route) => {
    await fulfillJson(route, {
      audit: { unresolved: 0 },
      approvals: { pending: 0 },
      sessions: { active: 0, jitActive: 0, breakGlassActive: 0 },
      compliance: { legalHolds: 0, residencyReview: 0 },
      incidents: { critical: 0, high: 0 },
      overrides: { mfa: 'disabled', sso: 'disabled' },
      events: { today: 0 },
    });
  });

  await page.route('**/api/superadmin/operator/timeline**', async (route) => {
    await fulfillJson(route, { items: [] });
  });

  await page.route('**/api/system-health**', async (route) => {
    await fulfillJson(route, { status: 'ok' });
  });

  await page.route('**/api/llm/providers**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/llm/control/usage**', async (route) => {
    await fulfillJson(route, { totals: { requests: 0, tokens: 0 }, period: '30d' });
  });

  await page.route('**/api/llm/costs**', async (route) => {
    await fulfillJson(route, { totalCost: 0, currency: 'USD', byProvider: [] });
  });

  await page.route('**/api/llm/health/detailed**', async (route) => {
    await fulfillJson(route, { overall: 'healthy', providers: [] });
  });

  await page.route('**/api/ai-governance/policy**', async (route) => {
    await fulfillJson(route, {
      data: {
        summary: { internetEnabled: false },
        runtime: {
          tavilyConfigured: false,
          webSearchAvailable: false,
          provider: null,
        },
      },
    });
  });

  await page.route('**/api/superadmin/integrations**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/superadmin/webhooks**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/superadmin/integrations/catalog**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/billing/admin/revenue**', async (route) => {
    await fulfillJson(route, {
      mrr: 0,
      arr: 0,
      activeSubscriptions: 0,
      planDistribution: [],
    });
  });

  await page.route('**/api/billing/admin/usage**', async (route) => {
    await fulfillJson(route, {
      totalTokensThisMonth: 0,
      totalStorageGB: 0,
      activeOrganizations: 0,
      periodStart: new Date().toISOString(),
    });
  });

  await page.route('**/api/billing/admin/operational-costs**', async (route) => {
    await fulfillJson(route, { items: [], totalCost: 0 });
  });

  await page.route('**/api/superadmin/admin/sessions', async (route) => {
    await fulfillJson(route, { sessions: [] });
  });

  await page.route('**/api/superadmin/admin/sessions/stats', async (route) => {
    await fulfillJson(route, {
      total: 0,
      active: 0,
      jitActive: 0,
      breakGlassActive: 0,
    });
  });

  await page.route('**/api/security-policies/all**', async (route) => {
    await fulfillJson(route, { policies: [] });
  });

  await page.route('**/api/security-policies/defaults**', async (route) => {
    await fulfillJson(route, {});
  });

  await page.route('**/api/compliance/frameworks**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.route('**/api/superadmin/analytics**', async (route) => {
    await fulfillJson(route, []);
  });

  await page.addInitScript(
    ({ syntheticToken, syntheticUser }) => {
      window.localStorage.setItem('token', syntheticToken);
      window.localStorage.setItem('user', JSON.stringify(syntheticUser));
      window.localStorage.setItem(
        'consultinity_demo_session',
        JSON.stringify({
          sessionId: 'smoke-superadmin',
          startTime: new Date().toISOString(),
          hasCompletedTour: true,
          hasSeenWelcome: true,
          hasInteractedWithAI: false,
          aiInteractionsUsed: 0,
          featuresExplored: [],
          upgradePromptsShown: 0,
          exitIntentTriggered: false,
          milestones: [],
        })
      );
    },
    { syntheticToken: auth.token, syntheticUser: user }
  );

  await auth.req.dispose();
}

async function expectMounted(page: Page, targetUrl?: RegExp) {
  await dismissTourModal(page);
  await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  await expect(page.getByText(/Coś poszło nie tak/i)).toHaveCount(0);
  if (targetUrl) {
    await expect(page).toHaveURL(targetUrl);
  }
}

test.describe('L4 Smoke — settings/admin/superadmin readiness', () => {
  test.setTimeout(300000);

  test('settings flow routes mount across the active surface', async ({ page }) => {
    await authenticateAdminDemo(page);

    for (const route of SETTINGS_FLOW_ROUTES) {
      console.log(`[smoke][settings] ${route.path}`);
      await page.goto(route.path);
      await expectMounted(page, route.expected);
    }
  });

  test('admin flow routes mount across the active command center', async ({ page }) => {
    await authenticateAdminDemo(page);

    for (const route of ADMIN_FLOW_ROUTES) {
      console.log(`[smoke][admin] ${route.path}`);
      await page.goto(route.path);
      await expectMounted(page, route.expected);
    }
  });

  test('superadmin flow routes mount across the active control plane', async ({
    page,
  }) => {
    await authenticateSyntheticSuperAdmin(page);

    for (const route of SUPERADMIN_FLOW_ROUTES) {
      console.log(`[smoke][superadmin] ${route.path}`);
      await page.goto(route.path);
      await expectMounted(page, route.expected);
    }
  });
});
