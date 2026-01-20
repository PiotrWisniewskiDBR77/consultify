/**
 * E2E Tests for Execution Center
 *
 * Validates status filters, view modes, and health panel availability.
 */
import { expect, Page, test } from '@playwright/test';

const testUser = {
  email: 'e2e-test@consultinity.dev',
  password: 'TestPassword123!',
};

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', testUser.email);
  await page.fill('[data-testid="password-input"]', testUser.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
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
    await expect(page.getByText('Portfolio Health')).toBeVisible();
  });

  test('blocks execution completion when gate decisions are pending', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const projectsResponse = await page.request.get('/api/projects', { headers });
    const projectsData = await projectsResponse.json();
    const projectId = projectsData?.projects?.[0]?.id || projectsData?.[0]?.id;

    const initResponse = await page.request.post('/api/initiatives', {
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

    const decisionResponse = await page.request.post('/api/decisions', {
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

    const closeResponse = await page.request.patch(`/api/initiatives/${initiativeId}/status`, {
      headers,
      data: { status: 'DONE' },
    });
    expect(closeResponse.status()).toBe(400);
  });

  test('moves completed initiative to benefits module', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const projectsResponse = await page.request.get('/api/projects', { headers });
    const projectsData = await projectsResponse.json();
    const projectId = projectsData?.projects?.[0]?.id || projectsData?.[0]?.id;

    const initResponse = await page.request.post('/api/initiatives', {
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

    const closeResponse = await page.request.patch(`/api/initiatives/${initiativeId}/status`, {
      headers,
      data: { status: 'DONE' },
    });
    expect(closeResponse.ok()).toBeTruthy();

    await page.goto('/benefits');
    await expect(page.getByText('E2E Execution to Benefits')).toBeVisible();
  });
});
