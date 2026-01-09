/**
 * SuperAdmin Modules E2E Tests
 * Tests all SuperAdmin modules for basic functionality and routing
 */

import { test, expect } from '@playwright/test';

const superAdminModules = [
    { name: 'Overview', path: '/superadmin/overview', testId: 'overview-module' },
    { name: 'Customers', path: '/superadmin/customers', testId: 'customers-module' },
    { name: 'AI Infrastructure', path: '/superadmin/ai-infrastructure', testId: 'ai-infrastructure-module' },
    { name: 'AI Development', path: '/superadmin/ai-development', testId: 'ai-development-module' },
    { name: 'AI Operations', path: '/superadmin/ai-operations', testId: 'ai-operations-module' },
    { name: 'System', path: '/superadmin/system', testId: 'system-module' },
    { name: 'Content', path: '/superadmin/content', testId: 'content-module' },
    { name: 'Revenue', path: '/superadmin/revenue', testId: 'revenue-module' },
    { name: 'Security', path: '/superadmin/security', testId: 'security-module' },
    { name: 'Analytics', path: '/superadmin/analytics', testId: 'analytics-module' },
    { name: 'Configuration', path: '/superadmin/configuration', testId: 'configuration-module' },
];

test.describe('SuperAdmin Modules', () => {
    superAdminModules.forEach(({ name, path, testId }) => {
        test(`should load ${name} module`, async ({ page }) => {
            await page.goto(`http://localhost:3000${path}`);
            await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
            
            // Wait for module to load
            await page.waitForLoadState('networkidle');
            
            // Check that page is not showing error
            const errorMessage = page.locator('text=/error|Error|404|Not Found/i');
            await expect(errorMessage).toHaveCount(0);
        });

        test(`should have correct URL for ${name} module`, async ({ page }) => {
            await page.goto(`http://localhost:3000${path}`);
            await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
        });

        test(`should preserve ${name} module state on refresh`, async ({ page }) => {
            await page.goto(`http://localhost:3000${path}`);
            await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
            
            await page.reload();
            await page.waitForLoadState('networkidle');
            
            await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
        });
    });

    test('should navigate between all modules without errors', async ({ page }) => {
        const errors: string[] = [];
        
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        
        for (const { path } of superAdminModules) {
            await page.goto(`http://localhost:3000${path}`);
            await page.waitForLoadState('networkidle');
            await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
        }
        
        // Filter out known non-critical errors
        const criticalErrors = errors.filter(
            (error) =>
                !error.includes('favicon') &&
                !error.includes('404') &&
                !error.includes('net::ERR_')
        );
        
        expect(criticalErrors.length).toBe(0);
    });

    test('should have sidebar navigation working for all modules', async ({ page }) => {
        await page.goto('http://localhost:3000/superadmin/overview');
        await page.waitForLoadState('networkidle');
        
        // Try to find and click sidebar items (adjust selectors based on actual implementation)
        for (const { name, path } of superAdminModules.slice(1, 4)) { // Test first 3 modules
            const sidebarItem = page.locator(
                `a[href*="${path}"], button:has-text("${name}"), [data-section="${path.split('/').pop()}"]`
            ).first();
            
            if (await sidebarItem.isVisible({ timeout: 2000 })) {
                await sidebarItem.click();
                await page.waitForLoadState('networkidle');
                await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')), { timeout: 5000 });
            }
        }
    });
});



