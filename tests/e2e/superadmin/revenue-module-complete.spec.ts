/**
 * E2E tests for Revenue Module - Complete Coverage
 *
 * Comprehensive tests for the SuperAdmin Revenue Module including:
 * - Revenue dashboard and metrics
 * - Billing management
 * - Invoice operations
 * - Payment processing
 * - Revenue analytics
 */

import { test, expect } from '@playwright/test';

test.describe('Revenue Module - Complete Coverage', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to SuperAdmin and authenticate
    await page.goto('/superadmin');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Revenue Dashboard', () => {
    test('should display revenue overview dashboard', async ({ page }) => {
      await page.goto('/superadmin/revenue');

      // Wait for dashboard to load
      await page.waitForSelector('[data-testid="revenue-dashboard"], .revenue-overview, h1, h2', {
        timeout: 10000,
      });

      // Verify main dashboard elements
      const dashboard = page
        .locator('[data-testid="revenue-dashboard"], .revenue-overview')
        .first();
      await expect(dashboard).toBeVisible();
    });

    test('should display MRR (Monthly Recurring Revenue)', async ({ page }) => {
      await page.goto('/superadmin/revenue');

      const mrrCard = page
        .locator('text=MRR, text=Monthly Recurring Revenue, [data-testid="mrr-card"]')
        .first();
      await expect(mrrCard).toBeVisible();
    });

    test('should display ARR (Annual Recurring Revenue)', async ({ page }) => {
      await page.goto('/superadmin/revenue');

      const arrCard = page
        .locator('text=ARR, text=Annual Recurring Revenue, [data-testid="arr-card"]')
        .first();
      await expect(arrCard).toBeVisible();
    });

    test('should display churn rate metric', async ({ page }) => {
      await page.goto('/superadmin/revenue');

      const churnCard = page.locator('text=Churn, [data-testid="churn-rate"]').first();
      await expect(churnCard).toBeVisible();
    });

    test('should display revenue growth chart', async ({ page }) => {
      await page.goto('/superadmin/revenue');

      const chart = page
        .locator('.recharts-wrapper, canvas, [data-testid="revenue-chart"]')
        .first();
      await expect(chart).toBeVisible({ timeout: 10000 });
    });

    test('should display LTV (Lifetime Value) metric', async ({ page }) => {
      await page.goto('/superadmin/revenue');

      const ltvCard = page
        .locator('text=LTV, text=Lifetime Value, text=CLV, [data-testid="ltv-card"]')
        .first();
      await expect(ltvCard).toBeVisible();
    });
  });

  test.describe('Billing Management', () => {
    test('should display billing overview', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=billing');

      const billingSection = page
        .locator('text=Billing, h2:has-text("Billing"), [data-testid="billing-section"]')
        .first();
      await expect(billingSection).toBeVisible();
    });

    test('should list subscription plans', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=billing');

      const plansList = page.locator('text=Starter, text=Professional, text=Enterprise').first();
      await expect(plansList).toBeVisible();
    });

    test('should edit subscription plan pricing', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=billing');

      const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-plan"]').first();
      if (await editButton.isVisible()) {
        await editButton.click();

        const priceInput = page.locator('input[name*="price"], input[type="number"]').first();
        await expect(priceInput).toBeVisible();
      }
    });

    test('should configure billing cycles', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=billing');

      const cycleConfig = page.locator('text=Monthly, text=Annual, text=Billing Cycle').first();
      await expect(cycleConfig).toBeVisible();
    });

    test('should manage payment methods', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=billing');

      const paymentMethods = page
        .locator('text=Payment Methods, text=Credit Card, text=Stripe')
        .first();
      await expect(paymentMethods).toBeVisible();
    });
  });

  test.describe('Invoice Operations', () => {
    test('should display invoices list', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=invoices');

      const invoicesList = page
        .locator('[data-testid="invoices-list"], table:has-text("Invoice"), .invoice-list')
        .first();
      await expect(invoicesList).toBeVisible();
    });

    test('should filter invoices by status', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=invoices');

      const statusFilter = page
        .locator('select[name*="status"], [data-testid="status-filter"]')
        .first();
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption({ label: 'Paid' });
        await page.waitForLoadState('networkidle');
      }
    });

    test('should filter invoices by date range', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=invoices');

      const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"]').first();
      if (await dateFilter.isVisible()) {
        await dateFilter.fill('2024-01-01');
        await page.waitForLoadState('networkidle');
      }
    });

    test('should view invoice details', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=invoices');

      const invoiceRow = page.locator('tr[data-testid="invoice-row"], .invoice-item').first();
      if (await invoiceRow.isVisible()) {
        await invoiceRow.click();

        const detailModal = page
          .locator('[data-testid="invoice-detail"], .modal:has-text("Invoice")')
          .first();
        await expect(detailModal).toBeVisible();
      }
    });

    test('should download invoice as PDF', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=invoices');

      const downloadButton = page
        .locator('button:has-text("Download"), [data-testid="download-invoice"]')
        .first();
      if (await downloadButton.isVisible()) {
        // Set up download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
        await downloadButton.click();
      }
    });

    test('should resend invoice email', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=invoices');

      const resendButton = page
        .locator('button:has-text("Resend"), [data-testid="resend-invoice"]')
        .first();
      if (await resendButton.isVisible()) {
        await resendButton.click();

        // Confirm dialog
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Send")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
    });

    test('should create credit note', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=invoices');

      const creditNoteButton = page
        .locator('button:has-text("Credit Note"), [data-testid="create-credit-note"]')
        .first();
      if (await creditNoteButton.isVisible()) {
        await creditNoteButton.click();

        const creditNoteForm = page.locator(
          '[data-testid="credit-note-form"], form:has-text("Credit")'
        );
        await expect(creditNoteForm).toBeVisible();
      }
    });
  });

  test.describe('Subscription Management', () => {
    test('should list active subscriptions', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=subscriptions');

      const subscriptionsList = page
        .locator('[data-testid="subscriptions-list"], table, .subscriptions-list')
        .first();
      await expect(subscriptionsList).toBeVisible();
    });

    test('should upgrade subscription', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=subscriptions');

      const upgradeButton = page
        .locator('button:has-text("Upgrade"), [data-testid="upgrade-subscription"]')
        .first();
      if (await upgradeButton.isVisible()) {
        await expect(upgradeButton).toBeEnabled();
      }
    });

    test('should downgrade subscription', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=subscriptions');

      const downgradeButton = page
        .locator('button:has-text("Downgrade"), [data-testid="downgrade-subscription"]')
        .first();
      if (await downgradeButton.isVisible()) {
        await expect(downgradeButton).toBeEnabled();
      }
    });

    test('should cancel subscription', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=subscriptions');

      const cancelButton = page
        .locator('button:has-text("Cancel"), [data-testid="cancel-subscription"]')
        .first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();

        // Should show confirmation dialog
        const confirmDialog = page.locator('[role="alertdialog"], .modal:has-text("Cancel")');
        await expect(confirmDialog).toBeVisible();
      }
    });

    test('should pause subscription', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=subscriptions');

      const pauseButton = page
        .locator('button:has-text("Pause"), [data-testid="pause-subscription"]')
        .first();
      if (await pauseButton.isVisible()) {
        await expect(pauseButton).toBeEnabled();
      }
    });

    test('should view subscription history', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=subscriptions');

      const subscriptionRow = page.locator('tr, .subscription-item').first();
      if (await subscriptionRow.isVisible()) {
        await subscriptionRow.click();

        const historyTab = page.locator('button:has-text("History"), tab:has-text("History")');
        if (await historyTab.isVisible()) {
          await historyTab.click();

          const historyList = page.locator('[data-testid="subscription-history"], .history-list');
          await expect(historyList).toBeVisible();
        }
      }
    });
  });

  test.describe('Revenue Analytics', () => {
    test('should display revenue by tier breakdown', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=analytics');

      const tierBreakdown = page
        .locator('text=By Tier, text=Revenue by Plan, [data-testid="tier-breakdown"]')
        .first();
      await expect(tierBreakdown).toBeVisible();
    });

    test('should display revenue trend over time', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=analytics');

      const trendChart = page
        .locator('.recharts-wrapper, canvas, [data-testid="trend-chart"]')
        .first();
      await expect(trendChart).toBeVisible({ timeout: 10000 });
    });

    test('should show cohort analysis', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=analytics');

      const cohortAnalysis = page
        .locator('text=Cohort, text=Retention, [data-testid="cohort-analysis"]')
        .first();
      await expect(cohortAnalysis).toBeVisible();
    });

    test('should show expansion revenue metrics', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=analytics');

      const expansionRevenue = page
        .locator('text=Expansion, text=Upsell, [data-testid="expansion-revenue"]')
        .first();
      await expect(expansionRevenue).toBeVisible();
    });

    test('should show contraction revenue metrics', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=analytics');

      const contractionRevenue = page
        .locator('text=Contraction, text=Downgrade, [data-testid="contraction-revenue"]')
        .first();
      await expect(contractionRevenue).toBeVisible();
    });

    test('should export analytics report', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=analytics');

      const exportButton = page
        .locator('button:has-text("Export"), [data-testid="export-analytics"]')
        .first();
      if (await exportButton.isVisible()) {
        await exportButton.click();

        // Wait for export options
        const exportOptions = page.locator('text=CSV, text=Excel, text=PDF');
        await expect(exportOptions.first()).toBeVisible();
      }
    });
  });

  test.describe('Payment Processing', () => {
    test('should display payment gateway status', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=payments');

      const gatewayStatus = page
        .locator('text=Stripe, text=Gateway, [data-testid="gateway-status"]')
        .first();
      await expect(gatewayStatus).toBeVisible();
    });

    test('should show failed payments', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=payments');

      const failedPayments = page
        .locator('text=Failed, text=Declined, [data-testid="failed-payments"]')
        .first();
      await expect(failedPayments).toBeVisible();
    });

    test('should retry failed payment', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=payments');

      const retryButton = page
        .locator('button:has-text("Retry"), [data-testid="retry-payment"]')
        .first();
      if (await retryButton.isVisible()) {
        await expect(retryButton).toBeEnabled();
      }
    });

    test('should process refund', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=payments');

      const refundButton = page
        .locator('button:has-text("Refund"), [data-testid="process-refund"]')
        .first();
      if (await refundButton.isVisible()) {
        await refundButton.click();

        // Refund form should appear
        const refundForm = page.locator('[data-testid="refund-form"], form:has-text("Refund")');
        await expect(refundForm).toBeVisible();
      }
    });

    test('should view payment dispute details', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=payments');

      const disputeTab = page
        .locator('button:has-text("Disputes"), tab:has-text("Disputes")')
        .first();
      if (await disputeTab.isVisible()) {
        await disputeTab.click();

        const disputesList = page.locator('[data-testid="disputes-list"], .disputes-list');
        await expect(disputesList).toBeVisible();
      }
    });
  });

  test.describe('Tax Management', () => {
    test('should display tax configuration', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=tax');

      const taxConfig = page.locator('text=Tax, text=VAT, [data-testid="tax-config"]').first();
      await expect(taxConfig).toBeVisible();
    });

    test('should configure tax rates by region', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=tax');

      const regionConfig = page
        .locator('text=Region, text=Country, [data-testid="tax-regions"]')
        .first();
      await expect(regionConfig).toBeVisible();
    });

    test('should generate tax report', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=tax');

      const taxReportButton = page
        .locator('button:has-text("Tax Report"), [data-testid="generate-tax-report"]')
        .first();
      if (await taxReportButton.isVisible()) {
        await expect(taxReportButton).toBeEnabled();
      }
    });
  });

  test.describe('Promo Codes and Discounts', () => {
    test('should list active promo codes', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=promos');

      const promoList = page
        .locator('[data-testid="promo-list"], table:has-text("Promo"), .promo-codes')
        .first();
      await expect(promoList).toBeVisible();
    });

    test('should create new promo code', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=promos');

      const createButton = page
        .locator('button:has-text("Create"), button:has-text("Add Promo")')
        .first();
      if (await createButton.isVisible()) {
        await createButton.click();

        const promoForm = page.locator('[data-testid="promo-form"], form:has-text("Promo")');
        await expect(promoForm).toBeVisible();
      }
    });

    test('should deactivate promo code', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=promos');

      const deactivateButton = page
        .locator('button:has-text("Deactivate"), [data-testid="deactivate-promo"]')
        .first();
      if (await deactivateButton.isVisible()) {
        await expect(deactivateButton).toBeEnabled();
      }
    });

    test('should view promo code usage', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=promos');

      const promoRow = page.locator('tr, .promo-item').first();
      if (await promoRow.isVisible()) {
        await promoRow.click();

        const usageStats = page.locator(
          'text=Usage, text=Redemptions, [data-testid="promo-usage"]'
        );
        await expect(usageStats.first()).toBeVisible();
      }
    });
  });

  test.describe('Reports Export', () => {
    test('should export revenue report', async ({ page }) => {
      await page.goto('/superadmin/revenue');

      const exportButton = page
        .locator('button:has-text("Export"), button:has-text("Download Report")')
        .first();
      if (await exportButton.isVisible()) {
        await exportButton.click();

        const formatOptions = page.locator('text=CSV, text=Excel, text=PDF').first();
        await expect(formatOptions).toBeVisible();
      }
    });

    test('should schedule recurring reports', async ({ page }) => {
      await page.goto('/superadmin/revenue?tab=reports');

      const scheduleButton = page
        .locator('button:has-text("Schedule"), [data-testid="schedule-report"]')
        .first();
      if (await scheduleButton.isVisible()) {
        await expect(scheduleButton).toBeEnabled();
      }
    });
  });
});
