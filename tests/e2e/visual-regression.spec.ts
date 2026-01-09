import { test, expect } from '@playwright/test';
import percySnapshot from '@percy/playwright';

/**
 * Visual Regression Tests
 * Tests UI consistency and visual changes across critical user flows
 * CRITICAL FOR ENTERPRISE UI QUALITY ASSURANCE
 */

test.describe('Visual Regression Tests', () => {
    test.setTimeout(120000); // 2 minutes for visual tests

    test.beforeEach(async ({ page }) => {
        // Login as admin user for consistent visual state
        await page.goto('/login');
        await page.fill('[data-testid="email"]', 'admin@testenterprise.com');
        await page.fill('[data-testid="password"]', 'AdminPass123!');
        await page.click('[data-testid="login-button"]');
        await expect(page.locator('[data-testid="dashboard-overview"]')).toBeVisible();
    });

    test('dashboard overview visual consistency', async ({ page }) => {
        await test.step('Navigate to main dashboard', async () => {
            await page.click('[data-testid="nav-dashboard"]');
            await expect(page.locator('[data-testid="dashboard-overview"]')).toBeVisible();
        });

        await test.step('Capture dashboard snapshot', async () => {
            await percySnapshot(page, 'Dashboard Overview', {
                widths: [1280, 1920],
                minHeight: 800,
            });
        });

        await test.step('Verify key dashboard elements', async () => {
            // Check that all expected elements are present
            await expect(page.locator('[data-testid="task-summary"]')).toBeVisible();
            await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
            await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible();

            // Additional snapshot for expanded state
            await percySnapshot(page, 'Dashboard Overview - Expanded', {
                scope: '[data-testid="dashboard-overview"]'
            });
        });
    });

    test('task inbox visual regression', async ({ page }) => {
        await test.step('Navigate to task inbox', async () => {
            await page.click('[data-testid="nav-my-work"]');
            await expect(page.locator('[data-testid="task-inbox"]')).toBeVisible();
        });

        await test.step('Capture empty state', async () => {
            // Ensure clean state for consistent snapshots
            await percySnapshot(page, 'Task Inbox - Empty State', {
                scope: '[data-testid="task-inbox"]'
            });
        });

        await test.step('Create sample task for visual testing', async () => {
            await page.click('[data-testid="create-task-button"]');
            await page.fill('[data-testid="task-title"]', 'Visual Test Task');
            await page.fill('[data-testid="task-description"]', 'Task for visual regression testing');
            await page.selectOption('[data-testid="task-priority"]', 'medium');
            await page.click('[data-testid="save-task-button"]');
            await expect(page.locator('[data-testid="task-created-success"]')).toBeVisible();
        });

        await test.step('Capture task list with items', async () => {
            await percySnapshot(page, 'Task Inbox - With Tasks', {
                scope: '[data-testid="task-inbox"]',
                widths: [768, 1280, 1920]
            });
        });

        await test.step('Test task interactions', async () => {
            // Open task details
            await page.click('[data-testid="task-item"]:has-text("Visual Test Task")');
            await expect(page.locator('[data-testid="task-details-modal"]')).toBeVisible();

            await percySnapshot(page, 'Task Details Modal', {
                scope: '[data-testid="task-details-modal"]'
            });

            // Close modal
            await page.click('[data-testid="close-modal"]');
        });
    });

    test('assessment workflow visual regression', async ({ page }) => {
        await test.step('Navigate to assessments', async () => {
            await page.click('[data-testid="nav-assessments"]');
            await expect(page.locator('[data-testid="assessment-hub"]')).toBeVisible();
        });

        await test.step('Capture assessment hub', async () => {
            await percySnapshot(page, 'Assessment Hub', {
                widths: [1024, 1440],
                minHeight: 600
            });
        });

        await test.step('Test assessment creation wizard', async () => {
            await page.click('[data-testid="create-assessment-button"]');
            await expect(page.locator('[data-testid="assessment-wizard"]')).toBeVisible();

            await percySnapshot(page, 'Assessment Creation Wizard - Step 1', {
                scope: '[data-testid="assessment-wizard"]'
            });

            // Fill basic info and move to next step
            await page.fill('[data-testid="assessment-name"]', 'Visual Test Assessment');
            await page.fill('[data-testid="assessment-description"]', 'Assessment for visual regression testing');
            await page.click('[data-testid="next-step"]');

            await percySnapshot(page, 'Assessment Creation Wizard - Step 2', {
                scope: '[data-testid="assessment-wizard"]'
            });
        });
    });

    test('admin panel visual consistency', async ({ page }) => {
        await test.step('Navigate to admin panel', async () => {
            await page.click('[data-testid="nav-admin"]');
            await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
        });

        await test.step('Capture admin overview', async () => {
            await percySnapshot(page, 'Admin Panel Overview', {
                widths: [1280, 1920],
                minHeight: 800
            });
        });

        await test.step('Test admin sections', async () => {
            // Team management
            await page.click('[data-testid="admin-section-team"]');
            await percySnapshot(page, 'Admin Team Management', {
                scope: '[data-testid="admin-content"]'
            });

            // Workspace settings
            await page.click('[data-testid="admin-section-workspace"]');
            await percySnapshot(page, 'Admin Workspace Settings', {
                scope: '[data-testid="admin-content"]'
            });

            // AI settings
            await page.click('[data-testid="admin-section-ai"]');
            await percySnapshot(page, 'Admin AI Settings', {
                scope: '[data-testid="admin-content"]'
            });
        });
    });

    test('settings panel visual regression', async ({ page }) => {
        await test.step('Navigate to user settings', async () => {
            await page.click('[data-testid="user-menu"]');
            await page.click('[data-testid="settings-link"]');
            await expect(page.locator('[data-testid="settings-page"]')).toBeVisible();
        });

        await test.step('Capture main settings page', async () => {
            await percySnapshot(page, 'User Settings Overview', {
                widths: [768, 1024, 1280]
            });
        });

        await test.step('Test individual settings sections', async () => {
            // Profile settings
            await page.click('[data-testid="settings-section-profile"]');
            await percySnapshot(page, 'Profile Settings', {
                scope: '[data-testid="settings-content"]'
            });

            // Notification settings
            await page.click('[data-testid="settings-section-notifications"]');
            await percySnapshot(page, 'Notification Settings', {
                scope: '[data-testid="settings-content"]'
            });

            // Security settings
            await page.click('[data-testid="settings-section-security"]');
            await percySnapshot(page, 'Security Settings', {
                scope: '[data-testid="settings-content"]'
            });
        });
    });

    test('error states visual regression', async ({ page }) => {
        await test.step('Navigate to non-existent page', async () => {
            await page.goto('/non-existent-page');
        });

        await test.step('Capture 404 error page', async () => {
            await percySnapshot(page, '404 Error Page', {
                widths: [768, 1280],
                minHeight: 600
            });
        });

        await test.step('Test error boundary', async () => {
            // Navigate to a page that might trigger an error
            await page.goto('/error-test-page');
            // Wait for potential error boundary to appear
            await page.waitForTimeout(2000);

            // Capture error boundary if present
            const errorBoundary = page.locator('[data-testid="error-boundary"]').first();
            if (await errorBoundary.isVisible()) {
                await percySnapshot(page, 'Error Boundary', {
                    scope: '[data-testid="error-boundary"]'
                });
            }
        });
    });

    test('responsive design visual regression', async ({ page, context }) => {
        await test.step('Test mobile viewport', async () => {
            await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
            await page.reload();
            await expect(page.locator('[data-testid="dashboard-overview"]')).toBeVisible();

            await percySnapshot(page, 'Dashboard Mobile View', {
                widths: [375]
            });
        });

        await test.step('Test tablet viewport', async () => {
            await page.setViewportSize({ width: 768, height: 1024 }); // iPad
            await page.reload();
            await expect(page.locator('[data-testid="dashboard-overview"]')).toBeVisible();

            await percySnapshot(page, 'Dashboard Tablet View', {
                widths: [768]
            });
        });

        await test.step('Test desktop viewport', async () => {
            await page.setViewportSize({ width: 1920, height: 1080 }); // Full HD
            await page.reload();
            await expect(page.locator('[data-testid="dashboard-overview"]')).toBeVisible();

            await percySnapshot(page, 'Dashboard Desktop View', {
                widths: [1920]
            });
        });
    });

    test('loading states visual regression', async ({ page }) => {
        await test.step('Navigate to page with loading states', async () => {
            await page.click('[data-testid="nav-reports"]');
            // Wait for loading to appear
            await page.waitForSelector('[data-testid="loading-spinner"]', { timeout: 5000 }).catch(() => {});
        });

        await test.step('Capture loading states', async () => {
            const loadingSpinner = page.locator('[data-testid="loading-spinner"]').first();
            if (await loadingSpinner.isVisible()) {
                await percySnapshot(page, 'Loading State', {
                    scope: '[data-testid="loading-spinner"]'
                });
            }

            // Capture skeleton loading states
            const skeleton = page.locator('[data-testid="skeleton-loader"]').first();
            if (await skeleton.isVisible()) {
                await percySnapshot(page, 'Skeleton Loading', {
                    scope: '[data-testid="skeleton-loader"]'
                });
            }
        });
    });

    test('form validation visual regression', async ({ page }) => {
        await test.step('Navigate to form with validation', async () => {
            await page.click('[data-testid="nav-my-work"]');
            await page.click('[data-testid="create-task-button"]');
            await expect(page.locator('[data-testid="task-form-modal"]')).toBeVisible();
        });

        await test.step('Capture empty form', async () => {
            await percySnapshot(page, 'Task Creation Form - Empty', {
                scope: '[data-testid="task-form-modal"]'
            });
        });

        await test.step('Trigger validation errors', async () => {
            // Submit empty form to trigger validation
            await page.click('[data-testid="save-task-button"]');

            // Wait for validation messages
            await page.waitForSelector('[data-testid="validation-error"]', { timeout: 5000 }).catch(() => {});

            await percySnapshot(page, 'Form Validation Errors', {
                scope: '[data-testid="task-form-modal"]'
            });
        });

        await test.step('Fill form correctly', async () => {
            await page.fill('[data-testid="task-title"]', 'Validated Task');
            await page.fill('[data-testid="task-description"]', 'Task with proper validation');
            await page.selectOption('[data-testid="task-priority"]', 'high');

            await percySnapshot(page, 'Form Valid State', {
                scope: '[data-testid="task-form-modal"]'
            });
        });
    });

    test('navigation and sidebar visual regression', async ({ page }) => {
        await test.step('Test collapsed sidebar', async () => {
            const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]').first();
            if (await sidebarToggle.isVisible()) {
                await sidebarToggle.click();
                await percySnapshot(page, 'Sidebar Collapsed', {
                    widths: [1280]
                });
            }
        });

        await test.step('Test expanded sidebar', async () => {
            const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]').first();
            if (await sidebarToggle.isVisible()) {
                await sidebarToggle.click(); // Expand if collapsed
                await percySnapshot(page, 'Sidebar Expanded', {
                    widths: [1280, 1920]
                });
            }
        });

        await test.step('Test navigation highlights', async () => {
            await page.click('[data-testid="nav-projects"]');
            await percySnapshot(page, 'Navigation - Projects Active', {
                scope: '[data-testid="main-navigation"]'
            });

            await page.click('[data-testid="nav-assessments"]');
            await percySnapshot(page, 'Navigation - Assessments Active', {
                scope: '[data-testid="main-navigation"]'
            });
        });
    });

    test('modal and overlay visual regression', async ({ page }) => {
        await test.step('Open modal dialog', async () => {
            await page.click('[data-testid="user-menu"]');
            await page.click('[data-testid="profile-link"]');
            await expect(page.locator('[data-testid="profile-modal"]')).toBeVisible();
        });

        await test.step('Capture modal', async () => {
            await percySnapshot(page, 'Profile Modal', {
                scope: '[data-testid="profile-modal"]'
            });
        });

        await test.step('Test modal overlay', async () => {
            await percySnapshot(page, 'Modal with Overlay', {
                widths: [1280]
            });
        });

        await test.step('Test modal close states', async () => {
            await page.click('[data-testid="close-modal"]');
            await expect(page.locator('[data-testid="profile-modal"]')).not.toBeVisible();

            await percySnapshot(page, 'After Modal Close', {
                widths: [1280]
            });
        });
    });

    test('data table visual regression', async ({ page }) => {
        await test.step('Navigate to data table view', async () => {
            await page.click('[data-testid="nav-reports"]');
            await page.click('[data-testid="data-table-view"]');
            await expect(page.locator('[data-testid="data-table"]')).toBeVisible();
        });

        await test.step('Capture table layout', async () => {
            await percySnapshot(page, 'Data Table View', {
                scope: '[data-testid="data-table"]',
                widths: [1024, 1440, 1920]
            });
        });

        await test.step('Test table sorting', async () => {
            await page.click('[data-testid="sort-column-name"]');
            await percySnapshot(page, 'Data Table - Sorted', {
                scope: '[data-testid="data-table"]'
            });
        });

        await test.step('Test table pagination', async () => {
            await page.click('[data-testid="pagination-next"]');
            await percySnapshot(page, 'Data Table - Page 2', {
                scope: '[data-testid="data-table"]'
            });
        });
    });
});






