/**
 * E2E Tests for Initiatives + Roadmap
 *
 * Validates status filters and gate decision workflow.
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

test.describe('Initiatives + Roadmap', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('shows only planning/review/approved status filters', async ({ page }) => {
    await page.goto('/initiatives');
    await expect(page.locator('[data-testid="initiatives-hub"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-PLANNING"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-REVIEW"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-APPROVED"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-filter-DRAFT"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="status-filter-EXECUTING"]')).toHaveCount(0);
  });

  test('enforces gate decisions for review -> approved -> executing', async ({ page }) => {
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const meResponse = await page.request.get('/api/auth/me', { headers });
    const meData = await meResponse.json();
    const userId = meData?.user?.id;

    const initResponse = await page.request.post('/api/initiatives', {
      headers,
      data: {
        title: 'E2E Initiative - Gate Flow',
        summary: 'E2E gate validation',
      },
    });
    const initData = await initResponse.json();
    const initiativeId = initData?.id;

    await page.request.patch(`/api/initiatives/${initiativeId}/status`, {
      headers,
      data: { status: 'REVIEW' },
    });

    const approveWithoutDecision = await page.request.patch(
      `/api/initiatives/${initiativeId}/status`,
      {
        headers,
        data: { status: 'APPROVED' },
      }
    );
    expect(approveWithoutDecision.status()).toBe(400);

    const goNoGoDecision = await page.request.post('/api/decisions', {
      headers,
      data: {
        title: 'Go/No-Go Decision',
        pmoDomain: 'GOVERNANCE_DECISION_MAKING',
        decisionOwnerId: userId,
        relatedObjectType: 'initiative',
        relatedObjectId: initiativeId,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        priority: 'high',
      },
    });
    const goNoGoData = await goNoGoDecision.json();
    await page.request.patch(`/api/decisions/${goNoGoData.id}/decide`, {
      headers,
      data: { decision: 'approved', rationale: 'Approved for E2E test' },
    });

    const approveWithDecision = await page.request.patch(
      `/api/initiatives/${initiativeId}/status`,
      {
        headers,
        data: { status: 'APPROVED' },
      }
    );
    expect(approveWithDecision.ok()).toBeTruthy();

    const resourcesDecision = await page.request.post('/api/decisions', {
      headers,
      data: {
        title: 'Resources Commit',
        pmoDomain: 'RESOURCE_RESPONSIBILITY',
        decisionOwnerId: userId,
        relatedObjectType: 'initiative',
        relatedObjectId: initiativeId,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        priority: 'high',
      },
    });
    const resourcesData = await resourcesDecision.json();
    await page.request.patch(`/api/decisions/${resourcesData.id}/decide`, {
      headers,
      data: { decision: 'approved', rationale: 'Approved resources' },
    });

    const scheduleDecision = await page.request.post('/api/decisions', {
      headers,
      data: {
        title: 'Schedule Lock',
        pmoDomain: 'SCHEDULE_MILESTONES',
        decisionOwnerId: userId,
        relatedObjectType: 'initiative',
        relatedObjectId: initiativeId,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        priority: 'high',
      },
    });
    const scheduleData = await scheduleDecision.json();
    await page.request.patch(`/api/decisions/${scheduleData.id}/decide`, {
      headers,
      data: { decision: 'approved', rationale: 'Schedule locked' },
    });

    const startExecution = await page.request.patch(
      `/api/initiatives/${initiativeId}/status`,
      {
        headers,
        data: { status: 'EXECUTING' },
      }
    );
    expect(startExecution.ok()).toBeTruthy();
  });
});
