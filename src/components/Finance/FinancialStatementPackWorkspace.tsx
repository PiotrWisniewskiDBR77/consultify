import { AlertTriangle, BarChart3, Calculator, ChevronDown, ChevronRight, Eye, EyeOff, FileText, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import {
  type FinanceStatementDetailV1,
  type FinanceStatementExplain,
  type FinanceStatementPackChild,
  type FinanceStatementRow,
  type FinanceStatementTableRow,
  type FinanceStatementValidation,
} from '../Economics/financeTypes';
import { CanonicalStatementTable } from './CanonicalStatementTable';
import { FinancialStatementWorkspace } from './FinancialStatementWorkspace';
import { StatementExplainPanel } from './StatementExplainPanel';
import { StatementValidationBadges } from './StatementValidationBadges';

type StatementTabType = 'P&L' | 'BS' | 'CF';

interface PackDetail {
  id: string;
  entity_name?: string;
  period_start?: string;
  period_end?: string;
  period_label?: string;
  currency?: string;
  scaling?: string;
  pack_status?: string;
  pack_readiness_status?: string;
  pack_readiness_score?: number;
  pack_quality_summary?: string;
  missing_statement_types?: string[] | string;
  source_statement_count?: number;
  validations?: Array<Record<string, unknown>>;
  statements?: Array<Record<string, unknown>>;
}

interface Props {
  statementPackId: string;
  onStatementChanged?: () => Promise<void> | void;
  onCreateModelFromPack?: (row: FinanceStatementRow) => void;
  onCreateAnalysisFromPack?: (row: FinanceStatementRow) => void;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      return JSON.parse(value).map((item: unknown) => String(item));
    } catch {
      return [];
    }
  }
  return [];
}

function mapValidation(validation: Record<string, unknown>, scope: 'statement' | 'pack'): FinanceStatementValidation {
  return {
    validationScope: scope,
    checkCode: String(validation.check_code || validation.checkCode || ''),
    checkName: String(validation.check_name || validation.checkName || ''),
    severity: String(validation.severity || 'info') as 'info' | 'warning' | 'error',
    status: String(validation.status || 'pass') as 'pass' | 'warning' | 'fail',
    expectedValue:
      validation.expected_value != null ? Number(validation.expected_value) : validation.expectedValue != null ? Number(validation.expectedValue) : null,
    actualValue:
      validation.actual_value != null ? Number(validation.actual_value) : validation.actualValue != null ? Number(validation.actualValue) : null,
    difference: validation.difference != null ? Number(validation.difference) : null,
    tolerance: validation.tolerance != null ? Number(validation.tolerance) : null,
    message: validation.message ? String(validation.message) : null,
    detailsJson: validation.details_json ? String(validation.details_json) : null,
    computedAt: String(validation.computed_at || validation.computedAt || ''),
  };
}

function mapPackDetailToRow(detail: PackDetail): FinanceStatementRow {
  const childStatements: FinanceStatementPackChild[] = Array.isArray(detail.statements)
    ? detail.statements.map((statement) => ({
        id: String(statement.id || ''),
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
      }))
    : [];

  const readinessStatus = String(detail.pack_readiness_status || 'pending').toLowerCase();
  const missingStatementTypes = parseStringArray(detail.missing_statement_types);
  return {
    id: String(detail.id),
    title: String(detail.period_label || detail.entity_name || detail.id),
    kind: 'statements',
    status: readinessStatus === 'ready' ? 'APPROVED' : readinessStatus === 'recoverable' ? 'REVIEW' : 'DRAFT',
    statementType: 'PACK',
    statementPackId: String(detail.id),
    entityName: String(detail.entity_name || ''),
    periodStart: String(detail.period_start || ''),
    periodEnd: String(detail.period_end || ''),
    periodLabel: String(detail.period_label || ''),
    currency: String(detail.currency || 'PLN'),
    scaling: String(detail.scaling || 'units'),
    sourceFileName: childStatements.map((statement) => statement.sourceFileName).filter(Boolean).join(', '),
    validationStatus: String(detail.pack_status || 'pending'),
    mappedLineCount: childStatements.reduce((sum, statement) => sum + Number(statement.mappedLineCount || 0), 0),
    totalLineCount: childStatements.reduce((sum, statement) => sum + Number(statement.totalLineCount || 0), 0),
    unmappedLineCount: childStatements.reduce((sum, statement) => sum + Number(statement.unmappedLineCount || 0), 0),
    sourceStatementCount: Number(detail.source_statement_count ?? childStatements.length),
    statementIds: childStatements.map((statement) => statement.id),
    missingStatementTypes,
    completenessLabel: ['P&L', 'BS', 'CF']
      .map((type) => (childStatements.some((statement) => statement.statementType === type) ? type : `—${type}`))
      .join(' / '),
    childStatements,
    overallConfidence: 0,
    rawStatus: String(detail.pack_status || 'draft'),
    readinessStatus,
    readinessScore: Number(detail.pack_readiness_score ?? 0),
    readinessSummary: String(detail.pack_quality_summary || ''),
    readinessReasonCodes: [],
    isWorkable: readinessStatus === 'ready',
    updatedAt: new Date().toISOString(),
  };
}

function mapStatementDetail(detail: any): FinanceStatementDetailV1 {
  return {
    id: String(detail.id || ''),
    statementType: String(detail.statement_type || ''),
    sourceFileName: String(detail.source_file_name || ''),
    readinessStatus: String(detail.readinessStatus || detail.readiness_status || 'pending'),
    readinessScore: Number(detail.readinessScore ?? detail.readiness_score ?? 0),
    readinessSummary: String(detail.readinessSummary || detail.readiness_summary || ''),
    validationStatus: String(detail.validation_status || 'pending'),
    valuesVersion: Number(detail.values_version ?? 0),
    latestVersionNo: Number(detail.latestVersionNo ?? detail.latest_version_no ?? 0),
    mappedLineCount: Number(detail.mappedLineCount ?? detail.mapped_line_count ?? 0),
    totalLineCount: Number(detail.totalLineCount ?? detail.total_line_count ?? 0),
    unmappedLineCount: Number(detail.unmappedLineCount ?? detail.unmapped_line_count ?? 0),
    values: Array.isArray(detail.values)
      ? detail.values
          .filter((value: any) => !value.is_non_financial)
          .map((value: any) => {
            const parsedEvidence =
              typeof value.evidence_json === 'string' && value.evidence_json.trim().startsWith('{')
                ? JSON.parse(value.evidence_json)
                : value.evidence_json || null;
            return {
              id: String(value.id),
              canonicalLineId: value.canonical_line_id ? String(value.canonical_line_id) : null,
              lineCode: value.line_code ? String(value.line_code) : null,
              lineName: value.line_name ? String(value.line_name) : null,
              lineNameEn: value.line_name_en ? String(value.line_name_en) : null,
              lineNamePl: value.line_name_pl ? String(value.line_name_pl) : null,
              parentCanonicalLineId: value.parent_line_id ? String(value.parent_line_id) : null,
              originalLabel: String(value.original_label || ''),
              value: Number(value.value || 0),
              confidence: Number(value.confidence ?? 0),
              sourcePage: value.source_page != null ? Number(value.source_page) : null,
              sourceRow: value.source_row != null ? Number(value.source_row) : null,
              mappingStatus: String(value.mapping_status || 'auto'),
              valueOrigin: String(value.value_origin || 'source'),
              mappingConfidence: Number(value.mapping_confidence ?? value.confidence ?? 0),
              isNonFinancial: Boolean(value.is_non_financial),
              classificationReason: value.classification_reason ? String(value.classification_reason) : null,
              aggregationLevel: value.aggregation_level != null ? Number(value.aggregation_level) : null,
              requiredLevel: value.required_level ? String(value.required_level) : null,
              signConvention: value.sign_convention ? String(value.sign_convention) : null,
              isTotal: Boolean(value.is_total),
              isSubtotal: Boolean(value.is_subtotal),
              isComputed: Boolean(value.is_computed),
              deaggregationReady: Boolean(value.deaggregation_ready),
              evidenceJson: parsedEvidence,
              sourceCandidateRowId: value.source_candidate_row_id ? String(value.source_candidate_row_id) : null,
              selectedMappingCandidateId: value.selected_mapping_candidate_id ? String(value.selected_mapping_candidate_id) : null,
              valuePeriodLabel: parsedEvidence?.periodLabel ? String(parsedEvidence.periodLabel) : null,
              valuePeriodIndex: Number(parsedEvidence?.periodIndex ?? 0),
            };
          })
      : [],
    validationLedger: Array.isArray(detail.validationLedger)
      ? detail.validationLedger.map((validation: any) => mapValidation(validation, 'statement'))
      : [],
  };
}

function ReadinessRing({ score, size = 36 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100);
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    pct >= 80 ? 'stroke-emerald-500' : pct >= 50 ? 'stroke-amber-500' : 'stroke-rose-500';
  const textColor =
    pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={3}
          className="stroke-slate-200/60 dark:stroke-white/[0.08]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${color} transition-all duration-700 ease-out`}
        />
      </svg>
      <span className={`absolute text-[9px] font-bold tabular-nums ${textColor}`}>{pct}</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 flex-[2] animate-pulse rounded bg-slate-200/60 dark:bg-white/[0.06]" />
          <div className="h-4 flex-1 animate-pulse rounded bg-slate-200/60 dark:bg-white/[0.06]" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-200/60 dark:bg-white/[0.06]" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-200/60 dark:bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

export const FinancialStatementPackWorkspace: React.FC<Props> = ({
  statementPackId,
  onStatementChanged,
  onCreateModelFromPack,
  onCreateAnalysisFromPack,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [detail, setDetail] = useState<PackDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatementTabType>('P&L');
  const [statementDetail, setStatementDetail] = useState<FinanceStatementDetailV1 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
  const [selectedExplain, setSelectedExplain] = useState<FinanceStatementExplain | null>(null);
  const [showAdvancedDetail, setShowAdvancedDetail] = useState(false);
  const [aggregationLevel, setAggregationLevel] = useState<1 | 2 | 3>(2);
  const [analyticsRows, setAnalyticsRows] = useState<FinanceStatementTableRow[]>([]);
  const [analyticsPeriods, setAnalyticsPeriods] = useState<Array<{ label: string; index: number }>>([]);
  const [showValidations, setShowValidations] = useState(false);
  const statementRequestSeq = useRef(0);
  const explainRequestSeq = useRef(0);

  const loadPack = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.get(`/api/finance-statements/packs/${statementPackId}`);
      setDetail((data as PackDetail) || null);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [statementPackId]);

  useEffect(() => {
    void loadPack();
  }, [loadPack]);

  const packRow = useMemo(() => (detail ? mapPackDetailToRow(detail) : null), [detail]);
  const packValidations = useMemo(
    () =>
      Array.isArray(detail?.validations)
        ? detail!.validations!.map((validation) => mapValidation(validation, 'pack'))
        : [],
    [detail]
  );
  const childStatements = packRow?.childStatements || [];
  const missingStatementTypes = packRow?.missingStatementTypes || [];
  const statementsByType = useMemo(() => {
    const next = new Map<StatementTabType, FinanceStatementPackChild>();
    for (const statement of childStatements) {
      const type = String(statement.statementType || '') as StatementTabType;
      if ((type === 'P&L' || type === 'BS' || type === 'CF') && !next.has(type)) next.set(type, statement);
    }
    return next;
  }, [childStatements]);
  const selectedStatement = statementsByType.get(activeTab) || null;

  useEffect(() => {
    if (!selectedStatement && childStatements.length > 0) {
      setActiveTab((childStatements[0]?.statementType as StatementTabType) || 'P&L');
    }
  }, [childStatements, selectedStatement]);

  const loadStatement = useCallback(async (statementId: string) => {
    const requestSeq = ++statementRequestSeq.current;
    setDetailLoading(true);
    setError(null);
    setStatementDetail(null);
    try {
      const response = await Api.get(`/api/finance-statements/${statementId}`);
      if (requestSeq !== statementRequestSeq.current) return;
      const mapped = mapStatementDetail(response);
      setStatementDetail(mapped);
    } catch (e: any) {
      if (requestSeq !== statementRequestSeq.current) return;
      setStatementDetail(null);
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      if (requestSeq === statementRequestSeq.current) {
        setDetailLoading(false);
      }
    }
  }, []);

  const loadAnalytics = useCallback(async (statementId: string, level: 1 | 2 | 3) => {
    const requestSeq = ++explainRequestSeq.current;
    setDetailLoading(true);
    try {
      const response = (await Api.get(
        `/api/finance-statements/${statementId}/analytics?level=${level}`
      )) as {
        periods?: Array<{ label: string; index: number }>;
        rows?: Array<any>;
      };
      if (requestSeq !== explainRequestSeq.current) return;
      const nextRows = Array.isArray(response?.rows)
        ? response.rows.map((row: any) => ({
            ...row,
            parentCanonicalLineId: row.parentCanonicalLineId ? String(row.parentCanonicalLineId) : null,
          }))
        : [];
      setAnalyticsRows(nextRows);
      setAnalyticsPeriods(Array.isArray(response?.periods) ? response.periods : []);
      const firstRow = nextRows[0] || null;
      setSelectedValueId(firstRow?.id || null);
      setSelectedExplain(firstRow?.explain || null);
    } catch (e: any) {
      if (requestSeq !== explainRequestSeq.current) return;
      setAnalyticsRows([]);
      setAnalyticsPeriods([]);
      setSelectedExplain(null);
    } finally {
      if (requestSeq === explainRequestSeq.current) {
        setDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedStatement?.id) {
      setStatementDetail(null);
      setAnalyticsRows([]);
      setAnalyticsPeriods([]);
      return;
    }
    setAggregationLevel(2);
    setShowAdvancedDetail(false);
    setSelectedValueId(null);
    setSelectedExplain(null);
    void loadStatement(selectedStatement.id);
  }, [loadStatement, selectedStatement?.id]);

  useEffect(() => {
    if (!selectedStatement?.id) return;
    void loadAnalytics(selectedStatement.id, aggregationLevel);
  }, [aggregationLevel, loadAnalytics, selectedStatement?.id]);

  useEffect(() => {
    if (!selectedValueId) return;
    if (!analyticsRows.some((row) => row.id === selectedValueId)) {
      setSelectedValueId(null);
      setSelectedExplain(null);
    }
  }, [analyticsRows, selectedValueId]);

  const failCount = packValidations.filter((v) => v.status === 'fail').length;
  const warnCount = packValidations.filter((v) => v.status === 'warning').length;

  if (loading && !detail) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-16 animate-pulse rounded-2xl bg-slate-200/40 dark:bg-white/[0.04]" />
        <SkeletonRows />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-500/10">
          <AlertTriangle size={20} className="text-rose-500" />
        </div>
        <div className="text-sm text-rose-600 dark:text-rose-300">{error}</div>
        <button
          type="button"
          onClick={() => void loadPack()}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.04]"
        >
          <RefreshCw size={12} />
          {isPl ? 'Ponów' : 'Retry'}
        </button>
      </div>
    );
  }

  if (!detail || !packRow) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8">
        <FileText size={24} className="text-slate-400" />
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {t('finance.pack.notFound', 'Statement pack not found')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {/* Compact header */}
      <div className="rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/80">
        <div className="flex items-center gap-4 px-4 py-3">
          {/* Readiness ring */}
          <ReadinessRing score={packRow.readinessScore || 0} />

          {/* Title & metadata */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {packRow.entityName || packRow.title}
              </span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                packRow.status === 'APPROVED'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : packRow.status === 'REVIEW'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400'
              }`}>
                {packRow.status === 'APPROVED'
                  ? (isPl ? 'Gotowy' : 'Ready')
                  : packRow.status === 'REVIEW'
                    ? (isPl ? 'Do naprawy' : 'Recovery')
                    : (isPl ? 'Szkic' : 'Draft')}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{packRow.periodLabel || `${packRow.periodStart} → ${packRow.periodEnd}`}</span>
              <span>{packRow.currency}</span>
              <span>{packRow.scaling}</span>
              <span>{childStatements.length} {isPl ? 'dok.' : 'docs'}</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
            {onCreateModelFromPack && packRow.isWorkable && (
              <button
                type="button"
                onClick={() => onCreateModelFromPack(packRow)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.04]"
              >
                <Calculator size={12} />
                <span className="hidden sm:inline">{isPl ? 'Model' : 'Model'}</span>
              </button>
            )}
            {onCreateAnalysisFromPack && packRow.isWorkable && (
              <button
                type="button"
                onClick={() => onCreateAnalysisFromPack(packRow)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.04]"
              >
                <BarChart3 size={12} />
                <span className="hidden sm:inline">{isPl ? 'Analiza' : 'Analysis'}</span>
              </button>
            )}
          </div>
        </div>

        {/* P&L / BS / CF tabs with line count badges */}
        <div className="flex items-center gap-1 border-t border-slate-200/50 px-4 py-2 dark:border-white/[0.05]" role="tablist">
          {(['P&L', 'BS', 'CF'] as const).map((tab) => {
            const child = statementsByType.get(tab);
            const hasDocument = !!child;
            const isActive = activeTab === tab;
            const mapped = child?.mappedLineCount ?? 0;
            const total = (child?.mappedLineCount ?? 0) + (child?.unmappedLineCount ?? 0);

            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-disabled={!hasDocument}
                onClick={() => hasDocument && setActiveTab(tab)}
                disabled={!hasDocument}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive && hasDocument
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : hasDocument
                      ? 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-white/[0.05]'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {tab}
                {hasDocument && total > 0 && (
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/70 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400'
                  }`}>
                    {mapped}/{total}
                  </span>
                )}
                {!hasDocument && (
                  <span className="text-[10px] font-normal italic">
                    {isPl ? 'brak' : 'n/a'}
                  </span>
                )}
              </button>
            );
          })}

          {/* Missing types warning */}
          {missingStatementTypes.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle size={10} />
              {isPl ? 'Brakuje:' : 'Missing:'} {missingStatementTypes.join(', ')}
            </span>
          )}

          {/* Validation toggle */}
          {packValidations.length > 0 && (
            <button
              type="button"
              onClick={() => setShowValidations((prev) => !prev)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100/70 dark:text-slate-400 dark:hover:bg-white/[0.04]"
            >
              {failCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-100 px-1 text-[9px] font-bold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                  {failCount}
                </span>
              )}
              {warnCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 text-[9px] font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                  {warnCount}
                </span>
              )}
              {showValidations ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>

        {/* Collapsible validations */}
        {showValidations && packValidations.length > 0 && (
          <div className="border-t border-slate-200/50 px-4 py-2 dark:border-white/[0.05]">
            <StatementValidationBadges
              validations={packValidations}
              emptyLabel={isPl ? 'Brak walidacji pakietu.' : 'No pack validations.'}
            />
          </div>
        )}
      </div>

      {/* Statement detail area */}
      {selectedStatement ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main table area */}
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/80">
            {/* Table header with controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 px-4 py-2.5 dark:border-white/[0.06]">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {activeTab}
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-white">
                  {selectedStatement.sourceFileName || selectedStatement.id}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Aggregation segmented control */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {isPl ? 'Agregacja' : 'Aggregation'}
                  </span>
                  <div className="inline-flex items-center rounded-lg border border-slate-200/70 bg-slate-50/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    {([1, 2, 3] as const).map((level) => {
                      const isActive = aggregationLevel === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setAggregationLevel(level)}
                          className={`h-6 min-w-7 rounded-md px-2 text-[11px] font-medium transition-all ${
                            isActive
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                          title={
                            level === 1
                              ? (isPl ? 'Tylko grupy główne' : 'Primary groups only')
                              : level === 2
                                ? (isPl ? 'Grupy i podgrupy' : 'Groups and subgroups')
                                : (isPl ? 'Pełna analityka' : 'Full analytics')
                          }
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Technical details toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvancedDetail((current) => !current)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                  aria-pressed={showAdvancedDetail}
                >
                  {showAdvancedDetail ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span className="hidden sm:inline">
                    {showAdvancedDetail
                      ? (isPl ? 'Ukryj techniczne' : 'Hide technical')
                      : (isPl ? 'Pokaż techniczne' : 'Show technical')}
                  </span>
                </button>
              </div>
            </div>

            {/* Statement validations (inline, compact) */}
            {statementDetail?.validationLedger && statementDetail.validationLedger.length > 0 && (
              <div className="border-b border-slate-200/50 px-4 py-2 dark:border-white/[0.04]">
                <StatementValidationBadges
                  validations={statementDetail.validationLedger}
                  emptyLabel=""
                />
              </div>
            )}

            {/* Table content */}
            <div className="p-3">
              {detailLoading ? (
                <SkeletonRows />
              ) : statementDetail ? (
                <CanonicalStatementTable
                  rows={analyticsRows}
                  periods={analyticsPeriods}
                  selectedValueId={selectedValueId}
                  onSelectRow={(row: FinanceStatementTableRow) => {
                    setSelectedValueId(row.id);
                    setSelectedExplain(row.explain || null);
                  }}
                  lineLabel={isPl ? 'Pozycja' : 'Line item'}
                  valueLabel={isPl ? 'Wartość' : 'Value'}
                  mappingLabel={isPl ? 'Mapowanie' : 'Mapping'}
                  originLabel={isPl ? 'Pochodzenie' : 'Origin'}
                  currency={packRow.currency}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <FileText size={20} className="text-slate-400" />
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPl ? 'Nie udało się załadować tabeli dokumentu.' : 'Could not load document table.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedStatement && void loadStatement(selectedStatement.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300"
                  >
                    <RefreshCw size={10} />
                    {isPl ? 'Ponów' : 'Retry'}
                  </button>
                </div>
              )}
            </div>

            {/* Advanced/technical detail */}
            {showAdvancedDetail && (
              <div className="border-t border-slate-200/70 dark:border-white/[0.08]">
                <FinancialStatementWorkspace
                  statementId={selectedStatement.id}
                  onStatementChanged={async () => {
                    await onStatementChanged?.();
                    await loadPack();
                    await loadStatement(selectedStatement.id);
                  }}
                />
              </div>
            )}
          </div>

          {/* Explain panel */}
          <StatementExplainPanel
            explain={selectedExplain}
            title={isPl ? 'Wyjaśnienie mapowania' : 'Mapping explain'}
            emptyLabel={isPl ? 'Kliknij wiersz, aby zobaczyć źródło i logikę mapowania.' : 'Select a row to inspect evidence and mapping logic.'}
            mappingLabel={isPl ? 'Mapowanie' : 'Mapping'}
            originLabel={isPl ? 'Pochodzenie' : 'Origin'}
            confidenceLabel={isPl ? 'Pewność' : 'Confidence'}
            sourceLabel={isPl ? 'Źródło' : 'Source'}
            noEvidenceLabel={isPl ? 'Brak zapisanych evidence dla tej pozycji.' : 'No stored evidence for this value.'}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200/70 py-12 dark:border-white/[0.08]">
          <FileText size={20} className="text-slate-400" />
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPl ? 'Brak wybranego dokumentu dla tej tabeli.' : 'No document selected for this table.'}
          </div>
        </div>
      )}
    </div>
  );
};
