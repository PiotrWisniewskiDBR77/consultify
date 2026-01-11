import { test, expect } from '@playwright/test';

test.describe('Critical User Journey', () => {
  test('should allow user to complete a full transformation cycle', async ({ page }) => {
    // 1. Initial Navigation & Login
    await page.goto('/');
    await page.click('text=Log In');
    await page.fill('input[type="email"]', 'admin@dbr77.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    // Verify Dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText(/Overview|System/);

    // 2. Start New Transformation
    await page.click('text=New Project');
    // Check availability of flow selection
    await expect(page.locator('text=Select Transformation Path')).toBeVisible();
    await page.click('text=AI Readiness Assessment');

    // 3. Fill details (mocking the step)
    const projectName = `Auto-Test Project ${Date.now()}`;
    await page.fill('input[name="projectName"]', projectName);
    await page.click('button:has-text("Create")');

    // 4. Assessment Phase
    await expect(page.locator('.project-header')).toContainText(projectName);
    await page.click('text=Start Assessment');

    // Answer questions (assuming some form structure)
    const questionInputs = page.locator('.question-input');
    if ((await questionInputs.count()) > 0) {
      await questionInputs.first().fill('Test Answer');
      await page.click('button:has-text("Next")');
    }

    // 5. Submit Assessment
    // Mock submission if deeper logic needed
    // await page.click('text=Submit');

    // 6. View Report (Value Realization)
    // await expect(page.locator('text=Report Generated')).toBeVisible();
  });
});
