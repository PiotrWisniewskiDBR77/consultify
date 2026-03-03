/**
 * Finance Export Service (V3-I01)
 *
 * Handles export of financial analysis to report or presentation with traceability.
 */

import { Api } from './api';

export interface ExportResult {
  outputId: string;
  outputType: 'report' | 'presentation';
  title: string;
  hasTemplate: boolean;
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
