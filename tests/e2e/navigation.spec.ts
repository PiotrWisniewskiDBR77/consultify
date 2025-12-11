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

            // Expand parent if needed and not already visible
            if (pageInfo.parent) {
                const parentSelector = locationMap[pageInfo.parent] || `nav >> text="${pageInfo.parent}"`;
                const linkSelector = locationMap[pageInfo.link] || `nav >> text="${pageInfo.link}"`;

                if (!(await page.isVisible(linkSelector))) {
                    await page.click(parentSelector);
                }
            }

            // Click the actual link
            const selector = locationMap[pageInfo.link] || `nav >> text="${pageInfo.link}"`;
            await page.click(selector);

            // Verify main header or content exists
            // Check for both h1 and breadcrumbs/spans
            await expect(page.locator(`text="${pageInfo.expectedText}"`).first()).toBeVisible();
        });
    }
});
