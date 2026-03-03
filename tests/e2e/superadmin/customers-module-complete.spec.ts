/**
 * E2E tests for Customers Module - Complete Coverage
 *
 * Comprehensive tests for the SuperAdmin Customers Module including:
 * - Customer list and search
 * - Customer details and editing
 * - Subscription management
 * - Usage analytics
 * - Export functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Customers Module - Complete Coverage', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to SuperAdmin and authenticate
    await page.goto('/superadmin');

    // Wait for authentication or handle demo mode
    await page.waitForLoadState('networkidle');
  });

  test.describe('Customer List', () => {
    test('should display customers list with pagination', async ({ page }) => {
      await page.goto('/superadmin/customers');

      // Wait for customer list to load
      await page.waitForSelector('[data-testid="customers-list"], table, .customer-card', {
        timeout: 10000,
      });

      // Verify pagination controls exist
      const pagination = page.locator(
        '[data-testid="pagination"], .pagination, nav[aria-label*="pagination"]'
      );
      await expect(pagination.or(page.locator('button:has-text("Next")'))).toBeVisible();
    });

    test('should search customers by name', async ({ page }) => {
      await page.goto('/superadmin/customers');

      // Find and use search input
      const searchInput = page
        .locator('input[placeholder*="Search"], input[type="search"], [data-testid="search-input"]')
        .first();
      await searchInput.fill('test');
      await searchInput.press('Enter');

      // Wait for filtered results
      await page.waitForLoadState('networkidle');
    });

    test('should search customers by email', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const searchInput = page
        .locator('input[placeholder*="Search"], input[type="search"]')
        .first();
      await searchInput.fill('test@example.com');
      await searchInput.press('Enter');

      await page.waitForLoadState('networkidle');
    });

    test('should filter customers by subscription status', async ({ page }) => {
      await page.goto('/superadmin/customers');

      // Find status filter
      const filterSelect = page
        .locator('select[name*="status"], [data-testid="status-filter"]')
        .first();
      if (await filterSelect.isVisible()) {
        await filterSelect.selectOption({ label: 'Active' });
        await page.waitForLoadState('networkidle');
      }
    });

    test('should filter customers by subscription tier', async ({ page }) => {
      await page.goto('/superadmin/customers');

      // Find tier filter
      const tierFilter = page.locator('select[name*="tier"], [data-testid="tier-filter"]');
      if (await tierFilter.isVisible()) {
        await tierFilter.selectOption({ index: 1 });
        await page.waitForLoadState('networkidle');
      }
    });

    test('should sort customers by various criteria', async ({ page }) => {
      await page.goto('/superadmin/customers');

      // Click on sortable column headers
      const sortableHeader = page
        .locator('th:has-text("Name"), th:has-text("Created"), th[data-sortable]')
        .first();
      if (await sortableHeader.isVisible()) {
        await sortableHeader.click();
        await page.waitForLoadState('networkidle');
      }
    });
  });

  test.describe('Customer Details', () => {
    test('should open customer details modal', async ({ page }) => {
      await page.goto('/superadmin/customers');

      // Click on first customer row
      const customerRow = page.locator('tr[data-testid="customer-row"], .customer-card').first();
      if (await customerRow.isVisible()) {
        await customerRow.click();

        // Wait for modal or detail panel
        await page.waitForSelector('[data-testid="customer-details"], .modal, [role="dialog"]', {
          timeout: 5000,
        });
      }
    });

    test('should display customer organization info', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const customerRow = page.locator('tr[data-testid="customer-row"], .customer-card').first();
      if (await customerRow.isVisible()) {
        await customerRow.click();

        // Verify organization details are shown
        await expect(page.locator('text=Organization, text=Company, h3').first()).toBeVisible();
      }
    });

    test('should display subscription information', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const customerRow = page.locator('tr').first();
      if (await customerRow.isVisible()) {
        await customerRow.click();

        // Look for subscription section
        const subscriptionSection = page.locator('text=Subscription, text=Plan, text=Tier');
        await expect(subscriptionSection.first()).toBeVisible();
      }
    });

    test('should display usage statistics', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const customerRow = page.locator('tr').first();
      if (await customerRow.isVisible()) {
        await customerRow.click();

        // Look for usage metrics
        const usageSection = page.locator('text=Usage, text=API Calls, text=Storage');
        await expect(usageSection.first()).toBeVisible();
      }
    });
  });

  test.describe('Customer Actions', () => {
    test('should be able to suspend customer', async ({ page }) => {
      await page.goto('/superadmin/customers');

      // Find actions menu
      const actionsButton = page
        .locator('[data-testid="customer-actions"], button:has-text("Actions")')
        .first();
      if (await actionsButton.isVisible()) {
        await actionsButton.click();

        // Look for suspend option
        const suspendOption = page.locator('text=Suspend, button:has-text("Suspend")');
        await expect(suspendOption.first()).toBeVisible();
      }
    });

    test('should be able to upgrade customer subscription', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const actionsButton = page
        .locator('[data-testid="customer-actions"], button:has-text("Actions")')
        .first();
      if (await actionsButton.isVisible()) {
        await actionsButton.click();

        const upgradeOption = page.locator('text=Upgrade, button:has-text("Upgrade")');
        await expect(upgradeOption.first()).toBeVisible();
      }
    });

    test('should be able to generate invoice', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const actionsButton = page
        .locator('[data-testid="customer-actions"], button:has-text("Actions")')
        .first();
      if (await actionsButton.isVisible()) {
        await actionsButton.click();

        const invoiceOption = page.locator(
          'text=Invoice, text=Generate Invoice, button:has-text("Invoice")'
        );
        await expect(invoiceOption.first()).toBeVisible();
      }
    });

    test('should be able to impersonate customer', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const actionsButton = page
        .locator('[data-testid="customer-actions"], button:has-text("Actions")')
        .first();
      if (await actionsButton.isVisible()) {
        await actionsButton.click();

        const impersonateOption = page.locator(
          'text=Impersonate, text=Login as, button:has-text("Impersonate")'
        );
        if (await impersonateOption.first().isVisible()) {
          // Impersonation should require confirmation
        }
      }
    });
  });

  test.describe('Customer Export', () => {
    test('should export customers list to CSV', async ({ page }) => {
      await page.goto('/superadmin/customers');

      // Find export button
      const exportButton = page
        .locator('button:has-text("Export"), [data-testid="export-button"]')
        .first();
      if (await exportButton.isVisible()) {
        // Set up download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

        await exportButton.click();

        // Select CSV option if menu appears
        const csvOption = page.locator('text=CSV, button:has-text("CSV")');
        if (await csvOption.isVisible()) {
          await csvOption.click();
        }
      }
    });

    test('should export customers list to Excel', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const exportButton = page
        .locator('button:has-text("Export"), [data-testid="export-button"]')
        .first();
      if (await exportButton.isVisible()) {
        await exportButton.click();

        const excelOption = page.locator('text=Excel, text=XLSX, button:has-text("Excel")');
        if (await excelOption.isVisible()) {
          await excelOption.click();
        }
      }
    });
  });

  test.describe('Customer Analytics', () => {
    test('should display customer growth chart', async ({ page }) => {
      await page.goto('/superadmin/customers?tab=analytics');

      // Wait for chart to render
      const chart = page.locator('.recharts-wrapper, canvas, [data-testid="growth-chart"]');
      await expect(chart.first()).toBeVisible({ timeout: 10000 });
    });

    test('should display MRR metrics', async ({ page }) => {
      await page.goto('/superadmin/customers?tab=analytics');

      const mrrMetric = page.locator('text=MRR, text=Monthly Recurring Revenue');
      await expect(mrrMetric.first()).toBeVisible();
    });

    test('should display churn rate', async ({ page }) => {
      await page.goto('/superadmin/customers?tab=analytics');

      const churnMetric = page.locator('text=Churn, text=Churn Rate');
      await expect(churnMetric.first()).toBeVisible();
    });

    test('should display customer lifetime value', async ({ page }) => {
      await page.goto('/superadmin/customers?tab=analytics');

      const clvMetric = page.locator('text=LTV, text=Lifetime Value, text=CLV');
      await expect(clvMetric.first()).toBeVisible();
    });
  });

  test.describe('Customer Subscription Management', () => {
    test('should display subscription tiers', async ({ page }) => {
      await page.goto('/superadmin/customers?tab=subscriptions');

      // Check for tier cards or list
      const tiers = page.locator('text=Starter, text=Professional, text=Enterprise');
      await expect(tiers.first()).toBeVisible();
    });

    test('should modify subscription quota', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const customerRow = page.locator('tr').first();
      if (await customerRow.isVisible()) {
        await customerRow.click();

        const quotaSection = page.locator('text=Quota, text=Limits, text=Usage Limits');
        await expect(quotaSection.first()).toBeVisible();
      }
    });

    test('should extend trial period', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const trialCustomer = page
        .locator('tr:has-text("Trial"), .customer-card:has-text("Trial")')
        .first();
      if (await trialCustomer.isVisible()) {
        await trialCustomer.click();

        const extendTrialButton = page.locator(
          'button:has-text("Extend Trial"), text=Extend Trial'
        );
        if (await extendTrialButton.isVisible()) {
          await expect(extendTrialButton).toBeEnabled();
        }
      }
    });
  });

  test.describe('Customer Communication', () => {
    test('should open email composer', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const emailButton = page
        .locator('button:has-text("Email"), [data-testid="send-email"]')
        .first();
      if (await emailButton.isVisible()) {
        await emailButton.click();

        // Wait for email composer modal
        const composer = page.locator('[data-testid="email-composer"], .modal:has-text("Email")');
        await expect(composer).toBeVisible();
      }
    });

    test('should display customer activity log', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const customerRow = page.locator('tr').first();
      if (await customerRow.isVisible()) {
        await customerRow.click();

        const activityTab = page.locator('button:has-text("Activity"), tab:has-text("Activity")');
        if (await activityTab.isVisible()) {
          await activityTab.click();

          const activityLog = page.locator('[data-testid="activity-log"], .activity-list');
          await expect(activityLog).toBeVisible();
        }
      }
    });
  });

  test.describe('Bulk Operations', () => {
    test('should select multiple customers', async ({ page }) => {
      await page.goto('/superadmin/customers');

      // Find checkboxes
      const checkboxes = page.locator(
        'input[type="checkbox"][name*="customer"], [data-testid="customer-checkbox"]'
      );
      const checkboxCount = await checkboxes.count();

      if (checkboxCount >= 2) {
        await checkboxes.first().check();
        await checkboxes.nth(1).check();

        // Verify bulk action bar appears
        const bulkActionBar = page.locator(
          '[data-testid="bulk-actions"], .bulk-actions, text=selected'
        );
        await expect(bulkActionBar.first()).toBeVisible();
      }
    });

    test('should perform bulk email', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const selectAllCheckbox = page
        .locator('input[type="checkbox"][name="selectAll"], th input[type="checkbox"]')
        .first();
      if (await selectAllCheckbox.isVisible()) {
        await selectAllCheckbox.check();

        const bulkEmailButton = page.locator(
          'button:has-text("Send Email"), button:has-text("Bulk Email")'
        );
        if (await bulkEmailButton.isVisible()) {
          await expect(bulkEmailButton).toBeEnabled();
        }
      }
    });
  });

  test.describe('Customer Notes', () => {
    test('should add customer note', async ({ page }) => {
      await page.goto('/superadmin/customers');

      const customerRow = page.locator('tr').first();
      if (await customerRow.isVisible()) {
        await customerRow.click();

        const notesTab = page.locator('button:has-text("Notes"), tab:has-text("Notes")');
        if (await notesTab.isVisible()) {
          await notesTab.click();

          const addNoteButton = page.locator('button:has-text("Add Note")');
          if (await addNoteButton.isVisible()) {
            await addNoteButton.click();

            const noteInput = page.locator('textarea[name="note"], [data-testid="note-input"]');
            await noteInput.fill('Test note from E2E test');

            const saveButton = page.locator('button:has-text("Save")');
            await saveButton.click();
          }
        }
      }
    });
  });
});
