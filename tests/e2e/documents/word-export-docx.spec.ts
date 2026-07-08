/**
 * Document Studio (M18/Word) — DOCX export (binary render) E2E.
 *
 * export-qa-gate.spec.ts deliberately only exercises the MARKDOWN export
 * end-to-end ("the lowest-risk one to assert... without depending on
 * docx/pdf renderer availability") and merely checks that the DOCX button is
 * visible/enabled. That leaves the actual DOCX binary-render path
 * (renderDocumentSchemaToDocxBuffer, server/src/services/documentStudio/
 * documentStudioService.ts) completely unexercised by E2E — exactly the gap
 * B3 (Word/DocumentStudio E2E grid) exists to close before any powłoka
 * (shell) rework on Word.
 *
 * Strategy:
 *   1. API-level (deterministic, no LLM): call
 *      GET /:artifactId/export/docx directly and assert on the SHAPE of a
 *      real binary export — filename ends in .docx, contentBase64 decodes to
 *      a non-trivial buffer whose first bytes are the ZIP local-file-header
 *      magic "PK\x03\x04" (docx is a zip container; a text/markdown
 *      fallback would NOT have this signature), and manifest.byteLength
 *      matches the decoded length. This proves the binary renderer actually
 *      ran, not just that the endpoint returned 200.
 *      Same three-way branching as export-qa-gate.spec.ts (entitlement gate
 *      / QA gate / success) so this cannot misreport an unrelated gate as a
 *      renderer failure.
 *   2. UI-level smoke: click the DOCX button in an open artifact and assert
 *      the success toast/testid — or, if a gate fires, the same gated UI
 *      export-qa-gate.spec.ts already asserts (kept light here to avoid
 *      duplicating that spec's depth).
 *
 * RUN (mock-DB, safe — does not touch prod):
 *   E2E_USE_WEB_SERVER=true E2E_REQUIRE_TEST_SUPPORT=true E2E_MOCK_DB=true \
 *     npx playwright test tests/e2e/documents/word-export-docx.spec.ts --project=chromium
 */
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  DOC_STUDIO_BASE,
  authHeaders,
  openArtifact,
  seedDocumentArtifact,
  setupDocumentStudioSession,
} from './_document-studio-helpers';

const SHOTS = path.resolve('tests/e2e/documents/screens');
const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

// ZIP local-file-header magic bytes — every .docx (OOXML) file starts with
// this because it is a zip container. If the renderer regressed to emitting
// plain text/markdown under the .docx filename, this signature would NOT
// match, so it is a strong structural proof the binary renderer ran.
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"

test.describe('Document Studio — DOCX export (binary render)', () => {
  test.describe.configure({ timeout: 120000 });

  test('GET /export/docx returns a real ZIP-container (OOXML) binary, or a recognized gate', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const { artifactId } = await seedDocumentArtifact(page.request, token, {
      description:
        'Executive summary export smoke: scope, findings, and recommendations for the sponsor.',
      documentType: 'interview_summary_report',
    });

    const res = await page.request.get(
      `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/export/docx`,
      { headers: authHeaders(token), timeout: 40000 }
    );

    if (res.status() === 403) {
      const body = (await res.json()) as { error?: string };
      // Either gate is a VALID, recognized outcome for a freshly-bootstrapped
      // E2E org (see export-qa-gate.spec.ts header comment) — this spec's
      // job is to prove the renderer path when it DOES run, and to not
      // misreport a gate as a renderer bug.
      expect(['TRIAL_EXPORT_DISABLED', 'qa_blocking']).toContain(body.error);
      test.info().annotations.push({
        type: 'gated',
        description: `docx export gated by ${body.error} — binary-render assertion skipped this run (expected; see export-qa-gate.spec.ts for the gated-UI coverage).`,
      });
      return;
    }

    expect(res.status(), await res.text()).toBe(200);
    const body = (await res.json()) as {
      format: string;
      filename: string;
      contentBase64: string;
      manifest: Record<string, unknown>;
    };

    expect(body.format).toBe('docx');
    expect(body.filename).toMatch(/\.docx$/);
    expect(typeof body.contentBase64).toBe('string');
    expect(body.contentBase64.length).toBeGreaterThan(0);

    const binary = Buffer.from(body.contentBase64, 'base64');
    // A non-trivial document renders to more than a few hundred bytes —
    // guards against a silently-empty/stub buffer passing the ZIP-magic
    // check by accident.
    expect(binary.byteLength).toBeGreaterThan(1000);
    expect(binary.subarray(0, 4)).toEqual(ZIP_MAGIC);

    // manifest.byteLength (when present) must match the decoded length —
    // the manifest is what the audit trail / download record persists.
    if (typeof body.manifest?.byteLength === 'number') {
      expect(body.manifest.byteLength).toBe(binary.byteLength);
    }
  });

  test('UI: clicking DOCX in an open artifact triggers export (success toast or a recognized gate)', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const { artifactId } = await seedDocumentArtifact(page.request, token, {
      description: 'Client deliverable export smoke via the document shell UI.',
      documentType: 'client_final_report',
    });

    await openArtifact(page, artifactId);
    await shot(page, 'word-export-docx-01-artifact-opened');

    const docxBtn = page.getByRole('button', { name: /^DOCX$/i });
    await expect(docxBtn).toBeVisible({ timeout: 20000 });
    await expect(docxBtn).toBeEnabled();

    const exportResponsePromise = page
      .waitForResponse((res) =>
        res.url().includes(`/api/document-studio/${encodeURIComponent(artifactId)}/export/docx`)
      )
      .catch(() => null);
    await docxBtn.click();
    const exportResponse = await exportResponsePromise;
    expect(exportResponse, 'docx export request was sent').not.toBeNull();

    const status = exportResponse?.status() ?? 0;
    if (status === 403) {
      // Entitlement or QA gate — export-qa-gate.spec.ts covers the full
      // gated-UI assertions in depth; here we only confirm the request
      // fired and the panel did not silently swallow the failure.
      const gateSurfaced = page
        .getByText(/access required|qa blocked|czasowo wyłączona dla triala|temporarily disabled for trial/i)
        .first();
      await expect(gateSurfaced).toBeVisible({ timeout: 15000 });
    } else {
      expect(status).toBe(200);
      await expect(page.getByTestId('document-export-success-note')).toBeVisible({
        timeout: 15000,
      });
    }
    await shot(page, 'word-export-docx-02-exported');
  });
});
