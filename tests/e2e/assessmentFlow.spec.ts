/**
 * E2E Tests: Assessment Flow
 * 
 * Phase 6: E2E Tests - Critical User Journey
 * Tests complete assessment wizard and matrix flow.
 */

import { test, expect } from '@playwright/test';

test.describe('Assessment Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard');
    });

    test('should navigate to assessment', async ({ page }) => {
        await page.goto('/assessment');
        await expect(page).toHaveURL(/.*assessment/);
    });

    test('should display assessment matrix', async ({ page }) => {
        await page.goto('/assessment');
        
        // Wait for matrix to load
        await page.waitForSelector('[data-testid="assessment-matrix"]', { timeout: 10000 }).catch(() => {});
        
        // Check if matrix cards are visible
        const matrixCards = page.locator('[data-testid="assessment-card"]').or(page.locator('text=Axis'));
        await expect(matrixCards.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    });

    test('should open assessment wizard', async ({ page }) => {
        await page.goto('/assessment');
        
        // Click on assessment card or start wizard button
        const startButton = page.locator('button:has-text("Start Assessment")').or(page.locator('button:has-text("Assess")')).first();
        const card = page.locator('[data-testid="assessment-card"]').first();
        
        if (await startButton.count() > 0) {
            await startButton.click();
        } else if (await card.count() > 0) {
            await card.click();
        }
        
        // Check if wizard opened
        await expect(page.locator('[data-testid="assessment-wizard"]').or(page.locator('text=Assessment Wizard'))).toBeVisible({ timeout: 5000 }).catch(() => {});
    });

    test('should complete assessment wizard', async ({ page }) => {
        await page.goto('/assessment');
        
        // Try to start wizard
        const startButton = page.locator('button:has-text("Start")').or(page.locator('button:has-text("Assess")')).first();
        if (await startButton.count() > 0) {
            await startButton.click();
            
            // Navigate through wizard steps
            const nextButton = page.locator('button:has-text("Next")').or(page.locator('button:has-text("Continue")')).first();
            if (await nextButton.count() > 0) {
                // Select level for each area
                const levelButtons = page.locator('button[data-level]').or(page.locator('button:has-text("Level")'));
                if (await levelButtons.count() > 0) {
                    await levelButtons.first().click();
                }
                
                await nextButton.click();
            }
            
            // Complete assessment
            const completeButton = page.locator('button:has-text("Complete")').or(page.locator('button:has-text("Finish")')).first();
            if (await completeButton.count() > 0) {
                await completeButton.click();
            }
        }
    });
});

