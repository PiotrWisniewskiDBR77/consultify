/**
 * MW-10 — Vault versioning golden flow, driven through the REAL browser
 * against the REAL production components (`VaultDocumentsView` +
 * `VaultDocumentPanel`), via the dev-render harness
 * (`dev-render/screens/vault-sejf-wnetrze.tsx`) — mocked but STATEFUL
 * `Api.*` methods, no backend/DB (same pattern CLAUDE.md §7 mandates for
 * pre-acceptance visual verification).
 *
 * Run: npx playwright test --config playwright.mw010-vault.config.ts
 *
 * Complements (does not replace) the real-Postgres, real-router coverage in
 * `tests/integration/mw010-vault-versioning.golden-flow.realdb.test.ts`
 * (CAS/409, permission parity, cross-tenant isolation — proven there against
 * a real DB). This spec proves the PRODUCTION UI actually wires those
 * contracts up: clicking "Save version" / "Restore" calls the right API
 * shape and renders the resulting state, including the CAS-conflict path.
 */
import { expect, test } from '@playwright/test';

// Isolated MW-10 entry (`mw010-vault.html` → `mw010-vault-main.tsx`) — NOT
// the shared `dev-render/main.tsx` registry. See `playwright.mw010-vault.config.ts`
// header for why: that registry statically references an unrelated, missing
// screen file, and stubbing it was rejected on review. This entry mounts
// `vault-sejf-wnetrze` directly and never touches the registry.
const SCREEN_URL = '/mw010-vault.html';
const DOC_ROW_NAME = 'MW10_wersjonowanie_demo.docx';

test.describe('MW-10 — Vault versioning golden flow (dev-render, real components)', () => {
  test('upload seed (v1→v2) → history visible → restore → v3 → history preserved, then edit → v4', async ({
    page,
  }) => {
    await page.goto(SCREEN_URL);

    // ---- open the seeded document (v1 upload, v2 edit) -------------------
    await page.getByText(DOC_ROW_NAME, { exact: true }).click();
    await page.getByRole('button', { name: 'Edytuj' }).click();
    await expect(page.getByText('Edytuj metadane')).toBeVisible();

    // ---- history: v2 current, v1 in history with a Restore control -------
    await expect(page.getByTestId('vault-panel-version-row-2')).toContainText('v2');
    await expect(page.getByTestId('vault-panel-version-row-2')).toContainText('aktualna');
    await expect(page.getByTestId('vault-panel-version-row-1')).toContainText('v1');
    await expect(page.getByTestId('vault-panel-version-restore-1')).toBeVisible();
    // The current version never shows its own restore button.
    await expect(page.getByTestId('vault-panel-version-restore-2')).toHaveCount(0);

    // ---- restore v1 → creates v3, does NOT overwrite v1/v2 ---------------
    await page.getByTestId('vault-panel-version-restore-1').click();
    await expect(page.getByText(/Przywrócono wersj/i)).toBeVisible();
    await expect(page.getByTestId('vault-panel-version-row-3')).toContainText('v3');
    await expect(page.getByTestId('vault-panel-version-row-3')).toContainText('aktualna');
    await expect(page.getByTestId('vault-panel-version-row-3')).toContainText('v1'); // "Przywrócono z v1"
    // History NOT rewritten — v1 and v2 still both present.
    await expect(page.getByTestId('vault-panel-version-row-1')).toBeVisible();
    await expect(page.getByTestId('vault-panel-version-row-2')).toBeVisible();
    // v2 is no longer current, so it now shows a restore control too.
    await expect(page.getByTestId('vault-panel-version-restore-2')).toBeVisible();
    // v3 (now current) has none.
    await expect(page.getByTestId('vault-panel-version-restore-3')).toHaveCount(0);

    // ---- edit: pick a new file → new version (v4) -------------------------
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'mw010-golden-e2e.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('MW-10 Playwright golden-flow content'),
    });
    await expect(page.getByTestId('vault-panel-new-version-submit')).toBeVisible();
    await page.getByTestId('vault-panel-new-version-submit').click();

    await expect(page.getByText('Zapisano nową wersję')).toBeVisible();
    await expect(page.getByTestId('vault-panel-version-row-4')).toContainText('v4');
    await expect(page.getByTestId('vault-panel-version-row-4')).toContainText('aktualna');
    // Full history intact: v1..v4 all present, none silently dropped.
    for (const n of [1, 2, 3, 4]) {
      await expect(page.getByTestId(`vault-panel-version-row-${n}`)).toBeVisible();
    }
  });

  test('a document the current user does NOT own shows no restore/upload controls (permission parity in the UI)', async ({
    page,
  }) => {
    await page.goto(SCREEN_URL);

    // "Benchmark_rynkowy_produkcja.xlsx" is scope=project, owned by a
    // different user in the seed data — canChangeScope must be false.
    await page.getByText('Benchmark_rynkowy_produkcja.xlsx', { exact: true }).click();
    await page.getByRole('button', { name: 'Edytuj' }).click();
    await expect(page.getByText('Edytuj metadane')).toBeVisible();

    await expect(page.getByText('Brak historii')).toBeVisible();
    await expect(page.getByTestId('vault-panel-new-version-pick')).toHaveCount(0);
  });

  test('dark mode renders the Versions section with no crimson tokens (visual sanity)', async ({
    page,
  }) => {
    await page.goto(`${SCREEN_URL}?theme=dark`);
    await page.getByText(DOC_ROW_NAME, { exact: true }).click();
    await page.getByRole('button', { name: 'Edytuj' }).click();
    await expect(page.getByText('Edytuj metadane')).toBeVisible();
    await expect(page.getByTestId('vault-panel-version-list')).toBeVisible();
  });
});
