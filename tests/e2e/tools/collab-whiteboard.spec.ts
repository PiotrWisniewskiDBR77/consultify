/**
 * Multiplayer collaboration — Whiteboard, two real browser contexts.
 *
 * Reuses the proven M09 harness (tests/e2e/smoke/m09-whiteboard-helpers.ts)
 * and mirrors the existing MC-09-27 pattern in tests/e2e/cases/m09-cases.spec.ts
 * (owner adds a sticky -> member's canvas grows a node), but scoped to run
 * under THIS task's mock-DB/mock-AI harness rather than staging.
 *
 * Realtime path under test: /ws/collab/:ideaId (server/src/gateways/
 * ideaCollabWs.gateway.ts, attached unconditionally in server/src/index.ts:
 * 1964-1971 -- no MOCK_DB guard found on the gateway file or its attach call).
 * useWhiteboardCollab.ts broadcasts `graph_patch` ops on node add; the peer
 * applies them via the `idea-collab-graph-patch` window event.
 *
 * Two assertions, in order of strength:
 *   1. PRIMARY (soft, real-time): member's node count increases within ~1.5s
 *      of the owner adding a sticky, with NO reload -- proves the WS push
 *      actually works end-to-end in this harness. `expect.soft` so a slow/CI
 *      machine missing the broadcast window doesn't fail the whole gate --
 *      the finding is printed either way (matches the established m09
 *      headlessNote() convention for timing-sensitive multiplayer checks).
 *   2. FALLBACK (hard, persistence-based): after a reload, the member MUST see
 *      the node that was added -- this does not depend on WS timing, only on
 *      the shared mock-DB state (see collab-ideas-table.spec.ts for the same
 *      argument re: mock DB being one process-global store).
 */
import { expect, test } from '@playwright/test';

import {
  WB,
  addSticky,
  nodeCount,
  openWhiteboardAsMember,
  openWhiteboardAsOwner,
} from '../smoke/m09-whiteboard-helpers';

test.describe('Collab — Whiteboard, two users same org [@module:collab]', () => {
  test.setTimeout(120000);

  test('owner adds a sticky; member sees it (realtime push, with reload fallback proof)', async ({
    page,
    browser,
  }) => {
    const session = await openWhiteboardAsOwner(page, `E2E Collab Whiteboard ${Date.now()}`);
    await expect(page.getByLabel(WB.canvasRegion)).toBeVisible({ timeout: 30000 });

    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    try {
      await openWhiteboardAsMember(memberPage, session.ideaId);
      await memberPage.getByLabel(WB.canvasRegion).waitFor({ timeout: 30000 }).catch(() => {});
      await memberPage.waitForTimeout(1500); // let the collab WS connect

      const memberNodesBefore = await nodeCount(memberPage);

      const added = await addSticky(page);
      expect(added, 'owner could add a sticky').toBe(true);

      // PRIMARY: realtime push, no reload. Soft -- report but don't hard-fail on
      // slow CI (matches existing MC-09-27 convention for the same assertion).
      await memberPage.waitForTimeout(1500);
      const memberNodesAfterPush = await nodeCount(memberPage);
      expect
        .soft(
          memberNodesAfterPush,
          'member canvas grew a node via WS graph_patch push (no reload)'
        )
        .toBeGreaterThan(memberNodesBefore);

      // FALLBACK: hard persistence proof independent of WS timing. The owner's
      // sticky add is durably saved (useWhiteboardCollab / map-sync); a reload
      // on the member side must show it even if the live push was missed.
      await memberPage.reload({ waitUntil: 'domcontentloaded' });
      await memberPage.getByLabel(WB.canvasRegion).waitFor({ timeout: 30000 });
      await memberPage.waitForTimeout(1500);
      const memberNodesAfterReload = await nodeCount(memberPage);
      expect(
        memberNodesAfterReload,
        'member sees the owner-added sticky after reload (durable shared state)'
      ).toBeGreaterThan(memberNodesBefore);
    } finally {
      await memberContext.close();
    }
  });
});
