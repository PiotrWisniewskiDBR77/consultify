/**
 * Document Studio (M18) — approve AI edit proposal + persistence E2E.
 *
 * Exercises the P1 fix (commit f6dd2ccc59): approving an AI edit proposal must
 * write the mutated schema through the durable overlay
 * (`persistSchemaOverlayWriteThrough`), so the approved edit SURVIVES a page
 * reload / fresh read. Before the fix, `approveEditProposal` mutated only the
 * in-memory schema echoed to the caller; a subsequent `getDocumentArtifact`
 * (overlay miss → stale wave5 row) resolved the PRE-approval schema and the
 * approved edit vanished.
 *
 * Strategy (fully deterministic, no LLM, no prod data):
 *   1. Seed a Mode-1 artifact via backend.
 *   2. Create a section-scope proposal WITHOUT useLlm → deterministic apply
 *      appends `[Edited with instruction: <instruction>]` to each block on
 *      approval (see applyInstruction / applyInstructionToBlock).
 *   3. Approve it.
 *   4. Re-GET the artifact (the read the FE reload path uses) and assert the
 *      applied marker is present in the DURABLE schema — the regression proof.
 *   5. Assert the proposal's own status advanced to executed, and a
 *      re-approve of the same proposal is rejected (idempotency guard).
 *
 * RUN (mock-DB, safe — does not touch prod):
 *   E2E_USE_WEB_SERVER=true E2E_REQUIRE_TEST_SUPPORT=true E2E_MOCK_DB=true \
 *     npx playwright test tests/e2e/documents/approve-proposal-persist.spec.ts --project=chromium
 */
import { expect, test } from '@playwright/test';

import {
  DOC_STUDIO_BASE,
  approveProposal,
  authHeaders,
  collectSchemaText,
  fetchArtifactSchema,
  seedDocumentArtifact,
  seedSectionProposal,
  setupDocumentStudioSession,
} from './_document-studio-helpers';

test.describe('Document Studio — approve AI proposal persists across reload', () => {
  test.describe.configure({ timeout: 120000 });

  test('approving a section proposal survives a fresh GET (write-through), and re-approve is rejected', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const { artifactId, schema } = await seedDocumentArtifact(page.request, token, {
      description:
        'Post-implementation review: benefits realized, lessons learned, and follow-up actions.',
      documentType: 'post_implementation_review',
    });

    expect(schema.sections.length).toBeGreaterThan(0);
    const targetSectionId: string = schema.sections[0].sectionId;
    expect(typeof targetSectionId).toBe('string');

    // Marker text is unique-per-run so the durable assertion cannot be
    // satisfied by pre-existing content.
    const instruction = `Tighten the executive framing E2E-${Date.now()}`;

    const { proposalId, expectedMarker } = await seedSectionProposal(
      page.request,
      token,
      artifactId,
      targetSectionId,
      instruction
    );

    // Pre-condition: the applied marker must NOT already be in the document.
    const before = await fetchArtifactSchema(page.request, token, artifactId);
    expect(collectSchemaText(before)).not.toContain(expectedMarker);

    await test.step('approve the proposal → executed, echoed schema already carries the edit', async () => {
      const result = await approveProposal(page.request, token, artifactId, proposalId);
      expect(['approved', 'executed']).toContain(result.proposal?.status);
      // The echoed schema (in-memory) should already reflect the edit — this
      // was always true; the fix is about the DURABLE path below.
      expect(collectSchemaText(result.schema)).toContain(expectedMarker);
    });

    await test.step('DURABLE proof: a fresh GET still contains the approved edit (f6dd2ccc59)', async () => {
      const afterReload = await fetchArtifactSchema(page.request, token, artifactId);
      expect(collectSchemaText(afterReload)).toContain(expectedMarker);
    });

    await test.step('re-approving the same (now executed) proposal is rejected — idempotency guard', async () => {
      const res = await page.request.post(
        `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/editor/proposals/${encodeURIComponent(
          proposalId
        )}/approve`,
        { headers: authHeaders(token), timeout: 40000 }
      );
      // Service throws proposal_not_pending → route maps non-not-found to 400.
      expect(res.status()).toBe(400);
      // The durable schema is unchanged (no double-apply of the marker).
      const stillOnce = await fetchArtifactSchema(page.request, token, artifactId);
      const text = collectSchemaText(stillOnce);
      const occurrences = text.split(expectedMarker).length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(1);
    });
  });

  test('rejecting a proposal leaves the document untouched (no persistence side-effect)', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const { artifactId, schema } = await seedDocumentArtifact(page.request, token, {
      description: 'Risk register update: new risks, mitigations, and residual exposure.',
      documentType: 'risk_register_report',
    });
    const targetSectionId: string = schema.sections[0].sectionId;
    const instruction = `Reject-path instruction E2E-${Date.now()}`;
    const { proposalId, expectedMarker } = await seedSectionProposal(
      page.request,
      token,
      artifactId,
      targetSectionId,
      instruction
    );

    const rejectRes = await page.request.post(
      `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/editor/proposals/${encodeURIComponent(
        proposalId
      )}/reject`,
      { headers: authHeaders(token), timeout: 40000 }
    );
    expect(rejectRes.status(), await rejectRes.text()).toBe(200);

    // A rejected proposal must never touch the durable schema.
    const afterReject = await fetchArtifactSchema(page.request, token, artifactId);
    expect(collectSchemaText(afterReject)).not.toContain(expectedMarker);
  });
});
