/**
 * Document Studio (M18) — manual TipTap autosave + optimistic-lock (409) E2E.
 *
 * Exercises the P0 data-loss fix (commit 34144d52ce): manual (non-AI) editor
 * content is saved through `PUT /:artifactId/content` with an
 * `expectedVersion` optimistic-lock on `schema.updatedAt`. A stale write must
 * be REJECTED with 409 + `{ conflict: { yourVersion, serverVersion } }` — a
 * silent last-write-wins overwrite is exactly the regression this guards.
 *
 * This is an API-level spec (drives the same endpoints the debounced FE
 * autosave calls) rather than a DOM-timing spec, because the debounce/version
 * plumbing is what regresses silently — a browser spec would race the 500ms
 * debounce and give a flaky, less precise signal. Auth + seeding reuse the
 * shared helpers (backend Mode-1 seed, ADMIN bearer token).
 *
 * Asserts on the DURABLE server state (re-GET after save), because the whole
 * point of the fix is that the manual edit survives a fresh read.
 *
 * RUN (mock-DB, safe — does not touch prod):
 *   E2E_USE_WEB_SERVER=true E2E_REQUIRE_TEST_SUPPORT=true E2E_MOCK_DB=true \
 *     npx playwright test tests/e2e/documents/autosave-optimistic-lock.spec.ts --project=chromium
 */
import { expect, test } from '@playwright/test';

import {
  DOC_STUDIO_BASE,
  authHeaders,
  collectSchemaText,
  fetchArtifactSchema,
  openArtifact,
  seedDocumentArtifact,
  setupDocumentStudioSession,
} from './_document-studio-helpers';

test.describe('Document Studio — manual autosave + optimistic-lock', () => {
  test.describe.configure({ timeout: 120000 });

  test('a fresh manual save persists; a stale save is rejected with 409, not silently overwritten', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const { artifactId, schema: seededSchema } = await seedDocumentArtifact(page.request, token, {
      description:
        'Operating model review: current-state assessment, gap analysis, and target-state design.',
      documentType: 'operating_model_review',
    });

    // Sanity — the seed produced editable sections we can mutate.
    expect(Array.isArray(seededSchema.sections)).toBe(true);
    expect(seededSchema.sections.length).toBeGreaterThan(0);

    const baseVersion: string = seededSchema.updatedAt;
    expect(typeof baseVersion).toBe('string');

    // A distinctive marker the manual edit injects into the first block of the
    // first section, so we can prove it round-trips through a fresh GET.
    const marker = `E2E-MANUAL-EDIT-${Date.now()}`;
    const editedSections = JSON.parse(JSON.stringify(seededSchema.sections));
    const firstBlock = editedSections[0].blocks?.[0];
    expect(firstBlock, 'seed produced at least one block to edit').toBeTruthy();
    if (firstBlock.content && typeof firstBlock.content === 'object') {
      if (typeof firstBlock.content.text === 'string') {
        firstBlock.content.text = `${firstBlock.content.text}\n\n${marker}`;
      } else {
        firstBlock.content.text = marker;
      }
    } else {
      firstBlock.content = { text: marker };
    }

    let savedVersion = '';

    await test.step('fresh save (correct expectedVersion) → 200, edit persists across a re-read', async () => {
      const res = await page.request.put(
        `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/content`,
        {
          headers: authHeaders(token),
          data: { sections: editedSections, expectedVersion: baseVersion },
          timeout: 40000,
        }
      );
      expect(res.status(), await res.text()).toBe(200);
      const body = (await res.json()) as { schema: { updatedAt: string } };
      savedVersion = body.schema.updatedAt;
      expect(savedVersion).toBeTruthy();
      // The version must MOVE — a save that didn't bump updatedAt would break
      // the very optimistic-lock this fix depends on.
      expect(savedVersion).not.toBe(baseVersion);

      // DURABLE assertion: re-GET and confirm the marker is really there.
      const reread = await fetchArtifactSchema(page.request, token, artifactId);
      expect(collectSchemaText(reread)).toContain(marker);
      expect(reread.updatedAt).toBe(savedVersion);
    });

    await test.step('stale save (old expectedVersion) → 409 conflict, NOT a silent overwrite', async () => {
      const staleMarker = `E2E-STALE-EDIT-${Date.now()}`;
      const staleSections = JSON.parse(JSON.stringify(editedSections));
      staleSections[0].blocks[0].content.text = staleMarker;

      const res = await page.request.put(
        `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/content`,
        {
          headers: authHeaders(token),
          // Deliberately re-use the ORIGINAL version — the server has already
          // moved on to `savedVersion`, so this must be rejected.
          data: { sections: staleSections, expectedVersion: baseVersion },
          timeout: 40000,
        }
      );
      expect(res.status()).toBe(409);
      const body = (await res.json()) as {
        error: string;
        code?: string;
        conflict?: { yourVersion?: string; serverVersion?: string };
      };
      expect(body.error).toBe('manual_save_conflict');
      expect(body.code).toBe('DOC_CONTENT_CONFLICT');
      expect(body.conflict?.yourVersion).toBe(baseVersion);
      expect(body.conflict?.serverVersion).toBe(savedVersion);

      // The stale write must NOT have landed — the good marker survives, the
      // stale marker never made it to the durable schema.
      const afterConflict = await fetchArtifactSchema(page.request, token, artifactId);
      const text = collectSchemaText(afterConflict);
      expect(text).toContain(marker);
      expect(text).not.toContain(staleMarker);
      expect(afterConflict.updatedAt).toBe(savedVersion);
    });

    await test.step('retry with the current version succeeds (conflict is recoverable, not terminal)', async () => {
      const recoveredMarker = `E2E-RECOVERED-EDIT-${Date.now()}`;
      const currentSchema = await fetchArtifactSchema(page.request, token, artifactId);
      const recoverSections = JSON.parse(JSON.stringify(currentSchema.sections));
      recoverSections[0].blocks[0].content.text = recoveredMarker;

      const res = await page.request.put(
        `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/content`,
        {
          headers: authHeaders(token),
          data: { sections: recoverSections, expectedVersion: currentSchema.updatedAt },
          timeout: 40000,
        }
      );
      expect(res.status(), await res.text()).toBe(200);
      const reread = await fetchArtifactSchema(page.request, token, artifactId);
      expect(collectSchemaText(reread)).toContain(recoveredMarker);
    });

    await test.step('malformed save is rejected with a typed 400 (guards the contract)', async () => {
      const missingVersion = await page.request.put(
        `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/content`,
        {
          headers: authHeaders(token),
          data: { sections: editedSections },
          timeout: 40000,
        }
      );
      expect(missingVersion.status()).toBe(400);
      expect(((await missingVersion.json()) as { code?: string }).code).toBe(
        'DOC_CONTENT_EXPECTED_VERSION_REQUIRED'
      );

      const missingSections = await page.request.put(
        `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/content`,
        {
          headers: authHeaders(token),
          data: { expectedVersion: savedVersion },
          timeout: 40000,
        }
      );
      expect(missingSections.status()).toBe(400);
      expect(((await missingSections.json()) as { code?: string }).code).toBe(
        'DOC_CONTENT_SECTIONS_REQUIRED'
      );
    });
  });

  test('the mounted signed editor renders a conflict after another session advances the version', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const { artifactId } = await seedDocumentArtifact(page.request, token, {
      description: 'Mounted stale-state proof for the internal-beta Materials gate.',
      documentType: 'operating_model_review',
    });
    await openArtifact(page, artifactId);
    const loaded = await fetchArtifactSchema(page.request, token, artifactId);
    await expect(page.getByTestId('document-tiptap-editor')).toBeVisible();

    const serverSections = JSON.parse(JSON.stringify(loaded.sections));
    const serverMarker = `SERVER-WINNER-${Date.now()}`;
    serverSections[0].blocks[0].content = { text: serverMarker };
    const winner = await page.request.put(
      `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/content`,
      {
        headers: authHeaders(token),
        data: { sections: serverSections, expectedVersion: loaded.updatedAt },
        timeout: 40000,
      }
    );
    expect(winner.status(), await winner.text()).toBe(200);

    const editor = page
      .getByTestId('document-tiptap-editor')
      .locator('[contenteditable="true"]')
      .first();
    await editor.click();
    await editor.press('End');
    await editor.type(` LOCAL-STALE-${Date.now()}`);

    const artifactStatus = page.getByTestId('document-artifact-status');
    if (await artifactStatus.count()) {
      await expect(artifactStatus).toContainText(/Konflikt|Conflict/, { timeout: 10000 });
    } else {
      await page.getByTestId('document-file-menu-trigger').click();
      await expect(page.getByTestId('document-file-menu-save')).toContainText(
        /Konflikt|[Cc]onflict/,
        { timeout: 10000 }
      );
    }

    const durable = await fetchArtifactSchema(page.request, token, artifactId);
    expect(collectSchemaText(durable)).toContain(serverMarker);
    expect(collectSchemaText(durable)).not.toContain('LOCAL-STALE-');
  });
});
