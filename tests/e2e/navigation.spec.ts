import { test, expect } from '@playwright/test';

test.describe('Navigation Smoke Test', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test via UI
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', 'piotr.wisniewski@dbr77.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');
        // Admin View has "Admin Panel" in header
        await expect(page.locator('h1:has-text("Admin Panel")')).toBeVisible();
    });

    const pages = [
        { name: 'Roadmap', parent: '3. Initiatives & Roadmap', link: 'Roadmap Builder', expectedText: 'Transformation Roadmap' },
        { name: 'Initiatives', parent: '3. Initiatives & Roadmap', link: 'Initiatives List', expectedText: 'Initiatives Generator' },
        { name: 'Projects', parent: 'Admin Panel', link: 'Projects', expectedText: 'Projects' }, // Admin Panel projects header or breadcrumb
        { name: 'Settings', link: 'Settings', expectedText: 'Personal Information' },
    ];

    for (const pageInfo of pages) {
        test(`should navigate to ${pageInfo.name}`, async ({ page }) => {
            // Dictionary of special locations for items not in the main <nav>
            const locationMap: Record<string, string> = {
                'Admin Panel': 'text="Admin Panel"',
                'Projects': 'text="Projects"',
                'Settings': 'text="Settings"'
            };

            // Hover sidebar to ensure it is expanded/visible
            // Target the fixed sidebar container explicitly
            await page.hover('div.fixed.z-50');
            await page.waitForTimeout(500); // Allow for expansion animation

            // Wait for sidebar to expand (CONSULTIFY header text appears)
            try {
                await page.waitForSelector('text="CONSULTIFY"', { timeout: 2000 });
            } catch (e) {
                console.log('Sidebar failed to expand on hover, attempting fallback click if possible');
            }

            // Expand parent if needed and not already visible
            if (pageInfo.parent) {
                // If the parent section is collapsed, click to expand it
                const linkSelector = locationMap[pageInfo.link] || `nav >> text="${pageInfo.link}"`;

                // Check visibility with loose timeout to avoid immediate fail
                if (!(await page.isVisible(linkSelector))) {
                    const parentSelector = locationMap[pageInfo.parent] || `nav >> text="${pageInfo.parent}"`;
                    await page.waitForSelector(parentSelector);
                    await page.click(parentSelector);
                    await page.waitForTimeout(300); // Wait for submenu animation
                }
            }

            // Navigate
            const linkSelector = locationMap[pageInfo.link] || `nav >> text="${pageInfo.link}"`;
            await page.waitForSelector(linkSelector);
            await page.click(linkSelector);

            // Verify main header or content exists
            // Check for both h1 and breadcrumbs/spans
            await expect(page.locator(`text="${pageInfo.expectedText}"`).first()).toBeVisible();
        });
    }
});
