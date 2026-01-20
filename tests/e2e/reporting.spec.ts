/**
 * E2E Tests for Reporting exports
 *
 * Validates management report generation and export endpoints.
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

test.describe('Reporting exports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('generates management report and exports PDF/PPTX', async ({ page }) => {
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
    expect(reportResponse.ok()).toBeTruthy();
    const reportData = await reportResponse.json();
    const reportId = reportData?.report?.id;
    expect(reportId).toBeTruthy();

    const pdfResponse = await page.request.get(`/api/management-reports/${reportId}/pdf`, {
      headers,
    });
    expect(pdfResponse.ok()).toBeTruthy();
    const pdfPayload = await pdfResponse.json();
    expect(pdfPayload?.pdfUrl).toContain(`${reportId}.pdf`);

    const pptxResponse = await page.request.get(`/api/management-reports/${reportId}/pptx`, {
      headers,
    });
    expect(pptxResponse.ok()).toBeTruthy();
    const pptxPayload = await pptxResponse.json();
    expect(pptxPayload?.pptxUrl).toContain(`${reportId}.pptx`);
  });
});
