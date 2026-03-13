#!/usr/bin/env tsx
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import dotenv from 'dotenv';
import pg from 'pg';

import { getCanonicalLineDefinitions, getCanonicalLineVersionTag } from '../src/services/financeCanonicalRegistry.js';
import logger from '../src/utils/Logger.js';

type DemoStatementSpec = {
  statementType: 'P&L' | 'BS' | 'CF';
  fileName: string;
  lines: Array<{ code: string; label: string; value: number; periodLabel: string; periodIndex: number }>;
};

type DemoPackSpec = {
  entityName: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  statements: DemoStatementSpec[];
};

function withComparativePeriods(params: {
  currentPeriodLabel: string;
  priorPeriodLabel: string;
  priorScale: number;
  currentLines: Array<{ code: string; label: string; value: number }>;
}): Array<{ code: string; label: string; value: number; periodLabel: string; periodIndex: number }> {
  return [
    ...params.currentLines.map((line) => ({
      ...line,
      periodLabel: params.currentPeriodLabel,
      periodIndex: 0,
    })),
    ...params.currentLines.map((line) => ({
      ...line,
      value: Math.round(line.value * params.priorScale),
      periodLabel: params.priorPeriodLabel,
      periodIndex: 1,
    })),
  ];
}

function env(name: string, fallback?: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || fallback;
}

function loadEnvFiles(): void {
  const root = process.cwd();
  dotenv.config({ path: path.join(root, '.env') });
  dotenv.config({ path: path.join(root, '.env.local'), override: false });
  const extraEnvFile = env('ENV_FILE');
  if (extraEnvFile) {
    dotenv.config({ path: path.join(root, extraEnvFile), override: true });
  }
}

async function resetFinanceTables(databaseUrl: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND (
         table_name LIKE 'financial_%'
         OR table_name IN ('budgets', 'budget_scenarios', 'valuations')
       )
     ORDER BY table_name`
  );

  const excluded = new Set([
    'financial_statement_lines',
    'financial_statement_templates',
    'financial_statement_line_aliases',
    'financial_ratio_benchmarks',
  ]);

  const tables = result.rows
    .map((row) => String(row.table_name))
    .filter((table) => !excluded.has(table));

  if (tables.length === 0) {
    await client.end();
    return [];
  }

  await client.query('BEGIN');
  try {
    await client.query(`TRUNCATE TABLE ${tables.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  return tables;
}

async function pickOrgAndUser(databaseUrl: string): Promise<{ organizationId: string; userId: string }> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const organizationId =
      env('ORG_ID') ||
      String((await client.query<{ id: string }>(`SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`)).rows[0]?.id || '');
    if (!organizationId) {
      throw new Error('No organization found. Pass ORG_ID to target a specific org.');
    }

    const userId =
      env('USER_ID') ||
      String(
        (
          await client.query<{ id: string }>(
            `SELECT id FROM users WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1`,
            [organizationId]
          )
        ).rows[0]?.id || ''
      );
    if (!userId) {
      throw new Error(`No user found for organization ${organizationId}. Pass USER_ID explicitly.`);
    }

    return { organizationId, userId };
  } finally {
    await client.end();
  }
}

async function loadLineMap(statementType: 'P&L' | 'BS' | 'CF'): Promise<Map<string, string>> {
  throw new Error(`loadLineMap requires a database client for ${statementType}`);
}

async function loadLineMapFromClient(
  client: pg.Client,
  statementType: 'P&L' | 'BS' | 'CF'
): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; line_code: string }>(
    `SELECT id, line_code
     FROM financial_statement_lines
     WHERE statement_type = $1
     ORDER BY line_code`,
    [statementType]
  );
  return new Map((result.rows || []).map((row) => [String(row.line_code), String(row.id)]));
}

async function syncCanonicalLines(client: pg.Client): Promise<void> {
  const definitions = getCanonicalLineDefinitions();
  for (const line of definitions) {
    await client.query(
      `INSERT INTO financial_statement_lines (
        id, organization_id, statement_type, line_code, line_name, line_name_en, line_name_pl, parent_line_id,
        sort_order, is_system, aggregation_level, required_level, sign_convention, is_total, is_subtotal,
        is_computed, formula_json, deaggregation_ready, taxonomy_version, is_active
      ) VALUES (
        $1,NULL,$2,$3,$4,$5,$6,$7,
        $8,TRUE,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,TRUE
      )
      ON CONFLICT (id) DO UPDATE SET
        statement_type = EXCLUDED.statement_type,
        line_code = EXCLUDED.line_code,
        line_name = EXCLUDED.line_name,
        line_name_en = EXCLUDED.line_name_en,
        line_name_pl = EXCLUDED.line_name_pl,
        parent_line_id = EXCLUDED.parent_line_id,
        sort_order = EXCLUDED.sort_order,
        is_system = TRUE,
        aggregation_level = EXCLUDED.aggregation_level,
        required_level = EXCLUDED.required_level,
        sign_convention = EXCLUDED.sign_convention,
        is_total = EXCLUDED.is_total,
        is_subtotal = EXCLUDED.is_subtotal,
        is_computed = EXCLUDED.is_computed,
        formula_json = EXCLUDED.formula_json,
        deaggregation_ready = EXCLUDED.deaggregation_ready,
        taxonomy_version = EXCLUDED.taxonomy_version,
        is_active = TRUE`,
      [
        line.id,
        line.statementType,
        line.code,
        line.labelEn,
        line.labelEn,
        line.labelPl,
        line.parentId || null,
        line.sortOrder,
        line.aggregationLevel,
        line.requiredLevel,
        line.signConvention,
        !!line.isTotal,
        !!line.isSubtotal,
        !!line.isComputed,
        line.formulaJson ? JSON.stringify(line.formulaJson) : null,
        !!line.deaggregationReady,
        getCanonicalLineVersionTag(),
      ]
    );
  }
}

async function createConfirmedDemoStatement(params: {
  client: pg.Client;
  organizationId: string;
  userId: string;
  entityName: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  packId: string;
  spec: DemoStatementSpec;
  lineMap: Map<string, string>;
}): Promise<string> {
  const statementId = randomUUID();
  const ingestRunId = randomUUID();
  const values = params.spec.lines.map((line, index) => {
    const canonicalLineId = params.lineMap.get(line.code);
    if (!canonicalLineId) {
      throw new Error(`Missing canonical line ${line.code} for ${params.spec.statementType}`);
    }
    return {
      id: randomUUID(),
      canonicalLineId,
      originalLabel: line.label,
      value: line.value,
      confidence: 0.99,
      sourcePage: 1,
      sourceRow: index + 1,
      periodLabel: line.periodLabel,
      periodIndex: line.periodIndex,
      lineCode: line.code,
      candidateRowId: randomUUID(),
      mappingCandidateId: randomUUID(),
    };
  });

  await params.client.query(
    `INSERT INTO financial_statements (
      id, organization_id, statement_pack_id, statement_type, period_start, period_end, period_label, currency,
      scaling, source_file_name, source_file_path, parse_method, overall_confidence, document_class,
      extraction_strategy, template_family, created_by, entity_name, notes, status, validation_status,
      validation_messages, readiness_status, readiness_score, quality_summary, quality_reason_codes,
      values_version, confirmed_by, confirmed_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      $9,$10,$11,$12,$13,$14,
      $15,$16,$17,$18,$19,$20,$21,
      $22,$23,$24,$25,$26,
      $27,$28,CURRENT_TIMESTAMP
    )`,
    [
      statementId,
      params.organizationId,
      params.packId,
      params.spec.statementType,
      params.periodStart,
      params.periodEnd,
      params.periodLabel,
      'PLN',
      'thousands',
      params.spec.fileName,
      `seed://finance-demo/${params.spec.fileName}`,
      'manual',
      0.99,
      'spreadsheet',
      'finance_demo_seed',
      'finance_demo',
      params.userId,
      params.entityName,
      `Demo finance dataset seeded by reset-and-seed-finance-demo.ts (${params.periodLabel}).`,
      'confirmed',
      'pass',
      JSON.stringify([]),
      'ready',
      100,
      'Statement passed the readiness contract and is ready for downstream work.',
      JSON.stringify([]),
      1,
      params.userId,
    ]
  );

  await params.client.query(
    `INSERT INTO financial_statement_ingest_runs (
      id, statement_id, organization_id, run_status, current_stage, source_file_name, source_file_path,
      parse_method, document_class, extraction_strategy, template_family, raw_text_length, summary_json, created_by,
      completed_at, updated_at
    ) VALUES (
      $1,$2,$3,'completed','confirm',$4,$5,
      $6,$7,$8,$9,$10,$11,$12,
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    )`,
    [
      ingestRunId,
      statementId,
      params.organizationId,
      params.spec.fileName,
      `seed://finance-demo/${params.spec.fileName}`,
      'manual',
      'spreadsheet',
      'finance_demo_seed',
      'finance_demo',
      0,
      JSON.stringify({ seeded: true, statementType: params.spec.statementType }),
      params.userId,
    ]
  );

  await params.client.query(
    `INSERT INTO financial_statement_source_artifacts (
      id, statement_id, ingest_run_id, artifact_type, stage, version_no, content_json, metadata_json, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      randomUUID(),
      statementId,
      ingestRunId,
      'finance_demo_seed',
      'confirm',
      1,
      JSON.stringify({
        entityName: params.entityName,
        periodLabel: params.periodLabel,
        statementType: params.spec.statementType,
        lines: params.spec.lines,
      }),
      JSON.stringify({ seeded: true }),
      params.userId,
    ]
  );

  for (const value of values) {
    await params.client.query(
      `INSERT INTO financial_statement_candidate_rows (
        id, statement_id, ingest_run_id, row_key, row_label, normalized_label, source_row, source_page,
        selected_period_label, raw_value, normalized_value, currency, scaling, confidence, classification_reason, metadata_json
      ) VALUES ($1,$2,$3,$4,$5,LOWER($5),$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        value.candidateRowId,
        statementId,
        ingestRunId,
        `${statementId}:${value.sourceRow}`,
        value.originalLabel,
        value.sourceRow,
        value.sourcePage,
        value.periodLabel,
        String(value.value),
        value.value,
        'PLN',
        'thousands',
        value.confidence,
        'finance_demo_seed',
        JSON.stringify({ seeded: true, periodLabel: value.periodLabel, periodIndex: value.periodIndex }),
      ]
    );

    await params.client.query(
      `INSERT INTO financial_statement_mapping_candidates (
        id, statement_id, ingest_run_id, candidate_row_id, canonical_line_id, score, match_reason,
        is_selected, selected_by, metadata_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9)`,
      [
        value.mappingCandidateId,
        statementId,
        ingestRunId,
        value.candidateRowId,
        value.canonicalLineId,
        0.99,
        'finance_demo_seed_exact',
        'seed',
        JSON.stringify({ seeded: true, sourceRow: value.sourceRow }),
      ]
    );

    await params.client.query(
      `INSERT INTO financial_statement_values (
        id, statement_id, canonical_line_id, original_label, value, confidence, source_page, source_row,
        mapping_status, is_non_financial, classification_reason, value_origin, mapping_confidence,
        source_candidate_row_id, selected_mapping_candidate_id, period_granularity, evidence_json, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP)`,
      [
        value.id,
        statementId,
        value.canonicalLineId,
        value.originalLabel,
        value.value,
        value.confidence,
        value.sourcePage,
        value.sourceRow,
        'auto',
        false,
        'finance_demo_seed',
        'mapped',
        value.confidence,
        value.candidateRowId,
        value.mappingCandidateId,
        'annual',
        JSON.stringify({
          sourcePage: value.sourcePage,
          sourceRow: value.sourceRow,
          originalLabel: value.originalLabel,
          periodLabel: value.periodLabel,
          periodIndex: value.periodIndex,
          seeded: true,
        }),
      ]
    );

    await params.client.query(
      `INSERT INTO financial_statement_value_evidence (
        id, statement_value_id, candidate_row_id, evidence_type, weight, contribution_value, explanation
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        randomUUID(),
        value.id,
        value.candidateRowId,
        'direct',
        1,
        value.value,
        `Seeded from finance demo row "${value.originalLabel}".`,
      ]
    );
  }

  await params.client.query(
    `INSERT INTO financial_statement_value_versions (
      id, statement_id, version_no, source_stage, values_json, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), statementId, 1, 'confirm', JSON.stringify(values), params.userId]
  );

  await params.client.query(
    `INSERT INTO financial_statement_versions (
      id, statement_id, version_no, version_kind, readiness_status, snapshot_json, change_summary, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      randomUUID(),
      statementId,
      1,
      'confirmed',
      'ready',
      JSON.stringify({
        values: values.map((value) => ({
          canonicalLineId: value.canonicalLineId,
          lineCode: value.lineCode || null,
          lineName: value.originalLabel,
          lineNamePl: value.originalLabel,
          statementType: params.spec.statementType,
          value: value.value,
          sourcePage: value.sourcePage,
          sourceRow: value.sourceRow,
          periodLabel: value.periodLabel,
          periodIndex: value.periodIndex,
        })),
        validations: [],
      }),
      'Seeded confirmed finance demo snapshot.',
      params.userId,
    ]
  );

  await params.client.query(
    `INSERT INTO financial_statement_validations (
      id, statement_id, validation_scope, check_code, check_name, severity, status, expected_value, actual_value,
      difference, tolerance, message, details_json
    ) VALUES
      ($1,$2,'statement','MAPPING_COVERAGE','Mapping Coverage','info','pass',1,1,0,0,$3,$4),
      ($5,$2,'statement','REQUIRED_LINE_COVERAGE','Required Line Coverage','info','pass',$6,$6,0,0,$7,$8)`,
    [
      randomUUID(),
      statementId,
      'Mapping coverage is 100% for seeded demo statement.',
      JSON.stringify({ mappedCount: values.length, eligibleCount: values.length }),
      randomUUID(),
      values.length,
      'All required lines for seeded demo statement are present.',
      JSON.stringify({ missingLineCodes: [] }),
    ]
  );

  await params.client.query(
    `INSERT INTO financial_statement_quality_runs (
      id, statement_id, organization_id, stage, result_status, readiness_status, strategy, summary, reason_codes, payload_json, created_by
    ) VALUES
      ($1,$2,$3,'upload','pass','ready','finance_demo_seed',$4,$5,$6,$7),
      ($8,$2,$3,'confirm','pass','ready','finance_demo_seed',$9,$10,$11,$7)`,
    [
      randomUUID(),
      statementId,
      params.organizationId,
      'Seeded finance demo statement uploaded.',
      JSON.stringify(['FINANCE_DEMO_SEED']),
      JSON.stringify({ statementType: params.spec.statementType }),
      params.userId,
      randomUUID(),
      'Seeded finance demo statement confirmed.',
      JSON.stringify([]),
      JSON.stringify({ valuesCount: values.length }),
    ]
  );

  return statementId;
}

function getDemoPacks(): DemoPackSpec[] {
  return [
    {
      entityName: 'Fabryka Alfa Sp. z o.o.',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
      periodLabel: 'FY 2025',
      statements: [
        {
          statementType: 'P&L',
          fileName: 'demo-alfa-pl-2025.pdf',
          lines: withComparativePeriods({
            currentPeriodLabel: 'FY 2025',
            priorPeriodLabel: 'FY 2024',
            priorScale: 0.88,
            currentLines: [
            { code: 'REVENUE', label: 'Przychody ze sprzedaży', value: 12500 },
            { code: 'PRODUCT_REVENUE', label: 'Przychody produktowe', value: 7800 },
            { code: 'PRODUCT_REVENUE_DOMESTIC', label: 'Przychody produktowe kraj', value: 5200 },
            { code: 'PRODUCT_REVENUE_EXPORT', label: 'Przychody produktowe eksport', value: 2600 },
            { code: 'SERVICE_REVENUE', label: 'Przychody usługowe', value: 3600 },
            { code: 'SUBSCRIPTION_REVENUE', label: 'Przychody abonamentowe', value: 1800 },
            { code: 'PROJECT_REVENUE', label: 'Przychody projektowe', value: 1800 },
            { code: 'OTHER_REVENUE', label: 'Pozostałe przychody', value: 1100 },
            { code: 'COGS', label: 'Koszt własny sprzedaży', value: 7800 },
            { code: 'MATERIALS_COGS', label: 'Koszt materiałów', value: 3400 },
            { code: 'RAW_MATERIALS_COGS', label: 'Koszt surowców', value: 3000 },
            { code: 'INBOUND_FREIGHT_COGS', label: 'Transport zakupu', value: 400 },
            { code: 'DIRECT_LABOR_COGS', label: 'Koszt robocizny bezpośredniej', value: 2500 },
            { code: 'PRODUCTION_PAYROLL_COGS', label: 'Płace produkcyjne', value: 1700 },
            { code: 'PRODUCTION_CONTRACTORS_COGS', label: 'Usługi produkcyjne obce', value: 800 },
            { code: 'OTHER_DIRECT_COSTS', label: 'Pozostałe koszty bezpośrednie', value: 1900 },
            { code: 'GROSS_PROFIT', label: 'Marża brutto', value: 4700 },
            { code: 'OTHER_OPERATING_INCOME', label: 'Pozostałe przychody operacyjne', value: 120 },
            { code: 'SELLING_EXPENSES', label: 'Koszty sprzedaży', value: 850 },
            { code: 'MARKETING_EXPENSES', label: 'Koszty marketingu', value: 420 },
            { code: 'LOGISTICS_EXPENSES', label: 'Koszty logistyki', value: 250 },
            { code: 'SALES_COMMISSIONS', label: 'Prowizje sprzedażowe', value: 180 },
            { code: 'GENERAL_ADMIN_EXPENSES', label: 'Koszty ogólnego zarządu', value: 1300 },
            { code: 'GNA_PAYROLL', label: 'Płace administracji', value: 620 },
            { code: 'GNA_RENT', label: 'Czynsz biur', value: 240 },
            { code: 'GNA_IT', label: 'IT i oprogramowanie', value: 180 },
            { code: 'GNA_EXTERNAL_SERVICES', label: 'Usługi obce', value: 260 },
            { code: 'OTHER_OPERATING_EXPENSES', label: 'Pozostałe koszty operacyjne', value: 750 },
            { code: 'IMPAIRMENT_EXPENSE', label: 'Odpisy aktualizujące', value: 290 },
            { code: 'PROVISIONS_EXPENSE', label: 'Koszt rezerw', value: 460 },
            { code: 'OPEX', label: 'Koszty operacyjne', value: 2900 },
            { code: 'EBITDA', label: 'EBITDA', value: 1920 },
            { code: 'DEPRECIATION', label: 'Amortyzacja', value: 400 },
            { code: 'PPE_DEPRECIATION', label: 'Amortyzacja środków trwałych', value: 250 },
            { code: 'INTANGIBLE_AMORTIZATION', label: 'Amortyzacja WNiP', value: 150 },
            { code: 'EBIT', label: 'EBIT / Zysk operacyjny', value: 1520 },
            { code: 'INTEREST_EXPENSE', label: 'Koszty finansowe', value: 180 },
            { code: 'BANK_INTEREST_EXPENSE', label: 'Odsetki bankowe', value: 140 },
            { code: 'LEASE_INTEREST_EXPENSE', label: 'Odsetki leasingowe', value: 40 },
            { code: 'OTHER_FINANCIAL_RESULT', label: 'Pozostałe przychody/koszty finansowe', value: -70 },
            { code: 'EBT', label: 'Zysk przed opodatkowaniem', value: 1270 },
            { code: 'TAX_EXPENSE', label: 'Podatek dochodowy', value: 280 },
            { code: 'CURRENT_TAX_EXPENSE', label: 'Podatek bieżący', value: 230 },
            { code: 'DEFERRED_TAX_EXPENSE', label: 'Podatek odroczony', value: 50 },
            { code: 'NET_INCOME', label: 'Zysk netto', value: 990 },
            ],
          }),
        },
        {
          statementType: 'BS',
          fileName: 'demo-alfa-bs-2025.xlsx',
          lines: withComparativePeriods({
            currentPeriodLabel: '2025-12-31',
            priorPeriodLabel: '2024-12-31',
            priorScale: 0.9,
            currentLines: [
            { code: 'CASH', label: 'Środki pieniężne', value: 1250 },
            { code: 'OPERATING_CASH', label: 'Gotówka operacyjna', value: 980 },
            { code: 'RESTRICTED_CASH', label: 'Środki zablokowane', value: 270 },
            { code: 'AR', label: 'Należności', value: 1480 },
            { code: 'TRADE_RECEIVABLES', label: 'Należności handlowe', value: 1200 },
            { code: 'OTHER_RECEIVABLES', label: 'Pozostałe należności', value: 280 },
            { code: 'INVENTORY', label: 'Zapasy', value: 1120 },
            { code: 'RAW_MATERIALS_INVENTORY', label: 'Materiały', value: 520 },
            { code: 'WORK_IN_PROGRESS_INVENTORY', label: 'Produkcja w toku', value: 180 },
            { code: 'FINISHED_GOODS_INVENTORY', label: 'Wyroby gotowe', value: 420 },
            { code: 'OTHER_CURRENT_ASSETS', label: 'Pozostałe aktywa obrotowe', value: 100 },
            { code: 'VAT_RECEIVABLES', label: 'Należności VAT', value: 40 },
            { code: 'PREPAID_EXPENSES', label: 'Rozliczenia międzyokresowe czynne', value: 60 },
            { code: 'CURRENT_ASSETS', label: 'Aktywa obrotowe', value: 3950 },
            { code: 'PROPERTY_PLANT_EQUIPMENT', label: 'Rzeczowe aktywa trwałe', value: 3600 },
            { code: 'PPE_LAND_BUILDINGS', label: 'Grunty i budynki', value: 1600 },
            { code: 'PPE_MACHINERY', label: 'Maszyny i urządzenia', value: 1400 },
            { code: 'PPE_VEHICLES', label: 'Środki transportu', value: 600 },
            { code: 'INTANGIBLE_ASSETS', label: 'Wartości niematerialne', value: 320 },
            { code: 'SOFTWARE_ASSETS', label: 'Oprogramowanie', value: 140 },
            { code: 'GOODWILL', label: 'Wartość firmy', value: 180 },
            { code: 'OTHER_NON_CURRENT_ASSETS', label: 'Pozostałe aktywa trwałe', value: 730 },
            { code: 'DEFERRED_TAX_ASSETS', label: 'Aktywa z tytułu podatku odroczonego', value: 210 },
            { code: 'FIXED_ASSETS', label: 'Aktywa trwałe', value: 4650 },
            { code: 'TOTAL_ASSETS', label: 'Aktywa ogółem', value: 8600 },
            { code: 'AP', label: 'Zobowiązania handlowe', value: 1150 },
            { code: 'TRADE_PAYABLES', label: 'Zobowiązania handlowe krajowe', value: 1150 },
            { code: 'SHORT_TERM_DEBT', label: 'Zobowiązania krótkoterminowe finansowe', value: 250 },
            { code: 'SHORT_TERM_BANK_DEBT', label: 'Krótkoterminowy dług bankowy', value: 150 },
            { code: 'CURRENT_LEASE_LIABILITIES', label: 'Krótkoterminowe zobowiązania leasingowe', value: 100 },
            { code: 'OTHER_CURRENT_LIABILITIES', label: 'Pozostałe zobowiązania krótkoterminowe', value: 350 },
            { code: 'TAX_PAYABLES', label: 'Zobowiązania podatkowe', value: 120 },
            { code: 'ACCRUED_EXPENSES', label: 'Rozliczenia międzyokresowe bierne', value: 230 },
            { code: 'CURRENT_LIABILITIES', label: 'Zobowiązania krótkoterminowe', value: 1750 },
            { code: 'LONG_TERM_DEBT', label: 'Zobowiązania długoterminowe finansowe', value: 2050 },
            { code: 'LONG_TERM_BANK_DEBT', label: 'Dług bankowy długoterminowy', value: 1700 },
            { code: 'NON_CURRENT_LEASE_LIABILITIES', label: 'Długoterminowe zobowiązania leasingowe', value: 350 },
            { code: 'OTHER_NON_CURRENT_LIABILITIES', label: 'Pozostałe zobowiązania długoterminowe', value: 400 },
            { code: 'LONG_TERM_PROVISIONS', label: 'Rezerwy długoterminowe', value: 400 },
            { code: 'TOTAL_LIABILITIES', label: 'Zobowiązania ogółem', value: 4200 },
            { code: 'SHARE_CAPITAL', label: 'Kapitał podstawowy', value: 2500 },
            { code: 'RETAINED_EARNINGS', label: 'Zyski zatrzymane', value: 1900 },
            { code: 'RETAINED_EARNINGS_PRIOR', label: 'Wynik lat ubiegłych', value: 910 },
            { code: 'RETAINED_EARNINGS_CURRENT', label: 'Wynik bieżącego roku', value: 990 },
            { code: 'TOTAL_EQUITY', label: 'Kapitał własny', value: 4400 },
            { code: 'TOTAL_LIABILITIES_EQUITY', label: 'Pasywa ogółem', value: 8600 },
            { code: 'WORKING_CAPITAL', label: 'Kapitał obrotowy', value: 2200 },
            ],
          }),
        },
        {
          statementType: 'CF',
          fileName: 'demo-alfa-cf-2025.pdf',
          lines: withComparativePeriods({
            currentPeriodLabel: 'FY 2025',
            priorPeriodLabel: 'FY 2024',
            priorScale: 0.86,
            currentLines: [
            { code: 'OPERATING_CF', label: 'Przepływy operacyjne', value: 1620 },
            { code: 'NET_INCOME_CF', label: 'Wynik netto w CFO', value: 990 },
            { code: 'DEPRECIATION_ADDBACK', label: 'Korekta o amortyzację', value: 400 },
            { code: 'CHANGE_WORKING_CAPITAL', label: 'Zmiana kapitału obrotowego', value: -180 },
            { code: 'CHANGE_AR', label: 'Zmiana należności', value: -140 },
            { code: 'CHANGE_INVENTORY', label: 'Zmiana zapasów', value: -90 },
            { code: 'CHANGE_AP', label: 'Zmiana zobowiązań', value: 50 },
            { code: 'TAXES_PAID', label: 'Podatek zapłacony', value: 260 },
            { code: 'INTEREST_PAID', label: 'Odsetki zapłacone', value: 180 },
            { code: 'INVESTING_CF', label: 'Przepływy inwestycyjne', value: -820 },
            { code: 'CAPEX', label: 'Nakłady inwestycyjne', value: 760 },
            { code: 'MAINTENANCE_CAPEX', label: 'CAPEX odtworzeniowy', value: 410 },
            { code: 'GROWTH_CAPEX', label: 'CAPEX rozwojowy', value: 350 },
            { code: 'OTHER_INVESTING_CF', label: 'Pozostałe przepływy inwestycyjne', value: -60 },
            { code: 'FINANCING_CF', label: 'Przepływy finansowe', value: -300 },
            { code: 'DEBT_DRAWDOWN', label: 'Zaciągnięcie finansowania dłużnego', value: 200 },
            { code: 'BANK_DEBT_DRAWDOWN', label: 'Uruchomienie długu bankowego', value: 160 },
            { code: 'LEASE_DEBT_DRAWDOWN', label: 'Nowe zobowiązania leasingowe', value: 40 },
            { code: 'DEBT_REPAYMENT', label: 'Spłata finansowania dłużnego', value: 360 },
            { code: 'BANK_DEBT_REPAYMENT', label: 'Spłata długu bankowego', value: 300 },
            { code: 'LEASE_DEBT_REPAYMENT', label: 'Spłata leasingu', value: 60 },
            { code: 'DIVIDENDS_PAID', label: 'Dywidendy wypłacone', value: 140 },
            { code: 'FREE_CASH_FLOW', label: 'Wolne przepływy pieniężne', value: 860 },
            { code: 'NET_CHANGE_CASH', label: 'Zmiana stanu środków pieniężnych', value: 500 },
            ],
          }),
        },
      ],
    },
    {
      entityName: 'Nova Energia S.A.',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
      periodLabel: 'FY 2025',
      statements: [
        {
          statementType: 'P&L',
          fileName: 'demo-nova-pl-2025.pdf',
          lines: withComparativePeriods({
            currentPeriodLabel: 'FY 2025',
            priorPeriodLabel: 'FY 2024',
            priorScale: 0.9,
            currentLines: [
            { code: 'REVENUE', label: 'Przychody ze sprzedaży', value: 18900 },
            { code: 'PRODUCT_REVENUE', label: 'Przychody produktowe', value: 12600 },
            { code: 'PRODUCT_REVENUE_DOMESTIC', label: 'Przychody produktowe kraj', value: 7700 },
            { code: 'PRODUCT_REVENUE_EXPORT', label: 'Przychody produktowe eksport', value: 4900 },
            { code: 'SERVICE_REVENUE', label: 'Przychody usługowe', value: 4800 },
            { code: 'SUBSCRIPTION_REVENUE', label: 'Przychody abonamentowe', value: 2500 },
            { code: 'PROJECT_REVENUE', label: 'Przychody projektowe', value: 2300 },
            { code: 'OTHER_REVENUE', label: 'Pozostałe przychody', value: 1500 },
            { code: 'COGS', label: 'Koszt własny sprzedaży', value: 11400 },
            { code: 'MATERIALS_COGS', label: 'Koszt materiałów', value: 5200 },
            { code: 'RAW_MATERIALS_COGS', label: 'Koszt surowców', value: 4680 },
            { code: 'INBOUND_FREIGHT_COGS', label: 'Transport zakupu', value: 520 },
            { code: 'DIRECT_LABOR_COGS', label: 'Koszt robocizny bezpośredniej', value: 3600 },
            { code: 'PRODUCTION_PAYROLL_COGS', label: 'Płace produkcyjne', value: 2460 },
            { code: 'PRODUCTION_CONTRACTORS_COGS', label: 'Usługi produkcyjne obce', value: 1140 },
            { code: 'OTHER_DIRECT_COSTS', label: 'Pozostałe koszty bezpośrednie', value: 2600 },
            { code: 'GROSS_PROFIT', label: 'Marża brutto', value: 7500 },
            { code: 'OTHER_OPERATING_INCOME', label: 'Pozostałe przychody operacyjne', value: 180 },
            { code: 'SELLING_EXPENSES', label: 'Koszty sprzedaży', value: 1350 },
            { code: 'MARKETING_EXPENSES', label: 'Koszty marketingu', value: 640 },
            { code: 'LOGISTICS_EXPENSES', label: 'Koszty logistyki', value: 410 },
            { code: 'SALES_COMMISSIONS', label: 'Prowizje sprzedażowe', value: 300 },
            { code: 'GENERAL_ADMIN_EXPENSES', label: 'Koszty ogólnego zarządu', value: 2400 },
            { code: 'GNA_PAYROLL', label: 'Płace administracji', value: 1080 },
            { code: 'GNA_RENT', label: 'Czynsz biur', value: 360 },
            { code: 'GNA_IT', label: 'IT i oprogramowanie', value: 310 },
            { code: 'GNA_EXTERNAL_SERVICES', label: 'Usługi obce', value: 650 },
            { code: 'OTHER_OPERATING_EXPENSES', label: 'Pozostałe koszty operacyjne', value: 1150 },
            { code: 'IMPAIRMENT_EXPENSE', label: 'Odpisy aktualizujące', value: 430 },
            { code: 'PROVISIONS_EXPENSE', label: 'Koszt rezerw', value: 720 },
            { code: 'OPEX', label: 'Koszty operacyjne', value: 4900 },
            { code: 'EBITDA', label: 'EBITDA', value: 2780 },
            { code: 'DEPRECIATION', label: 'Amortyzacja', value: 550 },
            { code: 'PPE_DEPRECIATION', label: 'Amortyzacja środków trwałych', value: 360 },
            { code: 'INTANGIBLE_AMORTIZATION', label: 'Amortyzacja WNiP', value: 190 },
            { code: 'EBIT', label: 'EBIT / Zysk operacyjny', value: 2230 },
            { code: 'INTEREST_EXPENSE', label: 'Koszty finansowe', value: 210 },
            { code: 'BANK_INTEREST_EXPENSE', label: 'Odsetki bankowe', value: 150 },
            { code: 'LEASE_INTEREST_EXPENSE', label: 'Odsetki leasingowe', value: 60 },
            { code: 'OTHER_FINANCIAL_RESULT', label: 'Pozostałe przychody/koszty finansowe', value: -120 },
            { code: 'EBT', label: 'Zysk przed opodatkowaniem', value: 1900 },
            { code: 'TAX_EXPENSE', label: 'Podatek dochodowy', value: 410 },
            { code: 'CURRENT_TAX_EXPENSE', label: 'Podatek bieżący', value: 340 },
            { code: 'DEFERRED_TAX_EXPENSE', label: 'Podatek odroczony', value: 70 },
            { code: 'NET_INCOME', label: 'Zysk netto', value: 1490 },
            ],
          }),
        },
        {
          statementType: 'BS',
          fileName: 'demo-nova-bs-2025.xlsx',
          lines: withComparativePeriods({
            currentPeriodLabel: '2025-12-31',
            priorPeriodLabel: '2024-12-31',
            priorScale: 0.91,
            currentLines: [
            { code: 'CASH', label: 'Środki pieniężne', value: 2160 },
            { code: 'OPERATING_CASH', label: 'Gotówka operacyjna', value: 1740 },
            { code: 'RESTRICTED_CASH', label: 'Środki zablokowane', value: 420 },
            { code: 'AR', label: 'Należności', value: 1960 },
            { code: 'TRADE_RECEIVABLES', label: 'Należności handlowe', value: 1540 },
            { code: 'OTHER_RECEIVABLES', label: 'Pozostałe należności', value: 420 },
            { code: 'INVENTORY', label: 'Zapasy', value: 1440 },
            { code: 'RAW_MATERIALS_INVENTORY', label: 'Materiały', value: 650 },
            { code: 'WORK_IN_PROGRESS_INVENTORY', label: 'Produkcja w toku', value: 280 },
            { code: 'FINISHED_GOODS_INVENTORY', label: 'Wyroby gotowe', value: 510 },
            { code: 'OTHER_CURRENT_ASSETS', label: 'Pozostałe aktywa obrotowe', value: 140 },
            { code: 'VAT_RECEIVABLES', label: 'Należności VAT', value: 60 },
            { code: 'PREPAID_EXPENSES', label: 'Rozliczenia międzyokresowe czynne', value: 80 },
            { code: 'CURRENT_ASSETS', label: 'Aktywa obrotowe', value: 5700 },
            { code: 'PROPERTY_PLANT_EQUIPMENT', label: 'Rzeczowe aktywa trwałe', value: 4800 },
            { code: 'PPE_LAND_BUILDINGS', label: 'Grunty i budynki', value: 1900 },
            { code: 'PPE_MACHINERY', label: 'Maszyny i urządzenia', value: 2100 },
            { code: 'PPE_VEHICLES', label: 'Środki transportu', value: 800 },
            { code: 'INTANGIBLE_ASSETS', label: 'Wartości niematerialne', value: 620 },
            { code: 'SOFTWARE_ASSETS', label: 'Oprogramowanie', value: 320 },
            { code: 'GOODWILL', label: 'Wartość firmy', value: 300 },
            { code: 'OTHER_NON_CURRENT_ASSETS', label: 'Pozostałe aktywa trwałe', value: 830 },
            { code: 'DEFERRED_TAX_ASSETS', label: 'Aktywa z tytułu podatku odroczonego', value: 240 },
            { code: 'FIXED_ASSETS', label: 'Aktywa trwałe', value: 6250 },
            { code: 'TOTAL_ASSETS', label: 'Aktywa ogółem', value: 11950 },
            { code: 'AP', label: 'Zobowiązania handlowe', value: 1420 },
            { code: 'TRADE_PAYABLES', label: 'Zobowiązania handlowe krajowe', value: 1420 },
            { code: 'SHORT_TERM_DEBT', label: 'Zobowiązania krótkoterminowe finansowe', value: 380 },
            { code: 'SHORT_TERM_BANK_DEBT', label: 'Krótkoterminowy dług bankowy', value: 250 },
            { code: 'CURRENT_LEASE_LIABILITIES', label: 'Krótkoterminowe zobowiązania leasingowe', value: 130 },
            { code: 'OTHER_CURRENT_LIABILITIES', label: 'Pozostałe zobowiązania krótkoterminowe', value: 440 },
            { code: 'TAX_PAYABLES', label: 'Zobowiązania podatkowe', value: 170 },
            { code: 'ACCRUED_EXPENSES', label: 'Rozliczenia międzyokresowe bierne', value: 270 },
            { code: 'CURRENT_LIABILITIES', label: 'Zobowiązania krótkoterminowe', value: 2240 },
            { code: 'LONG_TERM_DEBT', label: 'Zobowiązania długoterminowe finansowe', value: 2760 },
            { code: 'LONG_TERM_BANK_DEBT', label: 'Dług bankowy długoterminowy', value: 2210 },
            { code: 'NON_CURRENT_LEASE_LIABILITIES', label: 'Długoterminowe zobowiązania leasingowe', value: 550 },
            { code: 'OTHER_NON_CURRENT_LIABILITIES', label: 'Pozostałe zobowiązania długoterminowe', value: 500 },
            { code: 'LONG_TERM_PROVISIONS', label: 'Rezerwy długoterminowe', value: 500 },
            { code: 'TOTAL_LIABILITIES', label: 'Zobowiązania ogółem', value: 5500 },
            { code: 'SHARE_CAPITAL', label: 'Kapitał podstawowy', value: 3000 },
            { code: 'RETAINED_EARNINGS', label: 'Zyski zatrzymane', value: 3450 },
            { code: 'RETAINED_EARNINGS_PRIOR', label: 'Wynik lat ubiegłych', value: 1960 },
            { code: 'RETAINED_EARNINGS_CURRENT', label: 'Wynik bieżącego roku', value: 1490 },
            { code: 'TOTAL_EQUITY', label: 'Kapitał własny', value: 6450 },
            { code: 'TOTAL_LIABILITIES_EQUITY', label: 'Pasywa ogółem', value: 11950 },
            { code: 'WORKING_CAPITAL', label: 'Kapitał obrotowy', value: 3460 },
            ],
          }),
        },
        {
          statementType: 'CF',
          fileName: 'demo-nova-cf-2025.pdf',
          lines: withComparativePeriods({
            currentPeriodLabel: 'FY 2025',
            priorPeriodLabel: 'FY 2024',
            priorScale: 0.89,
            currentLines: [
            { code: 'OPERATING_CF', label: 'Przepływy operacyjne', value: 2380 },
            { code: 'NET_INCOME_CF', label: 'Wynik netto w CFO', value: 1490 },
            { code: 'DEPRECIATION_ADDBACK', label: 'Korekta o amortyzację', value: 550 },
            { code: 'CHANGE_WORKING_CAPITAL', label: 'Zmiana kapitału obrotowego', value: -260 },
            { code: 'CHANGE_AR', label: 'Zmiana należności', value: -180 },
            { code: 'CHANGE_INVENTORY', label: 'Zmiana zapasów', value: -120 },
            { code: 'CHANGE_AP', label: 'Zmiana zobowiązań', value: 40 },
            { code: 'TAXES_PAID', label: 'Podatek zapłacony', value: 390 },
            { code: 'INTEREST_PAID', label: 'Odsetki zapłacone', value: 210 },
            { code: 'INVESTING_CF', label: 'Przepływy inwestycyjne', value: -1050 },
            { code: 'CAPEX', label: 'Nakłady inwestycyjne', value: 960 },
            { code: 'MAINTENANCE_CAPEX', label: 'CAPEX odtworzeniowy', value: 520 },
            { code: 'GROWTH_CAPEX', label: 'CAPEX rozwojowy', value: 440 },
            { code: 'OTHER_INVESTING_CF', label: 'Pozostałe przepływy inwestycyjne', value: -90 },
            { code: 'FINANCING_CF', label: 'Przepływy finansowe', value: -420 },
            { code: 'DEBT_DRAWDOWN', label: 'Zaciągnięcie finansowania dłużnego', value: 300 },
            { code: 'BANK_DEBT_DRAWDOWN', label: 'Uruchomienie długu bankowego', value: 240 },
            { code: 'LEASE_DEBT_DRAWDOWN', label: 'Nowe zobowiązania leasingowe', value: 60 },
            { code: 'DEBT_REPAYMENT', label: 'Spłata finansowania dłużnego', value: 540 },
            { code: 'BANK_DEBT_REPAYMENT', label: 'Spłata długu bankowego', value: 450 },
            { code: 'LEASE_DEBT_REPAYMENT', label: 'Spłata leasingu', value: 90 },
            { code: 'DIVIDENDS_PAID', label: 'Dywidendy wypłacone', value: 180 },
            { code: 'FREE_CASH_FLOW', label: 'Wolne przepływy pieniężne', value: 1420 },
            { code: 'NET_CHANGE_CASH', label: 'Zmiana stanu środków pieniężnych', value: 910 },
            ],
          }),
        },
      ],
    },
  ];
}

async function main(): Promise<void> {
  loadEnvFiles();
  const confirm = env('RESET_FINANCE_CONFIRM');
  if (confirm !== 'YES') {
    throw new Error('Set RESET_FINANCE_CONFIRM=YES before running this destructive script.');
  }

  const databaseUrl = env('DATABASE_URL');
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  const { organizationId, userId } = await pickOrgAndUser(databaseUrl);

  const skipReset = env('SKIP_FINANCE_RESET') === 'YES';
  const packOffset = Math.max(0, Number(env('SEED_PACK_OFFSET') || 0) || 0);
  const packLimit = Math.max(0, Number(env('SEED_PACK_LIMIT') || 0) || 0);
  const truncatedTables = skipReset ? [] : await resetFinanceTables(databaseUrl);
  const allDemoPacks = getDemoPacks();
  const demoPacks =
    packLimit > 0 ? allDemoPacks.slice(packOffset, packOffset + packLimit) : allDemoPacks.slice(packOffset);

  const createdStatementIds: string[] = [];
  const createdPackIds: string[] = [];
  const syncClient = new pg.Client({ connectionString: databaseUrl });
  await syncClient.connect();
  try {
    await syncCanonicalLines(syncClient);
  } finally {
    await syncClient.end();
  }

  try {
    for (const pack of demoPacks) {
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      const packId = randomUUID();
      createdPackIds.push(packId);
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO financial_statement_packs (
            id, organization_id, entity_name, period_start, period_end, period_label, currency, scaling,
            pack_status, pack_readiness_status, pack_readiness_score, pack_quality_summary, pack_quality_reason_codes,
            source_statement_count, missing_statement_types, metadata_json
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13,
            $14,$15,$16
          )`,
          [
            packId,
            organizationId,
            pack.entityName,
            pack.periodStart,
            pack.periodEnd,
            pack.periodLabel,
            'PLN',
            'thousands',
            'confirmed',
            'ready',
            100,
            'Statement pack contains a complete ready set of P&L, Balance Sheet, and Cash Flow.',
            JSON.stringify([]),
            3,
            JSON.stringify([]),
            JSON.stringify({ seededBy: 'reset-and-seed-finance-demo.ts' }),
          ]
        );

        for (const spec of pack.statements) {
          const lineMap = await loadLineMapFromClient(client, spec.statementType);
          const statementId = await createConfirmedDemoStatement({
            client,
            organizationId,
            userId,
            entityName: pack.entityName,
            periodStart: pack.periodStart,
            periodEnd: pack.periodEnd,
            periodLabel: pack.periodLabel,
            packId,
            spec,
            lineMap,
          });
          createdStatementIds.push(statementId);
        }

        await client.query(
          `INSERT INTO financial_statement_validations (
            id, statement_pack_id, validation_scope, check_code, check_name, severity, status, expected_value, actual_value,
            difference, tolerance, message, details_json
          ) VALUES
            ($1,$2,'pack','PACK_COMPLETENESS','Pack Completeness','info','pass',3,3,0,0,$3,$4),
            ($5,$2,'pack','PACK_READINESS','Pack Readiness','info','pass',100,100,0,0,$6,$7)`,
          [
            randomUUID(),
            packId,
            'Statement pack contains all required statement types.',
            JSON.stringify({ presentTypes: ['P&L', 'BS', 'CF'], missingTypes: [] }),
            randomUUID(),
            'Statement pack contains a complete ready set of P&L, Balance Sheet, and Cash Flow.',
            JSON.stringify({ readinessStatus: 'ready', reasonCodes: [] }),
          ]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        await client.end();
      }
    }
  } catch (error) {
    throw error;
  }

  const verifyClient = new pg.Client({ connectionString: databaseUrl });
  await verifyClient.connect();
  const packCount = await verifyClient.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM financial_statement_packs`
  );
  const statementCount = await verifyClient.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM financial_statements`
  );
  await verifyClient.end();

  logger.info(
    `[reset-and-seed-finance-demo] truncated=${truncatedTables.length} tables, created=${createdStatementIds.length} statements, packs=${Number(
      packCount.rows[0]?.total || 0
    )}, statements=${Number(statementCount.rows[0]?.total || 0)}`
  );
}

main().catch((error) => {
  console.error('[reset-and-seed-finance-demo] Failed:', error);
  process.exit(1);
});
