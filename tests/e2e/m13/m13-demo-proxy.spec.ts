/**
 * M13 — REAL-DATA screenshots via local-frontend → demo-backend proxy.
 *
 * Why: demo.consultify.ai SPA does not hydrate under cold headless Playwright
 * (blank screenshots). So we render the LOCAL vite frontend (reliable) while
 * vite proxies /api → https://demo.consultify.ai (real Railway demo DB). Auth
 * is Bearer-token (tokenService reads localStorage 'token'), so the cross-origin
 * proxy authenticates as Piotr against his seeded demo org.
 *
 * Run:
 *   VITE_API_TARGET=https://demo.consultify.ai npx vite --mode staging --port 3100 --strictPort &  # background
 *   E2E_BASE_URL=http://localhost:3100 E2E_API_URL=http://localhost:3100 \
 *     E2E_ALLOW_LOCALHOST_REMOTE=true npx playwright test tests/e2e/m13/m13-demo-proxy.spec.ts
 *
 * Needs /tmp/m13_e2e_auth.json {token,org,uid} (Piotr's demo session).
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const EXEC = path.resolve('docs/qa/screens/m13-exec');
const ERROR_BOUNDARY_RE = /Coś poszło nie tak|Something went wrong/i;
const PRESENT = fs.existsSync('/tmp/m13_e2e_auth.json');
const auth = PRESENT
  ? (JSON.parse(fs.readFileSync('/tmp/m13_e2e_auth.json', 'utf8')) as {
      token: string;
      org: string;
      uid: string;
    })
  : { token: '', org: '', uid: '' };
const FLAG_ID = PRESENT ? fs.readFileSync('/tmp/m13_e2e_init.txt', 'utf8').trim() : '';

async function shot(page: Page, artifact: string, id: string) {
  await page.screenshot({ path: path.join(EXEC, artifact, `${id}.png`), fullPage: false });
}

async function dismiss(page: Page) {
  for (let i = 0; i < 3; i += 1) {
    let acted = false;
    for (const re of [/Skip|Pomiń/i, /Get started|Rozpocznij|Consultant|Konsultant/i]) {
      const b = page.getByRole('button', { name: re }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click({ timeout: 1000, force: true }).catch(() => {});
        acted = true;
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (!acted) break;
    await page.waitForTimeout(250);
  }
}

async function openSection(page: Page, label: string) {
  const nav = page
    .locator('nav, [data-section-nav], aside')
    .getByText(label, { exact: true })
    .first();
  if (await nav.isVisible({ timeout: 6000 }).catch(() => false)) {
    await nav.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }
}

test.describe('M13 — real-data screenshots (local FE → demo BE)', () => {
  test.skip(!PRESENT, '/tmp/m13_e2e_auth.json absent');
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ token, uid, org }) => {
        try {
          localStorage.setItem('token', token);
          localStorage.setItem('authToken', token);
          if (org) localStorage.setItem('consultify_current_org_id', org);
          if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
        } catch {
          /* ignore */
        }
      },
      auth
    );
  });

  test('INI hub (real demo data — seeded + existing)', async ({ page }) => {
    await page.goto('/portfolio', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismiss(page);
    await expect(page.getByText(/New initiative|Nowa inicjatywa/i).first()).toBeVisible({
      timeout: 45000,
    });
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await page.waitForTimeout(1200);
    await shot(page, 'initiatives', 'real-ini-hub');
    // All tab (full lifecycle)
    const allTab = page.getByRole('button', { name: /^All$|^Wszystkie$/i }).first();
    if (await allTab.isVisible().catch(() => false)) {
      await allTab.click({ force: true }).catch(() => {});
      await page.waitForTimeout(900);
      await shot(page, 'initiatives', 'real-ini-hub-all');
    }
  });

  test('INI flagship document + Tasks + Decisions + Timeline', async ({ page }) => {
    await page.goto(`/portfolio?open=${FLAG_ID}&mode=doc`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismiss(page);
    // Proxy → demo adds latency; wait for the document to finish loading
    // (the section nav appears) instead of a fixed sleep.
    await page
      .getByText(/Initiative Scope|Opis.*Kontekst|^Tasks$|^Zadania$|Description.*Context/i)
      .first()
      .waitFor({ state: 'visible', timeout: 45000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await shot(page, 'initiatives', 'real-ini-document');

    await openSection(page, 'Tasks');
    await shot(page, 'tasks', 'real-tsk-section');

    await openSection(page, 'Decisions');
    await shot(page, 'decisions', 'real-dec-section');

    await openSection(page, 'Timeline');
    const cal = page.getByRole('button', { name: /^Calendar$|^Kalendarz$/i }).first();
    if (await cal.isVisible({ timeout: 8000 }).catch(() => false)) {
      await cal.click({ force: true });
      await page.waitForTimeout(1200);
      await shot(page, 'calendar', 'real-cal-month');
    }
    const gantt = page.getByRole('button', { name: /^Gantt$/i }).first();
    if (await gantt.isVisible().catch(() => false)) {
      await gantt.click({ force: true });
      await page.waitForTimeout(1200);
      await shot(page, 'calendar', 'real-gantt-deps-critical');
    }
  });
});
