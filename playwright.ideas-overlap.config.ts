/**
 * S18-NOOVERLAP — standalone Playwright config for the Idea Table
 * Updated-column / pinned-actions-column overlap contract spec
 * (tests/e2e/ideas-table-overlap-geometry.spec.ts).
 *
 * Same pattern as playwright.mw010-vault.config.ts: boots the dev-render
 * Vite server and drives ONLY the production-shape harness
 * (dev-render/screens/idea-table-production.tsx via
 * `?screen=idea-table-production`) — real component, mock data, no login,
 * no backend, no database. This is the CLAUDE.md §7 harness pattern for
 * pre-acceptance visual/geometry verification.
 *
 * Run:
 *   npx playwright test --config playwright.ideas-overlap.config.ts
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.IDEAS_OVERLAP_DEV_RENDER_PORT || 3918);

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /ideas-table-overlap-geometry\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --config dev-render/vite.config.ts --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
