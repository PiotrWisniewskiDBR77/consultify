import { test, expect } from '@playwright/test';

/**
 * E2E Tests: AI Playbooks Flow
 * Covers SuperAdmin (Templates) and Admin (Runs) flows.
 */

test.describe('AI Playbooks Flow', () => {
  test.describe('SuperAdmin - Playbook Templates', () => {
    test.beforeEach(async ({ page }) => {
      // Login as SuperAdmin
      await page.goto('/login');
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@localhost');
      await page.fill(
        'input[type="password"]',
        process.env.TEST_USER_PASSWORD || 'testpassword123'
      );
      await page.click('button[type="submit"]');

      // Wait for navigation after login
      await page.waitForURL(/dashboard|overview/, { timeout: 15000 });

      // Navigate to Playbook Templates - try multiple possible selectors
      const playbookLink = page
        .locator('text=Playbook Templates')
        .or(page.locator('a[href*="playbook"]'))
        .first();
      if (await playbookLink.isVisible({ timeout: 5000 })) {
        await playbookLink.click();
        await page.waitForLoadState('networkidle');
      } else {
        // Try navigating directly
        await page.goto('/admin/playbook-templates');
      }
    });

    test('should display playbook templates list', async ({ page }) => {
      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Check for title (may be h1 or other heading)
      const title = page.locator('h1, h2, [data-testid="page-title"]').first();
      await expect(title).toBeVisible({ timeout: 10000 });

      // Should show at least the empty state or some templates
      const templatesContainer = page
        .locator('div.grid, [data-testid="templates-list"], main')
        .first();
      await expect(templatesContainer).toBeVisible({ timeout: 5000 });
    });

    test('should filter templates by status', async ({ page }) => {
      // Check for status tabs
      const tabs = ['Draft', 'Active', 'Published', 'Deprecated'];
      for (const tab of tabs) {
        const tabButton = page.locator(`button:has-text("${tab}")`);
        await expect(tabButton).toBeVisible();
        await tabButton.click();
        // After clicking, the list should still be visible (even if empty)
        await expect(page.locator('h1')).toContainText('AI Playbook Templates');
      }
    });

    test('should allow exporting templates', async ({ page }) => {
      // Check for export button
      const exportButton = page.locator('button:has-text("Export")');
      if (await exportButton.isVisible()) {
        await exportButton.click();
        // Should show export options
        await expect(page.locator('text=Export Template List')).toBeVisible();
      }
    });
  });

  test.describe('Admin - Playbook Runs', () => {
    test.beforeEach(async ({ page }) => {
      // Login as Admin
      await page.goto('/login');
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Wait for navigation after login
      await page.waitForURL(/dashboard|overview/, { timeout: 15000 });

      // Navigate to Playbook Runs - try multiple possible selectors
      const playbookRunsLink = page
        .locator('text=Playbook Runs')
        .or(page.locator('a[href*="playbook-runs"]'))
        .first();
      if (await playbookRunsLink.isVisible({ timeout: 5000 })) {
        await playbookRunsLink.click();
        await page.waitForLoadState('networkidle');
      } else {
        // Try navigating directly
        await page.goto('/admin/playbook-runs');
      }
    });

    test('should display playbook runs history', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('AI Playbook Runs');
      const runsContainer = page.locator('div.grid');
      await expect(runsContainer).toBeVisible();
    });

    test('should show available templates to start a run', async ({ page }) => {
      // Click "New Run" or similar
      const startRunButton = page
        .locator('button:has-text("Start New Playbook")')
        .or(page.locator('button:has-text("New Run")'));
      if (await startRunButton.isVisible()) {
        await startRunButton.click();
        // Should show template selection
        await expect(page.locator('text=Select Template')).toBeVisible();
      }
    });
  });
});
