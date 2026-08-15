import { test, expect } from '@playwright/test';

import { seedE2EAuthWithBootstrap } from './smoke/runtime-gate-helpers';

// SAFETY (2026-07-13): This spec used to log in through the UI with a hard-coded
// REAL account (piotr.wisniewski@dbr77.com / 123456), so the "create project"
// flow wrote real projects into the real DBR77 org. It now seeds the isolated
// E2E test-support tenant (seedE2EAuthWithBootstrap) — an ADMIN token minted for
// a throwaway org — so it never authenticates as, or writes into, a real account.
test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Isolated E2E tenant (test-support bootstrap) — never the real DBR77 account.
    await seedE2EAuthWithBootstrap(page);
    await page.goto('/');
    await expect(page.locator('h1:has-text("Admin Panel")')).toBeVisible();
  });

  test('should create a new project', async ({ page }) => {
    // Navigate to projects (Admin Panel -> Projects)
    // Admin Panel might be auto-expanded
    await page.hover('div.fixed.z-50');
    await page.waitForTimeout(500);
    // Ensure expansion
    try {
      await page.waitForSelector('text="CONSULTINITY"', { timeout: 2000 });
    } catch {
      /* ignore */
    }

    if (!(await page.isVisible('nav >> text="Projects"'))) {
      await page.click('nav >> text="Admin Panel"');
      await page.waitForTimeout(300);
    }
    await page.waitForSelector('nav >> text="Projects"');
    await page.click('nav >> text="Projects"');

    // Open "New Project" modal/form
    await page.click('text=New Project');

    // Fill modal/form
    const testProjectName = `E2E Test Project ${Date.now()}`;
    await page.fill('input[placeholder="Enter project name..."]', testProjectName);

    // Select status or other required fields if any (assuming defaults work or simple inputs)
    // await page.selectOption('select[name="status"]', 'Planning');

    // Submit
    await page.click('button:has-text("Create"), button:has-text("Save")');

    // Verify it appears in the list
    await expect(page.locator(`text = ${testProjectName} `)).toBeVisible();
  });
});
