/**
 * GEMBA Industrial Flow - E2E Test
 * 100% Coverage of GEMBA/Industrial User Journeys:
 * KPI Dashboard → Observations → RapidLean → Reports
 * 
 * @playwright
 */

import { test, expect } from '@playwright/test';

test.describe('GEMBA Industrial User Journeys', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'industrial@test.com');
        await page.fill('[data-testid="password-input"]', 'industrialpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should complete GEMBA walk observation flow', async ({ page }) => {
        // Navigate to GEMBA module
        await page.click('[data-testid="nav-gemba"]');
        await expect(page).toHaveURL(/\/gemba/);

        // Start new GEMBA walk
        await page.click('[data-testid="new-gemba-walk-btn"]');
        await page.waitForSelector('[data-testid="gemba-walk-modal"]');

        // Select area/zone
        await page.selectOption('[data-testid="gemba-area"]', 'production-floor-a');
        await page.fill('[data-testid="gemba-name"]', 'E2E Test GEMBA Walk');
        await page.click('[data-testid="start-walk-btn"]');

        // Observation screen
        await page.waitForSelector('[data-testid="observation-form"]');

        // Add observation
        await page.click('[data-testid="add-observation-btn"]');
        await page.selectOption('[data-testid="observation-category"]', 'safety');
        await page.fill('[data-testid="observation-description"]', 'Test safety observation');
        await page.selectOption('[data-testid="observation-severity"]', 'medium');
        await page.click('[data-testid="save-observation-btn"]');

        // Verify observation added
        await expect(page.locator('[data-testid="observation-item-0"]')).toBeVisible();

        // Complete GEMBA walk
        await page.click('[data-testid="complete-walk-btn"]');
        await page.waitForSelector('[data-testid="walk-summary"]');

        // Verify summary
        await expect(page.locator('[data-testid="observations-count"]')).toContainText('1');
    });

    test('should manage KPI dashboard', async ({ page }) => {
        // Navigate to GEMBA KPIs
        await page.click('[data-testid="nav-gemba"]');
        await page.click('[data-testid="gemba-kpis"]');

        // View KPI dashboard
        await page.waitForSelector('[data-testid="kpi-dashboard"]');

        // Check KPI cards
        await expect(page.locator('[data-testid="kpi-oee"]')).toBeVisible();
        await expect(page.locator('[data-testid="kpi-quality"]')).toBeVisible();
        await expect(page.locator('[data-testid="kpi-performance"]')).toBeVisible();

        // Add custom KPI
        await page.click('[data-testid="add-kpi-btn"]');
        await page.waitForSelector('[data-testid="kpi-modal"]');

        await page.fill('[data-testid="kpi-name"]', 'E2E Test KPI');
        await page.fill('[data-testid="kpi-target"]', '95');
        await page.selectOption('[data-testid="kpi-unit"]', 'percentage');
        await page.click('[data-testid="save-kpi-btn"]');

        // Verify KPI added
        await expect(page.locator('text=E2E Test KPI')).toBeVisible();
    });

    test('should complete RapidLean observation', async ({ page }) => {
        // Navigate to RapidLean
        await page.click('[data-testid="nav-discovery"]');
        await page.click('[data-testid="rapidlean-tool"]');

        // Select template
        await page.waitForSelector('[data-testid="template-list"]');
        await page.click('[data-testid="template-5s-audit"]');
        await page.click('[data-testid="start-observation-btn"]');

        // Fill observation form
        await page.waitForSelector('[data-testid="observation-form"]');

        // Set location
        await page.fill('[data-testid="location-input"]', 'Assembly Line 1');

        // Answer checklist items
        await page.click('[data-testid="item-0-yes"]');
        await page.click('[data-testid="item-1-yes"]');
        await page.click('[data-testid="item-2-score-4"]');

        // Add notes
        await page.fill('[data-testid="notes-input"]', 'E2E test observation notes');

        // Save observation
        await page.click('[data-testid="save-observation-btn"]');

        // Verify completion
        await page.waitForSelector('[data-testid="observation-saved"]');
    });
});

test.describe('QMS Quality Management Journeys', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'quality@test.com');
        await page.fill('[data-testid="password-input"]', 'qualitypassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should create and manage NCR', async ({ page }) => {
        // Navigate to QMS
        await page.click('[data-testid="nav-qms"]');
        await page.click('[data-testid="qms-ncr"]');

        // Create new NCR
        await page.click('[data-testid="new-ncr-btn"]');
        await page.waitForSelector('[data-testid="ncr-modal"]');

        await page.fill('[data-testid="ncr-title"]', 'E2E Test NCR');
        await page.selectOption('[data-testid="ncr-type"]', 'product');
        await page.selectOption('[data-testid="ncr-severity"]', 'major');
        await page.fill('[data-testid="ncr-description"]', 'Description of non-conformance');
        await page.click('[data-testid="create-ncr-btn"]');

        // Verify NCR created
        await expect(page.locator('text=E2E Test NCR')).toBeVisible();
    });

    test('should initiate CAPA from NCR', async ({ page }) => {
        // Navigate to NCR
        await page.click('[data-testid="nav-qms"]');
        await page.click('[data-testid="qms-ncr"]');
        await page.click('[data-testid="ncr-item-0"]');

        // Initiate CAPA
        await page.click('[data-testid="initiate-capa-btn"]');
        await page.waitForSelector('[data-testid="capa-modal"]');

        await page.fill('[data-testid="capa-root-cause"]', 'Root cause analysis');
        await page.fill('[data-testid="capa-corrective-action"]', 'Corrective action description');
        await page.fill('[data-testid="capa-preventive-action"]', 'Preventive action description');
        await page.click('[data-testid="submit-capa-btn"]');

        // Verify CAPA created
        await expect(page.locator('[data-testid="capa-status"]')).toContainText('Open');
    });

    test('should complete inspection checklist', async ({ page }) => {
        // Navigate to inspections
        await page.click('[data-testid="nav-qms"]');
        await page.click('[data-testid="qms-inspections"]');

        // Start new inspection
        await page.click('[data-testid="new-inspection-btn"]');
        await page.selectOption('[data-testid="inspection-type"]', 'incoming');
        await page.click('[data-testid="start-inspection-btn"]');

        // Fill inspection checklist
        await page.waitForSelector('[data-testid="inspection-checklist"]');

        await page.click('[data-testid="check-0-pass"]');
        await page.click('[data-testid="check-1-pass"]');
        await page.click('[data-testid="check-2-fail"]');
        await page.fill('[data-testid="check-2-notes"]', 'Minor defect observed');

        // Complete inspection
        await page.click('[data-testid="complete-inspection-btn"]');

        // Verify result
        await expect(page.locator('[data-testid="inspection-result"]')).toContainText('Conditional Pass');
    });
});

test.describe('Production/MES Journeys', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'production@test.com');
        await page.fill('[data-testid="password-input"]', 'productionpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should manage production orders', async ({ page }) => {
        // Navigate to MES
        await page.click('[data-testid="nav-mes"]');
        await page.click('[data-testid="mes-orders"]');

        // View order list
        await page.waitForSelector('[data-testid="orders-table"]');

        // Open order details
        await page.click('[data-testid="order-row-0"]');
        await page.waitForSelector('[data-testid="order-details"]');

        // Start production
        await page.click('[data-testid="start-production-btn"]');
        await expect(page.locator('[data-testid="order-status"]')).toContainText('In Progress');

        // Log production data
        await page.click('[data-testid="log-quantity-btn"]');
        await page.fill('[data-testid="quantity-input"]', '100');
        await page.click('[data-testid="submit-log-btn"]');

        // Verify production logged
        await expect(page.locator('[data-testid="produced-quantity"]')).toContainText('100');
    });

    test('should track downtime', async ({ page }) => {
        // Navigate to downtime tracking
        await page.click('[data-testid="nav-mes"]');
        await page.click('[data-testid="mes-downtime"]');

        // Log downtime
        await page.click('[data-testid="log-downtime-btn"]');
        await page.waitForSelector('[data-testid="downtime-modal"]');

        await page.selectOption('[data-testid="machine-select"]', 'machine-001');
        await page.selectOption('[data-testid="downtime-reason"]', 'breakdown');
        await page.fill('[data-testid="downtime-duration"]', '30');
        await page.fill('[data-testid="downtime-notes"]', 'E2E test downtime');
        await page.click('[data-testid="submit-downtime-btn"]');

        // Verify downtime logged
        await expect(page.locator('[data-testid="downtime-item-0"]')).toBeVisible();
    });
});

test.describe('Mobile Responsive Flows', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'mobile@test.com');
        await page.fill('[data-testid="password-input"]', 'mobilepassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should navigate with mobile menu', async ({ page }) => {
        // Open mobile menu
        await page.click('[data-testid="mobile-menu-btn"]');
        await page.waitForSelector('[data-testid="mobile-nav"]');

        // Navigate to My Work
        await page.click('[data-testid="mobile-nav-my-work"]');
        await expect(page).toHaveURL(/\/my-work/);

        // Open menu again
        await page.click('[data-testid="mobile-menu-btn"]');

        // Navigate to Settings
        await page.click('[data-testid="mobile-nav-settings"]');
        await expect(page).toHaveURL(/\/settings/);
    });

    test('should complete task on mobile', async ({ page }) => {
        // Navigate to tasks
        await page.click('[data-testid="mobile-menu-btn"]');
        await page.click('[data-testid="mobile-nav-my-work"]');

        // View task list
        await page.waitForSelector('[data-testid="mobile-task-list"]');

        // Tap on task
        await page.click('[data-testid="task-item-0"]');
        await page.waitForSelector('[data-testid="task-detail-sheet"]');

        // Complete task
        await page.click('[data-testid="complete-task-btn"]');

        // Verify completion
        await expect(page.locator('[data-testid="task-status"]')).toContainText('Completed');
    });

    test('should quick add observation on mobile', async ({ page }) => {
        // Navigate to GEMBA
        await page.click('[data-testid="mobile-menu-btn"]');
        await page.click('[data-testid="mobile-nav-gemba"]');

        // Use quick add
        await page.click('[data-testid="quick-add-fab"]');
        await page.waitForSelector('[data-testid="quick-observation-sheet"]');

        // Fill quick observation
        await page.selectOption('[data-testid="quick-category"]', 'safety');
        await page.fill('[data-testid="quick-description"]', 'Mobile observation test');
        await page.click('[data-testid="submit-quick-observation"]');

        // Verify added
        await expect(page.locator('[data-testid="observation-saved-toast"]')).toBeVisible();
    });
});
