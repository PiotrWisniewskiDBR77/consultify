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

export interface ExportFinancialAnalysisParams {
  analysisId: string;
  analysisTitle: string;
  outputType: 'report' | 'presentation';
  templateId?: string;
  initiativeIds?: string[];
}

/**
 * Export financial analysis to report or presentation.
 * Creates output via report-builder API with source_type: financial_analysis.
 */
export async function exportFinancialAnalysis(
  params: ExportFinancialAnalysisParams
): Promise<ExportResult> {
  const { analysisId, analysisTitle, outputType, templateId, initiativeIds } = params;

  const title = `Financial Analysis: ${analysisTitle}`;
  const sourceType = 'FINANCIAL_ANALYSIS';

  const response = await Api.post('/report-builder', {
    sourceType,
    sourceId: analysisId,
    sourceName: analysisTitle,
    title,
    description: `Draft ${outputType} exported from financial analysis`,
    templateId: templateId || undefined,
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
