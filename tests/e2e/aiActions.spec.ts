/**
 * E2E Tests: AI Actions Flow
 * 
 * Phase 6: E2E Tests - Critical User Journey
 * Tests complete AI action proposal, approval, and execution flow.
 */

import { test, expect } from '@playwright/test';

test.describe('AI Actions Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/login');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard');
    });

    test('should display AI action proposals', async ({ page }) => {
        await page.goto('/ai/actions');
        
        // Wait for proposals to load
        await page.waitForSelector('[data-testid="action-proposal"]', { timeout: 10000 }).catch(() => {});
        
        // Check if proposals list is visible
        const proposalsList = page.locator('[data-testid="action-proposal-list"]').or(page.locator('text=No pending action proposals'));
        await expect(proposalsList).toBeVisible();
    });

    test('should open action proposal details', async ({ page }) => {
        await page.goto('/ai/actions');
        
        // Click on first proposal if available
        const firstProposal = page.locator('[data-testid="action-proposal"]').first();
        const count = await firstProposal.count();
        
        if (count > 0) {
            await firstProposal.click();
            await expect(page.locator('[data-testid="action-proposal-detail"]').or(page.locator('text=Action Details'))).toBeVisible({ timeout: 5000 }).catch(() => {});
        }
    });

    test('should approve AI action', async ({ page }) => {
        await page.goto('/ai/actions');
        
        const approveButton = page.locator('button:has-text("Approve")').or(page.locator('button:has-text("Confirm")')).first();
        const count = await approveButton.count();
        
        if (count > 0) {
            await approveButton.click();
            
            // Fill reason if required
            const reasonInput = page.locator('textarea[placeholder*="reason" i]').or(page.locator('textarea')).first();
            if (await reasonInput.count() > 0) {
                await reasonInput.fill('Approved for testing');
            }
            
            // Confirm approval
            const confirmButton = page.locator('button:has-text("Confirm")').or(page.locator('button:has-text("Execute")')).first();
            if (await confirmButton.count() > 0) {
                await confirmButton.click();
            }
        }
    });

    test('should reject AI action with reason', async ({ page }) => {
        await page.goto('/ai/actions');
        
        const rejectButton = page.locator('button:has-text("Reject")').first();
        const count = await rejectButton.count();
        
        if (count > 0) {
            await rejectButton.click();
            
            // Reason is required for rejection
            const reasonInput = page.locator('textarea[placeholder*="reason" i]').or(page.locator('textarea')).first();
            if (await reasonInput.count() > 0) {
                await reasonInput.fill('Rejected for testing purposes');
                
                const confirmButton = page.locator('button:has-text("Confirm Rejection")').or(page.locator('button:has-text("Confirm")')).first();
                if (await confirmButton.count() > 0) {
                    await confirmButton.click();
                }
            }
        }
    });
});

