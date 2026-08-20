import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext } from '@playwright/test';
import { Pool, type PoolClient } from 'pg';

const DB_NAME_RE = /^fin_bvp_g4_[a-z0-9_]+$/;
const LOCK_NAME = 'FIN-BVP-G4:five-workspaces';

export const FIN_BVP_G4_FLAGS = [
  'financeAnalysisWorkspaceV1',
  'financeBaselineWorkspaceV1',
  'financePredictionWorkspaceV1',
  'financeStatementPackWorkspaceV2',
  'financeWorkspacePlatformV1',
] as const;

export type FinanceBvpFixture = {
  runId: string;
  statement: { legacyId: string; artifactId: string; businessVersionId: string };
  analysis: { legacyId: string; artifactId: string; businessVersionId: string };
  baseline: { legacyId: string; artifactId: string; businessVersionId: string };
  prediction: { legacyId: string; artifactId: string; businessVersionId: string };
  entityId: string;
  openingPeriodId: string;
  forecastPeriodId: string;
};

export function assertFinanceBvpDatabase(): string {
  const databaseUrl = String(process.env.DATABASE_URL || '');
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!databaseUrl || !DB_NAME_RE.test(databaseName)) {
    throw new Error('Finance BVP G4 requires DATABASE_URL database fin_bvp_g4_*');
  }
  return databaseUrl;
}

export async function enableFinanceBvpFlags(
  request: APIRequestContext,
  apiBaseUrl: string,
  testSupportKey: string,
  organizationId: string,
  runId: string
): Promise<void> {
  for (const flagKey of FIN_BVP_G4_FLAGS) {
    const response = await request.post(`${apiBaseUrl}/api/test-support/org-feature-flag`, {
      headers: { 'x-test-support-key': testSupportKey },
      data: { flagKey, organizationId, runId, enabled: true },
    });
    expect(response.status(), `enable ${flagKey}`).toBe(200);
  }
}

export async function seedFinanceBvpFixture(
  organizationId: string,
  userId: string
): Promise<{ fixture: FinanceBvpFixture; pool: Pool; lockClient: PoolClient }> {
  const databaseUrl = assertFinanceBvpDatabase();
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const lockClient = await pool.connect();
  const database = await lockClient.query<{ name: string }>('SELECT current_database() AS name');
  if (!DB_NAME_RE.test(database.rows[0]?.name || ''))
    throw new Error('Unsafe Finance BVP database');
  const locked = await lockClient.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
    [LOCK_NAME]
  );
  if (!locked.rows[0]?.locked) {
    lockClient.release();
    await pool.end();
    throw new Error('Finance BVP fixture is already running');
  }
  const releaseFailedSeed = async () => {
    await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]);
    lockClient.release();
    await pool.end();
  };

  const runId = `fin-bvp-g4-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const artifactService =
    await import('../../../server/src/services/finance/canonical/artifactVersionService');
  const make = async (
    artifactType:
      | 'STATEMENT_PACK'
      | 'HISTORICAL_ANALYSIS'
      | 'BASELINE_MODEL'
      | 'PREDICTION_SCENARIO'
  ) => artifactService.createArtifact({ organizationId, artifactType, createdBy: userId });
  const [
    statement,
    sourceAnalysis,
    workspaceAnalysis,
    baseline,
    predictionSourceBaseline,
    prediction,
  ] = await Promise.all([
    make('STATEMENT_PACK'),
    make('HISTORICAL_ANALYSIS'),
    make('HISTORICAL_ANALYSIS'),
    make('BASELINE_MODEL'),
    make('BASELINE_MODEL'),
    make('PREDICTION_SCENARIO'),
  ]).catch(async (error) => {
    await releaseFailedSeed();
    throw error;
  });
  const identity = (created: Awaited<ReturnType<typeof make>>, suffix: string) => ({
    legacyId: `${runId}-${suffix}`,
    artifactId: created.artifact.artifact_id,
    businessVersionId: created.businessVersion.business_version_id,
  });
  const fixture: FinanceBvpFixture = {
    runId,
    statement: identity(statement, 'statement'),
    analysis: identity(workspaceAnalysis, 'analysis'),
    baseline: identity(baseline, 'baseline'),
    prediction: identity(prediction, 'prediction'),
    entityId: '',
    openingPeriodId: '',
    forecastPeriodId: '',
  };
  const sourceAnalysisId = sourceAnalysis.businessVersion.business_version_id;
  const predictionSourceBaselineId = predictionSourceBaseline.businessVersion.business_version_id;

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (error) {
    await releaseFailedSeed();
    throw error;
  }
  let clientReleased = false;
  try {
    await client.query('BEGIN');
    const calendar = await client.query<{ fiscal_calendar_id: string }>(
      `INSERT INTO finance_stmt_calendars
        (organization_id,calendar_type,fiscal_year_end_month,fiscal_year_end_reference,effective_from,created_by)
       VALUES($1,'STANDARD',12,'LAST_DAY_OF_MONTH','2025-01-01',$2)
       RETURNING fiscal_calendar_id`,
      [organizationId, userId]
    );
    const entity = await client.query<{ id: string }>(
      `INSERT INTO finance_stmt_entities
        (organization_id,business_version_id,entity_code,legal_name,role,consolidation_method,functional_currency,created_by)
       VALUES($1,$2,$3,$4,'GROUP_PARENT','NOT_CONSOLIDATED','EUR',$5) RETURNING id`,
      [
        organizationId,
        fixture.statement.businessVersionId,
        `${runId}-entity`,
        `G4 Entity ${runId}`,
        userId,
      ]
    );
    const opening = await client.query<{ period_id: string }>(
      `INSERT INTO finance_stmt_periods
        (organization_id,fiscal_calendar_id,period_type,fiscal_year,fiscal_month,period_start,period_end,label,created_by)
       VALUES($1,$2,'MONTH',2025,12,'2025-12-01','2025-12-31','12/2025',$3) RETURNING period_id`,
      [organizationId, calendar.rows[0].fiscal_calendar_id, userId]
    );
    const forecast = await client.query<{ period_id: string }>(
      `INSERT INTO finance_stmt_periods
        (organization_id,fiscal_calendar_id,period_type,fiscal_year,fiscal_month,period_start,period_end,label,previous_period_id,created_by)
       VALUES($1,$2,'MONTH',2026,1,'2026-01-01','2026-01-31','01/2026',$3,$4) RETURNING period_id`,
      [organizationId, calendar.rows[0].fiscal_calendar_id, opening.rows[0].period_id, userId]
    );
    fixture.entityId = entity.rows[0].id;
    fixture.openingPeriodId = opening.rows[0].period_id;
    fixture.forecastPeriodId = forecast.rows[0].period_id;
    const bsLines = await client.query<{ id: string; line_code: string }>(
      `SELECT id,line_code FROM financial_statement_lines
        WHERE line_code IN ('CURRENT_ASSETS','CURRENT_LIABILITIES') ORDER BY line_code`
    );
    if (bsLines.rows.length !== 2) throw new Error('Required analysis BS catalog rows are missing');
    for (const row of bsLines.rows) {
      await client.query(
        `INSERT INTO finance_stmt_lines
        (id,organization_id,business_version_id,statement_type,canonical_line_id,entity_id,period_id,
         value_status,value_decimal,native_currency,presentation_currency,unit,accounting_policy,created_by)
       VALUES($1,$2,$3,'BS',$4,$5,$6,'PRESENT_NONZERO',$7,'EUR','EUR','UNITS','IFRS',$8)`,
        [
          randomUUID(),
          organizationId,
          fixture.statement.businessVersionId,
          row.id,
          fixture.entityId,
          fixture.openingPeriodId,
          row.line_code === 'CURRENT_ASSETS' ? 500000 : 250000,
          userId,
        ]
      );
    }
    for (const baselineVersionId of [
      fixture.baseline.businessVersionId,
      predictionSourceBaselineId,
    ]) {
      await client.query(
        `INSERT INTO finance_baseline_models
        (organization_id,business_version_id,horizon_months,horizon_rationale,
         horizon_rationale_note,created_by)
       VALUES($1,$2,1,'STEADY_STATE','Signed G4 one-month horizon',$3)`,
        [organizationId, baselineVersionId, userId]
      );
      await client.query(
        `INSERT INTO finance_baseline_assumptions
        (id,organization_id,business_version_id,schedule_type,driver_code,entity_id,period_id,rule,
         value_status,value_decimal,unit,quality,created_by)
       VALUES($1,$2,$3,'revenue_pvm','PRICE',$4,$5,'HISTORICAL_AVERAGE',
              'PRESENT_NONZERO',1,'EUR','ESTIMATED',$6)`,
        [
          randomUUID(),
          organizationId,
          baselineVersionId,
          fixture.entityId,
          fixture.forecastPeriodId,
          userId,
        ]
      );
    }
    await client.query(`SET LOCAL session_replication_role=replica`);
    await client.query(
      `UPDATE finance_business_versions SET status='APPROVED'
        WHERE organization_id=$1 AND business_version_id=ANY($2::text[])`,
      [
        organizationId,
        [fixture.statement.businessVersionId, sourceAnalysisId, predictionSourceBaselineId],
      ]
    );
    await client.query(`SET LOCAL session_replication_role=origin`);
    const edges = [
      [
        fixture.statement.businessVersionId,
        'STATEMENT_PACK',
        sourceAnalysisId,
        'HISTORICAL_ANALYSIS',
        'STATEMENT_TO_ANALYSIS',
        null,
      ],
      [
        fixture.statement.businessVersionId,
        'STATEMENT_PACK',
        fixture.baseline.businessVersionId,
        'BASELINE_MODEL',
        'STATEMENT_TO_MODEL',
        null,
      ],
      [
        sourceAnalysisId,
        'HISTORICAL_ANALYSIS',
        fixture.baseline.businessVersionId,
        'BASELINE_MODEL',
        'ANALYSIS_TO_MODEL',
        'c'.repeat(64),
      ],
      [
        fixture.statement.businessVersionId,
        'STATEMENT_PACK',
        predictionSourceBaselineId,
        'BASELINE_MODEL',
        'STATEMENT_TO_MODEL',
        null,
      ],
      [
        sourceAnalysisId,
        'HISTORICAL_ANALYSIS',
        predictionSourceBaselineId,
        'BASELINE_MODEL',
        'ANALYSIS_TO_MODEL',
        'e'.repeat(64),
      ],
      [
        fixture.statement.businessVersionId,
        'STATEMENT_PACK',
        fixture.analysis.businessVersionId,
        'HISTORICAL_ANALYSIS',
        'STATEMENT_TO_ANALYSIS',
        null,
      ],
      [
        predictionSourceBaselineId,
        'BASELINE_MODEL',
        fixture.prediction.businessVersionId,
        'PREDICTION_SCENARIO',
        'MODEL_TO_SCENARIO',
        'd'.repeat(64),
      ],
    ];
    for (const [source, sourceType, target, targetType, edgeType, hash] of edges) {
      await client.query(
        `INSERT INTO finance_lineage_edges
          (id,organization_id,source_version_id,source_artifact_type,target_version_id,target_artifact_type,
           edge_type,transformation_kind,assumption_snapshot_hash,author_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,'COMPUTE',$8,$9)`,
        [
          randomUUID(),
          organizationId,
          source,
          sourceType,
          target,
          targetType,
          edgeType,
          hash,
          userId,
        ]
      );
    }
    for (const baselineVersionId of [
      fixture.baseline.businessVersionId,
      predictionSourceBaselineId,
    ]) {
      await client.query(
        `INSERT INTO finance_baseline_workspace_contexts
        (organization_id,business_version_id,source_statement_version_id,source_analysis_version_id,
         entity_id,opening_balance_sheet_period_id,forecast_period_ids,version,configured_by)
       VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,1,$8)`,
        [
          organizationId,
          baselineVersionId,
          fixture.statement.businessVersionId,
          sourceAnalysisId,
          fixture.entityId,
          fixture.openingPeriodId,
          JSON.stringify([fixture.forecastPeriodId]),
          userId,
        ]
      );
    }
    await client.query(
      `INSERT INTO finance_prediction_scenarios
        (id,organization_id,business_version_id,name,description,scenario_mode,created_by)
       VALUES($1,$2,$3,$4,$5,'FUNDAMENTAL_INITIATIVE',$6)`,
      [
        randomUUID(),
        organizationId,
        fixture.prediction.businessVersionId,
        `Prediction ${runId}`,
        'Signed G4 prediction draft',
        userId,
      ]
    );
    await client.query(
      `INSERT INTO finance_analysis_definitions
        (organization_id,business_version_id,purpose,analysis_type,entity_scope_mode,
         presentation_currency,unit,created_by)
       VALUES($1,$2,'INTERNAL_REVIEW','STANDARD','GROUP_CONSOLIDATED','EUR','UNITS',$3)`,
      [organizationId, fixture.analysis.businessVersionId, userId]
    );
    const currentRatio = await client.query<{ id: string }>(
      `SELECT id FROM finance_analysis_kpi_catalog
        WHERE kpi_code='CURRENT_RATIO' AND status='ACTIVE' ORDER BY id LIMIT 1`
    );
    await client.query(
      `INSERT INTO finance_analysis_kpi_values
        (organization_id,business_version_id,kpi_catalog_id,entity_id,period_id)
       VALUES($1,$2,$3,$4,$5)`,
      [
        organizationId,
        fixture.analysis.businessVersionId,
        currentRatio.rows[0].id,
        fixture.entityId,
        fixture.openingPeriodId,
      ]
    );
    await client.query(
      `INSERT INTO financial_statement_packs
        (id,organization_id,entity_name,period_start,period_end,period_label,currency,scaling,
         pack_status,pack_readiness_status,pack_readiness_score,source_statement_count,missing_statement_types)
       VALUES($1,$2,$3,'2025-01-01','2025-12-31','FY 2025','EUR','units','confirmed','ready',100,1,'[]')`,
      [fixture.statement.legacyId, organizationId, `Statement ${runId}`]
    );
    await client.query(
      `INSERT INTO financial_analyses
        (id,organization_id,title,status,analysis_type,periods,statement_data,currency,created_by)
       VALUES($1,$2,$3,'DRAFT','comprehensive','[]','{}','EUR',$4)`,
      [fixture.analysis.legacyId, organizationId, `Analysis ${runId}`, userId]
    );
    for (const item of [fixture.baseline, fixture.prediction]) {
      await client.query(
        `INSERT INTO financial_models
          (id,organization_id,name,start_date,status,scenario,currency,horizon_months,created_by)
         VALUES($1,$2,$3,'2026-01-01','draft','base','EUR',1,$4)`,
        [
          item.legacyId,
          organizationId,
          `${item === fixture.baseline ? 'Baseline' : 'Prediction'} ${runId}`,
          userId,
        ]
      );
    }
    for (const [legacyTable, item] of [
      ['financial_statement_packs', fixture.statement],
      ['financial_analyses', fixture.analysis],
      ['financial_models', fixture.baseline],
      ['financial_models', fixture.prediction],
    ] as const) {
      await client.query(
        `INSERT INTO finance_artifact_aliases
          (legacy_table,legacy_id,legacy_version,artifact_id,organization_id,business_version_id,
           mapping_confidence,mapping_reason,created_by)
         VALUES($1,$2,'',$3,$4,$5,'AUTO_MIGRATE',$6,$7)`,
        [
          legacyTable,
          item.legacyId,
          item.artifactId,
          organizationId,
          item.businessVersionId,
          `signed G4 ${runId}`,
          userId,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    clientReleased = true;
    await releaseFailedSeed();
    throw error;
  } finally {
    if (!clientReleased) client.release();
  }
  return { fixture, pool, lockClient };
}

export async function releaseFinanceBvpFixture(pool: Pool, lockClient: PoolClient): Promise<void> {
  try {
    const unlocked = await lockClient.query<{ unlocked: boolean }>(
      'SELECT pg_advisory_unlock(hashtext($1)) AS unlocked',
      [LOCK_NAME]
    );
    expect(unlocked.rows[0]?.unlocked).toBe(true);
  } finally {
    lockClient.release();
    await pool.end();
  }
}
