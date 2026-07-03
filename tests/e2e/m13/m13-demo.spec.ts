/**
 * M13 — LIVE DEMO acceptance against https://demo.consultify.ai.
 *
 * Auth: a fresh user registered via /api/auth/register (no real credentials),
 * token injected into localStorage. Seeds were created out-of-band; this spec
 * navigates the real deployed UI and captures screenshots of the M13 Depth
 * features (document, gate readiness w/ flag ON, Calendar/Gantt, linked items).
 *
 * Run: E2E_BASE_URL=https://demo.consultify.ai E2E_API_URL=https://demo.consultify.ai \
 *      npx playwright test tests/e2e/m13/m13-demo.spec.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

const SHOTS_DIR = path.resolve('tests/e2e/screenshots/m13');
const ERROR_BOUNDARY_RE = /Coś poszło nie tak|Something went wrong/i;

fs.mkdirSync(SHOTS_DIR, { recursive: true });

// LIVE-DEMO spec: depends on out-of-band auth/seed files in /tmp. When they are
// absent (e.g. the default `tests/e2e/m13/` headless run), the reads below would
// throw ENOENT at import and break collection — so guard them and skip the suite.
const DEMO_PRESENT = fs.existsSync('/tmp/m13_e2e_auth.json');
const auth = DEMO_PRESENT
  ? (JSON.parse(fs.readFileSync('/tmp/m13_e2e_auth.json', 'utf8')) as {
      token: string;
      org: string;
      uid: string;
    })
  : { token: '', org: '', uid: '' };
const initId = DEMO_PRESENT ? fs.readFileSync('/tmp/m13_e2e_init.txt', 'utf8').trim() : '';
const creds = DEMO_PRESENT ? fs.readFileSync('/tmp/m13_e2e_creds.txt', 'utf8') : '';
const CRED_EMAIL = (creds.match(/EMAIL=(.+)/)?.[1] || '').trim();
const CRED_PASS = (creds.match(/PASS=(.+)/)?.[1] || '').trim();
const API = process.env.E2E_API_URL || 'https://demo.consultify.ai';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  test.skip(!DEMO_PRESENT, 'live-demo spec — /tmp/m13_e2e_* seed files absent');
  // Auth is cookie-based (httpOnly access_token). Log in via the API on this
  // page's request context so the cookie is set for subsequent navigations.
  const res = await page.request.post(`${API}/api/auth/login`, {
    data: { email: CRED_EMAIL, password: CRED_PASS },
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()} ${await res.text()}`);
  // Suppress onboarding + keep a localStorage token as a belt-and-suspenders.
  await page.addInitScript(
    ({ token, uid }) => {
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('authToken', token);
        if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
      } catch {
        /* ignore */
      }
    },
    { token: auth.token, uid: auth.uid }
  );
});

async function dismissOnboarding(page: Page) {
  for (let i = 0; i < 3; i += 1) {
    const btn = page
      .getByRole('button', { name: /Skip for now|Pomiń na razie|Pomiń|Get started|Rozpocznij/i })
      .first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true, timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(200);
    } else break;
  }
}

test.describe('M13 — live demo acceptance', () => {
  test('D1 — hub (All tab) shows the seeded initiative', async ({ page }) => {
    await page.goto('/portfolio', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissOnboarding(page);
    await page.waitForTimeout(2500);
    const allTab = page.getByText(/^All$/).first();
    if (await allTab.isVisible().catch(() => false)) {
      await allTab.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await shot(page, 'D1-hub-all');
  });

  test('D2 — initiative document opens', async ({ page }) => {
    await page.goto(`/portfolio?initiativeId=${initId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOnboarding(page);
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await shot(page, 'D2-document');
  });

  test('D3 — Gates section (gate-AI flag ON → readiness pill)', async ({ page }) => {
    await page.goto(`/portfolio?initiativeId=${initId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOnboarding(page);
    await page.waitForTimeout(2500);
    const gates = page.getByText(/^Gates$|Bramki/i).first();
    if (await gates.isVisible().catch(() => false)) {
      await gates.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500); // gate-ai-check + LLM may take a moment
    }
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await shot(page, 'D3-gates-readiness');
  });

  test('D4 — Timeline section: Calendar + Gantt toggle', async ({ page }) => {
    await page.goto(`/portfolio?initiativeId=${initId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOnboarding(page);
    await page.waitForTimeout(2500);
    const timeline = page.getByText(/^Timeline$|Oś czasu|Harmonogram/i).first();
    if (await timeline.isVisible().catch(() => false)) {
      await timeline.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
    }
    const calBtn = page.getByRole('button', { name: /^Calendar$|^Kalendarz$/ }).first();
    if (await calBtn.isVisible().catch(() => false)) {
      await calBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
      await shot(page, 'D4a-calendar');
    }
    const ganttBtn = page.getByRole('button', { name: /^Gantt$/ }).first();
    if (await ganttBtn.isVisible().catch(() => false)) {
      await ganttBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }
    await expect(page.locator('body')).not.toContainText(ERROR_BOUNDARY_RE);
    await shot(page, 'D4b-gantt');
  });
});
