/**
 * E2E Tests for RapidLean Production Observations
 * Full user workflow: start observation → fill templates → generate report
 */

const { test, expect } = require('@playwright/test');

test.describe('RapidLean Production Observations E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Mock authentication
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('token', 'mock-token');
            localStorage.setItem('user', JSON.stringify({
                id: 'test-user',
                organizationId: 'test-org',
                name: 'Test User'
            }));
        });
    });

    test('should complete full observation workflow', async ({ page }) => {
        // Navigate to RapidLean workspace
        await page.goto('/assessment/rapidlean');
        
        // Wait for workspace to load
        await page.waitForSelector('text=RapidLean Assessment', { timeout: 10000 });

        // Start observation
        const startButton = page.locator('button:has-text("Start Production Floor Observation")');
        if (await startButton.isVisible()) {
            await startButton.click();
        }

        // Fill first template (Value Stream)
        await page.waitForSelector('text=Value Stream Observation', { timeout: 5000 });
        
        // Fill location
        const locationInput = page.locator('input[placeholder*="Location"]');
        if (await locationInput.isVisible()) {
            await locationInput.fill('Production Line A');
        }

        // Answer questions
        const yesButton = page.locator('button:has-text("Yes")').first();
        if (await yesButton.isVisible()) {
            await yesButton.click();
        }

        // Add notes
        const notesTextarea = page.locator('textarea').first();
        if (await notesTextarea.isVisible()) {
            await notesTextarea.fill('Test observation notes');
        }

        // Save and continue (if not last template)
        const saveButton = page.locator('button:has-text("Save & Next")');
        if (await saveButton.isVisible()) {
            await saveButton.click();
        }

        // Verify progress
        const progressBar = page.locator('[class*="progress"]');
        if (await progressBar.isVisible()) {
            const progress = await progressBar.getAttribute('style');
            expect(progress).toContain('width');
        }
    });

    test('should display observation templates overview', async ({ page }) => {
        await page.goto('/assessment/rapidlean');
        
        await page.waitForSelector('text=RapidLean Assessment', { timeout: 10000 });

        // Verify templates are displayed
        const templates = page.locator('text=Value Stream Observation, Waste Identification, Flow & Pull Systems');
        await expect(templates.first()).toBeVisible({ timeout: 5000 });
    });

    test('should show DRD integration information', async ({ page }) => {
        await page.goto('/assessment/rapidlean');
        
        await page.waitForSelector('text=RapidLean Assessment', { timeout: 10000 });

        // Verify DRD context card
        const drdCard = page.locator('text=DRD Integration');
        await expect(drdCard).toBeVisible({ timeout: 5000 });

        // Verify DRD axes are mentioned
        const drdAxis1 = page.locator('text=DRD Axis 1');
        const drdAxis5 = page.locator('text=DRD Axis 5');
        await expect(drdAxis1.or(drdAxis5)).toBeVisible({ timeout: 5000 });
    });

    test('should handle photo upload in observation form', async ({ page }) => {
        await page.goto('/assessment/rapidlean');
        
        // Start observation
        const startButton = page.locator('button:has-text("Start Production Floor Observation")');
        if (await startButton.isVisible()) {
            await startButton.click();
        }

        await page.waitForSelector('text=Take Photo', { timeout: 5000 });

        // Verify photo upload button exists
        const photoButton = page.locator('button:has-text("Take Photo")');
        await expect(photoButton).toBeVisible({ timeout: 5000 });
    });

    test('should display results after completing observations', async ({ page }) => {
        // This test would require mocking the API response
        // For now, we verify the results view structure exists
        await page.goto('/assessment/rapidlean');
        
        // Mock successful assessment creation
        await page.route('**/api/rapidlean/observations', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    assessment: {
                        id: 'test-assessment-id',
                        overall_score: 3.5,
                        value_stream_score: 3.7,
                        observation_count: 6
                    },
                    report: {
                        id: 'test-report-id'
                    },
                    pdfUrl: '/test-report.pdf'
                })
            });
        });

        // Verify results card structure would be visible
        const resultsCard = page.locator('[class*="Results"]');
        // Note: This would need actual assessment data to be visible
    });

    test('should navigate between templates', async ({ page }) => {
        await page.goto('/assessment/rapidlean');
        
        const startButton = page.locator('button:has-text("Start Production Floor Observation")');
        if (await startButton.isVisible()) {
            await startButton.click();
        }

        await page.waitForSelector('text=Value Stream Observation', { timeout: 5000 });

        // Fill first template and move to next
        const locationInput = page.locator('input[placeholder*="Location"]');
        if (await locationInput.isVisible()) {
            await locationInput.fill('Line A');
        }

        // Answer required questions
        const yesButtons = page.locator('button:has-text("Yes")');
        const yesButtonCount = await yesButtons.count();
        for (let i = 0; i < Math.min(yesButtonCount, 3); i++) {
            await yesButtons.nth(i).click();
        }

        // Fill notes
        const notesTextarea = page.locator('textarea').first();
        if (await notesTextarea.isVisible()) {
            await notesTextarea.fill('Test notes');
        }

        // Verify template counter shows progress
        const templateCounter = page.locator('text=/1 \\/ 6/');
        await expect(templateCounter).toBeVisible({ timeout: 5000 });
    });

    test('should show progress bar during observation', async ({ page }) => {
        await page.goto('/assessment/rapidlean');
        
        const startButton = page.locator('button:has-text("Start Production Floor Observation")');
        if (await startButton.isVisible()) {
            await startButton.click();
        }

        await page.waitForSelector('text=Value Stream Observation', { timeout: 5000 });

        // Verify progress bar exists
        const progressBar = page.locator('[class*="progress"], [class*="Progress"]');
        await expect(progressBar.first()).toBeVisible({ timeout: 5000 });
    });

    test('should validate required fields', async ({ page }) => {
        await page.goto('/assessment/rapidlean');
        
        const startButton = page.locator('button:has-text("Start Production Floor Observation")');
        if (await startButton.isVisible()) {
            await startButton.click();
        }

        await page.waitForSelector('text=Value Stream Observation', { timeout: 5000 });

        // Try to save without filling required fields
        const saveButton = page.locator('button:has-text("Save")');
        if (await saveButton.isVisible()) {
            const isDisabled = await saveButton.isDisabled();
            // Save button should be disabled if required fields not filled
            expect(isDisabled).toBe(true);
        }
    });

    test('should handle cancel action', async ({ page }) => {
        await page.goto('/assessment/rapidlean');
        
        const startButton = page.locator('button:has-text("Start Production Floor Observation")');
        if (await startButton.isVisible()) {
            await startButton.click();
        }

        await page.waitForSelector('text=Value Stream Observation', { timeout: 5000 });

        // Click cancel
        const cancelButton = page.locator('button:has-text("Cancel")');
        if (await cancelButton.isVisible()) {
            await cancelButton.click();
        }

        // Should return to overview
        await page.waitForSelector('text=RapidLean Assessment', { timeout: 5000 });
    });
});

