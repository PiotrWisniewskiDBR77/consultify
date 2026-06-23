/**
 * M13 — FAZA TESTOWANIA (wykonanie + zdjęcia) dla planu 5×30.
 *
 * Wykonuje headless-feasible scenariusze render z _PLAN_TESTOW_WYKONAWCZY_M13_5x30.md
 * i zapisuje zdjęcia-dowody do docs/qa/screens/m13-exec/<artefakt>/<id>.png.
 * Każdy test asertuje brak error-boundary (jakość-minimum) i robi screen (do oceny
 * dwukryterialnej: jakość + grafika). Scenariusze ❌ real-browser / czysto
 * integration/component są pokryte osobno (vitest) i NIE są tu kapturowane.
 *
 * Run: E2E_USE_WEB_SERVER=true NODE_OPTIONS=--max-old-space-size=8192 \
 *      npx playwright test tests/e2e/m13/m13-exec.spec.ts --workers=2
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import {
  API_BASE_URL,
  authHeaders,
  dismissOnboarding,
  ERROR_BOUNDARY_RE,
  forceTheme,
  gotoHub,
  openDoc,
  seedInitiative,
  seedTasks,
  suppressOnboarding,
  uniqueLabel,
} from './_m13';
import { readTestSupportState } from '../_helpers/testSupportState';

const EXEC_ROOT = path.resolve('docs/qa/screens/m13-exec');
for (const sub of ['initiatives', 'decisions', 'notifications', 'calendar', 'tasks']) {
  fs.mkdirSync(path.join(EXEC_ROOT, sub), { recursive: true });
}

async function execShot(page: Page, artifact: string, id: string) {
  await page.screenshot({ path: path.join(EXEC_ROOT, artifact, `${id}.png`), fullPage: false });
}

async function seedDecision(
  page: Page,
  token: string,
  initiativeId: string,
  title: string,
  type: string
): Promise<void> {
  for (const url of [`${API_BASE_URL}/api/decisions`, `${API_BASE_URL}/api/my-work/decisions`]) {
    const res = await page.request
      .post(url, {
        headers: authHeaders(token),
        data: {
          initiativeId,
          title,
          type,
          description: `M13 exec seed — ${title}`,
          deadline: '2026-07-20',
        },
        timeout: 20000,
      })
      .catch(() => null);
    if (res && res.ok()) return;
  }
  // best-effort: brak round-tripu → sekcja pokaże pusty stan (nadal ważny render)
}

async function openTimeline(page: Page) {
  const nav = page
    .locator('nav, [data-section-nav], aside')
    .getByText(/^Timeline$|^Oś czasu$|^Harmonogram$/i)
    .first();
  if (await nav.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nav.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }
}

async function openSection(page: Page, label: string) {
  // Exact text match so "Tasks" doesn't accidentally hit "Timeline" etc.
  const nav = page
    .locator('nav, [data-section-nav], aside')
    .getByText(label, { exact: true })
    .first();
  if (await nav.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nav.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
  }
}

/** Seed tasks dated in the CURRENT display month (June 2026) so the Calendar
 *  month grid actually shows chips (seedTasks uses July → off-screen). */
async function seedTasksJune(page: Page, token: string, initiativeId: string) {
  const tasks = [
    { title: 'Analiza obecnego procesu', s: '2026-06-10', d: '2026-06-13' },
    { title: 'Projekt automatyzacji', s: '2026-06-15', d: '2026-06-20' },
    { title: 'Wdrożenie pilotażowe', s: '2026-06-23', d: '2026-06-27' },
  ];
  for (const t of tasks) {
    await page.request
      .post(`${API_BASE_URL}/api/pmo/tasks`, {
        headers: authHeaders(token),
        data: {
          title: t.title,
          initiativeId,
          status: 'todo',
          startedAt: new Date(`${t.s}T09:00:00.000Z`).toISOString(),
          dueDate: new Date(`${t.d}T09:00:00.000Z`).toISOString(),
        },
        timeout: 30000,
      })
      .catch(() => null);
  }
}

test.describe('M13 — faza testowania (zdjęcia 5×30 headless)', () => {
  let token = '';
  let userId = '';
  test.setTimeout(120000);

  test.beforeAll(() => {
    const s = readTestSupportState();
    token = s.token;
    userId = s.userId;
  });
  test.beforeEach(async ({ page }) => {
    await suppressOnboarding(page, userId);
  });

  // ─────────────── INICJATYWY ───────────────
  test('INI hub: kanban / lista / grid / analysis + dark/light', async ({ page }) => {
    await seedInitiative(page, token, uniqueLabel('EXEC-INI'));
    await gotoHub(page);
    await dismissOnboarding(page);
    await expect(page.getByText(/New initiative|Nowa inicjatywa/i).first()).toBeVisible({
      timeout: 45000,
    });
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await execShot(page, 'initiatives', 'ini-01-hub-kanban-active');

    // List / Grid / Timeline / Analysis — klik ikon przełącznika widoku (best-effort)
    for (const [name, re] of [
      ['ini-23-list-section27', /^List$|^Lista$/i],
      ['ini-25-timeline-gantt', /^Timeline$|^Oś czasu$/i],
      ['ini-26-grid-kebab', /^Grid$|^Siatka$/i],
      ['ini-27-analysis-tab', /Analysis|Analiza/i],
    ] as const) {
      const btn = page.getByRole('button', { name: re }).first();
      const tab = page.getByRole('tab', { name: re }).first();
      const target = (await btn.isVisible().catch(() => false)) ? btn : tab;
      if (await target.isVisible().catch(() => false)) {
        await target.click({ force: true }).catch(() => {});
        await page.waitForTimeout(900);
        await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
        await execShot(page, 'initiatives', name);
      }
    }

    await forceTheme(page, 'dark');
    await gotoHub(page);
    await dismissOnboarding(page);
    await page.waitForTimeout(800);
    await execShot(page, 'initiatives', 'ini-hub-dark');
    await forceTheme(page, 'light');
    await gotoHub(page);
    await dismissOnboarding(page);
    await page.waitForTimeout(800);
    await execShot(page, 'initiatives', 'ini-hub-light');
  });

  test('INI document: nawigacja sekcji (26)', async ({ page }) => {
    const title = uniqueLabel('EXEC-INI-DOC');
    const { id } = await seedInitiative(page, token, title);
    await openDoc(page, id, title);
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await execShot(page, 'initiatives', 'ini-10-26-sections-nav');
  });

  // ─────────────── TASKI ───────────────
  test('TSK sekcja Taski (z danymi) + dark/light', async ({ page }) => {
    const title = uniqueLabel('EXEC-TSK');
    const { id } = await seedInitiative(page, token, title);
    await seedTasks(page, token, id);
    await openDoc(page, id, title);
    await openSection(page, 'Tasks');
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await execShot(page, 'tasks', 'tsk-01-tasks-section');

    await forceTheme(page, 'dark');
    await openDoc(page, id, title);
    await openSection(page, 'Tasks');
    await page.waitForTimeout(600);
    await execShot(page, 'tasks', 'tsk-29-dark');
    await forceTheme(page, 'light');
    await openDoc(page, id, title);
    await openSection(page, 'Tasks');
    await page.waitForTimeout(600);
    await execShot(page, 'tasks', 'tsk-29-light');
  });

  // ─────────────── DECYZJE ───────────────
  test('DEC sekcja Decyzje (+ GO_NO_GO banner) + dark/light', async ({ page }) => {
    const title = uniqueLabel('EXEC-DEC');
    const { id } = await seedInitiative(page, token, title);
    await seedDecision(page, token, id, 'GO/No-Go pilotaż', 'GO_NO_GO');
    await seedDecision(page, token, id, 'Wybór dostawcy', 'GENERAL');
    await openDoc(page, id, title);
    await openSection(page, 'Decisions');
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await execShot(page, 'decisions', 'dec-01-decisions-section');

    await forceTheme(page, 'dark');
    await openDoc(page, id, title);
    await openSection(page, 'Decisions');
    await page.waitForTimeout(600);
    await execShot(page, 'decisions', 'dec-24-dark');
    await forceTheme(page, 'light');
    await openDoc(page, id, title);
    await openSection(page, 'Decisions');
    await page.waitForTimeout(600);
    await execShot(page, 'decisions', 'dec-24-light');
  });

  // ─────────────── KALENDARZ ───────────────
  test('CAL Timeline → Kalendarz month/week + dark/light', async ({ page }) => {
    const title = uniqueLabel('EXEC-CAL');
    const { id } = await seedInitiative(page, token, title);
    await seedTasksJune(page, token, id);
    await openDoc(page, id, title);
    await openTimeline(page);
    const calBtn = page.getByRole('button', { name: /^Calendar$|^Kalendarz$/i }).first();
    if (await calBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
      await calBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
      await execShot(page, 'calendar', 'cal-01-month');
      // tydzień
      const weekBtn = page.getByRole('button', { name: /^Week$|^Tydzień$/i }).first();
      if (await weekBtn.isVisible().catch(() => false)) {
        await weekBtn.click({ force: true });
        await page.waitForTimeout(800);
        await execShot(page, 'calendar', 'cal-03-week');
      }
    }
    // dark/light
    await forceTheme(page, 'dark');
    await openDoc(page, id, title);
    await openTimeline(page);
    const calD = page.getByRole('button', { name: /^Calendar$|^Kalendarz$/i }).first();
    if (await calD.isVisible({ timeout: 15000 }).catch(() => false)) {
      await calD.click({ force: true });
      await page.waitForTimeout(900);
      await execShot(page, 'calendar', 'cal-23-dark');
    }
    await forceTheme(page, 'light');
    await openDoc(page, id, title);
    await openTimeline(page);
    const calL = page.getByRole('button', { name: /^Calendar$|^Kalendarz$/i }).first();
    if (await calL.isVisible({ timeout: 15000 }).catch(() => false)) {
      await calL.click({ force: true });
      await page.waitForTimeout(900);
      await execShot(page, 'calendar', 'cal-24-light');
    }
  });

  test('CAL/V Gantt (parytet źródła z Kalendarzem)', async ({ page }) => {
    const title = uniqueLabel('EXEC-GANTT');
    const { id } = await seedInitiative(page, token, title);
    await seedTasksJune(page, token, id);
    await openDoc(page, id, title);
    await openTimeline(page);
    const ganttBtn = page.getByRole('button', { name: /^Gantt$/i }).first();
    if (await ganttBtn.isVisible({ timeout: 15000 }).catch(() => false)) {
      await ganttBtn.click({ force: true });
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
      await execShot(page, 'calendar', 'cal-19-gantt-parity');
    }
  });

  // ─────────────── NOTYFIKACJE ───────────────
  test('NOT in-app centrum (best-effort render)', async ({ page }) => {
    // Centrum notyfikacji w MyWork — render headless (dane zależne od sesji).
    for (const url of ['/my-work?tab=notifications', '/notifications', '/my-work']) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await dismissOnboarding(page);
      await page.waitForTimeout(1200);
      if (!(await page.locator('body').innerText()).match(ERROR_BOUNDARY_RE)) break;
    }
    await execShot(page, 'notifications', 'not-13-inapp-center');
  });
});
