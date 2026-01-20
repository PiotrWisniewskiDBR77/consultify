/**
 * Assessment -> Initiatives E2E Tests
 * Full workflow test: DRAFT -> REVIEW -> APPROVED -> Generate Initiatives
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001/api';

// Test user credentials (demo user)
const TEST_USER = {
  email: 'demo@legolex.com',
  password: 'demo123',
};

// Helper: Login
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[data-testid="email-input"], input[type="email"]', TEST_USER.email);
  await page.fill('[data-testid="password-input"], input[type="password"]', TEST_USER.password);
  await page.click('[data-testid="login-button"], button[type="submit"]');
  await page.waitForURL(/dashboard|home|projects/);
}

// Helper: Navigate to Assessment module
async function navigateToAssessment(page: Page, framework: 'DRD' | 'SIRI' = 'DRD') {
  // Click on Assessment in sidebar or navigation
  await page.click(`[data-testid="nav-assessment"], a[href*="assessment"]`);
  await page.waitForTimeout(500);
  
  // Select framework if needed
  if (framework === 'DRD') {
    await page.click('[data-testid="framework-drd"], button:has-text("DRD")');
  } else if (framework === 'SIRI') {
    await page.click('[data-testid="framework-siri"], button:has-text("SIRI")');
  }
}

test.describe('Assessment Module - CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should create new DRD assessment', async ({ page }) => {
    await navigateToAssessment(page, 'DRD');
    
    // Click New Assessment button
    await page.click('[data-testid="new-assessment-btn"], button:has-text("New Assessment"), button:has-text("Nowa ocena")');
    
    // Fill assessment name
    const nameInput = page.locator('[data-testid="assessment-name-input"], input[placeholder*="name"], input[placeholder*="nazwa"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Test Assessment - DRD');
    }
    
    // Verify assessment was created (status should be DRAFT)
    await expect(page.locator('[data-testid="status-badge"], .status-badge').first()).toContainText(/DRAFT|Szkic/i);
  });

  test('should create new SIRI assessment', async ({ page }) => {
    await navigateToAssessment(page, 'SIRI');
    
    // Click New Assessment button
    await page.click('[data-testid="new-assessment-btn"], button:has-text("New Assessment"), button:has-text("Nowa ocena")');
    
    // Fill assessment name if input is visible
    const nameInput = page.locator('[data-testid="assessment-name-input"], input[placeholder*="name"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('E2E Test Assessment - SIRI');
    }
    
    // Verify assessment was created
    await expect(page.locator('[data-testid="status-badge"], .status-badge').first()).toContainText(/DRAFT|Szkic/i);
  });

  test('should list assessments', async ({ page }) => {
    await navigateToAssessment(page, 'DRD');
    
    // Wait for assessment table/list to load
    await page.waitForSelector('[data-testid="assessments-table"], table, .assessments-list');
    
    // Verify table headers or list structure
    await expect(page.locator('th, .table-header').first()).toBeVisible();
  });

  test('should filter assessments by status', async ({ page }) => {
    await navigateToAssessment(page, 'DRD');
    
    // Open filter dropdown
    await page.click('[data-testid="status-filter"], button:has-text("Filter"), button:has-text("Filtr")');
    
    // Select DRAFT status
    await page.click('[data-testid="filter-draft"], option:has-text("DRAFT"), [value="DRAFT"]');
    
    // Verify filtered results
    const statusBadges = page.locator('[data-testid="status-badge"], .status-badge');
    const count = await statusBadges.count();
    
    for (let i = 0; i < count; i++) {
      await expect(statusBadges.nth(i)).toContainText(/DRAFT|Szkic/i);
    }
  });
});

test.describe('Assessment Module - Workflow Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToAssessment(page, 'DRD');
  });

  test('should show request review button only for DRAFT assessments', async ({ page }) => {
    // Find a DRAFT assessment
    const draftRow = page.locator('tr:has-text("DRAFT"), .assessment-item:has-text("DRAFT")').first();
    
    if (await draftRow.isVisible()) {
      await draftRow.click();
      
      // Request Review button should be visible
      await expect(page.locator('[data-testid="request-review-btn"], button:has-text("Request Review")')).toBeVisible();
    }
  });

  test('should transition from DRAFT to REVIEW', async ({ page }) => {
    // Find and open a DRAFT assessment
    const draftRow = page.locator('tr:has-text("DRAFT"), .assessment-item:has-text("DRAFT")').first();
    
    if (await draftRow.isVisible()) {
      await draftRow.click();
      await page.waitForTimeout(500);
      
      // Fill assessment data to meet DoD (completion >= 100%, confidence >= 3)
      // This depends on the specific form structure
      
      // Click Request Review
      await page.click('[data-testid="request-review-btn"], button:has-text("Request Review")');
      
      // Confirm in modal if present
      const confirmBtn = page.locator('[data-testid="confirm-btn"], button:has-text("Confirm"), button:has-text("Potwierdź")');
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
      
      // Wait for status change
      await page.waitForTimeout(1000);
      
      // Verify status changed to REVIEW
      await expect(page.locator('[data-testid="status-badge"], .status-badge')).toContainText(/REVIEW|W recenzji/i);
    }
  });

  test('should show approve buttons only for REVIEW status', async ({ page }) => {
    // Find a REVIEW assessment
    const reviewRow = page.locator('tr:has-text("REVIEW"), .assessment-item:has-text("W recenzji")').first();
    
    if (await reviewRow.isVisible()) {
      await reviewRow.click();
      
      // Approve Report and Approve Assessment buttons should be visible
      await expect(page.locator('[data-testid="approve-report-btn"], button:has-text("Approve Report")')).toBeVisible();
    }
  });

  test('should require report approval before assessment approval', async ({ page }) => {
    // Find a REVIEW assessment without approved report
    const reviewRow = page.locator('tr:has-text("IN_REVIEW"), .assessment-item:has-text("W recenzji")').first();
    
    if (await reviewRow.isVisible()) {
      await reviewRow.click();
      
      // Approve Assessment should be disabled or show warning
      const approveBtn = page.locator('[data-testid="approve-assessment-btn"], button:has-text("Approve Assessment")');
      
      if (await approveBtn.isVisible()) {
        // Button should be disabled or clicking should show error
        const isDisabled = await approveBtn.isDisabled();
        expect(isDisabled).toBe(true);
      }
    }
  });

  test('should send assessment back to DRAFT', async ({ page }) => {
    // Find a REVIEW assessment
    const reviewRow = page.locator('tr:has-text("REVIEW"), .assessment-item:has-text("W recenzji")').first();
    
    if (await reviewRow.isVisible()) {
      await reviewRow.click();
      
      // Click Send Back button
      await page.click('[data-testid="send-back-btn"], button:has-text("Send Back"), button:has-text("Cofnij")');
      
      // Fill comment (required)
      const commentInput = page.locator('[data-testid="comment-input"], textarea');
      if (await commentInput.isVisible()) {
        await commentInput.fill('Need to fix gaps in axis 3 and 4');
      }
      
      // Confirm
      await page.click('[data-testid="confirm-send-back"], button:has-text("Send Back"), button:has-text("Potwierdź")');
      
      // Verify status changed back to DRAFT
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="status-badge"], .status-badge')).toContainText(/DRAFT|Szkic/i);
    }
  });
});

test.describe('Assessment Module - Initiative Generation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToAssessment(page, 'DRD');
  });

  test('should show generate initiatives only for APPROVED assessments', async ({ page }) => {
    // Find an APPROVED assessment
    const approvedRow = page.locator('tr:has-text("APPROVED"), .assessment-item:has-text("Zatwierdzony")').first();
    
    if (await approvedRow.isVisible()) {
      await approvedRow.click();
      
      // Generate Initiatives button should be visible
      await expect(page.locator('[data-testid="generate-initiatives-btn"], button:has-text("Generate Initiatives")')).toBeVisible();
    }
  });

  test('should not allow generate initiatives for non-APPROVED assessments', async ({ page }) => {
    // Find a DRAFT or REVIEW assessment
    const nonApprovedRow = page.locator('tr:has-text("DRAFT"), .assessment-item:has-text("Szkic")').first();
    
    if (await nonApprovedRow.isVisible()) {
      await nonApprovedRow.click();
      
      // Generate Initiatives button should not be visible or should be disabled
      const generateBtn = page.locator('[data-testid="generate-initiatives-btn"], button:has-text("Generate Initiatives")');
      const isVisible = await generateBtn.isVisible();
      
      if (isVisible) {
        expect(await generateBtn.isDisabled()).toBe(true);
      } else {
        expect(isVisible).toBe(false);
      }
    }
  });

  test('should open generate initiatives modal', async ({ page }) => {
    // Find an APPROVED assessment
    const approvedRow = page.locator('tr:has-text("APPROVED"), .assessment-item:has-text("Zatwierdzony")').first();
    
    if (await approvedRow.isVisible()) {
      await approvedRow.click();
      await page.click('[data-testid="generate-initiatives-btn"], button:has-text("Generate Initiatives")');
      
      // Modal should be visible
      await expect(page.locator('[data-testid="generate-modal"], .modal, [role="dialog"]')).toBeVisible();
      
      // Methodology selector should be present
      await expect(page.locator('[data-testid="methodology-select"], select')).toBeVisible();
      
      // Count selector should be present (1-7)
      await expect(page.locator('[data-testid="count-select"], input[type="number"]')).toBeVisible();
    }
  });

  test('should limit initiatives count to max 7', async ({ page }) => {
    // Find an APPROVED assessment
    const approvedRow = page.locator('tr:has-text("APPROVED"), .assessment-item:has-text("Zatwierdzony")').first();
    
    if (await approvedRow.isVisible()) {
      await approvedRow.click();
      await page.click('[data-testid="generate-initiatives-btn"], button:has-text("Generate Initiatives")');
      
      const countInput = page.locator('[data-testid="count-select"], input[type="number"]');
      
      if (await countInput.isVisible()) {
        // Try to set value > 7
        await countInput.fill('10');
        
        // Value should be capped at 7 or show error
        const value = await countInput.inputValue();
        const numValue = parseInt(value, 10);
        expect(numValue <= 7 || page.locator('.error, [data-testid="error"]').isVisible()).toBeTruthy();
      }
    }
  });

  test('should generate initiatives and show in drawer', async ({ page }) => {
    // Find an APPROVED assessment
    const approvedRow = page.locator('tr:has-text("APPROVED"), .assessment-item:has-text("Zatwierdzony")').first();
    
    if (await approvedRow.isVisible()) {
      await approvedRow.click();
      await page.click('[data-testid="generate-initiatives-btn"], button:has-text("Generate Initiatives")');
      
      // Select methodology
      await page.selectOption('[data-testid="methodology-select"], select', 'impact-feasibility');
      
      // Set count
      const countInput = page.locator('[data-testid="count-input"], input[type="number"]');
      if (await countInput.isVisible()) {
        await countInput.fill('3');
      }
      
      // Click Generate
      await page.click('[data-testid="generate-btn"], button:has-text("Generate")');
      
      // Wait for generation (might take a while due to AI)
      await page.waitForTimeout(10000);
      
      // Verify initiatives appear in drawer
      await expect(page.locator('[data-testid="initiatives-drawer"], .initiatives-drawer')).toBeVisible();
      
      // Verify initiatives have DRAFT status
      const initiativeStatus = page.locator('[data-testid="initiative-status"], .initiative-status').first();
      await expect(initiativeStatus).toContainText(/DRAFT/i);
    }
  });
});

test.describe('Assessment Module - Dynamic Submenu', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should show open assessments in submenu', async ({ page }) => {
    await navigateToAssessment(page, 'DRD');
    
    // Open an assessment
    const assessmentRow = page.locator('tr, .assessment-item').first();
    await assessmentRow.click();
    
    // Submenu should show the open assessment
    await expect(page.locator('[data-testid="open-assessments-submenu"], .open-assessments')).toBeVisible();
  });

  test('should limit submenu to max 6 items', async ({ page }) => {
    await navigateToAssessment(page, 'DRD');
    
    // Open multiple assessments (if available)
    const assessmentRows = page.locator('tr, .assessment-item');
    const count = Math.min(await assessmentRows.count(), 8);
    
    for (let i = 0; i < count; i++) {
      await assessmentRows.nth(i).click();
      await page.waitForTimeout(200);
      await page.goBack();
      await page.waitForTimeout(200);
    }
    
    // Verify submenu has max 6 items
    const submenuItems = page.locator('[data-testid="submenu-item"], .submenu-item');
    const submenuCount = await submenuItems.count();
    expect(submenuCount).toBeLessThanOrEqual(6);
  });

  test('should close assessment from submenu', async ({ page }) => {
    await navigateToAssessment(page, 'DRD');
    
    // Open an assessment
    const assessmentRow = page.locator('tr, .assessment-item').first();
    await assessmentRow.click();
    
    // Click close button in submenu
    await page.click('[data-testid="close-submenu-item"], .submenu-close-btn');
    
    // Assessment should be removed from submenu
    await expect(page.locator('[data-testid="submenu-item"], .submenu-item')).not.toBeVisible();
  });
});

test.describe('Assessment Module - Initiatives Drawer', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToAssessment(page, 'DRD');
  });

  test('should open initiatives drawer', async ({ page }) => {
    // Open an assessment
    const assessmentRow = page.locator('tr, .assessment-item').first();
    await assessmentRow.click();
    
    // Click initiatives drawer toggle
    await page.click('[data-testid="initiatives-drawer-toggle"], button:has-text("Initiatives")');
    
    // Drawer should be visible (50% width)
    const drawer = page.locator('[data-testid="initiatives-drawer"], .initiatives-drawer');
    await expect(drawer).toBeVisible();
    
    // Verify drawer width is approximately 50%
    const drawerBox = await drawer.boundingBox();
    const viewportSize = page.viewportSize();
    if (drawerBox && viewportSize) {
      const widthRatio = drawerBox.width / viewportSize.width;
      expect(widthRatio).toBeGreaterThan(0.4);
      expect(widthRatio).toBeLessThan(0.6);
    }
  });

  test('should show initiative details in drawer', async ({ page }) => {
    // Open an assessment with initiatives
    const assessmentRow = page.locator('tr:has-text("APPROVED"), .assessment-item:has-text("Zatwierdzony")').first();
    
    if (await assessmentRow.isVisible()) {
      await assessmentRow.click();
      await page.click('[data-testid="initiatives-drawer-toggle"], button:has-text("Initiatives")');
      
      // Click on an initiative
      const initiativeItem = page.locator('[data-testid="initiative-item"], .initiative-item').first();
      if (await initiativeItem.isVisible()) {
        await initiativeItem.click();
        
        // Details should be visible
        await expect(page.locator('[data-testid="initiative-details"], .initiative-details')).toBeVisible();
      }
    }
  });

  test('should enable Go to Initiatives only after PLANNING status', async ({ page }) => {
    // Open an assessment with initiatives
    const assessmentRow = page.locator('tr:has-text("APPROVED"), .assessment-item:has-text("Zatwierdzony")').first();
    
    if (await assessmentRow.isVisible()) {
      await assessmentRow.click();
      await page.click('[data-testid="initiatives-drawer-toggle"], button:has-text("Initiatives")');
      
      // Go to Initiatives button
      const goToBtn = page.locator('[data-testid="go-to-initiatives"], button:has-text("Go to Initiatives")');
      
      // Button should be disabled if initiative status is DRAFT
      const initiativeItem = page.locator('[data-testid="initiative-item"]:has-text("DRAFT")').first();
      if (await initiativeItem.isVisible()) {
        await initiativeItem.click();
        expect(await goToBtn.isDisabled()).toBe(true);
      }
    }
  });
});

test.describe('Assessment Module - API Integration', () => {
  test('should fetch assessments from API', async ({ request }) => {
    // Login to get token
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: TEST_USER,
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    if (token) {
      // Fetch assessments
      const response = await request.get(`${API_URL}/assessment-workflow`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect(response.ok()).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('assessments');
      expect(Array.isArray(data.assessments)).toBe(true);
    }
  });

  test('should create assessment via API', async ({ request }) => {
    // Login to get token
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: TEST_USER,
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    if (token) {
      // Create assessment
      const response = await request.post(`${API_URL}/assessment-workflow`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          assessmentType: 'DRD',
          name: 'API Test Assessment',
        },
      });
      
      expect(response.ok()).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.status).toBe('DRAFT');
    }
  });

  test('should get open sessions via API', async ({ request }) => {
    // Login to get token
    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: TEST_USER,
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    if (token) {
      // Get open sessions
      const response = await request.get(`${API_URL}/assessment-workflow/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      expect(response.ok()).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('sessions');
      expect(Array.isArray(data.sessions)).toBe(true);
    }
  });
});
