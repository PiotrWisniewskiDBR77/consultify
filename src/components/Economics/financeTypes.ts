import { BarChart3, Calculator, FileText, Target, TrendingUp } from 'lucide-react';
import React from 'react';

import { type PreviewableItem } from '../shared/TableWithPreviewLayout';

export type FinanceStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';
export type FinanceKind =
  | 'statements'
  | 'models'
  | 'analysis'
  | 'investment'
  | 'prediction'
  | 'valuation';
export type PredictionType = 'model' | 'budget';

export type FinanceRowBase = PreviewableItem & {
  kind: FinanceKind;
  status: FinanceStatus;
  updatedAt: string;
  canonicalArtifactId?: string;
  canonicalBusinessVersionId?: string;
  canonicalArtifactType?:
    | 'STATEMENT_PACK'
    | 'HISTORICAL_ANALYSIS'
    | 'BASELINE_MODEL'
    | 'PREDICTION_SCENARIO'
    | 'VALUATION_CASE';
  canonicalFreshness?: string;
  canonicalVersion?: number;
};

export type FinanceModelRow = FinanceRowBase & {
  kind: 'models' | 'prediction';
  predictionType: PredictionType;
  scenario: string;
  currency: string;
  horizonMonths: number;
  startDate: string;
  periodStart?: string;
  periodEnd?: string;
  granularity?: string;
  /** Required by the governed budget commands; present for budget prediction rows. */
  version?: number;
  sourceStatementId?: string;
  sourceStatementPackId?: string;
  seedSourceType?: string;
  sourceDocumentTitle?: string;
  forecastWindowLabel?: string;
  variantLabel?: string;
  analyticalDepthLabel?: string;
};

export type FinanceModelForecastLine = {
  lineCode: string;
  lineName: string;
  level: number;
  isSubtotal?: boolean;
  isTotal?: boolean;
  values: Record<string, number>;
};

export type FinanceModelPreviewDetail = {
  sourceDocumentTitle: string;
  sourcePeriodLabel: string;
  currency: string;
  forecastYears: string[];
  selectedScenario: string;
  variants: Array<'base' | 'optimistic' | 'conservative'>;
  analyticalDepthLabel: string;
  sourceStatementCount: number;
  scenarioTables: Record<
    'base' | 'optimistic' | 'conservative',
    Record<'P&L' | 'BS' | 'CF', FinanceModelForecastLine[]>
  >;
};

export type FinanceAnalysisRow = FinanceRowBase & {
  kind: 'analysis' | 'investment';
  analysisType: string;
  currency: string;
  periodCount: number;
  sourceStatementIds?: string[];
  sourceStatementPackId?: string;
};

export type FinanceValuationRow = FinanceRowBase & {
  kind: 'valuation';
  sourceType: string;
  method: string;
  currency: string;
  horizonYears: number;
};

export type FinanceStatementPackChild = {
  id: string;
  statementType: string;
  rawStatus: string;
  readinessStatus?: string;
  readinessScore?: number;
  validationStatus?: string;
  mappedLineCount: number;
  totalLineCount: number;
  unmappedLineCount: number;
  sourceFileName?: string;
  updatedAt?: string;
  valuesVersion?: number;
  validationFailCount?: number;
  validationWarningCount?: number;
};

export type FinanceStatementValidation = {
  validationScope: 'statement' | 'pack';
  checkCode: string;
  checkName: string;
  severity: 'info' | 'warning' | 'error';
  status: 'pass' | 'warning' | 'fail';
  expectedValue?: number | null;
  actualValue?: number | null;
  difference?: number | null;
  tolerance?: number | null;
  message?: string | null;
  detailsJson?: string | null;
  computedAt?: string;
};

export type FinanceStatementExplainEvidence = {
  evidenceType: 'direct' | 'aggregated' | 'split' | 'derived' | 'manual_note';
  weight: number;
  contributionValue?: number | null;
  explanation?: string | null;
  source?: {
    candidateRowId?: string | null;
    rowLabel?: string | null;
    sourceRow?: number | null;
    sourcePage?: number | null;
    rawValue?: string | null;
  } | null;
};

export type FinanceStatementExplain = {
  valueId: string;
  originalLabel: string;
  mappedTo?: string | null;
  lineCode?: string | null;
  value: number;
  mappingStatus: string;
  valueOrigin: string;
  mappingConfidence: number;
  evidenceJson?: Record<string, unknown> | null;
  evidences: FinanceStatementExplainEvidence[];
  selectedMappingCandidate?: {
    id: string;
    score: number;
    reason?: string | null;
  } | null;
};

export type FinanceStatementTableRow = {
  id: string;
  canonicalLineId?: string | null;
  lineCode?: string | null;
  lineName?: string | null;
  lineNameEn?: string | null;
  lineNamePl?: string | null;
  parentCanonicalLineId?: string | null;
  originalLabel: string;
  value: number;
  confidence?: number;
  sourcePage?: number | null;
  sourceRow?: number | null;
  mappingStatus?: string;
  valueOrigin?: string;
  mappingConfidence?: number;
  isNonFinancial?: boolean;
  classificationReason?: string | null;
  aggregationLevel?: number | null;
  requiredLevel?: string | null;
  signConvention?: string | null;
  isTotal?: boolean;
  isSubtotal?: boolean;
  isComputed?: boolean;
  deaggregationReady?: boolean;
  evidenceJson?: Record<string, unknown> | null;
  sourceCandidateRowId?: string | null;
  selectedMappingCandidateId?: string | null;
  valuePeriodLabel?: string | null;
  valuePeriodIndex?: number | null;
  periodValues?: Array<{
    id: string;
    periodLabel?: string | null;
    periodIndex?: number | null;
    value: number;
  }>;
  explain?: FinanceStatementExplain | null;
};

export type FinanceStatementDetailV1 = {
  id: string;
  statementType: string;
  sourceFileName?: string;
  readinessStatus?: string;
  readinessScore?: number;
  readinessSummary?: string;
  validationStatus?: string;
  valuesVersion?: number;
  latestVersionNo?: number;
  mappedLineCount: number;
  totalLineCount: number;
  unmappedLineCount: number;
  values: FinanceStatementTableRow[];
  validationLedger: FinanceStatementValidation[];
};

export type FinanceStatementRow = FinanceRowBase & {
  kind: 'statements';
  statementType: string;
  statementPackId?: string;
  version?: number;
  entityName?: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  currency: string;
  scaling: string;
  sourceFileName: string;
  validationStatus: string;
  mappedLineCount: number;
  totalLineCount: number;
  unmappedLineCount: number;
  sourceStatementCount?: number;
  statementIds?: string[];
  missingStatementTypes?: string[];
  completenessLabel?: string;
  childStatements?: FinanceStatementPackChild[];
  nonFinancialLineCount?: number;
  overallConfidence: number;
  rawStatus: string;
  readinessStatus?: string;
  readinessScore?: number;
  readinessSummary?: string;
  readinessReasonCodes?: string[];
  documentClass?: string;
  extractionStrategy?: string;
  templateFamily?: string | null;
  valuesVersion?: number;
  isWorkable: boolean;
};

export type FinanceRow =
  | FinanceStatementRow
  | FinanceModelRow
  | FinanceAnalysisRow
  | FinanceValuationRow;

export const KIND_LABELS: Record<FinanceKind, { code: string; en: string; pl: string }> = {
  statements: { code: 'STM', en: 'Statement', pl: 'Sprawozdanie' },
  models: { code: 'MDL', en: 'Model', pl: 'Model' },
  analysis: { code: 'ANL', en: 'Analysis', pl: 'Analiza' },
  investment: { code: 'INV', en: 'Investment', pl: 'Inwestycja' },
  prediction: { code: 'PRD', en: 'Scenario', pl: 'Scenariusz' },
  valuation: { code: 'VAL', en: 'Valuation', pl: 'Wycena' },
};

export const KIND_ICONS: Record<FinanceKind, React.ReactNode> = {
  statements: React.createElement(FileText, {
    size: 14,
    className: 'text-blue-500 dark:text-blue-400',
  }),
  models: React.createElement(Calculator, {
    size: 14,
    className: 'text-blue-500 dark:text-blue-400',
  }),
  analysis: React.createElement(BarChart3, {
    size: 14,
    className: 'text-emerald-500 dark:text-emerald-400',
  }),
  investment: React.createElement(Target, {
    size: 14,
    className: 'text-fuchsia-500 dark:text-fuchsia-400',
  }),
  prediction: React.createElement(TrendingUp, {
    size: 14,
    className: 'text-violet-500 dark:text-violet-400',
  }),
  valuation: React.createElement(Target, {
    size: 14,
    className: 'text-amber-500 dark:text-amber-400',
  }),
};

export const KIND_ACCENT: Record<FinanceKind, string> = {
  statements: 'border-l-blue-500 dark:border-l-blue-400',
  models: 'border-l-blue-500 dark:border-l-blue-400',
  analysis: 'border-l-emerald-500 dark:border-l-emerald-400',
  investment: 'border-l-fuchsia-500 dark:border-l-fuchsia-400',
  prediction: 'border-l-violet-500 dark:border-l-violet-400',
  valuation: 'border-l-amber-500 dark:border-l-amber-400',
};

export const CANVAS_PADDING = 'pl-4 pr-1.5 pt-3 pb-4';

export function normalizeModelStatus(raw: unknown): FinanceStatus {
  const s = String(raw || '').toLowerCase();
  if (s === 'approved') return 'APPROVED';
  if (s === 'review') return 'REVIEW';
  return 'DRAFT';
}

export function normalizeStatus(raw: unknown): FinanceStatus {
  const s = String(raw || '').toUpperCase();
  if (s === 'APPROVED') return 'APPROVED';
  if (s === 'REVIEW') return 'REVIEW';
  return 'DRAFT';
}

export function statusToItemStatus(s: FinanceStatus): 'APPROVED' | 'REVIEW' | 'DRAFT' {
  return s;
}

export function statusToProgress(s: FinanceStatus): number {
  if (s === 'APPROVED') return 100;
  if (s === 'REVIEW') return 50;
  return 10;
}

export function getTypeCode(kind: FinanceKind): string {
  return KIND_LABELS[kind].code;
}

export function formatAge(
  dateStr: string,
  t: (key: string, defaultValue: string, options?: Record<string, unknown>) => string
): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (hours < 1) return t('finance.preview.ageJustNow', 'Just now');
  if (hours < 24) return t('finance.preview.ageHours', '{{hours}}h ago', { hours });
  if (days < 7) return t('finance.preview.ageDays', '{{days}}d ago', { days });
  return d.toLocaleDateString();
}

export function isWorkableStatement(
  readinessStatus: unknown,
  rawStatus: unknown,
  validationStatus: unknown,
  mappedLineCount: unknown,
  unmappedLineCount: unknown
): boolean {
  const normalizedReadiness = String(readinessStatus || '')
    .trim()
    .toLowerCase();
  const normalizedRawStatus = String(rawStatus || '')
    .trim()
    .toLowerCase();
  const normalizedValidation = String(validationStatus || '')
    .trim()
    .toLowerCase();
  const mapped = Number(mappedLineCount || 0);
  const unmapped = Number(unmappedLineCount || 0);

  if (normalizedReadiness === 'ready') return true;
  return (
    ['mapped', 'confirmed'].includes(normalizedRawStatus) &&
    ['pass', 'warnings'].includes(normalizedValidation) &&
    mapped > 0 &&
    unmapped === 0
  );
}

export function isRecognizedStatement(
  readinessStatus: unknown,
  rawStatus: unknown,
  statementType: unknown,
  mappedLineCount: unknown,
  totalLineCount: unknown
): boolean {
  const normalizedReadiness = String(readinessStatus || '')
    .trim()
    .toLowerCase();
  const normalizedRawStatus = String(rawStatus || '')
    .trim()
    .toLowerCase();
  const normalizedStatementType = String(statementType || '')
    .trim()
    .toUpperCase();
  const mapped = Number(mappedLineCount || 0);
  const total = Number(totalLineCount || 0);

  return (
    ['ready', 'recoverable', 'rejected'].includes(normalizedReadiness) ||
    (['imported', 'mapped', 'confirmed'].includes(normalizedRawStatus) &&
      ['P&L', 'PL', 'BS', 'BALANCE_SHEET', 'CF', 'CASH_FLOW'].includes(normalizedStatementType) &&
      mapped > 0 &&
      total > 0)
  );
}

export function deriveStatementReadinessStatus(
  readinessStatus: unknown,
  rawStatus: unknown,
  validationStatus: unknown,
  mappedLineCount: unknown,
  unmappedLineCount: unknown,
  totalLineCount: unknown
): 'pending' | 'recoverable' | 'ready' | 'rejected' {
  const normalizedReadiness = String(readinessStatus || '')
    .trim()
    .toLowerCase();
  if (['pending', 'recoverable', 'ready', 'rejected'].includes(normalizedReadiness)) {
    return normalizedReadiness as 'pending' | 'recoverable' | 'ready' | 'rejected';
  }
  if (isWorkableStatement('', rawStatus, validationStatus, mappedLineCount, unmappedLineCount)) {
    return 'ready';
  }
  const total = Number(totalLineCount || 0);
  const mapped = Number(mappedLineCount || 0);
  const normalizedRawStatus = String(rawStatus || '')
    .trim()
    .toLowerCase();
  if (
    total > 0 &&
    mapped > 0 &&
    ['imported', 'mapped', 'confirmed'].includes(normalizedRawStatus)
  ) {
    return 'recoverable';
  }
  if (total > 0 && mapped === 0) return 'rejected';
  return 'pending';
}

export interface PreviewDataState {
  statementPreviewDetail: {
    entityName?: string;
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    currency: string;
    scaling: string;
    sourceFileName: string;
    validationStatus: string;
    rawStatus: string;
    readinessStatus?: string;
    readinessSummary?: string;
    missingStatementTypes?: string[];
    sourceStatementCount?: number;
    childStatements?: FinanceStatementPackChild[];
    packValidations?: FinanceStatementValidation[];
    mappedLineCount: number;
    totalLineCount?: number;
    unmappedLineCount?: number;
    topLineItems: { label: string; code: string; value: number }[];
  } | null;
  statementPreviewRatios: {
    coveragePct: number;
    computed: number;
    total: number;
    topRatios: { code: string; name: string; value: number | null }[];
  } | null;
  modelPreviewDetail: FinanceModelPreviewDetail | null;
  predictionValidations: { total: number; pass: number; fail: number; warning: number } | null;
  analysisPreviewRatios:
    | { category: string; ratio_code: string; ratio_name: string; value: number | null }[]
    | null;
  budgetPreviewScenarios:
    | {
        scenarioType: string;
        name: string;
        isActive: boolean;
        summaryMetrics: Record<string, number>;
      }[]
    | null;
  valuationPreviewResults: {
    enterpriseValue: number | null;
    equityValue: number | null;
    evEbitda: number | null;
    currency: string;
  } | null;
  valuationPreviewDetail: {
    advisory: any;
    negotiationPack: any;
    sensitivity: any;
    displayMultiplier: number;
  } | null;
}
