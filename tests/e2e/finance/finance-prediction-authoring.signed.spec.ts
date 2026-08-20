import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import { getAuthHeader, readTestSupportState } from '../_helpers/testSupportState';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3459';
const WEB = process.env.E2E_BASE_URL || 'http://127.0.0.1:3460';

test('signed Prediction authoring saves, preflights, calculates and cold-reopens canonical results', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const state = readTestSupportState();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const headers = getAuthHeader();
  const create = async (artifactType: string) => {
    const response = await request.post(`${API}/api/v8/finance-v2/artifacts`, {
      headers,
      data: { artifactType },
    });
    expect(response.status()).toBe(201);
    const data = (await response.json()).data as {
      artifactId: string;
      currentBusinessVersion: { businessVersionId: string };
    };
    return {
      artifactId: data.artifactId,
      businessVersionId: data.currentBusinessVersion.businessVersionId,
    };
  };

  const statement = await create('STATEMENT_PACK');
  const baseline = await create('BASELINE_MODEL');
  const prediction = await create('PREDICTION_SCENARIO');
  const ids = {
    calendar: `cal-${randomUUID()}`,
    entity: `entity-${randomUUID()}`,
    opening: `period-${randomUUID()}`,
    forecast: `period-${randomUUID()}`,
  };

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO finance_stmt_calendars
          (fiscal_calendar_id,organization_id,calendar_type,fiscal_year_end_month,effective_from,created_by)
         VALUES ($1,$2,'STANDARD',12,'2025-01-01',$3)`,
        [ids.calendar, state.organizationId, state.userId]
      );
      await client.query(
        `INSERT INTO finance_stmt_entities
          (id,organization_id,business_version_id,entity_code,legal_name,role,consolidation_method,ownership_pct,functional_currency,created_by)
         VALUES ($1,$2,$3,$4,'Prediction E2E entity','GROUP_PARENT','FULL',100,'PLN',$5)`,
        [
          ids.entity,
          state.organizationId,
          statement.businessVersionId,
          `ENTITY-${randomUUID()}`,
          state.userId,
        ]
      );
      await client.query(
        `INSERT INTO finance_stmt_periods
          (period_id,organization_id,fiscal_calendar_id,period_type,fiscal_year,fiscal_month,period_start,period_end,label,created_by)
         VALUES ($1,$2,$3,'MONTH',2025,12,'2025-12-01','2025-12-31','Dec 2025',$4),
                ($5,$2,$3,'MONTH',2026,1,'2026-01-01','2026-01-31','Jan 2026',$4)`,
        [ids.opening, state.organizationId, ids.calendar, state.userId, ids.forecast]
      );
      const line = (
        await client.query<{ id: string }>(
          `SELECT id FROM financial_statement_lines WHERE line_code='REVENUE' LIMIT 1`
        )
      ).rows[0];
      if (!line) throw new Error('REVENUE taxonomy missing');
      await client.query(
        `INSERT INTO finance_stmt_lines
          (id,organization_id,business_version_id,statement_type,canonical_line_id,entity_id,period_id,
           consolidation_scope,value_status,value_decimal,native_currency,presentation_currency,unit,accounting_policy,created_by)
         VALUES ($1,$2,$3,'P&L',$4,$5,$6,'CONSOLIDATED','PRESENT_NONZERO',100,'PLN','PLN','UNITS','IFRS',$7)`,
        [
          randomUUID(),
          state.organizationId,
          statement.businessVersionId,
          line.id,
          ids.entity,
          ids.opening,
          state.userId,
        ]
      );
      await client.query(
        `INSERT INTO finance_baseline_outputs
          (id,organization_id,business_version_id,statement_type,canonical_line_id,entity_id,period_id,
           consolidation_scope,value_status,value_decimal,native_currency,presentation_currency,unit,multiplier,value_kind,created_by)
         VALUES ($1,$2,$3,'P&L',$4,$5,$6,'CONSOLIDATED','PRESENT_NONZERO',123,'PLN','PLN','UNITS',1,'FORECAST',$7)`,
        [
          randomUUID(),
          state.organizationId,
          baseline.businessVersionId,
          line.id,
          ids.entity,
          ids.forecast,
          state.userId,
        ]
      );
      await client.query(
        `INSERT INTO finance_lineage_edges
          (id,organization_id,source_version_id,source_artifact_type,target_version_id,target_artifact_type,
           edge_type,transformation_kind,assumption_snapshot_hash,author_id)
         VALUES ($1,$2,$3,'STATEMENT_PACK',$4,'BASELINE_MODEL','STATEMENT_TO_MODEL','COMPUTE',NULL,$5),
                ($6,$2,$4,'BASELINE_MODEL',$7,'PREDICTION_SCENARIO','MODEL_TO_SCENARIO','MANUAL_LINK',repeat('a',64),$5)`,
        [
          randomUUID(),
          state.organizationId,
          statement.businessVersionId,
          baseline.businessVersionId,
          state.userId,
          randomUUID(),
          prediction.businessVersionId,
        ]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await page.addInitScript(() => {
      localStorage.setItem(
        'consultify_feature_flags',
        JSON.stringify({ financePredictionWorkspaceV1: true })
      );
    });
    await page.goto(
      `${WEB}/finance?tab=prediction&canonicalArtifactType=PREDICTION_SCENARIO&canonicalArtifactId=${encodeURIComponent(prediction.artifactId)}&canonicalBusinessVersionId=${encodeURIComponent(prediction.businessVersionId)}`
    );
    await expect(page.getByTestId('prediction-canonical-authoring-banner')).toContainText(
      'Rewizja authoringu: 0',
      { timeout: 30_000 }
    );
    const skipOnboarding = page.getByRole('button', { name: 'Skip for now' });
    await skipOnboarding.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
    if (await skipOnboarding.isVisible()) {
      await skipOnboarding.click();
      await expect(skipOnboarding).toBeHidden();
    }

    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname.endsWith(
          `/prediction/${prediction.businessVersionId}/authoring`
        )
    );
    await page.getByTestId('prediction-save-authoring').click();
    expect((await saveResponse).status()).toBe(200);
    await expect(page.getByTestId('prediction-canonical-authoring-banner')).toContainText(
      'Rewizja authoringu: 1'
    );

    const preflightResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(
        `/prediction/${prediction.businessVersionId}/preflight`
      )
    );
    await page.getByRole('button', { name: /Uruchom preflight/i }).click();
    expect((await preflightResponse).status()).toBe(201);
    await expect(page.getByTestId('prediction-status-message')).toContainText('Preflight: 0');

    const calculateResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(
        `/prediction/${prediction.businessVersionId}/calculate`
      )
    );
    await page.getByRole('button', { name: /Przelicz scenariusz/i }).click();
    expect((await calculateResponse).status()).toBe(200);
    await expect(page.getByTestId('prediction-status-message')).toContainText(
      'potwierdzone odczytem kanonicznych wyników'
    );
    await expect(page.getByTestId('prediction-results-view')).toContainText('REVENUE');
    await expect(page.getByTestId('prediction-results-view')).toContainText('123');

    await page.reload();
    await expect(page.getByTestId('prediction-canonical-authoring-banner')).toContainText(
      'Rewizja authoringu: 1',
      { timeout: 30_000 }
    );
    await page.getByRole('tab', { name: /Modele.*Wyniki/i }).click();
    await expect(page.getByTestId('prediction-results-view')).toContainText('REVENUE');

    const persisted = await pool.query<{ revision: string; receipts: string; outputs: string }>(
      `SELECT s.authoring_revision::text AS revision,
              (SELECT count(*)::text FROM finance_prediction_authoring_receipts r WHERE r.organization_id=s.organization_id AND r.business_version_id=s.business_version_id) receipts,
              (SELECT count(*)::text FROM compute_job_outputs o WHERE o.organization_id=s.organization_id AND o.output_business_version_id=s.business_version_id) outputs
         FROM finance_prediction_scenarios s WHERE s.organization_id=$1 AND s.business_version_id=$2`,
      [state.organizationId, prediction.businessVersionId]
    );
    expect(persisted.rows[0]).toEqual({ revision: '1', receipts: '1', outputs: '1' });
  } finally {
    await pool.end();
  }
});
