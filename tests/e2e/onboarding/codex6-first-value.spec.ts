import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type APIResponse, type Page } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:4216';
const EVIDENCE_DIR = path.resolve('evidence/pilotaz-przeplyw');

async function responseJson(response: APIResponse): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${response.request().method()} ${response.url()} returned non-JSON: ${text.slice(0, 300)}`);
  }
}

async function expectOk(response: APIResponse, label: string): Promise<any> {
  const body = await responseJson(response);
  expect(response.status(), `${label}: HTTP ${response.status()} ${JSON.stringify(body)}`).toBeLessThan(400);
  return body;
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((nextTheme) => {
    const key = 'consultify-storage';
    const parsed = JSON.parse(localStorage.getItem(key) || '{"state":{}}');
    parsed.state = { ...(parsed.state || {}), theme: nextTheme };
    localStorage.setItem(key, JSON.stringify(parsed));
  }, theme);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toBeVisible();
}

async function captureThemes(page: Page, step: string) {
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, `${step}-${theme}.png`),
      fullPage: true,
    });
  }
}

async function dismissTour(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip for now' });
  if ((await skip.count()) > 0 && (await skip.isVisible())) await skip.click();
}

test.describe('CODEX6 E1 — fresh organization to first result', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: { cookies: [], origins: [] } });

  test('registration → context → interview → assessment → initiative → task → result', async ({ page }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const apiFailures: Array<{ status: number; method: string; url: string }> = [];
    page.on('response', (response) => {
      const status = response.status();
      if (response.url().includes('/api/') && (status === 404 || status >= 500)) {
        apiFailures.push({ status, method: response.request().method(), url: response.url() });
      }
    });

    const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const email = `codex6-first-value-${suffix}@test.invalid`;
    const companyName = `Pilot Manufacturing ${suffix}`;

    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await captureThemes(page, '01-registration');

    const bareInputs = page.locator('input:not([type])');
    await bareInputs.nth(0).fill('Pilot');
    await bareInputs.nth(1).fill('Owner');
    await page.locator('input[type="email"]').fill(email);
    await bareInputs.nth(2).fill(companyName);
    await page.locator('input[type="password"]').first().fill('Codex6-Fresh-Org-Password-123!');
    await page.locator('input[type="checkbox"]').first().click();

    const [registrationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/auth/register') && response.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Create account & start' }).click(),
    ]);
    const registration = await expectOk(registrationResponse, 'registration');
    const token = String(registration.token || '');
    const userId = String(registration.user?.id || '');
    expect(token).toBeTruthy();
    expect(userId).toBeTruthy();
    const auth = { Authorization: `Bearer ${token}` };
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const projects = await expectOk(
      await page.request.get(`${API_BASE_URL}/api/projects`, { headers: auth }),
      'starter project readback'
    );
    const project = (projects.projects || projects.data || projects)[0];
    expect(project?.name).toBe('First value workspace');
    const projectId = String(project.id);

    await expectOk(
      await page.request.post(`${API_BASE_URL}/api/onboarding/context`, {
        headers: auth,
        data: {
          role: 'Operations Director',
          industry: 'Manufacturing',
          problems: 'Unplanned downtime and late customer deliveries',
          urgency: 'High',
          targets: 'Reduce unplanned downtime by 20 percent',
        },
      }),
      'organization context'
    );
    await page.goto('/organization');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await expect(page.locator('body')).toContainText(/organization|profile|context/i);
    await captureThemes(page, '02-organization-context');

    const interview = await expectOk(
      await page.request.post(`${API_BASE_URL}/api/interview/sessions`, {
        headers: auth,
        data: { name: 'Pilot discovery interview' },
      }),
      'interview creation'
    );
    expect(interview.id).toBeTruthy();
    await page.goto('/interview');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
    await expect(page.locator('body')).toContainText('Pilot discovery interview');
    await captureThemes(page, '03-interview');

    const assessment = await expectOk(
      await page.request.post(`${API_BASE_URL}/api/assessment-workflow-v2`, {
        headers: auth,
        data: {
          assessmentType: 'DRD',
          name: 'Pilot digital readiness assessment',
          projectId,
          businessUnit: 'Operations',
        },
      }),
      'assessment creation'
    );
    expect(assessment.id || assessment.assessment?.id).toBeTruthy();
    await page.goto('/assessment');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await expect(page.locator('body')).toContainText(/assessment|digital readiness/i);
    await captureThemes(page, '04-assessment');

    const initiative = await expectOk(
      await page.request.post(`${API_BASE_URL}/api/initiatives`, {
        headers: auth,
        data: {
          title: 'Reduce unplanned downtime on Line 3',
          summary: 'Introduce condition monitoring and a weekly maintenance review.',
          problemStatement: 'Line 3 loses more than 40 hours each month to unplanned downtime.',
          hypothesis: 'Condition monitoring will surface failures before production stops.',
          projectId,
          priority: 'high',
          sourceType: 'manual',
        },
      }),
      'initiative creation'
    );
    const initiativeId = String(initiative.id || initiative.initiative?.id || '');
    expect(initiativeId).toBeTruthy();
    await page.goto('/initiatives');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await expect(page.locator('body')).toContainText('Reduce unplanned downtime on Line 3');
    await captureThemes(page, '05-initiative');

    const task = await expectOk(
      await page.request.post(`${API_BASE_URL}/api/tasks`, {
        headers: auth,
        data: {
          title: 'Install vibration sensors on Line 3',
          description: 'Install and validate sensors on the two critical CNC assets.',
          expectedOutcome: 'A usable weekly condition-monitoring signal.',
          projectId,
          initiativeId,
          assigneeId: userId,
          ownerId: userId,
          priority: 'high',
          dueDate: '2026-10-15',
          idempotencyKey: `codex6-e1-task-${suffix}`,
        },
      }),
      'task creation'
    );
    expect(task.id || task.task?.id).toBeTruthy();
    await page.goto('/execution');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await expect(page.locator('body')).toContainText(/execution|work|task/i);
    await captureThemes(page, '06-task');

    const kpiResponse = await expectOk(
      await page.request.post(`${API_BASE_URL}/api/vnext/results/kpi`, {
        headers: auth,
        data: {
          kpiCode: `PILOT-${suffix.slice(-8)}`,
          name: 'Unplanned downtime',
          targetGeometry: 'threshold_max',
          targetValue: 40,
          measurementFrequencyDays: 30,
          idempotencyKey: `codex6-e1-kpi-${suffix}`,
        },
      }),
      'KPI creation'
    );
    const kpiId = String(kpiResponse.kpi?.kpiId || '');
    expect(kpiId).toBeTruthy();

    await expectOk(
      await page.request.post(`${API_BASE_URL}/api/vnext/results/kpi/${kpiId}/measurements`, {
        headers: auth,
        data: {
          periodStart: '2026-09-01T00:00:00.000Z',
          periodEnd: '2026-09-30T23:59:59.000Z',
          actualValue: 48,
          source: 'manual',
          notes: 'First pilot result after the sensor installation task started.',
          idempotencyKey: `codex6-e1-result-${suffix}`,
        },
      }),
      'first result'
    );
    await page.goto('/results/kpi');
    await page.waitForLoadState('networkidle');
    await dismissTour(page);
    await expect(page.locator('body')).toContainText(/results|KPI|Unplanned downtime/i);
    await captureThemes(page, '07-first-result');

    expect(apiFailures, `unexpected API 404/5xx: ${JSON.stringify(apiFailures, null, 2)}`).toEqual([]);
  });
});
