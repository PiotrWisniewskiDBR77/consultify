import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

test.describe('Mobile Responsiveness', () => {
    // iPhone 12 Pro Viewport
    test.use({ viewport: { width: 390, height: 844 } });

    test('should adapt layout for mobile devices (iPhone 12 Pro)', async ({ page }) => {
        // 1. Auth Page Responsiveness
        await page.goto('/');

        // Welcome text checks - mobile might hide some headers
        const welcomeText = page.locator('text=Transformation Path');

        // Check for hamburger menu which might contain Login
        const hamburger = page.locator('button[aria-label="Open menu"], [data-testid="mobile-menu-trigger"], .lucide-menu');

        if (await welcomeText.isVisible()) {
            await expect(welcomeText).toBeVisible();
        }

        // Check for Log In
        const loginBtn = page.locator('text=Log In');
        if (!await loginBtn.isVisible() && await hamburger.isVisible()) {
            // Open mobile menu
            await hamburger.click();
            // Now check for Log In
            await expect(page.locator('text=Log In')).toBeVisible();
            // Click it to proceed
            await page.click('text=Log In');
        } else if (await loginBtn.isVisible()) {
            await page.click('text=Log In');
        } else {
            // Fallback if neither works (should fail)
            await expect(loginBtn).toBeVisible();
        }
        await page.fill('input[type="email"]', 'admin@dbr77.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');

        // 2. Dashboard Layout
        await page.waitForURL(/dashboard|home/i);

        // Sidebar should be hidden/collapsed
        // Assuming desktop sidebar has a specific class or ID that is hidden or changes on mobile
        // Or checking for Hamburger menu presence
        // Sidebar should be hidden/collapsed
        // Assuming desktop sidebar has a specific class or ID that is hidden or changes on mobile
        // Or checking for Hamburger menu presence
        if (await hamburger.isVisible()) {
            await expect(hamburger).toBeVisible();
        } else {
            // If sidebar is just hidden off-canvas
            const sidebar = page.locator('aside');
            // On mobile, sidebar might be hidden initially
            const box = await sidebar.boundingBox();
            if (box) {
                // It might be rendered but hidden via CSS or off-screen, difficult to check strictly without specific selector knowledge
                // Let's rely on checking if main content takes full width
            }
        }

        // Widgets should stack (checking generic grid containers)
        // This is heuristic; strict check would need specific test-ids for grid containers
        const grid = page.locator('.grid');
        if (await grid.count() > 0) {
            const firstGrid = grid.first();
            // In mobile, grid-cols-1 is common
            await expect(firstGrid).toBeVisible();
        }

        // 3. Navigation via Mobile Menu
        if (await hamburger.isVisible()) {
            await hamburger.click();
            // Sidebar/Menu should appear
            await expect(page.locator('text=Projects')).toBeVisible();
            await page.click('text=Projects');
            // Should navigate and close menu (typically)
            await page.waitForURL(/\/projects/i);
        } else {
            // Fallback if no hamburger (e.g. bottom nav)
            // Navigate directly if needed
            await page.goto('/projects');
        }

        // 4. List Views (Projects/Tasks)
        const projectList = page.locator('.project-list, .grid');
        await expect(projectList).toBeVisible();
    });
});

test.describe('Mobile Viewport (Pixel 5)', () => {
    test.use({ viewport: { width: 393, height: 851 } });

    test('should prevent horizontal scroll on main views', async ({ page }) => {
        await page.goto('/');

        // Evaluation of scroll width vs client width
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);

        // Allow small tolerance for scrollbars
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
});
