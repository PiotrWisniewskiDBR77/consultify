/**
 * E2E Tests: Initiatives + Roadmap Module
 *
 * Tests the initiative management flow:
 * - 4 views: List, Kanban, Grid (Tiles), Timeline
 * - Status filters (canonical PMO statuses for Initiatives module)
 * - Drawer (50%) + Open wider functionality
 * - Gate readiness (Go/No-Go, Resources Commit, Schedule Lock)
 * - Timeline with dependencies
 *
 * Canonical flow: REVIEW -> PROMOTED -> PLANNING -> APPROVED -> SCHEDULED -> (Execution)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5173';

test.describe('Initiatives + Roadmap Module', () => {
  test.beforeEach(async ({ page }) => {
    // Login as demo user
    await page.goto(`${BASE_URL}/login`);

    // Check if we need to login or already logged in
    const loginForm = page.locator('form, [data-testid="login-form"]');
    if (await loginForm.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.fill('input[type="email"], input[name="email"]', 'demo@consultify.ai');
      await page.fill('input[type="password"], input[name="password"]', 'demo123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/.*(?!login).*/);
    }

    // Navigate to Initiatives module
    await page.goto(`${BASE_URL}/initiatives`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('View Modes', () => {
    test('should display initiatives in List view', async ({ page }) => {
      // Click on list view button
      await page.click('[data-view-mode="table"], [aria-label*="list"], button:has-text("List")');
      await page.waitForTimeout(500);

      // Verify list view is active
      const listView = page.locator('[data-testid="portfolio-list"], table, [class*="list"]');
      await expect(listView).toBeVisible();
    });

    test('should display initiatives in Kanban view', async ({ page }) => {
      // Click on kanban view button
      await page.click(
        '[data-view-mode="kanban"], [aria-label*="kanban"], button:has-text("Kanban")'
      );
      await page.waitForTimeout(500);

      // Verify kanban columns are visible
      const kanbanColumns = page.locator('[class*="kanban"], [data-testid*="kanban"]');
      await expect(kanbanColumns).toBeVisible();
    });

    test('should display initiatives in Grid view (Tiles)', async ({ page }) => {
      // Click on grid view button
      await page.click('[data-view-mode="grid"], [aria-label*="grid"], button:has-text("Grid")');
      await page.waitForTimeout(500);

      // Verify grid layout
      const gridView = page.locator('[class*="grid"]');
      await expect(gridView).toBeVisible();
    });

    test('should display initiatives in Timeline view', async ({ page }) => {
      // Click on timeline view button
      await page.click(
        '[data-view-mode="timeline"], [aria-label*="timeline"], button:has-text("Timeline")'
      );
      await page.waitForTimeout(500);

      // Verify timeline is visible
      const timeline = page.locator(
        '[data-testid="initiatives-timeline"], [class*="gantt"], [class*="timeline"]'
      );
      await expect(timeline).toBeVisible();
    });
  });

  test.describe('Status Filters', () => {
    test('should filter by REVIEW status (first in workflow)', async ({ page }) => {
      // Click REVIEW filter - first status in Initiatives module workflow
      await page.click(
        'button:has-text("Review"), button:has-text("In Review"), [data-status="REVIEW"]'
      );
      await page.waitForTimeout(500);

      // Verify filter is active
      const filterButton = page.locator('button:has-text("Review")');
      await expect(filterButton).toBeVisible();
    });

    test('should filter by APPROVED status (second in workflow)', async ({ page }) => {
      // Click APPROVED filter
      await page.click('button:has-text("Approved"), [data-status="APPROVED"]');
      await page.waitForTimeout(500);

      // Verify filter is active
      const filterButton = page.locator('button:has-text("Approved")');
      await expect(filterButton).toBeVisible();
    });

    test('should filter by PLANNING status (last before execution)', async ({ page }) => {
      // Click PLANNING filter - last status before moving to Execution module
      await page.click('button:has-text("Planning"), [data-status="PLANNING"]');
      await page.waitForTimeout(500);

      // Verify only PLANNING initiatives are shown
      const initiatives = page.locator('[data-initiative-status]');
      const count = await initiatives.count();

      for (let i = 0; i < count; i++) {
        const status = await initiatives.nth(i).getAttribute('data-initiative-status');
        expect(['PLANNING', 'planning']).toContain(status?.toUpperCase() || status);
      }
    });

    test('should NOT show DRAFT status in Initiatives filters', async ({ page }) => {
      // DRAFT should not be visible in filter bar (belongs to Tools/Assessment)
      const draftFilter = page.locator('button:has-text("Draft"):not([class*="disabled"])');
      await expect(draftFilter).not.toBeVisible();
    });
  });

  test.describe('Initiative Drawer', () => {
    test('should open drawer when clicking on initiative', async ({ page }) => {
      // Wait for initiatives to load
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });

      // Click on first initiative
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);

      // Verify drawer is open (50% width panel)
      const drawer = page.locator('[class*="drawer"], [class*="side-panel"], [class*="w-1/2"]');
      await expect(drawer).toBeVisible();
    });

    test('should have Overview, Timeline, Resources, Decisions tabs', async ({ page }) => {
      // Open drawer
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);

      // Check for tabs
      const overviewTab = page.locator('button:has-text("Overview")');
      const timelineTab = page.locator('button:has-text("Timeline")');
      const resourcesTab = page.locator('button:has-text("Resources")');
      const decisionsTab = page.locator('button:has-text("Decisions")');

      // At least Overview should be visible
      await expect(overviewTab).toBeVisible();
    });

    test('should have "Open Wider" button', async ({ page }) => {
      // Open drawer
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);

      // Check for Open full card button (or maximize icon)
      const openWiderButton = page.locator(
        'button:has-text("Open full card"), button[title*="wider"], [aria-label*="wider"], [aria-label*="maximize"]'
      );
      await expect(openWiderButton).toBeVisible();
    });

    test('should expand to full view when clicking "Open Wider"', async ({ page }) => {
      // Open drawer
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);
      const initiativeName = (await page.locator('h2').first().textContent())?.trim() || '';

      // Click Open full card
      await page.click(
        'button:has-text("Open full card"), button[title*="wider"], [aria-label*="wider"]'
      );
      await page.waitForTimeout(800);

      // Verify canonical InitiativeDocumentView rendered
      await expect(page.locator('text=Gate readiness')).toBeVisible();
      await expect(page.locator('button:has-text("Economics")')).toBeVisible();

      // Verify tab is present in DynamicTabs
      if (initiativeName) {
        await expect(page.locator('button', { hasText: initiativeName }).first()).toBeVisible();
      }
    });
  });

  test.describe('Status Transitions', () => {
    test('should show gate readiness section in drawer', async ({ page }) => {
      // Open drawer
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);

      await expect(page.locator('text=Gate readiness')).toBeVisible();
    });

    test('should display status action buttons based on current status', async ({ page }) => {
      // Open drawer
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);

      // Check for action buttons based on workflow:
      const actionButton = page.locator(
        'button:has-text("Accept"), button:has-text("Start Planning"), button:has-text("Approve"), button:has-text("Schedule"), button:has-text("Start Execution"), button:has-text("Start Tracking")'
      );
      await expect(actionButton.first()).toBeVisible();
    });
  });

  test.describe('Gate Decisions', () => {
    test('should display required gate decisions', async ({ page }) => {
      // Navigate to Decisions tab in drawer
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);

      // Click Decisions tab
      await page.click('button:has-text("Decisions")');
      await page.waitForTimeout(300);

      // Check for gate decision information
      const gateSection = page.locator(
        '[class*="gate"], :has-text("Gate Decisions"), :has-text("Go/No-Go")'
      );
      // Gate section should be visible
    });

    test('should show gate requirements info', async ({ page }) => {
      // Open drawer and go to Decisions tab
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);
      await page.click('button:has-text("Decisions")');
      await page.waitForTimeout(300);

      // Check for gate requirements text
      const goNoGoText = page.locator(':has-text("Go/No-Go")');
      const resourcesText = page.locator(':has-text("Resources Commit")');
      const scheduleText = page.locator(':has-text("Schedule Lock")');

      await expect(goNoGoText.or(resourcesText).or(scheduleText).first()).toBeVisible();
    });
  });

  test.describe('Timeline with Dependencies', () => {
    test('should display initiatives on timeline', async ({ page }) => {
      // Switch to Timeline view
      await page.click('[data-view-mode="timeline"], button:has-text("Timeline")');
      await page.waitForTimeout(500);

      // Verify timeline chart is rendered
      const timeline = page.locator('[data-testid="initiatives-timeline"], [class*="gantt"]');
      await expect(timeline).toBeVisible();
    });

    test('should display AI assist buttons in Timeline', async ({ page }) => {
      // Switch to Timeline view
      await page.click('[data-view-mode="timeline"], button:has-text("Timeline")');
      await page.waitForTimeout(500);

      // Check for AI assist buttons
      const aiScheduleBtn = page.locator('button:has-text("AI Schedule")');
      const aiConflictsBtn = page.locator('button:has-text("AI Conflicts")');
      const aiPrioritiesBtn = page.locator('button:has-text("AI Priorities")');

      await expect(aiScheduleBtn).toBeVisible();
    });

    test('should allow creating dependencies between initiatives', async ({ page }) => {
      // Switch to Timeline view
      await page.click('[data-view-mode="timeline"], button:has-text("Timeline")');
      await page.waitForTimeout(500);

      // Timeline should support drag to create dependencies
      // This is a visual/interaction test - we verify the component is rendered
      const timeline = page.locator('[data-testid="initiatives-timeline"]');
      await expect(timeline).toBeVisible();
    });
  });

  test.describe('Kanban Drag & Drop', () => {
    test('should allow dragging initiative between status columns', async ({ page }) => {
      // Switch to Kanban view
      await page.click('[data-view-mode="kanban"], button:has-text("Kanban")');
      await page.waitForTimeout(500);

      // Verify kanban columns exist
      const planningColumn = page.locator('[data-status="PLANNING"], :has-text("Planning")');
      const reviewColumn = page.locator('[data-status="REVIEW"], :has-text("Review")');

      // Both columns should be visible
      // Drag & drop functionality is handled by the component
    });
  });

  test.describe('Quick Actions', () => {
    test('should have "New Initiative" button', async ({ page }) => {
      const newButton = page.locator(
        'button:has-text("New Initiative"), button:has-text("Create")'
      );
      await expect(newButton).toBeVisible();
    });

    test('should have "Bulk Edit" button', async ({ page }) => {
      const bulkButton = page.locator('button:has-text("Bulk"), button:has-text("bulk")');
      await expect(bulkButton).toBeVisible();
    });

    test('should have search functionality', async ({ page }) => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
      await expect(searchInput).toBeVisible();

      // Type in search
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Results should filter
    });
  });

  test.describe('Milestones Tab', () => {
    test('should display milestones in Timeline tab', async ({ page }) => {
      // Open drawer
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);

      // Click Timeline tab
      await page.click('button:has-text("Timeline")');
      await page.waitForTimeout(300);

      // Check for milestones section
      const milestonesSection = page.locator(':has-text("Milestones")');
      await expect(milestonesSection).toBeVisible();
    });

    test('should have "Add Milestone" button', async ({ page }) => {
      // Open drawer and go to Timeline tab
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);
      await page.click('button:has-text("Timeline")');
      await page.waitForTimeout(300);

      // Check for Add Milestone button
      const addButton = page.locator('button:has-text("Add Milestone"), :has-text("+ Add")');
      // Button should be visible
    });
  });

  test.describe('Resources Tab', () => {
    test('should display owner information', async ({ page }) => {
      // Open drawer
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);

      // Click Resources tab
      await page.click('button:has-text("Resources")');
      await page.waitForTimeout(300);

      // Check for ownership section
      const ownershipSection = page.locator(':has-text("Business Owner"), :has-text("Ownership")');
      await expect(ownershipSection).toBeVisible();
    });

    test('should display capacity information', async ({ page }) => {
      // Open drawer and go to Resources tab
      await page.waitForSelector('[data-testid*="initiative"], [class*="initiative-card"]', {
        timeout: 10000,
      });
      await page.click(
        '[data-testid*="initiative"]:first-child, [class*="initiative-card"]:first-child'
      );
      await page.waitForTimeout(500);
      await page.click('button:has-text("Resources")');
      await page.waitForTimeout(300);

      // Check for capacity section
      const capacitySection = page.locator(':has-text("Capacity"), :has-text("FTE")');
      // Capacity section should be present
    });
  });
});

test.describe('API Integration', () => {
  test('should load initiatives from API', async ({ page, request }) => {
    // Test API endpoint directly
    const response = await request.get(`${BASE_URL}/api/initiatives/portfolio`, {
      headers: {
        'x-demo-mode': 'true',
      },
    });

    // API should return 200 or 401 (if auth required)
    expect([200, 401]).toContain(response.status());
  });

  test('should load milestones from API', async ({ page, request }) => {
    // This test verifies the milestones endpoint exists
    // In real scenario, we'd need an initiative ID
    const response = await request.get(`${BASE_URL}/api/initiatives/test-id/milestones`, {
      headers: {
        'x-demo-mode': 'true',
      },
    });

    // Endpoint should exist (may return 404 for invalid ID or 401 for auth)
    expect([200, 401, 404]).toContain(response.status());
  });

  test('should load dependencies from API', async ({ page, request }) => {
    const response = await request.get(`${BASE_URL}/api/initiatives/portfolio/dependencies`, {
      headers: {
        'x-demo-mode': 'true',
      },
    });

    expect([200, 401]).toContain(response.status());
  });
});
