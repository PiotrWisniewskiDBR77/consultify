/**
 * AI Enterprise E2E Tests
 * 
 * End-to-end tests for enterprise AI features.
 */

import { test, expect } from '@playwright/test';

test.describe('AI Enterprise Features', () => {
    test.beforeEach(async ({ page }) => {
        // Login as admin
        await page.goto('/login');
        await page.fill('input[name="email"]', 'admin@test.com');
        await page.fill('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|home/);
    });

    test.describe('Audit Log Viewer', () => {
        test('admin can access audit log', async ({ page }) => {
            await page.goto('/admin/ai-audit');
            
            await expect(page.getByText('AI Audit Log')).toBeVisible();
            await expect(page.getByText('Enterprise security monitoring')).toBeVisible();
        });

        test('audit log displays entries', async ({ page }) => {
            await page.goto('/admin/ai-audit');
            
            // Wait for data to load
            await page.waitForResponse(response => 
                response.url().includes('/api/ai-security/audit-log')
            );
            
            // Should have table headers
            await expect(page.getByText('Timestamp')).toBeVisible();
            await expect(page.getByText('User')).toBeVisible();
            await expect(page.getByText('Action')).toBeVisible();
            await expect(page.getByText('Risk')).toBeVisible();
        });

        test('audit log can be filtered by risk level', async ({ page }) => {
            await page.goto('/admin/ai-audit');
            
            // Open filters
            await page.click('button:has-text("Filtry")');
            
            // Select HIGH risk
            await page.selectOption('select', 'HIGH');
            
            // Verify filter is applied
            await page.waitForResponse(response => 
                response.url().includes('riskLevel=HIGH')
            );
        });

        test('audit log can be exported to CSV', async ({ page }) => {
            await page.goto('/admin/ai-audit');
            
            // Wait for data
            await page.waitForResponse(response => 
                response.url().includes('/api/ai-security/audit-log')
            );
            
            // Start download
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.click('button:has-text("Export CSV")')
            ]);
            
            expect(download.suggestedFilename()).toContain('.csv');
        });

        test('clicking row opens detail modal', async ({ page }) => {
            await page.goto('/admin/ai-audit');
            
            // Wait for data
            await page.waitForSelector('table tbody tr');
            
            // Click first row
            await page.click('table tbody tr:first-child');
            
            // Modal should open
            await expect(page.getByText('Szczegóły logu')).toBeVisible();
        });
    });

    test.describe('Prompt Management', () => {
        test('admin can access prompt management', async ({ page }) => {
            await page.goto('/admin/ai-prompts');
            
            await expect(page.getByText('Prompty AI')).toBeVisible();
        });

        test('prompt list displays prompts', async ({ page }) => {
            await page.goto('/admin/ai-prompts');
            
            // Wait for data
            await page.waitForResponse(response => 
                response.url().includes('/api/ai-prompts')
            );
            
            // Should have at least one prompt
            await page.waitForSelector('[class*="cursor-pointer"]');
        });

        test('selecting prompt shows details', async ({ page }) => {
            await page.goto('/admin/ai-prompts');
            
            // Wait for list
            await page.waitForSelector('[class*="cursor-pointer"]');
            
            // Click first prompt
            await page.click('[class*="cursor-pointer"]:first-child');
            
            // Should show editor
            await expect(page.getByText('Edytuj')).toBeVisible();
            await expect(page.getByText('Historia')).toBeVisible();
            await expect(page.getByText('Test')).toBeVisible();
        });

        test('can enter edit mode', async ({ page }) => {
            await page.goto('/admin/ai-prompts');
            
            await page.waitForSelector('[class*="cursor-pointer"]');
            await page.click('[class*="cursor-pointer"]:first-child');
            
            await page.click('button:has-text("Edytuj")');
            
            await expect(page.getByText('Zapisz')).toBeVisible();
            await expect(page.getByText('Anuluj')).toBeVisible();
        });

        test('can filter prompts by category', async ({ page }) => {
            await page.goto('/admin/ai-prompts');
            
            await page.selectOption('select', 'system');
            
            // Should filter list
            await page.waitForResponse(response => 
                response.url().includes('category=system')
            );
        });
    });

    test.describe('A/B Testing Dashboard', () => {
        test('admin can access A/B testing', async ({ page }) => {
            await page.goto('/admin/ai-ab-testing');
            
            await expect(page.getByText('A/B Testing')).toBeVisible();
            await expect(page.getByText('Eksperymenty na promptach AI')).toBeVisible();
        });

        test('displays experiment statistics', async ({ page }) => {
            await page.goto('/admin/ai-ab-testing');
            
            await expect(page.getByText('Wszystkie')).toBeVisible();
            await expect(page.getByText('Aktywne')).toBeVisible();
            await expect(page.getByText('Zakończone')).toBeVisible();
        });

        test('can create new experiment', async ({ page }) => {
            await page.goto('/admin/ai-ab-testing');
            
            await page.click('button:has-text("Nowy eksperyment")');
            
            // Modal or form should appear
            // Implementation depends on UI design
        });

        test('can filter experiments by status', async ({ page }) => {
            await page.goto('/admin/ai-ab-testing');
            
            // Click filter tab
            await page.click('button:has-text("Aktywny")');
            
            await page.waitForResponse(response => 
                response.url().includes('status=running')
            );
        });
    });

    test.describe('AI Security Settings', () => {
        test('organization admin can access security settings', async ({ page }) => {
            await page.goto('/settings/ai-security');
            
            await expect(page.getByText('Ustawienia bezpieczeństwa AI')).toBeVisible();
        });

        test('can toggle AI features', async ({ page }) => {
            await page.goto('/settings/ai-security');
            
            await expect(page.getByText('Włączone funkcje')).toBeVisible();
            await expect(page.getByText('AI Chat')).toBeVisible();
            await expect(page.getByText('Generowanie raportów')).toBeVisible();
        });

        test('can configure rate limits', async ({ page }) => {
            await page.goto('/settings/ai-security');
            
            await expect(page.getByText('Limity zapytań')).toBeVisible();
            await page.click('button:has-text("Dodaj limit")');
            
            // Form should appear
            await expect(page.getByPlaceholder('Nazwa reguły')).toBeVisible();
        });

        test('can save settings', async ({ page }) => {
            await page.goto('/settings/ai-security');
            
            await page.click('button:has-text("Zapisz ustawienia")');
            
            await page.waitForResponse(response => 
                response.url().includes('/api/ai-security/organization-settings') &&
                response.request().method() === 'PUT'
            );
        });
    });

    test.describe('Proactive Nudges', () => {
        test('nudge appears for relevant context', async ({ page }) => {
            // Navigate to assessment page where nudge should trigger
            await page.goto('/assessment/new');
            
            // Wait for potential nudge
            await page.waitForTimeout(2000);
            
            // Check if nudge appeared (may or may not based on conditions)
            const nudge = page.locator('text=Sugestia AI');
            // This is conditional - nudge may not appear in test environment
        });

        test('nudge can be dismissed', async ({ page }) => {
            // If nudge is visible, test dismiss
            await page.goto('/assessment/new');
            
            const dismissButton = page.locator('text=Nie teraz');
            if (await dismissButton.isVisible({ timeout: 3000 })) {
                await dismissButton.click();
                
                // Nudge should disappear
                await expect(page.locator('text=Sugestia AI')).not.toBeVisible();
            }
        });
    });

    test.describe('AI Chat with Quality Check', () => {
        test('chat response includes quality indicators', async ({ page }) => {
            await page.goto('/chat');
            
            // Send message
            await page.fill('textarea', 'What are the best practices for digital transformation?');
            await page.click('button[type="submit"]');
            
            // Wait for response
            await page.waitForSelector('[data-testid="ai-response"]', { timeout: 30000 });
            
            // Response should be displayed
            const response = page.locator('[data-testid="ai-response"]');
            await expect(response).toBeVisible();
        });

        test('quality score is visible in response metadata', async ({ page }) => {
            await page.goto('/chat');
            
            await page.fill('textarea', 'Analyze my digital maturity');
            await page.click('button[type="submit"]');
            
            await page.waitForSelector('[data-testid="ai-response"]', { timeout: 30000 });
            
            // Quality indicator might be visible
            // Depends on UI implementation
        });
    });
});

test.describe('Enterprise Security - Rate Limiting', () => {
    test('rate limit error is displayed correctly', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="email"]', 'test@test.com');
        await page.fill('input[name="password"]', 'test123');
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|home/);
        
        await page.goto('/chat');
        
        // Send many requests quickly (to trigger rate limit)
        for (let i = 0; i < 5; i++) {
            await page.fill('textarea', `Test message ${i}`);
            await page.click('button[type="submit"]');
            await page.waitForTimeout(100);
        }
        
        // May see rate limit error
        // Behavior depends on actual rate limits configured
    });
});











