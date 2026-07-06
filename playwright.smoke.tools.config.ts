/**
 * Local-run-only override: same as playwright.smoke.config.ts but with
 * testDir pointed at tests/e2e/tools so the new tools suite can run against
 * the same self-boot mock harness without touching the shared smoke config.
 * Not intended to be a permanent addition to CI config wiring.
 */
import base from './playwright.smoke.config';

export default {
  ...(base as any),
  testDir: './tests/e2e/tools',
};
