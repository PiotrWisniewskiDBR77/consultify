/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { attachV8Context } from '../../middleware/v8Auth.middleware.js';
import executionBvpRoutes from '../../routes/caseWorkspace/executionBvp.routes.js';
import { consumeNextExecutionSignal } from '../resultsVnext/platform/executionSignalIngress.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)(
  'EXE-BVP-001 mounted producer -> Results ingress (fresh real PostgreSQL)',
  () => {
    const tag = randomUUID();
    const orgA = `exe-bvp-a-${tag}`;
    const orgB = `exe-bvp-b-${tag}`;
    const projectA = `exe-project-a-${tag}`;
    const initiativeA = `exe-initiative-a-${tag}`;
    const caseA = `exe-case-a-${tag}`;
    const artifactA = `exe-artifact-a-${tag}`;
    const submitter = `exe-submitter-${tag}`;
    const approver = `exe-approver-${tag}`;
    let db: Client;
    let app: express.Express;

    function auth(orgId: string, userId: string) {
      return { 'x-test-org-id': orgId, 'x-test-user-id': userId };
    }

    beforeAll(async () => {
      db = new Client({ connectionString: DATABASE_URL });
      await db.connect();
      await db.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`, [orgA, orgB]);
      await db.query(
        `INSERT INTO users(id,organization_id,email,role,status)
       VALUES($1,$2,$3,'ADMIN','active'),($4,$2,$5,'ADMIN','active')`,
        [submitter, orgA, `${submitter}@example.test`, approver, `${approver}@example.test`]
      );
      await db.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'ADMIN','ACTIVE'),($4,$2,$5,'ADMIN','ACTIVE')`,
        [`membership-${submitter}`, orgA, submitter, `membership-${approver}`, approver]
      );
      await db.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$1)`, [
        projectA,
        orgA,
      ]);
      await db.query(
        `INSERT INTO initiatives(id,organization_id,project_id,name) VALUES($1,$2,$3,$1)`,
        [initiativeA, orgA, projectA]
      );
      await db.query(
        `INSERT INTO case_core(case_id,organization_id,project_id,contracted_closure_type,created_by_actor_id,case_name)
       VALUES($1,$2,$3,'DELIVERY_COMPLETED',$4,$1)`,
        [caseA, orgA, projectA, submitter]
      );
      await db.query(
        `INSERT INTO case_workspace_artifact_links
         (link_id,organization_id,project_id,case_id,artifact_type,artifact_id,
          artifact_revision,relation,linked_by_actor_id,linked_at)
       VALUES($1,$2,$3,$4,'document',$5,'sha256:revision-a','DELIVERABLE',$6,now()::text)`,
        [artifactA, orgA, projectA, caseA, `document-${tag}`, submitter]
      );

      app = express();
      app.use(express.json());
      app.use((req: any, _res, next) => {
        req.organizationId = req.get('x-test-org-id');
        req.userId = req.get('x-test-user-id');
        req.userRole = 'ADMIN';
        req.user = { id: req.userId, organizationId: req.organizationId, role: 'ADMIN' };
        next();
      });
      app.use(attachV8Context);
      app.use('/api/v8/case-workspace', executionBvpRoutes);
      app.use(
        (error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
          res
            .status(error?.statusCode || error?.status || 500)
            .json({ code: error?.code || 'ERROR' });
        }
      );
    });

    afterAll(async () => {
      if (db) await db.end();
    });

    it('mounts authenticated tenant scope and delivers one exact immutable Results receipt under replay/concurrency', async () => {
      const crossTenant = await request(app)
        .post('/api/v8/case-workspace/execution-bvp/links')
        .set(auth(orgB, submitter))
        .set('Idempotency-Key', `cross-${tag}`)
        .send({ initiativeId: initiativeA, caseId: caseA, organizationId: orgA });
      expect([403, 404]).toContain(crossTenant.status);

      const linked = await request(app)
        .post('/api/v8/case-workspace/execution-bvp/links')
        .set(auth(orgA, submitter))
        .set('Idempotency-Key', `intake-${tag}`)
        .send({ initiativeId: initiativeA, caseId: caseA, organizationId: orgB })
        .expect(201);
      const linkId = linked.body.data.link_id as string;
      const replay = await request(app)
        .post('/api/v8/case-workspace/execution-bvp/links')
        .set(auth(orgA, submitter))
        .set('Idempotency-Key', `intake-${tag}`)
        .send({ initiativeId: initiativeA, caseId: caseA })
        .expect(201);
      expect(replay.body.data.link_id).toBe(linkId);

      const spine = await request(app)
        .post(`/api/v8/case-workspace/execution-bvp/links/${linkId}/spine`)
        .set(auth(orgA, submitter))
        .send({
          workRef: `case_workspace_run:${tag}`,
          resourceRef: `initiative_resources:${initiativeA}`,
          controlRef: `case_workspace_gateway_evaluations:${tag}`,
          reportRef: `document:report-${tag}@v1`,
          expectedVersion: 1,
        })
        .expect(200);

      const stale = await request(app)
        .post(`/api/v8/case-workspace/execution-bvp/links/${linkId}/spine`)
        .set(auth(orgA, submitter))
        .send({
          workRef: 'x',
          resourceRef: 'x',
          controlRef: 'x',
          reportRef: 'x',
          expectedVersion: 1,
        });
      expect(stale.status).toBe(404);

      const submitted = await request(app)
        .post(`/api/v8/case-workspace/execution-bvp/links/${linkId}/evidence`)
        .set(auth(orgA, submitter))
        .set('Idempotency-Key', `evidence-${tag}`)
        .send({ artifactLinkId: artifactA, contentDigest: 'sha256:content-a' })
        .expect(201);
      const evidenceId = submitted.body.data.evidence_id as string;
      const selfApproval = await request(app)
        .post(`/api/v8/case-workspace/execution-bvp/evidence/${evidenceId}/approve`)
        .set(auth(orgA, submitter))
        .send({ expectedVersion: 1 });
      expect(selfApproval.status).toBe(404);
      await request(app)
        .post(`/api/v8/case-workspace/execution-bvp/evidence/${evidenceId}/approve`)
        .set(auth(orgA, approver))
        .send({ expectedVersion: 1 })
        .expect(200);

      const closePath = `/api/v8/case-workspace/execution-bvp/links/${linkId}/close`;
      const closes = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(app)
            .post(closePath)
            .set(auth(orgA, approver))
            .set('Idempotency-Key', `signal-${tag}`)
            .send({ evidenceId, expectedVersion: spine.body.data.version })
        )
      );
      expect(closes.every((response) => response.status === 200 || response.status === 201)).toBe(
        true
      );
      const signalIds = closes.map((response) => response.body.data.signalId as string);
      expect(new Set(signalIds).size).toBe(1);

      const consumed = await Promise.all(
        Array.from({ length: 8 }, () => consumeNextExecutionSignal({ organizationId: orgA }))
      );
      expect(consumed.filter(Boolean)).toHaveLength(1);
      expect(consumed.find(Boolean)?.signalId).toBe(signalIds[0]);
      expect(await consumeNextExecutionSignal({ organizationId: orgA })).toBeNull();

      // Simulate a process restart: a new DB client reconstructs the exact
      // producer envelope and immutable Results receipt without process state.
      const cold = new Client({ connectionString: DATABASE_URL });
      await cold.connect();
      const persisted = await cold.query(
        `SELECT e.status,s.signal_id,s.delivery_status,s.attempt_count,s.payload_json,
              r.receipt_id,r.source_signal_id,r.source_execution_link_id,
              r.source_initiative_id,r.source_case_id,r.observation_payload
         FROM execution_case_links e
         JOIN execution_results_signal_outbox s ON s.execution_link_id=e.link_id
         JOIN rvn_execution_signal_receipts r ON r.source_signal_id=s.signal_id
        WHERE e.link_id=$1 AND e.organization_id=$2`,
        [linkId, orgA]
      );
      await cold.end();
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0]).toMatchObject({
        status: 'CLOSED',
        signal_id: signalIds[0],
        delivery_status: 'DELIVERED',
        attempt_count: 1,
        source_signal_id: signalIds[0],
        source_execution_link_id: linkId,
        source_initiative_id: initiativeA,
        source_case_id: caseA,
      });
      expect(persisted.rows[0].payload_json.evidenceId).toBe(evidenceId);
      expect(persisted.rows[0].observation_payload).toEqual(persisted.rows[0].payload_json);
      await expect(
        db.query(
          `UPDATE rvn_execution_signal_receipts SET signal_type='tampered' WHERE receipt_id=$1`,
          [persisted.rows[0].receipt_id]
        )
      ).rejects.toThrow(/immutable/);
    });
  }
);
