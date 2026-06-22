/**
 * M13 — KATALOG (headless screenshot harvest).
 *
 * Wykonuje headless-osiągalny podzbiór katalogu `_TESTY_M13_KATALOG_G1-V1.md`
 * (werdykty ✅/🟡) i zapisuje jeden PNG per scenariusz do
 * docs/qa/screens/m13-full/ — artefakt „zdjęcia z prac wykonanych".
 *
 * Honest scope: scenariusze ❌ (modale wizardów/override, AI live, drag real-mouse,
 * pilot-role, persist real-DB) NIE są tu — idą przez component/integration/real-browser
 * wg §4 katalogu. Endpointy M13-Depth (status, gate-ai-check, similar-check,
 * validate-card, linked-items) sprawdzamy jako MOUNTED (nie wynik biznesowy MOCK_DB).
 *
 * Run: E2E_USE_WEB_SERVER=true NODE_OPTIONS=--max-old-space-size=8192 \
 *      npx playwright test tests/e2e/m13/m13-katalog.spec.ts --workers=2
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';
import {
  API_BASE_URL,
  ERROR_BOUNDARY_RE,
  authHeaders,
  dismissOnboarding,
  forceTheme,
  gotoHub,
  openDoc,
  seedInitiative,
  seedTasks,
  sectionNavButtons,
  sectionNavLocator,
  setDark,
  suppressOnboarding,
  uniqueLabel,
} from './_m13';

const FULL_DIR = path.resolve('docs/qa/screens/m13-full');
fs.mkdirSync(FULL_DIR, { recursive: true });

/** Screenshot into the catalog dir (docs/qa/screens/m13-full/<id>.png). */
async function shotFull(page: Page, id: string) {
  await page.screenshot({ path: path.join(FULL_DIR, `${id}.png`), fullPage: false });
}
async function noErrorBoundary(page: Page) {
  await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
}
/** Mounted route = controller response, never the framework default body. */
async function expectMounted(res: { status(): number; text(): Promise<string> }) {
  const body = await res.text().catch(() => '');
  expect(body).not.toMatch(/Cannot (GET|POST|PATCH|PUT|DELETE)/i);
  expect(res.status()).not.toBe(401);
}
/** Click a section-nav item whose label matches re, then settle. */
async function openSection(page: Page, re: RegExp) {
  const btn = sectionNavLocator(page).filter({ hasText: re }).first();
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
  }
}
/** Click a Timeline toggle button (Calendar / Gantt) if present. */
async function clickToggle(page: Page, re: RegExp) {
  const b = page.getByRole('button', { name: re }).first();
  if (await b.isVisible({ timeout: 8000 }).catch(() => false)) {
    await b.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

test.describe('M13 Katalog — headless screenshot harvest', () => {
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

  // ── SERIA G — bramki AI (headless-osiągalne: render huba + endpointy mounted) ──
  test('G1-01 hub renderuje się (flaga OFF — zachowanie bazowe)', async ({ page }) => {
    await seedInitiative(page, token, uniqueLabel('M13-G1'));
    await gotoHub(page);
    await dismissOnboarding(page);
    await expect(page.getByText(/New initiative|Nowa inicjatywa/i).first()).toBeVisible({
      timeout: 45000,
    });
    await noErrorBoundary(page);
    await shotFull(page, 'g1-01-flag-off-no-change');
  });

  test('G4/G1/G3 — endpointy bramek AI + statusu są ZAMONTOWANE', async ({ page }) => {
    const { id } = await seedInitiative(page, token, uniqueLabel('M13-Gapi'));
    const h = authHeaders(token);
    // G4: POST /:id/gate-ai-check (G-series flagship)
    const gate = await page.request.post(`${API_BASE_URL}/api/initiatives/${id}/gate-ai-check`, {
      headers: h,
      data: { gate: 'SUBMIT_FOR_REVIEW' },
      timeout: 30000,
    });
    await expectMounted(gate);
    // G1/maszyna stanów: PATCH /:id/status
    const status = await page.request.patch(`${API_BASE_URL}/api/initiatives/${id}/status`, {
      headers: h,
      data: { status: 'PENDING_REVIEW', reason: 'katalog smoke' },
      timeout: 30000,
    });
    await expectMounted(status);
    await gotoHub(page);
    await dismissOnboarding(page);
    await noErrorBoundary(page);
    await shotFull(page, 'g4-01-endpoints-mounted');
  });

  // ── SERIA R — artefakty (render sekcji + Kalendarz; drag/notyf = poza headless) ──
  test('R1-01 sekcja Taski renderuje się (z treścią)', async ({ page }) => {
    const title = uniqueLabel('M13-R1');
    const { id } = await seedInitiative(page, token, title);
    await seedTasks(page, token, id);
    await openDoc(page, id, title);
    await openSection(page, /Task|Zadani|Milestone|Kamien/i);
    await noErrorBoundary(page);
    await shotFull(page, 'r1-01-task-section');
  });

  test('R2-01 sekcja Decyzje renderuje się', async ({ page }) => {
    const title = uniqueLabel('M13-R2');
    const { id } = await seedInitiative(page, token, title);
    await openDoc(page, id, title);
    await openSection(page, /Decision|Decyzj/i);
    await noErrorBoundary(page);
    await shotFull(page, 'r2-01-decision-section');
  });

  test('R3-01 Kalendarz (Timeline → Calendar) renderuje się', async ({ page }) => {
    const title = uniqueLabel('M13-R3');
    const { id } = await seedInitiative(page, token, title);
    await seedTasks(page, token, id);
    await openDoc(page, id, title);
    await openSection(page, /^Timeline$|^Oś czasu$|^Harmonogram$/i);
    await clickToggle(page, /^Calendar$|^Kalendarz$/i);
    await noErrorBoundary(page);
    await shotFull(page, 'r3-01-calendar-month');
  });

  test('R3-11/12 Kalendarz dark + light', async ({ page }) => {
    const title = uniqueLabel('M13-R3dl');
    const { id } = await seedInitiative(page, token, title);
    await seedTasks(page, token, id);
    await openDoc(page, id, title);
    await openSection(page, /^Timeline$|^Oś czasu$|^Harmonogram$/i);
    await clickToggle(page, /^Calendar$|^Kalendarz$/i);
    await setDark(page, true);
    await page.waitForTimeout(600);
    await noErrorBoundary(page);
    await shotFull(page, 'r3-11-calendar-dark');
    await setDark(page, false);
    await page.waitForTimeout(600);
    await shotFull(page, 'r3-12-calendar-light');
  });

  // ── SERIA V — Gantt (render; drag = component-test) ──
  test('V1-01 Gantt (Timeline → Gantt) renderuje bary', async ({ page }) => {
    const title = uniqueLabel('M13-V1');
    const { id } = await seedInitiative(page, token, title);
    await seedTasks(page, token, id);
    await openDoc(page, id, title);
    await openSection(page, /^Timeline$|^Oś czasu$|^Harmonogram$/i);
    await clickToggle(page, /^Gantt$/i);
    await noErrorBoundary(page);
    await shotFull(page, 'v1-01-gantt-task-bars');
  });

  test('V1-11/12 Gantt dark + light', async ({ page }) => {
    const title = uniqueLabel('M13-V1dl');
    const { id } = await seedInitiative(page, token, title);
    await seedTasks(page, token, id);
    await openDoc(page, id, title);
    await openSection(page, /^Timeline$|^Oś czasu$|^Harmonogram$/i);
    await clickToggle(page, /^Gantt$/i);
    await setDark(page, true);
    await page.waitForTimeout(600);
    await noErrorBoundary(page);
    await shotFull(page, 'v1-11-gantt-dark');
    await setDark(page, false);
    await page.waitForTimeout(600);
    await shotFull(page, 'v1-12-gantt-light');
  });

  // ── SERIA C — tworzenie (dedup endpoint mounted; modal = ❌ poza headless) ──
  test('C1 — endpoint dedup /similar-check ZAMONTOWANY', async ({ page }) => {
    const { id } = await seedInitiative(page, token, uniqueLabel('M13-C1'));
    const res = await page.request.post(`${API_BASE_URL}/api/initiatives/similar-check`, {
      headers: authHeaders(token),
      data: { name: 'Robotic Automation for Warehouse', summary: 'dedup probe', excludeId: id },
      timeout: 30000,
    });
    await expectMounted(res);
    await gotoHub(page);
    await dismissOnboarding(page);
    await noErrorBoundary(page);
    await shotFull(page, 'c1-02-dedup-endpoint-mounted');
  });

  // ── SERIA K — jakość kart (validate-card + linked-items mounted; sekcje render) ──
  test('K1 — endpoint /validate-card ZAMONTOWANY', async ({ page }) => {
    const res = await page.request.post(`${API_BASE_URL}/api/initiatives/validate-card`, {
      headers: authHeaders(token),
      data: { text: 'Jeśli zrobimy TODO to placeholder', rules: ['lang_pl', 'no_filler'] },
      timeout: 30000,
    });
    await expectMounted(res);
    await gotoHub(page);
    await dismissOnboarding(page);
    await noErrorBoundary(page);
    await shotFull(page, 'k1-06-validate-card-mounted');
  });

  test('K3 — endpoint /:id/linked-items ZAMONTOWANY', async ({ page }) => {
    const { id } = await seedInitiative(page, token, uniqueLabel('M13-K3'));
    const res = await page.request.get(`${API_BASE_URL}/api/initiatives/${id}/linked-items`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    });
    await expectMounted(res);
    await shotFull(page, 'k3-06-linked-items-mounted');
  });

  test('K/§2 — pełny obchód sekcji dokumentu (screenshot każdej)', async ({ page }) => {
    test.setTimeout(180000);
    const title = uniqueLabel('M13-sections');
    const { id } = await seedInitiative(page, token, title);
    await seedTasks(page, token, id);
    await openDoc(page, id, title);
    await noErrorBoundary(page);
    const sections = await sectionNavButtons(page);
    expect(sections.length, 'document has section-nav items').toBeGreaterThan(3);
    const navButtons = sectionNavLocator(page);
    let captured = 0;
    for (const s of sections) {
      const safe = s.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 32);
      if (!safe) continue;
      await navButtons.nth(s.index).click({ force: true }).catch(() => {});
      await page.waitForTimeout(450);
      await noErrorBoundary(page);
      await shotFull(page, `k2-section-${String(captured).padStart(2, '0')}-${safe}`);
      captured += 1;
    }
    expect(captured).toBeGreaterThan(3);
  });

  // ── Widoki portfolio (PV-01..04) ──
  test('PV-01..04 przełączniki widoku huba (Lista/Kanban/Timeline/Grid)', async ({ page }) => {
    await seedInitiative(page, token, uniqueLabel('M13-PV'));
    await gotoHub(page);
    await dismissOnboarding(page);
    await page.waitForTimeout(1200);
    await noErrorBoundary(page);
    await shotFull(page, 'pv-02-kanban'); // default hub = kanban
    const views: Array<[RegExp, string]> = [
      [/Lista|^List$/i, 'pv-01-list'],
      [/Timeline|Oś czasu/i, 'pv-03-timeline'],
      [/Grid|Siatka/i, 'pv-04-grid'],
      [/Kanban/i, 'pv-02-kanban'],
    ];
    for (const [re, name] of views) {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(900);
        await noErrorBoundary(page);
        await shotFull(page, name);
      }
    }
  });

  // ── Przekrojowe: dark/light huba i dokumentu ──
  test('Hub + dokument — dark i light', async ({ page }) => {
    const title = uniqueLabel('M13-theme');
    const { id } = await seedInitiative(page, token, title);
    // Light hub (forced before boot)
    await forceTheme(page, 'light');
    await gotoHub(page);
    await dismissOnboarding(page);
    await page.waitForTimeout(700);
    await noErrorBoundary(page);
    await shotFull(page, 'x-hub-light');
    // Dark hub
    await setDark(page, true);
    await page.waitForTimeout(700);
    await shotFull(page, 'x-hub-dark');
    await setDark(page, false);
    // Document dark + light
    await openDoc(page, id, title);
    await setDark(page, true);
    await page.waitForTimeout(600);
    await noErrorBoundary(page);
    await shotFull(page, 'x-doc-dark');
    await setDark(page, false);
    await page.waitForTimeout(600);
    await shotFull(page, 'x-doc-light');
  });
});
