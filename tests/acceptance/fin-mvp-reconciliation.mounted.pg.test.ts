/** FIN-MVP-RECONCILIATION-001 — mounted signed-JWT DEC-FIN matrix. */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { assertJwtSecretHermetic } from './sharedAcceptanceJwtSecret.js';
import { getJwtSecret, requireLocalDbUrl } from './harness.js';
import { ensureRoiGovernedVisibility } from '../resultsVnext/roi/roiRealdbOrgFixture.js';

const P = `fin-recon-${Date.now().toString(36)}-`;
const ORG_A = `${P}org-a`;
const ORG_B = `${P}org-b`;
const OWNER = `${P}owner`;
const ADMIN = `${P}admin`;
const MEMBER = `${P}member-case-owner`;
const FIN_OWNER = `${P}explicit-fin-owner`;
const REVOKED = `${P}revoked`;
const FOREIGN = `${P}foreign`;
const INITIATIVE = `${P}initiative`;

function token(userId: string, organizationId: string, role: string): string {
  return jwt.sign(
    { id: userId, email: `${userId}@test.local`, organizationId, organization_id: organizationId, role },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

describe('FIN-MVP-RECONCILIATION mounted realPG auth/tenant matrix', () => {
  let db: pg.Client;
  let app: Express;
  let caseId: string;
  const linkIds: string[] = [];
  const actualSources = new Map<string, { resultsActualSnapshotId: string; resultsActualMetric: 'totalFinancialBenefits' }>();
  const financeArtifactIds: string[] = [];

  async function seedGovernedSource(linkId: string, index: number) {
    const artifactId = randomUUID();
    const businessVersionId = randomUUID();
    const workingRevisionId = randomUUID();
    const computeSnapshotId = randomUUID();
    const actualSnapshotId = randomUUID();
    const contentHash = `sha256:${String(index + 1).repeat(64)}`;
    const engine = await db.query<{ engine_manifest_id: string }>(
      `SELECT engine_manifest_id FROM finance_engine_manifests ORDER BY created_at LIMIT 1`
    );
    await db.query(`INSERT INTO finance_artifacts
      (artifact_id,organization_id,artifact_type,natural_key,created_by)
      VALUES($1,$2,'BASELINE_MODEL',$3,$4)`,
      [artifactId, ORG_A, `mounted-reconciliation-${artifactId}`, OWNER]);
    await db.query(`INSERT INTO finance_business_versions
      (business_version_id,artifact_id,organization_id,version_no,status,freshness,engine_manifest_id,
       content_semantic_hash)
      VALUES($1,$2,$3,1,'DRAFT','NEVER_COMPUTED',$4,$5)`,
      [businessVersionId, artifactId, ORG_A, engine.rows[0]!.engine_manifest_id, contentHash]);
    await db.query(`INSERT INTO finance_working_revisions
      (working_revision_id,artifact_id,organization_id,business_version_id,revision_seq,
       content_semantic_hash,is_current,edited_by)
      VALUES($1,$2,$3,$4,1,$5,false,$6)`,
      [workingRevisionId, artifactId, ORG_A, businessVersionId, contentHash, OWNER]);
    await db.query(`INSERT INTO finance_compute_snapshots
      (compute_snapshot_id,artifact_id,organization_id,working_revision_id,engine_manifest_id,
       as_of,content_semantic_hash,created_by)
      VALUES($1,$2,$3,$4,$5,now(),$6,$7)`,
      [computeSnapshotId, artifactId, ORG_A, workingRevisionId,
        engine.rows[0]!.engine_manifest_id, contentHash, OWNER]);
    await db.query(`UPDATE finance_business_versions SET source_working_revision_id=$1,
      compute_snapshot_id=$2,status='APPROVED',freshness='CURRENT',approved_by=$3,approved_at=now()
      WHERE business_version_id=$4`, [workingRevisionId, computeSnapshotId, ADMIN, businessVersionId]);
    await db.query(`UPDATE rvn_roi_finance_links SET finance_artifact_id=$1,finance_version_id=$2,
      tracked_metric='totalFinancialBenefits',pinned_finance_value=106
      WHERE link_id=$3 AND organization_id=$4`, [artifactId, businessVersionId, linkId, ORG_A]);
    await db.query(`INSERT INTO rvn_roi_actual_snapshots
      (actual_snapshot_id,case_id,organization_id,sequence_number,as_of_period_end,published_by,
       total_actual_financial_benefits,periods_with_actual_count,periods_expected_count,coverage_pct,
       unverified_entry_count,disputed_entry_count,entry_ids_included)
      VALUES($1,$2,$3,$4,'2026-06-30',$5,100,1,1,100,0,0,'[]'::jsonb)`,
      [actualSnapshotId, caseId, ORG_A, index + 1, OWNER]);
    financeArtifactIds.push(artifactId);
    actualSources.set(linkId, { resultsActualSnapshotId: actualSnapshotId, resultsActualMetric: 'totalFinancialBenefits' });
  }

  async function seedUser(userId: string, orgId: string, role: string, membershipStatus = 'ACTIVE') {
    await db.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1,$2,$3,'x',$4,'active','Fin','Recon',now())`,
      [userId, orgId, `${userId}@test.local`, role]
    );
    await db.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1,$2,$3,$4,$5,now())`,
      [`${P}membership-${userId}`, orgId, userId, role === 'USER' ? 'MEMBER' : role, membershipStatus]
    );
  }

  beforeAll(async () => {
    await assertJwtSecretHermetic();
    requireLocalDbUrl();
    db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    await db.query(`INSERT INTO organizations (id,name,plan,status) VALUES ($1,'FIN A','enterprise','active'),($2,'FIN B','enterprise','active')`, [ORG_A, ORG_B]);
    await seedUser(OWNER, ORG_A, 'OWNER');
    await seedUser(ADMIN, ORG_A, 'ADMIN');
    await seedUser(MEMBER, ORG_A, 'USER');
    await seedUser(FIN_OWNER, ORG_A, 'ADMIN');
    await seedUser(REVOKED, ORG_A, 'USER', 'REVOKED');
    await seedUser(FOREIGN, ORG_B, 'OWNER');
    await db.query(`INSERT INTO initiatives (id,organization_id,name) VALUES ($1,$2,'FIN reconciliation')`, [INITIATIVE, ORG_A]);
    await ensureRoiGovernedVisibility({
      organizationId: ORG_A,
      actorUserId: OWNER,
      idempotencyKey: `${P}governed-visibility`,
    });
    for (const [userId, actedBy] of [[OWNER, ADMIN], [FIN_OWNER, OWNER]] as const) await db.query(
      `INSERT INTO rvn_finance_reconciliation_grant_events
       (organization_id,user_id,grant_version,action,acted_by,policy_version,policy_digest)
       VALUES ($1,$2,1,'granted',$3,'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
               'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d')`,
      [ORG_A, userId, actedBy]
    );

    const caseCommands = await import('../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    const linkCommands = await import('../../server/src/services/resultsVnext/roi/roiFinanceLinkCommands.js');
    const createdCase = await caseCommands.createRoiCase({
      organizationId: ORG_A,
      initiativeId: INITIATIVE,
      title: 'DEC-FIN mounted case',
      ownerUserId: MEMBER,
      currency: 'PLN',
      createdBy: OWNER,
      actorEffectiveRole: 'OWNER',
      idempotencyKey: `${P}case`,
    });
    caseId = createdCase.result.case.caseId;
    for (let index = 0; index < 4; index += 1) {
      const link = await linkCommands.createRoiFinanceLink({
        caseId,
        organizationId: ORG_A,
        financeArtifactType: 'business_case',
        financeArtifactId: `${P}artifact-${index}`,
        financeVersionId: `${P}version-${index}`,
        source: 'finance_v3',
        asOf: new Date().toISOString(),
        linkPurpose: 'actual_reconciliation',
        actorUserId: OWNER,
        actorEffectiveRole: 'OWNER',
        idempotencyKey: `${P}link-${index}`,
        access: { capabilities: ['*'], platformRole: null },
      });
      linkIds.push(link.result.linkId);
      await seedGovernedSource(link.result.linkId, index);
    }

    const roiRouter = (await import('../../server/src/routes/resultsVnext/roi.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/vnext/results/roi', roiRouter);
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    await db.query(`SET session_replication_role = replica`);
    await db.query(`DELETE FROM rvn_finance_reconciliation_grant_events WHERE organization_id = $1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_finance_reconciliation_decisions WHERE organization_id = $1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_finance_reconciliations WHERE organization_id = $1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_visibility_governance WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_finance_links WHERE organization_id = $1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_actual_snapshots WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id=$1)`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_events WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_resource_acl WHERE resource_id=$1`, [caseId]);
    await db.query(`DELETE FROM rvn_platform_obligations WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_baselines WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_roi_cases WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id=$1`, [ORG_A]);
    await db.query(`DELETE FROM finance_compute_snapshots WHERE artifact_id = ANY($1::text[])`, [financeArtifactIds]);
    await db.query(`DELETE FROM finance_working_revisions WHERE artifact_id = ANY($1::text[])`, [financeArtifactIds]);
    await db.query(`DELETE FROM finance_business_versions WHERE artifact_id = ANY($1::text[])`, [financeArtifactIds]);
    await db.query(`DELETE FROM finance_artifacts WHERE artifact_id = ANY($1::text[])`, [financeArtifactIds]);
    await db.query(`SET session_replication_role = origin`);
    await db.query(`DELETE FROM initiatives WHERE id=$1`, [INITIATIVE]);
    await db.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await db.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[OWNER, ADMIN, MEMBER, FIN_OWNER, REVOKED, FOREIGN]]);
    await db.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B]);
    await db.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  }, 30_000);

  async function openAsOwner(linkId: string, key: string) {
    const source = actualSources.get(linkId)!;
    return request(app)
      .post(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations`)
      .set('Authorization', `Bearer ${token(OWNER, ORG_A, 'OWNER')}`)
      .send({ financeLinkId: linkId, ...source, reconciliationKind: 'proposal', roiValue: 100, financeValue: 106, idempotencyKey: key });
  }

  it('MEMBER+responsibility is denied; qualified OWNER maker opens but cannot self-resolve', async () => {
    const member = await request(app)
      .post(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations`)
      .set('Authorization', `Bearer ${token(MEMBER, ORG_A, 'USER')}`)
      .send({ financeLinkId: linkIds[0], ...actualSources.get(linkIds[0]!)!, reconciliationKind: 'proposal', roiValue: 100, financeValue: 106, idempotencyKey: `${P}member-denied` });
    expect(member.status).toBe(404);
    const opened = await openAsOwner(linkIds[0]!, `${P}open-owner`);
    expect(opened.status).toBe(201);
    const reconciliation = opened.body.financeReconciliation;
    const self = await request(app)
      .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
      .set('Authorization', `Bearer ${token(OWNER, ORG_A, 'OWNER')}`)
      .send({ expectedVersion: reconciliation.rowVersion, status: 'resolved', idempotencyKey: `${P}self` });
    expect(self.status).toBe(403);
    expect(self.body.code).toBe('FINANCE_RECONCILIATION_SELF_RESOLUTION_DENIED');

    const admin = await request(app)
      .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
      .set('Authorization', `Bearer ${token(ADMIN, ORG_A, 'ADMIN')}`)
      .send({ expectedVersion: reconciliation.rowVersion, status: 'resolved', idempotencyKey: `${P}owner-resolve` });
    expect(admin.status).toBe(403);
    expect(admin.body.code).toBe('FINANCE_OWNER_GRANT_REQUIRED');
  });

  it('explicit Finance-owner capability resolves; foreign and revoked identities fail closed', async () => {
    const opened = await openAsOwner(linkIds[1]!, `${P}open-explicit`);
    expect(opened.status).toBe(201);
    const reconciliation = opened.body.financeReconciliation;
    for (const [actor, org, role] of [[FOREIGN, ORG_B, 'OWNER'], [REVOKED, ORG_A, 'USER']] as const) {
      const denied = await request(app)
        .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
        .set('Authorization', `Bearer ${token(actor, org, role)}`)
        .send({ expectedVersion: reconciliation.rowVersion, status: 'accepted_divergence', idempotencyKey: `${P}deny-${actor}` });
      expect([403, 404, 409]).toContain(denied.status);
    }
    const explicit = await request(app)
      .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
      .set('Authorization', `Bearer ${token(FIN_OWNER, ORG_A, 'ADMIN')}`)
      .send({ expectedVersion: reconciliation.rowVersion, status: 'accepted_divergence', idempotencyKey: `${P}explicit` });
    expect(explicit.status).toBe(200);
    expect(explicit.body.financeReconciliation.resolvedBy).toBe(FIN_OWNER);
  });

  it('ADMIN wildcard is insufficient and revoked membership is rechecked with the same token', async () => {
    const opened = await openAsOwner(linkIds[2]!, `${P}open-admin`);
    expect(opened.status).toBe(201);
    const reconciliation = opened.body.financeReconciliation;
    const admin = await request(app)
      .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${reconciliation.reconciliationId}`)
      .set('Authorization', `Bearer ${token(ADMIN, ORG_A, 'ADMIN')}`)
      .send({ expectedVersion: reconciliation.rowVersion, status: 'resolved', idempotencyKey: `${P}admin` });
    expect(admin.status).toBe(403);
    expect(admin.body.code).toBe('FINANCE_OWNER_GRANT_REQUIRED');
    await db.query(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`, [ORG_A, OWNER]);
    const cachedTokenDenied = await openAsOwner(linkIds[2]!, `${P}cached-revoked`);
    expect(cachedTokenDenied.status).toBe(404);
    await db.query(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`, [ORG_A, OWNER]);
    const cold = await db.query(
      `SELECT reconciliation_kind, decision_policy_version, decision_policy_digest, roi_value, finance_value, resolved_by
         FROM rvn_roi_finance_reconciliations WHERE reconciliation_id=$1`,
      [reconciliation.reconciliationId]
    );
    expect(cold.rows[0]).toMatchObject({
      reconciliation_kind: 'proposal',
      decision_policy_version: 'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
      decision_policy_digest: 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d',
      resolved_by: null,
    });
    expect(Number(cold.rows[0].roi_value)).toBe(100);
    expect(Number(cold.rows[0].finance_value)).toBe(106);
  });

  it('append-only revocation disables an explicit grant and cannot be mutated back', async () => {
    const opened = await openAsOwner(linkIds[3]!, `${P}open-revoked-grant`);
    expect(opened.status).toBe(201);
    await db.query(
      `INSERT INTO rvn_finance_reconciliation_grant_events
       (organization_id,user_id,grant_version,action,acted_by,policy_version,policy_digest)
       VALUES ($1,$2,2,'revoked',$3,'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
        'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d')`,
      [ORG_A, FIN_OWNER, OWNER]
    );
    const denied = await request(app)
      .patch(`/api/vnext/results/roi/cases/${caseId}/finance-reconciliations/${opened.body.financeReconciliation.reconciliationId}`)
      .set('Authorization', `Bearer ${token(FIN_OWNER, ORG_A, 'ADMIN')}`)
      .send({ expectedVersion: 1, status: 'resolved', idempotencyKey: `${P}revoked-grant` });
    expect(denied.status).toBe(403);
    await expect(db.query(
      `UPDATE rvn_finance_reconciliation_grant_events SET action='granted'
        WHERE organization_id=$1 AND user_id=$2 AND grant_version=2`,
      [ORG_A, FIN_OWNER]
    )).rejects.toThrow(/append-only/i);
    await expect(db.query(
      `INSERT INTO rvn_finance_reconciliation_grant_events
       (organization_id,user_id,grant_version,action,acted_by,policy_version,policy_digest)
       VALUES ($1,$2,3,'granted',$3,'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
        'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d')`,
      [ORG_A, FIN_OWNER, OWNER]
    )).rejects.toThrow(/irreversible/i);
    const commands = await import('../../server/src/services/resultsVnext/roi/roiFinanceReconciliationCommands.js');
    await expect(commands.recordFinanceOwnerGrantEvent({
      organizationId: ORG_A,
      userId: FIN_OWNER,
      action: 'granted',
      actorUserId: OWNER,
      idempotencyKey: `${P}forbidden-regrant`,
      access: { capabilities: ['*'], platformRole: null },
    })).rejects.toMatchObject({ code: 'FINANCE_OWNER_REVOCATION_IRREVERSIBLE' });
  });
});
