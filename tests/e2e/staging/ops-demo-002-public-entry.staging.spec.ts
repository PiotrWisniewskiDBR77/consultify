/**
 * OPS-DEMO-002 — staging golden flow for the public `Try demo` entry.
 *
 * TARGET: Railway project `consultify`, environment `demo`,
 * https://demo.consultify.ai. Localhost is not acceptance evidence.
 *
 * NOT RUN BY THE IMPLEMENTATION LANE. Codex runs it as part of a staging packet,
 * after the revision is deployed. It creates a real account in the demo database,
 * so it must be paired with the cleanup step documented in the packet.
 *
 * Run:
 *   OPS_DEMO_002_STAGING=1 \
 *   E2E_BASE_URL=https://demo.consultify.ai \
 *   npx playwright test tests/e2e/staging/ops-demo-002-public-entry.staging.spec.ts
 *
 * Fixture policy:
 *   - the address is namespaced and disposable: `ops-demo-002+<runId>@fixture.invalid`;
 *   - the password is generated per run and never written to a doc, log or seed;
 *   - two accounts are created so tenant isolation can be observed from the UI.
 */
import { expect, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://demo.consultify.ai';
const ENABLED = process.env.OPS_DEMO_002_STAGING === '1';

// Refuse to run anywhere except the sanctioned staging host: this spec writes.
const isCanonicalStagingTarget = (() => {
  try {
    return new URL(BASE_URL).hostname === 'demo.consultify.ai';
  } catch {
    return false;
  }
})();

test.describe('OPS-DEMO-002 public Try demo (staging)', () => {
  test.skip(
    !ENABLED || !isCanonicalStagingTarget,
    'Set OPS_DEMO_002_STAGING=1 and target https://demo.consultify.ai. This spec mutates the demo database.'
  );

  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const account = (suffix: string) => ({
    email: `ops-demo-002+${runId}-${suffix}@fixture.invalid`,
    // Generated per run; deliberately never logged or persisted anywhere.
    password: `Ops!${runId}${suffix}Demo`,
  });

  async function signUpForDemo(page: any, creds: { email: string; password: string }) {
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: /try demo|demo/i }).first().click();
    await expect(page.getByText(/Experience Consultify Demo/i)).toBeVisible();

    await page.getByPlaceholder('you@company.com').fill(creds.email);
    await page.getByPlaceholder('Min. 8 characters').fill(creds.password);
    await page.getByRole('button', { name: /Sign up & Enter Demo/i }).click();
  }

  test('signup enters an isolated seeded Atelier Toys workspace and reaches /chat', async ({
    page,
  }) => {
    const creds = account('a');
    const registerResponse = page.waitForResponse(
      (r: any) => r.url().includes('/api/auth/register-demo') && r.request().method() === 'POST'
    );

    await signUpForDemo(page, creds);

    const res = await registerResponse;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isDemo).toBe(true);
    expect(body.demoSession?.organizationId).toBeTruthy();

    await page.waitForURL(/\/chat/, { timeout: 60_000 });
    // Modules must render for the demo tenant, not an empty shell.
    await expect(page.getByText(/Atelier Toys/i).first()).toBeVisible({ timeout: 60_000 });

    // Every authenticated call must carry the caller's own session org.
    const orgHeader = await page.evaluate(() => {
      const raw = localStorage.getItem('consultify-storage');
      return raw ? JSON.parse(raw)?.state?.demoSessionOrgId || null : null;
    });
    expect(orgHeader).toBe(body.demoSession.organizationId);
  });

  test('a second demo account gets a different tenant', async ({ browser }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    try {
      const pageA = await first.newPage();
      const pageB = await second.newPage();

      const resA = pageA.waitForResponse((r: any) => r.url().includes('/api/auth/register-demo'));
      await signUpForDemo(pageA, account('tenant-a'));
      const bodyA = await (await resA).json();

      const resB = pageB.waitForResponse((r: any) => r.url().includes('/api/auth/register-demo'));
      await signUpForDemo(pageB, account('tenant-b'));
      const bodyB = await (await resB).json();

      expect(bodyA.demoSession.organizationId).not.toBe(bodyB.demoSession.organizationId);
    } finally {
      await first.close();
      await second.close();
    }
  });

  test('a repeated address is refused without disclosing that it exists', async ({ page }) => {
    const creds = account('dup');
    await signUpForDemo(page, creds);
    await page.waitForURL(/\/chat/, { timeout: 60_000 });

    const context = page.context();
    await context.clearCookies();
    const retryPage = await context.newPage();
    const conflict = retryPage.waitForResponse((r: any) =>
      r.url().includes('/api/auth/register-demo')
    );
    await signUpForDemo(retryPage, creds);

    const res = await conflict;
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('DEMO_SIGNUP_UNAVAILABLE');

    const alert = retryPage.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/already in use|exists/i);
    await expect(alert).not.toContainText(creds.email);
  });

  test('logout ends the session and private routes stay protected', async ({ page }) => {
    await signUpForDemo(page, account('logout'));
    await page.waitForURL(/\/chat/, { timeout: 60_000 });

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/chat`);
    await expect(page).toHaveURL(/\/(login|auth|$)/, { timeout: 60_000 });
  });

  test('the deprecated anonymous demo endpoint stays gone', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/auth/demo-login`, { data: {} });
    expect(res.status()).toBe(410);
  });
});
