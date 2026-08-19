import {
  BarChart3,
  Calculator,
  Clock,
  FileText,
  MoreVertical,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { statusChipTone } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import {
  approveCanonicalFinancialAnalysis,
  approveCanonicalValuation,
  approveFinanceModel,
  resolveLegacyFinanceArtifact,
  runCanonicalFinancialAnalysis,
} from '@/services/api/financeV2.api';
import {
  type FinanceVersionSnapshot,
  shouldFallbackToLegacyFinance,
  V8FinanceApi,
} from '@/services/api/v8/finance';

import {
  type FinanceAnalysisRow,
  type FinanceKind,
  type FinanceModelRow,
  type FinanceRow,
  type FinanceStatementRow,
  type FinanceValuationRow,
  formatAge,
  getTypeCode,
  type PreviewDataState,
} from './financeTypes';
import { FinanceVersionTimeline } from './FinanceVersionTimeline';
import { normalizeSensitivityGrid } from './normalizeSensitivityGrid';

const KIND_ICON_MAP: Record<FinanceKind, typeof Calculator> = {
  statements: FileText,
  models: Calculator,
  analysis: BarChart3,
  investment: Target,
  prediction: TrendingUp,
  valuation: Target,
};

async function computeModelWithFallback(modelId: string) {
  try {
    return await V8FinanceApi.computeModel(modelId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(`/api/financial-modeling/models/${modelId}/compute`, {});
  }
}

async function approveCanonicalModel(legacyModelId: string) {
  const identity = await resolveLegacyFinanceArtifact('financial_models', legacyModelId);
  if (identity.status !== 'RESOLVED') {
    throw new Error(
      identity.status === 'QUARANTINED'
        ? identity.reason || 'Model identity is quarantined'
        : 'Model has no canonical identity. Run the Finance backfill before approval.'
    );
  }
  return approveFinanceModel({
    modelArtifactId: identity.artifactId,
    idempotencyKey: crypto.randomUUID(),
  });
}

function PackValidationsSection({
  validations,
}: {
  validations: Array<{
    checkCode: string;
    checkName: string;
    severity: string;
    status: string;
    message?: string | null;
    expectedValue?: number | null;
    actualValue?: number | null;
    computedAt?: string;
  }>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const shown = expanded ? validations : validations.slice(0, 3);
  return (
    <div className="pt-1">
      <div className="flex flex-wrap gap-1">
        {shown.map((validation) => (
          <span
            key={`${validation.checkCode}-${validation.computedAt || ''}`}
            title={validation.message || undefined}
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium cursor-default ${
              validation.status === 'fail'
                ? 'bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300'
                : validation.status === 'warning'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
            }`}
          >
            {validation.checkName}
          </span>
        ))}
      </div>
      {validations.length > 3 && (
        <button
          type="button"
          className="text-[10px] font-medium text-c-info hover:underline mt-1 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `Show all ${validations.length} validations`}
        </button>
      )}
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {validations
            .filter((v) => v.status !== 'pass')
            .map((v) => (
              <div
                key={`${v.checkCode}-detail`}
                className="text-[10px] text-slate-600 dark:text-slate-400"
              >
                <span className="font-medium">{v.checkCode}</span>: {v.message || v.checkName}
                {v.expectedValue != null && v.actualValue != null && (
                  <span className="text-slate-600">
                    {' '}
                    (expected: {v.expectedValue}, actual: {v.actualValue})
                  </span>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

interface FinancePreviewPanelProps {
  statementPreviewDetail: PreviewDataState['statementPreviewDetail'];
  statementPreviewRatios: PreviewDataState['statementPreviewRatios'];
  modelPreviewDetail: PreviewDataState['modelPreviewDetail'];
  predictionValidations: PreviewDataState['predictionValidations'];
  analysisPreviewRatios: PreviewDataState['analysisPreviewRatios'];
  budgetPreviewScenarios: PreviewDataState['budgetPreviewScenarios'];
  valuationPreviewResults: PreviewDataState['valuationPreviewResults'];
  valuationPreviewDetail: PreviewDataState['valuationPreviewDetail'];
  handleOpenFull: (row: FinanceRow) => void;
  handleCreateModelFromStatement: (row: FinanceStatementRow) => void;
  handleCreateAnalysisFromStatements: (row: FinanceStatementRow) => void;
  loadStatements: () => Promise<void>;
  loadModels: () => Promise<void>;
  loadAnalyses: () => Promise<void>;
  loadAnalysisPreviewRatios: (id: string) => Promise<void>;
  loadBudgets: () => Promise<void>;
  loadBudgetPreviewScenarios: (id: string) => Promise<void>;
  loadPredictionPreview: (id: string) => Promise<void>;
  loadValuations: () => Promise<void>;
  loadValuationPreviewResults: (id: string) => Promise<void>;
  getBudgetRawId: (id: string) => string;
  versionSnapshots?: FinanceVersionSnapshot[];
}

export function useFinancePreview({
  statementPreviewDetail,
  statementPreviewRatios,
  modelPreviewDetail,
  predictionValidations,
  analysisPreviewRatios,
  budgetPreviewScenarios,
  valuationPreviewResults,
  valuationPreviewDetail,
  handleOpenFull,
  handleCreateModelFromStatement,
  handleCreateAnalysisFromStatements,
  loadStatements,
  loadModels,
  loadAnalyses,
  loadAnalysisPreviewRatios,
  loadBudgets,
  loadBudgetPreviewScenarios,
  loadPredictionPreview,
  loadValuations,
  loadValuationPreviewResults,
  getBudgetRawId,
  versionSnapshots,
}: FinancePreviewPanelProps) {
  const { t, i18n } = useTranslation();
  const numberLocale = i18n.language?.startsWith('pl') ? 'pl-PL' : 'en-US';

  const ModelStatementPreview: React.FC<{
    detail: NonNullable<PreviewDataState['modelPreviewDetail']>;
  }> = ({ detail }) => {
    const [selectedVariant, setSelectedVariant] = useState<'base' | 'optimistic' | 'conservative'>(
      detail.variants.includes(detail.selectedScenario as 'base' | 'optimistic' | 'conservative')
        ? (detail.selectedScenario as 'base' | 'optimistic' | 'conservative')
        : 'base'
    );
    const [selectedStatement, setSelectedStatement] = useState<'P&L' | 'BS' | 'CF'>('P&L');

    const rows = detail.scenarioTables[selectedVariant]?.[selectedStatement] || [];
    const variantLabels = {
      base: 'Base',
      optimistic: t('finance.preview.variantOptimistic', 'Optimistic'),
      conservative: t('finance.preview.variantConservative', 'Conservative'),
    };
    const statementLabels = {
      'P&L': 'P&L',
      BS: t('finance.preview.statementBS', 'Balance Sheet'),
      CF: 'Cash Flow',
    };

    return (
      <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              {t('finance.preview.sourceDocument', 'Source document')}
            </div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">
              {detail.sourceDocumentTitle}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {detail.sourcePeriodLabel} • {detail.sourceStatementCount}{' '}
              {t('finance.preview.sourceStatementsSuffix', 'source statements')}
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('finance.preview.analyticalLevels', 'Analytical levels')}:{' '}
            {detail.analyticalDepthLabel}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {detail.variants.map((variant) => (
            <button
              key={variant}
              onClick={() => setSelectedVariant(variant)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedVariant === variant
                  ? 'bg-blue-600 text-white'
                  : 'bg-c-surface text-c-text-secondary'
              }`}
            >
              {variantLabels[variant]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {(['P&L', 'BS', 'CF'] as const).map((statement) => (
            <button
              key={statement}
              onClick={() => setSelectedStatement(statement)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedStatement === statement
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-c-surface text-c-text-secondary'
              }`}
            >
              {statementLabels[statement]}
            </button>
          ))}
        </div>

        {/* §27-exempt: financial-calculation — forecast grid with hierarchical row groups (income/costs/EBITDA/taxes) and a computed totals column; not a flat data array */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-white/[0.04]">
                <th className="min-w-[220px] px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">
                  {t('finance.preview.lineColumn', 'Line')}
                </th>
                {detail.forecastYears.map((year) => (
                  <th
                    key={year}
                    className="px-3 py-2 text-right font-semibold text-slate-500 dark:text-slate-400"
                  >
                    {year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06]">
              {rows.map((line) => (
                <tr
                  key={`${selectedVariant}-${selectedStatement}-${line.lineCode}`}
                  className={
                    line.isTotal
                      ? 'bg-slate-100/60 dark:bg-white/[0.06]'
                      : line.isSubtotal
                        ? 'bg-slate-50/80 dark:bg-white/[0.03]'
                        : ''
                  }
                >
                  <td
                    className="px-3 py-2 text-slate-800 dark:text-slate-200"
                    style={{ paddingLeft: `${12 + line.level * 16}px` }}
                  >
                    <span className={line.isTotal || line.isSubtotal ? 'font-semibold' : ''}>
                      {line.lineName}
                    </span>
                  </td>
                  {detail.forecastYears.map((year) => {
                    const value = line.values[year] ?? 0;
                    return (
                      <td
                        key={`${line.lineCode}-${year}`}
                        className={`px-3 py-2 text-right font-mono ${
                          value < 0
                            ? 'text-danger-600 dark:text-danger-300'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {new Intl.NumberFormat(numberLocale, {
                          maximumFractionDigits: 0,
                        }).format(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPreviewBody = useCallback(
    (row: FinanceRow) => {
      const metaPills: { label: string; value: string }[] = [];

      if (row.kind === 'statements') {
        const sRow = row as FinanceStatementRow;
        metaPills.push(
          { label: t('finance.columns.type', 'Type'), value: 'Pack' },
          {
            label: t('finance.columns.period', 'Period'),
            value: sRow.periodLabel || sRow.periodEnd,
          },
          { label: t('common.currency', 'Currency'), value: sRow.currency },
          { label: t('finance.columns.scaling', 'Scaling'), value: sRow.scaling }
        );
      } else if (row.kind === 'models') {
        metaPills.push(
          {
            label: t('finance.columns.variants', 'Variants'),
            value: row.variantLabel || 'base / optimistic / conservative',
          },
          { label: t('common.currency', 'Currency'), value: row.currency },
          {
            label: t('finance.columns.forecastWindow', 'Forecast'),
            value: row.forecastWindowLabel || `${row.horizonMonths} ${t('finance.units.mo', 'mo')}`,
          }
        );
        metaPills.push({
          label: t('finance.columns.document', 'Document'),
          value: modelPreviewDetail?.sourceDocumentTitle || row.sourceDocumentTitle || '—',
        });
        if (row.startDate)
          metaPills.push({
            label: t('finance.columns.start', 'Start'),
            value: new Date(row.startDate).toLocaleDateString(),
          });
      } else if (row.kind === 'prediction') {
        const pRow = row as FinanceModelRow;
        if (pRow.predictionType === 'budget') {
          metaPills.push(
            {
              label: t('finance.prediction.subtype', 'Type'),
              value: t('finance.prediction.budget', 'Budget'),
            },
            { label: t('common.currency', 'Currency'), value: pRow.currency }
          );
          if (pRow.periodStart && pRow.periodEnd)
            metaPills.push({
              label: t('finance.columns.period', 'Period'),
              value: `${pRow.periodStart} → ${pRow.periodEnd}`,
            });
        } else {
          metaPills.push(
            { label: t('finance.prediction.subtype', 'Type'), value: 'Model' },
            { label: t('finance.columns.scenario', 'Scenario'), value: pRow.scenario },
            { label: t('common.currency', 'Currency'), value: pRow.currency },
            {
              label: t('finance.columns.horizon', 'Horizon'),
              value: `${pRow.horizonMonths} ${t('finance.units.mo', 'mo')}`,
            }
          );
        }
      } else if (row.kind === 'analysis' || row.kind === 'investment') {
        metaPills.push(
          { label: t('finance.columns.analysisType', 'Type'), value: row.analysisType },
          { label: t('common.currency', 'Currency'), value: row.currency },
          { label: t('finance.columns.periods', 'Periods'), value: String(row.periodCount) }
        );
      } else {
        const vRow = row as FinanceValuationRow;
        metaPills.push(
          { label: t('finance.columns.source', 'Source'), value: vRow.sourceType },
          { label: t('finance.columns.method', 'Method'), value: vRow.method },
          { label: t('common.currency', 'Currency'), value: vRow.currency },
          {
            label: t('finance.columns.horizonYears', 'Horizon'),
            value: `${vRow.horizonYears} ${t('finance.units.yr', 'yr')}`,
          }
        );
      }

      const metaPillsForCard: MetaPill[] = [
        {
          label: getTypeCode(row.kind),
          icon: KIND_ICON_MAP[row.kind],
          className:
            'border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200',
        },
        {
          label: row.status,
          tone: statusChipTone(row.status),
        },
        ...(metaPills.map((mp) => ({
          label: mp.value,
          className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
        })) as MetaPill[]),
      ];

      let detailsText = '';
      if (row.kind === 'statements') {
        const sRow = row as FinanceStatementRow;
        const detail = statementPreviewDetail;
        detailsText = t('finance.preview.statementsDetails', 'Statement pack…', {
          entity: detail?.entityName || sRow.entityName || '—',
          period: detail?.periodLabel || sRow.periodLabel || '—',
          status: detail?.rawStatus || sRow.rawStatus,
          currency: detail?.currency || sRow.currency,
          documents: detail?.sourceStatementCount || sRow.sourceStatementCount || 0,
        });
        if (detail?.mappedLineCount || sRow.mappedLineCount) {
          detailsText += t(
            'finance.preview.statementsMappedLinesSuffix',
            '\nMapped lines: {{mapped}}',
            {
              mapped: detail?.mappedLineCount || sRow.mappedLineCount,
              completeness: sRow.completenessLabel || '—',
            }
          );
        }
      } else if (row.kind === 'models') {
        detailsText = t('finance.preview.modelsDetails', 'Forecast model…', {
          sourceDoc: modelPreviewDetail?.sourceDocumentTitle || row.sourceDocumentTitle || '—',
          window: row.forecastWindowLabel || '3Y',
          variants: row.variantLabel || 'base / optimistic / conservative',
          depth: modelPreviewDetail?.analyticalDepthLabel || row.analyticalDepthLabel || 'L1-L3',
        });
      } else if (row.kind === 'analysis' || row.kind === 'investment') {
        const kindLabel =
          row.kind === 'investment'
            ? t('finance.preview.investmentCaseLabel', 'Investment case')
            : t('finance.preview.financialAnalysisLabel', 'Financial analysis');
        detailsText = t('finance.preview.analysisDetails', '{{kindLabel}}: {{analysisType}}', {
          kindLabel,
          analysisType: row.analysisType,
          currency: row.currency,
          periods: row.periodCount,
        });
      } else if (row.kind === 'prediction') {
        const pRow = row as FinanceModelRow;
        detailsText =
          pRow.predictionType === 'budget'
            ? t('finance.preview.predictionBudgetDetails', 'Budget / Forecast…', {
                start: pRow.periodStart || '—',
                end: pRow.periodEnd || '—',
                currency: pRow.currency,
              })
            : t('finance.preview.predictionModelDetails', 'Forecast / scenario…', {
                scenario: pRow.scenario,
                currency: pRow.currency,
                horizon: pRow.horizonMonths,
              });
      } else if (row.kind === 'valuation') {
        const vRow = row as FinanceValuationRow;
        detailsText = t('finance.preview.valuationDetails', 'Enterprise valuation…', {
          method: vRow.method,
          source: vRow.sourceType,
          currency: row.currency,
          horizon: vRow.horizonYears,
        });
      }

      return (
        <div className="space-y-4">
          <PreviewMetaCard
            pills={metaPillsForCard}
            trailing={
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5">
                <Clock size={14} className="text-slate-600" />
                {formatAge(row.updatedAt, t)}
              </span>
            }
          />

          <PreviewDetailsSection
            text={detailsText}
            customActions={[
              {
                id: 'more',
                label: t('common.more', 'More'),
                icon: MoreVertical,
                onClick: () => handleOpenFull(row),
              },
            ]}
          />

          {row.kind === 'statements' && (
            <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                {t('finance.statements.previewTitle', 'Pack health')}
              </div>
              {statementPreviewDetail ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-c-surface p-2">
                      <div className="text-slate-500 dark:text-slate-400">
                        {t('finance.statements.mappedLines', 'Mapped lines')}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {statementPreviewDetail.mappedLineCount}
                      </div>
                    </div>
                    <div className="rounded-md bg-c-surface p-2">
                      <div className="text-slate-500 dark:text-slate-400">
                        {t('finance.statements.validation', 'Pack status')}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                        {statementPreviewDetail.validationStatus}
                      </div>
                    </div>
                    <div className="rounded-md bg-c-surface p-2">
                      <div className="text-slate-500 dark:text-slate-400">
                        {t('finance.preview.unmapped', 'Unmapped')}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {statementPreviewDetail.unmappedLineCount || 0}
                      </div>
                    </div>
                    <div className="rounded-md bg-c-surface p-2">
                      <div className="text-slate-500 dark:text-slate-400">
                        {t('finance.preview.totalLines', 'Total lines')}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {statementPreviewDetail.totalLineCount || 0}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                      {t('finance.statements.ratios', 'Statements')}
                    </div>
                    {(statementPreviewDetail.childStatements || []).map((statement) => (
                      <div key={statement.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          {statement.statementType}
                        </span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          {statement.readinessStatus || 'pending'} / {statement.mappedLineCount}
                        </span>
                      </div>
                    ))}
                    {Array.isArray(statementPreviewDetail.missingStatementTypes) &&
                      statementPreviewDetail.missingStatementTypes.length > 0 && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          {t('finance.preview.missingPrefix', 'Missing:')}{' '}
                          {statementPreviewDetail.missingStatementTypes.join(', ')}
                        </div>
                      )}
                    {Array.isArray(statementPreviewDetail.packValidations) &&
                      statementPreviewDetail.packValidations.length > 0 && (
                        <PackValidationsSection
                          validations={statementPreviewDetail.packValidations}
                        />
                      )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('finance.preview.loadingPackPreview', 'Loading pack preview…')}
                </div>
              )}
            </div>
          )}

          {row.kind === 'models' &&
            (modelPreviewDetail ? (
              <ModelStatementPreview detail={modelPreviewDetail} />
            ) : (
              <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 text-xs text-slate-500 dark:text-slate-400">
                {t('finance.preview.loadingForecastLayout', 'Loading forecast statement layout…')}
              </div>
            ))}

          {/* Prediction: validation summary */}
          {row.kind === 'prediction' &&
            (row as FinanceModelRow).predictionType === 'model' &&
            predictionValidations && (
              <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {t('finance.prediction.validations', 'Validations')}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓ {predictionValidations.pass} {t('finance.prediction.pass', 'pass')}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400">
                    ⚠ {predictionValidations.warning} {t('finance.prediction.warn', 'warn')}
                  </span>
                  <span className="text-danger-600 dark:text-danger-400">
                    ✗ {predictionValidations.fail} {t('finance.prediction.fail', 'fail')}
                  </span>
                </div>
              </div>
            )}

          {/* Prediction: budget scenario cards */}
          {row.kind === 'prediction' &&
            (row as FinanceModelRow).predictionType === 'budget' &&
            budgetPreviewScenarios &&
            budgetPreviewScenarios.length > 0 && (
              <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {t('finance.prediction.scenarios', 'Scenarios')}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {budgetPreviewScenarios.map((sc) => {
                    const colorMap: Record<string, string> = {
                      base: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10',
                      optimistic: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10',
                      conservative: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10',
                    };
                    return (
                      <div
                        key={sc.scenarioType}
                        className={`border-l-2 rounded-r-md p-2 ${colorMap[sc.scenarioType] || 'border-l-slate-400 bg-slate-50/50 dark:bg-slate-900/10'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 capitalize">
                            {sc.name || sc.scenarioType}
                          </span>
                          {sc.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              {t('finance.preview.scenarioActive', 'active')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Analysis: ratio summary */}
          {(row.kind === 'analysis' || row.kind === 'investment') &&
            analysisPreviewRatios &&
            analysisPreviewRatios.length > 0 &&
            (() => {
              const categoryLabels: Record<string, { label: string; color: string }> = {
                liquidity: {
                  label: t('finance.preview.ratioCategories.liquidity', 'Liquidity'),
                  color: 'text-blue-600 dark:text-blue-400',
                },
                profitability: {
                  label: t('finance.preview.ratioCategories.profitability', 'Profitability'),
                  color: 'text-emerald-600 dark:text-emerald-400',
                },
                leverage: {
                  label: t('finance.preview.ratioCategories.leverage', 'Leverage'),
                  color: 'text-amber-600 dark:text-amber-400',
                },
                efficiency: {
                  label: t('finance.preview.ratioCategories.efficiency', 'Efficiency'),
                  color: 'text-violet-600 dark:text-violet-400',
                },
                investment: {
                  label: t('finance.preview.ratioCategories.investment', 'Investment'),
                  color: 'text-fuchsia-600 dark:text-fuchsia-400',
                },
                growth: {
                  label: t('finance.preview.ratioCategories.growth', 'Growth'),
                  color: 'text-blue-600 dark:text-blue-400',
                },
              };
              const grouped: Record<string, typeof analysisPreviewRatios> = {};
              for (const r of analysisPreviewRatios) {
                if (!grouped[r.category]) grouped[r.category] = [];
                grouped[r.category]!.push(r);
              }
              return (
                <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                    {t('finance.analysis.ratioSummary', 'Financial Ratios')}
                  </div>
                  {Object.entries(grouped).map(([cat, items]) => {
                    const meta = categoryLabels[cat] || {
                      label: cat,
                      color: 'text-slate-600',
                    };
                    const topRatio = items?.find((r) => r.value != null);
                    return (
                      <div key={cat} className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                        <span className="text-slate-600 dark:text-slate-300 font-mono">
                          {topRatio
                            ? `${topRatio.ratio_name}: ${topRatio.value?.toFixed(2)}`
                            : `${items?.length || 0} ${t('finance.preview.ratioCountSuffix', 'ratios')}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

          {/* Valuation: DCF results + sensitivity + advisory */}
          {row.kind === 'valuation' && (
            <>
              <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {t('finance.valuation.dcfResults', 'DCF Results')}
                </div>
                {valuationPreviewResults ? (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: 'EV',
                        value: valuationPreviewResults.enterpriseValue,
                        color: 'text-amber-600 dark:text-amber-400',
                      },
                      {
                        label: 'Equity',
                        value: valuationPreviewResults.equityValue,
                        color: 'text-emerald-600 dark:text-emerald-400',
                      },
                      {
                        label: 'EV/EBITDA',
                        value: valuationPreviewResults.evEbitda,
                        color: 'text-blue-600 dark:text-blue-400',
                      },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <div className={`text-[10px] font-medium ${item.color}`}>{item.label}</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.value != null
                            ? item.label === 'EV/EBITDA'
                              ? `${item.value.toFixed(1)}x`
                              : `${valuationPreviewResults.currency || ''} ${(item.value / 1_000_000).toFixed(1)}M`.trim()
                            : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t('finance.preview.notComputedDcf', 'Not computed yet — click "Compute DCF"')}
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      (row as FinanceValuationRow).sourceType === 'financial_model'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : (row as FinanceValuationRow).sourceType === 'budget'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
                    }`}
                  >
                    {(row as FinanceValuationRow).sourceType === 'financial_model'
                      ? 'Model'
                      : (row as FinanceValuationRow).sourceType === 'budget'
                        ? t('finance.prediction.budget', 'Budget')
                        : t('finance.preview.sourceTypeManual', 'Manual')}
                  </span>
                </div>
              </div>

              {/* Sensitivity heatmap */}
              {valuationPreviewDetail?.sensitivity &&
                (() => {
                  const sens = valuationPreviewDetail.sensitivity;
                  const normalized = normalizeSensitivityGrid(sens);
                  if (!normalized) return null;
                  const { columnHeaders, rowHeaders, values: matrix } = normalized;
                  const finiteValues = matrix
                    .flat()
                    .filter((value): value is number => value != null);
                  const maxVal = Math.max(...finiteValues);
                  const minVal = Math.min(...finiteValues);
                  return (
                    <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                        {t('finance.valuation.sensitivity', 'Sensitivity Analysis')}
                      </div>
                      {/* §27-exempt: financial-calculation — WACC/g sensitivity heatmap (pivot cross-tab, cell values computed from DCF formula) */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr>
                              <th className="text-left text-slate-500 py-0.5 pr-1">WACC \ g</th>
                              {(matrix[0] || []).map((_: any, ci: number) => (
                                <th key={ci} className="text-center text-slate-500 py-0.5 px-1">
                                  {columnHeaders[ci] ?? `${ci + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {matrix.map((matRow, ri: number) => (
                              <tr key={ri}>
                                <td className="text-slate-500 py-0.5 pr-1 font-medium">
                                  {rowHeaders[ri] ?? `${ri + 1}`}
                                </td>
                                {matRow.map((val, ci: number) => {
                                  if (val == null) {
                                    return (
                                      <td
                                        key={ci}
                                        className="text-center py-0.5 px-1 text-slate-400"
                                      >
                                        —
                                      </td>
                                    );
                                  }
                                  const norm =
                                    maxVal === minVal ? 0.5 : (val - minVal) / (maxVal - minVal);
                                  const bg =
                                    norm > 0.66
                                      ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                      : norm > 0.33
                                        ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                        : 'bg-danger-100 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300';
                                  return (
                                    <td
                                      key={ci}
                                      className={`text-center py-0.5 px-1 rounded ${bg} font-mono`}
                                    >
                                      {(
                                        (val * (valuationPreviewDetail.displayMultiplier || 1)) /
                                        1_000_000
                                      ).toFixed(1)}
                                      M
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

              {/* Advisory summary */}
              {valuationPreviewDetail?.advisory &&
                (() => {
                  const recs = Array.isArray(valuationPreviewDetail.advisory?.recommendations)
                    ? valuationPreviewDetail.advisory.recommendations
                    : Array.isArray(valuationPreviewDetail.advisory)
                      ? valuationPreviewDetail.advisory
                      : [];
                  if (recs.length === 0) return null;
                  const topTwo = recs.slice(0, 2);
                  return (
                    <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                          {t('finance.valuation.advisory', 'Advisory')}
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {recs.length}
                          </span>
                        </div>
                        <button
                          className="text-[10px] text-c-info hover:underline"
                          onClick={() => handleOpenFull(row)}
                        >
                          {t('finance.preview.viewAll', 'View all')}
                        </button>
                      </div>
                      {topTwo.map((rec: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span
                            className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              rec.priority === 'high'
                                ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                                : rec.priority === 'medium'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {(rec.priority || 'low').toUpperCase()}
                          </span>
                          <span className="text-slate-700 dark:text-slate-200 line-clamp-1">
                            {rec.title || rec.description || rec.text || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              {/* Negotiation pack badge */}
              {valuationPreviewDetail?.negotiationPack && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-700/30">
                    ✓ {t('finance.preview.negotiationPackReady', 'Negotiation Pack ready')}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      );
    },
    [
      t,
      numberLocale,
      statementPreviewDetail,
      statementPreviewRatios,
      modelPreviewDetail,
      predictionValidations,
      analysisPreviewRatios,
      budgetPreviewScenarios,
      valuationPreviewResults,
      valuationPreviewDetail,
      handleOpenFull,
    ]
  );

  const renderPreviewFooter = useCallback(
    (row: FinanceRow) => {
      const aiHints: string[] = (() => {
        switch (row.kind) {
          case 'statements':
            return [
              t('finance.preview.aiHints.reviewMapping', 'Review mapping'),
              t('finance.preview.aiHints.createModel', 'Create model'),
              t('finance.preview.aiHints.comparePeriods', 'Compare periods'),
            ];
          case 'models':
            return [
              t('finance.preview.aiHints.checkConsistency', 'Check consistency'),
              t('finance.preview.aiHints.suggestScenario', 'Suggest scenario'),
              t('finance.preview.aiHints.compareBaseline', 'Compare to baseline'),
            ];
          case 'analysis':
            return [
              t('finance.preview.aiHints.summarizeResults', 'Summarize results'),
              t('finance.preview.aiHints.findAnomalies', 'Find anomalies'),
              t('finance.preview.aiHints.suggestActions', 'Suggest actions'),
            ];
          case 'investment':
            return [
              t('finance.preview.aiHints.evaluateNpvIrr', 'Evaluate NPV and IRR'),
              t('finance.preview.aiHints.checkPayback', 'Check payback'),
              t('finance.preview.aiHints.goNoGoRecommendation', 'Go/no-go recommendation'),
            ];
          case 'prediction':
            return [
              t('finance.preview.aiHints.evaluateAssumptions', 'Evaluate assumptions'),
              t('finance.preview.aiHints.sensitivityAnalysis', 'Sensitivity analysis'),
              t('finance.preview.aiHints.compareScenarios', 'Compare scenarios'),
            ];
          case 'valuation':
            return [
              t('finance.preview.aiHints.verifyWacc', 'Verify WACC'),
              t('finance.preview.aiHints.compareMarket', 'Compare to market'),
              t('finance.preview.aiHints.howToImprove', 'How to improve?'),
            ];
        }
      })();

      const relationItems: RelationItem[] = [];

      const actionButtons: ActionRow['buttons'] = [];

      if (row.kind === 'statements') {
        const statementRow = row as FinanceStatementRow;
        relationItems.push(
          {
            label: `${t('finance.preview.relationsSources', 'Sources')}: ${
              statementPreviewDetail?.sourceFileName || statementRow.sourceFileName || '—'
            }`,
          },
          {
            label: `${t('finance.preview.relationsModelReadiness', 'Model readiness')}: ${
              statementRow.isWorkable
                ? t('finance.preview.readyForSeeding', 'Ready for seeding')
                : String(statementRow.readinessStatus || '').toLowerCase() === 'rejected'
                  ? t('finance.preview.rejectedImport', 'Rejected import')
                  : 'Recovery queue'
            }`,
          }
        );
        actionButtons.push(
          {
            label: t('finance.actions.createModelFromStatement', 'Utwórz model'),
            onClick: () => handleCreateModelFromStatement(statementRow),
            colorScheme: 'primary',
            disabled: !statementRow.isWorkable,
          },
          {
            label: t('finance.actions.createAnalysis', 'Utwórz analizę'),
            onClick: () => handleCreateAnalysisFromStatements(statementRow),
            colorScheme: 'emerald',
            disabled: !statementRow.isWorkable,
          }
        );
        if (!statementRow.isWorkable) {
          actionButtons.push({
            label: t('finance.actions.openRecoveryQueue', 'Otwórz recovery queue'),
            onClick: () => handleOpenFull(statementRow),
            colorScheme: 'neutral',
          });
        }
      }

      if (row.kind === 'models' && row.status !== 'APPROVED') {
        actionButtons.push({
          label: t('finance.actions.approve', 'Zatwierdź'),
          onClick: async () => {
            try {
              await approveCanonicalModel(row.id);
              await loadModels();
              toast.success(t('finance.toast.modelApproved', 'Model zatwierdzony'));
            } catch (e: any) {
              toast.error(
                e?.response?.data?.error ||
                  t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
              );
            }
          },
          colorScheme: 'emerald',
        });
      }

      if (row.kind === 'analysis' || row.kind === 'investment') {
        actionButtons.push({
          label: t('finance.actions.reanalyze', 'Przelicz ponownie'),
          onClick: async () => {
            try {
              await runCanonicalFinancialAnalysis(row.id);
              await loadAnalyses();
              await loadAnalysisPreviewRatios(row.id);
              toast.success(t('finance.toast.reanalyzed', 'Analiza przeliczona'));
            } catch (e: any) {
              toast.error(
                e?.response?.data?.error ||
                  t('finance.toast.reanalyzeFailed', 'Nie udało się przeliczyć')
              );
            }
          },
          colorScheme: 'primary',
        });
        actionButtons.push({
          label: t('finance.actions.createValuation', 'Utwórz wycenę'),
          onClick: () =>
            window.location.assign(
              `/economics?tab=valuation&createFrom=financial_analysis&sourceId=${row.id}`
            ),
          colorScheme: 'neutral',
        });
        if (row.status !== 'APPROVED') {
          actionButtons.push({
            label: t('finance.actions.approve', 'Zatwierdź'),
            onClick: async () => {
              try {
                await approveCanonicalFinancialAnalysis(row.id);
                await loadAnalyses();
                toast.success(t('finance.toast.analysisApproved', 'Analiza zatwierdzona'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                );
              }
            },
            colorScheme: 'emerald',
          });
        }
      }

      if (row.kind === 'prediction') {
        const pRow = row as FinanceModelRow;
        if (pRow.predictionType === 'budget') {
          const rawId = getBudgetRawId(row.id);
          actionButtons.push({
            label: t('finance.actions.generateProjections', 'Generuj prognozy'),
            onClick: async () => {
              try {
                const detail = await Api.get(`/api/economics/budgets/${rawId}`);
                const scens = (detail as any)?.scenarios || [];
                for (const sc of scens)
                  await Api.post(`/api/economics/budgets/${rawId}/scenarios/${sc.id}/project`, {});
                await loadBudgetPreviewScenarios(rawId);
                toast.success(t('finance.toast.projected', 'Prognozy wygenerowane'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.projectionFailed', 'Nie udało się wygenerować')
                );
              }
            },
            colorScheme: 'primary',
          });
          if (pRow.status !== 'APPROVED') {
            actionButtons.push({
              label: t('finance.actions.approve', 'Zatwierdź'),
              onClick: async () => {
                try {
                  await Api.post(`/api/economics/budgets/${rawId}/approve`, {});
                  await loadBudgets();
                  toast.success(t('finance.toast.budgetApproved', 'Budżet zatwierdzony'));
                } catch (e: any) {
                  toast.error(
                    e?.response?.data?.error ||
                      t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                  );
                }
              },
              colorScheme: 'emerald',
            });
          }
        } else {
          actionButtons.push({
            label: t('finance.actions.compute', 'Przelicz'),
            onClick: async () => {
              try {
                await computeModelWithFallback(row.id);
                await loadPredictionPreview(row.id);
                toast.success(t('finance.toast.computed', 'Prognoza przeliczona'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.computeFailed', 'Nie udało się przeliczyć')
                );
              }
            },
            colorScheme: 'primary',
          });
        }
      }

      if (row.kind === 'valuation') {
        actionButtons.push({
          label: t('finance.actions.computeDcf', 'Oblicz DCF'),
          onClick: async () => {
            try {
              await Api.post(`/api/economics/valuations/${row.id}/compute`, {});
              await loadValuations();
              await loadValuationPreviewResults(row.id);
              toast.success(t('finance.toast.valuationComputed', 'Wycena obliczona'));
            } catch (e: any) {
              toast.error(
                e?.response?.data?.error ||
                  t('finance.toast.computeDcfFailed', 'Nie udało się obliczyć DCF')
              );
            }
          },
          colorScheme: 'primary',
        });
        if (row.status !== 'APPROVED') {
          actionButtons.push({
            label: t('finance.actions.approve', 'Zatwierdź'),
            onClick: async () => {
              try {
                await approveCanonicalValuation(row.id);
                await loadValuations();
                toast.success(t('finance.toast.valuationApproved', 'Wycena zatwierdzona'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                );
              }
            },
            colorScheme: 'emerald',
          });
        }
        actionButtons.push({
          label: t('finance.actions.exportPptx', 'Eksportuj PPTX'),
          onClick: async () => {
            try {
              const result = await Api.post(`/api/economics/valuations/${row.id}/export/pptx`, {
                language: i18n.language?.startsWith('pl') ? 'pl' : 'en',
                theme: 'corporate',
                confidentiality: 'confidential',
              });
              toast.success(t('finance.toast.pptxExported', 'PPTX wygenerowany'));
              const downloadUrl = (result as any)?.downloadUrl;
              if (downloadUrl) window.open(downloadUrl, '_blank');
            } catch (e: any) {
              toast.error(
                e?.response?.data?.error ||
                  t('finance.toast.exportFailed', 'Nie udało się wyeksportować')
              );
            }
          },
          colorScheme: 'neutral',
        });
      }

      // NOTE (TYPE 11 fix, 2026-07-26): this footer used to push its own bespoke
      // "Eksportuj" and "Otwórz" buttons here — both were duplicates of actions
      // already surfaced canonically via getRowActions()/financePreviewActions
      // (FinanceHub.tsx): "Otwórz" duplicated the header onOpenFull (and even
      // collided with it on the "O" keyboard shortcut), and "Eksportuj" called the
      // exact same handleExport as the canonical export action. Both bespoke
      // buttons were removed; the header "Otwórz" and the canonical Export action
      // in the action bar (from getRowActions) remain as the single source of each.

      return (
        <div className="space-y-0">
          <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
            <PreviewAIHintStrip
              hints={aiHints}
              onRunHint={(hint) =>
                window.location.assign(`/chat?context=finance&prompt=${encodeURIComponent(hint)}`)
              }
            />
          </div>
          <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />
          <PreviewRelations
            items={relationItems}
            emptyLabel={t('common.noRelations', 'No relations')}
          />
          {versionSnapshots && versionSnapshots.length > 0 && (
            <>
              <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />
              <FinanceVersionTimeline snapshots={versionSnapshots} />
            </>
          )}
          <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />
          <PreviewActionBar rows={[{ buttons: actionButtons }]} />
        </div>
      );
    },
    [
      t,
      i18n,
      statementPreviewDetail,
      handleOpenFull,
      handleCreateModelFromStatement,
      handleCreateAnalysisFromStatements,
      loadStatements,
      loadModels,
      loadPredictionPreview,
      loadAnalyses,
      loadAnalysisPreviewRatios,
      loadBudgetPreviewScenarios,
      loadBudgets,
      getBudgetRawId,
      loadValuations,
      loadValuationPreviewResults,
      versionSnapshots,
    ]
  );

  return { renderPreviewBody, renderPreviewFooter };
}
