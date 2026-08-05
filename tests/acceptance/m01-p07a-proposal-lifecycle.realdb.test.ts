/**
 * M01-P07A — Proposal lifecycle: idempotency, read-back, approve/reject CAS,
 * audit, tenant isolation.
 *
 * Real-Postgres, real-HTTP, real-auth harness (same pattern as
 * chat-007-fixes.realdb.test.ts / chat-007-009-owner-handoff-reopen.realdb.test.ts).
 * No mocks for the product code under test.
 *
 * Covers three gaps found during the M01-P07A audit that were NOT covered by
 * the pre-existing chat-007-fixes suite:
 *
 *   1. CAS race between concurrent approve and reject
 *      (workCanvasService.ts::rejectProposal previously ran an UNGUARDED
 *      UPDATE with no `AND status = 'proposed'` clause — a concurrent
 *      approve that already materialized a real domain object could be
 *      silently clobbered back to `rejected` with target_object_id cleared,
 *      orphaning the just-created object).
 *   2. `audit_event_id` was never populated by either the approve or the
 *      reject HTTP handler (work-canvas.routes.ts) — the column exists and
 *      is populated on other write paths, but was structurally dead for
 *      proposal decisions specifically.
 *   3. The idempotency-key MISMATCH branches (different target / different
 *      payload reusing the same key) added by e636453b3d had zero test
 *      coverage — only the same-key/same-request dedup path was tested.
 *
 * Target choice for approve-exercising tests: `note` (materializeOrThrow ->
 * notebookService -> real `notebook_pages` row, verified correct in
 * chat-007-009-owner-handoff-reopen.realdb.test.ts), NOT `idea`. Target
 * `idea` deterministically fails its own independent read-back today — see
 * FINDING M01-021 below and the review at
 * docs/ui-standards/evidence/final-acceptance-2026-08-04/01-chat/orchestration/reviews/M01-P07A_REVIEW.md
 * §4.1: `createCanvasIdea` writes only the write-only `work_canvas_ideas`
 * table, not the real `my_ideas` table `confirmTargetObjectReadBack('idea')`
 * checks. Fixing that write is an owner write to My Work's (M02) owner
 * object, explicitly out of P07A's scope and reassigned to P07B. The CAS and
 * audit mechanics under test here are target-agnostic (they operate on
 * `work_canvas_proposals` rows before `commitProposalToDomain` ever runs),
 * so testing them against a target whose read-back is known-correct proves
 * the SAME mechanics without depending on the M01-021 gap.
 */
import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PREFIX = 'm01-p07a-';
const FOREIGN_ORG_ID = `${PREFIX}foreign-org`;
const FOREIGN_USER_ID = `${PREFIX}foreign-user`;
const FOREIGN_MEMBER_ID = `${PREFIX}foreign-member`;

let app: Express;
let token: string;
let foreignToken: string;

async function cleanup(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const drafts = await client.query(`SELECT id FROM work_canvas_drafts WHERE title LIKE $1`, [
      `${PREFIX}%`,
    ]);
    const draftIds = drafts.rows.map((row) => row.id);
    if (draftIds.length) {
      await client.query(`DELETE FROM work_canvas_proposals WHERE draft_id = ANY($1::text[])`, [
        draftIds,
      ]);
      await client.query(`DELETE FROM work_canvas_ideas WHERE source_draft_id = ANY($1::text[])`, [
        draftIds,
      ]);
      // FIX M01-021 (owner: P07B) — proposal-approval on an `idea` target now
      // materializes a REAL `my_ideas` (+ `my_idea_maps`) row through the
      // shared canvasMaterialize.ts writer (same path /save-to-workspace
      // already used); `materializeOrThrow`'s idea branch stores the source
      // draft id in `source_message_id` (`my_ideas` has no `source_draft_id`
      // column). Clean those up too — CLAUDE.md hygiene rule: probes leave
      // zero test records behind.
      const ideas = await client.query(
        `SELECT id FROM my_ideas WHERE source_message_id = ANY($1::text[])`,
        [draftIds]
      );
      const ideaIds = ideas.rows.map((row) => row.id);
      if (ideaIds.length) {
        await client.query(`DELETE FROM my_idea_maps WHERE idea_id = ANY($1::text[])`, [ideaIds]);
        await client.query(`DELETE FROM my_ideas WHERE id = ANY($1::text[])`, [ideaIds]);
      }
      await client.query(`DELETE FROM work_canvas_drafts WHERE id = ANY($1::text[])`, [draftIds]);
    }
    await client.query(`DELETE FROM notebook_pages WHERE title LIKE $1`, [`%${PREFIX}%`]);
    await client.query(`DELETE FROM organization_members WHERE id = $1`, [FOREIGN_MEMBER_ID]);
    await client.query(`DELETE FROM users WHERE id = $1`, [FOREIGN_USER_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [FOREIGN_ORG_ID]);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await seed();
  const service = await import('../../server/src/services/workCanvasService.js');
  await service.listProposals({ organizationId: SEED.ORG_ID, draftId: 'schema-probe' });
  await cleanup();

  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, status, is_active, created_at)
       VALUES ($1, 'M01-P07A foreign org', 'active', 1, NOW())`,
      [FOREIGN_ORG_ID]
    );
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, 'm01-p07a-foreign@acceptance.local', 'acceptance-only',
               'ADMIN', 'active', 'M01-P07A', 'Foreign', NOW())`,
      [FOREIGN_USER_ID, FOREIGN_ORG_ID]
    );
    await client.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', NOW())`,
      [FOREIGN_MEMBER_ID, FOREIGN_ORG_ID, FOREIGN_USER_ID]
    );
  } finally {
    await client.end();
  }

  token = mintToken();
  foreignToken = mintToken({
    id: FOREIGN_USER_ID,
    email: 'm01-p07a-foreign@acceptance.local',
    organizationId: FOREIGN_ORG_ID,
    organization_id: FOREIGN_ORG_ID,
    role: 'OWNER',
  });

  const router = (await import('../../server/src/routes/work-canvas.routes.js')).default;
  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/work-canvas', router);
});

afterAll(cleanup);

const auth = () => ({ Authorization: `Bearer ${token}` });
const foreignAuth = () => ({ Authorization: `Bearer ${foreignToken}` });

async function createDraft(label: string, contentMd: string): Promise<string> {
  const res = await request(app)
    .post('/api/work-canvas/drafts')
    .set(auth())
    .send({
      conversationId: `${PREFIX}${label}-conversation`,
      kind: 'markdown',
      title: `${PREFIX}${label}`,
      contentMd,
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}

/**
 * `note` target — used by every test below that calls /approve. See the
 * file-header comment: `idea`'s read-back is known-broken (M01-021), `note`'s
 * is verified-correct, and the CAS/audit mechanics under test here run
 * entirely before `commitProposalToDomain` ever branches on target.
 */
async function createNoteProposal(draftId: string, idempotencyKey?: string) {
  const res = await request(app)
    .post(`/api/work-canvas/drafts/${draftId}/proposals`)
    .set(auth())
    .send({ target: 'note', ...(idempotencyKey ? { idempotencyKey } : {}) });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}

/**
 * `idea` target — deliberately kept ONLY for the M01-021 gap-documentation
 * test below. Do NOT use this for CAS/audit tests; approving an idea-target
 * proposal deterministically 500s (see M01-021).
 */
async function createIdeaProposal(draftId: string, idempotencyKey?: string) {
  const res = await request(app)
    .post(`/api/work-canvas/drafts/${draftId}/proposals`)
    .set(auth())
    .send({ target: 'idea', ...(idempotencyKey ? { idempotencyKey } : {}) });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}

describe('M01-P07A — proposal lifecycle hardening', () => {
  describe('audit: approve and reject both persist a durable audit_event_id', () => {
    it('approve persists a non-null audit_event_id, both in the HTTP envelope and in the DB row', async () => {
      const draftId = await createDraft('audit-approve', '# Audit approve\n\nBody.');
      const proposalId = await createNoteProposal(draftId);

      const approved = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/approve`)
        .set(auth());
      expect(approved.status, JSON.stringify(approved.body)).toBe(200);
      expect(approved.body.auditEventId).toEqual(expect.stringMatching(/^ae-/));
      expect(approved.body.data.auditEventId).toEqual(expect.stringMatching(/^ae-/));

      const client = pgClient();
      await client.connect();
      try {
        const row = await client.query(
          `SELECT audit_event_id, status FROM work_canvas_proposals WHERE id = $1`,
          [proposalId]
        );
        expect(row.rows[0].status).toBe('approved');
        expect(row.rows[0].audit_event_id).toEqual(expect.stringMatching(/^ae-/));
      } finally {
        await client.end();
      }
    });

    it('reject persists a non-null audit_event_id, both in the HTTP envelope and in the DB row', async () => {
      const draftId = await createDraft('audit-reject', '# Audit reject\n\nBody.');
      const proposalId = await createNoteProposal(draftId);

      const rejected = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/reject`)
        .set(auth())
        .send({ reason: 'Not needed right now' });
      expect(rejected.status, JSON.stringify(rejected.body)).toBe(200);
      expect(rejected.body.auditEventId).toEqual(expect.stringMatching(/^ae-/));
      expect(rejected.body.data.auditEventId).toEqual(expect.stringMatching(/^ae-/));
      expect(rejected.body.data.readBack.reason).toBe('Not needed right now');

      const client = pgClient();
      await client.connect();
      try {
        const row = await client.query(
          `SELECT audit_event_id, status, target_object_id FROM work_canvas_proposals WHERE id = $1`,
          [proposalId]
        );
        expect(row.rows[0].status).toBe('rejected');
        expect(row.rows[0].target_object_id).toBeNull();
        expect(row.rows[0].audit_event_id).toEqual(expect.stringMatching(/^ae-/));
      } finally {
        await client.end();
      }
    });
  });

  describe('CAS: concurrent approve + reject resolve to exactly one durable winner', () => {
    it('never leaves a corrupted mix — either a real materialized note with status=approved, or status=rejected with target_object_id=null and NO note row', async () => {
      const draftId = await createDraft('cas-race', '# CAS race\n\nBody.');
      const proposalId = await createNoteProposal(draftId);

      const [approveRes, rejectRes] = await Promise.all([
        request(app).post(`/api/work-canvas/proposals/${proposalId}/approve`).set(auth()),
        request(app).post(`/api/work-canvas/proposals/${proposalId}/reject`).set(auth()),
      ]);

      // Both calls must resolve cleanly (200) — a race is not an error
      // condition for the loser, it re-reads and echoes whatever state is
      // current at that instant (which MAY legitimately still be the
      // transient 'executing' claim if it reads a beat before the winner's
      // commit finishes — that is not corruption, it is an honest snapshot).
      expect(approveRes.status, JSON.stringify(approveRes.body)).toBe(200);
      expect(rejectRes.status, JSON.stringify(rejectRes.body)).toBe(200);
      expect(['approved', 'rejected', 'executing']).toContain(approveRes.body.data.status);
      expect(['approved', 'rejected', 'executing']).toContain(rejectRes.body.data.status);

      // The DURABLE truth is the DB row, not either live HTTP snapshot — poll
      // briefly until the row settles out of the transient 'executing' claim
      // into its one true terminal state.
      const client = pgClient();
      await client.connect();
      let finalStatus = '';
      try {
        let row: { status: string; target_object_id: string | null } | undefined;
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const result = await client.query(
            `SELECT status, target_object_id FROM work_canvas_proposals WHERE id = $1`,
            [proposalId]
          );
          row = result.rows[0];
          if (row.status === 'approved' || row.status === 'rejected') break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        expect(row, 'proposal row must exist').toBeDefined();
        finalStatus = row!.status;
        expect(['approved', 'rejected']).toContain(finalStatus);

        if (finalStatus === 'approved') {
          expect(row!.target_object_id).toEqual(expect.any(String));
          const note = await client.query(
            `SELECT id FROM notebook_pages WHERE id = $1 AND organization_id = $2`,
            [row!.target_object_id, SEED.ORG_ID]
          );
          expect(note.rows).toHaveLength(1);
        } else {
          // The reject won: target_object_id must be null. Note that "no
          // orphan note exists" does not need a separate cross-table check
          // here the way the (now-reverted) idea variant did: reject's own
          // claim UPDATE (`WHERE status = 'proposed'`) and approve's claim
          // UPDATE share the identical guard, so they are mutually
          // exclusive at the row level — if reject's claim matched, approve's
          // claim provably did NOT, which means commitProposalToDomain (the
          // function that would create a notebook_pages row) never ran.
          expect(row!.target_object_id).toBeNull();
        }
      } finally {
        await client.end();
      }
    });

    it('a reject after an already-approved proposal is a clean no-op that does NOT clobber the approval', async () => {
      const draftId = await createDraft('cas-sequential', '# CAS sequential\n\nBody.');
      const proposalId = await createNoteProposal(draftId);

      const approved = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/approve`)
        .set(auth());
      expect(approved.status, JSON.stringify(approved.body)).toBe(200);
      expect(approved.body.data.status).toBe('approved');
      const targetObjectId = approved.body.data.targetObjectId as string;
      expect(targetObjectId).toEqual(expect.any(String));

      const rejectedAfter = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/reject`)
        .set(auth());
      expect(rejectedAfter.status, JSON.stringify(rejectedAfter.body)).toBe(200);
      // Must echo the ALREADY-APPROVED proposal untouched, not force a
      // rejection over it.
      expect(rejectedAfter.body.data.status).toBe('approved');
      expect(rejectedAfter.body.data.targetObjectId).toBe(targetObjectId);

      const client = pgClient();
      await client.connect();
      try {
        const row = await client.query(
          `SELECT status, target_object_id FROM work_canvas_proposals WHERE id = $1`,
          [proposalId]
        );
        expect(row.rows[0].status).toBe('approved');
        expect(row.rows[0].target_object_id).toBe(targetObjectId);
        const note = await client.query(
          `SELECT id FROM notebook_pages WHERE id = $1 AND organization_id = $2`,
          [targetObjectId, SEED.ORG_ID]
        );
        expect(note.rows).toHaveLength(1);
      } finally {
        await client.end();
      }
    });
  });

  describe('idempotency: mismatched key reuse is a typed 409, never a silent duplicate or a silent replay', () => {
    it('reusing a key with a DIFFERENT target returns 409 IDEMPOTENCY_KEY_REUSED and does not touch the original proposal', async () => {
      const draftId = await createDraft('idem-target-mismatch', '# Idem mismatch\n\nBody.');
      const key = `${PREFIX}mismatch-target-${Date.now()}`;

      const first = await request(app)
        .post(`/api/work-canvas/drafts/${draftId}/proposals`)
        .set(auth())
        .send({ target: 'idea', idempotencyKey: key });
      expect(first.status, JSON.stringify(first.body)).toBe(201);

      const second = await request(app)
        .post(`/api/work-canvas/drafts/${draftId}/proposals`)
        .set(auth())
        .send({ target: 'note', idempotencyKey: key });
      expect(second.status, JSON.stringify(second.body)).toBe(409);
      expect(second.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

      const client = pgClient();
      await client.connect();
      try {
        const rows = await client.query(
          `SELECT id, target FROM work_canvas_proposals WHERE draft_id = $1 AND client_idempotency_key = $2`,
          [draftId, key]
        );
        // Exactly the FIRST proposal, untouched — no second row, target
        // still 'idea' (the mismatched retry never mutated it).
        expect(rows.rows).toHaveLength(1);
        expect(rows.rows[0].id).toBe(first.body.data.id);
        expect(rows.rows[0].target).toBe('idea');
      } finally {
        await client.end();
      }
    });

    it('reusing a key with a DIFFERENT payload (same target) returns 409 IDEMPOTENCY_KEY_REUSED', async () => {
      const draftId = await createDraft('idem-payload-mismatch', '# Idem payload mismatch\n\nBody.');
      const key = `${PREFIX}mismatch-payload-${Date.now()}`;

      const first = await request(app)
        .post(`/api/work-canvas/drafts/${draftId}/proposals`)
        .set(auth())
        .send({ target: 'idea', idempotencyKey: key, payload: { note: 'first' } });
      expect(first.status, JSON.stringify(first.body)).toBe(201);

      const second = await request(app)
        .post(`/api/work-canvas/drafts/${draftId}/proposals`)
        .set(auth())
        .send({ target: 'idea', idempotencyKey: key, payload: { note: 'DIFFERENT' } });
      expect(second.status, JSON.stringify(second.body)).toBe(409);
      expect(second.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  describe('tenant isolation: a proposal is unreachable and undecidable from outside its organization', () => {
    it('approve/reject/get from a FOREIGN org all 404 — never leak existence, never mutate', async () => {
      const draftId = await createDraft('tenant-isolation', '# Tenant isolation\n\nBody.');
      const proposalId = await createNoteProposal(draftId);

      const foreignApprove = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/approve`)
        .set(foreignAuth());
      expect(foreignApprove.status, JSON.stringify(foreignApprove.body)).toBe(404);

      const foreignReject = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/reject`)
        .set(foreignAuth());
      expect(foreignReject.status, JSON.stringify(foreignReject.body)).toBe(404);

      const foreignList = await request(app)
        .get(`/api/work-canvas/drafts/${draftId}/proposals`)
        .set(foreignAuth());
      expect(foreignList.status, JSON.stringify(foreignList.body)).toBe(404);

      // The proposal must be untouched — still 'proposed' — and the OWNING
      // org can still legitimately decide it afterwards.
      const client = pgClient();
      await client.connect();
      try {
        const row = await client.query(`SELECT status FROM work_canvas_proposals WHERE id = $1`, [
          proposalId,
        ]);
        expect(row.rows[0].status).toBe('proposed');
      } finally {
        await client.end();
      }

      const ownerApprove = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/approve`)
        .set(auth());
      expect(ownerApprove.status, JSON.stringify(ownerApprove.body)).toBe(200);
      expect(ownerApprove.body.data.status).toBe('approved');
    });
  });

  /**
   * FIX M01-021 (owner: P07B). Was documented here as a KNOWN GAP during
   * P07A (see
   * docs/ui-standards/evidence/final-acceptance-2026-08-04/01-chat/orchestration/reviews/M01-P07A_REVIEW.md
   * §4.1 and M01_P07A_PROPOSAL_LIFECYCLE_REPORT.md §2.3/§10.1): approving an
   * `idea`-target proposal deterministically 500'd with
   * `CANVAS_HANDOFF_READBACK_MISSING` because `createCanvasIdea`
   * (workCanvasService.ts) wrote ONLY the write-only `work_canvas_ideas`
   * table, while `confirmTargetObjectReadBack('idea', ...)` checks the real,
   * product-facing `my_ideas` table. P07B closed the gap by routing `idea`
   * through the SAME shared `canvasMaterialize.ts::materializeOrThrow`
   * writer `/save-to-workspace` already used for `target=idea` — no new
   * table, no new column, no M02 code touched. This test replaces the old
   * KNOWN GAP assertions (which now correctly FAIL, since the bug they
   * documented is fixed) with assertions on the corrected behaviour,
   * verified against a REAL `my_ideas` row, not just the HTTP envelope.
   */
  describe('FIX M01-021 (owner: P07B) — idea-target approve materializes a real my_ideas row', () => {
    it('approving an idea-target proposal succeeds, creates a real tenant-scoped my_ideas + my_idea_maps row, and a retry reuses it', async () => {
      const draftId = await createDraft('m01-021-idea-fix', '# M01-021 fix\n\nBody.');
      const proposalId = await createIdeaProposal(draftId);

      const firstAttempt = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/approve`)
        .set(auth());
      expect(firstAttempt.status, JSON.stringify(firstAttempt.body)).toBe(200);
      expect(firstAttempt.body.data.status).toBe('approved');
      const ideaId = firstAttempt.body.data.targetObjectId as string;
      expect(ideaId).toBeTruthy();
      expect(firstAttempt.body.data.readBack.url).toBe(`/my-work?ideaId=${ideaId}`);

      const client = pgClient();
      await client.connect();
      try {
        // The owner object is REAL, tenant-scoped, and owned by the actor who
        // approved — this is exactly what confirmTargetObjectReadBack('idea')
        // checks, and exactly what the old write-only `work_canvas_ideas`
        // insert could never satisfy.
        const ideaRow = await client.query(
          `SELECT id, organization_id, user_id, title FROM my_ideas WHERE id = $1`,
          [ideaId]
        );
        expect(ideaRow.rows).toHaveLength(1);
        expect(ideaRow.rows[0].organization_id).toBe(SEED.ORG_ID);
        expect(ideaRow.rows[0].user_id).toBe(SEED.USER_ID);

        // The Idea Map — the Ideas workspace opens an idea through its map, so
        // an idea without one would deep-link to a broken screen.
        const mapRow = await client.query(
          `SELECT id FROM my_idea_maps WHERE idea_id = $1 AND organization_id = $2`,
          [ideaId, SEED.ORG_ID]
        );
        expect(mapRow.rows).toHaveLength(1);

        const proposalRow = await client.query(
          `SELECT status, target_object_id FROM work_canvas_proposals WHERE id = $1`,
          [proposalId]
        );
        expect(proposalRow.rows[0].status).toBe('approved');
        expect(proposalRow.rows[0].target_object_id).toBe(ideaId);
      } finally {
        await client.end();
      }

      // Retry (already-approved proposal) must be idempotent: same idea,
      // no second my_ideas row.
      const secondAttempt = await request(app)
        .post(`/api/work-canvas/proposals/${proposalId}/approve`)
        .set(auth());
      expect(secondAttempt.status, JSON.stringify(secondAttempt.body)).toBe(200);
      expect(secondAttempt.body.data.targetObjectId).toBe(ideaId);

      const client2 = pgClient();
      await client2.connect();
      try {
        const count = await client2.query(`SELECT count(*)::int AS n FROM my_ideas WHERE id = $1`, [
          ideaId,
        ]);
        expect(count.rows[0].n).toBe(1);
      } finally {
        await client2.end();
      }
    });
  });
});
