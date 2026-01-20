/**
 * E2E Tests: Tools -> Initiatives Flow
 *
 * Validates tool gate flow and initiative generation from tools.
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

test.describe('Tools -> Initiatives Flow', () => {
  test.setTimeout(120000); // 2 minutes timeout
  
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('creates initiatives after tool approval', async ({ page, request }) => {
    test.setTimeout(120000);
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const projectsResponse = await request.get(`${API_BASE_URL}/api/projects`, { headers });
    const projectsData = await projectsResponse.json();
    const projectId = projectsData?.projects?.[0]?.id || projectsData?.[0]?.id || null;

    const toolResponse = await request.post(`${API_BASE_URL}/api/tools`, {
      headers,
      data: {
        toolType: 'dynamic-swot',
        name: 'E2E Tool Session',
        projectId,
      },
      timeout: 30000,
    });
    expect(toolResponse.ok()).toBeTruthy();
    const toolData = await toolResponse.json();
    const toolId = toolData?.id;
    expect(toolId).toBeTruthy();

    const updateResponse = await request.put(`${API_BASE_URL}/api/tools/${toolId}`, {
      headers,
      data: {
        answers: { context: { goal: 'Test', scope: 'E2E' }, items: [{ quadrant: 'strengths' }] },
        completionPercent: 100,
        confidenceAvg: 4,
        contextSnapshot: { org: {}, chat: [] },
      },
      timeout: 30000,
    });
    expect(updateResponse.ok()).toBeTruthy();

    const reviewResponse = await request.post(
      `${API_BASE_URL}/api/tools/${toolId}/request-review`,
      {
        headers,
        data: {},
        timeout: 30000,
      }
    );
    expect(reviewResponse.ok()).toBeTruthy();
    const reviewData = await reviewResponse.json();
    expect(reviewData.status).toBe('REVIEW');

    const approveResponse = await request.post(`${API_BASE_URL}/api/tools/${toolId}/approve`, {
      headers,
      data: {},
      timeout: 30000,
    });
    expect(approveResponse.ok()).toBeTruthy();
    const approveData = await approveResponse.json();
    expect(approveData.status).toBe('APPROVED');

    const generateResponse = await request.post(
      `${API_BASE_URL}/api/tools/${toolId}/generate-initiatives`,
      {
        headers,
        data: {
          methodologyId: 'impact-feasibility',
          count: 2,
          includeChatContext: false,
        },
        timeout: 30000,
      }
    );
    expect(generateResponse.ok()).toBeTruthy();
    const generateData = await generateResponse.json();
    expect(generateData.initiatives?.length).toBeGreaterThan(0);
    generateData.initiatives.forEach((initiative: { status: string }) => {
      expect(initiative.status).toBe('DRAFT');
    });
  });
});
