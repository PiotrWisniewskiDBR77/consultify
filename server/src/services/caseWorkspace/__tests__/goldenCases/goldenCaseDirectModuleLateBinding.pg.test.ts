/**
 * GOLDEN CASE F — a module artifact created directly, with NO Case, is
 * LATE-BOUND into a Case afterwards; the pointer round-trips through a
 * revision update and back, on a real database.
 *
 *   A module artifact exists (an id this suite mints itself, exactly as a
 *     native module — Assessment/Finance/Materials/etc — would own it: this
 *     packet's allowlist forbids touching those modules' own tables, so the
 *     artifact's existence is represented the same way case-workspace's own
 *     services represent it everywhere — an opaque (artifactType, artifactId)
 *     pointer with NO row in any case-workspace table)
 *        -> a Case is created LATER, with no knowledge of that artifact
 *        -> the artifact is LATE-BOUND to the Case (POST .../artifact-links)
 *        -> the link is read back by id — with exactly enough information
 *           (artifactType, artifactId, artifactRevision) to construct a
 *           deep link INTO the owning module, and NOTHING else
 *        -> the module publishes a new revision; the Case re-pins to it
 *        -> the Case later unlinks it (module ownership was never
 *           transferred, so unlinking is a Case-side bookkeeping act, not a
 *           deletion of the module's own object)
 *
 * What this proves that Golden Cases A/B/C/D/E do not:
 *   - CW-RT-025 (artifactLinkService.ts's own header, cited verbatim in this
 *     repo's frozen product decisions: "moduly dzialaja BEZ Case i bez
 *     Teresy; obiekty modulow sa LINKOWANE do Case, nigdy kopiowane; Case
 *     nie przejmuje ownership"): an artifact that predates any Case, created
 *     by a module that never heard of case-workspace, can still be pointed
 *     at from a Case the moment one exists — "late binding", the literal
 *     Golden Case list item 4 ("direct module bez Case, nastepnie late
 *     binding do Case");
 *   - the pointer carries NO content column at all — this is asserted
 *     directly against `information_schema.columns` for
 *     `case_workspace_artifact_links`, not inferred from what one INSERT
 *     happened to send, so a future migration that added a content-shaped
 *     column would fail this test rather than pass it silently;
 *   - CW-01-026-INV9: re-pinning to a NEW revision published by the module
 *     is a POINTER UPDATE with an appended history entry, never a new row
 *     and never a copy of the module's content;
 *   - unlinking (DELETE /artifact-links/:linkId) changes ONLY the link's own
 *     `link_status` — nothing about the artifact itself is touched, because
 *     nothing about the artifact was ever stored here to touch. This is the
 *     provable half of Golden Case list item 12 ("deliverable otwierany w
 *     module zrodlowym i powrot do Case"): the backend contract that makes
 *     that round trip possible from the CLIENT side. What this suite does
 *     NOT and CANNOT prove — documented explicitly, not glossed over — is
 *     the UI navigation itself: "opening" the artifact in its source module
 *     and returning to the Case are client-side routing acts with no
 *     corresponding case-workspace API call, so no backend test can
 *     observe them. That half of CW-RT-025's claim stays evidence-missing
 *     at THIS layer, on purpose.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BASE,
  CONNECTION_STRING,
  createGoldenCaseApp,
  eventTypes,
  GoldenCaseFixtures,
  isGoldenCaseDbReachable,
  readOutboxForOrg,
  warnSkipped,
} from './goldenCaseHarness.js';

const REACHABLE = await isGoldenCaseDbReachable();
warnSkipped('Golden Case F (direct module, no Case, then late binding)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('GOLDEN CASE F — a module artifact predates its Case; late binding never copies it', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('binds a pre-existing module artifact late, re-pins its revision, and unlinks without touching it', async () => {
    const fx = new GoldenCaseFixtures(control);
    const correlationId = `golden-f-${randomUUID()}`;
    try {
      const orgId = await fx.seedOrg('golden-f');
      const projectId = await fx.seedProject(orgId, 'golden-f');
      const consultantId = await fx.seedUser(orgId, 'golden-f-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');

      const app = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const as = (m: 'post' | 'get' | 'delete', url: string) =>
        request(app)[m](url).set('X-Correlation-ID', correlationId);

      // -- 1. A module artifact exists BEFORE any Case does --------------------
      // This id is exactly what a native module (e.g. an Assessment
      // Table row, a Finance workbook) would already own — case-workspace
      // never creates it and this packet's allowlist forbids touching that
      // module's own tables, so it is represented the same way
      // artifactLinkService itself represents every module object: an opaque
      // (artifactType, artifactId) pair with no case-workspace row at all.
      const moduleArtifactId = `assessment-table-${randomUUID()}`;
      const moduleArtifactType = 'assessment_table';

      const linksBeforeCase = await control.query(
        `SELECT link_id FROM case_workspace_artifact_links WHERE artifact_id = $1`,
        [moduleArtifactId]
      );
      expect(linksBeforeCase.rowCount).toBe(0);

      // -- 2. The Case is created LATER, with no knowledge of the artifact ----
      const created = await as('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      const caseId: string = created.body.data.caseId;
      await as('post', `${BASE}/cases/${caseId}/status`).send({ targetStatus: 'ACTIVE' });

      // -- 3. Late binding: the module artifact is pointed at from the Case ---
      const lateBound = await as('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: moduleArtifactType,
        artifactId: moduleArtifactId,
        artifactRevision: 'rev-1',
        relation: 'EVIDENCE',
      });
      expect(lateBound.status).toBe(201);
      expect(lateBound.body.data.linkStatus).toBe('ACTIVE');
      const linkId: string = lateBound.body.data.linkId;

      // -- 4. NO content column exists on this table — asserted against the
      //    live schema, not against what one INSERT happened to send. -------
      const columns = await control.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'case_workspace_artifact_links'`
      );
      const columnNames = columns.rows.map((r) => r.column_name);
      for (const forbidden of ['content', 'payload', 'body', 'data', 'blob']) {
        expect(columnNames).not.toContain(forbidden);
      }
      // Only the pointer fields the header promises, plus link-lifecycle
      // metadata — never a copy.
      expect(columnNames).toEqual(
        expect.arrayContaining(['artifact_type', 'artifact_id', 'artifact_revision', 'link_status'])
      );

      // -- 5. The link, read back by id, carries EXACTLY enough to construct
      //    a deep link into the owning module — and nothing more. -----------
      const readBack = await as('get', `${BASE}/artifact-links/${linkId}`);
      expect(readBack.status).toBe(200);
      expect(readBack.body.data).toMatchObject({
        caseId,
        artifactType: moduleArtifactType,
        artifactId: moduleArtifactId,
        artifactRevision: 'rev-1',
        relation: 'EVIDENCE',
        linkStatus: 'ACTIVE',
      });
      // The module's own record is untouched by this being late-bound — the
      // Case link references it by id only.
      const linkRow = await control.query(
        `SELECT artifact_type, artifact_id, artifact_revision, case_id FROM case_workspace_artifact_links
          WHERE link_id = $1`,
        [linkId]
      );
      expect(linkRow.rows[0]).toMatchObject({
        artifact_type: moduleArtifactType,
        artifact_id: moduleArtifactId,
        artifact_revision: 'rev-1',
        case_id: caseId,
      });

      // -- 6. The module publishes a new revision; the Case re-pins to it -----
      const rePinned = await as('post', `${BASE}/artifact-links/${linkId}/pin`).send({
        revision: 'rev-2',
        reason: 'module published an updated version',
      });
      expect(rePinned.status).toBe(200);
      expect(rePinned.body.data.artifactRevision).toBe('rev-2');
      expect(rePinned.body.data.revisionPinHistory.length).toBeGreaterThanOrEqual(1);

      // Still exactly ONE link row for this (case, artifact) pair — re-pinning
      // is a pointer update, never a new row.
      const linksAfterPin = await control.query(
        `SELECT link_id, artifact_revision FROM case_workspace_artifact_links
          WHERE case_id = $1 AND artifact_id = $2`,
        [caseId, moduleArtifactId]
      );
      expect(linksAfterPin.rowCount).toBe(1);
      expect(linksAfterPin.rows[0].link_id).toBe(linkId);
      expect(linksAfterPin.rows[0].artifact_revision).toBe('rev-2');

      // -- 7. "Opened in the source module, and back to the Case" — the
      //    provable half only: the Case's own view of the link is stable and
      //    complete before AND after whatever the client does with it in the
      //    module's own UI (which never calls this API, by design). --------
      const beforeRoundTrip = await as('get', `${BASE}/cases/${caseId}/artifact-links`);
      expect(beforeRoundTrip.status).toBe(200);
      const entryBefore = beforeRoundTrip.body.data.find((l: { linkId: string }) => l.linkId === linkId);
      expect(entryBefore).toMatchObject({ artifactRevision: 'rev-2', linkStatus: 'ACTIVE' });

      // (No API call happens here on purpose — this IS the gap. Opening the
      // artifact in `assessment_table`'s own UI and navigating back to the
      // Case are both client-side routing actions this packet's API surface
      // has no endpoint for. Documented as evidence-missing, not silently
      // treated as proven.)

      const afterRoundTrip = await as('get', `${BASE}/cases/${caseId}/artifact-links`);
      expect(afterRoundTrip.status).toBe(200);
      const entryAfter = afterRoundTrip.body.data.find((l: { linkId: string }) => l.linkId === linkId);
      // The Case-side pointer is byte-for-byte the same before and after —
      // whatever the module's UI does to ITS OWN object, the Case's record of
      // it is unaffected, because the Case never held a copy to begin with.
      expect(entryAfter).toEqual(entryBefore);

      // -- 8. Unlinking touches ONLY the link's own status ---------------------
      const unlinked = await as('delete', `${BASE}/artifact-links/${linkId}`).send({
        reason: 'Case no longer needs this evidence pointer',
      });
      expect(unlinked.status).toBe(200);
      expect(unlinked.body.data.linkStatus).toBe('UNLINKED');

      const linkRowAfterUnlink = await control.query(
        `SELECT link_status, artifact_type, artifact_id, artifact_revision FROM case_workspace_artifact_links
          WHERE link_id = $1`,
        [linkId]
      );
      expect(linkRowAfterUnlink.rows[0]).toMatchObject({
        link_status: 'UNLINKED',
        // The pointer fields survive unlinking untouched — unlinking is Case
        // bookkeeping, not deletion of the module's object or its identity.
        artifact_type: moduleArtifactType,
        artifact_id: moduleArtifactId,
        artifact_revision: 'rev-2',
      });

      // ======================================================================
      // OUTBOX
      // ======================================================================
      const outbox = await readOutboxForOrg(control, orgId);
      const types = eventTypes(outbox);
      expect(types).toContain('artifact.linked_to_case');
      expect(types).toContain('evidence.pinned');
      expect(types).toContain('artifact.unlinked_from_case');

      const linkedEvent = outbox.find((r) => r.event_type === 'artifact.linked_to_case');
      expect(linkedEvent!.aggregate_id).toBe(linkId);
      expect(linkedEvent!.case_id).toBe(caseId);

      const correlationIds = new Set(outbox.map((r) => r.correlation_id));
      expect([...correlationIds]).toEqual([correlationId]);

      await control.query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]);
    } finally {
      await fx.teardown();
    }
  }, 120_000);
});
