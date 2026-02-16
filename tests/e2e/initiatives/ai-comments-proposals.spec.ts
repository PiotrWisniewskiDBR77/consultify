/**
 * E2E: Initiatives — Comments AI proposals modal
 *
 * Goal:
 * - "Analyze with AI" in Comments shows spinner while pending
 * - Modal opens even if AI returns no add/remove suggestions (table + note)
 */

import { expect, Page, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

async function dismissTourModal(page: Page) {
  const skipTour = page.getByText(/Skip tour/i);
  const consultantCard = page.getByText(/^Consultant$/i);
  for (let i = 0; i < 5; i++) {
    const visible = await skipTour.isVisible().catch(() => false);
    if (visible) {
      await skipTour.click({ timeout: 2000, force: true }).catch(() => {});
      await consultantCard.click({ timeout: 1000, force: true }).catch(() => {});
      await page.waitForTimeout(150);
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (!(await skipTour.isVisible().catch(() => false))) return;
    await page.waitForTimeout(200);
  }
}

async function login(page: Page): Promise<{ token: string; userId: string }> {
  const response = await page.request.post(`${API_BASE_URL}/api/auth/demo-login`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const userId = String(data?.user?.id || '');
  if (!userId) throw new Error('Demo login missing user id');

  await page.addInitScript(
    ({ token, refreshToken }) => {
      localStorage.setItem('token', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      sessionStorage.setItem('isDemo', 'true');
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
    data: {
      name: `E2E Project ${Date.now()}`,
      description: 'E2E seed project (created by test)',
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  const createdId = created?.id || created?.project?.id || created?.data?.id;
  if (!createdId) throw new Error('Failed to create project');
  return createdId;
}

test.describe('Initiatives — Comments AI proposals', () => {
  test.setTimeout(90000);

  test('Comments CTA shows spinner and opens proposals modal (even empty)', async ({ page }) => {
    const { token, userId } = await login(page);
    const projectId = await getFirstProjectId(page, token);
    const headers = { Authorization: `Bearer ${token}` };

    // Ensure user can edit in this project context so AI CTA is enabled.
    await page.request
      .post(`${API_BASE_URL}/api/projects/${projectId}/members`, {
        headers,
        data: { userId, projectRole: 'PROJECT_MANAGER', allocationPercent: 100 },
      })
      .catch(() => {});

    const createRes = await page.request.post(`${API_BASE_URL}/api/initiatives`, {
      headers,
      data: {
        title: `E2E AI Comments ${Date.now()}`,
        summary: 'E2E: verify Comments AI proposals modal',
        status: 'PLANNING',
        projectId,
        sourceType: 'manual',
        axis: 'operational',
        priority: 'high',
        ownerId: userId,
        sponsorId: userId,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    const initiativeId = created?.id;
    expect(initiativeId).toBeTruthy();

    await page.goto(`/initiatives?open=${initiativeId}&mode=doc`);
    await dismissTourModal(page);

    // Switch to Comments section in left nav (supports EN/PL label)
    await page.getByRole('button', { name: /Comments|Komentarze/i }).click();

    // Intercept refine-text call and delay response for spinner observability.
    await page.route('**/api/ai/refine-text**', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          text: JSON.stringify({ add: [], remove: [], note: 'No change suggestions.' }),
        }),
      });
    });

    const cta = page.getByRole('button', { name: /Analyze with AI|Analizuj z AI/i }).first();
    await expect(cta).toBeEnabled();

    await cta.click();

    // While pending: disabled + spinner svg
    await expect(cta).toBeDisabled();
    await expect(cta.locator('svg.animate-spin')).toBeVisible();

    // Modal should open after fulfillment
    await expect(
      page.getByText(/Proposed comment changes \(AI\)|Propozycje zmian w komentarzach \(AI\)/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
