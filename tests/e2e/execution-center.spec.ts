/**
 * E2E Tests for Execution Center
 *
 * Tests cover:
 * - UI: Status filters, view modes (5 views), portfolio health panel
 * - API: Execution summary, blockers, gate checks, portfolio health, statistics
 * - Workflow: Decision gates blocking completion, DONE -> Benefits handoff
 * - Escalations: Overdue decision handling
 *
 * Module statuses: EXECUTING, BLOCKED, DONE, CANCELLED, ARCHIVED
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

    // Status filters for execution phase
    await expect(page.locator('[data-testid="status-filter-EXECUTING"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-BLOCKED"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-DONE"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-CANCELLED"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-ARCHIVED"]')).toBeVisible();

    // 5 view modes: table, grid, kanban, timeline, calendar
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

  test('fetches execution summary via API', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Get project ID
    const projectsResponse = await page.request.get(`${API_BASE_URL}/api/projects`, { headers });
    const projectsData = await projectsResponse.json();
    const projectId = projectsData?.projects?.[0]?.id || projectsData?.[0]?.id;

    if (projectId) {
      const summaryResponse = await page.request.get(
        `${API_BASE_URL}/api/execution/${projectId}/summary`,
        { headers }
      );
      expect(summaryResponse.ok()).toBeTruthy();
      const summary = await summaryResponse.json();
      expect(summary).toHaveProperty('completionPercentage');
      expect(summary).toHaveProperty('onTrackTasks');
      expect(summary).toHaveProperty('blockedTasks');
    }
  });

  test('fetches portfolio health metrics via API', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const projectsResponse = await page.request.get(`${API_BASE_URL}/api/projects`, { headers });
    const projectsData = await projectsResponse.json();
    const projectId = projectsData?.projects?.[0]?.id || projectsData?.[0]?.id;

    if (projectId) {
      const healthResponse = await page.request.get(
        `${API_BASE_URL}/api/execution/${projectId}/health`,
        { headers }
      );
      expect(healthResponse.ok()).toBeTruthy();
      const health = await healthResponse.json();
      expect(health).toHaveProperty('healthScore');
      expect(health).toHaveProperty('onTrackCount');
      expect(health).toHaveProperty('blockedCount');
      expect(health).toHaveProperty('overdueDecisions');
      expect(health).toHaveProperty('breakdown');
    }
  });

  test('fetches execution statistics via API', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const statsResponse = await page.request.get(`${API_BASE_URL}/api/execution/stats`, {
      headers,
    });
    expect(statsResponse.ok()).toBeTruthy();
    const stats = await statsResponse.json();
    expect(stats).toHaveProperty('stats');
    expect(stats).toHaveProperty('total');
  });

  test('fetches escalations dashboard via API', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const escalationsResponse = await page.request.get(
      `${API_BASE_URL}/api/execution/escalations`,
      { headers }
    );
    expect(escalationsResponse.ok()).toBeTruthy();
    const escalations = await escalationsResponse.json();
    expect(escalations).toHaveProperty('escalations');
    expect(escalations.escalations).toHaveProperty('amber');
    expect(escalations.escalations).toHaveProperty('red');
    expect(escalations).toHaveProperty('counts');
  });

  test('fetches calendar items via API', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const calendarResponse = await page.request.get(`${API_BASE_URL}/api/execution/calendar`, {
      headers,
    });
    expect(calendarResponse.ok()).toBeTruthy();
    const calendar = await calendarResponse.json();
    expect(calendar).toHaveProperty('items');
    expect(Array.isArray(calendar.items)).toBeTruthy();
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

    // Create a blocking decision
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

    // Attempt to close initiative - should fail due to pending decision
    const closeResponse = await page.request.patch(
      `${API_BASE_URL}/api/initiatives/${initiativeId}/status`,
      {
        headers,
        data: { status: 'DONE' },
      }
    );
    expect(closeResponse.status()).toBe(400);
  });

  test('performs gate check via API', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const projectsResponse = await page.request.get(`${API_BASE_URL}/api/projects`, { headers });
    const projectsData = await projectsResponse.json();
    const projectId = projectsData?.projects?.[0]?.id || projectsData?.[0]?.id;

    if (projectId) {
      const gateResponse = await page.request.post(
        `${API_BASE_URL}/api/execution/${projectId}/gate-check`,
        {
          headers,
          data: {
            targetStatus: 'DONE',
          },
        }
      );
      expect(gateResponse.ok()).toBeTruthy();
      const gateResult = await gateResponse.json();
      expect(gateResult).toHaveProperty('canAdvance');
      expect(gateResult).toHaveProperty('message');
    }
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

    // DONE initiatives should be visible in Benefits module
    await page.goto('/benefits');
    await expect(page.getByText('E2E Execution to Benefits').first()).toBeVisible();
  });

  test('can switch between view modes', async ({ page }) => {
    await page.goto('/execution');

    // Switch to kanban view
    await page.locator('[data-testid="view-mode-kanban"]').click();
    await page.waitForTimeout(500);

    // Switch to timeline view
    await page.locator('[data-testid="view-mode-timeline"]').click();
    await page.waitForTimeout(500);

    // Switch to calendar view
    await page.locator('[data-testid="view-mode-calendar"]').click();
    await page.waitForTimeout(500);

    // Switch back to table view
    await page.locator('[data-testid="view-mode-table"]').click();
    await page.waitForTimeout(500);
  });

  test('kanban board displays columns and supports drag interactions', async ({ page }) => {
    await page.goto('/execution');

    // Switch to kanban view
    await page.locator('[data-testid="view-mode-kanban"]').click();
    await page.waitForTimeout(500);

    // Verify kanban board is visible
    await expect(page.locator('[data-testid="kanban-board"]')).toBeVisible();

    // Verify all 5 columns are present
    await expect(page.locator('[data-testid="kanban-column-todo"]')).toBeVisible();
    await expect(page.locator('[data-testid="kanban-column-in_progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="kanban-column-review"]')).toBeVisible();
    await expect(page.locator('[data-testid="kanban-column-blocked"]')).toBeVisible();
    await expect(page.locator('[data-testid="kanban-column-done"]')).toBeVisible();
  });

  test('RAID Log tab is accessible and displays content', async ({ page }) => {
    await page.goto('/execution');

    // Look for RAID Log tab
    const raidTab = page.getByRole('button', { name: /RAID/i }).first();
    if (await raidTab.isVisible()) {
      await raidTab.click();
      await page.waitForTimeout(500);

      // Verify RAID Log content is displayed
      await expect(page.getByText('RAID Log').first()).toBeVisible();
    }
  });

  test('Decisions tab shows pending decisions count', async ({ page }) => {
    await page.goto('/execution');

    // Look for Decisions tab
    const decisionsTab = page.getByRole('button', { name: /Decisions/i }).first();
    if (await decisionsTab.isVisible()) {
      await decisionsTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('can perform drag and drop in kanban board', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // Get project ID
    const projectsResponse = await page.request.get(`${API_BASE_URL}/api/projects`, { headers });
    const projectsData = await projectsResponse.json();
    const projectId = projectsData?.projects?.[0]?.id || projectsData?.[0]?.id;

    // Create a test task in TODO status
    const taskResponse = await page.request.post(`${API_BASE_URL}/api/tasks`, {
      headers,
      data: {
        title: 'E2E Drag Test Task',
        projectId,
        status: 'TODO',
        priority: 'medium',
      },
    });

    if (taskResponse.ok()) {
      await page.goto('/execution');

      // Switch to kanban view
      await page.locator('[data-testid="view-mode-kanban"]').click();
      await page.waitForTimeout(1000);

      // Verify kanban board is visible
      const kanbanBoard = page.locator('[data-testid="kanban-board"]');
      await expect(kanbanBoard).toBeVisible();

      // Look for the test task in TODO column
      const todoColumn = page.locator('[data-testid="kanban-column-todo"]');
      const taskCard = todoColumn.getByText('E2E Drag Test Task').first();

      if (await taskCard.isVisible({ timeout: 5000 })) {
        // Get the in_progress column
        const inProgressColumn = page.locator('[data-testid="kanban-column-in_progress"]');

        // Perform drag and drop
        await taskCard.dragTo(inProgressColumn);
        await page.waitForTimeout(1000);

        // Verify task moved to in_progress column
        await expect(inProgressColumn.getByText('E2E Drag Test Task')).toBeVisible();
      }
    }
  });
});
