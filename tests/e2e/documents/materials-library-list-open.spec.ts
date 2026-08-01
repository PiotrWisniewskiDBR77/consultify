import { expect, test } from '@playwright/test';

import {
  API_BASE_URL,
  seedDocumentArtifact,
  setupDocumentStudioSession,
} from './_document-studio-helpers';

// Acceptance environment: ENABLE_V8_GLOBAL=true and an internal-tools
// allowlist containing the E2E user's domain. Run against real PostgreSQL;
// the lightweight mock DB does not emulate schema-qualified `v8.*` tables.

test.describe('MAT-01 — canonical Materials registry list → open', () => {
  test.setTimeout(120000);

  test('a Document Studio artifact appears once and reopens in its owning runtime', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const title = `MAT-01 Registry ${Date.now()}`;
    const { artifactId } = await seedDocumentArtifact(page.request, token, {
      title,
      description: 'Canonical Materials list-to-open acceptance artifact.',
      documentType: 'generic_document',
    });

    await expect
      .poll(
        async () => {
          const response = await page.request.get(
            `${API_BASE_URL}/api/artifacts?outputType=report&limit=200&include=drafts`,
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 40000,
            }
          );
          if (!response.ok()) return [];
          const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
          return (body.data || []).filter(
            (item) => item.originRuntime === 'native_artifact' && item.originRecordId === artifactId
          );
        },
        { timeout: 30000, message: 'Document Studio artifact reaches canonical registry once' }
      )
      .toHaveLength(1);

    await page.goto('/presentations?tab=documents', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Pokaż robocze|Show drafts/i }).click();
    const rowTitle = page.getByText(title, { exact: true });
    await expect(rowTitle).toBeVisible({ timeout: 30000 });
    await rowTitle.dblclick();

    await expect(page).toHaveURL(new RegExp(`/document-studio/${artifactId}$`), { timeout: 30000 });
    await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  });
});
