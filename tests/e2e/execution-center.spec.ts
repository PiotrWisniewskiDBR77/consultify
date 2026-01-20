/**
 * E2E Tests for Execution Center
 *
 * Validates status filters, view modes, and health panel availability.
 */
import { expect, Page, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

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
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      sessionStorage.setItem('isDemo', 'true');
    },
    { token: data.token, refreshToken: data.refreshToken }
  );

  await page.goto('/dashboard');
}

async function getAuthToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) {
    throw new Error('Missing auth token');
  }
  return token;
}

test.describe('Execution Center', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('shows execution status filters and view modes', async ({ page }) => {
    await page.goto('/execution');

    await expect(page.locator('[data-testid="status-filter-EXECUTING"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-BLOCKED"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-DONE"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-CANCELLED"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-ARCHIVED"]')).toBeVisible();

    await expect(page.locator('[data-testid="view-mode-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-mode-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-mode-kanban"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-mode-timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="view-mode-calendar"]')).toBeVisible();
  });

  test('renders portfolio health panel', async ({ page }) => {
    await page.goto('/execution');
    await expect(page.locator('[data-testid="portfolio-health"]')).toBeVisible();
  });

  test('blocks execution completion when gate decisions are pending', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const projectsResponse = await page.request.get(`${API_BASE_URL}/api/projects`, { headers });
    const projectsData = await projectsResponse.json();
    const projectId = projectsData?.projects?.[0]?.id || projectsData?.[0]?.id;

    const initResponse = await page.request.post(`${API_BASE_URL}/api/initiatives`, {
      headers,
      data: {
        title: 'E2E Execution Initiative',
        summary: 'Execution gating test',
        status: 'EXECUTING',
        projectId,
      },
    });
    const initData = await initResponse.json();
    const initiativeId = initData?.id;

    const decisionResponse = await page.request.post(`${API_BASE_URL}/api/decisions`, {
      headers,
      data: {
        title: 'Scope Change Gate',
        projectId,
        decisionType: 'SCOPE_CHANGE',
        relatedObjectType: 'initiative',
        relatedObjectId: initiativeId,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    expect(decisionResponse.ok()).toBeTruthy();

    const closeResponse = await page.request.patch(
      `${API_BASE_URL}/api/initiatives/${initiativeId}/status`,
      {
        headers,
        data: { status: 'DONE' },
      }
    );
    expect(closeResponse.status()).toBe(400);
  });

  test('moves completed initiative to benefits module', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const projectsResponse = await page.request.get(`${API_BASE_URL}/api/projects`, { headers });
    const projectsData = await projectsResponse.json();
    const projectId = projectsData?.projects?.[0]?.id || projectsData?.[0]?.id;

    const initResponse = await page.request.post(`${API_BASE_URL}/api/initiatives`, {
      headers,
      data: {
        title: 'E2E Execution to Benefits',
        summary: 'Benefits handoff test',
        status: 'EXECUTING',
        projectId,
      },
    });
    const initData = await initResponse.json();
    const initiativeId = initData?.id;

    const closeResponse = await page.request.patch(
      `${API_BASE_URL}/api/initiatives/${initiativeId}/status`,
      {
        headers,
        data: { status: 'DONE' },
      }
    );
    expect(closeResponse.ok()).toBeTruthy();

    await page.goto('/benefits');
    await expect(page.getByText('E2E Execution to Benefits').first()).toBeVisible();
  });
});
