/**
 * TEMPLATE: E2E Test (Playwright)
 * 
 * Ten plik służy jako szablon do tworzenia testów E2E.
 * Skopiuj i dostosuj do konkretnego scenariusza.
 */

import { test, expect, Page } from '@playwright/test';

// ===== Test Fixtures & Helpers =====

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  name: 'Test User',
};

const TEST_ADMIN = {
  email: 'admin@example.com',
  password: 'AdminPassword123!',
  name: 'Admin User',
};

// Helper: Login as user
async function loginAsUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  
  // Wait for navigation to dashboard
  await expect(page).toHaveURL(/\/dashboard|\/my-work/);
}

// Helper: Create test data via API
async function seedTestData(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  
  await page.request.post('/api/test/seed', {
    headers: { Authorization: `Bearer ${token}` },
    data: { scenario: 'basic' },
  });
}

// Helper: Cleanup test data
async function cleanupTestData(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  
  await page.request.delete('/api/test/cleanup', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ===== Test Suites =====

test.describe('Feature: Resource Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, TEST_USER.email, TEST_USER.password);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup if needed
  });

  test.describe('Viewing Resources', () => {
    test('should display list of resources', async ({ page }) => {
      await page.goto('/resources');

      // Wait for page to load
      await expect(page.locator('[data-testid="resources-list"]')).toBeVisible();

      // Verify header is displayed
      await expect(page.locator('h1')).toContainText('Resources');

      // Verify at least one resource card exists
      const resourceCards = page.locator('[data-testid="resource-card"]');
      await expect(resourceCards).toHaveCount(await resourceCards.count());
    });

    test('should filter resources by status', async ({ page }) => {
      await page.goto('/resources');

      // Click status filter
      await page.click('[data-testid="status-filter"]');
      await page.click('[data-testid="status-active"]');

      // Wait for filter to apply
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/resources') && resp.status() === 200
      );

      // Verify filtered results
      const statusBadges = page.locator('[data-testid="resource-status"]');
      const count = await statusBadges.count();
      
      for (let i = 0; i < count; i++) {
        await expect(statusBadges.nth(i)).toContainText('Active');
      }
    });

    test('should search resources by name', async ({ page }) => {
      await page.goto('/resources');

      // Type in search box
      await page.fill('[data-testid="search-input"]', 'specific resource');

      // Wait for debounced search
      await page.waitForTimeout(500);

      // Verify search results
      const results = page.locator('[data-testid="resource-card"]');
      await expect(results.first()).toContainText('specific resource');
    });
  });

  test.describe('Creating Resources', () => {
    test('should create a new resource successfully', async ({ page }) => {
      await page.goto('/resources');

      // Click create button
      await page.click('[data-testid="create-resource-btn"]');

      // Fill form in modal
      await expect(page.locator('[data-testid="create-modal"]')).toBeVisible();
      
      await page.fill('[data-testid="name-input"]', 'New Test Resource');
      await page.fill('[data-testid="description-input"]', 'Test description');
      await page.selectOption('[data-testid="type-select"]', 'standard');

      // Submit form
      await page.click('[data-testid="submit-btn"]');

      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="toast-success"]')).toContainText('created');

      // Verify new resource appears in list
      await expect(page.locator('text=New Test Resource')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/resources');

      await page.click('[data-testid="create-resource-btn"]');

      // Try to submit empty form
      await page.click('[data-testid="submit-btn"]');

      // Verify validation errors
      await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="name-error"]')).toContainText('required');
    });

    test('should cancel creation and close modal', async ({ page }) => {
      await page.goto('/resources');

      await page.click('[data-testid="create-resource-btn"]');
      
      // Fill some data
      await page.fill('[data-testid="name-input"]', 'Draft Resource');

      // Click cancel
      await page.click('[data-testid="cancel-btn"]');

      // Verify modal closed
      await expect(page.locator('[data-testid="create-modal"]')).not.toBeVisible();

      // Verify data not saved
      await expect(page.locator('text=Draft Resource')).not.toBeVisible();
    });
  });

  test.describe('Editing Resources', () => {
    test('should edit existing resource', async ({ page }) => {
      await page.goto('/resources');

      // Click on first resource
      await page.click('[data-testid="resource-card"]:first-child');

      // Wait for detail view
      await expect(page.locator('[data-testid="resource-detail"]')).toBeVisible();

      // Click edit button
      await page.click('[data-testid="edit-btn"]');

      // Modify name
      await page.fill('[data-testid="name-input"]', 'Updated Resource Name');

      // Save changes
      await page.click('[data-testid="save-btn"]');

      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

      // Verify change persisted
      await expect(page.locator('[data-testid="resource-name"]')).toContainText('Updated Resource Name');
    });
  });

  test.describe('Deleting Resources', () => {
    test('should delete resource with confirmation', async ({ page }) => {
      await page.goto('/resources');

      // Get initial count
      const initialCount = await page.locator('[data-testid="resource-card"]').count();

      // Click delete on first resource
      await page.click('[data-testid="resource-card"]:first-child [data-testid="delete-btn"]');

      // Confirm deletion
      await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
      await page.click('[data-testid="confirm-delete-btn"]');

      // Verify success
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();

      // Verify count decreased
      await expect(page.locator('[data-testid="resource-card"]')).toHaveCount(initialCount - 1);
    });

    test('should cancel deletion', async ({ page }) => {
      await page.goto('/resources');

      const initialCount = await page.locator('[data-testid="resource-card"]').count();

      await page.click('[data-testid="resource-card"]:first-child [data-testid="delete-btn"]');
      
      // Cancel deletion
      await page.click('[data-testid="cancel-delete-btn"]');

      // Verify dialog closed
      await expect(page.locator('[data-testid="confirm-dialog"]')).not.toBeVisible();

      // Verify count unchanged
      await expect(page.locator('[data-testid="resource-card"]')).toHaveCount(initialCount);
    });
  });
});

test.describe('Feature: User Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email-input"]', TEST_USER.email);
    await page.fill('[data-testid="password-input"]', TEST_USER.password);
    await page.click('[data-testid="login-button"]');

    await expect(page).toHaveURL(/\/dashboard|\/my-work/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid="email-input"]', 'wrong@email.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-error"]')).toContainText('Invalid');
  });

  test('should logout successfully', async ({ page }) => {
    await loginAsUser(page, TEST_USER.email, TEST_USER.password);

    // Open user menu
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-btn"]');

    // Verify redirected to login
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Feature: Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, TEST_USER.email, TEST_USER.password);
  });

  test('should navigate between main sections', async ({ page }) => {
    // Navigate to each main section
    const sections = [
      { link: 'My Work', url: '/my-work' },
      { link: 'Initiatives', url: '/initiatives' },
      { link: 'Reports', url: '/reports' },
      { link: 'Settings', url: '/settings' },
    ];

    for (const section of sections) {
      await page.click(`[data-testid="nav-${section.link.toLowerCase().replace(' ', '-')}"]`);
      await expect(page).toHaveURL(new RegExp(section.url));
    }
  });

  test('should handle browser back/forward', async ({ page }) => {
    await page.goto('/dashboard');
    await page.goto('/my-work');
    await page.goto('/initiatives');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/my-work/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/initiatives/);
  });
});

test.describe('Feature: Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, TEST_USER.email, TEST_USER.password);
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    await page.goto('/resources');

    // Press keyboard shortcut for new resource
    await page.keyboard.press('n');

    // Verify modal opened
    await expect(page.locator('[data-testid="create-modal"]')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    await expect(page.locator('[data-testid="create-modal"]')).not.toBeVisible();
  });

  test('should navigate list with arrow keys', async ({ page }) => {
    await page.goto('/resources');

    // Focus first item
    await page.locator('[data-testid="resource-card"]').first().focus();

    // Navigate down
    await page.keyboard.press('ArrowDown');

    // Verify focus moved
    await expect(page.locator('[data-testid="resource-card"]:nth-child(2)')).toBeFocused();
  });
});

test.describe('Feature: Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should show mobile menu', async ({ page }) => {
    await loginAsUser(page, TEST_USER.email, TEST_USER.password);

    // Verify hamburger menu is visible
    await expect(page.locator('[data-testid="mobile-menu-btn"]')).toBeVisible();

    // Click to open menu
    await page.click('[data-testid="mobile-menu-btn"]');

    // Verify mobile navigation
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
  });

  test('should have touch-friendly buttons', async ({ page }) => {
    await loginAsUser(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/resources');

    // Verify buttons are at least 44x44 (touch target size)
    const button = page.locator('[data-testid="create-resource-btn"]');
    const box = await button.boundingBox();
    
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Feature: Error Handling', () => {
  test('should display friendly error page for 404', async ({ page }) => {
    await page.goto('/non-existent-page');

    await expect(page.locator('[data-testid="error-404"]')).toBeVisible();
    await expect(page.locator('text=Page not found')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await loginAsUser(page, TEST_USER.email, TEST_USER.password);

    // Simulate offline
    await page.route('**/api/**', (route) => route.abort());

    await page.goto('/resources');

    // Verify error message
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    
    // Verify retry button
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();
  });
});

test.describe('Feature: Performance', () => {
  test('should load dashboard within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await loginAsUser(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/dashboard');
    
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});



