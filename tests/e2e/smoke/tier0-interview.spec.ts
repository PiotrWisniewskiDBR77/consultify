/**
 * L4 Smoke — Tier-0 Interview (M10 Wywiad)  [@module:interview]
 *
 * DoD #6 for M10 requires the Interview E2E to live in the PR-blocking gate.
 * The full UI suite at tests/e2e/interview.spec.ts authenticates with a
 * hard-coded real-DB account (piotr.wisniewski@dbr77.com / 123456) and depends
 * on a seeded project + approved template library — neither exists under the
 * gate's MOCK_DB + ENABLE_TEST_SUPPORT web-server harness, so it cannot be
 * gated as-is. This spec mirrors the existing gated tier0 pattern instead:
 *
 *   - auth via readTestSupportState() token (same as tier0-initiative-create)
 *   - UI render via the already-gated expectRouteMounted() helper shape
 *     (same as tier0-core-workflows' "Interview (Discovery) module renders")
 *
 * It guarantees the Interview module mounts AND its core API session/context
 * path is reachable on every PR — without pulling in the flaky hard-coded-login
 * UI flows.
 *
 * Run (local): E2E_USE_WEB_SERVER=true npm run test:e2e:tier0
 */

import { expect, Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

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

async function expectRouteMounted(page: Page) {
  await dismissTourModal(page);
  await expect(page.locator('#root')).toContainText(/./, { timeout: 30000 });
  await expect(page.getByText(/Coś poszło nie tak|Something went wrong/i)).toHaveCount(0);
}

test.describe('L4 Smoke — Tier-0 Interview [@module:interview]', () => {
  test.setTimeout(90000);

  // /discovery is the legacy alias that renders InterviewHub directly (no
  // V8UnavailableBanner wrapper), so it mounts deterministically on a fresh
  // MOCK_DB org. This mirrors tier0-core-workflows' Interview render check.
  test('Interview hub renders (no error boundary)', async ({ page }) => {
    await page.goto('/discovery');
    await expectRouteMounted(page);
  });

  test('Interview session + context API reachable', async ({ request }) => {
    const { token } = readTestSupportState();
    const headers = authHeaders(token);

    // Create a session — core write path for the module.
    const createSession = await request.post(`${API_BASE_URL}/api/interview/sessions`, {
      headers,
      data: { name: `Tier0 Interview ${Date.now()}` },
    });
    // Endpoint must be mounted and accept the write. Under MOCK_DB persistence
    // across routes is not guaranteed, so a 2xx (created) is the gate signal.
    expect(createSession.ok()).toBeTruthy();

    // Organization context is the read path the UI relies on for the workspace.
    const contextRes = await request.get(`${API_BASE_URL}/api/interview/context`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(contextRes.ok()).toBeTruthy();
  });
});
