import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import { readTestSupportState } from '../_helpers/testSupportState';

const WEB_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3410';

test('signed Finance model approval uses only the canonical writer and survives cold status read', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const state = readTestSupportState();
  const runId = `fin-cutover-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const modelId = `${runId}-model`;
  const title = `FIN cutover ${runId}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let artifactId = '';
  let businessVersionId = '';
  const canonicalApproveRequests: string[] = [];
  const legacyApproveRequests: string[] = [];

  try {
    const artifactVersionService =
      await import('../../../server/src/services/finance/canonical/artifactVersionService');
    const created = await artifactVersionService.createArtifact({
      organizationId: state.organizationId,
      artifactType: 'HISTORICAL_ANALYSIS',
      createdBy: state.userId,
    });
    artifactId = created.artifact.artifact_id;
    businessVersionId = created.businessVersion.business_version_id;
    let version = created.businessVersion.version;
    const submitted = await artifactVersionService.transition({
      organizationId: state.organizationId,
      businessVersionId,
      action: 'submit_for_review',
      actorId: state.userId,
      role: 'preparer',
      expectedVersion: version,
    });
    if (!submitted.ok) throw new Error('Unable to submit canonical model for review');
    version = submitted.businessVersion.version;
    const reviewing = await artifactVersionService.transition({
      organizationId: state.organizationId,
      businessVersionId,
      action: 'start_review',
      actorId: state.userId,
      role: 'approver',
      expectedVersion: version,
    });
    if (!reviewing.ok) throw new Error('Unable to start canonical model review');

    await pool.query(
      `INSERT INTO financial_models
         (id,organization_id,name,start_date,status,version,created_by,created_at,updated_at)
       VALUES($1,$2,$3,CURRENT_DATE,'review',1,$4,NOW(),NOW())`,
      [modelId, state.organizationId, title, state.userId]
    );
    await pool.query(
      `UPDATE finance_business_versions SET freshness='CURRENT' WHERE business_version_id=$1`,
      [businessVersionId]
    );
    await pool.query(
      `INSERT INTO finance_artifact_aliases
         (legacy_table,legacy_id,legacy_version,artifact_id,organization_id,business_version_id,
          mapping_confidence,mapping_reason,created_by)
       VALUES('financial_models',$1,'',$2,$3,$4,'AUTO_MIGRATE','cutover signed journey',$5)`,
      [modelId, artifactId, state.organizationId, businessVersionId, state.userId]
    );

    await page.addInitScript(({ token, organizationId, userId }) => {
      const user = {
        id: userId,
        organizationId,
        email: 'finance-cutover@local.test',
        role: 'OWNER',
        isAuthenticated: true,
        accessLevel: 'full',
      };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(
        'consultinity-storage',
        JSON.stringify({
          state: {
            sessionMode: 'FULL',
            currentUser: user,
            currentOrganization: { id: organizationId, name: 'E2E Organization' },
          },
          version: 0,
        })
      );
    }, state);
    page.on('request', (request) => {
      if (request.method() !== 'POST') return;
      const pathname = new URL(request.url()).pathname;
      if (pathname === `/api/v8/finance-v2/models/${artifactId}/approve`) {
        canonicalApproveRequests.push(pathname);
      }
      if (
        pathname === `/api/v8/finance/models/${modelId}/approve` ||
        pathname === `/api/financial-modeling/models/${modelId}/approve`
      ) {
        legacyApproveRequests.push(pathname);
      }
    });

    await page.goto(`${WEB_BASE_URL}/finance?tab=models`);
    const skip = page.getByText(/Skip for now|Pomiń/i).last();
    if (
      await skip
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await skip.click();
    }
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByText(title, { exact: true }).click();
    const approve = page.getByRole('button', { name: /^(Approve|Zatwierdź)$/i }).first();
    await expect(approve).toBeVisible();
    const approvedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `/api/v8/finance-v2/models/${artifactId}/approve`
    );
    await approve.click();
    expect((await approvedResponse).status()).toBe(200);
    await expect.poll(() => canonicalApproveRequests.length).toBe(1);
    expect(legacyApproveRequests).toEqual([]);

    await page.reload();
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 30_000 });
    const coldStatus = await pool.query(
      `SELECT status FROM finance_business_versions
        WHERE business_version_id=$1 AND artifact_id=$2 AND organization_id=$3`,
      [businessVersionId, artifactId, state.organizationId]
    );
    expect(coldStatus.rows).toEqual([{ status: 'APPROVED' }]);
    expect(canonicalApproveRequests).toHaveLength(1);
    expect(legacyApproveRequests).toEqual([]);
  } finally {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL session_replication_role=replica`);
      await client.query(
        `DELETE FROM finance_artifact_aliases WHERE legacy_table='financial_models' AND legacy_id=$1`,
        [modelId]
      );
      await client.query(`DELETE FROM artifact_lifecycle_events WHERE artifact_id=$1`, [
        artifactId,
      ]);
      await client.query(`DELETE FROM finance_working_revisions WHERE artifact_id=$1`, [
        artifactId,
      ]);
      await client.query(`DELETE FROM finance_business_versions WHERE artifact_id=$1`, [
        artifactId,
      ]);
      await client.query(`DELETE FROM finance_artifacts WHERE artifact_id=$1`, [artifactId]);
      await client.query(`DELETE FROM financial_models WHERE id=$1 AND organization_id=$2`, [
        modelId,
        state.organizationId,
      ]);
      await client.query(`SET LOCAL session_replication_role=origin`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      const residue = await pool.query(
        `SELECT
           (SELECT count(*)::int FROM financial_models WHERE id=$1) AS models,
           (SELECT count(*)::int FROM finance_artifact_aliases WHERE legacy_table='financial_models' AND legacy_id=$1) AS aliases,
           (SELECT count(*)::int FROM finance_artifacts WHERE artifact_id=$2) AS artifacts`,
        [modelId, artifactId]
      );
      expect(residue.rows[0]).toEqual({ models: 0, aliases: 0, artifacts: 0 });
      await pool.end();
    }
  }
});
