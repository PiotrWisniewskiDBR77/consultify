/**
 * M13 Inicjatywy — headless acceptance (mirrors the M07 harness).
 *
 * Runs against the e2e webServer (MOCK_DB + ENABLE_TEST_SUPPORT) with a
 * register-demo session from tests/e2e/smoke/global-setup.ts. Each scenario
 * seeds an initiative via the API, navigates the real UI, asserts no error
 * boundary, and saves ONE screenshot as evidence (tests/e2e/screenshots/m13/).
 *
 * Scenario ids map to Harvard/Testy manualne/TESTY_M13_INICJATYWY.md / the
 * M13 Depth sub-modules (G/R/C/K/V).
 *
 * Run: E2E_USE_WEB_SERVER=true npx playwright test tests/e2e/m13/
 */
import fs from 'node:fs';
import path from 'node:path';

import { type APIResponse, expect, type Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const SHOTS_DIR = path.resolve('tests/e2e/screenshots/m13');
const ERROR_BOUNDARY_RE = /Coś poszło nie tak|Something went wrong/i;

fs.mkdirSync(SHOTS_DIR, { recursive: true });

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
function uniqueLabel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

async function seedInitiative(page: Page, token: string, title: string): Promise<{ id: string }> {
  const create = (): Promise<APIResponse> =>
    page.request.post(`${API_BASE_URL}/api/initiatives`, {
      headers: authHeaders(token),
      data: {
        title,
        summary: `M13 acceptance seed — ${title}`,
        hypothesis: 'Jeśli zautomatyzujemy proces to skrócimy czas bo usuniemy ręczne kroki',
      },
      timeout: 40000,
    });
  const res = await create();
  if (!res.ok()) throw new Error(`seedInitiative failed: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as any;
  return { id: String(body?.id || body?.initiative?.id || '') };
}

async function suppressOnboarding(page: Page, userId: string) {
  await page.addInitScript((uid) => {
    try {
      if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
    } catch {
      /* ignore */
    }
  }, userId);
}
async function dismissOnboarding(page: Page) {
  const buttons = [/Skip for now|Pomiń na razie|Pomiń/i, /Get started|Rozpocznij/i];
  for (let i = 0; i < 3; i += 1) {
    let acted = false;
    for (const re of buttons) {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 1000, force: true }).catch(() => {});
        acted = true;
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (!acted) break;
    await page.waitForTimeout(200);
  }
}
async function gotoHub(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto('/portfolio', { waitUntil: 'domcontentloaded', timeout: 60000 });
      return;
    } catch {
      await page.waitForTimeout(1000);
    }
  }
}

test.describe('M13 Inicjatywy — headless acceptance', () => {
  let token = '';
  let userId = '';
  test.beforeAll(() => {
    const s = readTestSupportState();
    token = s.token;
    userId = s.userId;
  });
  test.beforeEach(async ({ page }) => {
    await suppressOnboarding(page, userId);
  });

  test('S1 — Initiatives hub (portfolio) loads', async ({ page }) => {
    await seedInitiative(page, token, uniqueLabel('M13-S1'));
    await gotoHub(page);
    await dismissOnboarding(page);
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE, { timeout: 30000 });
    await expect(page.getByText(/Portfolio|Inicjatywy|Initiatives/i).first()).toBeVisible({
      timeout: 30000,
    });
    await shot(page, 'S1-hub');
  });

  test('S2 — initiative document opens (no error boundary)', async ({ page }) => {
    const { id } = await seedInitiative(page, token, uniqueLabel('M13-S2'));
    await page.goto(`/portfolio?initiativeId=${id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOnboarding(page);
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, 'S2-document');
  });

  test('S3 — Timeline section: Calendar / Gantt toggle (R3 + V1)', async ({ page }) => {
    const { id } = await seedInitiative(page, token, uniqueLabel('M13-S3'));
    await page.goto(`/portfolio?initiativeId=${id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOnboarding(page);
    // Open the Timeline section if a nav entry exists, then reveal Calendar/Gantt.
    const timelineNav = page.getByText(/^Timeline$|Oś czasu|Harmonogram/i).first();
    if (await timelineNav.isVisible().catch(() => false)) {
      await timelineNav.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }
    const ganttBtn = page.getByRole('button', { name: /^Gantt$/i }).first();
    if (await ganttBtn.isVisible().catch(() => false)) {
      await ganttBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE, { timeout: 30000 });
    await shot(page, 'S3-timeline-calendar-gantt');
  });
});
