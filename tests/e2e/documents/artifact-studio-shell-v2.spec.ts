import { expect, test } from '@playwright/test';

import {
  seedDocumentArtifact,
  setupDocumentStudioSession,
} from './_document-studio-helpers';

/**
 * Artifact Studio V2 — mounted-shell acceptance smoke.
 *
 * This is deliberately an E2E contract instead of a screenshot test. It proves
 * that the real Document Studio route mounts the agreed shell while the two
 * rollout flags are enabled. The legacy route remains available when the flags
 * are off, so this spec also protects the rollback boundary.
 */
test.describe('Artifact Studio V2 — Document shell', () => {
  test('mounts one Menu 2 line, contextual Menu 3, one left panel and no local right rail', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const { artifactId } = await seedDocumentArtifact(page.request, token, {
      title: `Artifact Studio shell ${Date.now()}`,
      documentType: 'business_case',
      language: 'pl',
    });

    await page.goto(
      `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );

    const shell = page.getByTestId('document-studio-mels-shell');
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute('data-artifact-studio', 'true');

    // Menu 2: a single mounted artifact toolbar. Menu 1 belongs to the app and
    // is intentionally outside this adapter.
    const menu2 = shell.getByTestId('mels-topbar');
    await expect(menu2).toHaveCount(1);
    await expect(menu2).toBeVisible();
    const menu2Box = await menu2.boundingBox();
    expect(menu2Box?.height ?? 0).toBeLessThanOrEqual(58);

    // Menu 3 is the only format/context toolbar.
    await expect(shell.getByTestId('artifact-menu3')).toHaveCount(1);

    // Exactly one structural left panel and no local inspector/right rail. The
    // only allowed right-side surface is the application-level Teresa panel.
    await expect(shell.getByTestId('mels-left-rail')).toHaveCount(1);
    await expect(shell.getByTestId('mels-right-rail')).toHaveCount(0);
    await expect(shell.getByTestId('mels-left-inspector-rail')).toHaveCount(0);

    // Historical duplicate entry points must not leak into the V2 shell.
    await expect(shell.getByRole('button', { name: /AI Editor/i })).toHaveCount(0);
    await expect(shell.getByText(/Document preview/i)).toHaveCount(0);
    await expect(shell.getByText(/Start over/i)).toHaveCount(0);

    // Teresa remains available from the agreed bottom shortcut, not as a fixed
    // Menu 3 command.
    const bottomTeresa = shell.getByRole('button', { name: 'Teresa', exact: true });
    await expect(bottomTeresa).toBeVisible();
    await expect(shell.getByTestId('artifact-menu3').getByText('Teresa', { exact: true })).toHaveCount(
      0
    );
  });

  test('keeps the legacy shell as an immediate rollback when rollout flags are disabled', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const { artifactId } = await seedDocumentArtifact(page.request, token, {
      title: `Artifact Studio rollback ${Date.now()}`,
      documentType: 'business_case',
      language: 'pl',
    });

    await page.goto(
      `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=0&ff_documentStudioV2=0`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );

    const shell = page.getByTestId('document-studio-mels-shell');
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).not.toHaveAttribute('data-artifact-studio', 'true');
    await expect(shell.getByTestId('artifact-menu3')).toHaveCount(0);
  });
});
