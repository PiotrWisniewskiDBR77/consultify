/**
 * L4 Smoke — Initiatives AI language payload
 *
 * Verifies that when UI language is set to:
 * - pl → AI requests send language: "pl"
 * - en → AI requests send language: "en"
 *
 * We make this deterministic by:
 * - authenticating via /api/auth/demo-login
 * - creating a project + initiative via authenticated API
 * - intercepting backend endpoints and asserting request body.language
 */

import { expect, Page, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

async function dismissTourModal(page: Page) {
  const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  // The welcome/tour overlay can appear slightly after navigation; keep trying briefly.
  for (let i = 0; i < 12; i++) {
    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);

    if (hasSkip) {
      await skipTour.click({ timeout: 1500, force: true }).catch(() => {});
    }
    if (hasWelcome) {
      // Picking a persona also dismisses the overlay in some flows.
      await consultantCard.click({ timeout: 1500, force: true }).catch(() => {});
    }

    await page.keyboard.press('Escape').catch(() => {});

    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;
    await page.waitForTimeout(200);
  }
}

async function demoLogin(page: Page): Promise<{ token: string; userId: string }> {
  const response = await page.request.post(`${API_BASE_URL}/api/auth/demo-login`);
  if (!response.ok()) {
    const bodyText = await response.text().catch(() => '<unreadable>');
    throw new Error(`Demo login failed: ${response.status()} ${response.statusText()} ${bodyText}`);
  }
  const data = await response.json();
  const userId = String(data?.user?.id || '');
  if (!userId) throw new Error('Demo login missing user id');

  await page.addInitScript(
    ({ token, refreshToken }) => {
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      sessionStorage.setItem('isDemo', 'true');

      // Make demo deterministic: suppress welcome tour / overlays (DemoSessionManager).
      try {
        localStorage.setItem(
          'consultinity_demo_session',
          JSON.stringify({
            sessionId: 'e2e',
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
      } catch {
        // ignore storage failures
      }
    },
    { token: data.token, refreshToken: data.refreshToken }
  );

  await page.goto('/dashboard');
  await dismissTourModal(page);
  return { token: data.token, userId };
}

async function getFirstProjectId(page: Page, token: string): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };
  const res = await page.request.get(`${API_BASE_URL}/api/projects`, { headers });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const projectId = data?.projects?.[0]?.id || data?.[0]?.id;
  if (projectId) return projectId;

  const createRes = await page.request.post(`${API_BASE_URL}/api/projects`, {
    headers,
    data: { name: `E2E Project ${Date.now()}`, description: 'E2E seed project (created by smoke)' },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  const createdId = created?.id || created?.project?.id || created?.data?.id;
  if (!createdId) throw new Error('Failed to create project');
  return createdId;
}

async function createInitiative(page: Page, token: string, userId: string, projectId: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const createRes = await page.request.post(`${API_BASE_URL}/api/initiatives`, {
    headers,
    data: {
      title: `E2E AI Lang ${Date.now()}`,
      summary: 'E2E: verify AI request language payload',
      status: 'PLANNING',
      projectId,
      sourceType: 'manual',
      axis: 'operational',
      priority: 'high',
      ownerBusinessId: userId,
      ownerExecutionId: userId,
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  const initiativeId = created?.id;
  expect(initiativeId).toBeTruthy();
  return String(initiativeId);
}

function getRequestJson(route: any): any {
  const req = route.request();
  try {
    return req.postDataJSON();
  } catch {
    try {
      return JSON.parse(req.postData() || '{}');
    } catch {
      return null;
    }
  }
}

test.describe('Initiatives — AI language payload (smoke)', () => {
  test.setTimeout(90000);

  test.describe('PL browser locale', () => {
    test.use({ locale: 'pl-PL' });

    test('Comments AI refine-text sends correct language (pl)', async ({ page }) => {
      const { token, userId } = await demoLogin(page);
      const projectId = await getFirstProjectId(page, token);
      const initiativeId = await createInitiative(page, token, userId, projectId);

      await page.goto(`/initiatives?open=${initiativeId}&mode=doc`);
      await dismissTourModal(page);

      // Switch to Comments section
      await page
        .getByRole('button', { name: /Comments|Komentarze/i })
        .first()
        .click({ force: true, timeout: 30000 });

      let saw = false;
      await page.route('**/api/ai/refine-text**', async (route) => {
        const body = getRequestJson(route);
        expect(body?.language).toBe('pl');
        saw = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ text: JSON.stringify({ add: [], remove: [], note: 'OK' }) }),
        });
      });

      const cta = page.getByRole('button', { name: /Analyze with AI|Analizuj z AI/i }).first();
      await expect(cta).toBeEnabled();
      await cta.click();

      // Modal should open (EN/PL)
      await expect(
        page.getByText(/Proposed comment changes \(AI\)|Propozycje zmian w komentarzach \(AI\)/i)
      ).toBeVisible({ timeout: 10000 });
      expect(saw).toBeTruthy();
    });
  });

  test.describe('EN browser locale', () => {
    test.use({ locale: 'en-US' });

    test('Team analyze refine-text sends correct language (en)', async ({ page }) => {
      const { token, userId } = await demoLogin(page);
      const projectId = await getFirstProjectId(page, token);
      const initiativeId = await createInitiative(page, token, userId, projectId);

      await page.goto(`/initiatives?open=${initiativeId}&mode=doc`);
      await dismissTourModal(page);

      let saw = false;
      await page.route('**/api/ai/refine-text**', async (route) => {
        const body = getRequestJson(route);
        expect(body?.language).toBe('en');
        saw = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: JSON.stringify({ add: [], update: [], remove: [], note: 'OK' }),
          }),
        });
      });

      // Switch to Team and trigger the global "Analyze with AI" CTA.
      const teamNav = page.getByRole('button', { name: /Team|Zespół/i }).first();
      await expect(teamNav).toBeVisible({ timeout: 15000 });
      await teamNav.click();

      const analyzeCta = page
        .getByRole('button', {
          name: /Analyze with AI|Analizuj z AI/i,
        })
        .first();
      await expect(analyzeCta).toBeVisible({ timeout: 15000 });
      await expect(analyzeCta).toBeEnabled();
      await analyzeCta.click();

      // We don't assert UI content deeply—this is a payload smoke check.
      await expect.poll(() => saw, { timeout: 15000 }).toBeTruthy();
    });
  });
});
