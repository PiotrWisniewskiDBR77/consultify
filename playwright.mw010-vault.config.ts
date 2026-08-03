/**
 * MW-10 — standalone Playwright config for the Vault versioning golden-flow
 * spec. Boots the dev-render Vite server but the spec navigates ONLY to the
 * ISOLATED entry `dev-render/mw010-vault.html` (→ `mw010-vault-main.tsx`),
 * which mounts the real `VaultDocumentsView` + `VaultDocumentPanel`
 * production components directly — it does NOT go through
 * `dev-render/main.tsx`'s shared screen registry (that registry statically
 * references an unrelated, pre-existing-and-missing screen file; see
 * `mw010-vault.html`'s header for the full explanation of why this spec
 * uses its own entry instead of a stub). Vite only transforms files it is
 * actually asked to serve, so this entry never touches the broken registry.
 * No backend, no database. This is the same harness pattern CLAUDE.md §7
 * mandates for pre-acceptance visual verification (real component, mock
 * data, no login).
 *
 * Run:
 *   npx playwright test --config playwright.mw010-vault.config.ts
 *
 * This does NOT replace the real-Postgres coverage in
 * `tests/integration/mw010-vault-versioning.golden-flow.realdb.test.ts`
 * (CAS/409, permission parity, cross-tenant isolation, delete cascade — all
 * proven there against a real DB and the real Express router). This spec
 * proves the BROWSER click-path: the production UI actually calls the new
 * API methods in the right order and renders the right state.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.MW010_DEV_RENDER_PORT || 3916);

export default defineConfig({
  testDir: './tests/e2e/vault',
  testMatch: /mw010-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
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
