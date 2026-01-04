import { test, expect } from '@playwright/test';

test.describe('My Work Dashboard Flow', () => {
    test.describe('Dashboard Overview', () => {
        test('should display personalized work dashboard', async ({ page }) => {
            // Login as regular user
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Should land on My Work dashboard
            await expect(page.locator('text=My Work')).toBeVisible();
            await expect(page.locator('text=Dashboard')).toBeVisible();

            // Should show personalized greeting
            await expect(page.locator('text=Welcome back, User')).toBeVisible();
        });

        test('should show work summary widgets', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Should display key metrics
            await expect(page.locator('text=Active Tasks')).toBeVisible();
            await expect(page.locator('text=Pending Reviews')).toBeVisible();
            await expect(page.locator('text=Upcoming Deadlines')).toBeVisible();
            await expect(page.locator('text=Completed This Week')).toBeVisible();
        });

        test('should display recent activity feed', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Should show recent activity
            await expect(page.locator('text=Recent Activity')).toBeVisible();

            // Should have activity items
            const activityItems = page.locator('.activity-item');
            await expect(activityItems.first()).toBeVisible();
        });
    });

    test.describe('Task Management', () => {
        test('should display assigned tasks', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Navigate to Tasks tab
            await page.click('text=Tasks');

            // Should show task list
            await expect(page.locator('text=My Tasks')).toBeVisible();

            // Should have task items
            const taskItems = page.locator('.task-item');
            if (await taskItems.count() > 0) {
                await expect(taskItems.first()).toBeVisible();
                await expect(taskItems.first().locator('text=Due:')).toBeVisible();
                await expect(taskItems.first().locator('text=Priority:')).toBeVisible();
            }
        });

        test('should allow task status updates', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Tasks');

            // Find first task
            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                // Click to open task details
                await firstTask.click();

                // Update status to In Progress
                await page.selectOption('select[name="status"]', 'in_progress');
                await page.click('button:has-text("Update Status")');

                await expect(page.locator('text=Task updated')).toBeVisible();
                await expect(page.locator('text=In Progress')).toBeVisible();
            }
        });

        test('should filter tasks by status and priority', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Tasks');

            // Filter by status
            await page.selectOption('select[name="statusFilter"]', 'pending');
            await expect(page.locator('text=Showing pending tasks')).toBeVisible();

            // Filter by priority
            await page.selectOption('select[name="priorityFilter"]', 'high');
            await expect(page.locator('text=High priority tasks')).toBeVisible();
        });

        test('should show task deadlines and reminders', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Tasks');

            // Should show overdue tasks highlighted
            const overdueTasks = page.locator('.task-overdue');
            if (await overdueTasks.count() > 0) {
                await expect(overdueTasks.first()).toBeVisible();
            }

            // Should show tasks due soon
            const dueSoonTasks = page.locator('.task-due-soon');
            if (await dueSoonTasks.count() > 0) {
                await expect(dueSoonTasks.first()).toBeVisible();
            }
        });
    });

    test.describe('Initiative Tracking', () => {
        test('should display user initiatives', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Navigate to Initiatives tab
            await page.click('text=Initiatives');

            // Should show initiative list
            await expect(page.locator('text=My Initiatives')).toBeVisible();

            // Should display initiative cards
            const initiativeCards = page.locator('.initiative-card');
            if (await initiativeCards.count() > 0) {
                await expect(initiativeCards.first()).toBeVisible();
                await expect(initiativeCards.first().locator('.progress-bar')).toBeVisible();
            }
        });

        test('should show initiative progress and milestones', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Initiatives');

            const firstInitiative = page.locator('.initiative-card').first();
            if (await firstInitiative.count() > 0) {
                // Should show progress percentage
                await expect(firstInitiative.locator('text=%')).toBeVisible();

                // Should show status
                await expect(firstInitiative.locator('.status-badge')).toBeVisible();

                // Should show next milestone
                await expect(firstInitiative.locator('text=Next:')).toBeVisible();
            }
        });

        test('should allow initiative updates', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Initiatives');

            const firstInitiative = page.locator('.initiative-card').first();
            if (await firstInitiative.count() > 0) {
                await firstInitiative.click();

                // Update progress
                await page.fill('input[name="progress"]', '75');
                await page.fill('textarea[name="updateNotes"]', 'Made significant progress on implementation');
                await page.click('button:has-text("Update Progress")');

                await expect(page.locator('text=Progress updated')).toBeVisible();
                await expect(page.locator('text=75%')).toBeVisible();
            }
        });
    });

    test.describe('Decision Management', () => {
        test('should display pending decisions', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Decisions');

            // Should show decisions requiring user input
            await expect(page.locator('text=Pending Decisions')).toBeVisible();

            const decisionItems = page.locator('.decision-item');
            if (await decisionItems.count() > 0) {
                await expect(decisionItems.first().locator('text=Due:')).toBeVisible();
                await expect(decisionItems.first().locator('button:has-text("Review")')).toBeVisible();
            }
        });

        test('should allow decision making', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Decisions');

            const firstDecision = page.locator('.decision-item').first();
            if (await firstDecision.count() > 0) {
                await firstDecision.locator('button:has-text("Review")').click();

                // Make decision
                await page.click('button:has-text("Approve")');
                await page.fill('textarea[name="decisionNotes"]', 'Approved based on comprehensive analysis');
                await page.click('button:has-text("Submit Decision")');

                await expect(page.locator('text=Decision recorded')).toBeVisible();
            }
        });

        test('should show decision history', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Decisions');
            await page.click('text=History');

            // Should show past decisions
            await expect(page.locator('text=Decision History')).toBeVisible();

            const historyItems = page.locator('.decision-history-item');
            if (await historyItems.count() > 0) {
                await expect(historyItems.first().locator('text=Decision:')).toBeVisible();
                await expect(historyItems.first().locator('text=Made on:')).toBeVisible();
            }
        });
    });

    test.describe('Notifications and Alerts', () => {
        test('should display notifications inbox', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Inbox');

            // Should show notifications
            await expect(page.locator('text=Notifications')).toBeVisible();

            const notificationItems = page.locator('.notification-item');
            if (await notificationItems.count() > 0) {
                await expect(notificationItems.first().locator('text=From:')).toBeVisible();
                await expect(notificationItems.first().locator('text=Received:')).toBeVisible();
            }
        });

        test('should allow notification management', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Inbox');

            // Mark as read
            const unreadNotifications = page.locator('.notification-unread');
            if (await unreadNotifications.count() > 0) {
                await unreadNotifications.first().click();
                await page.click('button:has-text("Mark as Read")');
                await expect(page.locator('text=Notification marked as read')).toBeVisible();
            }

            // Bulk actions
            await page.click('button:has-text("Select All")');
            await page.click('button:has-text("Mark Selected as Read")');
            await expect(page.locator('text=Notifications updated')).toBeVisible();
        });

        test('should show urgent alerts prominently', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Urgent alerts should be visible in main dashboard
            const urgentAlerts = page.locator('.alert-urgent');
            if (await urgentAlerts.count() > 0) {
                await expect(urgentAlerts.first()).toBeVisible();
                await expect(urgentAlerts.first().locator('.alert-icon')).toBeVisible();
            }

            // Should also appear in inbox
            await page.click('text=Inbox');
            const urgentNotifications = page.locator('.notification-urgent');
            if (await urgentNotifications.count() > 0) {
                await expect(urgentNotifications.first()).toBeVisible();
            }
        });
    });

    test.describe('Workload Management', () => {
        test('should display workload overview', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Workload');

            // Should show workload visualization
            await expect(page.locator('text=Workload Overview')).toBeVisible();
            await expect(page.locator('.workload-chart')).toBeVisible();
        });

        test('should show capacity and availability', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Workload');

            // Should show capacity indicators
            await expect(page.locator('text=Current Capacity')).toBeVisible();
            await expect(page.locator('.capacity-indicator')).toBeVisible();

            // Should show availability calendar
            await expect(page.locator('text=Availability')).toBeVisible();
            await expect(page.locator('.availability-calendar')).toBeVisible();
        });

        test('should allow workload adjustments', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Workload');
            await page.click('text=Adjust Capacity');

            // Update availability
            await page.selectOption('select[name="availability"]', '80%');
            await page.fill('textarea[name="notes"]', 'Reduced capacity due to training');

            await page.click('button:has-text("Update Capacity")');

            await expect(page.locator('text=Workload updated')).toBeVisible();
        });
    });

    test.describe('Focus Mode', () => {
        test('should enable focus mode for deep work', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Enable focus mode
            await page.click('button:has-text("Focus Mode")');

            // Should minimize distractions
            await expect(page.locator('.focus-overlay')).toBeVisible();
            await expect(page.locator('text=Distracting elements hidden')).toBeVisible();

            // Should show focus timer
            await expect(page.locator('.focus-timer')).toBeVisible();

            // Should allow selecting focus task
            await page.selectOption('select[name="focusTask"]', 'task-1');
            await page.click('button:has-text("Start Focus Session")');

            await expect(page.locator('text=Focus session started')).toBeVisible();
        });

        test('should track focus session productivity', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('button:has-text("Focus Mode")');
            await page.selectOption('select[name="focusTask"]', 'task-1');
            await page.click('button:has-text("Start Focus Session")');

            // Simulate session completion
            await page.click('button:has-text("Complete Session")');
            await page.selectOption('select[name="productivity"]', 'high');
            await page.fill('textarea[name="sessionNotes"]', 'Very productive session, completed key deliverables');
            await page.click('button:has-text("Save Session")');

            await expect(page.locator('text=Focus session completed')).toBeVisible();

            // Should update productivity metrics
            await page.click('text=Productivity');
            await expect(page.locator('text=High productivity session')).toBeVisible();
        });
    });

    test.describe('Time Tracking', () => {
        test('should track time on tasks', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Tasks');

            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();

                // Start time tracking
                await page.click('button:has-text("Start Timer")');
                await expect(page.locator('text=Timer running')).toBeVisible();
                await expect(page.locator('.time-display')).toBeVisible();

                // Stop timer after some time
                await page.waitForTimeout(2000); // Wait 2 seconds
                await page.click('button:has-text("Stop Timer")');

                await expect(page.locator('text=Time logged:')).toBeVisible();
                await expect(page.locator('input[name="timeSpent"]')).not.toHaveValue('');

                // Save time entry
                await page.fill('textarea[name="workDescription"]', 'Worked on task implementation');
                await page.click('button:has-text("Log Time")');

                await expect(page.locator('text=Time logged successfully')).toBeVisible();
            }
        });

        test('should show time tracking reports', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Time Tracking');

            // Should show time reports
            await expect(page.locator('text=Time Reports')).toBeVisible();
            await expect(page.locator('text=Total Hours This Week')).toBeVisible();
            await expect(page.locator('.time-chart')).toBeVisible();

            // Should allow filtering by date range
            await page.fill('input[name="startDate"]', '2024-01-01');
            await page.fill('input[name="endDate"]', '2024-01-31');
            await page.click('button:has-text("Filter")');

            await expect(page.locator('text=Showing time entries for January')).toBeVisible();
        });
    });

    test.describe('Collaboration Features', () => {
        test('should show team activity', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Team');

            // Should show team activity feed
            await expect(page.locator('text=Team Activity')).toBeVisible();

            const activityItems = page.locator('.team-activity-item');
            if (await activityItems.count() > 0) {
                await expect(activityItems.first()).toBeVisible();
                await expect(activityItems.first().locator('text=by')).toBeVisible();
            }
        });

        test('should allow quick team communication', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('text=Team');

            // Send quick message
            await page.fill('input[name="quickMessage"]', 'Quick update: Task completed ahead of schedule');
            await page.click('button:has-text("Send")');

            await expect(page.locator('text=Message sent')).toBeVisible();

            // Should appear in activity feed
            await expect(page.locator('text=Quick update: Task completed ahead of schedule')).toBeVisible();
        });
    });

    test.describe('Personalization', () => {
        test('should remember user preferences', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Set dashboard preferences
            await page.click('button:has-text("Customize Dashboard")');
            await page.check('input[name="showCompletedTasks"]');
            await page.uncheck('input[name="showOverdueAlerts"]');
            await page.selectOption('select[name="defaultView"]', 'kanban');
            await page.click('button:has-text("Save Preferences")');

            await expect(page.locator('text=Preferences saved')).toBeVisible();

            // Reload page - preferences should persist
            await page.reload();

            await expect(page.locator('text=Kanban View')).toBeVisible();
            // Should show completed tasks and hide overdue alerts
        });

        test('should allow dashboard customization', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            await page.click('button:has-text("Customize Dashboard")');

            // Rearrange widgets
            await page.dragAndDrop('.widget-tasks', '.widget-deadlines');
            await page.click('button:has-text("Save Layout")');

            await expect(page.locator('text=Dashboard layout saved')).toBeVisible();

            // Add new widget
            await page.click('button:has-text("Add Widget")');
            await page.click('text=Weather Widget');
            await page.click('button:has-text("Add to Dashboard")');

            await expect(page.locator('.weather-widget')).toBeVisible();
        });
    });

    test.describe('Mobile Responsiveness', () => {
        test('should work on mobile devices', async ({ page, browser }) => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });

            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Should show mobile-optimized dashboard
            await expect(page.locator('text=My Work')).toBeVisible();

            // Test mobile navigation
            await page.click('.mobile-menu-toggle');
            await expect(page.locator('.mobile-menu')).toBeVisible();

            // Test task interaction on mobile
            await page.click('text=Tasks');
            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();
                await expect(page.locator('.task-details-modal')).toBeVisible();
            }
        });
    });

    test.describe('Offline Capability', () => {
        test('should handle offline scenarios gracefully', async ({ page }) => {
            await page.goto('/');
            await page.click('text=Log In');
            await page.fill('input[type="email"]', 'user@example.com');
            await page.fill('input[type="password"]', 'userpass');
            await page.click('button[type="submit"]');

            // Simulate going offline
            await page.context().setOffline(true);

            // Try to perform action
            await page.click('text=Tasks');
            const firstTask = page.locator('.task-item').first();
            if (await firstTask.count() > 0) {
                await firstTask.click();

                // Should show offline indicator
                await expect(page.locator('text=You are currently offline')).toBeVisible();
                await expect(page.locator('text=Changes will sync when connection is restored')).toBeVisible();
            }

            // Restore connection
            await page.context().setOffline(false);
            await expect(page.locator('text=Connection restored')).toBeVisible();
        });
    });
});













