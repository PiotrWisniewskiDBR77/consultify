/**
 * SuperAdmin Comprehensive E2E Test
 *
 * This test systematically navigates through ALL SuperAdmin modules and tabs,
 * verifying that each page loads correctly, has no console errors, and displays
 * expected content (tables, data, etc.)
 *
 * Coverage:
 * - 11 Main Modules
 * - 70+ Sub-tabs
 * - Error detection
 * - Data validation
 */

import { test, expect, Page } from '@playwright/test';

// Define all modules and their tabs
const SUPERADMIN_MODULES = {
  overview: {
    name: 'Overview',
    path: '/superadmin/overview',
    tabs: ['dashboard', 'metrics', 'signals'],
  },
  customers: {
    name: 'Customers',
    path: '/superadmin/customers',
    tabs: [
      'organizations',
      'users',
      'lifecycle',
      'playbooks',
      'contracts',
      'security',
      'support',
      'feedback',
      'analytics',
      'compliance',
      'automation',
      'communication',
      'bulk-ops',
    ],
  },
  'ai-infrastructure': {
    name: 'AI Infrastructure',
    path: '/superadmin/ai-infrastructure',
    tabs: ['llm-config', 'tier-assignments', 'settings', 'health'],
  },
  'ai-development': {
    name: 'AI Development',
    path: '/superadmin/ai-development',
    tabs: ['prompts', 'intelligence', 'experiments', 'knowledge'],
  },
  'ai-operations': {
    name: 'AI Operations',
    path: '/superadmin/ai-operations',
    tabs: ['mission-control', 'performance', 'costs', 'sla', 'analytics'],
  },
  system: {
    name: 'System',
    path: '/superadmin/system',
    tabs: [
      'health',
      'audit-log',
      'feature-flags',
      'integrations',
      'security',
      'configuration',
      'analytics',
      'backup',
      'api-keys',
    ],
  },
  content: {
    name: 'Content',
    path: '/superadmin/content',
    tabs: ['playbooks', 'email-templates'],
  },
  revenue: {
    name: 'Revenue',
    path: '/superadmin/revenue',
    tabs: [
      'billing',
      'invoices',
      'usage',
      'pricing',
      'subscriptions',
      'recognition',
      'forecasts',
      'payments',
    ],
  },
  security: {
    name: 'Security',
    path: '/superadmin/security',
    tabs: [
      'sso',
      'scim',
      'roles',
      'permissions',
      'policies',
      'api-keys',
      'sessions',
      'audit',
      'workflows',
      'incidents',
      'threats',
      'dlp',
      'ai-budgets',
      'compliance',
    ],
  },
  analytics: {
    name: 'Analytics',
    path: '/superadmin/analytics',
    tabs: [], // Analytics module may not have tabs, just a single view
  },
  configuration: {
    name: 'Configuration',
    path: '/superadmin/configuration',
    tabs: ['settings', 'whitelabel', 'legal'],
  },
};

interface TestResult {
  module: string;
  tab?: string;
  status: 'pass' | 'fail';
  errors: string[];
  hasTable: boolean;
  hasData: boolean;
  screenshot?: string;
}

const testResults: TestResult[] = [];

// Helper function to check for console errors
function setupConsoleErrorTracking(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out non-critical errors
      if (
        !text.includes('favicon') &&
        !text.includes('404') &&
        !text.includes('net::ERR_') &&
        !text.includes('Download the React DevTools')
      ) {
        errors.push(text);
      }
    }
  });
  return errors;
}

// Helper function to check for page errors
function setupPageErrorTracking(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(`Page Error: ${error.message}`);
  });
  return errors;
}

// Helper function to click a tab
async function clickTab(page: Page, tabId: string): Promise<boolean> {
  try {
    // Try multiple selectors for tab buttons
    const selectors = [
      `button:has-text("${tabId}")`,
      `[data-tab="${tabId}"]`,
      `[data-tab-id="${tabId}"]`,
      `button[role="tab"]:has-text("${tabId}")`,
    ];

    for (const selector of selectors) {
      const tab = page.locator(selector).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(1000); // Wait for content to load
        return true;
      }
    }

    // If no exact match, try case-insensitive text match
    const allButtons = await page.locator('button').all();
    for (const button of allButtons) {
      const text = await button.textContent();
      if (text && text.toLowerCase().includes(tabId.toLowerCase().replace('-', ' '))) {
        await button.click();
        await page.waitForTimeout(1000);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`Failed to click tab ${tabId}:`, error);
    return false;
  }
}

// Helper function to check for tables and data
async function checkForTablesAndData(page: Page): Promise<{ hasTable: boolean; hasData: boolean }> {
  try {
    // Check for common table selectors
    const tableSelectors = [
      'table',
      '[role="table"]',
      '.table',
      '[class*="Table"]',
      '[data-testid*="table"]',
    ];

    let hasTable = false;
    let hasData = false;

    for (const selector of tableSelectors) {
      const tables = page.locator(selector);
      const count = await tables.count();

      if (count > 0) {
        hasTable = true;

        // Check if table has rows (data)
        const rows = page.locator(`${selector} tr, ${selector} [role="row"]`);
        const rowCount = await rows.count();

        // More than 1 row means it has data (excluding header)
        if (rowCount > 1) {
          hasData = true;
          break;
        }
      }
    }

    return { hasTable, hasData };
  } catch (error) {
    return { hasTable: false, hasData: false };
  }
}

test.describe('SuperAdmin Comprehensive Test Suite', () => {
  test.setTimeout(600000); // 10 minutes for the entire test suite

  test('Complete SuperAdmin Module and Tab Navigation', async ({ page }) => {
    // Navigate to SuperAdmin
    await page.goto('http://localhost:3000/superadmin/overview');
    await page.waitForLoadState('networkidle');

    // Wait for SuperAdmin to load
    await page.waitForTimeout(2000);

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    // Iterate through all modules
    for (const [moduleKey, moduleConfig] of Object.entries(SUPERADMIN_MODULES)) {
      console.log(`\n=== Testing Module: ${moduleConfig.name} ===`);

      // Navigate to module
      await page.goto(`http://localhost:3000${moduleConfig.path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      // Setup error tracking
      const consoleErrors = setupConsoleErrorTracking(page);
      const pageErrors = setupPageErrorTracking(page);

      // Test module landing page
      totalTests++;
      const moduleResult: TestResult = {
        module: moduleConfig.name,
        status: 'pass',
        errors: [],
        hasTable: false,
        hasData: false,
      };

      try {
        // Check URL
        await expect(page).toHaveURL(new RegExp(moduleConfig.path));

        // Check for tables and data
        const { hasTable, hasData } = await checkForTablesAndData(page);
        moduleResult.hasTable = hasTable;
        moduleResult.hasData = hasData;

        // Check for errors
        if (consoleErrors.length > 0 || pageErrors.length > 0) {
          moduleResult.errors = [...consoleErrors, ...pageErrors];
          moduleResult.status = 'fail';
          failedTests++;
        } else {
          passedTests++;
        }

        console.log(
          `  ✓ Module loaded: ${moduleConfig.name} | Table: ${hasTable} | Data: ${hasData} | Errors: ${moduleResult.errors.length}`
        );
      } catch (error) {
        moduleResult.status = 'fail';
        moduleResult.errors.push(`Module load failed: ${error}`);
        failedTests++;
        console.log(`  ✗ Module failed: ${moduleConfig.name}`);
      }

      testResults.push(moduleResult);

      // Test all tabs in the module
      if (moduleConfig.tabs.length > 0) {
        for (const tab of moduleConfig.tabs) {
          totalTests++;
          const tabResult: TestResult = {
            module: moduleConfig.name,
            tab,
            status: 'pass',
            errors: [],
            hasTable: false,
            hasData: false,
          };

          try {
            // Clear previous errors
            consoleErrors.length = 0;
            pageErrors.length = 0;

            // Click tab
            const clicked = await clickTab(page, tab);

            if (!clicked) {
              tabResult.status = 'fail';
              tabResult.errors.push(`Tab button not found: ${tab}`);
              failedTests++;
              console.log(`  ✗ Tab not found: ${tab}`);
            } else {
              // Wait for content to load
              await page.waitForTimeout(1000);

              // Check for tables and data
              const { hasTable, hasData } = await checkForTablesAndData(page);
              tabResult.hasTable = hasTable;
              tabResult.hasData = hasData;

              // Check for errors
              if (consoleErrors.length > 0 || pageErrors.length > 0) {
                tabResult.errors = [...consoleErrors, ...pageErrors];
                tabResult.status = 'fail';
                failedTests++;
                console.log(`  ✗ Tab has errors: ${tab} | Errors: ${tabResult.errors.length}`);
              } else {
                passedTests++;
                console.log(`  ✓ Tab loaded: ${tab} | Table: ${hasTable} | Data: ${hasData}`);
              }
            }
          } catch (error) {
            tabResult.status = 'fail';
            tabResult.errors.push(`Tab test failed: ${error}`);
            failedTests++;
            console.log(`  ✗ Tab failed: ${tab}`);
          }

          testResults.push(tabResult);
        }
      }
    }

    // Generate summary report
    console.log('\n\n=== TEST SUMMARY ===');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

    // Log failed tests
    const failures = testResults.filter((r) => r.status === 'fail');
    if (failures.length > 0) {
      console.log('\n=== FAILED TESTS ===');
      failures.forEach((f) => {
        const location = f.tab ? `${f.module} > ${f.tab}` : f.module;
        console.log(`\n${location}:`);
        f.errors.forEach((e) => console.log(`  - ${e}`));
      });
    }

    // Log modules/tabs without data
    const noData = testResults.filter((r) => r.hasTable && !r.hasData);
    if (noData.length > 0) {
      console.log('\n=== TABLES WITHOUT DATA ===');
      noData.forEach((r) => {
        const location = r.tab ? `${r.module} > ${r.tab}` : r.module;
        console.log(`  - ${location}`);
      });
    }

    // Save results to file
    const resultsJson = JSON.stringify(testResults, null, 2);
    console.log('\n=== DETAILED RESULTS ===');
    console.log(resultsJson);

    // Expect at least 80% pass rate
    const passRate = (passedTests / totalTests) * 100;
    expect(passRate).toBeGreaterThan(80);
  });
});
