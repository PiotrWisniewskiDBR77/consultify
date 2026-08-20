import crypto, { randomUUID } from 'node:crypto';

import {
  withPinnedPostgresTransaction,
  type PinnedTransactionClient,
} from '../../../database/PostgresDatabase.js';
import { assertFinanceEditor } from './valuationLegacySuccessorService.js';

const MODES = new Set([
  'STANDARD_BASE',
  'STANDARD_UPSIDE',
  'STANDARD_DOWNSIDE',
  'DRIVER_OVERRIDE',
  'FUNDAMENTAL_INITIATIVE',
]);
const SCHEDULES = new Set([
  'revenue_pvm',
  'headcount',
  'cogs_opex',
  'wc_dso_dio_dpo',
  'capex_depreciation',
  'leases',
  'debt_maturity',
  'tax_nol',
  'equity_re',
]);
const FINANCING = new Set([
  'FACILITY_DRAWDOWN',
  'DISCRETIONARY_REPAYMENT',
  'EQUITY_INJECTION',
  'DIVIDEND_DECLARATION',
  'SHARE_BUYBACK',
  'SURPLUS_ALLOCATION_POLICY',
  'COVENANT_DEFINITION',
  'MIN_CASH_POLICY',
]);
const HORIZON_FINANCING = new Set([
  'SURPLUS_ALLOCATION_POLICY',
  'COVENANT_DEFINITION',
  'MIN_CASH_POLICY',
]);

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(',')}}`;
}
const digest = (value: unknown) =>
  crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
const text = (value: unknown, field: string, max = 500): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    fail('PREDICTION_INPUT_INVALID', `${field} must be a non-empty string up to ${max} characters`);
  }
  return value.trim();
};
const nullableText = (value: unknown, field: string, max = 2000): string | null => {
  if (value === null || value === undefined || value === '') return null;
  return text(value, field, max);
};
const nullableNumber = (value: unknown, field: string): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail('PREDICTION_INPUT_INVALID', `${field} must be finite`);
  return value;
};
const nullableInteger = (value: unknown, field: string, min = 0): number | null => {
  const number = nullableNumber(value, field);
  if (number !== null && (!Number.isInteger(number) || number < min)) {
    fail('PREDICTION_INPUT_INVALID', `${field} must be an integer >= ${min}`);
  }
  return number;
};
const nullablePercent = (value: unknown, field: string): number | null => {
  const number = nullableNumber(value, field);
  if (number !== null && (number < 0 || number > 100)) {
    fail('PREDICTION_INPUT_INVALID', `${field} must be between 0 and 100`);
  }
  return number;
};
const boundedRows = (value: unknown, field: string, max: number): any[] => {
  if (!Array.isArray(value) || value.length > max)
    fail('PREDICTION_INPUT_INVALID', `${field} must be an array with at most ${max} rows`);
  return value;
};

async function assertVersion(
  tx: PinnedTransactionClient,
  organizationId: string,
  businessVersionId: string
) {
  const version = await tx.queryOne<any>(
    `SELECT bv.business_version_id,bv.artifact_id,bv.status,a.artifact_type
       FROM finance_business_versions bv
       JOIN finance_artifacts a ON a.artifact_id=bv.artifact_id AND a.organization_id=bv.organization_id
      WHERE bv.organization_id=? AND bv.business_version_id=? FOR SHARE`,
    [organizationId, businessVersionId]
  );
  if (!version || version.artifact_type !== 'PREDICTION_SCENARIO')
    fail('PREDICTION_NOT_FOUND', 'Prediction business version not found');
  return version;
}

async function readDraftTx(
  tx: PinnedTransactionClient,
  organizationId: string,
  businessVersionId: string
) {
  const context = await tx.queryOne<any>(
    `SELECT model_edge.source_version_id AS baseline_version_id,
            statement_edge.source_version_id AS statement_version_id,
            model.horizon_months
       FROM finance_lineage_edges model_edge
       LEFT JOIN finance_baseline_models model
         ON model.organization_id=model_edge.organization_id
        AND model.business_version_id=model_edge.source_version_id
       LEFT JOIN finance_lineage_edges statement_edge
         ON statement_edge.organization_id=model_edge.organization_id
        AND statement_edge.target_version_id=model_edge.source_version_id
        AND statement_edge.edge_type='STATEMENT_TO_MODEL'
      WHERE model_edge.organization_id=? AND model_edge.target_version_id=?
        AND model_edge.edge_type='MODEL_TO_SCENARIO'`,
    [organizationId, businessVersionId]
  );
  const baselineCells = context?.baseline_version_id
    ? await tx.queryAll<any>(
        `SELECT DISTINCT entity_id,period_id
           FROM finance_baseline_outputs
          WHERE organization_id=? AND business_version_id=?
          ORDER BY entity_id,period_id`,
        [organizationId, context.baseline_version_id]
      )
    : [];
  let entityIds = [...new Set(baselineCells.map((row: any) => String(row.entity_id)))];
  let periodIds = [...new Set(baselineCells.map((row: any) => String(row.period_id)))];
  let orderedPeriods = periodIds.length
    ? await tx.queryAll<any>(
        `SELECT period_id,period_start,period_end
           FROM finance_stmt_periods
          WHERE organization_id=? AND period_id=ANY(?::text[])
          ORDER BY period_start,period_id`,
        [organizationId, periodIds]
      )
    : [];
  if (!entityIds.length && context?.statement_version_id) {
    const sourceEntities = await tx.queryAll<any>(
      `SELECT DISTINCT entity_id FROM finance_stmt_lines
        WHERE organization_id=? AND business_version_id=? ORDER BY entity_id`,
      [organizationId, context.statement_version_id]
    );
    entityIds = sourceEntities.map((row: any) => String(row.entity_id));
  }
  let firstForecastStart = orderedPeriods[0]?.period_start ?? null;
  let opening = context?.statement_version_id
    ? await tx.queryOne<any>(
        `SELECT p.period_id,p.period_end,p.fiscal_calendar_id
           FROM finance_stmt_lines l
           JOIN finance_stmt_periods p ON p.period_id=l.period_id AND p.organization_id=l.organization_id
          WHERE l.organization_id=? AND l.business_version_id=?
            AND l.entity_id=? ${firstForecastStart ? 'AND p.period_end < ?' : ''}
          ORDER BY p.period_end DESC,p.period_id DESC LIMIT 1`,
        firstForecastStart
          ? [organizationId, context.statement_version_id, entityIds[0] ?? '', firstForecastStart]
          : [organizationId, context.statement_version_id, entityIds[0] ?? '']
      )
    : null;
  if (
    !orderedPeriods.length &&
    opening?.period_end &&
    opening?.fiscal_calendar_id &&
    Number(context?.horizon_months) > 0
  ) {
    orderedPeriods = await tx.queryAll<any>(
      `SELECT period_id,period_start,period_end
         FROM finance_stmt_periods
        WHERE organization_id=? AND fiscal_calendar_id=? AND period_start>?
        ORDER BY period_start,period_id LIMIT ?`,
      [
        organizationId,
        opening.fiscal_calendar_id,
        opening.period_end,
        Number(context.horizon_months),
      ]
    );
    periodIds = orderedPeriods.map((row: any) => String(row.period_id));
    firstForecastStart = orderedPeriods[0]?.period_start ?? null;
  }
  const scenario = await tx.queryOne<any>(
    `SELECT business_version_id,name,description,scenario_mode,authoring_revision,updated_at
       FROM finance_prediction_scenarios WHERE organization_id=? AND business_version_id=?`,
    [organizationId, businessVersionId]
  );
  if (!scenario)
    return {
      configured: false,
      businessVersionId,
      revision: 0,
      draft: null,
      computeContext: {
        ready: entityIds.length > 0 && orderedPeriods.length > 0 && Boolean(opening?.period_id),
        entityIds,
        forecastPeriodIds: orderedPeriods.map((row: any) => String(row.period_id)),
        openingBalanceSheetPeriodId: opening?.period_id ?? null,
      },
      results: { scenarioValues: {}, baselineValues: {} },
    };
  const overrides = await tx.queryAll<any>(
    `SELECT o.id,o.schedule_type,o.driver_code,o.entity_id,o.period_id,o.override_source,
            o.value_status,o.value_decimal,o.unit,o.baseline_value_decimal,o.rationale,
            l.line_code AS canonical_line_code
       FROM finance_prediction_driver_overrides o
       LEFT JOIN financial_statement_lines l ON l.id=o.canonical_line_id
      WHERE o.organization_id=? AND o.business_version_id=? ORDER BY o.id`,
    [organizationId, businessVersionId]
  );
  const initiatives = await tx.queryAll<any>(
    `SELECT * FROM finance_prediction_initiatives
      WHERE organization_id=? AND business_version_id=? ORDER BY initiative_code,id`,
    [organizationId, businessVersionId]
  );
  const impacts = await tx.queryAll<any>(
    `SELECT i.*,l.line_code AS statement_line_code
       FROM finance_prediction_impact_chain i
       JOIN financial_statement_lines l ON l.id=i.statement_line_id
      WHERE i.organization_id=? AND i.business_version_id=? ORDER BY i.id`,
    [organizationId, businessVersionId]
  );
  const financing = await tx.queryAll<any>(
    `SELECT * FROM finance_prediction_financing
      WHERE organization_id=? AND business_version_id=? ORDER BY id`,
    [organizationId, businessVersionId]
  );
  const computed = await tx.queryOne<any>(
    `SELECT max(o.committed_at)::text AS completed_at
       FROM compute_job_outputs o
      WHERE o.organization_id=? AND o.output_business_version_id=?`,
    [organizationId, businessVersionId]
  );
  const effectiveRows = await tx.queryAll<any>(
    `SELECT lines.line_code,v.period_id,v.value_decimal,v.variance_vs_baseline_decimal
       FROM finance_prediction_outputs_effective v
       JOIN financial_statement_lines lines ON lines.id=v.canonical_line_id
      WHERE v.business_version_id=? AND v.entity_id=?
      ORDER BY v.period_id,lines.line_code`,
    [businessVersionId, entityIds[0] ?? '']
  );
  const scenarioValues: Record<string, number> = {};
  const baselineValues: Record<string, number> = {};
  for (const row of effectiveRows) {
    if (row.value_decimal === null) continue;
    const key = `${row.line_code}::${row.period_id}`;
    const value = Number(row.value_decimal);
    scenarioValues[key] = value;
    baselineValues[key] =
      row.variance_vs_baseline_decimal === null
        ? value
        : value - Number(row.variance_vs_baseline_decimal);
  }
  return {
    configured: true,
    businessVersionId,
    revision: Number(scenario.authoring_revision),
    computeContext: {
      ready: entityIds.length > 0 && orderedPeriods.length > 0 && Boolean(opening?.period_id),
      entityIds,
      forecastPeriodIds: orderedPeriods.map((row: any) => String(row.period_id)),
      openingBalanceSheetPeriodId: opening?.period_id ?? null,
    },
    results: { scenarioValues, baselineValues },
    draft: {
      businessVersionId,
      scenarioMode: scenario.scenario_mode,
      name: scenario.name,
      driverOverrides: overrides.map((row: any) => ({
        id: row.id,
        scheduleType: row.schedule_type,
        driverCode: row.driver_code,
        entityId: row.entity_id,
        periodId: row.period_id,
        overrideSource: row.override_source,
        valueStatus: row.value_status,
        valueDecimal: row.value_decimal === null ? null : Number(row.value_decimal),
        unit: row.unit,
        baselineValueDecimal:
          row.baseline_value_decimal === null ? null : Number(row.baseline_value_decimal),
        rationale: row.rationale,
        canonicalLineCode: row.canonical_line_code ?? '',
      })),
      initiatives: initiatives.map((row: any) => ({
        id: row.id,
        initiativeCode: row.initiative_code,
        name: row.name,
        description: row.description,
        source: row.source,
        owner: row.owner,
        confidencePct: row.confidence_pct === null ? null : Number(row.confidence_pct),
        defaultStartPeriodId: row.default_start_period_id,
        defaultRampMonths: row.default_ramp_months,
        defaultDurationMonths: row.default_duration_months,
        implementationCostDecimal:
          row.implementation_cost_decimal === null ? null : Number(row.implementation_cost_decimal),
        status: row.status,
      })),
      impacts: impacts.map((row: any) => ({
        id: row.id,
        initiativeId: row.initiative_id,
        assumptionLabel: row.assumption_label,
        driverScheduleType: row.driver_schedule_type,
        driverCode: row.driver_code,
        kpiCatalogId: row.kpi_catalog_id,
        statementLineCode: row.statement_line_code,
        entityId: row.entity_id,
        amountKind: row.amount_kind,
        amountDecimal: Number(row.amount_decimal),
        amountUnit: row.amount_unit,
        sign: row.sign,
        startPeriodId: row.start_period_id,
        rampMonths: row.ramp_months,
        durationMonths: row.duration_months,
        decayPctPerPeriod:
          row.decay_pct_per_period === null ? null : Number(row.decay_pct_per_period),
        implementationCostDecimal:
          row.implementation_cost_decimal === null ? null : Number(row.implementation_cost_decimal),
        confidencePct: row.confidence_pct === null ? null : Number(row.confidence_pct),
        probabilityPct: row.probability_pct === null ? null : Number(row.probability_pct),
        cannibalizesImpactId: row.cannibalizes_impact_id,
      })),
      financing: financing.map((row: any) => ({
        id: row.id,
        financingKind: row.financing_kind,
        entityId: row.entity_id,
        periodId: row.period_id,
        payload: row.payload,
        rationale: row.rationale,
      })),
      lastAssumptionChangeAt: new Date(scenario.updated_at).toISOString(),
      lastComputeAt: computed?.completed_at ?? null,
    },
  };
}

export async function readPredictionAuthoring(organizationId: string, businessVersionId: string) {
  return withPinnedPostgresTransaction(async (tx) => {
    await assertVersion(tx, organizationId, businessVersionId);
    return readDraftTx(tx, organizationId, businessVersionId);
  });
}

export async function savePredictionAuthoring(params: {
  organizationId: string;
  userId: string;
  businessVersionId: string;
  idempotencyKey: string;
  expectedRevision: number;
  draft: any;
}) {
  return withPinnedPostgresTransaction(async (tx) => {
    await assertFinanceEditor(tx, params.organizationId, params.userId);
    await tx.queryOne(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${params.organizationId}:${params.businessVersionId}:PREDICTION_AUTHORING`,
    ]);
    const version = await assertVersion(tx, params.organizationId, params.businessVersionId);
    if (version.status !== 'DRAFT')
      fail('PREDICTION_IMMUTABLE', 'Only a DRAFT prediction version is editable');

    const draft = params.draft ?? {};
    const mode = text(draft.scenarioMode, 'scenarioMode', 40);
    if (!MODES.has(mode)) fail('PREDICTION_INPUT_INVALID', 'Unsupported scenarioMode');
    const typed = {
      businessVersionId: params.businessVersionId,
      scenarioMode: mode,
      name: text(draft.name, 'name', 300),
      driverOverrides: boundedRows(draft.driverOverrides, 'driverOverrides', 500),
      initiatives: boundedRows(draft.initiatives, 'initiatives', 200),
      impacts: boundedRows(draft.impacts, 'impacts', 1000),
      financing: boundedRows(draft.financing, 'financing', 500),
    };
    const requestSha256 = digest({ expectedRevision: params.expectedRevision, draft: typed });
    const receipt = await tx.queryOne<any>(
      `SELECT request_sha256,result_snapshot FROM finance_prediction_authoring_receipts
        WHERE organization_id=? AND idempotency_key=?`,
      [params.organizationId, params.idempotencyKey]
    );
    if (receipt) {
      if (receipt.request_sha256 !== requestSha256)
        fail(
          'IDEMPOTENCY_KEY_REUSED',
          'Idempotency key was reused with different prediction content'
        );
      return { ...receipt.result_snapshot, replay: true, requestSha256 };
    }

    const existing = await tx.queryOne<any>(
      `SELECT scenario_mode,authoring_revision FROM finance_prediction_scenarios
        WHERE organization_id=? AND business_version_id=? FOR UPDATE`,
      [params.organizationId, params.businessVersionId]
    );
    const currentRevision = existing ? Number(existing.authoring_revision) : 0;
    if (currentRevision !== params.expectedRevision)
      fail(
        'PREDICTION_AUTHORING_CONFLICT',
        `Expected revision ${params.expectedRevision}, current revision ${currentRevision}`
      );
    if (
      existing &&
      existing.scenario_mode !== mode &&
      !(existing.scenario_mode === 'DRIVER_OVERRIDE' && mode === 'FUNDAMENTAL_INITIATIVE')
    ) {
      fail(
        'PREDICTION_MODE_TRANSITION_FORBIDDEN',
        `Scenario mode cannot change from ${existing.scenario_mode} to ${mode}`
      );
    }
    if (
      mode === 'STANDARD_BASE' &&
      (typed.driverOverrides.length ||
        typed.initiatives.length ||
        typed.impacts.length ||
        typed.financing.length)
    ) {
      fail(
        'PREDICTION_INPUT_INVALID',
        'STANDARD_BASE must remain structurally identical to Baseline'
      );
    }
    if (mode !== 'FUNDAMENTAL_INITIATIVE' && (typed.initiatives.length || typed.impacts.length)) {
      fail(
        'PREDICTION_INPUT_INVALID',
        'Initiatives and impacts require FUNDAMENTAL_INITIATIVE mode'
      );
    }
    if (mode.startsWith('STANDARD_') && typed.financing.length)
      fail('PREDICTION_INPUT_INVALID', 'Standard modes forbid financing decisions');

    const nextRevision = currentRevision + 1;
    if (!existing) {
      await tx.queryRun(
        `INSERT INTO finance_prediction_scenarios
          (id,organization_id,business_version_id,name,scenario_mode,created_by,updated_by,authoring_revision)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          randomUUID(),
          params.organizationId,
          params.businessVersionId,
          typed.name,
          mode,
          params.userId,
          params.userId,
          nextRevision,
        ]
      );
    } else {
      await tx.queryRun(
        `UPDATE finance_prediction_scenarios SET name=?,scenario_mode=?,scenario_mode_promoted_by=?,updated_by=?,authoring_revision=?,updated_at=now()
          WHERE organization_id=? AND business_version_id=?`,
        [
          typed.name,
          mode,
          existing.scenario_mode === mode ? null : params.userId,
          params.userId,
          nextRevision,
          params.organizationId,
          params.businessVersionId,
        ]
      );
    }

    await tx.queryRun(
      `DELETE FROM finance_prediction_impact_chain WHERE organization_id=? AND business_version_id=?`,
      [params.organizationId, params.businessVersionId]
    );
    await tx.queryRun(
      `DELETE FROM finance_prediction_initiatives WHERE organization_id=? AND business_version_id=?`,
      [params.organizationId, params.businessVersionId]
    );
    await tx.queryRun(
      `DELETE FROM finance_prediction_driver_overrides WHERE organization_id=? AND business_version_id=?`,
      [params.organizationId, params.businessVersionId]
    );
    await tx.queryRun(
      `DELETE FROM finance_prediction_financing WHERE organization_id=? AND business_version_id=?`,
      [params.organizationId, params.businessVersionId]
    );

    const seenOverride = new Set<string>();
    for (const [index, row] of typed.driverOverrides.entries()) {
      const scheduleType = text(row.scheduleType, `driverOverrides[${index}].scheduleType`, 40);
      if (!SCHEDULES.has(scheduleType))
        fail('PREDICTION_INPUT_INVALID', 'Unsupported schedule type');
      const entityId = text(row.entityId, `driverOverrides[${index}].entityId`);
      const periodId = text(row.periodId, `driverOverrides[${index}].periodId`);
      const driverCode = text(row.driverCode, `driverOverrides[${index}].driverCode`);
      const lineCode = text(row.canonicalLineCode, `driverOverrides[${index}].canonicalLineCode`);
      const duplicateKey = `${scheduleType}:${driverCode}:${entityId}:${periodId}`;
      if (seenOverride.has(duplicateKey))
        fail('PREDICTION_INPUT_INVALID', `Duplicate driver override ${duplicateKey}`);
      seenOverride.add(duplicateKey);
      const entity = await tx.queryOne(
        `SELECT id FROM finance_stmt_entities WHERE id=? AND organization_id=?`,
        [entityId, params.organizationId]
      );
      const period = await tx.queryOne(
        `SELECT period_id FROM finance_stmt_periods WHERE period_id=? AND organization_id=?`,
        [periodId, params.organizationId]
      );
      const line = await tx.queryOne<any>(
        `SELECT l.id FROM financial_statement_lines l JOIN finance_prediction_driver_line_map m ON m.canonical_line_id=l.id
          WHERE l.line_code=? AND m.schedule_type=? LIMIT 1`,
        [lineCode, scheduleType]
      );
      if (!entity || !period || !line)
        fail('PREDICTION_REFERENCE_INVALID', `Invalid driver reference at row ${index}`);
      const value = nullableNumber(row.valueDecimal, `driverOverrides[${index}].valueDecimal`);
      const status = value === null ? 'MISSING' : value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO';
      let source = text(
        row.overrideSource ?? 'MANUAL',
        `driverOverrides[${index}].overrideSource`,
        40
      );
      if (mode === 'STANDARD_UPSIDE') source = 'STANDARD_PRESET_UPSIDE';
      if (mode === 'STANDARD_DOWNSIDE') source = 'STANDARD_PRESET_DOWNSIDE';
      await tx.queryRun(
        `INSERT INTO finance_prediction_driver_overrides
          (id,organization_id,business_version_id,schedule_type,driver_code,entity_id,period_id,override_source,
           value_status,value_decimal,unit,baseline_value_decimal,rationale,canonical_line_id,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          text(row.id, `driverOverrides[${index}].id`),
          params.organizationId,
          params.businessVersionId,
          scheduleType,
          driverCode,
          entityId,
          periodId,
          source,
          status,
          value,
          text(row.unit, `driverOverrides[${index}].unit`, 40),
          nullableNumber(row.baselineValueDecimal, 'baselineValueDecimal'),
          nullableText(row.rationale, 'rationale'),
          line.id,
          params.userId,
        ]
      );
    }

    const initiativeIds = new Set<string>();
    for (const [index, row] of typed.initiatives.entries()) {
      const id = text(row.id, `initiatives[${index}].id`);
      if (initiativeIds.has(id)) fail('PREDICTION_INPUT_INVALID', `Duplicate initiative id ${id}`);
      initiativeIds.add(id);
      const start = nullableText(row.defaultStartPeriodId, 'defaultStartPeriodId');
      if (
        start &&
        !(await tx.queryOne(
          `SELECT period_id FROM finance_stmt_periods WHERE period_id=? AND organization_id=?`,
          [start, params.organizationId]
        ))
      )
        fail('PREDICTION_REFERENCE_INVALID', 'Invalid initiative start period');
      await tx.queryRun(
        `INSERT INTO finance_prediction_initiatives
          (id,organization_id,business_version_id,initiative_code,name,description,source,owner,confidence_pct,
           default_start_period_id,default_ramp_months,default_duration_months,implementation_cost_decimal,status,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          params.organizationId,
          params.businessVersionId,
          text(row.initiativeCode, 'initiativeCode', 100),
          text(row.name, 'initiative.name', 300),
          nullableText(row.description, 'initiative.description'),
          nullableText(row.source, 'initiative.source'),
          nullableText(row.owner, 'initiative.owner'),
          nullablePercent(row.confidencePct, 'initiative.confidencePct'),
          start,
          nullableInteger(row.defaultRampMonths, 'defaultRampMonths'),
          nullableInteger(row.defaultDurationMonths, 'defaultDurationMonths'),
          nullableNumber(row.implementationCostDecimal, 'implementationCostDecimal'),
          ['DRAFT', 'CONFIRMED', 'REJECTED'].includes(row.status)
            ? row.status
            : fail('PREDICTION_INPUT_INVALID', 'Unsupported initiative status'),
          params.userId,
        ]
      );
    }

    const impactIds = new Set(
      typed.impacts.map((row: any, index: number) => text(row.id, `impacts[${index}].id`))
    );
    if (impactIds.size !== typed.impacts.length)
      fail('PREDICTION_INPUT_INVALID', 'Duplicate impact id');
    for (const [index, row] of typed.impacts.entries()) {
      const initiativeId = text(row.initiativeId, `impacts[${index}].initiativeId`);
      if (!initiativeIds.has(initiativeId))
        fail('PREDICTION_REFERENCE_INVALID', 'Impact initiative is outside this snapshot');
      const line = await tx.queryOne<any>(
        `SELECT id FROM financial_statement_lines WHERE line_code=? LIMIT 1`,
        [text(row.statementLineCode, 'statementLineCode')]
      );
      const entityId = text(row.entityId, 'impact.entityId');
      const entity = await tx.queryOne(
        `SELECT id FROM finance_stmt_entities WHERE id=? AND organization_id=?`,
        [entityId, params.organizationId]
      );
      const start = nullableText(row.startPeriodId, 'impact.startPeriodId');
      if (
        !line ||
        !entity ||
        (start &&
          !(await tx.queryOne(
            `SELECT period_id FROM finance_stmt_periods WHERE period_id=? AND organization_id=?`,
            [start, params.organizationId]
          )))
      )
        fail('PREDICTION_REFERENCE_INVALID', `Invalid impact reference at row ${index}`);
      const hasDriver =
        typeof row.driverScheduleType === 'string' && typeof row.driverCode === 'string';
      const hasKpi = typeof row.kpiCatalogId === 'string' && row.kpiCatalogId.length > 0;
      if (hasDriver === hasKpi)
        fail('PREDICTION_INPUT_INVALID', 'Impact must reference exactly one driver or KPI');
      if (hasDriver && !SCHEDULES.has(row.driverScheduleType))
        fail('PREDICTION_INPUT_INVALID', 'Unsupported impact schedule type');
      if (!['ABSOLUTE_AMOUNT', 'PERCENT_OF_BASE', 'PERCENT_DELTA'].includes(row.amountKind))
        fail('PREDICTION_INPUT_INVALID', 'Unsupported impact amount kind');
      if (!['POSITIVE', 'NEGATIVE'].includes(row.sign))
        fail('PREDICTION_INPUT_INVALID', 'Unsupported impact sign');
      const cannibalizes = nullableText(row.cannibalizesImpactId, 'cannibalizesImpactId');
      if (cannibalizes && (!impactIds.has(cannibalizes) || cannibalizes === row.id))
        fail(
          'PREDICTION_REFERENCE_INVALID',
          'Cannibalization target must be another impact in this snapshot'
        );
      await tx.queryRun(
        `INSERT INTO finance_prediction_impact_chain
          (id,organization_id,business_version_id,initiative_id,assumption_label,driver_schedule_type,driver_code,kpi_catalog_id,
           statement_line_id,entity_id,amount_kind,amount_decimal,amount_unit,sign,start_period_id,ramp_months,duration_months,
           decay_pct_per_period,implementation_cost_decimal,confidence_pct,probability_pct,cannibalizes_impact_id,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          text(row.id, `impacts[${index}].id`),
          params.organizationId,
          params.businessVersionId,
          initiativeId,
          text(row.assumptionLabel, 'assumptionLabel'),
          row.driverScheduleType,
          row.driverCode,
          row.kpiCatalogId,
          line.id,
          entityId,
          row.amountKind,
          nullableNumber(row.amountDecimal, 'amountDecimal'),
          text(row.amountUnit, 'amountUnit', 40),
          row.sign,
          start,
          nullableInteger(row.rampMonths, 'rampMonths'),
          nullableInteger(row.durationMonths, 'durationMonths'),
          nullablePercent(row.decayPctPerPeriod, 'decayPctPerPeriod'),
          nullableNumber(row.implementationCostDecimal, 'implementationCostDecimal'),
          nullablePercent(row.confidencePct, 'confidencePct'),
          nullablePercent(row.probabilityPct, 'probabilityPct'),
          null,
          params.userId,
        ]
      );
    }
    for (const [index, row] of typed.impacts.entries()) {
      const cannibalizes = nullableText(
        row.cannibalizesImpactId,
        `impacts[${index}].cannibalizesImpactId`
      );
      if (cannibalizes) {
        await tx.queryRun(
          `UPDATE finance_prediction_impact_chain SET cannibalizes_impact_id=?
            WHERE organization_id=? AND business_version_id=? AND id=?`,
          [cannibalizes, params.organizationId, params.businessVersionId, row.id]
        );
      }
    }

    for (const [index, row] of typed.financing.entries()) {
      const kind = text(row.financingKind, `financing[${index}].financingKind`, 50);
      if (!FINANCING.has(kind)) fail('PREDICTION_INPUT_INVALID', 'Unsupported financing kind');
      const entityId = text(row.entityId, 'financing.entityId');
      const entity = await tx.queryOne(
        `SELECT id FROM finance_stmt_entities WHERE id=? AND organization_id=?`,
        [entityId, params.organizationId]
      );
      const periodId = nullableText(row.periodId, 'financing.periodId');
      if (HORIZON_FINANCING.has(kind) ? periodId !== null : periodId === null) {
        fail('PREDICTION_INPUT_INVALID', `Invalid period shape for financing kind ${kind}`);
      }
      if (
        !entity ||
        (periodId &&
          !(await tx.queryOne(
            `SELECT period_id FROM finance_stmt_periods WHERE period_id=? AND organization_id=?`,
            [periodId, params.organizationId]
          )))
      )
        fail('PREDICTION_REFERENCE_INVALID', `Invalid financing reference at row ${index}`);
      if (!row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload))
        fail('PREDICTION_INPUT_INVALID', 'Financing payload must be an object');
      await tx.queryRun(
        `INSERT INTO finance_prediction_financing
          (id,organization_id,business_version_id,financing_kind,entity_id,period_id,payload,rationale,created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          text(row.id, `financing[${index}].id`),
          params.organizationId,
          params.businessVersionId,
          kind,
          entityId,
          periodId,
          JSON.stringify(row.payload),
          nullableText(row.rationale, 'financing.rationale'),
          params.userId,
        ]
      );
    }

    const snapshot = await readDraftTx(tx, params.organizationId, params.businessVersionId);
    await tx.queryRun(
      `INSERT INTO finance_prediction_authoring_receipts
        (receipt_id,organization_id,business_version_id,idempotency_key,request_sha256,result_revision,result_snapshot,created_by)
       VALUES (?,?,?,?,?,?,?::jsonb,?)`,
      [
        randomUUID(),
        params.organizationId,
        params.businessVersionId,
        params.idempotencyKey,
        requestSha256,
        nextRevision,
        JSON.stringify(snapshot),
        params.userId,
      ]
    );
    return { ...snapshot, replay: false, requestSha256 };
  });
}
