/**
 * E2E Tests for Assessment Module (Playwright)
 * Tests complete user flows through assessment creation and viewing
 */

const { test, expect } = require('@playwright/test');

test.describe('Assessment Module E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('http://localhost:3003/login');
        await page.fill('[name="email"]', 'test@example.com');
        await page.fill('[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard');
    });

    test('should navigate to Assessment Hub', async ({ page }) => {
        // Click Assessment in sidebar
        await page.click('[data-testid="assessment-menu"]');

        // Click Assessment Hub
        await page.click('[data-testid="assessment-hub"]');

        // Verify hub is loaded
        await expect(page.locator('h1')).toContainText('Assessment Hub');
        await expect(page.locator('[data-testid="overall-readiness"]')).toBeVisible();
    });

    test('should complete RapidLean assessment', async ({ page }) => {
        // Navigate to RapidLean
        await page.goto('http://localhost:3003/assessments/rapidlean');

        // Start assessment
        await page.click('button:has-text("Start Assessment")');

        // Answer first question
        await page.click('[data-value="4"]'); // Select rating
        await page.click('button:has-text("Next")');

        // Verify progress
        await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();

        // Fast-forward: answer remaining questions
        for (let i = 0; i < 17; i++) {
            await page.click('[data-value="3"]');
            await page.click('button:has-text("Next")');
            await page.waitForTimeout(100);
        }

        // Complete assessment
        await page.click('button:has-text("Complete Assessment")');

        // Verify results page
        await expect(page.locator('h2')).toContainText('RapidLean Results');
        await expect(page.locator('[data-testid="overall-score"]')).toBeVisible();
    });

    test('should upload external assessment', async ({ page }) => {
        // Navigate to External Digital
        await page.goto('http://localhost:3003/assessments/external');

        // Select framework
        await page.click('[data-framework="SIRI"]');

        // Fill metadata
        await page.fill('[name="frameworkVersion"]', 'SIRI 2.0');
        await page.fill('[name="assessmentDate"]', '2024-01-15');

        // Upload file (mock)
        const fileInput = await page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'siri-assessment.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('mock pdf content')
        });

        // Verify upload success
        await expect(page.locator('.success-message')).toContainText('uploaded');
    });

    test('should upload generic report', async ({ page }) => {
        // Navigate to Generic Reports
        await page.goto('http://localhost:3003/assessments/reports');

        // Fill form
        await page.fill('[name="title"]', 'ISO 9001 Audit Report');
        await page.selectOption('[name="reportType"]', 'ISO_AUDIT');

        // Upload file
        const fileInput = await page.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'iso-audit.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('mock pdf content')
        });

        // Verify in list
        await expect(page.locator('.report-list')).toContainText('ISO 9001 Audit Report');
    });

    test('should display assessment overview correctly', async ({ page }) => {
        // Navigate to Assessment Hub
        await page.goto('http://localhost:3003/assessments/hub');

        // Verify module cards
        await expect(page.locator('[data-module="drd"]')).toBeVisible();
        await expect(page.locator('[data-module="rapidLean"]')).toBeVisible();
        await expect(page.locator('[data-module="external"]')).toBeVisible();
        await expect(page.locator('[data-module="reports"]')).toBeVisible();

        // Verify quick actions
        await expect(page.locator('button:has-text("Start RapidLean")')).toBeVisible();
    });
});
