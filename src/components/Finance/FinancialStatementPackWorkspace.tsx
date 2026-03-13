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

export const FinancialStatementPackWorkspace: React.FC<Props> = ({
  statementPackId,
  onStatementChanged,
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
    if (!selectedStatement?.id) {
      return;
    }
    void loadAnalytics(selectedStatement.id, aggregationLevel);
  }, [aggregationLevel, loadAnalytics, selectedStatement?.id]);

  useEffect(() => {
    if (!selectedValueId) return;
    if (!analyticsRows.some((row) => row.id === selectedValueId)) {
      setSelectedValueId(null);
      setSelectedExplain(null);
    }
  }, [analyticsRows, selectedValueId]);
  const headerTitle =
    selectedStatement?.sourceFileName ||
    (isPl ? `Sprawozdanie ${activeTab}` : `${activeTab} statement`);
  const titleWithPeriods =
    analyticsPeriods.length > 0
      ? `${headerTitle} • ${analyticsPeriods.map((period) => period.label).join(' / ')}`
      : headerTitle;

  if (loading && !detail) {
    return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">{t('common.loading', 'Loading…')}</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-rose-600 dark:text-rose-300">{error}</div>;
  }

  if (!detail || !packRow) {
    return <div className="p-6 text-sm text-slate-500 dark:text-slate-400">{t('finance.pack.notFound', 'Statement pack not found')}</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="text-base font-semibold text-slate-900 dark:text-white">{titleWithPeriods}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['P&L', 'BS', 'CF'] as const).map((tab) => {
            const hasDocument = statementsByType.has(tab);
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => hasDocument && setActiveTab(tab)}
                disabled={!hasDocument}
                className={`h-9 rounded-full px-4 text-sm transition-colors ${
                  isActive && hasDocument
                    ? 'bg-cyan-600 text-white'
                    : hasDocument
                      ? 'border border-slate-200/70 bg-white/80 text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200'
                      : 'border border-dashed border-slate-200/70 bg-slate-50/60 text-slate-400 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-500'
                }`}
              >
                {tab}
                {!hasDocument && <span className="ml-2">{isPl ? 'Brak' : 'Missing'}</span>}
              </button>
            );
          })}
        </div>
        <details className="mt-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <summary className="cursor-pointer list-none text-xs font-medium text-slate-600 dark:text-slate-300">
            {isPl ? 'Szczegóły pakietu' : 'Pack details'}
          </summary>
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {packRow.entityName ? (
                  <div>{packRow.entityName}</div>
                ) : null}
                <div>{packRow.periodLabel || `${packRow.periodStart} → ${packRow.periodEnd}`} • {packRow.currency} • {packRow.scaling}</div>
              </div>
              <div className="rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2 text-right dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {isPl ? 'Liczba plików' : 'Files loaded'}
                </div>
                <div className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white">
                  {childStatements.length}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {childStatements.map((statement) => (
                <div
                  key={statement.id}
                  className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1 text-xs text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-200"
                >
                  <span className="font-medium">{statement.statementType}</span>
                  <span className="mx-1 text-slate-400">•</span>
                  <span className="break-all">{statement.sourceFileName || statement.id}</span>
                </div>
              ))}
            </div>
            {missingStatementTypes.length > 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                {isPl ? 'Brakuje:' : 'Missing:'} {missingStatementTypes.join(', ')}
              </div>
            )}
            <StatementValidationBadges
              validations={packValidations}
              emptyLabel={isPl ? 'Brak walidacji pakietu.' : 'No pack validations.'}
            />
          </div>
        </details>
      </div>

      {selectedStatement ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-3 py-2 dark:border-white/[0.08]">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{activeTab}</div>
                <div className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">
                  {selectedStatement.sourceFileName || selectedStatement.id}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {isPl ? 'Agregacja' : 'Aggregation'}
                </div>
                <div className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-50/80 p-1 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  {[1, 2, 3].map((level) => {
                    const isActive = aggregationLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setAggregationLevel(level as 1 | 2 | 3)}
                        className={`h-6 min-w-7 rounded-full px-2 text-[11px] font-medium transition-colors ${
                          isActive
                            ? 'bg-cyan-600 text-white'
                            : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/[0.06]'
                        }`}
                        title={
                          level === 1
                            ? isPl
                              ? 'Tylko grupy główne'
                              : 'Primary groups only'
                            : level === 2
                              ? isPl
                                ? 'Grupy i podgrupy'
                                : 'Groups and subgroups'
                              : isPl
                                ? 'Pełna analityka'
                                : 'Full analytics'
                        }
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedDetail((current) => !current)}
                  className="h-8 rounded-full border border-slate-200/70 px-3 text-xs text-slate-700 dark:border-white/[0.08] dark:text-slate-200"
                >
                  {showAdvancedDetail
                    ? isPl
                      ? 'Ukryj szczegóły techniczne'
                      : 'Hide technical details'
                    : isPl
                      ? 'Pokaż szczegóły techniczne'
                      : 'Show technical details'}
                </button>
              </div>
            </div>
            <div className="space-y-2 p-3">
              <StatementValidationBadges
                validations={statementDetail?.validationLedger || []}
                emptyLabel={isPl ? 'Brak walidacji tej tabeli.' : 'No table validations.'}
              />

              {detailLoading ? (
                <div className="py-8 text-sm text-slate-500 dark:text-slate-400">{t('common.loading', 'Loading…')}</div>
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
                />
              ) : (
                <div className="py-8 text-sm text-slate-500 dark:text-slate-400">
                  {isPl ? 'Nie udało się załadować tabeli dokumentu.' : 'Could not load document table.'}
                </div>
              )}
            </div>
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

          <StatementExplainPanel
            explain={selectedExplain}
            title={isPl ? 'Wyjaśnienie mapowania' : 'Explain mapping'}
            emptyLabel={isPl ? 'Kliknij wiersz, aby zobaczyć źródło i logikę mapowania.' : 'Select a row to inspect evidence and mapping logic.'}
            mappingLabel={isPl ? 'Mapowanie' : 'Mapping'}
            originLabel={isPl ? 'Pochodzenie' : 'Origin'}
            confidenceLabel={isPl ? 'Pewność' : 'Confidence'}
            sourceLabel={isPl ? 'Źródło' : 'Source'}
            noEvidenceLabel={isPl ? 'Brak zapisanych evidence dla tej pozycji.' : 'No stored evidence for this value.'}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
          {isPl ? 'Brak wybranego dokumentu dla tej tabeli.' : 'No document selected for this table.'}
        </div>
      )}
    </div>
  );
};
