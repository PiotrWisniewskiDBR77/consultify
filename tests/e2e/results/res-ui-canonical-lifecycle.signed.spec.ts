import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const WEB = process.env.E2E_BASE_URL || 'http://127.0.0.1:4310';
const PASSWORD = 'RnG6Runtime!2026';
const ADMIN = 'rn-g6-user-a-admin@consultify.local';

const KPI_DRAFT = '4d5db4f4-454e-4813-8813-4d5db4454ebd';
const ROI_MODELING = '4d60dfca-463e-4b5e-8b5e-4d60df463e9a';
const ROI_TRACKING = '4d60dfcc-463e-4b5e-8b5e-4d60df463e9a';
const ROI_PIR = '4d60dfcd-463e-4b5e-8b5e-4d60df463e9a';
const OKR_ACTIVE = 'f772dd20-6d67-49a1-89a1-f772dd6d67ca';

async function login(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /^(Log in|Zaloguj)/i }).first().click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
  const skip = page.getByRole('button', { name: /^(Skip for now|Pomiń na razie)$/i });
  if (await skip.isVisible({ timeout: 2_000 }).catch(() => false)) await skip.click();
  return { context, page };
}

async function openDraftEditor(page: Page): Promise<void> {
  await page.goto(`${WEB}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('results-vnext-kpi-registry-page')).toBeVisible();
  await page.locator('button:has-text("Org"), button:has-text("Organizacja")').first().click();
  await page.getByText('KPI-A-003', { exact: true }).first().click();
  const edit = page.getByRole('button', { name: /^(Edit draft|Edytuj szkic)$/ }).first();
  await expect(edit).toBeEnabled({ timeout: 15_000 });
  await edit.click();
  await expect(page.getByTestId('kpi-draft-name')).toBeVisible();
}

test.describe('RES-UI-CANON exact-current signed lifecycle', () => {
  test('KPI stale edit fails closed and reconciles to the authoritative value', async ({ browser }) => {
    const first = await login(browser);
    const stale = await login(browser);
    try {
      await openDraftEditor(first.page);
      await openDraftEditor(stale.page);

      const marker = `KPI current winner ${Date.now()}`;
      await first.page.getByTestId('kpi-draft-name').fill(marker);
      await first.page.getByTestId('kpi-draft-form-submit').click();
      await expect(first.page.getByTestId('kpi-draft-name')).toBeHidden({ timeout: 15_000 });

      await stale.page.getByTestId('kpi-draft-name').fill(`stale loser ${Date.now()}`);
      const staleResponse = stale.page.waitForResponse(
        (response) => response.url().includes(`/api/vnext/results/kpi/${KPI_DRAFT}/draft`) && response.request().method() === 'PUT'
      );
      await stale.page.getByTestId('kpi-draft-form-submit').click();
      expect((await staleResponse).status()).toBe(409);
      await expect(stale.page.getByTestId('kpi-draft-form-error')).toBeVisible();
      await expect(stale.page.getByTestId('kpi-draft-form-error')).toContainText(/changed|conflict|zmien/i);

      await stale.page.getByRole('button', { name: /^(Cancel|Anuluj)$/ }).click();
      await stale.page.reload({ waitUntil: 'domcontentloaded' });
      await stale.page.locator('button:has-text("Org"), button:has-text("Organizacja")').first().click();
      await stale.page.getByText('KPI-A-003', { exact: true }).first().click();
      const reconciledEdit = stale.page.getByRole('button', { name: /^(Edit draft|Edytuj szkic)$/ }).first();
      await expect(reconciledEdit).toBeEnabled({ timeout: 15_000 });
      await reconciledEdit.click();
      await expect(stale.page.getByTestId('kpi-draft-name')).toHaveValue(marker);
    } finally {
      await first.context.close();
      await stale.context.close();
    }
  });

  test('KPI, ROI and OKR mounted records survive exact deep links and cold reload', async ({ browser }) => {
    const actor = await login(browser);
    try {
      const routes = [
        `/results/kpi/${KPI_DRAFT}?ff_resultsVNextKpi=1`,
        `/results/roi/cases/${ROI_MODELING}?ff_resultsVNextRoi=1`,
        `/results/roi/cases/${ROI_TRACKING}?ff_resultsVNextRoi=1`,
        `/results/roi/cases/${ROI_PIR}?ff_resultsVNextRoi=1`,
        `/results/okr/sets/${OKR_ACTIVE}?ff_resultsVNextOkr=1`,
      ];
      for (const route of routes) {
        await actor.page.goto(`${WEB}${route}`, { waitUntil: 'domcontentloaded' });
        await expect(actor.page.locator('main')).toBeVisible({ timeout: 15_000 });
        await expect(actor.page.getByText(/not yet enabled|jeszcze niedostępn/i)).toHaveCount(0);
        await expect(actor.page.locator('[role="alert"]')).toHaveCount(0);
        const before = actor.page.url();
        await actor.page.reload({ waitUntil: 'domcontentloaded' });
        await expect(actor.page).toHaveURL(before);
        await expect(actor.page.locator('main')).toBeVisible({ timeout: 15_000 });
      }

      await expect(actor.page.getByText('OKR zespołu operacyjnego — transformacja Q3 2026', { exact: true })).toBeVisible();
      await expect(actor.page.getByText(/Objectives & Key Results|Cele i kluczowe rezultaty/i, { exact: true })).toBeVisible();
      await expect(actor.page.getByText(/^(History|Historia)$/i, { exact: true })).toBeVisible();
    } finally {
      await actor.context.close();
    }
  });
});
