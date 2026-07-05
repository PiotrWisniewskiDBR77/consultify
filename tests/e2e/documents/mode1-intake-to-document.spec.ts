/**
 * Document Studio (M18) — Mode 1: intake → outline → document (E2E, real UI).
 *
 * Drives the actual DOM flow end to end:
 *   1. /document-studio lands on the intake form (Mode 1 — no template).
 *   2. Fill description/title/type/language/density/goal/audience, submit.
 *   3. Outline phase renders the planned sections; click "Generate document".
 *   4. Document phase: MELS shell + TipTap editor + section headings render,
 *      and the URL updates to /document-studio/:artifactId (resumable).
 *
 * RUN (mock-DB, safe — does not touch prod):
 *   E2E_USE_WEB_SERVER=true E2E_REQUIRE_TEST_SUPPORT=true E2E_MOCK_DB=true \
 *     npx playwright test tests/e2e/documents/mode1-intake-to-document.spec.ts --project=chromium
 *
 * Structural assertions only (editor/sections/buttons) — no premium-tier
 * content assertions. See _document-studio-helpers.ts for the auth pattern.
 */
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { setupDocumentStudioSession } from './_document-studio-helpers';

const SHOTS = path.resolve('tests/e2e/documents/screens');
const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

test.describe('Document Studio — Mode 1 intake → outline → document', () => {
  test.describe.configure({ timeout: 120000 });

  test('fills intake, plans an outline, generates a document with visible sections', async ({
    page,
  }) => {
    await setupDocumentStudioSession(page);

    await page.goto('/document-studio', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByTestId('document-studio-view')).toBeVisible({ timeout: 30000 });

    await test.step('Mode 1 intake form renders and accepts input', async () => {
      const descriptionInput = page.getByTestId('docstudio-intake-input');
      await expect(descriptionInput).toBeVisible({ timeout: 15000 });
      await descriptionInput.fill(
        'Prepare an executive interview summary report for the client steering committee: scope, key findings, risks, and recommendations.'
      );

      const titleInput = page.getByPlaceholder(/auto-derived from description/i);
      if (await titleInput.isVisible().catch(() => false)) {
        await titleInput.fill(`E2E Mode1 Report ${Date.now()}`);
      }

      // Document type / language / density / goal selects — best-effort by
      // label text since the selects have no data-testid; skip silently if
      // the DOM shape ever changes rather than failing the whole flow.
      const typeSelect = page.locator('select').first();
      if (await typeSelect.isVisible().catch(() => false)) {
        await typeSelect.selectOption('interview_summary_report').catch(() => {});
      }

      await shot(page, 'mode1-01-intake-filled');
    });

    await test.step('submit intake → outline phase with planned sections', async () => {
      const submitBtn = page.getByTestId('docstudio-generate-btn');
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();

      // Outline phase has no stable testid; anchor on the visible "Generate
      // document" CTA that only exists in DocumentStudioOutlinePanel.
      const generateDocBtn = page.getByRole('button', { name: /generate document/i });
      await expect(generateDocBtn).toBeVisible({ timeout: 30000 });

      // At least one outline section item should render (ordered list of
      // planned sections rendered by DocumentStudioOutlinePanel).
      const outlineItems = page.locator('ol > li');
      await expect(outlineItems.first()).toBeVisible({ timeout: 15000 });
      expect(await outlineItems.count()).toBeGreaterThan(0);

      await shot(page, 'mode1-02-outline-phase');
    });

    await test.step('generate → document phase renders editor + sections, URL resumes', async () => {
      const generateDocBtn = page.getByRole('button', { name: /generate document/i });
      await generateDocBtn.click();

      // Document phase owns its own ExecutiveModuleShell (MELS) — this is the
      // definitive signal the artifact finished generating.
      await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({ timeout: 45000 });
      await expect(page.getByTestId('document-tiptap-editor')).toBeVisible({ timeout: 20000 });

      // URL should have moved to the resumable /document-studio/:artifactId form.
      await expect(page).toHaveURL(/\/document-studio\/[^/]+$/, { timeout: 15000 });

      // At least one rendered section heading (DocSectionNode emits
      // [data-section-id] on its heading DOM node).
      const sectionHeadings = page.locator('[data-section-id]');
      await expect(sectionHeadings.first()).toBeVisible({ timeout: 20000 });
      expect(await sectionHeadings.count()).toBeGreaterThan(0);

      // Export affordances are present (structural — content richness is
      // premium-flag-dependent, button presence is not).
      await expect(page.getByRole('button', { name: /^Markdown$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^DOCX$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^PDF$/i })).toBeVisible();

      await shot(page, 'mode1-03-document-phase');
    });

    await test.step('reload resumes the same artifact from the URL', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({ timeout: 45000 });
      await expect(page.getByTestId('document-tiptap-editor')).toBeVisible({ timeout: 20000 });
    });
  });
});
