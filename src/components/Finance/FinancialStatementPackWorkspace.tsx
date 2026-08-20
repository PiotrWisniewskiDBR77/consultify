import {
  AlertTriangle,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronRight,
  FileBarChart,
  FileText,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Upload,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '@/services/api/v8/finance';
import {
  confirmStatementPackCandidateHandoff,
  getStatementPackCandidateHandoff,
  previewStatementPackCandidateHandoff,
} from '@/services/api/v8/financeCandidateHandoffStatementPack';

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
import { FinanceCandidateHandoffModal } from './shared/FinanceCandidateHandoffModal';
import { StatementExplainPanel } from './StatementExplainPanel';
import { StatementValidationBadges } from './StatementValidationBadges';

type StatementTabType = 'P&L' | 'BS' | 'CF';

/** #82g — mirror of server FinanceReportLineage (financeReportSectionService.ts). */
interface FinanceLineageSourcePack {
  packId: string;
  entityName: string | null;
  periodLabel: string | null;
  periodEnd: string | null;
  currency: string;
}
interface FinanceLineageAssumption {
  key: string;
  value: unknown;
  sourceType: string;
  rationale?: string;
}
interface FinanceReportLineageEntry {
  id: string;
  category: 'ratio' | 'reconcile' | 'valuation';
  label: string;
  value: string | null;
  method: string;
  sourcePack: FinanceLineageSourcePack | null;
  assumptions: FinanceLineageAssumption[];
}
interface FinanceReportLineage {
  packId: string | null;
  sourcePack: FinanceLineageSourcePack | null;
  generatedAt: string;
  assumptions: FinanceLineageAssumption[];
  entries: FinanceReportLineageEntry[];
}

/**
 * O4.2-O4.6 — partial FE mirror of the server `FinanceReportSection` (only the fields
 * this panel renders). Surfaces the four engine outputs that had NO reachable UI:
 * scenario levers (O4.2), value tree (O4.3), portfolio advisory (O4.4), trend (O4.6).
 */
interface FinanceReportSectionData {
  headline?: string;
  verdict?: string;
  scenarios?: {
    available: boolean;
    outcomes?: Array<{
      leverId: string;
      leverName?: string;
      metric?: number;
      deltaVsStatusQuo?: number;
      risk?: string;
    }>;
    recommendation?: { chosenId?: string } | null;
  };
  valueTree?: {
    available: boolean;
    forLeverId?: string | null;
    tree?: { gross?: number; components?: unknown[] } | null;
    narrative?: string | null;
  };
  portfolioAdvisory?: {
    available: boolean;
    itemCount?: number;
    advisory?: {
      conclusion?: string;
      budgetVerdict?: string;
      totalCapex?: number;
      sequence?: unknown[];
    } | null;
  };
  trend?: {
    available: boolean;
    lines?: Array<{
      lineCode: string;
      trend?: { periods?: number; direction?: string; cagrPct?: number } | null;
    }>;
    note?: string;
  };
}

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
  onAddFile?: (packId: string) => void;
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

function mapValidation(
  validation: Record<string, unknown>,
  scope: 'statement' | 'pack'
): FinanceStatementValidation {
  return {
    validationScope: scope,
    checkCode: String(validation.check_code || validation.checkCode || ''),
    checkName: String(validation.check_name || validation.checkName || ''),
    severity: String(validation.severity || 'info') as 'info' | 'warning' | 'error',
    status: String(validation.status || 'pass') as 'pass' | 'warning' | 'fail',
    expectedValue:
      validation.expected_value != null
        ? Number(validation.expected_value)
        : validation.expectedValue != null
          ? Number(validation.expectedValue)
          : null,
    actualValue:
      validation.actual_value != null
        ? Number(validation.actual_value)
        : validation.actualValue != null
          ? Number(validation.actualValue)
          : null,
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
    status:
      readinessStatus === 'ready'
        ? 'APPROVED'
        : readinessStatus === 'recoverable'
          ? 'REVIEW'
          : 'DRAFT',
    statementType: 'PACK',
    statementPackId: String(detail.id),
    entityName: String(detail.entity_name || ''),
    periodStart: String(detail.period_start || ''),
    periodEnd: String(detail.period_end || ''),
    periodLabel: String(detail.period_label || ''),
    currency: String(detail.currency || 'PLN'),
    scaling: String(detail.scaling || 'units'),
    sourceFileName: childStatements
      .map((statement) => statement.sourceFileName)
      .filter(Boolean)
      .join(', '),
    validationStatus: String(detail.pack_status || 'pending'),
    mappedLineCount: childStatements.reduce(
      (sum, statement) => sum + Number(statement.mappedLineCount || 0),
      0
    ),
    totalLineCount: childStatements.reduce(
      (sum, statement) => sum + Number(statement.totalLineCount || 0),
      0
    ),
    unmappedLineCount: childStatements.reduce(
      (sum, statement) => sum + Number(statement.unmappedLineCount || 0),
      0
    ),
    sourceStatementCount: Number(detail.source_statement_count ?? childStatements.length),
    statementIds: childStatements.map((statement) => statement.id),
    missingStatementTypes,
    completenessLabel: ['P&L', 'BS', 'CF']
      .map((type) =>
        childStatements.some((statement) => statement.statementType === type) ? type : `—${type}`
      )
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
              classificationReason: value.classification_reason
                ? String(value.classification_reason)
                : null,
              aggregationLevel:
                value.aggregation_level != null ? Number(value.aggregation_level) : null,
              requiredLevel: value.required_level ? String(value.required_level) : null,
              signConvention: value.sign_convention ? String(value.sign_convention) : null,
              isTotal: Boolean(value.is_total),
              isSubtotal: Boolean(value.is_subtotal),
              isComputed: Boolean(value.is_computed),
              deaggregationReady: Boolean(value.deaggregation_ready),
              evidenceJson: parsedEvidence,
              sourceCandidateRowId: value.source_candidate_row_id
                ? String(value.source_candidate_row_id)
                : null,
              selectedMappingCandidateId: value.selected_mapping_candidate_id
                ? String(value.selected_mapping_candidate_id)
                : null,
              valuePeriodLabel: parsedEvidence?.periodLabel
                ? String(parsedEvidence.periodLabel)
                : null,
              valuePeriodIndex: Number(parsedEvidence?.periodIndex ?? 0),
            };
          })
      : [],
    validationLedger: Array.isArray(detail.validationLedger)
      ? detail.validationLedger.map((validation: any) => mapValidation(validation, 'statement'))
      : [],
  };
}

function ReadinessRing({ score, size = 32 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100);
  const radius = (size - 5) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    pct >= 80 ? 'stroke-emerald-500' : pct >= 50 ? 'stroke-amber-500' : 'stroke-danger-500';
  const textColor =
    pct >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : pct >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-danger-600 dark:text-danger-400';

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={2.5}
          className="stroke-slate-200/60 dark:stroke-white/[0.08]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${color} transition-all duration-700 ease-out`}
        />
      </svg>
      <span className={`absolute text-[8px] font-bold tabular-nums ${textColor}`}>{pct}</span>
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
  onAddFile,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const scalingLabel = (scaling: string) => {
    if (scaling === 'units') return isPl ? 'Jednostki' : 'Units';
    if (scaling === 'thousands') return isPl ? 'Tysiące' : 'Thousands';
    if (scaling === 'millions') return isPl ? 'Miliony' : 'Millions';
    return scaling;
  };
  const [detail, setDetail] = useState<PackDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatementTabType>('P&L');
  const [statementDetail, setStatementDetail] = useState<FinanceStatementDetailV1 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
  const [selectedExplain, setSelectedExplain] = useState<FinanceStatementExplain | null>(null);
  const [selectedRow, setSelectedRow] = useState<FinanceStatementTableRow | null>(null);
  const [showAdvancedDetail, setShowAdvancedDetail] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [aggregationLevel, setAggregationLevel] = useState<1 | 2 | 3>(2);
  const [analyticsRows, setAnalyticsRows] = useState<FinanceStatementTableRow[]>([]);
  const [analyticsPeriods, setAnalyticsPeriods] = useState<Array<{ label: string; index: number }>>(
    []
  );
  const [showValidations, setShowValidations] = useState(false);
  // FIN-06: "Send as Initiative Candidate" — via the shared
  // FinanceCandidateHandoffModal, mirroring the same action already
  // available from Investment Case / Valuation Recommendation. No prior
  // agent had wired a Statement Pack entry point yet; this reuses the
  // existing "Model"/"Analysis" quick-action slot in the header bar.
  const [candidateHandoffOpen, setCandidateHandoffOpen] = useState(false);
  // #82g — F5 lineage (skąd/przez co/założenia), lazy-loaded on first toggle.
  const [showLineage, setShowLineage] = useState(false);
  const [lineageLoading, setLineageLoading] = useState(false);
  const [lineage, setLineage] = useState<FinanceReportLineage | null>(null);
  const [lineageLoaded, setLineageLoaded] = useState(false);

  // O4.2-O4.6 — "Generuj sekcję raportu": POST report-section (silnik→papier) + render.
  const [showSection, setShowSection] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [section, setSection] = useState<FinanceReportSectionData | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const statementRequestSeq = useRef(0);
  const explainRequestSeq = useRef(0);

  const getStatementAnalyticsWithFallback = useCallback(
    async (statementId: string, level: 1 | 2 | 3) => {
      try {
        return await V8FinanceApi.getStatementAnalytics(statementId, { level });
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        return (await Api.get(
          `/api/finance-statements/${statementId}/analytics?level=${level}`
        )) as {
          periods?: Array<{ label: string; index: number }>;
          rows?: Array<any>;
        };
      }
    },
    []
  );

  const loadPack = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: PackDetail | null = null;
      try {
        const response = await V8FinanceApi.getStatementPack(statementPackId);
        data = (response?.pack as PackDetail) || null;
      } catch (error: any) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        data =
          ((await Api.get(`/api/finance-statements/packs/${statementPackId}`)) as PackDetail) ||
          null;
      }
      setDetail(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [statementPackId]);

  useEffect(() => {
    void loadPack();
  }, [loadPack]);

  useEffect(() => {
    setLineage(null);
    setLineageLoaded(false);
    setShowLineage(false);
  }, [statementPackId]);

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
      if ((type === 'P&L' || type === 'BS' || type === 'CF') && !next.has(type))
        next.set(type, statement);
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
      let response: unknown;
      try {
        const data = await V8FinanceApi.getStatement(statementId);
        response = data?.statement ?? null;
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        response = await Api.get(`/api/finance-statements/${statementId}`);
      }
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

  const loadAnalytics = useCallback(
    async (statementId: string, level: 1 | 2 | 3) => {
      const requestSeq = ++explainRequestSeq.current;
      setDetailLoading(true);
      try {
        const response = await getStatementAnalyticsWithFallback(statementId, level);
        if (requestSeq !== explainRequestSeq.current) return;
        const nextRows = Array.isArray(response?.rows)
          ? response.rows.map((row: any) => ({
              ...row,
              parentCanonicalLineId: row.parentCanonicalLineId
                ? String(row.parentCanonicalLineId)
                : null,
            }))
          : [];
        setAnalyticsRows(nextRows);
        setAnalyticsPeriods(Array.isArray(response?.periods) ? response.periods : []);
        setSelectedValueId(null);
        setSelectedExplain(null);
        setSelectedRow(null);
      } catch (e: any) {
        if (requestSeq !== explainRequestSeq.current) return;
        setAnalyticsRows([]);
        setAnalyticsPeriods([]);
        setSelectedExplain(null);
        setSelectedRow(null);
      } finally {
        if (requestSeq === explainRequestSeq.current) {
          setDetailLoading(false);
        }
      }
    },
    [getStatementAnalyticsWithFallback]
  );

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
    setSelectedRow(null);
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
      setSelectedRow(null);
    }
  }, [analyticsRows, selectedValueId]);

  const failCount = packValidations.filter((v) => v.status === 'fail').length;
  const warnCount = packValidations.filter((v) => v.status === 'warning').length;

  // #82g — F5 lineage: GET .../report-section/lineage (live, read-only, nic nie publikuje).
  const loadLineage = useCallback(async () => {
    setLineageLoading(true);
    try {
      const response = (await Api.get(
        `/api/finance-statements/packs/${statementPackId}/report-section/lineage`
      )) as { lineage?: FinanceReportLineage } | null;
      setLineage(response?.lineage || null);
    } catch {
      setLineage(null);
    } finally {
      setLineageLoading(false);
      setLineageLoaded(true);
    }
  }, [statementPackId]);

  const toggleLineage = useCallback(() => {
    setShowLineage((prev) => {
      const next = !prev;
      if (next && !lineageLoaded) void loadLineage();
      return next;
    });
  }, [lineageLoaded, loadLineage]);

  // O4.2-O4.6 — compose + publish the finance report section, then render the four
  // engine outputs (scenarios/value-tree/portfolio/trend) that previously had no UI.
  const generateSection = useCallback(async () => {
    setShowSection(true);
    setSectionLoading(true);
    setSectionError(null);
    try {
      const response = (await Api.post(
        `/api/finance-statements/packs/${statementPackId}/report-section`,
        {}
      )) as { section?: FinanceReportSectionData } | null;
      if (response?.section) {
        setSection(response.section);
      } else {
        setSection(null);
        setSectionError(t('finance.pack.section.empty', 'The report section came back empty.'));
      }
    } catch {
      setSection(null);
      setSectionError(
        t('finance.pack.section.failed', 'Could not generate the report section. Please try again.')
      );
    } finally {
      setSectionLoading(false);
    }
  }, [statementPackId, t]);

  const sourceFiles = useMemo(() => {
    return childStatements.map((s) => ({
      id: s.id,
      type: s.statementType,
      fileName: s.sourceFileName || s.id,
      mapped: s.mappedLineCount,
      total: (s.mappedLineCount || 0) + (s.unmappedLineCount || 0),
      status: s.readinessStatus,
      updatedAt: s.updatedAt,
    }));
  }, [childStatements]);

  if (loading && !detail) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-14 animate-pulse rounded-2xl bg-slate-200/40 dark:bg-white/[0.04]" />
        <SkeletonRows />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 dark:bg-danger-500/10">
          <AlertTriangle size={20} className="text-danger-500" />
        </div>
        <div className="text-sm text-danger-600 dark:text-danger-300">{error}</div>
        <button
          type="button"
          onClick={() => void loadPack()}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.04]"
        >
          <RefreshCw size={12} />
          {t('finance.pack.retry', 'Retry')}
        </button>
      </div>
    );
  }

  if (!detail || !packRow) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8">
        <FileText size={24} className="text-slate-600" />
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {t('finance.pack.notFound', 'Statement pack not found')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      {/* ═══ HEADER BAR ═══ */}
      <div className="flex-shrink-0 rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/80">
        {/* Row 1: Entity name + status + quick actions */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <ReadinessRing score={packRow.readinessScore || 0} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {packRow.entityName || packRow.title}
              </span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  packRow.status === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : packRow.status === 'REVIEW'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-400'
                }`}
              >
                {packRow.status === 'APPROVED'
                  ? t('finance.pack.statusReady', 'Ready')
                  : packRow.status === 'REVIEW'
                    ? t('finance.pack.statusRecovery', 'Recovery')
                    : t('finance.pack.statusDraft', 'Draft')}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span>{packRow.periodLabel || `${packRow.periodStart} → ${packRow.periodEnd}`}</span>
              <span>{packRow.currency}</span>
              <span>{scalingLabel(packRow.scaling)}</span>
              <span>
                {childStatements.length} {t('finance.pack.docsAbbrev', 'docs')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onCreateModelFromPack && packRow.isWorkable && (
              <button
                type="button"
                onClick={() => onCreateModelFromPack(packRow)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.04]"
              >
                <Calculator size={12} />
                <span className="hidden sm:inline">Model</span>
              </button>
            )}
            {onCreateAnalysisFromPack && packRow.isWorkable && (
              <button
                type="button"
                onClick={() => onCreateAnalysisFromPack(packRow)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.04]"
              >
                <BarChart3 size={12} />
                <span className="hidden sm:inline">
                  {t('finance.pack.analysisLabel', 'Analysis')}
                </span>
              </button>
            )}
            {/* FIN-06 — "Send as Initiative Candidate". Real eligibility
                (pack_readiness_status === 'ready') is resolved by the shared
                modal's own preview call; this button only gates on the same
                isWorkable condition as its Model/Analysis siblings. */}
            {packRow.isWorkable && (
              <button
                type="button"
                onClick={() => setCandidateHandoffOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.04]"
              >
                <Send size={12} />
                <span className="hidden sm:inline">
                  {t('finance.pack.sendAsCandidate', 'Send as Candidate')}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: P&L/BS/CF tabs (left) + Aggregation + Panel toggle (right) */}
        <div
          className="flex items-center gap-1 border-t border-slate-200/50 px-4 py-1.5 dark:border-white/[0.05]"
          role="tablist"
        >
          {/* Statement type tabs */}
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
                className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  isActive && hasDocument
                    ? 'bg-blue-600 text-white shadow-sm'
                    : hasDocument
                      ? 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-white/[0.05]'
                      : 'text-slate-600 dark:text-slate-500'
                }`}
              >
                {tab}
                {hasDocument && total > 0 && (
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-semibold tabular-nums leading-none ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/70 text-slate-500 dark:bg-white/[0.08] dark:text-slate-400'
                    }`}
                  >
                    {mapped}/{total}
                  </span>
                )}
                {!hasDocument && (
                  <span className="text-[9px] font-normal italic">
                    {t('finance.pack.notApplicable', 'n/a')}
                  </span>
                )}
              </button>
            );
          })}

          {missingStatementTypes.length > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle size={10} />
              {missingStatementTypes.join(', ')}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Validation toggle */}
          {packValidations.length > 0 && (
            <button
              type="button"
              onClick={() => setShowValidations((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-100/70 dark:text-slate-400 dark:hover:bg-white/[0.04]"
            >
              {failCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-100 px-1 text-[9px] font-bold text-danger-600 dark:bg-danger-500/15 dark:text-danger-400">
                  {failCount}
                </span>
              )}
              {warnCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 text-[9px] font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                  {warnCount}
                </span>
              )}
              {showValidations ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}

          {/* #82g — Lineage toggle: skąd/przez co/założenia dla wskaźników+reconcile+EV tej karty raportu */}
          <button
            type="button"
            onClick={toggleLineage}
            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-100/70 dark:text-slate-400 dark:hover:bg-white/[0.04]"
            title={t(
              'finance.pack.sourceLineageTooltip',
              'Source lineage (where this number comes from)'
            )}
          >
            <Search size={11} />
            {showLineage ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>

          {/* O4.2-O4.6 — Generate report section (silnik→papier): scenarios + value tree + portfolio + trend */}
          <button
            type="button"
            onClick={() => {
              if (!showSection) void generateSection();
              else setShowSection(false);
            }}
            disabled={sectionLoading}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 dark:text-c-text-secondary dark:hover:bg-white/[0.04]"
            title={t(
              'finance.pack.section.tooltip',
              'Generate the finance report section (scenarios, value tree, portfolio advisory, trend)'
            )}
          >
            <FileBarChart size={11} />
            <span className="hidden lg:inline">
              {t('finance.pack.section.cta', 'Generate report section')}
            </span>
            {sectionLoading ? (
              <RefreshCw size={11} className="animate-spin" />
            ) : showSection ? (
              <ChevronDown size={11} />
            ) : (
              <ChevronRight size={11} />
            )}
          </button>

          {/* Separator */}
          <div className="mx-1 h-5 w-px bg-slate-200/60 dark:bg-white/[0.06]" />

          {/* Aggregation control */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
              Agg
            </span>
            <div className="inline-flex items-center rounded-md border border-slate-200/70 bg-slate-50/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
              {([1, 2, 3] as const).map((level) => {
                const isActive = aggregationLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setAggregationLevel(level)}
                    className={`h-5 min-w-5 rounded px-1.5 text-[10px] font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel toggle */}
          <button
            type="button"
            onClick={() => setShowSidePanel((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
              showSidePanel
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                : 'text-slate-500 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:bg-white/[0.04]'
            }`}
            aria-pressed={showSidePanel}
            title={t('finance.pack.detailsPanelTooltip', 'Details panel')}
          >
            {showSidePanel ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            <span className="hidden lg:inline">{t('finance.pack.detailsLabel', 'Details')}</span>
          </button>
        </div>

        {/* Collapsible validations */}
        {showValidations && packValidations.length > 0 && (
          <div className="border-t border-slate-200/50 px-4 py-2 dark:border-white/[0.05]">
            <StatementValidationBadges
              validations={packValidations}
              emptyLabel={t('finance.pack.noValidations', 'No pack validations.')}
            />
          </div>
        )}

        {/* #82g — Collapsible lineage (skąd/przez co/założenia) */}
        {showLineage && (
          <div className="border-t border-slate-200/50 dark:border-white/[0.05]">
            {lineageLoading ? (
              <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                {t('finance.pack.loadingLineage', 'Loading source lineage…')}
              </div>
            ) : !lineage || lineage.entries.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'finance.pack.noLineage',
                  'No lineage yet — this pack has no computed ratios/reconcile/valuation.'
                )}
              </div>
            ) : (
              <div className="max-h-64 divide-y divide-c-border/60 overflow-y-auto dark:divide-white/[0.04]">
                {lineage.entries.map((entry) => (
                  <div key={`${entry.category}-${entry.id}`} className="px-4 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-slate-800 dark:text-slate-100">
                        {entry.label}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-300">
                        {entry.value ?? '—'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                      {entry.method}
                    </div>
                    {entry.sourcePack && (
                      <div className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-500">
                        {t('finance.pack.sourcePrefix', 'Source: ')}
                        {entry.sourcePack.entityName || entry.sourcePack.packId}
                        {entry.sourcePack.periodLabel ? ` · ${entry.sourcePack.periodLabel}` : ''}
                      </div>
                    )}
                    {entry.assumptions.length > 0 && (
                      <div className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                        {t('finance.pack.assumptionsPrefix', 'Assumptions: ')}
                        {entry.assumptions.map((a) => `${a.key}=${String(a.value)}`).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {lineage && lineage.assumptions.length > 0 && (
              <div className="border-t border-slate-200/40 px-4 py-2 text-[10px] text-slate-500 dark:border-white/[0.04] dark:text-slate-400">
                {t('finance.pack.sectionAssumptionsPrefix', 'Section assumptions: ')}
                {lineage.assumptions.map((a) => a.key).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* O4.2-O4.6 — Collapsible report-section result (scenarios / value tree / portfolio / trend) */}
        {showSection && (
          <div className="border-t border-c-border dark:border-white/[0.05]">
            {sectionLoading ? (
              <div className="px-4 py-3 text-xs text-c-text-muted">
                {t('finance.pack.section.loading', 'Composing report section…')}
              </div>
            ) : sectionError ? (
              <div className="px-4 py-3 text-xs text-danger-500 dark:text-danger-300">
                {sectionError}
              </div>
            ) : !section ? (
              <div className="px-4 py-3 text-xs text-c-text-muted">
                {t('finance.pack.section.emptyHint', 'No report section yet.')}
              </div>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-3">
                {/* Headline + verdict */}
                {(section.headline || section.verdict) && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[12px] font-medium text-c-text dark:text-c-text">
                      {section.headline}
                    </span>
                    {section.verdict && (
                      <span className="inline-flex shrink-0 rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary dark:bg-white/[0.06] dark:text-c-text-secondary">
                        {section.verdict}
                      </span>
                    )}
                  </div>
                )}

                {/* O4.2 — scenario levers */}
                {section.scenarios?.available && (section.scenarios.outcomes?.length ?? 0) > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                      {t('finance.pack.section.scenarios', 'Scenarios (O4.2)')}
                    </div>
                    <div className="divide-y divide-c-border/60 dark:divide-white/[0.04]">
                      {section.scenarios.outcomes!.map((o) => {
                        const recommended =
                          section.scenarios?.recommendation?.chosenId === o.leverId;
                        return (
                          <div
                            key={o.leverId}
                            className="flex items-center justify-between gap-2 py-1"
                          >
                            <span className="flex items-center gap-1.5 text-[11px] text-c-text-secondary">
                              {recommended && (
                                <span className="inline-flex rounded-full bg-c-success/10 px-1.5 py-0.5 text-[9px] font-semibold text-c-success dark:bg-c-success/10 dark:text-c-success">
                                  {t('finance.pack.section.recommended', 'Recommended')}
                                </span>
                              )}
                              {o.leverName || o.leverId}
                            </span>
                            <span className="tabular-nums text-[11px] text-c-text-secondary">
                              {typeof o.metric === 'number' ? o.metric.toLocaleString() : '—'}
                              {typeof o.deltaVsStatusQuo === 'number' &&
                                o.deltaVsStatusQuo !== 0 && (
                                  <span
                                    className={`ml-1 text-[10px] ${o.deltaVsStatusQuo > 0 ? 'text-c-success' : 'text-danger-500'}`}
                                  >
                                    ({o.deltaVsStatusQuo > 0 ? '+' : ''}
                                    {o.deltaVsStatusQuo.toLocaleString()})
                                  </span>
                                )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* O4.3 — value tree */}
                {section.valueTree?.available && section.valueTree.tree && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                      {t('finance.pack.section.valueTree', 'Value tree (O4.3)')}
                    </div>
                    <div className="text-[11px] text-c-text-secondary">
                      {t('finance.pack.section.grossValue', 'Gross value')}:{' '}
                      <span className="tabular-nums font-medium">
                        {typeof section.valueTree.tree.gross === 'number'
                          ? section.valueTree.tree.gross.toLocaleString()
                          : '—'}
                      </span>
                      {(section.valueTree.tree.components?.length ?? 0) > 0 && (
                        <span className="ml-1 text-c-text-muted">
                          ·{' '}
                          {t('finance.pack.section.components', '{{count}} components', {
                            count: section.valueTree.tree.components!.length,
                          })}
                        </span>
                      )}
                    </div>
                    {section.valueTree.narrative && (
                      <div className="mt-0.5 text-[10px] text-c-text-muted">
                        {section.valueTree.narrative}
                      </div>
                    )}
                  </div>
                )}

                {/* O4.4 — portfolio advisory */}
                {section.portfolioAdvisory?.available && section.portfolioAdvisory.advisory && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                      {t('finance.pack.section.portfolio', 'Portfolio advisory (O4.4)')}
                    </div>
                    <div className="text-[11px] text-c-text-secondary">
                      {t('finance.pack.section.initiatives', '{{count}} initiatives', {
                        count: section.portfolioAdvisory.itemCount ?? 0,
                      })}
                      {section.portfolioAdvisory.advisory.budgetVerdict && (
                        <span className="ml-1 text-c-text-muted">
                          · {section.portfolioAdvisory.advisory.budgetVerdict}
                        </span>
                      )}
                    </div>
                    {section.portfolioAdvisory.advisory.conclusion && (
                      <div className="mt-0.5 text-[10px] text-c-text-muted">
                        {section.portfolioAdvisory.advisory.conclusion}
                      </div>
                    )}
                  </div>
                )}

                {/* O4.6 — trend */}
                {section.trend?.available && (section.trend.lines?.length ?? 0) > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                      {t('finance.pack.section.trend', 'Trend (O4.6)')}
                    </div>
                    <div className="divide-y divide-c-border/60 dark:divide-white/[0.04]">
                      {section.trend
                        .lines!.filter((l) => (l.trend?.periods ?? 0) >= 2)
                        .map((l) => (
                          <div
                            key={l.lineCode}
                            className="flex items-center justify-between gap-2 py-1 text-[11px]"
                          >
                            <span className="text-c-text-secondary">{l.lineCode}</span>
                            <span className="text-c-text-secondary">
                              {l.trend?.direction || '—'}
                              {typeof l.trend?.cagrPct === 'number' && (
                                <span className="ml-1 tabular-nums text-c-text-muted">
                                  {l.trend.cagrPct > 0 ? '+' : ''}
                                  {l.trend.cagrPct.toFixed(1)}%
                                </span>
                              )}
                              <span className="ml-1 text-[10px] text-c-text-muted">
                                ({l.trend?.periods} {t('finance.pack.section.periods', 'periods')})
                              </span>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ CONTENT AREA ═══ */}
      {selectedStatement ? (
        <div
          className={`grid min-h-0 flex-1 gap-2 ${showSidePanel ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : ''}`}
        >
          {/* Main table */}
          <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/80">
            {/* Statement validations (inline, compact) */}
            {statementDetail?.validationLedger && statementDetail.validationLedger.length > 0 && (
              <div className="border-b border-slate-200/50 px-4 py-1.5 dark:border-white/[0.04]">
                <StatementValidationBadges
                  validations={statementDetail.validationLedger}
                  emptyLabel=""
                />
              </div>
            )}

            {/* Table */}
            <div className="flex min-h-0 flex-1 flex-col p-2">
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
                    setSelectedRow(row);
                    if (!showSidePanel) setShowSidePanel(true);
                  }}
                  lineLabel={t('finance.pack.lineItemLabel', 'Line item')}
                  valueLabel={t('finance.pack.valueLabel', 'Value')}
                  mappingLabel={t('finance.pack.mappingLabel', 'Mapping')}
                  originLabel={t('finance.pack.originLabel', 'Origin')}
                  currency={packRow.currency}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <FileText size={20} className="text-slate-600" />
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('finance.pack.couldNotLoadTable', 'Could not load document table.')}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedStatement && void loadStatement(selectedStatement.id)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300"
                  >
                    <RefreshCw size={10} />
                    {t('finance.pack.retry', 'Retry')}
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

          {/* Side panel */}
          {showSidePanel && (
            <div className="flex min-h-0 flex-col">
              {selectedExplain ? (
                <StatementExplainPanel
                  explain={selectedExplain}
                  selectedRow={selectedRow}
                  currency={packRow.currency}
                  title={t('finance.pack.lineItemDetailsTitle', 'Line item details')}
                  emptyLabel={t(
                    'finance.pack.selectRowHint',
                    'Select a row to see line item details.'
                  )}
                  mappingLabel={t('finance.pack.mappingLabel', 'Mapping')}
                  originLabel={t('finance.pack.originLabel', 'Origin')}
                  confidenceLabel={t('finance.pack.confidenceLabel', 'Confidence')}
                  sourceLabel={t('finance.pack.sourceLabel', 'Source')}
                  noEvidenceLabel={t(
                    'finance.pack.noEvidence',
                    'No stored evidence for this value.'
                  )}
                />
              ) : (
                /* Source files list when no row selected */
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm dark:border-white/[0.08] dark:bg-navy-900/90">
                  <div className="flex-shrink-0 border-b border-slate-200/70 px-3 py-2.5 dark:border-white/[0.06]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                      {t('finance.pack.sourceFilesLabel', 'Source files')}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onAddFile?.(statementPackId)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                      >
                        <Upload size={12} />
                        {t('finance.pack.addFile', 'Add file')}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await loadPack();
                          if (selectedStatement?.id) {
                            await loadStatement(selectedStatement.id);
                            await loadAnalytics(selectedStatement.id, aggregationLevel);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                        title={t('finance.pack.recalculateTooltip', 'Recalculate')}
                      >
                        <RotateCcw size={12} />
                        {t('finance.pack.recalcShort', 'Recalc')}
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {sourceFiles.length > 0 ? (
                      <div className="divide-y divide-c-border/60 dark:divide-white/[0.04]">
                        {sourceFiles.map((file) => {
                          const isActiveFile = selectedStatement?.id === file.id;
                          const statusColor =
                            file.status === 'ready'
                              ? 'bg-emerald-400'
                              : file.status === 'recoverable'
                                ? 'bg-amber-400'
                                : 'bg-slate-400';
                          return (
                            <div
                              key={file.id}
                              className={`px-4 py-3 transition-colors ${
                                isActiveFile
                                  ? 'bg-blue-50/50 dark:bg-blue-500/[0.06]'
                                  : 'hover:bg-slate-50/40 dark:hover:bg-white/[0.02]'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100/80 dark:bg-white/[0.05]">
                                  <FileText
                                    size={13}
                                    className="text-slate-500 dark:text-slate-400"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">
                                      {file.fileName}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100/80 px-1.5 py-0.5 font-semibold dark:bg-white/[0.06]">
                                      {file.type}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
                                      {file.status === 'ready'
                                        ? t('finance.pack.statusReady', 'Ready')
                                        : file.status === 'recoverable'
                                          ? t('finance.pack.statusRecovery', 'Recovery')
                                          : t('finance.pack.statusDraft', 'Draft')}
                                    </span>
                                    {file.total > 0 && (
                                      <span className="tabular-nums">
                                        {file.mapped}/{file.total}{' '}
                                        {t('finance.pack.linesAbbrev', 'lines')}
                                      </span>
                                    )}
                                  </div>
                                  {file.total > 0 && (
                                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200/60 dark:bg-white/[0.06]">
                                      <div
                                        className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                        style={{
                                          width: `${file.total > 0 ? (file.mapped / file.total) * 100 : 0}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                        <FileText size={20} className="text-slate-600 dark:text-slate-500" />
                        <div className="text-[12px] text-slate-500 dark:text-slate-400">
                          {t('finance.pack.noSourceFiles', 'No source files.')}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-200/50 px-4 py-2 dark:border-white/[0.05]">
                    <div className="text-[10px] text-slate-600 dark:text-slate-500">
                      {t(
                        'finance.pack.clickRowHint',
                        'Click a table row to see line item details.'
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200/70 py-12 dark:border-white/[0.08]">
          <FileText size={20} className="text-slate-600" />
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('finance.pack.noDocumentSelected', 'No document selected for this table.')}
          </div>
        </div>
      )}
      {candidateHandoffOpen && (
        <FinanceCandidateHandoffModal
          variant="standalone"
          open
          onClose={() => setCandidateHandoffOpen(false)}
          sourceType="finance_statement_pack"
          sourceId={packRow.id}
          preview={() => previewStatementPackCandidateHandoff(packRow.id)}
          confirm={() => confirmStatementPackCandidateHandoff(packRow.id)}
          fetchHandoff={() => getStatementPackCandidateHandoff(packRow.id)}
          // No direct single-candidate deep link exists yet — same honest
          // finding as the Investment Case / Valuation Recommendation call
          // sites (Initiatives' "Kandydaci" tab isn't URL-addressable).
          getReopenLink={() => null}
          title={t('finance.pack.candidateHandoffTitle', 'Statement Pack → Candidate')}
          noticeText={t(
            'finance.pack.candidateHandoffNotice',
            'This sends the Statement Pack to the Candidate inbox for review — it does not create an Initiative directly.'
          )}
          confirmLabel={t('finance.pack.sendAsCandidate', 'Send as Candidate')}
          cancelLabel={t('finance.pack.candidateHandoffCancel', 'Cancel')}
          closeLabel={t('finance.pack.candidateHandoffClose', 'Close')}
          checkingLabel={t('finance.pack.checkingEligibility', 'Checking eligibility...')}
          previewErrorFallback={t(
            'finance.pack.candidateEligibilityFailed',
            'Could not check eligibility'
          )}
          confirmErrorFallback={t(
            'finance.pack.candidateHandoffFailed',
            'Could not create the Candidate'
          )}
          createdMessage={t(
            'finance.pack.candidateCreated',
            'Sent as Initiative candidate: {{title}}'
          )}
          replayMessage={t(
            'finance.pack.candidateAlreadyExists',
            'Already sent as Initiative candidate: {{title}}'
          )}
        />
      )}
    </div>
  );
};
