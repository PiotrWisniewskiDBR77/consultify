import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Task Management Flow
 * Complete task creation, assignment, and completion workflow
 * CRITICAL FOR ENTERPRISE TASK MANAGEMENT
 */

test.describe('Task Management Flow', () => {
    test.setTimeout(90000); // 90 seconds for complex workflow

    test.beforeEach(async ({ page }) => {
        // Login as admin user
        await page.goto('/login');
        await page.fill('[data-testid="email"]', 'admin@testenterprise.com');
        await page.fill('[data-testid="password"]', 'AdminPass123!');
        await page.click('[data-testid="login-button"]');
        await expect(page.locator('[data-testid="dashboard-overview"]')).toBeVisible();
    });

    test('complete task lifecycle workflow', async ({ page }) => {
        // ==========================================
        // PHASE 1: Task Creation
        // ==========================================

        await test.step('Navigate to task creation', async () => {
            await page.click('[data-testid="nav-my-work"]');
            await page.click('[data-testid="create-task-button"]');
            await expect(page.locator('[data-testid="task-form-modal"]')).toBeVisible();
        });

        await test.step('Create new task', async () => {
            await page.fill('[data-testid="task-title"]', 'Implement User Authentication System');
            await page.fill('[data-testid="task-description"]',
                'Implement secure user authentication with MFA support, including password policies and session management.');
            await page.selectOption('[data-testid="task-priority"]', 'high');
            await page.selectOption('[data-testid="task-assignee"]', 'developer-1');

            // Set due date (7 days from now)
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);
            await page.fill('[data-testid="task-due-date"]', dueDate.toISOString().split('T')[0]);

            // Add tags/labels
            await page.fill('[data-testid="task-tags"]', 'authentication,security,mfa');
            await page.click('[data-testid="add-tag-button"]');

            await page.click('[data-testid="save-task-button"]');
            await expect(page.locator('[data-testid="task-created-success"]')).toBeVisible();
        });

        // ==========================================
        // PHASE 2: Task Assignment & Acceptance
        // ==========================================

        await test.step('Switch to assignee view', async () => {
            // Simulate switching users or check task appears in assignee's inbox
            await page.click('[data-testid="user-menu"]');
            await page.click('[data-testid="switch-user-developer1"]');

            await page.click('[data-testid="nav-my-work"]');
            await expect(page.locator('[data-testid="task-inbox"]')).toContainText('Implement User Authentication');
        });

        await test.step('Accept task assignment', async () => {
            await page.click('[data-testid="task-item"]:has-text("Implement User Authentication")');
            await expect(page.locator('[data-testid="task-details-modal"]')).toBeVisible();

            await page.click('[data-testid="accept-task-button"]');
            await expect(page.locator('[data-testid="task-accepted"]')).toBeVisible();

            // Status should change to 'in_progress'
            await expect(page.locator('[data-testid="task-status"]')).toContainText('In Progress');
        });

        // ==========================================
        // PHASE 3: Task Progress Updates
        // ==========================================

        await test.step('Update task progress', async () => {
            // Add progress note
            await page.fill('[data-testid="progress-note"]', 'Started implementing basic auth framework with bcrypt');
            await page.click('[data-testid="add-progress-note"]');

            // Update progress percentage
            await page.fill('[data-testid="progress-percentage"]', '25');
            await page.click('[data-testid="update-progress"]');

            await expect(page.locator('[data-testid="progress-25"]')).toBeVisible();
        });

        await test.step('Add task dependencies', async () => {
            await page.click('[data-testid="add-dependency-button"]');

            // Create dependent task
            await page.fill('[data-testid="dependency-title"]', 'Setup OAuth2 Provider Integration');
            await page.selectOption('[data-testid="dependency-priority"]', 'medium');
            await page.click('[data-testid="create-dependency"]');

            await expect(page.locator('[data-testid="task-dependencies"]')).toContainText('OAuth2 Provider');
        });

        // ==========================================
        // PHASE 4: Task Review & Approval
        // ==========================================

        await test.step('Submit task for review', async () => {
            await page.fill('[data-testid="completion-note"]',
                'Authentication system implemented with MFA, password policies, and session management. All tests passing.');
            await page.click('[data-testid="submit-review-button"]');

            await expect(page.locator('[data-testid="task-under-review"]')).toBeVisible();
        });

        await test.step('Approve task completion', async () => {
            // Switch back to admin view
            await page.click('[data-testid="user-menu"]');
            await page.click('[data-testid="switch-user-admin"]');

            await page.click('[data-testid="nav-my-work"]');
            await page.click('[data-testid="review-queue-tab"]');

            // Find and approve task
            await page.click('[data-testid="task-review-item"]:has-text("Implement User Authentication")');
            await page.fill('[data-testid="review-feedback"]', 'Excellent implementation. Security measures look solid.');
            await page.click('[data-testid="approve-task-button"]');

            await expect(page.locator('[data-testid="task-approved"]')).toBeVisible();
        });

        // ==========================================
        // PHASE 5: Task Completion & Follow-up
        // ==========================================

        await test.step('Verify task completion', async () => {
            await page.click('[data-testid="nav-my-work"]');
            await page.click('[data-testid="completed-tab"]');

            await expect(page.locator('[data-testid="completed-tasks"]')).toContainText('Implement User Authentication');

            // Check completion date and final status
            await page.click('[data-testid="task-item"]:has-text("Implement User Authentication")');
            await expect(page.locator('[data-testid="task-status"]')).toContainText('Completed');
            await expect(page.locator('[data-testid="completion-date"]')).toBeVisible();
        });

        await test.step('Check dependent task status', async () => {
            // Dependent task should now be available
            await expect(page.locator('[data-testid="available-tasks"]')).toContainText('OAuth2 Provider');

            // Verify dependency link
            await page.click('[data-testid="task-item"]:has-text("OAuth2 Provider")');
            await expect(page.locator('[data-testid="dependency-info"]')).toContainText('Implement User Authentication');
        });

        // ==========================================
        // VERIFICATION: Workflow Analytics
        // ==========================================

        await test.step('Verify workflow analytics', async () => {
            await page.click('[data-testid="nav-reports"]');
            await page.click('[data-testid="task-analytics"]');

            // Check completion metrics
            await expect(page.locator('[data-testid="tasks-completed"]')).toContainText('1');
            await expect(page.locator('[data-testid="avg-completion-time"]')).toBeVisible();

            // Check productivity metrics
            await expect(page.locator('[data-testid="team-productivity"]')).toBeVisible();
        });
    });

    test('task priority escalation workflow', async ({ page }) => {
        // ==========================================
        // PHASE 1: Create High Priority Task
        // ==========================================

        await test.step('Create urgent task', async () => {
            await page.click('[data-testid="nav-my-work"]');
            await page.click('[data-testid="create-task-button"]');

            await page.fill('[data-testid="task-title"]', 'URGENT: Security Vulnerability Fix');
            await page.selectOption('[data-testid="task-priority"]', 'critical');
            await page.selectOption('[data-testid="task-assignee"]', 'security-team');

            // Set very near due date
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            await page.fill('[data-testid="task-due-date"]', tomorrow.toISOString().split('T')[0]);

            await page.click('[data-testid="save-task-button"]');
        });

        // ==========================================
        // PHASE 2: Priority Escalation
        // ==========================================

        await test.step('Verify priority escalation alerts', async () => {
            // Check dashboard alerts
            await expect(page.locator('[data-testid="priority-alert"]')).toBeVisible();
            await expect(page.locator('[data-testid="priority-alert"]')).toContainText('critical');

            // Check email notifications (if implemented)
            // Check Slack/webhook notifications
        });

        await test.step('Monitor task progress urgency', async () => {
            // Switch to assignee view
            await page.click('[data-testid="user-menu"]');
            await page.click('[data-testid="switch-user-security"]');

            // Check urgent task indicators
            await expect(page.locator('[data-testid="urgent-indicator"]')).toBeVisible();
            await expect(page.locator('[data-testid="time-remaining"]')).toContainText('1 day');
        });

        // ==========================================
        // PHASE 3: Rapid Resolution
        // ==========================================

        await test.step('Complete urgent task quickly', async () => {
            await page.click('[data-testid="task-item"]:has-text("URGENT: Security")');
            await page.fill('[data-testid="progress-note"]', 'Vulnerability patched and tested');
            await page.fill('[data-testid="progress-percentage"]', '100');
            await page.click('[data-testid="mark-complete"]');

            await page.click('[data-testid="submit-review-button"]');
        });

        // ==========================================
        // VERIFICATION: Escalation Resolution
        // ==========================================

        await test.step('Verify escalation resolved', async () => {
            // Switch back to admin
            await page.click('[data-testid="user-menu"]');
            await page.click('[data-testid="switch-user-admin"]');

            // Check alerts cleared
            await expect(page.locator('[data-testid="priority-alert"]')).not.toBeVisible();

            // Check resolution metrics
            await page.click('[data-testid="nav-reports"]');
            await expect(page.locator('[data-testid="urgent-resolution-time"]')).toBeVisible();
        });
    });

    test('bulk task operations workflow', async ({ page }) => {
        // ==========================================
        // PHASE 1: Create Multiple Tasks
        // ==========================================

        await test.step('Create bulk tasks', async () => {
            const tasks = [
                { title: 'Setup CI/CD Pipeline', priority: 'high', assignee: 'devops' },
                { title: 'Implement API Rate Limiting', priority: 'medium', assignee: 'backend' },
                { title: 'Design User Dashboard', priority: 'medium', assignee: 'frontend' },
                { title: 'Write API Documentation', priority: 'low', assignee: 'tech-writer' }
            ];

            for (const task of tasks) {
                await page.click('[data-testid="create-task-button"]');
                await page.fill('[data-testid="task-title"]', task.title);
                await page.selectOption('[data-testid="task-priority"]', task.priority);
                await page.selectOption('[data-testid="task-assignee"]', task.assignee);
                await page.click('[data-testid="save-task-button"]');
                await expect(page.locator('[data-testid="task-created-success"]')).toBeVisible();
            }
        });

        // ==========================================
        // PHASE 2: Bulk Task Management
        // ==========================================

        await test.step('Perform bulk operations', async () => {
            // Select multiple tasks
            await page.click('[data-testid="select-all-tasks"]');

            // Bulk priority update
            await page.click('[data-testid="bulk-actions-menu"]');
            await page.click('[data-testid="bulk-update-priority"]');
            await page.selectOption('[data-testid="bulk-priority-select"]', 'high');
            await page.click('[data-testid="apply-bulk-update"]');

            await expect(page.locator('[data-testid="bulk-update-success"]')).toBeVisible();
        });

        await test.step('Bulk assignment changes', async () => {
            // Select subset of tasks
            await page.click('[data-testid="task-checkbox"]:nth-child(1)');
            await page.click('[data-testid="task-checkbox"]:nth-child(3)');

            // Bulk reassign
            await page.click('[data-testid="bulk-reassign"]');
            await page.selectOption('[data-testid="bulk-assignee-select"]', 'senior-dev');
            await page.click('[data-testid="confirm-bulk-reassign"]');

            await expect(page.locator('[data-testid="bulk-reassign-success"]')).toBeVisible();
        });

        // ==========================================
        // PHASE 3: Bulk Status Updates
        // ==========================================

        await test.step('Bulk status completion', async () => {
            // Simulate team completing tasks
            await page.click('[data-testid="clear-selection"]');

            // Mark completed tasks
            await page.click('[data-testid="task-item"]:has-text("Setup CI/CD")');
            await page.click('[data-testid="mark-complete"]');
            await page.click('[data-testid="close-modal"]');

            await page.click('[data-testid="task-item"]:has-text("Design User Dashboard")');
            await page.click('[data-testid="mark-complete"]');
            await page.click('[data-testid="close-modal"]');
        });

        // ==========================================
        // VERIFICATION: Bulk Operation Results
        // ==========================================

        await test.step('Verify bulk operation results', async () => {
            // Check completion stats
            await expect(page.locator('[data-testid="completed-count"]')).toContainText('2');
            await expect(page.locator('[data-testid="in-progress-count"]')).toContainText('2');

            // Check priority distribution
            await page.click('[data-testid="filter-priority-high"]');
            await expect(page.locator('[data-testid="task-count"]')).toContainText('4');

            // Check assignment distribution
            await page.click('[data-testid="filter-assignee-senior-dev"]');
            await expect(page.locator('[data-testid="task-count"]')).toContainText('2');
        });
    });

    test('task dependency management workflow', async ({ page }) => {
        // ==========================================
        // PHASE 1: Create Dependent Task Chain
        // ==========================================

        await test.step('Create task with dependencies', async () => {
            await page.click('[data-testid="create-task-button"]');

            await page.fill('[data-testid="task-title"]', 'Deploy Production Environment');
            await page.selectOption('[data-testid="task-priority"]', 'high');

            // Add dependencies
            await page.click('[data-testid="add-dependency"]');
            await page.fill('[data-testid="dependency-search"]', 'Setup CI/CD Pipeline');
            await page.click('[data-testid="select-dependency"]');

            await page.click('[data-testid="add-dependency"]');
            await page.fill('[data-testid="dependency-search"]', 'Implement API Rate Limiting');
            await page.click('[data-testid="select-dependency"]');

            await page.click('[data-testid="save-task-button"]');
        });

        // ==========================================
        // PHASE 2: Dependency Enforcement
        // ==========================================

        await test.step('Verify dependency blocking', async () => {
            // Try to start deployment task
            await page.click('[data-testid="task-item"]:has-text("Deploy Production")');
            await expect(page.locator('[data-testid="dependency-blocked"]')).toBeVisible();

            // Should show blocking dependencies
            await expect(page.locator('[data-testid="blocked-by"]')).toContainText('Setup CI/CD');
            await expect(page.locator('[data-testid="blocked-by"]')).toContainText('API Rate Limiting');
        });

        await test.step('Complete dependency tasks', async () => {
            // Complete first dependency
            await page.click('[data-testid="task-item"]:has-text("Setup CI/CD")');
            await page.click('[data-testid="mark-complete"]');
            await page.click('[data-testid="close-modal"]');

            // Check deployment task - still blocked
            await page.click('[data-testid="task-item"]:has-text("Deploy Production")');
            await expect(page.locator('[data-testid="dependency-blocked"]')).toBeVisible();
            await expect(page.locator('[data-testid="blocked-by"]')).toContainText('API Rate Limiting');

            // Complete second dependency
            await page.click('[data-testid="task-item"]:has-text("Implement API Rate Limiting")');
            await page.click('[data-testid="mark-complete"]');
            await page.click('[data-testid="close-modal"]');
        });

        // ==========================================
        // PHASE 3: Dependency Resolution
        // ==========================================

        await test.step('Verify dependency resolution', async () => {
            // Deployment task should now be available
            await page.click('[data-testid="task-item"]:has-text("Deploy Production")');
            await expect(page.locator('[data-testid="dependency-blocked"]')).not.toBeVisible();
            await expect(page.locator('[data-testid="ready-to-start"]')).toBeVisible();
        });

        await test.step('Complete deployment task', async () => {
            await page.click('[data-testid="accept-task-button"]');
            await page.fill('[data-testid="progress-note"]', 'Production environment deployed successfully');
            await page.fill('[data-testid="progress-percentage"]', '100');
            await page.click('[data-testid="mark-complete"]');
        });

        // ==========================================
        // VERIFICATION: Dependency Chain Success
        // ==========================================

        await test.step('Verify dependency chain completion', async () => {
            await page.click('[data-testid="nav-reports"]');
            await page.click('[data-testid="dependency-analytics"]');

            // Check dependency success metrics
            await expect(page.locator('[data-testid="dependency-chains-completed"]')).toContainText('1');
            await expect(page.locator('[data-testid="avg-resolution-time"]')).toBeVisible();

            // Check Gantt chart shows dependencies
            await expect(page.locator('[data-testid="dependency-gantt"]')).toBeVisible();
        });
    });

    test('task collaboration features', async ({ page, context }) => {
        // ==========================================
        // PHASE 1: Collaborative Task Creation
        // ==========================================

        await test.step('Create task with multiple assignees', async () => {
            await page.click('[data-testid="create-task-button"]');

            await page.fill('[data-testid="task-title"]', 'Implement Real-time Notifications');
            await page.selectOption('[data-testid="task-priority"]', 'high');

            // Add multiple assignees (collaborative task)
            await page.click('[data-testid="add-assignee"]');
            await page.selectOption('[data-testid="assignee-select"]', 'frontend-dev');
            await page.click('[data-testid="add-assignee"]');
            await page.selectOption('[data-testid="assignee-select"]', 'backend-dev');

            await page.click('[data-testid="save-task-button"]');
        });

        // ==========================================
        // PHASE 2: Collaborative Progress Updates
        // ==========================================

        await test.step('Collaborative progress tracking', async () => {
            // Frontend developer view
            await page.click('[data-testid="user-menu"]');
            await page.click('[data-testid="switch-user-frontend"]');

            await page.click('[data-testid="task-item"]:has-text("Real-time Notifications")');
            await page.fill('[data-testid="progress-note"]', 'Implemented frontend notification components');
            await page.fill('[data-testid="progress-percentage"]', '40');
            await page.click('[data-testid="update-progress"]');

            // Backend developer view (simulate another session)
            const newPage = await context.newPage();
            await newPage.goto('/login');
            await newPage.fill('[data-testid="email"]', 'backend@test.com');
            await newPage.fill('[data-testid="password"]', 'BackendPass123!');
            await newPage.click('[data-testid="login-button"]');

            await newPage.click('[data-testid="task-item"]:has-text("Real-time Notifications")');
            await newPage.fill('[data-testid="progress-note"]', 'Implemented backend notification service');
            await newPage.fill('[data-testid="progress-percentage"]', '35');
            await newPage.click('[data-testid="update-progress"]');

            // Check combined progress
            await page.reload();
            await expect(page.locator('[data-testid="combined-progress"]')).toContainText('75%');
        });

        // ==========================================
        // PHASE 3: Task Comments & Discussion
        // ==========================================

        await test.step('Add task comments and discussions', async () => {
            await page.click('[data-testid="comments-tab"]');

            // Add technical discussion
            await page.fill('[data-testid="comment-input"]', 'Should we use WebSockets or Server-Sent Events for real-time updates?');
            await page.click('[data-testid="post-comment"]');

            // Add reply
            await page.click('[data-testid="reply-button"]');
            await page.fill('[data-testid="reply-input"]', 'WebSockets would be better for bidirectional communication');
            await page.click('[data-testid="post-reply"]');

            // Add code snippet
            await page.click('[data-testid="code-snippet-button"]');
            await page.fill('[data-testid="code-input"]', 'const socket = new WebSocket(url);');
            await page.click('[data-testid="insert-code"]');
        });

        // ==========================================
        // PHASE 4: Task File Attachments
        // ==========================================

        await test.step('Add task attachments', async () => {
            await page.click('[data-testid="attachments-tab"]');

            // Upload design mockup
            await page.setInputFiles('[data-testid="file-upload"]', 'tests/fixtures/mockup.png');
            await page.fill('[data-testid="attachment-description"]', 'UI mockup for notification center');
            await page.click('[data-testid="upload-attachment"]');

            // Upload technical specification
            await page.setInputFiles('[data-testid="file-upload"]', 'tests/fixtures/tech-spec.pdf');
            await page.click('[data-testid="upload-attachment"]');

            await expect(page.locator('[data-testid="attachment-count"]')).toContainText('2');
        });

        // ==========================================
        // VERIFICATION: Collaboration Analytics
        // ==========================================

        await test.step('Verify collaboration metrics', async () => {
            // Switch back to admin view
            await page.click('[data-testid="user-menu"]');
            await page.click('[data-testid="switch-user-admin"]');

            await page.click('[data-testid="nav-reports"]');
            await page.click('[data-testid="collaboration-analytics"]');

            // Check collaboration metrics
            await expect(page.locator('[data-testid="collaborative-tasks"]')).toContainText('1');
            await expect(page.locator('[data-testid="avg-comments-per-task"]')).toBeVisible();
            await expect(page.locator('[data-testid="file-attachments-count"]')).toContainText('2');
        });
    });
});



