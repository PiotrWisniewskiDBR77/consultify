import { chromium } from 'playwright';
import fs from 'node:fs';

const EVIDENCE_DIR =
  '/private/tmp/consultify-m01-organization/docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/evidence-m01-20260824';
const BASE_URL = 'http://127.0.0.1:4403';
const GOALS_URL = `${BASE_URL}/organization/goals/strategic-intent?ff_org_redesign_v1=1`;
const MARKER = '[cold-readback-check 2026-08-24T21:58Z]';

const networkLog = [];
const consoleLog = [];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.text().includes('DEBUG')) consoleLog.push(msg.text());
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/organization-context-store')) {
      let bodySnippet = null;
      try {
        const json = await res.json();
        bodySnippet = JSON.stringify(json).slice(0, 500);
      } catch {
        /* ignore */
      }
      networkLog.push({
        method: res.request().method(),
        url,
        status: res.status(),
        bodySnippet,
        ts: new Date().toISOString(),
      });
    }
  });

  // --- Login ---
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page
    .locator('input[type="email"], input#email, input[name="email"]')
    .first()
    .fill('w3.organization.owner@local.test');
  await page
    .locator('input[type="password"], input#password, input[name="password"]')
    .first()
    .fill('ConsultifyM01Evidence2026!');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForTimeout(3000);
  const skipBtn = page.getByText('Skip for now');
  if (await skipBtn.isVisible().catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(500);
  }

  // --- Navigate to "Cele i mierniki" (Goals & Metrics) with redesign flag ON ---
  await page.goto(GOALS_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const field = page.getByLabel('Cel nadrzędny');
  await field.waitFor({ state: 'visible', timeout: 15000 });
  const valueBefore = await field.inputValue();
  fs.writeFileSync(`${EVIDENCE_DIR}/cold-readback-goals-before-value.txt`, valueBefore, 'utf8');
  await page.screenshot({ path: `${EVIDENCE_DIR}/cold-readback-goals-01-before.png`, fullPage: false });

  const noteBefore = await page
    .getByText('Dane zapisywane są lokalnie', { exact: false })
    .isVisible()
    .catch(() => false);

  // --- Edit + Save ---
  await field.fill(MARKER);
  await page.getByTestId('org-state-panel-save').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${EVIDENCE_DIR}/cold-readback-goals-02-after-save.png`, fullPage: false });
  const noteAfterSave = await page
    .getByText('Dane zapisywane są lokalnie', { exact: false })
    .isVisible()
    .catch(() => false);
  // Race-condition regression check (found + fixed in this same session): two
  // independent writers to /organization-context-store used to trip this
  // exact banner even when each write individually succeeded.
  const raceBannerVisible = await page
    .getByText('readback did not match the persisted write', { exact: false })
    .isVisible()
    .catch(() => false);

  // --- Full page reload (cold readback) ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const fieldAfterReload = page.getByLabel('Cel nadrzędny');
  await fieldAfterReload.waitFor({ state: 'visible', timeout: 15000 });
  await fieldAfterReload.scrollIntoViewIfNeeded();
  const valueAfterReload = await fieldAfterReload.inputValue();
  await page.screenshot({ path: `${EVIDENCE_DIR}/cold-readback-goals-03-after-reload.png`, fullPage: false });

  // --- Restore original value ---
  await fieldAfterReload.fill(valueBefore);
  await page.getByTestId('org-state-panel-save').click();
  await page.waitForTimeout(2500);

  // --- Full page reload again (confirm restore) ---
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const fieldAfterRestore = page.getByLabel('Cel nadrzędny');
  await fieldAfterRestore.waitFor({ state: 'visible', timeout: 15000 });
  await fieldAfterRestore.scrollIntoViewIfNeeded();
  const valueAfterRestore = await fieldAfterRestore.inputValue();
  await page.screenshot({ path: `${EVIDENCE_DIR}/cold-readback-goals-04-after-restore.png`, fullPage: false });

  // --- Direct GET verification (bypassing UI cache entirely) ---
  const getResp = await page.request.get(`${BASE_URL}/api/organization-context-store`);
  const getJson = await getResp.json().catch(() => null);

  const result = {
    valueBeforeEdit: valueBefore,
    marker: MARKER,
    noteShownBeforeSave: noteBefore,
    noteShownAfterSave: noteAfterSave,
    raceBannerVisibleAfterSave: raceBannerVisible,
    valueAfterSaveAndReload: valueAfterReload,
    matchAfterSaveAndReload: valueAfterReload === MARKER,
    valueAfterRestoreAndReload: valueAfterRestore,
    matchAfterRestoreAndReload: valueAfterRestore === valueBefore,
    finalGetStatus: getResp.status(),
    finalGetGoalsPrimaryObjective: getJson?.goals?.primaryObjective ?? null,
    consoleLog,
    networkLog,
  };
  fs.writeFileSync(`${EVIDENCE_DIR}/cold-readback-goals-diagnostic.json`, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
}

main().catch(async (err) => {
  console.error('CAPTURE FAILED:', err);
  process.exit(1);
});

process.on('unhandledRejection', () => {});
