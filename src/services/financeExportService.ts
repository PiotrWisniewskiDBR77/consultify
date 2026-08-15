/**
 * Finance Export Service (V3-I01)
 *
 * Handles export of financial analysis to report or presentation with traceability.
 */

import { Api } from './api';
import { V8FinanceApi, type V8FinanceModelDetail } from './api/v8/finance';

export interface ExportResult {
  outputId: string;
  outputType: 'report' | 'presentation' | 'workbook';
  title: string;
  hasTemplate: boolean;
}

type WorkbookScenarioKey = 'base' | 'bull' | 'bear';

function finite(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Workbook export requires ${label}`);
  return parsed;
}

function scenarioKey(label: unknown): WorkbookScenarioKey | null {
  const normalized = String(label || '')
    .trim()
    .toLowerCase();
  if (['base', 'baseline', 'bazowy'].includes(normalized)) return 'base';
  if (['bull', 'upside', 'optimistic', 'optymistyczny'].includes(normalized)) return 'bull';
  if (['bear', 'downside', 'conservative', 'pesymistyczny'].includes(normalized)) return 'bear';
  return null;
}

export function buildFinanceWorkbookParams(
  models: V8FinanceModelDetail[]
): Record<string, unknown> {
  const byScenario = new Map<WorkbookScenarioKey, V8FinanceModelDetail>();
  for (const model of models) {
    const key = scenarioKey(model.scenario);
    if (key) byScenario.set(key, model);
  }
  for (const key of ['base', 'bull', 'bear'] as const) {
    if (!byScenario.has(key)) {
      throw new Error(`Workbook export requires a persisted ${key} scenario`);
    }
  }

  const baseModel = byScenario.get('base')!;
  const baseAssumptions = (baseModel.assumptions_json || {}) as Record<string, any>;
  const baseBaseline = (baseAssumptions.baseline || {}) as Record<string, unknown>;
  const baseRevenue = finite(baseBaseline.revenue, 'base.baseline.revenue');
  const params: Record<string, unknown> = {
    companyName: baseModel.name,
    currencyCode: String(baseModel.currency || 'PLN').toUpperCase(),
    startYear: Number(String(baseModel.start_date || '').slice(0, 4)) || new Date().getFullYear(),
    baseRevenue,
  };

  for (const key of ['base', 'bull', 'bear'] as const) {
    const model = byScenario.get(key)!;
    const assumptions = (model.assumptions_json || {}) as Record<string, any>;
    const baseline = (assumptions.baseline || {}) as Record<string, unknown>;
    const revenue = finite(baseline.revenue, `${key}.baseline.revenue`);
    if (revenue === 0) {
      throw new Error(`Workbook export cannot derive ratios from zero ${key} revenue`);
    }
    params[`${key}.revenueGrowthPct`] = finite(
      assumptions.revenueGrowthPct ?? 0,
      `${key}.revenueGrowthPct`
    );
    params[`${key}.cogsPct`] = finite(baseline.cogs, `${key}.baseline.cogs`) / revenue;
    params[`${key}.opexPct`] = finite(baseline.opex, `${key}.baseline.opex`) / revenue;
    params[`${key}.daPct`] =
      finite(baseline.depreciation, `${key}.baseline.depreciation`) / revenue;
    params[`${key}.interestPct`] = finite(baseline.interest, `${key}.baseline.interest`) / revenue;
    params[`${key}.taxRatePct`] = finite(assumptions.taxRatePct, `${key}.taxRatePct`);
  }
  return params;
}

export async function exportFinancialModelWorkbook(params: {
  modelId: string;
}): Promise<ExportResult> {
  const caseResult = await V8FinanceApi.getCaseScenarios(params.modelId);
  const scenarioRows = caseResult?.scenarios || [];
  const details = await Promise.all(
    scenarioRows.map(async (row) => (await V8FinanceApi.getModel(row.id)).model)
  );
  const workbookParams = buildFinanceWorkbookParams(details);
  const sourceModel = details.find((model) => scenarioKey(model.scenario) === 'base')!;
  const response = await Api.post('/workbook/templates/threeScenarioPnL/build', {
    params: workbookParams,
    projectId: sourceModel.project_id || undefined,
    sourceInitiativeId: sourceModel.initiative_id || undefined,
  });
  if (!response?.id || !response?.downloadUrl) {
    throw new Error('Workbook build did not return a persisted artifact');
  }
  return {
    outputId: response.id,
    outputType: 'workbook',
    title: response.title || `Financial Model: ${sourceModel.name}`,
    hasTemplate: true,
  };
}

export type ExportableSourceType =
  | 'financial_analysis'
  | 'financial_model'
  | 'valuation'
  | 'budget';

const SOURCE_TYPE_MAP: Record<ExportableSourceType, string> = {
  financial_analysis: 'FINANCIAL_ANALYSIS',
  financial_model: 'FINANCIAL_ANALYSIS',
  valuation: 'VALUATION',
  budget: 'FINANCIAL_ANALYSIS',
};

const TITLE_PREFIX_MAP: Record<ExportableSourceType, string> = {
  financial_analysis: 'Financial Analysis',
  financial_model: 'Financial Model',
  valuation: 'Enterprise Valuation',
  budget: 'Budget Forecast',
};

export interface ExportFinancialAnalysisParams {
  analysisId: string;
  analysisTitle: string;
  analysisType?: ExportableSourceType;
  outputType: 'report' | 'presentation';
  templateId?: string;
  initiativeIds?: string[];
  brief?: {
    goal?: string;
    audience?: string;
    language?: 'pl' | 'en';
    format?: string;
    scope?: string;
  };
}

/**
 * Export financial analysis / valuation / model to report or presentation.
 * Creates output via report-builder API.
 */
export async function exportFinancialAnalysis(
  params: ExportFinancialAnalysisParams
): Promise<ExportResult> {
  const { analysisId, analysisTitle, outputType, templateId, initiativeIds, analysisType, brief } =
    params;

  const effectiveType = analysisType || 'financial_analysis';
  const title = `${TITLE_PREFIX_MAP[effectiveType]}: ${analysisTitle}`;
  const sourceType = SOURCE_TYPE_MAP[effectiveType];

  const response = await Api.post('/report-builder', {
    sourceType,
    sourceId: analysisId,
    sourceName: analysisTitle,
    title,
    description: `Draft ${outputType} exported from financial analysis`,
    templateId: templateId || undefined,
    // Keep intent metadata for traceability and better generation defaults.
    // (Report Builder treats this as optional config snapshot.)
    config: {
      sourceSubType: effectiveType,
      outputType,
      exportedAt: new Date().toISOString(),
      brief: brief || undefined,
    },
  });

  const report = response?.report;
  if (!report?.id) {
    throw new Error('Failed to create output');
  }

  const outputId = report.id;

  // Link initiative IDs if provided
  if (initiativeIds?.length && outputId) {
    try {
      await Api.post('/report-initiatives/link', {
        reportId: outputId,
        initiativeIds,
      });
    } catch {
      // Non-fatal: report was created, linking failed
    }
  }

  return {
    outputId,
    outputType,
    title: report.title || title,
    hasTemplate: !!templateId,
  };
}
