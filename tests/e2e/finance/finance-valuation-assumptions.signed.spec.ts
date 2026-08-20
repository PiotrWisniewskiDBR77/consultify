import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import { readTestSupportState } from '../_helpers/testSupportState';

const WEB_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3410';
const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3411';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const supportHeaders = { 'x-test-support-key': TEST_SUPPORT_KEY };

test('signed valuation wizard reaches canonical assumptions and persists WACC across cold reload', async ({
  browser,
  context,
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const state = readTestSupportState();
  const runId = `fin-bvp-valuation-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const title = `FIN BVP valuation ${runId}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  let valuationId = '';
  let recommendationId = '';
  let candidateId = '';
  const artifactIds: string[] = [];
  const businessVersionIds: string[] = [];
  const caseIds: string[] = [];
  let foreignRunId = '';

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
    recommendationId = `valuation-rec-${runId}`;
    await pool.query(
      `UPDATE valuations
        SET status='APPROVED',
            advisory=$3::jsonb,
            version=coalesce(version,0)+1
        WHERE organization_id=$1 AND id=$2`,
      [
        state.organizationId,
        valuationId,
        JSON.stringify({
          recommendations: [
            {
              id: recommendationId,
              title: `Governed valuation recommendation ${runId}`,
              mechanism: 'Signed G4 recommendation handoff',
              hypothesis: 'The approved recommendation creates one governed candidate',
              risks: ['Execution risk'],
            },
          ],
        }),
      ]
    );

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
    await page.getByRole('tab', { name: /Doradca wyceny|Valuation advisor/i }).click();
    const previewResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname ===
          `/api/finance/candidate-handoff/valuation-recommendation/${recommendationId}/preview`
    );
    await page
      .getByRole('button', { name: 'Wyślij jako kandydata na Initiative', exact: true })
      .click();
    expect((await previewResponse).status()).toBe(200);
    const confirmResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname ===
          `/api/finance/candidate-handoff/valuation-recommendation/${recommendationId}/confirm`
    );
    await page.getByRole('button', { name: 'Wyślij', exact: true }).click();
    const confirmed = await confirmResponse;
    expect(confirmed.status()).toBe(201);
    candidateId = String((await confirmed.json()).data?.candidateId || '');
    expect(candidateId).toBeTruthy();

    const coldContext = await browser.newContext({ storageState: await context.storageState() });
    const cold = await coldContext.newPage();
    try {
      const coldReceiptResponse = cold.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname ===
            `/api/finance/candidate-handoff/valuation-recommendation/${recommendationId}`
      );
      await cold.goto(`${WEB_BASE_URL}/finance/valuations/${encodeURIComponent(valuationId)}`);
      await expect(cold.getByTestId('valuation-workspace')).toBeVisible({ timeout: 30_000 });
      await cold.getByRole('tab', { name: /Założenia|Assumptions/i }).click();
      await expect(cold.getByTestId('wacc-currency')).toHaveValue('EUR');
      await expect(cold.getByTestId('wacc-risk-free-rate')).toHaveValue('3.75');
      await cold.getByRole('tab', { name: /Doradca wyceny|Valuation advisor/i }).click();
      await cold
        .getByRole('button', { name: 'Wyślij jako kandydata na Initiative', exact: true })
        .click();
      await cold.getByRole('button', { name: 'Wyślij', exact: true }).click();
      const coldReceipt = await coldReceiptResponse;
      expect(coldReceipt.status()).toBe(200);
      expect(await coldReceipt.json()).toMatchObject({ data: { candidateId } });
      await cold.goto(
        `${WEB_BASE_URL}/initiatives?tab=candidates&candidateInbox=discovery&candidateId=${encodeURIComponent(candidateId)}`
      );
      await expect(
        cold.getByText(`Governed valuation recommendation ${runId}`, { exact: false }).first()
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await coldContext.close();
    }

    const alias = await pool.query<{ business_version_id: string }>(
      `SELECT business_version_id FROM finance_artifact_aliases
        WHERE organization_id=$1 AND legacy_table='valuations' AND legacy_id=$2`,
      [state.organizationId, valuationId]
    );
    const businessVersionId = alias.rows[0]?.business_version_id;
    expect(businessVersionId).toBeTruthy();
    const beforeDenied = await pool.query(
      `SELECT row_to_json(w.*) snapshot FROM finance_valuation_wacc_inputs w
        WHERE organization_id=$1 AND business_version_id=$2`,
      [state.organizationId, businessVersionId]
    );
    const denialBody = {
      riskFreeRatePct: 99,
      currency: 'EUR',
      nominalOrReal: 'NOMINAL',
      preOrPostTax: 'POST_TAX',
    };
    const memberResponse = await request.post(`${API_BASE_URL}/api/test-support/member`, {
      headers: supportHeaders,
      data: { runId: state.runId, role: 'USER' },
    });
    expect(memberResponse.status(), await memberResponse.text()).toBe(201);
    const member = await memberResponse.json();
    foreignRunId = `fin-bvp-valuation-foreign-${Date.now()}`;
    const foreignResponse = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
      headers: supportHeaders,
      data: { runId: foreignRunId, role: 'ADMIN' },
    });
    expect(foreignResponse.status(), await foreignResponse.text()).toBe(200);
    const foreign = await foreignResponse.json();
    const deniedPut = (token: string) =>
      request.put(
        `${API_BASE_URL}/api/v8/finance-v2/valuation/variants/${businessVersionId}/wacc-inputs`,
        { headers: { Authorization: `Bearer ${token}` }, data: denialBody }
      );
    expect((await deniedPut(String(member.token))).status()).toBe(403);
    expect((await deniedPut(String(foreign.token))).status()).toBe(404);
    await pool.query(
      `UPDATE organization_members SET status='REVOKED'
        WHERE organization_id=$1 AND user_id=$2`,
      [state.organizationId, state.userId]
    );
    try {
      expect((await deniedPut(state.token)).status()).toBe(403);
    } finally {
      await pool.query(
        `UPDATE organization_members SET status='ACTIVE'
          WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, state.userId]
      );
    }
    const afterDenied = await pool.query(
      `SELECT row_to_json(w.*) snapshot FROM finance_valuation_wacc_inputs w
        WHERE organization_id=$1 AND business_version_id=$2`,
      [state.organizationId, businessVersionId]
    );
    expect(afterDenied.rows[0]).toEqual(beforeDenied.rows[0]);
  } finally {
    if (foreignRunId) {
      const cleanup = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
        headers: supportHeaders,
        data: { runId: foreignRunId },
      });
      expect(cleanup.status(), await cleanup.text()).toBe(200);
    }
    if (valuationId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL session_replication_role=replica`);
        if (recommendationId) {
          await client.query(
            `DELETE FROM finance_candidate_handoffs
              WHERE organization_id=$1 AND source_type='finance_valuation_recommendation' AND source_id=$2`,
            [state.organizationId, recommendationId]
          );
        }
        if (candidateId) {
          await client.query(
            `DELETE FROM initiative_candidates WHERE organization_id=$1 AND id=$2`,
            [state.organizationId, candidateId]
          );
        }
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
         (SELECT count(*)::int FROM artifact_lifecycle_events WHERE organization_id=$1 AND artifact_id = ANY($3::text[])) lifecycle_events,
         (SELECT count(*)::int FROM finance_candidate_handoffs
           WHERE organization_id=$1 AND source_type='finance_valuation_recommendation' AND source_id=$6) candidate_receipts,
         (SELECT count(*)::int FROM initiative_candidates WHERE organization_id=$1 AND id=$7) candidates`,
      [
        state.organizationId,
        valuationId,
        artifactIds,
        caseIds,
        businessVersionIds,
        recommendationId || null,
        candidateId || null,
      ]
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
      candidate_receipts: 0,
      candidates: 0,
    });
    await pool.end();
  }
});
