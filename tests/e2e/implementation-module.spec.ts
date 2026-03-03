/**
 * E2E Tests for Implementation Module (Execution Center)
 *
 * This suite validates real, end-to-end behaviors for the module entry route `/implementation`
 * (which renders the Execution Center UI).
 */

import { expect, Page, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

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

async function login(page: Page) {
  const response = await page.request.post(`${API_BASE_URL}/api/auth/demo-login`);
  if (!response.ok()) {
    let errorDetail = '';
    try {
      const data = await response.json();
      errorDetail = JSON.stringify(data);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Demo login failed: ${response.status()} ${errorDetail}`);
  }
  const data = await response.json();

  await page.addInitScript(
    ({ token, refreshToken }) => {
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      sessionStorage.setItem('isDemo', 'true');
    },
    { token: data.token, refreshToken: data.refreshToken }
  );

  // Ensure we have a proper origin so localStorage is accessible in subsequent steps.
  await page.goto('/dashboard');
  await dismissTourModal(page);
}

async function getAuthToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) throw new Error('Missing auth token');
  return token;
}

async function getProjectId(page: Page, token: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${token}` };
  const projectsResponse = await page.request.get(`${API_BASE_URL}/api/projects`, { headers });
  if (!projectsResponse.ok()) return null;
  const projectsData = await projectsResponse.json();
  return projectsData?.projects?.[0]?.id || projectsData?.[0]?.id || null;
}

async function createExecutionInitiative(
  page: Page,
  token: string,
  projectId: string | null,
  title: string
): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };
  const res = await page.request.post(`${API_BASE_URL}/api/initiatives`, {
    headers,
    data: {
      title,
      summary: 'E2E seed for execution module',
      status: 'EXECUTING',
      projectId: projectId || undefined,
    },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  const id = json?.id;
  if (!id) throw new Error('Failed to create initiative (missing id)');
  return id;
}

test.describe('Implementation Module (Execution Center)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('renders module and exposes view modes', async ({ page }) => {
    await page.goto('/implementation');
    await dismissTourModal(page);

    await expect(page.locator('#root')).toBeAttached();
    // View mode toggle is shown when tab exposes >1 mode (Reporting tab).
    await page.getByRole('button', { name: /Reporting|Raportowanie/i }).click();
    await expect(page.locator('[data-testid="view-mode-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-mode-kanban"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-mode-timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-mode-calendar"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-mode-grid"]')).toBeVisible();
  });

  test('manages timeline dependencies via UI (add + remove)', async ({ page }) => {
    const token = await getAuthToken(page);
    const projectId = await getProjectId(page, token);

    const aTitle = `E2E Dep A ${Date.now()}`;
    const bTitle = `E2E Dep B ${Date.now()}`;
    const aId = await createExecutionInitiative(page, token, projectId, aTitle);
    const bId = await createExecutionInitiative(page, token, projectId, bTitle);

    // Seed a dependency via API (deterministic), then validate UI can render + delete it.
    const headers = { Authorization: `Bearer ${token}` };
    const depCreate = await page.request.post(`${API_BASE_URL}/api/initiatives/portfolio/dependencies`, {
      headers,
      data: { fromInitiativeId: aId, toInitiativeId: bId, type: 'FINISH_TO_START', projectId },
    });
    if (!depCreate.ok()) {
      let detail = '';
      try {
        detail = JSON.stringify(await depCreate.json());
      } catch {
        detail = await depCreate.text();
      }
      throw new Error(`Dependency create failed: ${depCreate.status()} ${detail}`);
    }

    await page.goto('/implementation');
    await dismissTourModal(page);

    // Open Timeline view
    await page.getByRole('button', { name: /Reporting|Raportowanie/i }).click();
    await page.locator('[data-testid="view-mode-timeline"]').click();

    // Open dependency manager
    await page.locator('[data-testid="timeline-deps-button"]').click();
    await expect(page.locator('[data-testid="timeline-deps-modal"]')).toBeVisible();

    // Verify row appears
    const rowText = new RegExp(`${aTitle}.*→.*${bTitle}`);
    await expect(page.getByText(rowText)).toBeVisible();

    // Remove dependency in UI
    await page.getByRole('button', { name: /Remove/i }).first().click({ force: true });
    await expect(page.getByText(rowText)).not.toBeVisible();

    // Verify backend state updated (no dependency for this edge)
    const qs = new URLSearchParams();
    if (projectId) qs.set('projectId', projectId);
    const depList = await page.request.get(
      `${API_BASE_URL}/api/initiatives/portfolio/dependencies?${qs.toString()}`,
      { headers }
    );
    expect(depList.ok()).toBeTruthy();
    const depJson = await depList.json();
    const deps = depJson?.dependencies || [];
    expect(
      deps.some((d: any) => d.fromInitiativeId === aId && d.toInitiativeId === bId)
    ).toBeFalsy();
  });
});

