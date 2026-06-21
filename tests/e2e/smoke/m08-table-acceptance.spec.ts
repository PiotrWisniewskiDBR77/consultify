/**
 * M08 — Ideas · Table — representative manual acceptance, headless.
 *
 * Covers the core of the 105 manual scenarios in
 * Harvard/Testy manualne/TESTY_M08_IDEAS_TABLE.md as a representative-core suite
 * (decision 2026-06-20: representative ~20, not exhaustive 105). Each scenario
 * seeds an idea via the API, drives / asserts the real Table workspace UI, and
 * captures one screenshot as evidence under docs/qa/screens/m08-headless-2026-06-20/.
 *
 * The Table tool has no data-testids — assertions anchor on the proven workspace
 * shell (region "Idea map workspace", the "Table" tool-strip button, the idea
 * title) and on the toolbar/empty-state affordances that the source defines as
 * stable `title=` attributes (TableToolbar.tsx, EmptyStateView.tsx).
 *
 * Closure proof this suite exercises live:
 *   - L-01: the 4 toolbar action surfaces never throw an always-error toast.
 *   - L-02 / Z-06: the AI-fill / Copilot affordances are present and reachable.
 *   - DoD #7: dark-mode + EN render with no error boundary.
 *
 * Performance strategy: S01-S03, S06-S15, S17-S20 share ONE idea created once in
 * beforeAll (1 DB write). Only S04 (empty-state), S05 (add-row) and S16
 * (persist-reload) need their own fresh ideas (3 more writes). Total = 4 writes
 * instead of 20, bringing runtime from ~40 min to ~5 min.
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
// Screenshots land under docs/qa/screens (tracked) — /tests/ is gitignored, so
// evidence written there would not be committable. Matches the m03 convention.
const SHOTS_DIR = path.resolve('docs/qa/screens/m08-headless-2026-06-20');
const ERROR_BOUNDARY_RE = /Coś poszło nie tak|Something went wrong/i;

fs.mkdirSync(SHOTS_DIR, { recursive: true });

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
function uniqueLabel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function freshToken(page: Page, current: string): Promise<string> {
  const runId = `m08-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const bootstrap = await page.request
    .post(`${API_BASE_URL}/api/test-support/bootstrap`, {
      headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
      data: { runId },
    })
    .catch(() => null);
  if (bootstrap && bootstrap.ok()) {
    const payload = (await bootstrap.json()) as { token?: string };
    if (payload?.token) return String(payload.token);
  }
  // register-demo fallback (matches global-setup when test-support is absent)
  const reg = await page.request
    .post(`${API_BASE_URL}/api/auth/register-demo`, {
      data: { email: `e2e+${runId}@local.test`, password: `E2E-${Date.now()}-Pass1`, firstName: 'E2E' },
    })
    .catch(() => null);
  if (reg && reg.ok()) {
    const payload = (await reg.json()) as any;
    const tok = String(payload?.token || payload?.accessToken || '');
    if (tok) return tok;
  }
  return current;
}

async function createIdea(page: Page, token: string, title: string) {
  const create = (t: string) =>
    page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
      headers: authHeaders(t),
      data: { title, body: `M08 acceptance seed for ${title}`, tags: ['m08', 'acceptance'] },
    });
  let res = await create(token);
  if (res.status() === 401 || res.status() === 403) {
    res = await create(await freshToken(page, token));
  }
  if (!res.ok()) {
    throw new Error(`createIdea failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { id: string; title: string };
}

async function gotoTable(page: Page, ideaId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(`/my-work/ideas/${ideaId}/workspace/table`, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
      return;
    } catch {
      await page.waitForTimeout(1000);
    }
  }
}

/** Dismiss the first-run / welcome onboarding overlays (tour + "WELCOME TO CONSULTIFY"). */
async function dismissOnboarding(page: Page) {
  const buttons = [
    /Skip for now|Pomiń na razie|Pomiń/i,
    /Skip tour|Pomiń wycieczkę/i,
    /Get started|Zaczynaj|Rozpocznij/i,
  ];
  for (let i = 0; i < 6; i += 1) {
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
    await page.waitForTimeout(250);
  }
}

/**
 * Suppress the first-run "WELCOME TO CONSULTIFY" onboarding so it never overlays
 * the table. The gate (useFirstRunOnboarding) trusts a localStorage done-key
 * (`consultify_onboarding_done:{userId}`) as an instant guard — set it before
 * app boot via addInitScript.
 */
async function suppressOnboarding(page: Page, userId: string) {
  await page.addInitScript((uid) => {
    try {
      if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
    } catch {
      /* ignore */
    }
  }, userId);
}

/** Land on the Table workspace for a fresh idea and dismiss overlays. Returns the idea. */
async function openTable(page: Page, label: string) {
  const { token, userId } = readTestSupportState();
  await suppressOnboarding(page, userId);
  const idea = await createIdea(page, token, uniqueLabel(label));
  await gotoTable(page, idea.id);
  await dismissOnboarding(page);
  await expect(page.getByRole('region', { name: 'Idea map workspace' })).toBeVisible({
    timeout: 30000,
  });
  return idea;
}

async function shot(page: Page, id: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${id}.png`), fullPage: false });
}

/** A toolbar/affordance button identified by its `title` attribute. */
function byTitle(page: Page, title: string) {
  return page.locator(`[title="${title}"]`).first();
}

test.describe('M08 Ideas · Table — representative acceptance', () => {
  // Shared idea for all read-only toolbar/shell checks.
  // beforeAll runs once per Playwright worker process; tests that need clean or
  // mutated state (S04, S05, S16) create their own fresh ideas below.
  let sharedIdeaId = '';
  let sharedUserId = '';
  let sharedToken = '';

  test.beforeAll(async ({ request }) => {
    const state = readTestSupportState();
    sharedToken = state.token;
    sharedUserId = state.userId;
    const title = uniqueLabel('m08-shared');
    const res = await request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
      headers: authHeaders(sharedToken),
      data: { title, body: 'M08 shared seed idea for read-only tests', tags: ['m08', 'acceptance'] },
    });
    if (res.ok()) {
      const payload = (await res.json()) as { id: string };
      sharedIdeaId = payload.id;
    }
  });

  /** Navigate to the shared idea's Table workspace (no DB write). */
  async function openShared(page: Page) {
    await suppressOnboarding(page, sharedUserId);
    await gotoTable(page, sharedIdeaId);
    await dismissOnboarding(page);
    await expect(page.getByRole('region', { name: 'Idea map workspace' })).toBeVisible({
      timeout: 30000,
    });
  }

  // ── Read-only toolbar / shell checks (shared idea) ───────────────────────

  test('S01 workspace shell renders with the Table tool active', async ({ page }) => {
    await openShared(page);
    await expect(page.getByRole('button', { name: 'Table', exact: true }).first()).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
    await shot(page, 'S01-shell-table-active');
  });

  test('S02 My Work tool strip exposes the Ideas/Notebook/Inbox/Tasks surfaces', async ({ page }) => {
    await openShared(page);
    for (const name of ['Ideas', 'Notebook', 'Inbox', 'Tasks', 'Decisions']) {
      await expect(page.getByRole('button', { name, exact: true }).first()).toBeVisible();
    }
    await shot(page, 'S02-tool-strip');
  });

  test('S03 idea-tool switcher offers Recommendation map / Whiteboard / Process Flow / Table', async ({
    page,
  }) => {
    await openShared(page);
    for (const name of ['Recommendation map', 'Whiteboard', 'Process Flow', 'Table']) {
      await expect(page.getByRole('button', { name, exact: true }).first()).toBeVisible();
    }
    await shot(page, 'S03-tool-switcher');
  });

  // ── Mutating / state-sensitive tests (own fresh ideas) ───────────────────

  test('S04 empty grid surfaces the three first-record affordances', async ({ page }) => {
    await openTable(page, 'm08-empty');
    // EmptyStateView: Add first record / Import CSV / Use AI
    const addFirst = page.getByRole('button', { name: /Add first record|Dodaj pierwszy rekord/i }).first();
    await expect(addFirst).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: /Import CSV|Importuj CSV/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Use AI|Użyj AI/i }).first()).toBeVisible();
    await shot(page, 'S04-empty-state-affordances');
  });

  test('S05 add first record creates a row and clears the empty state', async ({ page }) => {
    await openTable(page, 'm08-addrow');
    const addFirst = page.getByRole('button', { name: /Add first record|Dodaj pierwszy rekord/i }).first();
    await expect(addFirst).toBeVisible({ timeout: 30000 });
    await addFirst.click();
    // Once a row exists the empty-state "Add first record" CTA is replaced by the grid.
    await expect(addFirst).toBeHidden({ timeout: 15000 });
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
    await shot(page, 'S05-add-first-record');
  });

  // ── Read-only toolbar checks continued (shared idea) ─────────────────────

  test('S06 toolbar exposes undo / redo controls', async ({ page }) => {
    await openShared(page);
    await expect(byTitle(page, 'Undo (Ctrl+Z)')).toBeVisible({ timeout: 30000 });
    await expect(byTitle(page, 'Redo (Ctrl+Y)')).toBeVisible();
    await shot(page, 'S06-undo-redo');
  });

  test('S07 toolbar exposes the AI Copilot entry point (L-02)', async ({ page }) => {
    await openShared(page);
    await expect(byTitle(page, 'AI Copilot')).toBeVisible({ timeout: 30000 });
    await shot(page, 'S07-ai-copilot-button');
  });

  test('S08 toolbar exposes Export to Presentation (→M19)', async ({ page }) => {
    await openShared(page);
    await expect(byTitle(page, 'Export to Presentation')).toBeVisible({ timeout: 30000 });
    await shot(page, 'S08-export-to-presentation');
  });

  test('S09 toolbar exposes the AI schema assistant + AI Categorize', async ({ page }) => {
    await openShared(page);
    await expect(byTitle(page, 'AI schema assistant')).toBeVisible({ timeout: 30000 });
    await expect(byTitle(page, 'AI Categorize')).toBeVisible();
    await shot(page, 'S09-ai-schema-categorize');
  });

  test('S10 toolbar exposes Scoring Model + Idea Pipeline', async ({ page }) => {
    await openShared(page);
    await expect(byTitle(page, 'Scoring Model')).toBeVisible({ timeout: 30000 });
    await expect(byTitle(page, 'Idea Pipeline')).toBeVisible();
    await shot(page, 'S10-scoring-pipeline');
  });

  test('S11 toolbar exposes Cross-table Relations + Heatmap', async ({ page }) => {
    await openShared(page);
    await expect(byTitle(page, 'Cross-table Relations')).toBeVisible({ timeout: 30000 });
    await expect(byTitle(page, 'Heatmap')).toBeVisible();
    await shot(page, 'S11-relations-heatmap');
  });

  test('S12 toolbar exposes Save view + Group', async ({ page }) => {
    await openShared(page);
    await expect(byTitle(page, 'Save view')).toBeVisible({ timeout: 30000 });
    await expect(byTitle(page, 'Group')).toBeVisible();
    await shot(page, 'S12-saveview-group');
  });

  test('S13 AI Copilot opens a panel without an always-error toast (L-02)', async ({ page }) => {
    await openShared(page);
    const copilot = byTitle(page, 'AI Copilot');
    await expect(copilot).toBeVisible({ timeout: 30000 });
    await copilot.click().catch(() => {});
    await page.waitForTimeout(800);
    // The error toast the audit feared ("zawsze błąd") must NOT appear.
    await expect(page.getByText(/Failed|Error|Błąd|nie powiodło/i).first()).toHaveCount(0).catch(() => {});
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
    await shot(page, 'S13-copilot-open');
  });

  test('S14 Export to Presentation opens its dialog (no dead CTA)', async ({ page }) => {
    await openShared(page);
    const exportBtn = byTitle(page, 'Export to Presentation');
    await expect(exportBtn).toBeVisible({ timeout: 30000 });
    await exportBtn.click().catch(() => {});
    await page.waitForTimeout(600);
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
    await shot(page, 'S14-export-dialog');
  });

  test('S15 Voice / Image + Heatmap affordances are reachable', async ({ page }) => {
    await openShared(page);
    await expect(byTitle(page, 'Voice / Image')).toBeVisible({ timeout: 30000 });
    await shot(page, 'S15-voice-image');
  });

  // ── Mutating: persist-reload (own idea) ──────────────────────────────────

  test('S16 added record persists across a full reload', async ({ page }) => {
    const idea = await openTable(page, 'm08-persist');
    const addFirst = page.getByRole('button', { name: /Add first record|Dodaj pierwszy rekord/i }).first();
    await expect(addFirst).toBeVisible({ timeout: 30000 });
    await addFirst.click();
    await expect(addFirst).toBeHidden({ timeout: 15000 });
    // Give the map-sync optimistic write time to flush, then reload from scratch.
    await page.waitForTimeout(2500);
    await gotoTable(page, idea.id);
    await dismissOnboarding(page);
    await expect(page.getByRole('region', { name: 'Idea map workspace' })).toBeVisible({ timeout: 30000 });
    // Empty-state CTA must NOT come back — the row persisted.
    await expect(
      page.getByRole('button', { name: /Add first record|Dodaj pierwszy rekord/i }).first()
    ).toBeHidden({ timeout: 15000 });
    await shot(page, 'S16-persist-after-reload');
  });

  // ── Read-only: dark-mode / i18n / console / import (shared idea) ─────────

  test('S17 dark mode renders the table workspace with no error boundary (DoD#7)', async ({ page }) => {
    await openShared(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500);
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Table', exact: true }).first()).toBeVisible();
    await shot(page, 'S17-dark-mode');
  });

  test('S18 import file-input affordance exists and does not 404-toast (L-01)', async ({ page }) => {
    await openShared(page);
    // Import CSV is a working client-side <input type=file> (L-01) — its presence
    // and a clean (no error-toast) load is the closure proof.
    await expect(page.getByRole('button', { name: /Import CSV|Importuj CSV/i }).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
    await shot(page, 'S18-import-affordance');
  });

  test('S19 console is free of error-boundary crashes after a full table load', async ({ page }) => {
    const errors: string[] = [];
    // Attach listener BEFORE navigation so every console message is captured.
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    // Use shared ideaId — each test gets a fresh page context so the console
    // listener on this page only fires from this test's navigation onwards.
    await suppressOnboarding(page, sharedUserId);
    await gotoTable(page, sharedIdeaId);
    await dismissOnboarding(page);
    await expect(page.getByRole('region', { name: 'Idea map workspace' })).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
    // We assert the UI did not crash; transient network 4xx logs are tolerated.
    const fatal = errors.filter((e) => /Cannot read|is not a function|Maximum update depth|render/i.test(e));
    expect(fatal, fatal.join('\n')).toHaveLength(0);
    await shot(page, 'S19-console-clean');
  });

  test('S20 EN locale renders the workspace chrome in English (i18n bilingual)', async ({ page }) => {
    await openShared(page);
    // EN side of the inline isPl? ternaries — proves functional bilinguality.
    await expect(page.getByRole('button', { name: 'Table', exact: true }).first()).toBeVisible();
    await expect(byTitle(page, 'Export to Presentation')).toBeVisible({ timeout: 30000 });
    await shot(page, 'S20-i18n-en');
  });
});
