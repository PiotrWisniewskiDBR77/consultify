/**
 * Document Studio (M18) — Mode 3: generate from an approved template (E2E).
 *
 * Mode 3 requires an APPROVED template to exist before the intake form's
 * template picker appears. Driving the full Template Architect authoring UI
 * (plan → review → approve) is Mode 2's own concern; here we seed an
 * approved template directly via the backend API (same endpoints the
 * Architect UI calls: POST /templates/plan, POST /templates/:id/approve —
 * see _document-studio-helpers.seedApprovedTemplate), then verify the real
 * UI: picking the template switches the form into Mode 3, and submitting it
 * generates a document WITHOUT an outline-preview step (Mode 3 skips
 * straight from intake to the document phase).
 *
 * RUN (mock-DB, safe — does not touch prod):
 *   E2E_USE_WEB_SERVER=true E2E_REQUIRE_TEST_SUPPORT=true E2E_MOCK_DB=true \
 *     npx playwright test tests/e2e/documents/mode3-template-generate.spec.ts --project=chromium
 */
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { seedApprovedTemplate, setupDocumentStudioSession } from './_document-studio-helpers';

const SHOTS = path.resolve('tests/e2e/documents/screens');
const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

test.describe('Document Studio — Mode 3 generate from approved template', () => {
  test.describe.configure({ timeout: 120000 });

  test('picking an approved template switches to Mode 3 and generates a document directly', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const templateName = `E2E Mode3 Template ${Date.now()}`;
    const { templateId } = await seedApprovedTemplate(page.request, token, {
      name: templateName,
      documentType: 'project_status_report',
    });

    await page.goto('/document-studio', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByTestId('document-studio-view')).toBeVisible({ timeout: 30000 });

    await test.step('approved template appears in the intake picker', async () => {
      // DocumentStudioIntakeForm renders the template <select> right after the
      // "Use approved template (optional)" label, with one <option
      // value={templateId}> per approved template — select by templateId,
      // which is unambiguous regardless of display-name formatting.
      const templateSelect = page
        .locator('label', { hasText: /use approved template/i })
        .locator('select');
      await expect(templateSelect).toBeVisible({ timeout: 20000 });
      await expect(templateSelect.locator(`option[value="${templateId}"]`)).toBeAttached({
        timeout: 10000,
      });
      await templateSelect.selectOption(templateId);

      // Mode 3 copy swap — title switches to the template-mode heading.
      await expect(
        page.getByText(/generate from approved template/i).first()
      ).toBeVisible({ timeout: 10000 });

      await shot(page, 'mode3-01-template-selected');
    });

    await test.step('fill the brief and submit — Mode 3 skips outline, goes straight to document', async () => {
      const descriptionInput = page.getByTestId('docstudio-intake-input');
      await descriptionInput.fill(
        'Weekly steering committee status update: progress against plan, risks, and next milestones.'
      );

      const submitBtn = page.getByTestId('docstudio-generate-btn');
      await expect(submitBtn).toHaveText(/generate from template/i);
      await submitBtn.click();

      // No outline panel in Mode 3 — goes directly to the document MELS shell.
      await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({ timeout: 45000 });
      await expect(page.getByTestId('document-tiptap-editor')).toBeVisible({ timeout: 20000 });
      await expect(page).toHaveURL(/\/document-studio\/[^/]+$/, { timeout: 15000 });

      await shot(page, 'mode3-02-document-generated');
    });

    await test.step('generated document exposes the same structural affordances as Mode 1', async () => {
      const sectionHeadings = page.locator('[data-section-id]');
      await expect(sectionHeadings.first()).toBeVisible({ timeout: 20000 });

      await expect(page.getByRole('button', { name: /^Markdown$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^DOCX$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^PDF$/i })).toBeVisible();
    });
  });
});
