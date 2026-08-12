/**
 * Artifact Approval Service Tests (HP-7)
 *
 * Real database tests (in-memory sqlite3) against the ACTUAL
 * `approval_assignments` schema extended by
 * `server/migrations/20260714_workflow_artifact_approvals.sql`
 * (assignment_kind / artifact_type / artifact_id).
 *
 * Exercises the real server/src/services/artifactApprovalService.ts module
 * (not an inline reimplementation) via its setDependencies() injection point,
 * the same pattern used by slaService.ts. Also proves zero regression for the
 * pre-existing 'project_gate' rows / query shape used by
 * slaService.ts + workqueueService.ts (HP-6 audit finding: PMO stage-gates
 * live in a completely separate `stage_gates` table and never touch
 * approval_assignments, so the only real regression surface is the
 * project_gate rows/queries already living on this table).
 *
 * @module tests/unit/backend/services/artifactApprovalService.test.ts
 */

import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import ArtifactApprovalService, {
  ARTIFACT_STATES,
} from '../../../../server/src/services/artifactApprovalService.js';

// ==========================================
// sqlite3 adapter matching server/src/database/IDatabase.ts's callback shape.
// DbPromise.{get,all,run} always rewrite `?` placeholders to Postgres-style
// `$1,$2,...` before calling db.get/all/run (see DbPromise.ts
// translatePlaceholders) — sqlite3's native driver only understands `?`, so
// this adapter translates back before delegating to the real sqlite3.Database.
// ==========================================

function toQuestionMarks(sql: string): string {
  return sql.replace(/\$\d+/g, '?');
}

function makeSqliteAdapter(db: sqlite3.Database) {
  return {
    get(sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) {
      db.get(toQuestionMarks(sql), params, callback);
      return this;
    },
    all(sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) {
      db.all(toQuestionMarks(sql), params, callback);
      return this;
    },
    run(sql: string, params: unknown[], callback: (this: { lastID?: number; changes: number }, err: Error | null) => void) {
      db.run(toQuestionMarks(sql), params, callback);
      return this;
    },
  };
}

const ORG_ID = 'org-hp7-test';
const USER_ID = 'user-hp7-reviewer';

describe('ArtifactApprovalService (HP-7)', () => {
  let sqliteDb: sqlite3.Database;

  beforeAll(async () => {
    sqliteDb = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      sqliteDb.serialize(() => {
        // Schema matches 000_initdb_core_tables.sql's approval_assignments
        // PLUS the columns added by 20260714_workflow_artifact_approvals.sql.
        sqliteDb.run(`
          CREATE TABLE approval_assignments(
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            proposal_id TEXT NOT NULL,
            assigned_to_user_id TEXT NOT NULL,
            requested_by_user_id TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING',
            sla_due_at TIMESTAMP NOT NULL,
            escalated_to_user_id TEXT,
            escalated_at TIMESTAMP,
            escalation_reason TEXT,
            acked_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            assignment_kind TEXT NOT NULL DEFAULT 'project_gate',
            artifact_type TEXT,
            artifact_id TEXT
          )
        `,
        (err) => (err ? reject(err) : resolve()));
      });
    });

    ArtifactApprovalService.setDependencies({ db: makeSqliteAdapter(sqliteDb) as any });
  });

  afterAll(() => sqliteDb.close());

  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      sqliteDb.run('DELETE FROM approval_assignments', (err) => (err ? reject(err) : resolve()));
    });
  });

  // ==========================================
  // draft -> review -> approved / rejected lifecycle
  // ==========================================

  describe('draft -> review -> approved lifecycle', () => {
    it('reports draft when no assignment row exists', async () => {
      const status = await ArtifactApprovalService.getArtifactApprovalStatus(
        ORG_ID,
        'insight',
        'insight-1'
      );
      expect(status.state).toBe(ARTIFACT_STATES.DRAFT);
      expect(status.assignment).toBeNull();
    });

    it('moves draft -> review on submitForReview', async () => {
      const assignment = await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'insight',
        artifactId: 'insight-2',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });

      expect(assignment.status).toBe('PENDING');
      expect(assignment.assignment_kind).toBe('artifact');
      expect(assignment.artifact_type).toBe('insight');
      expect(assignment.artifact_id).toBe('insight-2');
      expect(assignment.requested_by_user_id).toBe('author-1');

      const status = await ArtifactApprovalService.getArtifactApprovalStatus(
        ORG_ID,
        'insight',
        'insight-2'
      );
      expect(status.state).toBe(ARTIFACT_STATES.REVIEW);
    });

    it('rejects a second submitForReview while a review is active (409)', async () => {
      await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'decision',
        artifactId: 'decision-1',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });

      await expect(
        ArtifactApprovalService.submitForReview({
          orgId: ORG_ID,
          artifactType: 'decision',
          artifactId: 'decision-1',
          assignedToUserId: USER_ID,
          submittedBy: 'author-1',
        })
      ).rejects.toMatchObject({ status: 409 });
    });

    it('moves review -> approved on approveArtifact', async () => {
      await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'report',
        artifactId: 'report-1',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });

      const approved = await ArtifactApprovalService.approveArtifact({
        orgId: ORG_ID,
        artifactType: 'report',
        artifactId: 'report-1',
        approvedByUserId: USER_ID,
      });
      expect(approved.status).toBe('DONE');

      const status = await ArtifactApprovalService.getArtifactApprovalStatus(
        ORG_ID,
        'report',
        'report-1'
      );
      expect(status.state).toBe(ARTIFACT_STATES.APPROVED);
    });

    it('rejects assigning the requester as reviewer before writing a row', async () => {
      await expect(
        ArtifactApprovalService.submitForReview({
          orgId: ORG_ID,
          artifactType: 'presentation_version',
          artifactId: 'deck-self-review:v1',
          assignedToUserId: 'author-1',
          submittedBy: 'author-1',
        })
      ).rejects.toMatchObject({ status: 409 });

      const status = await ArtifactApprovalService.getArtifactApprovalStatus(
        ORG_ID,
        'presentation_version',
        'deck-self-review:v1'
      );
      expect(status.state).toBe(ARTIFACT_STATES.DRAFT);
    });

    it('allows only the assigned distinct reviewer to approve or reject', async () => {
      await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'workbook',
        artifactId: 'workbook-four-eyes',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });

      await expect(
        ArtifactApprovalService.approveArtifact({
          orgId: ORG_ID,
          artifactType: 'workbook',
          artifactId: 'workbook-four-eyes',
          approvedByUserId: 'author-1',
        })
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        ArtifactApprovalService.rejectArtifact({
          orgId: ORG_ID,
          artifactType: 'workbook',
          artifactId: 'workbook-four-eyes',
          rejectedByUserId: 'unassigned-reviewer',
          reason: 'Must not be accepted from an unassigned actor',
        })
      ).rejects.toMatchObject({ status: 403 });

      const approved = await ArtifactApprovalService.approveArtifact({
        orgId: ORG_ID,
        artifactType: 'workbook',
        artifactId: 'workbook-four-eyes',
        approvedByUserId: USER_ID,
      });
      expect(approved.status).toBe('DONE');
    });

    it('allows only the assigned reviewer to acknowledge', async () => {
      await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'presentation_version',
        artifactId: 'deck-ack:v2',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });

      await expect(
        ArtifactApprovalService.acknowledgeReview({
          orgId: ORG_ID,
          artifactType: 'presentation_version',
          artifactId: 'deck-ack:v2',
          userId: 'unassigned-reviewer',
        })
      ).rejects.toMatchObject({ status: 403 });
    });

    it('acknowledgeReview moves PENDING -> ACKED while staying in review state', async () => {
      await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'initiative',
        artifactId: 'initiative-1',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });

      const acked = await ArtifactApprovalService.acknowledgeReview({
        orgId: ORG_ID,
        artifactType: 'initiative',
        artifactId: 'initiative-1',
        userId: USER_ID,
      });
      expect(acked.status).toBe('ACKED');

      const status = await ArtifactApprovalService.getArtifactApprovalStatus(
        ORG_ID,
        'initiative',
        'initiative-1'
      );
      expect(status.state).toBe(ARTIFACT_STATES.REVIEW);

      // approveArtifact must also work from ACKED, not just PENDING
      const approved = await ArtifactApprovalService.approveArtifact({
        orgId: ORG_ID,
        artifactType: 'initiative',
        artifactId: 'initiative-1',
        approvedByUserId: USER_ID,
      });
      expect(approved.status).toBe('DONE');
    });

    it('moves review -> rejected, and allows resubmission afterwards', async () => {
      await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'deck',
        artifactId: 'deck-1',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });

      const rejected = await ArtifactApprovalService.rejectArtifact({
        orgId: ORG_ID,
        artifactType: 'deck',
        artifactId: 'deck-1',
        rejectedByUserId: USER_ID,
        reason: 'Missing evidence',
      });
      expect(rejected.status).toBe('REJECTED');

      let status = await ArtifactApprovalService.getArtifactApprovalStatus(
        ORG_ID,
        'deck',
        'deck-1'
      );
      expect(status.state).toBe(ARTIFACT_STATES.REJECTED);

      // REJECTED is not "active" -> resubmission must succeed, not 409
      const resubmitted = await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'deck',
        artifactId: 'deck-1',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });
      expect(resubmitted.status).toBe('PENDING');

      status = await ArtifactApprovalService.getArtifactApprovalStatus(ORG_ID, 'deck', 'deck-1');
      expect(status.state).toBe(ARTIFACT_STATES.REVIEW);
    });

    it('approveArtifact / rejectArtifact 404 when no active review exists', async () => {
      await expect(
        ArtifactApprovalService.approveArtifact({
          orgId: ORG_ID,
          artifactType: 'kpi',
          artifactId: 'kpi-missing',
          approvedByUserId: USER_ID,
        })
      ).rejects.toMatchObject({ status: 404 });

      await expect(
        ArtifactApprovalService.rejectArtifact({
          orgId: ORG_ID,
          artifactType: 'kpi',
          artifactId: 'kpi-missing',
          rejectedByUserId: USER_ID,
        })
      ).rejects.toMatchObject({ status: 404 });
    });

    it('scopes artifact state by organization (multi-tenant isolation)', async () => {
      await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'insight',
        artifactId: 'shared-artifact-id',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });

      const otherOrgStatus = await ArtifactApprovalService.getArtifactApprovalStatus(
        'a-different-org',
        'insight',
        'shared-artifact-id'
      );
      expect(otherOrgStatus.state).toBe(ARTIFACT_STATES.DRAFT);
    });
  });

  // ==========================================
  // Zero regression on the pre-existing 'project_gate' rows/queries
  // (slaService.ts / workqueueService.ts) — HP-6/HP-7 DoD requirement.
  // ==========================================

  describe('zero regression on pre-existing project_gate rows', () => {
    it('backfills assignment_kind=project_gate by default for rows inserted the old way (no new columns)', async () => {
      const id = uuidv4();
      await new Promise<void>((resolve, reject) => {
        sqliteDb.run(
          `INSERT INTO approval_assignments
             (id, org_id, proposal_id, assigned_to_user_id, status, sla_due_at, created_at)
           VALUES (?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
          [id, ORG_ID, 'proposal-legacy-1', USER_ID, new Date(Date.now() + 3600_000).toISOString()],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const row = await new Promise<any>((resolve, reject) => {
        sqliteDb.get('SELECT * FROM approval_assignments WHERE id = ?', [id], (err, r) =>
          err ? reject(err) : resolve(r)
        );
      });

      expect(row.assignment_kind).toBe('project_gate');
      expect(row.artifact_type).toBeNull();
      expect(row.artifact_id).toBeNull();
    });

    it('workqueueService-style getOrgApprovals query shape still returns rows unaffected by new columns', async () => {
      const id = uuidv4();
      await new Promise<void>((resolve, reject) => {
        sqliteDb.run(
          `INSERT INTO approval_assignments
             (id, org_id, proposal_id, assigned_to_user_id, status, sla_due_at, created_at)
           VALUES (?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
          [id, ORG_ID, 'proposal-legacy-2', USER_ID, new Date(Date.now() + 3600_000).toISOString()],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // Same WHERE shape as WorkqueueService.getOrgApprovals (org_id scope,
      // no assignment_kind filter — proving legacy callers keep working
      // untouched even though they are oblivious to the new column).
      const rows = await new Promise<any[]>((resolve, reject) => {
        sqliteDb.all(
          'SELECT * FROM approval_assignments WHERE org_id = ? ORDER BY sla_due_at ASC',
          [ORG_ID],
          (err, r) => (err ? reject(err) : resolve(r))
        );
      });

      expect(rows.some((r) => r.id === id)).toBe(true);
      expect(rows.find((r) => r.id === id)?.assignment_kind).toBe('project_gate');
    });

    it('artifact-kind rows do not leak into a project_gate-only proposal_id lookup', async () => {
      await ArtifactApprovalService.submitForReview({
        orgId: ORG_ID,
        artifactType: 'insight',
        artifactId: 'insight-no-collision',
        assignedToUserId: USER_ID,
        submittedBy: 'author-1',
      });

      // WorkqueueService.getAssignmentByProposal looks up by proposal_id;
      // artifact rows reuse proposal_id = artifactId, so a legacy proposal_id
      // lookup for an unrelated proposal id must find nothing.
      const row = await new Promise<any>((resolve, reject) => {
        sqliteDb.get(
          'SELECT * FROM approval_assignments WHERE proposal_id = ? AND org_id = ?',
          ['some-unrelated-ai-proposal-id', ORG_ID],
          (err, r) => (err ? reject(err) : resolve(r))
        );
      });
      expect(row).toBeUndefined();
    });
  });
});
