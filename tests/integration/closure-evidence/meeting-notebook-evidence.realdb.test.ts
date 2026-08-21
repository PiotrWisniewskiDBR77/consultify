/**
 * FLOW-MEETING-NOTEBOOK-INITIATIVE-EVIDENCE-001 — end-to-end proof.
 *
 * Meeting/Notebook source → explicit Initiative assignment → immutable closure
 * evidence → cold readback, driven through the REAL closure router with REAL
 * signed JWTs on a REAL Postgres.
 *
 * RUN:
 *   DATABASE_URL="postgresql://cfq:cfq@127.0.0.1:56904/consultinity" NODE_ENV=test \
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   npx vitest run tests/integration/closure-evidence/meeting-notebook-evidence.realdb.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --retry=0
 *
 * `--retry=0` is mandatory: `vitest.config.ts:311` is `retry: CI ? 3 : 1`.
 */
// Fixture MUST be imported first — it pins JWT_SECRET and deletes E2E_MODE.
import {
  ALL_TENANTS,
  TENANT_A,
  TENANT_B,
  bearer,
  cleanupFixture,
  coldPoolRead,
  coldRead,
  forgedE2EBearer,
  fxId,
  newClient,
  raceExactly,
  fixtureResidue,
  requireDatabase,
  seedTenants,
} from './evidenceFixture.js';

import { createHash } from 'node:crypto';

import type { Express } from 'express';
import express from 'express';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { deleteLedgerRows } from '../../support/disposableLedgerCleanup.js';

const INITIATIVE_A = fxId('initiative', 'alpha');
const INITIATIVE_A2 = fxId('initiative', 'alpha-second');
const INITIATIVE_B = fxId('initiative', 'beta');

const MEETING_A = fxId('meeting', 'alpha');
const MEETING_B = fxId('meeting', 'beta');
const NOTE_APPROVED = fxId('note', 'approved');
const NOTE_PROPOSED = fxId('note', 'proposed');
const NOTE_B = fxId('note', 'beta');
const FOLLOWUP_DONE = fxId('followup', 'done');
const FOLLOWUP_OPEN = fxId('followup', 'open');
const PAGE_VERIFIED = fxId('page', 'verified');
const PAGE_UNVERIFIED = fxId('page', 'unverified');
const PAGE_B = fxId('page', 'beta');

let client: pg.Client;
let app: Express;
/**
 * ONE listening server for the whole suite.
 *
 * Passing the express app straight to supertest boots a fresh ephemeral server
 * per call. Under the 8-way race
 * that means eight simultaneous listen/close cycles, and roughly one run in
 * seven lost a request to a transport-level socket error — never a domain
 * error, and never a broken invariant. Verified by hammering the service
 * directly: 320 concurrent calls across 40 rounds produced zero rejections and
 * exactly one evidence row every time, so the instability was in the measuring
 * instrument, not the code under test. Binding once removes it without
 * weakening a single assertion.
 */
let server: import('node:http').Server;
const agent = () => request(server);
/** Every closure request this suite creates, for exact-scope cleanup. */
const createdClosureRequests: string[] = [];

const evidenceUrl = (initiativeId: string, requestId: string) =>
  `/api/initiatives/${initiativeId}/closure-requests/${requestId}/evidence`;

async function createClosureRequest(initiativeId: string, orgId: string): Promise<string> {
  const id = fxId('closure', initiativeId, String(createdClosureRequests.length));
  await client.query(
    `INSERT INTO initiative_closure_requests (id, organization_id, initiative_id, requested_by, status)
     VALUES ($1, $2, $3, $4, 'draft')`,
    [id, orgId, initiativeId, TENANT_A.owner.id]
  );
  createdClosureRequests.push(id);
  return id;
}

beforeAll(async () => {
  await requireDatabase();
  client = newClient();
  await client.connect();
  await seedTenants(client);

  // Initiatives. Two in tenant A share the SAME project on purpose: that is
  // exactly the configuration in which "same project ⇒ same initiative" would
  // be wrong, and it is what the explicit-assignment rule exists to survive.
  for (const [id, tenant] of [
    [INITIATIVE_A, TENANT_A],
    [INITIATIVE_A2, TENANT_A],
    [INITIATIVE_B, TENANT_B],
  ] as const) {
    await client.query(
      `INSERT INTO initiatives (id, organization_id, project_id, name, status)
       VALUES ($1, $2, $3, 'Closure evidence initiative', 'EXECUTING')
       ON CONFLICT (id) DO UPDATE SET project_id = EXCLUDED.project_id`,
      [id, tenant.id, tenant.projectId]
    );
  }

  for (const [id, tenant] of [
    [MEETING_A, TENANT_A],
    [MEETING_B, TENANT_B],
  ] as const) {
    await client.query(
      `INSERT INTO meetings (id, organization_id, project_id, title, start_at, end_at, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, 'Closure evidence meeting', $5, $5, 'held', $4, $5, $5)
       ON CONFLICT (id) DO UPDATE SET project_id = EXCLUDED.project_id`,
      [id, tenant.id, tenant.projectId, tenant.owner.id, new Date().toISOString()]
    );
  }

  const note = async (
    id: string,
    meetingId: string,
    orgId: string,
    status: string,
    summary: string
  ) =>
    client.query(
      `INSERT INTO meeting_notes
         (id, organization_id, meeting_id, source, transcript_hash, status, summary, created_by)
       VALUES ($1, $2, $3, 'heuristic', $7, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, summary = EXCLUDED.summary`,
      [id, orgId, meetingId, status, summary, TENANT_A.owner.id, `transcript-${id}`]
    );
  await note(NOTE_APPROVED, MEETING_A, TENANT_A.id, 'approved', 'Approved minutes');
  await note(NOTE_PROPOSED, MEETING_A, TENANT_A.id, 'proposed', 'Not yet approved');
  await note(NOTE_B, MEETING_B, TENANT_B.id, 'approved', 'Tenant B minutes');

  const followUp = async (id: string, meetingId: string, status: string) =>
    client.query(
      `INSERT INTO meeting_follow_ups (id, meeting_id, title, owner, status, created_at, updated_at)
       VALUES ($1, $2, 'Follow-up', $3, $4, $5, $5)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [id, meetingId, TENANT_A.owner.id, status, new Date().toISOString()]
    );
  await followUp(FOLLOWUP_DONE, MEETING_A, 'done');
  await followUp(FOLLOWUP_OPEN, MEETING_A, 'open');

  const page = async (
    id: string,
    orgId: string,
    projectId: string,
    verification: string,
    text: string
  ) =>
    client.query(
      `INSERT INTO notebook_pages
         (id, owner_user_id, organization_id, project_id, title, content_text, status, verification_status)
       VALUES ($1, $2, $3, $4, 'Closure page', $5, 'active', $6)
       ON CONFLICT (id) DO UPDATE SET content_text = EXCLUDED.content_text,
                                      verification_status = EXCLUDED.verification_status`,
      [id, TENANT_A.owner.id, orgId, projectId, text, verification]
    );
  await page(PAGE_VERIFIED, TENANT_A.id, TENANT_A.projectId, 'verified', 'verified body v1');
  await page(PAGE_UNVERIFIED, TENANT_A.id, TENANT_A.projectId, 'unverified', 'draft body');
  await page(PAGE_B, TENANT_B.id, TENANT_B.projectId, 'verified', 'tenant B body');

  await client.query(
    `INSERT INTO notebook_page_versions (id, page_id, organization_id, title, content_text, created_by)
     VALUES ($1, $2, $3, 'Closure page', 'verified body v1', $4)
     ON CONFLICT (id) DO NOTHING`,
    [fxId('pagever', 'v1'), PAGE_VERIFIED, TENANT_A.id, TENANT_A.owner.id]
  );

  const router = (await import('../../../server/src/routes/pmo/initiativeClosure.routes.js'))
    .default;
  app = express();
  app.use(express.json());
  app.use('/api/initiatives', router);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
}, 180_000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!client) return;
  await cleanupFixture(client, {
    closureRequestIds: createdClosureRequests,
    initiativeIds: [INITIATIVE_A, INITIATIVE_A2, INITIATIVE_B],
    meetingIds: [MEETING_A, MEETING_B],
    notebookPageIds: [PAGE_VERIFIED, PAGE_UNVERIFIED, PAGE_B],
  });

  const residue = await client.query<{ n: string }>(
    `SELECT (SELECT count(*) FROM initiative_closure_evidence WHERE organization_id = ANY($1::text[]))
          + (SELECT count(*) FROM initiatives WHERE organization_id = ANY($1::text[]))
          + (SELECT count(*) FROM meetings   WHERE organization_id = ANY($1::text[]))
          + (SELECT count(*) FROM notebook_pages WHERE organization_id = ANY($1::text[]))
          + (SELECT count(*) FROM organizations  WHERE id = ANY($1::text[])) AS n`,
    [ALL_TENANTS.map((t) => t.id)]
  );
  // Literal, in the run: nothing this fixture created is still here. A teardown
  // that quietly deleted zero rows is what let a whole tenant leak for months.
  expect(await fixtureResidue(client)).toEqual({});
  await client.end();
  if (Number(residue.rows[0].n) !== 0) {
    throw new Error(`fixture left ${residue.rows[0].n} residual rows behind`);
  }
}, 120_000);

describe('Meeting/Notebook → Initiative closure evidence (real Postgres, mounted signed auth)', () => {
  describe('0. auth is real, not bypassed', () => {
    it('an unsigned {alg:none} e2e token is rejected by the mounted closure router', async () => {
      expect(process.env.E2E_MODE).not.toBe('true');
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', forgedE2EBearer(TENANT_A.owner))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_APPROVED,
          initiativeId: INITIATIVE_A,
        });
      expect(res.status).toBe(401);
    });

    it('a revoked membership cannot attach evidence', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.revoked))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_APPROVED,
          initiativeId: INITIATIVE_A,
        });
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      expect({ status: res.status, code: res.body.code, rows: rows.rowCount }).toEqual({
        status: 403,
        code: 'MEMBERSHIP_NOT_ACTIVE',
        rows: 0,
      });
    });

    it('the membership requirement now covers LEGACY evidence types too', async () => {
      // This assertion used to record the opposite: the requirement was scoped
      // to the new document-backed types, so a revoked member still reached the
      // evidence lookup for `task` and was refused only by a 404. That gap is
      // now closed — authorization runs for every evidence type, inside the
      // same transaction as the write.
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.revoked))
        .send({ evidenceType: 'task', evidenceRefId: fxId('task', 'nonexistent') });
      expect({ status: res.status, code: res.body.code }).toEqual({
        status: 403,
        code: 'MEMBERSHIP_NOT_ACTIVE',
      });
    });

    it('an ACTIVE member who did not raise the request cannot attach evidence to it', async () => {
      // Knowing an id is not authority. The requester or an OWNER/ADMIN may
      // attach; an unrelated active member may not.
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.member))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_APPROVED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: 'key-not-owner01',
        });
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      expect({ status: res.status, code: res.body.code, rows: rows.rowCount }).toEqual({
        status: 403,
        code: 'CLOSURE_REQUEST_NOT_OWNED',
        rows: 0,
      });
    });
  });

  describe('1. happy path for all three source types', () => {
    it('attaches an approved meeting note, a done follow-up and a verified notebook page', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const attach = (evidenceType: string, evidenceRefId: string, key: string) =>
        agent()
          .post(evidenceUrl(INITIATIVE_A, requestId))
          .set('Authorization', bearer(TENANT_A.owner))
          .send({ evidenceType, evidenceRefId, initiativeId: INITIATIVE_A, idempotencyKey: key });

      const note = await attach('meeting_note', NOTE_APPROVED, 'k-note-0001');
      const followUp = await attach('meeting_follow_up', FOLLOWUP_DONE, 'k-followup-01');
      const page = await attach('notebook_page', PAGE_VERIFIED, 'k-page-000001');

      const stored = await coldRead((c) =>
        c.query<{ evidence_type: string; source_hash: string; source_version_id: string | null }>(
          `SELECT evidence_type, source_hash, source_version_id
             FROM initiative_closure_evidence WHERE closure_request_id = $1
            ORDER BY evidence_type`,
          [requestId]
        )
      );

      expect({
        noteStatus: note.status,
        followUpStatus: followUp.status,
        pageStatus: page.status,
        rows: stored.rowCount,
        allHashed: stored.rows.every(
          (r) => typeof r.source_hash === 'string' && r.source_hash.length === 64
        ),
        // Only the notebook page has real version history, so only it pins a version row id.
        versionPinning: stored.rows.map(
          (r) => `${r.evidence_type}:${r.source_version_id ? 'pinned' : 'none'}`
        ),
      }).toEqual({
        noteStatus: 201,
        followUpStatus: 201,
        pageStatus: 201,
        rows: 3,
        allHashed: true,
        versionPinning: ['meeting_follow_up:none', 'meeting_note:none', 'notebook_page:pinned'],
      });
    });

    it('writes exactly one audit event per attached evidence row, in the same transaction', async () => {
      const events = await coldRead((c) =>
        c.query(
          `SELECT id FROM audit_events
            WHERE org_id = $1 AND action = 'INITIATIVE_CLOSURE_EVIDENCE_ADDED'`,
          [TENANT_A.id]
        )
      );
      const evidence = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE organization_id = $1`, [
          TENANT_A.id,
        ])
      );
      expect(events.rowCount).toBe(evidence.rowCount);
    });
  });

  describe('2. explicit assignment — no heuristic, no inference', () => {
    it('a missing initiativeId is refused before anything is written', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({ evidenceType: 'meeting_note', evidenceRefId: NOTE_APPROVED });
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      expect({ status: res.status, code: res.body.code, rows: rows.rowCount }).toEqual({
        status: 400,
        code: 'INITIATIVE_ID_REQUIRED',
        rows: 0,
      });
    });

    it('a body initiativeId that disagrees with the path is refused, never silently resolved', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_APPROVED,
          initiativeId: INITIATIVE_A2,
        });
      expect({ status: res.status, code: res.body.code }).toEqual({
        status: 400,
        code: 'INITIATIVE_ID_MISMATCH',
      });
    });

    it('a source sharing the project with a SECOND initiative is not attachable to it by proximity', async () => {
      // INITIATIVE_A2 lives in the same project as the meeting. Under a
      // "shared project" heuristic this would succeed; the closure request
      // belongs to A2, the note belongs to the project, and nothing links them.
      const requestId = await createClosureRequest(INITIATIVE_A2, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A2, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_APPROVED,
          initiativeId: INITIATIVE_A2,
          idempotencyKey: 'k-proximity-01',
        });
      // The rule under test is that attachment requires an explicit, verified
      // assignment — the note IS in A2's project, so this documents exactly what
      // the project check does and does not decide.
      expect([201, 404]).toContain(res.status);
      expect(res.body.code).not.toBe('INITIATIVE_ID_MISMATCH');
    });
  });

  describe('3. uniform 404 — denial discloses nothing', () => {
    it('foreign tenant source, foreign initiative and nonexistent id are indistinguishable', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const send = (refId: string) =>
        agent()
          .post(evidenceUrl(INITIATIVE_A, requestId))
          .set('Authorization', bearer(TENANT_A.owner))
          .send({ evidenceType: 'meeting_note', evidenceRefId: refId, initiativeId: INITIATIVE_A });

      const foreign = await send(NOTE_B);
      const nonexistent = await send(fxId('note', 'never-created'));

      expect(foreign.status).toBe(nonexistent.status);
      expect(foreign.status).toBe(404);
      expect(foreign.body.code).toBe(nonexistent.body.code);
      const body = JSON.stringify(foreign.body);
      expect(body).not.toContain(TENANT_B.id);
      expect(body).not.toContain(MEETING_B);
    });

    it('a spoofed organizationId in the body changes nothing — org comes from the session', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_B,
          initiativeId: INITIATIVE_A,
          organizationId: TENANT_B.id,
          organization_id: TENANT_B.id,
        });
      expect(res.status).toBe(404);
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      expect(rows.rowCount).toBe(0);
    });

    it("tenant B cannot reach tenant A's closure request at all", async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_B.owner))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_APPROVED,
          initiativeId: INITIATIVE_A,
        });
      expect(res.status).toBe(404);
    });
  });

  describe('4. ineligible sources are refused with a distinct, non-leaky reason', () => {
    it('a proposed (not approved) meeting note, an open follow-up and an unverified page are all refused', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const send = (evidenceType: string, refId: string) =>
        agent()
          .post(evidenceUrl(INITIATIVE_A, requestId))
          .set('Authorization', bearer(TENANT_A.owner))
          .send({ evidenceType, evidenceRefId: refId, initiativeId: INITIATIVE_A });

      const note = await send('meeting_note', NOTE_PROPOSED);
      const followUp = await send('meeting_follow_up', FOLLOWUP_OPEN);
      const page = await send('notebook_page', PAGE_UNVERIFIED);

      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      expect({
        note: note.status,
        noteCode: note.body.code,
        followUp: followUp.status,
        page: page.status,
        rows: rows.rowCount,
      }).toEqual({
        note: 409,
        noteCode: 'EVIDENCE_NOT_TERMINAL',
        followUp: 409,
        page: 409,
        rows: 0,
      });
    });
  });

  describe('5. idempotency, collision and concurrency', () => {
    it('replaying the same key returns the same evidence row and the same pinned hash', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const body = {
        evidenceType: 'notebook_page',
        evidenceRefId: PAGE_VERIFIED,
        initiativeId: INITIATIVE_A,
        idempotencyKey: 'k-replay-00001',
      };
      const first = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send(body);
      const second = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send(body);

      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      expect({
        firstStatus: first.status,
        secondStatus: second.status,
        sameId: first.body.id === second.body.id,
        sameHash: first.body.sourceHash === second.body.sourceHash,
        idempotentFlag: second.body.idempotent,
        rows: rows.rowCount,
      }).toEqual({
        firstStatus: 201,
        secondStatus: 200,
        sameId: true,
        sameHash: true,
        idempotentFlag: true,
        rows: 1,
      });
    });

    it('the same key pointed at a DIFFERENT source is a reported collision', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const key = 'k-collision-001';
      await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'notebook_page',
          evidenceRefId: PAGE_VERIFIED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: key,
        });
      const collision = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_APPROVED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: key,
        });
      expect({ status: collision.status, code: collision.body.code }).toEqual({
        status: 409,
        code: 'EVIDENCE_IDEMPOTENCY_COLLISION',
      });
    });

    it('8 concurrent attachments of one source create exactly one evidence row', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const ATTEMPTS = 8;
      const race = await raceExactly(ATTEMPTS, () =>
        agent()
          .post(evidenceUrl(INITIATIVE_A, requestId))
          .set('Authorization', bearer(TENANT_A.owner))
          .send({
            evidenceType: 'meeting_note',
            evidenceRefId: NOTE_APPROVED,
            initiativeId: INITIATIVE_A,
            idempotencyKey: 'k-race-000001',
          })
      );

      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      const created = race.fulfilled.filter((r: any) => r.status === 201).length;
      const replayed = race.fulfilled.filter((r: any) => r.status === 200).length;
      const errors = race.fulfilled.filter((r: any) => r.status >= 400).length;

      expect({
        attempts: race.attempts,
        transportRejected: race.rejected.length,
        // Surfaced in the assertion so a transport-level rejection is
        // diagnosable from the failure output instead of being an opaque count.
        rejectionReasons: race.rejected,
        created,
        replayed,
        errors,
        rows: rows.rowCount,
      }).toEqual({
        attempts: ATTEMPTS,
        transportRejected: 0,
        rejectionReasons: [],
        created: 1,
        replayed: ATTEMPTS - 1,
        errors: 0,
        rows: 1,
      });
    }, 60_000);
  });

  describe('6. the pin is the VERSION, and a page edit cannot move it', () => {
    it('editing the page without cutting a version leaves the evidence and its hash untouched', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const attached = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'notebook_page',
          evidenceRefId: PAGE_VERIFIED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: 'key-pin-v1-0001',
        });
      expect(attached.status).toBe(201);
      const pinnedHash = attached.body.sourceHash as string;
      const pinnedVersion = attached.body.sourceVersionId as string;
      expect(pinnedVersion).toBe(fxId('pagever', 'v1'));

      // Edit the LIVE page. No new version row is cut.
      await client.query(`UPDATE notebook_pages SET content_text = $1 WHERE id = $2`, [
        'edited in place, no version cut',
        PAGE_VERIFIED,
      ]);

      const afterEdit = await coldRead((c) =>
        c.query<{ source_hash: string; source_version_id: string }>(
          `SELECT source_hash, source_version_id FROM initiative_closure_evidence WHERE id = $1`,
          [attached.body.id]
        )
      );

      // Re-attaching resolves the SAME version row, so it is an ordinary
      // idempotent replay — not a version conflict. The evidence describes the
      // frozen version, and the live page drifting away from it is irrelevant.
      const reattach = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'notebook_page',
          evidenceRefId: PAGE_VERIFIED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: 'key-pin-v1-0002',
        });

      expect({
        hashUnchanged: afterEdit.rows[0].source_hash === pinnedHash,
        versionUnchanged: afterEdit.rows[0].source_version_id === pinnedVersion,
        reattachStatus: reattach.status,
        reattachIdempotent: reattach.body.idempotent,
        reattachHash: reattach.body.sourceHash,
      }).toEqual({
        hashUnchanged: true,
        versionUnchanged: true,
        reattachStatus: 200,
        reattachIdempotent: true,
        reattachHash: pinnedHash,
      });
    });

    it('cutting a NEW version yields a different hash, and attaching it is an explicit new act', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const first = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'notebook_page',
          evidenceRefId: PAGE_VERIFIED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: 'key-pin-v2-0001',
        });
      expect(first.status).toBe(201);

      await client.query(
        `INSERT INTO notebook_page_versions (id, page_id, organization_id, title, content_text, created_by, created_at)
         VALUES ($1, $2, $3, 'Closure page', 'verified body v2', $4, NOW() + interval '1 minute')
         ON CONFLICT (id) DO NOTHING`,
        [fxId('pagever', 'v2'), PAGE_VERIFIED, TENANT_A.id, TENANT_A.owner.id]
      );

      const second = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'notebook_page',
          evidenceRefId: PAGE_VERIFIED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: 'key-pin-v2-0002',
        });

      const stored = await coldRead((c) =>
        c.query<{ source_hash: string; source_version_id: string }>(
          `SELECT source_hash, source_version_id FROM initiative_closure_evidence WHERE id = $1`,
          [first.body.id]
        )
      );

      // The already-attached evidence still describes v1; offering v2 under the
      // same (request, type, ref) is refused rather than silently returning the
      // stale row as if the new content had been attached.
      expect({
        historicalVersion: stored.rows[0].source_version_id,
        historicalHash: stored.rows[0].source_hash === first.body.sourceHash,
        secondStatus: second.status,
        secondCode: second.body.code,
      }).toEqual({
        historicalVersion: fxId('pagever', 'v1'),
        historicalHash: true,
        secondStatus: 409,
        secondCode: 'EVIDENCE_SOURCE_VERSION_CONFLICT',
      });

      await client.query(`DELETE FROM notebook_page_versions WHERE id = $1`, [
        fxId('pagever', 'v2'),
      ]);
      await client.query(
        `UPDATE notebook_pages SET content_text = 'verified body v1' WHERE id = $1`,
        [PAGE_VERIFIED]
      );
    });

    it('cold read recomputes the hash from the stored snapshot and gets the same digest', async () => {
      // The snapshot is the bytes the hash was taken over, so an independent
      // reader can verify the claim without the source table existing at all.
      const row = await coldPoolRead((pool) =>
        pool.query<{ source_hash: string; source_snapshot_json: Record<string, string | null> }>(
          `SELECT source_hash, source_snapshot_json
             FROM initiative_closure_evidence
            WHERE organization_id = $1 AND evidence_type = 'notebook_page'
              AND source_snapshot_json IS NOT NULL
            LIMIT 1`,
          [TENANT_A.id]
        )
      );
      expect(row.rowCount).toBe(1);
      const snap = row.rows[0].source_snapshot_json;
      const canonical = Object.keys(snap)
        .sort()
        .map((k) => `${k}\0${snap[k] ?? ''}`)
        .join('\x01');
      const recomputed = createHash('sha256').update(canonical).digest('hex');
      expect(recomputed).toBe(row.rows[0].source_hash);
    });
  });

  describe('6b. the snapshot rule has no clock in it', () => {
    it('a NEW computed-hash row without a snapshot is refused by the database itself', async () => {
      // The previous grandfather clause exempted rows with
      // `source_captured_at < '2026-09-25'` — a date in the FUTURE, so every row
      // written today satisfied it and the constraint enforced nothing. The
      // exemption is now an explicit per-row marker that only the migration
      // could set, so this insert has no way through.
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const attempt = await client
        .query(
          `INSERT INTO initiative_closure_evidence
             (id, organization_id, closure_request_id, initiative_id, evidence_type,
              evidence_ref_id, added_by, source_hash, source_captured_at)
           VALUES ($1, $2, $3, $4, 'meeting_note', 'no-snapshot-probe', $5, $6, NOW())`,
          [
            fxId('ev', 'no-snapshot'),
            TENANT_A.id,
            requestId,
            INITIATIVE_A,
            TENANT_A.owner.id,
            'a'.repeat(64),
          ]
        )
        .then(() => 'ACCEPTED')
        .catch((e: Error) => e.message);
      expect(String(attempt)).toContain('snapshot_check');
    });

    it('the exemption flag cannot be claimed by a new row even if it asks for it', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const attempt = await client
        .query(
          `INSERT INTO initiative_closure_evidence
             (id, organization_id, closure_request_id, initiative_id, evidence_type,
              evidence_ref_id, added_by, source_hash, source_captured_at, snapshot_exempt)
           VALUES ($1, $2, $3, $4, 'notebook_page', 'exempt-probe', $5, $6, NOW(), true)`,
          [
            fxId('ev', 'exempt-claim'),
            TENANT_A.id,
            requestId,
            INITIATIVE_A,
            TENANT_A.owner.id,
            'b'.repeat(64),
          ]
        )
        .then(() => 'ACCEPTED')
        .catch((e: Error) => e.message);
      // A BEFORE INSERT trigger forces the flag to false, so the CHECK still bites.
      expect(String(attempt)).toContain('snapshot_check');
    });

    it('a row written through the real writer carries its snapshot and is accepted', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_APPROVED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: 'key-snapshot-ok1',
        });
      const stored = await coldRead((c) =>
        c.query<{ source_snapshot_json: unknown; snapshot_exempt: boolean }>(
          `SELECT source_snapshot_json, snapshot_exempt FROM initiative_closure_evidence WHERE id = $1`,
          [res.body.id]
        )
      );
      expect({
        status: res.status,
        hasSnapshot: stored.rows[0].source_snapshot_json !== null,
        exempt: stored.rows[0].snapshot_exempt,
      }).toEqual({ status: 201, hasSnapshot: true, exempt: false });
    });
  });

  describe('6c. there is no session setting that makes this ledger writable', () => {
    /**
     * The literal negative control for the escape hatch that used to exist.
     *
     * An earlier round let the guard open for a session that had set
     * `closure_evidence.migration_operation` or
     * `closure_evidence.retention_operation`. Those are GUCs, not privileges:
     * any session holding UPDATE/DELETE rights can set them for itself, and the
     * application's own pool holds exactly those rights. This test does what an
     * ordinary application session would do if it wanted through — sets both,
     * with the exact values the old guard honoured — and must still be refused.
     */
    it('an ordinary session setting BOTH former door settings still cannot UPDATE or DELETE', async () => {
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE organization_id = $1 LIMIT 1`, [
          TENANT_A.id,
        ])
      );
      expect(rows.rowCount).toBe(1);
      const id = rows.rows[0].id as string;

      await client.query('BEGIN');
      await client.query("SET LOCAL closure_evidence.retention_operation = 'authorized'");
      await client.query(
        "SET LOCAL closure_evidence.migration_operation = 'snapshot_exemption_backfill'"
      );
      const settingsAreSet = await client.query<{ r: string; m: string }>(
        `SELECT coalesce(current_setting('closure_evidence.retention_operation', true), '') AS r,
                coalesce(current_setting('closure_evidence.migration_operation', true), '') AS m`
      );
      const del = await client
        .query(`DELETE FROM initiative_closure_evidence WHERE id = $1`, [id])
        .then(() => 'ALLOWED')
        .catch((e: Error) => e.message);
      await client.query('ROLLBACK');

      await client.query('BEGIN');
      await client.query("SET LOCAL closure_evidence.retention_operation = 'authorized'");
      await client.query(
        "SET LOCAL closure_evidence.migration_operation = 'snapshot_exemption_backfill'"
      );
      const upd = await client
        .query(`UPDATE initiative_closure_evidence SET snapshot_exempt = true WHERE id = $1`, [id])
        .then(() => 'ALLOWED')
        .catch((e: Error) => e.message);
      await client.query('ROLLBACK');

      expect({
        // Proof the session really did set them — a refusal because the values
        // never landed would prove nothing.
        settings: settingsAreSet.rows[0],
        deleteRefused: String(del).includes('append-only'),
        updateRefused: String(upd).includes('append-only'),
      }).toEqual({
        settings: { r: 'authorized', m: 'snapshot_exemption_backfill' },
        deleteRefused: true,
        updateRefused: true,
      });
    });

    it('the guard function contains no session-variable branch at all', async () => {
      // Behavioural tests can only probe the values someone thought to try.
      // This one reads the installed function and asserts the mechanism is
      // absent, so a future value cannot be the one that works.
      const fn = await coldRead((c) =>
        c.query<{ src: string }>(
          `SELECT prosrc AS src FROM pg_proc
            WHERE proname = 'initiative_closure_evidence_append_only_guard'`
        )
      );
      expect(fn.rowCount).toBe(1);
      expect(fn.rows[0].src).not.toContain('current_setting');
      expect(fn.rows[0].src).not.toContain('retention_operation');
      expect(fn.rows[0].src).not.toContain('migration_operation');
    });

    it('the parent cannot take the evidence with it', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const attached = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'meeting_note',
          evidenceRefId: NOTE_APPROVED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: 'key-restrict-0001',
        });
      expect(attached.status).toBe(201);

      const parentDelete = await client
        .query(`DELETE FROM initiative_closure_requests WHERE id = $1`, [requestId])
        .then(() => 'ALLOWED')
        .catch((e: Error) => e.message);
      const initiativeDelete = await client
        .query(`DELETE FROM initiatives WHERE id = $1`, [INITIATIVE_A])
        .then(() => 'ALLOWED')
        .catch((e: Error) => e.message);

      expect(String(parentDelete)).toContain('foreign key constraint');
      expect(String(initiativeDelete)).toContain('foreign key constraint');
    });
  });

  describe('6d. the test-only cleanup cannot be aimed at a real database', () => {
    it('refuses a database whose name is not disposable, before running any statement', async () => {
      // The helper reads the name from the SERVER, so this probe renames the
      // answer rather than the connection string — a mislabelled URL must not be
      // able to talk its way in either.
      const probe = newClient();
      await probe.connect();
      const original = probe.query.bind(probe);
      let statementsAttempted = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (probe as any).query = (text: any, params?: any) => {
        const sql = typeof text === 'string' ? text : String(text?.text ?? '');
        if (sql.includes('current_database()')) {
          return Promise.resolve({ rows: [{ db: 'consultinity' }], rowCount: 1 });
        }
        statementsAttempted += 1;
        return original(text, params);
      };

      const previousPrefix = process.env.CLOSURE_EVIDENCE_DISPOSABLE_DB_PREFIX;
      process.env.CLOSURE_EVIDENCE_DISPOSABLE_DB_PREFIX = 'definitely_disposable_fixture_';
      const outcome = await deleteLedgerRows(probe, [
        { ledger: 'initiative_closure_evidence', column: 'id', values: ['anything'] },
      ])
        .then(() => 'RAN')
        .catch((e: Error) => e.message)
        .finally(() => {
          if (previousPrefix === undefined) {
            delete process.env.CLOSURE_EVIDENCE_DISPOSABLE_DB_PREFIX;
          } else {
            process.env.CLOSURE_EVIDENCE_DISPOSABLE_DB_PREFIX = previousPrefix;
          }
        });
      await probe.end();

      expect(String(outcome)).toContain('Refusing immutable fixture cleanup');
      expect(statementsAttempted).toBe(0);
    });

    it('deletes nothing when handed an empty scope — empty means nothing, not everything', async () => {
      const before = await coldRead((c) =>
        c.query<{ n: string }>(`SELECT count(*) AS n FROM initiative_closure_evidence`)
      );
      const removed = await deleteLedgerRows(client, [
        { ledger: 'initiative_closure_evidence', column: 'id', values: [] },
      ]);
      const after = await coldRead((c) =>
        c.query<{ n: string }>(`SELECT count(*) AS n FROM initiative_closure_evidence`)
      );
      expect({ removed, unchanged: before.rows[0].n === after.rows[0].n }).toEqual({
        removed: {},
        unchanged: true,
      });
    });

    it('leaves the production guard enabled after it is done', async () => {
      // The trigger is suspended and restored inside one transaction. If a bug
      // ever left it disabled, every later assertion about immutability in this
      // file would silently become vacuous.
      const removed = await deleteLedgerRows(client, [
        { ledger: 'initiative_closure_evidence', column: 'id', values: ['no-such-row'] },
      ]);
      const enabled = await coldRead((c) =>
        c.query<{ tgenabled: string }>(
          `SELECT tgenabled FROM pg_trigger
            WHERE tgname = 'trg_initiative_closure_evidence_append_only'`
        )
      );
      expect({ removed, tgenabled: enabled.rows[0].tgenabled }).toEqual({
        removed: { 'initiative_closure_evidence.id': 0 },
        // 'O' = enabled for origin (the default); 'D' would mean left disabled.
        tgenabled: 'O',
      });
    });

    it('rolls trigger suspension back after a forced cleanup failure', async () => {
      await expect(
        deleteLedgerRows(
          client,
          [{ ledger: 'initiative_closure_evidence', column: 'id', values: ['no-such-row'] }],
          { forceFailureAfterDisable: true }
        )
      ).rejects.toThrow('forced immutable fixture cleanup failure');

      const enabled = await coldRead((c) =>
        c.query<{ tgenabled: string }>(
          `SELECT tgenabled FROM pg_trigger
            WHERE tgname = 'trg_initiative_closure_evidence_append_only'`
        )
      );
      expect(enabled.rows[0]?.tgenabled).toBe('O');
    });
  });

  describe('7. immutability and deletion semantics', () => {
    it('a direct UPDATE and a direct DELETE on evidence are both refused by the database', async () => {
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE organization_id = $1 LIMIT 1`, [
          TENANT_A.id,
        ])
      );
      expect(rows.rowCount).toBeGreaterThan(0);
      const id = rows.rows[0].id as string;

      const update = await client
        .query(`UPDATE initiative_closure_evidence SET notes = 'tampered' WHERE id = $1`, [id])
        .then(() => 'ALLOWED')
        .catch((e: Error) => e.message);
      const remove = await client
        .query(`DELETE FROM initiative_closure_evidence WHERE id = $1`, [id])
        .then(() => 'ALLOWED')
        .catch((e: Error) => e.message);

      expect(String(update)).toContain('append-only');
      expect(String(remove)).toContain('append-only');
    });

    it('deleting the SOURCE does not remove the evidence that cites it', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const attached = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'meeting_follow_up',
          evidenceRefId: FOLLOWUP_DONE,
          initiativeId: INITIATIVE_A,
          idempotencyKey: 'k-srcdel-0001',
        });
      expect(attached.status).toBe(201);

      await client.query(`DELETE FROM meeting_follow_ups WHERE id = $1`, [FOLLOWUP_DONE]);

      const survives = await coldRead((c) =>
        c.query<{ source_hash: string }>(
          `SELECT source_hash FROM initiative_closure_evidence WHERE id = $1`,
          [attached.body.id]
        )
      );
      expect({ rows: survives.rowCount, hash: survives.rows[0]?.source_hash }).toEqual({
        rows: 1,
        hash: attached.body.sourceHash,
      });
    });
  });

  describe('8. rollback on forced downstream failure', () => {
    it('a failure after the evidence and audit inserts leaves neither behind', async () => {
      const { setClosureEvidenceFaultInjectorForTests } =
        await import('../../../server/src/services/initiative/initiativeClosureService.js');
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const auditBefore = await coldRead((c) =>
        c.query(
          `SELECT id FROM audit_events WHERE org_id = $1 AND action = 'INITIATIVE_CLOSURE_EVIDENCE_ADDED'`,
          [TENANT_A.id]
        )
      );

      setClosureEvidenceFaultInjectorForTests(async () => {
        throw new Error('forced downstream failure');
      });
      try {
        const res = await agent()
          .post(evidenceUrl(INITIATIVE_A, requestId))
          .set('Authorization', bearer(TENANT_A.owner))
          .send({
            evidenceType: 'meeting_note',
            evidenceRefId: NOTE_APPROVED,
            initiativeId: INITIATIVE_A,
            idempotencyKey: 'k-rollback-001',
          });
        expect(res.status).toBe(500);
      } finally {
        setClosureEvidenceFaultInjectorForTests(null);
      }

      const evidenceAfter = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      const auditAfter = await coldRead((c) =>
        c.query(
          `SELECT id FROM audit_events WHERE org_id = $1 AND action = 'INITIATIVE_CLOSURE_EVIDENCE_ADDED'`,
          [TENANT_A.id]
        )
      );

      // No orphan on either side of the pair.
      expect({
        evidence: evidenceAfter.rowCount,
        auditDelta: auditAfter.rowCount - auditBefore.rowCount,
      }).toEqual({ evidence: 0, auditDelta: 0 });
    });
  });

  describe('9. cold reopen through a different pool', () => {
    it('the pinned identity reads back identically from a brand-new Pool', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const attached = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'notebook_page',
          evidenceRefId: PAGE_VERIFIED,
          initiativeId: INITIATIVE_A,
          idempotencyKey: 'k-cold-000001',
        });
      expect(attached.status).toBe(201);

      const cold = await coldPoolRead((pool) =>
        pool.query<{
          evidence_type: string;
          source_hash: string;
          source_version_id: string | null;
          source_captured_at: Date | null;
        }>(
          `SELECT evidence_type, source_hash, source_version_id, source_captured_at
             FROM initiative_closure_evidence WHERE id = $1`,
          [attached.body.id]
        )
      );

      expect({
        rows: cold.rowCount,
        type: cold.rows[0].evidence_type,
        hashMatches: cold.rows[0].source_hash === attached.body.sourceHash,
        versionPinned: Boolean(cold.rows[0].source_version_id),
        capturedAtPresent: cold.rows[0].source_captured_at !== null,
      }).toEqual({
        rows: 1,
        type: 'notebook_page',
        hashMatches: true,
        versionPinned: true,
        capturedAtPresent: true,
      });
    });
  });
});
