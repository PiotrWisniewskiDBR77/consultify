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
            // Hover sidebar to ensure it is expanded/visible
            await page.hover('div.fixed.z-50');
            await page.waitForTimeout(500);

            if (pageInfo.name === 'Settings') {
                // Settings is a floating menu in bottom section
                // Hover the Settings button/icon
                // We use the text 'Settings' which appears when sidebar is expanded
                await page.hover('text=Settings');

                // Wait for floating menu and click 'My Profile'
                await page.waitForSelector('text=My Profile', { state: 'visible' });
                await page.click('text=My Profile');
            } else {
                // Standard Sidebar Navigation
                if (pageInfo.parent) {
                    // Check if parent is already expanded or visible
                    const linkSelector = `nav >> text="${pageInfo.link}"`;
                    if (!(await page.isVisible(linkSelector))) {
                        // Expand parent
                        // e.g. "3. Initiatives & Roadmap"
                        const parentSelector = `nav >> text="${pageInfo.parent}"`;
                        if (await page.isVisible(parentSelector)) {
                            await page.click(parentSelector);
                            await page.waitForTimeout(300);
                        }
                    }
                }

                // Click link
                const linkSelector = `nav >> text="${pageInfo.link}"`;
                await page.click(linkSelector);
            }

            // Verify
            await expect(page.locator(`text="${pageInfo.expectedText}"`).first()).toBeVisible();
        });
    }
});
