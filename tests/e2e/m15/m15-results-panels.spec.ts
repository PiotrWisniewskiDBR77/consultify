/**
 * M15 Seria D panels — E2E + graphical sign-off capture (light + dark).
 *
 * Drives the Results cockpit against the running frontend (:3000 → backend
 * :3001). Asserts the Strategic + AI/Portfolio panels render their Seria-D
 * sections and captures screenshots:
 *   docs/qa/screens/m15-2026-06-26/{light,dark}-{strategic,ai}.png
 *
 * SAFETY (2026-07-13): This spec used to mint a token by logging in as the REAL
 * account (piotr.wisniewski@dbr77.com / 123456) and drove the LIVE DBR77 org
 * (a3e05d4a-...) directly. It now reads the isolated test-support tenant token
 * from the global-setup state file (tests/e2e/_helpers/testSupportState.ts), so
 * it never authenticates as — or touches — a real organization. Running without
 * the gated harness now fails fast (missing state file). NOTE: the panel content
 * assertions (BSC/OKR/benefit-profiles/funnel) require that Seria-D fixture data
 * to be seeded into the isolated tenant; seeding those fixtures is tracked as
 * follow-up work, not part of this safety fix.
 *
 * Run (servers up + seed applied): npx playwright test tests/e2e/m15/m15-results-panels.spec.ts
 */
import path from 'node:path';

import { test, expect } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';
import { seedPageAuth } from '../cases/_m07-helpers';

const SHOTS = path.resolve('docs/qa/screens/m15-2026-06-26');

const STRATEGIC = '/benefits?tab=results_strategic&ff_strategicLayer=1&ff_valueTree=1';
const AI = '/benefits?tab=results_ai&ff_aiInsights=1&ff_portfolioInsights=1';

test.describe('M15 Seria D panels', () => {
  test.describe.configure({ timeout: 120_000 });
  let token: string;

  test.beforeAll(() => {
    // Isolated E2E tenant (test-support bootstrap) — never a real login.
    token = readTestSupportState().token;
    expect(token, 'test-support state must provide a token').toBeTruthy();
  });

  for (const theme of ['light', 'dark'] as const) {
    test.describe(`${theme} theme`, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript((t: string) => {
          try {
            const k = 'consultify-storage';
            const cur = JSON.parse(localStorage.getItem(k) || '{}');
            const state = (cur && cur.state) || {};
            state.theme = t;
            localStorage.setItem(k, JSON.stringify({ state, version: 2 }));
            localStorage.setItem('consultify_onboarding_done', 'true');
          } catch { /* storage unavailable */ }
        }, theme);
        await seedPageAuth(page, token);
        await page.setViewportSize({ width: 1680, height: 1050 });
      });

      test(`Strategic tab — BSC + OKR + benefit-profiles + adoption (${theme})`, async ({ page }) => {
        await page.goto(STRATEGIC, { waitUntil: 'domcontentloaded' });
        // error boundary must not show
        await expect(page.getByText(/Coś poszło nie tak|Something went wrong/i)).toHaveCount(0);
        // D10 OKR cascade section + D2 benefit profiles + D3/D4 adoption
        await expect(page.getByText(/Balanced Scorecard/i).first()).toBeVisible({ timeout: 60000 });
        await expect(page.getByText(/OKR/i).first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/Profil korzyści|Benefit profile/i).first()).toBeVisible({ timeout: 30000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SHOTS, `${theme}-strategic.png`), fullPage: true });
      });

      test(`AI tab — funnel + run-rate + anomaly + forecast/RCA (${theme})`, async ({ page }) => {
        await page.goto(AI, { waitUntil: 'domcontentloaded' });
        await expect(page.getByText(/Coś poszło nie tak|Something went wrong/i)).toHaveCount(0);
        // D6 funnel + D11 anomaly/forecast/RCA sections
        await expect(page.getByText(/Lejek wartości|value funnel/i).first()).toBeVisible({ timeout: 60000 });
        await expect(page.getByText(/anomali/i).first()).toBeVisible({ timeout: 30000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SHOTS, `${theme}-ai.png`), fullPage: true });
      });
    });
  }
});
