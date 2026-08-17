/**
 * UI-CANON G4 — automated canon sweep for one surface.
 *
 * Usage (servers already up, real Postgres, real session):
 *   G4_SURFACE=CHAT npx playwright test tests/e2e/ui-canon-g4/g4.spec.ts \
 *     --project=chromium --workers=1 --retries=0
 *
 * This test never asserts a green verdict — it *measures* and writes
 * `G4_SWEEP_RESULT.json`. The verdict is decided by a human-readable
 * evidence record afterwards, so a failing canon cannot hide behind a
 * passing test.
 */

import { execSync } from 'node:child_process';

import { test } from '@playwright/test';

import { SURFACES } from './_glue/registry';
import {
  LANGUAGES,
  THEMES,
  completeFirstRunOnboarding,
  setOnboardedUserId,
  sweepCell,
  sweepKeyboard,
  sweepNavigation,
  sweepStates,
  writeResult,
  storageStatePath,
  type SurfaceResult,
} from './_g4/sweep';
import type { ViewportName } from './_g4/types';

const key = String(process.env.G4_SURFACE || '').trim();
const spec = SURFACES.find((s) => s.key === key);

test.describe(`UI-CANON G4 sweep [${key || 'NO SURFACE SELECTED'}]`, () => {
  test.skip(!spec, `Set G4_SURFACE to one of: ${SURFACES.map((s) => s.key).join(', ')}`);
  test.setTimeout(20 * 60 * 1000);

  test('canon matrix', async ({ browser }) => {
    if (!spec) return;
    const productSha = execSync('git rev-parse HEAD').toString().trim();

    // Retire the first-run onboarding modal through the product's own API, so
    // every capture below shows the real surface instead of a welcome dialog.
    const apiBaseUrl = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
    const onboarding = await completeFirstRunOnboarding(apiBaseUrl);
    setOnboardedUserId(onboarding.userId);

    const context = await browser.newContext({ storageState: storageStatePath() });

    const cells: SurfaceResult['cells'] = [];
    const viewports: ViewportName[] = ['desktop', 'tablet', 'mobile'];
    for (const viewport of viewports) {
      for (const language of LANGUAGES) {
        for (const theme of THEMES) {
          cells.push(await sweepCell(context, spec, viewport, language, theme));
        }
      }
    }
    for (const route of spec.secondaryRoutes || []) {
      cells.push(await sweepCell(context, spec, 'desktop', 'pl', 'light', route));
    }

    const nav = await sweepNavigation(
      context,
      () => browser.newContext({ storageState: storageStatePath() }),
      spec
    );
    const keyboard = await sweepKeyboard(context, spec);
    const states = await sweepStates(context, spec);
    await context.close();

    const result: SurfaceResult = {
      taskId: spec.taskId,
      key: spec.key,
      module: spec.module,
      route: spec.route,
      productSha,
      startedAt: new Date().toISOString(),
      cells,
      ...nav,
      keyboard,
      states,
      statesNotPresent: spec.statesNotPresent || [],
      negativeControls: {
        onboardingRetiredViaRealApi: onboarding.detail,
        noRequestInterception:
          'This harness never calls page.route()/fulfill(); every response comes from the real backend on real Postgres.',
        blockingOverlayDetection:
          'A surface counts as rendered only when no dialog/aria-modal covers >15% of the viewport.',
        themeAndLanguageAreObserved:
          'Theme and language are set before first paint and each of the 12 cells is captured separately; identical captures across cells would be visible as identical files.',
      },
      gates: spec.gates,
    };
    const file = writeResult(spec, result);
    // eslint-disable-next-line no-console
    console.log(`[G4] ${spec.taskId} → ${file}`);
  });
});
