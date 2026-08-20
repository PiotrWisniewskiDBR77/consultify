import { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '@/services/api/v8/finance';
import { valuationDisplayMultiplier, valuationDisplayValue } from '@/utils/valuationMonetaryUnit';

import { type ModuleTab } from '../../shared/ModuleHub';
import {
  type FinanceModelPreviewDetail,
  type FinanceModelRow,
  type FinanceRow,
  type PreviewDataState,
} from '../financeTypes';

type ScenarioVariant = 'base' | 'optimistic' | 'conservative';

type StatementValueRow = {
  line_code?: string | null;
  line_name?: string | null;
  aggregation_level?: number | null;
  is_total?: boolean;
  is_subtotal?: boolean;
  value?: number | string | null;
};

type StatementDetail = {
  id: string;
  statement_type: string;
  period_label?: string | null;
  values?: StatementValueRow[];
};

export function canComputeStatementPackRatios(statements: Array<Record<string, unknown>>): boolean {
  return (
    statements.length > 0 &&
    statements.every((statement) => {
      const readiness = String(statement.readiness_status || '')
        .trim()
        .toLowerCase();
      const status = String(statement.status || '')
        .trim()
        .toLowerCase();
      return readiness === 'ready' || status === 'confirmed' || status === 'approved';
    })
  );
}

const SCENARIO_VARIANTS: ScenarioVariant[] = ['base', 'optimistic', 'conservative'];

async function getStatementPackDetailWithFallback(packId: string) {
  try {
    const data = await V8FinanceApi.getStatementPack(packId);
    return data?.pack ?? null;
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/finance-statements/packs/${packId}`).catch(() => null);
  }
}

async function getStatementDetailWithFallback(statementId: string) {
  try {
    const data = await V8FinanceApi.getStatement(statementId);
    return data?.statement ?? null;
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/finance-statements/${statementId}`).catch(() => null);
  }
}

async function getModelDetailWithFallback(modelId: string) {
  try {
    const data = await V8FinanceApi.getModel(modelId);
    return data?.model ?? null;
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/financial-modeling/models/${modelId}`).catch(() => null);
  }
}

async function getModelValidationsWithFallback(modelId: string) {
  try {
    return await V8FinanceApi.getModelValidations(modelId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/financial-modeling/models/${modelId}/validations`).catch(() => null);
  }
}

const SCENARIO_PROFILES: Record<
  ScenarioVariant,
  {
    revenueGrowth: number;
    cogsRatio: number;
    opexRatio: number;
    depreciationRatio: number;
    taxRate: number;
    interestRate: number;
    arRatio: number;
    inventoryRatio: number;
    apRatio: number;
    capexRatio: number;
    debtDecay: number;
    dividendRatio: number;
  }
> = {
  base: {
    revenueGrowth: 0.055,
    cogsRatio: 0.605,
    opexRatio: 0.21,
    depreciationRatio: 0.038,
    taxRate: 0.19,
    interestRate: 0.052,
    arRatio: 0.145,
    inventoryRatio: 0.085,
    apRatio: 0.11,
    capexRatio: 0.05,
    debtDecay: 0.95,
    dividendRatio: 0.02,
  },
  optimistic: {
    revenueGrowth: 0.082,
    cogsRatio: 0.575,
    opexRatio: 0.198,
    depreciationRatio: 0.036,
    taxRate: 0.19,
    interestRate: 0.047,
    arRatio: 0.138,
    inventoryRatio: 0.078,
    apRatio: 0.105,
    capexRatio: 0.056,
    debtDecay: 0.92,
    dividendRatio: 0.026,
  },
  conservative: {
    revenueGrowth: 0.028,
    cogsRatio: 0.632,
    opexRatio: 0.225,
    depreciationRatio: 0.04,
    taxRate: 0.19,
    interestRate: 0.058,
    arRatio: 0.152,
    inventoryRatio: 0.094,
    apRatio: 0.114,
    capexRatio: 0.043,
    debtDecay: 0.975,
    dividendRatio: 0.015,
  },
};

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeStatementType(value: unknown): 'P&L' | 'BS' | 'CF' | null {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'P&L' || normalized === 'PL') return 'P&L';
  if (normalized === 'BS' || normalized === 'BALANCE_SHEET') return 'BS';
  if (normalized === 'CF' || normalized === 'CASH_FLOW') return 'CF';
  return null;
}

function buildForecastYears(startDate: string): string[] {
  const startYear = Number.parseInt(String(startDate || '').slice(0, 4), 10);
  const baseYear = Number.isFinite(startYear) ? startYear : new Date().getFullYear();
  return Array.from({ length: 3 }, (_, index) => String(baseYear + index));
}

function getLineValue(rows: StatementValueRow[], codes: string[], fallback: number = 0): number {
  for (const code of codes) {
    const match = rows.find(
      (row) =>
        String(row.line_code || '')
          .trim()
          .toUpperCase() === code
    );
    const value = Math.abs(toNumber(match?.value));
    if (value > 0) return value;
  }
  return fallback;
}

function buildModelPreviewDetail(
  row: FinanceModelRow,
  modelDetail: any,
  packDetail: any,
  statementDetails: StatementDetail[]
): FinanceModelPreviewDetail {
  const sourceStatements = Array.isArray(packDetail?.statements) ? packDetail.statements : [];
  const valuesByType: Record<'P&L' | 'BS' | 'CF', StatementValueRow[]> = {
    'P&L': [],
    BS: [],
    CF: [],
  };

  for (const statement of statementDetails) {
    const type = normalizeStatementType(statement?.statement_type);
    if (!type) continue;
    valuesByType[type] = Array.isArray(statement?.values) ? statement.values : [];
  }

  const baseline = modelDetail?.assumptions_json?.baseline || {};
  const years = buildForecastYears(String(row.startDate || modelDetail?.start_date || ''));

  const baseRevenue = getLineValue(
    valuesByType['P&L'],
    ['REVENUE'],
    toNumber(baseline.revenue) || 1000
  );
  const baseCogs = getLineValue(
    valuesByType['P&L'],
    ['COGS'],
    toNumber(baseline.cogs) || baseRevenue * 0.6
  );
  const baseOpex = getLineValue(
    valuesByType['P&L'],
    ['OPEX'],
    toNumber(baseline.opex) || baseRevenue * 0.2
  );
  const baseDepreciation = getLineValue(
    valuesByType['P&L'],
    ['DEPRECIATION'],
    toNumber(baseline.depreciation) || baseRevenue * 0.035
  );
  const baseCash = getLineValue(
    valuesByType['BS'],
    ['CASH'],
    toNumber(modelDetail?.assumptions_json?.initialCash) || baseRevenue * 0.08
  );
  const baseAr = getLineValue(
    valuesByType['BS'],
    ['AR'],
    toNumber(modelDetail?.assumptions_json?.initialAR) || baseRevenue * 0.14
  );
  const baseInventory = getLineValue(
    valuesByType['BS'],
    ['INVENTORY'],
    toNumber(modelDetail?.assumptions_json?.initialInventory) || baseRevenue * 0.09
  );
  const baseAp = getLineValue(
    valuesByType['BS'],
    ['AP'],
    toNumber(modelDetail?.assumptions_json?.initialAP) || baseCogs * 0.11
  );
  const basePpe = getLineValue(
    valuesByType['BS'],
    ['PPE_NET'],
    toNumber(modelDetail?.assumptions_json?.initialPPE) || baseRevenue * 0.24
  );
  const baseDebt = getLineValue(
    valuesByType['BS'],
    ['LONG_TERM_DEBT', 'TOTAL_LIABILITIES'],
    toNumber(modelDetail?.assumptions_json?.initialDebt) || baseRevenue * 0.22
  );
  const baseEquity = getLineValue(
    valuesByType['BS'],
    ['EQUITY', 'TOTAL_EQUITY'],
    toNumber(modelDetail?.assumptions_json?.initialEquity) || baseRevenue * 0.3
  );

  const scenarioTables = Object.fromEntries(
    SCENARIO_VARIANTS.map((variant) => {
      const profile = SCENARIO_PROFILES[variant];
      let revenue = baseRevenue;
      let ppe = basePpe;
      let cash = baseCash;
      let ar = baseAr;
      let inventory = baseInventory;
      let ap = baseAp;
      let debt = baseDebt;

      const plLines = [
        {
          lineCode: 'REVENUE',
          lineName: 'Revenue',
          level: 0,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'COGS',
          lineName: 'Cost of goods sold',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'GROSS_PROFIT',
          lineName: 'Gross profit',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'OPEX',
          lineName: 'Operating expenses',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'EBITDA',
          lineName: 'EBITDA',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'DEPRECIATION',
          lineName: 'Depreciation',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'EBIT',
          lineName: 'EBIT',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'INTEREST_EXPENSE',
          lineName: 'Interest expense',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'EBT',
          lineName: 'Earnings before tax',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        { lineCode: 'TAX', lineName: 'Income tax', level: 1, values: {} as Record<string, number> },
        {
          lineCode: 'NET_INCOME',
          lineName: 'Net income',
          level: 0,
          isTotal: true,
          values: {} as Record<string, number>,
        },
      ];

      const bsLines = [
        { lineCode: 'CASH', lineName: 'Cash', level: 1, values: {} as Record<string, number> },
        {
          lineCode: 'AR',
          lineName: 'Accounts receivable',
          level: 2,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'INVENTORY',
          lineName: 'Inventory',
          level: 2,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'CURRENT_ASSETS',
          lineName: 'Current assets',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'PPE_NET',
          lineName: 'Property, plant and equipment',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'TOTAL_ASSETS',
          lineName: 'Total assets',
          level: 0,
          isTotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'AP',
          lineName: 'Accounts payable',
          level: 2,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'CURRENT_LIABILITIES',
          lineName: 'Current liabilities',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'LONG_TERM_DEBT',
          lineName: 'Long-term debt',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'TOTAL_LIABILITIES',
          lineName: 'Total liabilities',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        { lineCode: 'EQUITY', lineName: 'Equity', level: 1, values: {} as Record<string, number> },
        {
          lineCode: 'TOTAL_LIABILITIES_EQUITY',
          lineName: 'Total liabilities + equity',
          level: 0,
          isTotal: true,
          values: {} as Record<string, number>,
        },
      ];

      const cfLines = [
        {
          lineCode: 'NET_INCOME_CF',
          lineName: 'Net income',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'DEPRECIATION_ADDBACK',
          lineName: 'Depreciation add-back',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'WC_CHANGE',
          lineName: 'Working capital change',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'OPERATING_CF',
          lineName: 'Operating cash flow',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'CAPEX_CF',
          lineName: 'Capital expenditure',
          level: 1,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'INVESTING_CF',
          lineName: 'Investing cash flow',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'FINANCING_CF',
          lineName: 'Financing cash flow',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'NET_CHANGE_CASH',
          lineName: 'Net change in cash',
          level: 0,
          isSubtotal: true,
          values: {} as Record<string, number>,
        },
        {
          lineCode: 'CLOSING_CASH',
          lineName: 'Closing cash',
          level: 0,
          isTotal: true,
          values: {} as Record<string, number>,
        },
      ];

      for (const year of years) {
        const previousWorkingCapital = ar + inventory - ap;
        revenue = revenue * (1 + profile.revenueGrowth);
        const cogs = revenue * profile.cogsRatio;
        const grossProfit = revenue - cogs;
        const opex = Math.max(
          baseOpex *
            Math.pow(1 + profile.revenueGrowth * 0.75, Number(year) - Number(years[0]) + 1),
          revenue * profile.opexRatio
        );
        const ebitda = grossProfit - opex;
        const depreciation = Math.max(baseDepreciation, ppe * profile.depreciationRatio);
        const ebit = ebitda - depreciation;
        const interest = Math.max(debt * profile.interestRate, 0);
        const ebt = ebit - interest;
        const tax = Math.max(ebt, 0) * profile.taxRate;
        const netIncome = ebt - tax;

        ar = revenue * profile.arRatio;
        inventory = revenue * profile.inventoryRatio;
        ap = cogs * profile.apRatio;
        const workingCapital = ar + inventory - ap;
        const wcChange = workingCapital - previousWorkingCapital;
        const operatingCf = netIncome + depreciation - wcChange;
        const capex = -(revenue * profile.capexRatio);
        const investingCf = capex;
        const nextDebt = debt * profile.debtDecay;
        const financingCf = -(debt - nextDebt) - revenue * profile.dividendRatio;
        const netChangeCash = operatingCf + investingCf + financingCf;
        cash = cash + netChangeCash;
        ppe = Math.max(ppe + Math.abs(capex) - depreciation, revenue * 0.16);
        debt = nextDebt;

        const currentAssets = cash + ar + inventory;
        const totalAssets = currentAssets + ppe;
        const currentLiabilities = ap;
        const totalLiabilities = currentLiabilities + debt;
        const equity = Math.max(totalAssets - totalLiabilities, baseEquity * 0.7);

        const assign = (
          lines: Array<{ lineCode: string; values: Record<string, number> }>,
          lineCode: string,
          value: number
        ) => {
          const line = lines.find((entry) => entry.lineCode === lineCode);
          if (line) line.values[year] = Math.round(value);
        };

        assign(plLines, 'REVENUE', revenue);
        assign(plLines, 'COGS', -cogs);
        assign(plLines, 'GROSS_PROFIT', grossProfit);
        assign(plLines, 'OPEX', -opex);
        assign(plLines, 'EBITDA', ebitda);
        assign(plLines, 'DEPRECIATION', -depreciation);
        assign(plLines, 'EBIT', ebit);
        assign(plLines, 'INTEREST_EXPENSE', -interest);
        assign(plLines, 'EBT', ebt);
        assign(plLines, 'TAX', -tax);
        assign(plLines, 'NET_INCOME', netIncome);

        assign(bsLines, 'CASH', cash);
        assign(bsLines, 'AR', ar);
        assign(bsLines, 'INVENTORY', inventory);
        assign(bsLines, 'CURRENT_ASSETS', currentAssets);
        assign(bsLines, 'PPE_NET', ppe);
        assign(bsLines, 'TOTAL_ASSETS', totalAssets);
        assign(bsLines, 'AP', ap);
        assign(bsLines, 'CURRENT_LIABILITIES', currentLiabilities);
        assign(bsLines, 'LONG_TERM_DEBT', debt);
        assign(bsLines, 'TOTAL_LIABILITIES', totalLiabilities);
        assign(bsLines, 'EQUITY', equity);
        assign(bsLines, 'TOTAL_LIABILITIES_EQUITY', totalLiabilities + equity);

        assign(cfLines, 'NET_INCOME_CF', netIncome);
        assign(cfLines, 'DEPRECIATION_ADDBACK', depreciation);
        assign(cfLines, 'WC_CHANGE', -wcChange);
        assign(cfLines, 'OPERATING_CF', operatingCf);
        assign(cfLines, 'CAPEX_CF', capex);
        assign(cfLines, 'INVESTING_CF', investingCf);
        assign(cfLines, 'FINANCING_CF', financingCf);
        assign(cfLines, 'NET_CHANGE_CASH', netChangeCash);
        assign(cfLines, 'CLOSING_CASH', cash);
      }

      return [variant, { 'P&L': plLines, BS: bsLines, CF: cfLines }];
    })
  ) as FinanceModelPreviewDetail['scenarioTables'];

  return {
    sourceDocumentTitle: String(
      packDetail?.entity_name ||
        modelDetail?.source_statement_pack?.entity_name ||
        row.sourceDocumentTitle ||
        'Seeded statement pack'
    ),
    sourcePeriodLabel: String(
      packDetail?.period_label || modelDetail?.source_statement_pack?.period_label || 'Base year'
    ),
    currency: String(modelDetail?.currency || row.currency || packDetail?.currency || 'PLN'),
    forecastYears: years,
    selectedScenario: String(row.scenario || 'base'),
    variants: SCENARIO_VARIANTS,
    analyticalDepthLabel: row.analyticalDepthLabel || 'L1-L3',
    sourceStatementCount: sourceStatements.length || 0,
    scenarioTables,
  };
}

export function useFinanceSelection(activeTab: ModuleTab) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FinanceRow | null>(null);

  const [predictionValidations, setPredictionValidations] =
    useState<PreviewDataState['predictionValidations']>(null);
  const [statementPreviewDetail, setStatementPreviewDetail] =
    useState<PreviewDataState['statementPreviewDetail']>(null);
  const [statementPreviewRatios, setStatementPreviewRatios] =
    useState<PreviewDataState['statementPreviewRatios']>(null);
  const [modelPreviewDetail, setModelPreviewDetail] =
    useState<PreviewDataState['modelPreviewDetail']>(null);
  const [analysisPreviewRatios, setAnalysisPreviewRatios] =
    useState<PreviewDataState['analysisPreviewRatios']>(null);
  const [budgetPreviewScenarios, setBudgetPreviewScenarios] =
    useState<PreviewDataState['budgetPreviewScenarios']>(null);
  const [valuationPreviewResults, setValuationPreviewResults] =
    useState<PreviewDataState['valuationPreviewResults']>(null);
  const [valuationPreviewDetail, setValuationPreviewDetail] =
    useState<PreviewDataState['valuationPreviewDetail']>(null);

  useEffect(() => {
    setSelectedId(null);
    setSelectedItem(null);
    setStatementPreviewDetail(null);
    setStatementPreviewRatios(null);
    setModelPreviewDetail(null);
    setPredictionValidations(null);
    setAnalysisPreviewRatios(null);
    setBudgetPreviewScenarios(null);
    setValuationPreviewResults(null);
    setValuationPreviewDetail(null);
  }, [activeTab]);

  const getBudgetRawId = useCallback((rowId: string) => {
    return rowId.startsWith('budget-') ? rowId.slice(7) : rowId;
  }, []);

  const loadPredictionPreview = useCallback(async (modelId: string) => {
    try {
      const val = await getModelValidationsWithFallback(modelId);
      setPredictionValidations((val as any)?.summary || null);
    } catch {
      setPredictionValidations(null);
    }
  }, []);

  const loadModelPreview = useCallback(async (row: FinanceModelRow) => {
    try {
      const model = (await getModelDetailWithFallback(row.id)) as any;
      const packId =
        model?.source_statement_pack_id ||
        model?.source_statement_pack?.id ||
        row.sourceStatementPackId ||
        null;
      const packDetail = packId ? await getStatementPackDetailWithFallback(String(packId)) : null;
      const packStatements = Array.isArray((packDetail as any)?.statements)
        ? ((packDetail as any).statements as Array<{ id: string }>)
        : [];

      const statementDetails = (
        await Promise.all(
          packStatements
            .slice(0, 3)
            .map(async (statement) => getStatementDetailWithFallback(String(statement.id)))
        )
      ).filter(Boolean) as StatementDetail[];

      setModelPreviewDetail(buildModelPreviewDetail(row, model, packDetail, statementDetails));
    } catch {
      setModelPreviewDetail(null);
    }
  }, []);

  const loadStatementPreview = useCallback(async (statementId: string) => {
    try {
      const detail = await getStatementPackDetailWithFallback(statementId);
      const statements = Array.isArray((detail as any)?.statements)
        ? (detail as any).statements
        : [];
      setStatementPreviewDetail({
        entityName: String((detail as any)?.entity_name || ''),
        periodLabel: String((detail as any)?.period_label || ''),
        periodStart: String((detail as any)?.period_start || ''),
        periodEnd: String((detail as any)?.period_end || ''),
        currency: String((detail as any)?.currency || 'PLN'),
        scaling: String((detail as any)?.scaling || 'units'),
        sourceFileName: statements
          .map((statement: any) => String(statement?.source_file_name || ''))
          .filter(Boolean)
          .join(', '),
        validationStatus: String((detail as any)?.pack_status || 'pending'),
        rawStatus: String((detail as any)?.pack_status || 'draft'),
        readinessStatus: String(
          (detail as any)?.pack_readiness_status || (detail as any)?.readiness_status || 'pending'
        ),
        readinessSummary: String(
          (detail as any)?.pack_quality_summary || (detail as any)?.readiness_summary || ''
        ),
        missingStatementTypes: Array.isArray((detail as any)?.missing_statement_types)
          ? (detail as any).missing_statement_types.map((type: unknown) => String(type))
          : [],
        sourceStatementCount: Number((detail as any)?.source_statement_count ?? statements.length),
        childStatements: statements.map((statement: any) => ({
          id: String(statement.id),
          statementType: String(statement.statement_type || ''),
          rawStatus: String(statement.status || 'draft'),
          readinessStatus: String(statement.readiness_status || 'pending'),
          readinessScore: Number(statement.readiness_score ?? 0),
          validationStatus: String(statement.validation_status || 'pending'),
          mappedLineCount: Number(statement.mapped_line_count ?? 0),
          totalLineCount: Number(statement.total_line_count ?? 0),
          unmappedLineCount: Number(statement.unmapped_line_count ?? 0),
          sourceFileName: String(statement.source_file_name || ''),
          updatedAt: String(statement.updated_at || statement.created_at || ''),
          valuesVersion: Number(statement.values_version ?? 0),
          validationFailCount: Number(statement.validation_fail_count ?? 0),
          validationWarningCount: Number(statement.validation_warning_count ?? 0),
        })),
        packValidations: Array.isArray((detail as any)?.validations)
          ? (detail as any).validations.map((validation: any) => ({
              validationScope: 'pack',
              checkCode: String(validation.check_code || ''),
              checkName: String(validation.check_name || ''),
              severity: String(validation.severity || 'info') as 'info' | 'warning' | 'error',
              status: String(validation.status || 'pass') as 'pass' | 'warning' | 'fail',
              expectedValue:
                validation.expected_value != null ? Number(validation.expected_value) : null,
              actualValue: validation.actual_value != null ? Number(validation.actual_value) : null,
              difference: validation.difference != null ? Number(validation.difference) : null,
              tolerance: validation.tolerance != null ? Number(validation.tolerance) : null,
              message: validation.message ? String(validation.message) : null,
              detailsJson: validation.details_json ? String(validation.details_json) : null,
              computedAt: validation.computed_at ? String(validation.computed_at) : '',
            }))
          : [],
        mappedLineCount: statements.reduce(
          (sum: number, statement: any) => sum + Number(statement?.mapped_line_count ?? 0),
          0
        ),
        totalLineCount: statements.reduce(
          (sum: number, statement: any) => sum + Number(statement?.total_line_count ?? 0),
          0
        ),
        unmappedLineCount: statements.reduce(
          (sum: number, statement: any) => sum + Number(statement?.unmapped_line_count ?? 0),
          0
        ),
        topLineItems: statements.slice(0, 4).map((statement: any) => ({
          label: String(statement.statement_type || ''),
          code: String(statement.readiness_status || 'pending'),
          value: Number(statement.mapped_line_count ?? 0),
        })),
      });

      const firstStatementId = statements[0]?.id;
      // Ratio computation is a statement-ready capability. A newly staged
      // pack is deliberately recoverable/pending, so probing the endpoint here
      // creates a misleading 404 during a successful cold recovery journey.
      if (firstStatementId && canComputeStatementPackRatios(statements)) {
        try {
          const ratiosData = await V8FinanceApi.getStatementRatios(String(firstStatementId));
          const ratioResult = ratiosData?.ratios;
          setStatementPreviewRatios(
            ratioResult
              ? {
                  coveragePct: ratioResult.coverageSummary?.coveragePct ?? 0,
                  computed: ratioResult.coverageSummary?.computed ?? ratioResult.ratios.length,
                  total: ratioResult.coverageSummary?.total ?? ratioResult.ratios.length,
                  topRatios: ratioResult.ratios.slice(0, 4).map((ratio) => ({
                    code: ratio.code,
                    name: ratio.name,
                    value: ratio.value ?? null,
                  })),
                }
              : null
          );
        } catch {
          setStatementPreviewRatios(null);
        }
      } else {
        setStatementPreviewRatios(null);
      }
    } catch {
      setStatementPreviewDetail(null);
      setStatementPreviewRatios(null);
    }
  }, []);

  const loadBudgetPreviewScenarios = useCallback(async (budgetRawId: string) => {
    try {
      const data = await Api.get(`/api/economics/budgets/${budgetRawId}`);
      const scenarios = (data as any)?.scenarios;
      if (Array.isArray(scenarios) && scenarios.length > 0) {
        setBudgetPreviewScenarios(
          scenarios.map((s: any) => ({
            scenarioType: s.scenarioType || s.scenario_type || 'base',
            name: s.name || s.scenarioType || 'base',
            isActive: !!s.isActive || !!s.is_active,
            summaryMetrics: s.summaryMetrics || s.summary_metrics || {},
          }))
        );
      } else {
        setBudgetPreviewScenarios(null);
      }
    } catch {
      setBudgetPreviewScenarios(null);
    }
  }, []);

  const loadAnalysisPreviewRatios = useCallback(async (analysisId: string) => {
    try {
      let ratios: any[] | null = null;
      try {
        const data = await V8FinanceApi.getAnalysisRatios(analysisId);
        ratios = Array.isArray(data?.ratios) ? data.ratios : null;
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        const data = await Api.get(`/api/economics/financial-analyses/${analysisId}/ratios`);
        ratios = Array.isArray((data as any)?.ratios) ? (data as any).ratios : null;
      }
      if (Array.isArray(ratios) && ratios.length > 0) {
        setAnalysisPreviewRatios(
          ratios.map((r: any) => ({
            category: r.category,
            ratio_code: r.ratio_code,
            ratio_name: r.ratio_name,
            value: r.value != null ? Number(r.value) : null,
          }))
        );
      } else {
        setAnalysisPreviewRatios(null);
      }
    } catch {
      setAnalysisPreviewRatios(null);
    }
  }, []);

  const loadValuationPreviewResults = useCallback(async (valuationId: string) => {
    try {
      const data = await Api.get(`/api/economics/valuations/${valuationId}`);
      const v = (data as any)?.valuation;
      const results = typeof v?.results === 'string' ? JSON.parse(v.results) : v?.results;
      const dcf = results?.dcf;
      const advisory = typeof v?.advisory === 'string' ? JSON.parse(v.advisory) : v?.advisory;
      const negotiationPack =
        typeof v?.negotiation_pack === 'string'
          ? JSON.parse(v.negotiation_pack)
          : v?.negotiation_pack;
      const sensitivity = results?.sensitivity || null;
      const displayMultiplier = valuationDisplayMultiplier(results);

      if (dcf) {
        setValuationPreviewResults({
          enterpriseValue: valuationDisplayValue(dcf.enterpriseValue, displayMultiplier),
          equityValue: valuationDisplayValue(dcf.equityValue, displayMultiplier),
          evEbitda: dcf.impliedMultiple != null ? Number(dcf.impliedMultiple) : null,
          currency: String(v?.currency || results?.currency || ''),
        });
      } else {
        setValuationPreviewResults(null);
      }

      setValuationPreviewDetail({
        advisory: advisory || null,
        negotiationPack: negotiationPack || null,
        sensitivity: sensitivity || null,
        displayMultiplier,
      });
    } catch {
      setValuationPreviewResults(null);
      setValuationPreviewDetail(null);
    }
  }, []);

  const clearAllPreview = useCallback(() => {
    setStatementPreviewDetail(null);
    setStatementPreviewRatios(null);
    setModelPreviewDetail(null);
    setPredictionValidations(null);
    setAnalysisPreviewRatios(null);
    setBudgetPreviewScenarios(null);
    setValuationPreviewResults(null);
    setValuationPreviewDetail(null);
  }, []);

  const onSelectRow = useCallback(
    (row: FinanceRow) => {
      setSelectedId(row.id);
      setSelectedItem(row);
      if (row.kind === 'statements') {
        loadStatementPreview(row.id);
        setModelPreviewDetail(null);
        setPredictionValidations(null);
        setAnalysisPreviewRatios(null);
        setBudgetPreviewScenarios(null);
        setValuationPreviewResults(null);
        setValuationPreviewDetail(null);
      } else if (row.kind === 'models') {
        setStatementPreviewDetail(null);
        setStatementPreviewRatios(null);
        setAnalysisPreviewRatios(null);
        setBudgetPreviewScenarios(null);
        setValuationPreviewResults(null);
        setValuationPreviewDetail(null);
        loadModelPreview(row as FinanceModelRow);
        loadPredictionPreview(row.id);
      } else if (row.kind === 'prediction') {
        const modelRow = row as FinanceModelRow;
        if (modelRow.predictionType === 'budget') {
          setStatementPreviewDetail(null);
          setStatementPreviewRatios(null);
          setModelPreviewDetail(null);
          setPredictionValidations(null);
          setAnalysisPreviewRatios(null);
          setValuationPreviewResults(null);
          setValuationPreviewDetail(null);
          loadBudgetPreviewScenarios(getBudgetRawId(row.id));
        } else {
          setStatementPreviewDetail(null);
          setStatementPreviewRatios(null);
          setModelPreviewDetail(null);
          loadPredictionPreview(row.id);
          setAnalysisPreviewRatios(null);
          setBudgetPreviewScenarios(null);
          setValuationPreviewResults(null);
          setValuationPreviewDetail(null);
        }
      } else if (row.kind === 'analysis' || row.kind === 'investment') {
        setStatementPreviewDetail(null);
        setStatementPreviewRatios(null);
        setModelPreviewDetail(null);
        setPredictionValidations(null);
        setBudgetPreviewScenarios(null);
        setValuationPreviewResults(null);
        setValuationPreviewDetail(null);
        loadAnalysisPreviewRatios(row.id);
      } else if (row.kind === 'valuation') {
        setStatementPreviewDetail(null);
        setStatementPreviewRatios(null);
        setModelPreviewDetail(null);
        setPredictionValidations(null);
        setAnalysisPreviewRatios(null);
        setBudgetPreviewScenarios(null);
        loadValuationPreviewResults(row.id);
      } else {
        clearAllPreview();
      }
    },
    [
      loadPredictionPreview,
      loadStatementPreview,
      loadAnalysisPreviewRatios,
      loadBudgetPreviewScenarios,
      getBudgetRawId,
      loadValuationPreviewResults,
      clearAllPreview,
      loadModelPreview,
    ]
  );

  const deselectRow = useCallback(() => {
    setSelectedId(null);
    setSelectedItem(null);
    clearAllPreview();
  }, [clearAllPreview]);

  return {
    selectedId,
    setSelectedId,
    selectedItem,
    setSelectedItem,
    statementPreviewDetail,
    statementPreviewRatios,
    modelPreviewDetail,
    predictionValidations,
    analysisPreviewRatios,
    budgetPreviewScenarios,
    valuationPreviewResults,
    valuationPreviewDetail,
    getBudgetRawId,
    loadStatementPreview,
    loadModelPreview,
    loadPredictionPreview,
    loadBudgetPreviewScenarios,
    loadAnalysisPreviewRatios,
    loadValuationPreviewResults,
    onSelectRow,
    deselectRow,
    clearAllPreview,
  };
}
