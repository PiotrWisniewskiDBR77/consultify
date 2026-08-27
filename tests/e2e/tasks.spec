import { test, expect } from '@playwright/test';

test.describe('Task Management Flow', () => {
    test.describe('Task Creation', () => {
        test('should create a new task', async ({ page }) => {
            // Login first
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            // Click create new task
            await page.click('button:has-text("New Task")');

            // Fill task details
            await page.fill('input[name="title"]', 'Implement user authentication');
            await page.fill('textarea[name="description"]', 'Implement secure user authentication with JWT tokens and password hashing');
            await page.selectOption('select[name="priority"]', 'high');
            await page.selectOption('select[name="assignee"]', 'user@example.com');
            await page.fill('input[name="dueDate"]', '2024-02-15');

            // Add tags
            await page.fill('input[name="tags"]', 'authentication,security,backend');
            await page.click('button:has-text("Add Tag")');

            await page.click('button:has-text("Create Task")');

            // Should show success message
            await expect(page.locator('text=Task created successfully')).toBeVisible();

            // Should appear in task list
            await expect(page.locator('text=Implement user authentication')).toBeVisible();
        });

        test('should validate task creation form', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('button:has-text("New Task")');

            // Try to submit empty form
            await page.click('button:has-text("Create Task")');

            // Should show validation errors
            await expect(page.locator('text=Title is required')).toBeVisible();
            await expect(page.locator('text=Description is required')).toBeVisible();

            // Test invalid due date
            await page.fill('input[name="title"]', 'Test Task');
            await page.fill('textarea[name="description"]', 'Test description');
            await page.fill('input[name="dueDate"]', '2020-01-01'); // Past date
            await page.click('button:has-text("Create Task")');

            await expect(page.locator('text=Due date cannot be in the past')).toBeVisible();
        });

        test('should create task templates', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('button:has-text("New Task")');
            await page.click('text=Use Template');

            // Select template
            await page.click('text=Code Review Template');
            await page.click('button:has-text("Apply Template")');

            // Should pre-fill form with template data
            await expect(page.locator('input[name="title"]')).toHaveValue('Code Review');
            await expect(page.locator('textarea[name="description"]')).toContainText('Review code changes');
            await expect(page.locator('text=code-review')).toBeVisible();
        });
    });

    test.describe('Task Management', () => {
        test('should update task status', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            // Find first task
            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();

                // Update status to In Progress
                await page.selectOption('select[name="status"]', 'in_progress');
                await page.fill('textarea[name="statusComment"]', 'Started working on this task');
                await page.click('button:has-text("Update Status")');

                await expect(page.locator('text=Task status updated')).toBeVisible();
                await expect(page.locator('.status-badge').filter({ hasText: 'In Progress' })).toBeVisible();
            }
        });

        test('should reassign tasks', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();

                // Reassign task
                await page.selectOption('select[name="assignee"]', 'newuser@example.com');
                await page.fill('textarea[name="assignmentNote"]', 'Reassigning due to workload');
                await page.click('button:has-text("Reassign Task")');

                await expect(page.locator('text=Task reassigned successfully')).toBeVisible();
                await expect(page.locator('text=newuser@example.com')).toBeVisible();
            }
        });

        test('should set task dependencies', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            // Create two tasks first
            await page.click('button:has-text("New Task")');
            await page.fill('input[name="title"]', 'Task A');
            await page.fill('textarea[name="description"]', 'First task');
            await page.click('button:has-text("Create Task")');

            await page.click('button:has-text("New Task")');
            await page.fill('input[name="title"]', 'Task B');
            await page.fill('textarea[name="description"]', 'Second task that depends on first');
            await page.click('button:has-text("Create Task")');

            // Set dependency
            const taskB = page.locator('.task-item').filter({ hasText: 'Task B' });
            await taskB.click();

            await page.click('button:has-text("Add Dependency")');
            await page.click('text=Task A');
            await page.click('button:has-text("Set Dependency")');

            await expect(page.locator('text=Dependency added')).toBeVisible();
            await expect(page.locator('text=Depends on: Task A')).toBeVisible();
        });
    });

    test.describe('Task Filtering and Search', () => {
        test('should filter tasks by status', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            // Filter by status
            await page.selectOption('select[name="statusFilter"]', 'completed');
            await expect(page.locator('text=Showing completed tasks')).toBeVisible();

            // All visible tasks should have completed status
            const taskItems = page.locator('.task-item');
            const count = await taskItems.count();
            for (let i = 0; i < count; i++) {
                await expect(taskItems.nth(i)).toContainText('Completed');
            }
        });

        test('should filter tasks by assignee', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            await page.selectOption('select[name="assigneeFilter"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await expect(page.locator('text=Showing tasks assigned to admin@dbr77.com')).toBeVisible();
        });

        test('should search tasks by title and description', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            // Search for specific task
            await page.fill('input[name="search"]', 'authentication');
            await page.click('button:has-text("Search")');

            // Should show only matching tasks
            await expect(page.locator('text=authentication')).toBeVisible();

            // Clear search
            await page.click('button:has-text("Clear Search")');
            await expect(page.locator('input[name="search"]')).toHaveValue('');
        });

        test('should sort tasks by different criteria', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            // Sort by due date
            await page.selectOption('select[name="sortBy"]', 'dueDate');
            await page.selectOption('select[name="sortOrder"]', 'asc');

            // Tasks should be sorted by due date
            const taskItems = page.locator('.task-item');
            if (await taskItems.count() > 1) {
                // Check that first task has earlier due date than second
                const firstTaskDate = await taskItems.first().locator('.due-date').textContent();
                const secondTaskDate = await taskItems.nth(1).locator('.due-date').textContent();

                const firstDate = new Date(firstTaskDate || '');
                const secondDate = new Date(secondTaskDate || '');

                expect(firstDate.getTime()).toBeLessThanOrEqual(secondDate.getTime());
            }
        });
    });

    test.describe('Task Comments and Collaboration', () => {
        test('should add comments to tasks', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();

                // Add comment
                await page.fill('textarea[name="comment"]', 'This task needs more clarification on the requirements.');
                await page.click('button:has-text("Add Comment")');

                await expect(page.locator('text=Comment added')).toBeVisible();
                await expect(page.locator('text=This task needs more clarification')).toBeVisible();
                await expect(page.locator('text=admin@dbr77.com')).toBeVisible();
            }
        });

        test('should mention users in comments', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();

                // Add comment with mention
                await page.fill('textarea[name="comment"]', '@user@example.com can you provide more details on this requirement?');
                await page.click('button:has-text("Add Comment")');

                await expect(page.locator('text=Comment added')).toBeVisible();
                await expect(page.locator('text=@user@example.com')).toBeVisible();

                // Should show notification indicator
                await expect(page.locator('.mention-notification')).toBeVisible();
            }
        });

        test('should attach files to tasks', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();

                // Attach file
                const fileInput = page.locator('input[type="file"]');
                await fileInput.setInputFiles('./test-files/requirements.pdf');

                await page.click('button:has-text("Upload Attachment")');

                await expect(page.locator('text=File uploaded successfully')).toBeVisible();
                await expect(page.locator('text=requirements.pdf')).toBeVisible();
                await expect(page.locator('button:has-text("Download")')).toBeVisible();
            }
        });
    });

    test.describe('Task Time Tracking', () => {
        test('should track time spent on tasks', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();

                // Start timer
                await page.click('button:has-text("Start Timer")');
                await expect(page.locator('text=Timer started')).toBeVisible();
                await expect(page.locator('.timer-running')).toBeVisible();

                // Wait a bit
                await page.waitForTimeout(3000);

                // Stop timer
                await page.click('button:has-text("Stop Timer")');
                await expect(page.locator('text=Time logged')).toBeVisible();

                // Should show time entry
                await expect(page.locator('.time-entry')).toBeVisible();
                await expect(page.locator('text=0:00:03')).toBeVisible(); // Approximately 3 seconds
            }
        });

        test('should manually log time', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');

            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();

                // Manual time entry
                await page.click('button:has-text("Log Time Manually")');
                await page.fill('input[name="hours"]', '2');
                await page.fill('input[name="minutes"]', '30');
                await page.fill('textarea[name="description"]', 'Worked on implementing the feature');
                await page.click('button:has-text("Save Time Entry")');

                await expect(page.locator('text=Time logged successfully')).toBeVisible();
                await expect(page.locator('text=2h 30m')).toBeVisible();
            }
        });

        test('should show time tracking reports', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('text=Time Reports');

            // Should show time tracking summary
            await expect(page.locator('text=Time Tracking Summary')).toBeVisible();
            await expect(page.locator('text=Total Time Logged')).toBeVisible();
            await expect(page.locator('text=Average Task Time')).toBeVisible();

            // Should show time by task
            await expect(page.locator('.time-by-task-chart')).toBeVisible();
        });
    });

    test.describe('Task Templates and Automation', () => {
        test('should create task templates', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('text=Templates');
            await page.click('button:has-text("Create Template")');

            // Fill template details
            await page.fill('input[name="templateName"]', 'Bug Fix Template');
            await page.fill('input[name="defaultTitle"]', 'Fix: {bug_description}');
            await page.fill('textarea[name="defaultDescription"]', 'Fix the reported bug with the following symptoms...');
            await page.selectOption('select[name="defaultPriority"]', 'high');
            await page.fill('input[name="estimatedHours"]', '4');

            // Add subtasks
            await page.click('button:has-text("Add Subtask")');
            await page.fill('input[name="subtask1"]', 'Reproduce the bug');
            await page.click('button:has-text("Add Subtask")');
            await page.fill('input[name="subtask2"]', 'Identify root cause');
            await page.click('button:has-text("Add Subtask")');
            await page.fill('input[name="subtask3"]', 'Implement fix');

            await page.click('button:has-text("Save Template")');

            await expect(page.locator('text=Template saved successfully')).toBeVisible();
            await expect(page.locator('text=Bug Fix Template')).toBeVisible();
        });

        test('should apply automation rules', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('text=Automation Rules');
            await page.click('button:has-text("Create Rule")');

            // Create automation rule
            await page.fill('input[name="ruleName"]', 'High Priority Bug Auto-Assignment');
            await page.selectOption('select[name="trigger"]', 'task_created');
            await page.fill('input[name="condition"]', 'priority == "high" AND type == "bug"');
            await page.selectOption('select[name="action"]', 'assign_to');
            await page.selectOption('select[name="assignee"]', 'senior-dev@example.com');

            await page.click('button:has-text("Save Rule")');

            await expect(page.locator('text=Automation rule saved')).toBeVisible();

            // Test rule by creating matching task
            await page.click('button:has-text("New Task")');
            await page.fill('input[name="title"]', 'Critical Bug: Login Broken');
            await page.fill('textarea[name="description"]', 'Users cannot log in');
            await page.selectOption('select[name="priority"]', 'high');
            await page.fill('input[name="tags"]', 'bug');
            await page.click('button:has-text("Create Task")');

            // Should be auto-assigned
            await expect(page.locator('text=senior-dev@example.com')).toBeVisible();
        });
    });

    test.describe('Task Boards and Views', () => {
        test('should display kanban board view', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('button:has-text("Kanban View")');

            // Should show kanban columns
            await expect(page.locator('text=To Do')).toBeVisible();
            await expect(page.locator('text=In Progress')).toBeVisible();
            await expect(page.locator('text=Review')).toBeVisible();
            await expect(page.locator('text=Done')).toBeVisible();

            // Should allow drag and drop
            const taskCard = page.locator('.kanban-card').first();
            if (await taskCard.count() > 0) {
                const todoColumn = page.locator('.kanban-column').filter({ hasText: 'To Do' });
                const inProgressColumn = page.locator('.kanban-column').filter({ hasText: 'In Progress' });

                // Drag from To Do to In Progress
                await taskCard.dragTo(inProgressColumn);

                await expect(page.locator('text=Task status updated to In Progress')).toBeVisible();
            }
        });

        test('should display calendar view', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('button:has-text("Calendar View")');

            // Should show calendar
            await expect(page.locator('.calendar')).toBeVisible();

            // Should show tasks on their due dates
            const todayTasks = page.locator('.calendar-day.today .task-indicator');
            if (await todayTasks.count() > 0) {
                await todayTasks.first().click();
                await expect(page.locator('.task-details-popover')).toBeVisible();
            }
        });

        test('should display timeline view', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('button:has-text("Timeline View")');

            // Should show Gantt-style timeline
            await expect(page.locator('.timeline')).toBeVisible();
            await expect(page.locator('.timeline-bar')).toBeVisible();

            // Should show dependencies
            const dependencyLines = page.locator('.dependency-line');
            if (await dependencyLines.count() > 0) {
                await expect(dependencyLines.first()).toBeVisible();
            }
        });
    });

    test.describe('Task Analytics and Reporting', () => {
        test('should show task completion metrics', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('text=Analytics');

            // Should show completion metrics
            await expect(page.locator('text=Task Completion Rate')).toBeVisible();
            await expect(page.locator('text=Average Completion Time')).toBeVisible();
            await expect(page.locator('text=Tasks Completed This Month')).toBeVisible();

            // Should show charts
            await expect(page.locator('.completion-chart')).toBeVisible();
            await expect(page.locator('.velocity-chart')).toBeVisible();
        });

        test('should generate task reports', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('text=Reports');
            await page.click('button:has-text("Generate Report")');

            // Configure report
            await page.selectOption('select[name="reportType"]', 'completion_summary');
            await page.fill('input[name="startDate"]', '2024-01-01');
            await page.fill('input[name="endDate"]', '2024-12-31');
            await page.selectOption('select[name="format"]', 'pdf');

            await page.click('button:has-text("Generate")');

            await expect(page.locator('text=Report generation started')).toBeVisible();

            // Should show download link when ready
            await page.waitForSelector('button:has-text("Download Report")', { timeout: 30000 });
            await expect(page.locator('button:has-text("Download Report")')).toBeVisible();
        });

        test('should show team productivity metrics', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('text=Team Analytics');

            // Should show team metrics
            await expect(page.locator('text=Team Productivity')).toBeVisible();
            await expect(page.locator('text=Tasks per Team Member')).toBeVisible();
            await expect(page.locator('text=Average Resolution Time')).toBeVisible();

            // Should show individual performance
            const teamMembers = page.locator('.team-member-row');
            if (await teamMembers.count() > 0) {
                await expect(teamMembers.first().locator('.performance-score')).toBeVisible();
            }
        });
    });

    test.describe('Task Integration', () => {
        test('should integrate with project milestones', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/projects');
            await page.click('text=Test Project');
            await page.click('text=Milestones');

            // Create milestone
            await page.click('button:has-text("Add Milestone")');
            await page.fill('input[name="title"]', 'Phase 1 Complete');
            await page.fill('input[name="dueDate"]', '2024-03-15');
            await page.click('button:has-text("Create Milestone")');

            // Should automatically create related tasks
            await page.goto('/tasks');
            await expect(page.locator('text=Phase 1 Complete')).toBeVisible();

            // Tasks should be linked to milestone
            const milestoneTask = page.locator('.task-item').filter({ hasText: 'Phase 1 Complete' });
            await milestoneTask.click();
            await expect(page.locator('text=Linked to milestone: Phase 1 Complete')).toBeVisible();
        });

        test('should integrate with AI assistant', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('button:has-text("New Task")');

            // Use AI to help create task
            await page.click('button:has-text("AI Assist")');
            await page.fill('textarea[name="aiPrompt"]', 'Create a task for implementing user profile management with avatar upload');
            await page.click('button:has-text("Generate")');

            // Should populate form with AI suggestions
            await expect(page.locator('input[name="title"]')).toHaveValue('Implement User Profile Management');
            await expect(page.locator('textarea[name="description"]')).toContainText('avatar upload');

            // AI should suggest subtasks
            await expect(page.locator('text=Subtasks suggested by AI')).toBeVisible();
            await expect(page.locator('text=Create profile database schema')).toBeVisible();
            await expect(page.locator('text=Implement avatar upload functionality')).toBeVisible();
        });

        test('should sync with external systems', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
            await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
            await page.click('button[type="submit"]');

            await page.goto('/tasks');
            await page.click('text=Integrations');
            await page.click('text=Jira');

            // Link task to Jira issue
            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();
                await page.click('button:has-text("Link to Jira")');
                await page.fill('input[name="jiraIssueKey"]', 'PROJ-123');
                await page.click('button:has-text("Link Issue")');

                await expect(page.locator('text=Jira issue linked')).toBeVisible();
                await expect(page.locator('text=PROJ-123')).toBeVisible();

                // Status should sync
                await expect(page.locator('.sync-status')).toBeVisible();
            }
        });
    });
});














