import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import { readTestSupportState } from '../_helpers/testSupportState';

const WEB_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3410';

test('signed valuation wizard reaches canonical assumptions and persists WACC across cold reload', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const state = readTestSupportState();
  const runId = `fin-bvp-valuation-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const title = `FIN BVP valuation ${runId}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  let valuationId = '';
  const artifactIds: string[] = [];
  const businessVersionIds: string[] = [];
  const caseIds: string[] = [];

  try {
    await page.goto(`${WEB_BASE_URL}/finance?tab=valuation`);
    const skip = page.getByRole('button', { name: /Skip for now|Pomiń/i }).last();
    if (
      await skip
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await skip.click();
    }

    await page.getByRole('button', { name: /New valuation|Nowa wycena/i }).click();
    const modal = page
      .getByRole('heading', {
        name: /Nowa wycena przedsiębiorstwa|New enterprise valuation/i,
      })
      .locator('..');
    await modal.getByPlaceholder(/Wycena DCF|valuation/i).fill(title);

    const createResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/economics/valuations'
    );
    await modal.getByRole('button', { name: /Create|Utwórz/i }).click();
    const created = await createResponse;
    expect(created.status()).toBe(201);
    const createdBody = await created.json();
    valuationId = String(createdBody.id ?? createdBody.valuation?.id ?? '');
    expect(valuationId).toBeTruthy();

    await expect(page.getByTestId('valuation-workspace')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /Założenia|Assumptions/i }).click();

    await page.getByTestId('wacc-currency').fill('EUR');
    await page.getByTestId('wacc-risk-free-rate').fill('3.75');
    const putResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        /\/api\/v8\/finance-v2\/valuation\/variants\/[^/]+\/wacc-inputs$/.test(
          new URL(response.url()).pathname
        )
    );
    await page.getByTestId('wacc-save-button').click();
    expect((await putResponse).status()).toBe(200);

    await page.goto(`${WEB_BASE_URL}/finance/valuations/${encodeURIComponent(valuationId)}`);
    await expect(page.getByTestId('valuation-workspace')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /Założenia|Assumptions/i }).click();
    await expect(page.getByTestId('wacc-currency')).toHaveValue('EUR');
    await expect(page.getByTestId('wacc-risk-free-rate')).toHaveValue('3.75');
  } finally {
    if (valuationId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL session_replication_role=replica`);
        const aliases = await client.query<{
          artifact_id: string;
          business_version_id: string;
        }>(
          `SELECT artifact_id, business_version_id FROM finance_artifact_aliases
            WHERE organization_id=$1 AND legacy_table='valuations' AND legacy_id=$2`,
          [state.organizationId, valuationId]
        );
        for (const {
          artifact_id: artifactId,
          business_version_id: businessVersionId,
        } of aliases.rows) {
          artifactIds.push(artifactId);
          businessVersionIds.push(businessVersionId);
          const cases = await client.query<{ case_id: string }>(
            `SELECT case_id FROM finance_valuation_variants
              WHERE organization_id=$1
                AND business_version_id IN (SELECT business_version_id FROM finance_business_versions WHERE artifact_id=$2)`,
            [state.organizationId, artifactId]
          );
          caseIds.push(...cases.rows.map((row) => row.case_id));
          await client.query(
            `DELETE FROM finance_valuation_wacc_inputs WHERE organization_id=$1 AND business_version_id IN (SELECT business_version_id FROM finance_business_versions WHERE artifact_id=$2)`,
            [state.organizationId, artifactId]
          );
          await client.query(
            `DELETE FROM finance_lineage_edges
              WHERE organization_id=$1
                AND (source_version_id IN (SELECT business_version_id FROM finance_business_versions WHERE artifact_id=$2)
                  OR target_version_id IN (SELECT business_version_id FROM finance_business_versions WHERE artifact_id=$2))`,
            [state.organizationId, artifactId]
          );
          await client.query(
            `DELETE FROM finance_valuation_variants
              WHERE organization_id=$1
                AND business_version_id IN (SELECT business_version_id FROM finance_business_versions WHERE artifact_id=$2)`,
            [state.organizationId, artifactId]
          );
          for (const { case_id: caseId } of cases.rows) {
            await client.query(
              `DELETE FROM finance_valuation_cases WHERE organization_id=$1 AND case_id=$2`,
              [state.organizationId, caseId]
            );
          }
          await client.query(
            `DELETE FROM finance_artifact_aliases WHERE organization_id=$1 AND artifact_id=$2`,
            [state.organizationId, artifactId]
          );
          await client.query(
            `DELETE FROM artifact_lifecycle_events WHERE organization_id=$1 AND artifact_id=$2`,
            [state.organizationId, artifactId]
          );
          await client.query(
            `DELETE FROM finance_working_revisions WHERE organization_id=$1 AND artifact_id=$2`,
            [state.organizationId, artifactId]
          );
          await client.query(
            `DELETE FROM finance_business_versions WHERE organization_id=$1 AND artifact_id=$2`,
            [state.organizationId, artifactId]
          );
          await client.query(
            `DELETE FROM finance_artifacts WHERE organization_id=$1 AND artifact_id=$2`,
            [state.organizationId, artifactId]
          );
        }
        await client.query(`DELETE FROM valuations WHERE organization_id=$1 AND id=$2`, [
          state.organizationId,
          valuationId,
        ]);
        await client.query(`SET LOCAL session_replication_role=origin`);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    const residue = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM valuations WHERE organization_id=$1 AND id=$2) valuations,
         (SELECT count(*)::int FROM finance_artifact_aliases WHERE organization_id=$1 AND legacy_table='valuations' AND legacy_id=$2) aliases,
         (SELECT count(*)::int FROM finance_artifacts WHERE organization_id=$1 AND artifact_id = ANY($3::text[])) artifacts,
         (SELECT count(*)::int FROM finance_business_versions WHERE organization_id=$1 AND artifact_id = ANY($3::text[])) business_versions,
         (SELECT count(*)::int FROM finance_working_revisions WHERE organization_id=$1 AND artifact_id = ANY($3::text[])) working_revisions,
         (SELECT count(*)::int FROM finance_valuation_variants WHERE organization_id=$1 AND case_id = ANY($4::text[])) variants,
         (SELECT count(*)::int FROM finance_valuation_cases WHERE organization_id=$1 AND case_id = ANY($4::text[])) cases,
         (SELECT count(*)::int FROM finance_valuation_wacc_inputs WHERE organization_id=$1 AND business_version_id = ANY($5::text[])) wacc_inputs,
         (SELECT count(*)::int FROM artifact_lifecycle_events WHERE organization_id=$1 AND artifact_id = ANY($3::text[])) lifecycle_events`,
      [state.organizationId, valuationId, artifactIds, caseIds, businessVersionIds]
    );
    expect(residue.rows[0]).toEqual({
      valuations: 0,
      aliases: 0,
      artifacts: 0,
      business_versions: 0,
      working_revisions: 0,
      variants: 0,
      cases: 0,
      wacc_inputs: 0,
      lifecycle_events: 0,
    });
    await pool.end();
  }
});
