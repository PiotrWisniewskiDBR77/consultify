import fs from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  approveDeliveryEvidence,
  closeExecutionAndEmitResultsSignal,
  linkInitiativeToExecutionCase,
  recordExecutionSpine,
  submitDeliveryEvidence,
} from '../executionBvpService.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('EXE-BVP-001 golden flow (fresh real PostgreSQL)', () => {
  let verify: Client;

  beforeAll(async () => {
    verify = new Client({ connectionString: DATABASE_URL });
    await verify.connect();
    await verify.query(`
      CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT);
      CREATE TABLE projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id));
      CREATE TABLE initiatives (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), project_id TEXT NOT NULL REFERENCES projects(id));
      CREATE TABLE case_core (case_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), project_id TEXT NOT NULL REFERENCES projects(id));
      CREATE TABLE case_workspace_artifact_links (
        link_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES case_core(case_id),
        artifact_revision TEXT, relation TEXT NOT NULL, link_status TEXT NOT NULL, is_stale BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);
    const migration = await fs.readFile(
      path.resolve(process.cwd(), 'migrations/20260908_execution_bvp_spine.sql'),
      'utf8'
    );
    await verify.query(migration);
    await verify.query(`
      INSERT INTO organizations VALUES ('org-a','A'),('org-b','B');
      INSERT INTO projects VALUES ('project-a','org-a'),('project-b','org-b');
      INSERT INTO initiatives VALUES ('initiative-a','org-a','project-a'),('initiative-b','org-b','project-b');
      INSERT INTO case_core VALUES ('case-a','org-a','project-a'),('case-b','org-b','project-b');
      INSERT INTO case_workspace_artifact_links VALUES
        ('artifact-a','org-a','case-a','sha256:revision-a','DELIVERABLE','ACTIVE',FALSE),
        ('artifact-stale','org-a','case-a','sha256:revision-stale','EVIDENCE','ACTIVE',TRUE);
    `);
  });

  afterAll(async () => {
    if (verify) await verify.end();
  });

  it('persists the full chain, rejects tenant/stale/concurrency, emits exactly one signal, and cold-reopens it', async () => {
    await expect(
      linkInitiativeToExecutionCase({
        organizationId: 'org-a',
        initiativeId: 'initiative-b',
        caseId: 'case-a',
        actorId: 'actor-a',
        idempotencyKey: 'tenant-negative',
      })
    ).rejects.toThrow('execution_initiative_not_found');

    const link = await linkInitiativeToExecutionCase({
      organizationId: 'org-a',
      initiativeId: 'initiative-a',
      caseId: 'case-a',
      actorId: 'actor-a',
      idempotencyKey: 'intake-a',
    });
    const replay = await linkInitiativeToExecutionCase({
      organizationId: 'org-a',
      initiativeId: 'initiative-a',
      caseId: 'case-a',
      actorId: 'actor-a',
      idempotencyKey: 'intake-a',
    });
    expect(replay.link_id).toBe(link.link_id);

    const spine = await recordExecutionSpine({
      organizationId: 'org-a',
      linkId: link.link_id,
      workRef: 'case_workspace_run:run-a',
      resourceRef: 'initiative_resources:initiative-a',
      controlRef: 'case_workspace_gateway_evaluations:gate-a',
      reportRef: 'document:report-a@v1',
      expectedVersion: 1,
    });
    await expect(
      recordExecutionSpine({
        organizationId: 'org-a',
        linkId: link.link_id,
        workRef: 'x',
        resourceRef: 'x',
        controlRef: 'x',
        reportRef: 'x',
        expectedVersion: 1,
      })
    ).rejects.toThrow('execution_link_stale_or_not_found');
    await expect(
      submitDeliveryEvidence({
        organizationId: 'org-a',
        linkId: link.link_id,
        artifactLinkId: 'artifact-stale',
        contentDigest: 'sha256:stale',
        submittedBy: 'submitter',
        idempotencyKey: 'evidence-stale',
      })
    ).rejects.toThrow('execution_evidence_not_current');

    const evidence = await submitDeliveryEvidence({
      organizationId: 'org-a',
      linkId: link.link_id,
      artifactLinkId: 'artifact-a',
      contentDigest: 'sha256:content-a',
      submittedBy: 'submitter',
      idempotencyKey: 'evidence-a',
    });
    await expect(
      approveDeliveryEvidence({
        organizationId: 'org-a',
        evidenceId: evidence.evidence_id,
        approvedBy: 'submitter',
        expectedVersion: 1,
      })
    ).rejects.toThrow('execution_evidence_stale_forbidden_or_not_found');
    await approveDeliveryEvidence({
      organizationId: 'org-a',
      evidenceId: evidence.evidence_id,
      approvedBy: 'approver',
      expectedVersion: 1,
    });

    const outcomes = await Promise.allSettled([
      closeExecutionAndEmitResultsSignal({
        organizationId: 'org-a',
        linkId: link.link_id,
        evidenceId: evidence.evidence_id,
        expectedVersion: spine.version,
        idempotencyKey: 'signal-a',
      }),
      closeExecutionAndEmitResultsSignal({
        organizationId: 'org-a',
        linkId: link.link_id,
        evidenceId: evidence.evidence_id,
        expectedVersion: spine.version,
        idempotencyKey: 'signal-a',
      }),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    const signalIds = outcomes.map((result) =>
      result.status === 'fulfilled' ? result.value.signalId : 'failed'
    );
    expect(new Set(signalIds).size).toBe(1);

    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    const persisted = await cold.query(
      `SELECT e.status, s.signal_id, s.delivery_status, s.payload_json
         FROM execution_case_links e
         JOIN execution_results_signal_outbox s ON s.execution_link_id = e.link_id
        WHERE e.link_id = $1`,
      [link.link_id]
    );
    await cold.end();
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0].status).toBe('CLOSED');
    expect(persisted.rows[0].delivery_status).toBe('PENDING');
    expect(persisted.rows[0].payload_json.evidenceId).toBe(evidence.evidence_id);
  });
});
