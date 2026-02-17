/**
 * E2E Tests for Reporting Module
 *
 * Validates management report generation, export, templates, schedules, and workflows.
 * Tests all 4 report types: Team Meeting, Steering Committee, Portfolio Health, RAID
 *
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2 Highlight Reports
 */
import { expect, Page, test } from '@playwright/test';

async function login(page: Page) {
  const response = await page.request.post('/api/auth/demo-login');
  if (!response.ok()) {
    let errorDetail = '';
    try {
      const data = await response.json();
      errorDetail = JSON.stringify(data);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Demo login failed: ${response.status()} ${errorDetail}`);
  }
  const data = await response.json();

  await page.addInitScript(
    ({ token, refreshToken }) => {
      localStorage.setItem('token', token);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      sessionStorage.setItem('isDemo', 'true');
    },
    { token: data.token, refreshToken: data.refreshToken }
  );

  await page.goto('/dashboard');
}

async function getAuthToken(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  if (!token) {
    throw new Error('Missing auth token');
  }
  return token;
}

test.describe('Reporting Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Report Generation - All Types', () => {
    test('generates Portfolio Health report with RAG status and escalations', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'PORTFOLIO_HEALTH',
          scope: 'PORTFOLIO',
          periodDays: 30,
          aiEnhancement: false,
        },
      });
      expect(reportResponse.ok()).toBeTruthy();
      const reportData = await reportResponse.json();
      const report = reportData?.report;

      expect(report?.id).toBeTruthy();
      expect(report?.reportType).toBe('PORTFOLIO_HEALTH');
      expect(report?.scope).toBe('PORTFOLIO');
      expect(report?.content?.portfolioOverview).toBeDefined();
      expect(report?.content?.portfolioOverview?.overallHealth).toMatch(/GREEN|AMBER|RED|GREY/);
      expect(report?.content?.healthDrivers).toBeDefined();
      expect(report?.content?.projectHealth).toBeDefined();
    });

    test('generates Steering Committee report with decisions required', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'STEERING_COMMITTEE',
          scope: 'PORTFOLIO',
          periodDays: 30,
          aiEnhancement: false,
        },
      });
      expect(reportResponse.ok()).toBeTruthy();
      const reportData = await reportResponse.json();
      const report = reportData?.report;

      expect(report?.id).toBeTruthy();
      expect(report?.reportType).toBe('STEERING_COMMITTEE');
      expect(report?.content?.executiveSummary).toBeDefined();
      expect(report?.content?.overallStatus).toBeDefined();
      expect(report?.content?.overallStatus?.schedule).toBeDefined();
      expect(report?.content?.overallStatus?.budget).toBeDefined();
      expect(report?.content?.overallStatus?.scope).toBeDefined();
      expect(report?.content?.overallStatus?.risk).toBeDefined();
      // Decisions Required section should exist
      expect(report?.content?.decisionsRequired).toBeDefined();
    });

    test('generates RAID report with risks, assumptions, issues, dependencies', async ({
      page,
    }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'RAID',
          scope: 'PORTFOLIO',
          periodDays: 30,
          aiEnhancement: false,
        },
      });
      expect(reportResponse.ok()).toBeTruthy();
      const reportData = await reportResponse.json();
      const report = reportData?.report;

      expect(report?.id).toBeTruthy();
      expect(report?.reportType).toBe('RAID');
      expect(report?.content?.executiveSummary).toBeDefined();
      expect(report?.content?.risks).toBeDefined();
      expect(report?.content?.assumptions).toBeDefined();
      expect(report?.content?.issues).toBeDefined();
      expect(report?.content?.dependencies).toBeDefined();
      expect(report?.content?.escalations).toBeDefined();
    });

    test('generates Team Meeting report with task summary', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // First get a project ID
      const projectsResponse = await page.request.get('/api/projects', { headers });
      const projectsData = await projectsResponse.json();
      const projectId = projectsData?.projects?.[0]?.id;

      // Skip if no projects available
      if (!projectId) {
        test.skip(
          true,
          'No projects available in the E2E environment (GET /api/projects returned empty list)'
        );
        return;
      }

      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'TEAM_MEETING',
          scope: 'PROJECT',
          projectId,
          periodDays: 7,
          aiEnhancement: false,
        },
      });
      expect(reportResponse.ok()).toBeTruthy();
      const reportData = await reportResponse.json();
      const report = reportData?.report;

      expect(report?.id).toBeTruthy();
      expect(report?.reportType).toBe('TEAM_MEETING');
      expect(report?.scope).toBe('PROJECT');
      expect(report?.content?.statusSummary).toBeDefined();
      expect(report?.content?.statusSummary?.healthStatus).toMatch(/GREEN|AMBER|RED|GREY/);
      expect(report?.content?.completedWork).toBeDefined();
      expect(report?.content?.workInProgress).toBeDefined();
      expect(report?.content?.blockers).toBeDefined();
      expect(report?.content?.pendingDecisions).toBeDefined();
      expect(report?.content?.nextPeriodPlan).toBeDefined();
    });

    test('generates Team Weekly report', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      const projectsResponse = await page.request.get('/api/projects', { headers });
      const projectsData = await projectsResponse.json();
      const projectId = projectsData?.projects?.[0]?.id;

      if (!projectId) {
        test.skip(
          true,
          'No projects available in the E2E environment (GET /api/projects returned empty list)'
        );
        return;
      }

      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'TEAM_WEEKLY',
          scope: 'PROJECT',
          projectId,
          periodDays: 7,
          aiEnhancement: false,
        },
      });
      expect(reportResponse.ok()).toBeTruthy();
      const reportData = await reportResponse.json();

      expect(reportData?.report?.id).toBeTruthy();
      expect(reportData?.report?.reportType).toBe('TEAM_WEEKLY');
    });
  });

  test.describe('Report Export - PDF and PPTX', () => {
    test('exports report to PDF', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // Generate a report first
      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'PORTFOLIO_HEALTH',
          scope: 'PORTFOLIO',
          aiEnhancement: false,
        },
      });
      const reportData = await reportResponse.json();
      const reportId = reportData?.report?.id;
      expect(reportId).toBeTruthy();

      // Export to PDF
      const pdfResponse = await page.request.get(`/api/management-reports/${reportId}/pdf`, {
        headers,
      });
      expect(pdfResponse.ok()).toBeTruthy();
      const pdfPayload = await pdfResponse.json();
      expect(pdfPayload?.pdfUrl).toContain(`${reportId}.pdf`);
    });

    test('exports report to PPTX', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // Generate a report first
      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'STEERING_COMMITTEE',
          scope: 'PORTFOLIO',
          aiEnhancement: false,
        },
      });
      const reportData = await reportResponse.json();
      const reportId = reportData?.report?.id;
      expect(reportId).toBeTruthy();

      // Export to PPTX
      const pptxResponse = await page.request.get(`/api/management-reports/${reportId}/pptx`, {
        headers,
      });
      expect(pptxResponse.ok()).toBeTruthy();
      const pptxPayload = await pptxResponse.json();
      expect(pptxPayload?.pptxUrl).toContain(`${reportId}.pptx`);
    });
  });

  test.describe('Report Templates', () => {
    test('creates and lists report templates', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // Create a template
      const createResponse = await page.request.post('/api/management-reports/templates', {
        headers,
        data: {
          name: 'E2E Test Template',
          description: 'Template for E2E testing',
          reportType: 'STEERING_COMMITTEE',
          sections: ['executiveSummary', 'overallStatus', 'decisionsRequired'],
        },
      });
      expect(createResponse.ok()).toBeTruthy();
      const createData = await createResponse.json();
      expect(createData?.template?.id).toBeTruthy();
      expect(createData?.template?.name).toBe('E2E Test Template');

      // List templates
      const listResponse = await page.request.get('/api/management-reports/templates', { headers });
      expect(listResponse.ok()).toBeTruthy();
      const listData = await listResponse.json();
      expect(listData?.templates).toBeDefined();
      expect(Array.isArray(listData?.templates)).toBeTruthy();

      // Delete template (cleanup)
      const deleteResponse = await page.request.delete(
        `/api/management-reports/templates/${createData.template.id}`,
        { headers }
      );
      expect(deleteResponse.ok()).toBeTruthy();
    });
  });

  test.describe('Report Schedules', () => {
    test('creates and lists recurring schedules', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // Create a schedule
      const createResponse = await page.request.post('/api/management-reports/schedules', {
        headers,
        data: {
          reportType: 'PORTFOLIO_HEALTH',
          scope: 'PORTFOLIO',
          frequency: 'WEEKLY',
          dayOfWeek: 1, // Monday
          timeOfDay: '09:00',
          timezone: 'Europe/Warsaw',
          recipients: ['test@example.com'],
        },
      });
      expect(createResponse.ok()).toBeTruthy();
      const createData = await createResponse.json();
      expect(createData?.schedule?.id).toBeTruthy();
      expect(createData?.schedule?.frequency).toBe('WEEKLY');
      expect(createData?.schedule?.nextScheduledAt).toBeTruthy();

      // List schedules
      const listResponse = await page.request.get('/api/management-reports/schedules', { headers });
      expect(listResponse.ok()).toBeTruthy();
      const listData = await listResponse.json();
      expect(listData?.schedules).toBeDefined();
      expect(Array.isArray(listData?.schedules)).toBeTruthy();

      // Delete schedule (cleanup)
      const deleteResponse = await page.request.delete(
        `/api/management-reports/schedules/${createData.schedule.id}`,
        { headers }
      );
      expect(deleteResponse.ok()).toBeTruthy();
    });
  });

  test.describe('Report History', () => {
    test('retrieves report history with filters', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // Generate a report first
      await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'RAID',
          scope: 'PORTFOLIO',
          aiEnhancement: false,
        },
      });

      // Get history without filters
      const historyResponse = await page.request.get('/api/management-reports/history', {
        headers,
      });
      expect(historyResponse.ok()).toBeTruthy();
      const historyData = await historyResponse.json();
      expect(historyData?.reports).toBeDefined();
      expect(Array.isArray(historyData?.reports)).toBeTruthy();

      // Get history with type filter
      const filteredResponse = await page.request.get(
        '/api/management-reports/history?reportType=RAID',
        { headers }
      );
      expect(filteredResponse.ok()).toBeTruthy();
      const filteredData = await filteredResponse.json();
      expect(filteredData?.reports).toBeDefined();
      // All reports should be RAID type
      filteredData?.reports?.forEach((report: { reportType: string }) => {
        expect(report.reportType).toBe('RAID');
      });
    });
  });

  test.describe('Report Sharing', () => {
    test('creates share link for report', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // Generate a report first
      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'PORTFOLIO_HEALTH',
          scope: 'PORTFOLIO',
          aiEnhancement: false,
        },
      });
      const reportData = await reportResponse.json();
      const reportId = reportData?.report?.id;

      // Create share link
      const shareResponse = await page.request.post(`/api/management-reports/${reportId}/share`, {
        headers,
        data: {
          expiresInDays: 7,
        },
      });
      expect(shareResponse.ok()).toBeTruthy();
      const shareData = await shareResponse.json();
      expect(shareData?.shareUrl).toBeTruthy();
      expect(shareData?.shareUrl).toContain('/reports/share/');
    });
  });

  test.describe('Report Approval Workflow', () => {
    test('submits report for approval', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // Generate a report that requires approval
      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'STEERING_COMMITTEE',
          scope: 'PORTFOLIO',
          aiEnhancement: false,
          requiresApproval: true,
          approvalConfig: {
            levels: [{ level: 1, role: 'MANAGER' }],
          },
        },
      });
      const reportData = await reportResponse.json();
      const reportId = reportData?.report?.id;

      // Submit for approval
      const submitResponse = await page.request.post(`/api/management-reports/${reportId}/submit`, {
        headers,
      });
      expect(submitResponse.ok()).toBeTruthy();

      // Check approval status
      const statusResponse = await page.request.get(
        `/api/management-reports/${reportId}/approval-status`,
        { headers }
      );
      expect(statusResponse.ok()).toBeTruthy();
      const statusData = await statusResponse.json();
      expect(statusData?.status).toBe('PENDING');
    });
  });

  test.describe('Report Versioning', () => {
    test('retrieves report versions', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // Generate a report
      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'PORTFOLIO_HEALTH',
          scope: 'PORTFOLIO',
          aiEnhancement: false,
        },
      });
      const reportData = await reportResponse.json();
      const reportId = reportData?.report?.id;

      // Get versions
      const versionsResponse = await page.request.get(
        `/api/management-reports/${reportId}/versions`,
        { headers }
      );
      expect(versionsResponse.ok()).toBeTruthy();
      const versionsData = await versionsResponse.json();
      expect(versionsData?.versions).toBeDefined();
      expect(Array.isArray(versionsData?.versions)).toBeTruthy();
      // Should have at least initial version
      expect(versionsData?.versions?.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Decisions Required Integration', () => {
    test('report contains decisions required section with escalations', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      // Generate Steering Committee report which should have decisions
      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'STEERING_COMMITTEE',
          scope: 'PORTFOLIO',
          periodDays: 30,
          aiEnhancement: false,
        },
      });
      expect(reportResponse.ok()).toBeTruthy();
      const reportData = await reportResponse.json();
      const report = reportData?.report;

      // Verify decisionsRequired section structure
      expect(report?.content?.decisionsRequired).toBeDefined();
      expect(Array.isArray(report?.content?.decisionsRequired)).toBeTruthy();

      // If there are decisions, verify they have proper structure
      if (report?.content?.decisionsRequired?.length > 0) {
        const decision = report.content.decisionsRequired[0];
        expect(decision.id).toBeDefined();
        expect(decision.title).toBeDefined();
        expect(decision.decisionType).toBeDefined();
      }

      // Verify warnings/escalations are present in report structure
      expect(report?.content?.warnings).toBeDefined();
    });
  });

  test.describe('RAG Status Display', () => {
    test('Portfolio Health report shows RAG status for all categories', async ({ page }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'PORTFOLIO_HEALTH',
          scope: 'PORTFOLIO',
          aiEnhancement: false,
        },
      });
      const reportData = await reportResponse.json();
      const report = reportData?.report;

      // Check overall health RAG
      expect(report?.content?.portfolioOverview?.overallHealth).toMatch(/GREEN|AMBER|RED|GREY/);

      // Check health drivers have RAG status
      report?.content?.healthDrivers?.forEach(
        (driver: { category: string; status: string; summary: string }) => {
          expect(driver.category).toBeDefined();
          expect(driver.status).toMatch(/GREEN|AMBER|RED|GREY/);
          expect(driver.summary).toBeDefined();
        }
      );

      // Check project health RAG
      report?.content?.projectHealth?.forEach(
        (project: { projectId: string; projectName: string; status: string }) => {
          expect(project.projectId).toBeDefined();
          expect(project.status).toMatch(/GREEN|AMBER|RED|GREY/);
        }
      );
    });

    test('Steering Committee report shows RAG grid (schedule/budget/scope/risk)', async ({
      page,
    }) => {
      const token = await getAuthToken(page);
      const headers = { Authorization: `Bearer ${token}` };

      const reportResponse = await page.request.post('/api/management-reports/generate', {
        headers,
        data: {
          reportType: 'STEERING_COMMITTEE',
          scope: 'PORTFOLIO',
          aiEnhancement: false,
        },
      });
      const reportData = await reportResponse.json();
      const report = reportData?.report;

      // Check all RAG categories in overallStatus
      const overallStatus = report?.content?.overallStatus;
      expect(overallStatus?.schedule?.status).toMatch(/GREEN|AMBER|RED|GREY/);
      expect(overallStatus?.budget?.status).toMatch(/GREEN|AMBER|RED|GREY/);
      expect(overallStatus?.scope?.status).toMatch(/GREEN|AMBER|RED|GREY/);
      expect(overallStatus?.risk?.status).toMatch(/GREEN|AMBER|RED|GREY/);
      expect(overallStatus?.overallHealth).toMatch(/GREEN|AMBER|RED|GREY/);
    });
  });
});
