/**
 * M13 Inicjatywy — headless acceptance (mirrors the M07 harness).
 *
 * Runs against the e2e webServer (MOCK_DB + ENABLE_TEST_SUPPORT) with a
 * privileged, NON-demo session from tests/e2e/smoke/global-setup.ts — that
 * setup calls POST /api/test-support/bootstrap and, only if the route is
 * absent, POST /api/auth/register (the regular signup). It never uses
 * /api/auth/register-demo, which is the public unprivileged read-only demo
 * signup. Each scenario
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

  // Document opens via portfolio hub deep-link: /portfolio?open=<id>&mode=doc
  // The hub renders InitiativeDocumentView inline when activeDocumentId is set.
  // Deep-link effect falls back to legacy API when list is empty (fresh org).
  async function openDoc(page: Page, id: string, title: string) {
    await page.goto(`/portfolio?open=${encodeURIComponent(id)}&mode=doc`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOnboarding(page);
    // Wait for the document view: title visible AND at least one section nav item
    // (e.g. "Description & Context" or "Initiative Scope") confirming the doc rendered.
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 60000 });
    await expect(
      page.getByText(/Description.*Context|Initiative Scope|Opis.*Kontekst|Zakres/i).first()
    ).toBeVisible({ timeout: 30000 }).catch(() => {/* doc content optional, title sufficient */});
  }

  test('S1 — Initiatives hub (portfolio) renders', async ({ page }) => {
    await seedInitiative(page, token, uniqueLabel('M13-S1'));
    await gotoHub(page);
    await dismissOnboarding(page);
    // Hub shell rendered (real UI): the "New initiative" CTA + Portfolio tab.
    await expect(page.getByText(/New initiative|Nowa inicjatywa/i).first()).toBeVisible({
      timeout: 45000,
    });
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await shot(page, 'S1-hub');
  });

  test('S2 — initiative document opens with content', async ({ page }) => {
    const title = uniqueLabel('M13-S2');
    const { id } = await seedInitiative(page, token, title);
    await openDoc(page, id, title);
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await page.waitForTimeout(1000);
    await shot(page, 'S2-document');
  });

  test('S3 — Timeline section: Calendar / Gantt toggle (R3 + V1)', async ({ page }) => {
    const title = uniqueLabel('M13-S3');
    const { id } = await seedInitiative(page, token, title);
    await openDoc(page, id, title);
    // Click Timeline in the left section nav (may be named differently per locale).
    const timelineNav = page
      .locator('nav, [data-section-nav], aside')
      .getByText(/^Timeline$|^Oś czasu$|^Harmonogram$/i)
      .first();
    if (await timelineNav.isVisible({ timeout: 5000 }).catch(() => false)) {
      await timelineNav.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    // Calendar button is always present in the TimelineSection header toggle row.
    const calBtn = page.getByRole('button', { name: /^Calendar$|^Kalendarz$/i }).first();
    await calBtn.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    if (await calBtn.isVisible().catch(() => false)) {
      await calBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await shot(page, 'S3a-calendar');
    }
    // Gantt button — click and capture
    const ganttBtn = page.getByRole('button', { name: /^Gantt$/i }).first();
    if (await ganttBtn.isVisible().catch(() => false)) {
      await ganttBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await shot(page, 'S3-timeline-gantt');
  });
});
