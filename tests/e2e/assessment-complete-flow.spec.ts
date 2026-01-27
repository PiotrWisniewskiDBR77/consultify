import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Assessment Complete Flow
 *
 * Tests the full assessment lifecycle:
 * 1. Create new assessment (select framework)
 * 2. Fill assessment form
 * 3. Request review
 * 4. Generate report
 * 5. Approve report
 * 6. Approve assessment
 * 7. Generate initiatives
 */

test.describe('Assessment Complete Flow', () => {
  test.setTimeout(180000); // 3 minutes for complete flow

  let assessmentId: string;
  let assessmentName: string;

  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill login form
    const emailInput = page.locator('input[type="email"], input[name="email"], [data-testid="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"], [data-testid="password"]');

    if (await emailInput.isVisible()) {
      await emailInput.fill('admin@testenterprise.com');
      await passwordInput.fill('AdminPass123!');

      const loginButton = page.locator('button[type="submit"], [data-testid="login-button"]');
      await loginButton.click();

      // Wait for dashboard
      await page.waitForURL(/\/(dashboard|home|app)/);
    }
  });

  test('Step 1: Create new DRD assessment', async ({ page }) => {
    // Navigate to Assessment module
    await page.goto('/assessment');
    await page.waitForLoadState('networkidle');

    // Click "New Assessment" button
    const newButton = page.locator('button:has-text("New Assessment"), [data-testid="new-assessment"]');
    await newButton.click();

    // Wait for modal
    await expect(page.locator('[role="dialog"], .modal, [data-testid="new-assessment-modal"]')).toBeVisible();

    // Select DRD framework
    const drdButton = page.locator('button:has-text("DRD"), [data-testid="framework-drd"]');
    await drdButton.click();

    // Fill assessment name
    assessmentName = `E2E Test Assessment - ${Date.now()}`;
    const nameInput = page.locator('input[id="assessment-name"], [data-testid="assessment-name"]');
    await nameInput.fill(assessmentName);

    // Submit
    const createButton = page.locator('button:has-text("Create Assessment"), [data-testid="create-assessment"]');
    await createButton.click();

    // Wait for success
    await expect(page.locator('.toast-success, [data-testid="toast-success"]')).toBeVisible({ timeout: 10000 });

    // Verify assessment was created
    await expect(page.locator(`text=${assessmentName}`)).toBeVisible({ timeout: 10000 });
  });

  test('Step 2: Fill assessment form (DRD Axis 1)', async ({ page }) => {
    // Navigate to assessment
    await page.goto('/assessment');
    await page.waitForLoadState('networkidle');

    // Find and click on the assessment
    const assessmentRow = page.locator(`tr:has-text("${assessmentName}"), [data-testid="assessment-row"]`).first();
    if (await assessmentRow.isVisible()) {
      await assessmentRow.click();
    }

    // Wait for form to load
    await page.waitForLoadState('networkidle');

    // Fill first axis (Processes) - select level 3 for first area
    const levelButton = page.locator('button:has-text("3")').first();
    if (await levelButton.isVisible()) {
      await levelButton.click();
    }

    // Save changes
    const saveButton = page.locator('button:has-text("Save"), [data-testid="save-assessment"]');
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Step 3: Request review', async ({ page, request }) => {
    // Use API to request review (faster than UI)
    const response = await request.post(`/api/assessment-workflow/${assessmentId}/request-review`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    // If API fails, try UI
    if (!response.ok()) {
      await page.goto('/assessment');
      await page.waitForLoadState('networkidle');

      // Find assessment and click actions menu
      const actionsButton = page.locator('[data-testid="actions-menu"]').first();
      if (await actionsButton.isVisible()) {
        await actionsButton.click();
        const requestReviewOption = page.locator('button:has-text("Request Review")');
        await requestReviewOption.click();
      }
    }
  });

  test('Step 4: Generate report', async ({ page, request }) => {
    // Use API to generate report
    const response = await request.post(`/api/assessment-workflow/${assessmentId}/report`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('Step 5: Approve report', async ({ page, request }) => {
    // Use API to approve report
    const response = await request.post(`/api/assessment-workflow/${assessmentId}/report/approve`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('Step 6: Approve assessment', async ({ page, request }) => {
    // Use API to approve assessment
    const response = await request.post(`/api/assessment-workflow/${assessmentId}/approve`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('Step 7: Generate initiatives', async ({ page, request }) => {
    // Use API to generate initiatives
    const response = await request.post(`/api/assessment-workflow/${assessmentId}/generate-initiatives`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      data: {
        methodology: 'impact-feasibility',
        count: 5,
        includeChatContext: false,
      },
    });

    expect(response.ok()).toBeTruthy();

    // Verify initiatives were created
    const initiativesResponse = await request.get(
      `/api/assessment-workflow/${assessmentId}/generated-initiatives`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
      }
    );

    expect(initiativesResponse.ok()).toBeTruthy();
    const data = await initiativesResponse.json();
    expect(data.initiatives).toBeDefined();
    expect(data.initiatives.length).toBeGreaterThan(0);
  });
});

/**
 * API Integration Tests for Assessment Workflow
 */
test.describe('Assessment API Integration', () => {
  test.setTimeout(60000);

  let assessmentId: string;

  test('Create assessment via API', async ({ request }) => {
    const response = await request.post('/api/assessment-workflow', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      data: {
        assessmentType: 'DRD',
        name: `API Test Assessment - ${Date.now()}`,
        description: 'Created via E2E API test',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.id).toBeDefined();
    assessmentId = data.id;
  });

  test('Get assessment details', async ({ request }) => {
    const response = await request.get(`/api/assessment-workflow/${assessmentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('DRAFT');
    expect(data.assessmentType).toBe('DRD');
  });

  test('Update assessment data', async ({ request }) => {
    const response = await request.put(`/api/assessment-workflow/${assessmentId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      data: {
        axisData: {
          processes: {
            actual: 3,
            target: 5,
            areaScores: {
              '1A': [3, 5],
              '1B': [2, 4],
            },
          },
        },
        completionPercent: 100,
        confidenceAvg: 4,
      },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('List user assessments', async ({ request }) => {
    const response = await request.get('/api/assessment-workflow', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.assessments)).toBeTruthy();
  });

  test('Delete assessment', async ({ request }) => {
    const response = await request.delete(`/api/assessment-workflow/${assessmentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
  });
});

/**
 * Assessment Session Tests (Dynamic Submenu)
 */
test.describe('Assessment Sessions', () => {
  test.setTimeout(30000);

  let assessmentId: string;

  test.beforeAll(async ({ request }) => {
    // Create test assessment
    const response = await request.post('/api/assessment-workflow', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
      data: {
        assessmentType: 'SIRI',
        name: `Session Test Assessment - ${Date.now()}`,
      },
    });

    const data = await response.json();
    assessmentId = data.id;
  });

  test('Open assessment session', async ({ request }) => {
    const response = await request.post(`/api/assessment-workflow/${assessmentId}/session/open`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('Get open sessions (max 6)', async ({ request }) => {
    const response = await request.get('/api/assessment-workflow/sessions', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.sessions)).toBeTruthy();
    expect(data.sessions.length).toBeLessThanOrEqual(6);
  });

  test('Close assessment session', async ({ request }) => {
    const response = await request.post(`/api/assessment-workflow/${assessmentId}/session/close`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });

    expect(response.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    // Cleanup
    await request.delete(`/api/assessment-workflow/${assessmentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
      },
    });
  });
});

/**
 * Framework-specific Tests
 */
test.describe('Framework-specific Assessments', () => {
  test.setTimeout(60000);

  const frameworks = ['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'];

  for (const framework of frameworks) {
    test(`Create ${framework} assessment`, async ({ request }) => {
      const response = await request.post('/api/assessment-workflow', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
        data: {
          assessmentType: framework,
          name: `${framework} Test - ${Date.now()}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.assessmentType).toBe(framework);

      // Cleanup
      await request.delete(`/api/assessment-workflow/${data.id}`, {
        headers: {
          Authorization: `Bearer ${process.env.TEST_AUTH_TOKEN}`,
        },
      });
    });
  }
});
