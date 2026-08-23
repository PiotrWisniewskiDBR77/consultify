import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Link2,
  Play,
  Search,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState as SharedLoadingState } from '@/components/shared/states';

import Api from '../../services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '../../services/api/v8/finance';
import {
  deriveStatementReadinessStatus,
  type FinanceStatementRow,
  isWorkableStatement,
} from '../Economics/financeTypes';
import {
  type FinancialStatementCanonicalLineOption,
  type FinancialStatementMappedValue,
  FinancialStatementMappingEditor,
} from './FinancialStatementMappingEditor';
import { statementReasonSentences } from './statementReadinessCopy';

interface StatementDetail {
  id: string;
  statement_type: string;
  period_start: string;
  period_end: string;
  period_label: string;
  currency: string;
  scaling: string;
  source_file_name: string;
  validation_status: string;
  status: string;
  totalLineCount?: number;
  mappedLineCount?: number;
  unmappedLineCount?: number;
  nonFinancialLineCount?: number;
  isWorkable?: boolean;
  readinessStatus?: string;
  readinessScore?: number;
  readinessSummary?: string;
  readinessReasonCodes?: string[];
  document_class?: string;
  extraction_strategy?: string;
  template_family?: string | null;
  values_version?: number;
  qualityRuns?: Array<{
    stage: string;
    result_status: string;
    readiness_status?: string;
    strategy?: string;
    summary?: string;
    reason_codes?: string;
    created_at: string;
  }>;
  ingestRuns?: Array<{
    id: string;
    run_status: string;
    current_stage: string;
    source_file_name?: string;
    parse_method?: string;
    document_class?: string;
    extraction_strategy?: string;
    template_family?: string;
    raw_text_length?: number;
    latest_reason_codes?: string;
    started_at: string;
    completed_at?: string;
  }>;
  extractedSections?: Array<{
    section_key: string;
    section_label?: string;
    statement_type?: string;
    line_start?: number;
    line_end?: number;
    confidence?: number;
    text_excerpt?: string;
    metadata_json?: string;
    created_at: string;
  }>;
  repairSessions?: Array<{
    id: string;
    repair_status: string;
    summary?: string;
    payload_json?: string;
    started_by?: string;
    created_at: string;
    updated_at: string;
  }>;
  mappingCandidates?: Array<{
    candidate_row_id?: string;
    canonical_line_id?: string;
    score?: number;
    match_reason?: string;
    is_selected?: boolean;
    selected_by?: string;
    metadata_json?: string;
    created_at: string;
  }>;
  validationMessages: { type: string; code: string; message: string }[];
  values: Array<{
    id: string;
    canonical_line_id?: string | null;
    line_code?: string;
    line_name?: string;
    line_name_pl?: string;
    original_label: string;
    value: number;
    mapping_status: string;
    confidence?: number;
    source_row?: number;
    is_non_financial?: boolean;
    classification_reason?: string;
  }>;
}

interface RatioResult {
  ratios?: Array<{
    code: string;
    name: string;
    namePl?: string;
    value: number | null;
    status: string;
  }>;
  coverageSummary?: { coveragePct: number; computed: number; total: number };
}

interface DocumentIntelMatch {
  chunkText: string;
  score: number;
  metadata?: Record<string, unknown>;
}

interface RelatedStatementItem {
  id: string;
  statement_type: string;
  period_label?: string;
  period_end?: string;
  source_file_name?: string;
  status?: string;
  readiness_status?: string;
  validation_status?: string;
  mapped_line_count?: number;
  unmapped_line_count?: number;
  total_line_count?: number;
}

interface Props {
  statementId: string;
  onStatementChanged?: () => Promise<void> | void;
  onCreateModelFromStatement?: (row: FinanceStatementRow) => void;
  onCreateAnalysisFromStatements?: (statementIds: string[]) => void;
  onOpenStatement?: (statementId: string) => void;
}

async function getStatementDetailWithFallback(statementId: string) {
  try {
    const data = await V8FinanceApi.getStatement(statementId);
    return data?.statement ?? null;
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/finance-statements/${statementId}`);
  }
}

async function getCanonicalLinesWithFallback() {
  try {
    const data = await V8FinanceApi.getCanonicalLines();
    return Array.isArray(data?.canonicalLines) ? data.canonicalLines : [];
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get('/api/finance-statements/canonical-lines').catch(() => []);
  }
}

async function getStatementRatiosWithFallback(statementId: string) {
  try {
    const data = await V8FinanceApi.getStatementRatios(statementId);
    return (data?.ratios as RatioResult) || null;
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/finance-statements/${statementId}/ratios`).catch(() => null);
  }
}

async function getStatementsListWithFallback() {
  try {
    const data = await V8FinanceApi.getStatements();
    return Array.isArray(data?.statements) ? data.statements : [];
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get('/api/finance-statements').catch(() => []);
  }
}

async function searchStatementDocumentIntelligenceWithFallback(statementId: string, query: string) {
  try {
    const data = await V8FinanceApi.searchStatementDocumentIntelligence(statementId, { q: query });
    return Array.isArray(data?.matches) ? data.matches : [];
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    const response = (await Api.get(
      `/api/finance-statements/${statementId}/document-intelligence/search?q=${encodeURIComponent(query)}`
    )) as { matches?: DocumentIntelMatch[] };
    return Array.isArray(response?.matches) ? response.matches : [];
  }
}

async function confirmStatementWithFallback(statementId: string) {
  return V8FinanceApi.confirmStatementCurrent(statementId);
}

async function detectStatementWithFallback(statementId: string) {
  return V8FinanceApi.detectStatement(statementId, {});
}

async function extractStatementWithFallback(statementId: string) {
  return V8FinanceApi.extractStatement(statementId, {});
}

async function mapStatementWithFallback(
  statementId: string,
  lines: Array<Record<string, unknown>>
) {
  return V8FinanceApi.mapStatement(statementId, { lines });
}

async function saveStatementValuesWithFallback(
  statementId: string,
  values: Array<Record<string, unknown>>
) {
  return V8FinanceApi.putStatementValues(statementId, { values });
}

function mapStatementToRow(detail: StatementDetail): FinanceStatementRow {
  const rawStatus = String(detail.status || 'draft');
  const readinessStatus = deriveStatementReadinessStatus(
    detail.readinessStatus,
    detail.status,
    detail.validation_status,
    detail.mappedLineCount ?? (detail.values || []).filter((value) => value.line_code).length,
    detail.unmappedLineCount ??
      Math.max(
        0,
        Number(detail.totalLineCount ?? (detail.values || []).length) -
          Number(
            detail.mappedLineCount ??
              (detail.values || []).filter((value) => value.line_code).length
          )
      ),
    detail.totalLineCount ?? (detail.values || []).length
  );
  return {
    id: detail.id,
    title: detail.period_label || detail.source_file_name || detail.id,
    kind: 'statements',
    status:
      rawStatus.toLowerCase() === 'confirmed'
        ? 'APPROVED'
        : ['mapped', 'imported'].includes(rawStatus.toLowerCase())
          ? 'REVIEW'
          : 'DRAFT',
    updatedAt: new Date().toISOString(),
    statementType: String(detail.statement_type || ''),
    periodStart: String(detail.period_start || ''),
    periodEnd: String(detail.period_end || ''),
    periodLabel: String(detail.period_label || ''),
    currency: String(detail.currency || 'PLN'),
    scaling: String(detail.scaling || 'units'),
    sourceFileName: String(detail.source_file_name || ''),
    validationStatus: String(detail.validation_status || 'pending'),
    mappedLineCount: Number(
      detail.mappedLineCount ?? (detail.values || []).filter((value) => value.line_code).length
    ),
    totalLineCount: Number(detail.totalLineCount ?? (detail.values || []).length),
    unmappedLineCount: Number(
      detail.unmappedLineCount ??
        Math.max(
          0,
          Number(detail.totalLineCount ?? (detail.values || []).length) -
            Number(
              detail.mappedLineCount ??
                (detail.values || []).filter((value) => value.line_code).length
            )
        )
    ),
    overallConfidence: 0,
    rawStatus,
    readinessStatus,
    readinessScore: Number(detail.readinessScore ?? 0),
    readinessSummary: String(detail.readinessSummary || ''),
    readinessReasonCodes: Array.isArray(detail.readinessReasonCodes)
      ? detail.readinessReasonCodes
      : [],
    documentClass: String(detail.document_class || ''),
    extractionStrategy: String(detail.extraction_strategy || ''),
    templateFamily: detail.template_family || null,
    valuesVersion: Number(detail.values_version ?? 0),
    isWorkable: isWorkableStatement(
      readinessStatus,
      detail.status,
      detail.validation_status,
      detail.mappedLineCount ?? (detail.values || []).filter((value) => value.line_code).length,
      detail.unmappedLineCount ??
        Math.max(
          0,
          Number(detail.totalLineCount ?? (detail.values || []).length) -
            Number(
              detail.mappedLineCount ??
                (detail.values || []).filter((value) => value.line_code).length
            )
        )
    ),
  };
}

export const FinancialStatementWorkspace: React.FC<Props> = ({
  statementId,
  onStatementChanged,
  onCreateModelFromStatement,
  onCreateAnalysisFromStatements,
  onOpenStatement,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const scalingLabel = (scaling: string) => {
    if (scaling === 'units') return isPl ? 'Jednostki' : 'Units';
    if (scaling === 'thousands') return isPl ? 'Tysiące' : 'Thousands';
    if (scaling === 'millions') return isPl ? 'Miliony' : 'Millions';
    return scaling;
  };
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [ratios, setRatios] = useState<RatioResult | null>(null);
  const [canonicalLines, setCanonicalLines] = useState<FinancialStatementCanonicalLineOption[]>([]);
  const [editableValues, setEditableValues] = useState<FinancialStatementMappedValue[]>([]);
  const [allStatements, setAllStatements] = useState<RelatedStatementItem[]>([]);
  const [docQuery, setDocQuery] = useState('');
  const [docMatches, setDocMatches] = useState<DocumentIntelMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingRecovery, setSavingRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statement, ratioData, canonicalLineData, statementList] = await Promise.all([
        getStatementDetailWithFallback(statementId),
        getStatementRatiosWithFallback(statementId),
        getCanonicalLinesWithFallback(),
        getStatementsListWithFallback(),
      ]);
      setDetail(statement as StatementDetail);
      setRatios((ratioData as RatioResult) || null);
      setCanonicalLines(
        ((canonicalLineData as FinancialStatementCanonicalLineOption[]) || []).filter(Boolean)
      );
      setAllStatements(
        Array.isArray(statementList) ? (statementList as RelatedStatementItem[]) : []
      );
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [statementId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEditableValues(
      (detail?.values || [])
        .filter((value) => !value.is_non_financial)
        .map((value) => ({
          originalLabel: value.original_label,
          value: Number(value.value || 0),
          confidence: Number(value.confidence || 0),
          canonicalLineId: value.canonical_line_id || null,
          canonicalLabel: value.line_name || value.line_name_pl || value.line_code || '',
          mappingStatus: value.mapping_status || (value.canonical_line_id ? 'manual' : 'unmapped'),
          sourceRow: value.source_row,
          isNonFinancial: !!value.is_non_financial,
          classificationReason: value.classification_reason,
        }))
    );
  }, [detail]);

  const mappedValues = useMemo(
    () =>
      (detail?.values || [])
        .filter((value) => value.line_code && !value.is_non_financial)
        .slice(0, 20),
    [detail]
  );

  const statementRow = useMemo(() => (detail ? mapStatementToRow(detail) : null), [detail]);
  const isWorkable = statementRow?.isWorkable ?? false;

  const relatedStatements = useMemo(() => {
    if (!detail) return [];
    const currentPeriod = String(detail.period_label || detail.period_end || '').trim();
    const currentPeriodYear = String(detail.period_end || '').slice(0, 4);
    const currentRow: RelatedStatementItem = {
      id: detail.id,
      statement_type: detail.statement_type,
      period_label: detail.period_label,
      period_end: detail.period_end,
      source_file_name: detail.source_file_name,
      status: detail.status,
      readiness_status: detail.readinessStatus,
      validation_status: detail.validation_status,
      mapped_line_count: detail.mappedLineCount,
      unmapped_line_count: detail.unmappedLineCount,
      total_line_count: detail.totalLineCount,
    };

    const merged = [
      currentRow,
      ...allStatements.filter((statement) => String(statement.id) !== detail.id),
    ];
    const unique = Array.from(
      new Map(merged.map((statement) => [String(statement.id), statement])).values()
    );

    return unique
      .sort((a, b) => {
        if (a.id === detail.id) return -1;
        if (b.id === detail.id) return 1;
        const aPeriod = String(a.period_label || a.period_end || '').trim();
        const bPeriod = String(b.period_label || b.period_end || '').trim();
        const aScore =
          (aPeriod === currentPeriod ? 4 : 0) +
          (String(a.period_end || '').slice(0, 4) === currentPeriodYear ? 2 : 0) +
          (a.statement_type !== detail.statement_type ? 1 : 0);
        const bScore =
          (bPeriod === currentPeriod ? 4 : 0) +
          (String(b.period_end || '').slice(0, 4) === currentPeriodYear ? 2 : 0) +
          (b.statement_type !== detail.statement_type ? 1 : 0);
        if (bScore !== aScore) return bScore - aScore;
        return String(b.period_end || '').localeCompare(String(a.period_end || ''));
      })
      .slice(0, 3);
  }, [allStatements, detail]);

  const dataSections = useMemo(
    () => [
      {
        id: 'statement-source-documents',
        icon: FileText,
        label: t('finance.statements.sourceDocuments', 'Source documents'),
        helper: t(
          'finance.statements.sourceDocumentsHelper',
          '3 documents to compare with what the user expected.'
        ),
      },
      {
        id: 'statement-lines-table',
        icon: Database,
        label: t('finance.statements.loadedDataTable', 'Data table'),
        helper: `${isWorkable ? mappedValues.length : editableValues.length} ${t(
          'finance.statements.rows',
          'rows'
        )}`,
      },
      {
        id: 'statement-ratios-table',
        icon: BarChart3,
        label: t('finance.statements.ratiosSection', 'Ratios table'),
        helper: `${Number(ratios?.coverageSummary?.coveragePct || 0).toFixed(0)}%`,
      },
      {
        id: 'statement-validation-table',
        icon: AlertTriangle,
        label: t('finance.statements.validationSection', 'Validation'),
        helper: `${(detail?.validationMessages || []).length}`,
      },
      {
        id: 'statement-quality-runs-table',
        icon: Link2,
        label: t('finance.statements.qualityRunsSection', 'Quality runs'),
        helper: `${(detail?.qualityRuns || []).length}`,
      },
      {
        id: 'statement-ingest-runs-table',
        icon: ExternalLink,
        label: t('finance.statements.ingestRunsSection', 'Import audit'),
        helper: `${(detail?.ingestRuns || []).length}`,
      },
    ],
    [
      detail,
      editableValues.length,
      isWorkable,
      mappedValues.length,
      ratios?.coverageSummary?.coveragePct,
      t,
    ]
  );

  const scrollToSection = useCallback((sectionId: string) => {
    if (typeof document === 'undefined') return;
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!detail) return;
    try {
      await confirmStatementWithFallback(detail.id);
      await load();
      await onStatementChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    }
  }, [detail, load, onStatementChanged]);

  const handleRecomputeRatios = useCallback(async () => {
    try {
      const ratioData = await getStatementRatiosWithFallback(statementId);
      setRatios((ratioData as RatioResult) || null);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    }
  }, [statementId]);

  const handleRetryRecovery = useCallback(async () => {
    if (!detail) return;
    setLoading(true);
    setError(null);
    try {
      await detectStatementWithFallback(detail.id);
      const extracted = (await extractStatementWithFallback(detail.id)) as {
        lines?: Array<{
          originalLabel: string;
          value: number;
          confidence?: number;
          sourceRow?: number;
          isNonFinancial?: boolean;
          classificationReason?: string;
        }>;
      };
      const mapped = (await mapStatementWithFallback(detail.id, extracted?.lines || [])) as {
        mappedLines?: Array<{
          suggestedCanonicalId?: string;
          originalLabel: string;
          value: number;
          confidence?: number;
          sourceRow?: number;
          isNonFinancial?: boolean;
          classificationReason?: string;
        }>;
      };

      await saveStatementValuesWithFallback(
        detail.id,
        (mapped?.mappedLines || []).map((line) => ({
          canonicalLineId: line.suggestedCanonicalId || null,
          originalLabel: line.originalLabel,
          value: line.value,
          confidence: line.confidence ?? 0,
          sourceRow: line.sourceRow,
          mappingStatus: line.suggestedCanonicalId ? 'auto' : 'unmapped',
          isNonFinancial: !!line.isNonFinancial,
          classificationReason: line.classificationReason,
        }))
      );

      await load();
      await onStatementChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [detail, load, onStatementChanged]);

  const handleRecoveryValueChange = useCallback((idx: number, field: string, value: any) => {
    setEditableValues((prev) =>
      prev.map((item, index) => (index === idx ? { ...item, [field]: value } : item))
    );
  }, []);

  const handleRecoveryCanonicalChange = useCallback(
    (idx: number, canonId: string) => {
      const canon = canonicalLines.find((line) => line.id === canonId);
      setEditableValues((prev) =>
        prev.map((item, index) =>
          index === idx
            ? {
                ...item,
                canonicalLineId: canonId || null,
                canonicalLabel: canon?.line_name || canon?.line_name_pl || '',
                mappingStatus: canonId ? 'manual' : 'unmapped',
              }
            : item
        )
      );
    },
    [canonicalLines]
  );

  const handleSaveRecovery = useCallback(async () => {
    if (!detail) return;
    setSavingRecovery(true);
    setError(null);
    try {
      await saveStatementValuesWithFallback(
        detail.id,
        editableValues.map((value) => ({
          canonicalLineId: value.canonicalLineId,
          originalLabel: value.originalLabel,
          value: value.value,
          confidence: value.confidence,
          sourceRow: value.sourceRow,
          mappingStatus: value.mappingStatus,
          isNonFinancial: !!value.isNonFinancial,
          classificationReason: value.classificationReason,
        }))
      );
      await load();
      await onStatementChanged?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setSavingRecovery(false);
    }
  }, [detail, editableValues, load, onStatementChanged]);

  const handleSearchDocumentIntelligence = useCallback(async () => {
    if (!detail || !docQuery.trim()) return;
    try {
      const matches = await searchStatementDocumentIntelligenceWithFallback(
        detail.id,
        docQuery.trim()
      );
      setDocMatches(matches);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    }
  }, [detail, docQuery]);

  if (loading && !detail) {
    return (
      <div className="p-6">
        <SharedLoadingState template="panel" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        {error || t('finance.statements.notFound', 'Statement not found')}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50/30 dark:bg-navy-950/30">
      <div className="p-6 space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {detail.period_label || detail.source_file_name || detail.id}
                </h3>
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {detail.statement_type} • {detail.currency} • {detail.period_start} →{' '}
                {detail.period_end}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {statementRow && isWorkable && onCreateAnalysisFromStatements && (
                <button
                  onClick={() => onCreateAnalysisFromStatements([statementRow.id])}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300"
                >
                  <BarChart3 size={14} />
                  {t('finance.actions.createAnalysis', 'Utwórz analizę')}
                </button>
              )}
              {statementRow && isWorkable && onCreateModelFromStatement && (
                <button
                  onClick={() => onCreateModelFromStatement(statementRow)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  <TrendingUp size={14} />
                  {t('finance.actions.createModelFromStatement', 'Utwórz model')}
                </button>
              )}
              <button
                onClick={handleRecomputeRatios}
                disabled={!isWorkable}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-navy-700 dark:text-slate-200"
              >
                <Play size={14} />
                {t('finance.statements.computeRatios', 'Przelicz ratios')}
              </button>
              {statementRow && !isWorkable && (
                <button
                  onClick={handleRetryRecovery}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-navy-700 dark:text-slate-200"
                >
                  <Play size={14} />
                  {t('finance.statements.retryRecovery', 'Retry recovery')}
                </button>
              )}
              {isWorkable && String(detail.status || '').toLowerCase() !== 'confirmed' && (
                <button
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300"
                >
                  <CheckCircle2 size={14} />
                  {t('finance.actions.confirmStatement', 'Potwierdź statement')}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [t('finance.statements.scaling', 'Scaling'), scalingLabel(detail.scaling)],
              [t('finance.statements.status', 'Status'), detail.status],
              [t('finance.statements.readiness', 'Readiness'), detail.readinessStatus || 'pending'],
              [t('finance.statements.validation', 'Validation'), detail.validation_status],
              [t('finance.statements.sourceFile', 'Source file'), detail.source_file_name || '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 dark:bg-navy-800/70 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {label}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('finance.statements.readiness', 'Readiness')}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {isWorkable
                    ? t('finance.statements.readyForWork', 'Ready to work')
                    : detail.readinessStatus === 'rejected'
                      ? t('finance.statements.rejectedImport', 'Rejected import')
                      : t('finance.statements.notReadyForWork', 'Not ready for work')}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                <div>
                  {t('finance.statements.mappedLines', 'Mapped lines')}:{' '}
                  {statementRow?.mappedLineCount || 0}
                </div>
                <div>
                  {t('finance.statements.unmappedLines', 'Unmapped lines')}:{' '}
                  {statementRow?.unmappedLineCount || 0}
                </div>
                <div>
                  {t('finance.statements.nonFinancialLines', 'Excluded rows')}:{' '}
                  {statementRow?.nonFinancialLineCount || 0}
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {detail.readinessSummary ||
                t(
                  'finance.statements.workableRule',
                  'Only fully mapped and correctly validated financial data is handled in Statements. This import must be corrected before it becomes a working statement.'
                )}
            </div>
            {/* FALA 1 / „surowe identyfikatory w UI" (2026-07-27): tu leciała
                naga lista kodów backendu (`MISSING_PL`, `HAS_PENDING_STATEMENT`).
                Kod błędu nie jest komunikatem — mówimy, czego brakuje. */}
            {!!detail.readinessReasonCodes?.length && (
              <ul className="mt-3 space-y-1">
                {statementReasonSentences(detail.readinessReasonCodes, t).map((sentence) => (
                  <li
                    key={sentence}
                    className="flex items-start gap-1.5 text-[12px] text-slate-600 dark:text-slate-300"
                  >
                    <span aria-hidden="true">•</span>
                    <span>{sentence}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/70 p-4">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-blue-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('finance.statements.systemTables', 'System data tables')}
                </h4>
              </div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t(
                  'finance.statements.systemTablesHint',
                  'Use these quick links to open loaded data sections and compare what the system already contains.'
                )}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {dataSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-navy-700 dark:bg-navy-900 dark:hover:border-blue-700/60 dark:hover:bg-blue-900/10"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                        <Icon size={14} className="text-blue-500" />
                        {section.label}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {section.helper}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              id="statement-source-documents"
              className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/70 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('finance.statements.documentsLoaded', 'Documents loaded into the system')}
                  </h4>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {relatedStatements.length}/3
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t(
                  'finance.statements.documentsLoadedHint',
                  'This is both the loading area and a quick check that the expected statements and tables are present in the system.'
                )}
              </div>
              <div className="mt-4 space-y-2">
                {relatedStatements.map((statement) => {
                  const isCurrent = statement.id === detail.id;
                  return (
                    <button
                      key={statement.id}
                      type="button"
                      onClick={() => !isCurrent && onOpenStatement?.(statement.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        isCurrent
                          ? 'border-blue-300 bg-blue-50 dark:border-blue-700/60 dark:bg-blue-900/20'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 dark:border-navy-700 dark:bg-navy-900 dark:hover:border-blue-700/60 dark:hover:bg-blue-900/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                              {statement.statement_type}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {statement.period_label || statement.period_end || '—'}
                            </span>
                          </div>
                          <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                            {statement.source_file_name || statement.period_label || statement.id}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {t('finance.statements.readiness', 'Readiness')}:{' '}
                            {statement.readiness_status || 'pending'} •{' '}
                            {t('finance.statements.mappedLines', 'Mapped lines')}:{' '}
                            {statement.mapped_line_count || 0} •{' '}
                            {t('finance.statements.unmappedLines', 'Unmapped lines')}:{' '}
                            {statement.unmapped_line_count || 0}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-300">
                          {isCurrent
                            ? t('finance.statements.currentDocument', 'Current')
                            : t('finance.statements.openDocument', 'Open')}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {relatedStatements.length === 0 && (
                  <div className="text-sm text-slate-600">
                    {t(
                      'finance.statements.noRelatedDocuments',
                      'No loaded documents to compare yet'
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-300">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div
            id="statement-lines-table"
            className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {isWorkable
                  ? t('finance.statements.recognizedLines', 'Recognized financial lines')
                  : t('finance.statements.recoveryWorkbench', 'Recovery workbench')}
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">
                  {isWorkable ? mappedValues.length : editableValues.length}
                </span>
                {!isWorkable && (
                  <button
                    onClick={handleSaveRecovery}
                    disabled={savingRecovery}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {savingRecovery
                      ? t('common.loading', 'Loading…')
                      : t('finance.statements.saveRecovery', 'Save recovery')}
                  </button>
                )}
              </div>
            </div>
            {!isWorkable ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-navy-800/70 dark:text-slate-300">
                  {t(
                    'finance.statements.recoveryWorkbenchHint',
                    'Correct mappings here, save a new value version, and move the statement toward ready.'
                  )}
                </div>
                <FinancialStatementMappingEditor
                  mappedValues={editableValues}
                  canonicalLines={canonicalLines}
                  onValueChange={handleRecoveryValueChange}
                  onCanonicalChange={handleRecoveryCanonicalChange}
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table
                  /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full text-sm"
                >
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="pb-2">{t('finance.statements.line', 'Line')}</th>
                      <th className="pb-2">{t('finance.statements.original', 'Original')}</th>
                      <th className="pb-2 text-right">{t('finance.statements.value', 'Value')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.03]">
                    {mappedValues.map((value) => (
                      <tr key={value.id}>
                        <td className="py-2 text-slate-900 dark:text-white">
                          {isPl
                            ? value.line_name_pl || value.line_name || value.line_code
                            : value.line_name || value.line_name_pl || value.line_code}
                        </td>
                        <td className="py-2 text-slate-500 dark:text-slate-400">
                          {value.original_label}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-900 dark:text-white">
                          {Number(value.value || 0).toLocaleString(isPl ? 'pl-PL' : 'en-US')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mappedValues.length === 0 && (
                  <div className="py-6 text-sm text-slate-600">
                    {t('finance.statements.noMappedValues', 'No recognized financial lines yet')}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div
              id="statement-ratios-table"
              className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5"
            >
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {t('finance.statements.ratioCoverage', 'Ratio coverage')}
              </h4>
              <div className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
                {Number(ratios?.coverageSummary?.coveragePct || 0).toFixed(0)}%
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {ratios?.coverageSummary?.computed || 0}/{ratios?.coverageSummary?.total || 0}{' '}
                {t('finance.statements.ratiosComputed', 'ratios computed')}
              </div>
              <div className="mt-4 space-y-2">
                {(ratios?.ratios || [])
                  .filter((ratio) => ratio.value != null)
                  .slice(0, 5)
                  .map((ratio) => (
                    <div key={ratio.code} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300">
                        {isPl ? ratio.namePl || ratio.name : ratio.name}
                      </span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {ratio.value?.toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div
              id="statement-validation-table"
              className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5"
            >
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {t('finance.statements.validationMessages', 'Validation messages')}
              </h4>
              <div className="mt-4 space-y-3">
                {/* FALA 1 (2026-07-27): było `… • MISSING_PL, MISSING_CF,
                    HAS_PENDING_STATEMENT` — surowe kody jako komunikat. */}
                {!!detail.readinessReasonCodes?.length && (
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-navy-800/70 dark:text-slate-300">
                    <div className="font-medium">
                      {t('finance.statements.recoveryQueueLabel', 'Recovery queue')}
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {statementReasonSentences(detail.readinessReasonCodes, t).map((sentence) => (
                        <li key={sentence} className="flex items-start gap-1.5">
                          <span aria-hidden="true">•</span>
                          <span>{sentence}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(detail.validationMessages || []).length === 0 && (
                  <div className="text-sm text-slate-600">
                    {t('finance.statements.noValidationMessages', 'No validation messages')}
                  </div>
                )}
                {(detail.validationMessages || []).map((message) => (
                  <div
                    key={`${message.code}-${message.message}`}
                    className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-navy-800/70 p-3 text-sm"
                  >
                    <AlertTriangle size={14} className="mt-0.5 text-amber-500" />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {message.code}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">{message.message}</div>
                    </div>
                  </div>
                ))}
                {!!(detail.mappingCandidates || []).length && (
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-navy-800/70 dark:text-slate-300">
                    {t('finance.statements.mappingCandidates', 'Mapping candidates')} •{' '}
                    {
                      (detail.mappingCandidates || []).filter((candidate) => !candidate.is_selected)
                        .length
                    }{' '}
                    {t('finance.statements.alternativeCandidates', 'alternatives')}
                  </div>
                )}
                {!!(detail.repairSessions || []).length && (
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-navy-800/70 dark:text-slate-300">
                    {t('finance.statements.repairSessions', 'Repair sessions')} •{' '}
                    {
                      (detail.repairSessions || []).filter(
                        (session) => session.repair_status === 'open'
                      ).length
                    }{' '}
                    {t('finance.statements.open', 'open')}
                  </div>
                )}
              </div>
            </div>

            <div
              id="statement-quality-runs-table"
              className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5"
            >
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {t('finance.statements.qualityRuns', 'Quality runs')}
              </h4>
              <div className="mt-4 space-y-2">
                {(detail.qualityRuns || []).length === 0 && (
                  <div className="text-sm text-slate-600">
                    {t('finance.statements.noQualityRuns', 'No quality runs yet')}
                  </div>
                )}
                {(detail.qualityRuns || []).map((run) => (
                  <div
                    key={`${run.stage}-${run.created_at}`}
                    className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-navy-800/70 dark:text-slate-300"
                  >
                    <div className="font-medium text-slate-900 dark:text-white">
                      {run.stage} • {run.result_status}
                    </div>
                    <div className="mt-1">{run.summary || run.strategy || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              id="statement-ingest-runs-table"
              className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5"
            >
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {t('finance.statements.ingestRuns', 'Ingest runs')}
              </h4>
              <div className="mt-4 space-y-2">
                {(detail.ingestRuns || []).length === 0 && (
                  <div className="text-sm text-slate-600">
                    {t('finance.statements.noIngestRuns', 'No ingest runs yet')}
                  </div>
                )}
                {(detail.ingestRuns || []).map((run) => (
                  <div
                    key={run.id}
                    className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-navy-800/70 dark:text-slate-300"
                  >
                    <div className="font-medium text-slate-900 dark:text-white">
                      {run.current_stage} • {run.run_status}
                    </div>
                    <div className="mt-1">
                      {run.document_class || 'unknown'} • {run.extraction_strategy || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {t('finance.statements.extractedSections', 'Extracted sections')}
              </h4>
              <div className="mt-4 space-y-2">
                {(detail.extractedSections || []).slice(0, 4).map((section) => (
                  <div
                    key={`${section.section_key}-${section.created_at}`}
                    className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-navy-800/70 dark:text-slate-300"
                  >
                    <div className="font-medium text-slate-900 dark:text-white">
                      {section.section_label || section.section_key}
                    </div>
                    <div className="mt-1">
                      {section.line_start || 0} → {section.line_end || 0} •{' '}
                      {Math.round(Number(section.confidence || 0) * 100)}%
                    </div>
                  </div>
                ))}
                {(detail.extractedSections || []).length === 0 && (
                  <div className="text-sm text-slate-600">
                    {t('finance.statements.noExtractedSections', 'No extracted sections yet')}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {t('finance.statements.documentIntelligence', 'Document intelligence')}
              </h4>
              <div className="mt-4 flex gap-2">
                <input
                  value={docQuery}
                  onChange={(event) => setDocQuery(event.target.value)}
                  placeholder={t('finance.statements.documentSearchPlaceholder', 'Ask the report')}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800"
                />
                <button
                  onClick={handleSearchDocumentIntelligence}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-navy-700 dark:text-slate-200"
                >
                  <Search size={14} />
                  {t('common.search', 'Search')}
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {docMatches.length === 0 && (
                  <div className="text-sm text-slate-600">
                    {t('finance.statements.noDocumentMatches', 'No document matches yet')}
                  </div>
                )}
                {docMatches.map((match, index) => (
                  <div
                    key={`${index}-${match.score}`}
                    className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-navy-800/70 dark:text-slate-300"
                  >
                    <div className="font-medium text-slate-900 dark:text-white">
                      {match.score.toFixed(2)}
                    </div>
                    <div className="mt-1 line-clamp-4">{match.chunkText}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
