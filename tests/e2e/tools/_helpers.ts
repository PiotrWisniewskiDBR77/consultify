/**
 * Shared helpers for the tests/e2e/tools/ idea-tools persistence specs.
 *
 * IMPORTANT: `locator.isVisible()` does NOT auto-wait/poll even when passed a
 * `timeout` option — it is a synchronous DOM check that returns immediately
 * (see Playwright docs: "This method does not wait for the element to pass
 * actionability checks"). Using `.isVisible({ timeout: N }).catch(() => false)`
 * as a gating condition is a bug: it resolves in milliseconds regardless of
 * the timeout value, so a not-yet-rendered element always reads as "not
 * visible" even if it would have appeared moments later. Use `waitVisible`
 * below (backed by `locator.waitFor`, which DOES poll) for any check that
 * gates a skip/branch decision.
 */
import type { Locator } from '@playwright/test';

/** Poll for a locator to become visible within `timeout`ms. Never throws. */
export async function waitVisible(locator: Locator, timeout = 15000): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}
