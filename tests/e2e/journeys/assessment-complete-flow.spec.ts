/**
 * Assessment Complete Flow - E2E User Journey Test
 * 100% Coverage of Assessment User Journey:
 * Start → Progress → Complete → Generate Report
 * 
 * @playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Assessment Complete Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to login
        await page.goto('/login');

        // Login with test credentials
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');

        // Wait for dashboard
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should complete DRD assessment from start to report', async ({ page }) => {
        // Step 1: Navigate to Assessments
        await page.click('[data-testid="nav-assessment"]');
        await expect(page).toHaveURL(/\/assessment/);

        // Step 2: Start new assessment
        await page.click('[data-testid="new-assessment-btn"]');
        await page.waitForSelector('[data-testid="assessment-type-modal"]');

        // Step 3: Select DRD assessment type
        await page.click('[data-testid="assessment-type-drd"]');
        await page.click('[data-testid="start-assessment-btn"]');

        // Step 4: Fill assessment name
        await page.fill('[data-testid="assessment-name-input"]', 'E2E Test Assessment');
        await page.click('[data-testid="continue-btn"]');

        // Step 5: Answer questions (multiple dimensions)
        await page.waitForSelector('[data-testid="question-section"]');

        // Answer first 5 questions
        for (let i = 0; i < 5; i++) {
            const questionSelector = `[data-testid="question-${i}"]`;
            if (await page.locator(questionSelector).isVisible()) {
                // Select score 3 for all questions
                await page.click(`${questionSelector} [data-testid="score-3"]`);
            }
        }

        // Navigate to next dimension
        await page.click('[data-testid="next-dimension-btn"]');

        // Answer more questions
        for (let i = 0; i < 5; i++) {
            const questionSelector = `[data-testid="question-${i}"]`;
            if (await page.locator(questionSelector).isVisible()) {
                await page.click(`${questionSelector} [data-testid="score-4"]`);
            }
        }

        // Step 6: Complete assessment
        await page.click('[data-testid="complete-assessment-btn"]');
        await page.waitForSelector('[data-testid="assessment-complete-modal"]');

        // Step 7: Generate report
        await page.click('[data-testid="generate-report-btn"]');
        await page.waitForSelector('[data-testid="report-container"]');

        // Verify report sections exist
        await expect(page.locator('[data-testid="report-summary"]')).toBeVisible();
        await expect(page.locator('[data-testid="report-scores"]')).toBeVisible();
        await expect(page.locator('[data-testid="report-recommendations"]')).toBeVisible();
    });

    test('should save and resume assessment', async ({ page }) => {
        // Start new assessment
        await page.click('[data-testid="nav-assessment"]');
        await page.click('[data-testid="new-assessment-btn"]');
        await page.click('[data-testid="assessment-type-siri"]');
        await page.click('[data-testid="start-assessment-btn"]');

        // Answer some questions
        await page.fill('[data-testid="assessment-name-input"]', 'Resume Test Assessment');
        await page.click('[data-testid="continue-btn"]');

        await page.waitForSelector('[data-testid="question-0"]');
        await page.click('[data-testid="question-0"] [data-testid="score-2"]');

        // Save and exit
        await page.click('[data-testid="save-progress-btn"]');
        await page.waitForSelector('[data-testid="saved-notification"]');

        // Navigate away
        await page.click('[data-testid="nav-dashboard"]');
        await expect(page).toHaveURL(/\/(dashboard|my-work)/);

        // Return to assessments
        await page.click('[data-testid="nav-assessment"]');

        // Find and resume saved assessment
        await page.click('[data-testid="in-progress-tab"]');
        await expect(page.locator('text=Resume Test Assessment')).toBeVisible();

        await page.click('[data-testid="resume-assessment-btn"]');

        // Verify progress was saved
        await expect(page.locator('[data-testid="question-0"] [data-testid="score-2"]')).toHaveClass(/selected/);
    });

    test('should generate initiatives from completed assessment', async ({ page }) => {
        // Navigate to completed assessments
        await page.click('[data-testid="nav-assessment"]');
        await page.click('[data-testid="completed-tab"]');

        // Find a completed assessment
        await page.click('[data-testid="assessment-item-0"]');

        // Generate initiatives
        await page.click('[data-testid="generate-initiatives-btn"]');
        await page.waitForSelector('[data-testid="initiative-generation-modal"]');

        // Select methodology
        await page.click('[data-testid="methodology-impact-feasibility"]');
        await page.fill('[data-testid="initiative-count-input"]', '5');
        await page.click('[data-testid="generate-btn"]');

        // Wait for generation
        await page.waitForSelector('[data-testid="initiatives-generated"]', { timeout: 30000 });

        // Verify initiatives were created
        const initiatives = page.locator('[data-testid^="initiative-item-"]');
        await expect(initiatives).toHaveCount(5);
    });
});

test.describe('Interview Session Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should complete interview from template selection to results', async ({ page }) => {
        // Navigate to Interviews
        await page.click('[data-testid="nav-discovery"]');
        await page.click('[data-testid="interview-tool"]');

        // Select template
        await page.waitForSelector('[data-testid="template-list"]');
        await page.click('[data-testid="template-stakeholder-analysis"]');

        // Start interview
        await page.click('[data-testid="start-interview-btn"]');

        // Answer interview questions
        await page.waitForSelector('[data-testid="interview-question-0"]');

        // Fill first question
        await page.fill('[data-testid="interview-answer-0"]', 'Answer to first question');
        await page.click('[data-testid="next-question-btn"]');

        // Fill second question
        await page.fill('[data-testid="interview-answer-1"]', 'Answer to second question');
        await page.click('[data-testid="next-question-btn"]');

        // Complete interview
        await page.click('[data-testid="complete-interview-btn"]');

        // View results
        await page.waitForSelector('[data-testid="interview-results"]');
        await expect(page.locator('[data-testid="insights-section"]')).toBeVisible();
    });
});

test.describe('Decision Management Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'admin@test.com');
        await page.fill('[data-testid="password-input"]', 'adminpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should create and approve decision', async ({ page }) => {
        // Navigate to MyWork Decisions tab
        await page.click('[data-testid="nav-my-work"]');
        await page.click('[data-testid="tab-decisions"]');

        // Create new decision
        await page.click('[data-testid="new-decision-btn"]');
        await page.waitForSelector('[data-testid="decision-modal"]');

        // Fill decision details
        await page.fill('[data-testid="decision-title"]', 'E2E Test Decision');
        await page.fill('[data-testid="decision-description"]', 'Description for test decision');
        await page.selectOption('[data-testid="decision-type"]', 'APPROVAL');

        // Set deadline
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await page.fill('[data-testid="decision-deadline"]', tomorrow.toISOString().split('T')[0]);

        // Submit
        await page.click('[data-testid="create-decision-btn"]');
        await page.waitForSelector('[data-testid="decision-created-notification"]');

        // Find the decision in pending list
        await expect(page.locator('text=E2E Test Decision')).toBeVisible();

        // Approve decision
        await page.click('[data-testid="decision-E2E Test Decision"]');
        await page.click('[data-testid="approve-btn"]');
        await page.fill('[data-testid="rationale-input"]', 'Approved after E2E review');
        await page.click('[data-testid="confirm-approve-btn"]');

        // Verify approved status
        await expect(page.locator('[data-testid="decision-status-approved"]')).toBeVisible();
    });
});
