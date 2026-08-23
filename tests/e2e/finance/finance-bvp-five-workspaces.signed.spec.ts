import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';
import {
  enableFinanceBvpFlags,
  releaseFinanceBvpFixture,
  seedFinanceBvpFixture,
} from './financeBvpFiveWorkspacesFixture';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3411';
const WEB_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3410';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

type SignedPersona = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
};

const supportHeaders = { 'x-test-support-key': TEST_SUPPORT_KEY };
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function dismissOnboarding(page: import('@playwright/test').Page): Promise<void> {
  const skip = page.getByRole('button', { name: /Skip for now|Pomiń/i }).last();
  if (
    await skip
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)
  ) {
    await skip.click();
  }
}

test.describe.serial('FIN-BVP signed canonical workspaces', () => {
  test('Statements, Baseline, Prediction, Analysis and Valuation survive new signed browser contexts', async ({
    browser,
    context,
    page,
    request,
  }) => {
    test.setTimeout(360_000);
    const state = readTestSupportState();
    const { fixture, pool, lockClient } = await seedFinanceBvpFixture(
      state.organizationId,
      state.userId
    );
    let foreignRunId = '';
    try {
      await enableFinanceBvpFlags(
        request,
        API_BASE_URL,
        TEST_SUPPORT_KEY,
        state.organizationId,
        fixture.runId
      );

      await page.goto(
        `${WEB_BASE_URL}/finance/statements/${encodeURIComponent(fixture.statement.legacyId)}`
      );
      await dismissOnboarding(page);
      await expect(page.getByTestId('statement-pack-workspace-v2')).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId('canonical-statement-table-v2')).toBeVisible();
      await expect(page.getByText('CURRENT_ASSETS', { exact: true })).toBeVisible();
      await expect(page.getByText('500 000', { exact: true })).toBeVisible();
      await expect(page.getByText('CURRENT_LIABILITIES', { exact: true })).toBeVisible();
      await expect(page.getByText('250 000', { exact: true })).toBeVisible();

      const statementStorageState = await context.storageState();
      const statementColdContext = await browser.newContext({
        storageState: statementStorageState,
      });
      const statementCold = await statementColdContext.newPage();
      await statementCold.goto(
        `${WEB_BASE_URL}/finance/statements/${encodeURIComponent(fixture.statement.legacyId)}`
      );
      await expect(statementCold.getByTestId('statement-pack-workspace-v2')).toBeVisible({
        timeout: 30_000,
      });
      await expect(statementCold.getByTestId('canonical-statement-table-v2')).toBeVisible();
      await expect(statementCold.getByText('CURRENT_ASSETS', { exact: true })).toBeVisible();
      await expect(statementCold.getByText('500 000', { exact: true })).toBeVisible();
      await expect(statementCold.getByText('CURRENT_LIABILITIES', { exact: true })).toBeVisible();
      await expect(statementCold.getByText('250 000', { exact: true })).toBeVisible();
      await statementColdContext.close();

      await page.goto(
        `${WEB_BASE_URL}/finance/models/${encodeURIComponent(fixture.baseline.legacyId)}`
      );
      await dismissOnboarding(page);
      await expect(page.getByTestId('baseline-workspace')).toBeVisible({ timeout: 30_000 });
      const baselineValue = page.getByTestId('baseline-assumption-value-0');
      await expect(baselineValue).toHaveValue('1');
      await baselineValue.fill('2.5');
      const baselineWrite = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname ===
            `/api/v8/finance-v2/baseline/${fixture.baseline.businessVersionId}/assumptions`
      );
      await page.getByTestId('baseline-assumptions-save').click();
      const confirm = page.getByTestId('baseline-assumptions-preflight-confirm-save');
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      expect((await baselineWrite).status()).toBe(200);

      const storageState = await context.storageState();
      const coldContext = await browser.newContext({ storageState });
      const cold = await coldContext.newPage();
      await cold.goto(
        `${WEB_BASE_URL}/finance/models/${encodeURIComponent(fixture.baseline.legacyId)}`
      );
      await expect(cold.getByTestId('baseline-workspace')).toBeVisible({ timeout: 30_000 });
      await expect(cold.getByTestId('baseline-assumption-value-0')).toHaveValue('2.5');
      await coldContext.close();

      await page.goto(
        `${WEB_BASE_URL}/finance/predictions/${encodeURIComponent(fixture.prediction.legacyId)}`
      );
      await expect(page.getByTestId('prediction-assumptions-view')).toBeVisible({
        timeout: 30_000,
      });
      await page.getByTestId('add-initiative').click();
      await page.getByLabel('Nazwa inicjatywy').fill(`Signed initiative ${fixture.runId}`);
      const predictionWrite = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          new URL(response.url()).pathname ===
            `/api/v8/finance-v2/prediction/${fixture.prediction.businessVersionId}/authoring`
      );
      await page.getByTestId('prediction-save-authoring').click();
      expect((await predictionWrite).status()).toBe(200);
      await expect(page.getByTestId('prediction-canonical-authoring-banner')).toContainText(
        'Rewizja authoringu: 2'
      );

      const predictionColdContext = await browser.newContext({ storageState });
      const predictionCold = await predictionColdContext.newPage();
      await predictionCold.goto(
        `${WEB_BASE_URL}/finance/predictions/${encodeURIComponent(fixture.prediction.legacyId)}`
      );
      await expect(predictionCold.getByTestId('prediction-assumptions-view')).toBeVisible({
        timeout: 30_000,
      });
      await expect(predictionCold.getByLabel('Nazwa inicjatywy')).toHaveValue(
        `Signed initiative ${fixture.runId}`
      );
      await expect(
        predictionCold.getByTestId('prediction-canonical-authoring-banner')
      ).toContainText('Rewizja authoringu: 2');

      const preflight = predictionCold.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname ===
            `/api/v8/finance-v2/prediction/${fixture.prediction.businessVersionId}/preflight`
      );
      await predictionCold
        .getByRole('button', { name: /Uruchom preflight|Run preflight/i })
        .click();
      expect((await preflight).status()).toBe(201);
      await predictionColdContext.close();

      const conflictContext = await browser.newContext({ storageState });
      const conflictPage = await conflictContext.newPage();
      await conflictPage.goto(
        `${WEB_BASE_URL}/finance/predictions/${encodeURIComponent(fixture.prediction.legacyId)}`
      );
      await expect(conflictPage.getByTestId('prediction-canonical-authoring-banner')).toContainText(
        'Rewizja authoringu: 2'
      );
      const winningDraftResponse = await request.get(
        `${API_BASE_URL}/api/v8/finance-v2/prediction/${fixture.prediction.businessVersionId}/authoring`,
        { headers: bearer(state.token) }
      );
      expect(winningDraftResponse.status(), await winningDraftResponse.text()).toBe(200);
      const winningSnapshot = (await winningDraftResponse.json()).data;
      const winningKey = `signed-winner-${fixture.runId}`;
      const winningCommand = {
        expectedRevision: winningSnapshot.revision,
        draft: {
          ...winningSnapshot.draft,
          initiatives: winningSnapshot.draft.initiatives.map(
            (initiative: Record<string, unknown>) => ({
              ...initiative,
              name: `Server winner ${fixture.runId}`,
            })
          ),
        },
      };
      const winningWrite = await request.put(
        `${API_BASE_URL}/api/v8/finance-v2/prediction/${fixture.prediction.businessVersionId}/authoring`,
        {
          headers: { ...bearer(state.token), 'x-idempotency-key': winningKey },
          data: winningCommand,
        }
      );
      expect(winningWrite.status(), await winningWrite.text()).toBe(200);
      expect((await winningWrite.json()).data).toMatchObject({ revision: 3, replay: false });

      await conflictPage.getByLabel('Nazwa inicjatywy').fill(`Local conflict ${fixture.runId}`);
      const conflictResponse = conflictPage.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          new URL(response.url()).pathname ===
            `/api/v8/finance-v2/prediction/${fixture.prediction.businessVersionId}/authoring`
      );
      await conflictPage.getByTestId('prediction-save-authoring').click();
      expect((await conflictResponse).status()).toBe(409);
      await expect(conflictPage.getByTestId('prediction-status-message')).toContainText(
        'Wczytano kanoniczną rewizję 3'
      );
      await expect(conflictPage.getByLabel('Nazwa inicjatywy')).toHaveValue(
        `Server winner ${fixture.runId}`
      );
      await expect(conflictPage.getByTestId('prediction-canonical-authoring-banner')).toContainText(
        'Rewizja authoringu: 3'
      );
      await conflictContext.close();

      await page.goto(
        `${WEB_BASE_URL}/finance/analyses/${encodeURIComponent(fixture.analysis.legacyId)}`
      );
      await expect(page.getByTestId('analysis-workspace')).toBeVisible({ timeout: 30_000 });
      const analysisCompute = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname ===
            `/api/v8/finance-v2/analysis/${fixture.analysis.businessVersionId}/compute`
      );
      await page.getByTestId('finance-workspace-bar-primary').click();
      expect((await analysisCompute).status()).toBe(200);

      const analysisColdContext = await browser.newContext({ storageState });
      const analysisCold = await analysisColdContext.newPage();
      await analysisCold.goto(
        `${WEB_BASE_URL}/finance/analyses/${encodeURIComponent(fixture.analysis.legacyId)}`
      );
      await expect(analysisCold.getByTestId('analysis-workspace')).toBeVisible({
        timeout: 30_000,
      });
      const currentRatioName = await pool.query<{ kpi_name: string }>(
        `SELECT c.kpi_name
           FROM finance_analysis_kpi_values v
           JOIN finance_analysis_kpi_catalog c ON c.id = v.kpi_catalog_id
          WHERE v.organization_id=$1 AND v.business_version_id=$2 AND c.kpi_code='CURRENT_RATIO'`,
        [state.organizationId, fixture.analysis.businessVersionId]
      );
      const currentRatioRow = analysisCold
        .getByRole('row')
        .filter({ hasText: currentRatioName.rows[0].kpi_name });
      await expect(currentRatioRow).toContainText(currentRatioName.rows[0].kpi_name);
      await expect(currentRatioRow).toContainText('2');
      await analysisColdContext.close();

      await page.goto(`${WEB_BASE_URL}/finance?tab=valuation`);
      await page.getByRole('button', { name: /New valuation|Nowa wycena/i }).click();
      const valuationTitle = `Signed valuation ${fixture.runId}`;
      const valuationModal = page
        .getByRole('heading', {
          name: /Nowa wycena przedsiębiorstwa|New enterprise valuation/i,
        })
        .locator('..');
      await valuationModal.getByPlaceholder(/Wycena DCF|valuation/i).fill(valuationTitle);
      const valuationCreate = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/v8/finance-v2/valuation/registrations'
      );
      await valuationModal.getByRole('button', { name: /Create|Utwórz/i }).click();
      const valuationCreated = await valuationCreate;
      expect(valuationCreated.status(), await valuationCreated.text()).toBe(201);
      const valuation = (await valuationCreated.json()).data;
      expect(valuation.id).toBeTruthy();
      expect(valuation.businessVersionId).toBeTruthy();
      await expect(page.getByTestId('valuation-workspace')).toBeVisible({ timeout: 30_000 });
      await page.getByRole('tab', { name: /Założenia|Assumptions/i }).click();
      await page.getByTestId('wacc-currency').fill('EUR');
      await page.getByTestId('wacc-risk-free-rate').fill('3.75');
      const valuationWrite = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          new URL(response.url()).pathname ===
            `/api/v8/finance-v2/valuation/variants/${valuation.businessVersionId}/wacc-inputs`
      );
      await page.getByTestId('wacc-save-button').click();
      expect((await valuationWrite).status()).toBe(200);

      const valuationColdContext = await browser.newContext({ storageState });
      const valuationCold = await valuationColdContext.newPage();
      await valuationCold.goto(
        `${WEB_BASE_URL}/finance/valuations/${encodeURIComponent(String(valuation.id))}`
      );
      await expect(valuationCold.getByTestId('valuation-workspace')).toBeVisible({
        timeout: 30_000,
      });
      await valuationCold.getByRole('tab', { name: /Założenia|Assumptions/i }).click();
      await expect(valuationCold.getByTestId('wacc-currency')).toHaveValue('EUR');
      await expect(valuationCold.getByTestId('wacc-risk-free-rate')).toHaveValue('3.75');
      await valuationColdContext.close();

      const persisted = await pool.query<{
        baseline_value: string;
        prediction_version: string;
        initiative_count: number;
        preflight_count: number;
        analysis_value: string;
        valuation_currency: string;
        valuation_risk_free_rate: string;
      }>(
        `SELECT
          (SELECT value_decimal::text FROM finance_baseline_assumptions
            WHERE organization_id=$1 AND business_version_id=$2 LIMIT 1) baseline_value,
          (SELECT authoring_revision FROM finance_prediction_scenarios
            WHERE organization_id=$1 AND business_version_id=$3) prediction_version,
          (SELECT count(*)::int FROM finance_prediction_initiatives
            WHERE organization_id=$1 AND business_version_id=$3) initiative_count,
          (SELECT count(*)::int FROM finance_prediction_preflight_runs
            WHERE organization_id=$1 AND business_version_id=$3) preflight_count,
          (SELECT value_decimal::text FROM finance_analysis_kpi_values
            WHERE organization_id=$1 AND business_version_id=$4 LIMIT 1) analysis_value,
          (SELECT currency FROM finance_valuation_wacc_inputs
            WHERE organization_id=$1 AND business_version_id=$5) valuation_currency,
          (SELECT risk_free_rate_pct::text FROM finance_valuation_wacc_inputs
            WHERE organization_id=$1 AND business_version_id=$5) valuation_risk_free_rate`,
        [
          state.organizationId,
          fixture.baseline.businessVersionId,
          fixture.prediction.businessVersionId,
          fixture.analysis.businessVersionId,
          valuation.businessVersionId,
        ]
      );
      expect(persisted.rows[0]).toEqual({
        baseline_value: '2.5',
        prediction_version: '3',
        initiative_count: 1,
        preflight_count: 1,
        analysis_value: '2',
        valuation_currency: 'EUR',
        valuation_risk_free_rate: '3.75',
      });

      const beforeDenials = await pool.query(
        `SELECT
          (SELECT to_jsonb(a) FROM finance_artifacts a
            WHERE organization_id=$1 AND artifact_id=$2) statement_row,
          (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text),'[]')
            FROM finance_baseline_assumptions a
            WHERE organization_id=$1 AND business_version_id=$3) baseline_rows,
          (SELECT to_jsonb(s) FROM finance_prediction_scenarios s
            WHERE organization_id=$1 AND business_version_id=$4) prediction_scenario,
          (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY to_jsonb(i)::text),'[]')
            FROM finance_prediction_initiatives i
            WHERE organization_id=$1 AND business_version_id=$4) prediction_initiatives,
          (SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text),'[]')
            FROM finance_prediction_driver_overrides o
            WHERE organization_id=$1 AND business_version_id=$4) prediction_overrides,
          (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY to_jsonb(i)::text),'[]')
            FROM finance_prediction_impact_chain i
            WHERE organization_id=$1 AND business_version_id=$4) prediction_impacts,
          (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY to_jsonb(f)::text),'[]')
            FROM finance_prediction_financing f
            WHERE organization_id=$1 AND business_version_id=$4) prediction_financing,
          (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')
            FROM finance_prediction_authoring_receipts r
            WHERE organization_id=$1 AND business_version_id=$4) prediction_receipts,
          (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')
            FROM finance_prediction_preflight_runs r
            WHERE organization_id=$1 AND business_version_id=$4) prediction_preflight_runs,
          (SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY to_jsonb(v)::text),'[]')
            FROM finance_analysis_kpi_values v
            WHERE organization_id=$1 AND business_version_id=$5) analysis_rows`,
        [
          state.organizationId,
          fixture.statement.artifactId,
          fixture.baseline.businessVersionId,
          fixture.prediction.businessVersionId,
          fixture.analysis.businessVersionId,
        ]
      );

      const memberResponse = await request.post(`${API_BASE_URL}/api/test-support/member`, {
        headers: supportHeaders,
        data: { runId: state.runId, role: 'USER' },
      });
      expect(memberResponse.status(), await memberResponse.text()).toBe(201);
      const member = (await memberResponse.json()) as SignedPersona;

      foreignRunId = `fin-bvp-g4-foreign-${Date.now()}`;
      const foreignResponse = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
        headers: supportHeaders,
        data: { runId: foreignRunId, role: 'ADMIN' },
      });
      expect(foreignResponse.status(), await foreignResponse.text()).toBe(200);
      const foreign = (await foreignResponse.json()) as SignedPersona;

      const ownerDraftResponse = await request.get(
        `${API_BASE_URL}/api/v8/finance-v2/prediction/${fixture.prediction.businessVersionId}/authoring`,
        { headers: bearer(state.token) }
      );
      expect(ownerDraftResponse.status(), await ownerDraftResponse.text()).toBe(200);
      const ownerSnapshot = (await ownerDraftResponse.json()).data;
      const predictionCommand = {
        expectedRevision: ownerSnapshot.revision,
        draft: ownerSnapshot.draft,
      };

      const probeWrites = async (token: string, marker: string) => {
        const headers = bearer(token);
        const statement = await request.post(
          `${API_BASE_URL}/api/v8/finance-v2/artifacts/${fixture.statement.artifactId}/rename`,
          { headers, data: { naturalKey: `Denied ${marker}` } }
        );
        const baseline = await request.post(
          `${API_BASE_URL}/api/v8/finance-v2/baseline/${fixture.baseline.businessVersionId}/assumptions`,
          {
            headers,
            data: {
              assumptions: [
                {
                  scheduleType: 'revenue_pvm',
                  driverCode: 'PRICE',
                  entityId: fixture.entityId,
                  periodId: fixture.forecastPeriodId,
                  rule: 'HISTORICAL_AVERAGE',
                  valueStatus: 'PRESENT_NONZERO',
                  valueDecimal: 99,
                  unit: 'EUR',
                  quality: 'ESTIMATED',
                },
              ],
            },
          }
        );
        const prediction = await request.put(
          `${API_BASE_URL}/api/v8/finance-v2/prediction/${fixture.prediction.businessVersionId}/authoring`,
          {
            headers: { ...headers, 'x-idempotency-key': `denied-${marker}-${fixture.runId}` },
            data: predictionCommand,
          }
        );
        const analysis = await request.post(
          `${API_BASE_URL}/api/v8/finance-v2/analysis/${fixture.analysis.businessVersionId}/compute`,
          { headers, data: {} }
        );
        return [statement.status(), baseline.status(), prediction.status(), analysis.status()];
      };

      expect(await probeWrites(member.token, 'member')).toEqual([403, 403, 403, 403]);
      expect(await probeWrites(foreign.token, 'foreign')).toEqual([404, 404, 404, 404]);

      await pool.query(
        `UPDATE organization_members SET status='REVOKED'
          WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, state.userId]
      );
      try {
        expect(await probeWrites(state.token, 'revoked')).toEqual([403, 403, 403, 403]);
      } finally {
        await pool.query(
          `UPDATE organization_members SET status='ACTIVE'
            WHERE organization_id=$1 AND user_id=$2`,
          [state.organizationId, state.userId]
        );
      }

      const afterDenials = await pool.query(
        `SELECT
          (SELECT to_jsonb(a) FROM finance_artifacts a
            WHERE organization_id=$1 AND artifact_id=$2) statement_row,
          (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text),'[]')
            FROM finance_baseline_assumptions a
            WHERE organization_id=$1 AND business_version_id=$3) baseline_rows,
          (SELECT to_jsonb(s) FROM finance_prediction_scenarios s
            WHERE organization_id=$1 AND business_version_id=$4) prediction_scenario,
          (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY to_jsonb(i)::text),'[]')
            FROM finance_prediction_initiatives i
            WHERE organization_id=$1 AND business_version_id=$4) prediction_initiatives,
          (SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text),'[]')
            FROM finance_prediction_driver_overrides o
            WHERE organization_id=$1 AND business_version_id=$4) prediction_overrides,
          (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY to_jsonb(i)::text),'[]')
            FROM finance_prediction_impact_chain i
            WHERE organization_id=$1 AND business_version_id=$4) prediction_impacts,
          (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY to_jsonb(f)::text),'[]')
            FROM finance_prediction_financing f
            WHERE organization_id=$1 AND business_version_id=$4) prediction_financing,
          (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')
            FROM finance_prediction_authoring_receipts r
            WHERE organization_id=$1 AND business_version_id=$4) prediction_receipts,
          (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]')
            FROM finance_prediction_preflight_runs r
            WHERE organization_id=$1 AND business_version_id=$4) prediction_preflight_runs,
          (SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY to_jsonb(v)::text),'[]')
            FROM finance_analysis_kpi_values v
            WHERE organization_id=$1 AND business_version_id=$5) analysis_rows`,
        [
          state.organizationId,
          fixture.statement.artifactId,
          fixture.baseline.businessVersionId,
          fixture.prediction.businessVersionId,
          fixture.analysis.businessVersionId,
        ]
      );
      expect(afterDenials.rows[0]).toEqual(beforeDenials.rows[0]);
    } finally {
      if (foreignRunId) {
        const cleanup = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
          headers: supportHeaders,
          data: { runId: foreignRunId },
        });
        expect(cleanup.status(), await cleanup.text()).toBe(200);
      }
      await releaseFinanceBvpFixture(pool, lockClient);
    }
  });
});
