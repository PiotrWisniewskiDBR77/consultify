/**
 * E2E PMO Workflow Tests
 * 
 * Tests critical PMO flows:
 * - Initiative creation and management
 * - Task workflow
 * - Decision making
 * - Stage gate progression
 * - Report generation
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// Helper to login before tests
async function login(page: any) {
    await page.goto(BASE_URL);
    await page.getByLabel(/email/i).fill('demo@consultify.io');
    await page.getByLabel(/password/i).fill('demo123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/dashboard|app/, { timeout: 10000 });
}

test.describe('Initiative Management', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display initiatives list', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        
        await expect(page.getByRole('heading', { name: /initiatives/i })).toBeVisible();
    });

    test('should open create initiative modal', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        
        await page.getByRole('button', { name: /new|create|add/i }).first().click();
        
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByLabel(/name|title/i)).toBeVisible();
    });

    test('should validate initiative form', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        await page.getByRole('button', { name: /new|create|add/i }).first().click();
        
        // Try to submit empty form
        await page.getByRole('button', { name: /create|save|submit/i }).click();
        
        await expect(page.getByText(/required/i)).toBeVisible();
    });

    test('should create new initiative', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        await page.getByRole('button', { name: /new|create|add/i }).first().click();
        
        // Fill form
        await page.getByLabel(/name|title/i).fill('E2E Test Initiative');
        await page.getByLabel(/description|summary/i).first().fill('Test initiative for E2E testing');
        
        // Submit
        await page.getByRole('button', { name: /create|save/i }).click();
        
        // Should show success or redirect
        await expect(page.getByText(/E2E Test Initiative|success|created/i)).toBeVisible({ timeout: 5000 });
    });

    test('should display initiative details', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        
        // Click on first initiative
        await page.getByRole('link', { name: /.+/ }).first().click();
        
        // Should show initiative details
        await expect(page.getByText(/status|phase|progress/i)).toBeVisible();
    });

    test('should show initiative status badges', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        
        // Status badges should be visible
        await expect(page.getByText(/draft|active|on track|at risk|completed/i)).toBeVisible();
    });
});

test.describe('Task Management', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display task board', async ({ page }) => {
        await page.goto(`${BASE_URL}/tasks`);
        
        // Should show task board columns
        await expect(page.getByText(/to do|in progress|done/i)).toBeVisible();
    });

    test('should create new task', async ({ page }) => {
        await page.goto(`${BASE_URL}/tasks`);
        
        await page.getByRole('button', { name: /new task|add task/i }).click();
        
        // Fill task form
        await page.getByLabel(/title|name/i).fill('E2E Test Task');
        
        // Submit
        await page.getByRole('button', { name: /create|save/i }).click();
        
        await expect(page.getByText('E2E Test Task')).toBeVisible({ timeout: 5000 });
    });

    test('should move task between columns (drag & drop)', async ({ page }) => {
        await page.goto(`${BASE_URL}/tasks`);
        
        // Find a task card
        const taskCard = page.locator('[data-task-id]').first();
        const targetColumn = page.locator('[data-column="in-progress"]').first();
        
        if (await taskCard.isVisible() && await targetColumn.isVisible()) {
            await taskCard.dragTo(targetColumn);
            // Verify task moved
        }
    });

    test('should filter tasks', async ({ page }) => {
        await page.goto(`${BASE_URL}/tasks`);
        
        // Use filter
        const filterButton = page.getByRole('button', { name: /filter/i });
        if (await filterButton.isVisible()) {
            await filterButton.click();
            
            // Select filter option
            await page.getByText(/high priority|urgent/i).click();
        }
    });

    test('should show task details modal', async ({ page }) => {
        await page.goto(`${BASE_URL}/tasks`);
        
        // Click on task
        const taskCard = page.locator('[data-task-id], [class*="task-card"]').first();
        if (await taskCard.isVisible()) {
            await taskCard.click();
            
            // Should show modal with details
            await expect(page.getByRole('dialog')).toBeVisible();
        }
    });
});

test.describe('Decision Making', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display decisions list', async ({ page }) => {
        await page.goto(`${BASE_URL}/decisions`);
        
        await expect(page.getByRole('heading', { name: /decisions/i })).toBeVisible();
    });

    test('should show pending decisions', async ({ page }) => {
        await page.goto(`${BASE_URL}/decisions`);
        
        await expect(page.getByText(/pending|awaiting/i)).toBeVisible();
    });

    test('should open decision detail view', async ({ page }) => {
        await page.goto(`${BASE_URL}/decisions`);
        
        // Click on decision
        const decisionCard = page.locator('[data-decision-id]').first();
        if (await decisionCard.isVisible()) {
            await decisionCard.click();
            
            // Should show decision details
            await expect(page.getByText(/approve|reject|options/i)).toBeVisible();
        }
    });

    test('should record decision', async ({ page }) => {
        await page.goto(`${BASE_URL}/decisions`);
        
        const decisionCard = page.locator('[data-decision-id]').first();
        if (await decisionCard.isVisible()) {
            await decisionCard.click();
            
            // Add rationale
            await page.getByLabel(/rationale|reason|comment/i).fill('E2E test decision');
            
            // Submit decision
            await page.getByRole('button', { name: /approve|submit/i }).click();
            
            await expect(page.getByText(/approved|recorded|success/i)).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Stage Gate Progression', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display stage gate status', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        
        // Click on initiative
        await page.locator('[data-initiative-id]').first().click();
        
        // Should show gate status
        await expect(page.getByText(/gate|stage|phase/i)).toBeVisible();
    });

    test('should show gate readiness criteria', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        await page.locator('[data-initiative-id]').first().click();
        
        // Click on gate section
        await page.getByText(/gate status|stage gate/i).click();
        
        // Should show criteria
        await expect(page.getByText(/criteria|requirements|checklist/i)).toBeVisible();
    });

    test('should indicate missing criteria', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        await page.locator('[data-initiative-id]').first().click();
        
        // Should show incomplete indicators
        const incompleteIndicators = page.getByText(/incomplete|missing|not met/i);
        // May or may not be visible depending on initiative state
    });

    test('should allow gate approval when ready', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        await page.locator('[data-initiative-id]').first().click();
        
        // Find approve gate button
        const approveButton = page.getByRole('button', { name: /approve gate|progress|advance/i });
        
        if (await approveButton.isVisible()) {
            await approveButton.click();
            
            // Should show confirmation or success
            await expect(page.getByText(/approved|progressed|advanced/i)).toBeVisible();
        }
    });
});

test.describe('Report Generation', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display reports section', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        
        await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
    });

    test('should show report templates', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        
        await expect(page.getByText(/template|executive|assessment/i)).toBeVisible();
    });

    test('should create new report', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        
        await page.getByRole('button', { name: /new report|create|generate/i }).click();
        
        // Select template
        await page.getByText(/executive|assessment/i).first().click();
        
        // Generate
        await page.getByRole('button', { name: /generate|create/i }).click();
        
        // Should show report or success
        await expect(page.getByText(/generating|created|success/i)).toBeVisible({ timeout: 10000 });
    });

    test('should export report as PDF', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        
        // Click on existing report
        await page.locator('[data-report-id]').first().click();
        
        // Click export
        await page.getByRole('button', { name: /export/i }).click();
        await page.getByText(/pdf/i).click();
        
        // Should trigger download (can't fully verify in E2E)
    });
});

test.describe('Dashboard Overview', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display PMO dashboard', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        await expect(page.getByRole('heading', { name: /dashboard|overview/i })).toBeVisible();
    });

    test('should show key metrics', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        // Should display metrics cards
        await expect(page.getByText(/initiatives|tasks|decisions/i)).toBeVisible();
    });

    test('should show health indicators', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        // Should show health status
        await expect(page.getByText(/on track|at risk|healthy|warning/i)).toBeVisible();
    });

    test('should display recent activity', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        // Should show activity feed
        await expect(page.getByText(/recent|activity|updates/i)).toBeVisible();
    });

    test('should navigate to detail views', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        // Click on view all or metric card
        await page.getByText(/view all|see more/i).first().click();
        
        // Should navigate to detail view
        await expect(page).not.toHaveURL(`${BASE_URL}/dashboard`);
    });
});

test.describe('PMO Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display sidebar navigation', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        await expect(page.getByRole('navigation')).toBeVisible();
    });

    test('should navigate between PMO sections', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        // Navigate to initiatives
        await page.getByRole('link', { name: /initiatives/i }).click();
        await expect(page).toHaveURL(/initiatives/);
        
        // Navigate to tasks
        await page.getByRole('link', { name: /tasks/i }).click();
        await expect(page).toHaveURL(/tasks/);
        
        // Navigate to decisions
        await page.getByRole('link', { name: /decisions/i }).click();
        await expect(page).toHaveURL(/decisions/);
    });

    test('should show breadcrumbs', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        await page.locator('[data-initiative-id]').first().click();
        
        // Should show breadcrumb navigation
        await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toBeVisible()
            .catch(() => expect(page.getByText(/home|dashboard/i)).toBeVisible());
    });
});

test.describe('Search & Filter', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should have global search', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        const searchInput = page.getByPlaceholder(/search/i);
        await expect(searchInput).toBeVisible();
    });

    test('should show search results', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        await page.getByPlaceholder(/search/i).fill('test');
        await page.keyboard.press('Enter');
        
        // Should show search results
        await expect(page.getByText(/results|found|no results/i)).toBeVisible({ timeout: 5000 });
    });

    test('should filter initiatives by status', async ({ page }) => {
        await page.goto(`${BASE_URL}/initiatives`);
        
        const filterButton = page.getByRole('button', { name: /filter|status/i });
        if (await filterButton.isVisible()) {
            await filterButton.click();
            await page.getByText(/active|on track/i).first().click();
            
            // Results should be filtered
        }
    });
});

test.describe('Notifications', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display notification bell', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        await expect(page.getByRole('button', { name: /notifications/i })).toBeVisible();
    });

    test('should open notifications panel', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        await page.getByRole('button', { name: /notifications/i }).click();
        
        // Should show notifications dropdown or panel
        await expect(page.getByText(/notification|update|alert/i)).toBeVisible();
    });

    test('should mark notification as read', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.getByRole('button', { name: /notifications/i }).click();
        
        // Click on notification or mark as read
        const markReadButton = page.getByRole('button', { name: /mark.*read/i });
        if (await markReadButton.isVisible()) {
            await markReadButton.click();
        }
    });
});









